
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_ticket_type_event_category'
  ) THEN
    ALTER TABLE TICKET_TYPE
      ADD CONSTRAINT uq_ticket_type_event_category
      UNIQUE (EVENT_ID, CATEGORY);
  END IF;
END
$$;
