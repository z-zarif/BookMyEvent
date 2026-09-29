-- Transactional regression checks.
-- Run after schema.sql, triggers.sql, procedure.sql, and seed.sql.
-- Each check uses a nested transaction block and rolls its changes back.

-- 1. A failure after the first refund must roll back the complete event
-- cancellation attempt, including the first booking refund and ticket release.
DO $$
DECLARE
  v_event_id CHAR(15);
  v_first_booking_id CHAR(15);
  v_second_booking_id CHAR(15);
  v_second_payment_id CHAR(15);
  v_before_status VARCHAR(20);
  v_before_first_booking_status VARCHAR(20);
  v_before_first_tickets INTEGER;
  v_before_refunds INTEGER;
  v_failed BOOLEAN := FALSE;
  v_error_message TEXT;
BEGIN
  SELECT B.EVENT_ID, MIN(B.BOOKING_ID)
  INTO v_event_id, v_first_booking_id
  FROM BOOKINGS B
  LEFT JOIN PAYMENTS P ON P.BOOKING_ID = B.BOOKING_ID
  WHERE B.BK_STATUS IN ('pending', 'confirmed')
  GROUP BY B.EVENT_ID
  HAVING COUNT(DISTINCT B.BOOKING_ID) = 2
     AND COUNT(DISTINCT P.BOOKING_ID) = 2
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RAISE NOTICE 'SKIP cancellation rollback test: need an event with two paid bookings';
    RETURN;
  END IF;

  SELECT B.BOOKING_ID, P.PAYMENT_ID
  INTO v_second_booking_id, v_second_payment_id
  FROM BOOKINGS B
  JOIN PAYMENTS P ON P.BOOKING_ID = B.BOOKING_ID
  WHERE B.EVENT_ID = v_event_id
    AND B.BOOKING_ID <> v_first_booking_id
    AND B.BK_STATUS IN ('pending', 'confirmed')
  ORDER BY B.BOOKING_ID
  LIMIT 1;

  SELECT STATUS INTO v_before_status FROM EVENTS WHERE EVENT_ID = v_event_id;
  SELECT BK_STATUS INTO v_before_first_booking_status
  FROM BOOKINGS WHERE BOOKING_ID = v_first_booking_id;
  SELECT COUNT(*) INTO v_before_first_tickets
  FROM TICKETS WHERE BOOKING_ID = v_first_booking_id;
  SELECT COUNT(*) INTO v_before_refunds
  FROM WALLET_TRANSACTIONS
  WHERE REFERENCE_ID IN (v_first_booking_id, v_second_booking_id)
    AND TYPE = 'refund';

  BEGIN
    -- Remove the second payment only inside this test subtransaction. The
    -- event procedure succeeds for the first booking, then must fail at the
    -- second booking because its payment is missing.
    DELETE FROM PAYMENTS WHERE PAYMENT_ID = v_second_payment_id;
    CALL cancel_event(v_event_id, (SELECT ORGANIZER_ID FROM EVENTS WHERE EVENT_ID = v_event_id));
    RAISE EXCEPTION 'expected cancellation failure did not occur';
  EXCEPTION
    WHEN OTHERS THEN
      v_failed := TRUE;
      v_error_message := SQLERRM;
  END;

  IF NOT v_failed OR v_error_message = 'expected cancellation failure did not occur' THEN
    RAISE EXCEPTION 'Cancellation rollback test did not fail as expected';
  END IF;

  IF (SELECT STATUS FROM EVENTS WHERE EVENT_ID = v_event_id) <> v_before_status
     OR (SELECT BK_STATUS FROM BOOKINGS WHERE BOOKING_ID = v_first_booking_id)
        <> v_before_first_booking_status
     OR (SELECT COUNT(*) FROM TICKETS WHERE BOOKING_ID = v_first_booking_id)
        <> v_before_first_tickets
     OR (SELECT COUNT(*) FROM WALLET_TRANSACTIONS
         WHERE REFERENCE_ID IN (v_first_booking_id, v_second_booking_id)
           AND TYPE = 'refund') <> v_before_refunds THEN
    RAISE EXCEPTION 'Cancellation rollback test detected partial changes';
  END IF;

  RAISE NOTICE 'PASS cancellation rollback test';
END $$;


-- 2. Conditional approval must allow only one approval transition.
DO $$
DECLARE
  v_request_id CHAR(15);
  v_first_count INTEGER;
  v_second_count INTEGER;
BEGIN
  SELECT REQUEST_ID INTO v_request_id
  FROM ADD_MONEY_REQUESTS
  WHERE STATUS = 'pending'
  ORDER BY REQUESTED_AT
  LIMIT 1;

  IF v_request_id IS NULL THEN
    RAISE NOTICE 'SKIP approval race test: no pending add-money request';
    RETURN;
  END IF;

  BEGIN
    UPDATE ADD_MONEY_REQUESTS
    SET STATUS = 'approved'
    WHERE REQUEST_ID = v_request_id AND STATUS = 'pending';
    GET DIAGNOSTICS v_first_count = ROW_COUNT;

    UPDATE ADD_MONEY_REQUESTS
    SET STATUS = 'approved'
    WHERE REQUEST_ID = v_request_id AND STATUS = 'pending';
    GET DIAGNOSTICS v_second_count = ROW_COUNT;

    IF v_first_count <> 1 OR v_second_count <> 0 THEN
      RAISE EXCEPTION 'Approval conditional update returned %, then % rows',
        v_first_count, v_second_count;
    END IF;

    RAISE EXCEPTION 'rollback approval test changes';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM <> 'rollback approval test changes' THEN
        RAISE;
      END IF;
  END;

  RAISE NOTICE 'PASS conditional approval test';
END $$;


-- 3. Sold-out ticket types should become active again when tickets are released.
DO $$
DECLARE
  v_type_id CHAR(15);
  v_original_quantity INTEGER;
  v_original_status VARCHAR(20);
BEGIN
  SELECT TYPE_ID, QUANTITY_AVAILABLE, STATUS
  INTO v_type_id, v_original_quantity, v_original_status
  FROM TICKET_TYPE
  WHERE QUANTITY_AVAILABLE > 0
  ORDER BY TYPE_ID
  LIMIT 1;

  IF v_type_id IS NULL THEN
    RAISE NOTICE 'SKIP ticket reactivation test: no ticket type with available inventory';
    RETURN;
  END IF;

  BEGIN
    UPDATE TICKET_TYPE
    SET QUANTITY_AVAILABLE = 0
    WHERE TYPE_ID = v_type_id;

    IF (SELECT STATUS FROM TICKET_TYPE WHERE TYPE_ID = v_type_id) <> 'inactive' THEN
      RAISE EXCEPTION 'Ticket type did not become inactive at zero availability';
    END IF;

    UPDATE TICKET_TYPE
    SET QUANTITY_AVAILABLE = 1
    WHERE TYPE_ID = v_type_id;

    IF (SELECT STATUS FROM TICKET_TYPE WHERE TYPE_ID = v_type_id) <> 'active' THEN
      RAISE EXCEPTION 'Ticket type did not reactivate after inventory release';
    END IF;

    RAISE EXCEPTION 'rollback ticket reactivation test changes';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM <> 'rollback ticket reactivation test changes' THEN
        RAISE;
      END IF;
  END;

  RAISE NOTICE 'PASS ticket reactivation test (original %, %)',
    v_original_quantity, v_original_status;
END $$;
