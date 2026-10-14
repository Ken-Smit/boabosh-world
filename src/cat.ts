// Boabosh, modelled on the anime portrait (public/boabosh.jpg) from primitives.
// No asset pipeline, no licensing, no download: swap in a glTF later and only
// this file changes.

import * as THREE from "three";
import { toonMat, type MatParams } from "./toon.ts";
import type { Worn } from "./state.ts";
import { BY_ID, COATS, type Coat } from "./shop.ts";

const mat = (color: number, extra?: MatParams) => toonMat(color, extra);

// Caramel tabby: warm golden-brown fur, chocolate stripes, cream chest and
// muzzle, big green eyes, pink nose, a small smile.
const FUR = 0xc28a52;
const STRIPE = 0x5b3519;
const CREAM = 0xf3e2c3;
const PAW = 0xdfab72;
const PINK = 0xf0a3a8;
const DARK = 0x1c140e;
const LINE = 0x4a2a18;

export type Cat = {
  group: THREE.Group;
  tail: THREE.Mesh;
  head: THREE.Group;
  /** Open-eye meshes, and the happy closed-eye arcs that replace them. */
  eyes: THREE.Mesh[];
  lids: THREE.Mesh[];
  tongue: THREE.Mesh;
  hatSlot: THREE.Group;
  collarSlot: THREE.Group;
  glassesSlot: THREE.Group;
  backSlot: THREE.Group;
  costumeSlot: THREE.Group;
};

/** Partial ring hugging a round part, centred on `facing` (radians, 0 = +z). */
function band(radius: number, arc: number, facing: number, m: THREE.Material, tube = 0.028) {
  const g = new THREE.TorusGeometry(radius, tube, 5, 20, arc);
  g.rotateX(Math.PI / 2);
  // After rotateX the arc runs from +x toward +z; turn its middle to `facing`.
  g.rotateY(arc / 2 - Math.PI / 2 + facing);
  return new THREE.Mesh(g, m);
}

const at = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number) => { o.position.set(x, y, z); return o; };

/** Boabosh by default; the boss cats pass their own coat colours. */
export function makeCat(coat: Coat = COATS.caramel ?? { fur: FUR, stripe: STRIPE }): Cat {
  const group = new THREE.Group();
  group.rotation.order = "YXZ"; // lean (x) happens in the cat's own facing
  const fur = mat(coat.fur), stripe = mat(coat.stripe), cream = mat(coat.cream ?? CREAM);
  const paw = mat(coat.cream ? new THREE.Color(coat.fur).lerp(new THREE.Color(coat.cream), 0.5).getHex() : PAW);
  const pink = mat(PINK), dark = mat(DARK), line = mat(LINE);

  // --- body: plump and round, like the loaf in the picture ---
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.3, 8, 16), fur);
  body.scale.set(1.06, 1, 1.02);
  body.position.y = 0.42;
  group.add(body);

  // Stripes: uneven widths and lengths so they read as fur, not hoops.
  for (const [y, arc, tube] of [[0.22, 1.1, 0.03], [0.32, 1.3, 0.035], [0.43, 1.2, 0.03], [0.53, 1.35, 0.036], [0.63, 1.0, 0.028]] as const) {
    const r = y > 0.6 ? 0.33 : 0.375;
    const s = band(r, Math.PI * arc, Math.PI, stripe, tube);
    s.position.y = y;
    s.scale.x = 1.06;
    group.add(s);
  }
  group.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.52, 0.05), stripe), 0, 0.47, -0.365));

  // Cream chest and belly, the fluffiest bit.
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 12), cream);
  chest.scale.set(1, 1.3, 0.6);
  chest.position.set(0, 0.5, 0.25);
  group.add(chest);

  // --- legs: round haunches, striped front legs, warm light paws ---
  for (const x of [-0.27, 0.27]) {
    const haunch = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), fur);
    haunch.scale.set(0.8, 1, 1.2);
    haunch.position.set(x, 0.2, -0.08);
    group.add(haunch);
    for (const [y, a] of [[0.2, 0.8], [0.3, 0.7]] as const) {
      const hs = band(0.215, Math.PI * a, x < 0 ? -Math.PI / 2 : Math.PI / 2, stripe, 0.024);
      hs.position.set(x, y, -0.08);
      hs.scale.set(0.8, 1, 1.2);
      group.add(hs);
    }
    const backPaw = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), paw);
    backPaw.scale.set(1, 0.6, 1.5);
    backPaw.position.set(x * 0.9, 0.05, 0.1);
    group.add(backPaw);

    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.36, 10), fur);
    leg.position.set(x * 0.58, 0.22, 0.22);
    group.add(leg);
    for (const y of [0.16, 0.25, 0.34]) {
      const ls = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.015, 4, 12, Math.PI * 1.2), stripe);
      ls.rotation.set(Math.PI / 2, 0, -Math.PI * 0.1);
      ls.position.set(x * 0.58, y, 0.22);
      group.add(ls);
    }
    const front = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), paw);
    front.scale.set(1, 0.7, 1.25);
    front.position.set(x * 0.58, 0.055, 0.27);
    group.add(front);
    // Toe lines.
    for (const dx of [-0.03, 0.03]) group.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.03, 0.04), line), x * 0.58 + dx, 0.07, 0.385));
  }

  // --- head: wide cheeks, its own group so it can dip down to eat ---
  const head = new THREE.Group();
  const eyes: THREE.Mesh[] = [], lids: THREE.Mesh[] = [];
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.31, 20, 16), fur);
  skull.scale.set(1.14, 0.95, 1);
  skull.position.set(0, 0.95, 0.08);
  head.add(skull);

  // Fluffy cheek ruffs sticking out sideways.
  for (const side of [-1, 1]) {
    for (const [y, rz, len] of [[0.92, 1.9, 0.14], [0.86, 2.2, 0.12], [0.98, 1.6, 0.1]] as const) {
      const fluff = new THREE.Mesh(new THREE.ConeGeometry(0.05, len, 5), fur);
      fluff.position.set(side * 0.33, y, 0.1);
      fluff.rotation.z = side * -rz;
      head.add(fluff);
    }
  }

  // Forehead: the tabby "M", plus stripes that run back over the crown.
  for (const [x, rz, h] of [[-0.09, 0.3, 0.14], [-0.03, 0.08, 0.1], [0.03, -0.08, 0.1], [0.09, -0.3, 0.14]] as const) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.025, h, 0.03), stripe);
    m.position.set(x, 1.12, 0.33);
    m.rotation.set(-0.6, 0, rz);
    head.add(m);
  }
  for (const x of [-0.12, -0.04, 0.04, 0.12]) {
    const c = new THREE.Mesh(new THREE.TorusGeometry(0.305, 0.017, 4, 14, Math.PI * 0.5), stripe);
    c.rotation.y = Math.PI / 2;
    c.rotation.z = Math.PI * 0.15;
    c.position.set(x, 0.95, 0.08);
    c.scale.setScalar(1 - Math.abs(x) * 0.5);
    head.add(c);
  }
  // Cheek stripes sweeping back from the eyes.
  for (const side of [-1, 1]) {
    for (const [y, rz] of [[0.99, 0.35], [0.93, 0.15], [0.87, -0.05]] as const) {
      const ch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.03), stripe);
      ch.position.set(side * 0.3, y, 0.17);
      ch.rotation.set(0, side * 0.95, side * rz);
      head.add(ch);
    }
  }

  // Ears: big, pink inside, with cream tufts.
  for (const x of [-0.19, 0.19]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.28, 12), fur);
    ear.position.set(x, 1.2, 0.04);
    ear.rotation.z = -x * 0.9;
    ear.scale.z = 0.6;
    head.add(ear);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.2, 10), pink);
    inner.position.set(x * 0.98, 1.18, 0.075);
    inner.rotation.z = -x * 0.9;
    inner.scale.z = 0.4;
    head.add(inner);
    for (const dx of [-0.025, 0.02]) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.12, 4), cream);
      tuft.position.set(x * 0.95 + dx, 1.16, 0.095);
      tuft.rotation.z = -x * 0.9 + dx * 8;
      head.add(tuft);
    }
  }

  // Eyes, anime-sized: dark rim, green iris, big oval pupil, two glints.
  const irisCol = coat.eyes ?? 0x93cc45;
  const rim = mat(new THREE.Color(irisCol).multiplyScalar(0.45).getHex()), iris = mat(irisCol);
  const glint = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const x of [-0.125, 0.125]) {
    const ring = new THREE.Mesh(new THREE.SphereGeometry(0.084, 16, 12), rim);
    ring.scale.set(1, 1.05, 0.42);
    ring.position.set(x, 0.985, 0.33);
    head.add(ring);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.074, 16, 12), iris);
    eye.scale.set(1, 1.05, 0.45);
    eye.position.set(x, 0.985, 0.338);
    head.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), dark);
    pupil.scale.set(0.8, 1.15, 0.4);
    pupil.position.set(x, 0.985, 0.366);
    head.add(pupil);
    const g1 = new THREE.Mesh(new THREE.SphereGeometry(0.021, 8, 6), glint);
    g1.position.set(x - 0.022, 1.012, 0.376);
    head.add(g1);
    const g2 = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 4), glint);
    g2.position.set(x + 0.025, 0.96, 0.374);
    head.add(g2);
    eyes.push(ring, eye, pupil, g1, g2);
    // Happy closed eye: an upside-down "U", hidden until content.
    const lid = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.013, 5, 12, Math.PI), line);
    lid.position.set(x, 0.97, 0.355);
    lid.visible = false;
    head.add(lid);
    lids.push(lid);
  }

  // Muzzle: cream whisker pads and chin, small pink nose, a gentle smile.
  for (const x of [-0.055, 0.055]) {
    const padM = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), cream);
    padM.position.set(x, 0.88, 0.33);
    padM.scale.set(1.05, 0.85, 0.8);
    head.add(padM);
  }
  head.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), cream), 0, 0.825, 0.3));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.035, 3), pink);
  nose.position.set(0, 0.918, 0.398);
  nose.rotation.set(Math.PI / 2, 0, Math.PI);
  head.add(nose);
  head.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.03, 0.01), line), 0, 0.888, 0.4));
  for (const x of [-0.028, 0.028]) {
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.006, 4, 10, Math.PI), line);
    smile.rotation.z = Math.PI; // the bottom half of a ring: a curve that smiles
    smile.position.set(x, 0.875, 0.395);
    head.add(smile);
  }

  const whiskerPts: number[] = [];
  for (const side of [-1, 1]) {
    for (const dy of [0.03, 0.01, -0.01, -0.03]) {
      whiskerPts.push(side * 0.09, 0.885, 0.37, side * 0.48, 0.885 + dy * 3.5, 0.3);
    }
  }
  head.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(whiskerPts, 3)),
    new THREE.LineBasicMaterial({ color: 0xffffff }),
  ));

  // --- tail: thick, ringed, dark tip; pivot at the base so the wag swings it all ---
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.62, 4, 10), fur);
  tail.geometry.translate(0, 0.37, 0);
  tail.position.set(0, 0.3, -0.34);
  tail.rotation.x = -0.9;
  group.add(tail);
  for (const y of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.076, 0.022, 5, 12), stripe);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    tail.add(ring);
  }
  tail.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.078, 10, 8), stripe), 0, 0.7, 0));

  const hatSlot = new THREE.Group();
  hatSlot.position.set(0, 1.21, 0.05);
  head.add(hatSlot);
  const glassesSlot = new THREE.Group();
  glassesSlot.position.set(0, 0.985, 0.385);
  head.add(glassesSlot);

  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), pink);
  tongue.scale.set(1, 0.4, 1.3);
  tongue.position.set(0, 0.85, 0.38);
  tongue.visible = false;
  head.add(tongue);

  // Pivot the head at the neck: shift every part so the group sits at NECK.
  const NECK = new THREE.Vector3(0, 0.78, 0.08);
  head.children.forEach((c) => c.position.sub(NECK));
  head.position.copy(NECK);
  group.add(head);

  const collarSlot = new THREE.Group();
  collarSlot.position.set(0, 0.74, 0.06);
  group.add(collarSlot);
  const backSlot = new THREE.Group();
  backSlot.position.set(0, 0.5, -0.3);
  group.add(backSlot);
  const costumeSlot = new THREE.Group();
  group.add(costumeSlot);

  group.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return { group, tail, head, eyes, lids, tongue, hatSlot, collarSlot, glassesSlot, backSlot, costumeSlot };
}

// ---------- clothes ----------------------------------------------------------
// One builder per `style` in the shop catalog; colours come from the item, so
// e.g. every band collar or cone hat shares a builder.

type Build = (c1: number, c2: number) => THREE.Object3D;
const grp = (...parts: THREE.Object3D[]) => { const g = new THREE.Group(); g.add(...parts); return g; };
const ring = (r: number, tube: number, c: number, seg = 20) => {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, seg), mat(c));
  m.rotation.x = Math.PI / 2;
  return m;
};

/** A flat outline shape (star, heart) with a hole, for novelty glasses. */
function frame(points: [number, number][], c: number) {
  const outer = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const hole = new THREE.Path(points.map(([x, y]) => new THREE.Vector2(x * 0.72, y * 0.72)).reverse());
  outer.holes.push(hole);
  return new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.02, bevelEnabled: false }), mat(c));
}
const starPts = (r: number): [number, number][] =>
  Array.from({ length: 10 }, (_, i) => { const a = Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; return [Math.cos(a) * rr, Math.sin(a) * rr]; });
const heartPts = (r: number): [number, number][] =>
  Array.from({ length: 24 }, (_, i) => {
    const t = (i / 24) * Math.PI * 2;
    return [r * 0.06 * 16 * Math.sin(t) ** 3, r * 0.06 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))];
  });

const HAT: Record<string, Build> = {
  acorn: (c1) => grp(
    new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(c1)),
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.08, 6), mat(0x5a3a1a)), 0, 0.22, 0),
  ),
  bobble: (c1, c2) => grp(
    at(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.32, 14), mat(c1)), 0, 0.02, 0),
    at(ring(0.21, 0.045, c2), 0, -0.12, 0),
    at(new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mat(c2)), 0, 0.2, 0),
  ),
  goggles: (c1) => {
    const g = grp(at(ring(0.27, 0.025, 0x5a3a1a, 24), 0, -0.13, -0.02));
    for (const x of [-0.12, 0.12]) {
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 14), mat(c1));
      lens.rotation.x = Math.PI / 2 - 0.5;
      lens.position.set(x, -0.04, 0.2);
      g.add(lens);
    }
    return g;
  },
  cone: (c1, c2) => {
    const g = grp(at(new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.42, 16), mat(c1)), 0, 0.15, 0));
    for (let i = 0; i < 3; i++) g.add(at(ring(0.12 - i * 0.035, 0.012, c2, 16), 0, 0.02 + i * 0.1, 0));
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(c2)), 0, 0.38, 0));
    g.rotation.z = -0.15;
    return g;
  },
  witch: (c1, c2) => {
    const g = grp(
      at(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.02, 24), mat(c1)), 0, -0.05, 0),
      at(new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.5, 16), mat(c1)), 0, 0.2, 0),
      at(new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.17, 0.05, 16), mat(c2)), 0, 0.0, 0),
    );
    g.children[1]!.rotation.z = -0.25;
    return g;
  },
  crown: (c1, c2) => {
    const g = grp(at(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.1, 20, 1, true), mat(c1)), 0, 0, 0));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 4), mat(c1)), Math.sin(a) * 0.15, 0.09, Math.cos(a) * 0.15));
      g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), mat(i % 2 ? c2 : 0x3498db)), Math.sin(a) * 0.16, 0.0, Math.cos(a) * 0.16));
    }
    return g;
  },
  chef: (c1) => grp(
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.14, 16), mat(c1)), 0, 0, 0),
    at(new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), mat(c1)), 0, 0.16, 0),
    at(new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(c1)), 0.12, 0.14, 0),
    at(new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(c1)), -0.12, 0.14, 0),
  ),
  top: (c1, c2) => grp(
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.02, 24), mat(c1)), 0, -0.04, 0),
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 20), mat(c1)), 0, 0.12, 0),
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.05, 20), mat(c2)), 0, 0.0, 0),
  ),
  flowers: (c1, c2) => {
    const g = grp(at(ring(0.2, 0.02, c2), 0, -0.04, 0));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat(i % 2 ? c1 : 0xffffff)), Math.sin(a) * 0.2, -0.02, Math.cos(a) * 0.2));
      g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), mat(0xffd23f)), Math.sin(a) * 0.22, 0.0, Math.cos(a) * 0.22));
    }
    return g;
  },
  bow: (c1) => {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const loop = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.17, 12), mat(c1));
      loop.rotation.z = s * Math.PI / 2;
      loop.position.x = s * 0.09;
      g.add(loop);
    }
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat(c1)));
    g.position.set(0.12, -0.02, 0.06);
    g.rotation.z = 0.3;
    return g;
  },
  beanie: (c1, c2) => {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(c1));
    dome.scale.y = 0.8;
    return grp(at(dome, 0, -0.08, 0), at(ring(0.215, 0.04, c2), 0, -0.08, 0), at(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(c2)), 0, 0.12, 0));
  },
  cowboy: (c1) => {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.025, 24), mat(c1));
    brim.scale.z = 0.8;
    return grp(at(brim, 0, -0.03, 0), at(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.2, 16), mat(c1)), 0, 0.08, 0),
      at(new THREE.Mesh(new THREE.CylinderGeometry(0.162, 0.162, 0.04, 16), mat(0x3a2414)), 0, 0.0, 0));
  },
  phones: (c1, c2) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.025, 6, 20, Math.PI), mat(c1));
    const g = grp(at(band, 0, -0.2, -0.02));
    for (const s of [-1, 1]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 14), mat(c2));
      cup.rotation.z = Math.PI / 2;
      cup.position.set(s * 0.3, -0.22, -0.02);
      g.add(cup);
    }
    return g;
  },
  propeller: (c1, c2) => {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(c1));
    const g = grp(at(cap, 0, -0.06, 0), at(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 6), mat(0x888888)), 0, 0.17, 0));
    const blades = new THREE.Group();
    blades.position.y = 0.22;
    for (const a of [0, Math.PI]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.01, 0.05), mat(c2));
      b.position.x = Math.cos(a) * 0.11;
      blades.add(b);
    }
    blades.userData.spin = true; // main loop spins anything marked like this
    g.add(blades);
    return g;
  },
  pumpkin: (c1, c2) => {
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const rib = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), mat(c1));
      rib.scale.set(0.55, 0.7, 1);
      rib.rotation.y = (i / 6) * Math.PI;
      g.add(rib);
    }
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.1, 6), mat(0x5a7a2a)), 0, 0.15, 0));
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(c2));
    leaf.scale.set(1.5, 0.3, 0.8);
    leaf.position.set(0.06, 0.13, 0.02);
    g.add(leaf);
    g.position.y = 0.02;
    return g;
  },
  bunny: (c1, c2) => {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mat(c1));
      ear.scale.set(0.7, 2.6, 0.5);
      ear.position.set(s * 0.09, 0.14, -0.02);
      ear.rotation.z = -s * 0.15;
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat(c2));
      inner.scale.set(0.6, 2.4, 0.3);
      inner.position.set(s * 0.09, 0.14, 0.015);
      inner.rotation.z = -s * 0.15;
      g.add(ear, inner);
    }
    g.add(at(ring(0.2, 0.025, c1), 0, -0.05, 0));
    return g;
  },
};

const COLLAR: Record<string, Build> = {
  band: (c1, c2) => grp(ring(0.26, 0.045, c1, 16), at(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(c2 || 0xffd54a)), 0, -0.08, 0.25)),
  bell: (c1, c2) => {
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mat(c2));
    return grp(ring(0.26, 0.045, c1, 16), at(bell, 0, -0.09, 0.26), at(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.01, 0.02), mat(0x5a4a10)), 0, -0.1, 0.33));
  },
  bowtie: (c1) => {
    const g = grp(ring(0.255, 0.02, c1, 16));
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 4), mat(c1));
      wing.rotation.z = s * Math.PI / 2;
      wing.position.set(s * 0.07, -0.02, 0.27);
      g.add(wing);
    }
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(c1)), 0, -0.02, 0.28));
    return g;
  },
  scarf: (c1, c2) => {
    const tailM = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.04), mat(c1));
    tailM.position.set(0.1, -0.17, 0.27);
    tailM.rotation.z = 0.15;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.04, 0.045), mat(c2));
    stripe.position.set(0.11, -0.25, 0.27);
    stripe.rotation.z = 0.15;
    return grp(ring(0.27, 0.075, c1, 16), at(ring(0.27, 0.05, c2, 16), 0, -0.04, 0), tailM, stripe);
  },
  bandana: (c1, c2) => {
    const tri = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.26, 3), mat(c1));
    tri.rotation.set(Math.PI, 0, 0);
    tri.scale.z = 0.2;
    tri.position.set(0, -0.13, 0.25);
    const g = grp(ring(0.26, 0.03, c1, 16), tri);
    for (const [x, y] of [[-0.06, -0.08], [0.06, -0.09], [0, -0.16]] as const) g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 4), mat(c2)), x, y, 0.27));
    return g;
  },
  pearls: (c1) => {
    const g = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(c1)), Math.sin(a) * 0.27, -0.02 - Math.max(0, Math.cos(a)) * 0.05, Math.cos(a) * 0.27));
    }
    return g;
  },
};

const GLASSES: Record<string, Build> = {
  round: (c1) => {
    const g = new THREE.Group();
    for (const x of [-0.125, 0.125]) g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 6, 20), mat(c1)), x, 0, 0));
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.012), mat(c1)), 0, 0.02, 0));
    for (const s of [-1, 1]) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.22), mat(c1)), s * 0.21, 0.02, -0.11));
    return g;
  },
  shades: (c1) => {
    const g = new THREE.Group();
    for (const x of [-0.125, 0.125]) {
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), mat(c1));
      lens.scale.set(1.15, 0.8, 0.2);
      lens.position.set(x, 0, 0);
      g.add(lens);
    }
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.02), mat(c1)), 0, 0.05, 0));
    for (const s of [-1, 1]) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.22), mat(c1)), s * 0.22, 0.04, -0.11));
    return g;
  },
  star: (c1) => {
    const g = new THREE.Group();
    for (const x of [-0.125, 0.125]) g.add(at(frame(starPts(0.11), c1), x, 0, -0.01));
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.015), mat(c1)), 0, 0.02, 0));
    return g;
  },
  heart: (c1) => {
    const g = new THREE.Group();
    for (const x of [-0.125, 0.125]) g.add(at(frame(heartPts(0.1), c1), x, 0.01, -0.01));
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.015), mat(c1)), 0, 0.02, 0));
    return g;
  },
  monocle: (c1) => {
    const g = grp(at(new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.014, 6, 20), mat(c1)), 0.125, 0, 0));
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.3, 4), mat(c1));
    chain.position.set(0.19, -0.16, -0.02);
    chain.rotation.z = 0.3;
    g.add(chain);
    return g;
  },
};

const BACK: Record<string, Build> = {
  cape: (c1, c2) => {
    const cloth = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.48, 0.62, 16, 1, true, Math.PI * 0.6, Math.PI * 0.8), mat(c1, { side: THREE.DoubleSide }));
    cloth.position.set(0, -0.12, 0.25);
    const clasp = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mat(c2));
    clasp.position.set(0, 0.24, 0.6);
    return grp(cloth, at(ring(0.28, 0.03, c2, 16), 0, 0.2, 0.32), clasp);
  },
  wings: (c1, c2) => {
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.15, 0.35, 0.5, 0.45, 0.6, 0.25);
    shape.bezierCurveTo(0.5, 0.1, 0.45, -0.1, 0.25, -0.2);
    shape.bezierCurveTo(0.15, -0.15, 0.05, -0.05, 0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(geo, mat(c1));
      w.scale.set(s, 1, 1);
      w.rotation.y = s * -0.5;
      w.position.set(s * 0.05, 0.12, 0);
      const inner = new THREE.Mesh(geo, mat(c2));
      inner.scale.set(s * 0.6, 0.6, 1);
      inner.rotation.y = s * -0.5;
      inner.position.set(s * 0.06, 0.12, -0.012);
      g.add(w, inner);
    }
    return g;
  },
  batwings: (c1) => {
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(0.55, 0.3);
    shape.quadraticCurveTo(0.5, 0.1, 0.55, -0.05); shape.quadraticCurveTo(0.4, -0.02, 0.35, -0.12);
    shape.quadraticCurveTo(0.25, -0.05, 0.15, -0.12); shape.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(geo, mat(c1));
      w.scale.set(s, 1, 1);
      w.rotation.y = s * -0.5;
      w.position.set(s * 0.05, 0.15, 0);
      g.add(w);
    }
    return g;
  },
  backpack: (c1, c2) => {
    const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.12, 4, 10), mat(c1));
    bag.scale.z = 0.6;
    const flap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(c2));
    flap.scale.z = 0.62;
    flap.position.y = 0.06;
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.04), mat(c2));
    pocket.position.set(0, -0.08, -0.09);
    const g = grp(bag, flap, pocket);
    g.position.z = -0.08;
    return g;
  },
  shell: (c1, c2) => {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(c1));
    dome.rotation.x = -Math.PI / 2;
    dome.scale.set(1, 1, 0.55);
    const g = grp(dome);
    for (const [x, y] of [[0, 0], [-0.14, 0.1], [0.14, 0.1], [-0.14, -0.12], [0.14, -0.12]] as const) {
      const plate = new THREE.Mesh(new THREE.CircleGeometry(0.06, 6), mat(c2));
      plate.position.set(x, y, -0.17 + Math.hypot(x, y) * 0.35);
      plate.rotation.y = Math.PI;
      g.add(plate);
    }
    g.position.z = 0.05;
    return g;
  },
};

// Costumes hug the torso (body capsule: r≈0.38 at y 0.42), leaving head and paws out.
const suit = (c: number, flare = 0.43, h = 0.42, y = 0.5) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.4, flare, h, 20, 1, true), mat(c, { side: THREE.DoubleSide }));
  m.scale.x = 1.06;
  return at(m, 0, y, 0);
};
/** A cone sticking out of the suit's back at height y. */
const spike = (y: number, c: number) => at(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.13, 6), mat(c)), 0, y, -0.43).rotateX(-Math.PI / 2);
const COSTUME: Record<string, Build> = {
  pumpkin: (c1, c2) => {
    const g = grp(suit(c1, 0.46));
    for (let i = 0; i < 10; i++) { // darker ribs
      const a = (i / 10) * Math.PI * 2;
      g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.42, 0.02), mat(0xd9600f)), Math.sin(a) * 0.46, 0.5, Math.cos(a) * 0.44));
      g.children.at(-1)!.rotation.y = a;
    }
    const face = mat(0x2a1a10);
    for (const x of [-0.12, 0.12]) g.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.05, 3), face), x, 0.58, 0.44));
    const grin = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16, Math.PI, Math.PI), face);
    g.add(at(grin, 0, 0.46, 0.445), at(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8), mat(c2)), 0, 0.72, 0));
    return g;
  },
  ghost: (c1) => {
    // A sheet that drapes to the floor, with a wavy hem of little bumps.
    const g = grp(suit(c1, 0.52, 0.7, 0.38));
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(c1)), Math.sin(a) * 0.52 * 1.06, 0.04, Math.cos(a) * 0.52));
    }
    return g;
  },
  skeleton: (c1, c2) => {
    const g = grp(suit(c1));
    for (const [y, w] of [[0.62, 0.3], [0.54, 0.34], [0.46, 0.32], [0.38, 0.26]] as const) {
      const rib = at(band(0.425, w * 3, 0, mat(c2), 0.022), 0, y, 0);
      rib.scale.x = 1.06;
      g.add(rib);
    }
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.02), mat(c2)), 0, 0.5, 0.435)); // breastbone
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.02), mat(c2)), 0, 0.5, -0.435)); // spine
    return g;
  },
  bee: (c1, c2) => {
    const g = grp(suit(c1));
    for (const y of [0.4, 0.54]) g.add(at(ring(0.425, 0.035, c2, 24), 0, y, 0));
    g.children.slice(1).forEach((c) => (c.scale.x = 1.06));
    const wings = BACK.wings!(0xeaf6ff, 0xffffff);
    wings.position.set(0, 0.55, -0.4);
    return grp(g, wings);
  },
  dino: (c1, c2) => {
    const g = grp(suit(c1));
    for (const y of [0.34, 0.46, 0.58, 0.7]) g.add(spike(y, c2)); // spikes down the back
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), mat(0xd8efb0));
    belly.scale.set(1, 1.1, 0.3);
    return grp(g, at(belly, 0, 0.5, 0.38));
  },
};

const BUILDERS = { hat: HAT, collar: COLLAR, glasses: GLASSES, back: BACK, costume: COSTUME } as const;

export function dress(cat: Cat, worn: Partial<Worn>) {
  const slots = { hat: cat.hatSlot, collar: cat.collarSlot, glasses: cat.glassesSlot, back: cat.backSlot, costume: cat.costumeSlot };
  for (const key of Object.keys(slots) as (keyof Worn)[]) {
    const slot = slots[key];
    slot.clear();
    const it = worn[key] ? BY_ID[worn[key]!] : undefined;
    const build = it?.style ? BUILDERS[key][it.style] : undefined;
    if (!build || !it) continue;
    const o = build(it.color ?? 0xcccccc, it.color2 ?? 0xffffff);
    o.traverse((m) => { if ((m as THREE.Mesh).isMesh) m.castShadow = true; });
    slot.add(o);
  }
}
