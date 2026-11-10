// "Arzon telefon" tezlik sinovi: CPU 6x sekin + tarmoq profili, 360x640 ekran.
// Usage: npm run build && node e2e/perf.mjs
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const PROFILES = {
  // Chrome DevTools'dagi standart profillar
  'slow-3g': { latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 },
  'fast-3g': { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
};
/** Byudjetlar (ms / MB / fps). Oshsa — sinov yiqiladi. */
const BUDGET = {
  'slow-3g': { firstScreen: 6000, mapReady: 15000, warmOffline: 2500 },
  'fast-3g': { firstScreen: 3000, mapReady: 6000, warmOffline: 2500 },
  fps: 24,
  tapMs: 200,
  heapMB: 80,
};
const CPU = Number(process.env.CPU_SLOWDOWN ?? 6);

const PORT = 4175;
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'silent' });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const results = {};
let failed = false;
const check = (name, value, limit, unit, higherIsBetter = false) => {
  const ok = higherIsBetter ? value >= limit : value <= limit;
  if (!ok) failed = true;
  console.log(`  ${ok ? '✓' : '✗'} ${name}: ${Math.round(value)} ${unit} (byudjet ${higherIsBetter ? '≥' : '≤'} ${limit})`);
};

try {
  for (const [profile, net] of Object.entries(PROFILES)) {
    console.log(`\n== ${profile}, CPU ${CPU}x sekin ==`);
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, ...net });
    let bytes = 0;
    cdp.on('Network.loadingFinished', (e) => (bytes += e.encodedDataLength));

    // 1) Sovuq yuklanish: birinchi ekran
    const t0 = Date.now();
    await page.goto(`http://localhost:${PORT}/`);
    await page.getByLabel('Isming').waitFor();
    const firstScreen = Date.now() - t0;
    const firstBytes = bytes;
    check('Birinchi ekran (ro\'yxatdan o\'tish)', firstScreen, BUDGET[profile].firstScreen, 'ms');
    console.log(`    yuklangan: ${(firstBytes / 1024).toFixed(0)} KB`);

    // 2) Xarita (Phaser) tayyor bo'lguncha — bola ismini yozayotganda fonda yuklanadi
    await page.getByLabel('Isming').fill('Aziza');
    await page.getByRole('button', { name: /^2$/ }).click();
    const t1 = Date.now();
    await page.getByRole('button', { name: 'Sayohatni boshlash' }).click();
    await page.locator('.map-canvas[data-state="ready"] canvas').waitFor();
    const mapReady = Date.now() - t1 + 0;
    check('Xarita tayyor (Sayohatni boshlash bosilgandan)', mapReady, BUDGET[profile].mapReady, 'ms');

    // 3) Xarita FPS (animatsiyalar: pulsatsiya, tuya)
    await page.waitForTimeout(500);
    const fps = await page.evaluate(
      () =>
        new Promise((res) => {
          let n = 0;
          const start = performance.now();
          const tick = () => {
            n++;
            if (performance.now() - start < 3000) requestAnimationFrame(tick);
            else res((n * 1000) / (performance.now() - start));
          };
          requestAnimationFrame(tick);
        }),
    );
    check('Xarita FPS', fps, BUDGET.fps, 'fps', true);

    // 4) Bosishga javob vaqti (puzzle bo'lagini bosish -> belgilanishi)
    await page.locator('nav[aria-label="Bosqichlar"]').getByRole('button', { name: /Ona qishloq/ }).press('Enter');
    await page.getByRole('button', { name: /Qishloq darvozasi rasmi/ }).click();
    const cell = page.locator('.piece:not(.locked)').first();
    await cell.waitFor();
    const tap = await cell.evaluate(
      (el) =>
        new Promise((res) => {
          const t = performance.now();
          const obs = new MutationObserver(() => {
            if (el.classList.contains('selected')) {
              obs.disconnect();
              requestAnimationFrame(() => res(performance.now() - t));
            }
          });
          obs.observe(el, { attributes: true });
          el.click();
        }),
    );
    check('Bosishga javob (puzzle)', tap, BUDGET.tapMs, 'ms');

    const heap = await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0));
    check('JS xotira (heap)', heap, BUDGET.heapMB, 'MB');
    console.log(`    jami yuklangan: ${(bytes / 1024).toFixed(0)} KB`);

    // 5) Qayta ochish INTERNETSIZ (PWA keshidan)
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null || navigator.serviceWorker?.ready, null, { timeout: 30000 });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await ctx.setOffline(true);
    const t2 = Date.now();
    await page.reload();
    await page.locator('.map-canvas[data-state="ready"] canvas').waitFor();
    const warm = Date.now() - t2;
    check('Internetsiz qayta ochish (xarita bilan)', warm, BUDGET[profile].warmOffline, 'ms');
    results[profile] = { firstScreen, firstKB: Math.round(firstBytes / 1024), mapReady, fps: Math.round(fps), tapMs: Math.round(tap), heapMB: Math.round(heap), warmOffline: warm };
    await ctx.close();
  }
  console.log('\n' + JSON.stringify(results, null, 2));
  console.log(failed ? '\nPERF: BYUDJETDAN OSHDI' : '\nPERF: HAMMASI BYUDJET ICHIDA');
  if (failed) process.exitCode = 1;
} catch (e) {
  console.error('PERF FAILED:', e);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
