// Fish Catch (Stocking Catch at Christmas): the board, played in the game panel.
// Rules and tuning live in fishcatch.ts. The loop stops by itself when the board
// leaves or the panel hides, since Back to games has no teardown to call.

import { CFG, newRound, step, moveBasket, outcome, finalWords, secondsLeft, type Kind, type Thing } from "./fishcatch.ts";
import { BRAIN_PER_GAME } from "./state.ts";
import type { Hooks } from "./games.ts";
import * as sfx from "./sound.ts";

const svg = (body: string, box = "0 0 100 100") => `<svg viewBox="${box}" aria-hidden="true">${body}</svg>`;
const INK = `stroke="#33291f" stroke-width="3.5" stroke-linejoin="round"`;
const face = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="7" fill="#fff" stroke="#33291f" stroke-width="2"/><circle cx="${x + 1.5}" cy="${y + 1}" r="3.5" fill="#222"/>`;
const googly = (y: number) => `<circle cx="36" cy="${y}" r="10" fill="#fff" stroke="#33291f" stroke-width="2"/><circle cx="39" cy="${y + 3}" r="4.5" fill="#222"/><circle cx="62" cy="${y - 2}" r="8" fill="#fff" stroke="#33291f" stroke-width="2"/><circle cx="60" cy="${y}" r="3.5" fill="#222"/>`;

const fishArt = (a: string, b: string, extra = "") => svg(`
  <path d="M26 50 L4 28 Q10 50 4 72 Z" fill="${b}" ${INK}/>
  <path d="M50 26 Q62 8 74 28 Z" fill="${b}" ${INK}/>
  <ellipse cx="56" cy="52" rx="38" ry="27" fill="${a}" ${INK}/>
  <path d="M42 34 Q52 52 42 70" fill="none" stroke="${b}" stroke-width="4" stroke-linecap="round"/>
  ${face(74, 44)}
  <path d="M78 62 Q84 62 88 56" fill="none" stroke="#33291f" stroke-width="3" stroke-linecap="round"/>${extra}`);

const PLAIN: Record<Kind, string[]> = {
  fish: [fishArt("#4db6ee", "#2a86c8"), fishArt("#ff9d4d", "#e0702a")],
  gold: [fishArt("#ffd23f", "#f39c12", `<path d="M22 14 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3Z" fill="#fff6b0" stroke="#c97d0a" stroke-width="2"/>`)],
  boot: [svg(`
    <path d="M30 10 H66 V52 Q92 56 94 76 V84 H22 Q26 50 30 10 Z" fill="#9a6a3c" ${INK}/>
    <rect x="18" y="80" width="80" height="12" rx="5" fill="#5a3a22" ${INK}/>
    <rect x="26" y="8" width="44" height="12" rx="4" fill="#c79a66" ${INK}/>
    ${googly(42)}
    <path d="M40 66 Q52 74 64 66" fill="none" stroke="#33291f" stroke-width="3.5" stroke-linecap="round"/>`)],
};
const JOLLY: Record<Kind, string[]> = {
  fish: [
    fishArt("#58c4f5", "#2a86c8", `<path d="M58 28 Q70 0 92 16 L88 34 Z" fill="#d62839" ${INK}/><rect x="52" y="26" width="42" height="10" rx="5" fill="#fff" stroke="#33291f" stroke-width="2.5" transform="rotate(8 73 31)"/><circle cx="92" cy="14" r="6" fill="#fff" stroke="#33291f" stroke-width="2.5"/>`),
    svg(`<path d="M34 92 V34 A20 20 0 0 1 74 34 V44" fill="none" stroke="#33291f" stroke-width="22" stroke-linecap="round"/>
      <path d="M34 92 V34 A20 20 0 0 1 74 34 V44" fill="none" stroke="#fff" stroke-width="15" stroke-linecap="round"/>
      <path d="M34 92 V34 A20 20 0 0 1 74 34 V44" fill="none" stroke="#d62839" stroke-width="15" stroke-linecap="butt" stroke-dasharray="11 11"/>`),
    svg(`<circle cx="50" cy="50" r="42" fill="#d89a5a" ${INK}/><path d="M22 42 Q50 24 78 42" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
      <circle cx="34" cy="58" r="6" fill="#d62839"/><circle cx="66" cy="58" r="6" fill="#2f8a4a"/><circle cx="50" cy="72" r="6" fill="#ffd23f"/><circle cx="50" cy="48" r="5" fill="#6b4421"/>`),
  ],
  gold: [svg(`<path d="M50 4 L63 35 L96 38 L71 60 L79 93 L50 75 L21 93 L29 60 L4 38 L37 35 Z" fill="#ffd23f" ${INK}/>
    <circle cx="40" cy="48" r="4.5" fill="#33291f"/><circle cx="60" cy="48" r="4.5" fill="#33291f"/><path d="M40 60 Q50 70 60 60" fill="none" stroke="#33291f" stroke-width="3.5" stroke-linecap="round"/>`)],
  boot: [svg(`<path d="M12 62 Q6 34 30 28 Q42 8 64 18 Q90 20 90 48 Q98 74 72 84 Q44 96 24 84 Q12 78 12 62 Z" fill="#2b2b33" stroke="#e8eef5" stroke-width="4" stroke-linejoin="round"/>
    <path d="M30 34 l8 -6 M70 28 l8 8" stroke="#6a6a78" stroke-width="4" stroke-linecap="round"/>
    ${googly(50)}
    <path d="M38 72 Q50 80 62 70" fill="none" stroke="#e8eef5" stroke-width="3.5" stroke-linecap="round"/>`)],
};
const BASKET = svg(`
  <path d="M12 8 Q60 -22 108 8" fill="none" stroke="#33291f" stroke-width="10"/><path d="M12 8 Q60 -22 108 8" fill="none" stroke="#b5803f" stroke-width="5"/>
  <path d="M8 18 H112 L98 88 H22 Z" fill="#cf9a55" ${INK}/>
  <path d="M15 40 H105 M19 62 H101 M38 18 L42 88 M60 18 V88 M82 18 L78 88" stroke="#8a5a2a" stroke-width="3.5" fill="none"/>
  <rect x="3" y="8" width="114" height="14" rx="7" fill="#e6b873" ${INK}/>`, "0 -12 120 104");
const STOCKING = svg(`
  <path d="M16 24 V62 Q16 88 44 88 H98 Q117 88 117 71 Q117 54 98 54 H92 V24 Z" fill="#d62839" ${INK}/>
  <path d="M16 62 Q16 88 44 88 V62 Z" fill="#2f8a4a"/><path d="M98 88 Q117 88 117 71 Q117 54 98 54 Z" fill="#2f8a4a"/>
  <path d="M16 24 V62 Q16 88 44 88 H98 Q117 88 117 71 Q117 54 98 54 H92 V24 Z" fill="none" ${INK}/>
  <path d="M30 38 h48 M30 48 h48" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-dasharray="3 9"/>
  <rect x="6" y="3" width="96" height="23" rx="11" fill="#fff" ${INK}/>`, "0 0 120 92");

// Sparse fixed snow and string lights: the same every round, nothing to tune.
const SNOW = Array.from({ length: 16 }, (_, i) =>
  `<i class="fc-flake" style="--x:${(i * 37 + 5) % 97}%;--y:${(i * 53) % 90}%;--t:${5 + (i % 5)}s;--d:${-i * 0.9}s"><b></b></i>`).join("");
const BULBS = ["#ff5a5a", "#ffd23f", "#5ad1ff", "#6fe07a"];
const LIGHTS = svg(`<path d="M0 6 Q45 34 90 6 Q135 34 180 6 Q225 34 270 6 Q315 34 360 6" fill="none" stroke="#1d3a2a" stroke-width="3"/>` +
  [22, 45, 68, 112, 135, 158, 202, 225, 248, 292, 315, 338].map((x, i) => {
    const u = (x % 90) / 90, dip = 6 + 56 * u * (1 - u); // on the wire
    return `<circle class="fc-bulb" style="--d:${-i * 0.35}s" cx="${x}" cy="${dip + 7}" r="6.5" fill="${BULBS[i % 4]}" stroke="#1d3a2a" stroke-width="1.5"/>`;
  }).join(""), "0 0 360 34");

const div = (cls: string, html = "") => {
  const e = document.createElement("div");
  e.className = cls;
  e.innerHTML = html;
  return e;
};
const pick = (a: string[], id: number) => a[id % a.length]!;

export function fishCatch(box: HTMLElement, { status, done }: Hooks) {
  const j = document.body.classList.contains("christmas");
  const art = j ? JOLLY : PLAIN, what = j ? "stocking" : "basket";
  const r = newRound(), rng = Math.random, ac = new AbortController(), { signal } = ac;
  const root = div(`fc ${j ? "fc-jolly" : "fc-sunny"}`);
  root.setAttribute("role", "application");
  root.tabIndex = 0;
  root.setAttribute("aria-label", `${j ? "Stocking" : "Fish"} Catch. Slide on the board or use the left and right arrow keys to move your ${what}. Catch ${j ? "treats and stars" : "fish"}, and dodge the ${j ? "coal" : "old boots"}.`);
  const score = div("fc-score"), clock = div("fc-clock"), hud = div("fc-hud");
  hud.setAttribute("aria-hidden", "true");
  hud.append(score, clock);
  const basket = div("fc-basket", j ? STOCKING : BASKET);
  const ready = div("fc-banner", `👆 Slide to move your ${what}!`);
  root.append(div("fc-sky", j ? SNOW : `<i class="fc-sun"></i><i class="fc-cloud"></i><i class="fc-cloud two"></i>`), div("fc-ground"));
  if (j) root.append(div("fc-lights", LIGHTS));
  root.append(basket, hud, ready);
  box.replaceChildren(root);
  status(`Catch ${CFG.goal} points to win a trophy! ${j ? "Dodge the coal! ⚫" : "Dodge the boots! 🥾"}`);

  // ---------- input ----------
  const slide = (e: PointerEvent) => {
    const b = root.getBoundingClientRect();
    moveBasket(r, (e.clientX - b.left) / b.width);
  };
  root.addEventListener("pointermove", slide, { signal });
  root.addEventListener("pointerdown", (e) => {
    slide(e);
    root.setPointerCapture(e.pointerId); // keeps working when a finger slides off the board
  }, { signal });
  const keys = new Set<string>();
  addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { keys.add(e.key); e.preventDefault(); }
  }, { signal });
  addEventListener("keyup", (e) => keys.delete(e.key), { signal });
  addEventListener("blur", () => keys.clear(), { signal });

  // ---------- drawing ----------
  const sprites = new Map<number, HTMLElement>();
  const pops: { el: HTMLElement; until: number }[] = [];
  let W = 0, H = 0, now = 0;
  const pop = (cls: string, text: string, x: number, y: number, life = 0.8) => {
    const p = div(`fc-pop ${cls}`, text);
    p.style.left = `${Math.min(88, Math.max(12, x * 100))}%`;
    p.style.top = `${y * 100}%`;
    root.append(p);
    pops.push({ el: p, until: now + life });
  };
  const sprite = (t: Thing) => {
    const e = div(`fc-thing ${t.kind}`, pick(art[t.kind], t.id));
    root.insertBefore(e, basket);
    sprites.set(t.id, e);
    return e;
  };
  const draw = () => {
    const w = root.clientWidth, h = root.clientHeight;
    if (w !== W || h !== H) {
      W = w; H = h;
      root.style.setProperty("--item", `${Math.min(w * 0.17, h * 0.2)}px`);
      root.style.setProperty("--bw", `${w * CFG.basket}px`);
      root.style.setProperty("--bh", `${Math.min(w * CFG.basket * 0.78, h * 0.28)}px`);
      if (j) hud.style.top = `${Math.min(w * 0.09, h * 0.1)}px`; // under the string lights
    }
    const live = new Set<number>();
    for (const t of r.things) {
      live.add(t.id);
      (sprites.get(t.id) ?? sprite(t)).style.transform = `translate(${t.x * W}px, ${t.y * H}px) translate(-50%, -50%)`;
    }
    for (const [id, e] of sprites) if (!live.has(id)) { e.remove(); sprites.delete(id); }
    basket.style.transform = `translate(${r.basket * W}px, 0) translateX(-50%)`;
    basket.classList.toggle("wobble", r.wobble > 0);
    score.textContent = `${j ? "🧦" : "🐟"} ${r.score}${r.won ? " 🏆" : `/${CFG.goal}`}`;
    score.classList.toggle("won", r.won);
    clock.textContent = `⏱️ ${secondsLeft(r)}`;
    while (pops[0] && pops[0].until <= now) pops.shift()!.el.remove();
  };

  // ---------- the loop ----------
  let raf = 0, last = performance.now(), frozen = false;
  const stop = () => { frozen = true; ac.abort(); cancelAnimationFrame(raf); };
  const finish = () => {
    stop();
    draw();
    const words = finalWords(r);
    status(`${r.won ? "🏆" : "🌟"} ${words}`);
    root.append(div("fc-end", `<strong>${r.won ? "🏆" : "🌟"} ${r.score}</strong><span>${words}</span><small>Answer ${BRAIN_PER_GAME} more to play again 📚</small>`));
    if (r.won) sfx.chime(); else { sfx.tagLose(); done(outcome(r)); }
  };
  const frame = (t: number) => {
    if (frozen) return;
    if (!root.isConnected || !root.getClientRects().length) { stop(); return; } // Back, or the board was replaced
    const dt = Math.max(0, (t - last) / 1000); // step clamps it: a hidden tab just pauses
    last = t;
    now += Math.min(dt, CFG.maxStep);
    const dir = (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0);
    if (dir) moveBasket(r, r.basket + dir * CFG.keySpeed * Math.min(dt, CFG.maxStep));
    let ended = false;
    for (const h of step(r, dt, rng)) {
      if (h.type === "catch") {
        pop(h.kind === "boot" ? "bad" : h.kind === "gold" ? "gold" : "", h.points > 0 ? `+${h.points}` : `${h.points}`, h.x, CFG.catchTop - 0.05);
        if (h.kind === "boot") sfx.boing(); else if (h.kind === "gold") sfx.sparkle(); else sfx.plop();
      } else if (h.type === "goal") {
        pop("goal", `🎉 Goal! Keep catching!`, 0.5, 0.42, 1.8);
        status(`🏆 You caught enough! Keep going, there's still time!`);
        done("win"); // the trophy is safe now, even if they leave early
      } else ended = true;
    }
    if (r.time >= 0) ready.remove();
    draw();
    if (ended) finish(); else raf = requestAnimationFrame(frame);
  };
  draw();
  raf = requestAnimationFrame(frame);
}
