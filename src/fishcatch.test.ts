import { test } from "node:test";
import assert from "node:assert/strict";
import { CFG, newRound, spawn, step, inBasket, moveBasket, outcome, finalWords, secondsLeft, type Rng, type Round, type Thing } from "./fishcatch.ts";

/** Small seeded generator, so a failing round can be replayed. */
const seeded = (seed: number): Rng => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const thing = (kind: Thing["kind"], x: number, y: number): Thing => ({ id: 9, kind, x, y });
const playing = (): Round => ({ ...newRound(), time: 1, nextSpawn: 99 });

/** Play a round at 30 frames a second, letting `move` steer the basket. */
function play(rng: Rng, move: (r: Round, dt: number) => void = () => {}) {
  const r = newRound(), dt = 1 / 30;
  while (!r.over) { move(r, dt); step(r, dt, rng); }
  return r;
}

/** Slow to notice, slow to move, misjudges where things land, looks away, and ignores boots. */
function clumsy(rng: Rng) {
  let aim = 0.5, think = 0.6, dreaming = 0;
  return (r: Round, dt: number) => {
    think -= dt;
    dreaming = Math.max(0, dreaming - dt);
    if (think <= 0) {
      think = 0.55 + rng() * 0.45;
      if (rng() < 0.25) dreaming = 1.2;
      // Usually whatever is falling lowest, boots included; sometimes the wrong one.
      const seen = r.things.filter((t) => t.y < CFG.catchBottom).sort((a, b) => b.y - a.y);
      const pick = seen[rng() < 0.6 ? 0 : 1] ?? seen[0];
      if (pick) aim = pick.x + (rng() - 0.5) * 0.4;
    }
    if (dreaming > 0) return;
    const go = aim - r.basket, most = 0.55 * dt;
    moveBasket(r, r.basket + Math.max(-most, Math.min(most, go)));
  };
}

const winRate = (rounds: number, player: (rng: Rng) => (r: Round, dt: number) => void) => {
  let wins = 0, total = 0;
  for (let i = 0; i < rounds; i++) {
    const rng = seeded(i * 7919 + 1), r = play(rng, player(rng));
    if (outcome(r) === "win") wins++;
    total += r.score;
  }
  return { rate: wins / rounds, mean: total / rounds };
};

test("spawn: the first is a fish, all three kinds come up, and they stay on the board", () => {
  const rng = seeded(1), seen = { fish: 0, gold: 0, boot: 0 };
  assert.equal(spawn(() => CFG.gold / 2, 0).kind, "fish");
  for (let i = 1; i <= 4000; i++) {
    const t = spawn(rng, i);
    seen[t.kind]++;
    assert.ok(t.x > 0 && t.x < 1 && t.y < 0);
  }
  assert.ok(Math.abs(seen.gold / 4000 - CFG.gold) < 0.03);
  assert.ok(Math.abs(seen.boot / 4000 - CFG.boot) < 0.03);
});

test("catch zone: generous sideways, only at basket height", () => {
  const edge = CFG.basket / 2 + CFG.grace;
  assert.ok(inBasket(thing("fish", 0.5 + edge - 0.001, 0.8), 0.5));
  assert.ok(!inBasket(thing("fish", 0.5 + edge + 0.01, 0.8), 0.5));
  assert.ok(!inBasket(thing("fish", 0.5, CFG.catchTop - 0.01), 0.5));
  assert.ok(!inBasket(thing("fish", 0.5, CFG.catchBottom + 0.01), 0.5));
});

test("the basket stays on the board, and can still reach the edges", () => {
  const r = newRound();
  moveBasket(r, -3);
  assert.equal(r.basket, CFG.basket / 2);
  assert.ok(inBasket(thing("fish", 0.06, 0.8), r.basket));
  moveBasket(r, 3);
  assert.equal(r.basket, 1 - CFG.basket / 2);
  assert.ok(inBasket(thing("fish", 0.94, 0.8), r.basket));
});

test("scoring: fish +1, golden +3, a boot -1 with a wobble and never below zero", () => {
  const catchOne = (r: Round, kind: Thing["kind"]) => {
    r.things = [thing(kind, r.basket, 0.8)];
    return step(r, 0.01, () => 0.5);
  };
  const r = playing();
  assert.deepEqual(catchOne(r, "fish"), [{ type: "catch", kind: "fish", points: 1, x: 0.5 }]);
  assert.equal(r.score, 1);
  catchOne(r, "gold");
  assert.equal(r.score, 4);
  assert.equal(r.wobble, 0);
  catchOne(r, "boot");
  assert.equal(r.score, 3);
  assert.ok(r.wobble > 0);
  r.score = 0;
  catchOne(r, "boot");
  assert.equal(r.score, 0);
});

test("missed things just fall away", () => {
  const r = playing();
  r.things = [thing("fish", 0.95, 1.09)];
  r.basket = 0.15;
  assert.deepEqual(step(r, 0.1, () => 0.5), []);
  assert.equal(r.things.length, 0);
  assert.equal(r.score, 0);
});

test("reaching the goal wins once, play goes on, and a boot can't take the win back", () => {
  const r = playing();
  r.score = CFG.goal - 1;
  r.things = [thing("fish", 0.5, 0.8)];
  assert.ok(step(r, 0.01, () => 0.5).some((h) => h.type === "goal"));
  assert.equal(r.over, false);
  r.things = [thing("boot", 0.5, 0.8)];
  assert.ok(!step(r, 0.01, () => 0.5).some((h) => h.type === "goal"));
  assert.equal(r.score, CFG.goal - 1);
  assert.equal(outcome(r), "win");
});

test("the clock: a get-ready moment, then the whole round, then it stops", () => {
  const r = newRound(), rng = seeded(3);
  assert.equal(secondsLeft(r), CFG.seconds);
  step(r, 0.1, rng);
  assert.equal(r.things.length, 0); // nothing falls during get-ready
  const ended: unknown[] = [];
  let frames = 0;
  while (!r.over) { ended.push(...step(r, 0.05, rng).filter((h) => h.type === "end")); frames++; }
  assert.equal(ended.length, 1);
  assert.ok(Math.abs(frames * 0.05 - (CFG.lead + CFG.seconds - 0.1)) < 0.11);
  assert.equal(r.things.length, 0);
  assert.deepEqual(step(r, 1, rng), []);
});

test("a hidden tab coming back can't spawn a pile or skip the round", () => {
  const r = playing();
  r.nextSpawn = 0;
  const before = r.time;
  step(r, 3600, seeded(4));
  assert.equal(r.things.length, 1);
  assert.equal(r.over, false);
  assert.ok(r.time - before <= CFG.maxStep + 1e-9);
});

test("the pace rises only a little", () => {
  assert.ok(CFG.fall[1] / CFG.fall[0] < 1.35);
  assert.ok(CFG.gap[0] / CFG.gap[1] < 1.35);
});

test("the last word is warm, and a near miss says so close", () => {
  const r = newRound();
  r.score = CFG.goal - 2;
  assert.match(finalWords(r), /^So close!.*2 more/);
  r.score = 1;
  assert.match(finalWords(r), /^Nice catching!/);
  r.score = 20; r.won = true;
  assert.match(finalWords(r), /20/);
});

test("a clumsy kid wins most rounds", () => {
  const { rate, mean } = winRate(1000, clumsy);
  console.log(`clumsy: wins ${(rate * 100).toFixed(1)}%, mean score ${mean.toFixed(1)}`);
  assert.ok(rate >= 0.75, `clumsy kid won only ${rate}`);
});

test("a basket nobody moves is not a guaranteed win", () => {
  const { rate, mean } = winRate(1000, () => () => {});
  console.log(`idle: wins ${(rate * 100).toFixed(1)}%, mean score ${mean.toFixed(1)}`);
  assert.ok(rate < 0.5, `idle basket won ${rate}`);
});
