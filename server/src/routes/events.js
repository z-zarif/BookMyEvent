import express from "express";
import pool from "../db/db.js";
import { requireOrganizer, verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.get("/getevents", async (req, res) => {
  try {
    const result =
      await pool.query(`SELECT E.TITLE, E.EVENT_ID, U.USER_NAME, E.VENUE,E.EVENT_DATE_TIME,E.DESCRIBE_EVENT,E.STATUS
                                        FROM EVENTS E 
                                        JOIN ORGANIZERS O 
                                        ON E.ORGANIZER_ID=O.ORGANIZER_ID
                                            JOIN USERS U 
                                        ON O.ORGANIZER_ID=U.USER_ID
                                        WHERE E.STATUS = 'scheduled' AND E.EVENT_DATE_TIME >= NOW()
                                        ORDER BY E.EVENT_DATE_TIME ASC`);

    res.json(result.rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({
      error: "Could not load events",
    });
  }
});

router.post("/postevent", verifyToken, requireOrganizer, async (req, res) => {
  const { title, date_time, venue, description, ticketTypes } = req.body;
 

  if (!title || !venue || !ticketTypes||ticketTypes.length===0) {
    return res
      .status(400)
      .json({ error: "Title, venue, and ticket types are required" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const orgId = req.user.user_id;
    const eventResult = await client.query(
      `INSERT INTO EVENTS (EVENT_ID, ORGANIZER_ID,TITLE,EVENT_DATE_TIME,VENUE,DESCRIBE_EVENT)
            VALUES(fn_generate_id('EVNT'),$1,$2,$3,$4,$5)
            RETURNING EVENT_ID`,
      [orgId, title, date_time, venue, description],
    );
    const eventId = eventResult.rows[0].event_id;
    for (const t of ticketTypes) {
      await client.query(
        `INSERT INTO TICKET_TYPE (TYPE_ID, EVENT_ID, CATEGORY, QUANTITY_AVAILABLE, PRICE)
         VALUES (fn_generate_id('TKTTP'), $1, $2, $3, $4)`,
        [eventId, t.category, t.quantity, t.price],
      );
    }
    await client.query("COMMIT");
    res.status(201).json({
      message: "Event created successfully",
      eventId,
    });
  } catch (err) {
    await client.query("ROLLBACK");

    if (err.code === "23505") {
      return res.status(409).json({ error: "Event already registered" });
    }
    console.error(err);
    res.status(500).json({ error: "Event Registration failed" });
  } finally {
    client.release();
  }
});

router.post('/:eventId/cancel', verifyToken, requireOrganizer, async (req, res) => {
  const { eventId } = req.params;
  const organizerId = req.user.userId; // ⚠️ same key-name check as before — confirm against your JWT payload

  try {
    await pool.query('CALL cancel_event($1, $2)', [eventId, organizerId]);
    res.status(200).json({ message: 'Event cancelled successfully' });
  } catch (err) {
    console.error(err);
    switch (err.code) {
      case 'EV404': return res.status(404).json({ error: err.message });
      case 'EV403': return res.status(403).json({ error: err.message });
      case 'EV409': return res.status(409).json({ error: err.message });
      case 'BK404':
      case 'BK403':
      case 'BK409':
        // bubbled up from cancel_booking inside the loop
        return res.status(409).json({ error: `Failed while cancelling a booking: ${err.message}` });
      default:
        return res.status(500).json({ error: 'Failed to cancel event' });
    }
  }
});
export default router;
