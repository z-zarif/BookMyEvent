You have now covered the main end-to-end flows:

1. Customer registration and login  
2. Organizer registration  
3. Event creation  
4. Booking creation  
5. Individual booking cancellation  
6. Full event cancellation  
7. Wishlist management  
8. Wallet add-money request  
9. Admin approval/rejection  
10. Admin reports  

There are no major user-facing flows left for the core database walkthrough.

A few supporting concepts are still worth reviewing before moving on:

## 1. Organizer registration

This is the main flow we did not explain in detail. It covers:

```text
authenticated customer
→ POST /organizers/register
→ ORGANIZERS insert
→ new organizer JWT
→ event-creation permission
```

## 2. Authentication and logout

You should understand:

- JWT contents,
- `verifyToken`,
- `requireOrganizer`,
- `requireAdminAuth`,
- token expiration,
- `TOKEN_BLACKLIST`,
- the current logout limitation.

## 3. Trigger dependency chains

The most important chains are:

```text
booking
→ ticket insert
→ reserve inventory
→ sync booking total
→ wallet payment
```

```text
booking cancellation
→ ticket delete
→ release inventory
→ reactivate ticket type
→ wallet refund
```

```text
admin approval
→ request status update
→ approval trigger
→ wallet transaction
→ wallet balance trigger
```

## 4. Database constraints

Review how these enforce correctness:

- primary keys,
- composite primary keys,
- foreign keys,
- unique constraints,
- check constraints,
- `ON DELETE CASCADE`,
- `ON DELETE RESTRICT`.

## 5. Regression tests

You should run and understand:

- event-cancellation rollback,
- concurrent approval protection,
- ticket reactivation after cancellation.

The main file is `regression-tests.sql`.

## 6. One important current limitation

Customer logout currently removes the JWT from the browser, but the backend logout route is not active. Therefore, the token is not inserted into `TOKEN_BLACKLIST` during logout.

For a database course, you should be able to explain that distinction:

```text
frontend logout:
local token removed

server-side logout invalidation:
not currently implemented
```

## Recommended next step

You are ready to move from **feature tracing** to **system-level revision**.

The best revision order is:

1. Draw the complete table relationship diagram.
2. Draw the booking trigger chain.
3. Draw the cancellation rollback flow.
4. Explain the admin approval transaction.
5. Practice the five-answer format for any route:
   - What starts it?
   - Who can do it?
   - Which tables change?
   - What triggers or procedures run?
   - What happens if it fails?

The only major feature walkthrough still missing is **organizer registration**.