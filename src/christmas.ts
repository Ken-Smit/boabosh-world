// Christmas theme: on by itself from Nov 1 through Jan 6, with a toggle.
// `dress(scene, place)` adds a hidden group of trees, snowmen, presents, candy
// canes and falling snow to a scene and remembers its colours; `setOn` shows/hides
// every group and swaps grass and sky to snow and back. Mirrors halloween.ts.

import * as THREE from "three";
import { mat, at, shadows } from "./world.ts";
import { floater } from "./feed.ts";
import * as sfx from "./sound.ts";
import { offMark, seasonOf, themeOn } from "./season.ts";
import type { Place as WorldPlace, MapSpots } from "./halloween.ts";
import { ARENA } from "./lasertag.ts";
import { LANE } from "./yarnroll.ts";

type Place = WorldPlace | "arena" | "lane";

// ---------- on / off --------------------------------------------------------------
const KEY = "catworld:christmas";
export const isSeason = (d = new Date()) => seasonOf(d) === "christmas";
let on = (() => {
  try { return themeOn("christmas", localStorage.getItem(KEY)); } catch { /* private mode */ }
  return isSeason();
})();
export const isOn = () => on;

// ---------- builders (also used by the shop's Christmas decorations) ------------------
const glow = (c: number) => new THREE.MeshBasicMaterial({ color: c });

/** A soft round dot, shared by snow and fairy lights. */
const dot = (() => {
  let tex: THREE.CanvasTexture | null = null;
  return () => {
    if (tex) return tex;
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d")!, r = g.createRadialGradient(16, 16, 2, 16, 16, 16);
    r.addColorStop(0, "#fff"); r.addColorStop(0.55, "rgba(255,255,255,.9)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 32, 32);
    return (tex = new THREE.CanvasTexture(c));
  };
})();

// Bulbs are points in two sets that take turns glowing: one draw call per set, no real lights.
const bulbMats: THREE.PointsMaterial[] = [];
const bulbMat = (i: number) => (bulbMats[i] ??= new THREE.PointsMaterial({ size: 0.26, map: dot(), vertexColors: true, transparent: true, depthWrite: false, fog: false }));
const BULBS = [0xff3b3b, 0xffd23f, 0x4fd16a, 0x5ab8ff, 0xff8fd0].map((c) => new THREE.Color(c));
/** Fairy-light points at these spots. */
function bulbs(spots: THREE.Vector3[]) {
  const g = new THREE.Group();
  [0, 1].forEach((set) => {
    const mine = spots.filter((_, i) => i % 2 === set);
    const geo = new THREE.BufferGeometry().setFromPoints(mine);
    geo.setAttribute("color", new THREE.Float32BufferAttribute(mine.flatMap((_, i) => BULBS[(i * 2 + set) % BULBS.length]!.toArray()), 3));
    const p = new THREE.Points(geo, bulbMat(set));
    p.raycast = () => {}; // never catches a tap
    g.add(p);
  });
  return g;
}
/** Make the fairy lights take turns. */
export const twinkle = (t: number) => bulbMats.forEach((m, i) => { m.opacity = 0.65 + Math.sin(t * 3 + i * Math.PI) * 0.35; });

/** A decorated tree with fairy lights and a glowing star. About 2.9 tall at scale 1. */
export function christmasTree(scale = 1) {
  const g = new THREE.Group();
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.4, 8), mat(0x6b4a2b)), 0, 0.2, 0));
  const green = mat(0x2f8a4a), snow = mat(0xf4fafc);
  for (const [y, r, h] of [[0.85, 0.95, 1.1], [1.5, 0.75, 1.0], [2.1, 0.52, 0.85]] as const) {
    g.add(at(new THREE.Mesh(new THREE.ConeGeometry(r, h, 12), green), 0, y, 0));
    g.add(at(new THREE.Mesh(new THREE.ConeGeometry(r * 0.42, h * 0.42, 12), snow), 0, y + h * 0.3, 0)); // snow on each tier
  }
  const spots: THREE.Vector3[] = [];
  for (let i = 0; i < 34; i++) {
    const u = i / 34, a = i * 2.4, r = 0.95 * (1 - u) + 0.06;
    spots.push(new THREE.Vector3(Math.sin(a) * r, 0.4 + u * 2.15, Math.cos(a) * r));
  }
  g.add(bulbs(spots));
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.09 : 0.21;
    s[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r);
  }
  const star = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }).translate(0, 0, -0.025), glow(0xffd23f));
  star.position.y = 2.72;
  g.add(star);
  g.scale.setScalar(scale);
  return shadows(g);
}

/** A jolly snowman with a scarf and a top hat, looking at +z. Tap him! */
export function snowman(scale = 1) {
  const g = new THREE.Group();
  const white = mat(0xffffff), coal = mat(0x23232b);
  for (const [y, r] of [[0.36, 0.42], [0.95, 0.31], [1.4, 0.23]] as const) g.add(at(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), white), 0, y, 0));
  for (const x of [-0.08, 0.08]) g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), coal), x, 1.46, 0.2));
  for (let i = -2; i <= 2; i++) g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), coal), i * 0.05, 1.3 + Math.abs(i) * 0.015, 0.2)); // a coal smile
  for (const y of [1.05, 0.9]) g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), coal), 0, y, 0.3));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 8).rotateX(Math.PI / 2), mat(0xff8a1f));
  g.add(at(nose, 0, 1.4, 0.3));
  g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 18).rotateX(Math.PI / 2), mat(0xd62839)), 0, 1.2, 0));
  g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.05), mat(0xd62839)), 0.12, 1.06, 0.22));
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 16), coal), 0, 1.58, 0));
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.24, 16), coal), 0, 1.7, 0));
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.55, 5), mat(0x6b4a2b));
    arm.position.set(s * 0.46, 1.08, 0);
    arm.rotation.z = -s * 0.95;
    g.add(arm);
  }
  g.scale.setScalar(scale);
  g.userData.boo = "snowman";
  return shadows(g);
}

const WRAPS: [number, number][] = [[0xd62839, 0xffd23f], [0x2f8a4a, 0xffffff], [0x3a7bd5, 0xffffff], [0xffd23f, 0xd62839], [0xff8fd0, 0xffffff]];
/** A wrapped present with a ribbon and bow. `n` picks the paper. Tap it! */
export function present(scale = 1, n = 0) {
  const g = new THREE.Group();
  const [paper, tie] = WRAPS[n % WRAPS.length]!, ribbon = mat(tie);
  g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), mat(paper)), 0, 0.2, 0));
  g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.41, 0.09), ribbon), 0, 0.2, 0));
  g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.41, 0.52), ribbon), 0, 0.2, 0));
  for (const s of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), ribbon);
    loop.scale.set(1.2, 0.7, 0.6);
    g.add(at(loop, s * 0.08, 0.44, 0));
  }
  g.scale.setScalar(scale);
  g.userData.boo = "present";
  return shadows(g);
}

// One striped tube, shared by every cane.
let caneGeo: THREE.BufferGeometry | null = null;
function makeCaneGeo() {
  const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.75, 0)];
  for (let i = 1; i <= 8; i++) { const a = (i / 8) * Math.PI; pts.push(new THREE.Vector3(0.14 - Math.cos(a) * 0.14, 0.75 + Math.sin(a) * 0.14, 0)); }
  const segs = 40, radial = 8;
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segs, 0.05, radial);
  const red = new THREE.Color(0xd62839), white = new THREE.Color(0xffffff), cols: number[] = [];
  for (let s = 0; s <= segs; s++) for (let r = 0; r <= radial; r++) cols.push(...(Math.floor(s / 3 + r / radial) % 2 ? red : white).toArray());
  return geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
}
/** A red and white candy cane stuck in the snow. */
export function candyCane(scale = 1) {
  const m = new THREE.Mesh(caneGeo ??= makeCaneGeo(), mat(0xffffff, { vertexColors: true }));
  m.scale.setScalar(scale);
  m.castShadow = true;
  return m;
}

/** A string of fairy lights, sagging between two ends `width` apart, for walls. */
export function stringLights(width = 4, sag = 0.35) {
  const n = Math.round(width / 0.32), spots: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) spots.push(new THREE.Vector3(-width / 2 + (i / n) * width, -Math.sin((i / n) * Math.PI) * sag, 0));
  const g = bulbs(spots);
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(spots), new THREE.LineBasicMaterial({ color: 0x2b5a35 })));
  return g;
}

/** Fairy lights hung between two candy-striped poles, for outdoors. */
function lightArch(width: number) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const pole = candyCane(2.4);
    pole.position.x = (s * width) / 2;
    pole.rotation.y = s > 0 ? Math.PI : 0;
    g.add(pole);
  }
  g.add(at(stringLights(width, 0.45), 0, 2.1, 0));
  return g;
}

/** Stockings hanging in a row, for a wall. */
export function stockings() {
  const g = new THREE.Group();
  [0xd62839, 0x2f8a4a, 0xd62839].forEach((c, i) => {
    const s = new THREE.Group();
    s.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.08), mat(c)), 0, -0.2, 0));
    s.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.08), mat(c)), 0.05, -0.41, 0));
    s.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.1), mat(0xffffff)), 0, 0, 0));
    s.position.x = (i - 1) * 0.5;
    g.add(s);
  });
  g.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.1), mat(0x8b5a2b)), 0, 0.09, 0));
  return g;
}

/** Snow piled against a window pane, drawn over the room's view. */
function snowyPane(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.beginPath(); g.moveTo(0, 128); g.lineTo(0, 92);
  g.quadraticCurveTo(32, 74, 64, 94); g.quadraticCurveTo(96, 110, 128, 86);
  g.lineTo(128, 128); g.fill();
  for (let i = 0; i < 26; i++) { g.beginPath(); g.arc((i * 47) % 128, (i * 29) % 88, 1.5 + (i % 3) * 0.6, 0, 7); g.fill(); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  m.userData.outlineParameters = { visible: false };
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
}

// ---------- falling snow: one THREE.Points per scene ----------------------------------
function makeSnow(n: number, box: [number, number, number], centre: [number, number], size: number) {
  const pos = new Float32Array(n * 3);
  const seeds = Array.from({ length: n }, () => [Math.random() * box[0] * 2 - box[0], Math.random() * box[1], Math.random() * box[2] * 2 - box[2], 0.5 + Math.random() * 0.6, Math.random() * 6.28] as const);
  const geo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: dot(), color: 0xffffff, transparent: true, depthWrite: false, opacity: 0.95 }));
  points.frustumCulled = false; // the flakes move, so the bounding sphere would go stale
  points.raycast = () => {};
  points.position.set(centre[0], 0, centre[1]);
  const fall = (t: number) => {
    for (let i = 0; i < n; i++) {
      const [x, y, z, speed, ph] = seeds[i]!;
      pos[i * 3] = x + Math.sin(t * 0.7 + ph) * 0.35;
      pos[i * 3 + 1] = (((y - t * speed) % box[1]) + box[1]) % box[1];
      pos[i * 3 + 2] = z + Math.cos(t * 0.5 + ph) * 0.25;
    }
    geo.attributes.position!.needsUpdate = true;
  };
  fall(0);
  return { points, fall };
}

// ---------- dressing a scene ---------------------------------------------------------

type Dressed = {
  scene: THREE.Scene;
  group: THREE.Group;
  update: (t: number) => void;
  setColors: (on: boolean) => void;
};
const dressed: Dressed[] = [];

const SKY_TOP = new THREE.Color(0x6ea6dc), SKY_MID = new THREE.Color(0xc4def2), SKY_LOW = new THREE.Color(0xf2f7fb), FOG = new THREE.Color(0xe4eff7);
const SNOW = new THREE.Color(0xf6fafd), SNOW_BLUE = new THREE.Color(0xdde9f4), FROST = new THREE.Color(0xe9f3f2);

/** Remember a scene's colours and how to swap them to winter: sky, light, snowy ground, frosted greens. */
function winterSwap(scene: THREE.Scene) {
  const bg = scene.background instanceof THREE.Color ? scene.background.clone() : null;
  const fog = scene.fog ? (scene.fog as THREE.Fog).color.clone() : null;
  const lights: [THREE.Light, THREE.Color, number, THREE.Color | null][] = [];
  const attrs: [THREE.BufferAttribute, Float32Array, Float32Array][] = []; // [colours, summer, winter]
  const mats = new Map<THREE.MeshToonMaterial, [THREE.Color, THREE.Color]>();
  const summery: THREE.Object3D[] = [];
  const swapAttr = (a: THREE.BufferAttribute, paint: (r: number, g: number, b: number, i: number) => THREE.Color) => {
    const summer = (a.array as Float32Array).slice(), winter = summer.slice();
    for (let i = 0; i < a.count; i++) paint(summer[i * 3]!, summer[i * 3 + 1]!, summer[i * 3 + 2]!, i).toArray(winter, i * 3);
    attrs.push([a, summer, winter]);
  };
  scene.traverse((o) => {
    const l = o as THREE.Light;
    if ((l as THREE.DirectionalLight).isDirectionalLight || (l as THREE.HemisphereLight).isHemisphereLight) {
      lights.push([l, l.color.clone(), l.intensity, (l as THREE.HemisphereLight).groundColor?.clone() ?? null]);
    }
    if (o.name === "summery") summery.push(o);
    const m = o as THREE.Mesh;
    if (!m.isMesh || o.userData.area) return; // the map's pads keep their colours
    const colours = m.geometry.attributes.color as THREE.BufferAttribute | undefined;
    if (m.name === "sky" && colours) {
      const y = m.geometry.attributes.position!;
      swapAttr(colours, (_r, _g, _b, i) => {
        const h = y.getY(i) / 80;
        return h > 0.1 ? SKY_MID.clone().lerp(SKY_TOP, Math.min(1, (h - 0.1) / 0.6)) : SKY_LOW.clone().lerp(SKY_MID, Math.max(0, (h + 0.05) / 0.15));
      });
      return;
    }
    const inst = (m as THREE.InstancedMesh).instanceColor;
    if (inst) swapAttr(inst as THREE.BufferAttribute, (r, g, b) => new THREE.Color(r, g, b).lerp(FROST, 0.72)); // grass, flowers, leaves
    const material = m.material as THREE.MeshToonMaterial;
    if (!material.isMeshToonMaterial) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox!;
    const big = bb.max.x - bb.min.x >= 30; // only the ground is this wide
    if (big && colours) swapAttr(colours, (_r, _g, _b, i) => SNOW.clone().lerp(SNOW_BLUE, ((i * 37) % 11) / 11));
    else if (big) mats.set(material, [material.color.clone(), SNOW]);
    else if (!mats.has(material) && !material.vertexColors) { // green things get a frosting
      const c = material.color;
      if (c.g > c.r * 1.15 && c.g > c.b * 1.15) mats.set(material, [c.clone(), c.clone().lerp(FROST, 0.6)]);
    }
  });
  return (cold: boolean) => {
    if (bg && scene.background instanceof THREE.Color) scene.background.copy(cold ? SKY_MID : bg);
    if (fog && scene.fog) (scene.fog as THREE.Fog).color.copy(cold ? FOG : fog);
    for (const [l, c, i, gc] of lights) {
      const hemi = (l as THREE.HemisphereLight).isHemisphereLight;
      l.color.copy(cold ? new THREE.Color(hemi ? 0xe6f1ff : 0xfff3e2) : c);
      l.intensity = cold ? i * (hemi ? 1.05 : 0.8) : i;
      if (gc) (l as THREE.HemisphereLight).groundColor.copy(cold ? new THREE.Color(0xb4c6dc) : gc);
    }
    for (const [a, summer, winter] of attrs) { (a.array as Float32Array).set(cold ? winter : summer); a.needsUpdate = true; }
    for (const [m, [summer, winter]] of mats) m.color.copy(cold ? winter : summer);
    for (const o of summery) o.visible = !cold;
  };
}

type Spot = [number, number, number, number?]; // x, z, scale, facing
type Layout = {
  trees: Spot[];
  snowmen: Spot[];
  presents: Spot[];
  canes: Spot[];
  arch?: [number, number, number]; // x, z, width
  snow: { n: number; box: [number, number, number]; centre: [number, number]; size: number };
  extra?: (g: THREE.Group) => void;
};

/** Candy canes lining both sides of a path from a to b. */
function alongPath(a: THREE.Vector3, b: THREE.Vector3, along: number[]): Spot[] {
  const dir = b.clone().sub(a).normalize(), side = new THREE.Vector3(dir.z, 0, -dir.x);
  return along.flatMap((d) => [-1, 1].map((s) => {
    const p = a.clone().addScaledVector(dir, d).addScaledVector(side, s * 0.85);
    return [p.x, p.z, 0.8, s > 0 ? 0 : Math.PI] as Spot;
  }));
}

const OUTSIDE: Layout["snow"] = { n: 350, box: [15, 13, 12], centre: [1, 0], size: 0.15 };
const INSIDE: Layout["snow"] = { n: 70, box: [6, 5, 4], centre: [0, 0], size: 0.09 }; // a little magic indoor snow

function layout(place: Place, spots?: MapSpots): Layout {
  switch (place) {
    case "arena": { // all outside the walls, so nothing gets in the way of playing
      const x = ARENA.hw + 1.6, z = -ARENA.hd - 1.4;
      return {
        trees: [[-x, z, 1.3], [x, z, 1.3]],
        snowmen: [],
        presents: [[-x + 2.4, z, 0.8], [x - 2.4, z, 0.8]],
        canes: [[-x + 0.8, ARENA.hd - 1, 1], [x - 0.8, ARENA.hd - 1, 1]],
        snow: { n: 300, box: [ARENA.hw * 2 + 6, 8, ARENA.hd * 2 + 6], centre: [0, 0], size: 0.16 },
      };
    }
    case "lane": { // all beside the bumpers, so nothing gets in the way of rolling
      const x = LANE.hw + 1.7;
      return {
        trees: [[-x - 0.6, LANE.far + 0.2, 1.3], [x + 0.6, LANE.far + 0.2, 1.3], [x + 2.6, -1, 1]],
        snowmen: [[x + 0.3, 1.8, 0.8, -0.5]],
        presents: [[-x + 0.2, -1.7, 0.8], [x - 0.5, -2, 0.8], [x + 0.5, -2.9, 0.65]],
        canes: [[-LANE.hw - 0.75, LANE.near + 0.9, 1.1], [LANE.hw + 0.75, LANE.near + 0.9, 1.1], [-LANE.hw - 0.75, LANE.far, 1.1], [LANE.hw + 0.75, LANE.far, 1.1]],
        snow: { n: 260, box: [11, 9, 9], centre: [0, -0.5], size: 0.16 },
      };
    }
    case "map": {
      const s = spots!;
      return {
        trees: [[7.6, 3.4, 1.2], [-7.6, 2.0, 1.1], [-8.2, -2.4, 1.3], [8.3, -2.6, 1.25]],
        snowmen: [[2.4, 1.3, 0.8, -0.2], [-2.3, 0.7, 0.8, 0.2], [6.0, 3.6, 0.8, -0.3]],
        presents: [[6.7, 4.3, 0.8], [8.3, 4.4, 0.7], [-6.8, 2.8, 0.75], [3.5, 3.1, 0.8], [1.5, 3.2, 0.7]],
        canes: s.pads.flatMap((p) => alongPath(s.home, p, [1.7, p.distanceTo(s.home) - 2.3])),
        arch: [0, -0.4, 2.6], // a gateway over the mountain path
        snow: { n: 600, box: [20, 12, 15], centre: [0, -1], size: 0.2 },
      };
    }
    case "forest":
      return {
        trees: [[-5.6, -1.2, 1.1], [6.6, -2.8, 1.2]],
        snowmen: [[-4.6, 0.6, 0.85, 0.4], [5.0, 1.6, 0.85, -0.4]],
        presents: [[-3.4, -0.8, 0.8], [4.3, -1.5, 0.75], [-1.7, 3.6, 0.7]],
        canes: [[-2.2, 3.0, 1], [3.4, 3.0, 1], [2.6, -2.8, 1]],
        arch: [-4.5, -3.5, 4],
        snow: OUTSIDE,
      };
    case "mountain":
      return {
        trees: [[-4.8, -2.6, 1.05], [5.6, -3.4, 1.1]],
        snowmen: [[-3.2, 1.0, 0.85, 0.4]],
        presents: [[3.0, -0.8, 0.8], [-1.6, 4.5, 0.7], [-4.0, -1.8, 0.7]],
        canes: [[1.6, 4.5, 1], [-1.6, 3.0, 0.9], [3.8, 1.5, 1]],
        arch: [3.4, -4.4, 4],
        snow: { ...OUTSIDE, n: 200 }, // the mountain already has its own snow
      };
    case "lab":
      return {
        trees: [[-3.9, -5.2, 1.1]],
        snowmen: [[-5.2, 1.2, 0.8, 0.5]],
        presents: [[-2.9, -4.7, 0.7], [-1.4, 3.6, 0.7], [1.6, 3.6, 0.7]],
        canes: [],
        snow: { ...INSIDE, box: [7, 6, 5], centre: [0, -1] },
        extra: (g) => {
          g.add(at(stringLights(5.5), 0, 5.6, -6.4));
          for (const x of [-6, 6]) g.add(at(snowyPane(2.4, 3.6), x, 3.4, -6.47));
        },
      };
    case "home":
      return {
        trees: [[5.1, 0.2, 0.75]],
        snowmen: [],
        presents: [[-1.3, 3.4, 0.65], [1.3, 3.4, 0.65], [4.4, 1.0, 0.55]],
        canes: [],
        snow: INSIDE,
        extra: (g) => {
          g.add(at(stringLights(8, 0.3), -1, 4.6, -4.42));
          g.add(at(snowyPane(2.6, 2.4), 2.4, 2.6, -4.47));
        },
      };
    case "garden":
      return {
        trees: [[-4.8, -3.6, 1.15], [7.0, -3.0, 1.1]],
        snowmen: [[-4.2, 1.8, 0.85, 0.4], [6.0, 2.2, 0.85, -0.4]],
        presents: [[-2.6, -4.2, 0.8], [2.0, -4.6, 0.8], [-1.6, 4.6, 0.7]],
        canes: [[1.6, 4.6, 1], [-3.2, 3.8, 0.9], [4.6, 3.8, 0.9]],
        snow: OUTSIDE,
      };
  }
}

type Pop = { s: THREE.Sprite; born: number };

/** Add the Christmas group to a scene (hidden unless the theme is on). Call once per scene. */
export function dress(scene: THREE.Scene, place: Place, spots?: MapSpots) {
  if (!isSeason()) return; // nothing to build the rest of the year
  const outdoor = place === "map" || place === "forest" || place === "mountain" || place === "garden";
  const setColors = outdoor ? winterSwap(scene) : () => {}; // before our own green trees join the scene
  const L = layout(place, spots);
  const group = new THREE.Group();
  group.name = "christmas";
  const put = (o: THREE.Object3D, [x, z, , ry]: Spot) => { o.position.set(x, 0, z); o.rotation.y = ry ?? 0; group.add(o); return o; };
  const trees = L.trees.map((s) => put(christmasTree(s[2]), s));
  const hoppers = [...L.snowmen.map((s) => put(snowman(s[2]), s)), ...L.presents.map((s, i) => put(present(s[2], i), s))];
  L.canes.forEach((s) => put(candyCane(s[2]), s));
  if (L.arch) group.add(at(lightArch(L.arch[2]), L.arch[0], 0, L.arch[1]));
  L.extra?.(group);
  // A warm glow by the nearest trees; lots of point lights would be slow.
  trees.slice(0, 2).forEach((tr) => {
    const l = new THREE.PointLight(0xffd9a0, 2.5, 4.5, 1.6);
    l.position.copy(tr.position).add(new THREE.Vector3(0, 1.1, 1));
    group.add(l);
  });
  const { points, fall } = makeSnow(L.snow.n, L.snow.box, L.snow.centre, L.snow.size);
  group.add(points);
  const pops: Pop[] = [];
  group.userData.pops = pops;
  scene.add(group);
  const d: Dressed = {
    scene, group, setColors,
    update: (t) => {
      twinkle(t);
      fall(t);
      for (const o of hoppers) {
        const a = t - (o.userData.booAt ?? -9);
        o.position.y = a < 0.5 ? Math.sin((a / 0.5) * Math.PI) * 0.45 : 0;
        if (o.userData.boo === "snowman") o.rotation.z = a < 0.8 ? Math.sin((a / 0.8) * Math.PI * 4) * 0.15 : 0; // a happy wiggle
      }
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

/** Show the current state everywhere, without saving anything. */
export function apply() {
  for (const d of dressed) { d.group.visible = on; d.setColors(on); }
  sfx.setJolly(on);
  document.body.classList.toggle("christmas", on);
}

export function setOn(v: boolean) {
  on = v;
  try { localStorage.setItem(KEY, v ? "on" : offMark()); } catch { /* ignore */ }
  apply();
}

export function update(scene: THREE.Scene, t: number) {
  if (!on) return;
  for (const d of dressed) if (d.scene === scene) d.update(t);
}

/** Tap test: the snowman/present under the ray, if any. */
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
  snowman: ["Ho ho ho!", "Merry Christmas!", "Brrr! Hee hee!"],
  present: ["Jingle!", "🎁 Surprise!", "Jingle jingle!"],
};
/** A friendly surprise: the thing hops, says something, and makes a sound. */
export function boo(o: THREE.Object3D, t: number) {
  o.userData.booAt = t;
  const kind = o.userData.boo as string;
  (kind === "snowman" ? sfx.hoHoHo : sfx.jingle)();
  const lines = SAYS[kind] ?? ["Jingle!"];
  const s = floater(lines[Math.floor(Math.random() * lines.length)]!, "#c8102e", 0.45, true); // red shows up on snow
  s.material.depthTest = false; // always readable, even behind a tree
  s.renderOrder = 9;
  const group = o.parent!;
  s.position.copy(o.position).add(new THREE.Vector3(0, kind === "snowman" ? 2 : 0.9, 0));
  group.add(s);
  (group.userData.pops as Pop[] | undefined)?.push({ s, born: t });
}
