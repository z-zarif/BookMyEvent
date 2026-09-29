# Feature 2: Cancelling an Individual Booking

This is the next important booking flow because it reverses many operations from booking creation:

- booking status changes,
- tickets are removed,
- ticket inventory is restored,
- wallet is refunded.

The request starts in the same `bookings.js` file, near the cancellation route.

---

## 1. What starts it?

The user clicks **Cancel** on the My Bookings page.

The frontend sends:

```http
POST /bookings/:bookingId/cancel
Authorization: Bearer <customer-jwt>
```

The route is:

```js
router.post("/:bookingId/cancel", verifyToken, async (req, res) => {
```

It extracts:

```js
const { bookingId } = req.params;
const userId = req.user.user_id;
```

The booking ID comes from the URL, but the user ID comes from the verified JWT.

That is important because the user cannot simply submit another user's ID as their own.

---

# 2. Who can do it?

The route uses:

```js
verifyToken
```

from `auth.js`.

This confirms that:

1. A token exists.
2. The token has not been blacklisted.
3. The token signature is valid.
4. The token has not expired.
5. The user ID is extracted from the token.

However, authentication alone is not enough.

The database procedure also checks ownership:

```sql
IF v_owner_id <> p_user_id THEN
    RAISE EXCEPTION 'Booking % does not belong to user %', ...
        USING ERRCODE = 'BK403';
END IF;
```

So there are two layers:

```text
Frontend route protection
        +
Backend JWT authentication
        +
Database ownership verification
```

The database check is the important security check because users should not be able to cancel someone else's booking by guessing a booking ID.

---

# 3. Transaction begins

The route obtains a dedicated database client:

```js
const client = await pool.connect();
```

Then starts a transaction:

```js
await client.query("BEGIN");
```

The route calls the procedure:

```js
await client.query(
  "CALL cancel_booking($1::char(15), $2::char(15), $3::boolean)",
  [bookingId, userId, true],
);
```

The three procedure parameters are:

```text
p_booking_id
p_user_id
p_enforce_cutoff
```

The last value is `true`, meaning the normal two-day cancellation rule applies.

---

# 4. What does the procedure do?

The procedure is defined in `procedure.sql`.

Its signature is:

```sql
CREATE OR REPLACE PROCEDURE cancel_booking(
    p_booking_id CHAR(15),
    p_user_id CHAR(15),
    p_enforce_cutoff BOOLEAN DEFAULT TRUE
)
```

A procedure is appropriate here because cancellation modifies several related tables as one workflow.

---

## Step A: Find and lock the booking

The procedure executes:

```sql
SELECT B.BK_STATUS, B.USER_ID, E.EVENT_DATE_TIME
INTO v_bk_status, v_owner_id, v_event_date_time
FROM BOOKINGS B
JOIN EVENTS E ON E.EVENT_ID = B.EVENT_ID
WHERE B.BOOKING_ID = p_booking_id
FOR UPDATE;
```

### Tables read

```text
BOOKINGS
EVENTS
```

### Why `FOR UPDATE` is used

The booking row is locked until the transaction ends.

This prevents another transaction from changing or cancelling the same booking simultaneously.

The procedure stores:

```text
v_bk_status
v_owner_id
v_event_date_time
```

---

## Step B: Check that the booking exists

```sql
IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % does not exist', p_booking_id
        USING ERRCODE = 'BK404';
END IF;
```

If no row was returned:

```text
BK404
```

is raised.

The server catches that code and returns:

```http
404 Not Found
```

to the frontend.

---

## Step C: Verify ownership

```sql
IF v_owner_id <> p_user_id THEN
    RAISE EXCEPTION 'Booking % does not belong to user %', ...
        USING ERRCODE = 'BK403';
END IF;
```

This prevents a user from cancelling a booking that belongs to another user.

The server maps `BK403` to:

```http
403 Forbidden
```

---

## Step D: Prevent repeated cancellation

```sql
IF v_bk_status = 'cancelled' THEN
    RAISE EXCEPTION 'Booking % is already cancelled', ...
        USING ERRCODE = 'BK409';
END IF;
```

If a booking is already cancelled, the operation stops.

This prevents:

- a second refund,
- repeated ticket release,
- repeated inventory increase.

The server maps `BK409` to:

```http
409 Conflict
```

This is especially important because cancellation creates a refund. Without this check, repeated requests could credit the wallet multiple times.

---

## Step E: Enforce the two-day cutoff

The procedure checks:

```sql
IF p_enforce_cutoff
   AND v_event_date_time <= CURRENT_TIMESTAMP + INTERVAL '2 days' THEN
    RAISE EXCEPTION 'Bookings cannot be cancelled within 2 days of the event'
        USING ERRCODE = 'BK422';
END IF;
```

When the individual booking route calls the procedure:

```js
p_enforce_cutoff = true
```

Therefore the user cannot cancel within two days of the event.

For event cancellation, the event procedure calls this procedure with:

```sql
p_enforce_cutoff = FALSE
```

That is intentional because an organizer cancelling an entire event must refund customers even if the event is soon.

The server maps `BK422` to:

```http
422 Unprocessable Entity
```

---

## Step F: Find the original payment

The procedure executes:

```sql
SELECT AMOUNT, DEBITED_FROM
INTO v_amount, v_wallet_id
FROM PAYMENTS
WHERE BOOKING_ID = p_booking_id;
```

### Table read

```text
PAYMENTS
```

It stores:

```text
v_amount
v_wallet_id
```

These values are needed to refund the exact amount to the wallet that originally paid.

If there is no payment:

```sql
IF NOT FOUND THEN
    RAISE EXCEPTION 'No payment found for booking %', ...
        USING ERRCODE = 'BK404';
END IF;
```

The cancellation stops before making any changes.

---

# 5. Which tables change?

## Step G: Delete the tickets

```sql
DELETE FROM TICKETS
WHERE BOOKING_ID = p_booking_id;
```

### Table changed

```text
TICKETS
```

All tickets belonging to the booking are removed.

If the booking had three tickets, this deletes three rows.

Two database triggers activate because of each ticket deletion.

---

# 6. What happens automatically when tickets are deleted?

## Trigger 1: Release ticket inventory

The deletion activates:

```sql
trg_release_ticket
```

This trigger is defined as:

```sql
AFTER DELETE ON TICKETS
```

It calls:

```sql
fn_release_ticket()
```

The function executes:

```sql
UPDATE TICKET_TYPE
SET QUANTITY_AVAILABLE = QUANTITY_AVAILABLE + 1
WHERE TYPE_ID = OLD.TICKET_TYPE_ID;
```

`OLD` means the ticket row that is being deleted.

For each cancelled ticket:

```text
quantity_available increases by 1
```

So if three tickets are cancelled:

```text
available quantity increases by 3
```

---

## Trigger 2: Recalculate booking total

The deletion also activates:

```sql
trg_tickets_sync_booking_total
```

It calls:

```sql
fn_sync_booking_total()
```

The function calculates the sum of remaining tickets:

```sql
SELECT SUM(PRICE_PAID)
FROM TICKETS
WHERE BOOKING_ID = v_booking_id
```

After all tickets are deleted, the sum becomes zero.

Then it updates:

```sql
UPDATE BOOKINGS
SET TOTAL_COST = 0
WHERE BOOKING_ID = v_booking_id;
```

So cancellation automatically changes the booking total to zero.

This means the procedure does not need to manually write:

```sql
TOTAL_COST = 0
```

The trigger maintains it.

---

## Trigger 3: Reactivate sold-out ticket type

When ticket inventory is increased, the `BEFORE UPDATE` trigger may activate:

```sql
trg_ticket_type_auto_status
```

It calls:

```sql
fn_ticket_type_auto_status()
```

The trigger handles two cases.

### When inventory reaches zero

```sql
IF NEW.QUANTITY_AVAILABLE <= 0
   AND NEW.STATUS = 'active' THEN
    NEW.STATUS := 'inactive';
```

The ticket type becomes:

```text
active → inactive
```

because it is sold out.

### When inventory is released

```sql
ELSIF OLD.QUANTITY_AVAILABLE = 0
      AND NEW.QUANTITY_AVAILABLE > 0
      AND OLD.STATUS = 'inactive'
      AND NEW.STATUS = 'inactive' THEN
    NEW.STATUS := 'active';
```

The ticket type becomes:

```text
inactive → active
```

because tickets are available again.

In your current design, `inactive` means:

```text
sold out
```

not permanently disabled.

---

# 7. Change booking status

After deleting tickets, the procedure executes:

```sql
UPDATE BOOKINGS
SET BK_STATUS = 'cancelled'
WHERE BOOKING_ID = p_booking_id;
```

### Table changed

```text
BOOKINGS
```

The state changes:

```text
confirmed → cancelled
```

or:

```text
pending → cancelled
```

---

# 8. Create the refund

The procedure inserts:

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
      'refund',
      v_amount,
      'Refund for cancelled booking',
      p_booking_id,
      CURRENT_TIMESTAMP
    );
```

### Table changed

```text
WALLET_TRANSACTIONS
```

The refund contains:

```text
TYPE = refund
AMOUNT = original payment amount
REFERENCE_ID = booking ID
```

The reference ID allows the system to identify which booking caused the refund.

---

# 9. What happens automatically for the refund?

The insert activates:

```sql
trg_wallet_transactions_apply
```

This calls:

```sql
fn_apply_wallet_transactions()
```

The function:

1. Validates the transaction type.
2. Validates that the amount is positive.
3. Locks the wallet row.
4. Reads the current balance.
5. Adds the refund amount.
6. Calculates `BALANCE_AFTER`.
7. Updates the wallet balance.

For a refund:

```sql
v_current_balance := v_current_balance + NEW.AMOUNT;
```

So the wallet balance increases.

The function also updates:

```sql
NEW.BALANCE_AFTER
```

before the wallet transaction row is inserted.

### Automatically changed

```text
WALLETS.BALANCE
WALLETS.LAST_USED
WALLET_TRANSACTIONS.BALANCE_AFTER
```

The application does not directly update the wallet balance.

It inserts a financial transaction, and the trigger applies the balance effect.

---

# 10. Commit or rollback

The route commits after the procedure succeeds:

```js
await client.query("COMMIT");
```

Then it sends:

```json
{
  "message": "Booking cancelled successfully"
}
```

with HTTP status:

```http
200 OK
```

---

## If anything fails

The route catches the error:

```js
catch (err) {
  await client.query("ROLLBACK");
```

The rollback reverses every change made during the cancellation attempt.

For example, if the wallet refund fails after tickets were deleted:

```text
DELETE tickets
  → inventory increases
  → booking status changes
  → refund fails
  → ROLLBACK
```

After rollback:

```text
tickets restored
inventory restored
booking status restored
booking total restored
wallet unchanged
no refund row
```

This is the main reason transaction control is required.

---

# Full individual cancellation flow

```text
POST /bookings/:bookingId/cancel
        |
        v
verifyToken
        |
        v
BEGIN
        |
        v
CALL cancel_booking(...)
        |
        +--> lock booking
        |
        +--> verify existence
        |
        +--> verify ownership
        |
        +--> verify not already cancelled
        |
        +--> verify two-day cutoff
        |
        +--> find original payment
        |
        +--> DELETE TICKETS
        |       |
        |       +--> trg_release_ticket
        |       |       |
        |       |       +--> increase availability
        |       |
        |       +--> trg_tickets_sync_booking_total
        |               |
        |               +--> set booking total to zero
        |
        +--> UPDATE BOOKINGS to cancelled
        |
        +--> INSERT refund WALLET_TRANSACTION
                |
                +--> trg_wallet_transactions_apply
                        |
                        +--> increase wallet balance
                        +--> set balance_after
        |
        v
COMMIT
        |
        v
200 Booking cancelled successfully
```

---

# Five-answer note for your course

### 1. What starts it?

```text
POST /bookings/:bookingId/cancel
```

The booking ID comes from the URL, and the user ID comes from the JWT.

### 2. Who can do it?

A logged-in user can cancel only their own booking. The procedure checks ownership and enforces the two-day cutoff.

### 3. Which tables change or get read?

Read:

```text
BOOKINGS
EVENTS
PAYMENTS
```

Change:

```text
TICKETS
TICKET_TYPE
BOOKINGS
WALLET_TRANSACTIONS
WALLETS
```

### 4. What happens automatically?

- `trg_release_ticket` restores ticket inventory.
- `trg_tickets_sync_booking_total` recalculates the booking total.
- `trg_ticket_type_auto_status` reactivates a sold-out ticket type when inventory returns.
- `trg_wallet_transactions_apply` credits the refund to the wallet.

### 5. What happens if something fails?

The route rolls back the transaction. No partial cancellation, inventory release, booking status change, or wallet refund remains.

The key sentence to remember is:

> Booking cancellation is a multi-table reversal workflow, and the transaction guarantees that either the entire refund succeeds or none of the cancellation changes are kept.