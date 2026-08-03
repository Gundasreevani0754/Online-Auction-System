import { getDb, nowIso } from '../db/index.js';
import { getAuctionById } from '../db/bids.js';
import { createPendingTransaction } from '../db/transactions.js';

/**
 * Closes auctions once their end time passes and records the winner.
 *
 * Runs on a timer rather than being triggered by page views, so an auction
 * finishes on schedule even if nobody is watching it.
 */

const CHECK_INTERVAL_MS = 1000;

let timer = null;
let onClosed = null;

const DUE_AUCTIONS_SQL = `
  SELECT id FROM auctions
  WHERE status = 'open' AND end_time <= ?
  ORDER BY end_time ASC
`;

/**
 * Closes every auction whose time is up. Safe to call at any time - it is a
 * no-op when nothing is due.
 *
 * @returns {object[]} The auctions that were closed by this call.
 */
export function closeDueAuctions() {
  const db = getDb();
  const now = nowIso();

  db.exec('BEGIN IMMEDIATE');

  let closedIds = [];

  try {
    closedIds = db.prepare(DUE_AUCTIONS_SQL).all(now).map((row) => row.id);

    if (closedIds.length === 0) {
      db.exec('ROLLBACK');
      return [];
    }

    const topBid = db.prepare(
      'SELECT bidder_id FROM bids WHERE auction_id = ? ORDER BY amount DESC, id ASC LIMIT 1',
    );
    const close = db.prepare(
      "UPDATE auctions SET status = 'closed', winner_id = ? WHERE id = ? AND status = 'open'",
    );
    const saleDetails = db.prepare(
      `SELECT a.current_price AS amount, i.seller_id AS sellerId
       FROM auctions a JOIN items i ON i.id = a.item_id WHERE a.id = ?`,
    );

    for (const auctionId of closedIds) {
      // No bids means no winner - the item simply goes unsold.
      const winner = topBid.get(auctionId);
      close.run(winner ? winner.bidder_id : null, auctionId);

      // A winner owes the seller straight away, so the invoice is written in
      // the same transaction as the close - never one without the other.
      if (winner) {
        const sale = saleDetails.get(auctionId);
        createPendingTransaction(db, {
          auctionId,
          buyerId: winner.bidder_id,
          sellerId: sale.sellerId,
          amount: sale.amount,
        });
      }
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const closed = closedIds.map((id) => getAuctionById(id));

  if (typeof onClosed === 'function') {
    closed.forEach((auction) => onClosed(auction));
  }

  return closed;
}

/**
 * @param {(auction: object) => void} handler Called once per closed auction,
 *   used to push the result to anyone watching.
 */
export function startAuctionCloser(handler) {
  onClosed = handler;

  // Catches anything that expired while the server was stopped.
  closeDueAuctions();

  timer = setInterval(() => {
    try {
      closeDueAuctions();
    } catch (err) {
      console.error('Auction closer failed:', err.message);
    }
  }, CHECK_INTERVAL_MS);

  return timer;
}

export function stopAuctionCloser() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  onClosed = null;
}
