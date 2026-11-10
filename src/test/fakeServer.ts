/**
 * Xotiradagi soxta server (UI testlari uchun). Haqiqiy server API testlari server/test'da —
 * bu yerda faqat UI to'g'ri chaqiruvlar qilishini tekshiramiz.
 */
import { mergeProgress } from '../engine/merge';
import { initialProgress, type Progress } from '../engine/progress';
import { ApiClient } from '../net/api';

export interface FakeServer {
  api: ApiClient;
  online: boolean;
  docs: Map<string, Progress>;
  classes: { id: number; name: string; grade: number; school: string; code: string; rankingEnabled: boolean }[];
  students: { id: string; name: string; classCode: string }[];
  calls: string[];
}

export function fakeServer(): FakeServer {
  const s: FakeServer = {
    api: null as unknown as ApiClient,
    online: true,
    docs: new Map(),
    classes: [{ id: 1, name: '3-A', grade: 3, school: '15-maktab', code: 'K7P3QA', rankingEnabled: false }],
    students: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Aziza', classCode: 'K7P3QA' }],
    calls: [],
  };
  const tokens = new Map<string, string>(); // token -> student id / 'teacher'
  const json = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  const f: typeof fetch = async (input, init) => {
    const url = new URL(String(input), 'http://x');
    const path = url.pathname.replace(/^\/api/, '');
    const method = init?.method ?? 'GET';
    s.calls.push(`${method} ${path}`);
    if (!s.online) throw new TypeError('Failed to fetch');
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const auth = (init?.headers as Record<string, string> | undefined)?.Authorization?.slice(7);
    const who = auth ? tokens.get(auth) : undefined;
    const issue = (id: string) => {
      const t = `tok-${id}-${tokens.size}-xxxxxxxxxx`;
      tokens.set(t, id);
      return t;
    };

    if (path === '/health') return json(200, { ok: true });
    const joinInfo = path.match(/^\/join\/(\w+)$/);
    if (joinInfo && method === 'GET') {
      const c = s.classes.find((x) => x.code === joinInfo[1]!.toUpperCase());
      if (!c) return json(404, { error: 'class_not_found' });
      return json(200, { class: { name: c.name, grade: c.grade, school: c.school }, students: s.students.filter((x) => x.classCode === c.code).map(({ id, name }) => ({ id, name })) });
    }
    if (path === '/join' && method === 'POST') {
      const c = s.classes.find((x) => x.code === String(body.code).toUpperCase());
      if (!c) return json(404, { error: 'class_not_found' });
      let st = s.students.find((x) => x.id === body.studentId);
      if (!st) {
        if (s.students.some((x) => x.classCode === c.code && x.name.toLowerCase() === String(body.name).toLowerCase())) return json(409, { error: 'name_taken' });
        st = { id: `2222222${s.students.length}-2222-4222-8222-222222222222`, name: body.name, classCode: c.code };
        s.students.push(st);
      }
      return json(200, { token: issue(st.id), student: { id: st.id, name: st.name, grade: c.grade }, class: { name: c.name, school: c.school, grade: c.grade } });
    }
    if (path === '/me/progress') {
      if (!who || who === 'teacher') return json(401, { error: 'unauthorized' });
      const st = s.students.find((x) => x.id === who)!;
      const c = s.classes.find((x) => x.code === st.classCode)!;
      const profile = { name: st.name, grade: c.grade };
      if (method === 'GET') return json(200, { ...(s.docs.get(who) ?? initialProgress()), profile });
      const merged = { ...mergeProgress(s.docs.get(who) ?? initialProgress(), body), profile };
      s.docs.set(who, merged);
      return json(200, merged);
    }
    if (path === '/me/class') {
      const total = [...s.docs.values()].reduce((a, d) => a + Object.values(d.tasks).reduce((x, t) => x + t.stars, 0), 0);
      return json(200, { class: { name: '3-A', grade: 3 }, goal: { target: 500, stars: total }, ranking: null });
    }
    if (path === '/teachers/login') {
      if (body.password !== 'kuchli-parol-1') return json(401, { error: 'bad_credentials' });
      return json(200, { token: issue('teacher'), name: 'Malika' });
    }
    if (who !== 'teacher') return json(401, { error: 'unauthorized' });
    if (path === '/classes' && method === 'GET') return json(200, s.classes.map((c) => ({ ...c, students: s.students.filter((x) => x.classCode === c.code).length })));
    if (path === '/classes' && method === 'POST') {
      const c = { id: s.classes.length + 1, name: body.name, grade: body.grade, school: body.school, code: 'NEWC0D'.replace('0', 'Q'), rankingEnabled: false };
      s.classes.push(c);
      return json(201, { ...c, students: 0 });
    }
    const stats = path.match(/^\/classes\/(\d+)\/stats$/);
    if (stats) {
      const c = s.classes.find((x) => x.id === Number(stats[1]))!;
      const students = s.students
        .filter((x) => x.classCode === c.code)
        .map((x) => ({ id: x.id, name: x.name, stars: Object.values(s.docs.get(x.id)?.tasks ?? {}).reduce((a, t) => a + t.stars, 0), tasks: Object.keys(s.docs.get(x.id)?.tasks ?? {}).length, coins: 0, levels: 0, lastSeen: null }));
      return json(200, {
        class: { ...c, students: students.length },
        students,
        tasks: [{ taskId: 'daryo-01', players: 2, avgStars: 1.5, avgMistakes: 3.5, avgAttempts: 2, medianTimeMs: 90000 }],
        goal: { target: 500, stars: students.reduce((a, x) => a + x.stars, 0) },
        ranking: null,
      });
    }
    const del = path.match(/^\/classes\/(\d+)\/students\/(.+)$/);
    if (del && method === 'DELETE') {
      s.students = s.students.filter((x) => x.id !== del[2]);
      return json(204);
    }
    return json(404, { error: 'not_found' });
  };
  s.api = new ApiClient('/api', null, f);
  return s;
}
