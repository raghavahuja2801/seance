// Regression check for R-9: a snuffed candle must be visibly dark. The flame's
// flicker animation once animated opacity, which overrode `.out` and kept every
// candle burning. Asserts computed style, not class names. No API key needed.
// Requires the server running:
//   npm run check:browser   (PW_CHANNEL=chrome to use installed Chrome)
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8790/');
  const r = await page.evaluate(async () => {
    // A candle exactly as the room builds it, then lit, snuffed, and unlit.
    const mk = (cls) => {
      const c = document.createElement('div');
      c.className = `candle ${cls}`;
      c.innerHTML = '<div class="flame"></div><div class="smoke"></div>';
      document.body.append(c);
      return c;
    };
    const opacity = (c) => Number(getComputedStyle(c.querySelector('.flame')).opacity);
    const lit = mk('');
    const snuffed = mk('');
    const unlit = mk('unlit');
    await new Promise((r) => setTimeout(r, 300));
    snuffed.classList.add('out');
    await new Promise((r) => setTimeout(r, 800)); // past the .35s fade
    return { lit: opacity(lit), snuffed: opacity(snuffed), unlit: opacity(unlit) };
  });
  await browser.close();
  console.log(r);
  const ok = (cond, msg) => { if (!cond) { console.error('FAIL', msg); process.exitCode = 1; } else console.log('ok  ', msg); };
  ok(r.lit > 0.5, 'a lit candle shows its flame');
  ok(r.snuffed < 0.05, 'a snuffed candle is visibly dark');
  ok(r.unlit < 0.05, 'an unlit candle is visibly dark');
})();
