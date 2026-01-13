# MÓJ FILM — CRUD (część A, finalna)

Prosta aplikacja internetowa do osobistej bazy danych filmów: harmonogram oglądania, obejrzane, ulubione, wyszukiwanie, dodawanie z TMDB (z plakatem).

## Wymagania
- Node.js 20+
- SQLite (wbudowany przez better-sqlite3)
- Internet dla TMDB (opcjonalnie, jeśli chcesz wyszukiwać/publikować plakaty)

## Ustawienia
Plik `.env` jest lokalny (nie jest przesyłany do GitHuba). Utwórz go na podstawie `.env.example`.

Przykładowa treść:
```
TMDB_API_KEY=YOUR_KEY
PORT=8080

# Tylko w trybie deweloperskim: zwraca token resetu w odpowiedzi na /api/auth/forgot-password
# (aby uniknąć konfigurowania usługi poczty e-mail podczas tworzenia)
RETURN_RESET_TOKEN=true
```

## Uruchom lokalnie
Opcjonalnie możesz zasilić bazę danych danymi demonstracyjnymi za pomocą polecenia `npm run seed`.
```bash
npm install
npm run migrate
npm run dev
```
Otwórz: http://localhost:8080

## Punkty końcowe API
- `GET /api/movies` — lista (parametry: `q`, `watched=true|false`)
- `GET /api/movies/:id` — szczegóły
- `POST /api/movies` — utwórz
- `PUT /api/movies/:id` — zaktualizuj
- `DELETE /api/movies/:id` — usuń

### `POST/PUT` Treść (przykład)
```json
{
"title": "Incepcja",
"year": 2010,
"genre": "Science fiction/Thriller",
"rating": 5,
"comment": "Fajne",
"watched": true,
"favorite": 1,
"poster_url": "https://image.tmdb.org/t/p/w500/....jpg",
"tmdb_id": 27205
}
```

## Integracja z TMDB
- `GET /api/tmdb/search?q=...` — wyszukiwanie w TMDB (tytuł/rok/plakat)
- `POST /api/tmdb/add` — dodawanie według `tmdb_id` (body: `{ "tmdb_id": 123, "watched": false }`)

---

To jest gotowa kompilacja **Części A**.
