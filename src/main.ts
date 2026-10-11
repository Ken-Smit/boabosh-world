import * as THREE from "three";
import { OutlineEffect } from "three/examples/jsm/effects/OutlineEffect.js";
import { toonify } from "./toon.ts";
import {
  AREAS, type Area, type State, type Need, applyAnswer, feed, wear, happiness, mood, activeCat, needs, buy, owns,
  furnish, setActive, water, play, pet, nap, cleanLitter, drain, DRAIN, PICTURES, codeToPictures, picturesToCode, LESSON, COINS_PER_ANSWER, COINS_PER_LESSON, GAMES, BRAIN_PER_GAME, canPlay, startGame, winGame, type Game,
} from "./state.ts";
import { BY_ID, CATALOG, COATS, SHOP_TABS, SLOT_OF, HOME_SLOT_OF, type Category, type ShopItem } from "./shop.ts";
import { buildHome, BED_SPOT, type HomeScene } from "./home.ts";
import { boot, save, restore, logAttempt, myCode, online, pairCreate, pairRedeem } from "./store.ts";
import { makeCat, dress, type Cat } from "./cat.ts";
import { buildWorld, HOME_SIGN } from "./world.ts";
import { buildArea, type AreaScene } from "./areas.ts";
import { buildGarden, ticTacToe, rockPaperScissors, kittenChess, type Result, type Mode } from "./games.ts";
import { startFeeding, type Activity } from "./feed.ts";
import { startPlay, startMove, startNap, startScoop } from "./play.ts";
import * as sfx from "./sound.ts";
import * as hw from "./halloween.ts";
import { AREA_INFO, generate, type Question } from "./quiz.ts";

// ---------- scene ----------------------------------------------------------
const canvas = document.getElementById("scene") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xf6ead2, 26, 75); // warm haze, like late-afternoon anime light
// Anime look: no filmic tone mapping (it greys out the flat colours), and a
// warm brown ink line round everything. Thin lines read as drawn, not CAD.
const ink = new OutlineEffect(renderer, { defaultThickness: 0.0045, defaultColor: [0.22, 0.12, 0.07], defaultAlpha: 1 });

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
camera.position.set(0, 9.5, 11);
camera.lookAt(0, 0, -0.5);

// Cool sky fill + warm low sun: shadows go blue-violet, lit sides go golden.
scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x7a6a8a, 0.95));
const sun = new THREE.DirectionalLight(0xffdcaa, 2.9);
sun.position.set(8, 14, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
const cam = sun.shadow.camera as THREE.OrthographicCamera;
cam.left = -18; cam.right = 18; cam.top = 18; cam.bottom = -18; cam.far = 60;
scene.add(sun);

const HOME = new THREE.Vector3(0, 0, 4.2);
const SPOTS: Record<Area, THREE.Vector3> = {
  forest: new THREE.Vector3(-5, 0, 0.5),
  mountain: new THREE.Vector3(0, 0, -3.6),
  lab: new THREE.Vector3(5, 0, 0.5),
};

const GARDEN = new THREE.Vector3(-4.4, 0, 4.6);
const updateWorld = buildWorld(scene, { home: HOME, ...SPOTS, garden: GARDEN });

// Area markers. Each pad is a click target; the gem above it bobs.
const pads: THREE.Mesh[] = [];
const gems: THREE.Mesh[] = [];
for (const area of AREAS) {
  const info = AREA_INFO[area];
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.6, 0.3, 32),
    new THREE.MeshLambertMaterial({ color: info.color }),
  );
  pad.position.copy(SPOTS[area]).setY(0.15);
  pad.userData.area = area;
  pad.receiveShadow = true;
  scene.add(pad);
  pads.push(pad);

  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.4),
    new THREE.MeshLambertMaterial({ color: 0xfff3b0, emissive: 0xffd54a, emissiveIntensity: 0.6, flatShading: true }),
  );
  gem.position.copy(SPOTS[area]).setY(1.8);
  gem.userData.area = area;
  gem.castShadow = true;
  scene.add(gem);
  gems.push(gem);
}

// The cottage is a click target too: tap it to go home. Invisible hit box.
const HOUSE = new THREE.Vector3(2.4, 0, 4.4);
const houseHit = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2, 1.6), new THREE.MeshBasicMaterial({ visible: false }));
houseHit.position.copy(HOUSE).setY(1);
scene.add(houseHit);
const signHit = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
signHit.position.copy(HOME_SIGN).setY(0.8);
scene.add(signHit);

// The Game Garden's pad: pink, with its own gem.
{
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.3, 32), new THREE.MeshLambertMaterial({ color: 0xe86aa6 }));
  pad.position.copy(GARDEN).setY(0.15);
  pad.userData.area = "garden";
  pad.receiveShadow = true;
  scene.add(pad);
  pads.push(pad);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), new THREE.MeshLambertMaterial({ color: 0xffd1f0, emissive: 0xff6bd6, emissiveIntensity: 0.6 }));
  gem.position.copy(GARDEN).setY(1.8);
  gem.userData.area = "garden";
  scene.add(gem);
  gems.push(gem);
}

toonify(scene); // map built: convert anything made with raw Lambert materials
hw.dress(scene, "map", { home: HOME, pads: [...Object.values(SPOTS), GARDEN] });

const resize = () => {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
};
addEventListener("resize", resize);
resize();

// ---------- state ----------------------------------------------------------
let state: State = await boot();

// The cat on screen is whichever one is active; rebuilt when you switch cats.
let cat: Cat = makeCat(COATS[activeCat(state).coat]);
let catId = activeCat(state).id;
cat.group.position.copy(HOME);
scene.add(cat.group);

let target = HOME.clone();
let pendingArea: Area | null = null; // walking to a pad on the map
let quizOnArrival: Area | null = null; // walking into an area scene
let activity: Activity | null = null; // eating or playing animation in progress
let afterActivity = ""; // hint to show when it ends
let pendingHome = false; // walking to the cottage on the map
let pendingGarden = false; // walking to the Game Garden pad
let pendingAction: (() => void) | null = null; // at home: walk somewhere, then do this

// ---------- views: the map, or inside one area ----------------------------
type View = Pick<AreaScene, "scene" | "camPos" | "camLook" | "update">;
const mapView: View = { scene, camPos: camera.position.clone(), camLook: new THREE.Vector3(0, 0, -0.5), update: updateWorld };
const areaViews = new Map<Area, AreaScene>(); // built on first visit, then reused
let view: View = mapView;
let here: Area | null = null;
let fading = false;

function show(v: View) {
  activity?.update(Infinity); // anything mid-animation belongs to the old scene
  activity = null;
  pendingAction = null;
  view = v;
  v.scene.add(cat.group); // add() moves the cat out of the old scene
  camera.position.copy(v.camPos);
  camera.lookAt(v.camLook);
}

/** Fade to black, swap the scene while it's dark, fade back in. */
function fadeThen(swap: () => void) {
  fading = true;
  const fade = document.getElementById("fade")!;
  fade.classList.add("on");
  setTimeout(() => {
    swap();
    fade.classList.remove("on");
    fading = false;
  }, 450);
}

function enterArea(area: Area) {
  sfx.swish();
  fadeThen(() => {
    sfx.ambience(area);
    let v = areaViews.get(area);
    if (!v) { v = buildArea(area); areaViews.set(area, v); hw.dress(v.scene, area); }
    here = area;
    show(v);
    cat.group.position.copy(v.entry);
    target = v.stand.clone();
    quizOnArrival = area;
    hint.textContent = `Welcome to ${AREA_INFO[area].title}!`;
  });
}

function leaveArea() {
  const from = here;
  sfx.swish();
  fadeThen(() => {
    sfx.ambience("map");
    here = null;
    show(mapView);
    if (from) cat.group.position.copy(SPOTS[from]);
    target = HOME.clone();
    hint.textContent = "Tap a glowing spot on the map to visit it.";
  });
}
let currentQ: Question | null = null;
let locked = false;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const hint = $("hint");

function render() {
  const me = activeCat(state);
  if (me.id !== catId) swapCat();
  $("coins").textContent = String(state.coins);
  const brain = Math.min(state.sinceGame, BRAIN_PER_GAME);
  $("brain-hud").textContent = brain >= BRAIN_PER_GAME ? "🎮 ready!" : `${brain}/${BRAIN_PER_GAME}`;
  $("brain-stat").classList.toggle("ready", brain >= BRAIN_PER_GAME);
  $("fish").textContent = String(state.fish);
  $("catname").textContent = me.name;
  const h = happiness(state);
  $("mood").textContent = `is ${mood(h)}`;
  ($("feed") as HTMLButtonElement).disabled = state.fish <= 0 || activity !== null;
  // Nudge toward home when a need is running low.
  $("home-btn").classList.toggle("alert", view !== homeView && Object.values(needs(state)).some((n) => n < 40));
  dress(cat, me.worn);
  if (homeView && view === homeView) homeView.apply(state);
  if (!$("care").hidden) renderCare();
}

/** Switch the on-screen cat to the active one, in the same spot. */
function swapCat() {
  const me = activeCat(state);
  const old = cat;
  activity?.update(Infinity);
  activity = null;
  cat = makeCat(COATS[me.coat]);
  cat.group.position.copy(old.group.position);
  cat.group.rotation.y = old.group.rotation.y;
  old.group.parent?.add(cat.group);
  old.group.removeFromParent();
  catId = me.id;
  $("care-name").textContent = me.name;
}

const persist = () => { save(state); render(); };

// ---------- walking + clicking --------------------------------------------
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();

canvas.addEventListener("pointerdown", (e) => {
  sfx.unlock();
  if (fading) return;
  ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ptr, camera);

  // Tap Boabosh to pet: works on the map and inside areas.
  // Meshes only: the whiskers are lines, and lines get a fat 1-unit hit zone.
  if (ray.intersectObject(cat.group, true).some((h) => (h.object as THREE.Mesh).isMesh)) {
    if (!activity) doPet();
    return;
  }

  // Halloween: tap a ghost, pumpkin or cauldron for a friendly "Boo!".
  const spooky = hw.hit(ray, view.scene);
  if (spooky) { hw.boo(spooky, clock.getElapsedTime()); return; }

  // At home: tap another cat to switch to caring for it.
  if (homeView && view === homeView) {
    for (const o of homeView.others()) {
      if (ray.intersectObject(o.group, true).some((h) => (h.object as THREE.Mesh).isMesh)) {
        state = setActive(state, o.id);
        persist();
        sfx.meow("happy");
        hint.textContent = `Now looking after ${activeCat(state).name}! 💕`;
        return;
      }
    }
    return;
  }

  if (!$("quiz").hidden || view !== mapView) return;
  if (ray.intersectObjects([houseHit, signHit]).length) {
    sfx.meow("short");
    pendingHome = true;
    pendingArea = null;
    target = HOUSE.clone().add(new THREE.Vector3(-0.6, 0, 1.0));
    hint.textContent = "Going home…";
    return;
  }
  const hit = ray.intersectObjects([...pads, ...gems])[0];
  if (!hit) return;
  if (hit.object.userData.area === "garden") {
    sfx.meow("short");
    pendingHome = false;
    pendingArea = null;
    pendingGarden = true;
    target = GARDEN.clone();
    hint.textContent = "Walking to the Game Garden… 🎮";
    return;
  }
  const area = hit.object.userData.area as Area;
  sfx.meow("short");
  pendingGarden = false;
  pendingHome = false;
  pendingArea = area;
  target = SPOTS[area].clone();
  hint.textContent = `Walking to ${AREA_INFO[area].title}…`;
});

// ---------- quiz -----------------------------------------------------------
/** "Reading Forest · Grade 3 · Lesson 2: 4/10" */
function quizHeader(area: Area) {
  const done = state.cleared[area] % LESSON, lessonNo = Math.floor(state.cleared[area] / LESSON) + 1;
  $("quiz-area").textContent = `${AREA_INFO[area].title} · Grade ${Math.floor(state.grade[area])} · Lesson ${lessonNo}: ${done}/${LESSON}`;
}

function openQuiz(area: Area) {
  quizHeader(area);
  $("quiz").hidden = false;
  nextQuestion(area);
}

function nextQuestion(area: Area) {
  locked = false;
  currentQ = generate(area, state.grade[area], state.seen[area]);
  $("quiz-q").textContent = currentQ.q;
  $("quiz-feedback").textContent = "";

  const box = $("quiz-choices");
  box.replaceChildren();
  currentQ.choices.forEach((choice, i) => {
    const b = document.createElement("button");
    b.textContent = choice;
    b.onclick = () => answer(area, i, b);
    box.append(b);
  });
}

function answer(area: Area, i: number, btn: HTMLButtonElement) {
  if (locked || !currentQ) return;
  locked = true;

  const correct = i === currentQ.a;
  btn.classList.add(correct ? "right" : "wrong");
  logAttempt({ area, skill: currentQ.skill, correct });

  const r = applyAnswer(state, area, correct, Date.now(), currentQ.key);
  state = r.state;
  persist();

  const fb = $("quiz-feedback");
  const finished = r.lesson;
  if (!correct) {
    fb.textContent = `Nice try! The answer is "${currentQ.choices[currentQ.a]}". You'll get the next one! 💪`;
    sfx.wrong();
    sfx.meow("curious", 0.5);
    react("oops", true);
  } else {
    const parts = [`Yes! +${COINS_PER_ANSWER} 🪙 +1 🐟`];
    if (state.sinceGame === BRAIN_PER_GAME) parts.push("🧠 Brain power full — you can play a game in the Game Garden! 🎮");
    sfx.chime();
    setTimeout(sfx.coin, 200);
    if (r.unlocked.length) {
      parts.push(`You found: ${r.unlocked.map((u) => u.label).join(", ")}!`);
      setTimeout(sfx.sparkle, 350);
    }
    // Lesson complete: fanfare, a victory spin with confetti, and the boss cat's fact.
    if (finished) {
      const info = AREA_INFO[area];
      const fact = info.facts[Math.floor(Math.random() * info.facts.length)];
      parts.push(`🎉 Lesson complete! +${COINS_PER_LESSON} bonus 🪙 ${info.boss} says: "${fact}"`);
      setTimeout(sfx.fanfare, 250);
      react("victory", true);
    } else {
      react("cheer", true);
    }
    fb.textContent = parts.join(" ");
  }

  if (r.gradeUp) fb.textContent += ` ⭐ Wow — you're ready for Grade ${r.gradeUp} questions!`;
  quizHeader(area);
  setTimeout(warnLowNeeds, 2500); // answers tire the cat too; nudge after the cheer, not over it
  setTimeout(() => { if (!$("quiz").hidden) nextQuestion(area); }, finished ? 5000 : correct ? 1600 : 2600);
}

/** The cat reacts to an answer. A victory interrupts whatever else is going on. */
function react(move: "cheer" | "oops" | "victory", force = false) {
  if (activity && !force) return;
  activity?.update(Infinity); // finish (and tidy up) anything running
  activity = startMove(cat, move, clock.getElapsedTime());
  render();
}

$("quiz-close").onclick = () => {
  $("quiz").hidden = true;
  currentQ = null;
  leaveArea();
};

// ---------- care + wardrobe ------------------------------------------------
$("feed").onclick = () => {
  if (activity || state.fish <= 0) return;
  if (view === homeView) { $("c-feed").click(); return; } // at home, use the real bowl
  activity = startFeeding(cat, clock.getElapsedTime());
  state = feed(state);
  persist();
  afterActivity = `${activeCat(state).name} is full and happy. 💛`;
  hint.textContent = `Nom nom nom… ${activeCat(state).name} is eating! 🐟`;
};

// ---------- panels: shared bits ----------------------------------------------

/** Row of tabs; calls `pick` with the chosen key and marks it selected. */
function tabs<K extends string>(box: HTMLElement, list: { key: K; label: string }[], current: K, pick: (k: K) => void) {
  box.replaceChildren(...list.map(({ key, label }) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(key === current));
    b.onclick = () => pick(key);
    return b;
  }));
}

/** One item card: icon, name, a status line, click handler. */
function card(it: Pick<ShopItem, "icon" | "label">, status: string, cls: string[], onClick: () => void) {
  const b = document.createElement("button");
  b.className = ["card", ...cls].join(" ");
  const icon = document.createElement("span"); icon.className = "icon"; icon.textContent = it.icon;
  const name = document.createElement("span"); name.className = "name"; name.textContent = it.label;
  const price = document.createElement("span"); price.className = "price"; price.textContent = status;
  b.append(icon, name, price);
  b.onclick = onClick;
  return b;
}
const empty = (text: string, goShop?: Category) => {
  const p = document.createElement("p");
  p.className = "muted";
  p.textContent = text;
  if (goShop) {
    const b = document.createElement("button");
    b.className = "pill";
    b.textContent = "🛍️ Go to the Shop";
    b.onclick = () => { closePanels(); openShop(goShop); };
    p.append(" ", b);
  }
  return p;
};
const closePanels = () => { for (const id of ["shop", "wardrobe", "decorate", "arcade", "game"]) $(id).hidden = true; };

// ---------- shop ---------------------------------------------------------------
type ShopTab = Category | "halloween";
let shopTab: ShopTab = "food";
function openShop(tab: ShopTab = shopTab) {
  if (tab === "halloween" && !hw.isOn()) tab = "food";
  shopTab = tab;
  $("shop-coins").textContent = String(state.coins);
  const list: { key: ShopTab; label: string }[] = SHOP_TABS.map((t) => ({ key: t.cat, label: t.label }));
  if (hw.isOn()) list.unshift({ key: "halloween", label: "🎃 Halloween" });
  tabs($("shop-tabs"), list, tab, (k) => openShop(k));
  const items = CATALOG.filter((i) => (tab === "halloween" ? i.season === "halloween" : i.cat === tab) && (i.price > 0 || tab === "food"));
  $("shop-items").replaceChildren(...items.map((it) => {
    const have = it.cat !== "food" && owns(state, it.id);
    const status = have ? "Owned ✓" : `🪙 ${it.price}${it.amount ? ` · +${it.amount} 🐟` : ""}`;
    const cls = have ? ["owned"] : state.coins < it.price ? ["poor"] : [];
    return card(it, status, cls, () => shopBuy(it));
  }));
  $("shop").hidden = false;
}
function shopBuy(it: ShopItem) {
  const r = buy(state, it.id);
  const msg = $("shop-msg");
  if (!r.ok) {
    sfx.nope();
    msg.textContent = r.why === "owned" ? `You already have the ${it.label}! ✓`
      : `You need ${it.price - state.coins} more coins. Answer questions to earn more! 🪙`;
    return;
  }
  state = r.state;
  persist();
  sfx.coin();
  setTimeout(sfx.sparkle, 150);
  const slot = SLOT_OF[it.cat], home = HOME_SLOT_OF[it.cat];
  if (it.cat === "cats") { sfx.meow("happy", 0.3); msg.textContent = `🎉 ${it.label} moved in! Visit them at home 🏠`; }
  else if (it.cat === "food") msg.textContent = `+${it.amount} 🐟 food in the cupboard!`;
  else if (it.cat === "toys") msg.textContent = `🧶 New toy! Play with it at home 🏠`;
  else if (slot) { state = wear(state, it.id); persist(); msg.textContent = `✨ ${activeCat(state).name} is wearing the ${it.label}!`; }
  else if (home || it.cat === "decor") { state = furnish(state, it.id); persist(); msg.textContent = `🏠 The ${it.label} is in the home now!`; }
  openShop(shopTab);
}
$("shop-btn").onclick = () => { closePanels(); $("shop-msg").textContent = ""; openShop(hw.isOn() && shopTab === "food" ? "halloween" : shopTab); };
$("shop-close").onclick = () => { $("shop").hidden = true; };

// ---------- dress up: pick a cat, then clothes ------------------------------------
type WardTab = "cats" | "hats" | "collars" | "glasses" | "backs";
let wardTab: WardTab = "hats";
function openWardrobe(tab: WardTab = wardTab) {
  wardTab = tab;
  const me = activeCat(state);
  $("wardrobe-name").textContent = me.name;
  tabs($("wardrobe-tabs"), [
    { key: "cats", label: "🐱 Cats" }, { key: "hats", label: "🎩 Hats" }, { key: "collars", label: "🎀 Collars" },
    { key: "glasses", label: "👓 Glasses" }, { key: "backs", label: "🦸 Capes & Wings" },
  ], tab, (k) => openWardrobe(k as WardTab));
  const box = $("wardrobe-items");
  if (tab === "cats") {
    box.replaceChildren(...state.cats.map((c) => card(
      { icon: c.id === "boabosh" ? "🐈" : BY_ID[c.id]?.icon ?? "🐱", label: c.name },
      c.id === me.id ? "Playing now ✓" : "Choose",
      c.id === me.id ? ["on"] : [],
      () => { state = setActive(state, c.id); persist(); sfx.meow("happy"); openWardrobe("cats"); },
    )), ...(state.cats.length < 2 ? [empty("Want more cats? Adopt one in the Shop!", "cats")] : []));
  } else {
    const slot = SLOT_OF[tab]!;
    const mine = CATALOG.filter((i) => i.cat === tab && state.items.includes(i.id));
    box.replaceChildren(...mine.map((it) => card(it, me.worn[slot] === it.id ? "Wearing ✓" : "Wear", me.worn[slot] === it.id ? ["on"] : [], () => {
      state = wear(state, it.id);
      persist();
      sfx.sparkle();
      openWardrobe(tab);
    })), ...(mine.length ? [] : [empty("Nothing here yet!", tab)]));
  }
  $("wardrobe").hidden = false;
}
$("wardrobe-btn").onclick = () => { closePanels(); openWardrobe(); };
$("wardrobe-close").onclick = () => { $("wardrobe").hidden = true; };

// ---------- decorate the home --------------------------------------------------------
type DecoTab = "beds" | "bowls" | "water" | "litter" | "walls" | "floors" | "rugs" | "decor";
let decoTab: DecoTab = "beds";
function openDecorate(tab: DecoTab = decoTab) {
  decoTab = tab;
  tabs($("decorate-tabs"), [
    { key: "beds", label: "🛏️ Bed" }, { key: "bowls", label: "🥣 Food bowl" }, { key: "water", label: "💧 Water bowl" },
    { key: "litter", label: "🚽 Litter box" }, { key: "walls", label: "🖌️ Wallpaper" }, { key: "floors", label: "🟫 Floor" },
    { key: "rugs", label: "🌀 Rug" }, { key: "decor", label: "🪴 Decorations" },
  ], tab, (k) => openDecorate(k as DecoTab));
  const mine = CATALOG.filter((i) => i.cat === tab && state.items.includes(i.id));
  const slot = HOME_SLOT_OF[tab];
  const using = (id: string) => (slot ? state.home[slot] === id : state.home.decor.includes(id));
  $("decorate-items").replaceChildren(...mine.map((it) => card(it, using(it.id) ? (slot ? "Using ✓" : "On ✓") : slot ? "Use" : "Put out", using(it.id) ? ["on"] : [], () => {
    state = furnish(state, it.id);
    persist();
    sfx.sparkle();
    openDecorate(tab);
  })), empty(mine.length > 1 || tab === "decor" ? "" : "Only the starter one so far.", tab));
  $("decorate").hidden = false;
}
$("decorate-close").onclick = () => { $("decorate").hidden = true; };

// ---------- Game Garden ----------------------------------------------------------------
let gardenView: AreaScene | null = null;
let currentGame: Game | null = null;

function enterGarden() {
  if (!$("quiz").hidden) { $("quiz").hidden = true; currentQ = null; }
  closePanels();
  sfx.swish();
  fadeThen(() => {
    if (!gardenView) { gardenView = buildGarden(); hw.dress(gardenView.scene, "garden"); }
    sfx.ambience("map");
    here = null;
    show(gardenView);
    cat.group.position.copy(gardenView.entry);
    target = gardenView.stand.clone();
    pendingAction = openArcade; // once Boabosh has walked in
    hint.textContent = "Welcome to the Game Garden! 🎈";
  });
}
function leaveGarden(msg = "Tap a glowing spot on the map to visit it. Tap Boabosh to pet!") {
  closePanels();
  sfx.swish();
  fadeThen(() => {
    sfx.ambience("map");
    show(mapView);
    cat.group.position.copy(GARDEN);
    target = HOME.clone();
    render();
    hint.textContent = msg;
  });
}

function openArcade() {
  $("game").hidden = true;
  $("arcade-coins").textContent = String(state.coins);
  const n = Math.min(state.sinceGame, BRAIN_PER_GAME);
  $("brain").innerHTML = `<strong>🧠 Brain power</strong> ${"<i class=on></i>".repeat(n)}${"<i></i>".repeat(BRAIN_PER_GAME - n)} `
    + (n >= BRAIN_PER_GAME ? "<span>Full! Pick a game 🎉</span>" : `<span>Answer ${BRAIN_PER_GAME - n} more question${BRAIN_PER_GAME - n === 1 ? "" : "s"} right to play</span>`);
  $("arcade-games").replaceChildren(...(Object.keys(GAMES) as Game[]).map((g) => {
    const info = GAMES[g], ok = canPlay(state, g);
    const status = ok.ok ? `Play · 🪙 ${info.price}` : ok.why === "brain" ? `🔒 🪙 ${info.price} · needs 🧠` : `🔒 needs 🪙 ${ok.need} more`;
    const c = card({ icon: info.icon, label: info.label }, status, ok.ok ? [] : ["poor"], () => chooseMode(g));
    const trophies = document.createElement("span");
    trophies.className = "trophies";
    trophies.textContent = state.trophies[g] ? `🏆 × ${state.trophies[g]}` : "";
    c.append(trophies);
    return c;
  }));
  $("arcade").hidden = false;
}

/** Who to play: Boabosh (the active cat) or a friend on this device. */
function chooseMode(g: Game) {
  const ok = canPlay(state, g);
  if (!ok.ok) { playGame(g, "cat"); return; } // shows why it's locked
  const foe = activeCat(state).name;
  openArcade(); // refresh coins + brain meter, then swap the cards for the choice
  $("arcade-msg").textContent = `${GAMES[g].icon} ${GAMES[g].label} — who's playing?`;
  $("arcade-games").replaceChildren(
    card({ icon: "🐱", label: `Play against ${foe}` }, "1 player", [], () => playGame(g, "cat")),
    card({ icon: "👫", label: "Play a friend" }, "2 players, one device", [], () => playGame(g, "duo")),
    card({ icon: "↩️", label: "Pick another game" }, "", [], openArcade),
  );
  $("arcade").hidden = false;
}

function playGame(g: Game, mode: Mode) {
  const ok = canPlay(state, g);
  const msg = $("arcade-msg");
  if (!ok.ok) {
    sfx.nope();
    msg.textContent = ok.why === "brain"
      ? `First, answer ${ok.need} more question${ok.need === 1 ? "" : "s"} right in the Forest, Mountain or Lab! 📚`
      : `You need ${ok.need} more coins — every right answer gives 10! 🪙`;
    return;
  }
  msg.textContent = "";
  state = startGame(state, g);
  persist();
  sfx.coin();
  currentGame = g;
  $("arcade").hidden = true;
  const foe = activeCat(state).name;
  $("game-title").textContent = `${GAMES[g].icon} ${GAMES[g].label} · ${mode === "duo" ? "👫 2 players" : `🐱 vs ${foe}`}`;
  $("game-back").textContent = "Back to games";
  const hooks = {
    status: (t: string) => { $("game-status").textContent = t; },
    done: (r: Result) => gameOver(r),
    mode,
    foe,
  };
  const board = $("game-board");
  (g === "chess" ? kittenChess : g === "ttt" ? ticTacToe : rockPaperScissors)(board, hooks);
  $("game").hidden = false;
}

function gameOver(r: Result) {
  const foe = activeCat(state).name;
  if (r === "win" && currentGame) {
    // You beat Boabosh: a trophy, and Boabosh cheers for you like a good sport.
    state = winGame(state, currentGame);
    persist();
    setTimeout(sfx.fanfare, 200);
    react("cheer", true);
    hint.textContent = `🏆 You beat ${foe}! ${foe} says: "Good game!"`;
  } else if (r === "lose") {
    // Boabosh won: a victory spin, then a friendly nudge to try again.
    sfx.meow("happy");
    react("victory", true);
    hint.textContent = `${foe} won this one! Learn a bit more, then challenge ${foe} again 💪`;
  } else if (r === "p1" || r === "p2") {
    setTimeout(sfx.fanfare, 200);
    react("cheer", true);
    hint.textContent = `🎉 ${r === "p1" ? "Player 1" : "Player 2"} wins! ${foe} loved watching!`;
  } else {
    sfx.chime();
    react("cheer", true);
  }
  $("game-back").textContent = "Back to games · answer 3 more to play again 📚";
}

$("game-back").onclick = () => { $("game").hidden = true; currentGame = null; openArcade(); };
$("arcade-learn").onclick = () => leaveGarden("📚 Pick a learning place: Reading Forest, Math Mountain or Science Lab!");
$("arcade-leave").onclick = () => leaveGarden();

// ---------- home and care -------------------------------------------------------------
let homeView: HomeScene | null = null;
const getHome = () => { if (!homeView) { homeView = buildHome(); hw.dress(homeView.scene, "home"); } return homeView; };

function enterHome() {
  if (!$("quiz").hidden) { $("quiz").hidden = true; currentQ = null; }
  closePanels();
  sfx.swish();
  fadeThen(() => {
    const h = getHome();
    sfx.ambience("home");
    here = null;
    show(h);
    h.apply(state);
    cat.group.position.copy(h.entry);
    target = h.stand.clone();
    $("care").hidden = false;
    $("care-name").textContent = activeCat(state).name;
    renderCare();
    render();
    hint.textContent = `Welcome home! Take care of ${activeCat(state).name} 🏠`;
  });
}
function leaveHome() {
  closePanels();
  sfx.swish();
  fadeThen(() => {
    sfx.ambience("map");
    show(mapView);
    $("care").hidden = true;
    $("toy-pick").hidden = true;
    cat.group.position.copy(HOUSE).add(new THREE.Vector3(-0.6, 0, 1.0));
    target = HOME.clone();
    render();
    hint.textContent = "Tap a glowing spot on the map to visit it. Tap Boabosh to pet!";
  });
}
$("home-btn").onclick = () => { if (view === homeView) leaveHome(); else enterHome(); };
$("c-leave").onclick = leaveHome;
$("c-decorate").onclick = () => { closePanels(); openDecorate(); };

const NEED_ROWS: [Need, string, string][] = [
  ["food", "🐟 Food", "#f39c12"], ["water", "💧 Water", "#3498db"], ["fun", "🧶 Fun", "#9b59b6"],
  ["love", "💕 Love", "#ff6b9a"], ["energy", "😴 Energy", "#2ecc71"], ["clean", "🧹 Litter", "#8a6a4a"],
];
function renderCare() {
  const n = needs(state);
  $("needs").replaceChildren(...NEED_ROWS.map(([k, label, colour]) => {
    const row = document.createElement("div");
    row.className = "need";
    row.setAttribute("aria-label", `${label} ${n[k]} percent`);
    const name = document.createElement("span"); name.textContent = label;
    const bar = document.createElement("div"); bar.className = "bar";
    const fill = document.createElement("i"); fill.style.width = `${n[k]}%`; fill.style.background = n[k] < 35 ? "#e5533d" : colour;
    bar.append(fill);
    row.append(name, bar);
    return row;
  }));
  ($("c-feed") as HTMLButtonElement).textContent = `🐟 Feed (${state.fish})`;
}

/** At home: walk to a spot, turn to face the right way, then do the thing. */
function walkThen(spot: { at: THREE.Vector3; face: number }, then: () => void) {
  if (activity || fading) return;
  target = spot.at.clone();
  pendingAction = () => { cat.group.rotation.y = spot.face; then(); };
}
const busy = () => activity !== null || pendingAction !== null || fading;

function doPet() {
  activity = startMove(cat, "pet", clock.getElapsedTime());
  state = pet(state);
  persist();
  hint.textContent = `${activeCat(state).name} loves being petted! 💕`;
  afterActivity = `${activeCat(state).name} is purring happily.`;
}

$("c-feed").onclick = () => {
  if (busy()) return;
  if (state.fish <= 0) { sfx.nope(); hint.textContent = "Out of food! Buy some in the Shop 🛍️"; return; }
  walkThen(getHome().spots.food, () => {
    activity = startFeeding(cat, clock.getElapsedTime(), false);
    state = feed(state);
    persist();
    hint.textContent = `Nom nom nom… ${activeCat(state).name} is eating! 🐟`;
    afterActivity = `${activeCat(state).name} is full and happy. 💛`;
  });
  hint.textContent = "Time to eat!";
};
$("c-water").onclick = () => {
  if (busy()) return;
  walkThen(getHome().spots.water, () => {
    activity = startMove(cat, "drink", clock.getElapsedTime());
    state = water(state);
    persist();
    hint.textContent = "Lap, lap, lap… fresh water! 💧";
    afterActivity = `${activeCat(state).name} isn't thirsty any more. 💧`;
  });
};
$("c-pet").onclick = () => { if (!busy()) doPet(); };
$("c-brush").onclick = () => {
  if (busy()) return;
  activity = startMove(cat, "brush", clock.getElapsedTime());
  state = pet(state);
  persist();
  hint.textContent = "Brush, brush… so soft and shiny! ✨";
  afterActivity = `${activeCat(state).name}'s fur is all fluffy now!`;
};
$("c-nap").onclick = () => {
  if (busy()) return;
  const h = getHome();
  walkThen(h.spots.bed, () => {
    activity = startNap(cat, BED_SPOT, h.bedTop(), clock.getElapsedTime());
    state = nap(state);
    persist();
    hint.textContent = "Shhh… nap time. 😴";
    afterActivity = `${activeCat(state).name} woke up full of energy! ⚡`;
  });
};
$("c-litter").onclick = () => {
  if (busy()) return;
  const h = getHome();
  walkThen(h.spots.litter, () => {
    activity = startScoop(cat, h.litterTray, clock.getElapsedTime());
    const r = cleanLitter(state);
    state = r.state;
    persist();
    hint.textContent = "Scoop, scoop… all clean! 🧹";
    afterActivity = r.coins ? `Thanks for helping! +${r.coins} 🪙` : "Sparkling clean! ✨";
    if (r.coins) setTimeout(sfx.coin, 3800);
  });
};
$("c-scratch").onclick = () => {
  if (busy()) return;
  if (!state.home.decor.includes("scratcher")) { hint.textContent = "Put the scratching post out in 🎨 Decorate first!"; return; }
  walkThen(getHome().spots.scratch, () => {
    activity = startMove(cat, "scratch", clock.getElapsedTime());
    state = play(state);
    persist();
    hint.textContent = "Scritch scratch! Claws stay healthy 🐾";
    afterActivity = `${activeCat(state).name} loves the scratching post!`;
  });
};
$("c-play").onclick = () => {
  const box = $("toy-pick");
  if (!box.hidden) { box.hidden = true; return; }
  const toys = CATALOG.filter((i) => i.cat === "toys" && state.items.includes(i.id));
  box.replaceChildren(...toys.map((it) => card(it, "Play!", [], () => {
    if (busy()) return;
    box.hidden = true;
    activity = startPlay(cat, it.id, clock.getElapsedTime());
    state = play(state);
    persist();
    hint.textContent = `${activeCat(state).name} is playing with the ${it.label}!`;
    afterActivity = `That was fun! ${activeCat(state).name} loves the ${it.label}. 💛`;
  })), ...(toys.length ? [] : [empty("No toys yet!", "toys")]));
  box.hidden = false;
};
// Playing uses up needs: every minute the game is open and on screen, a little
// of each goes down. Paused when the tab is hidden or the title screen is up.
setInterval(() => {
  if (document.visibilityState !== "visible" || !$("title").hidden) return;
  state = drain(state, DRAIN.minute);
  persist();
  warnLowNeeds();
}, 60_000);

// When a need gets low, Boabosh says so (once, until it's looked after).
const LOW = 35;
const warned = new Set<Need>();
const WARN: Partial<Record<Need, string>> = {
  food: "🐟 {name} is getting hungry! Tap Feed or visit home 🏠",
  water: "💧 {name} is thirsty! Give some water at home 🏠",
  energy: "😴 {name} is getting sleepy. Time for a nap at home 🏠",
  love: "💕 {name} wants some love. Tap {name} to pet!",
  clean: "🧹 The litter box needs scooping at home 🏠",
};
function warnLowNeeds() {
  const n = needs(state);
  for (const k of Object.keys(WARN) as Need[]) {
    if (n[k] >= LOW + 15) warned.delete(k); // cared for: allowed to warn again later
    if (n[k] < LOW && !warned.has(k) && !activity) {
      warned.add(k);
      hint.textContent = WARN[k]!.replaceAll("{name}", activeCat(state).name);
      sfx.meow(k === "energy" ? "sleepy" : "curious");
      return; // one nudge at a time
    }
  }
}

// Needs run down in real time; refresh the bars and the home now and then.
setInterval(() => { if (view === homeView) render(); else $("home-btn").classList.toggle("alert", Object.values(needs(state)).some((n) => n < 40)); }, 5000);

// ---------- collar tag (cross-device) --------------------------------------
// ---------- picture code (cross-device) ------------------------------------------
// A 4-picture pairing code: made on the old device, works once, for 10 minutes.
const PAIR = 4;
let picks: number[] = [];
let pairTimer: ReturnType<typeof setInterval> | undefined;

/** A row of numbered picture tiles; empty slots show the number. */
function picRow(box: HTMLElement, pics: number[], showEmpty = false) {
  box.replaceChildren(...Array.from({ length: PAIR }, (_, i) => {
    const li = document.createElement("li");
    const p = PICTURES[pics[i] ?? -1];
    li.textContent = p ? p[0] : showEmpty ? String(i + 1) : "";
    li.className = p ? "" : "empty";
    li.setAttribute("aria-label", p ? `${i + 1}: ${p[1]}` : `${i + 1}: empty`);
    return li;
  }));
}

function drawPicks() {
  picRow($("tag-slots"), picks, true);
  ($("tag-load") as HTMLButtonElement).disabled = picks.length < PAIR;
  ($("tag-undo") as HTMLButtonElement).disabled = picks.length === 0;
}

// The picture grid: animals, then food, then things, so pictures are easy to find.
$("tag-grid").replaceChildren(...PICTURES.map(([emoji, name], i) => {
  const b = document.createElement("button");
  b.textContent = emoji;
  b.title = name;
  b.setAttribute("aria-label", name);
  b.onclick = () => {
    if (picks.length >= PAIR) return;
    picks.push(i);
    sfx.pop();
    $("tag-msg").textContent = picks.length === PAIR ? "All 4! Now tap “Fetch my cats” 🐾" : "";
    drawPicks();
  };
  return b;
}));

function resetPairing() {
  clearInterval(pairTimer);
  $("tag-pics").hidden = true;
  $("tag-timer").hidden = true;
  ($("tag-make") as HTMLButtonElement).disabled = false;
}

$("tag-btn").onclick = () => {
  closePanels();
  resetPairing();
  $("tag-code").textContent = myCode();
  picks = [];
  drawPicks();
  $("tag-msg").textContent = online() ? "" : "Playing offline: picture codes need the internet save (Supabase).";
  $("tag").hidden = false;
};
$("tag-close").onclick = () => { $("tag").hidden = true; resetPairing(); };
$("tag-undo").onclick = () => { picks.pop(); $("tag-msg").textContent = ""; drawPicks(); };

$("tag-make").onclick = async () => {
  const make = $("tag-make") as HTMLButtonElement;
  make.disabled = true;
  $("tag-msg").textContent = "Making your code… ✨";
  try {
    const pics = await pairCreate(state);
    picRow($("tag-pics"), codeToPictures(pics));
    $("tag-pics").hidden = false;
    $("tag-msg").textContent = "";
    sfx.sparkle();
    const until = Date.now() + 10 * 60_000;
    const tick = () => {
      const left = Math.max(0, until - Date.now());
      const m = Math.floor(left / 60_000), sec = Math.floor((left % 60_000) / 1000);
      $("tag-timer").textContent = left > 0
        ? `⏳ Works for ${m}:${String(sec).padStart(2, "0")} · only once · keep it secret 🔒`
        : "This code ran out. Make a new one!";
      $("tag-timer").hidden = false;
      if (left <= 0) { clearInterval(pairTimer); $("tag-pics").hidden = true; make.disabled = false; }
    };
    tick();
    clearInterval(pairTimer);
    pairTimer = setInterval(tick, 1000);
  } catch (err) {
    make.disabled = false;
    $("tag-msg").textContent = (err as Error).message === "offline"
      ? "Playing offline: picture codes need the internet save (Supabase)."
      : "Couldn't make a code right now. Try again in a moment!";
  }
};

async function fetchCats(get: () => Promise<State>) {
  $("tag-msg").textContent = "Looking for your cats… 🔍";
  try {
    state = await get();
    render();
    sfx.meow("happy");
    sfx.sparkle();
    $("tag-msg").textContent = `Found ${activeCat(state).name}! Welcome back 🎉`;
    $("tag-code").textContent = myCode();
    picks = [];
    drawPicks();
  } catch (err) {
    sfx.nope();
    const msg = (err as Error).message;
    $("tag-msg").textContent = msg.startsWith("No cat")
      ? "Hmm, no cats with those pictures. Check the order, or make a new code on the other device! 🧐"
      : msg === "offline" ? "Playing offline: picture codes need the internet save (Supabase)." : msg;
  }
}
$("tag-load").onclick = () => { if (picks.length === PAIR) void fetchCats(() => pairRedeem(picturesToCode(picks))); };
$("tag-load-letters").onclick = () => void fetchCats(() => restore(($("tag-input") as HTMLInputElement).value));

$("offline").hidden = online();

// Sound + music toggles (remembered in this browser), and a soft pop on every button.
const toggles = () => {
  $("snd").textContent = sfx.soundOn() ? "🔊" : "🔇";
  $("snd").setAttribute("aria-pressed", String(sfx.soundOn()));
  $("snd").setAttribute("aria-label", sfx.soundOn() ? "Sound on" : "Sound off");
  $("mus").setAttribute("aria-pressed", String(sfx.musicOn()));
  $("mus").setAttribute("aria-label", sfx.musicOn() ? "Music on" : "Music off");
};
// 🎃 Halloween theme toggle (on by itself in October).
const hwButton = () => {
  $("hw-btn").setAttribute("aria-pressed", String(hw.isOn()));
  $("hw-btn").setAttribute("aria-label", hw.isOn() ? "Halloween decorations on" : "Halloween decorations off");
};
$("hw-btn").onclick = () => { hw.setOn(!hw.isOn()); hwButton(); if (hw.isOn()) sfx.boo(); };
hw.setOn(hw.isOn()); // apply body class + music for the starting state
hwButton();
$("snd").onclick = () => { sfx.unlock(); sfx.setSound(!sfx.soundOn()); toggles(); };
$("mus").onclick = () => { sfx.unlock(); sfx.setMusic(!sfx.musicOn()); toggles(); };
toggles();
document.addEventListener("click", (e) => {
  const b = (e.target as Element).closest("button");
  if (b && b.parentElement?.id !== "quiz-choices") sfx.pop(); // answers get their own sound
});

$("start").onclick = () => {
  sfx.unlock();
  sfx.ambience("map");
  sfx.meow("happy", 0.3);
  $("title").classList.add("gone");
  setTimeout(() => { $("title").hidden = true; }, 700);
};

// ---------- loop -----------------------------------------------------------
const clock = new THREE.Clock();
let lastStep = 0;
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();

  gems.forEach((g, i) => { g.position.y = 1.8 + Math.sin(t * 2 + i) * 0.18; g.rotation.y = t * 0.8; });

  view.update(t);
  hw.update(view.scene, t);
  // Gentle camera drift inside areas so the place feels alive.
  if (view !== mapView) {
    camera.position.copy(view.camPos).add(new THREE.Vector3(Math.sin(t * 0.15) * 0.6, Math.sin(t * 0.21) * 0.2, 0));
    camera.lookAt(view.camLook);
  }

  // Walk toward the target, face the way we're going; on the map, arriving at
  // a pad fades into that area; in an area, arriving opens the quiz.
  const to = target.clone().sub(cat.group.position);
  const dist = to.length();
  if (dist > 0.08 && !activity) {
    cat.group.position.addScaledVector(to.normalize(), Math.min(0.07, dist));
    cat.group.rotation.y = Math.atan2(to.x, to.z);
    cat.group.position.y = Math.abs(Math.sin(t * 9)) * 0.08; // bouncy trot
    if (Math.floor(t * 4.5) !== lastStep) { lastStep = Math.floor(t * 4.5); sfx.step(); }
  } else {
    cat.group.position.y = Math.sin(t * 2) * 0.02;
    // Idle: turn to face the camera (not mid-animation: eating faces the bowl).
    if (!activity && !pendingAction) cat.group.rotation.y += (0 - cat.group.rotation.y) * 0.06;
    if (!activity && pendingAction && !fading) { const go = pendingAction; pendingAction = null; go(); }
    if (!activity && pendingHome && !fading) { pendingHome = false; enterHome(); }
    if (!activity && pendingGarden && !fading) { pendingGarden = false; enterGarden(); }
    if (!activity && pendingArea && !fading) { enterArea(pendingArea); pendingArea = null; }
    if (!activity && quizOnArrival && !fading) { openQuiz(quizOnArrival); quizOnArrival = null; }
  }
  cat.tail.rotation.z = Math.sin(t * 3) * 0.3;
  cat.hatSlot.traverse((o) => { if (o.userData.spin) o.rotation.y = t * 8; }); // propeller caps spin
  // Eating/playing overrides pose, head, eyes and tail; walking waits until it's done.
  if (activity && !activity.update(t)) {
    activity = null;
    if (afterActivity) hint.textContent = afterActivity;
    afterActivity = "";
    render();
  }

  ink.render(view.scene, camera);
});

render();
