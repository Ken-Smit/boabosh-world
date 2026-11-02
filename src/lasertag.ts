// Laser tag rules: difficulty table, arena layout, foe brains, aim assist, hit
// tests and scoring. No DOM or three.js: the scene only draws what `step` says,
// and the tests play whole rounds headlessly with the very same code.

export type Level = "easy" | "medium" | "hard";
export type LevelConfig = {
  label: string; icon: string; blurb: string;
  foes: number;
  seconds: number; // round length
  foeSpeed: number; // walking pace; the player is PLAYER_SPEED
  fireGap: number; // seconds a foe waits between shots
  telegraph: number; // seconds a foe stands still, glowing, before each shot
  beamSpeed: number; // foe beams are slow enough to see and step away from
  aimError: number; // degrees a foe's aim can be off, either way
  playerSafe: number; // seconds nothing can tag the player after a tag
  foeDizzy: number; // seconds a tagged foe sits dizzy
  foeSafe: number; // then this long blinking, before it can be tagged again
  cone: number; // aim assist: a foe this many degrees either side of facing locks on
  reach: number; // aim assist range
  tagGap: number; // seconds between the player's tags
  powerEvery: number; // seconds between power stars
};

// ---------- the one table to tune ----------
export const LEVELS: Record<Level, LevelConfig> = {
  easy: { label: "Easy", icon: "😺", blurb: "Sleepy kittens", foes: 2, seconds: 60, foeSpeed: 1.1, fireGap: 5.5, telegraph: 1.4, beamSpeed: 4.5, aimError: 24, playerSafe: 5, foeDizzy: 2.2, foeSafe: 0.5, cone: 180, reach: 20, tagGap: 0.45, powerEvery: 14 },
  medium: { label: "Medium", icon: "😼", blurb: "Playful cats", foes: 2, seconds: 60, foeSpeed: 1.9, fireGap: 3.2, telegraph: 1.1, beamSpeed: 6, aimError: 13, playerSafe: 3.5, foeDizzy: 1.8, foeSafe: 3, cone: 120, reach: 13, tagGap: 0.6, powerEvery: 14 },
  hard: { label: "Hard", icon: "😾", blurb: "Speedy champions", foes: 3, seconds: 60, foeSpeed: 2.7, fireGap: 2, telegraph: 0.8, beamSpeed: 7.5, aimError: 6, playerSafe: 2.4, foeDizzy: 1.4, foeSafe: 6, cone: 75, reach: 10, tagGap: 0.85, powerEvery: 11 },
};
export const LEVEL_ORDER: Level[] = ["easy", "medium", "hard"];

export const PLAYER_SPEED = 4.6;
export const POWER_SECONDS = 6; // power star: can't be tagged, tags twice as fast
export const COUNTDOWN = 2.4;
const PLAYER_DIZZY = 0.9; // tagged player moves at half speed for this long
const CAT_R = 0.45; // cats vs walls
const HIT_R = 0.6; // foe beams vs the player

// ---------- the arena ----------
export type Vec = { x: number; z: number };
export type Box = Vec & { hw: number; hd: number }; // centre, half width, half depth
export const ARENA = { hw: 8.5, hd: 5 };
export const WALLS: Box[] = [
  { x: -4.4, z: -1.3, hw: 1.5, hd: 0.3 }, { x: 4.4, z: -1.3, hw: 1.5, hd: 0.3 },
  { x: 0, z: 0.7, hw: 1.4, hd: 0.3 },
  { x: -6, z: 2.2, hw: 0.3, hd: 1 }, { x: 6, z: 2.2, hw: 0.3, hd: 1 },
  { x: 0, z: -3.2, hw: 0.7, hd: 0.45 },
];
export const PLAYER_START: Vec = { x: 0, z: 3.6 };
const FOE_STARTS: Vec[] = [{ x: -5.5, z: -3.4 }, { x: 5.5, z: -3.4 }, { x: 0, z: -4.4 }];
export const POWER_SPOTS: Vec[] = [{ x: -2.6, z: 2.4 }, { x: 2.6, z: 2.4 }, { x: -7, z: -3 }, { x: 7, z: -3 }, { x: 0, z: -1 }];

const inBox = (p: Vec, b: Box, pad = 0) => Math.abs(p.x - b.x) < b.hw + pad && Math.abs(p.z - b.z) < b.hd + pad;
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
/** Facing angle: 0 is +z, the same way cats turn in three.js (rotation.y). */
export const angleTo = (a: Vec, b: Vec) => Math.atan2(b.x - a.x, b.z - a.z);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Is the straight line a→b clear of walls? (Slab test against each box.) */
export function canSee(a: Vec, b: Vec, walls: Box[] = WALLS): boolean {
  const dx = b.x - a.x, dz = b.z - a.z;
  return !walls.some((w) => {
    let t0 = 0, t1 = 1;
    for (const [o, d, c, h] of [[a.x, dx, w.x, w.hw], [a.z, dz, w.z, w.hd]] as const) {
      if (Math.abs(d) < 1e-9) { if (Math.abs(o - c) > h) return false; continue; }
      const lo = (c - h - o) / d, hi = (c + h - o) / d;
      t0 = Math.max(t0, Math.min(lo, hi));
      t1 = Math.min(t1, Math.max(lo, hi));
      if (t0 > t1) return false;
    }
    return true;
  });
}

/** Slide a cat by (dx, dz), one axis at a time, so walls never stop it dead. */
export function move(p: Vec, dx: number, dz: number): Vec {
  const free = (q: Vec) => !WALLS.some((w) => inBox(q, w, CAT_R));
  const lim = (v: number, h: number) => Math.max(-h + CAT_R, Math.min(h - CAT_R, v));
  let q = { x: lim(p.x + dx, ARENA.hw), z: p.z };
  if (!free(q)) q = { x: p.x, z: p.z };
  const r = { x: q.x, z: lim(q.z + dz, ARENA.hd) };
  return free(r) ? r : q;
}

// ---------- the round ----------
export type Foe = Vec & {
  face: number; goal: Vec;
  phase: "walk" | "aim" | "dizzy"; timer: number; // timer counts down the aim or dizzy phase
  wait: number; // until it may fire again
  safe: number; // grace after getting up, so it can't be tagged again at once
  moving: boolean;
};
export type Shot = Vec & { vx: number; vz: number };
export type Round = {
  level: Level; cfg: LevelConfig; rnd: () => number;
  start: number; left: number; // countdown, then seconds of play left
  blue: number; pink: number; // tags scored by each team
  p: Vec & { face: number; dizzy: number; safe: number; power: number; cool: number; moving: boolean };
  foes: Foe[]; shots: Shot[];
  star: Vec | null; nextStar: number;
};
export type Input = { mx: number; mz: number; fire: boolean };
export type TagEvent =
  | { type: "pew"; from: Vec; to: Vec; hit: boolean }
  | { type: "aim"; foe: number }
  | { type: "shot"; foe: number }
  | { type: "tagFoe"; foe: number }
  | { type: "tagPlayer" }
  | { type: "star" } | { type: "gotStar" }
  | { type: "go" } | { type: "end" };

function randomSpot(rnd: () => number): Vec {
  for (;;) {
    const q = { x: (rnd() * 2 - 1) * (ARENA.hw - 1), z: (rnd() * 2 - 1) * (ARENA.hd - 1) };
    if (!WALLS.some((w) => inBox(q, w, CAT_R + 0.2))) return q;
  }
}

export function newRound(level: Level, rnd: () => number = Math.random): Round {
  const cfg = LEVELS[level];
  return {
    level, cfg, rnd, start: COUNTDOWN, left: cfg.seconds, blue: 0, pink: 0,
    p: { ...PLAYER_START, face: Math.PI, dizzy: 0, safe: 0, power: 0, cool: 0, moving: false },
    foes: FOE_STARTS.slice(0, cfg.foes).map((s, i) => ({
      ...s, face: 0, goal: randomSpot(rnd), phase: "walk", timer: 0, wait: 1.5 + i * 1.2 + cfg.fireGap / 2, safe: 0, moving: false,
    })),
    shots: [], star: null, nextStar: cfg.powerEvery / 2,
  };
}

/** Aim assist: the closest foe the player could tag now, within reach and cone, in plain sight. */
export function pickTarget(g: Round): number {
  const { p, cfg } = g;
  const cone = (cfg.cone * Math.PI) / 180;
  let best = -1, bestD = Infinity;
  g.foes.forEach((f, i) => {
    const d = dist(p, f);
    if (f.phase === "dizzy" || f.safe > 0 || d > cfg.reach || d >= bestD) return;
    if (Math.abs(wrap(angleTo(p, f) - p.face)) > cone || !canSee(p, f)) return;
    best = i; bestD = d;
  });
  return best;
}

/** A foe only decides to fire when it's walking, rested, can see the player and is close enough. */
export const foeWantsToFire = (f: Foe, p: Vec, cfg: LevelConfig) =>
  f.phase === "walk" && f.wait <= 0 && dist(f, p) < cfg.reach + 2 && canSee(f, p);

/** Where a foe's beam goes: at the player's spot now, off by up to aimError. */
export const foeAim = (f: Vec, p: Vec, aimError: number, rnd: () => number) =>
  angleTo(f, p) + ((rnd() * 2 - 1) * aimError * Math.PI) / 180;

/** Where a straight beam stops: the first wall, or the edge of the arena. */
function beamEnd(from: Vec, angle: number): Vec {
  const q = { x: from.x, z: from.z };
  for (let i = 0; i < 90; i++) {
    q.x += Math.sin(angle) * 0.2; q.z += Math.cos(angle) * 0.2;
    if (Math.abs(q.x) > ARENA.hw || Math.abs(q.z) > ARENA.hd || WALLS.some((w) => inBox(q, w))) break;
  }
  return q;
}

/** Advance the round by dt seconds. Returns what happened, for the scene to show and play. */
export function step(g: Round, input: Input, dt: number): TagEvent[] {
  const ev: TagEvent[] = [];
  if (g.left <= 0) return ev;
  if (g.start > 0) {
    g.start -= dt;
    if (g.start <= 0) ev.push({ type: "go" });
    return ev;
  }
  const { p, cfg, rnd } = g;

  // Player: stick or keys, slower while dizzy.
  const len = Math.hypot(input.mx, input.mz);
  p.moving = len > 0.15;
  if (p.moving) {
    const s = (PLAYER_SPEED * (p.dizzy > 0 ? 0.5 : 1) * Math.min(1, len) * dt) / len;
    Object.assign(p, move(p, input.mx * s, input.mz * s));
    p.face = Math.atan2(input.mx, input.mz);
  }
  p.dizzy = Math.max(0, p.dizzy - dt);
  p.safe = Math.max(0, p.safe - dt);
  p.power = Math.max(0, p.power - dt);
  p.cool = Math.max(0, p.cool - dt);

  // Tag! Locks on to a foe if there's one to lock on to, otherwise fires straight ahead.
  if (input.fire && p.cool <= 0) {
    p.cool = cfg.tagGap * (p.power > 0 ? 0.5 : 1);
    const i = pickTarget(g);
    if (i >= 0) {
      const f = g.foes[i]!;
      p.face = angleTo(p, f);
      ev.push({ type: "pew", from: { x: p.x, z: p.z }, to: { x: f.x, z: f.z }, hit: true }, { type: "tagFoe", foe: i });
      f.phase = "dizzy"; f.timer = cfg.foeDizzy; f.moving = false; // a tag also stops a shot being charged
      g.blue++;
    } else {
      ev.push({ type: "pew", from: { x: p.x, z: p.z }, to: beamEnd(p, p.face), hit: false });
    }
  }

  // Foes: wander; stop and glow before every shot; get dizzy when tagged.
  g.foes.forEach((f, i) => {
    f.wait -= dt;
    f.safe = Math.max(0, f.safe - dt);
    if (f.phase === "dizzy") {
      f.timer -= dt;
      if (f.timer <= 0) { f.phase = "walk"; f.safe = cfg.foeSafe; f.goal = randomSpot(rnd); }
      return;
    }
    if (f.phase === "aim") {
      f.face = angleTo(f, p);
      f.timer -= dt;
      if (f.timer <= 0) {
        const a = foeAim(f, p, cfg.aimError, rnd);
        f.face = a;
        g.shots.push({ x: f.x, z: f.z, vx: Math.sin(a) * cfg.beamSpeed, vz: Math.cos(a) * cfg.beamSpeed });
        ev.push({ type: "shot", foe: i });
        f.phase = "walk"; f.wait = cfg.fireGap * (0.8 + rnd() * 0.4);
      }
      return;
    }
    if (foeWantsToFire(f, p, cfg)) {
      f.phase = "aim"; f.timer = cfg.telegraph; f.moving = false;
      ev.push({ type: "aim", foe: i });
      return;
    }
    if (dist(f, f.goal) < 0.3) { f.goal = randomSpot(rnd); return; }
    const s = cfg.foeSpeed * dt, a = angleTo(f, f.goal);
    const q = move(f, Math.sin(a) * s, Math.cos(a) * s);
    if (dist(q, f) < s * 0.3) f.goal = randomSpot(rnd); // stuck on a wall: go somewhere else
    f.x = q.x; f.z = q.z; f.face = a; f.moving = true;
  });

  // Foe beams: stopped by walls and edges; a tag makes the player safe for a while.
  g.shots = g.shots.filter((s) => {
    s.x += s.vx * dt; s.z += s.vz * dt;
    if (Math.abs(s.x) > ARENA.hw || Math.abs(s.z) > ARENA.hd || WALLS.some((w) => inBox(s, w))) return false;
    if (dist(s, p) > HIT_R) return true;
    if (p.safe > 0 || p.power > 0) return false; // fizzles harmlessly
    g.pink++;
    p.dizzy = PLAYER_DIZZY; p.safe = cfg.playerSafe;
    ev.push({ type: "tagPlayer" });
    return false;
  });

  // Power stars: a helping paw on every level.
  g.nextStar -= dt;
  if (!g.star && g.nextStar <= 0) {
    g.star = { ...POWER_SPOTS[Math.floor(rnd() * POWER_SPOTS.length)]! };
    ev.push({ type: "star" });
  }
  if (g.star && dist(g.star, p) < 0.9) {
    g.star = null; g.nextStar = cfg.powerEvery; p.power = POWER_SECONDS;
    ev.push({ type: "gotStar" });
  }

  g.left -= dt;
  if (g.left <= 0) { g.left = 0; g.shots = []; ev.push({ type: "end" }); }
  return ev;
}

// ---------- scoring ----------
export type Outcome = "win" | "tie" | "lose";
export const outcome = (g: Pick<Round, "blue" | "pink">): Outcome => (g.blue > g.pink ? "win" : g.blue === g.pink ? "tie" : "lose");
/** Only ever warm: nobody is out, and losing is just "so close". */
export const CHEER: Record<Outcome, string> = {
  win: "You did it! Blue team wins! 🏆",
  tie: "A tie! What a great game! 🤝",
  lose: "So close! Try again! You're getting better every time 💪",
};
