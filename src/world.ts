// Everything on the map that isn't the cat or a click target: terrain, sky,
// paths, the three areas' scenery, home, and the little things that move.
// Built from primitives like the cat, so there's still no asset pipeline.

import * as THREE from "three";
import { toonMat, type MatParams } from "./toon.ts";

export const mat = (color: number, extra: MatParams = {}) => toonMat(color, extra);

// Seeded so the map looks the same every visit.
let seed = 7;
export const reseed = (n: number) => { seed = n; };
export const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const range = (a: number, b: number) => a + rnd() * (b - a);
export const choose = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;

export function shadows<T extends THREE.Object3D>(o: T, cast = true): T {
  o.traverse((c) => { if ((c as THREE.Mesh).isMesh) { c.castShadow = cast; c.receiveShadow = true; } });
  return o;
}

export function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z);
  return o;
}

/** Text painted onto a canvas, for signs and number blocks. Empty `bg` = transparent, glowing text. */
export function label(text: string, bg: string, fg: string, w = 256, h = 128, size = 64) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  else { g.shadowColor = fg; g.shadowBlur = size * 0.4; }
  // Wood grain on wooden signs.
  if (bg && bg !== "#ffffff") {
    g.strokeStyle = "rgba(0,0,0,0.12)";
    for (let y = 8; y < h; y += 14) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w / 3, y + 5, w / 2, y - 5, w, y + 2); g.stroke(); }
  }
  g.fillStyle = fg;
  g.font = `bold ${size}px "Trebuchet MS", sans-serif`;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export const leafMats = [0x2f7a3c, 0x3d8b45, 0x4c9a5a, 0x2b6a36].map((c) => mat(c));
export const bark = mat(0x6b4a2b);

export function makePine(s: number, leaf = choose(leafMats)) {
  const g = new THREE.Group();
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.7, 6), bark), 0, 0.35, 0));
  for (let k = 0; k < 3; k++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.75 - k * 0.18, 0.9, 7), leaf);
    cone.position.y = 0.8 + k * 0.48;
    cone.rotation.y = rnd();
    g.add(cone);
  }
  g.scale.setScalar(s);
  g.rotation.y = rnd() * 3;
  return shadows(g);
}

export function makeOak(s: number, leaf = choose(leafMats)) {
  const g = new THREE.Group();
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.2, 6), bark), 0, 0.6, 0));
  for (let k = 0; k < 5; k++) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(range(0.45, 0.65), 0), leaf);
    blob.position.set(range(-0.4, 0.4), range(1.3, 1.9), range(-0.4, 0.4));
    g.add(blob);
  }
  g.scale.setScalar(s);
  return shadows(g);
}

// ---------------------------------------------------------------------------

/** Signpost in front of the cottage; main.ts makes it a tap target too. */
export const HOME_SIGN = new THREE.Vector3(3.9, 0, 5.5);

export type Spots = { home: THREE.Vector3; forest: THREE.Vector3; mountain: THREE.Vector3; lab: THREE.Vector3; garden: THREE.Vector3 };

export function buildWorld(scene: THREE.Scene, spots: Spots): (t: number) => void {
  reseed(7);
  const movers: ((t: number) => void)[] = [];
  const S = spots;
  const pathEnds = [S.forest, S.mountain, S.lab, S.garden].map((p) => [S.home, p] as const);
  const POND = new THREE.Vector3(2.2, 0, -1.0);
  const LAB_AT = new THREE.Vector3(S.lab.x + 1.4, 0, S.lab.z - 2.6);
  const HOUSE_AT = new THREE.Vector3(S.home.x + 2.4, 0, S.home.z + 0.2);
  // Footprints of the big set pieces, so grass and rocks don't poke through them.
  const blocked: [THREE.Vector3, number][] = [[POND, 1.5], [LAB_AT, 1.7], [HOUSE_AT, 1.1]];

  /** Keep scatter off the paths, pads and home so the cat never walks through a tree. */
  const clear = (x: number, z: number, pad = 0.9) => {
    const p = new THREE.Vector3(x, 0, z);
    for (const [a, b] of pathEnds) {
      const line = new THREE.Line3(a, b);
      if (line.closestPointToPoint(p, true, new THREE.Vector3()).distanceTo(p) < pad) return false;
    }
    if ([S.forest, S.mountain, S.lab, S.garden].some((s) => s.distanceTo(p) < 1.9 + pad * 0.3)) return false;
    if (blocked.some(([c, r]) => c.distanceTo(p) < r + pad * 0.3)) return false;
    return S.home.distanceTo(p) > 1.3 + pad * 0.3;
  };
  const scatter = (n: number, r0: number, r1: number, cx: number, cz: number, padding: number, place: (x: number, z: number) => void) => {
    for (let tries = 0, made = 0; made < n && tries < n * 40; tries++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(range(r0 * r0, r1 * r1));
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (clear(x, z, padding)) { place(x, z); made++; }
    }
  };

  // ---------- sky ----------------------------------------------------------
  {
    const geo = new THREE.SphereGeometry(80, 32, 16);
    const top = new THREE.Color(0x3f8fe0), mid = new THREE.Color(0x9fd4f7), low = new THREE.Color(0xfff0d8);
    const pos = geo.attributes.position!, cols: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const h = pos.getY(i) / 80;
      const c = h > 0.1 ? mid.clone().lerp(top, Math.min(1, (h - 0.1) / 0.6)) : low.clone().lerp(mid, Math.max(0, (h + 0.05) / 0.15));
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
    sky.name = "sky"; // the Halloween theme recolours it
    scene.add(sky);
  }

  // ---------- terrain: flat meadow in the middle, rolling hills outside ------
  {
    const geo = new THREE.PlaneGeometry(130, 130, 110, 110);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position!, cols: number[] = [];
    const grassLo = new THREE.Color(0x5f9e4a), grassHi = new THREE.Color(0xa9cf6a), dirt = new THREE.Color(0x9a8a5a);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const r = Math.hypot(x, z);
      const hills = Math.sin(x * 0.21) * Math.cos(z * 0.17) * 1.6 + Math.sin(x * 0.07 + z * 0.11) * 2.4 + 2;
      const edge = THREE.MathUtils.smoothstep(r, 11, 20);
      const y = hills * edge * (1 + r * 0.03) + Math.sin(x * 1.3) * Math.cos(z * 1.7) * 0.04;
      pos.setY(i, y);
      const c = grassLo.clone().lerp(grassHi, THREE.MathUtils.clamp(y / 6 + range(-0.08, 0.12), 0, 1));
      if (rnd() < 0.04) c.lerp(dirt, 0.3);
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, mat(0xffffff, { vertexColors: true }));
    ground.receiveShadow = true;
    scene.add(ground);
  }

  // ---------- far mountain ring, softened by fog --------------------------
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + range(-0.1, 0.1);
    const r = range(42, 55), h = range(9, 18), w = range(7, 12);
    const peak = new THREE.Mesh(new THREE.ConeGeometry(w, h, 6), mat(choose([0x7d8fa6, 0x8a9ab0, 0x6f8199])));
    peak.position.set(Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r);
    peak.rotation.y = rnd();
    scene.add(peak);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.32, h * 0.32, 6), mat(0xf4f7fb));
    cap.position.set(0, h / 2 - h * 0.16 + 0.05, 0);
    cap.scale.setScalar(1.03);
    peak.add(cap);
  }

  // ---------- paths: packed dirt with flagstones and a pebble edge ----------
  const dirtMat = mat(0xcdb685);
  const stoneMats = [mat(0xb9b2a4), mat(0xa8a092), mat(0xc8c0b0)];
  const pebbles: THREE.Matrix4[] = [];
  for (const [a, b] of pathEnds) {
    const len = a.distanceTo(b);
    const ang = Math.atan2(b.x - a.x, b.z - a.z);
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(1.0, len + 0.6), dirtMat);
    seg.rotation.set(-Math.PI / 2, 0, -ang);
    seg.position.copy(a).add(b).multiplyScalar(0.5).setY(0.02);
    seg.receiveShadow = true;
    scene.add(seg);

    const dir = b.clone().sub(a).normalize();
    const side = new THREE.Vector3(dir.z, 0, -dir.x);
    for (let d = 0.6; d < len - 1.2; d += 0.62) {
      const p = a.clone().addScaledVector(dir, d).addScaledVector(side, range(-0.12, 0.12));
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(range(0.2, 0.27), 0.28, 0.06, 7), choose(stoneMats));
      stone.position.copy(p).setY(0.04);
      stone.rotation.y = rnd() * 3;
      stone.receiveShadow = true;
      scene.add(stone);
    }
    for (let d = 0; d < len - 1.4; d += 0.22) {
      for (const s of [-1, 1]) {
        const p = a.clone().addScaledVector(dir, d).addScaledVector(side, s * range(0.52, 0.62));
        const sc = range(0.04, 0.09);
        pebbles.push(new THREE.Matrix4().compose(
          p.setY(sc * 0.4), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(), rnd() * 3, 0)), new THREE.Vector3(sc, sc * 0.6, sc),
        ));
      }
    }
  }
  // Ring of stones around each pad.
  for (const s of [S.forest, S.mountain, S.lab, S.garden]) {
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2, sc = range(0.1, 0.16);
      pebbles.push(new THREE.Matrix4().compose(
        new THREE.Vector3(s.x + Math.cos(a) * 1.72, sc * 0.4, s.z + Math.sin(a) * 1.72),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(), rnd() * 3, 0)), new THREE.Vector3(sc, sc * 0.7, sc),
      ));
    }
  }
  // Pale inlaid ring + paw print on each pad's top.
  for (const s of [S.forest, S.mountain, S.lab, S.garden]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.22, 40), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(s.x, 0.31, s.z);
    scene.add(ring);
    const paw = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });
    const pawPad = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20), paw);
    pawPad.rotation.x = -Math.PI / 2;
    pawPad.scale.set(1.15, 0.95, 1);
    pawPad.position.set(s.x, 0.31, s.z + 0.15);
    scene.add(pawPad);
    for (const [dx, dz] of [[-0.42, -0.25], [-0.15, -0.5], [0.15, -0.5], [0.42, -0.25]] as const) {
      const toe = new THREE.Mesh(new THREE.CircleGeometry(0.12, 14), paw);
      toe.rotation.x = -Math.PI / 2;
      toe.position.set(s.x + dx, 0.31, s.z + dz);
      scene.add(toe);
    }
  }
  {
    const inst = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), mat(0x9d968a), pebbles.length);
    pebbles.forEach((m, i) => inst.setMatrixAt(i, m));
    scene.add(shadows(inst));
  }

  // ---------- grass tufts + wildflowers (instanced: thousands, one draw each) --
  {
    const blades: THREE.Matrix4[] = [];
    const blade = new THREE.ConeGeometry(0.035, 0.32, 3);
    blade.translate(0, 0.16, 0);
    scatter(900, 1, 16, 0, 0, 0.6, (x, z) => {
      for (let k = 0; k < 4; k++) {
        const s = range(0.6, 1.3);
        blades.push(new THREE.Matrix4().compose(
          new THREE.Vector3(x + range(-0.08, 0.08), 0, z + range(-0.08, 0.08)),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(range(-0.4, 0.4), rnd() * 3, range(-0.4, 0.4))),
          new THREE.Vector3(s, s, s),
        ));
      }
    });
    const grass = new THREE.InstancedMesh(blade, mat(0xffffff), blades.length);
    const greens = [0x4f8f3a, 0x62a248, 0x7bb654, 0x437f33, 0x93c463].map((c) => new THREE.Color(c));
    blades.forEach((m, i) => { grass.setMatrixAt(i, m); grass.setColorAt(i, choose(greens)); });
    grass.receiveShadow = true;
    scene.add(grass);

    const heads: THREE.Matrix4[] = [], stems: THREE.Matrix4[] = [];
    scatter(320, 1.5, 14, 0, 0, 0.7, (x, z) => {
      const h = range(0.18, 0.32);
      stems.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(1, h, 1)));
      heads.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 3, 0)), new THREE.Vector3(1, 0.6, 1).multiplyScalar(range(0.8, 1.3))));
    });
    const stemMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 3), mat(0x4f8c37), stems.length);
    stems.forEach((m, i) => stemMesh.setMatrixAt(i, m));
    scene.add(stemMesh);
    const headMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.065, 0), mat(0xffffff), heads.length);
    const petals = [0xffffff, 0xffe066, 0xff8fab, 0xc39bff, 0xff6b6b, 0x8ecae6].map((c) => new THREE.Color(c));
    heads.forEach((m, i) => { headMesh.setMatrixAt(i, m); headMesh.setColorAt(i, choose(petals)); });
    scene.add(shadows(headMesh));
  }

  // Rocks scattered over the meadow.
  scatter(40, 3, 15, 0, 0, 0.9, (x, z) => {
    const s = range(0.15, 0.45);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat(choose([0x9a958c, 0x8a857c, 0xa9a397])));
    rock.position.set(x, s * 0.35, z);
    rock.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    rock.scale.y = 0.7;
    scene.add(shadows(rock));
  });

  // ---------- signposts -----------------------------------------------------
  const wood = mat(0x8b5a2b), woodDark = mat(0x6b4421);
  const sign = (text: string, x: number, z: number, ry = 0) => {
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.4, 6), woodDark), 0, 0.7, -0.1));
    const face = new THREE.MeshLambertMaterial({ map: label(text, "#a8743f", "#fff6e0", 512, 128, 58) });
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.42, 0.06), [wood, wood, wood, wood, face, wood]);
    board.position.y = 1.2;
    g.add(board);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    scene.add(shadows(g));
  };
  sign("Reading Forest", S.forest.x + 1.0, S.forest.z + 2.4, 0.2);
  sign("Math Mountain", S.mountain.x + 2.4, S.mountain.z + 0.4, -0.1);
  sign("Science Lab", S.lab.x - 1.0, S.lab.z + 2.4, -0.2);
  sign("🏠 Boabosh's Home", HOME_SIGN.x, HOME_SIGN.z, -0.3);
  sign("🎮 Game Garden", S.garden.x + 1.9, S.garden.z + 1.0, 0.15);

  // ---------- Reading Forest ------------------------------------------------
  const F = S.forest;
  const pine = (x: number, z: number, s: number) => scene.add(at(makePine(s), x, 0, z));
  const oak = (x: number, z: number, s: number) => scene.add(at(makeOak(s), x, 0, z));
  scatter(22, 2.1, 5, F.x, F.z, 1.1, (x, z) => { if (z < F.z + 0.6 || x < F.x - 2.2) (rnd() < 0.6 ? pine : oak)(x, z, range(0.8, 1.35)); });
  // A denser wood further out on the left, so the forest feels like a forest.
  scatter(30, 0, 5.5, F.x - 6, F.z - 1, 1.1, (x, z) => (rnd() < 0.7 ? pine : oak)(x, z, range(1.0, 1.7)));

  const capRed = mat(0xd63a2f), capBrown = mat(0xb07a4a), stemMat = mat(0xf4ead5), dot = mat(0xffffff);
  scatter(14, 1.8, 4.2, F.x, F.z, 0.7, (x, z) => {
    const g = new THREE.Group();
    const s = range(0.6, 1.2), red = rnd() < 0.6;
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.2, 6), stemMat), 0, 0.1, 0));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), red ? capRed : capBrown);
    cap.position.y = 0.18;
    g.add(cap);
    if (red) for (let k = 0; k < 4; k++) {
      const a = k * 1.7;
      g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), dot), Math.cos(a) * 0.09, 0.29, Math.sin(a) * 0.09));
    }
    g.scale.setScalar(s);
    g.position.set(x, 0, z);
    scene.add(shadows(g));
  });
  scatter(8, 2, 4.5, F.x, F.z, 0.9, (x, z) => {
    const bush = new THREE.Group();
    const leaf = choose(leafMats);
    for (let k = 0; k < 4; k++) bush.add(at(new THREE.Mesh(new THREE.IcosahedronGeometry(range(0.22, 0.34), 0), leaf), range(-0.25, 0.25), 0.22, range(-0.2, 0.2)));
    for (let k = 0; k < 3; k++) bush.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 4), mat(0xc0392b)), range(-0.3, 0.3), range(0.3, 0.45), range(0.1, 0.3)));
    bush.position.set(x, 0, z);
    scene.add(shadows(bush));
  });
  // Fallen log and a stump with rings.
  {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 1.8, 8), bark);
    log.rotation.set(0, 0.6, Math.PI / 2);
    log.position.set(F.x - 2.4, 0.22, F.z - 1.9);
    scene.add(shadows(log));
    const stump = new THREE.Group();
    stump.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.4, 9), bark), 0, 0.2, 0));
    stump.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 9), mat(0xd9b77e)), 0, 0.41, 0));
    stump.position.set(F.x + 1.9, 0, F.z - 1.6);
    scene.add(shadows(stump));
  }
  // Open storybook on a reading stand behind the pad.
  {
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.9, 6), woodDark), 0, 0.45, 0));
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.6), wood);
    top.position.y = 0.92; top.rotation.x = 0.5;
    g.add(top);
    const page = mat(0xfdf8ec);
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.5), page);
      p.position.set(s * 0.2, 0.97, 0.02);
      p.rotation.set(0.5, 0, -s * 0.12);
      g.add(p);
    }
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.02, 0.54), mat(0x8e2c3a));
    cover.position.set(0, 0.95, 0); cover.rotation.x = 0.5;
    g.add(cover);
    g.position.set(F.x - 0.2, 0, F.z - 2.2);
    scene.add(shadows(g));
  }

  // ---------- Math Mountain -------------------------------------------------
  const M = S.mountain;
  const rockMats = [mat(0x8d7d9c), mat(0x7a6c8a), mat(0x9c8fa8)];
  const snow = mat(0xf7f9fc);
  const peak = (x: number, z: number, r: number, h: number) => {
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.ConeGeometry(r, h, 8, 3), choose(rockMats)), 0, h / 2, 0));
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.35, h * 0.35, 8), snow);
    cap.position.y = h - h * 0.175 + 0.02;
    cap.scale.set(1.04, 1, 1.04);
    g.add(cap);
    // Ledges of rock sticking out of the slope.
    for (let k = 0; k < 3; k++) {
      const y = range(0.4, h * 0.45), a = rnd() * Math.PI * 2, rr = r * (1 - y / h) * 0.95;
      g.add(at(new THREE.Mesh(new THREE.DodecahedronGeometry(range(0.25, 0.45), 0), choose(rockMats)), Math.cos(a) * rr, y, Math.sin(a) * rr));
    }
    g.position.set(x, 0, z);
    g.rotation.y = rnd();
    scene.add(shadows(g));
    return g;
  };
  peak(M.x, M.z - 4.6, 3.4, 6.5);
  peak(M.x - 3.6, M.z - 3.6, 2.3, 4.2);
  peak(M.x + 3.8, M.z - 3.9, 2.6, 4.8);
  peak(M.x - 7, M.z - 6.5, 3, 5.5);
  peak(M.x + 7.5, M.z - 6, 3.2, 6);
  // Summit flag, waving.
  {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 5), mat(0x555555));
    pole.position.set(M.x, 7.0, M.z - 4.6);
    scene.add(pole);
    const flagGeo = new THREE.PlaneGeometry(0.7, 0.4, 6, 1);
    flagGeo.translate(0.35, 0, 0);
    const flag = new THREE.Mesh(flagGeo, mat(0xe74c3c, { side: THREE.DoubleSide }));
    flag.position.set(M.x + 0.03, 7.4, M.z - 4.6);
    scene.add(flag);
    const base = flagGeo.attributes.position!.array.slice();
    movers.push((t) => {
      const p = flagGeo.attributes.position!;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(t * 5 - base[i * 3]! * 6) * 0.08 * base[i * 3]!);
      p.needsUpdate = true;
    });
  }
  // Pines around the foot of the mountain.
  scatter(16, 2.2, 6, M.x, M.z - 2, 1, (x, z) => { if (z < M.z + 1) pine(x, z, range(0.7, 1.2)); });
  scatter(5, 2, 4, M.x, M.z, 0.9, (x, z) => {
    const s = range(0.2, 0.4);
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), choose(rockMats));
    b.position.set(x, s * 0.5, z);
    b.rotation.set(rnd(), rnd(), rnd());
    scene.add(shadows(b));
  });
  // Stacked number blocks.
  {
    const cols = ["#e74c3c", "#3498db", "#f1c40f", "#2ecc71", "#9b59b6", "#e67e22"];
    const block = (n: string, x: number, y: number, z: number, ry: number) => {
      const m = new THREE.MeshLambertMaterial({ map: label(n, cols[Number(n) % cols.length]!, "#ffffff", 128, 128, 96) });
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), m);
      b.position.set(x, y, z);
      b.rotation.y = ry;
      scene.add(shadows(b));
    };
    const bx = M.x - 2.4, bz = M.z + 0.4;
    block("1", bx, 0.225, bz, 0.2);
    block("2", bx + 0.5, 0.225, bz + 0.1, -0.1);
    block("3", bx + 0.25, 0.675, bz + 0.05, 0.4);
    block("5", M.x + 2.1, 0.225, M.z - 0.9, -0.3);
    block("7", M.x - 2.0, 0.225, M.z - 1.2, 0.5);
  }

  // ---------- Science Lab ---------------------------------------------------
  const L = S.lab;
  {
    const lab = new THREE.Group();
    const wall = mat(0xe8eef4), trim = mat(0x4f86c6), glass = mat(0x9fe3ff, { emissive: 0x3aa6d8, emissiveIntensity: 0.5 });
    lab.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 1.8), wall), 0, 0.8, 0));
    lab.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.15, 1.9), trim), 0, 1.65, 0));
    lab.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.12, 1.9), trim), 0, 0.06, 0));
    // Observatory dome with a telescope poking out.
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xb8c4cf));
    dome.position.set(0.3, 1.72, -0.1);
    lab.add(dome);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.05), mat(0x2b3440));
    slot.position.set(0.3, 2.1, 0.55); slot.rotation.x = -0.6;
    lab.add(slot);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.9, 8), mat(0x3a4656));
    scope.position.set(0.3, 2.3, 0.6); scope.rotation.x = 0.9;
    lab.add(scope);
    // Windows that glow, a door, steps.
    for (const x of [-0.85, 0.85]) {
      lab.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.05), glass), x, 0.95, 0.91));
      lab.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.07, 0.08), trim), x, 0.67, 0.93));
    }
    lab.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.95, 0.05), mat(0x2e5c8a)), 0, 0.48, 0.91));
    lab.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), mat(0xffd54a)), 0.18, 0.48, 0.95));
    lab.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.35), mat(0xb0b6bc)), 0, 0.04, 1.05));
    // Rooftop chimney pipe with a rising puff of coloured steam.
    lab.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 8), mat(0x8a96a3)), -0.9, 2.0, -0.4));
    lab.position.copy(LAB_AT);
    lab.rotation.y = -0.45;
    scene.add(shadows(lab));

    const puffs: THREE.Mesh[] = [];
    const chimneyTop = new THREE.Vector3(-0.9, 2.4, -0.4).applyEuler(lab.rotation).add(lab.position);
    for (let k = 0; k < 5; k++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshLambertMaterial({ color: 0xc8f7d0, transparent: true }));
      scene.add(puff);
      puffs.push(puff);
    }
    movers.push((t) => puffs.forEach((p, k) => {
      const f = (t * 0.35 + k / puffs.length) % 1;
      p.position.copy(chimneyTop).add(new THREE.Vector3(Math.sin(f * 6 + k) * 0.15 + f * 0.4, f * 1.8, 0));
      p.scale.setScalar(0.6 + f * 1.6);
      (p.material as THREE.MeshLambertMaterial).opacity = 0.75 * (1 - f);
    }));
  }
  // Bubbling flasks on a bench.
  {
    const bench = new THREE.Group();
    bench.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.55), mat(0xd7dde3)), 0, 0.7, 0));
    for (const x of [-0.6, 0.6]) for (const z of [-0.22, 0.22]) bench.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), mat(0x7f8c99)), x, 0.35, z));
    const glassMat = new THREE.MeshPhongMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.35, shininess: 120 });
    const bubbles: THREE.Mesh[] = [];
    for (const [x, liquid] of [[-0.42, 0x6be675], [0, 0xff6bd6], [0.42, 0x5ec8ff]] as const) {
      const flask = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.32, 12, 1, true), glassMat);
      flask.position.set(x, 0.9, 0);
      bench.add(flask);
      bench.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 8, 1, true), glassMat), x, 1.12, 0));
      const liq = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.16, 12), mat(liquid, { emissive: liquid, emissiveIntensity: 0.35 }));
      liq.geometry.translate(0, 0.08, 0);
      liq.position.set(x, 0.75, 0);
      bench.add(liq);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), mat(liquid, { emissive: liquid, emissiveIntensity: 0.6 }));
      b.userData.x = x;
      bench.add(b);
      bubbles.push(b);
    }
    bench.position.set(L.x + 2.4, 0, L.z - 0.4);
    bench.rotation.y = -1.2;
    scene.add(shadows(bench));
    movers.push((t) => bubbles.forEach((b, k) => {
      const f = (t * 0.8 + k * 0.33) % 1;
      b.position.set(b.userData.x + Math.sin(f * 9) * 0.02, 0.9 + f * 0.45, 0);
      b.scale.setScalar(1 - f * 0.6);
    }));
  }
  // Satellite dish that slowly scans the sky.
  {
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.1, 6), mat(0x8a96a3)), 0, 0.55, 0));
    const head = new THREE.Group();
    head.position.y = 1.15;
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 6, 0, Math.PI * 2, 0, Math.PI / 3.2), mat(0xeef2f5, { side: THREE.DoubleSide }));
    dish.rotation.x = Math.PI * 0.75;
    head.add(dish);
    const prong = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4), mat(0x555f6a));
    prong.position.set(0, 0.0, 0.22); prong.rotation.x = Math.PI * 0.25;
    head.add(prong);
    g.add(head);
    g.position.set(L.x - 1.2, 0, L.z - 2.6);
    scene.add(shadows(g));
    movers.push((t) => { head.rotation.y = Math.sin(t * 0.3) * 1.2; });
  }
  scatter(6, 2.3, 4.5, L.x, L.z, 0.9, (x, z) => {
    if (z > L.z) return;
    const s = range(0.25, 0.4);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(s, 0), mat(choose([0x7fd1e8, 0xb39ddb, 0x80cbc4]), { emissive: 0x335577, emissiveIntensity: 0.3 }));
    crystal.position.set(x, s * 0.8, z);
    crystal.scale.y = 1.6;
    crystal.rotation.y = rnd();
    scene.add(shadows(crystal));
  });

  // ---------- Home: Boabosh's cottage, bed, food bowl ----------------------
  const H = S.home;
  {
    const house = new THREE.Group();
    house.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.2), mat(0xf2d9b3)), 0, 0.5, 0));
    // Gable roof as a 3-sided prism.
    // Turn a vertex to +x, then lay the prism on its side so that vertex is the ridge.
    const roofGeo = new THREE.CylinderGeometry(0.95, 0.95, 1.7, 3).rotateY(Math.PI / 2).rotateZ(Math.PI / 2);
    const roof = new THREE.Mesh(roofGeo, mat(0xb5523b));
    roof.position.y = 1.47;
    roof.scale.set(1, 1, 0.75);
    house.add(roof);
    house.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.22), mat(0x8e6e5a)), 0.45, 1.7, -0.2));
    // Round cat-door and a window with a flower box.
    const door = new THREE.Mesh(new THREE.CircleGeometry(0.24, 16), mat(0x5a3b22));
    door.position.set(-0.3, 0.3, 0.605);
    house.add(door);
    house.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.04), mat(0xfff1a8, { emissive: 0xffc94a, emissiveIntensity: 0.35 })), 0.35, 0.6, 0.61));
    house.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.12), wood), 0.35, 0.4, 0.66));
    for (const [x, c] of [[0.22, 0xff6b6b], [0.35, 0xffe066], [0.48, 0xc39bff]] as const) house.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), mat(c)), x, 0.48, 0.67));
    // Name plate over the door.
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.16), new THREE.MeshLambertMaterial({ map: label("BOABOSH", "#7a4a26", "#fff1c9", 256, 64, 40) }));
    plate.position.set(-0.3, 0.68, 0.61);
    house.add(plate);
    house.position.copy(HOUSE_AT);
    house.rotation.y = -0.35;
    scene.add(shadows(house));

    const bowl = new THREE.Group();
    bowl.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.12, 14), mat(0x3d7cc9)), 0, 0.06, 0));
    bowl.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 14), mat(0xc08a5a)), 0, 0.11, 0));
    const fish = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 5), mat(0xa8c6d8));
    fish.rotation.set(Math.PI / 2, 0, 0.4); fish.position.set(0.02, 0.15, 0);
    bowl.add(fish);
    bowl.position.set(H.x + 1.2, 0, H.z + 0.9);
    scene.add(shadows(bowl));

    const bed = new THREE.Group();
    bed.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.12, 8, 16), mat(0x9b59b6)), 0, 0.1, 0).rotateX(Math.PI / 2));
    bed.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.08, 16), mat(0xf5e6ff)), 0, 0.06, 0));
    bed.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mat(0xe74c3c)), 0.15, 0.16, 0.05)); // ball of yarn
    bed.position.set(H.x - 0.9, 0, H.z + 1.3); // clear of the path to the Game Garden
    scene.add(shadows(bed));
  }

  // ---------- pond with lily pads and reeds --------------------------------
  {
    const px = POND.x, pz = POND.z;
    const bank = new THREE.Mesh(new THREE.CircleGeometry(1.3, 24), mat(0xb7a77a));
    bank.rotation.x = -Math.PI / 2; bank.scale.set(1, 0.8, 1);
    bank.position.set(px, 0.015, pz);
    bank.receiveShadow = true;
    scene.add(bank);
    const waterMat = new THREE.MeshPhongMaterial({ color: 0x3f9fd6, shininess: 90, specular: 0xffffff, transparent: true, opacity: 0.85 });
    const water = new THREE.Mesh(new THREE.CircleGeometry(1.12, 24), waterMat);
    water.rotation.x = -Math.PI / 2; water.scale.set(1, 0.8, 1);
    water.position.set(px, 0.03, pz);
    water.receiveShadow = true;
    scene.add(water);
    const pads: THREE.Mesh[] = [];
    for (let k = 0; k < 5; k++) {
      const pad = new THREE.Mesh(new THREE.CircleGeometry(range(0.12, 0.2), 10, 0.3, Math.PI * 1.85), mat(0x3f8f3a));
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(px + range(-0.75, 0.75), 0.04, pz + range(-0.5, 0.5));
      scene.add(pad);
      pads.push(pad);
      if (k < 2) scene.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.08, 6), mat(0xffc0e0)), pad.position.x, 0.08, pad.position.z));
    }
    for (let k = 0; k < 9; k++) {
      const a = range(-0.6, 1.4);
      const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, range(0.5, 0.8), 4), mat(0x5c8a3a));
      reed.position.set(px + Math.cos(a) * 1.2, 0.3, pz - Math.sin(a) * 0.95);
      reed.rotation.z = range(-0.15, 0.15);
      scene.add(reed);
      if (k % 2 === 0) scene.add(at(new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.1, 2, 5), mat(0x6b4421)), reed.position.x, 0.65, reed.position.z));
    }
    movers.push((t) => {
      waterMat.color.setHSL(0.56, 0.6, 0.53 + Math.sin(t * 1.5) * 0.02);
      pads.forEach((p, k) => { p.rotation.z = Math.sin(t * 0.5 + k) * 0.2; });
    });
  }

  // ---------- clouds drifting overhead -------------------------------------
  {
    const cloudMat = mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.25 });
    const clouds: THREE.Group[] = [];
    for (let i = 0; i < 9; i++) {
      const c = new THREE.Group();
      for (let k = 0; k < 6; k++) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(range(0.8, 1.5), 1), cloudMat);
        puff.position.set(k * 0.9 - 2.5 + range(-0.3, 0.3), range(-0.2, 0.5), range(-0.5, 0.5));
        puff.scale.y = 0.65;
        c.add(puff);
      }
      c.position.set(range(-40, 40), range(10, 16), range(-45, -15));
      c.userData.speed = range(0.3, 0.7);
      scene.add(c);
      clouds.push(c);
    }
    movers.push((t) => clouds.forEach((c) => {
      c.position.x += c.userData.speed * 0.016;
      if (c.position.x > 50) c.position.x = -50;
    }));
  }

  // ---------- butterflies --------------------------------------------------
  {
    const flies: { g: THREE.Group; l: THREE.Mesh; r: THREE.Mesh; cx: number; cz: number; ph: number }[] = [];
    // Wing lies flat, sticking out along +x; flapping is a roll about the body (z).
    const wing = new THREE.CircleGeometry(0.12, 6).translate(0.11, 0, 0).rotateX(-Math.PI / 2);
    for (let i = 0; i < 7; i++) {
      const m = mat(choose([0xffb347, 0xff6b9a, 0x7ec8ff, 0xfff176, 0xb39ddb]), { side: THREE.DoubleSide });
      const g = new THREE.Group();
      const l = new THREE.Mesh(wing, m), r = new THREE.Mesh(wing, m);
      r.rotation.y = Math.PI;
      g.add(l, r);
      g.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.12, 2, 4).rotateX(Math.PI / 2), mat(0x222222)));
      scene.add(g);
      flies.push({ g, l, r, cx: range(-7, 7), cz: range(-3, 5), ph: rnd() * 10 });
    }
    movers.push((t) => flies.forEach((f) => {
      const u = t * 0.4 + f.ph;
      const x = f.cx + Math.sin(u) * 1.6, z = f.cz + Math.sin(u * 2) * 0.9;
      const nx = f.cx + Math.sin(u + 0.05) * 1.6, nz = f.cz + Math.sin((u + 0.05) * 2) * 0.9;
      f.g.position.set(x, 0.9 + Math.sin(u * 3) * 0.3, z);
      f.g.rotation.y = Math.atan2(nx - x, nz - z);
      const flap = Math.sin(t * 18 + f.ph) * 1.1;
      f.l.rotation.z = flap; f.r.rotation.z = flap; // r is mirrored by its y-turn
    }));
  }

  return (t) => movers.forEach((m) => m(t));
}
