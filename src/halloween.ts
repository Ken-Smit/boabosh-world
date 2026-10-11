// Halloween theme: on automatically in October (and on Nov 1), with a toggle.
// `dress(scene, place)` adds a hidden group of pumpkins, ghosts, bats and webs
// to a scene and remembers its colours; `setOn` shows/hides every group and
// swaps the sky and light to a purple-orange sunset and back.
//
// Nothing here is scary on purpose: smiling pumpkins, friendly ghosts that
// giggle "Boo!", bats that flap. It's for a 7-year-old.

import * as THREE from "three";
import { mat, at, shadows } from "./world.ts";
import { floater } from "./feed.ts";
import * as sfx from "./sound.ts";

export type Place = "map" | "forest" | "mountain" | "lab" | "home" | "garden";

// ---------- on / off --------------------------------------------------------------
const KEY = "catworld:halloween";
export const isSeason = (d = new Date()) => d.getMonth() === 9 || (d.getMonth() === 10 && d.getDate() === 1);
let on = (() => {
  try { const v = localStorage.getItem(KEY); if (v) return v === "on"; } catch { /* private mode */ }
  return isSeason();
})();
export const isOn = () => on;

// ---------- builders (also used by the shop's Halloween decorations) ------------------
const glow = (c = 0xffc53d) => new THREE.MeshBasicMaterial({ color: c });
const FACE_GLOW = 0xffc53d;

/** A smiling jack-o'-lantern: ribbed body, stem, glowing carved face. */
export function pumpkin(scale = 1, lit = true) {
  const g = new THREE.Group();
  const body = mat(0xff7a1a);
  for (let i = 0; i < 8; i++) {
    const rib = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), body);
    rib.scale.set(0.5, 0.78, 1);
    rib.rotation.y = (i / 8) * Math.PI;
    g.add(rib);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.14, 6), mat(0x5a7a2a));
  stem.position.set(0.01, 0.28, 0);
  stem.rotation.z = -0.25;
  g.add(stem);
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(0x3f8a3a));
  leaf.scale.set(1.4, 0.3, 0.8);
  leaf.position.set(0.08, 0.25, 0.04);
  g.add(leaf);
  if (lit) {
    const face = glow(FACE_GLOW);
    for (const x of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(new THREE.CircleGeometry(0.06, 3), face);
      eye.position.set(x, 0.06, 0.301);
      eye.rotation.z = Math.PI / 2; // point up, like carved triangles
      g.add(eye);
    }
    const nose = new THREE.Mesh(new THREE.CircleGeometry(0.03, 3), face);
    nose.position.set(0, -0.02, 0.302);
    nose.rotation.z = Math.PI / 2;
    g.add(nose);
    // A big friendly grin with two teeth gaps.
    const smile = new THREE.Shape();
    smile.moveTo(-0.15, -0.06);
    smile.quadraticCurveTo(0, -0.03, 0.15, -0.06);
    smile.quadraticCurveTo(0, -0.22, -0.15, -0.06);
    const grin = new THREE.Mesh(new THREE.ShapeGeometry(smile), face);
    grin.position.z = 0.298;
    g.add(grin);
    for (const x of [-0.05, 0.05]) g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.04), mat(0xff7a1a)), x, -0.085, 0.302));
  }
  g.scale.setScalar(scale);
  g.userData.boo = "pumpkin";
  return shadows(g);
}

/** A friendly ghost: a soft dome that flares at the bottom, big eyes, round "oo" mouth. */
export function ghost(scale = 1) {
  const g = new THREE.Group();
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) { const a = (i / 10) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.sin(a) * 0.3, 0.3 + Math.cos(a) * 0.3)); }
  pts.push(new THREE.Vector2(0.32, 0.05), new THREE.Vector2(0.4, -0.15));
  const sheet = new THREE.Mesh(new THREE.LatheGeometry(pts.reverse(), 20), mat(0xffffff, { transparent: true, opacity: 0.88, side: THREE.DoubleSide, emissive: 0xdde8ff, emissiveIntensity: 0.35 }));
  g.add(sheet);
  for (const x of [-0.09, 0.09]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mat(0x1c140e));
    eye.scale.set(1, 1.3, 0.5);
    eye.position.set(x, 0.38, 0.27);
    g.add(eye);
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff })), x - 0.012, 0.405, 0.29));
  }
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat(0x1c140e));
  mouth.scale.set(1, 1.2, 0.4);
  mouth.position.set(0, 0.27, 0.29);
  g.add(mouth);
  for (const x of [-0.17, 0.17]) g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat(0xffb3c1)), x, 0.3, 0.24)); // rosy cheeks
  g.scale.setScalar(scale);
  g.userData.boo = "ghost";
  return g;
}

/** A little bat. Its two wings are named so the update can flap them. */
export function bat(scale = 1) {
  const g = new THREE.Group();
  const black = mat(0x2a2233);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), black));
  for (const x of [-0.05, 0.05]) {
    g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 4), black), x, 0.1, 0));
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd23f })), x * 0.8, 0.02, 0.08));
  }
  const s = new THREE.Shape();
  s.moveTo(0, 0.04); s.lineTo(0.34, 0.08); s.quadraticCurveTo(0.3, 0, 0.32, -0.05);
  s.quadraticCurveTo(0.24, -0.02, 0.2, -0.07); s.quadraticCurveTo(0.14, -0.03, 0.08, -0.07); s.lineTo(0, -0.03);
  const geo = new THREE.ShapeGeometry(s);
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(geo, mat(0x3a2f48, { side: THREE.DoubleSide }));
    w.scale.x = side;
    w.position.x = side * 0.05;
    w.name = side < 0 ? "wingL" : "wingR";
    g.add(w);
  }
  g.scale.setScalar(scale);
  return g;
}

/** A witch's cauldron with glowing green brew and bubbles (named for the update). */
export function cauldron(scale = 1) {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.SphereGeometry(0.45, 18, 12, 0, Math.PI * 2, Math.PI * 0.25, Math.PI * 0.75), mat(0x2b2b33, { side: THREE.DoubleSide }));
  pot.position.y = 0.42;
  g.add(pot);
  g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.05, 8, 24).rotateX(Math.PI / 2), mat(0x3a3a44)), 0, 0.74, 0));
  g.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.31, 24).rotateX(-Math.PI / 2), glow(0x7dff6a)), 0, 0.72, 0));
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.18, 6), mat(0x2b2b33));
    leg.position.set(Math.cos(i * 2.1) * 0.28, 0.09, Math.sin(i * 2.1) * 0.28);
    g.add(leg);
  }
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), glow(0xb8ff9a));
    b.name = `bubble${i}`;
    g.add(b);
  }
  g.scale.setScalar(scale);
  g.userData.boo = "cauldron";
  return shadows(g);
}

/** A string of paper bats, for walls. */
export function batGarland(width = 4) {
  const g = new THREE.Group();
  const n = Math.round(width / 0.55);
  for (let i = 0; i <= n; i++) {
    const x = -width / 2 + (i / n) * width;
    const b = bat(0.9);
    b.position.set(x, -Math.sin((i / n) * Math.PI) * 0.35, 0);
    b.rotation.z = Math.sin(i * 1.7) * 0.2;
    g.add(b);
  }
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, width, 4).rotateZ(Math.PI / 2), mat(0xff9a3a));
  string.position.y = -0.12;
  g.add(string);
  return g;
}

/** A spider web for a corner: spokes and a spiral, drawn with lines. */
function web(size = 0.9) {
  const pts: number[] = [];
  const spokes = 7;
  for (let i = 0; i < spokes; i++) { const a = (i / (spokes - 1)) * (Math.PI / 2); pts.push(0, 0, 0, Math.cos(a) * size, -Math.sin(a) * size, 0); }
  for (let r = 0.2; r <= size; r += 0.18) {
    for (let i = 0; i < spokes - 1; i++) {
      const a1 = (i / (spokes - 1)) * (Math.PI / 2), a2 = ((i + 1) / (spokes - 1)) * (Math.PI / 2);
      pts.push(Math.cos(a1) * r, -Math.sin(a1) * r, 0, Math.cos(a2) * r, -Math.sin(a2) * r, 0);
    }
  }
  return new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)),
    new THREE.LineBasicMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0.8 }),
  );
}

// ---------- dressing a scene ---------------------------------------------------------

type Dressed = {
  scene: THREE.Scene;
  group: THREE.Group;
  update: (t: number) => void;
  setColors: (on: boolean) => void;
};
const dressed: Dressed[] = [];

const SKY_TOP = new THREE.Color(0x2b1a55), SKY_MID = new THREE.Color(0x9a4f9a), SKY_LOW = new THREE.Color(0xffa45a);

/** Remember a scene's sky/fog/light colours and how to swap them to sunset. */
function sunsetSwap(scene: THREE.Scene, outdoor: boolean) {
  if (!outdoor) return () => {};
  const bg = scene.background instanceof THREE.Color ? scene.background.clone() : null;
  const fog = scene.fog ? (scene.fog as THREE.Fog).color.clone() : null;
  const lights: [THREE.Light, THREE.Color, number, THREE.Color | null][] = [];
  let sky: THREE.BufferAttribute | null = null, skyOrig: Float32Array | null = null, skyY: Float32Array | null = null;
  scene.traverse((o) => {
    const l = o as THREE.Light;
    if ((l as THREE.DirectionalLight).isDirectionalLight || (l as THREE.HemisphereLight).isHemisphereLight) {
      lights.push([l, l.color.clone(), l.intensity, (l as THREE.HemisphereLight).groundColor?.clone() ?? null]);
    }
    const m = o as THREE.Mesh;
    if (m.isMesh && m.name === "sky") {
      sky = m.geometry.attributes.color as THREE.BufferAttribute;
      skyOrig = (sky.array as Float32Array).slice();
      skyY = (m.geometry.attributes.position!.array as Float32Array).filter((_, i) => i % 3 === 1);
    }
  });
  return (spooky: boolean) => {
    if (bg && scene.background instanceof THREE.Color) scene.background.copy(spooky ? SKY_MID : bg);
    if (fog && scene.fog) (scene.fog as THREE.Fog).color.copy(spooky ? new THREE.Color(0xe39a72) : fog);
    for (const [l, c, i, gc] of lights) {
      const hemi = (l as THREE.HemisphereLight).isHemisphereLight;
      l.color.copy(spooky ? new THREE.Color(hemi ? 0xc8a8e8 : 0xffa860) : c);
      l.intensity = spooky ? i * (hemi ? 0.85 : 0.9) : i;
      if (gc) (l as THREE.HemisphereLight).groundColor.copy(spooky ? new THREE.Color(0x6a3a4a) : gc);
    }
    if (sky && skyOrig && skyY) {
      const a = sky as THREE.BufferAttribute;
      for (let i = 0; i < a.count; i++) {
        if (!spooky) { a.setXYZ(i, skyOrig[i * 3]!, skyOrig[i * 3 + 1]!, skyOrig[i * 3 + 2]!); continue; }
        const h = skyY[i]! / 80;
        const c = h > 0.15 ? SKY_MID.clone().lerp(SKY_TOP, Math.min(1, (h - 0.15) / 0.5)) : SKY_LOW.clone().lerp(SKY_MID, Math.max(0, (h + 0.05) / 0.2));
        a.setXYZ(i, c.r, c.g, c.b);
      }
      a.needsUpdate = true;
    }
  };
}

type Layout = {
  pumpkins: [number, number, number, number?][]; // x, z, scale, facing
  ghosts: [number, number, number][]; // centre x, height, centre z
  bats: { cx: number; cz: number; r: number; y: number; n: number } | null;
  extra?: (g: THREE.Group) => void;
};

/** Pumpkins lining both sides of a path from a to b. */
function alongPath(a: THREE.Vector3, b: THREE.Vector3, at: number[]): [number, number, number, number][] {
  const dir = b.clone().sub(a).normalize(), side = new THREE.Vector3(dir.z, 0, -dir.x);
  return at.flatMap((d) => [-1, 1].map((s) => {
    const p = a.clone().addScaledVector(dir, d).addScaledVector(side, s * 0.85);
    return [p.x, p.z, 0.75, Math.atan2(-p.x * 0.2, 1)] as [number, number, number, number];
  }));
}

export type MapSpots = { home: THREE.Vector3; pads: THREE.Vector3[] };

function layout(place: Place, spots?: MapSpots): Layout {
  switch (place) {
    case "map": {
      const s = spots!;
      return {
        pumpkins: [
          ...s.pads.flatMap((p) => alongPath(s.home, p, [1.7, p.distanceTo(s.home) - 2.3])),
          [3.4, 3.4, 1.1, -0.3], [1.5, 3.6, 0.9, 0], // by the cottage
        ],
        ghosts: [[-2.2, 2.0, -1.8], [3.6, 2.3, 2.0], [-6.5, 2.6, -3.5], [-7.8, 2.6, 2.4]],
        bats: { cx: 0, cz: -2.5, r: 5.5, y: 4.2, n: 9 }, // low enough to see from the map camera
        extra: (g) => {
          g.add(at(cauldron(0.9), 1.3, 0, 1.3));
          const moon = new THREE.Mesh(new THREE.CircleGeometry(5, 32), new THREE.MeshBasicMaterial({ color: 0xfff1c0, fog: false }));
          moon.position.set(-28, 22, -60);
          moon.lookAt(0, 8, 11);
          g.add(moon);
        },
      };
    }
    case "forest":
      return { pumpkins: [[-1.7, 3.6, 0.9], [1.7, 3.6, 0.9], [-3.4, -0.2, 0.8], [2.6, -2.8, 0.8], [0.8, -2.4, 0.6]], ghosts: [[-4, 2.6, -2], [4.5, 3, -4]], bats: { cx: 0, cz: -7, r: 5, y: 9, n: 6 } };
    case "mountain":
      return { pumpkins: [[-1.6, 4.5, 0.9], [1.6, 4.5, 0.9], [-3.2, 1.0, 0.8], [3.0, -0.8, 0.8]], ghosts: [[-5, 2.5, -1]], bats: { cx: 0, cz: -6, r: 8, y: 8, n: 7 } };
    case "lab":
      return {
        pumpkins: [[-1.4, 3.6, 0.8], [1.6, 3.6, 0.8], [3.8, -2.6, 0.55]], ghosts: [[4, 3.5, 0]], bats: null,
        extra: (g) => g.add(at(batGarland(5.5), 0, 5.6, -6.4)),
      };
    case "home":
      return {
        pumpkins: [[-1.3, 3.4, 0.7], [1.3, 3.4, 0.7]], ghosts: [[-3.5, 3.4, -1], [3.8, 3.6, 1]], bats: null,
        extra: (g) => {
          const w1 = web(1.0); w1.position.set(-5.95, 4.95, -4.45); g.add(w1);
          const w2 = web(1.0); w2.position.set(5.95, 4.95, -4.45); w2.scale.x = -1; g.add(w2);
        },
      };
    case "garden":
      return { pumpkins: [[-1.6, 4.6, 0.9], [1.6, 4.6, 0.9], [-2.6, -4.2, 1.0], [2.0, -4.6, 1.0], [6.0, 2.2, 0.8]], ghosts: [[-3, 3, 1], [5.5, 3.2, -2]], bats: { cx: 0, cz: -7, r: 6, y: 6, n: 6 } };
  }
}

type Pop = { s: THREE.Sprite; born: number };

/** Add the Halloween group to a scene (hidden unless the theme is on). Call once per scene. */
export function dress(scene: THREE.Scene, place: Place, spots?: MapSpots) {
  const L = layout(place, spots);
  const group = new THREE.Group();
  group.name = "halloween";
  const pumpkins = L.pumpkins.map(([x, z, s, ry]) => { const p = pumpkin(s); p.position.set(x, 0.23 * s, z); p.rotation.y = ry ?? 0; group.add(p); return p; });
  const ghosts = L.ghosts.map(([x, y, z], i) => { const g = ghost(0.9 + (i % 2) * 0.2); g.userData.home = new THREE.Vector3(x, y, z); group.add(g); return g; });
  const bats: THREE.Group[] = [];
  if (L.bats) for (let i = 0; i < L.bats.n; i++) { const b = bat(1.2); b.userData.ph = (i / L.bats.n) * Math.PI * 2; bats.push(b); group.add(b); }
  L.extra?.(group);
  const glows = pumpkins.flatMap((p) => p.children.filter((c) => ((c as THREE.Mesh).material as THREE.Material)?.type === "MeshBasicMaterial")) as THREE.Mesh[];
  // A few real lights for the nearest pumpkins; dozens of point lights would be slow.
  const lights = pumpkins.slice(0, place === "map" ? 4 : 2).map((p) => {
    const l = new THREE.PointLight(0xff9a3a, 2.5, 3.5, 1.6);
    l.position.copy(p.position).add(new THREE.Vector3(0, 0.4, 0.4));
    group.add(l);
    return l;
  });
  const pops: Pop[] = [];
  group.userData.pops = pops;
  scene.add(group);
  const d: Dressed = {
    scene, group,
    setColors: sunsetSwap(scene, place === "map" || place === "forest" || place === "mountain" || place === "garden"),
    update: (t) => {
      const flick = 0.85 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07;
      glows.forEach((m) => (m.material as THREE.MeshBasicMaterial).color.setRGB(1, 0.62 * flick + 0.2, 0.15 * flick));
      lights.forEach((l, i) => { l.intensity = 2.5 * (flick + Math.sin(t * 9 + i) * 0.05); });
      ghosts.forEach((g, i) => {
        const h = g.userData.home as THREE.Vector3;
        const boo = t - (g.userData.booAt ?? -9);
        g.position.set(h.x + Math.sin(t * 0.5 + i) * 0.8, h.y + Math.sin(t * 1.4 + i) * 0.2 + (boo < 0.6 ? Math.sin((boo / 0.6) * Math.PI) * 0.6 : 0), h.z + Math.cos(t * 0.4 + i) * 0.5);
        g.rotation.y = boo < 0.8 ? (boo / 0.8) * Math.PI * 2 : Math.sin(t * 0.8 + i) * 0.4;
        g.rotation.z = Math.sin(t * 1.2 + i) * 0.08;
      });
      pumpkins.forEach((p) => {
        const boo = t - (p.userData.booAt ?? -9);
        p.position.y = 0.23 * p.scale.x + (boo < 0.5 ? Math.sin((boo / 0.5) * Math.PI) * 0.4 : 0);
      });
      if (L.bats) bats.forEach((b, i) => {
        const a = t * 0.6 + b.userData.ph;
        const r = L.bats!.r + Math.sin(t + i) * 0.8;
        b.position.set(L.bats!.cx + Math.cos(a) * r, L.bats!.y + Math.sin(t * 2 + i) * 0.5, L.bats!.cz + Math.sin(a) * r * 0.6);
        b.rotation.y = -a;
        const flap = Math.sin(t * 14 + i) * 0.7;
        b.getObjectByName("wingL")!.rotation.y = flap;
        b.getObjectByName("wingR")!.rotation.y = -flap;
      });
      group.traverse((o) => {
        if (!o.name.startsWith("bubble")) return;
        const k = Number(o.name.slice(6)), f = (t * 0.6 + k / 5) % 1;
        o.position.set(Math.sin(k * 2.3) * 0.15, 0.72 + f * 0.5, Math.cos(k * 1.7) * 0.15);
        o.scale.setScalar(1 - f);
      });
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i]!, a = t - p.born;
        p.s.position.y += 0.012;
        p.s.material.opacity = 1 - a / 1.4;
        if (a > 1.4) { p.s.removeFromParent(); p.s.material.map?.dispose(); p.s.material.dispose(); pops.splice(i, 1); }
      }
    },
  };
  dressed.push(d);
  group.visible = on;
  d.setColors(on);
}

export function setOn(v: boolean) {
  on = v;
  try { localStorage.setItem(KEY, v ? "on" : "off"); } catch { /* ignore */ }
  for (const d of dressed) { d.group.visible = v; d.setColors(v); }
  sfx.setSpooky(v);
  document.body.classList.toggle("halloween", v);
}

export function update(scene: THREE.Scene, t: number) {
  if (!on) return;
  for (const d of dressed) if (d.scene === scene) d.update(t);
}

/** Tap test: the ghost/pumpkin/cauldron under the ray, if any. */
export function hit(ray: THREE.Raycaster, scene: THREE.Scene): THREE.Object3D | null {
  if (!on) return null;
  const g = dressed.find((d) => d.scene === scene)?.group;
  if (!g) return null;
  for (const h of ray.intersectObject(g, true)) {
    let o: THREE.Object3D | null = h.object;
    while (o && !o.userData.boo) o = o.parent;
    if (o) return o;
  }
  return null;
}

const SAYS: Record<string, string[]> = {
  ghost: ["Boo!", "Boo! Hee hee!", "Wooo!"],
  pumpkin: ["Happy Halloween!", "Boo!", "🎃"],
  cauldron: ["Bubble bubble!", "Hee hee!"],
};
/** A friendly scare: the thing jumps or spins, says something, and makes a sound. */
export function boo(o: THREE.Object3D, t: number) {
  o.userData.booAt = t;
  const kind = o.userData.boo as string;
  (kind === "ghost" ? sfx.boo : kind === "pumpkin" ? sfx.pop : sfx.lap)();
  const lines = SAYS[kind] ?? ["Boo!"];
  const s = floater(lines[Math.floor(Math.random() * lines.length)]!, "#fff1c9", 0.35, true);
  const group = o.parent!;
  s.position.copy(o.position).add(new THREE.Vector3(0, 0.9, 0));
  group.add(s);
  (group.userData.pops as Pop[] | undefined)?.push({ s, born: t });
}
