import { getDb, nowIso } from './index.js';

/**
 * Bidding rules live here rather than in the route, so every path into the
 * database is checked. The whole read-check-write sequence runs inside one
 * IMMEDIATE transaction: SQLite takes the write lock up front, so two bids
 * arriving at the same moment cannot both read the same current price and
 * both succeed.
 */

/**
 * Anti-sniping. A bid inside the final window pushes the finish line back, so
 * an auction cannot be won by bidding one second before the end - there is
 * always time to respond.
 */
export const ANTI_SNIPE_WINDOW_MS = 2 * 60 * 1000;
export const ANTI_SNIPE_EXTENSION_MS = 2 * 60 * 1000;

export const BID_ERRORS = {
  NOT_FOUND: 'That auction does not exist.',
  CLOSED: 'This auction has already ended.',
  OWN_ITEM: 'You cannot bid on your own item.',
  INVALID_AMOUNT: 'Enter a valid bid amount in rupees.',
  TOO_LOW: 'Your bid must be higher than the current bid.',
  BELOW_START: 'Your bid must be at least the starting price.',
};

const AUCTION_DETAIL_SQL = `
  SELECT a.id             AS auctionId,
         a.starting_price AS startingPrice,
         a.current_price  AS currentPrice,
         a.start_time     AS startTime,
         a.end_time       AS endTime,
         a.status         AS status,
         a.winner_id      AS winnerId,
         w.first_name || ' ' || SUBSTR(w.last_name, 1, 1) || '.' AS winnerName,
         i.id             AS itemId,
         i.title          AS title,
         i.description    AS description,
         i.category       AS category,
         i.image_url      AS imageUrl,
         u.id             AS sellerId,
         u.first_name || ' ' || u.last_name AS sellerName,
         (SELECT COUNT(*) FROM bids b WHERE b.auction_id = a.id) AS bidCount
  FROM auctions a
  JOIN items i      ON i.id = a.item_id
  JOIN users u      ON u.id = i.seller_id
  LEFT JOIN users w ON w.id = a.winner_id
  WHERE a.id = ?
`;

export function getAuctionById(auctionId) {
  return getDb().prepare(AUCTION_DETAIL_SQL).get(auctionId);
}

/** Full bid history, newest first - the transparency the brief asks for. */
export function listBidHistory(auctionId, limit = 50) {
  return getDb()
    .prepare(
      `SELECT b.id                              AS id,
              b.amount                          AS amount,
              b.created_at                      AS placedAt,
              b.bidder_id                       AS bidderId,
              u.first_name || ' ' || SUBSTR(u.last_name, 1, 1) || '.' AS bidderName
       FROM bids b
       JOIN users u ON u.id = b.bidder_id
       WHERE b.auction_id = ?
       ORDER BY b.amount DESC, b.id DESC
       LIMIT ?`,
    )
    .all(auctionId, limit);
}

/** An auction is biddable only while it is open AND its end time is ahead. */
export function isBiddable(auction, now = Date.now()) {
  return auction.status === 'open' && new Date(auction.endTime).getTime() > now;
}

/**
 * Places a bid after re-checking every rule against the live row.
 *
 * @param {{ auctionId: number, bidderId: number, amount: number }} bid
 * @returns {{ ok: true, auction: object } | { ok: false, error: string }}
 */
export function placeBid({ auctionId, bidderId, amount }) {
  const db = getDb();

  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: BID_ERRORS.INVALID_AMOUNT };
  }

  db.exec('BEGIN IMMEDIATE');

  try {
    const auction = db.prepare(AUCTION_DETAIL_SQL).get(auctionId);

    if (!auction) {
      db.exec('ROLLBACK');
      return { ok: false, error: BID_ERRORS.NOT_FOUND };
    }
    if (!isBiddable(auction)) {
      db.exec('ROLLBACK');
      return { ok: false, error: BID_ERRORS.CLOSED };
    }
    if (auction.sellerId === bidderId) {
      db.exec('ROLLBACK');
      return { ok: false, error: BID_ERRORS.OWN_ITEM };
    }

    // The first bid may match the starting price; later bids must beat the
    // current one.
    const isFirstBid = auction.bidCount === 0;

    if (isFirstBid && amount < auction.startingPrice) {
      db.exec('ROLLBACK');
      return { ok: false, error: BID_ERRORS.BELOW_START };
    }
    if (!isFirstBid && amount <= auction.currentPrice) {
      db.exec('ROLLBACK');
      return { ok: false, error: BID_ERRORS.TOO_LOW };
    }

    db.prepare('INSERT INTO bids (auction_id, bidder_id, amount, created_at) VALUES (?, ?, ?, ?)')
      .run(auctionId, bidderId, amount, nowIso());

    // Anti-sniping: a late bid moves the end time out, giving everyone else a
    // fair chance to respond.
    const now = Date.now();
    const endsAt = new Date(auction.endTime).getTime();
    const extended = endsAt - now <= ANTI_SNIPE_WINDOW_MS;
    const newEndTime = extended ? new Date(now + ANTI_SNIPE_EXTENSION_MS).toISOString() : auction.endTime;

    db.prepare('UPDATE auctions SET current_price = ?, end_time = ? WHERE id = ?')
      .run(amount, newEndTime, auctionId);

    db.exec('COMMIT');

    return { ok: true, auction: getAuctionById(auctionId), extended };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
