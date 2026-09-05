import express from "express";
import pool from "../db/db.js";
import verifyToken from "../middleware/auth.js";

const router = express.Router();

// One booking can contain only ONE ticket type
router.post("/", verifyToken, async (req, res) => {
  const { typeId, qty, promoCode } = req.body;

  // Logged-in user
  const userId = req.user.user_id;
  // 1. Validate input
  if (!typeId) {
    return res.status(400).json({
      error: "typeId is required",
    });
  }
  if (!Number.isInteger(qty) || qty <= 0) {
    return res.status(400).json({
      error: "qty must be a positive integer",
    });
  }
  // Take one connection from the connection pool
  const client = await pool.connect();

  try {
    // 2. Start transaction
    await client.query("BEGIN");
    // 3. Get and lock the requested ticket type
    const { rows: ticketRows } = await client.query(
      `
      SELECT
        EVENT_ID,
        PRICE,
        QUANTITY_AVAILABLE,
        STATUS
      FROM TICKET_TYPE
      WHERE TYPE_ID = $1
      FOR UPDATE
      `,
      [typeId],
    );

    // Ticket type does not exist
    if (ticketRows.length === 0) {
      throw new Error(`Ticket type ${typeId} not found`);
    }

    // Since TYPE_ID is unique, there will only be one row
    const ticketType = ticketRows[0];

    // Ticket type must currently be active
    if (ticketType.status !== "active") {
      throw new Error(`Ticket type ${typeId} is not on sale`);
    }

    // Make sure enough tickets are available
    if (ticketType.quantity_available < qty) {
      throw new Error(`Only ${ticketType.quantity_available} ticket(s) left`);
    }

    // Save information we will need later
    const eventId = ticketType.event_id;
    const price = ticketType.price;
    // 4. Create pending booking
    const { rows: bookingRows } = await client.query(
      `
      INSERT INTO BOOKINGS
        (BOOKING_ID, EVENT_ID, USER_ID, BK_STATUS)
      VALUES
        (fn_generate_id('BKG'), $1, $2, 'pending')
      RETURNING BOOKING_ID
      `,
      [eventId, userId],
    );

    const bookingId = bookingRows[0].booking_id;

    console.log("Booking created:", bookingId);

    // 5. Create tickets
    // Example:
    //
    // qty = 3
    //
    // Creates:
    //
    // ticket 1
    // ticket 2
    // ticket 3
    //
    // trg_reserve_ticket automatically decreases
    // QUANTITY_AVAILABLE for every inserted ticket.
    //
    // trg_tickets_sync_booking_total automatically
    // updates BOOKINGS.TOTAL_COST.

    for (let i = 0; i < qty; i++) {
      // Generate ticket ID
      const { rows: idRows } = await client.query(
        `SELECT fn_generate_id('TKT') AS id`,
      );

      const ticketId = idRows[0].id;
      const seatNumber = `S${ticketId.slice(-8)}`;
      // Insert one ticket
      await client.query(
        `
        INSERT INTO TICKETS
          (
            TICKET_ID,
            BOOKING_ID,
            TICKET_TYPE_ID,
            SEAT_NUMBER,
            PRICE_PAID
          )
        VALUES
          ($1, $2, $3, $4, $5)
        `,
        [ticketId, bookingId, typeId, seatNumber, price],
      );
    }
    // 6. Read TOTAL_COST calculated by trigger
    const { rows: bookingTotalRows } = await client.query(
      `
      SELECT TOTAL_COST
      FROM BOOKINGS
      WHERE BOOKING_ID = $1
      `,
      [bookingId],
    );

    // PostgreSQL NUMERIC may come as a string,
    // so convert it to JavaScript Number
    const totalCost = Number(bookingTotalRows[0].total_cost);

    // Initially the customer has to pay the full amount
    let payable = totalCost;

    // Default: no discount
    let discount = 0;

    // 7. Apply promo code if provided

    if (promoCode) {
      const { rows: promoRows } = await client.query(
        `
        SELECT
          PROMO_ID,
          DISCOUNT_TYPE,
          DISCOUNT_VALUE
        FROM PROMO_CODES
        WHERE CODE = $1
          AND STATUS = 'active'
          AND CURRENT_TIMESTAMP
              BETWEEN VALID_FROM AND VALID_TO
        FOR UPDATE
        `,
        [promoCode],
      );

      // Promo does not exist / inactive / expired
      if (promoRows.length === 0) {
        throw new Error("Invalid or expired promo code");
      }

      const promo = promoRows[0];

      // Percentage discount
      if (promo.discount_type === "percentage") {
        discount = +(payable * (Number(promo.discount_value) / 100)).toFixed(2);
      }

      // Flat discount
      else {
        discount = Math.min(Number(promo.discount_value), payable);
      }

      // Record that this booking used this promo
      await client.query(
        `
        INSERT INTO PROMO_REDEMPTIONS
          (
            REDEMPTION_ID,
            PROMO_ID,
            BOOKING_ID,
            DISCOUNT_APPLIED
          )
        VALUES
          (fn_generate_id('RDM'), $1, $2, $3)
        `,
        [promo.promo_id, bookingId, discount],
      );

      // Calculate final amount
      payable = +(payable - discount).toFixed(2);
    }

    // PAYMENTS and WALLET_TRANSACTIONS require amount > 0
    if (payable <= 0) {
      throw new Error("Discount cannot reduce payment amount to zero");
    }

    const { rows: walletRows } = await client.query(
      `
      SELECT WALLET_ID
      FROM WALLETS
      WHERE USER_ID = $1
      `,
      [userId],
    );

    if (walletRows.length === 0) {
      throw new Error("No wallet found for user");
    }

    const walletId = walletRows[0].wallet_id;

    // 9. Charge wallet
    // dont need to directly update wallet balance, we insert a transaction, the trigger checks the balance
    // and subtracts deductable amount
    await client.query(
      `
      INSERT INTO WALLET_TRANSACTIONS
        (
          TRANSACTION_ID,
          WALLET_ID,
          TYPE,
          AMOUNT,
          REASON,
          REFERENCE_ID
        )
      VALUES
        (
          fn_generate_id('WTX'),
          $1,
          'payment',
          $2,
          'Booking payment',
          $3
        )
      `,
      [walletId, payable, bookingId],
    );

    // 10. Record payment

    await client.query(
      `
      INSERT INTO PAYMENTS
        (
          PAYMENT_ID,
          BOOKING_ID,
          AMOUNT,
          DEBITED_FROM,
          PAYMENT_METHOD
        )
      VALUES
        (
          fn_generate_id('PAY'),
          $1,
          $2,
          $3,
          'wallet'
        )
      `,
      [bookingId, payable, walletId],
    );

    // 11. Confirm booking

    await client.query(
      `
      UPDATE BOOKINGS
      SET BK_STATUS = 'confirmed'
      WHERE BOOKING_ID = $1
      `,
      [bookingId],
    );
    // 12. Everything succeeded → save permanently
    await client.query("COMMIT");
    // 13. Send response

    return res.status(201).json({
      message: "Booking successful",

      bookingId,

      ticketTypeId: typeId,

      quantity: qty,

      totalCost,

      discount,

      amountCharged: payable,
    });
  } catch (err) {
    // Something failed → undo everything

    await client.query("ROLLBACK");

    console.error("Booking error:", err);

    return res.status(400).json({
      error: err.message,
    });
  } finally {
    client.release();
  }
});

export default router;
