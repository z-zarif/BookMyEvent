# Feature 6: Wishlist

The wishlist flow is simpler than booking, but it demonstrates:

- authenticated user ownership,
- composite primary keys,
- foreign keys,
- idempotent inserts,
- transactions for writes,
- cascading deletes.

The main files are:

- `wishlist.js`
- `Wishlist.jsx`
- `schema.sql`

---

# 1. What starts it?

There are three wishlist operations.

## View wishlist

```http
GET /wishlist
```

## Add an event

```http
POST /wishlist
```

Request body:

```json
{
  "eventId": "EVNT..."
}
```

## Remove an event

```http
DELETE /wishlist/:eventId
```

The frontend API functions are:

```js
getWishlist()
addToWishlist(eventId)
removeFromWishlist(eventId)
```

The user can add an event from the event details page and view saved events on:

```text
/wishlist
```

---

# 2. Who can use it?

All wishlist routes use:

```js
verifyToken
```

For example:

```js
router.post("/", verifyToken, async (req, res) => {
```

The user ID comes from:

```js
req.user.user_id
```

It does **not** come from the request body.

That is important because a user must not be able to add or remove items from another user's wishlist by submitting someone else's ID.

The server constructs the database queries using:

```text
authenticated user ID
+
requested event ID
```

---

# 3. Database structure

The table is:

```sql
CREATE TABLE WISHLIST (
  USER_ID CHAR(15) NOT NULL
    REFERENCES USERS(USER_ID)
    ON DELETE CASCADE,

  EVENT_ID CHAR(15) NOT NULL
    REFERENCES EVENTS(EVENT_ID)
    ON DELETE CASCADE,

  ADDED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT pk_wl
    PRIMARY KEY (USER_ID, EVENT_ID)
);
```

The primary key is composed of two columns:

```text
(USER_ID, EVENT_ID)
```

This means:

```text
one user can save many events
one event can be saved by many users
the same user cannot save the same event twice
```

Conceptually, `WISHLIST` represents a many-to-many relationship:

```text
USERS ←→ EVENTS
```

---

# 4. Viewing the wishlist

The route executes:

```sql
SELECT
  E.EVENT_ID,
  E.TITLE,
  E.EVENT_DATE_TIME,
  E.VENUE,
  E.STATUS,
  W.ADDED_AT
FROM WISHLIST W
JOIN EVENTS E
  ON E.EVENT_ID = W.EVENT_ID
WHERE W.USER_ID = $1
ORDER BY W.ADDED_AT DESC;
```

The query reads:

```text
WISHLIST
EVENTS
```

The `WHERE` condition is:

```sql
WHERE W.USER_ID = $1
```

The parameter is:

```js
req.user.user_id
```

Therefore, a customer only sees their own saved events.

The join is needed because `WISHLIST` stores the relationship, while event information such as title and venue is stored in `EVENTS`.

---

# 5. Adding an event

The route first validates the request:

```js
if (!eventId) {
  return res.status(400).json({
    error: "eventId is required",
  });
}
```

Then it obtains a database client:

```js
const client = await pool.connect();
```

and starts a transaction:

```js
await client.query("BEGIN");
```

The insert is:

```sql
INSERT INTO WISHLIST (USER_ID, EVENT_ID)
VALUES ($1, $2)
ON CONFLICT (USER_ID, EVENT_ID) DO NOTHING;
```

The parameters are:

```js
[
  req.user.user_id,
  eventId,
]
```

---

# 6. Why `ON CONFLICT DO NOTHING` is useful

Suppose the user clicks the wishlist button twice.

The first insert creates:

```text
(USER_ID, EVENT_ID)
```

The second insert conflicts with the composite primary key:

```sql
PRIMARY KEY (USER_ID, EVENT_ID)
```

Instead of returning an error, this clause makes the second insert harmless:

```sql
ON CONFLICT (USER_ID, EVENT_ID) DO NOTHING
```

This property is called **idempotency**.

Repeated requests produce the same final state:

```text
the event is saved once
```

There are no duplicate wishlist rows.

---

# 7. Foreign-key validation

`EVENT_ID` references:

```sql
EVENTS(EVENT_ID)
```

If the client submits an event ID that does not exist, PostgreSQL raises a foreign-key violation.

The server checks:

```js
if (err.code === "23503") {
  return res.status(404).json({
    error: "Event not found",
  });
}
```

So the database protects referential integrity, and the backend translates the database error into a user-friendly response.

The route never trusts the event ID just because it came from the frontend.

---

# 8. Commit and rollback

If the insert succeeds:

```js
await client.query("COMMIT");
```

The route returns:

```json
{
  "added": true
}
```

with status:

```http
201 Created
```

If the insert fails:

```js
await client.query("ROLLBACK");
```

The route returns an error and releases the client.

The transaction may seem small for one insert, but it follows the project rule that write operations use an explicit transaction with one checked-out client.

---

# 9. Removing an event

The delete route is:

```http
DELETE /wishlist/:eventId
```

It executes:

```sql
DELETE FROM WISHLIST
WHERE USER_ID = $1
  AND EVENT_ID = $2;
```

The important security detail is that the delete condition includes both:

```text
authenticated USER_ID
requested EVENT_ID
```

Therefore, a user can only remove their own wishlist entry.

The route then commits:

```js
await client.query("COMMIT");
```

and returns:

```json
{
  "removed": true
}
```

If the row did not exist, the delete simply affects zero rows. The route still returns success because the desired final state is:

```text
event is not in this user's wishlist
```

That is another idempotent behavior.

---

# 10. What happens if a user or event is deleted?

Both foreign keys use:

```sql
ON DELETE CASCADE
```

For users:

```text
delete user
    ↓
their wishlist rows are automatically deleted
```

For events:

```text
delete event
    ↓
all wishlist rows for that event are automatically deleted
```

This prevents orphaned wishlist records.

The relationship cleanup is handled by PostgreSQL rather than application code.

---

# 11. Is there a wishlist trigger?

No application trigger is required for adding or removing wishlist entries.

The database features involved are:

```text
composite primary key
foreign keys
ON DELETE CASCADE
DEFAULT CURRENT_TIMESTAMP
```

The admin wishlist report reads the same table, but does not change it.

---

# 12. Admin wishlist report connection

The admin report uses:

```sql
SELECT
  E.EVENT_ID,
  E.ORGANIZER_ID,
  E.TITLE,
  E.EVENT_DATE_TIME,
  E.STATUS AS event_status,
  COUNT(W.USER_ID)::int AS wishlist_count
FROM EVENTS E
LEFT JOIN WISHLIST W
  ON W.EVENT_ID = E.EVENT_ID
GROUP BY
  E.EVENT_ID,
  E.ORGANIZER_ID,
  E.TITLE,
  E.EVENT_DATE_TIME,
  E.STATUS
ORDER BY
  wishlist_count DESC,
  E.EVENT_DATE_TIME ASC,
  E.TITLE;
```

The `LEFT JOIN` is important.

It includes events with zero wishlist entries:

```text
Event A → 15 wishlists
Event B → 3 wishlists
Event C → 0 wishlists
```

An ordinary `INNER JOIN` would omit Event C entirely.

The report is admin-only because the entire admin router uses:

```js
router.use(requireAdminAuth);
```

---

# Complete wishlist flow

## Add

```text
User clicks wishlist
        |
        v
POST /wishlist
        |
        v
verifyToken
        |
        v
read user_id from JWT
        |
        v
BEGIN
        |
        v
INSERT WISHLIST
        |
        +--> composite key prevents duplicates
        +--> foreign key verifies event
        |
        v
COMMIT
```

## Remove

```text
User clicks remove
        |
        v
DELETE /wishlist/:eventId
        |
        v
verifyToken
        |
        v
DELETE WHERE user_id = JWT user
             AND event_id = URL event
        |
        v
COMMIT
```

## View

```text
GET /wishlist
        |
        v
verifyToken
        |
        v
JOIN WISHLIST with EVENTS
WHERE user_id = JWT user
        |
        v
return saved events
```

---

# Five-answer note for your course

### 1. What starts it?

The user sends one of:

```http
GET /wishlist
POST /wishlist
DELETE /wishlist/:eventId
```

### 2. Who can do it?

Only an authenticated user.

The server takes the user ID from the JWT.

### 3. Which tables change or get read?

Read:

```text
WISHLIST
EVENTS
```

Write:

```text
WISHLIST
```

### 4. What happens automatically?

PostgreSQL:

- prevents duplicate user-event pairs,
- checks that users exist,
- checks that events exist,
- sets `ADDED_AT`,
- removes wishlist rows when users or events are deleted.

### 5. What happens if something fails?

The write transaction rolls back. A nonexistent event becomes a `404`, and a repeated save is safely ignored.

---

## Key exam sentence

> `WISHLIST` is a many-to-many relationship table whose composite primary key prevents duplicate saves, while foreign keys and cascading deletes maintain referential integrity. The API uses the authenticated user ID to ensure users can only manage their own wishlist.