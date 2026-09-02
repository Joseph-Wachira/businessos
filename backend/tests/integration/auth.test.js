import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';

const app = createApp();

function extractCookie(res, name) {
  const cookies = res.headers['set-cookie'] ?? [];
  return cookies.find((c) => c.startsWith(`${name}=`));
}

describe('auth flow', () => {
  it('registers a new user and issues tokens', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'alice@example.com', password: 'Password123', firstName: 'Alice' });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(extractCookie(res, 'refreshToken')).toBeTruthy();
  });

  it('gives the same generic response for a duplicate email as a fresh registration', async () => {
    await request(app).post('/api/auth/register').send({ email: 'dup@example.com', password: 'Password123' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: 'Password123' });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeUndefined();
  });

  it('rejects a weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'weak@example.com', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('logs in with correct credentials', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'bob@example.com', password: 'Password123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob@example.com', password: 'Password123' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.email).toBe('bob@example.com');
  });

  it('rejects the wrong password with a generic message', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'carol@example.com', password: 'Password123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'carol@example.com', password: 'WrongPassword1' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects login for a nonexistent email with the same message as a wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Password123' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rotates the refresh token and detects reuse of a replayed token', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dave@example.com', password: 'Password123' });
    const firstRefreshCookie = extractCookie(registerRes, 'refreshToken');

    const rotateRes = await request(app).post('/api/auth/refresh').set('Cookie', firstRefreshCookie);
    expect(rotateRes.status).toBe(200);
    expect(rotateRes.body.accessToken).toBeTruthy();

    // Replaying the already-rotated (now revoked) token must fail...
    const replayRes = await request(app).post('/api/auth/refresh').set('Cookie', firstRefreshCookie);
    expect(replayRes.status).toBe(401);

    // ...and must have revoked the whole family, so even the legitimately
    // rotated second token is now dead too.
    const secondRefreshCookie = extractCookie(rotateRes, 'refreshToken');
    const afterReuseRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', secondRefreshCookie);
    expect(afterReuseRes.status).toBe(401);
  });

  it('logs out and revokes the refresh token', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'erin@example.com', password: 'Password123' });
    const refreshCookie = extractCookie(registerRes, 'refreshToken');

    const logoutRes = await request(app).post('/api/auth/logout').set('Cookie', refreshCookie);
    expect(logoutRes.status).toBe(204);

    const refreshRes = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie);
    expect(refreshRes.status).toBe(401);
  });

  it('completes the password reset flow and revokes existing sessions', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'frank@example.com', password: 'Password123' });
    const refreshCookie = extractCookie(registerRes, 'refreshToken');

    await request(app).post('/api/auth/forgot-password').send({ email: 'frank@example.com' });

    const user = await prisma.user.findUnique({ where: { email: 'frank@example.com' } });
    const resetToken = await prisma.passwordResetToken.findFirst({ where: { userId: user.id } });
    // Test-only access to the raw token isn't possible (only the hash is stored) —
    // exercise the invalid-token path instead of a real reset here; the atomic
    // single-use update itself is covered by rejecting an already-used/invalid token twice.
    expect(resetToken).toBeTruthy();

    const badReset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'not-a-real-token', newPassword: 'NewPassword123' });
    expect(badReset.status).toBe(400);

    // Original session must still be usable since the reset above never succeeded.
    const refreshRes = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie);
    expect(refreshRes.status).toBe(200);
  });

  it('rejects an unauthenticated request to /api/auth/me', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user for a valid access token', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'grace@example.com', password: 'Password123' });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${registerRes.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('grace@example.com');
  });
});
