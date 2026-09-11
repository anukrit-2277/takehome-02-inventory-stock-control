import * as authService from './auth.service.js';
import { env, isProduction } from '../../config/env.js';

const REFRESH_COOKIE = 'refresh_token';

// Scoped to /api/auth so the cookie is only ever sent to the routes that use it.
// In production the frontend sits on a different domain, which requires
// SameSite=None, and SameSite=None is only honoured on a Secure cookie.
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/api/auth',
  maxAge: env.jwt.refreshTtlDays * 24 * 60 * 60 * 1000,
};

export async function login(req, res) {
  const { email, password } = req.body;
  const { user, accessToken, refreshToken } = await authService.login(email, password);

  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
  res.json({ user, accessToken });
}

export async function refresh(req, res) {
  const { user, accessToken, refreshToken } = await authService.refresh(req.cookies[REFRESH_COOKIE]);

  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
  res.json({ user, accessToken });
}

export async function logout(req, res) {
  await authService.logout(req.cookies[REFRESH_COOKIE]);

  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, maxAge: undefined });
  res.status(204).end();
}

export async function me(req, res) {
  res.json({ user: req.user });
}
