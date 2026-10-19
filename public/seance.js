import { boardLayout, intensityOf, spellSteps, stripDirections } from './lib.js';
import { createAmbience } from './ambience.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@fishaudio/agent-client@0.3.0/+esm';
const $ = (id) => document.getElementById(id);
const DEBUG = new URLSearchParams(location.search).has('debug');
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CANDLE_SPOTS = [[4, 22], [96, 22], [2, 74], [98, 74], [50, 100]]; // % of .table, around the board
const REST = { x: 50, y: 58 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let AgentSession = null; // loaded by the loader
let session = null;
let ghost = null;
let foundPeace = false;
let ambience = null; // created on the first summon click: browsers unlock audio only inside a user gesture

const MUTE_KEY = 'seance.muted';
function savedMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}
function setMuted(muted) {
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* private mode: not remembered */ }
  ambience?.setMuted(muted);
  $('mute').setAttribute('aria-pressed', String(muted));
  $('mute').setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
}

function log(...args) {
  console.log('[seance]', ...args);
  if (!DEBUG) return;
  const el = $('debug');
  el.hidden = false;
  el.textContent += args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n';
  el.scrollTop = el.scrollHeight;
}

function show(screenId) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === screenId));
  // Move focus to the new screen's heading for keyboard and screen-reader users.
  $(screenId).querySelector('h1, h2')?.setAttribute('tabindex', '-1');
  $(screenId).querySelector('h1, h2')?.focus({ preventScroll: true });
}

// ---------- Board ----------
const spots = boardLayout();
const glyphs = {};
for (const [key, { x, y, r }] of Object.entries(spots)) {
  const el = document.createElement('span');
  el.className = 'glyph' + (key.length > 1 ? ' word' : '');
  el.textContent = key;
  el.style.left = `${x}%`;
  el.style.top = `${y}%`;
  el.style.setProperty('--r', `${r}deg`);
  $('board').append(el);
  glyphs[key] = el;
}

const planchette = $('planchette');
let planchetteAt = REST;
function movePlanchette(to) {
  // Lean into the direction of travel, like a hand pushing it.
  const tilt = Math.max(-16, Math.min(16, (to.x - planchetteAt.x) * 0.5));
  planchette.style.setProperty('--tilt', `${tilt}deg`);
  planchette.style.left = `${to.x}%`;
  planchette.style.top = `${to.y}%`;
  planchetteAt = to;
}

let spelling = Promise.resolve(); // spells queue so two calls never fight over the planchette
function spell(raw) {
  const steps = spellSteps(raw);
  spelling = spelling.then(async () => {
    planchette.classList.remove('drift');
    $('spelled').textContent = '';
    for (const step of steps) {
      if (step === ' ') {
        movePlanchette(REST);
        $('spelled').textContent += ' ';
        await sleep(600);
        continue;
      }
      movePlanchette(spots[step]);
      ambience?.slide(0.9);
      await sleep(950);
      glyphs[step].classList.add('lit');
      $('spelled').textContent += step;
      await sleep(450);
      glyphs[step].classList.remove('lit');
    }
    await sleep(800);
    movePlanchette(REST);
    planchette.style.setProperty('--tilt', '0deg');
    planchette.classList.add('drift');
  });
  return steps.join('');
}

// ---------- Candles ----------
function placeCandles() {
  $('candles').replaceChildren(
    ...CANDLE_SPOTS.map(([x, y]) => {
      const c = document.createElement('div');
      c.className = 'candle unlit';
      c.style.left = `${x}%`;
      c.style.top = `${y}%`;
      c.innerHTML = '<div class="flame"></div><div class="smoke"></div>';
      return c;
    }),
  );
  updateLight();
}
async function lightCandles() {
  for (const c of document.querySelectorAll('.candle.unlit')) {
    c.classList.remove('unlit');
    ambience?.light();
    updateLight();
    await sleep(REDUCED_MOTION ? 0 : 280);
  }
}
function updateLight() {
  const all = document.querySelectorAll('.candle');
  const lit = document.querySelectorAll('.candle:not(.out):not(.unlit)');
  document.documentElement.style.setProperty('--light', String(all.length ? Math.max(0.15, lit.length / all.length) : 1));
  return lit.length;
}
function snuffCandle() {
  const lit = [...document.querySelectorAll('.candle:not(.out):not(.unlit)')];
  if (!lit.length) return { snuffed: false };
  lit[Math.floor(Math.random() * lit.length)].classList.add('out');
  ambience?.snuff();
  return { snuffed: true, remaining: updateLight() };
}
function snuffAll() {
  document.querySelectorAll('.candle').forEach((c) => c.classList.add('out'));
  updateLight();
}
function relightAll() {
  document.querySelectorAll('.candle').forEach((c) => c.classList.remove('out', 'unlit'));
  ambience?.light();
  updateLight();
}

function shakeRoom(intensity) {
  const cls = `shake-${intensityOf(intensity)}`;
  document.body.classList.remove('shake-gentle', 'shake-violent');
  void document.body.offsetWidth; // restart the animation
  document.body.classList.add(cls);
  ambience?.creak(intensityOf(intensity));
  setTimeout(() => document.body.classList.remove(cls), 2000);
}

// ---------- Captions: words surface like ink ----------
function renderSpirit(text) {
  const el = $('spirit');
  const words = stripDirections(text).split(' ').filter(Boolean);
  const spans = el.children;
  for (let i = 0; i < words.length; i++) {
    const word = words[i] + (i < words.length - 1 ? ' ' : '');
    if (spans[i]) {
      if (spans[i].textContent !== word) spans[i].textContent = word; // refined in place, no re-animation
    } else {
      const s = document.createElement('span');
      s.className = 'w';
      s.textContent = word;
      el.append(s);
    }
  }
  while (spans.length > words.length) spans[spans.length - 1].remove();
}

// ---------- Ambient loop: flicker, voice glow, dust ----------
const dust = $('dust');
const dctx = dust.getContext('2d');
let motes = [];
function sizeDust() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  dust.width = innerWidth * dpr;
  dust.height = innerHeight * dpr;
  dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  motes = Array.from({ length: innerWidth < 640 ? 22 : 45 }, () => ({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    r: 0.6 + Math.random() * 1.6,
    vx: (Math.random() - 0.5) * 0.12,
    vy: -0.05 - Math.random() * 0.15,
    a: 0.15 + Math.random() * 0.35,
  }));
}
sizeDust();
addEventListener('resize', sizeDust);

let flicker = 0;
function frame() {
  const root = document.documentElement.style;
  if (!REDUCED_MOTION) {
    // Smoothed random walk: candlelight that breathes rather than strobes.
    flicker += (Math.random() * 2 - 1 - flicker) * 0.08;
    root.setProperty('--flicker', flicker.toFixed(3));
  }

  let level = 0;
  const data = session?.getOutputFrequencyData?.();
  if (data?.length) {
    let sum = 0;
    for (const v of data) sum += v;
    level = Math.min(1, sum / data.length / 90);
  }
  root.setProperty('--voice', level.toFixed(3));
  ambience?.duck(level);
  if (REDUCED_MOTION) return requestAnimationFrame(frame);

  dctx.clearRect(0, 0, innerWidth, innerHeight);
  for (const m of motes) {
    m.x += m.vx + flicker * 0.05;
    m.y += m.vy;
    if (m.y < -5) { m.y = innerHeight + 5; m.x = Math.random() * innerWidth; }
    dctx.beginPath();
    dctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    dctx.fillStyle = `rgba(255, 210, 150, ${(m.a * (0.8 + level * 0.8)).toFixed(3)})`;
    dctx.fill();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- Session ----------
const clientTools = {
  seance_spell: ({ text }) => ({ spelled: spell(text) }),
  seance_snuff_candle: () => snuffCandle(),
  seance_shake_room: ({ intensity }) => (shakeRoom(intensity), { shaken: intensityOf(intensity) }),
  seance_find_peace: () => {
    foundPeace = true;
    document.body.classList.add('peace');
    relightAll();
    return { ok: true };
  },
};

const MODE_TEXT = { listening: 'The spirit is listening… speak.', thinking: 'The air grows cold…', speaking: '' };

async function summon(g, button) {
  ghost = g;
  foundPeace = false;
  button.setAttribute('aria-busy', 'true');
  try {
    ambience ??= createAmbience();
    ambience.setMuted(savedMuted());
    ambience.start();
    if (DEBUG) window.__ambience = ambience;
  } catch (err) {
    log('no audio:', err?.message ?? String(err)); // the séance still works silently
  }
  try {
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ghost: g.id }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);

    document.body.className = '';
    $('ghost-name').textContent = g.name;
    $('status').textContent = 'Reaching across the veil…';
    $('spirit').replaceChildren();
    $('you').textContent = $('spelled').textContent = '';
    placeCandles();
    movePlanchette(REST);
    planchette.classList.add('drift');
    show('room');
    const lighting = lightCandles();

    session = await AgentSession.start({ sessionToken: body, clientTools });
    await lighting;
    log('connected', session.sessionId, g.id);
    if (DEBUG) window.__session = session; // lets tests type to the spirit (see scripts/check-candles.cjs)

    session.on('modeChange', (mode) => {
      document.body.dataset.mode = mode;
      $('status').textContent = MODE_TEXT[mode] ?? '';
    });
    let lastSegment = null;
    const onAgentText = ({ segmentId, text }) => {
      if (segmentId !== lastSegment) {
        lastSegment = segmentId; // a new line from the spirit: clear the old words so the new ones surface fresh
        $('spirit').replaceChildren();
      }
      renderSpirit(text);
    };
    session.on('agentResponseDelta', onAgentText);
    session.on('agentResponse', (e) => {
      log('ghost:', e.text);
      onAgentText(e);
    });
    session.on('userTranscript', ({ text }) => ($('you').textContent = text));
    session.on('toolCallStarted', ({ toolName, input }) => log('tool:', toolName, input));
    session.on('toolCallFailed', ({ toolName, error }) => log('tool failed:', toolName, error));
    session.on('error', (err) => log('error:', err.code, err.message));
    session.on('disconnect', ({ reason }) => finish(reason));
  } catch (err) {
    log('summon failed', err?.code ?? '', err?.message ?? String(err));
    const micDenied = err?.code === 'mic_permission_denied';
    endingScreen(
      'The spirits are silent',
      micDenied ? 'They need to hear your voice. Allow the microphone and try again.' : 'Nothing answered from beyond. Try again in a moment.',
      0,
    );
  } finally {
    button.removeAttribute('aria-busy');
  }
}

function finish(reason) {
  log('ended:', reason, 'peace=', foundPeace);
  session = null;
  const name = ghost?.name ?? 'The spirit';
  if (foundPeace) {
    ambience?.peace();
    document.body.classList.add('peace');
    endingScreen(`${name} is at peace`, 'The cold lifts. Every candle burns warm again. Thank you for listening.');
  } else if (reason === 'agent_hangup') {
    snuffAll();
    ambience?.wrath();
    document.body.classList.add('wrath');
    endingScreen(`${name} has left in anger`, 'Every flame dies at once. The circle is broken, and the truth stays buried.');
  } else if (reason === 'user_hangup') {
    endingScreen('You closed the circle', `${name} drifts back into the dark, still restless.`);
  } else {
    endingScreen('The spirits have gone quiet', 'The connection to the other side was lost.');
  }
}

function endingScreen(title, text, delay = 1800) {
  // Let the last effect play before the room fades out.
  setTimeout(() => {
    ambience?.stop();
    $('ending-title').textContent = title;
    $('ending-text').textContent = text;
    show('ending');
  }, delay);
}

$('end').addEventListener('click', () => session?.end());
$('mute').addEventListener('click', () => setMuted($('mute').getAttribute('aria-pressed') !== 'true'));
setMuted(savedMuted());
$('again').addEventListener('click', () => {
  document.body.className = '';
  show('summon');
});

// ---------- Picker ----------
const SIGILS = {
  eleanor: '<path d="M17 3v28M5 10l24 14M29 10L5 24M13 5l4 4 4-4M13 29l4-4 4 4"/>', // frost
  lou: '<path d="M12 26a4 4 0 1 1-1-3V6l14-3v19a4 4 0 1 1-1-3V8L12 10"/>', // note
  silas: '<path d="M14 31l2-20h2l2 20zM13 11h8M17 11V7M17 7l-12-4M17 7l12-4M11 31h12"/>', // lighthouse
  agnes: '<path d="M17 3v6M17 9c-5 0-8 4-8 9 0 6 4 13 8 13s8-7 8-13c0-5-3-9-8-9zM12 20h10"/>', // noose-knot apple
  tommy: '<path d="M14 6h6v4h-6zM12 10h10v6H12zM13 16h8l-1 14h-6zM10 12h2M22 12h2"/>', // tin soldier
  marvello: '<path d="M10 25h14M12 25l1-14h8l1 14M9 11h16M14 6l-3-3M20 6l3-3M17 6V2"/>', // top hat and sparks
};
function renderGhosts(ghosts) {
  $('ghosts').replaceChildren(
    ...ghosts.map((g) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.innerHTML = `<svg class="sigil" viewBox="0 0 34 34" aria-hidden="true">${SIGILS[g.id] ?? '<circle cx="17" cy="17" r="10"/>'}</svg><span class="name"></span><span class="epitaph"></span>`;
      b.querySelector('.name').textContent = g.name;
      b.querySelector('.epitaph').textContent = g.epitaph;
      b.addEventListener('click', () => summon(g, b));
      li.append(b);
      return li;
    }),
  );
}

// ---------- Loader ----------
const LOADER_LINES = ['Drawing the curtains…', 'Lighting the candle…', 'Waking the spirits…'];
async function boot() {
  const loader = $('loader');
  const fill = $('loader-fill');
  let done = 0;
  const tick = (i) => () => {
    done++;
    fill.style.transform = `scaleX(${done / 3})`;
    $('loader-text').textContent = LOADER_LINES[Math.min(done, LOADER_LINES.length - 1)];
    if (i === 0) loader.classList.add('lit');
  };
  try {
    const [, , ghosts] = await Promise.all([
      document.fonts.ready.then(tick(0)),
      import(SDK_URL).then((m) => { AgentSession = m.AgentSession; }).then(tick(1)),
      fetch('/api/ghosts').then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }).then((g) => (tick(2)(), g)),
      sleep(REDUCED_MOTION ? 0 : 1600), // long enough to read as a ritual, not a flash
    ]);
    renderGhosts(ghosts);
    $('loader-text').textContent = 'The spirits are waiting.';
    await sleep(REDUCED_MOTION ? 0 : 500);
    loader.classList.add('done');
    document.body.removeAttribute('aria-busy');
    show('summon');
  } catch (err) {
    log('boot failed', err?.message ?? String(err));
    $('loader-text').textContent = 'The spirits cannot be reached. Check your connection.';
    $('loader-retry').hidden = false;
  }
}
$('loader-retry').addEventListener('click', () => location.reload());
boot();
