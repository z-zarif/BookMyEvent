import express from 'express';
import pool from '../db/db.js';

const router= express.Router();

router.get("/events",async(req, res)=>{
    try {
       const result= await pool.query(`SELECT E.TITLE, E.EVENT_ID, U.USER_NAME, E.VENUE,E.EVENT_DATE_TIME,E.DESCRIBE_EVENT,E.STATUS
                                        FROM EVENTS E 
                                        JOIN ORGANIZERS O 
                                        ON E.ORGANIZER_ID=O.ORGANIZER_ID
                                            JOIN USERS U 
                                        ON O.ORGANIZER_ID=U.USER_ID
                                        WHERE E.STATUS = 'scheduled' AND E.EVENT_DATE_TIME >= NOW()
                                        ORDER BY E.EVENT_DATE_TIME ASC`)
        
        res.json(result.rows);
    } catch (err) {
        console.log(err);
        res.status(500).json({
            error:"Could not load events"
        })
        
    }

}
);
export default router;