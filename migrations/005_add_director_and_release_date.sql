-- 005_add_director_and_release_date.sql

ALTER TABLE movies ADD COLUMN director TEXT;
ALTER TABLE movies ADD COLUMN release_date DATE;
