import { getDb } from './index.js';

/**
 * Read-only queries backing the dashboards. Creating listings and placing bids
 * arrive in Phases 5 and 6.
 */

const AUCTION_CARD_COLUMNS = `
  a.id            AS auctionId,
  a.current_price AS currentPrice,
  a.starting_price AS startingPrice,
  a.end_time      AS endTime,
  a.status        AS status,
  i.title         AS title,
  i.category      AS category,
  i.image_url     AS imageUrl,
  (SELECT COUNT(*) FROM bids b WHERE b.auction_id = a.id) AS bidCount
`;

/** Open auctions, soonest to finish first - the buyer's "Live Auctions" list. */
export function listOpenAuctions(limit = 12) {
  return getDb()
    .prepare(
      `SELECT ${AUCTION_CARD_COLUMNS},
              u.id                               AS sellerId,
              u.first_name || ' ' || u.last_name AS sellerName
       FROM auctions a
       JOIN items i ON i.id = a.item_id
       JOIN users u ON u.id = i.seller_id
       WHERE a.status = 'open'
       ORDER BY a.end_time ASC
       LIMIT ?`,
    )
    .all(limit);
}

/**
 * One row per auction the user has bid on, with their best bid and whether it
 * is still the leading one.
 */
export function listBidsByUser(userId) {
  return getDb()
    .prepare(
      `SELECT ${AUCTION_CARD_COLUMNS},
              MAX(b.amount)                            AS myBid,
              COUNT(b.id)                              AS myBidCount,
              MAX(b.created_at)                        AS lastBidAt,
              CASE WHEN MAX(b.amount) = a.current_price THEN 1 ELSE 0 END AS isWinning
       FROM bids b
       JOIN auctions a ON a.id = b.auction_id
       JOIN items i    ON i.id = a.item_id
       WHERE b.bidder_id = ?
       GROUP BY a.id
       ORDER BY isWinning DESC, a.end_time ASC`,
    )
    .all(userId);
}

/** Everything this seller has listed. */
export function listItemsBySeller(sellerId) {
  return getDb()
    .prepare(
      `SELECT ${AUCTION_CARD_COLUMNS},
              i.id     AS itemId,
              t.status AS paymentStatus,
              a.winner_id AS winnerId
       FROM items i
       LEFT JOIN auctions a      ON a.item_id = i.id
       LEFT JOIN transactions t  ON t.auction_id = a.id
       WHERE i.seller_id = ?
       ORDER BY a.end_time ASC`,
    )
    .all(sellerId);
}

/** Most recent bids placed on this seller's items. */
export function listBidsReceived(sellerId, limit = 10) {
  return getDb()
    .prepare(
      `SELECT b.amount     AS amount,
              b.created_at AS placedAt,
              i.title      AS title,
              a.id         AS auctionId,
              u.first_name || ' ' || u.last_name AS bidderName
       FROM bids b
       JOIN auctions a ON a.id = b.auction_id
       JOIN items i    ON i.id = a.item_id
       JOIN users u    ON u.id = b.bidder_id
       WHERE i.seller_id = ?
       ORDER BY b.created_at DESC
       LIMIT ?`,
    )
    .all(sellerId, limit);
}
