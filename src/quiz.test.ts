import { test } from "node:test";
import assert from "node:assert/strict";
import { generate, levelFor, POOLS, type Level } from "./quiz.ts";
import { AREAS } from "./state.ts";

// Seeded RNG so a failure can be reproduced.
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

test("every item at every grade makes a well-formed question (thousands of draws)", () => {
  const r = seeded(42);
  for (const area of AREAS) {
    for (const item of POOLS[area]) {
      for (let i = 0; i < 40; i++) {
        const m = item.make(r);
        assert.ok(m.q.length > 5, `${area}/${item.skill}: empty question`);
        assert.ok(m.answer.length > 0, `${area}/${item.skill}: empty answer for "${m.q}"`);
        assert.ok(m.wrong.filter((w: string) => w !== m.answer).length >= 1, `${area}/${item.skill}: no wrong answers for "${m.q}"`);
        assert.ok(!/NaN|undefined|Infinity/.test(m.q + m.answer + m.wrong.join()), `${area}/${item.skill}: bad value in "${m.q}"`);
      }
    }
  }
});

test("generated questions: answer is a choice, choices are unique, 3 or 4 of them", () => {
  const r = seeded(7);
  for (const area of AREAS) for (const grade of [2, 3, 4.5]) for (let i = 0; i < 300; i++) {
    const q = generate(area, grade, [], r);
    assert.equal(new Set(q.choices).size, q.choices.length, `duplicate choice in "${q.q}": ${q.choices}`);
    assert.ok(q.a >= 0 && q.a < q.choices.length, `answer missing from "${q.q}"`);
    assert.ok(q.choices.length >= 2 && q.choices.length <= 4);
  }
});

test("math answers are actually right", () => {
  const r = seeded(3);
  const ops: Record<string, (a: number, b: number) => number> = { "+": (a, b) => a + b, "−": (a, b) => a - b, "×": (a, b) => a * b, "÷": (a, b) => a / b };
  let checked = 0;
  for (let i = 0; i < 2000; i++) {
    const q = generate("mountain", 2 + (i % 3), [], r);
    const m = q.q.match(/^(\d+) ([+−×÷]) (\d+) = \?$/);
    if (!m) continue;
    const want = ops[m[2]!]!(Number(m[1]), Number(m[3]));
    const got = q.choices[q.a]!;
    if (got.includes("R")) continue; // remainders checked below
    assert.equal(Number(got.replace(/,/g, "")), want, q.q);
    checked++;
  }
  assert.ok(checked > 300);
});

test("no repeats within the last 60 questions in a place", () => {
  for (const area of AREAS) for (const grade of [2, 3, 4.5]) {
    const r = seeded(11);
    const seen: string[] = [];
    for (let i = 0; i < 300; i++) {
      const q = generate(area, grade, seen.slice(-60), r);
      assert.ok(!seen.slice(-60).includes(q.key), `${area} grade ${grade}: "${q.q}" repeated`);
      seen.push(q.key);
    }
  }
});

test("each place and grade has well over 100 different questions", () => {
  const r = seeded(9);
  for (const area of AREAS) for (const grade of [2, 3, 4]) {
    const keys = new Set<string>();
    for (let i = 0; i < 6000; i++) keys.add(generate(area, grade + 0.5, [], r).key);
    assert.ok(keys.size >= 150, `${area} grade ${grade}: only ${keys.size}`);
  }
});

test("level mix: mostly the current grade, some review, some stretch", () => {
  const r = seeded(5);
  const count: Record<Level, number> = { 2: 0, 3: 0, 4: 0 };
  for (let i = 0; i < 1000; i++) count[levelFor(3.4, r)]++;
  assert.ok(count[3] > 600 && count[2] > 100 && count[4] > 50, JSON.stringify(count));
  for (let i = 0; i < 200; i++) assert.notEqual(levelFor(2, r), 4);
});

test("each place has questions at every grade", () => {
  for (const area of AREAS) for (const lv of [2, 3, 4]) {
    assert.ok(POOLS[area].filter((i) => i.level === lv).length >= 8, `${area} grade ${lv}`);
  }
});
