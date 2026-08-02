import { findById } from '../db/users.js';
import { COOKIE_NAME, clearSessionCookie, parseCookies, readToken } from './session.js';

/**
 * Reads the session cookie and puts the matching user on `req.user`
 * (or null). Runs on every request so any route or page can check it.
 */
export function attachUser(req, res, next) {
  req.user = null;

  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  const userId = readToken(token);

  if (userId === null) {
    // A tampered or expired cookie should not linger in the browser.
    if (token) {
      clearSessionCookie(res);
    }
    return next();
  }

  const user = findById(userId);

  if (!user) {
    clearSessionCookie(res);
    return next();
  }

  req.user = user;
  return next();
}

/**
 * Blocks signed-out visitors. Anything that asked for JSON - an /api/ route or
 * a fetch() sending `Accept: application/json` - gets a 401 it can parse.
 * Ordinary page loads are redirected to the login screen.
 */
function wantsJson(req) {
  return req.path.startsWith('/api/') || req.accepts(['html', 'json']) === 'json';
}

export function requireAuth(req, res, next) {
  if (req.user) {
    return next();
  }

  if (wantsJson(req)) {
    return res.status(401).json({ error: 'Sign in to continue.' });
  }

  return res.redirect('/login');
}

/** Keeps signed-in users off the login and register pages. */
export function requireGuest(req, res, next) {
  if (req.user) {
    return res.redirect('/dashboard');
  }

  return next();
}

/** Sellers only - used by the listing routes in Phase 5. */
export function requireSeller(req, res, next) {
  if (req.user?.role === 'seller') {
    return next();
  }

  if (!req.user) {
    return requireAuth(req, res, next);
  }

  return res.status(403).send('403 - Seller account required');
}
