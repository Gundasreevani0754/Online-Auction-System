import fs from 'node:fs';
import path from 'node:path';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { DB_PATH } from '../config.js';

/**
 * Stateless sessions: the cookie holds a signed payload, so nothing has to be
 * kept in server memory and a restart does not log everyone out.
 *
 * Cookie value: base64url(payload).base64url(hmac-sha256)
 */

export const COOKIE_NAME = 'bidderx_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const SECRET_FILE = path.join(path.dirname(DB_PATH), '.session-secret');

/**
 * Uses SESSION_SECRET when provided. Otherwise generates a secret once and
 * stores it next to the database (gitignored) so logins survive restarts.
 */
function loadSecret() {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }

  if (fs.existsSync(SECRET_FILE)) {
    return fs.readFileSync(SECRET_FILE, 'utf8');
  }

  const generated = randomBytes(32).toString('hex');
  fs.mkdirSync(path.dirname(SECRET_FILE), { recursive: true });
  fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600 });

  return generated;
}

const secret = loadSecret();

const encode = (value) => Buffer.from(value, 'utf8').toString('base64url');
const sign = (data) => createHmac('sha256', secret).update(data).digest('base64url');

/**
 * @param {number} userId
 * @returns {string} A signed session token.
 */
export function createToken(userId) {
  const payload = encode(JSON.stringify({ uid: userId, exp: Date.now() + SESSION_TTL_MS }));

  return `${payload}.${sign(payload)}`;
}

/**
 * Verifies the signature and expiry of a token.
 *
 * @param {string | undefined} token
 * @returns {number | null} The user id, or null when the token is missing,
 *   tampered with, or expired.
 */
export function readToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) {
    return null;
  }

  const [payload, signature] = token.split('.');
  if (!payload || !signature) {
    return null;
  }

  const expected = Buffer.from(sign(payload), 'utf8');
  const actual = Buffer.from(signature, 'utf8');

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));

    if (!Number.isInteger(uid) || typeof exp !== 'number' || exp < Date.now()) {
      return null;
    }

    return uid;
  } catch {
    return null;
  }
}

/** Minimal Cookie header parser - avoids pulling in cookie-parser. */
export function parseCookies(header) {
  const cookies = {};

  for (const part of (header || '').split(';')) {
    const index = part.indexOf('=');
    if (index === -1) {
      continue;
    }

    const name = part.slice(0, index).trim();
    if (name) {
      cookies[name] = decodeURIComponent(part.slice(index + 1).trim());
    }
  }

  return cookies;
}

const cookieOptions = {
  httpOnly: true, // Blocks document.cookie, so XSS cannot steal the session.
  sameSite: 'lax', // Blocks cross-site form posts riding the cookie (CSRF).
  path: '/',
  secure: process.env.NODE_ENV === 'production',
};

export function setSessionCookie(res, userId) {
  res.cookie(COOKIE_NAME, createToken(userId), { ...cookieOptions, maxAge: SESSION_TTL_MS });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions);
}
