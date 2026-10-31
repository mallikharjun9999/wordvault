import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app, H, setupDb, teardownDb, newUser, config } from './helpers.js';
import { User } from '../src/models/index.js';

beforeAll(setupDb); afterAll(teardownDb);

describe('authentication', () => {
  it('1. registers a new user (single "user" role, no secrets returned)', async () => {
    const res = await request(app).post('/api/auth/register').set(H).send({ email: 'A@Example.com ', password: 'password-1234', displayName: 'Asha' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('a@example.com');
    expect(res.body.data.user.role).toBe('user');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    expect(res.headers['set-cookie'][0]).toMatch(/SameSite=Lax/i);
  });
  it('2. logs in a registered user and /me works with the cookie', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/login').set(H).send({ email: 'a@example.com', password: 'password-1234' });
    expect(res.status).toBe(200);
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200); expect(me.body.data.user.email).toBe('a@example.com');
  });
  it('3. rejects invalid credentials with a uniform message', async () => {
    const bad = await request(app).post('/api/auth/login').set(H).send({ email: 'a@example.com', password: 'wrong-password-1' });
    const unknown = await request(app).post('/api/auth/login').set(H).send({ email: 'nobody@example.com', password: 'wrong-password-1' });
    expect(bad.status).toBe(401); expect(unknown.status).toBe(401);
    expect(bad.body.error.message).toBe(unknown.body.error.message);
  });
  it('4. rejects duplicate email registration (case-insensitive)', async () => {
    const res = await request(app).post('/api/auth/register').set(H).send({ email: 'A@EXAMPLE.COM', password: 'password-1234' });
    expect(res.status).toBe(409); expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });
  it('5. stores passwords as bcrypt hashes', async () => {
    const u = await User.findOne({ email: 'a@example.com' }).select('+passwordHash');
    expect(u.passwordHash).not.toContain('password-1234');
    expect(u.passwordHash).toMatch(/^\$2[aby]\$/);
  });
  it('6. protected routes reject unauthenticated requests', async () => {
    for (const url of ['/api/vocabulary', '/api/progress', '/api/reviews/queue', '/api/export/account', '/api/auth/me']) {
      const res = await request(app).get(url); expect(res.status, url).toBe(401);
    }
  });
  it('7. rejects forged, wrong-secret, expired, and revoked tokens', async () => {
    const u = await User.findOne({ email: 'a@example.com' });
    const get = (t) => request(app).get('/api/auth/me').set('Cookie', `wv_token=${t}`);
    expect((await get('garbage')).status).toBe(401);
    expect((await get(jwt.sign({ sub: String(u._id), tv: 0 }, 'another-secret-another-secret-123456'))).status).toBe(401);
    expect((await get(jwt.sign({ sub: String(u._id), tv: 0 }, config.jwtSecret, { expiresIn: -10 }))).status).toBe(401);
    expect((await get(jwt.sign({ sub: String(u._id), tv: 99 }, config.jwtSecret))).status).toBe(401); // stale tokenVersion
    expect((await get(jwt.sign({ sub: String(u._id), tv: 0 }, config.jwtSecret, { algorithm: 'HS512' }))).status).toBe(401);
  });
  it('8. ignores a client-supplied user id', async () => {
    const a = await newUser(); const b = await newUser();
    await a.post('/api/vocabulary', { word: 'secret' });
    const viaQuery = await b.get(`/api/vocabulary?ownerId=${a.user.id}&userId=${a.user.id}`);
    expect(viaQuery.body.data.items).toHaveLength(0);
    const viaBody = await b.post('/api/vocabulary', { word: 'planted', ownerId: a.user.id });
    expect(viaBody.status).toBe(400); // strict schema rejects mass-assignment of ownerId
  });
  it('validates input (weak password, bad email)', async () => {
    expect((await request(app).post('/api/auth/register').set(H).send({ email: 'x@y.com', password: 'short1' })).status).toBe(400);
    expect((await request(app).post('/api/auth/register').set(H).send({ email: 'nope', password: 'password-1234' })).status).toBe(400);
    expect((await request(app).post('/api/auth/register').set(H).send({ email: 'z@y.com', password: 'password-1234', role: 'admin' })).status).toBe(400);
  });
  it('CSRF: state-changing requests without the custom header or with a foreign Origin are refused', async () => {
    expect((await request(app).post('/api/auth/login').send({ email: 'a@example.com', password: 'password-1234' })).status).toBe(403);
    expect((await request(app).post('/api/auth/login').set(H).set('Origin', 'https://evil.example').send({ email: 'a@example.com', password: 'password-1234' })).status).toBe(403);
    expect((await request(app).post('/api/auth/login').set(H).set('Origin', 'http://localhost:5173').send({ email: 'a@example.com', password: 'password-1234' })).status).toBe(200);
  });
  it('password change revokes other sessions and enforces the current password', async () => {
    const u = await newUser(); const other = request.agent(app);
    await other.post('/api/auth/login').set(H).send({ email: u.email, password: u.password });
    expect((await u.post('/api/auth/change-password', { currentPassword: 'wrong-password-1', newPassword: 'new-password-5678' })).status).toBe(400);
    expect((await u.post('/api/auth/change-password', { currentPassword: u.password, newPassword: 'new-password-5678' })).status).toBe(200);
    expect((await other.get('/api/auth/me')).status).toBe(401);
    expect((await u.get('/api/auth/me')).status).toBe(200); // current session re-issued
    expect((await request(app).post('/api/auth/login').set(H).send({ email: u.email, password: 'new-password-5678' })).status).toBe(200);
  });
  it('CORS does not allow arbitrary origins', async () => {
    const res = await request(app).options('/api/health').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
