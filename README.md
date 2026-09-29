# BookMyEvent

> **CSE-216 Database Project**
> A full-stack event discovery and ticket-booking platform built with React,
> Express, and PostgreSQL.

BookMyEvent connects customers, organizers, and administrators in one
transaction-safe event management system. Users can discover events, reserve
tickets, pay through a wallet, use promo codes, save events, and track their
bookings. Organizers can publish and manage events, while administrators manage
wallet approvals and view business reports.

## ✨ Highlights

- Customer registration, login, JWT authentication, and role-aware access
- Organizer registration, event creation, cancellation, and lifecycle tracking
- Ticket inventory reservation with concurrency-safe database operations
- Wallet payments, refunds, add-money requests, and approval workflows
- Promo-code validation and redemption tracking
- Wishlist management
- Admin dashboard with revenue, occupancy, customer, promo, and wishlist reports
- Automatic event completion after the scheduled event time
- Transactional rollback for failed bookings, refunds, and administrative actions

## 🧱 Technology Stack

| Layer | Technology |
| --- | --- |
| Customer interface | React, React Router, Tailwind CSS, Vite |
| Admin interface | React, React Router, Tailwind CSS, Vite |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| Authentication | JWT and bcrypt |
| Database access | `pg` connection pool |

## 🗂️ Project Structure

```text
BookMyEvent/
├── database/       PostgreSQL schema, triggers, procedures, queries, and seed data
├── server/         Express REST API
├── frontend-react/ Customer-facing React application
└── admin-panel/    Admin dashboard
```

## 🗃️ Database Design

The database is the core of the application and contains:

- `USERS`, `ORGANIZERS`, and `EVENTS`
- `TICKET_TYPE` and `TICKETS`
- `BOOKINGS` and `PAYMENTS`
- `WALLETS` and `WALLET_TRANSACTIONS`
- `PROMO_CODES` and `PROMO_REDEMPTIONS`
- `WISHLIST`, `ADD_MONEY_REQUESTS`, and `TICKET_AUDIT_LOG`

Database features demonstrated:

- Primary keys, composite keys, foreign keys, and unique constraints
- Check constraints and default values
- Transaction control with `BEGIN`, `COMMIT`, and `ROLLBACK`
- PL/pgSQL functions and procedures
- Triggers for inventory, booking totals, wallet balances, refunds, approvals,
  audit logging, and event completion
- CTEs, joins, aggregation, ranking, and reporting queries

## 🚀 Setup

### 1. Configure PostgreSQL

Create a PostgreSQL database and configure `server/.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
JWT_SECRET=replace-with-a-long-random-secret
ADMIN_PASSWORD=choose-an-admin-password
PORT=5000
```

### 2. Initialize the database

Run the scripts in this order:

```text
database/schema.sql
database/add-photo-url-migration.sql
database/add-event-lifecycle-migration.sql   # existing databases only
database/triggers.sql
database/procedure.sql
database/seed.sql                             # optional demo data
database/regression-tests.sql                 # optional verification
```

`database/triggers.sql` is the authoritative trigger and helper-function
setup. `database/functions.sql` is retained only as a compatibility no-op.

### 3. Install dependencies

```powershell
cd server
npm install

cd ..\frontend-react
npm install

cd ..\admin-panel
npm install
```

### 4. Run the applications

Start the backend:

```powershell
cd server
npm run dev
```

Start the customer frontend in a second terminal:

```powershell
cd frontend-react
npm run dev
```

Start the admin panel in a third terminal:

```powershell
cd admin-panel
npm run dev
```

The backend runs on `http://localhost:5000`. Vite prints the frontend URLs in
the terminal.

## 🔐 Access Rules

- Event browsing is public.
- Booking, wallet, wishlist, profile, and organizer actions require a customer
  JWT.
- Organizer actions verify organizer membership and event ownership.
- Admin routes use a separate admin JWT issued from `ADMIN_PASSWORD`.
- Customers cannot delete events with booking history; those events must be
  cancelled so ticket and refund history is preserved.
- An event can contain each ticket category only once.

## 🔄 Important Workflows

```text
Booking:
lock ticket type → create booking → reserve tickets → charge wallet → confirm

Booking cancellation:
lock booking → delete tickets → release inventory → refund wallet

Event cancellation:
cancel and refund every eligible booking → mark event cancelled → commit once

Admin approval:
approve request → create deposit transaction → update wallet balance
```

All related write operations use explicit transactions so partial changes are
rolled back when an operation fails.

## 🧪 Validation

```powershell
cd frontend-react
npm run build

cd ..\admin-panel
npm run build
```

The SQL regression script verifies cancellation rollback, approval protection,
and ticket reactivation without leaving test data behind.

---

**BookMyEvent — making event booking reliable, organized, and database-driven.**
