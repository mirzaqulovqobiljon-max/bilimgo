import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { createPool, migrate } from './db';

const db = createPool();
const applied = await migrate(db);
if (applied.length) console.log('Migratsiyalar:', applied.join(', '));

const app = createApp({
  db,
  teacherInvite: process.env.TEACHER_INVITE,
  staticDir: process.env.STATIC_DIR ?? fileURLToPath(new URL('../../dist/', import.meta.url)),
  classGoalStars: process.env.CLASS_GOAL_STARS ? Number(process.env.CLASS_GOAL_STARS) : undefined,
});
const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => console.log(`Ipak Yo'li server: http://localhost:${port}`));
