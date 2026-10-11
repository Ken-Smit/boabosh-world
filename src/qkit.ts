// Shared building blocks for question files. Separate from quiz.ts so the
// question files can use them without a circular import.

export type Level = 2 | 3 | 4;
export type Rng = () => number;
export type Made = { q: string; answer: string; wrong: string[] };
export type Item = { level: Level; skill: string; make: (r: Rng) => Made };
export type Question = { skill: string; q: string; choices: string[]; a: number; level: Level; key: string };

/** A fixed, hand-written question: the right answer first, then wrong ones. */
export const F = (level: Level, skill: string, q: string, answer: string, ...wrong: string[]): Item =>
  ({ level, skill, make: () => ({ q, answer, wrong }) });
/** A generator: builds a new question each time it's picked. */
export const G = (level: Level, skill: string, make: (r: Rng) => Made): Item => ({ level, skill, make });

// ---------- small random helpers the question modules share ---------------------
export const int = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
export const one = <T>(r: Rng, xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
export function shuffle<T>(r: Rng, xs: T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
export const sample = <T>(r: Rng, xs: readonly T[], n: number) => shuffle(r, [...xs]).slice(0, n);
