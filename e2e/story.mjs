// Ertak E2E: haqiqiy Chrome'da o'yin boshidagi ertak oxirigacha ko'riladi (haqiqiy MP3 bilan).
// Tekshiradi: barcha gaplar ovozi yuklanib, dekodlanib, chalinadi; sahnalar tartibi; rasmlar yuklanadi;
// "Yo'lga chiqamiz" -> xarita; qayta ochilganda ertak chiqmaydi. Har sahnadan skrinshot (telefon va kompyuter).
// Ishlatish: npm run build && node e2e/story.mjs
import { preview } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';

const story = JSON.parse(readFileSync(new URL('../src/content/story.uz.json', import.meta.url), 'utf8'));
const audioIndex = JSON.parse(readFileSync(new URL('../src/content/audio.uz.json', import.meta.url), 'utf8'));
const SHOTS = new URL('./screens-story/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const PORT = 4176;
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'silent' });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ok = (m) => console.log(`  ✓ ${m}`);
const errors = [];
const VIEWPORTS = {
  telefon: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  kompyuter: { viewport: { width: 1280, height: 800 } },
};
try {
  for (const [name, opts] of Object.entries(VIEWPORTS)) {
    console.log(`\n${name}:`);
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
    const failed = [];
    page.on('response', (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
    await page.addInitScript(() => {
      window.__played = [];
      const orig = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function play() {
        const src = this.src.split('/').pop();
        this.addEventListener('ended', () => window.__played.push({ src, dur: this.duration }), { once: true });
        return orig.call(this);
      };
    });

    await page.goto(`http://localhost:${PORT}/`);
    await page.getByLabel('Isming').fill('Aziza');
    await page.getByRole('button', { name: /^2$/ }).click();
    await page.getByRole('button', { name: 'Sayohatni boshlash' }).click();
    await page.getByRole('dialog', { name: "Ertak: o'yin boshlanishi" }).waitFor();
    await page.screenshot({ path: `${SHOTS}${name}-0-boshlash.png` });
    await page.getByRole('button', { name: "▶ Ertakni ko'rish" }).click({ force: true }); // tugma pulsatsiya qiladi

    const t0 = Date.now();
    for (const [i, sc] of story.intro.scenes.entries()) {
      await page.locator(`.story-frame[data-scene="${sc.id}"][data-phase="playing"]`).waitFor({ timeout: 20000 });
      // rasmlar haqiqatan yuklangan (naturalWidth > 0)
      const broken = await page.$$eval('.story-scene img', (imgs) => imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src));
      if (broken.length) throw new Error(`rasm yuklanmadi: ${broken}`);
      await page.waitForTimeout(sc.id === 'dev' ? 0 : 1800);
      if (sc.id === 'dev') {
        // kadrlar CSS vaqtlariga mos: 1.1s tutun, 2.9s kuladi, 4.9s uchadi
        const ts = Date.now();
        for (const [ms, tag] of [[1700, 'a-tutun'], [3700, 'b-kuladi'], [5300, 'c-uchadi']]) {
          await page.waitForTimeout(Math.max(0, ms - (Date.now() - ts)));
          await page.screenshot({ path: `${SHOTS}${name}-${i + 1}-dev-${tag}.png` });
        }
      } else await page.screenshot({ path: `${SHOTS}${name}-${i + 1}-${sc.id}.png` });
      ok(`sahna ${i + 1}: ${sc.id}`);
    }
    await page.getByRole('button', { name: "Ha, yo'lga chiqamiz! 🐪" }).waitFor({ timeout: 30000 });
    const total = Date.now() - t0;
    await page.screenshot({ path: `${SHOTS}${name}-6-oxiri.png` });
    const played = await page.evaluate(() => window.__played);
    const want = story.intro.scenes.flatMap((s) => s.lines).map((l) => audioIndex[`${l.voice}|${l.text}`].split('/').pop());
    const got = played.map((p) => p.src);
    if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`ovozlar tartibi:\n${got}\n!=\n${want}`);
    if (played.some((p) => !(p.dur > 1))) throw new Error(`dekodlanmagan ovoz: ${JSON.stringify(played)}`);
    ok(`${played.length} ta gap ovozi oxirigacha chalindi (${(total / 1000).toFixed(1)} s)`);

    await page.getByRole('button', { name: "Ha, yo'lga chiqamiz! 🐪" }).click();
    await page.locator('.map-canvas canvas').waitFor();
    ok('xarita ochildi');
    await page.reload();
    await page.locator('.map-canvas canvas').waitFor();
    if (await page.getByRole('dialog', { name: /Ertak/ }).count()) throw new Error('ertak qayta chiqdi');
    ok("qayta ochilganda ertak chiqmaydi");
    await page.getByRole('button', { name: "▶ Ertakni qayta ko'rish" }).click();
    await page.getByRole('dialog', { name: "Ertak: o'yin boshlanishi" }).waitFor();
    await page.getByRole('button', { name: /O'tkazib yuborish/ }).click();
    await page.locator('.map-canvas canvas').waitFor();
    ok("xaritadan qayta ko'rish va o'tkazib yuborish ishlaydi");
    if (failed.length) throw new Error('yuklanmagan fayllar:\n' + failed.join('\n'));
    await ctx.close();
  }
  if (errors.length) throw new Error('konsol xatolari:\n' + errors.join('\n'));
  console.log(`\nSTORY E2E PASSED — skrinshotlar: ${SHOTS}`);
} catch (e) {
  console.error('\nSTORY E2E FAILED:', e);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
