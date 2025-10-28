// server.js v11 + favorites
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { getDb } from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TMDB_KEY = process.env.TMDB_API_KEY;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const MovieSchema = z.object({
  title: z.string().min(1).max(200),
  year: z.number().int().min(1888).max(2100).nullable().optional(),
  genre: z.string().trim().max(200).optional().default(''),
  rating: z.number().int().min(0).max(5).optional().default(0),
  comment: z.string().max(1000).optional().default(''),
  watched: z.boolean().optional().default(false),
  favorite: z.boolean().optional().default(false),
  poster_url: z.string().trim().url().optional().nullable(),
  tmdb_id: z.number().int().optional().nullable()
});

const db = getDb();
const rowToMovie = r => ({
  ...r,
  watched: !!r.watched,
  favorite: !!r.favorite,
  rating: Number(r.rating ?? 0)
});

// LIST
app.get('/api/movies', (req, res) => {
  const { q, watched, favorite } = req.query;
  const parts = []; const params = [];
  if (q){ parts.push('(title LIKE ? OR genre LIKE ? OR year LIKE ?)'); params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  if (watched === 'true') parts.push('watched = 1');
  if (watched === 'false') parts.push('watched = 0');
  if (favorite === 'true') parts.push('favorite = 1');
  if (favorite === 'false') parts.push('favorite = 0');
  const where = parts.length ? `WHERE ${parts.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM movies ${where} ORDER BY id DESC`).all(...params);
  res.json(rows.map(rowToMovie));
});

// RECENT (залишаємо як раніше — останні переглянуті; для улюблених робимо окремий ендпоінт)
app.get('/api/movies/recent', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM movies
    WHERE watched=1 AND last_watched_at IS NOT NULL
    ORDER BY last_watched_at DESC LIMIT 10
  `).all();
  res.json(rows.map(rowToMovie));
});

// FAVORITES (новий список)
app.get('/api/movies/favorites', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM movies
    WHERE favorite = 1
    ORDER BY updated_at DESC, id DESC
    LIMIT 50
  `).all();
  res.json(rows.map(rowToMovie));
});

// ONE
app.get('/api/movies/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM movies WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: 'Not found' });
  res.json(rowToMovie(row));
});

// CREATE
app.post('/api/movies', (req, res) => {
  const parsed = MovieSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
  const { title, year=null, genre, rating, comment, watched, favorite, poster_url, tmdb_id=null } = parsed.data;
  const poster = poster_url && String(poster_url).trim() ? String(poster_url).trim() : null;
  const now = new Date().toISOString();
  const info = db.prepare(`
    INSERT INTO movies (tmdb_id, title, year, genre, rating, comment, watched, favorite, created_at, updated_at, last_watched_at, poster_url)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(tmdb_id, title, year, genre, rating, comment, watched?1:0, favorite?1:0, now, now, watched? now : null, poster);
  const created = db.prepare('SELECT * FROM movies WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(rowToMovie(created));
});

// UPDATE
app.put('/api/movies/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ message: 'Bad id' });
  const parsed = MovieSchema.partial().refine(o=>Object.keys(o).length>0, {message:'Empty body'}).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
  const prev = db.prepare('SELECT * FROM movies WHERE id = ?').get(id);
  if (!prev) return res.status(404).json({ message: 'Not found' });

  const next = { ...prev, ...parsed.data };
  const now = new Date().toISOString();
  const watchedInt = next.watched ? 1 : 0;
  const favoriteInt = next.favorite ? 1 : 0;
  const lastWatched =
    (prev.watched === 0 && watchedInt === 1) ? now :
    (prev.watched === 1 && watchedInt === 0) ? null :
    prev.last_watched_at;

  const poster =
    next.poster_url === undefined
      ? prev.poster_url
      : (next.poster_url && String(next.poster_url).trim()) || null;

  db.prepare(`
    UPDATE movies
    SET tmdb_id=?, title=?, year=?, genre=?, rating=?, comment=?, watched=?, favorite=?, updated_at=?, last_watched_at=?, poster_url=?
    WHERE id=?
  `).run(
    next.tmdb_id ?? prev.tmdb_id,
    next.title ?? prev.title,
    (next.year===undefined ? prev.year : next.year),
    next.genre ?? prev.genre,
    Number(next.rating ?? prev.rating ?? 0),
    next.comment ?? prev.comment,
    watchedInt,
    favoriteInt,
    now,
    lastWatched,
    poster,
    id
  );
  const row = db.prepare('SELECT * FROM movies WHERE id = ?').get(id);
  res.json(rowToMovie(row));
});

// QUICK toggle favorite
app.put('/api/movies/:id/favorite', (req, res) => {
  const id = Number(req.params.id);
  const { favorite } = req.body || {};
  if (!Number.isInteger(id)) return res.status(400).json({ message: 'Bad id' });
  const prev = db.prepare('SELECT * FROM movies WHERE id=?').get(id);
  if (!prev) return res.status(404).json({ message: 'Not found' });
  const now = new Date().toISOString();
  db.prepare(`UPDATE movies SET favorite=?, updated_at=? WHERE id=?`)
    .run(favorite ? 1 : 0, now, id);
  const row = db.prepare('SELECT * FROM movies WHERE id=?').get(id);
  res.json(rowToMovie(row));
});

// DELETE
app.delete('/api/movies/:id', (req, res) => {
  const info = db.prepare('DELETE FROM movies WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ message: 'Not found' });
  res.status(204).send();
});

// TMDB SEARCH
app.get('/api/tmdb/search', async (req, res) => {
  try {
    if (!TMDB_KEY) return res.status(500).json({ message: 'TMDB key is missing' });
    const q = String(req.query.q || '').trim();
    if (!q) return res.json([]);
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&language=uk-UA&query=${encodeURIComponent(q)}`;
    const r = await fetch(url);
    const data = await r.json();
    const results = (data.results || []).slice(0, 12).map(m => ({
      tmdb_id: m.id,
      title: m.title || m.original_title,
      year: (m.release_date || '').slice(0,4) || null,
      poster_url: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null
    }));
    res.json(results);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// TMDB ADD (тепер можемо додавати в улюблені без watched)
app.post('/api/tmdb/add', async (req, res) => {
  try {
    if (!TMDB_KEY) return res.status(500).json({ message: 'TMDB key is missing' });
    const { tmdb_id, watched=false, favorite=false } = req.body || {};
    if (!tmdb_id) return res.status(400).json({ message: 'tmdb_id is required' });

    const existing = db.prepare('SELECT * FROM movies WHERE tmdb_id = ?').get(tmdb_id);
    if (existing) return res.status(200).json(rowToMovie(existing));

    const url = `https://api.themoviedb.org/3/movie/${tmdb_id}?api_key=${TMDB_KEY}&language=uk-UA`;
    const r = await fetch(url);
    if (!r.ok) return res.status(404).json({ message: 'Not found in TMDB' });
    const m = await r.json();

    const title = m.title || m.original_title;
    const year = (m.release_date || '').slice(0,4) ? Number((m.release_date || '').slice(0,4)) : null;
    const genre = (m.genres || []).map(g => g.name).join(', ');
    const poster_url = m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null;

    const now = new Date().toISOString();
    const info = db.prepare(`
      INSERT INTO movies (tmdb_id, title, year, genre, rating, comment, watched, favorite, created_at, updated_at, last_watched_at, poster_url)
      VALUES (?, ?, ?, ?, 0, '', ?, ?, ?, ?, ?, ?)
    `).run(tmdb_id, title, year, genre, watched?1:0, favorite?1:0, now, now, watched? now : null, poster_url);

    const created = db.prepare('SELECT * FROM movies WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(rowToMovie(created));
  } catch (e) {
    const again = db.prepare('SELECT * FROM movies WHERE tmdb_id = ?').get(req.body?.tmdb_id);
    if (again) return res.status(200).json(rowToMovie(again));
    res.status(500).json({ message: e.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`✔ API & Frontend: http://localhost:${PORT}`));
