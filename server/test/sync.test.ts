import 'fake-indexeddb/auto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { freshDb } from './helpers';
import type { Db } from '../src/db';
import { ApiClient } from '../../src/net/api';
import { SyncEngine, type SyncStatus } from '../../src/net/sync';
import { indexedKV, memoryKV } from '../../src/net/kv';
import { initialProgress, recordTask, setProfile, type Progress } from '../../src/engine/progress';
import { loadContentForNode } from './content';

let db: Db;
let drop: () => Promise<void>;
let server: Server;
let base: string;
let code: string;
const c = loadContentForNode();
const village = c.levels.find((l) => l.id === 'ona-qishloq')!;
const task = (id: string) => c.tasks.find((t) => t.id === id)!;

/** Internetni "uzib-ulash" mumkin bo'lgan fetch. */
function flakyFetch() {
  const state = { online: true, calls: 0 };
  const f: typeof fetch = async (...args) => {
    state.calls++;
    if (!state.online) throw new TypeError('Failed to fetch');
    return fetch(...args);
  };
  return { f, state };
}

beforeAll(async () => {
  ({ db, drop } = await freshDb());
  const app = createApp({ db, limits: { auth: 1000, join: 1000 } });
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const api = new ApiClient(base);
  const t = await api.teacherRegister({ name: 'Ustoz', email: 'sync@maktab.uz', password: 'kuchli-parol-1' });
  api.token = t.token;
  code = (await api.createClass({ name: '3-A', grade: 3, school: '1-maktab' })).code;
});
afterAll(async () => {
  server.close();
  await drop();
});

async function student(name: string, fetchImpl?: typeof fetch) {
  const api = new ApiClient(base, null, fetchImpl);
  const j = await api.join({ code, name });
  api.token = j.token;
  return { api, id: j.student.id };
}

const waitUntil = async (cond: () => boolean | Promise<boolean>, ms = 5000) => {
  const end = Date.now() + ms;
  while (!(await cond())) {
    if (Date.now() > end) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
};

describe('offline → online sinxronlash', () => {
  it('progress made offline is queued in IndexedDB and reaches the server when back online', async () => {
    const { f, state } = flakyFetch();
    const { api } = await student('Aziza', f);
    let local: Progress = setProfile(initialProgress(), { name: 'Aziza', grade: 3 });
    const statuses: SyncStatus[] = [];
    const engine = new SyncEngine(api, indexedKV('t1'), (m) => (local = m), { minBackoffMs: 20, maxBackoffMs: 80 });
    engine.subscribe((s) => statuses.push(s));

    state.online = false; // maktabda internet uzildi
    local = recordTask(local, task('ona-qishloq-01'), village, 3, 0).progress;
    await engine.push(local);
    local = recordTask(local, task('ona-qishloq-02'), village, 2, 1).progress;
    await engine.push(local);
    expect(engine.status).toBe('offline');
    expect(await engine.hasPending()).toBe(true);
    const before = state.calls;
    await new Promise((r) => setTimeout(r, 150));
    expect(state.calls).toBeGreaterThan(before); // qayta urinib turibdi

    state.online = true; // internet qaytdi
    // brauzerda 'online' hodisasi darhol qayta urintiradi; node'da — kutish taymeri
    await waitUntil(() => engine.status === 'synced');
    expect(await engine.hasPending()).toBe(false);
    const row = await db.query(`SELECT task_id, stars FROM progress p JOIN users u ON u.id = p.student_id WHERE u.name = 'Aziza' ORDER BY task_id`);
    expect(row.rows).toEqual([{ task_id: 'ona-qishloq-01', stars: 3 }, { task_id: 'ona-qishloq-02', stars: 2 }]);
    expect(statuses).toEqual(expect.arrayContaining(['offline', 'syncing', 'synced']));
    engine.stop();
  });

  it('queue survives an app restart (closed tab) while offline', async () => {
    const { f, state } = flakyFetch();
    const { api } = await student('Bobur', f);
    state.online = false;
    const kvName = 't2';
    const e1 = new SyncEngine(api, indexedKV(kvName), () => {}, { minBackoffMs: 10_000 });
    const p = recordTask(setProfile(initialProgress(), { name: 'Bobur', grade: 3 }), task('ona-qishloq-03'), village, 1, 5).progress;
    await e1.push(p);
    e1.stop(); // brauzer yopildi

    state.online = true;
    let local = setProfile(initialProgress(), { name: 'Bobur', grade: 3 }); // yangi sessiya: mahalliy bo'sh
    const e2 = new SyncEngine(api, indexedKV(kvName), (m) => (local = m), { minBackoffMs: 20 });
    local = await e2.pull(local);
    await waitUntil(() => e2.status === 'synced');
    expect(local.tasks['ona-qishloq-03']!.stars).toBe(1);
    expect((await api.getProgress()).tasks['ona-qishloq-03']).toBeDefined();
    e2.stop();
  });

  it('two devices: school computer and home phone end up with the union', async () => {
    const { api, id } = await student('Charos');
    const phoneApi = new ApiClient(base);
    phoneApi.token = (await phoneApi.join({ code, studentId: id })).token;

    let school = setProfile(initialProgress(), { name: 'Charos', grade: 3 });
    let phone = school;
    const eSchool = new SyncEngine(api, memoryKV(), (m) => (school = m), { minBackoffMs: 20 });
    const ePhone = new SyncEngine(phoneApi, memoryKV(), (m) => (phone = m), { minBackoffMs: 20 });

    school = recordTask(school, task('ona-qishloq-01'), village, 3, 0).progress;
    await eSchool.push(school);
    phone = recordTask(phone, task('ona-qishloq-02'), village, 3, 0).progress;
    phone = recordTask(phone, task('ona-qishloq-01'), village, 1, 7).progress; // uyda yomonroq o'ynadi
    await ePhone.push(phone);
    school = await eSchool.pull(school);

    for (const p of [school, phone]) {
      expect(p.tasks['ona-qishloq-01']!.stars).toBe(3); // eng yaxshi natija saqlandi
      expect(p.tasks['ona-qishloq-02']!.stars).toBe(3);
      expect(p.inventory.kalit!.sort()).toEqual(['dasta', 'tishlar']);
    }
    eSchool.stop();
    ePhone.stop();
  });

  it('a revoked session reports auth-error instead of retrying forever', async () => {
    const { api, id } = await student('Dono');
    await db.query('DELETE FROM sessions WHERE user_id = $1', [id]);
    const e = new SyncEngine(api, memoryKV(), () => {}, { minBackoffMs: 20 });
    await e.push(setProfile(initialProgress(), { name: 'Dono', grade: 3 }));
    expect(e.status).toBe('auth-error');
    expect(await e.hasPending()).toBe(true); // ma'lumot yo'qolmaydi — qayta kirgandan keyin yuboriladi
    e.stop();
  });
});
