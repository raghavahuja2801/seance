// End to end: a live ghost snuffs a candle and the flame is visibly gone.
// Costs ~30 s of agent time. Requires the server (npm start), Playwright and Chrome:
//   node scripts/check-candles.cjs   (PW_CHANNEL=chrome to use installed Chrome)
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  page.on('console', (m) => m.text().startsWith('[seance] tool') && console.log(m.text()));
  await page.goto('http://127.0.0.1:8790/?debug');
  await page.waitForSelector('#summon.active');
  await page.locator('#ghosts li', { hasText: 'Lou' }).locator('.summon').click();
  await page.waitForFunction(() => window.__session, null, { timeout: 30000 });
  await page.waitForTimeout(6000); // let her finish the first line
  await page.evaluate(() => window.__session.sendUserMessage("Honestly this is boring. Hurry up, I don't have all night.", { audio: true }));
  await page.waitForFunction(() => document.querySelector('.candle.out'), null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(800);
  const r = await page.evaluate(() =>
    [...document.querySelectorAll('.candle')].map((c) => ({ out: c.classList.contains('out'), opacity: Number(getComputedStyle(c.querySelector('.flame')).opacity) })),
  );
  await page.evaluate(() => window.__session?.end());
  await browser.close();
  const dark = r.filter((c) => c.out && c.opacity < 0.05).length;
  console.log(r.map((c) => (c.opacity < 0.05 ? 'dark' : 'lit')).join(' '));
  console.log(dark ? `ok   ${dark} candle(s) visibly out` : 'FAIL no candle visibly went out');
  process.exitCode = dark ? 0 : 1;
})();
