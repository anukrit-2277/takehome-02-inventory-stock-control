import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { unauthorized } from '../../lib/errors.js';

// Compared against when the email does not exist, so a wrong email and a wrong
// password take the same amount of time and cannot be told apart.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

/** Fields we are willing to send to the client. Never the password hash. */
function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

function signAccessToken(user) {
  return jwt.sign({ role: user.role }, env.jwt.accessSecret, {
    subject: String(user.id),
    expiresIn: env.jwt.accessTtl,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

// Refresh tokens are opaque random strings rather than JWTs: we look them up in
// the database anyway to check they have not been revoked, so signing them
// would add work without adding a guarantee.
function newRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

// Only the hash is stored, so a leaked database does not hand over live sessions.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function refreshExpiry() {
  const expires = new Date();
  expires.setDate(expires.getDate() + env.jwt.refreshTtlDays);
  return expires;
}

/** Issues a fresh access + refresh token pair for a user. */
async function issueSession(user) {
  const refreshToken = newRefreshToken();
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt: refreshExpiry() },
  });
  return { user: publicUser(user), accessToken: signAccessToken(user), refreshToken };
}

export async function login(email, password) {
  const user = await prisma.user.findUnique({ where: { email } });
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  // One message for every failure, so we never reveal which emails exist.
  if (!user || !passwordMatches || !user.isActive) {
    throw unauthorized('Invalid email or password');
  }
  return issueSession(user);
}

export async function refresh(token) {
  if (!token) throw unauthorized('No refresh token provided');

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!stored) throw unauthorized('Invalid refresh token');

  // Each refresh token is single-use. Seeing a revoked one again means the token
  // was copied, so we end every session that user has rather than just this one.
  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw unauthorized('Refresh token has already been used');
  }

  if (stored.expiresAt < new Date()) throw unauthorized('Refresh token has expired');
  if (!stored.user.isActive) throw unauthorized('This account is no longer active');

  // Rotate: the presented token is retired and replaced.
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });
  return issueSession(stored.user);
}

export async function logout(token) {
  if (!token) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
