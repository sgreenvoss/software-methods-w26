ALTER TABLE calendar
  ADD COLUMN IF NOT EXISTS person_id INTEGER REFERENCES person (user_id);

CREATE INDEX IF NOT EXISTS idx_calendar_person_id ON calendar (person_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_calendar_person_gcal
  ON calendar (person_id, gcal_id);
