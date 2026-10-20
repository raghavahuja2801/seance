import { boardLayout, intensityOf, spellSteps, stripDirections } from './lib.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@fishaudio/agent-client@0.3.0/+esm';
const $ = (id) => document.getElementById(id);
const DEBUG = new URLSearchParams(location.search).has('debug');
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FOOTLIGHTS = 5;
const REST = { x: 50, y: 58 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let AgentSession = null; // loaded by the loader
let session = null;
let ghost = null;
let foundPeace = false;

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
    for (const step of steps) {
      if (step === ' ') {
        movePlanchette(REST);
        await sleep(600);
        continue;
      }
      movePlanchette(spots[step]);
      await sleep(950);
      // What the spirit spells stays inked on the board.
      glyphs[step].classList.add('lit', 'inked');
      await sleep(450);
      glyphs[step].classList.remove('lit');
    }
    if (steps.length) record(steps.join(''));
    await sleep(800);
    movePlanchette(REST);
    planchette.style.setProperty('--tilt', '0deg');
    planchette.classList.add('drift');
  });
  return steps.join('');
}

// Each spelled word joins the record beside the board, newest on top, rising as the truth builds.
function record(word) {
  const li = document.createElement('li');
  li.className = 'print';
  li.textContent = word;
  $('record').append(li);
}

// ---------- Candles ----------
function placeCandles() {
  $('candles').replaceChildren(
    ...Array.from({ length: FOOTLIGHTS }, () => {
      const c = document.createElement('div');
      c.className = 'candle unlit';
      c.innerHTML = '<div class="flame"></div><div class="smoke"></div>';
      return c;
    }),
  );
  updateLight();
}
async function lightCandles() {
  for (const c of document.querySelectorAll('.candle.unlit')) {
    c.classList.remove('unlit');
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
  return { snuffed: true, remaining: updateLight() };
}
function snuffAll() {
  document.querySelectorAll('.candle').forEach((c) => c.classList.add('out'));
  updateLight();
}
function relightAll() {
  document.querySelectorAll('.candle').forEach((c) => c.classList.remove('out', 'unlit'));
  updateLight();
}

function shakeRoom(intensity) {
  const cls = `shake-${intensityOf(intensity)}`;
  document.body.classList.remove('shake-gentle', 'shake-violent');
  void document.body.offsetWidth; // restart the animation
  document.body.classList.add(cls);
  setTimeout(() => document.body.classList.remove(cls), 2000);
}

// ---------- Captions: words surface like ink ----------
function renderSpirit(text) {
  const el = $('spirit');
  const clean = stripDirections(text);
  const words = clean.split(' ').filter(Boolean);
  // Short lines are set huge; long ones step down so a whole line stays on stage.
  el.style.setProperty('--fit', clean.length <= 50 ? '4.6rem' : clean.length <= 100 ? '3.4rem' : clean.length <= 170 ? '2.5rem' : '2rem');
  const spans = el.children;
  for (let i = 0; i < words.length; i++) {
    const word = words[i] + (i < words.length - 1 ? ' ' : '');
    if (spans[i]) {
      if (spans[i].textContent !== word) spans[i].textContent = word; // refined in place, no re-animation
    } else {
      const s = document.createElement('span');
      s.className = 'w print';
      s.textContent = word;
      el.append(s);
    }
  }
  while (spans.length > words.length) spans[spans.length - 1].remove();
}

// ---------- Ambient loop: gaslight flicker and the spirit's voice ----------
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

const MODE_TEXT = { listening: 'The spirit listens. Speak.', thinking: 'The spirit is thinking', speaking: '' };
const setStatus = (text) => ($('status').querySelector('.label').textContent = text);

async function summon(g, button) {
  ghost = g;
  foundPeace = false;
  button.setAttribute('aria-busy', 'true');
  try {
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ghost: g.id }),
    });
    const body = await res.json();
    if (!res.ok) throw Object.assign(new Error(body.error ?? `HTTP ${res.status}`), { status: res.status });

    document.body.className = '';
    delete document.body.dataset.mode;
    $('ghost-name').textContent = g.name;
    setStatus('Reaching across the veil…');
    $('record').replaceChildren();
    Object.values(glyphs).forEach((el) => el.classList.remove('inked', 'lit'));
    $('spirit').replaceChildren();
    $('you').textContent = '';
    placeCandles();
    movePlanchette(REST);
    planchette.classList.add('drift');
    show('room');
    const lighting = lightCandles();

    session = await AgentSession.start({ sessionToken: body, clientTools });
    session.setOutputVolume(g.gain ?? 1); // some voices run hot; keep every spirit at a similar level
    await lighting;
    log('connected', session.sessionId, g.id);
    if (DEBUG) window.__session = session; // lets tests type to the spirit (see scripts/check-candles.cjs)

    session.on('modeChange', (mode) => {
      document.body.dataset.mode = mode;
      setStatus(MODE_TEXT[mode] ?? '');
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
      err?.status === 429 ? 'The spirits are weary' : 'The spirits are silent',
      err?.status === 429
        ? 'Too many séances have been held tonight. Rest a while, then try again in a few minutes.'
        : micDenied ? 'They need to hear your voice. Allow the microphone and try again.' : 'Nothing answered from beyond. Try again in a moment.',
      'silent',
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
    document.body.classList.add('peace');
    endingScreen(`${name} is at peace`, 'The cold lifts. Every candle burns warm again. Thank you for listening.', 'peace');
  } else if (reason === 'agent_hangup') {
    snuffAll();
    document.body.classList.add('wrath');
    endingScreen(`${name} has left in anger`, 'Every flame dies at once. The circle is broken, and the truth stays buried.', 'wrath');
  } else if (reason === 'user_hangup') {
    endingScreen('You closed the circle', `${name} drifts back into the dark, still restless.`, 'closed');
  } else {
    endingScreen('The spirits have gone quiet', 'The connection to the other side was lost.', 'lost');
  }
}

// Each ending is a printed notice with its own stamp, pasted over the bill.
const STAMPS = { peace: 'At peace', wrath: 'Cancelled', closed: 'Curtain down', lost: 'Interrupted', silent: 'No answer' };

function endingScreen(title, text, kind, delay = 1800) {
  // Let the last effect play before the room fades out.
  setTimeout(() => {
    $('ending').dataset.kind = kind;
    $('ending-stamp').textContent = STAMPS[kind];
    $('ending-title').textContent = title;
    $('ending-text').textContent = text;
    const words = [...$('record').children].map((li) => li.textContent);
    $('ending-record').innerHTML = words.length ? '<b>From beyond:</b> ' : '';
    $('ending-record').append(words.join(' · '));
    show('ending');
  }, delay);
}

$('end').addEventListener('click', () => session?.end());
$('again').addEventListener('click', () => {
  document.body.className = '';
  show('summon');
});

// ---------- The bill ----------
// One audio element for every preview, so only one spirit speaks at a time.
const preview = new Audio();
let previewing = null;
function stopPreview() {
  preview.pause();
  previewing?.setAttribute('aria-pressed', 'false');
  previewing = null;
}
preview.addEventListener('ended', stopPreview);

function hear(g, button) {
  const again = previewing === button;
  stopPreview();
  if (again) return;
  preview.src = `voices/${g.id}.mp3`; // previews are levelled at render time, so no gain here
  preview.play().catch((err) => log('preview failed', err?.message ?? String(err)));
  button.setAttribute('aria-pressed', 'true');
  previewing = button;
}

function renderGhosts(ghosts) {
  $('ghosts').replaceChildren(
    ...ghosts.map((g, i) => {
      // Epitaphs read "role · dates · “cover story”"; the bill sets each part in its own type.
      const [role, dates, story] = g.epitaph.split(' · ');
      const li = document.createElement('li');
      li.className = 'act print';
      li.style.setProperty('--d', `${0.45 + i * 0.08}s`);
      li.innerHTML = `<div><h3 class="act-name ink"></h3><p class="act-role"></p><p class="act-meta"><span class="dates"></span> · <q></q></p></div>
        <div class="act-actions">
          <button class="btn hear" aria-pressed="false"><svg class="icon" aria-hidden="true"><use href="#i-play"/></svg>Hear</button>
          <button class="btn btn-stamp summon">Summon</button>
        </div>`;
      li.querySelector('.act-name').textContent = g.name;
      li.querySelector('.act-role').textContent = role;
      li.querySelector('.dates').textContent = dates;
      li.querySelector('q').textContent = story;
      const hearBtn = li.querySelector('.hear');
      hearBtn.setAttribute('aria-label', `Hear ${g.name}`);
      hearBtn.addEventListener('click', () => hear(g, hearBtn));
      const summonBtn = li.querySelector('.summon');
      summonBtn.setAttribute('aria-label', `Summon ${g.name}`);
      summonBtn.addEventListener('click', () => {
        stopPreview();
        summon(g, summonBtn);
      });
      return li;
    }),
  );
}

// ---------- Loader ----------
const LOADER_LINES = ['Setting the type…', 'Inking the plates…', 'Pasting up the bill…'];
async function boot() {
  const loader = $('loader');
  const fill = $('loader-fill');
  let done = 0;
  const tick = () => {
    done++;
    fill.style.transform = `scaleX(${done / 3})`;
    $('loader-text').textContent = LOADER_LINES[Math.min(done, LOADER_LINES.length - 1)];
  };
  try {
    const [, , ghosts] = await Promise.all([
      document.fonts.ready.then(tick),
      import(SDK_URL).then((m) => { AgentSession = m.AgentSession; }).then(tick),
      fetch('/api/ghosts').then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }).then((g) => (tick(), g)),
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
