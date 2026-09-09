CREATE OR REPLACE PROCEDURE cancel_booking(
    p_booking_id CHAR(15),
    p_user_id    CHAR(15)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_bk_status  VARCHAR(20);
    v_owner_id   CHAR(15);
    v_amount     NUMERIC(10,2);
    v_wallet_id  CHAR(15);
BEGIN
    -- Lock the booking row so a concurrent cancel can't race with this one
    SELECT BK_STATUS, USER_ID
    INTO v_bk_status, v_owner_id
    FROM BOOKINGS
    WHERE BOOKING_ID = p_booking_id
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

    -- Pull refund amount + destination wallet from the original payment
    SELECT AMOUNT, DEBITED_FROM
    INTO v_amount, v_wallet_id
    FROM PAYMENTS
    WHERE BOOKING_ID = p_booking_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No payment found for booking %', p_booking_id
    USING ERRCODE = 'BK404';
    END IF;

    -- Deleting the tickets does two jobs for free via existing triggers:
    --   trg_release_ticket        -> restores QUANTITY_AVAILABLE per ticket type
    --   trg_tickets_sync_booking_total -> recalculates BOOKINGS.TOTAL_COST (drops to 0)
    DELETE FROM TICKETS
    WHERE BOOKING_ID = p_booking_id;

    UPDATE BOOKINGS
    SET BK_STATUS = 'cancelled'
    WHERE BOOKING_ID = p_booking_id;

    -- trg_wallet_transactions_apply credits the wallet balance automatically
    INSERT INTO WALLET_TRANSACTIONS
        (TRANSACTION_ID, WALLET_ID, TYPE, AMOUNT, REASON, REFERENCE_ID, HAPPENED_AT)
    VALUES
        (fn_generate_id('WTX'), v_wallet_id, 'refund', v_amount,
         'Refund for cancelled booking', p_booking_id, CURRENT_TIMESTAMP);

    COMMIT;

EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END;
$$;


CREATE OR REPLACE PROCEDURE cancel_event(
    p_event_id      CHAR(15),
    p_organizer_id  CHAR(15)
)
LANGUAGE plpgsql
AS $$
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

    -- Cancel every active booking for this event, one at a time
    FOR r IN
        SELECT BOOKING_ID, USER_ID
        FROM BOOKINGS
        WHERE EVENT_ID = p_event_id
          AND BK_STATUS IN ('pending', 'confirmed')
        ORDER BY BOOKING_ID
    LOOP
        CALL cancel_booking(r.BOOKING_ID, r.USER_ID);
    END LOOP;

    UPDATE EVENTS
    SET STATUS = 'cancelled'
    WHERE EVENT_ID = p_event_id;

    COMMIT;

EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END;
$$;