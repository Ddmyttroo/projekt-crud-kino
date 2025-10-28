CREATE TABLE IF NOT EXISTS movies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  year INTEGER CHECK (year IS NULL OR year >= 1888),
  genre TEXT,
  rating INTEGER DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  comment TEXT,
  watched INTEGER NOT NULL DEFAULT 0 CHECK (watched IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  last_watched_at TEXT DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_movies_year ON movies(year);
CREATE INDEX IF NOT EXISTS idx_movies_title ON movies(title);
CREATE INDEX IF NOT EXISTS idx_movies_watched ON movies(watched);
CREATE INDEX IF NOT EXISTS idx_movies_lastwatched ON movies(last_watched_at);
