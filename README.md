# BookMyEvent

A ticketing app focused on a user-friendly event booking experience.

## Database setup

Run the database scripts in this order:

1. `database/schema.sql`
2. `database/add-photo-url-migration.sql`
3. `database/triggers.sql`
4. `database/procedure.sql`
5. `database/seed.sql`
6. `database/regression-tests.sql` (optional verification)

`database/functions.sql` is retained as a compatibility no-op. Trigger and
helper-function definitions are authoritative in `database/triggers.sql`.

`seed.sql` runs inside one transaction. `test.sql` contains exploratory
queries and its seed-data cleanup section is transactional. The regression
script uses rollback-only test subtransactions, so it does not leave test
changes behind.

## Authentication boundaries

- Public event discovery pages do not require login.
- Checkout, bookings, wallet, wishlist, profile, and organizer actions require
  a customer JWT.
- Organizer actions additionally verify ownership or organizer membership on
  the server.
- Admin pages use a separate admin JWT issued after the configured
  `ADMIN_PASSWORD` is checked. Every `/admin/*` route requires that admin
  token; the frontend route guard is only an additional UX layer.
