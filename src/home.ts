// The cats' home: a cozy room. The bed, bowls, litter box, wallpaper, floor,
// rug and decorations are rebuilt from the save by `apply`, so whatever the
// player buys and picks shows up here. Also shows care at a glance: the water
// level, litter clumps, and the other cats lounging about.

import * as THREE from "three";
import type { AreaScene } from "./areas.ts";
import { makeCat, dress, type Cat } from "./cat.ts";
import { BY_ID, COATS, type ShopItem } from "./shop.ts";
import { activeCat, needs, type State } from "./state.ts";
import { toonify } from "./toon.ts";
import { mat, at, shadows, leafMats, label } from "./world.ts";
import { pumpkin, cauldron, batGarland } from "./halloween.ts";

export type HomeScene = AreaScene & {
  apply: (s: State, now?: number) => void;
  /** Where the cat stands to use each thing, and which way it faces. */
  spots: Record<"food" | "water" | "bed" | "litter" | "center" | "scratch", { at: THREE.Vector3; face: number }>;
  bedTop: () => number;
  /** The other (not active) cats, for tapping. */
  others: () => { id: string; group: THREE.Group }[];
  litterTray: THREE.Vector3;
};

const W = 12, D = 9, H = 5;
const BED = new THREE.Vector3(-3.4, 0, -2.3);
const FOOD = new THREE.Vector3(2.0, 0, 0.4);
const WATER = new THREE.Vector3(3.1, 0, 0.4);
const LITTER = new THREE.Vector3(4.7, 0, -3.3);

// ---------- textures -------------------------------------------------------------

function canvasTex(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, repeat = 1) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}
const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

function wallTex(it: ShopItem) {
  const a = hex(it.color ?? 0xf6e7cf), b = hex(it.color2 ?? 0xffffff);
  return canvasTex(256, (g, s) => {
    g.fillStyle = a; g.fillRect(0, 0, s, s);
    g.fillStyle = b; g.strokeStyle = b;
    switch (it.style) {
      case "stripes": for (let x = 0; x < s; x += 64) g.fillRect(x, 0, 28, s); break;
      case "dots": for (let y = 16; y < s; y += 64) for (let x = (y / 64) % 2 ? 48 : 16; x < s; x += 64) { g.beginPath(); g.arc(x, y, 10, 0, 7); g.fill(); } break;
      case "stars":
        g.font = "28px sans-serif";
        for (let i = 0; i < 14; i++) g.fillText("★", (i * 73) % s, (i * 131) % s + 20);
        break;
      case "planks": g.lineWidth = 3; for (let x = 0; x < s; x += 42) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, s); g.stroke(); } break;
      case "gradient": { const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, s, s); break; }
      case "fish":
        g.font = "34px sans-serif";
        for (let i = 0; i < 8; i++) g.fillText("🐟", ((i * 97) % s) - 10, ((i * 61) % s) + 30);
        break;
    }
  }, 3);
}

function floorTex(it: ShopItem) {
  const a = hex(it.color ?? 0xb07a4a), b = hex(it.color2 ?? 0x9a6a3e);
  return canvasTex(256, (g, s) => {
    g.fillStyle = a; g.fillRect(0, 0, s, s);
    switch (it.style) {
      case "planks":
        g.strokeStyle = b; g.lineWidth = 4;
        for (let y = 0; y < s; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke(); g.beginPath(); const x = ((y / 32) * 97) % s; g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); }
        break;
      case "check": g.fillStyle = b; g.fillRect(0, 0, s / 2, s / 2); g.fillRect(s / 2, s / 2, s / 2, s / 2); break;
      case "grass": g.strokeStyle = b; g.lineWidth = 2; for (let i = 0; i < 400; i++) { const x = (i * 37) % s, y = (i * 53) % s; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 2, y - 8); g.stroke(); } break;
      case "marble": g.strokeStyle = b; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, i * 50); g.bezierCurveTo(80, i * 50 + 30, 160, i * 50 - 20, s, i * 50 + 10); g.stroke(); } break;
      default: for (let i = 0; i < 300; i++) { g.fillStyle = "rgba(255,255,255,0.06)"; g.fillRect((i * 37) % s, (i * 59) % s, 2, 2); } // carpet fuzz
    }
  }, 4);
}

/** The view out of the window: anime sky, trees and rooftops. */
function windowView() {
  return canvasTex(512, (g, s) => {
    const sky = g.createLinearGradient(0, 0, 0, s);
    sky.addColorStop(0, "#5aa7e8"); sky.addColorStop(0.6, "#bfe3f7"); sky.addColorStop(1, "#f6ecd8");
    g.fillStyle = sky; g.fillRect(0, 0, s, s);
    g.fillStyle = "rgba(255,255,255,0.9)";
    for (const [x, y, r] of [[90, 90, 40], [130, 80, 50], [175, 95, 36], [380, 60, 34], [420, 50, 44], [455, 66, 30]]) { g.beginPath(); g.arc(x!, y!, r!, 0, 7); g.fill(); }
    g.fillStyle = "#6f9c8a"; // far roofs
    for (const [x, w, h] of [[20, 140, 120], [300, 180, 150]]) { g.fillRect(x!, s - h!, w!, h!); g.beginPath(); g.moveTo(x! - 15, s - h!); g.lineTo(x! + w! / 2, s - h! - 50); g.lineTo(x! + w! + 15, s - h!); g.fill(); }
    g.fillStyle = "#4f8f4a";
    for (const [x, y, r] of [[200, 330, 70], [250, 290, 80], [470, 320, 70], [30, 360, 60]]) { g.beginPath(); g.arc(x!, y!, r!, 0, 7); g.fill(); }
  });
}

// ---------- furniture builders -------------------------------------------------------

const cyl = (rt: number, rb: number, h: number, c: number, seg = 20, open = false) =>
  new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat(c, open ? { side: THREE.DoubleSide } : {}));
const ball = (r: number, c: number) => new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(c));
const box = (w: number, h: number, d: number, c: number) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));

const BEDS: Record<string, (c1: number, c2: number) => { g: THREE.Group; top: number }> = {
  basket: (c1, c2) => {
    const g = new THREE.Group();
    g.add(at(cyl(0.7, 0.6, 0.38, c1, 24, true), 0, 0.19, 0));
    for (let i = 0; i < 4; i++) g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.62 + i * 0.025, 0.018, 4, 32).rotateX(Math.PI / 2), mat(new THREE.Color(c1).multiplyScalar(0.85).getHex())), 0, 0.06 + i * 0.1, 0));
    g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 6, 32).rotateX(Math.PI / 2), mat(c1)), 0, 0.38, 0));
    const cushion = ball(0.6, c2); cushion.scale.y = 0.25; g.add(at(cushion, 0, 0.18, 0));
    return { g, top: 0.24 };
  },
  cushion: (c1, c2) => {
    const g = new THREE.Group();
    const c = ball(0.75, c1); c.scale.set(1, 0.3, 0.85); g.add(at(c, 0, 0.2, 0));
    g.add(at(ball(0.06, c2), 0, 0.42, 0));
    for (const [x, z] of [[-0.6, -0.5], [0.6, -0.5], [-0.6, 0.5], [0.6, 0.5]] as const) g.add(at(ball(0.08, c2), x, 0.12, z));
    return { g, top: 0.36 };
  },
  donut: (c1, c2) => {
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.22, 12, 32).rotateX(Math.PI / 2), mat(c1)), 0, 0.2, 0));
    g.add(at(cyl(0.5, 0.5, 0.12, c2, 24), 0, 0.08, 0));
    return { g, top: 0.15 };
  },
  box: (c1) => {
    const g = new THREE.Group();
    const dark = new THREE.Color(c1).multiplyScalar(0.85).getHex();
    g.add(at(box(1.2, 0.04, 0.9, dark), 0, 0.02, 0));
    for (const [x, z, w, d] of [[0, 0.45, 1.2, 0.04], [0, -0.45, 1.2, 0.04], [0.6, 0, 0.04, 0.9], [-0.6, 0, 0.04, 0.9]] as const) g.add(at(box(w, 0.5, d, c1), x, 0.25, z));
    const flap = box(1.2, 0.04, 0.4, c1); flap.position.set(0, 0.55, -0.6); flap.rotation.x = -0.7; g.add(flap);
    g.add(at(box(0.3, 0.06, 0.005, 0x8a5a2b), 0, 0.35, 0.455)); // "tape"
    return { g, top: 0.05 };
  },
  cloud: (c1, c2) => {
    const g = new THREE.Group();
    for (const [x, z, r] of [[0, 0, 0.5], [-0.45, 0.1, 0.38], [0.45, 0.05, 0.4], [0.1, -0.35, 0.36], [-0.2, 0.35, 0.33]] as const) { const p = ball(r, c1); p.scale.y = 0.5; g.add(at(p, x, 0.2, z)); }
    const pillow = ball(0.22, c2); pillow.scale.set(1.3, 0.4, 0.8); g.add(at(pillow, 0, 0.42, -0.3));
    return { g, top: 0.42 };
  },
  canopy: (c1, c2) => {
    const g = BEDS.cushion!(c1, c2).g;
    for (const [x, z] of [[-0.7, -0.6], [0.7, -0.6], [-0.7, 0.6], [0.7, 0.6]] as const) g.add(at(cyl(0.03, 0.03, 2.0, 0xffffff, 8), x, 1.0, z));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.7, 4, 1, true), mat(c1, { side: THREE.DoubleSide }));
    roof.rotation.y = Math.PI / 4;
    g.add(at(roof, 0, 2.3, 0));
    for (const x of [-0.7, 0.7]) {
      const drape = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 1.8), mat(c2, { side: THREE.DoubleSide, transparent: true, opacity: 0.7 }));
      g.add(at(drape, x, 1.1, 0.62));
    }
    return { g, top: 0.36 };
  },
  castle: (c1, c2) => {
    const g = new THREE.Group();
    g.add(at(box(1.5, 0.3, 1.1, c1), 0, 0.15, 0));
    const pad = ball(0.55, 0xf3e2c3); pad.scale.set(1.1, 0.2, 0.8); g.add(at(pad, 0, 0.32, 0));
    for (const [x, z] of [[-0.75, -0.55], [0.75, -0.55]] as const) {
      g.add(at(cyl(0.18, 0.18, 1.2, c1, 12), x, 0.6, z));
      g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.45, 12), mat(c2)), x, 1.42, z));
      g.add(at(box(0.18, 0.12, 0.01, 0xf1c40f), x + 0.1, 1.75, z));
    }
    g.add(at(box(1.5, 0.7, 0.12, c1), 0, 0.5, -0.55));
    for (let i = 0; i < 5; i++) g.add(at(box(0.18, 0.15, 0.14, c1), -0.6 + i * 0.3, 0.92, -0.55));
    return { g, top: 0.4 };
  },
};

function bowl(c: number, r = 0.26) {
  const g = new THREE.Group();
  g.add(at(cyl(r, r * 0.72, 0.14, c, 24, true), 0, 0.07, 0));
  g.add(at(cyl(r * 0.72, r * 0.72, 0.02, new THREE.Color(c).multiplyScalar(0.8).getHex(), 24), 0, 0.01, 0));
  g.add(at(new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 6, 24).rotateX(Math.PI / 2), mat(new THREE.Color(c).lerp(new THREE.Color(0xffffff), 0.3).getHex())), 0, 0.14, 0));
  return g;
}

function foodBowl(it: ShopItem) {
  const c = it.color ?? 0x3d7cc9;
  if (it.style === "stand") {
    const g = new THREE.Group();
    g.add(at(box(0.7, 0.05, 0.5, c), 0, 0.22, 0));
    for (const [x, z] of [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]] as const) g.add(at(box(0.05, 0.22, 0.05, c), x, 0.11, z));
    g.add(at(bowl(it.color2 ?? 0xffffff, 0.22), 0, 0.24, 0));
    return g;
  }
  const g = bowl(c);
  if (it.style === "fish") {
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 3), mat(c));
    tail.rotation.z = Math.PI / 2;
    g.add(at(tail, 0.34, 0.08, 0));
    g.add(at(ball(0.03, 0x222222), -0.15, 0.1, 0.2));
  }
  // A paw print on the front.
  g.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), mat(0xffffff)), 0, 0.07, 0.235));
  return g;
}

// ---------- decorations: one builder each, at its own spot ----------------------------

const DECOR: Record<string, { at: [number, number, number]; ry?: number; build: (it: ShopItem) => THREE.Object3D; anim?: (o: THREE.Object3D, t: number) => void }> = {
  "cat-tree": { at: [-5.0, 0, 0.2], build: (it) => {
    const g = new THREE.Group();
    const post = it.color ?? 0xc8a06a, pad = it.color2 ?? 0x9b59b6;
    g.add(at(box(1.0, 0.1, 1.0, pad), 0, 0.05, 0));
    g.add(at(cyl(0.1, 0.1, 2.6, post, 10), 0, 1.3, 0));
    g.add(at(cyl(0.1, 0.1, 1.4, post, 10), 0.35, 0.7, 0.3));
    for (const [y, x, z, r] of [[1.4, 0.35, 0.3, 0.4], [2.6, 0, 0, 0.5], [0.9, -0.3, -0.25, 0.35]] as const) g.add(at(cyl(r, r, 0.1, pad, 16), x, y, z));
    const hideout = box(0.6, 0.5, 0.6, pad); g.add(at(hideout, 0, 1.95, 0));
    g.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.17, 16), mat(0x3a2a40)), 0, 1.92, 0.305));
    const toy = ball(0.06, 0xf1c40f); toy.name = "dangle"; g.add(at(toy, 0.4, 2.2, 0.3));
    return g;
  }, anim: (o, t) => { const d = o.getObjectByName("dangle"); if (d) d.position.x = 0.4 + Math.sin(t * 2) * 0.05; } },
  plant: { at: [5.3, 0, 1.4], build: () => {
    const g = new THREE.Group();
    g.add(at(cyl(0.3, 0.22, 0.5, 0xc0643a, 14), 0, 0.25, 0));
    for (let i = 0; i < 9; i++) g.add(at(new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), leafMats[i % leafMats.length]!), Math.sin(i * 2.4) * 0.3, 0.75 + (i % 3) * 0.3, Math.cos(i * 2.4) * 0.3));
    return g;
  } },
  bookshelf: { at: [-1.2, 0, -4.15], build: () => {
    const g = new THREE.Group();
    const wood = 0x8b5a2b;
    g.add(at(box(1.6, 2.4, 0.5, wood), 0, 1.2, -0.05));
    const cols = [0xc0392b, 0x2e86de, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0x16a085];
    for (let row = 0; row < 3; row++) {
      g.add(at(box(1.5, 0.05, 0.42, 0x6b4421), 0, 0.3 + row * 0.75, 0.05));
      for (let i = 0; i < 9; i++) {
        const h = 0.4 + ((i * 7 + row) % 4) * 0.06;
        g.add(at(box(0.13, h, 0.32, cols[(i + row * 3) % cols.length]!), -0.6 + i * 0.15, 0.33 + row * 0.75 + h / 2, 0.06));
      }
    }
    return g;
  } },
  lamp: { at: [-2.7, 0, -4.0], build: (it) => {
    const g = new THREE.Group();
    g.add(at(cyl(0.25, 0.3, 0.06, 0x6b4421), 0, 0.03, 0));
    g.add(at(cyl(0.03, 0.03, 1.8, 0x6b4421, 8), 0, 0.9, 0));
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 0.5, 20, 1, true), mat(it.color ?? 0xfff0c8, { side: THREE.DoubleSide, emissive: 0xffd590, emissiveIntensity: 0.6 })), 0, 1.85, 0));
    const l = new THREE.PointLight(0xffc880, 5, 6, 1.6);
    l.position.y = 1.7;
    g.add(l);
    return g;
  } },
  portrait: { at: [-4.1, 3.0, -4.47], build: () => {
    const g = new THREE.Group();
    g.add(box(1.7, 1.05, 0.08, 0xc8a050));
    const tex = new THREE.TextureLoader().load("/boabosh.jpg");
    tex.colorSpace = THREE.SRGBColorSpace;
    g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.82), new THREE.MeshBasicMaterial({ map: tex })), 0, 0, 0.045));
    return g;
  } },
  aquarium: { at: [5.4, 0, -1.2], ry: -Math.PI / 2, build: () => {
    const g = new THREE.Group();
    g.add(at(box(1.6, 0.8, 0.6, 0x6b4421), 0, 0.4, 0));
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 0.5), mat(0x8fd8ff, { transparent: true, opacity: 0.35 })), 0, 1.2, 0));
    g.add(at(box(1.45, 0.08, 0.45, 0xe8d4a0), 0, 0.84, 0));
    for (let i = 0; i < 4; i++) g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.4, 4), mat(0x2ecc71)), -0.6 + i * 0.4, 1.05, -0.1));
    for (const [c, i] of [[0xff8c1a, 0], [0xffd23f, 1], [0xff5c8a, 2]] as const) { const f = ball(0.06, c); f.scale.set(1.6, 1, 0.6); f.name = `fish${i}`; g.add(f); }
    return g;
  }, anim: (o, t) => { for (let i = 0; i < 3; i++) { const f = o.getObjectByName(`fish${i}`); if (f) { const a = t * (0.6 + i * 0.2) + i * 2; f.position.set(Math.sin(a) * 0.6, 1.1 + i * 0.12, Math.cos(a * 1.3) * 0.12); f.rotation.y = Math.cos(a) > 0 ? 0 : Math.PI; } } } },
  scratcher: { at: [-5.2, 0, 2.6], build: (it) => {
    const g = new THREE.Group();
    g.add(at(box(0.7, 0.08, 0.7, 0x9b59b6), 0, 0.04, 0));
    g.add(at(cyl(0.14, 0.14, 1.2, it.color ?? 0xd9c08a, 12), 0, 0.68, 0));
    for (let i = 0; i < 10; i++) g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.012, 4, 14).rotateX(Math.PI / 2), mat(0xb89a5a)), 0, 0.2 + i * 0.1, 0));
    g.add(at(cyl(0.25, 0.25, 0.06, 0x9b59b6), 0, 1.3, 0));
    const b = ball(0.06, 0xff6b6b); b.name = "dangle"; g.add(at(b, 0.2, 1.05, 0));
    return g;
  }, anim: (o, t) => { const d = o.getObjectByName("dangle"); if (d) d.position.z = Math.sin(t * 2.5) * 0.06; } },
  cushions: { at: [-3.1, 0, 1.9], build: () => {
    const g = new THREE.Group();
    for (const [x, z, c, r] of [[0, 0, 0xff8fab, 0.4], [0.5, 0.2, 0x7ec8ff, 0.32], [-0.3, 0.35, 0xffe066, 0.3]] as const) { const p = ball(r, c); p.scale.y = 0.45; g.add(at(p, x, r * 0.4, z)); }
    return g;
  } },
  "fairy-lights": { at: [0, 4.4, -4.42], build: () => {
    const g = new THREE.Group();
    const cols = [0xffd23f, 0xff8fab, 0x7ec8ff, 0x9bff9b];
    for (let i = 0; i < 26; i++) {
      const x = -5.6 + i * 0.45, y = -Math.abs(Math.sin(i * 0.6)) * 0.3;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: cols[i % 4]! }));
      b.name = `bulb${i}`;
      g.add(at(b, x, y, 0));
    }
    return g;
  }, anim: (o, t) => { for (let i = 0; i < 26; i++) { const b = o.getObjectByName(`bulb${i}`); if (b) b.scale.setScalar(0.8 + Math.max(0, Math.sin(t * 3 + i)) * 0.5); } } },
  "toy-chest": { at: [0.6, 0, -3.95], build: (it) => {
    const g = new THREE.Group();
    g.add(at(box(1.0, 0.55, 0.6, it.color ?? 0xc0392b), 0, 0.28, 0));
    const lid = box(1.04, 0.1, 0.64, 0xf1c40f); lid.position.set(0, 0.6, -0.15); lid.rotation.x = -0.5; g.add(lid);
    g.add(at(ball(0.12, 0xe74c3c), -0.2, 0.62, 0.05));
    g.add(at(ball(0.1, 0x3498db), 0.2, 0.6, 0.0));
    return g;
  } },
  "window-seat": { at: [2.4, 0, -4.05], build: (it) => {
    const g = new THREE.Group();
    g.add(at(box(2.4, 1.15, 0.7, 0xf6ead2), 0, 0.575, 0));
    const pad = ball(1, it.color ?? 0xf3e2c3); pad.scale.set(1.15, 0.12, 0.33); g.add(at(pad, 0, 1.18, 0));
    return g;
  } },
  clock: { at: [-1.2, 3.75, -4.45], build: () => {
    const tex = canvasTex(128, (g2) => {
      g2.fillStyle = "#fffaf0"; g2.beginPath(); g2.arc(64, 64, 62, 0, 7); g2.fill();
      g2.fillStyle = "#4a2e1c"; g2.font = "bold 16px sans-serif"; g2.textAlign = "center"; g2.textBaseline = "middle";
      for (let h = 1; h <= 12; h++) { const a = (h / 12) * Math.PI * 2; g2.fillText(String(h), 64 + Math.sin(a) * 48, 64 - Math.cos(a) * 48); }
    });
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 24).rotateX(Math.PI / 2), mat(0xc0392b)), 0, 0, 0));
    g.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.36, 24), mat(0xffffff, { map: tex })), 0, 0, 0.045));
    const hand = box(0.03, 0.28, 0.01, 0x222222); hand.geometry.translate(0, 0.14, 0); hand.name = "hand"; g.add(at(hand, 0, 0, 0.055));
    return g;
  }, anim: (o, t) => { const h = o.getObjectByName("hand"); if (h) h.rotation.z = -t * 0.5; } },
  sunflower: { at: [5.3, 0, 3.1], build: () => {
    const g = new THREE.Group();
    g.add(at(cyl(0.2, 0.15, 0.45, 0x4f86c6, 14), 0, 0.22, 0));
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.15, h = 1.0 + i * 0.15;
      g.add(at(cyl(0.015, 0.015, h, 0x3f8a3a, 5), x, 0.45 + h / 2 - 0.2, 0));
      const head = new THREE.Group();
      head.add(new THREE.Mesh(new THREE.CircleGeometry(0.16, 14), mat(0xffd23f, { side: THREE.DoubleSide })));
      head.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), mat(0x6b4421)), 0, 0, 0.01));
      g.add(at(head, x, 0.45 + h - 0.2, 0.05));
    }
    return g;
  } },
  "jack-o-lantern": { at: [-1.9, 0, 3.4], ry: 0.3, build: () => { const p = pumpkin(1.8); p.position.y = 0.4; const g = new THREE.Group(); g.add(p); return g; } },
  cauldron: { at: [0.9, 0, -2.7], build: () => cauldron(1), anim: (o, t) => o.traverse((b) => {
    if (!b.name.startsWith("bubble")) return;
    const k = Number(b.name.slice(6)), f = (t * 0.6 + k / 5) % 1;
    b.position.set(Math.sin(k * 2.3) * 0.15, 0.72 + f * 0.5, Math.cos(k * 1.7) * 0.15);
    b.scale.setScalar(1 - f);
  }) },
  "bat-garland": { at: [5.95, 4.0, 0], ry: -Math.PI / 2, build: () => batGarland(5) },
  piano: { at: [-5.45, 0, -3.3], ry: Math.PI / 2, build: () => {
    const g = new THREE.Group();
    g.add(at(box(1.3, 0.75, 0.5, 0xd62828), 0, 0.55, 0));
    for (const x of [-0.55, 0.55]) g.add(at(box(0.08, 0.2, 0.4, 0xd62828), x, 0.1, 0));
    g.add(at(box(1.2, 0.04, 0.2, 0xffffff), 0, 0.94, 0.18));
    for (let i = 0; i < 8; i++) g.add(at(box(0.05, 0.05, 0.12, 0x222222), -0.5 + i * 0.14, 0.97, 0.15));
    return g;
  } },
};

// ---------- the room ---------------------------------------------------------------------

export function buildHome(): HomeScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3a2a20);
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x8a6a50, 1.1));
  // Afternoon sun through the window, like the portrait.
  const sun = new THREE.DirectionalLight(0xffe2b0, 2.4);
  sun.position.set(4, 9, -10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, far: 40 });
  scene.add(sun);
  const fill = new THREE.PointLight(0xffd8a8, 4, 14, 1.4);
  fill.position.set(0, 4.5, 1);
  scene.add(fill);

  const floorMat = mat(0xffffff);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), floorMat);
  floor.receiveShadow = true;
  scene.add(floor);
  const wallMat = mat(0xffffff);
  for (const [x, z, w, ry] of [[0, -D / 2, W, 0], [-W / 2, 0, D, Math.PI / 2], [W / 2, 0, D, -Math.PI / 2]] as const) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), wallMat);
    m.position.set(x, H / 2, z); m.rotation.y = ry; m.receiveShadow = true;
    scene.add(m);
    const skirting = box(w, 0.25, 0.06, 0xffffff);
    skirting.position.set(x, 0.125, z).add(new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)).multiplyScalar(0.03));
    skirting.rotation.y = ry;
    scene.add(skirting);
  }
  // The big window, with curtains tied back.
  {
    const view = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.4), new THREE.MeshBasicMaterial({ map: windowView() }));
    view.position.set(2.4, 2.6, -D / 2 + 0.02);
    scene.add(view);
    const frameC = 0xe8d6b8;
    for (const [x, y, w, h] of [[0, 1.25, 2.8, 0.14], [0, -1.25, 2.9, 0.18], [-1.35, 0, 0.14, 2.6], [1.35, 0, 0.14, 2.6], [0, 0, 0.08, 2.4], [0, 0.2, 2.6, 0.07]] as const) {
      scene.add(at(box(w, h, 0.12, frameC), 2.4 + x, 2.6 + y, -D / 2 + 0.07));
    }
    for (const s of [-1, 1]) {
      const curtain = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 2.9, 10, 1, true, 0, Math.PI), mat(0xfff8ec, { side: THREE.DoubleSide }));
      curtain.position.set(2.4 + s * 1.65, 2.55, -D / 2 + 0.25);
      curtain.rotation.y = Math.PI / 2;
      scene.add(curtain);
      scene.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 6, 14), mat(0xd9a76a)), 2.4 + s * 1.65, 1.9, -D / 2 + 0.3));
    }
    scene.add(at(cyl(0.04, 0.04, 4.0, 0x8b5a2b, 8).rotateZ(Math.PI / 2), 2.4, 4.05, -D / 2 + 0.2));
    // Sunbeam.
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, 4), new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.position.set(1.8, 0.02, -1.8);
    beam.rotation.y = 0.25;
    scene.add(beam);
  }
  // Ceiling light cord + a doormat by the way in.
  scene.add(at(cyl(0.01, 0.01, 1.2, 0x333333, 4), 0, 4.4, 1));
  scene.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.35, 20, 1, true), mat(0xe8894a, { side: THREE.DoubleSide })), 0, 3.7, 1));
  scene.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff6d8 })), 0, 3.55, 1));
  const doormat = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9).rotateX(-Math.PI / 2), mat(0xffffff, { map: label("Welcome!", "#a0703a", "#fff6e0", 256, 128, 44) }));
  doormat.position.set(0, 0.01, 3.9);
  scene.add(doormat);
  // A little mat under the bowls, with a name plate.
  const bowlMat = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.0).rotateX(-Math.PI / 2), mat(0xf3c6a0));
  bowlMat.position.set((FOOD.x + WATER.x) / 2, 0.012, FOOD.z);
  scene.add(bowlMat);

  // Rebuilt parts.
  const parts = { bed: new THREE.Group(), food: new THREE.Group(), water: new THREE.Group(), litter: new THREE.Group(), rug: new THREE.Group(), decor: new THREE.Group(), cats: new THREE.Group() };
  Object.values(parts).forEach((g) => scene.add(g));
  parts.bed.position.copy(BED);
  parts.food.position.copy(FOOD);
  parts.water.position.copy(WATER);
  parts.litter.position.copy(LITTER);
  parts.litter.rotation.y = -0.3;

  let bedTop = 0.2;
  let waterSurface: THREE.Mesh | null = null, fountainArc: THREE.Mesh | null = null;
  const decorAnims: [THREE.Object3D, (o: THREE.Object3D, t: number) => void][] = [];
  let others: { id: string; group: THREE.Group; cat: Cat; ph: number }[] = [];
  const last: Record<string, string> = {};

  const apply = (s: State, now = Date.now()) => {
    const n = needs(s, now);
    const h = s.home;
    const changed = (k: string, v: string) => { if (last[k] === v) return false; last[k] = v; return true; };

    if (changed("wall", h.wall)) { wallMat.map?.dispose(); wallMat.map = wallTex(BY_ID[h.wall]!); wallMat.needsUpdate = true; }
    if (changed("floor", h.floor)) { floorMat.map?.dispose(); floorMat.map = floorTex(BY_ID[h.floor]!); floorMat.needsUpdate = true; }

    if (changed("bed", h.bed)) {
      parts.bed.clear();
      const it = BY_ID[h.bed]!;
      const b = (BEDS[it.style ?? "basket"] ?? BEDS.basket!)(it.color ?? 0xc8a06a, it.color2 ?? 0xf3e2c3);
      parts.bed.add(shadows(b.g));
      bedTop = b.top;
    }
    if (changed("food", h.food)) { parts.food.clear(); parts.food.add(shadows(foodBowl(BY_ID[h.food]!))); }

    // Water bowl: the water level shows how thirsty the cat is.
    if (changed("water", h.water)) {
      parts.water.clear();
      const it = BY_ID[h.water]!;
      const g = bowl(it.color ?? 0x5ec8ff);
      waterSurface = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24).rotateX(-Math.PI / 2), mat(0x7fd1ff, { transparent: true, opacity: 0.85 }));
      g.add(waterSurface);
      fountainArc = null;
      if (it.style === "fountain") {
        g.add(at(cyl(0.08, 0.1, 0.4, it.color2 ?? 0x4f86c6, 12), 0, 0.2, 0));
        g.add(at(ball(0.06, 0xeaf6ff), 0, 0.42, 0));
        fountainArc = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 16, Math.PI), mat(0x9fe3ff, { transparent: true, opacity: 0.7 }));
        fountainArc.position.set(0.12, 0.4, 0);
        g.add(fountainArc);
      }
      parts.water.add(shadows(g));
    }
    if (waterSurface) waterSurface.position.y = 0.025 + (n.water / 100) * 0.1;

    // Litter box: clumps pile up as it gets dirty, and stink lines appear.
    {
      const clumps = Math.round((100 - n.clean) / 15);
      if (changed("litter", `${h.litter}:${clumps}`)) {
        parts.litter.clear();
        const it = BY_ID[h.litter]!;
        const g = new THREE.Group();
        const c = it.color ?? 0x7f8c99;
        g.add(at(box(1.2, 0.08, 0.9, c), 0, 0.04, 0));
        for (const [x, z, w, d] of [[0, 0.43, 1.2, 0.05], [0, -0.43, 1.2, 0.05], [0.58, 0, 0.05, 0.9], [-0.58, 0, 0.05, 0.9]] as const) g.add(at(box(w, 0.3, d, c), x, 0.15, z));
        g.add(at(box(1.1, 0.04, 0.8, 0xe8d6a8), 0, 0.22, 0)); // sand
        for (let i = 0; i < clumps; i++) { const cl = ball(0.05, 0x8a6a4a); cl.scale.y = 0.6; g.add(at(cl, -0.4 + ((i * 37) % 9) * 0.1, 0.25, -0.3 + ((i * 53) % 7) * 0.1)); }
        if (it.style === "hood") {
          // Half a tube lying along x: the arc goes over the top of the tray.
          g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.2, 20, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), mat(c, { side: THREE.DoubleSide })), 0, 0.25, 0));
        } else if (it.style === "cabinet") {
          g.add(at(box(1.3, 0.9, 1.0, c), 0, 0.75, 0));
          g.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.22, 18), mat(0x3a2a20)), 0.66, 0.45, 0).rotateY(Math.PI / 2));
        } else if (it.style === "dome") {
          g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(it.color ?? 0xeaf0f6, { transparent: true, opacity: 0.55 })), 0, 0.28, 0));
          g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.04, 6, 24).rotateX(Math.PI / 2), mat(it.color2 ?? 0x4f86c6)), 0, 0.28, 0));
        }
        if (n.clean < 45) {
          for (let k = 0; k < 3; k++) {
            const st = new THREE.Sprite(new THREE.SpriteMaterial({ map: label("~", "", "#8fbf5a", 128, 128, 110), transparent: true, depthWrite: false }));
            st.scale.setScalar(0.5);
            st.name = `stink${k}`;
            g.add(at(st, -0.3 + k * 0.3, 0.8, 0));
          }
        }
        parts.litter.add(shadows(g));
      }
    }

    if (changed("rug", h.rug)) {
      parts.rug.clear();
      const it = BY_ID[h.rug]!;
      const c1 = it.color ?? 0xff8fab, c2 = it.color2 ?? 0xffffff;
      const disc = (r: number, c: number, y: number) => at(new THREE.Mesh(new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2), mat(c)), 0, y, 0);
      if (it.style === "round") { parts.rug.add(disc(1.6, c1, 0.01), disc(1.3, c2, 0.012), disc(1.15, c1, 0.014)); }
      else if (it.style === "rainbow") [0xe74c3c, 0xf39c12, 0xf1c40f, 0x2ecc71, 0x3498db, 0x9b59b6].forEach((c, i) => parts.rug.add(disc(1.7 - i * 0.25, c, 0.01 + i * 0.002)));
      else if (it.style === "paw") {
        parts.rug.add(disc(1.6, c1, 0.01));
        const pawPad = disc(0.45, c2, 0.013); pawPad.scale.set(1.2, 1, 1); pawPad.position.z = 0.25; parts.rug.add(pawPad);
        for (const [x, z] of [[-0.55, -0.35], [-0.2, -0.65], [0.2, -0.65], [0.55, -0.35]] as const) parts.rug.add(at(disc(0.17, c2, 0.013), x, 0.013, z));
      } else if (it.style === "fishrug") {
        const body = disc(1.1, c1, 0.01); body.scale.set(1.5, 1, 1); parts.rug.add(body);
        const tail = new THREE.Mesh(new THREE.CircleGeometry(0.7, 3).rotateX(-Math.PI / 2), mat(c1)); tail.position.set(-1.9, 0.01, 0); parts.rug.add(tail);
        parts.rug.add(at(disc(0.15, c2, 0.013), 1.1, 0.013, -0.25));
      }
      parts.rug.position.set(0, 0, 0.8);
    }

    if (changed("decor", [...h.decor].sort().join(","))) {
      parts.decor.clear();
      decorAnims.length = 0;
      for (const id of h.decor) {
        const d = DECOR[id];
        const it = BY_ID[id];
        if (!d || !it) continue;
        const o = shadows(d.build(it));
        o.position.set(...d.at);
        o.rotation.y = d.ry ?? 0;
        parts.decor.add(o);
        if (d.anim) decorAnims.push([o, d.anim]);
      }
    }

    // The other cats lounge around the room; rebuilt when cats or outfits change.
    const lineup = s.cats.filter((c) => c.id !== s.active);
    if (changed("cats", JSON.stringify(lineup.map((c) => [c.id, c.worn])) + activeCat(s).id)) {
      parts.cats.clear();
      const seats: [number, number, number, number][] = [[-2.0, 0, 2.4, 0.5], [2.6, 0, 2.6, -0.4], [-4.2, 0, 1.0, 0.9], [3.8, 0, -1.6, -0.6], [-1.0, 0, -2.2, 0.2], [1.2, 0, 2.9, -0.1], [-4.4, 0, 3.2, 0.7], [4.2, 0, 1.8, -0.8]];
      others = lineup.map((c, i) => {
        const cat = makeCat(COATS[c.coat]);
        dress(cat, c.worn);
        const [x, y, z, ry] = seats[i % seats.length]!;
        cat.group.position.set(x, y, z);
        cat.group.rotation.y = ry;
        cat.group.scale.setScalar(0.92);
        parts.cats.add(cat.group);
        return { id: c.id, group: cat.group, cat, ph: i * 1.7 };
      });
    }
    toonify(scene);
  };

  const update = (t: number) => {
    decorAnims.forEach(([o, f]) => f(o, t));
    others.forEach(({ cat, ph }) => {
      cat.tail.rotation.z = Math.sin(t * 1.8 + ph) * 0.35;
      cat.head.rotation.y = Math.sin(t * 0.4 + ph) * 0.35;
      const blink = ((t + ph) % 5) < 0.12;
      cat.eyes.forEach((e) => { e.visible = !blink; });
      cat.lids.forEach((l) => { l.visible = blink; });
    });
    if (fountainArc) fountainArc.scale.y = 1 + Math.sin(t * 12) * 0.05;
    parts.litter.traverse((o) => { if (o.name.startsWith("stink")) { const k = Number(o.name.slice(5)); o.position.y = 0.7 + ((t * 0.4 + k * 0.33) % 1) * 0.6; (o as THREE.Sprite).material.opacity = 1 - ((t * 0.4 + k * 0.33) % 1); } });
  };

  return {
    scene, update, apply,
    camPos: new THREE.Vector3(0, 6.2, 10.8), camLook: new THREE.Vector3(0.6, 1.3, -0.8),
    entry: new THREE.Vector3(0, 0, 4.2), stand: new THREE.Vector3(0, 0, 1.3),
    spots: {
      // Behind the bowls, facing the camera, so you see the cat's face while it eats.
      food: { at: FOOD.clone().add(new THREE.Vector3(0, 0, -0.55)), face: 0 },
      water: { at: WATER.clone().add(new THREE.Vector3(0, 0, -0.55)), face: 0 },
      bed: { at: BED.clone().add(new THREE.Vector3(0.4, 0, 1.0)), face: 0 },
      litter: { at: LITTER.clone().add(new THREE.Vector3(-0.8, 0, 1.2)), face: 0.5 },
      center: { at: new THREE.Vector3(0, 0, 1.3), face: 0 },
      scratch: { at: new THREE.Vector3(-4.55, 0, 2.6), face: -Math.PI / 2 }, // facing the post
    },
    bedTop: () => bedTop,
    others: () => others.map(({ id, group }) => ({ id, group })),
    litterTray: LITTER.clone(),
  };
}

export const BED_SPOT = BED;
