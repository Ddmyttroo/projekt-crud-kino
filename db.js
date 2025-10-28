import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'app.db');

export function getDb(){
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  return new Database(DB_PATH);
}

function hasColumn(db, table, col){
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  return rows.some(r => r.name === col);
}

function migrate() {
  const db = getDb();
  db.pragma('journal_mode = WAL');

  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

  for (const f of files) {
    // 004_add_favorite.sql обробляємо окремо (див. нижче),
    // щоб не ловити синтаксичну помилку "IF NOT EXISTS"
    if (f.startsWith('004_add_favorite')) continue;

    const sql = fs.readFileSync(path.join(dir, f), 'utf8').trim();
    if (!sql) continue;

    try {
      db.exec(sql);
      console.log('✔ applied', f);
    } catch (e) {
      // Робимо міграції ідемпотентними
      if (/duplicate column/i.test(e.message)) {
        console.log('⏭ skipped', f, `(${e.message})`);
      } else if (/already exists/i.test(e.message)) {
        console.log('⏭ skipped', f, `(${e.message})`);
      } else {
        throw e;
      }
    }
  }

  // Додаємо колонку favorite, якщо її ще немає (без IF NOT EXISTS)
  const cols = db.prepare('PRAGMA table_info(movies)').all();
  const hasFavorite = cols.some(c => c.name === 'favorite');

  if (!hasFavorite) {
    db.exec('ALTER TABLE movies ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;');
    console.log('✔ added favorite column');
  } else {
    console.log('⏭ favorite already exists');
  }

  console.log('✔ migrations done');
}


function seed(){
  const db = getDb();

  // очищаємо таблицю і скидаємо AUTOINCREMENT
  db.exec(`DELETE FROM movies; VACUUM;`);

  const now = new Date().toISOString();
  const ins = db.prepare(`
    INSERT INTO movies (tmdb_id, title, year, genre, rating, comment, watched, created_at, updated_at, last_watched_at, poster_url)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `);

  // === ТВОЇ 55 НАЗВ (реалістичні роки/жанри, без постерів; TMDB підтягне) ===
  const rows = [
    // watched приклади (2 шт):
    [null,'Пророк (Un prophète)', 2009,'Кримінал/Драма',       5,'Шедевр французького кіно', 1, now, now, now, null],
    [null,'Впіймай мене, якщо зможеш', 2002,'Біографія/Кримінал',5,'',                          1, now, now, now, null],

    // у планах:
    [null,'Одного разу в Голлівуді',     2019,'Комедія/Драма',            0,'',0,now,now,null,null],
    [null,'Bullet Train',                2022,'Екшн/Комедія',             0,'',0,now,now,null,null],
    [null,'Союзники',                    2016,'Драма/Трилер/Війна',       0,'',0,now,now,null,null],
    [null,'I Am Number Four',            2011,'Фантастика/Екшн',          0,'',0,now,now,null,null],
    [null,'Троя',                        2004,'Історичний/Екшн/Драма',    0,'',0,now,now,null,null],
    [null,'Dexter (серіал)',             2006,'Кримінал/Драма/Трилер',    0,'',0,now,now,null,null],
    [null,'Big Stan',                    2007,'Комедія',                  0,'',0,now,now,null,null],
    [null,'День курка',                  null,'Комедія',                  0,'',0,now,now,null,null],
    [null,'Виправдання жорстокості',     null,'Драма/Трилер',             0,'',0,now,now,null,null],
    [null,'Місія нездійсненна: Протокол Фантом', 2011,'Екшн/Шпигунський', 0,'',0,now,now,null,null],
    [null,'Універсальний солдат',        1992,'Екшн/Фантастика',          0,'',0,now,now,null,null],
    [null,'Два далеких незнайомці',      2020,'Драма/Короткометражка',    0,'',0,now,now,null,null],
    [null,'Чорний птах (мінісеріал)',    2022,'Кримінал/Драма',           0,'',0,now,now,null,null],
    [null,'Містер і місіс Сміт',         2005,'Екшн/Комедія',             0,'',0,now,now,null,null],
    [null,'Той, хто біжить по лезу',     1982,'Фантастика/Нео-нуар',      0,'',0,now,now,null,null],
    [null,'11 друзів Оушена',            2001,'Кримінал/Хайст',           0,'',0,now,now,null,null],
    [null,'Агенти А.Н.К.Л.',             2015,'Екшн/Шпигунський',         0,'',0,now,now,null,null],
    [null,'Банші Інішеріна',             2022,'Драма/Чорна комедія',      0,'',0,now,now,null,null],
    [null,'Ефект колібрі (Redemption)',  2013,'Екшн/Трилер',              0,'',0,now,now,null,null],
    [null,'Дякую за вашу службу',        2017,'Драма/Війна',              0,'',0,now,now,null,null],
    [null,'Чужі серед нас',              1988,'Фантастика/Екшн',          0,'',0,now,now,null,null],
    [null,'Межа майбутнього',            2014,'Фантастика/Екшн',          0,'',0,now,now,null,null],
    [null,'Дуже дивні справи (серіал)',  2016,'Фантастика/Горор',         0,'',0,now,now,null,null],
    [null,'Таможня дає добро',           2010,'Комедія',                  0,'',0,now,now,null,null],
    [null,'Кінгсмен: Секретна служба',   2014,'Екшн/Шпигунський',         0,'',0,now,now,null,null],
    [null,'Найманець (American Assassin)',2017,'Екшн/Трилер',            0,'',0,now,now,null,null],
    [null,'Кіллхаус',                    null,'Екшн/Трилер',              0,'',0,now,now,null,null],
    [null,'Хамелеон',                    2001,'Трилер',                   0,'',0,now,now,null,null],
    [null,'Останній бойскаут',           1991,'Екшн/Трилер',              0,'',0,now,now,null,null],
    [null,'Супер ген',                   null,'Фантастика/Комедія',       0,'',0,now,now,null,null],
    [null,'Таємний щоденник Симона Петлюри',2018,'Історична драма',      0,'',0,now,now,null,null],
    [null,'Гангстер Лен',                2017,'Кримінал/Драма',           0,'',0,now,now,null,null],
    [null,'Краса по-американськи',       1999,'Драма',                    0,'',0,now,now,null,null],
    [null,'Поводир',                     2014,'Драма/Історія',            0,'',0,now,now,null,null],
    [null,'Хакер',                       2014,'Трилер',                   0,'',0,now,now,null,null],
    [null,'Пророк (Next)',               2007,'Фантастика/Трилер',        0,'',0,now,now,null,null],
    [null,'Людина дощу',                 1988,'Драма',                    0,'',0,now,now,null,null],
    [null,'Бриліантовий поліцейський',   1999,'Екшн/Комедія',             0,'',0,now,now,null,null],
    [null,'Скін',                        2018,'Драма/Біографія',          0,'',0,now,now,null,null],
    [null,'Ніхто',                       2021,'Екшн/Трилер',              0,'',0,now,now,null,null],
    [null,'Нічого втрачати',             1997,'Комедія/Кримінал',         0,'',0,now,now,null,null],
    [null,'Година пік',                  1998,'Екшн/Комедія',             0,'',0,now,now,null,null],
    [null,'Година пік 2',                2001,'Екшн/Комедія',             0,'',0,now,now,null,null],
    [null,'Година пік 3',                2007,'Екшн/Комедія',             0,'',0,now,now,null,null],
    [null,'Законослухняний громадянин',  2009,'Трилер/Кримінал',          0,'',0,now,now,null,null],
    [null,'Шоу Трумана',                 1998,'Драма/Сатира',             0,'',0,now,now,null,null],
    [null,'Перший шлюб Джорджі та Менді',null,'Драма/Романтика',          0,'',0,now,now,null,null],
    [null,'Пиво зі смаком дружби',       null,'Комедія',                  0,'',0,now,now,null,null],
    [null,'Чого хочуть жінки',           2000,'Романтична комедія',       0,'',0,now,now,null,null],
    [null,'Втеча з Шоушенка',            1994,'Драма',                    0,'',0,now,now,null,null],
    [null,'Легенда',                     2015,'Кримінал/Біографія',       0,'',0,now,now,null,null],
    [null,'Початок',                     2010,'Фантастика/Трилер',        0,'',0,now,now,null,null],
    [null,'Голгофа',                     2014,'Драма/Чорна комедія',      0,'',0,now,now,null,null],
  ];

  db.transaction(()=> rows.forEach(r => ins.run(...r)))();
  const count = db.prepare('SELECT COUNT(*) AS c FROM movies').get().c;
  console.log('✔ seed inserted', count, 'rows');
}

if (process.argv[2] === 'migrate') migrate();
if (process.argv[2] === 'seed') seed();
