// Pure game state. No DOM, no network, no three.js — so the self-check can
// import it under plain node.

import { BY_ID, CATS, STARTER, SLOT_OF, HOME_SLOT_OF } from "./shop.ts";

export const AREAS = ["forest", "mountain", "lab"] as const;
export type Area = (typeof AREAS)[number];

export type Slot = "hat" | "collar" | "glasses" | "back";
export type Worn = Record<Slot, string | null>;

/** One cat. Each need is the time it was last looked after. */
export type Pet = {
  id: string;
  name: string;
  coat: string;
  worn: Worn;
  fed: number;
  watered: number;
  played: number;
  petted: number;
  rested: number;
};

export type HomeSlot = "bed" | "food" | "water" | "litter" | "wall" | "floor" | "rug";
export type Home = Record<HomeSlot, string> & { decor: string[]; litterCleaned: number };

export type State = {
  v: 2;
  coins: number;
  /** Servings of food in the cupboard. */
  fish: number;
  /** Everything owned: quiz rewards and shop buys (not cats or food). */
  items: string[];
  cats: Pet[];
  active: string;
  home: Home;
  cleared: Record<Area, number>;
  /** Difficulty per place: 2.0–4.99, the whole number is the grade asked. */
  grade: Record<Area, number>;
  /** Ids of recently asked questions per place, so they don't repeat. */
  seen: Record<Area, string[]>;
  /** Right answers since the last game. Games need BRAIN_PER_GAME of them. */
  sinceGame: number;
  trophies: Record<Game, number>;
  updatedAt: number;
};

// ---------- Game Garden ----------------------------------------------------------
// Balance: a game costs coins (earned by answering) AND needs a few fresh right
// answers since the last game, so banking coins can't skip the learning. Wins
// give trophies, never coins, so games can't be farmed to pay for more games.
export type Game = "rps" | "ttt" | "chess";
export const GAMES: Record<Game, { label: string; price: number; icon: string }> = {
  rps: { label: "Paw Rock-Paper-Scissors", price: 10, icon: "🐾" },
  ttt: { label: "Kitten Tic-Tac-Toe", price: 20, icon: "⭕" },
  chess: { label: "Kitten Chess", price: 40, icon: "♟️" },
};
export const BRAIN_PER_GAME = 3;

// Quiz rewards: answering enough questions in an area gives these for free.
export type Item = { id: string; label: string; at: number };
export const UNLOCKS: Record<Area, Item[]> = {
  forest: [
    { id: "acorn-hat", label: "Acorn Hat", at: 3 },
    { id: "leaf-collar", label: "Leaf Collar", at: 6 },
    { id: "yarn", label: "Ball of Yarn", at: 9 },
  ],
  mountain: [
    { id: "bobble-hat", label: "Bobble Hat", at: 3 },
    { id: "bell-collar", label: "Bell Collar", at: 6 },
    { id: "feather-wand", label: "Feather Wand", at: 9 },
  ],
  lab: [
    { id: "goggles", label: "Lab Goggles", at: 3 },
    { id: "star-collar", label: "Star Collar", at: 6 },
    { id: "laser-dot", label: "Laser Dot", at: 9 },
  ],
};

export const CAT_NAME = "Boabosh";
// ponytail: fixed names, no free-text field. A kid types their real name
// into a free field, and then this app is storing a child's name on a server.
// Keep the save blob non-identifying and that whole problem never starts.

export const COINS_PER_ANSWER = 10;
export const COINS_PER_LESSON = 50;
export const COINS_PER_CHORE = 2;

const noWear = (): Worn => ({ hat: null, collar: null, glasses: null, back: null });

export const newPet = (id: string, name: string, coat: string, now: number): Pet =>
  ({ id, name, coat, worn: noWear(), fed: now, watered: now, played: now, petted: now, rested: now });

export const newState = (now = Date.now()): State => ({
  v: 2,
  coins: 0,
  fish: 3,
  items: [...STARTER],
  cats: [newPet("boabosh", CAT_NAME, "caramel", now)],
  active: "boabosh",
  home: {
    bed: "bed-basket", food: "bowl-blue", water: "water-basic", litter: "litter-basic",
    wall: "wall-cream", floor: "floor-wood", rug: "rug-none", decor: ["scratcher"], litterCleaned: now,
  },
  cleared: { forest: 0, mountain: 0, lab: 0 },
  grade: { forest: 2, mountain: 2, lab: 2 },
  seen: { forest: [], mountain: [], lab: [] },
  sinceGame: 0,
  trophies: { rps: 0, ttt: 0, chess: 0 },
  updatedAt: now,
});

/** Saves from before the shop (v1) become v2; anything unrecognised is null. */
export function migrate(raw: unknown, now = Date.now()): State | null {
  const s = raw as Record<string, unknown> | null;
  if (!s || typeof s !== "object") return null;
  if (s.v === 2) {
    // Fill in fields added since this save was made (games, free starter items).
    const v2 = s as unknown as State, fresh = newState(now);
    const hadScratcher = v2.items.includes("scratcher");
    return {
      ...fresh, ...v2,
      items: [...new Set([...STARTER, ...v2.items])],
      home: { ...fresh.home, ...v2.home, decor: hadScratcher ? v2.home.decor : [...v2.home.decor, "scratcher"] },
      trophies: { ...fresh.trophies, ...v2.trophies },
      grade: { ...fresh.grade, ...v2.grade },
      seen: { ...fresh.seen, ...v2.seen },
      sinceGame: v2.sinceGame ?? 0,
    };
  }
  if (s.v !== 1) return null;
  const old = s as { fish: number; items: string[]; worn: { hat: string | null; collar: string | null }; cleared: Record<Area, number>; lastFed: number; updatedAt: number };
  const fresh = newState(now);
  const answered = old.cleared.forest + old.cleared.mountain + old.cleared.lab;
  const boabosh = { ...fresh.cats[0]!, worn: { ...noWear(), ...old.worn }, fed: old.lastFed };
  return {
    ...fresh,
    coins: answered * COINS_PER_ANSWER, // credit the answers they already got right
    fish: old.fish,
    items: [...new Set([...STARTER, ...old.items])],
    cats: [boabosh],
    cleared: old.cleared,
    updatedAt: old.updatedAt,
  };
}

export const activeCat = (s: State): Pet => s.cats.find((c) => c.id === s.active) ?? s.cats[0]!;
const withCat = (s: State, f: (c: Pet) => Pet, now: number): State =>
  ({ ...s, cats: s.cats.map((c) => (c.id === s.active ? f(c) : c)), updatedAt: now });

// ---------- needs --------------------------------------------------------------

const HOUR = 3_600_000;
/** How many hours each need takes to run down from full. */
export const DECAY = { food: 12, water: 10, fun: 16, love: 8, energy: 20, clean: 24 } as const;
export type Need = keyof typeof DECAY;

/** 100 just after care, sliding to a floor of 10 (never zero: nobody's pet suffers). */
const level = (since: number, hours: number, now: number) =>
  Math.round(100 - Math.min(1, Math.max(0, (now - since) / (hours * HOUR))) * 90);

export function needs(s: State, now = Date.now(), c: Pet = activeCat(s)): Record<Need, number> {
  return {
    food: level(c.fed, DECAY.food, now),
    water: level(c.watered, DECAY.water, now),
    fun: level(c.played, DECAY.fun, now),
    love: level(c.petted, DECAY.love, now),
    energy: level(c.rested, DECAY.energy, now),
    clean: level(s.home.litterCleaned, DECAY.clean, now),
  };
}

// Playing makes a cat hungry and tired too, not just time passing: every
// minute in the game and every answer uses up a little of each need. Points
// are on the same 10–100 scale as `needs`.
export const DRAIN = {
  minute: { food: 0.8, water: 1, fun: 0.5, love: 0.8, energy: 0.7, clean: 0.4 },
  answer: { food: 1, water: 1, energy: 0.8, clean: 0.3 },
  game: { food: 2, water: 2, energy: 5 },
} satisfies Record<string, Partial<Record<Need, number>>>;

const FIELD = { food: "fed", water: "watered", fun: "played", love: "petted", energy: "rested" } as const;

/** Use up need points by moving each "last cared for" time back. Never below the floor of 10. */
export function drain(s: State, points: Partial<Record<Need, number>>, now = Date.now()): State {
  const back = (since: number, need: Need) => {
    const span = DECAY[need] * HOUR;
    return Math.max(now - span, since - ((points[need] ?? 0) / 90) * span);
  };
  const cats = s.cats.map((c) => {
    if (c.id !== s.active) return c;
    const next = { ...c };
    for (const need of Object.keys(FIELD) as (keyof typeof FIELD)[]) next[FIELD[need]] = back(c[FIELD[need]], need);
    return next;
  });
  return { ...s, cats, home: { ...s.home, litterCleaned: back(s.home.litterCleaned, "clean") }, updatedAt: now };
}

export const happiness = (s: State, now = Date.now()): number => {
  const n = Object.values(needs(s, now));
  return Math.round(n.reduce((a, b) => a + b, 0) / n.length);
};

export const mood = (h: number) => (h > 80 ? "purring" : h > 60 ? "content" : h > 40 ? "peckish" : "needs you");

// ---------- quiz -----------------------------------------------------------------

// ---------- difficulty ---------------------------------------------------------
// Each place has its own grade level, 2.0 to 4.99. Right answers nudge it up,
// misses nudge it down a bit more, so at ~80% right it climbs about one grade
// every 18 questions, and it eases off when a kid is struggling.
export const GRADE_MIN = 2, GRADE_MAX = 4.99, GRADE_UP = 0.12, GRADE_DOWN = 0.2;
export const LESSON = 10; // right answers per lesson; each lesson pays a bonus
const SEEN_MAX = 60; // recent questions to avoid repeating, per place

/** One answered question. Returns the next state, what unlocked and coins earned. */
export function applyAnswer(
  s: State,
  area: Area,
  correct: boolean,
  now = Date.now(),
  key?: string, // the question's id, remembered so it isn't asked again soon
): { state: State; unlocked: Item[]; coins: number; lesson: boolean; gradeUp: number | null } {
  const before = s.grade[area];
  const after = Math.min(GRADE_MAX, Math.max(GRADE_MIN, before + (correct ? GRADE_UP : -GRADE_DOWN)));
  const gradeUp = Math.floor(after) > Math.floor(before) ? Math.floor(after) : null;
  const seen = key ? { ...s.seen, [area]: [...s.seen[area].filter((k) => k !== key), key].slice(-SEEN_MAX) } : s.seen;
  const base = { ...drain(s, DRAIN.answer, now), grade: { ...s.grade, [area]: after }, seen, updatedAt: now };
  if (!correct) return { state: base, unlocked: [], coins: 0, lesson: false, gradeUp: null };

  const cleared = { ...s.cleared, [area]: s.cleared[area] + 1 };
  const unlocked = UNLOCKS[area].filter((i) => cleared[area] >= i.at && !s.items.includes(i.id));
  const lesson = cleared[area] % LESSON === 0;
  const coins = COINS_PER_ANSWER + (lesson ? COINS_PER_LESSON : 0);
  return {
    state: {
      ...base,
      coins: s.coins + coins,
      fish: s.fish + 1,
      sinceGame: s.sinceGame + 1,
      cleared,
      items: [...s.items, ...unlocked.map((i) => i.id)],
    },
    unlocked,
    coins,
    lesson,
    gradeUp,
  };
}

// ---------- shop ---------------------------------------------------------------------

export type BuyResult = { ok: true; state: State } | { ok: false; why: "unknown" | "owned" | "coins" };

export function buy(s: State, id: string, now = Date.now()): BuyResult {
  const it = BY_ID[id];
  if (!it) return { ok: false, why: "unknown" };
  const cat = CATS.find((c) => c.id === id);
  const owned = cat ? s.cats.some((c) => c.id === id) : it.cat !== "food" && s.items.includes(id);
  if (owned) return { ok: false, why: "owned" };
  if (s.coins < it.price) return { ok: false, why: "coins" };
  const paid = { ...s, coins: s.coins - it.price, updatedAt: now };
  if (cat) return { ok: true, state: { ...paid, cats: [...s.cats, newPet(cat.id, cat.name, cat.coat, now)] } };
  if (it.cat === "food") return { ok: true, state: { ...paid, fish: s.fish + (it.amount ?? 1) } };
  return { ok: true, state: { ...paid, items: [...s.items, id] } };
}

export type PlayCheck = { ok: true } | { ok: false; why: "coins" | "brain"; need: number };
/** Can the player start this game? Needs coins and fresh right answers. */
export function canPlay(s: State, g: Game): PlayCheck {
  if (s.sinceGame < BRAIN_PER_GAME) return { ok: false, why: "brain", need: BRAIN_PER_GAME - s.sinceGame };
  if (s.coins < GAMES[g].price) return { ok: false, why: "coins", need: GAMES[g].price - s.coins };
  return { ok: true };
}
/** Pay for a game and reset the brain meter. No-op if not allowed. */
export function startGame(s: State, g: Game, now = Date.now()): State {
  if (!canPlay(s, g).ok) return s;
  const tired = drain(s, DRAIN.game, now);
  return withCat({ ...tired, coins: s.coins - GAMES[g].price, sinceGame: 0 }, (c) => ({ ...c, played: now }), now);
}
export const winGame = (s: State, g: Game, now = Date.now()): State =>
  ({ ...s, trophies: { ...s.trophies, [g]: s.trophies[g] + 1 }, updatedAt: now });

export const owns = (s: State, id: string) => s.items.includes(id) || s.cats.some((c) => c.id === id);

// ---------- dressing and decorating -----------------------------------------------------

/** Put on (or take off, if already worn) a piece of clothing on the active cat. */
export function wear(s: State, id: string, now = Date.now()): State {
  const it = BY_ID[id];
  const slot = it && SLOT_OF[it.cat];
  if (!slot || !s.items.includes(id)) return s;
  return withCat(s, (c) => ({ ...c, worn: { ...c.worn, [slot]: c.worn[slot] === id ? null : id } }), now);
}

/** Use an owned piece of furniture, or switch a decoration on/off. */
export function furnish(s: State, id: string, now = Date.now()): State {
  const it = BY_ID[id];
  if (!it || !s.items.includes(id)) return s;
  if (it.cat === "decor") {
    const decor = s.home.decor.includes(id) ? s.home.decor.filter((d) => d !== id) : [...s.home.decor, id];
    return { ...s, home: { ...s.home, decor }, updatedAt: now };
  }
  const slot = HOME_SLOT_OF[it.cat];
  return slot ? { ...s, home: { ...s.home, [slot]: id }, updatedAt: now } : s;
}

export function setActive(s: State, id: string, now = Date.now()): State {
  return s.cats.some((c) => c.id === id) ? { ...s, active: id, updatedAt: now } : s;
}

// ---------- care ---------------------------------------------------------------------------

export function feed(s: State, now = Date.now()): State {
  if (s.fish <= 0) return s;
  return { ...withCat(s, (c) => ({ ...c, fed: now }), now), fish: s.fish - 1 };
}
export const water = (s: State, now = Date.now()) => withCat(s, (c) => ({ ...c, watered: now }), now);
export const play = (s: State, now = Date.now()) => withCat(s, (c) => ({ ...c, played: now }), now);
export const pet = (s: State, now = Date.now()) => withCat(s, (c) => ({ ...c, petted: now }), now);
export const nap = (s: State, now = Date.now()) => withCat(s, (c) => ({ ...c, rested: now }), now);

/** Scoop the litter. Pays a little for doing the chore, but only if it needed doing. */
export function cleanLitter(s: State, now = Date.now()): { state: State; coins: number } {
  const coins = needs(s, now).clean < 70 ? COINS_PER_CHORE : 0;
  return { state: { ...s, coins: s.coins + coins, home: { ...s.home, litterCleaned: now }, updatedAt: now }, coins };
}

/**
 * Two devices, two saves. Newest wins.
 * ponytail: last-write-wins loses the older device's progress if both were
 * played offline on the same day. Per-field merge only if that actually bites.
 */
export const newer = (a: State | null, b: State | null): State | null =>
  !a ? b : !b ? a : a.updatedAt >= b.updatedAt ? a : b;

const CODE_ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L — a kid types this
export const CODE_RE = /^[A-Z0-9]{8}$/;

export const makeCode = (rnd: (n: number) => Uint8Array): string =>
  Array.from(rnd(8), (b) => CODE_ALPHA[b % CODE_ALPHA.length]).join("");

/**
 * The picture code: the same 8-letter code shown as 8 pictures, one picture
 * per letter of CODE_ALPHA, so a kid matches pictures instead of reading and
 * typing letters. Same code underneath: old letter tags keep working.
 * Picked to be easy to tell apart and easy to say out loud.
 */
export const PICTURES: [emoji: string, name: string][] = [
  ["🐱", "cat"], ["🐶", "dog"], ["🐸", "frog"], ["🐟", "fish"], ["🦋", "butterfly"], ["🐢", "turtle"],
  ["🐧", "penguin"], ["🦉", "owl"], ["🐝", "bee"], ["🐰", "bunny"], ["🦊", "fox"], ["🐻", "bear"],
  ["🐼", "panda"], ["🦁", "lion"], ["🐵", "monkey"], ["🐙", "octopus"],
  ["🍎", "apple"], ["🍌", "banana"], ["🍕", "pizza"], ["🍪", "cookie"], ["🍓", "strawberry"],
  ["🌈", "rainbow"], ["⭐", "star"], ["🌙", "moon"], ["🌸", "flower"], ["🎈", "balloon"],
  ["🚀", "rocket"], ["🚗", "car"], ["🎃", "pumpkin"], ["⚽", "ball"], ["🍦", "ice cream"],
];
/** Code letters → picture numbers (-1 for a letter that isn't in the alphabet). */
export const codeToPictures = (code: string): number[] => [...code].map((c) => CODE_ALPHA.indexOf(c));
export const picturesToCode = (picks: number[]): string => picks.map((i) => CODE_ALPHA[i] ?? "").join("");
