# Feature 5: Creating an Event

This flow starts in the organizer frontend and creates one event together with its ticket types.

The main files are:

- `CreateEvent.jsx`
- `api.js`
- `events.js`
- `schema.sql`

---

## 1. What starts it?

The organizer opens the create-event page:

```text
/organizer/create-event
```

The form collects:

```text
title
date and time
venue
description
photo URL
ticket types
```

Each ticket type contains:

```json
{
  "category": "REGULAR",
  "quantity": 100,
  "price": 500
}
```

The frontend sends:

```http
POST /events/postevent
Authorization: Bearer <organizer-jwt>
```

The API helper is:

```js
export const createEvent = (payload) =>
  client.post('/events/postevent', payload);
```

---

# 2. Who can create an event?

The route is:

```js
router.post(
  "/postevent",
  verifyToken,
  requireOrganizer,
  async (req, res) => {
```

Two middleware functions run first.

## `verifyToken`

This middleware:

1. Reads the `Authorization` header.
2. Extracts the JWT.
3. Checks whether the token is in `TOKEN_BLACKLIST`.
4. Verifies the JWT signature and expiration.
5. Stores the decoded user in:

```js
req.user
```

The organizer ID is then obtained from:

```js
req.user.user_id
```

The client does not get to choose the organizer ID.

---

## `requireOrganizer`

This middleware checks:

```sql
SELECT ORGANIZER_ID
FROM ORGANIZERS
WHERE ORGANIZER_ID = $1;
```

The user must have a matching row in:

```text
ORGANIZERS
```

If the user is only a normal customer, the request returns:

```http
403 Organizer access required
```

So the authorization rule is:

```text
valid customer JWT
+
user exists in ORGANIZERS
```

---

# 3. Frontend validation and request data

The frontend sends the ticket values as numbers:

```js
ticketTypes: ticketTypes.map((tt) => ({
  category: tt.category,
  quantity: Number(tt.quantity),
  price: Number(tt.price),
}))
```

The backend performs a basic validation:

```js
if (!title || !venue || !ticketTypes || ticketTypes.length === 0) {
  return res.status(400).json({
    error: "Title, venue, and ticket types are required",
  });
}
```

This verifies that the request has:

```text
title
venue
at least one ticket type
```

The database performs additional validation through constraints.

---

# 4. The route starts one transaction

The route obtains a dedicated client:

```js
const client = await pool.connect();
```

Then starts a transaction:

```js
await client.query("BEGIN");
```

This is important because creating an event involves multiple inserts:

```text
insert EVENTS
insert TICKET_TYPE 1
insert TICKET_TYPE 2
insert TICKET_TYPE 3
...
```

These inserts must be atomic.

The desired behavior is:

```text
all inserts succeed → COMMIT
any insert fails → ROLLBACK
```

---

# 5. Insert the event

The route executes:

```sql
INSERT INTO EVENTS
  (
    EVENT_ID,
    ORGANIZER_ID,
    TITLE,
    EVENT_DATE_TIME,
    VENUE,
    DESCRIBE_EVENT,
    PHOTO_URL
  )
VALUES
  (
    fn_generate_id('EVNT'),
    $1,
    $2,
    $3,
    $4,
    $5,
    $6
  )
RETURNING EVENT_ID;
```

The values are:

```js
[
  orgId,
  title,
  date_time,
  venue,
  description,
  photoUrl || null,
]
```

The database generates the event ID using:

```sql
fn_generate_id('EVNT')
```

The generated ID has the prefix:

```text
EVNT
```

The route retrieves the generated ID:

```js
const eventId = eventResult.rows[0].event_id;
```

This ID is needed to connect every ticket type to the new event.

---

# 6. What does the `EVENTS` table enforce?

The table contains:

```sql
CREATE TABLE EVENTS (
  EVENT_ID CHAR(15) PRIMARY KEY,
  ORGANIZER_ID CHAR(15) NOT NULL
    REFERENCES ORGANIZERS(ORGANIZER_ID),
  TITLE VARCHAR(100) NOT NULL,
  EVENT_DATE_TIME TIMESTAMP NOT NULL,
  VENUE VARCHAR(50),
  DESCRIBE_EVENT TEXT,
  STATUS VARCHAR(20) DEFAULT 'scheduled'
    CHECK (STATUS IN ('scheduled', 'cancelled', 'completed')),
  CONSTRAINT uq_event_per_organizer_date
    UNIQUE (ORGANIZER_ID, TITLE, EVENT_DATE_TIME)
);
```

Important rules:

## Organizer foreign key

```sql
REFERENCES ORGANIZERS(ORGANIZER_ID)
```

An event cannot belong to a nonexistent organizer.

## Required values

These cannot be null:

```text
EVENT_ID
ORGANIZER_ID
TITLE
EVENT_DATE_TIME
```

## Default status

Since the route does not provide a status, PostgreSQL uses:

```text
scheduled
```

## Duplicate-event prevention

This constraint prevents one organizer from creating the same title at the same date and time:

```sql
UNIQUE (ORGANIZER_ID, TITLE, EVENT_DATE_TIME)
```

If it is violated, PostgreSQL returns error code:

```text
23505
```

The route converts that into:

```http
409 Conflict
```

with:

```json
{
  "error": "Event already registered"
}
```

---

# 7. Insert ticket types

After the event is inserted, the route loops over the submitted ticket types:

```js
for (const t of ticketTypes) {
  await client.query(
    `INSERT INTO TICKET_TYPE
       (TYPE_ID, EVENT_ID, CATEGORY, QUANTITY_AVAILABLE, PRICE)
     VALUES
       (fn_generate_id('TKTTP'), $1, $2, $3, $4)`,
    [eventId, t.category, t.quantity, t.price],
  );
}
```

Each row receives:

```text
TYPE_ID generated with TKTTP prefix
EVENT_ID from the newly inserted event
CATEGORY from the form
QUANTITY_AVAILABLE from the form
PRICE from the form
```

Example database result:

| TYPE_ID | EVENT_ID | CATEGORY | QUANTITY_AVAILABLE | PRICE |
|---|---|---|---:|---:|
| TKTTP... | EVNT... | REGULAR | 100 | 500 |
| TKTTP... | EVNT... | VIP | 25 | 1200 |

---

# 8. What does `TICKET_TYPE` enforce?

The table defines:

```sql
CREATE TABLE TICKET_TYPE (
  TYPE_ID CHAR(15) PRIMARY KEY,
  EVENT_ID CHAR(15)
    REFERENCES EVENTS(EVENT_ID)
    ON DELETE RESTRICT,
  CATEGORY VARCHAR(10)
    CHECK (CATEGORY IN
      ('REGULAR', 'VIP', 'PLATINUM', 'EARLY_BIRD')),
  QUANTITY_AVAILABLE INTEGER NOT NULL DEFAULT 0
    CHECK (QUANTITY_AVAILABLE >= 0),
  STATUS VARCHAR(20) DEFAULT 'active'
    CHECK (STATUS IN ('active', 'inactive')),
  PRICE NUMERIC(10,2) NOT NULL
    CHECK (PRICE > 0)
);
```

The database validates:

## Valid category

Only these categories are accepted:

```text
REGULAR
VIP
PLATINUM
EARLY_BIRD
```

## Nonnegative quantity

This is invalid:

```text
quantity = -5
```

because of:

```sql
CHECK (QUANTITY_AVAILABLE >= 0)
```

## Positive price

This is invalid:

```text
price = 0
```

because of:

```sql
CHECK (PRICE > 0)
```

## Event must exist

Each ticket type must reference the event just created.

---

# 9. Are ticket triggers activated during event creation?

Usually, no inventory trigger is needed when inserting a `TICKET_TYPE`.

The important ticket triggers are attached to the `TICKETS` table:

```text
TICKETS inserted → reserve inventory
TICKETS deleted  → release inventory
```

At event-creation time, no actual ticket has been sold yet.

The initial `QUANTITY_AVAILABLE` is inserted directly into `TICKET_TYPE`.

The ticket-type audit and automatic-status triggers are attached to updates:

```sql
CREATE TRIGGER trg_ticket_type_audit
AFTER UPDATE ON ticket_type
```

```sql
CREATE TRIGGER trg_ticket_type_auto_status
BEFORE UPDATE ON ticket_type
```

Therefore, creating a ticket type does not reserve or release a ticket.

---

# 10. Commit

If the event insert and every ticket-type insert succeed:

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
  "message": "Event created successfully",
  "eventId": "EVNT..."
}
```

The frontend then navigates to:

```text
/organizer/dashboard
```

---

# 11. Failure and rollback

Suppose the organizer submits three ticket types:

```text
REGULAR   → valid
VIP       → valid
PLATINUM  → price = 0
```

The database rejects the third insert because:

```sql
CHECK (PRICE > 0)
```

The route catches the error:

```js
catch (err) {
  await client.query("ROLLBACK");
}
```

The rollback removes:

```text
the event row
the REGULAR ticket type
the VIP ticket type
```

The result is not a partially created event.

This is why the transaction is necessary.

Without a transaction, the database could contain:

```text
event created
two ticket types created
third ticket type failed
```

With the transaction:

```text
everything succeeds
or nothing remains
```

---

# Complete event creation flow

```text
Organizer fills CreateEvent form
        |
        v
POST /events/postevent
        |
        v
verifyToken
        |
        v
requireOrganizer
        |
        v
pool.connect()
        |
        v
BEGIN
        |
        v
INSERT EVENTS
        |
        v
generate EVENT_ID using fn_generate_id('EVNT')
        |
        v
for each ticket type:
        |
        +--> INSERT TICKET_TYPE
              |
              +--> generate TYPE_ID using fn_generate_id('TKTTP')
              +--> validate category
              +--> validate quantity
              +--> validate price
              +--> validate EVENT_ID foreign key
        |
        v
COMMIT
        |
        v
201 Event created successfully
```

---

# Five-answer note for your course

### 1. What starts it?

The organizer submits:

```http
POST /events/postevent
```

with event information and an array of ticket types.

### 2. Who can do it?

Only a valid authenticated user who has a row in:

```text
ORGANIZERS
```

### 3. Which tables change or get read?

Inserted:

```text
EVENTS
TICKET_TYPE
```

Read indirectly through validation:

```text
ORGANIZERS
```

The database also uses:

```text
fn_generate_id()
```

to create IDs.

### 4. What happens automatically?

The database automatically:

- generates event and ticket-type IDs,
- sets event status to `scheduled`,
- sets ticket-type status to `active`,
- validates foreign keys,
- validates allowed categories,
- validates positive prices,
- validates nonnegative inventory,
- prevents duplicate events for one organizer.

### 5. What happens if something fails?

The transaction rolls back the event and every ticket type inserted before the failure.

---

## Important distinction

Event creation creates **ticket categories and available inventory**.

It does not create individual sold tickets.

The difference is:

```text
TICKET_TYPE
= a category for sale, such as VIP or REGULAR

TICKETS
= individual tickets created during booking
```

Later, when a customer books the event:

```text
TICKETS inserted
    ↓
inventory decreases
    ↓
ticket type may become inactive when sold out
```

So event creation prepares the inventory, while booking consumes it.