BEGIN;

DO $$
DECLARE
  organizer_ids CHAR(15)[] := '{}';
  v_user_id CHAR(15);
  v_event_id CHAR(15);
  v_type_id CHAR(15);
  j INT;
  k INT;
  m INT;
  cat TEXT;
  v_price NUMERIC(10,2);
  event_categories TEXT[];
  organizer_names TEXT[] := ARRAY[
    'Skyline Live', 'Underground Sounds Co.', 'Riverside Presents',
    'Neon Collective', 'Warehouse Nine Events'
  ];
  organizer_emails TEXT[] := ARRAY[
    'organizer1@eventia.test', 'organizer2@eventia.test', 'organizer3@eventia.test',
    'organizer4@eventia.test', 'organizer5@eventia.test'
  ];
  shared_password_hash TEXT := '$2b$10$Mt44sU/T8gKE04JPYZ0vo.tyrTILRIo5vCffZW3ZiEO2V0AijhMPu';
  -- ordered cheapest -> priciest; price bands below rely on this ranking
  categories TEXT[] := ARRAY['EARLY_BIRD', 'REGULAR', 'VIP', 'PLATINUM'];
  venues TEXT[] := ARRAY['Skyline Arena', 'The Underground', 'Riverside Amphitheatre',
    'Neon Hall', 'Warehouse 9', 'Echo Park', 'The Fillmore East', 'Stardust Pavilion'];
  titles TEXT[] := ARRAY[
    'Arctic Waves Live', 'The Midnight Parade', 'Solstice Fest', 'Neon Static', 'Echo Chamber Live',
    'Velvet Thunder Tour', 'Crimson Skyline', 'Glass Horizon', 'Wildfire Sessions', 'Lunar Drift',
    'Static Bloom', 'Paper Planes Reunion', 'Ashes to Anthems', 'Golden Hour Live', 'Feral Youth Tour',
    'The Analog Kids', 'Rooftop Riot', 'Afterglow Sessions', 'Iron Orchid', 'Ultraviolet Nights'
  ];
BEGIN
  -- 1. Create 5 real organizer accounts (unchanged)
  FOR i IN 1..5 LOOP
    v_user_id := fn_generate_id('USR');
    INSERT INTO USERS (USER_ID, USER_NAME, EMAIL, PASSWORD, GENDER)
    VALUES (v_user_id, organizer_names[i], organizer_emails[i], shared_password_hash, 'prefer_not_to_say');

    INSERT INTO ORGANIZERS (ORGANIZER_ID, COMPANY_NAME, BIO)
    VALUES (v_user_id, organizer_names[i], 'Live event promoter on Eventia.');

    INSERT INTO WALLETS (WALLET_ID, USER_ID)
    VALUES (fn_generate_id('WAL'), v_user_id);

    organizer_ids := array_append(organizer_ids, v_user_id);
  END LOOP;

  -- 2. Create 20 events
  FOR j IN 1..20 LOOP
    v_event_id := fn_generate_id('EVNT');
    INSERT INTO EVENTS (EVENT_ID, ORGANIZER_ID, TITLE, EVENT_DATE_TIME, VENUE, DESCRIBE_EVENT, STATUS)
    VALUES (
      v_event_id,
      organizer_ids[1 + (j % 5)],
      titles[j],
      NOW() + (j * 3) * interval '1 day' + floor(random() * 12)::int * interval '1 hour',
      venues[1 + (j % array_length(venues, 1))],
      'Live at ' || venues[1 + (j % array_length(venues, 1))] || '. Doors open early, don''t miss it.',
      'scheduled'
    );

    -- 3. Give each event 2-3 DISTINCT ticket categories, priced by band
    k := 2 + floor(random() * 2)::int;

    -- unnest(categories) yields each of the 4 values exactly once, so
    -- ORDER BY random() LIMIT k picks k of them WITHOUT duplicates
    event_categories := ARRAY(
      SELECT c FROM unnest(categories) AS c
      ORDER BY random()
      LIMIT k
    );

    FOR m IN 1..array_length(event_categories, 1) LOOP
      cat := event_categories[m];
      v_type_id := fn_generate_id('TKTTP');

      -- Non-overlapping bands guarantee EARLY_BIRD < REGULAR < VIP < PLATINUM
      -- no matter what the random roll lands on within each band
      v_price := CASE cat
        WHEN 'EARLY_BIRD' THEN (200  + floor(random() * 800))::numeric(10,2)   -- 200–999
        WHEN 'REGULAR'    THEN (1000 + floor(random() * 1500))::numeric(10,2)  -- 1000–2499
        WHEN 'VIP'        THEN (2500 + floor(random() * 1500))::numeric(10,2)  -- 2500–3999
        WHEN 'PLATINUM'   THEN (4000 + floor(random() * 2000))::numeric(10,2)  -- 4000–5999
      END;

      INSERT INTO TICKET_TYPE (TYPE_ID, EVENT_ID, CATEGORY, QUANTITY_AVAILABLE, STATUS, PRICE)
      VALUES (v_type_id, v_event_id, cat, 20 + floor(random() * 180)::int, 'active', v_price);
    END LOOP;
  END LOOP;
END $$;




UPDATE TICKET_TYPE
SET PRICE = ROUND(PRICE / 50) * 50
WHERE EVENT_ID IN (
  SELECT EVENT_ID FROM EVENTS
  WHERE ORGANIZER_ID IN (
    SELECT USER_ID FROM USERS WHERE EMAIL LIKE '%@eventia.test'
  )
);

-- 4. Test promo codes for checkout and admin reporting
-- Active codes can be used immediately. The expired and inactive codes are
-- intentional negative cases for validating promo rejection behavior.
INSERT INTO PROMO_CODES
  (PROMO_ID, CODE, VALID_FROM, VALID_TO, DISCOUNT_TYPE, DISCOUNT_VALUE, STATUS)
VALUES
  ('PRMTEST0000001', 'TEST10',      CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '30 days', 'percentage', 10.00, 'active'),
  ('PRMTEST0000002', 'TEST25',      CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '30 days', 'percentage', 25.00, 'active'),
  ('PRMTEST0000003', 'FLAT500',     CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '30 days', 'flat',       500.00, 'active'),
  ('PRMTEST0000004', 'FLAT2000',    CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '30 days', 'flat',      2000.00, 'active'),
  ('PRMTEST0000005', 'TEST1',       CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '30 days', 'percentage',  1.00, 'active'),
  ('PRMTEST0000006', 'TEST100',     CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '30 days', 'percentage',100.00, 'active'),
  ('PRMTEST0000007', 'EXPIRED10',   CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '1 day', 'percentage', 10.00, 'active'),
  ('PRMTEST0000008', 'INACTIVE10',  CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '30 days', 'percentage', 10.00, 'inactive')
ON CONFLICT (CODE) DO UPDATE
SET VALID_FROM = EXCLUDED.VALID_FROM,
    VALID_TO = EXCLUDED.VALID_TO,
    DISCOUNT_TYPE = EXCLUDED.DISCOUNT_TYPE,
    DISCOUNT_VALUE = EXCLUDED.DISCOUNT_VALUE,
    STATUS = EXCLUDED.STATUS;

COMMIT;