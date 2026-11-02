// The Laser Tag Arena: a neon room, its cats and beams, and the controls. Rules
// live in lasertag.ts; this file only feeds it input and draws what comes back.

import * as THREE from "three";
import type { AreaScene } from "./areas.ts";
import { makeCat, dress, type Cat } from "./cat.ts";
import * as xmas from "./christmas.ts";
import { COATS } from "./shop.ts";
import { toonify } from "./toon.ts";
import { mat, at, shadows, label } from "./world.ts";
import { ARENA, WALLS, COUNTDOWN, newRound, pickTarget, step, type Level, type Round } from "./lasertag.ts";
import * as sfx from "./sound.ts";

export type LaserTag = AreaScene & {
  begin: (cat: Cat, level: Level, done: (g: Round) => void) => void;
  /** Ends any round and takes down its listeners, gear and HUD. Safe to call twice. */
  stop: () => void;
  playing: () => boolean;
  /** Built with the Christmas look? */
  jolly: boolean;
};

const BLUE = 0x4fc3ff, GOLD = 0xffe066;
let PINK = 0xff5fb8; // the other team: red at Christmas (blue vs red stays clear for colour-blind kids)
const FOE_COATS = ["ginger", "snow", "calli"];

/** Flat glowing colour: no shading, no ink line. */
function glow(color: number, opacity = 1) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
  m.userData.outlineParameters = { visible: false };
  return m;
}
function sprite(text: string, color: string, size: number) {
  const m = new THREE.SpriteMaterial({ map: label(text, "", color, 256, 128, 72), transparent: true, depthTest: false });
  m.userData.outlineParameters = { visible: false };
  const s = new THREE.Sprite(m);
  s.scale.set(size * 2, size, 1);
  s.renderOrder = 5;
  s.visible = false;
  return s;
}

type Gear = {
  root: THREE.Group; bubble: THREE.Mesh; bang: THREE.Sprite; say: THREE.Sprite; stars: THREE.Group; charge: THREE.Mesh;
  sayLeft: number; spin: number;
};

/** What every cat wears here: a team vest, a floor ring, and its dizzy stars and speech. */
function makeGear(color: number): Gear {
  const root = new THREE.Group();
  const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.43, 0.3, 20, 1, true), mat(color, { side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.5 }));
  vest.scale.x = 1.06;
  root.add(at(vest, 0, 0.5, 0));
  root.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), glow(0xffffff)), 0, 0.52, 0.43)); // the toy beam comes from here
  root.add(at(new THREE.Mesh(new THREE.RingGeometry(0.58, 0.76, 32).rotateX(-Math.PI / 2), glow(color, 0.8)), 0, 0.04, 0));
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.85, 18, 12), glow(color, 0.2));
  bubble.position.y = 0.65;
  bubble.visible = false;
  const charge = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), glow(0xffffff));
  charge.position.set(0, 0.55, 0.6);
  charge.visible = false;
  const bang = at(sprite("!", "#ffe066", 1.4), 0, 1.95, 0);
  const say = at(sprite("Meow!", "#ffffff", 0.7), 0, 1.8, 0);
  const stars = new THREE.Group();
  stars.position.y = 1.45;
  stars.visible = false;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    stars.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.09), glow(GOLD)), Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4));
  }
  root.add(bubble, charge, bang, say, stars);
  return { root, bubble, bang, say, stars, charge, sayLeft: 0, spin: 0 };
}

export function buildArena(): LaserTag {
  const jolly = document.body.classList.contains("christmas");
  PINK = jolly ? 0xff3b4a : 0xff5fb8;
  document.getElementById("lt-foe-dot")!.textContent = jolly ? "🔴" : "🩷";
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b2c);
  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x5560c0, 1.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(4, 16, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, far: 40 });
  scene.add(sun);

  // Floor: deep blue with a neon grid.
  const { hw, hd } = ARENA;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 40, 0.1, hd * 2 + 40), mat(0x10164a));
  floor.position.y = -0.05;
  floor.receiveShadow = true;
  scene.add(floor);
  const lines = new THREE.MeshBasicMaterial({ color: 0x2c47c9 });
  lines.userData.outlineParameters = { visible: false };
  for (let x = -hw; x <= hw; x += 1.7) scene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.04, hd * 2).rotateX(-Math.PI / 2), lines), x, 0.01, 0));
  for (let z = -hd; z <= hd; z += 1.666) scene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, 0.04).rotateX(-Math.PI / 2), lines), 0, 0.01, z));

  // Low walls with a glowing top: cover you can still see cats over.
  const wall = (x: number, z: number, w: number, d: number, h: number, c: number) => {
    scene.add(shadows(at(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0x2a2f86)), x, h / 2, z)));
    scene.add(at(new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.07, d + 0.04), glow(c)), x, h, z));
  };
  WALLS.forEach((b, i) => wall(b.x, b.z, b.hw * 2, b.hd * 2, 0.7, i % 2 ? PINK : BLUE));
  wall(0, -hd - 0.2, hw * 2 + 0.8, 0.4, 1.5, PINK);
  wall(0, hd + 0.2, hw * 2 + 0.8, 0.4, 0.3, BLUE);
  for (const s of [-1, 1]) wall(s * (hw + 0.2), 0, 0.4, hd * 2, 0.6, s < 0 ? BLUE : PINK);

  // Glowing sign and lamps on the back of the room.
  const signMat = new THREE.MeshBasicMaterial({ map: label(jolly ? "SNOWY LASER TAG" : "LASER TAG ARENA", "", "#7fe3ff", 1024, 128, 96), transparent: true, depthWrite: false });
  signMat.userData.outlineParameters = { visible: false };
  scene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(10, 1.25), signMat), 0, 2.6, -hd - 0.45));
  const lamps: THREE.Mesh[] = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), glow(i % 2 ? PINK : BLUE));
    scene.add(at(m, -13 + (i * 26) / 11, 4.2, -hd - 1));
    lamps.push(m);
  }

  // Beams, sparkles, the power star and the lock-on ring, kept in pools so a round makes no garbage.
  const pews = Array.from({ length: 6 }, () => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 8).rotateX(Math.PI / 2), glow(0x9fe8ff));
    m.visible = false;
    scene.add(m);
    return Object.assign(m, { life: 0 });
  });
  const shots = Array.from({ length: 12 }, () => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.55, 4, 10).rotateX(Math.PI / 2), glow(jolly ? 0xff9a8a : 0xff8fd0));
    m.visible = false;
    scene.add(m);
    return m;
  });
  const sparks = Array.from({ length: 40 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), glow([GOLD, 0xffffff, BLUE, PINK][i % 4]!));
    m.visible = false;
    scene.add(m);
    return Object.assign(m, { life: 0, vel: new THREE.Vector3() });
  });
  let nextSpark = 0;
  const burst = (x: number, z: number) => {
    for (let i = 0; i < 12; i++) {
      const s = sparks[nextSpark++ % sparks.length]!;
      s.visible = true; s.life = 0.8;
      s.position.set(x, 0.9, z);
      s.vel.set((Math.random() - 0.5) * 4, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 4);
    }
  };
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), glow(GOLD));
  star.add(new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.04, 6, 24), glow(0xffffff)));
  star.visible = false;
  scene.add(star);
  const lock = new THREE.Mesh(new THREE.RingGeometry(0.86, 1.02, 32).rotateX(-Math.PI / 2), glow(0xffffff));
  lock.visible = false;
  scene.add(lock);

  // Pink team, on show before the first round too.
  const foes = FOE_COATS.map((c) => {
    const cat = makeCat(COATS[c]);
    if (jolly) dress(cat, { hat: "santa-hat" });
    const gear = makeGear(PINK);
    cat.group.add(gear.root);
    scene.add(cat.group);
    return { cat, gear };
  });
  const playerGear = makeGear(BLUE);
  const lobby = newRound("hard");
  foes.forEach(({ cat }, i) => { const f = lobby.foes[i]!; cat.group.position.set(f.x, 0, f.z); });
  toonify(scene);

  const $ = (id: string) => document.getElementById(id)!;
  const hud = $("lt-hud"), blueEl = $("lt-blue"), pinkEl = $("lt-pink"), timeEl = $("lt-time"), sayEl = $("lt-say");
  const stick = $("lt-stick"), knob = stick.firstElementChild as HTMLElement, fireBtn = $("lt-fire");

  const camPos = new THREE.Vector3(0, 13.5, 11.5), camLook = new THREE.Vector3(0, 0, -0.5);
  const camBase = camPos.clone(), lookBase = camLook.clone();

  let round: Round | null = null, me: Cat | null = null, onDone: ((g: Round) => void) | null = null;
  let controls: AbortController | null = null;
  let last = 0, endIn = 0, sayLeft = 0;
  const keys = new Set<string>(), pad = { x: 0, z: 0 };
  let held = false, queued = false;

  const say = (text: string, seconds: number) => { sayEl.textContent = text; sayLeft = seconds; };
  const put = (el: HTMLElement, text: string) => { if (el.textContent !== text) el.textContent = text; };

  function pose(cat: Cat, gear: Gear, s: { x: number; z: number; face: number; moving: boolean }, dizzy: boolean, shield: number | null, t: number, dt: number) {
    const g = cat.group;
    g.position.x = s.x; g.position.z = s.z;
    g.position.y = s.moving ? Math.abs(Math.sin(t * 11)) * 0.1 : 0;
    gear.spin = dizzy ? gear.spin + dt * 9 : 0;
    g.rotation.y = dizzy ? gear.spin : s.face;
    g.visible = !dizzy || Math.floor(t * 6) % 2 === 0; // the blink
    gear.stars.visible = dizzy;
    gear.stars.rotation.y = -gear.spin * 1.4;
    cat.eyes.forEach((e) => { e.visible = !dizzy; });
    cat.lids.forEach((l) => { l.visible = dizzy; });
    gear.bubble.visible = shield !== null;
    if (shield !== null) (gear.bubble.material as THREE.MeshBasicMaterial).color.setHex(shield);
    if (gear.sayLeft > 0) {
      gear.sayLeft -= dt;
      gear.say.visible = gear.sayLeft > 0;
      gear.say.position.y = 1.8 + (1 - gear.sayLeft) * 0.5;
    }
  }
  const meow = (gear: Gear) => { gear.sayLeft = 1; gear.say.visible = true; };

  function stop() {
    controls?.abort();
    controls = null;
    if (me) {
      me.group.remove(playerGear.root);
      me.group.visible = true;
      me.group.position.y = 0;
      me.group.rotation.y = 0;
      me.eyes.forEach((e) => { e.visible = true; });
      me.lids.forEach((l) => { l.visible = false; });
      me = null;
    }
    round = null; onDone = null;
    keys.clear(); pad.x = pad.z = 0; held = queued = false;
    knob.style.transform = "";
    hud.hidden = true;
    for (const m of [...pews, ...shots, ...sparks, star, lock]) m.visible = false;
    for (const { cat, gear } of foes) {
      cat.eyes.forEach((e) => { e.visible = true; });
      cat.lids.forEach((l) => { l.visible = false; });
      cat.group.visible = true;
      gear.stars.visible = gear.bubble.visible = gear.bang.visible = gear.say.visible = gear.charge.visible = false;
    }
    camPos.copy(camBase); camLook.copy(lookBase);
  }

  function begin(cat: Cat, level: Level, done: (g: Round) => void) {
    stop();
    round = newRound(level);
    me = cat; onDone = done; endIn = 0; last = 0;
    cat.group.add(playerGear.root);
    foes.forEach(({ cat: c }, i) => { c.group.visible = i < round!.foes.length; });
    hud.hidden = false;
    say("", 0);

    // Everything below dies with this controller, so leaving can't leave a listener behind.
    controls = new AbortController();
    const signal = controls.signal;
    const FIRE = new Set(["Space", "Enter", "KeyF"]);
    const MOVE = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"]);
    addEventListener("keydown", (e) => {
      if (FIRE.has(e.code)) { held = true; if (!e.repeat) queued = true; e.preventDefault(); }
      else if (MOVE.has(e.code)) { keys.add(e.code); e.preventDefault(); }
    }, { signal });
    addEventListener("keyup", (e) => { if (FIRE.has(e.code)) held = false; keys.delete(e.code); }, { signal });
    addEventListener("blur", () => { keys.clear(); held = false; pad.x = pad.z = 0; knob.style.transform = ""; }, { signal });

    // Thumb stick. Pointer capture keeps it working when the thumb slides off it.
    let thumb = -1;
    const drag = (e: PointerEvent) => {
      const r = stick.getBoundingClientRect(), reach = r.width * 0.36;
      let x = (e.clientX - r.left - r.width / 2) / reach, z = (e.clientY - r.top - r.height / 2) / reach;
      const l = Math.hypot(x, z);
      if (l > 1) { x /= l; z /= l; }
      pad.x = x; pad.z = z;
      knob.style.transform = `translate(${x * reach}px, ${z * reach}px)`;
    };
    const release = (e: PointerEvent) => {
      if (e.pointerId !== thumb) return;
      thumb = -1; pad.x = pad.z = 0; knob.style.transform = "";
    };
    stick.addEventListener("pointerdown", (e) => { sfx.unlock(); thumb = e.pointerId; stick.setPointerCapture(thumb); drag(e); e.preventDefault(); }, { signal });
    stick.addEventListener("pointermove", (e) => { if (e.pointerId === thumb) drag(e); }, { signal });
    stick.addEventListener("pointerup", release, { signal });
    stick.addEventListener("pointercancel", release, { signal });
    let tagger = -1;
    fireBtn.addEventListener("pointerdown", (e) => { sfx.unlock(); tagger = e.pointerId; fireBtn.setPointerCapture(tagger); held = queued = true; e.preventDefault(); }, { signal });
    for (const ev of ["pointerup", "pointercancel"] as const) fireBtn.addEventListener(ev, (e) => { if (e.pointerId === tagger) { tagger = -1; held = false; } }, { signal });
  }

  function play(g: Round, t: number, dt: number) {
    const k = (a: string, b: string) => (keys.has(a) || keys.has(b) ? 1 : 0);
    const mx = pad.x + k("ArrowRight", "KeyD") - k("ArrowLeft", "KeyA");
    const mz = pad.z + k("ArrowDown", "KeyS") - k("ArrowUp", "KeyW"); // the camera looks toward -z: up on screen is -z
    const fire = (held || queued) && g.start <= 0;
    for (const e of step(g, { mx, mz, fire }, dt)) {
      if (e.type === "pew") {
        queued = false;
        sfx.pew(false);
        const b = pews.find((p) => p.life <= 0) ?? pews[0]!;
        const from = new THREE.Vector3(e.from.x, 0.55, e.from.z), to = new THREE.Vector3(e.to.x, 0.6, e.to.z);
        b.position.copy(from).lerp(to, 0.5);
        b.scale.set(1, 1, from.distanceTo(to));
        b.lookAt(to);
        b.visible = true; b.life = 0.16;
      } else if (e.type === "aim") {
        sfx.charge();
      } else if (e.type === "shot") {
        sfx.pew(true);
      } else if (e.type === "tagFoe") {
        const f = g.foes[e.foe]!, gear = foes[e.foe]!.gear;
        sfx.tagged(); sfx.meow("short", 0.05);
        burst(f.x, f.z); meow(gear);
      } else if (e.type === "tagPlayer") {
        sfx.tagged(); sfx.meow("curious", 0.05);
        burst(g.p.x, g.p.z); meow(playerGear);
      } else if (e.type === "star") {
        sfx.pop(); say("⭐ A power star! Grab it!", 1.8);
      } else if (e.type === "gotStar") {
        sfx.sparkle(); say("⭐ Super cat! Fast tags, and nothing can tag you!", 2.2);
      } else if (e.type === "go") {
        sfx.chime(); say("Go! 🐾", 0.9);
      } else if (e.type === "end") {
        say("Time's up! 🎉", 2); endIn = 1.3;
      }
    }

    // Draw it all.
    const shield = g.p.power > 0 ? GOLD : g.p.safe > 0 ? BLUE : null;
    pose(me!, playerGear, { ...g.p }, g.p.dizzy > 0, shield, t, dt);
    g.foes.forEach((f, i) => {
      const { cat, gear } = foes[i]!;
      pose(cat, gear, f, f.phase === "dizzy", f.safe > 0 ? PINK : null, t + i * 0.09, dt); // offset: foes don't all blink out at once
      const aiming = f.phase === "aim";
      gear.bang.visible = aiming;
      gear.charge.visible = aiming;
      if (aiming) {
        gear.charge.scale.setScalar(0.4 + (1 - f.timer / g.cfg.telegraph) * 1.2);
        gear.bang.position.y = 1.95 + Math.sin(t * 14) * 0.06;
      }
    });
    shots.forEach((m, i) => {
      const s = g.shots[i];
      m.visible = !!s;
      if (s) {
        m.position.set(s.x, 0.6, s.z);
        m.rotation.y = Math.atan2(s.vx, s.vz);
      }
    });
    star.visible = !!g.star;
    if (g.star) {
      star.position.set(g.star.x, 0.8 + Math.sin(t * 3) * 0.12, g.star.z);
      star.rotation.y = t * 2;
    }
    const target = g.start > 0 ? -1 : pickTarget(g);
    lock.visible = target >= 0 && g.left > 0;
    if (target >= 0) {
      const f = g.foes[target]!;
      lock.position.set(f.x, 0.05, f.z);
      lock.scale.setScalar(1 + Math.sin(t * 8) * 0.06);
    }
    fireBtn.classList.toggle("locked", lock.visible);

    // HUD.
    put(blueEl, String(g.blue));
    put(pinkEl, String(g.pink));
    put(timeEl, String(Math.ceil(g.left)));
    if (g.start > 0) put(sayEl, String(Math.ceil((g.start / COUNTDOWN) * 3)));
    else {
      sayLeft -= dt;
      if (sayLeft <= 0) put(sayEl, "");
    }

    // A gentle follow, so the player's cat stays near the middle of small screens.
    camPos.lerp(new THREE.Vector3(g.p.x * 0.45, camBase.y, camBase.z + g.p.z * 0.35), 0.06);
    camLook.lerp(new THREE.Vector3(g.p.x * 0.45, 0, lookBase.z + g.p.z * 0.35), 0.06);

    if (g.left <= 0) {
      endIn -= dt;
      if (endIn <= 0) { const finish = onDone!; stop(); finish(g); }
    }
  }

  function update(t: number) {
    lamps.forEach((m, i) => { m.scale.setScalar(1 + Math.sin(t * 2 + i) * 0.25); });
    // Long frames are clamped: a hidden tab stops the animation loop, so the round simply waits.
    const dt = last ? Math.min(0.05, t - last) : 0;
    last = t;
    for (const b of pews) if (b.life > 0) { b.life -= dt; b.visible = b.life > 0; }
    for (const s of sparks) if (s.life > 0) {
      s.life -= dt;
      s.visible = s.life > 0;
      s.vel.y -= 7 * dt;
      s.position.addScaledVector(s.vel, dt);
      s.rotation.y += dt * 6;
    }
    foes.forEach(({ cat }, i) => { cat.tail.rotation.z = Math.sin(t * 4 + i) * 0.4; });
    if (round) play(round, t, dt);
  }

  if (jolly) xmas.dress(scene, "arena");
  return {
    scene, camPos, camLook, update, begin, stop,
    entry: new THREE.Vector3(0, 0, hd - 0.4), stand: new THREE.Vector3(0, 0, 3.6), jolly,
    playing: () => round !== null,
  };
}
