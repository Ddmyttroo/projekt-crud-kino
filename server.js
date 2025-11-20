// server.js v13 — movies per user + admin + nickname + backend validation + error format
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { getDb } from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TMDB_KEY = process.env.TMDB_API_KEY;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = getDb();

/* ===== ЕДИНИЙ ФОРМАТ ПОМИЛОК ===== */

function makeError(status, error, message, fieldErrors = []) {
  return {
    timestamp: new Date().toISOString(),
    status,
    error,
    message,
    fieldErrors
  };
}

function zodToFieldErrors(zerr) {
  const flat = zerr.flatten();
  const list = [];
  for (const [field, msgs] of Object.entries(flat.fieldErrors || {})) {
    (msgs || []).forEach(msg => {
      list.push({
        field,
        code: 'INVALID',
        message: msg
      });
    });
  }
  return list;
}

/* ===== СХЕМИ ===== */

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

// логін/реєстрація
const RegisterSchema = z.object({
  email: z.string().trim().min(3).max(200).email(),
  password: z.string().min(6).max(200),
  nickname: z.string().trim().min(2).max(50)
});

const LoginSchema = z.object({
  email: z.string().trim().min(3).max(200).email(),
  password: z.string().min(6).max(200)
});

/* ===== УТИЛІТИ КОРИСТУВАЧА ===== */

// Отримання поточного юзера з заголовка X-User-Id
function getCurrentUser(req) {
  const id = Number(req.headers['x-user-id']);
  if (!id) return null;

  const user = db
    .prepare('SELECT id, email, nickname, is_admin FROM users WHERE id = ?')
    .get(id);
  return user || null;
}

// Якщо ще немає admin — робимо першого користувача адміном
// і привʼязуємо до нього ВСІ фільми без user_id
function ensureAdminForExistingData() {
  const admin = db.prepare('SELECT id FROM users WHERE is_admin = 1').get();
  if (admin) return;

  const firstUser = db
    .prepare('SELECT id FROM users ORDER BY id ASC LIMIT 1')
    .get();

  if (!firstUser) return;

  db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(firstUser.id);
  db.prepare('UPDATE movies SET user_id = ? WHERE user_id IS NULL')
    .run(firstUser.id);

  console.log(
    '✔ Promoted first user to admin and attached all movies without user_id to them'
  );
}

// Гарантуємо нік для юзера, якщо він ще відсутній
function ensureNicknameForUser(user) {
  if (user.nickname) return user;

  let base = (user.email.split('@')[0] || 'user').slice(0, 20) || 'user';
  let nick = base;
  let i = 1;

  while (true) {
    const exists = db
      .prepare('SELECT id FROM users WHERE nickname = ? AND id <> ?')
      .get(nick, user.id);
    if (!exists) break;
    nick = `${base}_${i++}`;
  }

  db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(nick, user.id);
  return { ...user, nickname: nick };
}

// Викликаємо один раз при старті сервера
ensureAdminForExistingData();

/* ===== HELPERS ДЛЯ MOVIES ===== */

const rowToMovie = (r) => ({
  ...r,
  watched: !!r.watched,
  favorite: !!r.favorite,
  rating: Number(r.rating ?? 0)
});

/* ===== MIDDLEWARE НА АВТОРИЗАЦІЮ (простий) ===== */

function requireUser(req, res) {
  const user = getCurrentUser(req);
  if (!user) {
    res
      .status(401)
      .json(makeError(401, 'Unauthorized', 'Brak autoryzacji'));
    return null;
  }
  return user;
}

/* ===== MOVIES API (привʼязані до user_id) ===== */

// LIST
app.get('/api/movies', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const { q, watched, favorite } = req.query;
  const parts = ['user_id = ?'];
  const params = [user.id];

  if (q) {
    parts.push('(title LIKE ? OR genre LIKE ? OR year LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (watched === 'true') parts.push('watched = 1');
  if (watched === 'false') parts.push('watched = 0');
  if (favorite === 'true') parts.push('favorite = 1');
  if (favorite === 'false') parts.push('favorite = 0');

  const where = parts.length ? `WHERE ${parts.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM movies ${where} ORDER BY id DESC`)
    .all(...params);

  res.json(rows.map(rowToMovie));
});

// RECENT — останні переглянуті
app.get('/api/movies/recent', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const rows = db
    .prepare(
      `
    SELECT * FROM movies
    WHERE user_id = ? AND watched = 1 AND last_watched_at IS NOT NULL
    ORDER BY last_watched_at DESC
    LIMIT 10
  `
    )
    .all(user.id);

  res.json(rows.map(rowToMovie));
});

// FAVORITES
app.get('/api/movies/favorites', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const rows = db
    .prepare(
      `
    SELECT * FROM movies
    WHERE user_id = ? AND favorite = 1
    ORDER BY updated_at DESC, id DESC
    LIMIT 50
  `
    )
    .all(user.id);

  res.json(rows.map(rowToMovie));
});

// ONE
app.get('/api/movies/:id', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const row = db
    .prepare('SELECT * FROM movies WHERE id = ? AND user_id = ?')
    .get(req.params.id, user.id);

  if (!row) {
    return res
      .status(404)
      .json(makeError(404, 'Not Found', 'Film nie istnieje'));
  }

  res.json(rowToMovie(row));
});

// CREATE
app.post('/api/movies', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const parsed = MovieSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json(
        makeError(
          400,
          'Bad Request',
          'Niepoprawne dane filmu',
          zodToFieldErrors(parsed.error)
        )
      );
  }

  let {
    title,
    year = null,
    genre,
    rating,
    comment,
    watched,
    favorite,
    poster_url,
    tmdb_id = null
  } = parsed.data;

  const ratingInt = Number(rating ?? 0);
  const watchedBool = !!watched;

  // Biznesowa reguła: nie można dać oceny, jeśli film nie jest obejrzany
  if (!watchedBool && ratingInt > 0) {
    return res
      .status(422)
      .json(
        makeError(
          422,
          'Unprocessable Entity',
          'Naruszenie reguł biznesowych',
          [
            {
              field: 'rating',
              code: 'RATING_WITHOUT_WATCHED',
              message:
                'Nie możesz wystawić oceny, jeśli film nie jest oznaczony jako obejrzany'
            }
          ]
        )
      );
  }

  const poster =
    poster_url && String(poster_url).trim()
      ? String(poster_url).trim()
      : null;

  const now = new Date().toISOString();

  const info = db
    .prepare(
      `
    INSERT INTO movies (
      tmdb_id, title, year, genre,
      rating, comment,
      watched, favorite,
      created_at, updated_at, last_watched_at, poster_url,
      user_id
    )
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `
    )
    .run(
      tmdb_id,
      title,
      year,
      genre,
      ratingInt,
      comment,
      watchedBool ? 1 : 0,
      favorite ? 1 : 0,
      now,
      now,
      watchedBool ? now : null,
      poster,
      user.id
    );

  const created = db
    .prepare('SELECT * FROM movies WHERE id = ?')
    .get(info.lastInsertRowid);

  res.status(201).json(rowToMovie(created));
});

// UPDATE
app.put('/api/movies/:id', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res
      .status(400)
      .json(makeError(400, 'Bad Request', 'Nieprawidłowe ID filmu'));
  }

  const parsed = MovieSchema.partial()
    .refine((o) => Object.keys(o).length > 0, { message: 'Empty body' })
    .safeParse(req.body);

  if (!parsed.success) {
    return res
      .status(400)
      .json(
        makeError(
          400,
          'Bad Request',
          'Niepoprawne dane filmu',
          zodToFieldErrors(parsed.error)
        )
      );
  }

  const prev = db
    .prepare('SELECT * FROM movies WHERE id = ? AND user_id = ?')
    .get(id, user.id);

  if (!prev) {
    return res
      .status(404)
      .json(makeError(404, 'Not Found', 'Film nie istnieje'));
  }

  const next = { ...prev, ...parsed.data };
  const now = new Date().toISOString();

  const watchedInt = next.watched ? 1 : 0;
  const favoriteInt = next.favorite ? 1 : 0;
  const ratingInt = Number(next.rating ?? prev.rating ?? 0);

  // Biznesowa reguła
  if (!next.watched && ratingInt > 0) {
    return res
      .status(422)
      .json(
        makeError(
          422,
          'Unprocessable Entity',
          'Naruszenie reguł biznesowych',
          [
            {
              field: 'rating',
              code: 'RATING_WITHOUT_WATCHED',
              message:
                'Nie możesz wystawić oceny, jeśli film nie jest oznaczony jako obejrzany'
            }
          ]
        )
      );
  }

  const lastWatched =
    prev.watched === 0 && watchedInt === 1
      ? now
      : prev.watched === 1 && watchedInt === 0
      ? null
      : prev.last_watched_at;

  const poster =
    next.poster_url === undefined
      ? prev.poster_url
      : (next.poster_url && String(next.poster_url).trim()) || null;

  db.prepare(
    `
    UPDATE movies
    SET tmdb_id = ?, title = ?, year = ?, genre = ?, rating = ?, comment = ?,
        watched = ?, favorite = ?, updated_at = ?, last_watched_at = ?, poster_url = ?
    WHERE id = ? AND user_id = ?
  `
  ).run(
    next.tmdb_id ?? prev.tmdb_id,
    next.title ?? prev.title,
    next.year === undefined ? prev.year : next.year,
    next.genre ?? prev.genre,
    ratingInt,
    next.comment ?? prev.comment,
    watchedInt,
    favoriteInt,
    now,
    lastWatched,
    poster,
    id,
    user.id
  );

  const row = db
    .prepare('SELECT * FROM movies WHERE id = ? AND user_id = ?')
    .get(id, user.id);

  res.json(rowToMovie(row));
});

// QUICK toggle favorite
app.put('/api/movies/:id/favorite', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const id = Number(req.params.id);
  const { favorite } = req.body || {};
  if (!Number.isInteger(id)) {
    return res
      .status(400)
      .json(makeError(400, 'Bad Request', 'Nieprawidłowe ID filmu'));
  }

  const prev = db
    .prepare('SELECT * FROM movies WHERE id = ? AND user_id = ?')
    .get(id, user.id);

  if (!prev) {
    return res
      .status(404)
      .json(makeError(404, 'Not Found', 'Film nie istnieje'));
  }

  const now = new Date().toISOString();

  db.prepare(
    'UPDATE movies SET favorite = ?, updated_at = ? WHERE id = ? AND user_id = ?'
  ).run(favorite ? 1 : 0, now, id, user.id);

  const row = db
    .prepare('SELECT * FROM movies WHERE id = ? AND user_id = ?')
    .get(id, user.id);

  res.json(rowToMovie(row));
});

// DELETE
app.delete('/api/movies/:id', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const info = db
    .prepare('DELETE FROM movies WHERE id = ? AND user_id = ?')
    .run(req.params.id, user.id);

  if (info.changes === 0) {
    return res
      .status(404)
      .json(makeError(404, 'Not Found', 'Film nie istnieje'));
  }

  res.status(204).send();
});

/* ===== TMDB ===== */

app.get('/api/tmdb/search', async (req, res) => {
  try {
    if (!TMDB_KEY) {
      return res
        .status(500)
        .json(
          makeError(
            500,
            'Internal Server Error',
            'Brak klucza TMDB po stronie serwera'
          )
        );
    }
    const q = String(req.query.q || '').trim();
    if (!q) return res.json([]);

    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&language=uk-UA&query=${encodeURIComponent(
      q
    )}`;

    const r = await fetch(url);
    if (!r.ok) {
      return res
        .status(502)
        .json(
          makeError(
            502,
            'Bad Gateway',
            'Błąd podczas komunikacji z TMDB'
          )
        );
    }

    const data = await r.json();

    const results = (data.results || [])
      .slice(0, 12)
      .map((m) => ({
        tmdb_id: m.id,
        title: m.title || m.original_title,
        year: (m.release_date || '').slice(0, 4) || null,
        poster_url: m.poster_path
          ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
          : null
      }));

    res.json(results);
  } catch (e) {
    res
      .status(500)
      .json(
        makeError(
          500,
          'Internal Server Error',
          'Nieoczekiwany błąd TMDB'
        )
      );
  }
});

// TMDB ADD — додає фільм поточному користувачу
app.post('/api/tmdb/add', async (req, res) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    if (!TMDB_KEY) {
      return res
        .status(500)
        .json(
          makeError(
            500,
            'Internal Server Error',
            'Brak klucza TMDB po stronie serwera'
          )
        );
    }

    const { tmdb_id, watched = false, favorite = false } = req.body || {};
    if (!tmdb_id) {
      return res
        .status(400)
        .json(
          makeError(
            400,
            'Bad Request',
            'tmdb_id jest wymagane',
            [
              {
                field: 'tmdb_id',
                code: 'REQUIRED',
                message: 'Pole tmdb_id jest wymagane'
              }
            ]
          )
        );
    }

    const existing = db
      .prepare('SELECT * FROM movies WHERE tmdb_id = ? AND user_id = ?')
      .get(tmdb_id, user.id);

    if (existing) return res.status(200).json(rowToMovie(existing));

    const url = `https://api.themoviedb.org/3/movie/${tmdb_id}?api_key=${TMDB_KEY}&language=uk-UA`;
    const r = await fetch(url);
    if (!r.ok) {
      return res
        .status(404)
        .json(makeError(404, 'Not Found', 'Film nie znaleziony w TMDB'));
    }

    const m = await r.json();
    const title = m.title || m.original_title;
    const year = (m.release_date || '').slice(0, 4)
      ? Number((m.release_date || '').slice(0, 4))
      : null;
    const genre = (m.genres || []).map((g) => g.name).join(', ');
    const poster_url = m.poster_path
      ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
      : null;

    const now = new Date().toISOString();
    const watchedInt = watched ? 1 : 0;
    const favoriteInt = favorite ? 1 : 0;

    const info = db
      .prepare(
        `
      INSERT INTO movies (
        tmdb_id, title, year, genre,
        rating, comment,
        watched, favorite,
        created_at, updated_at, last_watched_at, poster_url,
        user_id
      )
      VALUES (?, ?, ?, ?, 0, '', ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        tmdb_id,
        title,
        year,
        genre,
        watchedInt,
        favoriteInt,
        now,
        now,
        watchedInt ? now : null,
        poster_url,
        user.id
      );

    const created = db
      .prepare('SELECT * FROM movies WHERE id = ?')
      .get(info.lastInsertRowid);

    res.status(201).json(rowToMovie(created));
  } catch (e) {
    const user = getCurrentUser(req);
    if (user && req.body?.tmdb_id) {
      const again = db
        .prepare('SELECT * FROM movies WHERE tmdb_id = ? AND user_id = ?')
        .get(req.body.tmdb_id, user.id);
      if (again) return res.status(200).json(rowToMovie(again));
    }
    res
      .status(500)
      .json(
        makeError(
          500,
          'Internal Server Error',
          'Nieoczekiwany błąd podczas dodawania filmu z TMDB'
        )
      );
  }
});

/* ===== АВТЕНТИФІКАЦІЯ з nickname ===== */

// РЕЄСТРАЦІЯ
app.post('/api/register', async (req, res) => {
  try {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json(
          makeError(
            400,
            'Bad Request',
            'Niepoprawne dane rejestracji',
            zodToFieldErrors(parsed.error)
          )
        );
    }

    const { email, password, nickname } = parsed.data;

    const existingEmail = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(email);
    if (existingEmail) {
      return res
        .status(409)
        .json(
          makeError(
            409,
            'Conflict',
            'Konto z takim email już istnieje',
            [
              {
                field: 'email',
                code: 'DUPLICATE',
                message: 'Użytkownik z takim emailem już istnieje'
              }
            ]
          )
        );
    }

    const existingNick = db
      .prepare('SELECT id FROM users WHERE nickname = ?')
      .get(nickname);
    if (existingNick) {
      return res
        .status(409)
        .json(
          makeError(
            409,
            'Conflict',
            'Taki nick jest już zajęty',
            [
              {
                field: 'nickname',
                code: 'DUPLICATE',
                message: 'Taki nick jest już zajęty'
              }
            ]
          )
        );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const info = db
      .prepare(
        'INSERT INTO users (email, password_hash, nickname, is_admin) VALUES (?, ?, ?, 0)'
      )
      .run(email, passwordHash, nickname);

    // після реєстрації ще раз перевіримо admin
    ensureAdminForExistingData();

    const user = db
      .prepare('SELECT id, email, nickname, is_admin FROM users WHERE id = ?')
      .get(info.lastInsertRowid);

    return res.status(201).json({
      id: user.id,
      email: user.email,
      nickname: user.nickname
    });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json(
        makeError(
          500,
          'Internal Server Error',
          'Wewnętrzny błąd serwera podczas rejestracji'
        )
      );
  }
});

// ЛОГІН
app.post('/api/login', async (req, res) => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json(
          makeError(
            400,
            'Bad Request',
            'Niepoprawne dane logowania',
            zodToFieldErrors(parsed.error)
          )
        );
    }

    const { email, password } = parsed.data;

    let user = db
      .prepare('SELECT id, email, password_hash, nickname, is_admin FROM users WHERE email = ?')
      .get(email);

    if (!user) {
      return res
        .status(401)
        .json(
          makeError(
            401,
            'Unauthorized',
            'Nieprawidłowy email lub hasło'
          )
        );
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res
        .status(401)
        .json(
          makeError(
            401,
            'Unauthorized',
            'Nieprawidłowy email lub hasło'
          )
        );
    }

    // гарантуємо, що є хоча б один admin
    ensureAdminForExistingData();

    // гарантуємо нік, якщо раніше його не було
    user = ensureNicknameForUser(user);

    return res.json({
      id: user.id,
      email: user.email,
      nickname: user.nickname
    });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json(
        makeError(
          500,
          'Internal Server Error',
          'Wewnętrzny błąd serwera podczas logowania'
        )
      );
  }
});

/* ===== ENDPOINT /health ДЛЯ SMOKE-TEST (CI/CD) ===== */

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/* ===== START ===== */
const PORT = process.env.PORT || 8080;

// запускаємо сервер ТІЛЬКИ якщо файл запущений напряму (node server.js),
// а не коли його імпортує тест
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    console.log(`✔ API & Frontend: http://localhost:${PORT}`);
  });
}

export default app;
