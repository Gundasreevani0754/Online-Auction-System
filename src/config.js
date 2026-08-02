import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(currentDir, '..');
export const PORT = Number(process.env.PORT) || 3000;
export const HOST = process.env.HOST || 'localhost';

export const DB_PATH = process.env.DB_PATH || path.join(ROOT_DIR, 'data', 'bidderx.sqlite');
export const SCHEMA_PATH = path.join(currentDir, 'db', 'schema.sql');
