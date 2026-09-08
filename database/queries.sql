- **Organizer revenue dashboard** — `EVENTS` → `TICKET_TYPE` → `TICKETS`/`BOOKINGS` → `PAYMENTS`, grouped by event, summing revenue and counting tickets sold per organizer
- **Event occupancy report** — capacity from `TICKET_TYPE` vs. tickets actually sold, computing a fill percentage per event, ranked
- **Top customers by spend** — `USERS` → `BOOKINGS` → `PAYMENTS`, grouped by user, summing total spend and booking count
- **Promo code effectiveness** — `PROMO_CODES` → `PROMO_REDEMPTIONS` → `BOOKINGS`, grouped by code, total discount given and redemption count
- **Most wishlisted events** — `WISHLIST` → `EVENTS`, grouped by event, counting wishlist adds (good simple one to round things out)

