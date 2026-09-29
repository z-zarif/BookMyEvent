

# Feature 3: Cancelling an Entire Event

This flow is more complex than individual booking cancellation because one organizer action may cancel many customer bookings and create many refunds.

The main files are:

- `events.js`
- `procedure.sql`
- `auth.js`

---

## 1. What starts it?

The backend route is:

```http
POST /events/:eventId/cancel
Authorization: Bearer <organizer-jwt>
```

The route is defined as:

```js
router.post('/:eventId/cancel', verifyToken, requireOrganizer, async (req, res) => {
```

It extracts:

```js
const { eventId } = req.params;
const organizerId = req.user.user_id;
```

The event ID comes from the URL.

The organizer ID comes from the authenticated JWT, not from the request body.

---

# 2. Who can do it?

There are three authorization checks.

## Check 1: JWT authentication

`verifyToken` confirms:

- a token exists,
- the token is not blacklisted,
- the token signature is valid,
- the token is not expired.

Then it sets:

```js
req.user = decoded;
```

The route uses:

```js
req.user.user_id
```

as the organizer ID.

---

## Check 2: Organizer membership

The `requireOrganizer` middleware runs before the route handler.

It queries:

```sql
SELECT ORGANIZER_ID
FROM ORGANIZERS
WHERE ORGANIZER_ID = $1
```

If the user is not found in `ORGANIZERS`, the server returns:

```http
403 Organizer access required
```

This ensures an ordinary customer cannot call the event cancellation route.

---

## Check 3: Event ownership inside the procedure

The procedure independently checks:

```sql
IF v_owner_id <> p_organizer_id THEN
    RAISE EXCEPTION 'Event % does not belong to organizer %', ...
        USING ERRCODE = 'EV403';
END IF;
```

This is important because being an organizer does not mean the organizer owns every event.

The user must be:

```text
authenticated
+
an organizer
+
the owner of this specific event
```

---

# 3. Transaction begins

The route obtains one database client:

```js
const client = await pool.connect();
```

Then begins a transaction:

```js
await client.query("BEGIN");
```

The route calls the database procedure using the same client:

```js
await client.query(
  'CALL cancel_event($1, $2)',
  [eventId, organizerId],
);
```

If the procedure succeeds:

```js
await client.query("COMMIT");
```

If anything fails:

```js
await client.query("ROLLBACK");
```

The route owns the transaction.

That design is essential because the event procedure calls the booking cancellation procedure repeatedly.

---

# 4. What does `cancel_event` do?

The procedure is:

```sql
CREATE OR REPLACE PROCEDURE cancel_event(
    p_event_id CHAR(15),
    p_organizer_id CHAR(15)
)
```

It receives:

```text
p_event_id
p_organizer_id
```

It declares:

```sql
v_owner_id
v_status
r RECORD
```

`r` is used to hold one booking row at a time inside the loop.

---

## Step A: Lock and inspect the event

```sql
SELECT ORGANIZER_ID, STATUS
INTO v_owner_id, v_status
FROM EVENTS
WHERE EVENT_ID = p_event_id
FOR UPDATE;
```

### Table read

```text
EVENTS
```

### Why `FOR UPDATE`?

It locks the event row until the transaction ends.

This prevents two cancellation requests from modifying the same event concurrently.

The procedure stores:

```text
v_owner_id
v_status
```

---

## Step B: Check event existence

```sql
IF NOT FOUND THEN
    RAISE EXCEPTION 'Event % does not exist', p_event_id
        USING ERRCODE = 'EV404';
END IF;
```

If the event does not exist, the procedure raises:

```text
EV404
```

The route maps that to:

```http
404 Not Found
```

---

## Step C: Verify event ownership

```sql
IF v_owner_id <> p_organizer_id THEN
    RAISE EXCEPTION 'Event % does not belong to organizer %', ...
        USING ERRCODE = 'EV403';
END IF;
```

This prevents Organizer A from cancelling Organizer B's event.

The route returns:

```http
403 Forbidden
```

---

## Step D: Prevent repeated event cancellation

```sql
IF v_status = 'cancelled' THEN
    RAISE EXCEPTION 'Event % is already cancelled', ...
        USING ERRCODE = 'EV409';
END IF;
```

This prevents:

- cancelling the same event twice,
- refunding customers twice,
- releasing tickets twice,
- increasing inventory incorrectly.

The route maps this to:

```http
409 Conflict
```

---

# 5. Find all eligible bookings

The procedure executes:

```sql
FOR r IN
    SELECT BOOKING_ID, USER_ID
    FROM BOOKINGS
    WHERE EVENT_ID = p_event_id
      AND BK_STATUS IN ('pending', 'confirmed')
    ORDER BY BOOKING_ID
LOOP
    CALL cancel_booking(r.BOOKING_ID, r.USER_ID, FALSE);
END LOOP;
```

### Table read

```text
BOOKINGS
```

It selects every booking for the event whose status is:

```text
pending
or
confirmed
```

The result is ordered by booking ID so the cancellation order is deterministic.

For each booking, it calls:

```sql
CALL cancel_booking(
    r.BOOKING_ID,
    r.USER_ID,
    FALSE
);
```

The third parameter is important:

```text
p_enforce_cutoff = FALSE
```

---

# 6. Why is the cutoff disabled?

For an individual customer cancellation, the two-day cutoff is enforced.

For a complete event cancellation, the organizer must be able to cancel the event even if it is close to the event date.

Therefore:

```text
Individual booking cancellation:
p_enforce_cutoff = TRUE

Event cancellation:
p_enforce_cutoff = FALSE
```

The inner `cancel_booking` procedure still performs:

- booking ownership validation,
- already-cancelled validation,
- payment lookup,
- ticket deletion,
- booking status update,
- refund creation.

It only skips the two-day restriction.

---

# 7. What happens for each booking?

For every booking in the loop:

```text
CALL cancel_booking(...)
```

The inner procedure performs:

1. Lock booking.
2. Verify booking exists.
3. Verify the booking belongs to the selected user.
4. Verify booking is not already cancelled.
5. Find its payment.
6. Delete its tickets.
7. Release ticket inventory through triggers.
8. Recalculate booking total through triggers.
9. Set booking status to `cancelled`.
10. Insert a refund wallet transaction.
11. Increase the wallet through the wallet trigger.

For an event with three bookings:

```text
Booking A → cancelled and refunded
Booking B → cancelled and refunded
Booking C → cancelled and refunded
```

All of this occurs inside the same outer transaction.

---

# 8. Why removing `COMMIT` from `cancel_booking` mattered

Previously, `cancel_booking` contained:

```sql
COMMIT;
```

That was a serious problem.

The outer operation looks like:

```text
BEGIN
  cancel booking A
  COMMIT
  cancel booking B
  failure
ROLLBACK
```

Once booking A had committed, the outer rollback could not undo it.

The result could be:

```text
Booking A refunded
Booking B not refunded
Event still scheduled
```

That is an inconsistent state.

Now `cancel_booking` does **not** commit.

The correct structure is:

```text
BEGIN
  cancel booking A
  cancel booking B
  cancel booking C
  update event status
COMMIT
```

If booking B fails:

```text
BEGIN
  cancel booking A
  cancel booking B → failure
ROLLBACK
```

The changes to booking A are also undone.

This gives event cancellation all-or-nothing behavior.

---

# 9. Update event status

After the booking loop finishes successfully, the procedure executes:

```sql
UPDATE EVENTS
SET STATUS = 'cancelled'
WHERE EVENT_ID = p_event_id;
```

### Table changed

```text
EVENTS
```

The event changes:

```text
scheduled → cancelled
```

Only after this statement succeeds does the route commit.

---

# 10. Successful response

The route executes:

```js
await client.query("COMMIT");
```

Then responds:

```json
{
  "message": "Event cancelled successfully"
}
```

with:

```http
200 OK
```

---

# 11. Failure behavior

Suppose an event has three paid bookings:

```text
Booking A
Booking B
Booking C
```

During cancellation:

```text
Booking A succeeds
Booking B fails because payment is missing
```

The route catches the error:

```js
catch (err) {
  await client.query("ROLLBACK");
}
```

The rollback restores:

```text
Booking A status
Booking A tickets
Booking A inventory
Booking A total cost
Booking A refund
Booking B state
Event status
```

Nothing from the failed event cancellation remains.

This is the key property:

> Event cancellation either refunds every eligible booking and cancels the event, or changes nothing.

---

# Complete event cancellation flow

```text
POST /events/:eventId/cancel
        |
        v
verifyToken
        |
        v
requireOrganizer
        |
        v
BEGIN
        |
        v
CALL cancel_event(eventId, organizerId)
        |
        +--> lock event
        |
        +--> verify event exists
        |
        +--> verify organizer owns event
        |
        +--> verify event is not cancelled
        |
        +--> find pending/confirmed bookings
        |
        +--> for each booking:
        |       |
        |       +--> CALL cancel_booking(..., FALSE)
        |               |
        |               +--> delete tickets
        |               +--> release inventory
        |               +--> update booking total
        |               +--> mark booking cancelled
        |               +--> create wallet refund
        |
        +--> update event status to cancelled
        |
        v
COMMIT
        |
        v
200 Event cancelled successfully
```

---

# Five-answer note for your course

### 1. What starts it?

```text
POST /events/:eventId/cancel
```

The event ID comes from the URL and the organizer ID comes from the JWT.

### 2. Who can do it?

The requester must:

1. Have a valid JWT.
2. Be registered as an organizer.
3. Own the selected event.

### 3. Which tables change or get read?

Read:

```text
EVENTS
BOOKINGS
PAYMENTS
```

Change directly or through triggers:

```text
EVENTS
BOOKINGS
TICKETS
TICKET_TYPE
WALLET_TRANSACTIONS
WALLETS
```

### 4. What happens automatically?

Each inner booking cancellation activates:

- `trg_release_ticket`
- `trg_tickets_sync_booking_total`
- `trg_ticket_type_auto_status`
- `trg_wallet_transactions_apply`

The outer procedure loops over all eligible bookings and finally updates the event status.

### 5. What happens if something fails?

The route rolls back the entire transaction. Earlier refunds and cancellations from the loop are undone as well.

The key sentence to remember is:

> `cancel_event` is an outer multi-booking workflow, so it must own the single transaction while `cancel_booking` performs each individual refund without committing.