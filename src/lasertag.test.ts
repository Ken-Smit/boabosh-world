import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LEVELS, LEVEL_ORDER, WALLS, ARENA, PLAYER_START, POWER_SPOTS, CHEER, newRound, step, pickTarget, canSee, move, foeAim, angleTo, foeWantsToFire, outcome,
  type Level, type Round, type Input,
} from "./lasertag.ts";

// Seeded, so a failure here is a real change and not bad luck.
const seeded = (n: number) => () => {
  n = (n + 0x6d2b79f5) | 0;
  let t = Math.imul(n ^ (n >>> 15), 1 | n);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const DT = 1 / 30;
type Player = (g: Round, rnd: () => number) => Input;

function play(level: Level, seed: number, player: Player, each?: (g: Round, ev: ReturnType<typeof step>, time: number) => void) {
  const g = newRound(level, seeded(seed)), rnd = seeded(seed * 7 + 1);
  let time = 0;
  while (g.left > 0) {
    const ev = step(g, player(g, rnd), DT);
    time += DT;
    each?.(g, ev, time);
  }
  return g;
}
const nearest = (g: Round) => g.foes.reduce((a, b) => (Math.hypot(a.x - g.p.x, a.z - g.p.z) < Math.hypot(b.x - g.p.x, b.z - g.p.z) ? a : b));

/** A little kid: wanders off half the time, taps TAG now and then, never dodges. */
const clumsy = (): Player => {
  let mx = 0, mz = 0, next = 0;
  return (g, rnd) => {
    next -= DT;
    if (next <= 0) {
      next = 0.5 + rnd();
      const a = rnd() < 0.5 ? rnd() * 6.3 : angleTo(g.p, nearest(g));
      mx = Math.sin(a); mz = Math.cos(a);
    }
    return { mx, mz, fire: rnd() < 0.05 };
  };
};
/** A kid who's had a few tries: heads for the nearest foe, keeps moving, taps TAG steadily. */
const practised = (): Player => (g, rnd) => {
  const a = angleTo(g.p, g.star ?? nearest(g));
  const wob = Math.sin(g.left * 2.5) * 0.9; // weaves a bit, so slow beams tend to miss
  return { mx: Math.sin(a + wob), mz: Math.cos(a + wob), fire: rnd() < 0.2 };
};
const rate = (level: Level, make: () => Player, n = 200) => {
  let wins = 0;
  for (let s = 1; s <= n; s++) if (outcome(play(level, s, make())) === "win") wins++;
  return wins / n;
};

test("difficulty goes up in order", () => {
  const [e, m, h] = LEVEL_ORDER.map((l) => LEVELS[l]) as [typeof LEVELS.easy, typeof LEVELS.easy, typeof LEVELS.easy];
  assert.ok(e.foes <= m.foes && m.foes < h.foes);
  for (const k of ["foeSpeed", "beamSpeed", "foeSafe", "tagGap"] as const) assert.ok(e[k] < m[k] && m[k] < h[k], k);
  for (const k of ["fireGap", "telegraph", "aimError", "playerSafe", "foeDizzy", "cone", "reach"] as const) assert.ok(e[k] > m[k] && m[k] > h[k], k);
});

test("even Hard is gentle", () => {
  const h = LEVELS.hard;
  assert.ok(h.foes <= 3);
  assert.ok(h.telegraph >= 0.75, "foes always wind up long enough to see");
  assert.ok(h.fireGap >= 2, "a foe fires at most about every two seconds");
  assert.ok(h.beamSpeed <= 8, "beams stay slow enough to step out of the way");
  assert.ok(h.playerSafe >= 2, "a tag always buys breathing room");
  assert.ok(h.cone >= 60, "aim assist stays generous");
  assert.ok(h.powerEvery <= 12, "the player gets power-up help");
  assert.ok(h.seconds <= 60);
});

test("foes always stand still and telegraph before firing", () => {
  for (const level of LEVEL_ORDER) {
    const aimAt = new Map<number, number>();
    let shots = 0;
    play(level, 3, () => ({ mx: 0, mz: 0, fire: false }), (g, ev, time) => {
      for (const e of ev) {
        if (e.type === "aim") aimAt.set(e.foe, time);
        if (e.type === "tagFoe") aimAt.delete(e.foe);
        if (e.type === "shot") {
          shots++;
          assert.ok(time - aimAt.get(e.foe)! >= LEVELS[level].telegraph - DT * 1.5, level);
          aimAt.delete(e.foe);
        }
      }
      for (const [i] of aimAt) assert.equal(g.foes[i]!.moving, false);
    });
    assert.ok(shots > 0, `${level} foes do fire`);
  }
});

test("walls block sight and movement", () => {
  assert.equal(canSee({ x: 0, z: 3 }, { x: 0, z: -1 }), false); // the middle wall
  assert.equal(canSee({ x: -8, z: -4.5 }, { x: 8, z: -4.5 }), true);
  assert.equal(canSee({ x: 0, z: 4 }, { x: 8, z: 4 }), true);
  assert.equal(move({ x: 0, z: 1.6 }, 0, -1).z, 1.6);
  assert.equal(move({ x: 0, z: 1.6 }, 0.5, -1).x, 0.5); // walking into it at an angle slides along
  assert.equal(move({ x: ARENA.hw - 0.5, z: 0 }, 5, 0).x, ARENA.hw - 0.45);
  for (const s of [PLAYER_START, ...POWER_SPOTS]) assert.ok(WALLS.every((w) => Math.abs(s.x - w.x) > w.hw || Math.abs(s.z - w.z) > w.hd));
});

test("aim assist locks on within the cone, not through walls or at a dizzy cat", () => {
  const g = newRound("medium", seeded(1));
  const f = g.foes[0]!;
  g.foes = [f];
  Object.assign(g.p, { x: 0, z: 3, face: Math.PI / 2 }); // facing +x
  Object.assign(f, { x: 4, z: 4 });
  assert.equal(pickTarget(g), 0);
  Object.assign(f, { x: -4, z: 3 }); // straight behind
  assert.equal(pickTarget(g), -1);
  g.p.face = -Math.PI / 2;
  assert.equal(pickTarget(g), 0);
  f.phase = "dizzy";
  assert.equal(pickTarget(g), -1);
  f.phase = "walk";
  Object.assign(g.p, { x: 0, z: 2, face: Math.PI });
  Object.assign(f, { x: 0, z: -0.5 }); // behind the middle wall
  assert.equal(pickTarget(g), -1);
});

test("a foe won't fire blind, and its aim stays within its error", () => {
  const cfg = LEVELS.hard;
  const f = { ...newRound("hard", seeded(1)).foes[0]!, x: 0, z: -1, wait: 0 };
  assert.equal(foeWantsToFire(f, { x: 0, z: 2 }, cfg), false); // wall between
  assert.equal(foeWantsToFire(f, { x: 3, z: -1 }, cfg), true);
  assert.equal(foeWantsToFire({ ...f, wait: 1 }, { x: 3, z: -1 }, cfg), false);
  const rnd = seeded(9);
  for (let i = 0; i < 200; i++) {
    const a = foeAim(f, { x: 3, z: -1 }, cfg.aimError, rnd);
    assert.ok(Math.abs(a - Math.PI / 2) <= (cfg.aimError * Math.PI) / 180);
  }
});

test("a tag scores, the foe gets dizzy and pops back up; the player is never out", () => {
  const still = { mx: 0, mz: 0, fire: false };
  const g = newRound("easy", seeded(2));
  for (let i = 0; i < 90; i++) step(g, still, DT); // past the countdown
  Object.assign(g.p, { x: -7, z: -4.2 });
  Object.assign(g.foes[0]!, { x: -5, z: -4.2 });
  const ev = step(g, { ...still, fire: true }, DT);
  assert.equal(g.blue, 1);
  assert.ok(ev.some((e) => e.type === "tagFoe" && e.foe === 0));
  assert.equal(g.foes[0]!.phase, "dizzy");
  for (let i = 0; i < 120; i++) step(g, still, DT);
  assert.notEqual(g.foes[0]!.phase, "dizzy");
  // A beam into the player: one tag, then safe however many more arrive.
  g.foes = [];
  const pink = g.pink;
  const shoot = () => g.shots.push({ x: g.p.x + 0.3, z: g.p.z, vx: 0, vz: 0 });
  g.p.safe = 0;
  shoot(); step(g, still, DT);
  assert.equal(g.pink, pink + 1);
  shoot(); step(g, still, DT);
  assert.equal(g.pink, pink + 1);
  assert.equal(g.shots.length, 0);
});

test("nothing happens in the countdown, and rounds end once, on time", () => {
  const g = newRound("hard", seeded(4));
  assert.deepEqual(step(g, { mx: 1, mz: 0, fire: true }, DT), []);
  assert.deepEqual({ x: g.p.x, z: g.p.z }, PLAYER_START);
  let ended = 0;
  play("hard", 4, clumsy(), (_g, e) => { ended += e.filter((x) => x.type === "end").length; });
  assert.equal(ended, 1);
});

test("power star: picked up, and the player can't be tagged while it lasts", () => {
  const still = { mx: 0, mz: 0, fire: false };
  const g = newRound("hard", seeded(5));
  g.foes = [];
  while (!g.star) step(g, still, DT);
  Object.assign(g.p, { x: g.star.x, z: g.star.z });
  assert.ok(step(g, still, DT).some((e) => e.type === "gotStar"));
  g.shots.push({ x: g.p.x, z: g.p.z, vx: 0, vz: 0 });
  step(g, still, DT);
  assert.equal(g.pink, 0);
});

test("outcomes and messages stay warm", () => {
  assert.equal(outcome({ blue: 3, pink: 2 }), "win");
  assert.equal(outcome({ blue: 2, pink: 2 }), "tie");
  assert.equal(outcome({ blue: 1, pink: 2 }), "lose");
  assert.match(CHEER.lose, /So close! Try again!/);
});

// Headless rounds, real rules. These numbers are the "not too hard" promise.
test("simulated kids: Easy is nearly always a win, Hard is hard but winnable", () => {
  const easy = rate("easy", clumsy), medium = rate("medium", clumsy), hard = rate("hard", clumsy);
  const easyP = rate("easy", practised), mediumP = rate("medium", practised), hardP = rate("hard", practised);
  console.log(`win rates  clumsy: easy ${easy} medium ${medium} hard ${hard}  practised: easy ${easyP} medium ${mediumP} hard ${hardP}`);
  assert.ok(easy >= 0.9, `clumsy on easy ${easy}`);
  assert.ok(medium >= 0.6, `clumsy on medium ${medium}`);
  assert.ok(mediumP >= 0.9, `practised on medium ${mediumP}`);
  assert.ok(hardP >= 0.5, `practised on hard ${hardP}`);
  assert.ok(hard < medium, "hard is harder for the same kid");
});
