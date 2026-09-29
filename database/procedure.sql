DROP PROCEDURE IF EXISTS cancel_booking(CHAR, CHAR);
DROP PROCEDURE IF EXISTS cancel_booking(CHAR, CHAR, BOOLEAN);

CREATE OR REPLACE PROCEDURE cancel_booking(
    p_booking_id CHAR(15),
    p_user_id    CHAR(15),
    p_enforce_cutoff BOOLEAN DEFAULT TRUE
)
LANGUAGE plpgsql
AS $$
-- The caller owns the transaction so event cancellation can refund every
-- booking and update the event atomically.
DECLARE
    v_bk_status  VARCHAR(20);
    v_owner_id   CHAR(15);
    v_amount     NUMERIC(10,2);
    v_wallet_id  CHAR(15);
    v_event_date_time TIMESTAMP;
BEGIN
    SELECT B.BK_STATUS, B.USER_ID, E.EVENT_DATE_TIME
    INTO v_bk_status, v_owner_id, v_event_date_time
    FROM BOOKINGS B
    JOIN EVENTS E ON E.EVENT_ID = B.EVENT_ID
    WHERE B.BOOKING_ID = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % does not exist', p_booking_id
            USING ERRCODE = 'BK404';
    END IF;

    IF v_owner_id <> p_user_id THEN
        RAISE EXCEPTION 'Booking % does not belong to user %', p_booking_id, p_user_id
            USING ERRCODE = 'BK403';
    END IF;

    IF v_bk_status = 'cancelled' THEN
        RAISE EXCEPTION 'Booking % is already cancelled', p_booking_id
            USING ERRCODE = 'BK409';
    END IF;

    IF p_enforce_cutoff
       AND v_event_date_time <= CURRENT_TIMESTAMP + INTERVAL '2 days' THEN
        RAISE EXCEPTION 'Bookings cannot be cancelled within 2 days of the event'
            USING ERRCODE = 'BK422';
    END IF;

    SELECT AMOUNT, DEBITED_FROM
    INTO v_amount, v_wallet_id
    FROM PAYMENTS
    WHERE BOOKING_ID = p_booking_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No payment found for booking %', p_booking_id
            USING ERRCODE = 'BK404';
    END IF;

    DELETE FROM TICKETS
    WHERE BOOKING_ID = p_booking_id;

    UPDATE BOOKINGS
    SET BK_STATUS = 'cancelled'
    WHERE BOOKING_ID = p_booking_id;

    INSERT INTO WALLET_TRANSACTIONS
        (TRANSACTION_ID, WALLET_ID, TYPE, AMOUNT, REASON, REFERENCE_ID, HAPPENED_AT)
    VALUES
        (fn_generate_id('WTX'), v_wallet_id, 'refund', v_amount,
         'Refund for cancelled booking', p_booking_id, CURRENT_TIMESTAMP);

END;
$$;

CREATE OR REPLACE PROCEDURE cancel_event(
    p_event_id      CHAR(15),
    p_organizer_id  CHAR(15)
)
LANGUAGE plpgsql
AS $$
-- The caller owns the transaction; do not commit inside the booking loop.
DECLARE
    v_owner_id  CHAR(15);
    v_status    VARCHAR(20);
    r           RECORD;
BEGIN
    SELECT ORGANIZER_ID, STATUS
    INTO v_owner_id, v_status
    FROM EVENTS
    WHERE EVENT_ID = p_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event % does not exist', p_event_id
            USING ERRCODE = 'EV404';
    END IF;

    IF v_owner_id <> p_organizer_id THEN
        RAISE EXCEPTION 'Event % does not belong to organizer %', p_event_id, p_organizer_id
            USING ERRCODE = 'EV403';
    END IF;

    IF v_status = 'cancelled' THEN
        RAISE EXCEPTION 'Event % is already cancelled', p_event_id
            USING ERRCODE = 'EV409';
    END IF;

    FOR r IN
        SELECT BOOKING_ID, USER_ID
        FROM BOOKINGS
        WHERE EVENT_ID = p_event_id
          AND BK_STATUS IN ('pending', 'confirmed')
        ORDER BY BOOKING_ID
    LOOP
        CALL cancel_booking(r.BOOKING_ID, r.USER_ID, FALSE);
    END LOOP;

    UPDATE EVENTS
    SET STATUS = 'cancelled'
    WHERE EVENT_ID = p_event_id;

END;
$$;