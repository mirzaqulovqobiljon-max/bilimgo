import { createPool, migrate } from './db';

const db = createPool();
const applied = await migrate(db);
console.log(applied.length ? `Bajarildi: ${applied.join(', ')}` : 'Yangi migratsiya yo\'q');
await db.end();
