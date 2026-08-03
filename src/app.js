import path from 'node:path';
import express from 'express';

import { ROOT_DIR } from './config.js';
import { attachUser, requireGuest } from './auth/middleware.js';
import { authRouter } from './routes/auth.js';
import { dashboardRouter } from './routes/dashboard.js';
import { itemsRouter } from './routes/items.js';
import { auctionsRouter } from './routes/auctions.js';

/**
 * Public page routes -> the HTML file each one serves, plus any guard.
 * Both "/login" and "/login.html" resolve to the same page, so the existing
 * hrefs inside the HTML keep working untouched.
 */
const PAGES = {
  '/': { file: 'index.html' },
  '/login': { file: 'login.html', guard: requireGuest },
  '/register': { file: 'register.html', guard: requireGuest },
};

/**
 * 0 means "always revalidate", not "never cache": the browser still sends the
 * ETag and gets a cheap 304 when nothing changed. A longer max-age left people
 * running an hour-old copy of the CSS or JS after every edit.
 */
const STATIC_MAX_AGE = 0;

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // req.ip reflects the real client when running behind a proxy.
  app.set('trust proxy', 1);

  // Parsers for the auth form posts.
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  // Makes req.user available to every route below.
  app.use(attachUser);

  // Stylesheets and browser scripts.
  app.use('/css', express.static(path.join(ROOT_DIR, 'css'), { maxAge: STATIC_MAX_AGE }));
  app.use('/js', express.static(path.join(ROOT_DIR, 'js'), { maxAge: STATIC_MAX_AGE }));
  // Product photos are stored locally so the site works without internet.
  app.use('/images', express.static(path.join(ROOT_DIR, 'images'), { maxAge: STATIC_MAX_AGE }));

  app.use(authRouter);
  app.use(dashboardRouter);
  app.use(itemsRouter);
  app.use(auctionsRouter);

  for (const [route, { file, guard }] of Object.entries(PAGES)) {
    const filePath = path.join(ROOT_DIR, file);
    const handlers = guard ? [guard] : [];
    handlers.push((req, res) => res.sendFile(filePath));

    app.get(route, ...handlers);

    // "/" also answers on "/index.html" so the links written in the HTML work.
    app.get(`/${file}`, ...handlers);
  }

  app.use((req, res) => {
    res.status(404).send('404 - Page not found');
  });

  // eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
  app.use((err, req, res, next) => {
    // Errors raised by the body parser already carry the right status - a
    // malformed JSON body is the caller's mistake (400), not a server fault.
    const status = err.status || err.statusCode || 500;

    if (status >= 500) {
      console.error(err);
    }

    const message = status === 400 ? 'Bad request' : 'Something went wrong';

    if (req.path.startsWith('/api/') || req.accepts(['html', 'json']) === 'json') {
      res.status(status).json({ error: message });
      return;
    }

    res.status(status).send(`${status} - ${message}`);
  });

  return app;
}
