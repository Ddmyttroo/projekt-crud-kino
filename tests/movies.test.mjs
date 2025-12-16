import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../server.js';

let testUser = null;

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

test('POST /api/movies with invalid payload returns 400', async () => {
  const { post } = await authed();

  const res = await post('/api/movies').send({});

  assert.strictEqual(res.statusCode, 400);
  assert.ok(res.body);
  assert.strictEqual(res.body.status, 400);
  assert.strictEqual(res.body.error, 'Bad Request');
  assert.ok(Array.isArray(res.body.fieldErrors));
  assert.ok(res.body.fieldErrors.length > 0);
});

test('POST /api/movies with rating but not watched returns 422', async () => {
  const { post } = await authed();

  const res = await post('/api/movies').send({
    title: 'Test film',
    year: 2020,
    genre: 'Test',
    rating: 4,
    watched: false
  });

  assert.strictEqual(res.statusCode, 422);
  assert.ok(res.body);
  assert.strictEqual(res.body.status, 422);
  assert.strictEqual(res.body.error, 'Unprocessable Entity');
  assert.ok(Array.isArray(res.body.fieldErrors));
  const codeList = res.body.fieldErrors.map(f => f.code);
  assert.ok(codeList.includes('RATING_WITHOUT_WATCHED'));
});

test('GET /api/movies/:id for non-existing returns 404', async () => {
  const { get } = await authed();

  const res = await get('/api/movies/9999999');

  assert.strictEqual(res.statusCode, 404);
  assert.ok(res.body);
  assert.strictEqual(res.body.status, 404);
  assert.strictEqual(res.body.error, 'Not Found');
});

test('POST /api/register with duplicate email returns 409', async () => {
  const user = await getTestUser();

  const res = await request(app)
    .post('/api/register')
    .send({
      email: user.email,
      password: 'secret123',
      nickname: 'someNick'
    });

  assert.strictEqual(res.statusCode, 409);
  assert.ok(res.body);
  assert.strictEqual(res.body.status, 409);
  assert.strictEqual(res.body.error, 'Conflict');
});

test('POST /api/auth/reset-password resets password and invalidates token', async () => {
  const uniq = Date.now();
  const email = `reset_${uniq}@example.com`;
  const password = 'secret123';
  const nickname = `reset_${uniq}`;

  const reg = await request(app)
    .post('/api/register')
    .send({ email, password, nickname });
  assert.strictEqual(reg.statusCode, 201);

  process.env.NODE_ENV = 'test';

  const forgot = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email });
  assert.strictEqual(forgot.statusCode, 200);
  assert.ok(forgot.body);
  assert.ok(forgot.body.resetToken);

  const token = forgot.body.resetToken;
  const newPassword = 'newsecret123';

  const reset = await request(app)
    .post('/api/auth/reset-password')
    .send({ email, token, newPassword });
  assert.strictEqual(reset.statusCode, 200);
  assert.ok(reset.body);
  assert.strictEqual(reset.body.ok, true);

  const oldLogin = await request(app)
    .post('/api/login')
    .send({ email, password });
  assert.strictEqual(oldLogin.statusCode, 401);

  const newLogin = await request(app)
    .post('/api/login')
    .send({ email, password: newPassword });
  assert.strictEqual(newLogin.statusCode, 200);
  assert.ok(newLogin.body);
  assert.strictEqual(newLogin.body.email, email);

  const reuse = await request(app)
    .post('/api/auth/reset-password')
    .send({ email, token, newPassword: 'another123' });
  assert.strictEqual(reuse.statusCode, 400);
});

test('POST /api/auth/forgot-password does not reveal account existence', async () => {
  process.env.NODE_ENV = 'test';

  const res = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: `nope_${Date.now()}@example.com` });
  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.body);
  assert.strictEqual(res.body.ok, true);
});

test('GET /health returns ok', async () => {
  const res = await request(app).get('/health');
  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.body);
  assert.strictEqual(res.body.status, 'ok');
});
