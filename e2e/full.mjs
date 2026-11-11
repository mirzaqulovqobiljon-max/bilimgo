// Real Chrome: plays the WHOLE adventure (7 levels) on a 360x740 phone viewport.
// Usage: npm run build && node e2e/full.mjs [grade]
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const grade = Number(process.argv[2] ?? 2);
// VIEWPORT=desktop — kompyuter ekrani (sichqoncha + klaviatura), aks holda telefon (touch)
const desktop = process.env.VIEWPORT === 'desktop';
const root = new URL('../src/content/', import.meta.url).pathname;
const levels = JSON.parse(readFileSync(root + 'levels.json', 'utf8')).sort((a, b) => a.order - b.order);
const tasks = readdirSync(root + 'tasks').flatMap((f) => JSON.parse(readFileSync(root + 'tasks/' + f, 'utf8')));
const questions = [
  ...tasks.flatMap((t) => Object.values(t.tiers).flatMap((v) => v.questions ?? [])),
  ...levels.flatMap((l) => (l.obstacle.battle ? Object.values(l.obstacle.battle).flatMap((b) => b.questions) : [])),
];
const words = tasks.flatMap((t) => Object.values(t.tiers).flatMap((v) => v.words ?? []));
const tiersOf = (game) => tasks.filter((t) => t.game === game).flatMap((t) => Object.values(t.tiers));

/** Labirint: BFS (tuzoqlardan aylanib) — start -> kalit -> chiqish. */
function mazePath(m) {
  const wall = ([x, y]) => m.rows[y]?.[x] !== '.';
  const trap = ([x, y]) => m.traps.some((t) => t[0] === x && t[1] === y);
  const bfs = (a, b) => {
    const prev = new Map([[a.join(), null]]);
    const q = [a];
    while (q.length) {
      const c = q.shift();
      if (c[0] === b[0] && c[1] === b[1]) {
        const path = [];
        for (let k = c; k; k = prev.get(k.join())) path.unshift(k);
        return path;
      }
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const n = [c[0] + dx, c[1] + dy];
        if (!prev.has(n.join()) && !wall(n) && !trap(n)) (prev.set(n.join(), c), q.push(n));
      }
    }
    return null;
  };
  const p = [...bfs(m.start, m.key), ...bfs(m.key, m.exit).slice(1)];
  return p.slice(1).map((c, i) => {
    const dx = c[0] - p[i][0];
    const dy = c[1] - p[i][1];
    return dx === 1 ? 'ArrowRight' : dx === -1 ? 'ArrowLeft' : dy === 1 ? 'ArrowDown' : 'ArrowUp';
  });
}

const SHOTS = new URL(`./screens-full-${grade}${desktop ? '-desktop' : ''}/`, import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const PORT = 4174;
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'silent' });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const errors = [];
const shotted = new Set();
let n = 0;
try {
  const ctx = await browser.newContext(
    desktop
      ? { viewport: { width: 1280, height: 800 } }
      : { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  );
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
      const extra = page.locator('.task-card.extra:not(.done)');
      const bonus = (await extra.count()) ? extra : cards.filter({ hasText: "qo'shimcha sinov" });
      await ((await bonus.count()) ? bonus.first() : cards.first()).click();
      await page.locator('.riddle, .puzzle, .crossword, .memory, .sorting, .maze, .chest, .hidden-game, .horse').first().waitFor();
      if (await has('.maze')) {
        await shotOnce('labirint');
        const cols = await page.$eval('.mz-board', (e) => e.style.gridTemplateColumns.match(/repeat\((\d+)/)[1]);
        const m = tiersOf('maze').find((x) => String(x.rows[0].length) === cols);
        const keys = mazePath(m);
        for (const [i, k] of keys.entries()) {
          // telefonda ekrandagi tugmalar, kompyuterda klaviatura (yarmi WASD)
          if (!desktop) await page.getByRole('button', { name: { ArrowUp: 'Yuqoriga', ArrowDown: 'Pastga', ArrowLeft: 'Chapga', ArrowRight: "O'ngga" }[k] }).click();
          else await page.keyboard.press(i % 2 ? k : { ArrowUp: 'w', ArrowDown: 's', ArrowLeft: 'a', ArrowRight: 'd' }[k]);
          if (i === Math.floor(keys.length / 2)) await shotOnce('labirint-yarim');
        }
      } else if (await has('.chest')) {
        await shotOnce('sandiq');
        const qs = await page.$$eval('.chest-q', (els) => els.map((e) => e.textContent));
        const c = tiersOf('chest').find((x) => x.puzzles.every((p, i) => p.q === qs[i]));
        for (const [i, pz] of c.puzzles.entries()) {
          if (desktop) {
            await page.getByRole('spinbutton', { name: `${i + 1}-raqam` }).click();
            await page.keyboard.press(String(pz.answer));
          } else {
            const up = Math.min(pz.answer, 10 - pz.answer);
            for (let k = 0; k < up; k++)
              await page.getByRole('button', { name: `${i + 1}-raqamni ${pz.answer <= 5 ? 'oshirish' : 'kamaytirish'}` }).click();
          }
        }
        await page.getByRole('button', { name: /Tekshirish/ }).click();
        await page.waitForTimeout(500);
        await shotOnce('sandiq-ochildi');
      } else if (await has('.hidden-game')) {
        await shotOnce('yashirin');
        const ids = await page.$$eval('.ho-list li', (els) => els.map((e) => e.dataset.target));
        const h = tiersOf('hidden').find((x) => x.targets.length === ids.length && x.targets.every((t, i) => t.id === ids[i]));
        const box = await page.locator('.ho-stage').boundingBox();
        for (const t of h.targets) {
          const x = box.x + (t.x + t.w / 2) * box.width;
          const y = box.y + (t.y + t.h / 2) * box.height;
          if (desktop) await page.mouse.click(x, y);
          else await page.touchscreen.tap(x, y);
          await page.waitForTimeout(40);
        }
        await shotOnce('yashirin-topildi');
      } else if (await has('.horse')) {
        await shotOnce('ot-boshlash');
        await page.getByRole('button', { name: /Boshlash/ }).click();
        let shot = false;
        while (!(await has('.horse.phase-done')) && (await has('.horse'))) {
          // brauzer ichida, har kadrda: to'siq sakrash nuqtasiga kelganmi
          const ready = await page
            .waitForFunction(
              () => {
                const b = document.querySelector('.hr-box');
                if (!b || document.querySelector('.horse.phase-done')) return 'done';
                return b.dataset.next && Number(b.dataset.next) <= Number(b.dataset.lead) && b.dataset.y === '0.00' ? 'jump' : false;
              },
              null,
              { polling: 'raf', timeout: 20000 },
            )
            .then((h) => h.jsonValue());
          if (ready === 'done') break;
          if (desktop) await page.keyboard.press('Space');
          else await page.locator('.hr-jump').dispatchEvent('pointerdown');
          if (!shot) {
            await page.waitForTimeout(220);
            await shotOnce('ot-sakrash');
            shot = true;
          }
          await page.waitForFunction(() => document.querySelector('.hr-box')?.dataset.y !== '0.00' || !!document.querySelector('.horse.phase-done'), null, { polling: 'raf', timeout: 3000 }).catch(() => {});
        }
        const mistakes = await page.locator('.horse .mg-hud').textContent();
        console.log(`    ot: ${mistakes.trim()}`);
      } else if (await has('.riddle')) {
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
      if (await has('.battle.finale')) {
        // 2-faza: qalqon
        await page.locator('.phase-shield').waitFor({ timeout: 8000 });
        await shotOnce('jang-qalqon');
        while (await has('.phase-shield')) {
          const r = await page
            .waitForFunction(
              () => {
                const el = document.querySelector('.phase-shield');
                if (!el) return 'done';
                return el.dataset.orb && Number(el.dataset.orb) >= Number(el.dataset.zone) + 0.06 ? 'raise' : false;
              },
              null,
              { polling: 'raf', timeout: 15000 },
            )
            .then((h) => h.jsonValue());
          if (r === 'done') break;
          if (desktop) await page.keyboard.press('Space');
          else await page.locator('.shield-btn').dispatchEvent('pointerdown');
          await page.waitForTimeout(150);
        }
        // 3-faza: sehrli belgilar
        await page.locator('.phase-runes').waitFor({ timeout: 8000 });
        await shotOnce('jang-belgilar');
        const target = await page.$eval('.phase-runes', (e) => e.dataset.target);
        for (const r of target) await page.getByRole('button', { name: `Belgi ${r}` }).click();
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
  for (const pg of browser.contexts().flatMap((c) => c.pages())) await pg.screenshot({ path: `${SHOTS}XATO.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
