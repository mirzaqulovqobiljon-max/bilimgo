// Maket tekshiruvi: har bir yangi o'yin telefonda (360x740) va kompyuterda (1280x800) — asosiy tugmalar
// boboning gap pufagi ostida qolmasligi kerak. Skrinshotlar: e2e/screens-layout/
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';

const levels = JSON.parse(readFileSync(new URL('../src/content/levels.json', import.meta.url), 'utf8'));
const battleQs = levels.flatMap((l) => (l.obstacle.battle ? Object.values(l.obstacle.battle).flatMap((b) => b.questions) : []));

const out = new URL('./screens-layout/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const server = await createServer({ server: { port: 5197, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
// har o'yinning "asosiy" tugmalari — bola ularga barmog'i yetishi shart
const CONTROLS = {
  maze: ['.dpad-btn', '.mz-board'],
  hidden: ['.ho-view', '.mg-hud .btn'],
  horse: ['.hr-jump', '.hr-box'],
  chest: ['.wheel-btn', '.chest-check'],
  battle: ['.battle-q .option'],
};
const problems = [];
try {
  for (const [vw, vh, name] of [[360, 740, 'tel'], [1280, 800, 'pc']]) {
    for (const game of Object.keys(CONTROLS)) {
      for (const tier of ['kichik', 'olim']) {
        const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: name === 'tel' ? 2 : 1 });
        const errs = [];
        page.on('pageerror', (e) => errs.push(String(e)));
        await page.goto(`http://localhost:5197/e2e/harness/game.html?game=${game}&tier=${tier}`);
        await page.locator('.bobo-bubble').waitFor();
        await page.waitForTimeout(300);
        const bubble = await page.locator('.bobo-bubble').boundingBox();
        for (const sel of CONTROLS[game]) {
          const boxes = await page.locator(sel).evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.top, r.bottom]; }));
          const covered = boxes.filter(([top, bottom]) => bottom > bubble.y + 4 || top > vh);
          if (!boxes.length) problems.push(`${name} ${game}/${tier}: ${sel} topilmadi`);
          else if (covered.length) problems.push(`${name} ${game}/${tier}: ${sel} pufak ostida (${covered.length}/${boxes.length}) — pufak y=${Math.round(bubble.y)}`);
        }
        const covered = async (sel, label) => {
          const bb = await page.locator('.bobo-bubble').boundingBox();
          const boxes = await page.locator(sel).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().bottom));
          const bad = boxes.filter((b) => bb && b > bb.y + 4);
          if (!boxes.length) problems.push(`${name} ${game}/${tier}: ${label} topilmadi`);
          else if (bad.length) problems.push(`${name} ${game}/${tier}: ${label} pufak ostida (${bad.length}/${boxes.length})`);
        };
        if (game === 'battle') {
          // 1-fazani yechib, qalqon va belgilar fazalarining maketini ham tekshiramiz
          while (await page.locator('.battle-q').count()) {
            const en = page.locator('.battle-q .option:not([disabled])');
            if (!(await en.count())) { await page.waitForTimeout(50); continue; }
            const text = (await page.locator('.battle-q .dev-says').textContent()).replace("Dev so'raydi: ", '');
            const q = battleQs.find((x) => x.q === text);
            await en.filter({ hasText: q.options[q.answer] }).first().click();
          }
          await page.locator('.phase-shield').waitFor();
          await page.waitForTimeout(300);
          await covered('.shield-btn', 'qalqon tugmasi');
          await page.screenshot({ path: `${out}${name}-${game}-${tier}-qalqon.png` });
          while (await page.locator('.phase-shield').count()) {
            const r = await page.waitForFunction(() => { const el = document.querySelector('.phase-shield'); if (!el) return 'done'; return el.dataset.orb && Number(el.dataset.orb) >= Number(el.dataset.zone) + 0.06 ? 'go' : false; }, null, { polling: 'raf', timeout: 15000 }).then((h) => h.jsonValue());
            if (r === 'done') break;
            await page.keyboard.press('Space');
            await page.waitForTimeout(150);
          }
          await page.locator('.phase-runes').waitFor();
          await page.waitForTimeout(300);
          await covered('.rune-btn', 'belgi tugmalari');
          await page.screenshot({ path: `${out}${name}-${game}-${tier}-belgilar.png` });
        }
        if (errs.length) problems.push(`${name} ${game}/${tier}: ${errs.join('; ')}`);
        await page.screenshot({ path: `${out}${name}-${game}-${tier}.png` });
        await page.close();
      }
    }
  }
  if (problems.length) {
    console.log(problems.join('\n'));
    process.exitCode = 1;
  } else console.log('MAKET: hamma asosiy tugmalar ochiq (telefon va kompyuter)');
} finally {
  await browser.close();
  await server.close();
}
