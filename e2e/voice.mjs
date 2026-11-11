// Ovoz E2E: haqiqiy Chrome'da kichik sayyoh uchun bobo gaplari, savolni o'qib berish va 🔊 tugmasi
// MP3 yuklashini hamda brauzer ularni dekodlay olishini tekshiradi.
// Ishlatish: npm run build && node e2e/voice.mjs
import { preview } from 'vite';
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const audioIndex = JSON.parse(readFileSync(new URL('../src/content/audio.uz.json', import.meta.url), 'utf8'));

const PORT = 4175;
const APP_URL = `http://localhost:${PORT}/`;
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'silent' });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const ok = (m) => console.log(`  ✓ ${m}`);
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => errors.push(String(e)));
  const mp3 = [];
  page.on('response', (r) => r.url().endsWith('.mp3') && mp3.push({ url: r.url().split('/').pop(), status: r.status() }));
  // Ijro etilgan audio elementlarni sanaymiz (Audio() DOM'ga qo'shilmaydi, shuning uchun play() ni kuzatamiz)
  await page.addInitScript(() => {
    window.__played = [];
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function play() {
      window.__played.push(this.src.split('/').pop());
      return orig.call(this);
    };
  });

  await page.goto(APP_URL);
  await page.getByLabel('Isming').fill('Aziza');
  await page.getByRole('button', { name: /^2$/ }).click(); // 2-sinf -> kichik sayyoh, ovoz yoqiq
  await page.getByRole('button', { name: 'Sayohatni boshlash' }).click();
  await page.locator('.map-canvas canvas').waitFor({ timeout: 15000 });
  await page.waitForFunction(() => window.__played.length > 0);
  ok(`xaritada bobo gapirdi: ${await page.evaluate(() => window.__played[0])}`);

  const canvas = page.locator('.map-canvas canvas');
  await page.waitForTimeout(500);
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + 230 * (box.width / 360), box.y + 580 * (box.height / 640));
  await page.getByText('Kalit: 0/3').waitFor();
  await page.getByRole('button', { name: /Harflardan so'z/ }).click();
  const file = (voice, text) => audioIndex[`${voice}|${text}`].split('/').pop();
  const want = [file('bobo', "Harflardan so'z tuzamiz. To'g'ri so'zni bos."), file('bobo', "A, L, K, T, I. Qaysi so'z chiqadi?")];
  await page.waitForFunction((w) => w.every((f) => window.__played.includes(f)), want, { timeout: 15000 });
  const played = await page.evaluate(() => window.__played);
  if (played.indexOf(want[0]) > played.indexOf(want[1])) throw new Error('savol kirish gapidan oldin o\'qildi');
  ok('topshiriq: avval bobo kirish gapi, keyin savol o\'qildi');

  const n = await page.evaluate(() => window.__played.length);
  await page.getByRole('button', { name: "Savolni o'qib ber" }).click();
  await page.waitForFunction((k) => window.__played.length > k, n);
  ok('🔊 tugmasi savolni qayta o\'qidi');

  // Brauzer faylni haqiqatan dekodlay oladimi (buzuq MP3 bo'lsa jim qolardi)
  const durations = await page.evaluate(async (files) => {
    const ac = new AudioContext();
    const out = [];
    for (const f of files) {
      const buf = await (await fetch(`audio/uz/${f}`)).arrayBuffer();
      out.push((await ac.decodeAudioData(buf)).duration);
    }
    return out;
  }, [...new Set(mp3.map((m) => m.url))]);
  if (durations.some((d) => !(d > 0.3))) throw new Error(`dekodlash xato: ${durations}`);
  ok(`${durations.length} ta MP3 dekodlandi (${durations.map((d) => d.toFixed(1)).join('s, ')}s)`);

  const bad = mp3.filter((m) => m.status >= 400);
  if (bad.length) throw new Error(`yuklanmagan fayllar: ${JSON.stringify(bad)}`);
  ok(`${mp3.length} ta so'rov, hammasi 200/206`);

  // Ovozni o'chirish ishlaydi
  await page.getByRole('button', { name: "Ovozni o'chirish" }).click();
  const m = await page.evaluate(() => window.__played.length);
  await page.getByRole('button', { name: 'Bobo, yordam ber' }).click();
  await page.waitForTimeout(800);
  if ((await page.evaluate(() => window.__played.length)) !== m) throw new Error("o'chirilgan ovoz baribir gapirdi");
  ok("ovoz o'chirilganda bobo jim (matn ko'rinadi)");

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('OVOZ E2E: OK');
} catch (e) {
  console.error('OVOZ E2E XATO:', e);
  process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
