import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing built on Node's own crypto module - scrypt is a memory-hard
 * KDF designed for exactly this, so no third-party dependency is needed.
 *
 * Stored format: scrypt$<salt-hex>$<hash-hex>
 */

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const ALGORITHM = 'scrypt';

/**
 * @param {string} plainPassword
 * @returns {string} The encoded hash, safe to store in `users.password_hash`.
 */
export function hashPassword(plainPassword) {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const derived = scryptSync(plainPassword, salt, KEY_LENGTH).toString('hex');

  return `${ALGORITHM}$${salt}$${derived}`;
}

/**
 * Compares a candidate password against a stored hash in constant time.
 *
 * @param {string} plainPassword
 * @param {string} storedHash
 * @returns {boolean}
 */
export function verifyPassword(plainPassword, storedHash) {
  if (typeof storedHash !== 'string') {
    return false;
  }

  const [algorithm, salt, expected] = storedHash.split('$');
  if (algorithm !== ALGORITHM || !salt || !expected) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = scryptSync(plainPassword, salt, expectedBuffer.length);

  return timingSafeEqual(expectedBuffer, actualBuffer);
}
