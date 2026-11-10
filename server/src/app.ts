import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { mergeProgress } from '../../src/engine/merge';
import { ProgressSchema, initialProgress, type Progress } from '../../src/engine/progress';
import { hashPassword, hashToken, newClassCode, newToken, normalizeCode, verifyPassword } from './auth';
import type { Db } from './db';

export interface AppOptions {
  db: Db;
  /** Bo'lsa — o'qituvchi ro'yxatdan o'tishi uchun shu taklif kodi talab qilinadi. */
  teacherInvite?: string;
  /** Bo'lsa — frontend build (dist/) shu yerdan beriladi. */
  staticDir?: string;
  /** Sinf jamoaviy maqsadi (rejada: "butun sinf bilan 500 yulduz"). */
  classGoalStars?: number;
  sessionDays?: number;
  /** Daqiqasiga so'rovlar chegarasi (testlarda o'zgartiriladi). */
  limits?: { auth?: number; join?: number };
}

type Role = 'student' | 'teacher' | 'admin';
interface AuthUser {
  id: string;
  role: Role;
  name: string;
  class_id: number | null;
}
type AuthedRequest = Request & { user: AuthUser };

class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const body = <T extends z.ZodTypeAny>(schema: T, req: Request): z.infer<T> => {
  const r = schema.safeParse(req.body);
  if (!r.success) throw new HttpError(400, 'invalid_input');
  return r.data;
};

/**
 * Juda oddiy xotiradagi cheklovchi: kod/parol taxmin qilishni sekinlashtiradi.
 * Kalit — IP + marshrut nomi (yo'l emas: aks holda har bir taxmin qilingan kod alohida hisoblanardi).
 */
function rateLimit(bucket: string, max: number, windowMs: number) {
  const hits = new Map<string, { n: number; until: number }>();
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = `${req.ip}:${bucket}`;
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.until < now) hits.set(key, { n: 1, until: now + windowMs });
    else if (++h.n > max) return next(new HttpError(429, 'too_many_requests'));
    next();
  };
}

const Name = z.string().trim().min(1).max(30).regex(/^[\p{L}\p{M}' ʻ’-]+$/u, 'faqat harflar');

export function createApp(opts: AppOptions) {
  const { db } = opts;
  const goal = opts.classGoalStars ?? 500;
  const sessionDays = opts.sessionDays ?? 180;
  const authLimit = opts.limits?.auth ?? 10;
  const joinLimit = opts.limits?.join ?? 30;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '200kb' }));
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });

  const issueSession = async (userId: string) => {
    const { token, hash } = newToken();
    await db.query(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + ($3 || ' days')::interval)`, [
      hash,
      userId,
      String(sessionDays),
    ]);
    return token;
  };


  const requireUser =
    (...roles: Role[]) =>
    async (req: Request, _res: Response, next: NextFunction) => {
      try {
        const header = req.get('authorization') ?? '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : '';
        if (!token) throw new HttpError(401, 'unauthorized');
        const r = await db.query<AuthUser>(
          `SELECT u.id, u.role, u.name, u.class_id FROM sessions s JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = $1 AND s.expires_at > now()`,
          [hashToken(token)],
        );
        const user = r.rows[0];
        if (!user) throw new HttpError(401, 'unauthorized');
        if (roles.length && !roles.includes(user.role)) throw new HttpError(403, 'forbidden');
        (req as AuthedRequest).user = user;
        next();
      } catch (e) {
        next(e);
      }
    };
  const userOf = (req: Request) => (req as AuthedRequest).user;

  const api = express.Router();

  api.get('/health', wrap(async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ ok: true });
  }));

  // ---------- O'qituvchi ----------
  const TeacherRegister = z.object({
    name: z.string().trim().min(1).max(60),
    email: z.string().trim().toLowerCase().email().max(120),
    password: z.string().min(8).max(200),
    invite: z.string().optional(),
  });
  api.post('/teachers/register', rateLimit('register', authLimit, 60_000), wrap(async (req, res) => {
    const b = body(TeacherRegister, req);
    if (opts.teacherInvite && b.invite !== opts.teacherInvite) throw new HttpError(403, 'bad_invite');
    const hash = await hashPassword(b.password);
    try {
      const r = await db.query<{ id: string }>(
        `INSERT INTO users (role, name, email, password_hash) VALUES ('teacher', $1, $2, $3) RETURNING id`,
        [b.name, b.email, hash],
      );
      res.status(201).json({ token: await issueSession(r.rows[0]!.id), name: b.name });
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new HttpError(409, 'email_taken');
      throw e;
    }
  }));

  api.post('/teachers/login', rateLimit('login', authLimit, 60_000), wrap(async (req, res) => {
    const b = body(z.object({ email: z.string().trim().toLowerCase(), password: z.string() }), req);
    const r = await db.query<{ id: string; name: string; password_hash: string }>(
      `SELECT id, name, password_hash FROM users WHERE email = $1 AND role IN ('teacher','admin')`,
      [b.email],
    );
    const u = r.rows[0];
    if (!u || !(await verifyPassword(b.password, u.password_hash))) throw new HttpError(401, 'bad_credentials');
    res.json({ token: await issueSession(u.id), name: u.name });
  }));

  api.post('/logout', requireUser(), wrap(async (req, res) => {
    const token = (req.get('authorization') ?? '').slice(7);
    await db.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
    res.status(204).end();
  }));

  const ownClass = async (req: Request) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'not_found');
    const u = userOf(req);
    const r = await db.query<{ id: number; name: string; grade: number; code: string; ranking_enabled: boolean; school: string }>(
      `SELECT c.id, c.name, c.grade, c.code, c.ranking_enabled, s.name AS school
         FROM classes c JOIN schools s ON s.id = c.school_id
        WHERE c.id = $1 AND (c.teacher_id = $2 OR $3 = 'admin')`,
      [id, u.id, u.role],
    );
    if (!r.rows[0]) throw new HttpError(404, 'not_found');
    return r.rows[0];
  };

  api.get('/classes', requireUser('teacher', 'admin'), wrap(async (req, res) => {
    const r = await db.query(
      `SELECT c.id, c.name, c.grade, c.code, c.ranking_enabled AS "rankingEnabled", s.name AS school,
              (SELECT count(*)::int FROM users u WHERE u.class_id = c.id) AS students
         FROM classes c JOIN schools s ON s.id = c.school_id
        WHERE c.teacher_id = $1 ORDER BY c.created_at`,
      [userOf(req).id],
    );
    res.json(r.rows);
  }));

  api.post('/classes', requireUser('teacher', 'admin'), wrap(async (req, res) => {
    const b = body(
      z.object({ name: z.string().trim().min(1).max(30), grade: z.number().int().min(1).max(11), school: z.string().trim().min(1).max(120) }),
      req,
    );
    const school = await db.query<{ id: number }>(
      `INSERT INTO schools (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [b.school],
    );
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const r = await db.query(
          `INSERT INTO classes (school_id, teacher_id, name, grade, code) VALUES ($1, $2, $3, $4, $5)
           RETURNING id, name, grade, code, ranking_enabled AS "rankingEnabled"`,
          [school.rows[0]!.id, userOf(req).id, b.name, b.grade, newClassCode()],
        );
        res.status(201).json({ ...r.rows[0], school: b.school, students: 0 });
        return;
      } catch (e) {
        if ((e as { code?: string }).code !== '23505') throw e; // kod to'qnashuvi — qayta urinamiz
      }
    }
    throw new HttpError(500, 'code_generation_failed');
  }));

  api.patch('/classes/:id', requireUser('teacher', 'admin'), wrap(async (req, res) => {
    const c = await ownClass(req);
    const b = body(z.object({ rankingEnabled: z.boolean() }), req);
    // Rejaga ko'ra: 7-14 yoshlilar uchun ommaviy reyting yo'q; faqat 9-11 sinflarda o'qituvchi yoqishi mumkin.
    if (b.rankingEnabled && c.grade < 9) throw new HttpError(400, 'ranking_not_allowed_for_grade');
    await db.query('UPDATE classes SET ranking_enabled = $1 WHERE id = $2', [b.rankingEnabled, c.id]);
    res.json({ ok: true });
  }));

  api.post('/classes/:id/rotate-code', requireUser('teacher', 'admin'), wrap(async (req, res) => {
    const c = await ownClass(req);
    const code = newClassCode();
    await db.query('UPDATE classes SET code = $1 WHERE id = $2', [code, c.id]);
    res.json({ code });
  }));

  api.delete('/classes/:id/students/:sid', requireUser('teacher', 'admin'), wrap(async (req, res) => {
    const c = await ownClass(req);
    const r = await db.query(`DELETE FROM users WHERE id = $1 AND class_id = $2 AND role = 'student'`, [req.params.sid, c.id]);
    if (!r.rowCount) throw new HttpError(404, 'not_found');
    res.status(204).end();
  }));

  api.get('/classes/:id/stats', requireUser('teacher', 'admin'), wrap(async (req, res) => {
    const c = await ownClass(req);
    const students = await db.query<{ id: string; name: string; stars: number; tasks: number; coins: number; levels: number; lastSeen: string | null }>(
      `SELECT u.id, u.name,
              COALESCE((SELECT sum(p.stars)::int FROM progress p WHERE p.student_id = u.id), 0) AS stars,
              COALESCE((SELECT count(*)::int FROM progress p WHERE p.student_id = u.id), 0) AS tasks,
              COALESCE((st.doc->>'coins')::int, 0) AS coins,
              COALESCE(jsonb_array_length(st.doc->'completedLevels'), 0) AS levels,
              u.last_seen_at AS "lastSeen"
         FROM users u LEFT JOIN student_state st ON st.student_id = u.id
        WHERE u.class_id = $1 ORDER BY lower(u.name)`,
      [c.id],
    );
    // "Bolalar qayerda qiynalyapti": o'rtacha xato ko'p topshiriqlar yuqorida.
    const tasks = await db.query(
      `SELECT p.task_id AS "taskId", count(*)::int AS players,
              round(avg(p.stars)::numeric, 2)::float AS "avgStars",
              round(avg(p.best_mistakes)::numeric, 2)::float AS "avgMistakes",
              round(avg(p.attempts)::numeric, 2)::float AS "avgAttempts",
              (percentile_cont(0.5) WITHIN GROUP (ORDER BY p.best_time_ms))::int AS "medianTimeMs"
         FROM progress p JOIN users u ON u.id = p.student_id
        WHERE u.class_id = $1 GROUP BY p.task_id ORDER BY "avgMistakes" DESC, "avgStars" ASC`,
      [c.id],
    );
    const total = students.rows.reduce((s, x) => s + x.stars, 0);
    const ranking =
      c.ranking_enabled && c.grade >= 9
        ? [...students.rows].sort((a, b) => b.stars - a.stars).map((s, i) => ({ rank: i + 1, name: s.name, stars: s.stars }))
        : null;
    res.json({
      class: { id: c.id, name: c.name, grade: c.grade, code: c.code, school: c.school, rankingEnabled: c.ranking_enabled },
      students: students.rows,
      tasks: tasks.rows,
      goal: { target: goal, stars: total },
      ranking,
    });
  }));

  // ---------- O'quvchi: sinf kodi bilan kirish ----------
  const findClass = async (code: string) => {
    const r = await db.query<{ id: number; name: string; grade: number; school: string }>(
      `SELECT c.id, c.name, c.grade, s.name AS school FROM classes c JOIN schools s ON s.id = c.school_id WHERE c.code = $1`,
      [normalizeCode(code)],
    );
    if (!r.rows[0]) throw new HttpError(404, 'class_not_found');
    return r.rows[0];
  };

  /** Kod bo'yicha sinf va undagi ismlar ro'yxati (bola o'z ismini tanlaydi — parol yo'q). */
  api.get('/join/:code', rateLimit('join-list', joinLimit, 60_000), wrap(async (req, res) => {
    const c = await findClass(String(req.params.code));
    const s = await db.query(`SELECT id, name FROM users WHERE class_id = $1 AND role = 'student' ORDER BY lower(name)`, [c.id]);
    res.json({ class: { name: c.name, grade: c.grade, school: c.school }, students: s.rows });
  }));

  api.post('/join', rateLimit('join', joinLimit, 60_000), wrap(async (req, res) => {
    const b = body(z.object({ code: z.string().min(4).max(12), name: Name.optional(), studentId: z.string().uuid().optional() }), req);
    const c = await findClass(b.code);
    let id: string;
    let name: string;
    if (b.studentId) {
      const r = await db.query<{ id: string; name: string }>(`SELECT id, name FROM users WHERE id = $1 AND class_id = $2`, [b.studentId, c.id]);
      if (!r.rows[0]) throw new HttpError(404, 'student_not_found');
      ({ id, name } = r.rows[0]);
    } else if (b.name) {
      try {
        const r = await db.query<{ id: string }>(`INSERT INTO users (role, name, class_id) VALUES ('student', $1, $2) RETURNING id`, [b.name, c.id]);
        id = r.rows[0]!.id;
        name = b.name;
      } catch (e) {
        if ((e as { code?: string }).code === '23505') throw new HttpError(409, 'name_taken');
        throw e;
      }
    } else throw new HttpError(400, 'invalid_input');
    res.json({ token: await issueSession(id), student: { id, name, grade: c.grade }, class: { name: c.name, school: c.school, grade: c.grade } });
  }));

  // ---------- O'quvchi: progress sinxronlash ----------
  const loadState = async (studentId: string): Promise<Progress | null> => {
    const r = await db.query<{ doc: unknown }>('SELECT doc FROM student_state WHERE student_id = $1', [studentId]);
    if (!r.rows[0]) return null;
    const p = ProgressSchema.safeParse(r.rows[0].doc);
    return p.success ? p.data : null;
  };

  const studentProfile = async (req: Request) => {
    const u = userOf(req);
    const r = await db.query<{ grade: number }>('SELECT grade FROM classes WHERE id = $1', [u.class_id]);
    return { name: u.name, grade: r.rows[0]!.grade };
  };

  api.get('/me/progress', requireUser('student'), wrap(async (req, res) => {
    const u = userOf(req);
    await db.query('UPDATE users SET last_seen_at = now() WHERE id = $1', [u.id]);
    const doc = (await loadState(u.id)) ?? initialProgress();
    res.json({ ...doc, profile: await studentProfile(req) });
  }));

  /** Mijoz holatini serverdagisi bilan birlashtiradi (hech narsa yo'qolmaydi) va natijani qaytaradi. */
  api.put('/me/progress', requireUser('student'), wrap(async (req, res) => {
    const u = userOf(req);
    const incoming = ProgressSchema.safeParse(req.body);
    if (!incoming.success) throw new HttpError(400, 'invalid_progress');
    const profile = await studentProfile(req);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      // bir o'quvchining parallel so'rovlari navbat bilan bajariladi
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [u.id]);
      const r = await client.query<{ doc: unknown }>('SELECT doc FROM student_state WHERE student_id = $1', [u.id]);
      const prev = r.rows[0] ? ProgressSchema.safeParse(r.rows[0].doc) : null;
      const merged: Progress = { ...mergeProgress(prev?.success ? prev.data : initialProgress(), incoming.data), profile };
      await client.query(
        `INSERT INTO student_state (student_id, doc, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (student_id) DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`,
        [u.id, JSON.stringify(merged)],
      );
      for (const [taskId, t] of Object.entries(merged.tasks)) {
        await client.query(
          `INSERT INTO progress (student_id, task_id, stars, attempts, best_mistakes, best_time_ms, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, now())
           ON CONFLICT (student_id, task_id) DO UPDATE SET stars = EXCLUDED.stars, attempts = EXCLUDED.attempts,
             best_mistakes = EXCLUDED.best_mistakes, best_time_ms = EXCLUDED.best_time_ms, updated_at = now()
           WHERE (progress.stars, progress.attempts, progress.best_mistakes) IS DISTINCT FROM (EXCLUDED.stars, EXCLUDED.attempts, EXCLUDED.best_mistakes)`,
          [u.id, taskId, t.stars, t.plays, t.bestMistakes, t.bestTimeMs ?? null],
        );
      }
      for (const [itemId, parts] of Object.entries(merged.inventory)) {
        for (const part of parts) {
          await client.query(`INSERT INTO inventory (student_id, item_id, part_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [u.id, itemId, part]);
        }
      }
      await client.query('UPDATE users SET last_seen_at = now() WHERE id = $1', [u.id]);
      await client.query('COMMIT');
      res.json(merged);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }));

  /** Sinfning jamoaviy maqsadi; reyting faqat 9-11 sinf va o'qituvchi yoqqan bo'lsa. */
  api.get('/me/class', requireUser('student'), wrap(async (req, res) => {
    const u = userOf(req);
    const c = await db.query<{ name: string; grade: number; ranking_enabled: boolean }>(
      'SELECT name, grade, ranking_enabled FROM classes WHERE id = $1',
      [u.class_id],
    );
    const s = await db.query<{ name: string; stars: number }>(
      `SELECT u.name, COALESCE(sum(p.stars), 0)::int AS stars FROM users u LEFT JOIN progress p ON p.student_id = u.id
        WHERE u.class_id = $1 GROUP BY u.id, u.name ORDER BY stars DESC, lower(u.name)`,
      [u.class_id],
    );
    const cls = c.rows[0]!;
    const total = s.rows.reduce((a, x) => a + x.stars, 0);
    res.json({
      class: { name: cls.name, grade: cls.grade },
      goal: { target: goal, stars: total },
      ranking: cls.ranking_enabled && cls.grade >= 9 ? s.rows.map((x, i) => ({ rank: i + 1, ...x })) : null,
    });
  }));

  app.use('/api', api);
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'not_found')));

  if (opts.staticDir && existsSync(opts.staticDir)) {
    app.use(express.static(opts.staticDir, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => res.sendFile(join(opts.staticDir!, 'index.html')));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.code });
      return;
    }
    if ((err as { type?: string }).type === 'entity.parse.failed') {
      res.status(400).json({ error: 'invalid_json' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'internal' });
  });

  return app;
}
