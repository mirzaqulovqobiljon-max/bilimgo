// Real browser + real server + real PostgreSQL:
// teacher creates a class -> student joins on a phone -> plays OFFLINE -> back online -> teacher sees stats.
// Usage: npm run build && DATABASE_URL=postgres://ipak:ipak@localhost:5432/ipak_e2e node e2e/backend.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import pg from '../server/node_modules/pg/lib/index.js';
import { chromium } from 'playwright-core';

const DB = process.env.DATABASE_URL ?? 'postgres://ipak:ipak@localhost:5432/ipak_e2e';
const PORT = 8091;
const BASE = `http://localhost:${PORT}`;
const SHOTS = new URL('./screens-backend/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

// fresh database
{
  const u = new URL(DB);
  const name = u.pathname.slice(1);
  u.pathname = '/postgres';
  const c = new pg.Client({ connectionString: u.toString() });
  await c.connect();
  await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await c.query(`CREATE DATABASE ${name}`);
  await c.end();
}

const serverDir = new URL('../server/', import.meta.url).pathname;
const srv = spawn('node', ['--import', 'tsx', 'src/main.ts'], {
  cwd: serverDir,
  env: { ...process.env, DATABASE_URL: DB, PORT: String(PORT), TEACHER_INVITE: 'MAKTAB-2026' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let srvLog = '';
srv.stdout.on('data', (d) => (srvLog += d));
srv.stderr.on('data', (d) => (srvLog += d));
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('server did not start\n' + srvLog)), 20000);
  const iv = setInterval(async () => {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) {
        clearInterval(iv);
        clearTimeout(t);
        res();
      }
    } catch {}
  }, 200);
});

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const errors = [];
const ok = (m) => console.log(`  ✓ ${m}`);
let n = 0;
try {
  // ---------- O'qituvchi (kompyuter) ----------
  const tctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const tp = await tctx.newPage();
  tp.setDefaultTimeout(10000);
  tp.on('pageerror', (e) => errors.push('teacher: ' + e));
  await tp.goto(`${BASE}/#oqituvchi`);
  await tp.getByRole('button', { name: /Ro'yxatdan o'tish/ }).click();
  await tp.getByLabel('Ism-sharifingiz').fill('Malika Karimova');
  await tp.getByLabel('Email').fill('malika@maktab.uz');
  await tp.getByLabel('Parol').fill('kuchli-parol-1');
  await tp.getByLabel(/Taklif kodi/).fill('MAKTAB-2026');
  await tp.getByRole('button', { name: "Ro'yxatdan o'tish" }).click();
  await tp.getByLabel('Sinf nomi').fill('3-A');
  await tp.getByLabel('Sinf (1-11)').selectOption('3');
  await tp.getByLabel('Maktab').fill('15-maktab, Chilonzor');
  await tp.getByRole('button', { name: 'Sinf yaratish' }).click();
  const classBtn = tp.getByText(/3-A — kod: /);
  await classBtn.waitFor();
  const code = (await classBtn.textContent()).match(/kod: (\w{6})/)[1];
  ok(`teacher registered and created class 3-A, code ${code}`);
  await tp.screenshot({ path: `${SHOTS}${++n}-teacher-classes.png` });

  // ---------- O'quvchi (telefon) ----------
  const sctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const sp = await sctx.newPage();
  sp.setDefaultTimeout(10000);
  sp.on('pageerror', (e) => errors.push('student: ' + e));
  sp.on('console', (m) => m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text()) && errors.push('student console: ' + m.text()));
  await sp.goto(BASE);
  await sp.getByRole('button', { name: /Sinf kodi bilan kirish/ }).click();
  await sp.getByLabel('Sinf kodi').fill(code.toLowerCase());
  await sp.getByRole('button', { name: 'Davom etish' }).click();
  await sp.getByRole('button', { name: /Men yangiman/ }).click();
  await sp.getByLabel('Isming').fill('Aziza');
  await sp.screenshot({ path: `${SHOTS}${++n}-student-join.png` });
  await sp.getByRole('button', { name: 'Sayohatni boshlash' }).click();
  await sp.getByText('Kichik sayyoh · 3-A').waitFor();
  await sp.getByRole('status', { name: 'Natijalar saqlandi' }).waitFor();
  ok('student joined with class code + first name only');

  // ---------- Internet uzildi ----------
  await sctx.setOffline(true);
  await sp.locator('nav[aria-label="Bosqichlar"]').getByRole('button', { name: /Ona qishloq — ochiq/ }).press('Enter');
  const answers = { 'Harflardan so\'z': ['KALIT', 'OT', 'UY'], Topishmoqlar: ['Tuxum', 'Oy', 'Kitob'] };
  for (const title of ["Harflardan so'z", 'Qishloq darvozasi rasmi', 'Topishmoqlar']) {
    await sp.getByRole('button', { name: new RegExp(title) }).click();
    if (answers[title]) for (const a of answers[title]) await sp.getByRole('button', { name: a, exact: true }).click();
    else
      for (;;) {
        const b = await sp.$$eval('[data-cell]', (els) => els.map((e) => [e.dataset.cell, e.dataset.piece]));
        const w = b.find(([c, p]) => c !== p);
        if (!w) break;
        await sp.locator(`[data-cell="${w[0]}"]`).click();
        await sp.locator(`[data-cell="${b.find(([, p]) => p === w[0])[0]}"]`).click();
      }
    await sp.locator('.result').waitFor();
    const go = sp.getByRole('button', { name: "To'siqni yengamiz!" });
    if (await go.count()) await go.click();
    else await sp.getByRole('button', { name: 'Davom etamiz' }).click();
  }
  await sp.getByRole('button', { name: 'Kalitni olish' }).click();
  await sp.locator('.obstacle-target').click();
  await sp.getByText("Ona qishloq — o'tildi!").waitFor();
  await sp.getByRole('status', { name: /Internet yo'q/ }).waitFor();
  await sp.screenshot({ path: `${SHOTS}${++n}-student-offline.png` });
  const before = await (await fetch(`${BASE}/api/health`)).json();
  if (!before.ok) throw new Error('server down?');
  {
    const c = new pg.Client({ connectionString: DB });
    await c.connect();
    const r = await c.query('SELECT count(*)::int AS n FROM progress');
    await c.end();
    if (r.rows[0].n !== 0) throw new Error('progress reached server while offline?!');
  }
  ok('played level 1 fully OFFLINE: status shows offline, nothing on server yet');

  // ---------- Internet qaytdi ----------
  await sctx.setOffline(false);
  await sp.getByRole('status', { name: 'Natijalar saqlandi' }).waitFor({ timeout: 20000 });
  ok('back online: queue flushed automatically');

  // reload on the phone: progress persists (server + local)
  await sp.reload();
  await sp.getByText('Kichik sayyoh · 3-A').waitFor();
  await sp.getByLabel(/Jami tanga: 30/).waitFor();

  // ---------- O'qituvchi statistikasi ----------
  await tp.reload();
  await tp.getByText(/3-A — kod: /).click();
  await tp.getByRole('heading', { name: /O'quvchilar \(1\)/ }).waitFor();
  const row = await tp.locator('.t-table tbody tr', { hasText: 'Aziza' }).first().innerText();
  if (!/Aziza\s+\d+\s+3\s+1\/7/.test(row)) throw new Error(`unexpected stats row: ${row}`);
  await tp.getByText('Topishmoqlar').first().waitFor();
  await tp.screenshot({ path: `${SHOTS}${++n}-teacher-stats.png`, fullPage: true });
  ok(`teacher sees Aziza: ${row.replace(/\s+/g, ' ')}`);

  // ---------- Boshqa qurilmada o'z ismini tanlash ----------
  const s2 = await (await browser.newContext({ viewport: { width: 360, height: 740 } })).newPage();
  await s2.goto(BASE);
  await s2.getByRole('button', { name: /Sinf kodi bilan kirish/ }).click();
  await s2.getByLabel('Sinf kodi').fill(code);
  await s2.getByRole('button', { name: 'Davom etish' }).click();
  await s2.getByRole('button', { name: 'Aziza' }).click();
  await s2.getByLabel(/Jami tanga: 30/).waitFor();
  ok('second device: picked own name, got the same progress');

  if (errors.length) throw new Error('errors:\n' + errors.join('\n'));
  console.log('\nBACKEND E2E PASSED');
} catch (e) {
  console.error('\nBACKEND E2E FAILED:', e, '\n--- server log ---\n' + srvLog.slice(-2000));
  process.exitCode = 1;
} finally {
  await browser.close();
  srv.kill();
}
