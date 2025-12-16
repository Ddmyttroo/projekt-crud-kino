import 'dotenv/config';
import fetch from 'node-fetch';
import { getDb } from '../db.js';

const TMDB_KEY = process.env.TMDB_API_KEY;
if (!TMDB_KEY) {
  console.error('❌ TMDB_API_KEY відсутній у .env');
  process.exit(1);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function buildImage(p){ return p ? `https://image.tmdb.org/t/p/w500${p}` : null; }

async function searchOne(title, year) {
  const base = 'https://api.themoviedb.org/3/search/movie';
  const url = new URL(base);
  url.searchParams.set('api_key', TMDB_KEY);
  url.searchParams.set('query', title);
  if (year) url.searchParams.set('year', String(year));
  url.searchParams.set('language', 'uk-UA');
  url.searchParams.set('include_adult', 'false');

  const r = await fetch(url.toString());
  if (!r.ok) return null;
  const data = await r.json();
  const list = Array.isArray(data.results) ? data.results : [];
  if (!list.length) return null;

  let best = null;
  if (year) {
    best = list.find(m => (m.release_date || '').startsWith(String(year))) || null;
  }
  if (!best) {
    best = list.sort((a,b)=>(b.popularity||0)-(a.popularity||0))[0] || null;
  }
  if (!best) return null;

  return {
    tmdb_id: best.id,
    title: best.title || best.original_title,
    poster_url: buildImage(best.poster_path),
    year: (best.release_date || '').slice(0,4) || null
  };
}

async function main(){
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, title, year
    FROM movies
    WHERE poster_url IS NULL OR poster_url = ''
  `).all();

  if (!rows.length){
    console.log('ℹ️ Усі фільми вже мають poster_url — робити нічого.');
    return;
  }

  console.log(`🔎 Шукаю постери для ${rows.length} фільмів...`);
  let updated = 0, skipped = 0;

  for (const r of rows){
    try{
      const found = await searchOne(r.title, r.year);
      if (found && found.poster_url){
        db.prepare(`UPDATE movies SET poster_url=?, tmdb_id=COALESCE(tmdb_id, ?) WHERE id=?`)
          .run(found.poster_url, found.tmdb_id, r.id);
        console.log(`✔ ${r.title}`);
        updated++;
      } else {
        console.log(`⚪ Not found: ${r.title}`);
        skipped++;
      }
      await sleep(150);
    }catch(e){
      console.log(`⚠️ Помилка для "${r.title}": ${e.message}`);
      skipped++;
    }
  }

  console.log(`\n✅ Готово. Оновлено: ${updated}, пропущено: ${skipped}`);
}

main().catch(e=>{ console.error(e); process.exit(1); });
