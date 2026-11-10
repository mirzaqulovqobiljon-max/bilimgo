// Real Chrome: plays the WHOLE adventure (7 levels) on a 360x740 phone viewport.
// Usage: npm run build && node e2e/full.mjs [grade]
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const grade = Number(process.argv[2] ?? 2);
const root = new URL('../src/content/', import.meta.url).pathname;
const levels = JSON.parse(readFileSync(root + 'levels.json', 'utf8')).sort((a, b) => a.order - b.order);
const tasks = readdirSync(root + 'tasks').flatMap((f) => JSON.parse(readFileSync(root + 'tasks/' + f, 'utf8')));
const questions = [
  ...tasks.flatMap((t) => Object.values(t.tiers).flatMap((v) => v.questions ?? [])),
  ...levels.flatMap((l) => (l.obstacle.battle ? Object.values(l.obstacle.battle).flatMap((b) => b.questions) : [])),
];
const words = tasks.flatMap((t) => Object.values(t.tiers).flatMap((v) => v.words ?? []));

const SHOTS = new URL(`./screens-full-${grade}/`, import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const PORT = 4174;
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'silent' });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const errors = [];
const shotted = new Set();
let n = 0;
try {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  const shotOnce = async (key) => {
    if (shotted.has(key)) return;
    shotted.add(key);
    await page.screenshot({ path: `${SHOTS}${String(++n).padStart(2, '0')}-${key}.png` });
  };
  const has = (sel) => page.locator(sel).count().then((c) => c > 0);

  await page.goto(`http://localhost:${PORT}/`);
  await page.getByLabel('Isming').fill('Aziza');
  await page.getByRole('button', { name: new RegExp(`^${grade}$`) }).click();
  await page.getByRole('button', { name: 'Sayohatni boshlash' }).click();
  await page.locator('.map-canvas canvas').waitFor();

  for (const level of levels) {
    await page.locator('nav[aria-label="Bosqichlar"]').getByRole('button', { name: new RegExp(`\\. ${level.title} — ochiq`) }).press('Enter'); // klaviatura/ekran o'quvchi yo'li
    await page.locator('.hub').waitFor();
    if (level.order === 6) await shotOnce('hub-6parts');
    for (;;) {
      const cards = page.locator('.task-card:not(.done)');
      if ((await cards.count()) === 0) break;
      const bonus = cards.filter({ hasText: "qo'shimcha sinov" });
      await ((await bonus.count()) ? bonus.first() : cards.first()).click();
      await page.locator('.riddle, .puzzle, .crossword, .memory, .sorting').first().waitFor();
      if (await has('.riddle')) {
        while (await has('.riddle')) {
          const text = await page.locator('.riddle-q').textContent().catch(() => null);
          if (!text) break;
          const shown = await page.$$eval('.riddle .option', (els) => els.map((e) => e.textContent));
          const q = questions.find((x) => x.q === text && x.options.length === shown.length && x.options.every((o, i) => o === shown[i]));
          await page.locator('.riddle .option').nth(q.answer).click();
          await page.waitForFunction((t) => !document.querySelector('.riddle') || document.querySelector('.riddle-q')?.textContent !== t, text);
        }
      } else if (await has('.puzzle')) {
        await shotOnce('puzzle');
        for (;;) {
          const b = await page.$$eval('[data-cell]', (els) => els.map((e) => [e.dataset.cell, e.dataset.piece]));
          const w = b.find(([c, p]) => c !== p);
          if (!w) break;
          const h = b.find(([, p]) => p === w[0]);
          await page.locator(`[data-cell="${w[0]}"]`).click();
          await page.locator(`[data-cell="${h[0]}"]`).click();
        }
      } else if (await has('.crossword')) {
        await shotOnce('crossword');
        while (await has('.cw-answer')) {
          const clue = await page.locator('.cw-clue').textContent();
          const word = words.find((x) => clue.includes(x.q));
          await page.getByLabel('Javob').fill(word.a);
          await page.getByRole('button', { name: 'Tekshirish' }).click();
          if (!shotted.has('crossword-progress')) await shotOnce('crossword-progress');
        }
      } else if (await has('.memory')) {
        await shotOnce('memory');
        const pairs = await page.$$eval('.mcard', (els) => els.map((e) => e.dataset.pair));
        const byPair = {};
        pairs.forEach((p, i) => (byPair[p] ??= []).push(i));
        for (const [a, b] of Object.values(byPair)) {
          await page.locator('.mcard').nth(a).click();
          await page.locator('.mcard').nth(b).click();
          await page.waitForTimeout(30);
        }
      } else if (await has('.sorting')) {
        await shotOnce('sorting');
        for (;;) {
          const o = await page.$$eval('.sort-main', (els) => els.map((e) => Number(e.dataset.item)));
          const pos = o.findIndex((it, i) => it !== i);
          if (pos < 0) break;
          await page.locator('.sort-main').nth(o.indexOf(pos)).click();
          await page.locator('.sort-main').nth(pos).click();
        }
        await page.getByRole('button', { name: 'Tekshirish' }).click();
      }
      await page.locator('.result').waitFor();
      const go = page.getByRole('button', { name: "To'siqni yengamiz!" });
      if (await go.count()) {
        await go.click();
        break;
      }
      await page.getByRole('button', { name: 'Davom etamiz' }).click();
    }
    if (await has('.hub')) await page.getByRole('button', { name: /To'siqni yengamiz!|Dev bilan jangga!/ }).click();
    await page.locator('.obstacle, .battle').first().waitFor();
    if (await has('.battle')) {
      await shotOnce('battle');
      while (await has('.battle-q')) {
        const enabled = page.locator('.battle-q .option:not([disabled])');
        if ((await enabled.count()) === 0) {
          await page.waitForTimeout(50);
          continue;
        }
        const text = (await page.locator('.battle-q .dev-says').textContent()).replace("Dev so'raydi: ", '');
        const q = questions.find((x) => x.q === text);
        await enabled.filter({ hasText: q.options[q.answer] }).first().click();
      }
      await page.waitForTimeout(400);
      await shotOnce('battle-won');
    } else {
      await shotOnce(`obstacle-${level.obstacle.type}`);
      const item = page.getByRole('button', { name: /ni olish$/ });
      const a = await item.boundingBox();
      const t = await page.locator('.obstacle-target').boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(1000);
      await shotOnce(`obstacle-${level.obstacle.type}-open`);
    }
    await page.locator('.done').waitFor({ timeout: 8000 });
    console.log(`  ✓ ${level.order}. ${level.title}`);
    if (level.order === 7) {
      await page.locator('.certificate').scrollIntoViewIfNeeded();
      await shotOnce('certificate');
    } else {
      await page.getByRole('button', { name: 'Xaritaga qaytish' }).click();
      await page.locator('.map-canvas canvas').waitFor();
    }
  }
  await page.getByRole('button', { name: 'Xaritaga qaytish' }).click();
  await page.locator('.map-canvas canvas').waitFor();
  await page.waitForTimeout(700);
  await shotOnce('map-final');
  if (errors.length) throw new Error('console errors:\n' + errors.join('\n'));
  console.log(`\nFULL E2E PASSED (grade ${grade}) — screenshots in ${SHOTS}`);
} catch (e) {
  console.error('\nFULL E2E FAILED:', e);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
