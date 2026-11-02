import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONFIG, HOMES, LANE, YARN_CHEER, aimFromDrag, keyStart, newYarnRound, roll, step, yarnOutcome,
  type YarnEvent, type YarnRound,
} from "./yarnroll.ts";

// Seeded, so a failure here is a real change and not bad luck.
const seeded = (n: number) => () => {
  n = (n + 0x6d2b79f5) | 0;
  let t = Math.imul(n ^ (n >>> 15), 1 | n);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const DT = 1 / 30;
type Player = (g: YarnRound, rnd: () => number) => { aim: number; power: number };

/** Runs until the phase changes away from "roll"/"pause", collecting events. */
function settle(g: YarnRound) {
  const ev: YarnEvent[] = [];
  for (let i = 0; i < 2000 && g.phase !== "aim" && g.phase !== "over"; i++) ev.push(...step(g, DT));
  return ev;
}
function play(seed: number, player: Player) {
  const g = newYarnRound(seeded(seed)), rnd = seeded(seed * 7 + 1);
  while (g.phase !== "over") {
    const { aim, power } = player(g, rnd);
    assert.equal(roll(g, aim, power), true);
    settle(g);
  }
  return g;
}

/** A little kid: any direction the lane allows, any pull big enough to count. */
const clumsy: Player = (_g, rnd) => ({ aim: (rnd() * 2 - 1) * CONFIG.maxAim, power: CONFIG.minPull + rnd() * (1 - CONFIG.minPull) });
/** A kid who's had a few tries: a firm pull, aimed at the middle of the mice still up. */
const careful: Player = (g, rnd) => {
  const up = g.mice.filter((m) => !m.down);
  const x = up.reduce((s, m) => s + m.x, 0) / up.length, z = up.reduce((s, m) => s + m.z, 0) / up.length;
  return { aim: Math.atan2(x - g.ball.x, g.ball.z - z) + (rnd() * 2 - 1) * 0.05, power: 0.75 + rnd() * 0.2 };
};
/** The least a player can do: the smallest pull that counts, dead straight. */
const lazy: Player = () => ({ aim: 0, power: CONFIG.minPull });
/** Mashing Space, never touching the arrows. */
const masher: Player = (_g, rnd) => keyStart(rnd);

const stats = (p: Player, n = 500) => {
  let wins = 0, sum = 0;
  for (let s = 1; s <= n; s++) { const t = play(s, p).total; sum += t; if (yarnOutcome(t) === "win") wins++; }
  return { rate: wins / n, avg: sum / n };
};

test("a game is 5 rolls, and the mice pop back after every 2 rolls or when all are down", () => {
  const g = newYarnRound(seeded(1));
  let resets = 0, ends = 0, rolled = 0;
  while (g.phase !== "over") {
    const set = g.inSet;
    roll(g, 0, 0.9);
    const ev = settle(g), r = ev.find((e) => e.type === "rolled");
    rolled++;
    const reset = ev.some((e) => e.type === "reset");
    resets += reset ? 1 : 0;
    ends += ev.filter((e) => e.type === "end").length;
    if (g.phase === "aim") {
      assert.equal(reset, set + 1 >= CONFIG.resetEvery || (r?.type === "rolled" && r.cleared));
      if (reset) assert.ok(g.mice.every((m) => !m.down));
    }
    if (g.phase === "aim") assert.deepEqual([g.ball.x, g.ball.z], [0, LANE.near]);
  }
  assert.equal(rolled, CONFIG.rolls);
  assert.equal(ends, 1);
  assert.ok(resets >= 2);
});

test("you can only roll when it's time, and a score counts each mouse once", () => {
  const g = newYarnRound(seeded(2));
  assert.equal(HOMES.length, 6);
  assert.equal(roll(g, 0, 1), true);
  assert.equal(roll(g, 0, 1), false);
  let knocks = 0;
  const seen = new Set<number>();
  for (const e of settle(g)) if (e.type === "knock") { knocks++; assert.ok(!seen.has(e.mouse)); seen.add(e.mouse); }
  assert.equal(knocks, g.total);
  assert.ok(g.total <= 6);
});

test("nothing happens until you roll: doing nothing never wins", () => {
  const g = newYarnRound(seeded(3));
  for (let i = 0; i < 5000; i++) assert.deepEqual(step(g, DT), []);
  assert.equal(g.total, 0);
  assert.equal(g.phase, "aim");
});

test("bumpers keep every roll in the lane, and no roll is wasted", () => {
  for (const aim of [-CONFIG.maxAim, -0.3, 0, 0.3, CONFIG.maxAim]) for (const power of [0, 0.5, 1]) {
    const g = newYarnRound(seeded(4));
    roll(g, aim, power);
    for (let i = 0; i < 2000 && g.phase === "roll"; i++) {
      step(g, DT);
      assert.ok(Math.abs(g.ball.x) <= LANE.hw - LANE.ballR + 1e-9, "stays between the bumpers");
    }
    assert.ok(g.total >= 1, `aim ${aim} power ${power} knocked ${g.total}`);
  }
});

test("a fast sliding mouse chains into another; a slow one doesn't", () => {
  const knocks = (speed: number) => {
    const g = newYarnRound(seeded(5));
    g.ball.moving = false;
    g.phase = "roll";
    Object.assign(g.mice[1]!, { down: true, vx: speed, vz: 0 }); // slides at its neighbour across the triangle
    return settle(g).filter((e) => e.type === "knock").length;
  };
  assert.ok(knocks(CONFIG.chainMin + 4) >= 1);
  assert.equal(knocks(CONFIG.chainMin - 1), 0);
});

test("a firm roll beats a soft one", () => {
  const total = (power: number) => { const g = newYarnRound(seeded(5)); roll(g, 0, power); settle(g); return g.total; };
  assert.ok(total(1) > total(0));
});

test("frame rate barely matters", () => {
  const run = (dt: number) => {
    const g = newYarnRound(seeded(6));
    roll(g, 0.1, 0.7);
    for (let i = 0; i < 5000 && g.phase === "roll"; i++) step(g, dt);
    return g.total;
  };
  assert.ok(Math.abs(run(1 / 60) - run(1 / 20)) <= 1);
});

test("dragging back aims the other way, with a limit, and pushing forward has no power", () => {
  assert.deepEqual(aimFromDrag(0, 100, 100), { aim: -0, power: 1 });
  assert.ok(aimFromDrag(-30, 100, 100).aim > 0, "pull left, roll right");
  assert.ok(aimFromDrag(30, 100, 100).aim < 0, "pull right, roll left");
  assert.equal(aimFromDrag(-500, 10, 100).aim, CONFIG.maxAim);
  assert.equal(aimFromDrag(0, 400, 100).power, 1);
  assert.equal(aimFromDrag(0, 50, 100).power, 0.5);
  assert.equal(aimFromDrag(10, -80, 100).power, 0);
});

test("outcomes and messages stay warm", () => {
  assert.equal(yarnOutcome(CONFIG.goal), "win");
  assert.equal(yarnOutcome(CONFIG.goal - 1), "near");
  assert.equal(yarnOutcome(0), "try");
  assert.match(YARN_CHEER.near, /So close!/);
});

// Headless games, real rules. These numbers are the "not too hard" promise.
test("simulated kids: clumsy usually wins, careful always does, the laziest pull doesn't", () => {
  const c = stats(clumsy), k = stats(careful), l = stats(lazy), m = stats(masher);
  console.log(`win rates (goal ${CONFIG.goal})  clumsy ${c.rate} (avg ${c.avg})  careful ${k.rate} (avg ${k.avg})  laziest pull ${l.rate} (avg ${l.avg})  Space mash ${m.rate} (avg ${m.avg})`);
  assert.ok(c.rate >= 0.75, `clumsy ${c.rate}`);
  assert.ok(c.rate < 1, "still a game");
  assert.ok(k.rate >= 0.99, `careful ${k.rate}`);
  assert.equal(l.rate, 0, `laziest ${l.rate}`);
  assert.ok(m.rate < c.rate, `Space mash ${m.rate} should do worse than really rolling`);
});
