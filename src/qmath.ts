// Math Mountain: almost all generators, so the questions never run out and
// every answer is computed, never typed by hand.

import { F, G, int, one, type Item } from "./qkit.ts";

const NAMES = ["Boabosh", "Mochi", "Pepper", "Ginger", "Luna", "Smokey"];
/** Wrong answers near the right one: off by small amounts, never negative, never the answer. */
const near = (ans: number, ...deltas: number[]) =>
  deltas.map((d) => ans + d).filter((x) => x >= 0 && x !== ans).map(String);
const money = (c: number) => (c >= 100 ? `$${Math.floor(c / 100)}.${String(c % 100).padStart(2, "0")}` : `${c}¢`);
const clock = (h: number, m: number) => `${((h - 1 + 12) % 12) + 1}:${String(m).padStart(2, "0")}`;
const comma = (n: number) => n.toLocaleString("en-US");

export const MATH: Item[] = [
  // ---------------------------------------------------------------- grade 2
  G(2, "add-within-20", (r) => {
    const a = int(r, 2, 9), b = int(r, 2, 9);
    return { q: `${a} + ${b} = ?`, answer: String(a + b), wrong: near(a + b, -1, 1, -2, 2, 10) };
  }),
  G(2, "sub-within-20", (r) => {
    const b = int(r, 2, 9), a = b + int(r, 2, 10);
    return { q: `${a} − ${b} = ?`, answer: String(a - b), wrong: near(a - b, -1, 1, 2, a + b - (a - b)) };
  }),
  G(2, "add-within-100", (r) => {
    const a = int(r, 11, 59), b = int(r, 10, 39);
    return { q: `${a} + ${b} = ?`, answer: String(a + b), wrong: near(a + b, 10, -10, 1, -1) };
  }),
  G(2, "sub-within-100", (r) => {
    const b = int(r, 10, 40), a = b + int(r, 10, 50);
    return { q: `${a} − ${b} = ?`, answer: String(a - b), wrong: near(a - b, 10, -10, 1, -1) };
  }),
  G(2, "ten-more-less", (r) => {
    const n = int(r, 15, 85), more = r() < 0.5;
    const ans = more ? n + 10 : n - 10;
    return { q: `What is 10 ${more ? "more" : "less"} than ${n}?`, answer: String(ans), wrong: near(ans, more ? -20 : 20, more ? -9 : 9, more ? 1 : -1) };
  }),
  G(2, "skip-count", (r) => {
    const step = one(r, [2, 5, 10]), start = step * int(r, 1, 6);
    const seq = [0, 1, 2].map((i) => start + i * step);
    const ans = start + 3 * step;
    return { q: `Count by ${step}s: ${seq.join(", ")}, __`, answer: String(ans), wrong: near(ans, 1, -step + 1, step, step - 1) };
  }),
  G(2, "place-value", (r) => {
    const t = int(r, 1, 9), o = int(r, 0, 9);
    return { q: `In the number ${t}${o}, what is the ${t} worth?`, answer: String(t * 10), wrong: [String(t), String(t * 100), `${t}${o}`] };
  }),
  G(2, "compare", (r) => {
    const nums = new Set<number>();
    while (nums.size < 4) nums.add(int(r, 10, 99));
    const xs = [...nums], big = r() < 0.5;
    const ans = big ? Math.max(...xs) : Math.min(...xs);
    return { q: `Which number is the ${big ? "biggest" : "smallest"}?`, answer: String(ans), wrong: xs.filter((x) => x !== ans).map(String) };
  }),
  G(2, "even-odd", (r) => {
    const even = r() < 0.5;
    const pick = (wantEven: boolean) => { let n = int(r, 3, 49); if ((n % 2 === 0) !== wantEven) n++; return n; };
    const ans = pick(even);
    return { q: `Which number is ${even ? "even" : "odd"}?`, answer: String(ans), wrong: [pick(!even), pick(!even), pick(!even)].map(String) };
  }),
  G(2, "time", (r) => {
    const h = int(r, 1, 11), half = r() < 0.5;
    const ans = half ? clock(h, 30) : clock(h + 1, 0);
    return {
      q: `It is ${clock(h, 0)}. What time will it be in ${half ? "30 minutes" : "1 hour"}?`,
      answer: ans, wrong: [clock(h, 30), clock(h + 1, 0), clock(h, 15), clock(h + 1, 30)].filter((x) => x !== ans),
    };
  }),
  G(2, "money", (r) => {
    const d = int(r, 1, 4), n = int(r, 0, 3), p = int(r, 1, 4);
    const ans = d * 10 + n * 5 + p;
    const parts = [`${d} dime${d > 1 ? "s" : ""}`, n ? `${n} nickel${n > 1 ? "s" : ""}` : "", `${p} penn${p > 1 ? "ies" : "y"}`].filter(Boolean);
    return { q: `How much money is ${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}?`, answer: money(ans), wrong: [money(d + n + p), money(ans + 5), money(ans - 1), money(ans + 10)] };
  }),
  G(2, "word-problem-add", (r) => {
    const who = one(r, NAMES), a = int(r, 3, 12), b = int(r, 2, 9);
    const thing = one(r, ["fish", "toy mice", "yarn balls", "treats", "feathers"]);
    return { q: `${who} has ${a} ${thing} and finds ${b} more. How many ${thing} now?`, answer: String(a + b), wrong: near(a + b, -1, 1, a - b - (a + b), 2) };
  }),
  G(2, "word-problem-sub", (r) => {
    const who = one(r, NAMES), b = int(r, 2, 8), a = b + int(r, 3, 10);
    return { q: `${who} had ${a} treats and ate ${b}. How many are left?`, answer: String(a - b), wrong: near(a - b, -1, 1, 2 * b, 2) };
  }),
  G(2, "word-problem-add", (r) => {
    const a = int(r, 3, 9), b = int(r, 2, 9);
    return { q: `Trick-or-treat! 🎃 You get ${a} candies at one house and ${b} at the next. How many candies is that?`, answer: String(a + b), wrong: near(a + b, -1, 1, 2, -2) };
  }),
  F(2, "shapes", "How many sides does a triangle have?", "3", "4", "5", "6"),
  F(2, "shapes", "How many sides does a hexagon have?", "6", "5", "8", "4"),
  F(2, "shapes", "How many corners does a square have?", "4", "3", "5", "6"),
  F(2, "time", "How many days are in one week?", "7", "5", "10", "12"),
  F(2, "time", "How many minutes are in one hour?", "60", "100", "30", "24"),
  F(2, "money", "How many cents is one quarter?", "25¢", "10¢", "5¢", "50¢"),

  // ---------------------------------------------------------------- grade 3
  G(3, "add-within-1000", (r) => {
    const a = int(r, 120, 599), b = int(r, 105, 399);
    return { q: `${a} + ${b} = ?`, answer: String(a + b), wrong: near(a + b, 100, -100, 10, -10) };
  }),
  G(3, "sub-within-1000", (r) => {
    const b = int(r, 105, 450), a = b + int(r, 110, 480);
    return { q: `${a} − ${b} = ?`, answer: String(a - b), wrong: near(a - b, 100, -100, 10, -10) };
  }),
  G(3, "multiply-facts", (r) => {
    const a = int(r, 2, 10), b = int(r, 2, 10);
    return { q: `${a} × ${b} = ?`, answer: String(a * b), wrong: near(a * b, a, -a, b, a + b - a * b, 1) };
  }),
  G(3, "divide-facts", (r) => {
    const b = int(r, 2, 10), ans = int(r, 2, 10);
    return { q: `${b * ans} ÷ ${b} = ?`, answer: String(ans), wrong: near(ans, 1, -1, 2, b - ans) };
  }),
  G(3, "missing-factor", (r) => {
    const a = int(r, 2, 9), b = int(r, 3, 9);
    return { q: `__ × ${b} = ${a * b}. What number goes in the blank?`, answer: String(a), wrong: near(a, 1, -1, 2, a * b - b - a) };
  }),
  G(3, "round", (r) => {
    const to = one(r, [10, 100]), n = to === 10 ? int(r, 12, 98) : int(r, 120, 980);
    if (n % to === to / 2) return { q: `Round ${n + 1} to the nearest ${to}.`, answer: String(Math.round((n + 1) / to) * to), wrong: near(Math.round((n + 1) / to) * to, -to, to) };
    const ans = Math.round(n / to) * to;
    return { q: `Round ${n} to the nearest ${to}.`, answer: String(ans), wrong: [...near(ans, -to, to), String(n)] };
  }),
  G(3, "multiply-word", (r) => {
    const groups = int(r, 3, 8), each = int(r, 2, 9);
    const [g, e] = one(r, [["cat beds", "kittens"], ["bowls", "fish"], ["boxes", "toy mice"], ["shelves", "books"]] as const);
    return { q: `There are ${groups} ${g} with ${each} ${e} in each. How many ${e} in all?`, answer: String(groups * each), wrong: near(groups * each, groups + each - groups * each, each, -each, 1) };
  }),
  G(3, "divide-word", (r) => {
    const kids = int(r, 2, 6), each = int(r, 2, 8);
    return { q: `${kids * each} treats are shared equally by ${kids} cats. How many treats does each cat get?`, answer: String(each), wrong: near(each, 1, -1, kids - each, kids * each - kids - each) };
  }),
  G(3, "fractions", (r) => {
    const n = one(r, [2, 3, 4, 6, 8]), k = int(r, 1, n - 1);
    return { q: `A pizza is cut into ${n} equal slices. ${one(r, NAMES)} eats ${k}. What fraction was eaten?`, answer: `${k}/${n}`, wrong: [`${n}/${k}`, `${k}/${n + 1}`, `${n - k}/${n}`, `1/${k + n}`] };
  }),
  G(3, "fractions-compare", (r) => {
    const [a, b, c] = one(r, [[2, 4, 8], [2, 3, 6], [3, 4, 8], [2, 6, 8], [3, 6, 8]] as const);
    const big = r() < 0.5;
    return { q: `Which fraction is ${big ? "biggest" : "smallest"}?`, answer: big ? `1/${a}` : `1/${c}`, wrong: big ? [`1/${b}`, `1/${c}`] : [`1/${a}`, `1/${b}`] };
  }),
  G(3, "area", (r) => {
    const l = int(r, 3, 9), w = int(r, 2, 7);
    return { q: `A rug is ${l} feet long and ${w} feet wide. What is its area?`, answer: `${l * w} square feet`, wrong: [`${2 * (l + w)} square feet`, `${l + w} square feet`, `${l * w + l} square feet`] };
  }),
  G(3, "elapsed-time", (r) => {
    const h = int(r, 1, 10), m = one(r, [0, 15, 30]), add = one(r, [15, 30, 45]);
    const t = h * 60 + m + add;
    const ans = clock(Math.floor(t / 60), t % 60);
    return {
      q: `${one(r, NAMES)} starts a nap at ${clock(h, m)} and naps for ${add} minutes. When does the nap end?`,
      answer: ans, wrong: [clock(h, m), clock(Math.floor((t + 15) / 60), (t + 15) % 60), clock(Math.floor((t - 15) / 60), (t - 15) % 60), clock(Math.floor(t / 60) + 1, t % 60)].filter((x) => x !== ans),
    };
  }),
  G(3, "change", (r) => {
    const cost = 5 * int(r, 3, 19);
    return { q: `A cat toy costs ${money(cost)}. You pay with $1.00. How much change do you get?`, answer: money(100 - cost), wrong: [money(cost), money(100 - cost + 10), money(Math.max(5, 100 - cost - 5))] };
  }),
  G(3, "divide-word", (r) => {
    const kids = int(r, 2, 5), each = int(r, 3, 9);
    return { q: `${kids} friends share ${kids * each} Halloween candies equally. How many does each friend get? 🍬`, answer: String(each), wrong: near(each, 1, -1, 2, kids) };
  }),
  G(3, "multiply-word", (r) => {
    const rows = int(r, 3, 8), per = int(r, 3, 9);
    return { q: `A pumpkin patch has ${rows} rows with ${per} pumpkins in each row. How many pumpkins? 🎃`, answer: String(rows * per), wrong: near(rows * per, per, -per, rows + per - rows * per, 1) };
  }),
  F(3, "measure", "How many inches are in one foot?", "12", "10", "100", "3"),
  F(3, "measure", "Which is the best unit to measure how long a pencil is?", "inches", "miles", "pounds", "gallons"),
  F(3, "shapes", "A shape with 4 equal sides and 4 square corners is a…", "square", "triangle", "pentagon", "circle"),
  F(3, "multiply-facts", "Any number times 0 is…", "0", "the same number", "1", "10"),
  F(3, "multiply-facts", "Any number times 1 is…", "the same number", "0", "1", "10"),

  // ---------------------------------------------------------------- grade 4
  G(4, "multiply-multi-digit", (r) => {
    const a = int(r, 112, 499), b = int(r, 2, 9);
    return { q: `${a} × ${b} = ?`, answer: comma(a * b), wrong: [comma(a * b + 10), comma(a * b - b), comma(a * (b + 1)), comma(a * b + 100)] };
  }),
  G(4, "multiply-2x2", (r) => {
    const a = int(r, 11, 29), b = int(r, 11, 19);
    return { q: `${a} × ${b} = ?`, answer: comma(a * b), wrong: [comma(a * b + 10), comma(a * b - a), comma(a * 10 + b), comma(a * b + b)] };
  }),
  G(4, "divide-remainder", (r) => {
    const b = int(r, 3, 9), ans = int(r, 4, 12), rem = int(r, 1, b - 1);
    return { q: `${b * ans + rem} ÷ ${b} = ?`, answer: `${ans} R${rem}`, wrong: [`${ans + 1} R${rem}`, `${ans} R${rem + 1 < b ? rem + 1 : rem - 1}`, `${ans - 1} R${rem}`, `${ans}`] };
  }),
  G(4, "place-value-big", (r) => {
    const digits = String(int(r, 10000, 99999)).split("");
    const pos = int(r, 0, 3);
    if (digits[pos] === "0") digits[pos] = "7";
    const n = Number(digits.join("")), d = Number(digits[pos]), place = 10 ** (4 - pos);
    return { q: `In ${comma(n)}, what is the ${d} worth?`, answer: comma(d * place), wrong: [comma(d * place * 10), comma(d * place / 10 >= 1 ? d * place / 10 : d * 100), String(d)] };
  }),
  G(4, "round-1000", (r) => {
    let n = int(r, 1200, 9800);
    if (n % 1000 === 500) n += 1;
    const ans = Math.round(n / 1000) * 1000;
    return { q: `Round ${comma(n)} to the nearest thousand.`, answer: comma(ans), wrong: [comma(ans + 1000), comma(Math.max(1000, ans - 1000)), comma(Math.round(n / 100) * 100)] };
  }),
  G(4, "fractions-equivalent", (r) => {
    const [n, d] = one(r, [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [2, 5]] as const), k = int(r, 2, 4);
    return { q: `Which fraction is equal to ${n}/${d}?`, answer: `${n * k}/${d * k}`, wrong: [`${n + k}/${d + k}`, `${n * k}/${d}`, `${n}/${d * k}`, `${d * k}/${n * k}`] };
  }),
  G(4, "fractions-add", (r) => {
    const d = one(r, [5, 6, 8, 10, 12]), a = int(r, 1, d - 3), b = int(r, 1, d - a - 1);
    return { q: `${a}/${d} + ${b}/${d} = ?`, answer: `${a + b}/${d}`, wrong: [`${a + b}/${d * 2}`, `${a * b}/${d}`, `${a + b + 1}/${d}`] };
  }),
  G(4, "decimals", (r) => {
    if (r() < 0.5) {
      const t = int(r, 1, 9);
      return { q: `Write ${t}/10 as a decimal.`, answer: `0.${t}`, wrong: [`${t}.0`, `0.0${t}`, `${t}.10`] };
    }
    const h = int(r, 11, 99);
    return { q: `Write ${h}/100 as a decimal.`, answer: `0.${h}`, wrong: [`${h}.0`, `0.0${h}`, `${h}.100`] };
  }),
  G(4, "decimals-compare", (r) => {
    const a = int(r, 2, 9), b = int(r, 11, 99);
    if (a * 10 === b) return { q: `Which is bigger: 0.${a} or 0.${b + 1}?`, answer: `0.${b + 1}`, wrong: [`0.${a}`, "They are equal"] };
    const ans = a * 10 > b ? `0.${a}` : `0.${b}`;
    return { q: `Which is bigger: 0.${a} or 0.${b}?`, answer: ans, wrong: [ans === `0.${a}` ? `0.${b}` : `0.${a}`, "They are equal"] };
  }),
  G(4, "perimeter", (r) => {
    const l = int(r, 4, 15), w = int(r, 2, 9);
    return { q: `A cat pen is a rectangle ${l} m long and ${w} m wide. What is its perimeter?`, answer: `${2 * (l + w)} m`, wrong: [`${l * w} m`, `${l + w} m`, `${2 * l + w} m`] };
  }),
  G(4, "factors", (r) => {
    const n = one(r, [12, 18, 20, 24, 30, 36, 40]);
    const fs = [2, 3, 4, 5, 6].filter((f) => n % f === 0);
    const nots = [7, 9, 11, 13, 14, 16].filter((f) => n % f !== 0);
    return { q: `Which number is a factor of ${n}?`, answer: String(one(r, fs)), wrong: nots.map(String) };
  }),
  G(4, "prime", (r) => {
    const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29], comps = [4, 6, 8, 9, 10, 12, 15, 21, 25, 27];
    return { q: "Which number is prime (only 1 and itself divide it)?", answer: String(one(r, primes)), wrong: comps.map(String) };
  }),
  G(4, "multi-step-word", (r) => {
    const bags = int(r, 3, 7), per = int(r, 4, 9), ate = int(r, 2, 9);
    const who = one(r, NAMES);
    return { q: `${who} buys ${bags} bags of treats with ${per} treats in each, then eats ${ate}. How many treats are left?`, answer: String(bags * per - ate), wrong: near(bags * per - ate, ate, ate * 2, bags + per - ate - (bags * per - ate), -1) };
  }),
  G(4, "multi-step-word", (r) => {
    const houses = int(r, 6, 12), each = int(r, 3, 6), gave = int(r, 4, 15);
    return { q: `You visit ${houses} houses and get ${each} candies at each. You give ${gave} to your little brother. How many are left? 🎃`, answer: String(houses * each - gave), wrong: near(houses * each - gave, gave, -1, 1, 10) };
  }),
  F(4, "angles", "A square corner is called a…", "right angle", "straight angle", "round angle", "sharp angle"),
  F(4, "measure", "How many centimeters are in 1 meter?", "100", "10", "1,000", "12"),
  F(4, "measure", "How many grams are in 1 kilogram?", "1,000", "100", "10", "60"),
  F(4, "measure", "How many hours are in one day?", "24", "12", "60", "7"),
  F(4, "shapes", "Lines that never cross, like train tracks, are called…", "parallel lines", "right angles", "curved lines", "diagonal lines"),
];
