import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

let tempDir: string | undefined;
let closeDb: (() => void) | undefined;

afterEach(() => {
  closeDb?.();
  closeDb = undefined;

  if (ORIGINAL_NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = ORIGINAL_NODE_ENV;

  if (ORIGINAL_ENCRYPTION_KEY === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = ORIGINAL_ENCRYPTION_KEY;

  vi.resetModules();
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe('development database initialization', () => {
  it('applies migrations when starting with a fresh database', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freellmapi-dev-db-'));
    process.env.NODE_ENV = 'development';
    process.env.ENCRYPTION_KEY = 'd'.repeat(64);
    vi.resetModules();

    const { initDb } = await import('../../db/index.js');
    const db = initDb(path.join(tempDir, 'freeapi.db'));
    closeDb = () => db.close();

    const migrations = db.prepare('SELECT COUNT(*) AS count FROM migrations').get() as { count: number };
    const tables = db.prepare(`
      SELECT name FROM sqlite_master
       WHERE type = 'table' AND name IN ('models', 'api_keys', 'settings')
    `).all() as { name: string }[];

    expect(migrations.count).toBeGreaterThan(0);
    expect(tables.map(({ name }) => name).sort()).toEqual(['api_keys', 'models', 'settings']);
  });
});
