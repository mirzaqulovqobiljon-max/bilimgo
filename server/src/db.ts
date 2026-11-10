import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export type Db = pg.Pool;

export function createPool(connectionString = process.env.DATABASE_URL): Db {
  if (!connectionString) throw new Error('DATABASE_URL o\'rnatilmagan');
  return new pg.Pool({ connectionString, max: 10 });
}

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));

/** Oddiy migrator: migrations/*.sql fayllarini tartib bilan, faqat bir marta bajaradi. */
export async function migrate(db: Db): Promise<string[]> {
  const client = await db.connect();
  try {
    await client.query('SELECT pg_advisory_lock(727272)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const done = new Set((await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    const applied: string[] = [];
    for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
      if (done.has(file)) continue;
      await client.query('BEGIN');
      try {
        await client.query(readFileSync(MIGRATIONS_DIR + file, 'utf8'));
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
    return applied;
  } finally {
    await client.query('SELECT pg_advisory_unlock(727272)').catch(() => {});
    client.release();
  }
}
