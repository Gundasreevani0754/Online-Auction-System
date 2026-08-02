import { getDb, nowIso, transaction } from './index.js';

/**
 * Creates the item and its auction together. Both rows are written inside one
 * transaction so a failure can never leave an item with no auction attached.
 *
 * @param {{ sellerId: number, title: string, description: string,
 *   category: string, imageUrl: string, startingPrice: number,
 *   endTime: string }} listing
 * @returns {{ itemId: number, auctionId: number }}
 */
export function createListing(listing) {
  const db = getDb();
  const createdAt = nowIso();

  return transaction(db, () => {
    const { lastInsertRowid: itemId } = db
      .prepare(
        `INSERT INTO items (seller_id, title, description, category, image_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        listing.sellerId,
        listing.title,
        listing.description,
        listing.category,
        listing.imageUrl,
        createdAt,
      );

    const { lastInsertRowid: auctionId } = db
      .prepare(
        `INSERT INTO auctions (item_id, starting_price, current_price, start_time, end_time, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'open', ?)`,
      )
      .run(Number(itemId), listing.startingPrice, listing.startingPrice, createdAt, listing.endTime, createdAt);

    return { itemId: Number(itemId), auctionId: Number(auctionId) };
  });
}
