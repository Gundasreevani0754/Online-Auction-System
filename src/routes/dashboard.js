import path from 'node:path';
import express from 'express';

import { ROOT_DIR } from '../config.js';
import { requireAuth } from '../auth/middleware.js';
import {
  listBidsByUser,
  listBidsReceived,
  listItemsBySeller,
  listOpenAuctions,
} from '../db/auctions.js';

export const dashboardRouter = express.Router();

const isOpen = (row) => row.status === 'open';

function buildBuyerView(userId) {
  const myBids = listBidsByUser(userId);
  const openBids = myBids.filter(isOpen);

  return {
    liveAuctions: listOpenAuctions(),
    myBids,
    stats: [
      { label: 'Active Bids', value: String(openBids.length) },
      { label: 'Currently Winning', value: String(openBids.filter((row) => row.isWinning).length) },
      { label: 'Auctions Live', value: String(listOpenAuctions().length) },
    ],
  };
}

function buildSellerView(userId) {
  const myListings = listItemsBySeller(userId);
  const bidsReceived = listBidsReceived(userId);
  const openListings = myListings.filter(isOpen);
  const totalBids = myListings.reduce((sum, row) => sum + row.bidCount, 0);
  const topBid = openListings.reduce((max, row) => Math.max(max, row.currentPrice), 0);

  return {
    myListings,
    bidsReceived,
    stats: [
      { label: 'Active Listings', value: String(openListings.length) },
      { label: 'Bids Received', value: String(totalBids) },
      { label: 'Highest Bid', value: topBid > 0 ? `₹${topBid.toLocaleString('en-IN')}` : '—' },
    ],
  };
}

// Both paths serve the same page, matching how /login and /login.html behave.
dashboardRouter.get(['/dashboard', '/dashboard.html'], requireAuth, (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'dashboard.html'));
});

dashboardRouter.get('/api/dashboard', requireAuth, (req, res) => {
  const { id, first_name: firstName, last_name: lastName, email, role } = req.user;

  const view = role === 'seller' ? buildSellerView(id) : buildBuyerView(id);

  res.json({ user: { id, firstName, lastName, email, role }, ...view });
});
