-- Adds an optional photo to events. Safe to run anytime - existing events
-- just get NULL, which the frontend falls back to a placeholder image for.

ALTER TABLE EVENTS ADD COLUMN IF NOT EXISTS PHOTO_URL TEXT;
