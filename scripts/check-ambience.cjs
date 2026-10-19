// Render the ambience offline in headless Chrome and assert on its levels.
// Requires the server running (npm start) and Playwright + Chrome; run:
//   npm run check:browser   (PW_CHANNEL=chrome to use installed Chrome instead of Playwright's Chromium)
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8790/');
  const r = await page.evaluate(async () => {
    const { createAmbience } = await import('/ambience.js');
    const render = async (script, seconds = 6) => {
      const ctx = new OfflineAudioContext(1, 44100 * seconds, 44100);
      const a = createAmbience(ctx);
      await a.start();
      script(a, ctx);
      const buf = await ctx.startRendering();
      const d = buf.getChannelData(0);
      const rms = (from, to) => {
        let s = 0;
        for (let i = from * 44100; i < to * 44100; i++) s += d[i] * d[i];
        return Math.sqrt(s / ((to - from) * 44100));
      };
      return { rms, peak: d.reduce((m, v) => Math.max(m, Math.abs(v)), 0) };
    };
    const at = (ctx, t, fn) => ctx.suspend(t).then(() => { fn(); ctx.resume(); });
    const base = await render(() => {});
    const fx = await render((a, ctx) => { at(ctx, 4, () => a.creak('violent')); });
    const ducked = await render((a, ctx) => { at(ctx, 3.5, () => a.duck(1)); });
    const muted = await render((a) => a.setMuted(true));
    return {
      bed: base.rms(4, 6), creak: fx.rms(4, 5.5), ducked: ducked.rms(4.5, 6),
      muted: muted.rms(1, 6), peak: Math.max(base.peak, fx.peak),
    };
  });
  await browser.close();
  console.log(r);
  const ok = (cond, msg) => { if (!cond) { console.error('FAIL', msg); process.exitCode = 1; } else console.log('ok  ', msg); };
  ok(r.bed > 0.005 && r.bed < 0.06, 'bed is audible but sits well under a voice');
  ok(r.creak > r.bed * 2, 'a violent creak stands out above the bed (+6 dB)');
  ok(r.ducked < r.bed * 0.6, 'bed ducks under the spirit voice');
  ok(r.muted < 0.0005, 'mute is silent');
  ok(r.peak < 1, 'no clipping');
})();
