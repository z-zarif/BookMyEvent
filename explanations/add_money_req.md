# Feature 9: Wallet Add-Money Request

This is the final flow in your chosen sequence.

The important design is:

> The customer does not directly increase the wallet balance. They submit a pending request, and only admin approval triggers the actual deposit.

Main files:

- `wallet.js`
- `admin.js`
- `triggers.sql`
- `schema.sql`
- `Wallet.jsx`

---

# Part A: Customer submits an add-money request

## 1. What starts it?

The customer enters an amount in the wallet page and submits it.

The frontend sends:

```http
POST /wallet/add-money
Authorization: Bearer <customer-jwt>
```

with:

```json
{
  "amount": 1000
}
```

The frontend API helper is:

```js
export const requestAddMoney = (amount) =>
  client.post('/wallet/add-money', { amount });
```

---

# 2. Who can submit it?

The route uses:

```js
router.post("/add-money", verifyToken, async (req, res) => {
```

Therefore, the customer must have a valid JWT.

The user ID is taken from:

```js
req.user.user_id
```

The client cannot submit a request for another user because the server ignores any user ID from the request body.

---

# 3. Validate the amount

The route extracts:

```js
const { amount } = req.body;
```

Then checks:

```js
if (!amount || amount <= 0) {
  return res.status(400).json({
    error: "amount must be greater than 0",
  });
}
```

Invalid values include:

```text
missing amount
0
negative amount
```

The database also protects the value through:

```sql
CHECK (AMOUNT > 0)
```

in `ADD_MONEY_REQUESTS`.

---

# 4. Start a transaction

The route obtains one client:

```js
const client = await pool.connect();
```

Then begins:

```js
await client.query("BEGIN");
```

The request is inserted inside this transaction.

Although the operation currently consists of one insert, the explicit transaction keeps the write behavior consistent with the rest of the project and makes failure handling clear.

---

# 5. Insert the pending request

The route executes:

```sql
INSERT INTO ADD_MONEY_REQUESTS
  (REQUEST_ID, USER_ID, AMOUNT)
VALUES
  (fn_generate_id('AMR'), $1, $2)
RETURNING REQUEST_ID, STATUS;
```

The database generates the request ID using:

```sql
fn_generate_id('AMR')
```

Since `STATUS` is not supplied, the table default applies:

```sql
STATUS DEFAULT 'pending'
```

A new row looks like:

| REQUEST_ID | USER_ID | AMOUNT | STATUS |
|---|---|---:|---|
| AMR... | USR... | 1000.00 | pending |

At this point:

```text
request created
wallet balance unchanged
no wallet transaction created
```

---

# 6. What does `ADD_MONEY_REQUESTS` enforce?

The table is:

```sql
CREATE TABLE ADD_MONEY_REQUESTS (
  REQUEST_ID CHAR(15) PRIMARY KEY,
  USER_ID CHAR(15) NOT NULL
    REFERENCES USERS(USER_ID)
    ON DELETE RESTRICT,
  AMOUNT NUMERIC(10,2) NOT NULL
    CHECK (AMOUNT > 0),
  STATUS VARCHAR(20) DEFAULT 'pending'
    CHECK (
      STATUS IN ('pending', 'approved', 'rejected')
    ),
  REQUESTED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PROCESSED_AT TIMESTAMP
);
```

The database enforces:

## Valid user

The request must belong to an existing user:

```sql
REFERENCES USERS(USER_ID)
```

## Positive amount

```sql
CHECK (AMOUNT > 0)
```

## Valid status

Only these states are allowed:

```text
pending
approved
rejected
```

## Automatic request timestamp

```sql
REQUESTED_AT DEFAULT CURRENT_TIMESTAMP
```

---

# 7. Commit the request

If the insert succeeds:

```js
await client.query("COMMIT");
```

The route returns:

```http
201 Created
```

with:

```json
{
  "request_id": "AMR...",
  "status": "pending"
}
```

If the insert fails:

```js
await client.query("ROLLBACK");
```

No request is created.

---

# Part B: Customer views request history

The customer can request:

```http
GET /wallet/add-money/mine
```

The route executes:

```sql
SELECT
  REQUEST_ID,
  AMOUNT,
  STATUS,
  REQUESTED_AT,
  PROCESSED_AT
FROM ADD_MONEY_REQUESTS
WHERE USER_ID = $1
ORDER BY REQUESTED_AT DESC;
```

Again, `$1` is:

```js
req.user.user_id
```

This ensures that the customer sees only their own requests.

The result may contain:

```text
pending
approved
rejected
```

requests.

---

# Part C: Admin sees the request

The admin frontend requests:

```http
GET /admin/add-money-requests?status=pending
```

The backend joins:

```sql
ADD_MONEY_REQUESTS
JOIN USERS
```

to display:

```text
request ID
amount
status
requested time
customer name
customer email
```

The route is protected by:

```js
router.use(requireAdminAuth);
```

Only the admin can view and process these requests.

---

# Part D: Admin approves the request

The admin sends:

```http
POST /admin/add-money-requests/:id/approve
```

The route starts one transaction:

```js
const client = await pool.connect();
await client.query("BEGIN");
```

Then executes:

```sql
UPDATE ADD_MONEY_REQUESTS
SET STATUS = 'approved'
WHERE REQUEST_ID = $1
  AND STATUS = 'pending'
RETURNING REQUEST_ID, STATUS, PROCESSED_AT;
```

The critical condition is:

```sql
AND STATUS = 'pending'
```

Only a pending request can be approved.

---

# 8. Why approval is conditional

Suppose two admins click approve at the same time.

The first transaction changes:

```text
pending → approved
```

The second transaction then attempts:

```sql
WHERE STATUS = 'pending'
```

but the row is already approved.

The second update returns zero rows.

The route detects that:

```js
result.rows.length === 0
```

Then it checks the current status and returns:

```http
409 Conflict
```

This prevents two approvals from creating two deposits.

---

# 9. Approval trigger

The status update changes:

```text
OLD.STATUS = 'pending'
NEW.STATUS = 'approved'
```

That activates:

```sql
CREATE TRIGGER trg_add_money_request_approved
BEFORE UPDATE ON ADD_MONEY_REQUESTS
FOR EACH ROW
WHEN (
  OLD.STATUS = 'pending'
  AND NEW.STATUS = 'approved'
)
EXECUTE FUNCTION fn_add_money_request_approved();
```

The trigger function:

1. Finds the user's wallet.
2. Inserts a deposit into `WALLET_TRANSACTIONS`.
3. Sets `PROCESSED_AT`.

It finds the wallet using:

```sql
SELECT WALLET_ID
INTO v_wallet_id
FROM WALLETS
WHERE USER_ID = NEW.USER_ID;
```

If no wallet exists, it raises an exception:

```text
No wallet found for user
```

The approval transaction then fails and rolls back.

---

# 10. Deposit transaction insertion

The approval trigger inserts:

```sql
INSERT INTO WALLET_TRANSACTIONS
  (
    TRANSACTION_ID,
    WALLET_ID,
    TYPE,
    AMOUNT,
    REASON,
    REFERENCE_ID,
    HAPPENED_AT
  )
VALUES
  (
    fn_generate_id('WTX'),
    v_wallet_id,
    'deposit',
    NEW.AMOUNT,
    'Add money request approved',
    NEW.REQUEST_ID,
    CURRENT_TIMESTAMP
  );
```

The resulting row records:

```text
transaction type = deposit
amount = requested amount
reference = original request ID
reason = Add money request approved
```

This gives you an audit trail connecting:

```text
admin approval
→ wallet deposit
```

---

# 11. Wallet balance trigger

The insert into `WALLET_TRANSACTIONS` activates:

```sql
CREATE TRIGGER trg_wallet_transactions_apply
BEFORE INSERT ON WALLET_TRANSACTIONS
FOR EACH ROW
EXECUTE FUNCTION fn_apply_wallet_transactions();
```

The trigger function:

1. Locks the wallet row.
2. Reads the current balance.
3. Adds the deposit amount.
4. Sets `BALANCE_AFTER`.
5. Updates the wallet.

Conceptually:

```text
old balance = 10000
deposit     = 1000
new balance = 11000
```

The wallet update is:

```sql
UPDATE WALLETS
SET BALANCE = v_current_balance,
    LAST_USED = CURRENT_TIMESTAMP
WHERE WALLET_ID = NEW.WALLET_ID;
```

The inserted wallet transaction receives:

```text
BALANCE_AFTER = 11000
```

---

# 12. `PROCESSED_AT` is set automatically

Inside the approval trigger function:

```sql
NEW.PROCESSED_AT := CURRENT_TIMESTAMP;
```

Because this is a `BEFORE UPDATE` trigger, changing `NEW.PROCESSED_AT` modifies the row that is about to be written.

The route itself does not need to set this field during approval.

---

# 13. Commit approval

If all of the following succeed:

```text
request status update
wallet lookup
wallet transaction insert
wallet balance update
```

the admin route commits:

```js
await client.query("COMMIT");
```

The final state is:

```text
ADD_MONEY_REQUESTS.STATUS = approved
ADD_MONEY_REQUESTS.PROCESSED_AT = timestamp
WALLET_TRANSACTIONS row exists
WALLETS.BALANCE increased
```

---

# Part E: Admin rejects the request

The admin can also send:

```http
POST /admin/add-money-requests/:id/reject
```

The route executes:

```sql
UPDATE ADD_MONEY_REQUESTS
SET STATUS = 'rejected',
    PROCESSED_AT = CURRENT_TIMESTAMP
WHERE REQUEST_ID = $1
  AND STATUS = 'pending'
RETURNING REQUEST_ID, STATUS, PROCESSED_AT;
```

The transition is:

```text
pending → rejected
```

The approval trigger does not activate because:

```text
NEW.STATUS != approved
```

Therefore:

```text
no WALLET_TRANSACTIONS row
wallet balance unchanged
```

---

# Complete add-money approval flow

```text
Customer submits amount
        |
        v
POST /wallet/add-money
        |
        v
verifyToken
        |
        v
BEGIN
        |
        v
INSERT ADD_MONEY_REQUESTS
        |
        v
STATUS = pending
        |
        v
COMMIT
```

Then:

```text
Admin opens pending requests
        |
        v
POST /admin/add-money-requests/:id/approve
        |
        v
requireAdminAuth
        |
        v
BEGIN
        |
        v
UPDATE request
WHERE STATUS = pending
        |
        v
pending → approved
        |
        v
trg_add_money_request_approved
        |
        v
INSERT WALLET_TRANSACTIONS
        |
        v
trg_wallet_transactions_apply
        |
        v
UPDATE WALLETS balance
        |
        v
COMMIT
```

---

# Failure example

Suppose an admin approves a request, but the user's wallet row is missing.

The sequence becomes:

```text
BEGIN
  request status changes to approved
  approval trigger searches for wallet
  wallet not found
  trigger raises exception
ROLLBACK
```

After rollback:

```text
request remains pending
no deposit exists
wallet balance is unchanged
```

This prevents an approval from being recorded without actually crediting the wallet.

---

# Five-answer note for your course

### 1. What starts it?

Customer:

```http
POST /wallet/add-money
```

Admin:

```http
POST /admin/add-money-requests/:id/approve
```

### 2. Who can do it?

- Any authenticated customer can submit a request for themselves.
- Only an authenticated admin can approve or reject it.

### 3. Which tables change or get read?

Customer submission:

```text
ADD_MONEY_REQUESTS
```

Admin approval:

```text
ADD_MONEY_REQUESTS
WALLET_TRANSACTIONS
WALLETS
```

### 4. What happens automatically?

Approval activates:

```text
trg_add_money_request_approved
```

which inserts a deposit.

That insert activates:

```text
trg_wallet_transactions_apply
```

which updates the wallet balance and `BALANCE_AFTER`.

### 5. What happens if something fails?

The relevant transaction rolls back.

An approval cannot remain successful unless the wallet transaction and wallet balance update also succeed.

---

## Key exam sentence

> Adding money is a two-step approval workflow. The customer creates only a pending request; the admin changes it to approved, which activates a trigger that creates a deposit transaction, and the wallet transaction trigger applies that deposit to the wallet balance. All approval effects occur in one transaction, preventing inconsistent wallet data.