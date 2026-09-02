import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import * as passwordUtils from '../../src/utils/password.js';

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

  it('completes the password reset flow, rejects reusing the token, and revokes existing sessions', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'frank@example.com', password: 'Password123' });
    const refreshCookie = extractCookie(registerRes, 'refreshToken');

    const forgotRes = await request(app).post('/api/auth/forgot-password').send({ email: 'frank@example.com' });
    const { resetToken } = forgotRes.body;
    expect(resetToken).toBeTruthy();

    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, newPassword: 'NewPassword123' });
    expect(resetRes.status).toBe(200);

    const loginOld = await request(app)
      .post('/api/auth/login')
      .send({ email: 'frank@example.com', password: 'Password123' });
    expect(loginOld.status).toBe(401);

    const loginNew = await request(app)
      .post('/api/auth/login')
      .send({ email: 'frank@example.com', password: 'NewPassword123' });
    expect(loginNew.status).toBe(200);

    // Single-use: replaying the same token must fail even though it hasn't expired.
    const replay = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, newPassword: 'AnotherPassword123' });
    expect(replay.status).toBe(400);

    // A reset is treated as a compromise response: it revokes every existing
    // session, including the one from registration.
    const refreshRes = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie);
    expect(refreshRes.status).toBe(401);
  });

  it('rejects an expired password reset token', async () => {
    await request(app).post('/api/auth/register').send({ email: 'grant@example.com', password: 'Password123' });
    const forgotRes = await request(app).post('/api/auth/forgot-password').send({ email: 'grant@example.com' });

    const user = await prisma.user.findUnique({ where: { email: 'grant@example.com' } });
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: forgotRes.body.resetToken, newPassword: 'NewPassword123' });
    expect(res.status).toBe(400);
  });

  it('invalidates an earlier password reset token once a new one is requested', async () => {
    await request(app).post('/api/auth/register').send({ email: 'heidi@example.com', password: 'Password123' });

    const firstForgot = await request(app).post('/api/auth/forgot-password').send({ email: 'heidi@example.com' });
    const secondForgot = await request(app).post('/api/auth/forgot-password').send({ email: 'heidi@example.com' });
    expect(firstForgot.body.resetToken).not.toBe(secondForgot.body.resetToken);

    const resetWithOldToken = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: firstForgot.body.resetToken, newPassword: 'NewPassword123' });
    expect(resetWithOldToken.status).toBe(400);

    const resetWithNewToken = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: secondForgot.body.resetToken, newPassword: 'NewPassword123' });
    expect(resetWithNewToken.status).toBe(200);
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

  it('completes the email verification flow and rejects reusing the token', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'ivan@example.com', password: 'Password123' });
    const { emailVerificationToken } = registerRes.body;
    expect(emailVerificationToken).toBeTruthy();

    const verifyRes = await request(app).post('/api/auth/verify-email').send({ token: emailVerificationToken });
    expect(verifyRes.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { email: 'ivan@example.com' } });
    expect(user.isEmailVerified).toBe(true);

    const replay = await request(app).post('/api/auth/verify-email').send({ token: emailVerificationToken });
    expect(replay.status).toBe(400);
  });

  it('resend-verification issues a fresh token and invalidates the previous one', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'judy@example.com', password: 'Password123' });
    const firstToken = registerRes.body.emailVerificationToken;

    const resendRes = await request(app)
      .post('/api/auth/resend-verification')
      .set('Authorization', `Bearer ${registerRes.body.accessToken}`);
    expect(resendRes.status).toBe(200);
    expect(resendRes.body.verificationToken).toBeTruthy();
    expect(resendRes.body.verificationToken).not.toBe(firstToken);

    const verifyWithOldToken = await request(app).post('/api/auth/verify-email').send({ token: firstToken });
    expect(verifyWithOldToken.status).toBe(400);

    const verifyWithNewToken = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: resendRes.body.verificationToken });
    expect(verifyWithNewToken.status).toBe(200);
  });

  it('locks the account after repeated failed logins, then unlocks once the lockout window passes', async () => {
    await request(app).post('/api/auth/register').send({ email: 'kevin@example.com', password: 'Password123' });

    for (let i = 0; i < 5; i += 1) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'kevin@example.com', password: 'WrongPassword1' });
      expect(res.status).toBe(401);
    }

    const lockedRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'kevin@example.com', password: 'Password123' });
    expect(lockedRes.status).toBe(401);
    expect(lockedRes.body.error.code).toBe('ACCOUNT_LOCKED');

    const user = await prisma.user.findUnique({ where: { email: 'kevin@example.com' } });
    await prisma.user.update({ where: { id: user.id }, data: { lockedUntil: new Date(Date.now() - 1000) } });

    const unlockedRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'kevin@example.com', password: 'Password123' });
    expect(unlockedRes.status).toBe(200);
  });

  it('treats email as case-insensitive for both duplicate detection and login', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'Mallory@Example.com', password: 'Password123' });
    expect(registerRes.status).toBe(201);
    expect(registerRes.body.accessToken).toBeTruthy();

    const dupRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'mallory@example.com', password: 'Password123' });
    expect(dupRes.status).toBe(201);
    expect(dupRes.body.accessToken).toBeUndefined(); // generic "already registered" response

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'MALLORY@EXAMPLE.COM', password: 'Password123' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.email).toBe('mallory@example.com');
  });

  it('pays the same bcrypt cost for a duplicate-email registration as a fresh one (closes the timing side-channel)', async () => {
    await request(app).post('/api/auth/register').send({ email: 'laura@example.com', password: 'Password123' });

    const compareSpy = vi.spyOn(passwordUtils, 'comparePassword');
    try {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'laura@example.com', password: 'Password123' });

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeUndefined();
      expect(compareSpy).toHaveBeenCalled();
    } finally {
      compareSpy.mockRestore();
    }
  });
});
