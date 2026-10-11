// Feeding animation: a bowl appears, a fish drops in, the cat eats it in
// bites, licks its lips, closes its eyes and purrs with hearts floating up.

import * as THREE from "three";
import type { Cat } from "./cat.ts";
import { mat, label, at } from "./world.ts";
import * as sfx from "./sound.ts";

const DURATION = 5.2;

export const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
/** 0→1 over [a, b] seconds. */
export const phase = (t: number, a: number, b: number) => ease((t - a) / (b - a));

function makeFish() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat(0x9fc3d8));
  body.scale.set(0.55, 0.8, 1.6);
  g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mat(0xe8f1f6));
  belly.scale.set(0.5, 0.6, 1.5);
  belly.position.y = -0.03;
  g.add(belly);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.11, 3), mat(0x7fa8c0));
  tail.rotation.x = Math.PI / 2;
  tail.position.z = -0.19;
  g.add(tail);
  for (const x of [-0.05, 0.05]) g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 4), mat(0x111111)), x, 0.02, 0.12));
  g.rotation.y = Math.PI / 2; // lie across the bowl
  return g;
}

function makeBowl() {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.17, 0.13, 18, 1, true), mat(0x3d7cc9, { side: THREE.DoubleSide }));
  outer.position.y = 0.065;
  g.add(outer);
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 18), mat(0x2f62a3)), 0, 0.01, 0));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 6, 20), mat(0x5a96de));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.13;
  g.add(rim);
  // A paw print painted on the side.
  const paw = new THREE.Mesh(new THREE.CircleGeometry(0.035, 10), mat(0xffffff));
  paw.position.set(0, 0.06, 0.205);
  paw.rotation.x = -0.25;
  g.add(paw);
  g.traverse((o) => { o.castShadow = true; });
  return g;
}

/** Floating text/heart that rises and fades. */
export function floater(text: string, colour: string, size: number, wide = false) {
  const w = wide ? 512 : 256;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: label(text, "", colour, w, 128, wide ? 64 : 72), transparent: true, depthWrite: false }));
  s.scale.set(size * (w / 128), size, 1);
  return s;
}

/** A timed animation the main loop runs until `update` returns false. */
export type Activity = { update: (t: number) => boolean };

/** Remove an effects group and free its GPU resources. */
export function dispose(fx: THREE.Object3D) {
  fx.removeFromParent();
  fx.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mats = m.material ? ([] as THREE.Material[]).concat(m.material) : [];
    mats.forEach((x) => { (x as THREE.SpriteMaterial).map?.dispose(); x.dispose(); });
  });
}

/** Put every part an activity may have moved back to rest. */
export function resetCat(cat: Cat) {
  cat.head.rotation.set(0, 0, 0);
  cat.group.rotation.x = 0;
  cat.group.rotation.z = 0;
  cat.group.scale.setScalar(1);
  cat.tongue.visible = false;
  cat.tail.rotation.x = -0.9;
  cat.eyes.forEach((e) => { e.visible = true; });
  cat.lids.forEach((l) => { l.visible = false; });
}

/**
 * Start the eating animation at clock time `t0`. The cat should be standing
 * still; the caller stops walking until `update` returns false.
 */
/** `withBowl` false: at home the cat eats from its real bowl, so don't bring one. */
export function startFeeding(cat: Cat, t0: number, withBowl = true): Activity {
  const root = cat.group.parent!;
  const fx = new THREE.Group(); // bowl + effects, placed in front of the cat
  root.add(fx);

  const bowl = makeBowl();
  if (withBowl) fx.add(bowl);
  const fish = makeFish();
  fx.add(fish);

  // Crumbs that fly out on each bite.
  const crumbs = Array.from({ length: 12 }, () => {
    const c = new THREE.Mesh(new THREE.TetrahedronGeometry(0.02), mat(0xcfe0ea));
    c.visible = false;
    fx.add(c);
    return { m: c, v: new THREE.Vector3(), born: -1 };
  });
  const noms = [floater("nom!", "#ffffff", 0.22), floater("nom!", "#ffffff", 0.22), floater("nom!", "#ffffff", 0.22)];
  const hearts = [0, 1, 2, 3].map(() => floater("♥", "#ff4d6d", 0.3));
  const purr = floater("purrr…", "#fff3c4", 0.28);
  [...noms, ...hearts, purr].forEach((s) => { s.visible = false; fx.add(s); });

  const BITES = [1.25, 1.75, 2.25];
  let bitesDone = 0;
  const played = new Set<string>();
  const once = (k: string, f: () => void) => { if (!played.has(k)) { played.add(k); f(); } };
  sfx.pop();
  sfx.meow("short", 0.15);

  const setEyes = (closed: boolean) => {
    cat.eyes.forEach((e) => { e.visible = !closed; });
    cat.lids.forEach((l) => { l.visible = closed; });
  };

  const finish = () => { dispose(fx); resetCat(cat); };

  return {
    update(now: number) {
      const t = now - t0;
      if (t >= DURATION) { finish(); return false; }

      // Keep the bowl just in front of the cat, wherever it's standing.
      const fwd = new THREE.Vector3(Math.sin(cat.group.rotation.y), 0, Math.cos(cat.group.rotation.y));
      fx.position.copy(cat.group.position).setY(0).addScaledVector(fwd, 0.55);
      fx.rotation.y = cat.group.rotation.y;

      // 1. Bowl pops in with a little overshoot, fish drops into it.
      const pop = phase(t, 0, 0.35);
      const leave = phase(t, DURATION - 0.4, DURATION);
      bowl.scale.setScalar((pop + Math.sin(pop * Math.PI) * 0.25) * (1 - leave));
      const drop = phase(t, 0.25, 0.6);
      fish.position.set(0, 0.16 + (1 - drop) * 1.4, 0);
      fish.rotation.z = (1 - drop) * 2;

      // 2. Head dips into the bowl, chomps, comes back up.
      const down = phase(t, 0.55, 0.9) * (1 - phase(t, 2.6, 2.95));
      const chomping = t > 0.9 && t < 2.6;
      cat.group.rotation.x = down * 0.4; // lean the whole body toward the bowl
      cat.head.rotation.x = down * 0.7 + (chomping ? Math.abs(Math.sin(t * 12)) * 0.12 : 0) - phase(t, 2.95, 3.2) * 0.18 * (1 - leave);

      // Bites: the fish shrinks, crumbs fly, a "nom!" pops up.
      while (bitesDone < BITES.length && t >= BITES[bitesDone]!) {
        crumbs.forEach((c, i) => {
          if (i % 3 !== bitesDone % 3 && bitesDone < 2) return;
          c.born = t;
          c.m.visible = true;
          c.m.position.set(0, 0.2, 0.05);
          c.v.set((Math.random() - 0.5) * 1.2, 1 + Math.random(), (Math.random() - 0.2) * 0.8);
        });
        sfx.crunch();
        noms[bitesDone]!.visible = true;
        noms[bitesDone]!.userData.born = t;
        noms[bitesDone]!.userData.x = (bitesDone - 1) * 0.35;
        bitesDone++;
      }
      fish.scale.setScalar([1, 0.7, 0.4, 0][bitesDone]!);
      fish.visible = bitesDone < 3;
      crumbs.forEach((c) => {
        if (c.born < 0) return;
        const a = t - c.born;
        c.m.position.set(c.v.x * a, 0.2 + c.v.y * a - 4.5 * a * a, 0.05 + c.v.z * a);
        c.m.rotation.set(a * 9, a * 7, 0);
        if (c.m.position.y < 0.02) c.m.visible = false;
      });
      noms.forEach((n) => {
        if (!n.visible) return;
        const a = t - n.userData.born;
        n.position.set(n.userData.x, 1.3 + a * 0.6, -0.3);
        n.material.opacity = 1 - a / 0.8;
        if (a > 0.8) n.visible = false;
      });

      // 3. Lick of the lips, then eyes close happily.
      if (t > 2.95) once("lick", () => sfx.meow("short"));
      if (t > 3.2) once("purr", () => sfx.purr(DURATION - 3.3));
      cat.tongue.visible = t > 2.95 && t < 3.45;
      cat.tongue.position.x = Math.sin((t - 2.95) * 14) * 0.05;
      setEyes(t > 3.2 && t < DURATION - 0.35);

      // 4. Purr: a fast tiny shiver, tail up and swishing, hearts and "purrr…".
      const content = phase(t, 3.1, 3.4) * (1 - leave);
      cat.group.scale.set(1 + Math.sin(t * 45) * 0.012 * content, 1 + Math.sin(t * 45 + 1) * 0.015 * content, 1);
      cat.tail.rotation.x = -0.9 - content * 0.5;
      cat.tail.rotation.z = Math.sin(t * 5) * 0.25;
      hearts.forEach((h, i) => {
        const a = t - (3.2 + i * 0.35);
        h.visible = a > 0 && a < 1.5;
        if (!h.visible) return;
        h.position.set(Math.sin(a * 3 + i) * 0.25 + (i - 1.5) * 0.15, 1.4 + a * 0.9, -0.62);
        h.material.opacity = Math.min(1, a * 4) * (1 - a / 1.5);
        h.scale.set(0.6 * (0.6 + a * 0.4), 0.3 * (0.6 + a * 0.4), 1);
      });
      const pa = t - 3.3;
      purr.visible = pa > 0 && pa < 1.6;
      purr.position.set(0.6, 1.55 + pa * 0.15, -0.62);
      purr.material.opacity = Math.min(1, pa * 3) * (1 - Math.max(0, pa - 1.1) / 0.5);
      return true;
    },
  };
}
