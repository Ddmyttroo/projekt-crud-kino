import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../server.js';

let testUser = null;

// Створюємо/памʼятаємо тестового юзера
async function getTestUser() {
  if (testUser) return testUser;

  const uniq = Date.now();
  const email = `test_${uniq}@example.com`;
  const password = 'secret123';
  const nickname = `tester_${uniq}`;

  const res = await request(app)
    .post('/api/register')
    .send({ email, password, nickname });

  assert.strictEqual(res.statusCode, 201);

  testUser = {
    id: res.body.id,
    email: res.body.email,
    nickname: res.body.nickname
  };

  return testUser;
}

// Хелпер: повертає функції get/post/put/delete, які АВТОМАТИЧНО ставлять X-User-Id
async function authed() {
  const user = await getTestUser();
  const withUser = (req) => req.set('X-User-Id', String(user.id));

  return {
    user,
    get:  (url) => withUser(request(app).get(url)),
    post: (url) => withUser(request(app).post(url)),
    put:  (url) => withUser(request(app).put(url)),
    del:  (url) => withUser(request(app).delete(url)),
  };
}

// 1) POST /api/movies з некоректним payload → 400 Bad Request
test('POST /api/movies with invalid payload returns 400', async () => {
  const { post } = await authed();

  const res = await post('/api/movies').send({}); // немає title

  assert.strictEqual(res.statusCode, 400);
  assert.ok(res.body);
  assert.strictEqual(res.body.status, 400);
  assert.strictEqual(res.body.error, 'Bad Request');
  assert.ok(Array.isArray(res.body.fieldErrors));
  assert.ok(res.body.fieldErrors.length > 0);
});

// 2) POST /api/movies з рейтингом, але без watched → 422 Unprocessable Entity
test('POST /api/movies with rating but not watched returns 422', async () => {
  const { post } = await authed();

  const res = await post('/api/movies').send({
    title: 'Test film',
    year: 2020,
    genre: 'Test',
    rating: 4,      // є рейтинг
    watched: false   // але не позначено переглянутим
  });

  assert.strictEqual(res.statusCode, 422);
  assert.ok(res.body);
  assert.strictEqual(res.body.status, 422);
  assert.strictEqual(res.body.error, 'Unprocessable Entity');
  assert.ok(Array.isArray(res.body.fieldErrors));
  const codeList = res.body.fieldErrors.map(f => f.code);
  assert.ok(codeList.includes('RATING_WITHOUT_WATCHED'));
});

// 3) GET /api/movies/:id для неіснуючого ресурсу → 404
test('GET /api/movies/:id for non-existing returns 404', async () => {
  const { get } = await authed();

  const res = await get('/api/movies/9999999');

  assert.strictEqual(res.statusCode, 404);
  assert.ok(res.body);
  assert.strictEqual(res.body.status, 404);
  assert.strictEqual(res.body.error, 'Not Found');
});

// 4) POST /api/register з дублікатом email → 409 Conflict
test('POST /api/register with duplicate email returns 409', async () => {
  const user = await getTestUser();

  const res = await request(app)
    .post('/api/register')
    .send({
      email: user.email,      // той самий email
      password: 'secret123',
      nickname: 'someNick'
    });

  assert.strictEqual(res.statusCode, 409);
  assert.ok(res.body);
  assert.strictEqual(res.body.status, 409);
  assert.strictEqual(res.body.error, 'Conflict');
});

// 5) /health → 200, простий smoke-test
test('GET /health returns ok', async () => {
  const res = await request(app).get('/health');
  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.body);
  assert.strictEqual(res.body.status, 'ok');
});
