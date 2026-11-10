import pg from 'pg';
import { createPool, migrate, type Db } from '../src/db';

const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? 'postgres://ipak:ipak@localhost:5432/postgres';

/** Har bir test fayli uchun alohida, bo'sh baza: testlar bir-biriga ta'sir qilmaydi. */
export async function freshDb(): Promise<{ db: Db; drop(): Promise<void> }> {
  const name = `ipak_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  const db = createPool(url.toString());
  await migrate(db);
  return {
    db,
    async drop() {
      await db.end();
      const a = new pg.Client({ connectionString: ADMIN_URL });
      await a.connect();
      await a.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await a.end();
    },
  };
}
