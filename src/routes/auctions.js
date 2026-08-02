import path from 'node:path';
import express from 'express';

import { ROOT_DIR } from '../config.js';
import { requireAuth } from '../auth/middleware.js';
import { BID_ERRORS, getAuctionById, isBiddable, listBidHistory, placeBid } from '../db/bids.js';
import { broadcastBid } from '../realtime/hub.js';

export const auctionsRouter = express.Router();

const asId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/** The detail page itself is public - anyone may look, only members may bid. */
auctionsRouter.get('/auction/:id', (req, res, next) => {
  const auctionId = asId(req.params.id);

  // Fall through to the 404 handler for junk ids and auctions that do not
  // exist, rather than serving a shell that then reports the failure itself.
  if (auctionId === null || !getAuctionById(auctionId)) {
    return next();
  }

  return res.sendFile(path.join(ROOT_DIR, 'auction.html'));
});

auctionsRouter.get('/api/auctions/:id', (req, res) => {
  const auctionId = asId(req.params.id);
  const auction = auctionId === null ? undefined : getAuctionById(auctionId);

  if (!auction) {
    return res.status(404).json({ error: BID_ERRORS.NOT_FOUND });
  }

  const viewer = req.user;

  return res.json({
    auction: { ...auction, isBiddable: isBiddable(auction) },
    bids: listBidHistory(auctionId),
    viewer: viewer
      ? {
          id: viewer.id,
          firstName: viewer.first_name,
          isSeller: viewer.id === auction.sellerId,
        }
      : null,
  });
});

auctionsRouter.post('/bids', requireAuth, (req, res) => {
  const auctionId = asId(req.body.auctionId);
  const amount = Number(req.body.amount);

  if (auctionId === null) {
    return res.status(400).json({ error: BID_ERRORS.NOT_FOUND });
  }

  const result = placeBid({ auctionId, bidderId: req.user.id, amount });

  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  const payload = {
    auction: { ...result.auction, isBiddable: isBiddable(result.auction) },
    bids: listBidHistory(auctionId),
  };

  // Everyone watching this auction sees the new bid immediately.
  broadcastBid(payload);

  return res.json(payload);
});
