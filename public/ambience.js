// Room sound, synthesized with Web Audio: no files to load or license.
// Create it from a user gesture (browsers keep audio locked until one).

// `ctx` is injectable so the sound can be rendered offline and measured (see scripts/check-ambience.cjs).
export function createAmbience(ctx = new AudioContext()) {
  const master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10; // only catch real peaks; the defaults (-24 dB, 12:1) flatten every effect into the bed
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  master.gain.value = 0;

  // Bed (drone + wind) runs through a duck stage so it sinks under the spirit's voice.
  const bed = ctx.createGain();
  bed.gain.value = 1;
  bed.connect(master);

  const noise = noiseBuffer(ctx, 4);
  const now = () => ctx.currentTime;
  let muted = false;
  let running = false;
  const sources = [];

  function startBed() {
    // Drone: two detuned low tones through a dark filter, slowly breathing.
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 260;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.022;
    droneFilter.connect(droneGain).connect(bed);
    for (const [freq, type] of [[55, 'sawtooth'], [82.6, 'triangle'], [54.6, 'sine']]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.connect(droneFilter);
      o.start();
      sources.push(o);
    }
    sources.push(lfo(ctx, 0.06, 0.01, droneGain.gain));

    // Wind: looped noise through a wandering band-pass.
    const wind = ctx.createBufferSource();
    wind.buffer = noise;
    wind.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 0.9;
    band.frequency.value = 520;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.03;
    wind.connect(band).connect(windGain).connect(bed);
    wind.start();
    sources.push(wind, lfo(ctx, 0.045, 260, band.frequency), lfo(ctx, 0.11, 0.015, windGain.gain));
  }

  /** One-shot: filtered noise burst with an envelope. */
  function burst({ type = 'bandpass', freq = 1000, q = 1, gain = 0.2, attack = 0.005, decay = 0.3, sweepTo, at = now() }) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, at);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + decay);
    f.Q.value = q;
    const g = ctx.createGain();
    envelope(g.gain, at, gain, attack, decay);
    src.connect(f).connect(g).connect(master);
    src.start(at, Math.random() * 3);
    src.stop(at + attack + decay + 0.05);
  }

  /** One-shot: an oscillator with an envelope and optional pitch glide. */
  function tone({ type = 'sine', freq, to, gain = 0.15, attack = 0.01, decay = 0.6, at = now(), dest = master }) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (to) o.frequency.exponentialRampToValueAtTime(to, at + attack + decay);
    const g = ctx.createGain();
    envelope(g.gain, at, gain, attack, decay);
    o.connect(g).connect(dest);
    o.start(at);
    o.stop(at + attack + decay + 0.05);
  }

  function level(target, seconds) {
    master.gain.cancelScheduledValues(now());
    master.gain.setTargetAtTime(muted ? 0 : target, now(), seconds / 3);
  }

  return {
    get muted() { return muted; },
    async start() {
      if (ctx.state === 'suspended' && !(ctx instanceof OfflineAudioContext)) await ctx.resume();
      if (!running) { startBed(); running = true; }
      level(0.9, 3);
    },
    stop() { level(0, 2.5); },
    setMuted(value) {
      muted = value;
      level(value || !running ? 0 : 0.9, 0.4);
    },
    /** 0..1 voice level from the agent's audio: the bed sinks while the spirit speaks. */
    duck(voice) { bed.gain.setTargetAtTime(1 - Math.min(1, voice * 1.6) * 0.65, now(), 0.12); },
    light() { burst({ type: 'highpass', freq: 3000, gain: 0.05, attack: 0.01, decay: 0.25 }); },
    snuff() {
      burst({ type: 'highpass', freq: 2200, gain: 0.16, attack: 0.01, decay: 0.45 });
      burst({ type: 'lowpass', freq: 400, gain: 0.12, attack: 0.02, decay: 0.3 });
    },
    /** The planchette sliding over wood toward the next letter. */
    slide(seconds = 0.9) { burst({ type: 'bandpass', freq: 380, q: 0.7, gain: 0.05, attack: seconds * 0.4, decay: seconds * 0.6, sweepTo: 260 }); },
    /** The planchette settling on a letter. */
    tick() { burst({ type: 'bandpass', freq: 1700, q: 3, gain: 0.25, attack: 0.002, decay: 0.05 }); },
    creak(intensity) {
      const t = now();
      // A strained wooden creak: a rough low saw, wobbling in pitch, through a nasal band.
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 700;
      band.Q.value = 3;
      band.connect(master);
      for (let i = 0; i < (intensity === 'violent' ? 3 : 1); i++) {
        tone({ type: 'sawtooth', freq: 95 + Math.random() * 30, to: 60 + Math.random() * 20, gain: 0.35, attack: 0.05, decay: 0.9, at: t + i * 0.35, dest: band });
      }
      if (intensity === 'violent') {
        tone({ freq: 70, to: 35, gain: 0.5, attack: 0.005, decay: 1.2, at: t });
        burst({ type: 'lowpass', freq: 180, gain: 0.35, attack: 0.02, decay: 1.6, at: t });
      }
    },
    peace() {
      const t = now();
      for (const [i, f] of [220, 277.2, 329.6, 440].entries()) tone({ type: 'sine', freq: f, gain: 0.06, attack: 1.2 + i * 0.2, decay: 3.5, at: t });
      level(0.35, 4);
    },
    wrath() {
      const t = now();
      for (const f of [58, 61.7, 87.3]) tone({ type: 'sawtooth', freq: f, to: f * 0.7, gain: 0.12, attack: 0.02, decay: 2.2, at: t });
      burst({ type: 'highpass', freq: 1800, gain: 0.25, attack: 0.01, decay: 0.8, at: t });
    },
  };
}

function noiseBuffer(ctx, seconds) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function lfo(ctx, rate, depth, param) {
  const o = ctx.createOscillator();
  o.frequency.value = rate;
  const g = ctx.createGain();
  g.gain.value = depth;
  o.connect(g).connect(param);
  o.start();
  return o;
}

function envelope(param, at, peak, attack, decay) {
  param.setValueAtTime(0.0001, at);
  param.exponentialRampToValueAtTime(peak, at + attack);
  param.exponentialRampToValueAtTime(0.0001, at + attack + decay);
}
