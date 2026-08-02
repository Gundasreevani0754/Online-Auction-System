import { hashPassword } from '../auth/password.js';
import { closeDb, getDb, nowIso, transaction } from './index.js';
import { AUCTIONS, BUYERS, DEMO_PASSWORD, SELLERS } from './seed-data.js';

const BID_INTERVAL_MS = 7 * 60 * 1000;

/** Order matters: children before parents so foreign keys stay satisfied. */
const TABLES_IN_DELETE_ORDER = ['transactions', 'bids', 'auctions', 'items', 'users'];

function clearAllTables(db) {
  for (const table of TABLES_IN_DELETE_ORDER) {
    db.exec(`DELETE FROM ${table}`);
  }
  db.exec(`DELETE FROM sqlite_sequence WHERE name IN (${TABLES_IN_DELETE_ORDER.map((t) => `'${t}'`).join(', ')})`);
}

function insertUsers(db, passwordHash) {
  const insert = db.prepare(`
    INSERT INTO users (first_name, last_name, email, phone, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const idsByKey = new Map();
  const createdAt = nowIso();

  for (const [role, people] of [['seller', SELLERS], ['buyer', BUYERS]]) {
    for (const person of people) {
      const { lastInsertRowid } = insert.run(
        person.firstName,
        person.lastName,
        person.email,
        person.phone,
        passwordHash,
        role,
        createdAt,
      );
      idsByKey.set(person.key, Number(lastInsertRowid));
    }
  }

  return idsByKey;
}

/**
 * Builds an evenly spaced ladder of `count` bids climbing from just above the
 * starting price to exactly the current price, so `MAX(bids.amount)` always
 * agrees with `auctions.current_price`.
 *
 * @returns {number[]}
 */
function buildBidLadder(startingPrice, currentPrice, count) {
  const range = currentPrice - startingPrice;

  return Array.from({ length: count }, (_, index) =>
    startingPrice + Math.round((range * (index + 1)) / count),
  );
}

function insertAuctions(db, userIdsByKey) {
  const insertItem = db.prepare(`
    INSERT INTO items (seller_id, title, description, category, image_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertAuction = db.prepare(`
    INSERT INTO auctions (item_id, starting_price, current_price, start_time, end_time, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'open', ?)
  `);
  const insertBid = db.prepare(`
    INSERT INTO bids (auction_id, bidder_id, amount, created_at)
    VALUES (?, ?, ?, ?)
  `);

  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const buyerIds = BUYERS.map((buyer) => userIdsByKey.get(buyer.key));
  let bidTotal = 0;

  for (const auction of AUCTIONS) {
    const sellerId = userIdsByKey.get(auction.sellerKey);
    const amounts = buildBidLadder(auction.startingPrice, auction.currentPrice, auction.bidCount);
    const startTime = new Date(now - amounts.length * BID_INTERVAL_MS).toISOString();

    const { lastInsertRowid: itemId } = insertItem.run(
      sellerId,
      auction.title,
      auction.description,
      auction.category,
      auction.imageUrl,
      createdAt,
    );

    const { lastInsertRowid: auctionId } = insertAuction.run(
      Number(itemId),
      auction.startingPrice,
      auction.currentPrice,
      startTime,
      new Date(now + auction.endsInMs).toISOString(),
      createdAt,
    );

    amounts.forEach((amount, index) => {
      // Rotating bidders keeps the same person from outbidding themselves.
      const bidderId = buyerIds[index % buyerIds.length];
      const placedAt = new Date(now - (amounts.length - index) * BID_INTERVAL_MS).toISOString();

      insertBid.run(Number(auctionId), bidderId, amount, placedAt);
    });

    bidTotal += amounts.length;
  }

  return { auctionCount: AUCTIONS.length, bidTotal };
}

/**
 * Wipes and repopulates every table. Safe to run repeatedly.
 *
 * @param {DatabaseSync} db
 */
export function seedDatabase(db) {
  const passwordHash = hashPassword(DEMO_PASSWORD);

  return transaction(db, () => {
    clearAllTables(db);
    const userIdsByKey = insertUsers(db, passwordHash);
    const counts = insertAuctions(db, userIdsByKey);

    return { userCount: SELLERS.length + BUYERS.length, ...counts };
  });
}

// Run directly via `npm run db:seed`.
if (import.meta.filename === process.argv[1]) {
  try {
    const result = seedDatabase(getDb());
    console.log(
      `Seeded ${result.userCount} users, ${result.auctionCount} auctions and ${result.bidTotal} bids.`,
    );
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  } finally {
    closeDb();
  }
}
