import { getDb, nowIso } from './index.js';

const PUBLIC_COLUMNS = 'id, first_name, last_name, email, phone, role, created_at';

/**
 * @param {string} email
 * @returns {object | undefined} Includes password_hash - login use only.
 */
export function findByEmailWithHash(email) {
  return getDb()
    .prepare(`SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE email = ?`)
    .get(email);
}

/**
 * @param {number} id
 * @returns {object | undefined} Never includes the password hash.
 */
export function findById(id) {
  return getDb().prepare(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ?`).get(id);
}

export function emailExists(email) {
  return getDb().prepare('SELECT 1 FROM users WHERE email = ?').get(email) !== undefined;
}

/**
 * @param {{ firstName: string, lastName: string, email: string, phone: string,
 *   passwordHash: string, role: 'buyer' | 'seller' }} user
 * @returns {object} The created user, without the password hash.
 */
export function createUser({ firstName, lastName, email, phone, passwordHash, role }) {
  const { lastInsertRowid } = getDb()
    .prepare(
      `INSERT INTO users (first_name, last_name, email, phone, password_hash, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(firstName, lastName, email, phone, passwordHash, role, nowIso());

  return findById(Number(lastInsertRowid));
}
