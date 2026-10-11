// The Game Garden: a carnival scene (3D) and the three games, which are played
// on a DOM board in a panel over it. Rules live in chess.ts / minigames.ts.

import * as THREE from "three";
import type { AreaScene } from "./areas.ts";
import { makeCat, dress } from "./cat.ts";
import { COATS } from "./shop.ts";
import { toonify } from "./toon.ts";
import { mat, at, shadows, label, makePine, reseed, range } from "./world.ts";
import * as chess from "./chess.ts";
import { winner, coachMove, judge, HANDS, type Mark, type Hand } from "./minigames.ts";
import * as sfx from "./sound.ts";

// ============================================================================
// The scene
// ============================================================================

export function buildGarden(): AreaScene {
  reseed(51);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fd0f5);
  scene.fog = new THREE.Fog(0xf6e6d2, 22, 60);
  scene.add(new THREE.HemisphereLight(0xe6f2ff, 0x8a7a5a, 1.1));
  const sun = new THREE.DirectionalLight(0xffe0b0, 2.6);
  sun.position.set(6, 14, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, far: 50 });
  scene.add(sun);
  const movers: ((t: number) => void)[] = [];

  const lawn = new THREE.Mesh(new THREE.CircleGeometry(40, 48).rotateX(-Math.PI / 2), mat(0x7cc457));
  lawn.receiveShadow = true;
  scene.add(lawn);
  for (let i = 0; i < 60; i++) {
    const a = range(0, Math.PI * 2), r = range(12, 30);
    const x = Math.cos(a) * r, z = Math.sin(a) * r - 6;
    if (z > -4) continue; // only behind the garden, never between the camera and the games
    scene.add(at(makePine(range(1.6, 2.6)), x, 0, z));
  }

  // Giant chessboard on the ground, with kitten "pieces" standing on it.
  {
    const g = new THREE.Group();
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const tile = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.6), mat((r + c) % 2 ? 0x8a5a3a : 0xf3e2c3));
      tile.position.set((c - 3.5) * 0.6, 0.03, (r - 3.5) * 0.6);
      tile.receiveShadow = true;
      g.add(tile);
    }
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.05, 5.1), mat(0x5a3a22)), 0, 0.01, 0));
    for (const [coat, hat, x, z, ry] of [["ginger", "crown", -0.3, 1.5, 0.2], ["pepper", "crown", 0.9, -1.5, Math.PI - 0.3], ["ginger", "top-hat", -1.5, 1.5, 0.3], ["pepper", "witch-hat", 2.1, -2.1, Math.PI]] as const) {
      const k = makeCat(COATS[coat]);
      dress(k, { hat, collar: null, glasses: null, back: null });
      k.group.scale.setScalar(0.75);
      k.group.position.set(x, 0.06, z);
      k.group.rotation.y = ry;
      g.add(k.group);
      movers.push((t) => { k.tail.rotation.z = Math.sin(t * 2 + x) * 0.3; });
    }
    g.position.set(-4.8, 0, -2.5);
    g.rotation.y = 0.35;
    scene.add(shadows(g));
  }

  // Big standing tic-tac-toe board with paw marks.
  {
    const g = new THREE.Group();
    const wood = 0xa0703a;
    for (const x of [-0.6, 0.6]) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.1), mat(wood)), x, 1.6, 0));
    for (const y of [1.0, 2.2]) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.1), mat(wood)), 0, y, 0));
    for (const x of [-1.15, 1.15]) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.4, 0.14), mat(0x6b4421)), x, 1.7, -0.05));
    const marks = [[0, 0, "🐱"], [1, 1, "🐱"], [2, 0, "🐾"], [0, 2, "🐾"], [2, 2, "🐱"]] as const;
    for (const [c, r, m] of marks) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: label(m, "", "#ffffff", 128, 128, 90), transparent: true }));
      s.scale.setScalar(0.6);
      s.position.set((c - 1) * 1.2, 2.8 - r * 1.2, 0.1);
      g.add(s);
    }
    g.position.set(4.8, 0, -3.2);
    g.rotation.y = -0.4;
    scene.add(shadows(g));
  }

  // Rock-paper-scissors stage with a giant paw.
  {
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 0.35, 24), mat(0xe86aa6)), 0, 0.17, 0));
    g.add(at(new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.06, 6, 30).rotateX(Math.PI / 2), mat(0xffd23f)), 0, 0.35, 0));
    const paw = new THREE.Group();
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.45, 18, 14), mat(0xf6e2c8));
    pad.scale.set(1, 0.8, 0.7);
    paw.add(pad);
    paw.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), mat(0xff9ab0)), 0, -0.08, 0.3));
    for (const [x, y] of [[-0.32, 0.36], [-0.11, 0.48], [0.11, 0.48], [0.32, 0.36]] as const) {
      paw.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), mat(0xf6e2c8)), x, y, 0.05));
      paw.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mat(0xff9ab0)), x, y, 0.17));
    }
    paw.position.y = 1.4;
    g.add(paw);
    movers.push((t) => { paw.rotation.z = Math.sin(t * 1.5) * 0.15; paw.position.y = 1.4 + Math.abs(Math.sin(t * 3)) * 0.1; });
    g.position.set(3.6, 0, 1.6);
    scene.add(shadows(g));
  }

  // Striped carnival tent at the back.
  {
    const g = new THREE.Group();
    const stripes = 12;
    for (let i = 0; i < stripes; i++) {
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 2.2, 2, 1, true, (i / stripes) * Math.PI * 2, (Math.PI * 2) / stripes), mat(i % 2 ? 0xffffff : 0xe74c3c, { side: THREE.DoubleSide }));
      wall.position.y = 1.1;
      g.add(wall);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.8, 2, 1, true, (i / stripes) * Math.PI * 2, (Math.PI * 2) / stripes), mat(i % 2 ? 0xe74c3c : 0xffffff, { side: THREE.DoubleSide }));
      roof.position.y = 3.1;
      g.add(roof);
    }
    g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 8), mat(0xffd23f)), 0, 4.2, 0));
    g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), mat(0x3a2030)), 0, 0.8, 2.21));
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), mat(0x3498db, { side: THREE.DoubleSide }));
    flag.position.set(0.25, 4.4, 0);
    g.add(flag);
    movers.push((t) => { flag.rotation.y = Math.sin(t * 3) * 0.4; });
    g.position.set(0, 0, -7);
    scene.add(shadows(g));
    const signM = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.8), new THREE.MeshBasicMaterial({ map: label("🎮 Game Garden", "#ffd23f", "#7a2a10", 512, 128, 58) }));
    signM.position.set(0, 2.55, -4.75);
    scene.add(signM);
  }

  // A little carousel that turns.
  {
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.15, 24), mat(0x9b59b6)), 0, 0.08, 0));
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.3, 10), mat(0xffd23f)), 0, 1.2, 0));
    g.add(at(new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.7, 24), mat(0xff8fab)), 0, 2.6, 0));
    const ride = new THREE.Group();
    [0xffd23f, 0x4ecdc4, 0xff6b6b, 0x9bff9b].forEach((c, i) => {
      const a = (i / 4) * Math.PI * 2;
      ride.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6), mat(0xffffff)), Math.cos(a) * 0.95, 1.25, Math.sin(a) * 0.95));
      const seat = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), mat(c));
      seat.scale.set(1.3, 0.8, 0.8);
      seat.name = `seat${i}`;
      ride.add(at(seat, Math.cos(a) * 0.95, 0.9, Math.sin(a) * 0.95));
    });
    g.add(ride);
    movers.push((t) => {
      ride.rotation.y = t * 0.6;
      for (let i = 0; i < 4; i++) { const s = ride.getObjectByName(`seat${i}`); if (s) s.position.y = 0.9 + Math.sin(t * 2 + i * 1.6) * 0.2; }
    });
    g.position.set(-7.2, 0, 0.6);
    scene.add(shadows(g));
  }

  // Balloons on strings, bobbing.
  {
    const cols = [0xff6b6b, 0xffd23f, 0x4ecdc4, 0x9b59b6, 0xff9ff3, 0x54a0ff];
    for (const [bx, bz] of [[-2.4, -4.5], [2.6, -5.0], [6.8, 0.5], [-7.4, -0.8]] as const) {
      const g = new THREE.Group();
      g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.3, 10), mat(0x8b5a2b)), 0, 0.15, 0));
      cols.slice(0, 4).forEach((c, i) => {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), mat(c));
        b.scale.y = 1.2;
        const x = Math.cos(i * 1.6) * 0.35, z = Math.sin(i * 1.6) * 0.35, y = 2.4 + (i % 2) * 0.4;
        b.position.set(x, y, z);
        b.name = "balloon";
        g.add(b);
        // String from the weight up to the balloon: a cylinder turned from +y to that direction.
        const dir = new THREE.Vector3(x, y - 0.3, z);
        const str = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, dir.length(), 4), mat(0xffffff));
        str.position.set(x / 2, 0.3 + (y - 0.3) / 2, z / 2);
        str.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        g.add(str);
      });
      g.position.set(bx, 0, bz);
      scene.add(shadows(g));
      movers.push((t) => g.children.forEach((b, i) => { if (b.name === "balloon") b.position.y += Math.sin(t * 1.5 + i + bx) * 0.002; }));
    }
  }

  // Bunting strung across, and confetti drifting down.
  {
    const cols = [0xff6b6b, 0xffd23f, 0x4ecdc4, 0x9b59b6, 0xff9ff3];
    const tri = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.15, 0, 0), new THREE.Vector3(0.15, 0, 0), new THREE.Vector3(0, -0.35, 0)]);
    tri.computeVertexNormals();
    for (const z of [-1.5, 2.5]) {
      for (let i = 0; i < 26; i++) {
        const x = -7.5 + i * 0.6;
        const f = new THREE.Mesh(tri, mat(cols[i % cols.length]!, { side: THREE.DoubleSide }));
        f.position.set(x, 4.2 - Math.sin((i / 25) * Math.PI) * 0.8, z);
        scene.add(f);
      }
    }
    const n = 120, pos = new Float32Array(n * 3), colArr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos.set([range(-10, 10), range(0, 8), range(-8, 6)], i * 3);
      const c = new THREE.Color(cols[i % cols.length]!);
      colArr.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colArr, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.12, vertexColors: true }));
    scene.add(pts);
    movers.push((t) => {
      const p = geo.attributes.position!;
      for (let i = 0; i < n; i++) {
        let y = p.getY(i) - 0.008;
        if (y < 0) y = 8;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(t * 2 + i) * 0.004);
      }
      p.needsUpdate = true;
    });
  }

  // Coach Whiskers, who runs the games: a grey tabby in a propeller cap.
  {
    const coach = makeCat(COATS.smokey);
    dress(coach, { hat: "propeller", collar: "bowtie", glasses: null, back: null });
    coach.group.position.set(1.9, 0, -1.0);
    coach.group.rotation.y = -0.3;
    scene.add(coach.group);
    movers.push((t) => {
      coach.tail.rotation.z = Math.sin(t * 2.4) * 0.35;
      coach.group.traverse((o) => { if (o.userData.spin) o.rotation.y = t * 8; });
    });
  }

  toonify(scene);
  return {
    scene, update: (t) => movers.forEach((m) => m(t)),
    camPos: new THREE.Vector3(0, 6, 12), camLook: new THREE.Vector3(1.5, 1.4, -1.5),
    entry: new THREE.Vector3(0, 0, 7), stand: new THREE.Vector3(0, 0, 1.6),
  };
}

// ============================================================================
// Artwork: kitten chess pieces, kitten marks, paws. All inline SVG.
// ============================================================================

// You are the snow-white kittens; Boabosh (a ginger tabby) plays the ginger ones.
const SIDE = {
  w: { fur: "#ffffff", body: "#f4ecdf", stripe: "#cdbca4", eye: "#4aa3e0", line: "#2e2418", name: "white" }, // dark outline so white pieces pop on light squares
  b: { fur: "#f2a65a", body: "#e8964a", stripe: "#b5651d", eye: "#5f9e2f", line: "#6e3510", name: "ginger" },
};
const GOLD = `fill="#ffd23f" stroke="#a87b00" stroke-width="2.5" stroke-linejoin="round"`;

/** A kitten face centred on (cx, cy), radius r. */
function face(cx: number, cy: number, r: number, side: "w" | "b", ears = true) {
  const s = SIDE[side], k = r / 16;
  const P = (x: number, y: number) => `${cx + x * k} ${cy + y * k}`;
  return `
    ${ears ? `<path d="M${P(-15, -2)} L${P(-12, -19)} L${P(-3, -12)} Z M${P(15, -2)} L${P(12, -19)} L${P(3, -12)} Z" fill="${s.fur}" stroke="${s.line}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M${P(-12, -6)} L${P(-11, -15)} L${P(-6, -11)} Z M${P(12, -6)} L${P(11, -15)} L${P(6, -11)} Z" fill="#ffb3c1"/>` : ""}
    <ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.9}" fill="${s.fur}" stroke="${s.line}" stroke-width="2.5"/>
    <path d="M${P(-3, -13)} v${3 * k} M${P(0, -14)} v${4 * k} M${P(3, -13)} v${3 * k}" stroke="${s.stripe}" stroke-width="${1.6 * k}" stroke-linecap="round"/>
    <ellipse cx="${cx - 6 * k}" cy="${cy - 1 * k}" rx="${3.2 * k}" ry="${3.8 * k}" fill="${s.eye}"/>
    <ellipse cx="${cx + 6 * k}" cy="${cy - 1 * k}" rx="${3.2 * k}" ry="${3.8 * k}" fill="${s.eye}"/>
    <ellipse cx="${cx - 6 * k}" cy="${cy - 0.5 * k}" rx="${1.6 * k}" ry="${2.8 * k}" fill="#111"/>
    <ellipse cx="${cx + 6 * k}" cy="${cy - 0.5 * k}" rx="${1.6 * k}" ry="${2.8 * k}" fill="#111"/>
    <circle cx="${cx - 7 * k}" cy="${cy - 2.5 * k}" r="${1 * k}" fill="#fff"/><circle cx="${cx + 5 * k}" cy="${cy - 2.5 * k}" r="${1 * k}" fill="#fff"/>
    <path d="M${P(-1.6, 3)} h${3.2 * k} l${-1.6 * k} ${1.8 * k} Z" fill="#ff8fab"/>
    <path d="M${P(0, 5)} q${-2 * k} ${2.5 * k} ${-4 * k} ${1 * k} M${P(0, 5)} q${2 * k} ${2.5 * k} ${4 * k} ${1 * k}" stroke="${s.line}" stroke-width="1.4" fill="none"/>
    <path d="M${P(-8, 4)} h${-9 * k} M${P(8, 4)} h${9 * k}" stroke="${side === "w" ? "#b8aa98" : "#fff"}" stroke-width="1"/>`;
}

/**
 * Chess pieces: the real chess shapes (so they read as King, Queen, Rook...)
 * with kitten faces. Taller = more important, just like a real set.
 */
export function pieceSVG(kind: chess.Kind, side: "w" | "b") {
  const s = SIDE[side];
  const fill = `fill="${s.body}" stroke="${s.line}" stroke-width="2.5" stroke-linejoin="round"`;
  const base = `<path d="M20 97 h60 v-5 q0-6-9-8 h-42 q-9 2-9 8 Z" ${fill}/>`;
  let art = "";
  switch (kind) {
    case "P": // pawn: a little round piece
      art = `<path d="M34 86 q4-18 16-22 q12 4 16 22 Z" ${fill}/>${face(50, 52, 14, side)}`;
      break;
    case "R": // rook: a castle tower with battlements, kitten in the window
      art = `<path d="M28 86 L31 42 h38 L72 86 Z" ${fill}/>
        <path d="M24 44 V22 h11 v8 h9 v-8 h12 v8 h9 v-8 h11 V44 Z" ${fill}/>
        <path d="M28 86 L31 42 h38 L72 86" fill="none" stroke="${s.stripe}" stroke-width="1.5" stroke-dasharray="4 5"/>
        ${face(50, 62, 13, side, false)}`;
      break;
    case "B": // bishop: tall pointed mitre with the diagonal slit and a ball on top
      art = `<path d="M33 86 Q28 58 50 20 Q72 58 67 86 Z" ${fill}/>
        <path d="M56 32 L45 46" stroke="${s.line}" stroke-width="4" stroke-linecap="round"/>
        <circle cx="50" cy="15" r="5" ${fill}/>
        ${face(50, 64, 13, side, false)}`;
      break;
    case "N": // knight: the horse-head profile, kitten-eared
      art = `<path d="M30 86 Q28 66 40 56 Q26 56 22 46 Q22 36 34 30 Q38 16 50 14 L54 6 L58 15 Q76 20 76 46 Q76 70 70 86 Z" ${fill}/>
        <path d="M58 16 Q70 22 72 40 Q74 58 68 72" fill="none" stroke="${s.stripe}" stroke-width="5" stroke-linecap="round"/>
        <path d="M48 16 L46 6 L54 12" fill="#ffb3c1" stroke="${s.line}" stroke-width="2"/>
        <ellipse cx="44" cy="32" rx="4" ry="5" fill="${s.eye}"/><ellipse cx="44" cy="33" rx="2" ry="3.6" fill="#111"/>
        <circle cx="26" cy="44" r="2.4" fill="#ff8fab"/>
        <path d="M30 46 h-12 M30 49 l-11 3" stroke="${side === "w" ? "#b8aa98" : "#fff"}" stroke-width="1"/>
        <path d="M36 52 Q40 58 48 56" fill="none" stroke="${s.line}" stroke-width="1.6"/>`;
      break;
    case "Q": // queen: tall, flared, a pointed crown with pearls
      art = `<path d="M30 86 Q36 64 38 52 h24 Q64 64 70 86 Z" ${fill}/>
        ${face(50, 46, 15, side)}
        <path d="M33 34 L31 12 L40 24 L50 6 L60 24 L69 12 L67 34 Z" ${GOLD}/>
        <circle cx="31" cy="11" r="3.5" fill="#fff" stroke="#a87b00" stroke-width="1.5"/>
        <circle cx="50" cy="5" r="3.5" fill="#ff6bd6" stroke="#a87b00" stroke-width="1.5"/>
        <circle cx="69" cy="11" r="3.5" fill="#fff" stroke="#a87b00" stroke-width="1.5"/>
        <path d="M38 66 Q50 72 62 66" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="0.1 6" stroke-linecap="round"/>`;
      break;
    case "K": // king: the tallest, a crown topped with a cross, and a royal sash
      art = `<path d="M28 86 Q34 62 37 52 h26 Q66 62 72 86 Z" ${fill}/>
        <path d="M36 58 L64 80" stroke="#d62828" stroke-width="6" stroke-linecap="round"/>
        ${face(50, 46, 15, side)}
        <path d="M35 34 V20 l7 7 l8 -9 l8 9 l7 -7 V34 Z" ${GOLD}/>
        <path d="M50 1 v15 M43.5 7 h13" stroke="#a87b00" stroke-width="6" stroke-linecap="round"/>
        <path d="M50 1 v15 M43.5 7 h13" stroke="#ffd23f" stroke-width="3" stroke-linecap="round"/>`;
      break;
  }
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${base}${art}</svg>`;
}

/** A kitten head for tic-tac-toe. */
export const kittenSVG = (side: "w" | "b") => `<svg viewBox="0 0 100 100" aria-hidden="true">${face(50, 56, 34, side)}</svg>`;

/** Paw art for rock (curled), paper (spread wide) and scissors (two toes out). */
export function pawSVG(hand: Hand) {
  const toes: Record<Hand, [number, number, number][]> = {
    rock: [[36, 44, 8], [46, 40, 8], [56, 40, 8], [66, 44, 8]], // toes tucked in: a fist
    paper: [[22, 34, 10], [38, 18, 10], [58, 16, 10], [76, 30, 10], [86, 54, 9]],
    scissors: [[38, 14, 9], [64, 12, 9]],
  };
  // Scissors: two long toes in a V, outlined so they read on a light card.
  const extra = hand === "scissors"
    ? `<path d="M44 52 L38 16 M56 52 L64 14" stroke="#8a5a3a" stroke-width="20" stroke-linecap="round"/><path d="M44 52 L38 16 M56 52 L64 14" stroke="#f6e2c8" stroke-width="14" stroke-linecap="round"/>`
    : "";
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    ${extra}
    <ellipse cx="50" cy="64" rx="${hand === "rock" ? 26 : 30}" ry="${hand === "rock" ? 24 : 27}" fill="#f6e2c8" stroke="#8a5a3a" stroke-width="3"/>
    <ellipse cx="50" cy="70" rx="15" ry="12" fill="#ff9ab0"/>
    ${toes[hand].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#f6e2c8" stroke="#8a5a3a" stroke-width="2.5"/><circle cx="${x}" cy="${y + 1}" r="${r * 0.55}" fill="#ff9ab0"/>`).join("")}
  </svg>`;
}

// ============================================================================
// The games (DOM). Each mounts into `box` and reports the result via `done`.
// Two modes: against Boabosh (the active cat), or two people on one device.
// ============================================================================

export type Mode = "cat" | "duo";
/** win/lose = you vs the cat; p1/p2 = which person won in duo mode. */
export type Result = "win" | "lose" | "draw" | "p1" | "p2";
export type Hooks = { status: (text: string) => void; done: (r: Result) => void; mode: Mode; foe: string };

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", html = "") => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

// ---------- Kitten Tic-Tac-Toe ----------------------------------------------------
export function ticTacToe(box: HTMLElement, { status, done, mode, foe }: Hooks) {
  const board: Mark[] = Array(9).fill(null);
  let turn: "X" | "O" = "X", over = false, waiting = false;
  const who = (m: "X" | "O") => (mode === "duo" ? (m === "X" ? "Player 1 (white kittens)" : "Player 2 (ginger kittens)") : m === "X" ? "You" : foe);
  const grid = el("div", "ttt");
  box.replaceChildren(grid);
  const draw = (line: number[] = []) => {
    grid.replaceChildren(...board.map((m, i) => {
      const b = el("button", `cell${line.includes(i) ? " glow" : ""}`, m ? kittenSVG(m === "X" ? "w" : "b") : "");
      b.setAttribute("aria-label", m ? `${who(m)}'s kitten` : `empty square ${i + 1}`);
      b.disabled = over || waiting || !!m;
      b.onclick = () => place(i);
      return b;
    }));
  };
  const prompt = () => status(mode === "duo" ? `${who(turn)} — your turn!` : "Your turn! You're the white kittens 🤍");
  const finish = () => {
    const w = winner(board);
    if (!w) return false;
    over = true;
    if (w === "draw") { draw(); status("It's a draw — a cat's game! 😺"); done("draw"); return true; }
    draw(w.line);
    if (mode === "duo") { status(`Three in a row — ${who(w.mark)} wins! 🏆`); done(w.mark === "X" ? "p1" : "p2"); }
    else { status(w.mark === "X" ? "Three in a row — you beat " + foe + "! 🏆" : `${foe} got three in a row! Rematch soon?`); done(w.mark === "X" ? "win" : "lose"); }
    return true;
  };
  const place = (i: number) => {
    if (over || waiting || board[i]) return;
    board[i] = turn;
    sfx.pop();
    if (finish()) return;
    if (mode === "duo") { turn = turn === "X" ? "O" : "X"; draw(); prompt(); return; }
    waiting = true;
    draw();
    status(`${foe} is thinking… 🤔`);
    setTimeout(() => {
      waiting = false;
      board[coachMove(board, 0.35)] = "O";
      sfx.meow("short");
      if (!finish()) { draw(); prompt(); }
    }, 650);
  };
  prompt();
  draw();
}

// ---------- Paw Rock-Paper-Scissors (first to 2) -------------------------------------
export function rockPaperScissors(box: HTMLElement, { status, done, mode, foe }: Hooks) {
  let a = 0, b = 0, busy = false;
  let first: Hand | null = null; // duo mode: Player 1's secret pick
  const nameA = mode === "duo" ? "Player 1" : "You", nameB = mode === "duo" ? "Player 2" : foe;
  const arena = el("div", "rps");
  const score = el("p", "rps-score");
  const shows = el("div", "rps-show");
  const handA = el("div", "rps-hand", pawSVG("rock")), handB = el("div", "rps-hand coach", pawSVG("rock"));
  shows.append(el("span", "rps-who", nameA), handA, el("span", "rps-vs", "vs"), handB, el("span", "rps-who", nameB));
  const pick = el("div", "rps-pick");
  const label: Record<Hand, string> = { rock: "Rock", paper: "Paper", scissors: "Scissors" };
  for (const h of HANDS) {
    const btn = el("button", "rps-btn", `${pawSVG(h)}<span>${label[h]}</span>`);
    btn.onclick = () => choose(h);
    pick.append(btn);
  }
  arena.append(score, shows, pick);
  box.replaceChildren(arena);
  const tally = () => { score.textContent = `${nameA} ${a} – ${b} ${nameB} · first to 2 wins`; };
  const ask = () => status(mode === "duo"
    ? (first ? "🙈 Player 1, look away! Player 2, pick your paw." : "Player 1, pick your paw — Player 2, no peeking! 🙈")
    : "Pick a paw! Rock beats Scissors, Scissors beats Paper, Paper beats Rock.");

  const choose = (h: Hand) => {
    if (busy) return;
    if (mode === "duo" && !first) { first = h; sfx.pop(); ask(); return; } // keep it secret
    const pa = mode === "duo" ? first! : h;
    const pb = mode === "duo" ? h : HANDS[Math.floor(Math.random() * 3)]!;
    first = null;
    busy = true;
    [handA, handB].forEach((x) => { x.innerHTML = pawSVG("rock"); x.classList.add("shake"); });
    ["Paw…", "paw…", "POUNCE!"].forEach((w, i) => setTimeout(() => { status(w); sfx.pop(); }, i * 380));
    setTimeout(() => {
      [handA, handB].forEach((x) => x.classList.remove("shake"));
      handA.innerHTML = pawSVG(pa);
      handB.innerHTML = pawSVG(pb);
      const r = judge(pa, pb);
      if (r === "win") a++; else if (r === "lose") b++;
      tally();
      status(r === "draw" ? `Both ${label[pa]}! Go again!` : r === "win" ? `${label[pa]} beats ${label[pb]} — point to ${nameA}! ⭐` : `${label[pb]} beats ${label[pa]} — point to ${nameB}!`);
      (r === "draw" ? sfx.pop : sfx.chime)();
      if (a === 2 || b === 2) {
        pick.querySelectorAll("button").forEach((x) => { (x as HTMLButtonElement).disabled = true; });
        setTimeout(() => {
          const aWon = a === 2;
          status(`${aWon ? nameA : nameB} ${aWon && mode !== "duo" ? "win" : "wins"} the match! 🏆`);
          done(mode === "duo" ? (aWon ? "p1" : "p2") : aWon ? "win" : "lose");
        }, 700);
      } else { busy = false; setTimeout(ask, 900); }
    }, 1150);
  };
  tally();
  ask();
}

// ---------- Kitten Chess -----------------------------------------------------------------
export function kittenChess(box: HTMLElement, { status, done, mode, foe }: Hooks) {
  let pos = chess.start();
  let pick: number | null = null;
  let targets: chess.Move[] = [];
  let last: chess.Move | null = null;
  let over = false, thinking = false;
  const sideName = (s: chess.Side) => (mode === "duo" ? (s === "w" ? "Player 1 (white kittens)" : "Player 2 (ginger kittens)") : s === "w" ? "You" : foe);
  const wrap = el("div", "chess-wrap");
  const board = el("div", "chess");
  const taken = el("p", "chess-taken");
  // Piece guide: what each kitten is called, drawn the same as on the board.
  const legend = el("div", "chess-legend");
  for (const k of ["K", "Q", "R", "B", "N", "P"] as chess.Kind[]) {
    const item = el("div", "legend-item", `${pieceSVG(k, "w")}<span>${chess.NAMES[k] === "Castle" ? "Rook (Castle)" : chess.NAMES[k]}</span>`);
    legend.append(item);
  }
  wrap.append(board, taken, legend);
  box.replaceChildren(wrap);

  const name = (q: chess.Piece) => `${SIDE[q[0] as chess.Side].name} ${chess.NAMES[q[1] as chess.Kind]}`;
  const draw = () => {
    const check = chess.inCheck(pos) ? pos.board.indexOf(`${pos.turn}K`) : -1;
    board.replaceChildren(...pos.board.map((q, i) => {
      const r = i >> 3, c = i & 7;
      const cls = ["sq", (r + c) % 2 ? "dark" : "light"];
      if (i === pick) cls.push("picked");
      if (last && (i === last.from || i === last.to)) cls.push("last");
      if (i === check) cls.push("check");
      const tgt = targets.some((m) => m.to === i);
      if (tgt) cls.push(q ? "capture" : "dot");
      const b = el("button", cls.join(" "), q ? pieceSVG(q[1] as chess.Kind, q[0] as chess.Side) : "");
      b.setAttribute("aria-label", `${"abcdefgh"[c]}${8 - r}${q ? ` ${name(q)}` : ""}${tgt ? ", can move here" : ""}`);
      if (q) b.title = name(q);
      b.onclick = () => tap(i);
      return b;
    }));
  };
  const caught = { w: [] as chess.Kind[], b: [] as chess.Kind[] }; // pieces each side has captured
  const showTaken = () => {
    const list = (ks: chess.Kind[]) => ks.map((k) => chess.NAMES[k]).join(", ") || "none yet";
    taken.textContent = `${sideName("w")} caught: ${list(caught.w)}  ·  ${sideName("b")} caught: ${list(caught.b)}`;
  };
  const yourTurn = () => status(mode === "duo"
    ? `${sideName(pos.turn)} — your move!`
    : "Your move! Tap one of your white kittens to see where it can go.");
  const move = (m: chess.Move) => {
    const victim = m.ep ? pos.board[m.to + (pos.turn === "w" ? 8 : -8)] : pos.board[m.to];
    if (victim) caught[pos.turn].push(victim[1] as chess.Kind);
    pos = chess.play(pos, m);
    last = m;
    pick = null;
    targets = [];
    (victim ? sfx.swat : sfx.pop)();
    showTaken();
    draw();
    const st = chess.status(pos);
    if (st === "mate") {
      over = true;
      const winnerSide: chess.Side = pos.turn === "w" ? "b" : "w";
      if (mode === "duo") { status(`Checkmate! ${sideName(winnerSide)} wins! 🏆`); done(winnerSide === "w" ? "p1" : "p2"); }
      else { status(winnerSide === "w" ? `Checkmate! You beat ${foe}! 🏆` : `Checkmate — ${foe} wins this time. Great game!`); done(winnerSide === "w" ? "win" : "lose"); }
      return true;
    }
    if (st === "stalemate") { over = true; status("Stalemate — nobody can move. It's a draw! 😺"); done("draw"); return true; }
    if (st === "check") {
      const victimName = mode === "duo" ? `${sideName(pos.turn)}, your` : pos.turn === "w" ? "Your" : `${foe}'s`;
      status(`Check! ${victimName} King is in danger! 👑`);
      sfx.meow("curious");
    }
    return false;
  };
  const catTurn = () => {
    thinking = true;
    status(`${foe} is thinking… 🤔`);
    setTimeout(() => {
      const m = chess.bestMove(pos, 90);
      thinking = false;
      if (m && !move(m) && chess.status(pos) !== "check") yourTurn();
    }, 550);
  };
  const tap = (i: number) => {
    const mine = mode === "duo" ? pos.turn : "w";
    if (over || thinking || pos.turn !== mine) return;
    const m = targets.find((x) => x.to === i);
    if (m) {
      if (move(m)) return;
      if (mode === "cat") catTurn();
      else if (chess.status(pos) !== "check") yourTurn();
      return;
    }
    if (pos.board[i]?.[0] === mine) {
      pick = i;
      targets = chess.legal(pos).filter((x) => x.from === i);
      sfx.pop();
      const kind = chess.NAMES[pos.board[i]![1] as chess.Kind];
      status(targets.length ? `${kind} selected — it can go to the glowing squares.` : `That ${kind} can't move right now — try another!`);
    } else { pick = null; targets = []; }
    draw();
  };
  showTaken();
  draw();
  yourTurn();
}
