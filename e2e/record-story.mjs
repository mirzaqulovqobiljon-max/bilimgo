// Ertakni MP4 ga yozib olish (ko'rib chiqish uchun): Chrome ekranini yozadi, ovozlarni chalingan paytiga joylaydi.
// Ishlatish: node e2e/record-story.mjs [intro|outro] [telefon|kompyuter]
// Eslatma: sintez qilingan tovush effektlari (momaqaldiroq, sehr) yozuvga kirmaydi — faqat bobo va dev ovozi.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';

const part = process.argv[2] ?? 'intro';
const kind = process.argv[3] ?? 'kompyuter';
const size = kind === 'telefon' ? { width: 405, height: 720 } : { width: 1280, height: 720 };
const OUT = new URL('./video/', import.meta.url).pathname;
const RAW = `${OUT}raw-${part}-${kind}/`;
rmSync(RAW, { recursive: true, force: true });
mkdirSync(RAW, { recursive: true });

const PORT = 4177;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: RAW, size } });
  await ctx.addInitScript(() => {
    window.__plays = [];
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function play() {
      window.__plays.push({ src: new URL(this.src).pathname, t: performance.timeOrigin + performance.now() });
      return orig.call(this);
    };
  });
  const t0 = Date.now();
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/e2e/harness/story.html?part=${part}`);
  await page.getByRole('button', { name: /▶/ }).waitFor();
  await page.waitForTimeout(1200);
  const tStart = Date.now();
  await page.getByRole('button', { name: /▶/ }).click({ force: true });
  await page.locator('.story-frame[data-phase="end"]').waitFor({ timeout: 90000 });
  await page.waitForTimeout(3500);
  const plays = await page.evaluate(() => window.__plays);
  const tEnd = Date.now();
  await ctx.close();
  const webm = RAW + readdirSync(RAW).find((f) => f.endsWith('.webm'));
  // ovozlarni vaqt bo'yicha joylab, bitta MP4 ga yig'ish
  const inputs = ['-i', webm];
  const filters = [];
  plays.forEach((p, i) => {
    inputs.push('-i', `public${decodeURIComponent(p.src)}`);
    const ms = Math.max(0, Math.round(p.t - t0));
    filters.push(`[${i + 1}:a]adelay=${ms}|${ms}[a${i}]`);
  });
  const mix = `${filters.join(';')};${plays.map((_, i) => `[a${i}]`).join('')}amix=inputs=${plays.length}:normalize=0[aout]`;
  const trimStart = Math.max(0, (tStart - t0 - 800) / 1000);
  const dur = (tEnd - t0) / 1000 - trimStart;
  const out = `${OUT}ertak-${part}-${kind}.mp4`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', mix, '-map', '0:v', '-map', '[aout]',
    '-ss', String(trimStart), '-t', String(dur), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-r', '25', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out]);
  console.log(`✓ ${out} (${plays.length} ta ovoz)`);
} finally {
  await browser.close();
  await server.close();
}
