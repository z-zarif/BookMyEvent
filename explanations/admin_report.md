

# Feature 7: Admin Reports Dashboard

The reports feature lets an administrator view aggregated business data:

1. Organizer revenue
2. Event occupancy
3. Top customers by spending
4. Promo-code effectiveness
5. Most-wishlisted events

The main files are:

- `admin.js`
- `Reports.jsx`
- `api.js`
- `queries.sql`

---

# 1. What starts it?

The admin frontend calls:

```http
GET /admin/reports
Authorization: Bearer <admin-jwt>
```

The frontend API function is:

```js
export const getReports = () => client.get('/admin/reports');
```

The `Reports` page calls it when the page loads:

```js
useEffect(() => {
  getReports()
    .then(setReports)
    .catch((err) => setError(err.message));
}, []);
```

The server returns one JSON object containing five arrays:

```json
{
  "revenue": [],
  "occupancy": [],
  "customers": [],
  "promos": [],
  "wishlists": []
}
```

Each array is rendered as a table in the admin frontend.

---

# 2. Who can see the reports?

The entire admin router uses:

```js
router.use(requireAdminAuth);
```

This middleware runs before:

```text
/admin/stats
/admin/wallets
/admin/transactions
/admin/audit-log
/admin/reports
```

Therefore, `/admin/reports` cannot be accessed by a normal customer token.

The flow is:

```text
admin login
    ↓
admin JWT stored in adminToken
    ↓
Axios interceptor adds Authorization header
    ↓
requireAdminAuth validates the token
    ↓
report queries execute
```

The admin frontend gets the token from:

```js
localStorage.getItem('adminToken')
```

and adds it to every request.

---

# 3. Backend report execution

The server stores the five SQL statements in:

```js
const reportQueries = {
  revenue: `...`,
  occupancy: `...`,
  customers: `...`,
  promos: `...`,
  wishlists: `...`,
};
```

The endpoint executes them with:

```js
const entries = await Promise.all(
  Object.entries(reportQueries).map(async ([name, query]) => [
    name,
    (await pool.query(query)).rows,
  ]),
);
```

`Promise.all` allows the five read-only queries to execute concurrently.

Then the result is converted into an object:

```js
res.json(Object.fromEntries(entries));
```

This feature does not need an explicit transaction because it only reads data.

---

# 4. Organizer revenue report

The goal is:

```text
event
→ booking
→ payment
```

and then group by event.

The query first calculates payment totals per booking:

```sql
WITH booking_revenue AS (
  SELECT
    BOOKING_ID,
    SUM(AMOUNT) AS booking_revenue
  FROM PAYMENTS
  GROUP BY BOOKING_ID
)
```

This produces an intermediate result like:

| BOOKING_ID | booking_revenue |
|---|---:|
| BK001 | 1000.00 |
| BK002 | 2500.00 |

Then it groups those booking totals by event:

```sql
event_revenue AS (
  SELECT
    B.EVENT_ID,
    SUM(BR.booking_revenue) AS revenue
  FROM BOOKINGS B
  JOIN booking_revenue BR
    ON BR.BOOKING_ID = B.BOOKING_ID
  GROUP BY B.EVENT_ID
)
```

Finally, it counts actual tickets separately:

```sql
event_ticket_sales AS (
  SELECT
    B.EVENT_ID,
    COUNT(T.TICKET_ID)::int AS tickets_sold
  FROM BOOKINGS B
  LEFT JOIN TICKETS T
    ON T.BOOKING_ID = B.BOOKING_ID
  GROUP BY B.EVENT_ID
)
```

The final result includes:

```text
organizer ID
event ID
event title
event status
total revenue
tickets sold
```

---

## Why pre-aggregate revenue?

Suppose one booking has:

```text
payment = 1000
tickets = 3
```

If we directly join `PAYMENTS` and `TICKETS`, the payment row may appear three times:

```text
1000 + 1000 + 1000 = 3000
```

That would incorrectly multiply revenue.

The query avoids this by calculating:

```text
payment total per booking first
```

and only then grouping by event.

This is called **pre-aggregation**.

---

## Important reporting assumption

The query sums rows in `PAYMENTS`, including payments associated with bookings that may later be cancelled.

That means the report represents:

```text
recorded/gross payment volume
```

rather than:

```text
net revenue after refunds
```

Since cancellation creates a refund wallet transaction but does not delete the original payment, a future net-revenue report would need to subtract refunds or filter according to the intended business rule.

---

# 5. Event occupancy report

The goal is:

```text
total capacity
tickets sold
fill percentage
```

The report first sums remaining inventory:

```sql
WITH event_capacity AS (
  SELECT
    EVENT_ID,
    SUM(QUANTITY_AVAILABLE)::int AS remaining_capacity
  FROM TICKET_TYPE
  GROUP BY EVENT_ID
)
```

Then it counts sold tickets:

```sql
event_ticket_sales AS (
  SELECT
    TT.EVENT_ID,
    COUNT(T.TICKET_ID)::int AS tickets_sold
  FROM TICKET_TYPE TT
  LEFT JOIN TICKETS T
    ON T.TICKET_TYPE_ID = TT.TYPE_ID
  GROUP BY TT.EVENT_ID
)
```

The total capacity is calculated as:

```sql
remaining_capacity + tickets_sold
```

The fill percentage is:

```sql
100 * tickets_sold / total_capacity
```

The query uses:

```sql
NULLIF(total_capacity, 0)
```

to avoid division by zero.

If an event has no capacity, the percentage becomes `NULL` instead of causing a database error.

---

## Example

Suppose an event has:

```text
remaining tickets = 70
sold tickets = 30
```

Then:

```text
total capacity = 70 + 30 = 100
fill percentage = 30 / 100 * 100 = 30%
```

The report orders events by:

```text
highest fill percentage first
```

So the most occupied events appear at the top.

---

# 6. Why capacity uses remaining inventory plus sold tickets

`TICKET_TYPE.QUANTITY_AVAILABLE` decreases when tickets are sold.

For example:

```text
initial quantity = 100
sold tickets = 30
remaining quantity = 70
```

The database no longer stores the original capacity in a separate column.

Therefore, the report reconstructs it:

```text
original capacity = remaining quantity + sold ticket count
```

This works because:

- booking ticket inserts decrease availability,
- cancellation ticket deletes increase availability.

The inventory triggers maintain the relationship.

---

# 7. Top customers by spend

The report joins:

```text
USERS
→ BOOKINGS
→ PAYMENTS
```

It first aggregates payments per booking:

```sql
WITH booking_spend AS (
  SELECT
    BOOKING_ID,
    SUM(AMOUNT) AS booking_spend
  FROM PAYMENTS
  GROUP BY BOOKING_ID
)
```

Then it groups by customer:

```sql
SELECT
  U.USER_ID,
  U.USER_NAME,
  U.EMAIL,
  SUM(BS.booking_spend)::numeric(12, 2) AS total_spend,
  COUNT(DISTINCT B.BOOKING_ID)::int AS paid_booking_count
FROM USERS U
JOIN BOOKINGS B
  ON B.USER_ID = U.USER_ID
JOIN booking_spend BS
  ON BS.BOOKING_ID = B.BOOKING_ID
GROUP BY
  U.USER_ID,
  U.USER_NAME,
  U.EMAIL
```

The output contains:

```text
customer name
email
total spending
number of paid bookings
```

It is ordered by:

```text
total spend descending
booking count descending
customer name
```

The `COUNT(DISTINCT ...)` protects the booking count from duplicate rows caused by joins.

---

# 8. Promo-code effectiveness

This report joins:

```text
PROMO_CODES
→ PROMO_REDEMPTIONS
```

The query uses:

```sql
LEFT JOIN PROMO_REDEMPTIONS PR
  ON PR.PROMO_ID = PC.PROMO_ID
```

This means promo codes with zero redemptions still appear.

The report calculates:

```sql
COUNT(PR.REDEMPTION_ID)::int AS redemption_count
```

and:

```sql
COALESCE(
  SUM(PR.DISCOUNT_APPLIED),
  0
)::numeric(12, 2) AS total_discount_given
```

The output includes:

```text
promo code
status
discount type
discount value
redemption count
total discount given
```

---

## Why `COALESCE` is needed

For a promo code with no redemptions:

```sql
SUM(...) 
```

would normally produce:

```text
NULL
```

But the frontend should display:

```text
0.00
```

Therefore:

```sql
COALESCE(SUM(...), 0)
```

converts the missing aggregate result into zero.

---

# 9. Most-wishlisted events

This report joins:

```text
EVENTS
→ WISHLIST
```

It uses:

```sql
LEFT JOIN WISHLIST W
  ON W.EVENT_ID = E.EVENT_ID
```

and counts:

```sql
COUNT(W.USER_ID)::int AS wishlist_count
```

The report groups by the event columns and orders by:

```text
wishlist count descending
```

This produces results such as:

| Event | Wishlist adds |
|---|---:|
| Concert A | 25 |
| Workshop B | 12 |
| Festival C | 0 |

The `LEFT JOIN` includes events that nobody has wishlisted.

---

# 10. Frontend rendering

The frontend uses a reusable `Table` component:

```jsx
function Table({ columns, rows, empty }) {
```

Each report supplies:

```text
rows
empty message
columns
render functions
```

For example, revenue uses:

```jsx
<Table
  rows={reports.revenue}
  empty="No sales yet."
  columns={[
    ['Organizer', (r) => r.organizer_id],
    ['Event', (r) => r.title],
    ['Status', (r) => r.event_status],
    ['Tickets Sold', (r) => r.tickets_sold],
    ['Revenue', (r) => money(r.total_revenue)],
  ]}
/>
```

Money is formatted using:

```js
const money = (value) =>
  `৳${Number(value || 0).toLocaleString(...)}`
```

Therefore, the backend returns numeric values and the frontend handles display formatting.

---

# Complete admin reports flow

```text
Admin logs in
        |
        v
admin JWT stored in adminToken
        |
        v
Admin opens Reports page
        |
        v
GET /admin/reports
        |
        v
Axios adds admin Authorization header
        |
        v
requireAdminAuth
        |
        v
Run five read-only aggregate queries
        |
        +--> revenue
        +--> occupancy
        +--> customers
        +--> promos
        +--> wishlists
        |
        v
Return one JSON object
        |
        v
React renders five tables
```

---

# Five-answer note for your course

### 1. What starts it?

The administrator opens the reports page, which sends:

```http
GET /admin/reports
```

### 2. Who can do it?

Only a valid administrator authenticated through the admin JWT system.

### 3. Which tables are read?

Depending on the report:

```text
EVENTS
ORGANIZERS
TICKET_TYPE
TICKETS
BOOKINGS
PAYMENTS
USERS
PROMO_CODES
PROMO_REDEMPTIONS
WISHLIST
```

No report tables are modified.

### 4. What happens automatically?

SQL performs:

- joins,
- grouping,
- sums,
- counts,
- percentages,
- null handling,
- ranking through `ORDER BY`.

The database triggers are not activated because these are read-only queries.

### 5. What happens if something fails?

The endpoint catches the database error, logs it, and returns:

```http
500 Could not load admin reports
```

The frontend displays the error message instead of showing fake or partial success data.

---

## Key exam sentence

> The admin reports use aggregate SQL queries to transform normalized transactional tables into business summaries. Common table expressions pre-aggregate payments before joining ticket data, preventing revenue multiplication, while `LEFT JOIN`, `COALESCE`, `COUNT`, `SUM`, and percentage calculations ensure that zero-activity events and promo codes are still reported correctly.