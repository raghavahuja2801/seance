import { AgentSession } from 'https://cdn.jsdelivr.net/npm/@fishaudio/agent-client@0.3.0/+esm';
import { boardLayout, intensityOf, spellSteps, stripDirections } from './lib.js';

const $ = (id) => document.getElementById(id);
const DEBUG = new URLSearchParams(location.search).has('debug');
const CANDLE_SPOTS = [[3, 18], [97, 18], [1, 70], [99, 70], [50, 104]]; // % of .table, around the board
const REST = { x: 50, y: 58 };

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
function movePlanchette({ x, y }) {
  planchette.style.left = `${x}%`;
  planchette.style.top = `${y}%`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
      await sleep(900);
      glyphs[step].classList.add('lit');
      $('spelled').textContent += step;
      await sleep(450);
      glyphs[step].classList.remove('lit');
    }
    await sleep(800);
    movePlanchette(REST);
    planchette.classList.add('drift');
  });
  return steps.join('');
}

// ---------- Candles ----------
function lightCandles() {
  $('candles').replaceChildren(
    ...CANDLE_SPOTS.map(([x, y]) => {
      const c = document.createElement('div');
      c.className = 'candle';
      c.style.left = `${x}%`;
      c.style.top = `${y}%`;
      c.innerHTML = '<div class="flame"></div>';
      return c;
    }),
  );
  updateLight();
}
function updateLight() {
  const all = document.querySelectorAll('.candle');
  const lit = document.querySelectorAll('.candle:not(.out)');
  document.documentElement.style.setProperty('--light', String(all.length ? lit.length / all.length : 1));
  return lit.length;
}
function snuffCandle() {
  const lit = [...document.querySelectorAll('.candle:not(.out)')];
  if (!lit.length) return { snuffed: false };
  lit[Math.floor(Math.random() * lit.length)].classList.add('out');
  return { snuffed: true, remaining: updateLight() };
}
function snuffAll() {
  document.querySelectorAll('.candle').forEach((c) => c.classList.add('out'));
  updateLight();
}

function shakeRoom(intensity) {
  const cls = `shake-${intensityOf(intensity)}`;
  document.body.classList.remove('shake-gentle', 'shake-violent');
  void document.body.offsetWidth; // restart the animation
  document.body.classList.add(cls);
  setTimeout(() => document.body.classList.remove(cls), 2000);
}

// ---------- Voice-reactive light ----------
let rafId = 0;
function pulse() {
  const data = session?.getOutputFrequencyData?.();
  let level = 0;
  if (data?.length) {
    let sum = 0;
    for (const v of data) sum += v;
    level = Math.min(1, sum / data.length / 90);
  }
  document.documentElement.style.setProperty('--voice', level.toFixed(3));
  rafId = requestAnimationFrame(pulse);
}

// ---------- Session ----------
const clientTools = {
  seance_spell: ({ text }) => ({ spelled: spell(text) }),
  seance_snuff_candle: () => snuffCandle(),
  seance_shake_room: ({ intensity }) => (shakeRoom(intensity), { shaken: intensityOf(intensity) }),
  seance_find_peace: () => {
    foundPeace = true;
    document.body.classList.add('peace');
    return { ok: true };
  },
};

const MODE_TEXT = { listening: 'The spirit is listening…', thinking: 'The air grows cold…', speaking: '' };

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
    if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);

    document.body.className = '';
    $('ghost-name').textContent = g.name;
    $('status').textContent = 'Reaching across the veil…';
    $('spirit').textContent = $('you').textContent = $('spelled').textContent = '';
    lightCandles();
    movePlanchette(REST);
    planchette.classList.add('drift');
    show('room');

    session = await AgentSession.start({ sessionToken: body, clientTools });
    log('connected', session.sessionId, g.id);

    session.on('modeChange', (mode) => {
      document.body.dataset.mode = mode;
      $('status').textContent = MODE_TEXT[mode] ?? '';
    });
    session.on('agentResponseDelta', ({ text }) => ($('spirit').textContent = stripDirections(text)));
    session.on('agentResponse', ({ text }) => {
      log('ghost:', text); // raw: shows whether Drama 3 [directions] arrive in the transcript
      $('spirit').textContent = stripDirections(text);
    });
    session.on('userTranscript', ({ text }) => ($('you').textContent = text));
    session.on('toolCallStarted', ({ toolName, input }) => log('tool:', toolName, input));
    session.on('toolCallFailed', ({ toolName, error }) => log('tool failed:', toolName, error));
    session.on('error', (err) => log('error:', err.code, err.message));
    session.on('disconnect', ({ reason }) => finish(reason));
    rafId = requestAnimationFrame(pulse);
  } catch (err) {
    log('summon failed', err?.code ?? '', err?.message ?? String(err));
    const micDenied = err?.code === 'mic_permission_denied';
    endingScreen(
      'The spirits are silent',
      micDenied ? 'They need to hear your voice. Allow the microphone and try again.' : 'Nothing answered from beyond. Try again in a moment.',
    );
  } finally {
    button.removeAttribute('aria-busy');
  }
}

function finish(reason) {
  log('ended:', reason, 'peace=', foundPeace);
  cancelAnimationFrame(rafId);
  document.documentElement.style.setProperty('--voice', '0');
  session = null;
  const name = ghost?.name ?? 'The spirit';
  if (foundPeace) {
    document.body.classList.add('peace');
    endingScreen(`${name} is at peace`, 'The cold lifts. Somewhere, a candle relights itself. Thank you for listening.');
  } else if (reason === 'agent_hangup') {
    snuffAll();
    document.body.classList.add('wrath');
    endingScreen(`${name} has left in anger`, 'Every flame dies at once. The circle is broken, and the truth stays buried.');
  } else if (reason === 'user_hangup') {
    endingScreen('You closed the circle', `${name} drifts back into the dark, still restless.`);
  } else {
    endingScreen('The spirits have gone quiet', 'The connection to the other side was lost.');
  }
}

function endingScreen(title, text) {
  // Let the last effect play before the room fades out.
  setTimeout(() => {
    $('ending-title').textContent = title;
    $('ending-text').textContent = text;
    show('ending');
  }, 1800);
}

$('end').addEventListener('click', () => session?.end());
$('again').addEventListener('click', () => {
  document.body.className = '';
  show('summon');
});

// ---------- Picker ----------
const ghosts = await (await fetch('/api/ghosts')).json();
$('ghosts').replaceChildren(
  ...ghosts.map((g) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.innerHTML = '<span class="name"></span><span class="epitaph"></span>';
    b.querySelector('.name').textContent = g.name;
    b.querySelector('.epitaph').textContent = g.epitaph;
    b.addEventListener('click', () => summon(g, b));
    li.append(b);
    return li;
  }),
);
