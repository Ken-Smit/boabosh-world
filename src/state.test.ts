import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newState, applyAnswer, feed, wear, newer, needs, happiness, makeCode, CODE_RE, migrate, buy, furnish,
  setActive, activeCat, cleanLitter, water, COINS_PER_ANSWER, COINS_PER_LESSON, COINS_PER_CHORE, type State,
  canPlay, startGame, winGame, GAMES, BRAIN_PER_GAME, drain, DRAIN, PICTURES, codeToPictures, picturesToCode,
} from "./state.ts";
import { CATALOG, BY_ID, STARTER } from "./shop.ts";

const HOUR = 3_600_000;

const run = (n: number, area: "forest" | "mountain" | "lab" = "forest") => {
  let s = newState(0);
  const got: string[] = [];
  let coins = 0;
  for (let i = 0; i < n; i++) {
    const r = applyAnswer(s, area, true, i + 1);
    s = r.state;
    coins += r.coins;
    got.push(...r.unlocked.map((u) => u.id));
  }
  return { s, got, coins };
};
const rich = (coins = 10_000): State => ({ ...newState(0), coins });

test("right answers earn coins and fish, unlock at the threshold once each", () => {
  const { s, got, coins } = run(7);
  assert.equal(s.coins, 7 * COINS_PER_ANSWER);
  assert.equal(coins, 7 * COINS_PER_ANSWER);
  assert.equal(s.fish, 3 + 7); // starter fish + one per answer
  assert.deepEqual(got, ["acorn-hat", "leaf-collar"]);
  assert.ok(s.items.includes("acorn-hat") && s.items.includes("leaf-collar"));
});

test("every 10th right answer in a place completes a lesson and pays the bonus", () => {
  assert.equal(run(9).s.coins, 9 * COINS_PER_ANSWER);
  assert.equal(run(10).s.coins, 10 * COINS_PER_ANSWER + COINS_PER_LESSON);
  assert.equal(run(20).s.coins, 20 * COINS_PER_ANSWER + 2 * COINS_PER_LESSON);
  assert.equal(run(10, "lab").s.cleared.forest, 0); // lessons count per place
});

test("difficulty climbs with right answers, eases off after misses, stays in grades 2–4", () => {
  let s = newState(0);
  let reached: number | null = null;
  for (let i = 0; i < 9; i++) { const r = applyAnswer(s, "mountain", true, i); s = r.state; reached ??= r.gradeUp; }
  assert.equal(Math.floor(s.grade.mountain), 3);
  assert.equal(reached, 3);
  assert.equal(s.grade.forest, 2); // other places untouched
  s = applyAnswer(s, "mountain", false, 10).state;
  assert.ok(s.grade.mountain < 3.08 + 0.001);
  for (let i = 0; i < 100; i++) s = applyAnswer(s, "mountain", true, i).state;
  assert.equal(s.grade.mountain, 4.99);
  for (let i = 0; i < 100; i++) s = applyAnswer(s, "mountain", false, i).state;
  assert.equal(s.grade.mountain, 2);
});

test("recently asked questions are remembered per place, capped", () => {
  let s = newState(0);
  for (let i = 0; i < 80; i++) s = applyAnswer(s, "lab", i % 2 === 0, i, `q${i}`).state;
  assert.equal(s.seen.lab.length, 60);
  assert.equal(s.seen.lab.at(-1), "q79");
  assert.deepEqual(s.seen.forest, []);
});

test("wrong answers cost nothing and earn nothing", () => {
  const r = applyAnswer(newState(0), "forest", false, 5);
  assert.equal(r.state.coins, 0);
  assert.equal(r.state.cleared.forest, 0);
  assert.deepEqual(r.unlocked, []);
});

test("buying: costs coins, refuses when broke, never twice", () => {
  const r = buy(rich(100), "party-hat", 1);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.state.coins, 100 - BY_ID["party-hat"]!.price);
  assert.ok(r.state.items.includes("party-hat"));
  assert.deepEqual(buy(r.state, "party-hat", 2), { ok: false, why: "owned" });
  assert.deepEqual(buy(newState(0), "crown", 2), { ok: false, why: "coins" });
  assert.deepEqual(buy(rich(), "no-such-thing", 2), { ok: false, why: "unknown" });
});

test("food is a consumable: buy again and again, adds servings", () => {
  let s = rich(100);
  for (let i = 0; i < 2; i++) { const r = buy(s, "fish-3"); assert.ok(r.ok); if (r.ok) s = r.state; }
  assert.equal(s.fish, 3 + 6);
});

test("buying a cat adds a cat you can switch to; each wears its own outfit", () => {
  const r = buy(rich(), "cat-pepper", 1);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.state.cats.length, 2);
  const h = buy(r.state, "crown", 2);
  assert.ok(h.ok);
  if (!h.ok) return;
  const pepper = setActive(wear(h.state, "crown"), "cat-pepper");
  assert.equal(activeCat(pepper).name, "Pepper");
  assert.equal(activeCat(pepper).worn.hat, null); // the crown is on Boabosh
  assert.equal(pepper.cats[0]!.worn.hat, "crown");
});

test("wear toggles, refuses unowned items and things that aren't clothes", () => {
  const { s } = run(9);
  assert.equal(activeCat(wear(s, "acorn-hat")).worn.hat, "acorn-hat");
  assert.equal(activeCat(wear(wear(s, "acorn-hat"), "acorn-hat")).worn.hat, null);
  assert.equal(activeCat(wear(s, "goggles")).worn.hat, null); // not owned
  assert.deepEqual(wear(s, "yarn"), s); // toys are not worn
  const suited = wear({ ...s, items: [...s.items, "ghost-sheet"] }, "ghost-sheet");
  assert.equal(activeCat(suited).worn.costume, "ghost-sheet"); // costumes get their own slot
});

test("furnishing swaps owned furniture and toggles decor", () => {
  const r = buy(rich(), "bed-donut");
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(furnish(r.state, "bed-donut").home.bed, "bed-donut");
  assert.equal(furnish(newState(0), "bed-cloud").home.bed, "bed-basket"); // not owned
  const p = buy(rich(), "plant");
  assert.ok(p.ok);
  if (!p.ok) return;
  const on = furnish(p.state, "plant");
  assert.deepEqual(on.home.decor, ["scratcher", "plant"]); // the free scratching post is always there to start
  assert.deepEqual(furnish(on, "plant").home.decor, ["scratcher"]);
});

test("needs run down over hours to a floor of 10, and care tops them up", () => {
  const s = newState(0);
  assert.equal(needs(s, 0).food, 100);
  assert.equal(needs(s, 6 * HOUR).food, 55); // halfway through 12 hours
  assert.equal(needs(s, 100 * HOUR).food, 10);
  assert.equal(needs(feed(s, 50 * HOUR), 50 * HOUR).food, 100);
  assert.equal(needs(water(s, 50 * HOUR), 50 * HOUR).water, 100);
  assert.equal(happiness(s, 0), 100);
});

test("feeding spends a serving; no food is a no-op", () => {
  assert.equal(feed(newState(0), 10).fish, 2);
  const broke = { ...newState(0), fish: 0 };
  assert.equal(feed(broke, 10), broke);
});

test("cleaning the litter pays only when it was dirty", () => {
  const s = newState(0);
  assert.equal(cleanLitter(s, HOUR).coins, 0);
  const dirty = cleanLitter(s, 20 * HOUR);
  assert.equal(dirty.coins, COINS_PER_CHORE);
  assert.equal(needs(dirty.state, 20 * HOUR).clean, 100);
});

test("v1 saves migrate: keep progress, credit coins, Boabosh keeps the outfit", () => {
  const v1 = {
    v: 1, name: "Boabosh", fish: 4, items: ["acorn-hat"], worn: { hat: "acorn-hat", collar: null },
    cleared: { forest: 3, mountain: 2, lab: 0 }, lastFed: 5, updatedAt: 9,
  };
  const s = migrate(v1, 100)!;
  assert.equal(s.v, 2);
  assert.equal(s.coins, 5 * COINS_PER_ANSWER);
  assert.equal(s.fish, 4);
  assert.equal(activeCat(s).worn.hat, "acorn-hat");
  assert.equal(activeCat(s).fed, 5);
  assert.ok(STARTER.every((id) => s.items.includes(id)));
  assert.equal(migrate({ v: 99 }), null);
  assert.equal(migrate(null), null);
});

test("catalog: unique ids, starter items free, prices sane", () => {
  const ids = CATALOG.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(CATALOG.length > 90);
  assert.ok(CATALOG.every((i) => i.price >= 0 && i.price <= 1000));
});

test("newer picks the later save and tolerates nulls", () => {
  const a = { ...newState(0), updatedAt: 10 };
  const b = { ...newState(0), updatedAt: 20 };
  assert.equal(newer(a, b), b);
  assert.equal(newer(b, a), b);
  assert.equal(newer(null, a), a);
  assert.equal(newer(null, null), null);
});

test("save codes match what the server accepts and skip lookalike glyphs", () => {
  for (let i = 0; i < 200; i++) {
    const c = makeCode((n) => crypto.getRandomValues(new Uint8Array(n)));
    assert.match(c, CODE_RE);
    assert.ok(!/[01OIL]/.test(c), `lookalike glyph in ${c}`);
  }
});

test("games need fresh right answers AND coins; playing resets the brain meter", () => {
  const broke = run(BRAIN_PER_GAME - 1).s;
  assert.deepEqual(canPlay(broke, "rps"), { ok: false, why: "brain", need: 1 });
  const ready = run(BRAIN_PER_GAME).s; // 3 answers = 30 coins
  assert.deepEqual(canPlay(ready, "rps"), { ok: true });
  assert.deepEqual(canPlay(ready, "chess"), { ok: false, why: "coins", need: GAMES.chess.price - ready.coins });
  const played = startGame(ready, "rps", 99);
  assert.equal(played.coins, ready.coins - GAMES.rps.price);
  assert.equal(played.sinceGame, 0);
  assert.equal(activeCat(played).played, 99); // games are fun for the cat too
  assert.equal(canPlay(played, "rps").ok, false); // learn again before the next one
  assert.deepEqual(startGame(broke, "rps"), broke);
});

test("a rich player still can't skip learning: coins alone don't unlock games", () => {
  const banked = { ...rich(9999), sinceGame: 0 };
  assert.equal(canPlay(banked, "chess").ok, false);
});

test("winning gives a trophy, never coins", () => {
  const s = winGame(rich(50), "ttt");
  assert.equal(s.trophies.ttt, 1);
  assert.equal(s.coins, 50);
});

test("older v2 saves gain the new fields and the free scratching post", () => {
  const { sinceGame: _a, trophies: _b, grade: _c, seen: _d, ...old } = newState(0);
  const legacy = { ...old, items: old.items.filter((i) => i !== "scratcher"), home: { ...old.home, decor: [] } };
  const s = migrate(legacy, 5)!;
  assert.equal(s.sinceGame, 0);
  assert.deepEqual(s.trophies, { rps: 0, ttt: 0, chess: 0 });
  assert.deepEqual(s.grade, { forest: 2, mountain: 2, lab: 2 });
  assert.ok(s.items.includes("scratcher"));
  assert.deepEqual(s.home.decor, ["scratcher"]);
});

test("picture codes: one distinct picture per code letter, round-trips every code", () => {
  assert.equal(PICTURES.length, 31);
  assert.equal(new Set(PICTURES.map((p) => p[0])).size, 31);
  assert.equal(new Set(PICTURES.map((p) => p[1])).size, 31);
  for (let i = 0; i < 200; i++) {
    const c = makeCode((n) => crypto.getRandomValues(new Uint8Array(n)));
    const pics = codeToPictures(c);
    assert.ok(pics.every((p) => p >= 0 && p < 31));
    assert.equal(picturesToCode(pics), c);
  }
  assert.equal(codeToPictures("A0")[1], -1); // a lookalike glyph never appears in real codes
});

test("playing makes the cat hungry and tired: minutes, answers and games all use up needs", () => {
  const s = newState(0);
  const after10min = Array.from({ length: 10 }).reduce<State>((x) => drain(x, DRAIN.minute, 0), s);
  const n = needs(after10min, 0);
  assert.equal(n.food, 92);
  assert.equal(n.water, 90);
  assert.ok(n.energy < 100 && n.love < 100 && n.fun < 100 && n.clean < 100);
  const answered = applyAnswer(s, "forest", false, 0).state; // even a wrong answer is effort
  assert.equal(needs(answered, 0).food, 99);
  const played = startGame({ ...s, coins: 100, sinceGame: 3 }, "rps", 0);
  assert.equal(needs(played, 0).energy, 95);
  assert.equal(needs(played, 0).fun, 100); // a game is fun, though
});

test("needs never drop below the floor, and care fills them back up", () => {
  let s = newState(0);
  for (let i = 0; i < 500; i++) s = drain(s, DRAIN.minute, 0);
  const n = needs(s, 0);
  assert.ok(Object.values(n).every((v) => v === 10), JSON.stringify(n));
  assert.equal(needs(feed(s, 0), 0).food, 100);
});

test("only the cat you're playing with gets tired", () => {
  const r = buy({ ...newState(0), coins: 1000 }, "cat-pepper", 0);
  assert.ok(r.ok);
  if (!r.ok) return;
  const s = drain(r.state, { food: 30 }, 0);
  assert.equal(needs(s, 0, s.cats[0]).food, 70);
  assert.equal(needs(s, 0, s.cats[1]).food, 100);
});
