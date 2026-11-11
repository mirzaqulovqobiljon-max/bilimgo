// Ot yugurishi tezligi: oddiy va 4x sekin protsessorda (arzon telefon) kadr tezligi.
// Ishlatish: node e2e/runner-fps.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
const server = await createServer({ server: { port: 5195, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
let fail = false;
try {
  for (const rate of [1, 4]) {
    const page = await browser.newPage({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2 });
    const cdp = await page.context().newCDPSession(page);
    await page.goto('http://localhost:5195/e2e/harness/game.html?game=horse&tier=olim');
    await page.getByRole('button', { name: /Boshlash/ }).click();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    await page.waitForTimeout(500);
    const fps = await page.evaluate(
      () =>
        new Promise((res) => {
          const times = [];
          const f = (t) => {
            times.push(t);
            if (times.length < 180) requestAnimationFrame(f);
            else {
              const d = times.slice(1).map((x, i) => x - times[i]).sort((a, b) => a - b);
              res({ avg: 1000 / (d.reduce((a, b) => a + b, 0) / d.length), p95: d[Math.floor(d.length * 0.95)] });
            }
          };
          requestAnimationFrame(f);
        }),
    );
    console.log(`  CPU x${rate}: o'rtacha ${fps.avg.toFixed(0)} FPS, eng sekin 5% kadr ${fps.p95.toFixed(1)} ms`);
    if (fps.avg < (rate === 1 ? 50 : 30)) fail = true;
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(fail ? 'OT FPS: BYUDJETDAN PAST' : 'OT FPS: OK (oddiy >= 50, 4x sekin >= 30)');
process.exitCode = fail ? 1 : 0;
