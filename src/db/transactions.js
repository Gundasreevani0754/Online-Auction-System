import { getDb, nowIso } from './index.js';

/**
 * A transaction is created the moment an auction closes with a winner - it is
 * the amount owed. Checkout then marks it paid.
 *
 * Payment is deliberately simulated: no card details are collected anywhere in
 * this project, so there is nothing sensitive to protect.
 */

export const CHECKOUT_ERRORS = {
  NOT_FOUND: 'No payment is due for that auction.',
  NOT_WINNER: 'Only the winning bidder can complete this payment.',
  ALREADY_PAID: 'This payment has already been completed.',
};

const TRANSACTION_SQL = `
  SELECT t.id         AS id,
         t.auction_id  AS auctionId,
         t.buyer_id    AS buyerId,
         t.seller_id   AS sellerId,
         t.amount      AS amount,
         t.status      AS status,
         t.created_at  AS createdAt
  FROM transactions t
  WHERE t.auction_id = ?
`;

export function getByAuctionId(auctionId) {
  return getDb().prepare(TRANSACTION_SQL).get(auctionId);
}

/**
 * Records what the winner owes. Called by the closer inside its own
 * transaction, so the database handle is passed in.
 *
 * INSERT OR IGNORE plus the UNIQUE constraint on auction_id means an auction
 * can never end up with two invoices, however often this runs.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ auctionId: number, buyerId: number, sellerId: number, amount: number }} sale
 */
export function createPendingTransaction(db, { auctionId, buyerId, sellerId, amount }) {
  return db
    .prepare(
      `INSERT OR IGNORE INTO transactions (auction_id, buyer_id, seller_id, amount, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
    )
    .run(auctionId, buyerId, sellerId, amount, nowIso());
}

/**
 * Completes the simulated payment.
 *
 * @param {{ auctionId: number, buyerId: number }} payment
 * @returns {{ ok: true, transaction: object } | { ok: false, error: string }}
 */
export function markPaid({ auctionId, buyerId }) {
  const db = getDb();

  db.exec('BEGIN IMMEDIATE');

  try {
    const transaction = db.prepare(TRANSACTION_SQL).get(auctionId);

    if (!transaction) {
      db.exec('ROLLBACK');
      return { ok: false, error: CHECKOUT_ERRORS.NOT_FOUND };
    }
    if (transaction.buyerId !== buyerId) {
      db.exec('ROLLBACK');
      return { ok: false, error: CHECKOUT_ERRORS.NOT_WINNER };
    }
    if (transaction.status === 'paid') {
      db.exec('ROLLBACK');
      return { ok: false, error: CHECKOUT_ERRORS.ALREADY_PAID };
    }

    db.prepare("UPDATE transactions SET status = 'paid' WHERE id = ? AND status = 'pending'")
      .run(transaction.id);

    db.exec('COMMIT');

    return { ok: true, transaction: getByAuctionId(auctionId) };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** Auctions this user won, newest first, with what they still owe. */
export function listWinsForBuyer(buyerId) {
  return getDb()
    .prepare(
      `SELECT a.id            AS auctionId,
              a.current_price AS amount,
              a.end_time      AS endTime,
              i.title         AS title,
              i.category      AS category,
              i.image_url     AS imageUrl,
              t.status        AS paymentStatus,
              u.first_name || ' ' || u.last_name AS sellerName,
              (SELECT COUNT(*) FROM bids b WHERE b.auction_id = a.id) AS bidCount
       FROM auctions a
       JOIN items i        ON i.id = a.item_id
       JOIN users u        ON u.id = i.seller_id
       LEFT JOIN transactions t ON t.auction_id = a.id
       WHERE a.winner_id = ? AND a.status = 'closed'
       ORDER BY a.end_time DESC`,
    )
    .all(buyerId);
}
