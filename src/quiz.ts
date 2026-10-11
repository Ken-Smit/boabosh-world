// The question engine. Each area has a pool of items for grades 2, 3 and 4:
// hand-written questions (F) and generators (G) that build a fresh question
// from number ranges or word/fact lists every time, so the questions last.
//
// `skill` is the tag the attempts table groups by, so keep the strings stable;
// renaming one splits its history in the skill report.
//
// ponytail: no live AI here on purpose. A browser-side key is public, a
// child's activity would go to a third party, and generated questions would
// reach a kid unreviewed. Draft new questions with AI offline if you like, but
// review them and add them below.

import type { Area } from "./state.ts";
import { MATH } from "./qmath.ts";
import { READING } from "./qreading.ts";
import { SCIENCE } from "./qscience.ts";

export type { Level, Rng, Made, Item, Question } from "./qkit.ts";
import { one, shuffle, sample, type Item, type Level, type Rng, type Question } from "./qkit.ts";

export const POOLS: Record<Area, Item[]> = { forest: READING, mountain: MATH, lab: SCIENCE };

/** Short stable id for a question's text, for the "recently seen" list. */
export function keyOf(q: string) {
  let h = 5381;
  for (let i = 0; i < q.length; i++) h = ((h << 5) + h + q.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Which grade to ask at. Mostly the player's current grade, sometimes one below
 * (review keeps it confident) and sometimes one above (a stretch).
 */
export function levelFor(grade: number, r: Rng): Level {
  const base = Math.min(4, Math.max(2, Math.floor(grade))) as Level;
  const roll = r();
  if (roll < 0.2 && base > 2) return (base - 1) as Level;
  if (roll > 0.9 && base < 4) return (base + 1) as Level;
  return base;
}

/** A new question for this area and grade that isn't in `seen`. */
export function generate(area: Area, grade: number, seen: readonly string[] = [], r: Rng = Math.random): Question {
  const pool = POOLS[area];
  let best: Question | null = null;
  for (let tries = 0; tries < 40; tries++) {
    const level = levelFor(grade, r);
    const items = pool.filter((i) => i.level === level);
    const item = one(r, items.length ? items : pool);
    const m = item.make(r);
    const n = item.level === 2 ? 3 : 4;
    const wrong = [...new Set(m.wrong.filter((w: string) => w !== m.answer))];
    const choices = shuffle(r, [m.answer, ...sample(r, wrong, n - 1)]);
    const q: Question = { skill: item.skill, q: m.q, choices, a: choices.indexOf(m.answer), level: item.level, key: keyOf(`${m.q}|${m.answer}`) }; // same wording, different answer = a different question
    best = q;
    if (!seen.includes(q.key)) return q;
  }
  return best!; // everything recent was seen (tiny pool): a repeat is better than nothing
}

export const AREA_INFO: Record<Area, { title: string; boss: string; facts: string[]; color: number }> = {
  forest: {
    title: "Reading Forest", boss: "Willow the Lighthouse Cat", color: 0x4c9a5a,
    facts: [
      "A cat has about 24 whiskers, and they can feel a breeze before you do.",
      "Reading for just 20 minutes a day adds up to about 1.8 million words a year!",
      "The word 'kitten' comes from an old French word, 'chitoun'.",
      "Cats can make over 100 different sounds. Dogs make about 10.",
    ],
  },
  mountain: {
    title: "Math Mountain", boss: "Professor Tabby", color: 0x8d7d9c,
    facts: [
      "Cats land on their feet using a balance sensor in the inner ear.",
      "A cat sleeps about 15 hours a day. That's more than half of 24!",
      "Most cats have 18 toes: 5 on each front paw and 4 on each back paw.",
      "A cat's heart beats about 140 times a minute, about twice as fast as yours.",
    ],
  },
  lab: {
    title: "Science Lab", boss: "Dr. Pickles", color: 0x4f86c6,
    facts: [
      "A cat's nose print is unique, like a human fingerprint.",
      "Cats can't taste sweet things. Their tongues don't have sweet taste buds.",
      "A cat's purr may help its bones heal. Scientists are still finding out how.",
      "Cats see better than us in dim light, but they can't see in total darkness.",
    ],
  },
};
