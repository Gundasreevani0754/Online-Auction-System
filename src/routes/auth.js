import express from 'express';

import { createUser, emailExists, findByEmailWithHash } from '../db/users.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { clearSessionCookie, setSessionCookie } from '../auth/session.js';
import { requireAuth } from '../auth/middleware.js';
import { clearFailures, isLockedOut, recordFailure } from '../auth/throttle.js';
import { validateLogin, validateRegistration } from '../auth/validate.js';

export const authRouter = express.Router();

/** Sends the visitor back to the form with a message the page can display. */
function redirectWithError(res, page, message, email = '') {
  const params = new URLSearchParams({ error: message });

  if (email) {
    params.set('email', email);
  }

  return res.redirect(`${page}?${params.toString()}`);
}

authRouter.post('/register', (req, res) => {
  const { errors, values } = validateRegistration(req.body);

  if (errors.length > 0) {
    return redirectWithError(res, '/register', errors[0], values.email);
  }

  if (emailExists(values.email)) {
    return redirectWithError(res, '/register', 'That email is already registered.', values.email);
  }

  const user = createUser({
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    phone: values.phone,
    passwordHash: hashPassword(values.password),
    role: values.role,
  });

  setSessionCookie(res, user.id);

  return res.redirect('/dashboard');
});

authRouter.post('/login', (req, res) => {
  const { errors, values } = validateLogin(req.body);

  if (errors.length > 0) {
    return redirectWithError(res, '/login', errors[0], values.email);
  }

  if (isLockedOut(req, values.email)) {
    return redirectWithError(res, '/login', 'Too many attempts. Try again later.', values.email);
  }

  const user = findByEmailWithHash(values.email);

  // One message for both cases, so the form cannot be used to discover which
  // email addresses are registered.
  if (!user || !verifyPassword(values.password, user.password_hash)) {
    recordFailure(req, values.email);
    return redirectWithError(res, '/login', 'Invalid email or password.', values.email);
  }

  clearFailures(req, values.email);
  setSessionCookie(res, user.id);

  return res.redirect('/dashboard');
});

authRouter.post('/logout', (req, res) => {
  clearSessionCookie(res);

  return res.redirect('/');
});

/** Lets any page ask who is signed in. Used by the navbar from Phase 4 on. */
authRouter.get('/api/me', requireAuth, (req, res) => {
  const { id, first_name: firstName, last_name: lastName, email, role } = req.user;

  return res.json({ id, firstName, lastName, email, role });
});
