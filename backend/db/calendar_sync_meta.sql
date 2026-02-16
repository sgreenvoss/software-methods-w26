CREATE TABLE IF NOT EXISTS calendar_sync_meta (
  calendar_id INTEGER PRIMARY KEY REFERENCES calendar (calendar_id),
  last_refreshed TIMESTAMPTZ,
  last_error TEXT,
  sync_token TEXT
);
