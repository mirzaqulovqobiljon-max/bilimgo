import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { migrate, type Db } from '../src/db';
import { freshDb } from './helpers';
import { initialProgress, type Progress } from '../../src/engine/progress';

let db: Db;
let drop: () => Promise<void>;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  ({ db, drop } = await freshDb());
  app = createApp({ db, teacherInvite: 'MAKTAB-2026', classGoalStars: 20, limits: { auth: 1000, join: 1000 } });
});
afterAll(async () => drop());

const teacher = async (email = 'malika@maktab.uz') => {
  const r = await request(app)
    .post('/api/teachers/register')
    .send({ name: 'Malika opa', email, password: 'kuchli-parol-1', invite: 'MAKTAB-2026' });
  expect(r.status).toBe(201);
  return r.body.token as string;
};
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const progressWith = (tasks: Progress['tasks'], extra: Partial<Progress> = {}): Progress => ({
  ...initialProgress(),
  profile: { name: 'ignored', grade: 1 },
  tasks,
  coins: Object.keys(tasks).length * 10,
  ...extra,
});

describe('health & migrations', () => {
  it('health check works, migrations are idempotent', async () => {
    expect((await request(app).get('/api/health')).body).toEqual({ ok: true });
    expect(await migrate(db)).toEqual([]);
  });

  it('schema refuses personal data columns and public ranking for grades 1-8', async () => {
    const cols = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`);
    const names = cols.rows.map((r) => r.column_name);
    expect(names).not.toEqual(expect.arrayContaining(['phone']));
    expect(names.some((n: string) => /phone|address|surname|birth/.test(n))).toBe(false);
  });
});

describe("o'qituvchi", () => {
  it('needs the invite code, unique email, strong-enough password', async () => {
    expect((await request(app).post('/api/teachers/register').send({ name: 'X', email: 'x@y.uz', password: 'kuchli-parol-1' })).status).toBe(403);
    expect((await request(app).post('/api/teachers/register').send({ name: 'X', email: 'x@y.uz', password: 'qisqa', invite: 'MAKTAB-2026' })).status).toBe(400);
    await teacher('dup@maktab.uz');
    const again = await request(app).post('/api/teachers/register').send({ name: 'X', email: 'DUP@maktab.uz', password: 'kuchli-parol-1', invite: 'MAKTAB-2026' });
    expect(again.status).toBe(409);
  });

  it('logs in with the right password only; password is not stored in plain text', async () => {
    await teacher('login@maktab.uz');
    expect((await request(app).post('/api/teachers/login').send({ email: 'login@maktab.uz', password: 'notogri-parol' })).status).toBe(401);
    const ok = await request(app).post('/api/teachers/login').send({ email: 'LOGIN@maktab.uz', password: 'kuchli-parol-1' });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toMatch(/^[\w-]{40,}$/);
    const row = await db.query(`SELECT password_hash FROM users WHERE email = 'login@maktab.uz'`);
    expect(row.rows[0].password_hash).toMatch(/^scrypt\$/);
    expect(row.rows[0].password_hash).not.toContain('kuchli-parol-1');
  });

  it('creates classes with a readable 6-char code and sees only own classes', async () => {
    const a = await teacher('a@maktab.uz');
    const b = await teacher('b@maktab.uz');
    const c = await request(app).post('/api/classes').set(auth(a)).send({ name: '3-A', grade: 3, school: '15-maktab' });
    expect(c.status).toBe(201);
    expect(c.body.code).toMatch(/^[A-HJ-KM-NP-Z2-9]{6}$/);
    expect((await request(app).get('/api/classes').set(auth(a))).body.map((x: { name: string }) => x.name)).toEqual(['3-A']);
    expect((await request(app).get('/api/classes').set(auth(b))).body).toEqual([]);
    expect((await request(app).get(`/api/classes/${c.body.id}/stats`).set(auth(b))).status).toBe(404);
    expect((await request(app).get('/api/classes')).status).toBe(401);
    expect((await request(app).get('/api/classes').set(auth('soxta-token'))).status).toBe(401);
  });

  it('ranking can be enabled only for grades 9-11', async () => {
    const t = await teacher('rank@maktab.uz');
    const small = await request(app).post('/api/classes').set(auth(t)).send({ name: '6-B', grade: 6, school: '15-maktab' });
    const big = await request(app).post('/api/classes').set(auth(t)).send({ name: '10-A', grade: 10, school: '15-maktab' });
    const bad = await request(app).patch(`/api/classes/${small.body.id}`).set(auth(t)).send({ rankingEnabled: true });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('ranking_not_allowed_for_grade');
    expect((await request(app).patch(`/api/classes/${big.body.id}`).set(auth(t)).send({ rankingEnabled: true })).status).toBe(200);
  });
});

describe("o'quvchi: sinf kodi bilan kirish va progress", () => {
  let t: string;
  let classId: number;
  let code: string;

  beforeAll(async () => {
    t = await teacher('sinf@maktab.uz');
    const c = await request(app).post('/api/classes').set(auth(t)).send({ name: '2-V', grade: 2, school: '7-maktab' });
    classId = c.body.id;
    code = c.body.code;
  });

  it('joins with only a class code and a first name', async () => {
    const r = await request(app).post('/api/join').send({ code: code.toLowerCase(), name: 'Aziza' });
    expect(r.status).toBe(200);
    expect(r.body.student).toMatchObject({ name: 'Aziza', grade: 2 });
    expect(r.body.class).toEqual({ name: '2-V', school: '7-maktab', grade: 2 });
    const list = await request(app).get(`/api/join/${code}`);
    expect(list.body.students.map((s: { name: string }) => s.name)).toEqual(['Aziza']);
    expect(Object.keys(list.body.students[0]).sort()).toEqual(['id', 'name']);
  });

  it('wrong code, duplicate name, bad name are rejected', async () => {
    expect((await request(app).post('/api/join').send({ code: 'ZZZZZZ', name: 'Ali' })).status).toBe(404);
    expect((await request(app).post('/api/join').send({ code, name: 'aziza' })).status).toBe(409);
    expect((await request(app).post('/api/join').send({ code, name: '<script>' })).status).toBe(400);
    expect((await request(app).post('/api/join').send({ code, name: 'x'.repeat(31) })).status).toBe(400);
  });

  it('picks own name on another device and gets the same progress', async () => {
    const first = await request(app).post('/api/join').send({ code, name: 'Bekzod' });
    const tok1 = first.body.token as string;
    const doc = progressWith({ 'ona-qishloq-01': { stars: 2, plays: 1, bestMistakes: 1 } }, { inventory: { kalit: ['dasta'] } });
    expect((await request(app).put('/api/me/progress').set(auth(tok1)).send(doc)).status).toBe(200);
    const second = await request(app).post('/api/join').send({ code, studentId: first.body.student.id });
    const got = await request(app).get('/api/me/progress').set(auth(second.body.token));
    expect(got.body.tasks['ona-qishloq-01'].stars).toBe(2);
    expect(got.body.inventory.kalit).toEqual(['dasta']);
    expect(got.body.profile).toEqual({ name: 'Bekzod', grade: 2 }); // ism va sinf serverdan
  });

  it('merges offline progress: nothing is ever taken away', async () => {
    const j = await request(app).post('/api/join').send({ code, name: 'Dilshod' });
    const tok = j.body.token as string;
    const school = progressWith({ 'ona-qishloq-01': { stars: 3, plays: 2, bestMistakes: 0 } }, { inventory: { kalit: ['dasta'] } });
    await request(app).put('/api/me/progress').set(auth(tok)).send(school);
    // eski telefon, offline: kamroq yulduz, boshqa qism
    const phone = progressWith({ 'ona-qishloq-01': { stars: 1, plays: 1, bestMistakes: 4 }, 'ona-qishloq-02': { stars: 2, plays: 1, bestMistakes: 1 } }, { inventory: { kalit: ['tishlar'] } });
    const merged = await request(app).put('/api/me/progress').set(auth(tok)).send(phone);
    expect(merged.body.tasks['ona-qishloq-01']).toMatchObject({ stars: 3, plays: 2, bestMistakes: 0 });
    expect(merged.body.tasks['ona-qishloq-02'].stars).toBe(2);
    expect(merged.body.inventory.kalit).toEqual(['dasta', 'tishlar']);
    // takroriy yuborish (offline navbat) natijani o'zgartirmaydi
    const again = await request(app).put('/api/me/progress').set(auth(tok)).send(phone);
    expect(again.body).toEqual(merged.body);
  });

  it('parallel uploads from two devices do not lose data', async () => {
    const j = await request(app).post('/api/join').send({ code, name: 'Ergash' });
    const tok = j.body.token as string;
    const docs = Array.from({ length: 8 }, (_, i) => progressWith({ [`ona-qishloq-0${(i % 5) + 1}`]: { stars: ((i % 3) + 1) as 1 | 2 | 3, plays: 1, bestMistakes: i } }));
    await Promise.all(docs.map((d) => request(app).put('/api/me/progress').set(auth(tok)).send(d)));
    const got = await request(app).get('/api/me/progress').set(auth(tok));
    expect(Object.keys(got.body.tasks).sort()).toEqual(['ona-qishloq-01', 'ona-qishloq-02', 'ona-qishloq-03', 'ona-qishloq-04', 'ona-qishloq-05']);
  });

  it('rejects malformed progress and teacher tokens on student routes', async () => {
    const j = await request(app).post('/api/join').send({ code, name: 'Feruza' });
    expect((await request(app).put('/api/me/progress').set(auth(j.body.token)).send({ coins: -5 })).status).toBe(400);
    expect((await request(app).put('/api/me/progress').set(auth(j.body.token)).set('Content-Type', 'application/json').send('{bad')).status).toBe(400);
    expect((await request(app).get('/api/me/progress').set(auth(t))).status).toBe(403);
  });

  it('teacher stats: students, hardest tasks first, class goal, no ranking for grade 2', async () => {
    const s = await request(app).get(`/api/classes/${classId}/stats`).set(auth(t));
    expect(s.status).toBe(200);
    expect(s.body.class).toMatchObject({ name: '2-V', grade: 2, code });
    const names = s.body.students.map((x: { name: string }) => x.name);
    expect(names).toEqual(expect.arrayContaining(['Aziza', 'Bekzod', 'Dilshod']));
    const dil = s.body.students.find((x: { name: string }) => x.name === 'Dilshod');
    expect(dil).toMatchObject({ stars: 5, tasks: 2 });
    expect(s.body.goal.target).toBe(20);
    expect(s.body.goal.stars).toBeGreaterThanOrEqual(7);
    const mistakes = s.body.tasks.map((x: { avgMistakes: number }) => x.avgMistakes);
    expect(mistakes).toEqual([...mistakes].sort((a, b) => b - a));
    expect(s.body.ranking).toBeNull();
    const me = await request(app).post('/api/join').send({ code, studentId: dil.id });
    const mine = await request(app).get('/api/me/class').set(auth(me.body.token));
    expect(mine.body.ranking).toBeNull();
    expect(mine.body.goal.target).toBe(20);
  });

  it('teacher can rotate the code and delete a student (and all their data)', async () => {
    const j = await request(app).post('/api/join').send({ code, name: "G'ayrat" });
    await request(app).put('/api/me/progress').set(auth(j.body.token)).send(progressWith({ 'ona-qishloq-01': { stars: 3, plays: 1, bestMistakes: 0 } }));
    const del = await request(app).delete(`/api/classes/${classId}/students/${j.body.student.id}`).set(auth(t));
    expect(del.status).toBe(204);
    const left = await db.query('SELECT count(*)::int AS n FROM progress WHERE student_id = $1', [j.body.student.id]);
    expect(left.rows[0].n).toBe(0);
    expect((await request(app).get('/api/me/progress').set(auth(j.body.token))).status).toBe(401);
    const rot = await request(app).post(`/api/classes/${classId}/rotate-code`).set(auth(t));
    expect(rot.body.code).not.toBe(code);
    expect((await request(app).get(`/api/join/${code}`)).status).toBe(404);
    code = rot.body.code;
  });
});

describe('olim sinfi reytingi', () => {
  it('appears only when the teacher enables it', async () => {
    const t = await teacher('olim@maktab.uz');
    const c = await request(app).post('/api/classes').set(auth(t)).send({ name: '11-A', grade: 11, school: 'Lisey' });
    const a = await request(app).post('/api/join').send({ code: c.body.code, name: 'Nodira' });
    const b = await request(app).post('/api/join').send({ code: c.body.code, name: 'Otabek' });
    await request(app).put('/api/me/progress').set(auth(b.body.token)).send(progressWith({ 'ona-qishloq-01': { stars: 3, plays: 1, bestMistakes: 0 } }));
    expect((await request(app).get('/api/me/class').set(auth(a.body.token))).body.ranking).toBeNull();
    await request(app).patch(`/api/classes/${c.body.id}`).set(auth(t)).send({ rankingEnabled: true });
    const r = await request(app).get('/api/me/class').set(auth(a.body.token));
    expect(r.body.ranking.map((x: { name: string }) => x.name)).toEqual(['Otabek', 'Nodira']);
  });
});

describe('logout and rate limit', () => {
  it('logout invalidates the token', async () => {
    const t = await teacher('out@maktab.uz');
    expect((await request(app).post('/api/logout').set(auth(t))).status).toBe(204);
    expect((await request(app).get('/api/classes').set(auth(t))).status).toBe(401);
  });

  it('guessing class codes (different codes!) is slowed down', async () => {
    const strict = createApp({ db, limits: { auth: 3, join: 5 } });
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) statuses.push((await request(strict).get(`/api/join/AAAA${i}`)).status);
    expect(statuses.slice(0, 5)).toEqual([404, 404, 404, 404, 404]);
    expect(statuses.slice(5)).toEqual([429, 429, 429]);
    const logins: number[] = [];
    for (let i = 0; i < 5; i++) logins.push((await request(strict).post('/api/teachers/login').send({ email: `x${i}@y.uz`, password: 'p' })).status);
    expect(logins).toEqual([401, 401, 401, 429, 429]);
  });
});
