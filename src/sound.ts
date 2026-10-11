// Every sound in the game, synthesized with the Web Audio API. No audio
// files to download or license; each sound is a few oscillators, a noise
// burst and an envelope.
//
// Browsers only allow audio after a tap or click, so nothing plays until
// `unlock()` runs from a user gesture (the title screen's Start button).

type Bus = "sfx" | "amb" | "music";

let ctx: AudioContext | null = null;
let master: GainNode, buses: Record<Bus, GainNode>, noise: AudioBuffer;

const prefs = { sound: true, music: true };
try {
  const saved = JSON.parse(localStorage.getItem("catworld:audio") ?? "null");
  if (saved) Object.assign(prefs, saved);
} catch { /* private mode: defaults */ }
const savePrefs = () => { try { localStorage.setItem("catworld:audio", JSON.stringify(prefs)); } catch { /* ignore */ } };

const LEVEL: Record<Bus, number> = { sfx: 0.9, amb: 0.5, music: 0.22 };

export function unlock() {
  if (!ctx) {
    ctx = new AudioContext();
    const comp = ctx.createDynamicsCompressor(); // keeps stacked sounds from clipping
    master = ctx.createGain();
    master.gain.value = prefs.sound ? 1 : 0;
    master.connect(comp).connect(ctx.destination);
    buses = { sfx: ctx.createGain(), amb: ctx.createGain(), music: ctx.createGain() };
    for (const b of Object.keys(buses) as Bus[]) { buses[b].gain.value = LEVEL[b]; buses[b].connect(master); }
    buses.music.gain.value = prefs.music ? LEVEL.music : 0;
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (pendingAmbience) ambience(pendingAmbience);
    startMusic();
  }
  if (ctx.state === "suspended") void ctx.resume();
}

export const soundOn = () => prefs.sound;
export const musicOn = () => prefs.music;
export function setSound(on: boolean) {
  prefs.sound = on; savePrefs();
  if (ctx) master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05);
}
export function setMusic(on: boolean) {
  prefs.music = on; savePrefs();
  if (ctx) buses.music.gain.setTargetAtTime(on ? LEVEL.music : 0, ctx.currentTime, 0.2);
}

// ---------- building blocks --------------------------------------------------

const ready = () => ctx !== null && prefs.sound;
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

/** Gain node with a quick attack and exponential decay, already connected to `bus`. */
function env(start: number, dur: number, vol: number, bus: Bus = "sfx", attack = 0.01) {
  const g = ctx!.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  g.connect(buses[bus]);
  return g;
}

/** One oscillator note, optionally gliding to another pitch. */
function tone(freq: number, start: number, dur: number, vol: number, type: OscillatorType = "sine", glideTo?: number, bus: Bus = "sfx") {
  const o = ctx!.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
  o.connect(env(start, dur, vol, bus));
  o.start(start);
  o.stop(start + dur + 0.05);
  return o;
}

/** Filtered noise burst: crunches, swats, crackles, wind gusts. */
function hiss(start: number, dur: number, vol: number, filter: BiquadFilterType, freq: number, q = 1, sweepTo?: number, bus: Bus = "sfx") {
  const s = ctx!.createBufferSource();
  s.buffer = noise;
  s.loop = true;
  const f = ctx!.createBiquadFilter();
  f.type = filter; f.frequency.setValueAtTime(freq, start); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, start + dur);
  s.connect(f).connect(env(start, dur, vol, bus, Math.min(0.02, dur / 3)));
  s.start(start, Math.random() * 1.5);
  s.stop(start + dur + 0.05);
}

/** A music-box / bell note: sine plus a quieter octave, long ring. */
function bell(freq: number, start: number, dur: number, vol: number, bus: Bus = "sfx") {
  tone(freq, start, dur, vol, "sine", undefined, bus);
  tone(freq * 2, start, dur * 0.6, vol * 0.35, "sine", undefined, bus);
  tone(freq * 3.01, start, dur * 0.25, vol * 0.12, "sine", undefined, bus);
}

// ---------- the cat ---------------------------------------------------------

/**
 * A purr: noise pulsed ~26 times a second (the real purr rate) through a low
 * filter, rising and falling with each breath in and out. Most laptop and
 * phone speakers can't play true sub-bass, so the rumble sits at 100–400 Hz.
 */
export function purr(seconds = 2.5, vol = 0.9) {
  if (!ready()) return;
  const t = ctx!.currentTime;
  const src = ctx!.createBufferSource();
  src.buffer = noise; src.loop = true;
  const lp = ctx!.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 320; lp.Q.value = 2;
  const pulse = ctx!.createGain();
  pulse.gain.value = 0.5;
  const lfo = ctx!.createOscillator();
  lfo.type = "triangle"; lfo.frequency.value = 26;
  const depth = ctx!.createGain();
  depth.gain.value = 0.5;
  lfo.connect(depth).connect(pulse.gain);
  const breath = ctx!.createGain();
  breath.gain.setValueAtTime(0.0001, t);
  // Breathing: in (louder, a touch higher) ~0.9 s, out ~1.1 s.
  let at = t;
  for (let inhale = true; at < t + seconds; inhale = !inhale) {
    const len = inhale ? 0.9 : 1.1;
    breath.gain.setTargetAtTime(inhale ? vol : vol * 0.7, at, 0.12);
    lp.frequency.setTargetAtTime(inhale ? 380 : 260, at, 0.15);
    lfo.frequency.setTargetAtTime(inhale ? 27 : 24, at, 0.1);
    at += len;
  }
  breath.gain.setTargetAtTime(0.0001, t + seconds - 0.25, 0.1);
  src.connect(lp).connect(pulse).connect(breath).connect(buses.sfx);
  src.start(t); lfo.start(t);
  src.stop(t + seconds + 0.3); lfo.stop(t + seconds + 0.3);
}

/**
 * Meow: a buzzy sawtooth through a filter that opens then closes ("mee-ow"),
 * with the pitch rising and falling and a little vibrato.
 * happy = bright and rising; curious = "mrrp?" ends high; short = a chirp.
 */
export function meow(kind: "happy" | "curious" | "short" | "sleepy" = "happy", delay = 0) {
  if (!ready()) return;
  const t = ctx!.currentTime + delay;
  const shapes = {
    happy:   { f: [620, 920, 640], d: 0.62, open: [700, 2600, 900] },
    curious: { f: [520, 560, 860], d: 0.42, open: [600, 1400, 2300] },
    short:   { f: [760, 980, 820], d: 0.2,  open: [900, 2600, 1300] },
    sleepy:  { f: [480, 560, 400], d: 0.8,  open: [500, 1500, 600] },
  }[kind];
  const o = ctx!.createOscillator();
  o.type = "sawtooth";
  const [f0, f1, f2] = shapes.f, d = shapes.d;
  o.frequency.setValueAtTime(f0!, t);
  o.frequency.exponentialRampToValueAtTime(f1!, t + d * 0.35);
  o.frequency.exponentialRampToValueAtTime(f2!, t + d);
  const vib = ctx!.createOscillator();
  vib.frequency.value = 6.5;
  const vibAmt = ctx!.createGain();
  vibAmt.gain.value = 9;
  vib.connect(vibAmt).connect(o.frequency);
  const f = ctx!.createBiquadFilter();
  f.type = "lowpass"; f.Q.value = 6;
  const [o0, o1, o2] = shapes.open;
  f.frequency.setValueAtTime(o0!, t);
  f.frequency.exponentialRampToValueAtTime(o1!, t + d * 0.3);
  f.frequency.exponentialRampToValueAtTime(o2!, t + d);
  const g = ctx!.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.32, t + 0.05);
  g.gain.setValueAtTime(0.32, t + d * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(f).connect(g).connect(buses.sfx);
  o.start(t); vib.start(t);
  o.stop(t + d + 0.05); vib.stop(t + d + 0.05);
}

// ---------- quiz ------------------------------------------------------------

/** Right answer: a bright three-note chime going up. */
export function chime() {
  if (!ready()) return;
  const t = ctx!.currentTime;
  [72, 76, 79, 84].forEach((n, i) => bell(midi(n), t + i * 0.07, 0.6, 0.18));
}

/** Wrong answer: a soft, friendly "uh-oh" (falling, never harsh). */
export function wrong() {
  if (!ready()) return;
  const t = ctx!.currentTime;
  tone(midi(67), t, 0.22, 0.2, "triangle");
  tone(midi(63), t + 0.2, 0.38, 0.2, "triangle", midi(62));
  hiss(t + 0.2, 0.3, 0.04, "bandpass", 500, 3, 300);
}

/** New item found: a quick upward sparkle. */
export function sparkle() {
  if (!ready()) return;
  const t = ctx!.currentTime;
  for (let i = 0; i < 10; i++) bell(midi(84 + [0, 4, 7, 12, 16, 19, 24, 19, 24, 28][i]!), t + i * 0.045, 0.35, 0.07);
}

/** Lesson complete: a little fanfare, a sparkle, and a happy meow. */
export function fanfare() {
  if (!ready()) return;
  const t = ctx!.currentTime;
  [60, 64, 67, 72].forEach((n, i) => {
    tone(midi(n), t + i * 0.11, 0.25, 0.14, "triangle");
    tone(midi(n + 12), t + i * 0.11, 0.2, 0.06, "square");
  });
  // Final chord, held.
  for (const n of [60, 64, 67, 72, 76]) {
    tone(midi(n), t + 0.5, 1.4, 0.09, "triangle");
    tone(midi(n) * 1.004, t + 0.5, 1.4, 0.05, "sawtooth"); // slight detune = brassy
  }
  for (let i = 0; i < 12; i++) bell(midi(88 + (i % 5) * 3), t + 0.55 + i * 0.06, 0.4, 0.05);
  tone(midi(36), t + 0.5, 1.2, 0.2, "sine");
}

// ---------- care and play ---------------------------------------------------

/** One bite: a couple of crunchy clicks. */
export function crunch() {
  if (!ready()) return;
  const t = ctx!.currentTime;
  for (let i = 0; i < 3; i++) hiss(t + i * 0.05 + Math.random() * 0.02, 0.05, 0.25, "bandpass", 2200 + Math.random() * 1500, 1.5);
  tone(160, t, 0.08, 0.12, "sine", 90);
}

/** Paw whacks something soft. */
export function swat() {
  if (!ready()) return;
  const t = ctx!.currentTime;
  hiss(t, 0.06, 0.25, "bandpass", 1300, 1.2);
  tone(170, t, 0.12, 0.25, "sine", 60);
}

export function boing() {
  if (!ready()) return;
  const t = ctx!.currentTime;
  const o = tone(180, t, 0.45, 0.22, "sine");
  o.frequency.exponentialRampToValueAtTime(620, t + 0.12);
  o.frequency.exponentialRampToValueAtTime(260, t + 0.45);
}

/** Laser dot darting off. */
export function zip() {
  if (!ready()) return;
  tone(2200, ctx!.currentTime, 0.14, 0.07, "sine", 500);
}

/** Pounce / leap: a quick airy whoosh. */
export function whoosh(vol = 0.18) {
  if (!ready()) return;
  hiss(ctx!.currentTime, 0.4, vol, "bandpass", 300, 1.5, 2400);
}

/** Soft paw step on the ground. */
export function step() {
  if (!ready()) return;
  const t = ctx!.currentTime;
  tone(110 + Math.random() * 30, t, 0.06, 0.07, "sine", 60);
  hiss(t, 0.04, 0.03, "lowpass", 900);
}

/** Button press. */
export function pop() {
  if (!ready()) return;
  tone(520, ctx!.currentTime, 0.08, 0.12, "sine", 900);
}

/** Scene change. */
export function swish() {
  if (!ready()) return;
  hiss(ctx!.currentTime, 0.7, 0.12, "bandpass", 2400, 1, 250);
}

// ---------- Halloween -----------------------------------------------------------------

/** A friendly ghost "wooo-oo": a wobbly sine sliding up then down. */
export function boo() {
  if (!ready()) return;
  const t = ctx!.currentTime;
  const o = ctx!.createOscillator();
  o.frequency.setValueAtTime(330, t);
  o.frequency.exponentialRampToValueAtTime(520, t + 0.35);
  o.frequency.exponentialRampToValueAtTime(300, t + 0.9);
  const vib = ctx!.createOscillator();
  vib.frequency.value = 7;
  const amt = ctx!.createGain();
  amt.gain.value = 18;
  vib.connect(amt).connect(o.frequency);
  o.connect(env(t, 0.95, 0.16, "sfx", 0.08));
  o.start(t); vib.start(t);
  o.stop(t + 1); vib.stop(t + 1);
  setTimeout(() => meow("short"), 700); // the ghost giggles. it's a nice ghost.
}

let spooky = false;
/** Halloween music: the same tune in a minor key, a bit slower. */
export const setSpooky = (v: boolean) => { spooky = v; };
const toMinor = (n: number) => ([4, 9, 11].includes(n % 12) ? n - 1 : n); // E→E♭, A→A♭, B→B♭: C major becomes C minor

// ---------- home and shop ------------------------------------------------------

/** Lapping water: a tiny wet plip. */
export function lap() {
  if (!ready()) return;
  const t = ctx!.currentTime;
  tone(900 + Math.random() * 300, t, 0.06, 0.12, "sine", 1600);
  hiss(t, 0.05, 0.05, "bandpass", 3000, 2);
}

/** A soft snore: a slow breath of low noise. */
export function snore() {
  if (!ready()) return;
  const t = ctx!.currentTime;
  hiss(t, 1.1, 0.12, "lowpass", 260, 3, 180);
  tone(70, t + 0.1, 0.9, 0.06, "sine", 55);
}

/** One stroke of the brush through fur. */
export function brush() {
  if (!ready()) return;
  hiss(ctx!.currentTime, 0.45, 0.08, "bandpass", 4000, 0.8, 2500);
}

/** Scooping litter: sandy shush, then a little clunk into the bag. */
export function scoop() {
  if (!ready()) return;
  const t = ctx!.currentTime;
  hiss(t, 0.3, 0.12, "highpass", 2500, 0.7);
  tone(180, t + 0.55, 0.1, 0.12, "sine", 90);
}

/** Claws on sisal rope: a quick rough scritch. */
export function scratch() {
  if (!ready()) return;
  const t = ctx!.currentTime;
  for (let i = 0; i < 3; i++) hiss(t + i * 0.035, 0.05, 0.1, "bandpass", 1800 + Math.random() * 1200, 2);
}

/** Coins! Two bright pings: "ka-ching". */
export function coin() {
  if (!ready()) return;
  const t = ctx!.currentTime;
  bell(midi(88), t, 0.25, 0.14);
  bell(midi(95), t + 0.08, 0.5, 0.14);
}

/** Not enough coins: a soft low double boop. */
export function nope() {
  if (!ready()) return;
  const t = ctx!.currentTime;
  tone(220, t, 0.12, 0.12, "triangle");
  tone(196, t + 0.14, 0.18, 0.12, "triangle");
}

// ---------- ambience: a bed of sound per place ------------------------------

export type Place = "map" | "forest" | "mountain" | "lab" | "home";
let pendingAmbience: Place | null = null;
let stopAmbience: (() => void) | null = null;

/** Crossfade into the sounds of a place: a continuous bed plus random events. */
export function ambience(place: Place) {
  pendingAmbience = place;
  if (!ctx) return;
  stopAmbience?.();
  const bed = ctx.createGain();
  const t = ctx.currentTime;
  bed.gain.setValueAtTime(0.0001, t);
  bed.gain.exponentialRampToValueAtTime(1, t + 1.2);
  bed.connect(buses.amb);
  const nodes: AudioScheduledSourceNode[] = [];

  /** Looping filtered noise, slowly swelling: breeze, wind, brook. */
  const loopNoise = (type: BiquadFilterType, freq: number, vol: number, swell: number, q = 0.7) => {
    const s = ctx!.createBufferSource();
    s.buffer = noise; s.loop = true;
    const f = ctx!.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx!.createGain();
    g.gain.value = vol;
    const lfo = ctx!.createOscillator();
    lfo.frequency.value = swell;
    const amt = ctx!.createGain();
    amt.gain.value = vol * 0.6;
    lfo.connect(amt).connect(g.gain);
    s.connect(f).connect(g).connect(bed);
    s.start(); lfo.start();
    nodes.push(s, lfo);
  };
  const hum = (freq: number, vol: number) => {
    const o = ctx!.createOscillator();
    o.frequency.value = freq;
    const g = ctx!.createGain();
    g.gain.value = vol;
    o.connect(g).connect(bed);
    o.start();
    nodes.push(o);
  };

  // Random events while we're here.
  const events: [number, () => void][] = []; // [mean seconds between, play]
  const bird = () => {
    const s = ctx!.currentTime, base = 2400 + Math.random() * 1600;
    for (let i = 0, n = 2 + Math.floor(Math.random() * 3); i < n; i++) {
      tone(base, s + i * 0.12, 0.09, 0.05, "sine", base * (1.2 + Math.random() * 0.3), "amb");
    }
  };

  const owl = () => { // "hoo-hoo"
    const s = ctx!.currentTime;
    tone(370, s, 0.35, 0.08, "sine", 340, "amb");
    tone(370, s + 0.5, 0.55, 0.08, "sine", 330, "amb");
  };
  if (spooky && place !== "lab" && place !== "home") events.push([9, owl]); // Halloween: owls everywhere outside
  if (place === "map") {
    loopNoise("lowpass", 500, 0.05, 0.08);
    events.push([3, bird]);
  } else if (place === "forest") {
    loopNoise("lowpass", 450, 0.04, 0.06);
    loopNoise("bandpass", 1800, 0.035, 0.7, 0.8); // the brook
    events.push([2, bird], [11, () => { // owl: "hoo-hoo"
      const s = ctx!.currentTime;
      tone(370, s, 0.35, 0.08, "sine", 340, "amb");
      tone(370, s + 0.5, 0.55, 0.08, "sine", 330, "amb");
    }]);
  } else if (place === "mountain") {
    loopNoise("lowpass", 700, 0.09, 0.12, 1.5); // wind
    loopNoise("bandpass", 1600, 0.02, 0.2, 2);  // whistle in the wind
    events.push(
      [0.6, () => hiss(ctx!.currentTime, 0.03, 0.05 + Math.random() * 0.05, "highpass", 2500, 1, undefined, "amb")], // campfire crackle
      [9, () => bell(midi(81), ctx!.currentTime, 2.5, 0.06, "amb")], // the summit bell
    );
  } else if (place === "home") {
    // Cozy: birds outside the window, a clock ticking.
    events.push([5, bird], [1, () => tone(2400, ctx!.currentTime, 0.03, 0.025, "square", undefined, "amb")]);
  } else {
    hum(110, 0.018); hum(220, 0.008); // fridge-ish lab hum
    events.push(
      [0.7, () => { const s = ctx!.currentTime, f = 300 + Math.random() * 500; tone(f, s, 0.07, 0.04, "sine", f * 1.8, "amb"); }], // bubbles
      [5, () => { const s = ctx!.currentTime; for (let i = 0; i < 4; i++) hiss(s + i * 0.07, 0.05, 0.05, "highpass", 3000, 1, undefined, "amb"); }], // tesla coil
    );
  }

  const timers = events.map(([mean, play]) => {
    let id = 0;
    const next = () => { id = window.setTimeout(() => { play(); next(); }, (mean * (0.4 + Math.random() * 1.2)) * 1000); };
    next();
    return () => clearTimeout(id);
  });

  stopAmbience = () => {
    timers.forEach((c) => c());
    const s = ctx!.currentTime;
    bed.gain.setTargetAtTime(0.0001, s, 0.3);
    nodes.forEach((n) => n.stop(s + 1.5));
  };
}

// ---------- music: a gentle music-box loop ------------------------------------

// Eighth notes over C – Am – F – G. null = rest.
const MELODY: (number | null)[] = [
  72, 76, 79, 76, 74, 76, 72, null,
  69, 72, 76, 72, 74, 72, 69, null,
  65, 69, 72, 74, 72, 69, 67, null,
  67, 71, 74, 79, 77, 74, 71, null,
];
const BASS = [48, 45, 41, 43];
const EIGHTH = 0.34;

function startMusic() {
  let step = 0, at = ctx!.currentTime + 0.5;
  // Schedule a little ahead of time on a timer; Web Audio plays it on the beat.
  window.setInterval(() => {
    // A backgrounded tab throttles timers; skip ahead rather than burst-play missed notes.
    if (at < ctx!.currentTime) at = ctx!.currentTime + 0.05;
    while (at < ctx!.currentTime + 0.6) {
      const n = MELODY[step % MELODY.length];
      const tune = spooky ? toMinor : (x: number) => x;
      if (n != null) bell(midi(tune(n)), at, 0.9, 0.16, "music");
      if (step % 8 === 0) bell(midi(tune(BASS[(step / 8) % 4]!)), at, 2.4, 0.18, "music");
      if (step % 8 === 4) bell(midi(tune(BASS[Math.floor(step / 8) % 4]! + 7)), at, 1.2, 0.08, "music");
      at += spooky ? EIGHTH * 1.15 : EIGHTH;
      step++;
    }
  }, 150);
}
