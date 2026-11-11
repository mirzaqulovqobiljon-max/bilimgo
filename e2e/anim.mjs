// Animatsiya kadrlari: har bir to'siq ochilishining o'rtasidan va oxiridan skrinshot.
// Ishlatish: node e2e/anim.mjs  ->  e2e/screens-anim/*.png
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const out = new URL('./screens-anim/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const errors = [];
try {
  for (const [id, frames] of [
    ['ona-qishloq', [350, 1050, 1500, 3000]],
    ['daryo', [400, 1100, 1900, 3300]],
    ['qizilqum', [150, 450, 900, 2200]],
  ]) {
    const page = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 });
    page.on('pageerror', (e) => errors.push(`${id}: ${e}`));
    await page.goto(`http://localhost:5199/e2e/harness/anim.html?level=${id}`);
    await page.locator('.tray-item').click();
    await page.locator('.obstacle-target').click();
    const t0 = Date.now();
    for (const ms of frames) {
      await page.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
      await page.locator('.obstacle-stage').screenshot({ path: `${out}${id}-${ms}.png` });
    }
    console.log(`  ✓ ${id}: ${frames.length} kadr`);
    await page.close();
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('ANIMATSIYA KADRLARI: OK');
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
