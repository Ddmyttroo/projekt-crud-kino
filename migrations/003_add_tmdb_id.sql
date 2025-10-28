ALTER TABLE movies ADD COLUMN tmdb_id INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS uq_movies_tmdb ON movies(tmdb_id);
