// Yarn Roll rules: cat bowling on a lane with bumpers. No DOM or three.js: the
// scene only draws what `step` says, and the tests play whole games headlessly.

// ---------- the one table to tune ----------
export const CONFIG = {
  rolls: 5,
  goal: 11, // mice to knock down over all the rolls to win a trophy
  resetEvery: 2, // the mice pop back after this many rolls, or sooner if all are down
  maxAim: (30 * Math.PI) / 180, // furthest a roll can point from straight ahead
  minSpeed: 4.2, maxSpeed: 12, // power 0 and power 1; even power 0 reaches the mice
  drag: 0.8, // how fast the ball slows
  hitR: 0.7, // ball centre to mouse centre: wide, so near misses still count
  hitKeep: 0.62, // ball speed kept after each mouse
  launch: 0.8, // a knocked mouse slides off at this share of the speed that hit it
  chainR: 0.8, // a sliding mouse knocks others this close...
  chainMin: 4, // ...while it's going at least this fast
  slideDrag: 7, // how fast a knocked mouse stops
  pause: 1.2, // seconds to enjoy the result before the next roll
  minPull: 0.15, // a smaller pull than this is taken as "changed my mind"
  keyPower: 0.3, // keyboard: power to start from, so Space alone is only a gentle roll
  keyAimOff: (12 * Math.PI) / 180, // keyboard: the arrow starts up to this far off straight
};

export const LANE = { hw: 2, near: 4.2, far: -5.2, ballR: 0.36 };
const SUB = 1 / 60; // physics step, so slow devices roll the same as fast ones
const MAX_ROLL = 7; // seconds; a safety net, rolls end long before this
const STOP = 0.5; // a ball slower than this has stopped

// The triangle, point toward the player.
export const HOMES = [[0, -2.5], [-0.72, -3.4], [0.72, -3.4], [-1.44, -4.3], [0, -4.3], [1.44, -4.3]] as const;

export type Mouse = { x: number; z: number; down: boolean; vx: number; vz: number };
export type YarnRound = {
  rnd: () => number;
  phase: "aim" | "roll" | "pause" | "over";
  timer: number;
  used: number; // rolls started
  inSet: number; // rolls since the mice last popped back
  got: number; // knocked down this roll
  total: number;
  ball: { x: number; z: number; vx: number; vz: number; moving: boolean };
  mice: Mouse[];
};
export type YarnEvent =
  | { type: "knock"; mouse: number }
  | { type: "bump"; x: number; z: number }
  | { type: "rolled"; got: number; strike: boolean; cleared: boolean }
  | { type: "reset" } | { type: "ready" } | { type: "end" };

const stand = (): Mouse[] => HOMES.map(([x, z]) => ({ x, z, down: false, vx: 0, vz: 0 }));
const startBall = () => ({ x: 0, z: LANE.near, vx: 0, vz: 0, moving: false });
const clamp = (v: number, h: number) => Math.max(-h, Math.min(h, v));

export const newYarnRound = (rnd: () => number = Math.random): YarnRound =>
  ({ rnd, phase: "aim", timer: 0, used: 0, inSet: 0, got: 0, total: 0, ball: startBall(), mice: stand() });

/** Dragging back: (dx, dy) is the pull in pixels, y down. The ball goes the opposite way. */
export function aimFromDrag(dx: number, dy: number, reach: number) {
  const aim = clamp(Math.atan2(-dx, Math.max(0, dy)), CONFIG.maxAim);
  return { aim, power: dy > 0 ? Math.min(1, Math.hypot(dx, dy) / reach) : 0 };
}

/** Where the keyboard's arrow starts each roll: a little off, so the arrows have a job to do. */
export const keyStart = (rnd: () => number) => ({ aim: (rnd() * 2 - 1) * CONFIG.keyAimOff, power: CONFIG.keyPower });

/** Let go! aim: radians from straight, + is right. power: 0 to 1. False if it isn't time to roll. */
export function roll(g: YarnRound, aim: number, power: number): boolean {
  if (g.phase !== "aim") return false;
  const a = clamp(aim, CONFIG.maxAim), p = Math.max(0, Math.min(1, power));
  const speed = CONFIG.minSpeed + (CONFIG.maxSpeed - CONFIG.minSpeed) * p;
  Object.assign(g.ball, { vx: Math.sin(a) * speed, vz: -Math.cos(a) * speed, moving: true });
  g.phase = "roll"; g.timer = 0; g.got = 0; g.used++; g.inSet++;
  return true;
}

function knock(g: YarnRound, i: number, fromX: number, fromZ: number, speed: number, ev: YarnEvent[]) {
  const m = g.mice[i]!;
  const dx = m.x - fromX, dz = m.z - fromZ, d = Math.hypot(dx, dz) || 1;
  m.down = true;
  m.vx = (dx / d) * speed * CONFIG.launch; m.vz = (dz / d) * speed * CONFIG.launch;
  g.got++; g.total++;
  ev.push({ type: "knock", mouse: i });
}

function physics(g: YarnRound, dt: number, ev: YarnEvent[]) {
  const b = g.ball, wall = LANE.hw - LANE.ballR;
  if (b.moving) {
    b.x += b.vx * dt; b.z += b.vz * dt;
    if (Math.abs(b.x) > wall) { // the bumpers: no roll is ever wasted
      b.x = clamp(b.x, wall); b.vx *= -0.9;
      ev.push({ type: "bump", x: b.x, z: b.z });
    }
    const speed = Math.hypot(b.vx, b.vz), slow = Math.max(0, speed - CONFIG.drag * dt) / (speed || 1);
    b.vx *= slow; b.vz *= slow;
    g.mice.forEach((m, i) => {
      if (m.down || Math.hypot(m.x - b.x, m.z - b.z) > CONFIG.hitR) return;
      knock(g, i, b.x, b.z, Math.hypot(b.vx, b.vz), ev);
      b.vx *= CONFIG.hitKeep; b.vz *= CONFIG.hitKeep;
    });
    if (b.z < LANE.far || Math.hypot(b.vx, b.vz) < STOP) b.moving = false;
  }
  g.mice.forEach((m) => {
    const speed = Math.hypot(m.vx, m.vz);
    if (!speed) return;
    const slow = Math.max(0, speed - CONFIG.slideDrag * dt) / speed;
    m.x = clamp(m.x + m.vx * dt, LANE.hw - 0.25);
    m.z = Math.max(LANE.far, m.z + m.vz * dt);
    m.vx *= slow; m.vz *= slow;
    if (speed < CONFIG.chainMin) return;
    g.mice.forEach((o, i) => {
      if (!o.down && Math.hypot(o.x - m.x, o.z - m.z) < CONFIG.chainR) knock(g, i, m.x, m.z, speed, ev);
    });
  });
  g.timer += dt;
  if ((!b.moving && g.mice.every((m) => !m.vx && !m.vz)) || g.timer > MAX_ROLL) {
    b.moving = false;
    g.mice.forEach((m) => { m.vx = m.vz = 0; });
    g.phase = "pause"; g.timer = CONFIG.pause;
    ev.push({ type: "rolled", got: g.got, strike: g.got === HOMES.length, cleared: g.mice.every((m) => m.down) });
  }
}

/** Advance the game by dt seconds. Returns what happened, for the scene to show and play. */
export function step(g: YarnRound, dt: number): YarnEvent[] {
  const ev: YarnEvent[] = [];
  if (g.phase === "roll") {
    for (let left = dt; left > 0 && g.phase === "roll"; left -= SUB) physics(g, Math.min(left, SUB), ev);
  } else if (g.phase === "pause") {
    g.timer -= dt;
    if (g.timer > 0) return ev;
    if (g.used >= CONFIG.rolls) { g.phase = "over"; ev.push({ type: "end" }); return ev; }
    if (g.inSet >= CONFIG.resetEvery || g.mice.every((m) => m.down)) { g.mice = stand(); g.inSet = 0; ev.push({ type: "reset" }); }
    g.ball = startBall();
    g.phase = "aim";
    ev.push({ type: "ready" });
  }
  return ev;
}

// ---------- scoring ----------
export type YarnOutcome = "win" | "near" | "try";
export const yarnOutcome = (total: number): YarnOutcome => (total >= CONFIG.goal ? "win" : total >= CONFIG.goal - 2 ? "near" : "try");
/** Only ever warm. */
export const YARN_CHEER: Record<YarnOutcome, string> = {
  win: "You did it! 🏆",
  near: "So close! Try again! 💪",
  try: "Nice rolling! You're getting better every time 💪",
};
