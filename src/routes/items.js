import path from 'node:path';
import express from 'express';

import { ROOT_DIR } from '../config.js';
import { requireSeller } from '../auth/middleware.js';
import { listOpenAuctions } from '../db/auctions.js';
import { createListing } from '../db/items.js';
import { validateListing } from '../listings/validate.js';

export const itemsRouter = express.Router();

/** Public feed powering the home page grid. */
itemsRouter.get('/api/auctions', (req, res) => {
  res.json({ auctions: listOpenAuctions(24) });
});

itemsRouter.get(['/sell', '/sell.html'], requireSeller, (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'sell.html'));
});

itemsRouter.post('/items', requireSeller, (req, res) => {
  const { errors, values } = validateListing(req.body);

  if (errors.length > 0) {
    return res.redirect(`/sell?${new URLSearchParams({ error: errors[0] }).toString()}`);
  }

  createListing({ ...values, sellerId: req.user.id });

  return res.redirect(`/dashboard?${new URLSearchParams({ listed: values.title }).toString()}`);
});
