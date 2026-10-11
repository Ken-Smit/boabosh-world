// Playing with toys from the wardrobe. Each toy has its own little scene:
// the yarn gets chased, the feather wand gets swatted, the laser dot gets
// pounced on. Every one ends with a happy, purring cat. Also here: petting,
// and the cat's reactions to quiz answers (hop, head tilt, victory spin).

import * as THREE from "three";
import type { Cat } from "./cat.ts";
import { mat, at } from "./world.ts";
import { phase, floater, dispose, resetCat, type Activity } from "./feed.ts";
import * as sfx from "./sound.ts";
import { BY_ID, type ShopItem } from "./shop.ts";

type Rig = {
  cat: Cat;
  fx: THREE.Group; // effects group sitting at the cat's starting spot, world-aligned
  p0: THREE.Vector3; // where the cat started; it ends back here
  pos: THREE.Vector3; // the cat's position relative to p0, written each frame
  once: (key: string, play: () => void) => void; // fire a sound once per activity
};

/** Eyes closed, hearts floating up, a purr. `t` is seconds since the toy started. */
function celebration(fx: THREE.Group) {
  const hearts = [0, 1, 2, 3].map(() => floater("♥", "#ff4d6d", 0.3));
  const purr = floater("purrr…", "#fff3c4", 0.28);
  [...hearts, purr].forEach((s) => { s.visible = false; fx.add(s); });
  let started = false;
  return (cat: Cat, t: number, start: number, end: number, at = new THREE.Vector3()) => {
    const on = t > start && t < end - 0.3;
    if (on && !started) { started = true; sfx.meow("happy"); sfx.purr(end - start - 0.2); }
    cat.eyes.forEach((e) => { e.visible = !on; });
    cat.lids.forEach((l) => { l.visible = on; });
    hearts.forEach((h, i) => {
      const a = t - (start + i * 0.3);
      h.visible = a > 0 && a < 1.4;
      if (!h.visible) return;
      h.position.set(at.x + Math.sin(a * 3 + i) * 0.25 + (i - 1.5) * 0.15, 1.4 + a * 0.9, at.z);
      h.material.opacity = Math.min(1, a * 4) * (1 - a / 1.4);
    });
    const pa = t - start - 0.1;
    purr.visible = pa > 0 && pa < 1.5;
    purr.position.set(at.x + 0.6, 1.55 + pa * 0.15, at.z);
    purr.material.opacity = Math.min(1, pa * 3) * (1 - Math.max(0, pa - 1) / 0.5);
  };
}

/** Point the head at a spot (in fx/world-aligned coords), relative to how the body faces. */
function look(rig: Rig, target: THREE.Vector3, amount = 1) {
  const { cat } = rig;
  const d = target.clone().sub(rig.pos).sub(new THREE.Vector3(0, 0.95, 0));
  let yaw = Math.atan2(d.x, d.z) - cat.group.rotation.y;
  yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw)); // wrap to [-π, π]
  const pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z));
  cat.head.rotation.y = THREE.MathUtils.clamp(yaw, -0.9, 0.9) * amount;
  cat.head.rotation.x = THREE.MathUtils.clamp(pitch, -0.6, 0.8) * amount;
}

/** Turn the body smoothly to face a spot. */
function face(rig: Rig, target: THREE.Vector3, k = 0.15) {
  const want = Math.atan2(target.x - rig.pos.x, target.z - rig.pos.z);
  let d = want - rig.cat.group.rotation.y;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  rig.cat.group.rotation.y += d * k;
}

/** Unit-length rod along +z from its origin; `stretch` aims it from a to b. */
const rod = (radius: number, colour: number) =>
  new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 6).translate(0, 0.5, 0).rotateX(Math.PI / 2), mat(colour));
function stretch(m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, origin: THREE.Vector3) {
  m.position.copy(a);
  m.lookAt(b.clone().add(origin)); // lookAt takes world coords
  m.scale.set(1, 1, Math.max(0.001, a.distanceTo(b)));
}

/** A hop from one spot to another (fx-local), height `h`, u in 0..1. */
const hop = (a: THREE.Vector3, b: THREE.Vector3, h: number, u: number) =>
  a.clone().lerp(b, u).setY(Math.sin(Math.PI * u) * h);

// ---------------------------------------------------------------------------
// Ball of yarn: rolls in, cat crouches and wiggles, pounces, chases it round
// in a circle as it unspools a thread, then catches and hugs it.
// ---------------------------------------------------------------------------
/** The thing that gets chased: a yarn ball, a toy mouse (slides, doesn't roll) or a bouncy ball. */
function chaseToy(it: ShopItem, R: number) {
  const ball = new THREE.Group();
  const c1 = it.color ?? 0xe74c3c, c2 = it.color2 ?? 0xb03024;
  if (it.style === "mouse") {
    const body = new THREE.Mesh(new THREE.SphereGeometry(R, 14, 10), mat(c1));
    body.scale.set(0.8, 0.7, 1.3);
    ball.add(body);
    for (const x of [-0.06, 0.06]) ball.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), mat(c2, { side: THREE.DoubleSide })), x, 0.08, 0.08));
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), mat(c2));
    nose.position.z = R * 1.3;
    ball.add(nose);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 4), mat(c2));
    tail.rotation.x = Math.PI / 2 - 0.3;
    tail.position.set(0, 0.02, -0.28);
    ball.add(tail);
  } else {
    ball.add(new THREE.Mesh(new THREE.SphereGeometry(R, 14, 10), mat(c1)));
    const wraps = it.style === "ball" ? 1 : 6;
    for (let k = 0; k < wraps; k++) {
      const w = new THREE.Mesh(new THREE.TorusGeometry(R * 0.99, it.style === "ball" ? 0.03 : 0.012, 4, 20), mat(c2));
      w.rotation.set(k * 0.9, k * 1.7, k * 0.4);
      ball.add(w);
    }
  }
  ball.traverse((o) => { o.castShadow = true; });
  return ball;
}

function yarn(rig: Rig, celebrate: ReturnType<typeof celebration>, it: ShopItem = BY_ID.yarn!): (t: number) => number {
  const { cat, fx } = rig;
  const R = 0.14;
  const ball = chaseToy(it, R);
  const rolls = it.style !== "mouse", unspools = it.style === "yarn" || !it.style;
  fx.add(ball);
  // The unspooled thread: a thin tube, rebuilt each time it grows a point.
  const MAX = 120;
  const threadPts: THREE.Vector3[] = [];
  const threadMat = mat(0xe74c3c, { transparent: true });
  const thread = new THREE.Mesh(new THREE.BufferGeometry(), threadMat);
  fx.add(thread);
  const last = new THREE.Vector3(1.8, R, 1.2);
  const swat = floater("swat!", "#ffffff", 0.2);
  swat.visible = false;
  fx.add(swat);

  const ballAt = (t: number) => {
    if (t < 0.7) return new THREE.Vector3(1.8, R, 1.2).lerp(new THREE.Vector3(0, R, 0.75), phase(t, 0, 0.7));
    if (t < 1.6) return new THREE.Vector3(0, R, 0.75);
    // Knocked away: spirals round the cat, slowing down.
    const u = Math.min(t, 3.9) - 1.6;
    const a = Math.PI / 2 + u * 2.9 - u * u * 0.25;
    const r = 0.75 + u * 0.15;
    return new THREE.Vector3(Math.cos(a) * r, R, Math.sin(a) * r);
  };

  return (t) => {
    const b = ballAt(t);
    // Roll: spin about the axis perpendicular to travel.
    const step = b.clone().sub(last);
    if (step.lengthSq() > 1e-8) {
      if (rolls) ball.rotateOnWorldAxis(new THREE.Vector3(step.z, 0, -step.x).normalize(), step.length() / R);
      else ball.rotation.y = Math.atan2(step.x, step.z); // the mouse scurries nose-first
    }
    last.copy(b);
    if (t < 4.4) ball.position.copy(b);
    // Thread unspools behind the ball once it's been knocked.
    const tail = threadPts[threadPts.length - 1];
    if (it.style === "ball" && t < 4.4) b.y = R + Math.abs(Math.sin(t * 9)) * 0.25; // boing boing
    if (unspools && t > 1.6 && t < 4.4 && threadPts.length < MAX && (!tail || tail.distanceTo(b.clone().setY(0.02)) > 0.06)) {
      threadPts.push(b.clone().setY(0.02));
      if (threadPts.length > 1) {
        thread.geometry.dispose();
        thread.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(threadPts), threadPts.length * 3, 0.012, 4);
      }
    }

    const start = new THREE.Vector3();
    if (t < 1.3) {
      // Spot it, crouch, butt wiggle.
      const c = phase(t, 0.4, 0.9);
      look(rig, b);
      rig.pos.copy(start);
      cat.group.scale.set(1, 1 - 0.12 * c, 1 + 0.06 * c);
      cat.group.rotation.z = Math.sin(t * 28) * 0.06 * c;
      cat.tail.rotation.z = Math.sin(t * 16) * 0.5;
    } else if (t < 2.0) {
      // Pounce forward onto it, then land back.
      rig.once("pounce", () => sfx.whoosh());
      if (t > 1.6) rig.once("knock", sfx.swat);
      const u = phase(t, 1.3, 1.75), back = phase(t, 1.75, 2.0);
      cat.group.rotation.z = 0;
      cat.group.scale.set(1, 1.05, 1);
      rig.pos.copy(hop(start, new THREE.Vector3(0, 0, 0.35), 0.45, u)).lerp(start, back);
      cat.group.rotation.x = Math.sin(u * Math.PI) * 0.35;
      look(rig, b, 0.6);
    } else if (t < 3.9) {
      // Chase it round, swatting.
      cat.group.scale.setScalar(1);
      cat.group.rotation.x = Math.max(0, Math.sin(t * 9)) * 0.25; // swats
      face(rig, b, 0.25);
      rig.pos.set(0, Math.abs(Math.sin(t * 12)) * 0.05, 0);
      look(rig, b);
      const s = t % 0.9;
      if (s < 0.4) rig.once(`swat${Math.floor(t / 0.9)}`, sfx.swat);
      swat.visible = s < 0.4;
      swat.position.set(b.x, 0.7 + s, b.z);
      swat.material.opacity = 1 - s / 0.4;
      cat.tail.rotation.z = Math.sin(t * 10) * 0.4;
    } else if (t < 4.4) {
      // Final pounce: land on the ball and grab it.
      swat.visible = false;
      rig.once("leap", () => sfx.whoosh());
      const u = phase(t, 3.9, 4.35);
      const end = b.clone().multiplyScalar(0.55).setY(0);
      face(rig, b, 0.3);
      rig.pos.copy(hop(start, end, 0.5, u));
      cat.group.rotation.x = Math.sin(u * Math.PI) * 0.3;
    } else {
      // Hug the ball, purr, then hop home as the yarn vanishes.
      const home = phase(t, 5.4, 5.9);
      const spot = ballAt(3.9).multiplyScalar(0.55).setY(0);
      rig.pos.copy(spot.lerp(new THREE.Vector3(), home));
      cat.group.rotation.x = 0;
      face(rig, new THREE.Vector3(0, 0, 50), 0.1);
      cat.head.rotation.set(0.15, 0, Math.sin(t * 2) * 0.1);
      ball.position.copy(rig.pos).add(new THREE.Vector3(0, R, 0.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), cat.group.rotation.y));
      ball.scale.setScalar(1 - home);
      threadMat.opacity = 1 - home;
      cat.tail.rotation.z = Math.sin(t * 4) * 0.3;
      cat.tail.rotation.x = -1.3;
      celebrate(cat, t, 4.5, 6, rig.pos.clone());
    }
    cat.group.position.copy(rig.pos).add(rig.p0);
    return 6;
  };
}

// ---------------------------------------------------------------------------
// Feather wand: a wand dangles a bunch of feathers that swing about. The cat
// tracks it, rears up to bat at it, then leaps and catches it in its mouth.
// ---------------------------------------------------------------------------
function feather(rig: Rig, celebrate: ReturnType<typeof celebration>, it: ShopItem = BY_ID["feather-wand"]!): (t: number) => number {
  const { cat, fx } = rig;
  const HANDLE = new THREE.Vector3(1.4, 2.8, 1.6);
  const stick = rod(0.03, 0xd4a017);
  const string = rod(0.008, 0xffffff);
  fx.add(stick, string);
  const plume = new THREE.Group();
  const feathers = it.id === "rainbow-wand" ? [0xe74c3c, 0xf39c12, 0xf1c40f, 0x2ecc71, 0x3498db, 0x9b59b6]
    : it.id === "butterfly-wand" ? [it.color ?? 0x4ecdc4, 0xffd23f, it.color ?? 0x4ecdc4, 0xffd23f]
    : it.id === "ghost-wand" ? [0xffffff, 0xdde8ff, 0xffffff, 0xff9a3a]
    : [0xff6b9a, 0x4ecdc4, 0xffd23f, 0x9b59b6];
  feathers.forEach((c, i) => {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(c));
    f.scale.set(0.5, 3, 1.2);
    f.geometry.translate(0, -0.05, 0);
    f.position.y = -0.1;
    f.rotation.z = (i - (feathers.length - 1) / 2) * 0.35;
    plume.add(f);
  });
  plume.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(0xffffff)));
  plume.traverse((o) => { o.castShadow = true; });
  fx.add(plume);
  const boing = floater("boing!", "#ffffff", 0.2);
  boing.visible = false;
  fx.add(boing);

  // Where the feathers dangle: drop in, swing about, zip away when grabbed.
  const featherAt = (t: number) => {
    const drop = phase(t, 0, 0.6);
    return new THREE.Vector3(Math.sin(t * 3) * 0.55, 1.05 + Math.sin(t * 4.7) * 0.3 + (1 - drop) * 2.5, 0.75 + Math.sin(t * 2.1) * 0.15);
  };

  return (t) => {
    const leave = phase(t, 5.2, 5.8);
    const handle = HANDLE.clone().add(new THREE.Vector3(0, leave * 3, 0));
    let f = featherAt(t);
    const caught = t > 4.1;
    if (caught) {
      // Held in the cat's mouth.
      f = cat.head.localToWorld(new THREE.Vector3(0, 0.08, 0.42)).sub(rig.p0);
    }
    // Wand points from the handle toward the feathers (a third of the way).
    const tip = handle.clone().lerp(f, 0.35);
    stretch(stick, handle, tip, rig.p0);
    stretch(string, tip, f, rig.p0);
    string.visible = !caught;
    plume.position.copy(f);
    plume.rotation.z = Math.sin(t * 9) * 0.4;
    plume.visible = leave < 1;

    if (t < 1.2) {
      // Eyes lock on, tail twitches.
      look(rig, f);
      cat.tail.rotation.z = Math.sin(t * 18) * 0.35;
      rig.pos.set(0, 0, 0);
    } else if (t < 3.8) {
      // Rear up and bat at it, again and again.
      const s = Math.max(0, Math.sin((t - 1.2) * 7));
      cat.group.rotation.x = -0.4 * s;
      rig.pos.set(0, 0.18 * s, 0);
      face(rig, f, 0.2);
      look(rig, f);
      cat.tail.rotation.z = Math.sin(t * 8) * 0.4;
      const b = (t - 1.2) % (2 * Math.PI / 7);
      if (s > 0.9) rig.once(`bat${Math.floor((t - 1.2) / (2 * Math.PI / 7))}`, sfx.boing);
      boing.visible = s > 0.9 && b < 0.4;
      boing.position.set(f.x, f.y + 0.3, f.z);
    } else if (t < 4.5) {
      // The big leap.
      boing.visible = false;
      rig.once("leap", () => sfx.whoosh(0.25));
      if (t > 4.1) rig.once("catch", () => sfx.meow("short"));
      const u = phase(t, 3.8, 4.45);
      const target = featherAt(4.1).setY(0).multiplyScalar(0.5);
      face(rig, target, 0.3);
      rig.pos.copy(hop(new THREE.Vector3(), target, 0.9, u));
      cat.group.rotation.x = -0.5 * Math.sin(u * Math.PI);
      look(rig, featherAt(4.1), 0.8);
    } else {
      // Proud, feather in mouth, purring; then trot back.
      const home = phase(t, 5.5, 6.0);
      const spot = featherAt(4.1).setY(0).multiplyScalar(0.5);
      rig.pos.copy(spot.lerp(new THREE.Vector3(), home));
      cat.group.rotation.x = 0;
      face(rig, new THREE.Vector3(0, 0, 50), 0.1);
      cat.head.rotation.set(-0.15, 0, 0);
      cat.tail.rotation.x = -1.3;
      cat.tail.rotation.z = Math.sin(t * 3) * 0.3;
      celebrate(cat, t, 4.6, 6.1, rig.pos.clone());
    }
    cat.group.position.copy(rig.pos).add(rig.p0);
    return 6.1;
  };
}

// ---------------------------------------------------------------------------
// Laser dot: zips around the ground; the cat follows it with its whole body,
// pounces three times and always just misses, then it vanishes. "?"
// ---------------------------------------------------------------------------
function laser(rig: Rig, celebrate: ReturnType<typeof celebration>, it: ShopItem = BY_ID["laser-dot"]!): (t: number) => number {
  const { cat, fx } = rig;
  const dot = new THREE.Group();
  dot.add(new THREE.Mesh(new THREE.CircleGeometry(0.035, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff })));
  const beam = it.color ?? 0xff2020;
  const glowMat = new THREE.MeshBasicMaterial({ color: beam, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  dot.add(new THREE.Mesh(new THREE.CircleGeometry(0.09, 20).rotateX(-Math.PI / 2), glowMat));
  dot.add(new THREE.Mesh(new THREE.CircleGeometry(0.18, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: beam, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false })));
  const red = new THREE.PointLight(beam, 1.5, 1.2, 2);
  red.position.y = 0.1;
  dot.add(red);
  dot.position.y = 0.025;
  fx.add(dot);
  const huh = floater("?", "#ffffff", 0.45);
  huh.visible = false;
  fx.add(huh);

  const POUNCES = [1.5, 2.6, 3.6];
  // Lissajous wander, with a quick dart away just as each pounce lands.
  const dotAt = (t: number) => {
    let s = t * 1.0;
    for (const p of POUNCES) s += phase(t, p + 0.3, p + 0.45) * 1.2;
    return new THREE.Vector3(Math.sin(s * 2.3) * 1.3, 0, 0.9 + Math.sin(s * 3.1 + 1) * 0.6);
  };

  let from = new THREE.Vector3(), to = new THREE.Vector3(), lastP = -1;
  return (t) => {
    const d = dotAt(t);
    dot.position.set(d.x, 0.025, d.z);
    dot.visible = t < 4.4;
    glowMat.opacity = 0.6 + Math.sin(t * 40) * 0.15;

    if (t < 4.4) {
      // Pounce: hop most of the way to where the dot is, then come back.
      const p = POUNCES.findIndex((p0) => t >= p0 && t < p0 + 0.85);
      for (const p0 of POUNCES) if (t > p0 + 0.3) rig.once(`zip${p0}`, sfx.zip);
      if (p >= 0 && p !== lastP) {
        sfx.whoosh();
        lastP = p;
        from = rig.pos.clone().setY(0);
        to = d.clone().multiplyScalar(0.6);
      }
      if (p >= 0) {
        const u = phase(t, POUNCES[p]!, POUNCES[p]! + 0.4), back = phase(t, POUNCES[p]! + 0.5, POUNCES[p]! + 0.85);
        rig.pos.copy(hop(from, to, 0.45, u)).lerp(new THREE.Vector3(), back);
        cat.group.rotation.x = Math.sin(u * Math.PI) * 0.35;
        cat.group.scale.setScalar(1);
      } else {
        // Crouch and wiggle while tracking.
        rig.pos.set(0, 0, 0);
        cat.group.rotation.x = 0;
        cat.group.scale.set(1, 0.9, 1.05);
        cat.group.rotation.z = Math.sin(t * 30) * 0.04;
        face(rig, d, 0.2);
      }
      look(rig, d);
      cat.tail.rotation.z = Math.sin(t * 20) * 0.45;
    } else {
      // Where did it go? Look left, look right… then decide that was fun.
      rig.pos.set(0, 0, 0);
      cat.group.scale.setScalar(1);
      cat.group.rotation.set(0, cat.group.rotation.y, 0);
      face(rig, new THREE.Vector3(0, 0, 50), 0.08);
      const a = t - 4.4;
      rig.once("huh", () => sfx.meow("curious"));
      huh.visible = a < 1.3;
      huh.position.set(0.35, 1.55 + Math.sin(a * 6) * 0.05, 0);
      huh.material.opacity = Math.min(1, a * 5) * (1 - Math.max(0, a - 1) / 0.3);
      cat.head.rotation.set(-0.1, a < 1.3 ? Math.sin(a * 5) * 0.6 : 0, a < 1.3 ? Math.sin(a * 5) * 0.15 : 0);
      cat.tail.rotation.z = Math.sin(t * 3) * 0.3;
      if (a > 1.3) cat.tail.rotation.x = -1.3;
      celebrate(cat, t, 5.8, 7.2);
    }
    cat.group.position.copy(rig.pos).add(rig.p0);
    return 7.2;
  };
}

// ---------------------------------------------------------------------------
// Petting: tap Boabosh. Leans into the hand, eyes shut, purrs.
// ---------------------------------------------------------------------------
function pet(rig: Rig, celebrate: ReturnType<typeof celebration>): (t: number) => number {
  const { cat, fx } = rig;
  const hand = floater("✋", "#ffffff", 0.35);
  fx.add(hand);
  return (t) => {
    const stroke = Math.sin(t * 5);
    hand.position.set(stroke * 0.12, 1.45 - Math.abs(stroke) * 0.05, 0.15);
    hand.material.opacity = Math.min(1, t * 5) * (1 - phase(t, 2.2, 2.6));
    cat.head.rotation.set(-0.1, 0, 0.25 + stroke * 0.08); // leans into the stroke
    cat.group.rotation.z = stroke * 0.04;
    cat.tail.rotation.x = -1.3;
    cat.tail.rotation.z = Math.sin(t * 3) * 0.35;
    rig.pos.set(0, 0, 0);
    celebrate(cat, t, 0.15, 3);
    cat.group.position.copy(rig.pos).add(rig.p0);
    return 3;
  };
}

// ---------------------------------------------------------------------------
// Quiz reactions: a happy hop, a puzzled head tilt, a victory spin + confetti.
// ---------------------------------------------------------------------------
// Rotates so a run of right answers doesn't repeat the same move every time.
let cheerCount = 0;
const CHEERS = ["Yay!", "Purr-fect!", "Paw-some!", "Great job!", "You did it!", "Meow-velous!", "So smart!", "Hooray!"];
const ENCOURAGE = ["Nice try!", "Almost!", "You can do it!", "Keep going!", "Let's try again!"];
const pick = <T>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]!;

/** Gold stars bursting out round the cat. Returns a per-frame update. */
function starBurst(fx: THREE.Group, n = 10, at = 0.15) {
  const stars = Array.from({ length: n }, (_, i) => {
    const s = floater(i % 3 ? "★" : "✦", i % 2 ? "#ffd23f" : "#fff3a0", 0.2);
    const a = (i / n) * Math.PI * 2;
    s.userData.dir = new THREE.Vector3(Math.cos(a), 0.6 + Math.random() * 0.6, Math.sin(a) * 0.5);
    s.visible = false;
    fx.add(s);
    return s;
  });
  return (t: number) => stars.forEach((s) => {
    const a = t - at;
    s.visible = a > 0 && a < 1;
    if (!s.visible) return;
    const d = s.userData.dir as THREE.Vector3;
    s.position.set(d.x * a * 1.4, 1.0 + d.y * a * 1.4, 0.3 + d.z * a);
    s.material.opacity = 1 - a;
    s.material.rotation = a * 6;
  });
}

/** A floating word that pops in big and drifts up. */
function cheerWord(fx: THREE.Group, text: string, colour: string, start: number, end: number) {
  const w = floater(text, colour, 0.36, true);
  w.visible = false;
  fx.add(w);
  return (t: number) => {
    const a = t - start;
    w.visible = a > 0 && t < end;
    if (!w.visible) return;
    const pop = a < 0.15 ? a / 0.15 * 1.25 : 1.25 - Math.min(0.25, (a - 0.15) * 2); // overshoot, settle
    w.scale.set(0.36 * 4 * pop, 0.36 * pop, 1);
    w.position.set(0, 2.25 + a * 0.2, 0.2); // above the head even at the top of a jump
    w.material.opacity = Math.min(1, (end - t) * 4);
  };
}

// Right answer: one of four celebrations, all with happy eyes, stars and a cheer word.
function cheer(rig: Rig): (t: number) => number {
  const { cat, fx } = rig;
  const move = cheerCount++ % 4;
  const stars = starBurst(fx);
  const word = cheerWord(fx, pick(CHEERS), "#fff6d6", 0.1, 1.6);
  const ry0 = cat.group.rotation.y;
  rig.once("meow", () => sfx.meow("happy", 0.2));
  return (t) => {
    const happy = t > 0.05 && t < 1.5;
    cat.eyes.forEach((e) => { e.visible = !happy; });
    cat.lids.forEach((l) => { l.visible = happy; });
    cat.tail.rotation.x = -1.35;
    cat.tail.rotation.z = Math.sin(t * 10) * 0.45;
    stars(t);
    word(t);
    if (move === 0) {
      // Big star jump: crouch, spring up stretched tall, land squashed.
      const crouch = phase(t, 0, 0.15) * (1 - phase(t, 0.15, 0.25));
      const u = phase(t, 0.2, 0.75);
      const land = phase(t, 0.75, 0.85) * (1 - phase(t, 0.85, 1.05));
      rig.pos.set(0, Math.sin(Math.PI * u) * 0.6, 0);
      cat.group.scale.set(1 + land * 0.12, 1 - crouch * 0.15 + Math.sin(Math.PI * u) * 0.12 - land * 0.12, 1);
      cat.head.rotation.set(-0.25 * Math.sin(Math.PI * u), 0, 0);
    } else if (move === 1) {
      // Spin hop.
      const u = phase(t, 0.1, 0.8);
      if (t > 0.1) rig.once("spin", () => sfx.whoosh(0.15));
      rig.pos.set(0, Math.sin(Math.PI * u) * 0.45, 0);
      cat.group.rotation.y = ry0 + u * Math.PI * 2;
    } else if (move === 2) {
      // Happy dance: sway side to side, bouncing, head bopping.
      const on = 1 - phase(t, 1.3, 1.5);
      cat.group.rotation.z = Math.sin(t * 9) * 0.14 * on;
      rig.pos.set(Math.sin(t * 9) * 0.06 * on, Math.abs(Math.sin(t * 9)) * 0.12 * on, 0);
      cat.head.rotation.set(0, 0, -Math.sin(t * 9) * 0.2 * on);
    } else {
      // Double hop.
      const h1 = phase(t, 0.05, 0.4), h2 = phase(t, 0.45, 0.9);
      rig.pos.set(0, Math.sin(Math.PI * h1) * 0.3 + Math.sin(Math.PI * h2) * 0.45, 0);
      cat.group.rotation.x = -Math.sin(Math.PI * h2) * 0.2;
    }
    cat.group.position.copy(rig.pos).add(rig.p0);
    return 1.6;
  };
}

// Wrong answer, kid-friendly: never sad. A puzzled head tilt, then an
// encouraging nod, a little hop and a heart: "You can do it!"
function oops(rig: Rig): (t: number) => number {
  const { cat, fx } = rig;
  const q = floater("?", "#ffffff", 0.4);
  const heart = floater("♥", "#ff7a9a", 0.3);
  fx.add(q, heart);
  const word = cheerWord(fx, pick(ENCOURAGE), "#dff4ff", 1.0, 2.5);
  return (t) => {
    // 1. Hmm? Head tilts, "?" bobs.
    const tilt = phase(t, 0, 0.25) * (1 - phase(t, 0.9, 1.1));
    cat.head.rotation.set(0.05, 0, 0.38 * tilt);
    q.position.set(0.4, 1.5 + Math.sin(t * 6) * 0.04, 0);
    q.material.opacity = tilt;
    // 2. Nod-nod ("that's OK!"), a hop, a heart.
    if (t > 1.0) rig.once("encourage", () => sfx.meow("short"));
    const nod = t > 1.0 && t < 1.7 ? Math.max(0, Math.sin((t - 1.0) * 18)) * 0.25 : 0;
    if (t > 1.0) cat.head.rotation.x = nod;
    const u = phase(t, 1.75, 2.1);
    rig.pos.set(0, Math.sin(Math.PI * u) * 0.25, 0);
    const ha = t - 1.8;
    heart.visible = ha > 0 && ha < 0.8;
    heart.position.set(-0.3, 1.4 + ha * 0.6, 0.2);
    heart.material.opacity = 1 - ha / 0.8;
    word(t);
    cat.tail.rotation.x = t > 1.0 ? -1.25 : -0.9;
    cat.tail.rotation.z = Math.sin(t * (t > 1 ? 8 : 2)) * 0.3;
    cat.group.position.copy(rig.pos).add(rig.p0);
    return 2.5;
  };
}

function victory(rig: Rig, celebrate: ReturnType<typeof celebration>): (t: number) => number {
  const { cat, fx } = rig;
  const cols = [0xff6b6b, 0xffd23f, 0x4ecdc4, 0x9b59b6, 0x2ecc71, 0xff9ff3, 0x54a0ff];
  const noLine = { visible: false };
  const bits = Array.from({ length: 70 }, (_, i) => {
    const m = mat(cols[i % cols.length]!, { side: THREE.DoubleSide });
    m.userData.outlineParameters = noLine;
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.12), m);
    const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 1.6;
    b.userData.v = new THREE.Vector3(Math.cos(a) * sp, 3 + Math.random() * 2.5, Math.sin(a) * sp);
    b.userData.spin = new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9);
    b.visible = false;
    fx.add(b);
    return b;
  });
  const ry0 = cat.group.rotation.y;
  return (t) => {
    // Crouch, then a big spinning jump.
    const crouch = phase(t, 0, 0.25) * (1 - phase(t, 0.25, 0.35));
    const u = phase(t, 0.35, 1.15);
    if (t > 0.35) rig.once("jump", () => sfx.whoosh(0.25));
    rig.pos.set(0, Math.sin(Math.PI * u) * 0.9, 0);
    cat.group.scale.set(1, 1 - crouch * 0.15, 1);
    cat.group.rotation.y = ry0 + u * Math.PI * 2;
    cat.tail.rotation.x = -0.9 - u * 0.5;
    // Confetti bursts at the top of the jump and flutters down.
    bits.forEach((b) => {
      const a = t - 0.75;
      b.visible = a > 0 && a < 3.2;
      if (!b.visible) return;
      const v = b.userData.v as THREE.Vector3, sp = b.userData.spin as THREE.Vector3;
      // Thrown up, then gravity until air drag caps the fall at a gentle flutter.
      const a1 = (v.y + 0.6) / 6;
      const y = a < a1 ? v.y * a - 3 * a * a : v.y * a1 - 3 * a1 * a1 - 0.6 * (a - a1);
      b.position.set(v.x * a * 0.8 + Math.sin(a * 4 + v.x) * 0.1, Math.max(0.02, 1.6 + y), v.z * a * 0.8);
      b.rotation.set(sp.x * a, sp.y * a, sp.z * a);
    });
    celebrate(cat, t, 1.2, 4.2);
    cat.group.position.copy(rig.pos).add(rig.p0);
    return 4.2;
  };
}

// ---------------------------------------------------------------------------
// Care at home: drinking, napping in bed, brushing, and scooping the litter.
// ---------------------------------------------------------------------------

/** Laps water from the bowl in front of it: tongue flicks, ripples, "lap". */
function drink(rig: Rig, celebrate: ReturnType<typeof celebration>): (t: number) => number {
  const { cat, fx } = rig;
  const fwd = new THREE.Vector3(Math.sin(cat.group.rotation.y), 0, Math.cos(cat.group.rotation.y));
  const bowlAt = fwd.clone().multiplyScalar(0.55).setY(0.13);
  const ripples = [0, 1, 2].map(() => {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.045, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
    r.position.copy(bowlAt);
    fx.add(r);
    return r;
  });
  const laps = [0, 1, 2].map(() => { const f = floater("lap", "#bfe9ff", 0.18); f.visible = false; fx.add(f); return f; });
  return (t) => {
    const down = phase(t, 0.1, 0.5) * (1 - phase(t, 3.0, 3.4));
    cat.group.rotation.x = down * 0.4;
    cat.head.rotation.x = down * 0.7 + (t > 0.5 && t < 3 ? Math.abs(Math.sin(t * 9)) * 0.08 : 0);
    const lapping = t > 0.5 && t < 3;
    cat.tongue.visible = lapping && Math.sin(t * 18) > 0.2;
    if (lapping) rig.once(`lap${Math.floor(t * 2.6)}`, sfx.lap);
    ripples.forEach((r, i) => {
      const a = ((t * 1.3 + i / 3) % 1);
      r.visible = lapping;
      r.scale.setScalar(1 + a * 4);
      (r.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - a);
    });
    laps.forEach((l, i) => {
      const a = t - (0.8 + i * 0.8);
      l.visible = a > 0 && a < 0.8;
      l.position.set(bowlAt.x + (i - 1) * 0.25, 1.0 + a * 0.5, bowlAt.z * 0.3);
      l.material.opacity = 1 - a / 0.8;
    });
    if (t > 3.3) rig.once("lick", () => sfx.meow("short"));
    celebrate(cat, t, 3.5, 5.2);
    rig.pos.set(0, 0, 0);
    cat.group.position.copy(rig.pos).add(rig.p0);
    return 5.2;
  };
}

/** Hops into bed, curls up, snoozes with Zzz, then stretches and hops out. */
const nap = (bed: THREE.Vector3, top: number): Maker => (rig) => {
  const { cat, fx } = rig;
  const inBed = bed.clone().sub(rig.p0).setY(0);
  const zs = [0, 1, 2].map((i) => { const z = floater(i === 1 ? "z" : "Z", "#dfe8ff", 0.22 + i * 0.05); z.visible = false; fx.add(z); return z; });
  const ry0 = cat.group.rotation.y;
  return (t) => {
    const hopIn = phase(t, 0.2, 0.75), hopOut = phase(t, 7.4, 7.95);
    const sleeping = t > 0.9 && t < 7.0;
    if (t > 0.2) rig.once("in", () => sfx.whoosh(0.12));
    if (t > 7.4) rig.once("out", () => sfx.whoosh(0.12));
    const p = hop(new THREE.Vector3(), inBed, 0.6, hopIn).add(new THREE.Vector3(0, top * hopIn, 0));
    if (hopOut > 0) p.copy(hop(inBed, new THREE.Vector3(), 0.6, hopOut)).add(new THREE.Vector3(0, top * (1 - hopOut), 0));
    rig.pos.copy(p);
    // Curl up: lower and longer, head down on the paws, tail wrapped round.
    const curl = phase(t, 0.8, 1.3) * (1 - phase(t, 6.6, 7.0));
    cat.group.scale.set(1 + curl * 0.08, 1 - curl * 0.3, 1 + curl * 0.1);
    cat.group.rotation.y = ry0 + curl * 0.6;
    cat.head.rotation.set(curl * 0.55, 0, curl * 0.25);
    cat.tail.rotation.x = -0.9 + curl * 0.6;
    cat.tail.rotation.z = curl * 1.1 + Math.sin(t * 0.8) * 0.05;
    const closed = sleeping;
    cat.eyes.forEach((e) => { e.visible = !closed; });
    cat.lids.forEach((l) => { l.visible = closed; });
    // Breathing while asleep.
    if (sleeping) cat.group.scale.y *= 1 + Math.sin(t * 2.2) * 0.025;
    if (sleeping) rig.once(`snore${Math.floor((t - 1) / 2.4)}`, sfx.snore);
    zs.forEach((z, i) => {
      const a = ((t - 1.2) * 0.45 + i / 3) % 1;
      z.visible = sleeping && t > 1.2;
      z.position.set(inBed.x + 0.3 + a * 0.5, 0.9 + top + a * 0.9, inBed.z);
      z.material.opacity = Math.sin(a * Math.PI);
    });
    // Waking: a big stretch and a yawn.
    const stretch = phase(t, 7.0, 7.2) * (1 - phase(t, 7.2, 7.4));
    if (stretch > 0) { cat.group.scale.set(1, 1 + stretch * 0.15, 1 + stretch * 0.1); cat.tongue.visible = true; rig.once("yawn", () => sfx.meow("sleepy")); }
    else if (t > 7.4) cat.tongue.visible = false;
    cat.group.position.copy(rig.pos).add(rig.p0);
    return 8.0;
  };
};

/** A brush strokes down the back; fur sparkles; purring. */
function brush(rig: Rig, celebrate: ReturnType<typeof celebration>): (t: number) => number {
  const { cat, fx } = rig;
  const b = new THREE.Group();
  b.add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.32), mat(0xc0643a)));
  b.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.3), mat(0xfff0d0)), 0, -0.05, 0));
  b.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.32, 8).rotateX(Math.PI / 2), mat(0xc0643a)), 0, 0.02, 0.3));
  fx.add(b);
  const sparkles = Array.from({ length: 8 }, () => { const s = floater("✦", "#fff6c0", 0.14); s.visible = false; fx.add(s); return s; });
  const toWorld = (v: THREE.Vector3) => v.applyAxisAngle(new THREE.Vector3(0, 1, 0), cat.group.rotation.y);
  return (t) => {
    const u = (t * 0.8) % 1; // one stroke per 1.25 s, head to tail
    const along = toWorld(new THREE.Vector3(0, 0, 0.25 - u * 0.65));
    b.position.set(along.x, 0.86 - u * 0.12 + Math.sin(u * Math.PI) * 0.03, along.z);
    b.rotation.y = cat.group.rotation.y;
    b.visible = t < 3.8;
    if (t < 3.8) rig.once(`stroke${Math.floor(t * 0.8)}`, sfx.brush);
    sparkles.forEach((s, i) => {
      const a = (t * 0.9 + i / 8) % 1;
      s.visible = t > 0.4 && t < 4;
      const p = toWorld(new THREE.Vector3(Math.sin(i * 2.4) * 0.35, 0, 0.2 - (i / 8) * 0.6));
      s.position.set(p.x, 0.5 + a * 0.6, p.z);
      s.material.opacity = Math.sin(a * Math.PI);
    });
    cat.head.rotation.set(-0.15, 0, Math.sin(t * 2) * 0.12);
    cat.tail.rotation.x = -1.3;
    celebrate(cat, t, 0.3, 4.8);
    rig.pos.set(0, 0, 0);
    cat.group.position.copy(rig.pos).add(rig.p0);
    return 4.8;
  };
}

/** Scoop the litter: the scoop dips in, lifts out clumps into a bag, sparkle. The cat watches. */
const scoop = (tray: THREE.Vector3): Maker => (rig) => {
  const { cat, fx } = rig;
  const local = tray.clone().sub(rig.p0);
  const tool = new THREE.Group();
  tool.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.25), mat(0x2ecc71)));
  tool.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 6).rotateZ(Math.PI / 2 - 0.4), mat(0x27ae60)), 0.3, 0.1, 0));
  const lump = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(0x8a6a4a));
  lump.position.y = 0.04;
  tool.add(lump);
  fx.add(tool);
  const bag = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.45, 12), mat(0x3a4656));
  bag.position.copy(local).add(new THREE.Vector3(-0.9, 0.22, 0.6));
  fx.add(bag);
  const sparkle = Array.from({ length: 10 }, () => { const s = floater("✨", "#ffffff", 0.18); s.visible = false; fx.add(s); return s; });
  return (t) => {
    const cyc = Math.min(2, Math.floor(t / 1.1)), u = (t % 1.1) / 1.1; // three scoops
    const dig = local.clone().add(new THREE.Vector3(-0.2 + cyc * 0.2, 0, -0.1 + cyc * 0.1));
    const dump = bag.position.clone().add(new THREE.Vector3(0, 0.3, 0));
    const p = u < 0.4 ? dig.clone().setY(0.6 - Math.sin((u / 0.4) * Math.PI) * 0.35) : dig.clone().setY(0.6).lerp(dump, (u - 0.4) / 0.6);
    tool.position.copy(p);
    tool.rotation.z = u < 0.4 ? 0.2 : -0.3;
    lump.visible = u > 0.25 && u < 0.9 && t < 3.3;
    tool.visible = t < 3.3;
    if (t < 3.3 && u > 0.1) rig.once(`dig${cyc}`, sfx.scoop);
    sparkle.forEach((s, i) => {
      const a = t - 3.3 - i * 0.05;
      s.visible = a > 0 && a < 0.9;
      s.position.set(local.x + Math.sin(i * 2.1) * 0.5, 0.4 + a * 0.8, local.z + Math.cos(i * 2.1) * 0.35);
      s.material.opacity = 1 - a / 0.9;
    });
    if (t > 3.3) rig.once("clean", sfx.sparkle);
    // The cat watches, then approves.
    look(rig, local.clone().setY(0.3), 0.8);
    cat.tail.rotation.z = Math.sin(t * 3) * 0.3;
    rig.pos.set(0, 0, 0);
    cat.group.position.copy(rig.pos).add(rig.p0);
    if (t > 3.5) rig.once("ok", () => sfx.meow("short"));
    return 4.4;
  };
};

/** Rears up at the scratching post and scratches away: "scritch!", wood shavings, then a happy purr. */
function scratch(rig: Rig, celebrate: ReturnType<typeof celebration>): (t: number) => number {
  const { cat, fx } = rig;
  const fwd = new THREE.Vector3(Math.sin(cat.group.rotation.y), 0, Math.cos(cat.group.rotation.y));
  const post = fwd.clone().multiplyScalar(0.62);
  const bits = Array.from({ length: 14 }, () => {
    const b = new THREE.Mesh(new THREE.TetrahedronGeometry(0.025), mat(0xd9c08a));
    b.visible = false;
    fx.add(b);
    return { b, born: -1, v: new THREE.Vector3() };
  });
  const words = [0, 1, 2].map(() => { const w = floater("scritch!", "#fff6d6", 0.18, true); w.visible = false; fx.add(w); return w; });
  let next = 0;
  return (t) => {
    const up = phase(t, 0, 0.35) * (1 - phase(t, 2.9, 3.2));
    const scratching = t > 0.35 && t < 2.9;
    cat.group.rotation.x = -0.45 * up; // up on the back legs
    cat.group.rotation.z = scratching ? Math.sin(t * 16) * 0.07 : 0; // left paw, right paw
    rig.pos.copy(fwd.clone().multiplyScalar(0.12 * up)).setY(0.12 * up);
    cat.head.rotation.set(-0.2 * up, 0, scratching ? Math.sin(t * 16) * 0.12 : 0);
    cat.tail.rotation.z = Math.sin(t * 6) * 0.35;
    if (scratching && t > next) { // a stroke: sound + shavings
      next = t + 0.22;
      sfx.scratch();
      bits.filter((x) => x.born < 0 || t - x.born > 0.8).slice(0, 3).forEach((x) => {
        x.born = t;
        x.b.visible = true;
        x.v.set((Math.random() - 0.5) * 0.8, 0.4 + Math.random() * 0.4, (Math.random() - 0.5) * 0.8).addScaledVector(fwd, -0.6);
      });
    }
    bits.forEach((x) => {
      if (x.born < 0) return;
      const a = t - x.born;
      x.b.position.set(post.x + x.v.x * a, Math.max(0.02, 0.75 + x.v.y * a - 3 * a * a), post.z + x.v.z * a);
      x.b.rotation.set(a * 8, a * 5, 0);
    });
    words.forEach((w, i) => {
      const a = t - (0.5 + i * 0.75);
      w.visible = a > 0 && a < 0.7;
      w.position.set(post.x + (i - 1) * 0.3, 1.3 + a * 0.5, post.z);
      w.material.opacity = 1 - a / 0.7;
    });
    celebrate(cat, t, 3.2, 4.8);
    cat.group.position.copy(rig.pos).add(rig.p0);
    return 4.8;
  };
}

type Maker = (rig: Rig, celebrate: ReturnType<typeof celebration>) => (t: number) => number;
const PLAY_STYLES: Record<string, (rig: Rig, c: ReturnType<typeof celebration>, it: ShopItem) => (t: number) => number> = {
  yarn, mouse: yarn, ball: yarn, feather, laser,
};
const MOVES: Record<"pet" | "cheer" | "oops" | "victory" | "drink" | "brush" | "scratch", Maker> = { pet, cheer, oops, victory, drink, brush, scratch };

/** Start playing with a toy at clock time `t0`. */
export function startPlay(cat: Cat, toy: string, t0: number) {
  const it = BY_ID[toy];
  const make = it?.style ? PLAY_STYLES[it.style] : undefined;
  return it && make ? run(cat, (rig, c) => make(rig, c, it), t0) : null;
}
export const startNap = (cat: Cat, bed: THREE.Vector3, top: number, t0: number) => run(cat, nap(bed, top), t0);
export const startScoop = (cat: Cat, tray: THREE.Vector3, t0: number) => run(cat, scoop(tray), t0);
/** Petting, or a reaction to a quiz answer. */
export const startMove = (cat: Cat, move: keyof typeof MOVES, t0: number) => run(cat, MOVES[move], t0);

function run(cat: Cat, make: Maker, t0: number): Activity {
  const fx = new THREE.Group();
  const p0 = cat.group.position.clone().setY(0);
  fx.position.copy(p0);
  cat.group.parent!.add(fx);
  const played = new Set<string>();
  const once = (k: string, play: () => void) => { if (!played.has(k)) { played.add(k); play(); } };
  const rig: Rig = { cat, fx, p0, pos: new THREE.Vector3(), once };
  const step = make(rig, celebration(fx));
  return {
    update(now) {
      const t = now - t0;
      // update(Infinity) = stop now: skip the step so no stray sounds fire.
      if (Number.isFinite(t) && t < step(t)) return true;
      dispose(fx);
      resetCat(cat);
      cat.group.position.copy(p0);
      // Spins and chases can wind the heading past ±π; unwrap so the idle turn doesn't spin it back.
      cat.group.rotation.y = Math.atan2(Math.sin(cat.group.rotation.y), Math.cos(cat.group.rotation.y));
      return false;
    },
  };
}
