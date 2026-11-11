// Real-browser smoke test: plays level 1 end-to-end in Chrome on a small phone viewport.
// Usage: npm run build && npm run test:e2e   (CHROME_PATH=/path/to/chrome to override)
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = 4173;
const APP_URL = `http://localhost:${PORT}/`;
const SHOTS = new URL('./screens/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

console.log('starting preview…');
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'silent' });
console.log('preview up, launching chrome…');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const errors = [];
let step = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
try {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = (name) => page.screenshot({ path: `${SHOTS}${String(++step).padStart(2, '0')}-${name}.png` });
  const bubble = () => page.locator('.bobo-bubble').innerText();

  const t0 = Date.now();
  await page.goto(APP_URL);
  await page.getByLabel('Isming').waitFor();
  ok(`registration screen in ${Date.now() - t0} ms`);
  await shot('register');
  await page.getByLabel('Isming').fill('Aziza');
  await page.getByRole('button', { name: /^2$/ }).click();
  await page.getByRole('button', { name: 'Sayohatni boshlash' }).click();

  // Phaser map: wait for canvas, click on node 1 by its map coordinates
  const canvas = page.locator('.map-canvas canvas');
  await canvas.waitFor({ timeout: 15000 });
  await page.waitForTimeout(600);
  await shot('map');
  const box = await canvas.boundingBox();
  const sx = box.width / 360, sy = box.height / 640;
  // locked node 2 first
  await page.mouse.click(box.x + 115 * sx, box.y + 495 * sy); // 2-nuqta (mapModel.ts)
  if (!/oldingi to'siqni/.test(await bubble())) throw new Error('locked node did not answer');
  ok('Phaser map rendered; locked node -> bobo explains');
  await page.mouse.click(box.x + 230 * sx, box.y + 580 * sy); // 1-nuqta
  await page.getByText('Kalit: 0/3').waitFor();
  ok('clicked node 1 on canvas -> level hub');
  await shot('hub');

  // Task 1: riddle
  await page.getByRole('button', { name: /Harflardan so'z/ }).click();
  await shot('riddle');
  await page.getByRole('button', { name: 'OLMA' }).click();
  for (const a of ['KALIT', 'OT', 'UY']) await page.getByRole('button', { name: a, exact: true }).click();
  await page.getByText(/Kalit dastasi sumkaga tushdi/).waitFor();
  await shot('result');
  await page.getByRole('button', { name: 'Davom etamiz' }).click();
  ok('riddle done (1 mistake)');

  // Task 2: puzzle — first move by real drag, the rest by taps
  await page.getByRole('button', { name: /Qishloq darvozasi rasmi/ }).click();
  await shot('puzzle');
  const readBoard = () => page.$$eval('[data-cell]', (els) => els.map((e) => [Number(e.dataset.cell), Number(e.dataset.piece)]));
  let board = await readBoard();
  {
    const [wrongCell] = board.find(([c, p]) => c !== p);
    const [holderCell] = board.find(([, p]) => p === wrongCell);
    const a = await page.locator(`[data-cell="${holderCell}"]`).boundingBox();
    const b = await page.locator(`[data-cell="${wrongCell}"]`).boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
    await page.mouse.up();
    board = await readBoard();
    if (board.find(([c]) => c === wrongCell)[1] !== wrongCell) throw new Error('drag swap failed');
    ok('puzzle piece moved by real drag');
  }
  for (;;) {
    board = await readBoard();
    const w = board.find(([c, p]) => c !== p);
    if (!w) break;
    const holder = board.find(([, p]) => p === w[0]);
    await page.locator(`[data-cell="${w[0]}"]`).click();
    await page.locator(`[data-cell="${holder[0]}"]`).click();
  }
  await page.getByText(/Kalit tishlari sumkaga tushdi/).waitFor();
  await page.getByRole('button', { name: 'Davom etamiz' }).click();
  ok('puzzle solved');

  // Task 3
  await page.getByRole('button', { name: /Topishmoqlar/ }).click();
  for (const a of ['Tuxum', 'Oy', 'Kitob']) await page.getByRole('button', { name: a, exact: true }).click();
  await page.getByText("Kalit to'liq yig'ildi!").waitFor();
  await shot('key-complete');
  ok('key assembled 3/3');
  await page.getByRole('button', { name: "To'siqni yengamiz!" }).click();

  // Gate: real drag of the key from the bag to the padlock
  await page.getByRole('button', { name: 'Kalitni olish' }).waitFor();
  await shot('gate');
  const k = await page.getByRole('button', { name: 'Kalitni olish' }).boundingBox();
  const lock = await page.locator('.obstacle-target').boundingBox();
  await page.mouse.move(k.x + k.width / 2, k.y + k.height / 2);
  await page.mouse.down();
  await page.mouse.move(lock.x + lock.width / 2, lock.y + lock.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.getByText('Ochildi!').waitFor();
  await page.waitForTimeout(500);
  await shot('gate-open');
  await page.getByText("Ona qishloq — o'tildi!").waitFor({ timeout: 5000 });
  ok('key dragged onto the gate -> gate opened');
  await shot('done');

  await page.getByRole('button', { name: 'Xaritaga qaytish' }).click();
  await canvas.waitFor();
  await page.waitForTimeout(600);
  await shot('map-after');

  // Reload: progress must survive
  await page.reload();
  await page.locator('.map-canvas canvas').waitFor();
  const coins = await page.getByLabel(/Jami tanga/).innerText();
  if (!coins.includes('30')) throw new Error(`coins after reload: ${coins}`);
  ok('progress survives reload (30 coins)');

  if (errors.length) throw new Error(`console errors:\n${errors.join('\n')}`);
  ok('no console errors');
  console.log(`\nE2E PASSED — screenshots in ${SHOTS}`);
} catch (e) {
  console.error('\nE2E FAILED:', e);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
