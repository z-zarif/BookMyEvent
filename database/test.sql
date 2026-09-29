SELECT
  c.relname AS table_name,
  t.tgname AS trigger_name,
  p.proname AS function_name,
  p.prosrc AS function_source
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname IN ('tickets', 'ticket_type')
AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

SELECT prosrc FROM pg_proc WHERE proname = 'fn_reserve_ticket';

SELECT
  prosrc LIKE '%NEW.TYPE_ID%' AS still_has_bug,
  prosrc LIKE '%NEW.TICKET_TYPE_ID%' AS has_correct_fix
FROM pg_proc
WHERE proname = 'fn_reserve_ticket';

SELECT p.proname AS function_name, t.line
FROM pg_proc p,
LATERAL unnest(string_to_array(p.prosrc, E'\n')) AS t(line)
WHERE p.prorettype = 'trigger'::regtype
  AND p.pronamespace = 'public'::regnamespace
  AND regexp_replace(t.line, '--.*$', '') ~* 'type_id'
  AND regexp_replace(t.line, '--.*$', '') !~* 'ticket_type_id'
ORDER BY p.proname;

SELECT p.proname AS function_name, t.line
FROM pg_proc p,
LATERAL unnest(string_to_array(p.prosrc, E'\n')) AS t(line)
WHERE p.prorettype = 'trigger'::regtype
  AND p.pronamespace = 'public'::regnamespace
  AND regexp_replace(t.line, '--.*$', '') ~* 'type_id'
  AND regexp_replace(t.line, '--.*$', '') !~* 'ticket_type_id'
ORDER BY p.proname;




SELECT p.proname AS function_name, t.line
FROM pg_proc p,
LATERAL unnest(string_to_array(p.prosrc, E'\n')) AS t(line)
WHERE p.prorettype = 'trigger'::regtype
  AND p.pronamespace = 'public'::regnamespace
  AND regexp_replace(t.line, '--.*$', '') ~* 'type_id'
  AND regexp_replace(t.line, '--.*$', '') !~* 'ticket_type_id'
ORDER BY p.proname;



SELECT USER_ID FROM USERS;
SELECT USER_ID, WALLET_ID FROM WALLETS;

SELECT tgname, tgrelid::regclass AS on_table
FROM pg_trigger
WHERE NOT tgisinternal;


INSERT INTO WALLETS (WALLET_ID, USER_ID)
SELECT fn_generate_id('WAL'), U.USER_ID
FROM USERS U
WHERE NOT EXISTS (SELECT 1 FROM WALLETS W WHERE W.USER_ID = U.USER_ID);

SELECT COUNT(*) FROM WALLETS;  -- should be 11


SELECT EMAIL 
FROM USERS;

SELECT p.proname, p.prokind, pg_get_function_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'cancel_booking'
  AND n.nspname = 'public';

CREATE TEMP TABLE tmp_seed_organizer_ids AS
SELECT USER_ID FROM USERS WHERE EMAIL LIKE '%@eventia.test';

CREATE TEMP TABLE tmp_seed_event_ids AS
SELECT EVENT_ID FROM EVENTS WHERE ORGANIZER_ID IN (SELECT USER_ID FROM tmp_seed_organizer_ids);

CREATE TEMP TABLE tmp_seed_booking_ids AS
SELECT BOOKING_ID FROM BOOKINGS WHERE EVENT_ID IN (SELECT EVENT_ID FROM tmp_seed_event_ids);

-- inspect before deleting anything
SELECT B.BOOKING_ID, B.USER_ID, B.BK_STATUS, E.TITLE
FROM BOOKINGS B
JOIN EVENTS E ON E.EVENT_ID = B.EVENT_ID
WHERE B.BOOKING_ID IN (SELECT BOOKING_ID FROM tmp_seed_booking_ids);


SELECT
  B.BOOKING_ID,
  B.BK_STATUS,
  U.USER_NAME,
  U.EMAIL,
  P.AMOUNT,
  P.DEBITED_FROM AS WALLET_ID,
  E.TITLE
FROM BOOKINGS B
JOIN USERS U ON U.USER_ID = B.USER_ID
JOIN EVENTS E ON E.EVENT_ID = B.EVENT_ID
LEFT JOIN PAYMENTS P ON P.BOOKING_ID = B.BOOKING_ID
WHERE B.BOOKING_ID IN (
  'BKG48067c64f1f5', 'BKG93075f5f7466', 'BKGdd1baff12180', 'BKG3ab6214a5af2', 'BKG6ff343f77f9c'
);



SELECT * FROM TICKETS WHERE BOOKING_ID = 'BKG6ff343f77f9c';

SELECT * FROM WALLET_TRANSACTIONS
WHERE REFERENCE_ID = 'BKG6ff343f77f9c';

INSERT INTO WALLET_TRANSACTIONS (TRANSACTION_ID, WALLET_ID, TYPE, AMOUNT, REASON, REFERENCE_ID, HAPPENED_AT)
VALUES
  (fn_generate_id('WTX'), 'WALefd6f75d47d8', 'refund', 2250.00, 'Refund: event removed from test data', 'BKG48067c64f1f5', CURRENT_TIMESTAMP),
  (fn_generate_id('WTX'), 'WALa2a95a3d5295', 'refund', 4132.00, 'Refund: event removed from test data', 'BKG93075f5f7466', CURRENT_TIMESTAMP),
  (fn_generate_id('WTX'), 'WALa2a95a3d5295', 'refund', 8106.00, 'Refund: event removed from test data', 'BKGdd1baff12180', CURRENT_TIMESTAMP),
  (fn_generate_id('WTX'), 'WALa2a95a3d5295', 'refund', 4475.00, 'Refund: event removed from test data', 'BKG3ab6214a5af2', CURRENT_TIMESTAMP);


  SELECT WALLET_ID, BALANCE FROM WALLETS
WHERE WALLET_ID IN ('WALefd6f75d47d8', 'WALa2a95a3d5295', 'WALa26bfdb20bf5');

SELECT * FROM WALLET_TRANSACTIONS
WHERE REFERENCE_ID IN ('BKG48067c64f1f5', 'BKG93075f5f7466', 'BKGdd1baff12180', 'BKG3ab6214a5af2')
  AND TYPE = 'refund';


  SELECT WALLET_ID, BALANCE FROM WALLETS
WHERE WALLET_ID IN ('WALefd6f75d47d8', 'WALa2a95a3d5295', 'WALa26bfdb20bf5');

BEGIN;

DROP TABLE IF EXISTS tmp_seed_organizer_ids;
DROP TABLE IF EXISTS tmp_seed_event_ids;
DROP TABLE IF EXISTS tmp_seed_booking_ids;

CREATE TEMP TABLE tmp_seed_organizer_ids AS
SELECT USER_ID FROM USERS WHERE EMAIL LIKE '%@eventia.test';

CREATE TEMP TABLE tmp_seed_event_ids AS
SELECT EVENT_ID FROM EVENTS WHERE ORGANIZER_ID IN (SELECT USER_ID FROM tmp_seed_organizer_ids);

CREATE TEMP TABLE tmp_seed_booking_ids AS
SELECT BOOKING_ID FROM BOOKINGS WHERE EVENT_ID IN (SELECT EVENT_ID FROM tmp_seed_event_ids);

-- sanity check counts before deleting — sanity numbers only, compare to what you expect
SELECT
  (SELECT COUNT(*) FROM tmp_seed_organizer_ids) AS organizers,
  (SELECT COUNT(*) FROM tmp_seed_event_ids) AS events,
  (SELECT COUNT(*) FROM tmp_seed_booking_ids) AS bookings;



DELETE FROM TICKET_AUDIT_LOG
WHERE TYPE_ID IN (
  SELECT TYPE_ID FROM TICKET_TYPE
  WHERE EVENT_ID IN (SELECT EVENT_ID FROM tmp_seed_event_ids)
);

DELETE FROM PROMO_REDEMPTIONS WHERE BOOKING_ID IN (SELECT BOOKING_ID FROM tmp_seed_booking_ids);
DELETE FROM PAYMENTS WHERE BOOKING_ID IN (SELECT BOOKING_ID FROM tmp_seed_booking_ids);
DELETE FROM WALLET_TRANSACTIONS WHERE REFERENCE_ID IN (SELECT BOOKING_ID FROM tmp_seed_booking_ids);
DELETE FROM TICKETS WHERE BOOKING_ID IN (SELECT BOOKING_ID FROM tmp_seed_booking_ids);
DELETE FROM BOOKINGS WHERE BOOKING_ID IN (SELECT BOOKING_ID FROM tmp_seed_booking_ids);

DELETE FROM TICKET_TYPE WHERE EVENT_ID IN (SELECT EVENT_ID FROM tmp_seed_event_ids);
DELETE FROM EVENTS WHERE EVENT_ID IN (SELECT EVENT_ID FROM tmp_seed_event_ids);

DELETE FROM WALLETS WHERE USER_ID IN (SELECT USER_ID FROM tmp_seed_organizer_ids);
DELETE FROM ORGANIZERS WHERE ORGANIZER_ID IN (SELECT USER_ID FROM tmp_seed_organizer_ids);
DELETE FROM USERS WHERE USER_ID IN (SELECT USER_ID FROM tmp_seed_organizer_ids);

DROP TABLE tmp_seed_booking_ids;
DROP TABLE tmp_seed_event_ids;
DROP TABLE tmp_seed_organizer_ids;

COMMIT;




CREATE OR REPLACE FUNCTION fn_mark_completed_events()
RETURNS INTEGER AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE EVENTS
  SET STATUS = 'completed'
  WHERE STATUS = 'scheduled'
    AND EVENT_DATE_TIME < CURRENT_TIMESTAMP;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql;