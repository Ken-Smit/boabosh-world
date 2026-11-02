// Fish Catch rules: the tuning table, spawning, falling, catching, scoring. No
// DOM or three.js: the board only draws what `step` says, and the tests play
// whole rounds headlessly with the very same code. x and y run 0 to 1 across the
// board, y down.

export type Rng = () => number;
export type Kind = "fish" | "gold" | "boot";
export type Thing = { id: number; kind: Kind; x: number; y: number };
export type Round = {
  time: number; // seconds played; below 0 is the "get ready" moment
  score: number;
  won: boolean; // stays true even if a boot then dips the score under the goal
  over: boolean;
  basket: number; // centre x
  wobble: number; // seconds of silly wobble left
  things: Thing[];
  nextSpawn: number;
  nextId: number;
};
export type Happening =
  | { type: "catch"; kind: Kind; points: number; x: number }
  | { type: "goal" }
  | { type: "end" };

// ---------- the one table to tune ----------
export const CFG = {
  seconds: 40,
  lead: 1.5, // get-ready seconds before the clock starts
  goal: 18,
  gap: [1.0, 0.82] as const, // seconds between things, first to last moment of the round
  fall: [0.24, 0.31] as const, // board heights per second, first to last moment
  gold: 0.12, // chance a thing is a golden fish
  boot: 0.2, // chance a thing is a boot
  points: { fish: 1, gold: 3, boot: -1 } as Record<Kind, number>,
  basket: 0.3, // basket width
  grace: 0.03, // extra reach either side, so near misses count
  catchTop: 0.74, // a thing's centre is caught between these heights
  catchBottom: 0.96,
  keySpeed: 1.1, // arrow keys: board widths per second
  wobble: 0.5,
  maxStep: 0.1, // longest step: a hidden tab can't pile things up
};

const lerp = ([a, b]: readonly number[], t: number) => a! + (b! - a!) * Math.min(1, Math.max(0, t / CFG.seconds));

export const newRound = (): Round => ({
  time: -CFG.lead, score: 0, won: false, over: false, basket: 0.5, wobble: 0, things: [], nextSpawn: 0, nextId: 0,
});

export const secondsLeft = (r: Round) => Math.ceil(Math.min(CFG.seconds, CFG.seconds - r.time));

/** The first thing is always a fish, so nobody's round opens with a boot. */
export function spawn(rng: Rng, id: number): Thing {
  const roll = rng();
  const kind: Kind = id === 0 || roll >= CFG.gold + CFG.boot ? "fish" : roll < CFG.gold ? "gold" : "boot";
  return { id, kind, x: 0.06 + rng() * 0.88, y: -0.08 };
}

export const inBasket = (t: Thing, basket: number) =>
  t.y >= CFG.catchTop && t.y <= CFG.catchBottom && Math.abs(t.x - basket) <= CFG.basket / 2 + CFG.grace;

export const moveBasket = (r: Round, x: number) => {
  r.basket = Math.min(1 - CFG.basket / 2, Math.max(CFG.basket / 2, x));
};

/** Advance the round; what happened comes back for the board to show and play. */
export function step(r: Round, seconds: number, rng: Rng): Happening[] {
  if (r.over) return [];
  const dt = Math.min(seconds, CFG.maxStep), out: Happening[] = [];
  r.time += dt;
  r.wobble = Math.max(0, r.wobble - dt);
  if (r.time < 0) return out;
  if (r.time >= CFG.seconds) {
    r.over = true;
    r.things = [];
    out.push({ type: "end" });
    return out;
  }
  r.nextSpawn -= dt;
  if (r.nextSpawn <= 0) {
    r.things.push(spawn(rng, r.nextId++));
    r.nextSpawn = lerp(CFG.gap, r.time) * (0.85 + rng() * 0.3);
  }
  const fall = lerp(CFG.fall, r.time) * dt;
  r.things = r.things.filter((t) => {
    t.y += fall;
    if (inBasket(t, r.basket)) {
      const points = CFG.points[t.kind];
      r.score = Math.max(0, r.score + points);
      if (t.kind === "boot") r.wobble = CFG.wobble;
      out.push({ type: "catch", kind: t.kind, points, x: t.x });
      return false;
    }
    return t.y < 1.1;
  });
  if (!r.won && r.score >= CFG.goal) { r.won = true; out.push({ type: "goal" }); }
  return out;
}

export const outcome = (r: Round): "win" | "lose" => (r.won ? "win" : "lose");

/** The warm last word on a round. */
export function finalWords(r: Round) {
  const short = CFG.goal - r.score;
  if (r.won) return `You scored ${r.score}! What a catch!`;
  if (short <= 3) return `So close! You scored ${r.score}. Just ${short} more next time!`;
  return `Nice catching! You scored ${r.score}. The goal is ${CFG.goal}, try again soon!`;
}
