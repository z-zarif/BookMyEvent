

# Feature 1: Creating a Booking

We will trace this request:

```http
POST /bookings
Authorization: Bearer <customer-jwt>
Content-Type: application/json

{
  "typeId": "TKTT...",
  "qty": 2,
  "promoCode": "TEST10"
}
```

The main route is `bookings.js`, specifically `router.post("/")`.

---

## 1. What starts it?

### Frontend

The user confirms checkout in `Checkout.jsx`.

The frontend constructs:

```js
const payload = { typeId, qty };

if (showPromo && trimmed) {
  payload.promoCode = trimmed.toUpperCase();
}
```

Then it calls:

```js
createBooking(payload);
```

That function is defined in `api.js`:

```js
export const createBooking = (payload) =>
  client.post('/bookings', payload);
```

The request reaches:

```js
router.post("/", verifyToken, async (req, res) => {
```

The route is protected by `verifyToken`.

---

## 2. Who can do it?

### Authentication

Before the booking handler runs, `verifyToken` in `auth.js` does the following:

1. Reads the `Authorization` header.
2. Extracts the JWT.
3. Checks whether the token is in `TOKEN_BLACKLIST`.
4. Verifies the JWT signature using `JWT_SECRET`.
5. Places the decoded user information in:

```js
req.user
```

The booking route gets the user ID from:

```js
const userId = req.user.user_id;
```

So the client does **not** choose the booking owner. The owner comes from the verified token.

### Input validation

The route verifies:

```js
if (!typeId)
```

and:

```js
if (!Number.isInteger(qty) || qty <= 0)
```

Invalid input returns HTTP `400`.

The database also validates many values through:

- primary keys,
- foreign keys,
- `CHECK` constraints,
- unique constraints,
- trigger validation.

---

# 3. Which tables are read or changed?

## Transaction begins

The route obtains one dedicated PostgreSQL client:

```js
const client = await pool.connect();
```

Then starts one transaction:

```js
await client.query("BEGIN");
```

Every database operation for this booking uses this same `client`.

That is important. If the route used `pool.query()` for some statements and `client.query()` for others, those statements might execute on different connections and would not belong to the same transaction.

---

## Step A: Lock and inspect the ticket type

```sql
SELECT
  EVENT_ID,
  PRICE,
  QUANTITY_AVAILABLE,
  STATUS
FROM TICKET_TYPE
WHERE TYPE_ID = $1
FOR UPDATE
```

### Table read

```text
TICKET_TYPE
```

### Why `FOR UPDATE` matters

`FOR UPDATE` locks the selected ticket type until the transaction finishes.

Suppose two customers try to buy the last ticket simultaneously:

```text
Customer A: SELECT ... FOR UPDATE
Customer B: SELECT ... FOR UPDATE
```

Customer A gets the lock first. Customer B waits.

After Customer A commits, Customer B sees the updated availability and cannot oversell the ticket.

This is a database concurrency control technique.

### Application checks

The route checks:

```js
if (ticketRows.length === 0)
```

Then:

```js
if (ticketType.status !== "active")
```

And:

```js
if (ticketType.quantity_available < qty)
```

So the booking fails if:

- the ticket type does not exist,
- it is inactive,
- or there are not enough tickets.

---

## Step B: Calculate seat capacity

The route reads existing tickets:

```sql
SELECT COUNT(*)::int AS sold_count
FROM TICKETS
WHERE TICKET_TYPE_ID = $1
```

Then calculates:

```js
const capacity =
  Number(ticketType.quantity_available) + soldRows[0].sold_count;
```

Conceptually:

```text
original capacity
=
remaining tickets
+
already sold tickets
```

This value is used to generate seat names such as:

```text
1a
1b
1c
...
2a
```

---

## Step C: Create a pending booking

```sql
INSERT INTO BOOKINGS
  (BOOKING_ID, EVENT_ID, USER_ID, BK_STATUS)
VALUES
  (fn_generate_id('BKG'), $1, $2, 'pending')
RETURNING BOOKING_ID
```

### Tables changed

```text
BOOKINGS
```

### Function activated

This SQL calls:

```sql
fn_generate_id('BKG')
```

That function is defined in `triggers.sql`.

It generates an ID using:

```sql
MD5(CLOCK_TIMESTAMP()::TEXT || RANDOM()::TEXT)
```

The result has the prefix:

```text
BKG
```

The booking starts as:

```text
pending
```

It is not confirmed yet because payment has not succeeded.

---

## Step D: Insert each ticket

For every requested ticket, the route:

1. Generates a ticket ID.
2. Finds an unused seat number.
3. Inserts into `TICKETS`.

Example:

```sql
INSERT INTO TICKETS
  (
    TICKET_ID,
    BOOKING_ID,
    TICKET_TYPE_ID,
    SEAT_NUMBER,
    PRICE_PAID
  )
VALUES
  ($1, $2, $3, $4, $5)
```

### Table changed

```text
TICKETS
```

Two important triggers activate during this insert.

---

# 4. What happens automatically?

## Trigger 1: Reserve ticket inventory

The insert activates:

```sql
trg_reserve_ticket
```

This is a:

```sql
BEFORE INSERT ON TICKETS
```

trigger.

It calls:

```sql
fn_reserve_ticket()
```

The function first locks the ticket type:

```sql
SELECT QUANTITY_AVAILABLE, STATUS
FROM TICKET_TYPE
WHERE TYPE_ID = NEW.TICKET_TYPE_ID
FOR UPDATE;
```

Notice the important distinction:

```text
NEW.TICKET_TYPE_ID
```

means the ticket type associated with the ticket currently being inserted.

The function then checks:

```sql
IF v_status <> 'active'
```

and:

```sql
IF v_available <= 0
```

If either condition fails, the ticket insert fails.

If everything is valid, it decreases availability:

```sql
UPDATE TICKET_TYPE
SET QUANTITY_AVAILABLE = QUANTITY_AVAILABLE - 1
WHERE TYPE_ID = NEW.TICKET_TYPE_ID;
```

### Table changed automatically

```text
TICKET_TYPE.QUANTITY_AVAILABLE
```

If availability becomes zero, the `BEFORE UPDATE` trigger also activates:

```sql
trg_ticket_type_auto_status
```

That calls:

```sql
fn_ticket_type_auto_status()
```

It changes:

```text
active → inactive
```

when availability reaches zero.

In your project, `inactive` currently means:

```text
sold out
```

not manually disabled.

---

## Trigger 2: Update booking total

After the ticket insert completes, this trigger activates:

```sql
trg_tickets_sync_booking_total
```

It is defined as:

```sql
AFTER INSERT OR DELETE ON tickets
```

It calls:

```sql
fn_sync_booking_total()
```

The function calculates:

```sql
SELECT SUM(PRICE_PAID)
FROM tickets
WHERE BOOKING_ID = v_booking_id
```

Then updates:

```sql
UPDATE BOOKINGS
SET TOTAL_COST = calculated_ticket_total
WHERE BOOKING_ID = v_booking_id;
```

So the application does not manually calculate and write `BOOKINGS.TOTAL_COST`. The database trigger maintains it.

For quantity `2`, this trigger fires twice:

```text
Insert ticket 1
  → reserve inventory
  → recalculate booking total

Insert ticket 2
  → reserve inventory
  → recalculate booking total
```

After all ticket inserts, the route reads the final total:

```sql
SELECT TOTAL_COST
FROM BOOKINGS
WHERE BOOKING_ID = $1
```

---

# Promo-code processing

If the user entered a promo code, the route runs:

```sql
SELECT
  PROMO_ID,
  DISCOUNT_TYPE,
  DISCOUNT_VALUE
FROM PROMO_CODES
WHERE CODE = $1
  AND STATUS = 'active'
  AND CURRENT_TIMESTAMP BETWEEN VALID_FROM AND VALID_TO
FOR UPDATE
```

### Table read

```text
PROMO_CODES
```

The promo must satisfy all three conditions:

1. Code matches.
2. Status is `active`.
3. Current time is between `VALID_FROM` and `VALID_TO`.

`FOR UPDATE` locks the promo row for this transaction.

### Percentage promo

For `TEST10`:

```js
discount =
  totalCost * (discountValue / 100);
```

For a total of ৳9100:

```text
discount = 9100 × 10% = 910
payable = 9100 - 910 = 8190
```

### Flat promo

For `FLAT500`:

```js
discount = Math.min(discountValue, payable);
```

This prevents the discount from exceeding the booking total.

### Promo redemption record

The route then inserts:

```sql
INSERT INTO PROMO_REDEMPTIONS
  (
    REDEMPTION_ID,
    PROMO_ID,
    BOOKING_ID,
    DISCOUNT_APPLIED
  )
VALUES
  (fn_generate_id('RDM'), $1, $2, $3)
```

### Table changed

```text
PROMO_REDEMPTIONS
```

There is an important database constraint:

```sql
BOOKING_ID CHAR(15) NOT NULL UNIQUE
```

That means one booking cannot use multiple promo codes.

There is no trigger involved here. The application directly inserts the redemption record.

---

# Wallet payment processing

The route looks up the customer wallet:

```sql
SELECT WALLET_ID
FROM WALLETS
WHERE USER_ID = $1
```

### Table read

```text
WALLETS
```

Then it inserts a wallet transaction:

```sql
INSERT INTO WALLET_TRANSACTIONS
  (
    TRANSACTION_ID,
    WALLET_ID,
    TYPE,
    AMOUNT,
    REASON,
    REFERENCE_ID
  )
VALUES
  (
    fn_generate_id('WTX'),
    $1,
    'payment',
    $2,
    'Booking payment',
    $3
  )
```

The route does **not** directly update:

```text
WALLETS.BALANCE
```

Instead, it inserts a transaction and lets a trigger update the balance.

---

## Trigger 3: Apply wallet transaction

The insert activates:

```sql
trg_wallet_transactions_apply
```

This is a:

```sql
BEFORE INSERT ON WALLET_TRANSACTIONS
```

trigger.

It calls:

```sql
fn_apply_wallet_transactions()
```

The function:

1. Validates the transaction type.
2. Validates that the amount is positive.
3. Locks the wallet row.
4. Checks the current balance.
5. Subtracts the amount for a payment.
6. Calculates `BALANCE_AFTER`.
7. Updates the wallet balance.

For a payment:

```sql
v_current_balance := v_current_balance - NEW.AMOUNT;
```

If the wallet has insufficient funds, it raises an exception:

```text
Insufficient balance in wallet ...
```

The `WALLET_TRANSACTIONS` insert then fails, and the entire booking transaction is rolled back.

### Tables changed automatically

```text
WALLETS.BALANCE
WALLETS.LAST_USED
WALLET_TRANSACTIONS.BALANCE_AFTER
```

---

# Payment record

If the wallet transaction succeeds, the route inserts:

```sql
INSERT INTO PAYMENTS
  (
    PAYMENT_ID,
    BOOKING_ID,
    AMOUNT,
    DEBITED_FROM,
    PAYMENT_METHOD
  )
VALUES
  (
    fn_generate_id('PAY'),
    $1,
    $2,
    $3,
    'wallet'
  )
```

### Table changed

```text
PAYMENTS
```

The payment table gives you a permanent record of:

- which booking was paid,
- how much was paid,
- which wallet was charged,
- and which payment method was used.

There is no custom trigger on `PAYMENTS`.

---

# Confirming the booking

The route finally runs:

```sql
UPDATE BOOKINGS
SET BK_STATUS = 'confirmed'
WHERE BOOKING_ID = $1
```

The booking changes:

```text
pending → confirmed
```

At this point the following have succeeded:

```text
booking created
tickets inserted
inventory decreased
booking total calculated
promo redemption recorded, if applicable
wallet charged
payment recorded
booking confirmed
```

---

# 5. What happens if something fails?

At the end of the successful path:

```js
await client.query("COMMIT");
```

The transaction becomes permanent.

If any operation throws an error, execution goes to:

```js
catch (err) {
  await client.query("ROLLBACK");
```

That undoes **all changes made during this booking attempt**.

## Example: invalid promo

The order is:

```text
1. Create pending booking
2. Insert tickets
3. Decrease inventory
4. Invalid promo detected
5. ROLLBACK
```

After rollback:

```text
No booking
No tickets
Inventory restored
No promo redemption
No wallet charge
No payment
```

## Example: insufficient wallet balance

The order is:

```text
1. Create booking
2. Insert tickets
3. Decrease inventory
4. Insert wallet payment transaction
5. Wallet trigger detects insufficient balance
6. ROLLBACK
```

After rollback:

```text
No booking
No tickets
Inventory restored
No wallet transaction
No payment
```

This is why transaction control is essential in this feature.

---

# Complete booking flow

```text
POST /bookings
       |
       v
verifyToken
       |
       v
BEGIN
       |
       v
Lock TICKET_TYPE
       |
       v
Validate availability
       |
       v
Insert BOOKINGS as pending
       |
       v
Insert TICKETS repeatedly
       |
       +--> trg_reserve_ticket
       |        |
       |        +--> decrease ticket availability
       |
       +--> trg_tickets_sync_booking_total
                |
                +--> update booking total
       |
       v
Validate PROMO_CODES
       |
       v
Insert PROMO_REDEMPTIONS
       |
       v
Insert WALLET_TRANSACTIONS
       |
       +--> trg_wallet_transactions_apply
                |
                +--> validate balance
                +--> decrease wallet
                +--> set balance_after
       |
       v
Insert PAYMENTS
       |
       v
Update booking to confirmed
       |
       v
COMMIT
```

---

# Five-answer note for your course

You can write this short note:

### 1. What starts it?

The customer submits checkout data to:

```text
POST /bookings
```

with:

```text
typeId, qty, optional promoCode
```

### 2. Who can do it?

A user must provide a valid customer JWT. The user ID comes from the verified token.

### 3. Which tables change or get read?

Read:

```text
TICKET_TYPE
TICKETS
PROMO_CODES
WALLETS
```

Change:

```text
BOOKINGS
TICKETS
TICKET_TYPE
PROMO_REDEMPTIONS
WALLET_TRANSACTIONS
WALLETS
PAYMENTS
```

### 4. What happens automatically?

- `fn_generate_id()` generates IDs.
- `trg_reserve_ticket` decreases ticket availability.
- `trg_ticket_type_auto_status` marks sold-out types inactive and reactivates released inventory.
- `trg_tickets_sync_booking_total` recalculates the booking total.
- `trg_wallet_transactions_apply` validates and applies wallet payments.

### 5. What happens if something fails?

The route executes `ROLLBACK`, removing all partial booking, ticket, inventory, promo, wallet, and payment changes. It then returns an error response to the frontend.

The most important sentence to remember is:

> The route coordinates the workflow, but the database triggers enforce inventory, totals, and wallet consistency.