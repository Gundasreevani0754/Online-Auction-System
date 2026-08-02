-- BidderX schema.
--
-- Conventions:
--   * Money is stored as INTEGER rupees. Never REAL - floating point rounding
--     must not touch bid amounts.
--   * Timestamps are TEXT in ISO 8601 UTC ('2026-08-02T16:30:00.000Z') so they
--     sort correctly as plain strings.

PRAGMA foreign_keys = ON;

-- Users -----------------------------------------------------------------
-- A single table for buyers and sellers. Sellers can also bid, so the role
-- only controls who is allowed to list items.
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name    TEXT    NOT NULL,
  last_name     TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  phone         TEXT,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller')),
  created_at    TEXT    NOT NULL
);

-- Items -----------------------------------------------------------------
-- The physical object being sold: photo, description, category, owner.
CREATE TABLE IF NOT EXISTS items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  category    TEXT    NOT NULL,
  image_url   TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL
);

-- Auctions --------------------------------------------------------------
-- The sale event for an item: price, window, outcome. Separate from items so
-- an unsold item can be relisted later without duplicating its details.
CREATE TABLE IF NOT EXISTS auctions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id        INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  starting_price INTEGER NOT NULL CHECK (starting_price >= 0),
  current_price  INTEGER NOT NULL CHECK (current_price >= 0),
  start_time     TEXT    NOT NULL,
  end_time       TEXT    NOT NULL,
  status         TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
  winner_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT    NOT NULL,
  CHECK (end_time > start_time)
);

-- Bids ------------------------------------------------------------------
-- Append-only. Rows are never updated or deleted, so the full bid history
-- the brief asks for is always recoverable.
CREATE TABLE IF NOT EXISTS bids (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  auction_id INTEGER NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  bidder_id  INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  amount     INTEGER NOT NULL CHECK (amount > 0),
  created_at TEXT    NOT NULL
);

-- Transactions ----------------------------------------------------------
-- Written when an auction closes with a winner. One per auction.
CREATE TABLE IF NOT EXISTS transactions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  auction_id INTEGER NOT NULL UNIQUE REFERENCES auctions(id) ON DELETE CASCADE,
  buyer_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     INTEGER NOT NULL CHECK (amount > 0),
  status     TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at TEXT    NOT NULL
);

-- Indexes ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_items_seller      ON items (seller_id);
CREATE INDEX IF NOT EXISTS idx_auctions_item     ON auctions (item_id);
CREATE INDEX IF NOT EXISTS idx_auctions_status   ON auctions (status, end_time);
CREATE INDEX IF NOT EXISTS idx_bids_auction      ON bids (auction_id, amount DESC);
CREATE INDEX IF NOT EXISTS idx_bids_bidder       ON bids (bidder_id);
CREATE INDEX IF NOT EXISTS idx_tx_buyer          ON transactions (buyer_id);
CREATE INDEX IF NOT EXISTS idx_tx_seller         ON transactions (seller_id);
