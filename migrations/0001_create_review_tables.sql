CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL,
  artifact_name TEXT NOT NULL,
  artifact_category TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  review_token_hash TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  reviewed_at INTEGER
);

CREATE TABLE submission_images (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  object_key TEXT NOT NULL UNIQUE,
  size_bytes INTEGER NOT NULL
);

CREATE INDEX submissions_by_artifact_status
  ON submissions (artifact_id, status, created_at);

CREATE INDEX submissions_by_expiry
  ON submissions (status, expires_at);

CREATE INDEX submission_images_by_submission
  ON submission_images (submission_id);
