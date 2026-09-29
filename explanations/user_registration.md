Search for `register/user|login/user|logout`

# Feature 8: Customer Registration and Login

This flow explains how a visitor becomes a customer and how the system authenticates that customer later.

The main files are:

- `auth.js`
- `auth.js`
- `schema.sql`
- `api.js`
- `AuthContext.jsx`

There are two related operations:

1. Registering a customer
2. Logging in as a customer

---

# Part A: Customer registration

## 1. What starts it?

The frontend sends:

```http
POST /auth/register/user
```

with:

```json
{
  "userName": "Zarif",
  "email": "zarif@example.com",
  "password": "secret",
  "gender": "male"
}
```

The frontend API helper is:

```js
export const registerUser = (userName, email, password, gender) =>
  client.post('/auth/register/user', {
    userName,
    email,
    password,
    gender,
  });
```

This route is public. The visitor does not have a token yet.

---

## 2. Basic request validation

The route extracts:

```js
const { userName, email, password, gender } = req.body;
```

Then checks:

```js
if (!userName || !email || !password || !gender) {
  return res.status(400).json({
    error: "Name, email, password, gender are required",
  });
}
```

If a required value is missing, the database is not accessed.

The route returns:

```http
400 Bad Request
```

---

# 3. Registration transaction begins

The route obtains one database client:

```js
const client = await pool.connect();
```

Then:

```js
await client.query("BEGIN");
```

Registration performs two related inserts:

```text
insert user
insert wallet
```

These must be in the same transaction.

Every newly registered customer needs a wallet because booking payments use wallet records.

---

# 4. Password hashing

Before inserting the user, the plaintext password is hashed:

```js
const passwordHash = await bycrpt.hash(password, 10);
```

The value stored in `USERS.PASSWORD` is therefore not:

```text
secret
```

It is a bcrypt hash similar to:

```text
$2b$10$...
```

The number `10` is the bcrypt cost factor.

The important security rule is:

> The database stores the password hash, not the original password.

---

# 5. Insert the customer

The route executes:

```sql
INSERT INTO USERS
  (
    USER_ID,
    USER_NAME,
    EMAIL,
    PASSWORD,
    GENDER
  )
VALUES
  (
    fn_generate_id('USR'),
    $1,
    $2,
    $3,
    $4
  )
RETURNING USER_ID, USER_NAME, EMAIL;
```

The database generates the ID with:

```sql
fn_generate_id('USR')
```

A successful result returns:

```text
USER_ID
USER_NAME
EMAIL
```

The password is not returned.

---

# 6. What does the `USERS` table enforce?

The table defines:

```sql
CREATE TABLE USERS (
  USER_ID CHAR(15) PRIMARY KEY,
  USER_NAME VARCHAR(40) NOT NULL,
  EMAIL VARCHAR(100) UNIQUE NOT NULL,
  PASSWORD VARCHAR(60) NOT NULL,
  GENDER VARCHAR(20)
    CHECK (
      GENDER IN
      ('male', 'female', 'other', 'prefer_not_to_say')
    ),
  CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ACCOUNT_STATUS VARCHAR(20) DEFAULT 'active'
    CHECK (
      ACCOUNT_STATUS IN ('active', 'deactivated')
    )
);
```

Important constraints:

## Unique email

```sql
EMAIL VARCHAR(100) UNIQUE NOT NULL
```

Two accounts cannot use the same email address.

## Allowed gender values

The database accepts only the values defined by the `CHECK` constraint.

## Default values

The database automatically sets:

```text
CREATED_AT = current timestamp
ACCOUNT_STATUS = active
```

---

# 7. Create the wallet

After the user insert succeeds, the route executes:

```sql
INSERT INTO WALLETS
  (WALLET_ID, USER_ID)
VALUES
  (fn_generate_id('WAL'), $1);
```

The user ID is the ID returned from the first insert.

The wallet table provides a default balance:

```sql
BALANCE NUMERIC(10,2) DEFAULT 10000
```

So a new user receives a wallet with:

```text
balance = 10000
```

The `WALLETS.USER_ID` column is unique, so each user can have only one wallet.

---

# 8. Why user and wallet use one transaction

The correct transaction is:

```text
BEGIN
  insert user
  insert wallet
COMMIT
```

If the wallet insert fails:

```text
ROLLBACK
```

The user insert is also undone.

Without a transaction, this could happen:

```text
user exists
wallet does not exist
```

That would create a customer who cannot reliably make wallet payments.

---

# 9. Create the JWT

After the database transaction commits, the route creates a JWT:

```js
const token = jwt.sign(
  {
    user_id: user.user_id,
    role: "user",
  },
  process.env.JWT_SECRET,
  { expiresIn: "7d" },
);
```

The token payload contains:

```json
{
  "user_id": "USR...",
  "role": "user"
}
```

The JWT does not contain the password.

The response is:

```json
{
  "token": "...",
  "user": {
    "user_id": "USR...",
    "user_name": "Zarif",
    "email": "zarif@example.com"
  }
}
```

The frontend stores the token through the authentication context and uses it for protected requests.

---

# Part B: Customer login

## 1. What starts it?

The frontend sends:

```http
POST /auth/login/user
```

with:

```json
{
  "email": "zarif@example.com",
  "password": "secret"
}
```

The API helper is:

```js
export const loginUser = (email, password) =>
  client.post('/auth/login/user', {
    email,
    password,
  });
```

---

## 2. Validate the request

The route checks:

```js
if (!email || !password) {
  return res.status(400).json({
    error: "Email and Password are required",
  });
}
```

Missing credentials result in:

```http
400 Bad Request
```

---

# 3. Find the user

The route executes:

```sql
SELECT *
FROM USERS
WHERE EMAIL = $1;
```

If no row exists:

```js
if (result.rows.length == 0) {
  return res.status(403).json({
    error: "Email not found, Please signup first",
  });
}
```

The database is used to retrieve the stored bcrypt hash.

---

# 4. Compare the password

The route performs:

```js
const isPasswordCorrect =
  await bycrpt.compare(password, user.password);
```

Bcrypt compares:

```text
plaintext password from request
against
stored bcrypt hash
```

The original password is never retrieved because it was never stored.

If the comparison fails:

```http
401 Unauthorized
```

with:

```json
{
  "error": "Incorrect Password. Please try again"
}
```

---

# 5. Determine the user's role

After verifying the password, the route checks whether the user is also an organizer:

```sql
SELECT ORGANIZER_ID
FROM ORGANIZERS
WHERE ORGANIZER_ID = $1;
```

Then:

```js
const role =
  organizerCheck.rows.length > 0
    ? "organizer"
    : "user";
```

This means the JWT role reflects the database state.

A user who has registered as an organizer receives:

```json
{
  "role": "organizer"
}
```

A normal customer receives:

```json
{
  "role": "user"
}
```

The database row in `ORGANIZERS` is the real authorization evidence. The JWT role helps the frontend display the correct interface, but backend middleware still performs database checks where necessary.

---

# 6. Create the login JWT

The route signs:

```js
const token = jwt.sign(
  {
    user_id: user.user_id,
    role,
  },
  process.env.JWT_SECRET,
  { expiresIn: "7d" },
);
```

Then it removes the password from the response object:

```js
delete user.password;
```

The response contains:

```text
token
user profile
```

but not the password hash.

---

# Authentication versus authorization

These are different concepts.

## Authentication

Answers:

```text
Who is this user?
```

Examples:

- verifying the JWT,
- checking the password,
- finding the user by email.

## Authorization

Answers:

```text
What is this authenticated user allowed to do?
```

Examples:

- checking whether the user exists in `ORGANIZERS`,
- checking whether the organizer owns an event,
- checking whether the token has admin role.

A valid customer token alone does not allow event creation.

The user must also be an organizer.

---

# How protected routes use the token

For a protected route, the frontend sends:

```http
Authorization: Bearer <jwt>
```

The middleware:

```js
verifyToken
```

extracts the token and checks whether it is blacklisted:

```sql
SELECT 1
FROM TOKEN_BLACKLIST
WHERE TOKEN = $1;
```

Then it verifies the JWT:

```js
const decoded = jwt.verify(
  token,
  process.env.JWT_SECRET,
);
```

Finally:

```js
req.user = decoded;
```

Protected routes can then use:

```js
req.user.user_id
```

to identify the customer.

---

# Current logout detail

The database contains:

```sql
TOKEN_BLACKLIST
```

and `verifyToken` checks it.

However, the customer logout route is currently commented out/removed from `auth.js`.

Therefore, the current frontend logout behavior removes the token locally, but it does not actively insert that token into `TOKEN_BLACKLIST`.

This means:

```text
local logout:
token removed from browser

server-side invalidation:
not currently performed by a logout route
```

The token would technically remain valid until it expires if someone still possessed it.

That is an important distinction when explaining the current implementation.

---

# Complete registration flow

```text
Visitor submits registration form
        |
        v
POST /auth/register/user
        |
        v
validate required fields
        |
        v
BEGIN
        |
        v
bcrypt.hash(password)
        |
        v
INSERT USERS
        |
        v
INSERT WALLETS
        |
        v
COMMIT
        |
        v
jwt.sign(user_id, role)
        |
        v
return token and user
```

---

# Complete login flow

```text
Customer submits email and password
        |
        v
POST /auth/login/user
        |
        v
validate credentials
        |
        v
SELECT USERS WHERE EMAIL = $1
        |
        v
bcrypt.compare(password, stored hash)
        |
        v
SELECT ORGANIZERS to determine role
        |
        v
jwt.sign(user_id, role)
        |
        v
remove password from response
        |
        v
return token and user
```

---

# Five-answer note for your course

### 1. What starts it?

Registration:

```http
POST /auth/register/user
```

Login:

```http
POST /auth/login/user
```

### 2. Who can do it?

Registration is public.

Login is public, but the supplied credentials must match an existing customer.

### 3. Which tables change or get read?

Registration writes:

```text
USERS
WALLETS
```

Login reads:

```text
USERS
ORGANIZERS
```

Protected requests may read:

```text
TOKEN_BLACKLIST
```

### 4. What happens automatically?

The system:

- hashes passwords using bcrypt,
- generates IDs using `fn_generate_id`,
- sets default timestamps,
- sets a default wallet balance,
- enforces unique email addresses,
- creates a signed JWT after successful registration or login.

### 5. What happens if something fails?

Registration rolls back both the user and wallet insert.

Login returns an authentication error without changing database state.

---

## Key exam sentence

> Registration is a transactional write operation that creates both a user and their wallet atomically, while login is a read-and-verify operation that compares a submitted password against a bcrypt hash and issues a JWT containing the authenticated user identity and role.