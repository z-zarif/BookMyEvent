
# Feature 4: Admin Approving an Add-Money Request

This flow is a good example of a database trigger performing financial work automatically.

The main files are:

- `admin.js`
- `triggers.sql`
- `schema.sql`

The feature allows a customer to request money to be added to their wallet. An admin approves or rejects that request.

---

## 1. What starts it?

The admin frontend sends:

```http
POST /admin/add-money-requests/:id/approve
```

For example:

```http
POST /admin/add-money-requests/AMR123/approve
Authorization: Bearer <admin-jwt>
```

The request ID comes from:

```js
req.params.id
```

The route is protected because the router uses:

```js
router.use(requireAdminAuth);
```

Therefore, every route in `admin.js` requires admin authentication.

---

# 2. How does the request originally get created?

Before approval, the customer creates an add-money request through the wallet feature.

The request is stored in:

```text
ADD_MONEY_REQUESTS
```

A typical row looks conceptually like:

| REQUEST_ID | USER_ID | AMOUNT | STATUS |
|---|---|---:|---|
| AMR123 | USR001 | 1000.00 | pending |

The important initial status is:

```text
pending
```

The wallet is **not credited yet**.

That is intentional. The requested amount only affects the wallet after an admin approves it.

---

# 3. Admin authentication

Before reaching the approval handler, `requireAdminAuth` checks the admin token.

The admin JWT contains a role similar to:

```json
{
  "role": "admin"
}
```

The middleware verifies:

- the token exists,
- the signature is valid,
- the token is not expired,
- the token represents an administrator.

If authentication fails, the route does not execute any SQL.

This is authorization rather than ordinary customer authentication:

```text
Customer JWT:
identifies a customer

Admin JWT:
authorizes access to administrative operations
```

---

# 4. The route starts a transaction

The approval route obtains one client:

```js
const client = await pool.connect();
```

Then begins a transaction:

```js
await client.query("BEGIN");
```

This is important because approving the request causes multiple database effects:

1. The request status changes.
2. A wallet transaction is inserted by a trigger.
3. The wallet balance changes through another trigger.

All of these changes must succeed together.

The transaction structure is:

```text
BEGIN
  update add-money request
  approval trigger creates wallet deposit
  wallet trigger changes wallet balance
COMMIT
```

If any part fails:

```text
ROLLBACK
```

---

# 5. Conditional approval update

The route executes:

```sql
UPDATE ADD_MONEY_REQUESTS
SET STATUS = 'approved'
WHERE REQUEST_ID = $1
  AND STATUS = 'pending'
RETURNING REQUEST_ID, STATUS, PROCESSED_AT;
```

This statement performs two jobs:

1. It checks that the request exists and is still pending.
2. It changes the status to approved.

The important part is:

```sql
AND STATUS = 'pending'
```

Without this condition, two administrators could approve the same request.

---

# 6. Why the conditional `WHERE` matters

Imagine two admins approve the same request at almost the same time.

### Admin A

```text
checks status → pending
```

### Admin B

```text
checks status → pending
```

If the application uses separate `SELECT` and `UPDATE` statements, both admins may believe they are allowed to approve it.

Then both could cause a deposit.

The safe update is:

```sql
UPDATE ...
WHERE REQUEST_ID = $1
  AND STATUS = 'pending'
```

PostgreSQL locks the row while updating it.

Only one transaction can successfully change:

```text
pending → approved
```

The second transaction finds that the row is no longer pending.

Its `UPDATE` returns zero rows.

The route detects this:

```js
if (result.rows.length === 0) {
```

Then it checks the current status and returns:

```http
409 Conflict
```

For example:

```json
{
  "error": "Request is already approved"
}
```

This prevents duplicate approval.

---

# 7. Approval trigger activation

The update changes:

```text
OLD.STATUS = 'pending'
NEW.STATUS = 'approved'
```

That activates:

```sql
CREATE TRIGGER trg_add_money_request_approved
BEFORE UPDATE ON ADD_MONEY_REQUESTS
FOR EACH ROW
WHEN (OLD.STATUS = 'pending' AND NEW.STATUS = 'approved')
EXECUTE FUNCTION fn_add_money_request_approved();
```

There are two protections here:

## Trigger-level condition

```sql
WHEN (OLD.STATUS = 'pending' AND NEW.STATUS = 'approved')
```

## Function-level condition

```sql
IF OLD.STATUS = 'pending' AND NEW.STATUS = 'approved' THEN
```

Both ensure that a deposit is created only during the actual transition:

```text
pending → approved
```

The trigger does not create a deposit for:

```text
approved → approved
rejected → approved
pending → rejected
```

---

# 8. What does `fn_add_money_request_approved()` do?

The trigger function first finds the user's wallet:

```sql
SELECT WALLET_ID
INTO v_wallet_id
FROM WALLETS
WHERE USER_ID = NEW.USER_ID;
```

The table read is:

```text
WALLETS
```

If the wallet does not exist:

```sql
RAISE EXCEPTION 'No wallet found for user %', NEW.USER_ID;
```

The entire transaction fails and the request remains pending because the route rolls back.

---

## Then it inserts a wallet transaction

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

This creates a financial record such as:

| TYPE | AMOUNT | REASON | REFERENCE_ID |
|---|---:|---|---|
| deposit | 1000.00 | Add money request approved | AMR123 |

The `REFERENCE_ID` links the wallet transaction to the original add-money request.

---

# 9. Wallet transaction trigger activation

Inserting into `WALLET_TRANSACTIONS` activates:

```sql
CREATE TRIGGER trg_wallet_transactions_apply
BEFORE INSERT ON WALLET_TRANSACTIONS
FOR EACH ROW
EXECUTE FUNCTION fn_apply_wallet_transactions();
```

This trigger performs the actual wallet balance update.

The route does not directly execute:

```sql
UPDATE WALLETS
SET BALANCE = BALANCE + amount
```

Instead:

```text
admin approval
    ↓
approval trigger
    ↓
wallet transaction insert
    ↓
wallet balance trigger
    ↓
wallet balance update
```

This centralizes all wallet balance changes in one place.

---

# 10. What does `fn_apply_wallet_transactions()` do?

The function finds and locks the wallet:

```sql
SELECT BALANCE
INTO v_current_balance
FROM WALLETS
WHERE WALLET_ID = NEW.WALLET_ID
FOR UPDATE;
```

The `FOR UPDATE` prevents concurrent wallet updates from using an outdated balance.

For a deposit:

```sql
IF v_type = 'payment' THEN
    ...
ELSE
    v_current_balance := v_current_balance + NEW.AMOUNT;
END IF;
```

Since the transaction type is:

```text
deposit
```

the balance increases.

Then it sets:

```sql
NEW.BALANCE_AFTER := v_current_balance;
```

Finally, it updates:

```sql
UPDATE WALLETS
SET BALANCE = v_current_balance,
    LAST_USED = CURRENT_TIMESTAMP
WHERE WALLET_ID = NEW.WALLET_ID;
```

The resulting data becomes:

```text
old wallet balance: 500.00
deposit:            1000.00
new wallet balance: 1500.00
BALANCE_AFTER:      1500.00
```

---

# 11. Final commit

If all trigger operations succeed:

```js
await client.query("COMMIT");
```

The following changes become permanent:

```text
ADD_MONEY_REQUESTS.STATUS = 'approved'
WALLET_TRANSACTIONS row inserted
WALLETS.BALANCE increased
WALLET_TRANSACTIONS.BALANCE_AFTER populated
ADD_MONEY_REQUESTS.PROCESSED_AT populated
```

The route returns the updated request:

```json
{
  "request_id": "AMR123",
  "status": "approved",
  "processed_at": "..."
}
```

---

# 12. Rejection flow

The rejection endpoint is:

```http
POST /admin/add-money-requests/:id/reject
```

It executes:

```sql
UPDATE ADD_MONEY_REQUESTS
SET STATUS = 'rejected',
    PROCESSED_AT = CURRENT_TIMESTAMP
WHERE REQUEST_ID = $1
  AND STATUS = 'pending'
RETURNING REQUEST_ID, STATUS, PROCESSED_AT;
```

This also uses:

```sql
AND STATUS = 'pending'
```

But it does **not** create a wallet transaction.

The status transition is:

```text
pending → rejected
```

Because the approval trigger only activates for:

```text
pending → approved
```

No deposit is created.

---

# 13. Failure behavior

Consider this sequence:

```text
BEGIN
  update request to approved
  approval trigger runs
  wallet does not exist
  trigger raises exception
ROLLBACK
```

The rollback restores the original state:

```text
request remains pending
no wallet transaction remains
wallet balance is unchanged
```

This is exactly what we want. An approval must never appear successful if the deposit failed.

---

# Complete approval flow

```text
POST /admin/add-money-requests/:id/approve
        |
        v
requireAdminAuth
        |
        v
pool.connect()
        |
        v
BEGIN
        |
        v
UPDATE ADD_MONEY_REQUESTS
WHERE STATUS = 'pending'
        |
        +--> if zero rows:
        |       request missing or already processed
        |
        +--> if successful:
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

# Five-answer note for your course

### 1. What starts it?

```http
POST /admin/add-money-requests/:id/approve
```

An authenticated administrator sends the request.

### 2. Who can do it?

Only a valid admin can access the route.

### 3. Which tables change or get read?

Directly or indirectly:

```text
ADD_MONEY_REQUESTS
WALLETS
WALLET_TRANSACTIONS
```

### 4. What happens automatically?

The status update activates:

```text
trg_add_money_request_approved
```

That inserts a deposit into:

```text
WALLET_TRANSACTIONS
```

The insert activates:

```text
trg_wallet_transactions_apply
```

That updates:

```text
WALLETS.BALANCE
```

### 5. What happens if something fails?

The route rolls back the entire transaction.

The request is not approved unless the wallet deposit and balance update both succeed.

---

## Most important exam explanation

> The admin route only changes the add-money request status. The approval trigger converts that state transition into a wallet deposit, and the wallet transaction trigger applies the deposit to the wallet balance. A single transaction ensures that approval, transaction history, and wallet balance remain consistent.