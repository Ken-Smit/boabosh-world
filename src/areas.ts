// The inside of each area. Walking onto a pad on the map fades into one of
// these: its own scene, lights, camera framing and things that move. Built on
// first visit and kept, so going back is instant.

import * as THREE from "three";
import type { Area } from "./state.ts";
import { makeCat, dress, type Cat } from "./cat.ts";
import { toonify } from "./toon.ts";
import { mat, rnd, range, choose, reseed, shadows, at, label, leafMats, bark, makePine, makeOak } from "./world.ts";

export type AreaScene = {
  scene: THREE.Scene;
  camPos: THREE.Vector3;
  camLook: THREE.Vector3;
  /** Where the cat appears, and where it walks to before the quiz opens. */
  entry: THREE.Vector3;
  stand: THREE.Vector3;
  update: (t: number) => void;
};

export function buildArea(area: Area): AreaScene {
  reseed(area === "forest" ? 11 : area === "mountain" ? 23 : 37);
  const a = area === "forest" ? forest() : area === "mountain" ? mountain() : lab();
  toonify(a.scene);
  return a;
}

// ---------- shared bits ------------------------------------------------------

function lights(scene: THREE.Scene, sky: number, ground: number, sunColor: number, sunPos: [number, number, number], sunPower = 2) {
  scene.add(new THREE.HemisphereLight(sky, ground, 1.3));
  const sun = new THREE.DirectionalLight(sunColor, sunPower);
  sun.position.set(...sunPos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  const c = sun.shadow.camera as THREE.OrthographicCamera;
  c.left = -14; c.right = 14; c.top = 14; c.bottom = -14; c.far = 70;
  scene.add(sun);
}

/** A boss cat sitting somewhere, wagging. Returns its per-frame wag. */
function boss(scene: THREE.Scene, coat: { fur: number; stripe: number }, hat: string | null, x: number, y: number, z: number, ry: number) {
  const c: Cat = makeCat(coat);
  dress(c, { hat, collar: null, glasses: null, back: null });
  c.group.position.set(x, y, z);
  c.group.rotation.y = ry;
  scene.add(c.group);
  return (t: number) => {
    c.tail.rotation.z = Math.sin(t * 2.2) * 0.35;
    c.group.position.y = y + Math.sin(t * 1.6) * 0.015;
  };
}

/** Bumpy ground plane with per-vertex colour. */
function ground(size: number, segs: number, colour: (x: number, z: number) => THREE.Color, height: (x: number, z: number) => number = () => 0) {
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position!, cols: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, height(x, z));
    const c = colour(x, z);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat(0xffffff, { vertexColors: true }));
  m.receiveShadow = true;
  return m;
}

const dummy = new THREE.Object3D();
/** Many copies of one shape in one draw call. `place` sets `dummy` and returns a colour (or nothing). */
function instanced(geo: THREE.BufferGeometry, material: THREE.Material, n: number, place: (i: number, d: THREE.Object3D) => THREE.Color | void) {
  const m = new THREE.InstancedMesh(geo, material, n);
  for (let i = 0; i < n; i++) {
    dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
    const c = place(i, dummy);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
    if (c) m.setColorAt(i, c);
  }
  return shadows(m);
}

function glowSprite(text: string, colour: string, size: number) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: label(text, "", colour, 128, 128, 90), transparent: true, depthWrite: false }));
  s.scale.setScalar(size);
  return s;
}

/** Points that drift, for fireflies, snow, dust. */
function particles(n: number, colour: number, size: number, box: THREE.Vector3, centre: THREE.Vector3, additive = true) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = centre.x + range(-box.x, box.x);
    pos[i * 3 + 1] = centre.y + range(0, box.y);
    pos[i * 3 + 2] = centre.z + range(-box.z, box.z);
  }
  const geo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({
    color: colour, size, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  return new THREE.Points(geo, m);
}

// ============================================================================
// Reading Forest: a clearing under a giant hollow Library Tree.
// ============================================================================
function forest(): AreaScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fbfa0);
  scene.fog = new THREE.Fog(0x8fbfa0, 14, 42);
  lights(scene, 0xe8fff0, 0x3d5a2e, 0xfff0c8, [-6, 16, 8], 2.2);
  const movers: ((t: number) => void)[] = [];

  const moss = [0x4f8a3a, 0x5d9a44, 0x6aa84f, 0x46803a].map((c) => new THREE.Color(c));
  const litter = new THREE.Color(0x8a6a3a);
  scene.add(ground(90, 90, (x, z) => {
    const c = choose(moss).clone();
    if (Math.hypot(x, z) < 4.2) c.lerp(new THREE.Color(0x9ab86a), 0.35); // sunny clearing
    return rnd() < 0.15 ? c.lerp(litter, 0.4) : c;
  }, (x, z) => (Math.hypot(x, z) > 9 ? Math.sin(x * 0.4) * Math.cos(z * 0.3) * 0.5 : 0)));

  // --- the Library Tree ---
  {
    const T = new THREE.Group();
    const trunkMat = mat(0x6b4a2b), darkBark = mat(0x4f3520);
    T.add(at(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.1, 10, 12, 4), trunkMat), 0, 5, 0));
    // Roots spreading into the ground.
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + range(-0.2, 0.2);
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.55, 3, 6).rotateX(Math.PI / 2), darkBark);
      root.position.set(Math.cos(a) * 1.7, 0.45, Math.sin(a) * 1.7);
      root.lookAt(Math.cos(a) * 4, -0.6, Math.sin(a) * 4);
      T.add(root);
    }
    // Bark ridges.
    for (let k = 0; k < 14; k++) {
      const a = rnd() * Math.PI * 2, y = range(1, 8);
      const r = 2.1 - (y / 10) * 0.6;
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.12, range(1, 2.2), 0.1), darkBark);
      ridge.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      ridge.rotation.y = -a;
      T.add(ridge);
    }
    // The hollow: a dark arch with glowing shelves of books inside.
    const hollow = new THREE.Mesh(new THREE.CircleGeometry(1.0, 24), new THREE.MeshBasicMaterial({ color: 0x2a1a0e }));
    hollow.scale.set(1, 1.35, 1);
    hollow.position.set(0, 1.5, 1.98);
    T.add(hollow);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.12, 6, 24, Math.PI), darkBark);
    arch.scale.set(1, 1.35, 1);
    arch.position.set(0, 1.5, 2.0);
    T.add(arch);
    const shelfMat = mat(0x9a6b3a);
    const bookCols = [0xc0392b, 0x2e86de, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0x16a085].map((c) => new THREE.Color(c));
    for (const y of [0.75, 1.35, 1.95]) T.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.3), shelfMat), 0, y, 1.92));
    T.add(instanced(new THREE.BoxGeometry(1, 1, 1), mat(0xffffff), 30, (i, d) => {
      const row = Math.floor(i / 10), col = i % 10;
      const h = range(0.32, 0.48);
      d.position.set(-0.62 + col * 0.135, [0.78, 1.38, 1.98][row]! + h / 2, 1.95);
      d.scale.set(0.1, h, 0.22);
      d.rotation.z = col === 9 ? 0.35 : 0;
      return choose(bookCols);
    }));
    const warm = new THREE.PointLight(0xffc870, 6, 6, 1.6);
    warm.position.set(0, 1.6, 2.6);
    T.add(warm);
    // Round little windows higher up, lit from inside.
    for (const [a, y] of [[0.5, 5.2], [-0.6, 6.6], [1.4, 7.6]] as const) {
      const r = 2.1 - (y / 10) * 0.6 + 0.02;
      const win = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), mat(0xffe3a0, { emissive: 0xffb84a, emissiveIntensity: 0.9 }));
      win.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
      win.rotation.y = a;
      T.add(win);
      const frame = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 4, 16), darkBark);
      frame.position.copy(win.position);
      frame.rotation.y = a;
      T.add(frame);
    }
    // Branches and a huge canopy.
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 4.5, 6).rotateX(Math.PI / 2), trunkMat);
      br.position.set(Math.cos(a) * 1.6, 8.5, Math.sin(a) * 1.6);
      br.lookAt(Math.cos(a) * 6, 11, Math.sin(a) * 6);
      T.add(br);
    }
    for (let k = 0; k < 16; k++) {
      const a = rnd() * Math.PI * 2, r = range(0, 5.5);
      T.add(at(new THREE.Mesh(new THREE.IcosahedronGeometry(range(1.8, 2.8), 0), choose(leafMats)), Math.cos(a) * r, range(10, 12.5), Math.sin(a) * r));
    }
    // Hanging lantern on the right branch, swaying.
    const lantern = new THREE.Group();
    lantern.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.6, 3), mat(0x333333)), 0, -0.8, 0));
    lantern.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.4, 6), mat(0xffe08a, { emissive: 0xffb030, emissiveIntensity: 1 })), 0, -1.75, 0));
    lantern.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.2, 6), mat(0x3a2a1a)), 0, -1.45, 0));
    const lampLight = new THREE.PointLight(0xffb040, 4, 5, 1.8);
    lampLight.position.y = -1.75;
    lantern.add(lampLight);
    lantern.position.set(3.4, 6.2, 1.2);
    T.add(lantern);
    movers.push((t) => { lantern.rotation.z = Math.sin(t * 1.1) * 0.08; lampLight.intensity = 4 + Math.sin(t * 13) * 0.3; });

    // An owl on the left branch who blinks.
    const owl = new THREE.Group();
    const owlBody = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), mat(0x8a6a4a));
    owlBody.scale.set(1, 1.25, 0.9);
    owl.add(owlBody);
    owl.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat(0xe8d6b0)), 0, 0.12, 0.2).rotateX(0.2));
    const owlEyes: THREE.Mesh[] = [];
    for (const x of [-0.1, 0.1]) {
      owl.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat(0xffd23f)), x, 0.18, 0.33));
      const p = at(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(0x111111)), x, 0.18, 0.4);
      owl.add(p); owlEyes.push(p);
      const tuft = at(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 4), mat(0x6a4a2a)), x * 2, 0.45, 0.05);
      tuft.rotation.z = -x * 3;
      owl.add(tuft);
    }
    owl.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 4), mat(0xe0a020)), 0, 0.08, 0.42).rotateX(Math.PI));
    owl.position.set(-3.3, 8.55, 1.6);
    T.add(owl);
    movers.push((t) => {
      const blink = (t % 4) < 0.15 ? 0.1 : 1;
      owlEyes.forEach((e) => { e.scale.y = blink; });
      owl.rotation.y = Math.sin(t * 0.4) * 0.5;
    });

    T.position.set(0, 0, -7);
    scene.add(shadows(T));
  }

  // --- tall trees all around ---
  for (let k = 0; k < 70; k++) {
    const a = rnd() * Math.PI * 2, r = range(8, 30);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z > 3 && Math.abs(x) < 5) continue; // keep the way in clear
    const t = rnd() < 0.55 ? makePine(range(2.2, 3.8)) : makeOak(range(2, 3.2));
    scene.add(at(t, x, 0, z));
  }
  // Ferns: fans of long leaves.
  {
    const leaf = new THREE.ConeGeometry(0.09, 1, 3).translate(0, 0.5, 0);
    const spots: [number, number][] = [];
    while (spots.length < 40) {
      const a = rnd() * Math.PI * 2, r = range(4.5, 12);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!(z > 2 && Math.abs(x) < 2.5)) spots.push([x, z]);
    }
    const greens = [0x3f8a3a, 0x4f9a40, 0x2f7a30].map((c) => new THREE.Color(c));
    scene.add(instanced(leaf, mat(0xffffff), spots.length * 7, (i, d) => {
      const [x, z] = spots[Math.floor(i / 7)]!;
      d.position.set(x, 0, z);
      d.rotation.order = "YXZ";
      d.rotation.set(range(0.7, 1.1), (i % 7) * 0.9 + range(-0.2, 0.2), 0);
      d.scale.setScalar(range(0.7, 1.2));
      return choose(greens);
    }));
  }
  // Fallen leaves on the forest floor.
  {
    const cols = [0xd9822b, 0xc0392b, 0xe6b422, 0x8a5a2b].map((c) => new THREE.Color(c));
    scene.add(instanced(new THREE.CircleGeometry(0.08, 5).rotateX(-Math.PI / 2), mat(0xffffff, { side: THREE.DoubleSide }), 400, (_, d) => {
      const a = rnd() * Math.PI * 2, r = range(1, 14);
      d.position.set(Math.cos(a) * r, 0.02, Math.sin(a) * r);
      d.rotation.y = rnd() * 6;
      d.scale.set(1, 1, 1.6);
      return choose(cols);
    }));
  }
  // Fairy ring of mushrooms around the clearing.
  {
    const red = mat(0xd63a2f), stem = mat(0xf4ead5), dot = mat(0xffffff);
    for (let k = 0; k < 22; k++) {
      const a = (k / 22) * Math.PI * 2;
      if (Math.sin(a) > 0.82) continue; // gap where the cat walks in
      const g = new THREE.Group();
      g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.22, 6), stem), 0, 0.11, 0));
      g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), red), 0, 0.2, 0));
      for (let d = 0; d < 4; d++) g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), dot), Math.cos(d * 1.6) * 0.09, 0.31, Math.sin(d * 1.6) * 0.09));
      g.scale.setScalar(range(0.8, 1.3));
      scene.add(shadows(at(g, Math.cos(a) * 4.3, 0, Math.sin(a) * 4.3)));
    }
  }
  // Reading stumps and stacks of books.
  {
    const ringTop = mat(0xd9b77e);
    for (const [x, z] of [[-3.2, -1.6], [3.2, -1.4], [-3.6, 1.6], [3.5, 1.8]] as const) {
      const s = new THREE.Group();
      s.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.5, 10), bark), 0, 0.25, 0));
      s.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.02, 10), ringTop), 0, 0.51, 0));
      s.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.012, 3, 16).rotateX(Math.PI / 2), mat(0xb08a50)), 0, 0.525, 0));
      scene.add(shadows(at(s, x, 0, z)));
    }
    const cols = [0xc0392b, 0x2e86de, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22];
    for (const [x, z, n] of [[-2.2, -3.2, 5], [2.4, -3.4, 3], [-4.8, -0.2, 4], [5, 0.2, 6], [1.8, 3.0, 3]] as const) {
      let y = 0;
      for (let k = 0; k < n; k++) {
        const h = range(0.1, 0.16);
        const b = new THREE.Mesh(new THREE.BoxGeometry(range(0.5, 0.7), h, range(0.38, 0.5)), mat(choose(cols)));
        b.position.set(x + range(-0.05, 0.05), y + h / 2, z);
        b.rotation.y = range(-0.4, 0.4);
        scene.add(shadows(b));
        // Pages: a cream stripe down one side.
        scene.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.02, h * 0.8, 0.36), mat(0xfdf6e3)), x + 0.31, y + h / 2, z).rotateY(b.rotation.y));
        y += h;
      }
    }
  }
  // A big open storybook on a stand, pages turning.
  {
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 1.0, 6), mat(0x6b4421)), 0, 0.5, 0));
    const tilt = new THREE.Group();
    tilt.position.y = 1.05; tilt.rotation.x = 0.55;
    tilt.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 1), mat(0x8e2c3a)));
    const pageMat = new THREE.MeshLambertMaterial({ map: label("Once upon a time…", "#fdf6e3", "#4a3a2a", 512, 256, 46), side: THREE.DoubleSide });
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), sx < 0 ? pageMat : mat(0xfdf6e3, { side: THREE.DoubleSide }));
      p.rotation.x = -Math.PI / 2;
      p.position.set(sx * 0.37, 0.035, 0);
      tilt.add(p);
    }
    const turning = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9).translate(0.35, 0, 0), mat(0xfffbef, { side: THREE.DoubleSide }));
    turning.rotation.x = -Math.PI / 2;
    const hinge = new THREE.Group();
    hinge.position.y = 0.04;
    hinge.add(turning);
    tilt.add(hinge);
    g.add(tilt);
    g.position.set(-1.8, 0, -2.6);
    g.rotation.y = 0.35;
    scene.add(shadows(g));
    movers.push((t) => { const f = (t * 0.25) % 1; hinge.rotation.z = f < 0.5 ? Math.sin(f * 2 * Math.PI / 2) * Math.PI : Math.PI; hinge.visible = f < 0.5; });
  }
  // A brook down the left, with a little arched bridge.
  {
    const geo = new THREE.PlaneGeometry(2.2, 60, 1, 90).rotateX(-Math.PI / 2);
    const brookX = (z: number) => -8 + Math.sin(z * 0.22) * 2.2;
    const pos = geo.attributes.position!;
    for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) + brookX(pos.getZ(i)));
    const waterMat = new THREE.MeshPhongMaterial({ color: 0x4aa6d6, shininess: 100, specular: 0xffffff, transparent: true, opacity: 0.88 });
    const water = new THREE.Mesh(geo, waterMat);
    water.position.y = 0.04;
    water.receiveShadow = true;
    scene.add(water);
    scene.add(instanced(new THREE.DodecahedronGeometry(1, 0), mat(0x9d968a), 140, (i, d) => {
      const z = range(-28, 28), side = i % 2 ? 1 : -1, s = range(0.12, 0.3);
      d.position.set(brookX(z) + side * range(1.1, 1.4), s * 0.3, z);
      d.scale.set(s, s * 0.6, s);
      d.rotation.set(rnd(), rnd(), 0);
    }));
    const bridge = new THREE.Group();
    const plank = mat(0xa0703a);
    for (let k = 0; k < 9; k++) {
      const u = (k / 8) * 2 - 1;
      bridge.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 1.1), plank), u * 1.5, 0.45 * (1 - u * u) + 0.05, 0).rotateZ(-u * 0.5));
    }
    for (const z of [-0.55, 0.55]) for (const u of [-1, 0, 1]) bridge.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 5), plank), u * 1.3, 0.3 + 0.45 * (1 - u * u), z));
    bridge.position.set(brookX(1.5), 0, 1.5);
    scene.add(shadows(bridge));
    movers.push((t) => waterMat.color.setHSL(0.56, 0.6, 0.55 + Math.sin(t * 2) * 0.025));
  }
  // Sunbeams slanting through the canopy.
  for (const [x, z, r] of [[-1.5, -1, 1.2], [3, 0.5, 0.9], [-5, 2, 0.8]] as const) {
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.5, r, 14, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff3c0, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    beam.position.set(x - 2, 7, z);
    beam.rotation.z = 0.28;
    scene.add(beam);
  }
  // Glowing letters drifting up out of the tree's hollow.
  {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const cols = ["#fff3a0", "#bff7ff", "#ffd1f0", "#d4ffbf"];
    const sprites = Array.from({ length: 18 }, (_, i) => {
      const s = glowSprite(choose(letters), choose(cols), 0.55);
      s.userData.ph = i / 18;
      s.userData.x = range(-3, 3);
      scene.add(s);
      return s;
    });
    movers.push((t) => sprites.forEach((s) => {
      const f = (t * 0.06 + s.userData.ph) % 1;
      s.position.set(s.userData.x * f + Math.sin(t + s.userData.ph * 20) * 0.3, 1.5 + f * 7, -5 + f * 4);
      s.material.opacity = Math.min(1, f * 6) * (1 - f);
    }));
  }
  // Fireflies.
  {
    const ff = particles(80, 0xfff27a, 0.12, new THREE.Vector3(9, 3, 9), new THREE.Vector3(0, 0.3, 0));
    scene.add(ff);
    const base = (ff.geometry.attributes.position!.array as Float32Array).slice();
    movers.push((t) => {
      const p = ff.geometry.attributes.position!;
      for (let i = 0; i < p.count; i++) {
        p.setXYZ(i, base[i * 3]! + Math.sin(t * 0.7 + i) * 0.4, base[i * 3 + 1]! + Math.sin(t * 1.3 + i * 2) * 0.25, base[i * 3 + 2]! + Math.cos(t * 0.6 + i) * 0.4);
      }
      p.needsUpdate = true;
      (ff.material as THREE.PointsMaterial).opacity = 0.7 + Math.sin(t * 5) * 0.3;
    });
  }

  // Willow, the forest's boss cat: a silver tabby with an acorn hat, on a stump.
  movers.push(boss(scene, { fur: 0xb8b8b4, stripe: 0x55575a }, "acorn-hat", 3.2, 0.52, -1.4, -0.5));

  return {
    scene, update: (t) => movers.forEach((m) => m(t)),
    camPos: new THREE.Vector3(1.5, 4.2, 10.5), camLook: new THREE.Vector3(2.2, 2.4, -2),
    entry: new THREE.Vector3(0, 0, 6.5), stand: new THREE.Vector3(0, 0, 0.8),
  };
}

// ============================================================================
// Math Mountain: a snowy summit plateau above the clouds.
// ============================================================================
function mountain(): AreaScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7fbde8);
  scene.fog = new THREE.Fog(0xd9ecf8, 25, 85);
  lights(scene, 0xeaf6ff, 0x9aa8b8, 0xffffff, [8, 18, 10], 2.4);
  const movers: ((t: number) => void)[] = [];
  const snow = mat(0xf6f9fc), rockMats = [0x8d7d9c, 0x7a6c8a, 0x9c8fa8, 0x6c6078].map((c) => mat(c));

  // --- the plateau: a rough rock column with a snowy top ---
  {
    const geo = new THREE.CylinderGeometry(12, 9, 14, 28, 6);
    const pos = geo.attributes.position!;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 6.95) continue; // keep the top rim tidy
      const k = range(0.88, 1.1);
      pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k);
    }
    geo.computeVertexNormals();
    const top = ground(24, 48, () => new THREE.Color(rnd() < 0.08 ? 0xdde6f0 : 0xf4f8fc), (x, z) => (Math.hypot(x, z) > 4 ? Math.sin(x * 0.8) * Math.cos(z * 0.7) * 0.15 : 0));
    // Clip the square snow sheet to a circle by dropping corners under the rock.
    const tp = top.geometry.attributes.position!;
    for (let i = 0; i < tp.count; i++) if (Math.hypot(tp.getX(i), tp.getZ(i)) > 11.8) tp.setY(i, -1);
    top.geometry.computeVertexNormals();
    scene.add(top);
    const col = new THREE.Mesh(geo, rockMats[1]);
    col.position.y = -7.02;
    col.receiveShadow = true;
    scene.add(col);
  }
  // Cloud sea below, with peaks poking up through it.
  {
    const sea = new THREE.Mesh(new THREE.CircleGeometry(150, 32).rotateX(-Math.PI / 2), mat(0xffffff, { emissive: 0xdde8f2, emissiveIntensity: 0.5 }));
    sea.position.y = -8;
    scene.add(sea);
    const cloudMat = mat(0xffffff, { emissive: 0xe8f0f8, emissiveIntensity: 0.4 });
    const puffs = instanced(new THREE.IcosahedronGeometry(1, 1), cloudMat, 160, (_, d) => {
      const a = rnd() * Math.PI * 2, r = range(14, 70);
      d.position.set(Math.cos(a) * r, -7.5 + range(0, 1.5), Math.sin(a) * r);
      d.scale.set(range(2, 5), range(1, 2), range(2, 5));
    });
    puffs.castShadow = false;
    scene.add(puffs);
    movers.push((t) => { puffs.rotation.y = t * 0.004; });
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2 + range(-0.15, 0.15), r = range(28, 60), h = range(14, 30), w = range(5, 10);
      const peak = new THREE.Mesh(new THREE.ConeGeometry(w, h, 7), choose(rockMats));
      peak.position.set(Math.cos(a) * r, -8 + h / 2, Math.sin(a) * r);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.38, h * 0.38, 7), snow);
      cap.position.y = h / 2 - h * 0.19 + 0.05;
      cap.scale.set(1.04, 1, 1.04);
      peak.add(cap);
      scene.add(peak);
    }
  }
  // Snow mounds, rocks and ice patches on the plateau.
  scene.add(instanced(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), snow, 18, (_, d) => {
    const a = rnd() * Math.PI * 2, r = range(6, 10.5);
    d.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    d.scale.set(range(0.6, 1.5), range(0.3, 0.6), range(0.6, 1.4));
  }));
  scene.add(instanced(new THREE.DodecahedronGeometry(1, 0), mat(0x8a7f96), 30, (_, d) => {
    const a = rnd() * Math.PI * 2, r = range(4, 11);
    const s = range(0.2, 0.6);
    d.position.set(Math.cos(a) * r, s * 0.3, Math.sin(a) * r);
    if (d.position.z > 3 && Math.abs(d.position.x) < 2) d.position.x += 3; // path in
    d.scale.set(s, s * 0.7, s);
    d.rotation.set(rnd(), rnd(), rnd());
  }));
  for (const [x, z, r] of [[-2.8, 3.8, 0.9], [6.5, -1.5, 0.7]] as const) {
    const ice = new THREE.Mesh(new THREE.CircleGeometry(r, 12).rotateX(-Math.PI / 2), new THREE.MeshPhongMaterial({ color: 0xbfe6ff, shininess: 120, specular: 0xffffff, transparent: true, opacity: 0.8 }));
    ice.position.set(x, 0.02, z);
    scene.add(ice);
  }
  // Snowy pines around the rim.
  for (let k = 0; k < 22; k++) {
    const a = rnd() * Math.PI * 2, r = range(8.5, 11);
    if (Math.sin(a) > 0.75) continue;
    const p = makePine(range(1.2, 2), mat(0x2f6a4a));
    p.children.slice(1).forEach((cone) => {
      const capSnow = new THREE.Mesh(new THREE.ConeGeometry(((cone as THREE.Mesh).geometry as THREE.ConeGeometry).parameters.radius * 0.55, 0.4, 7), snow);
      capSnow.position.copy(cone.position).setY(cone.position.y + 0.3);
      p.add(capSnow);
    });
    scene.add(shadows(at(p, Math.cos(a) * r, 0, Math.sin(a) * r)));
  }

  // --- the Giant Abacus: beads slide over as it counts ---
  {
    const g = new THREE.Group();
    const wood = mat(0x8b5a2b);
    for (const x of [-2, 2]) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.4, 0.35), wood), x, 1.7, 0));
    for (const y of [0.35, 3.25]) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.22, 0.4), wood), 0, y, 0));
    const beadCols = [0xe74c3c, 0xf39c12, 0xf1c40f, 0x2ecc71, 0x3498db];
    const rows: THREE.Mesh[][] = [];
    beadCols.forEach((c, r) => {
      const y = 0.85 + r * 0.55;
      g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.8, 5).rotateZ(Math.PI / 2), mat(0xcccccc)), 0, y, 0));
      const beadMat = mat(c);
      const beads = Array.from({ length: 10 }, () => {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), beadMat);
        b.scale.set(0.7, 1, 1);
        b.position.y = y;
        g.add(b);
        return b;
      });
      rows.push(beads);
    });
    g.position.set(-0.5, 0, -6);
    scene.add(shadows(g));
    movers.push((t) => rows.forEach((beads, r) => {
      const count = Math.floor(t * 0.8 + r * 2.3) % 11; // each row counts 0..10 on its own
      beads.forEach((b, j) => {
        const goal = j < count ? -1.75 + j * 0.25 : 1.75 - (9 - j) * 0.25;
        b.position.x += (goal - b.position.x) * 0.12;
      });
    }));
  }
  // --- Number Stairs climbing to a lookout with a bell ---
  {
    const g = new THREE.Group();
    const stone = [mat(0xa59bb3), mat(0x958aa4)];
    const numCols = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#1abc9c", "#3498db", "#9b59b6", "#e84393", "#fd79a8", "#00b894"];
    for (let i = 1; i <= 10; i++) {
      const h = i * 0.36;
      g.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.5, h, 0.75), stone[i % 2]!), 0, h / 2, -i * 0.75));
      const n = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.3), new THREE.MeshLambertMaterial({ map: label(String(i), numCols[i - 1]!, "#ffffff", 128, 112, 80) }));
      n.position.set(0, h - 0.18, -i * 0.75 + 0.38);
      g.add(n);
    }
    const top = 3.6;
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.4, top, 2.4), stone[0]!), 0, top / 2, -8.7));
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.15, 2.5), snow), 0, top + 0.07, -8.7));
    // Bell frame.
    for (const x of [-0.7, 0.7]) g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 5), mat(0x6b4421)), x, top + 0.8, -8.7));
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), mat(0x6b4421)), 0, top + 1.6, -8.7));
    const bell = new THREE.Group();
    bell.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.35, 0.5, 12, 1, true), mat(0xd4a017, { side: THREE.DoubleSide })), 0, -0.35, 0));
    bell.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), mat(0x8a6a10)), 0, -0.62, 0));
    bell.position.set(0, top + 1.55, -8.7);
    g.add(bell);
    movers.push((t) => { bell.rotation.z = Math.sin(t * 2) * 0.25; });
    g.position.set(5.6, 0, 1.6);
    g.rotation.y = -0.25;
    scene.add(shadows(g));
  }
  // --- Clock Rock: a big clock whose hands sweep round ---
  {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d")!;
    x.fillStyle = "#fffaf0"; x.beginPath(); x.arc(128, 128, 124, 0, Math.PI * 2); x.fill();
    x.lineWidth = 8; x.strokeStyle = "#3a2a1a"; x.stroke();
    x.fillStyle = "#3a2a1a"; x.font = "bold 30px Trebuchet MS, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
    for (let h = 1; h <= 12; h++) {
      const a = (h / 12) * Math.PI * 2;
      x.fillText(String(h), 128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96);
    }
    for (let m = 0; m < 60; m++) {
      const a = (m / 60) * Math.PI * 2, r0 = m % 5 ? 112 : 106;
      x.lineWidth = m % 5 ? 2 : 4;
      x.beginPath(); x.moveTo(128 + Math.sin(a) * r0, 128 - Math.cos(a) * r0); x.lineTo(128 + Math.sin(a) * 118, 128 - Math.cos(a) * 118); x.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.DodecahedronGeometry(1.3, 0), rockMats[0]), 0, 1.0, -0.4).rotateY(0.4));
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.15, 32).rotateX(Math.PI / 2), mat(0x8b5a2b)), 0, 1.9, 0.6));
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.85, 32), new THREE.MeshLambertMaterial({ map: tex }));
    face.position.set(0, 1.9, 0.69);
    g.add(face);
    const hand = (len: number, w: number, col: number) => {
      const h = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.03).translate(0, len / 2, 0), mat(col));
      h.position.set(0, 1.9, 0.72);
      g.add(h);
      return h;
    };
    const hourHand = hand(0.42, 0.07, 0x2b2118), minHand = hand(0.66, 0.05, 0x2b2118);
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(0xd4a017)), 0, 1.9, 0.74));
    g.position.set(-4.6, 0, -2.4);
    g.rotation.y = 0.35;
    scene.add(shadows(g));
    movers.push((t) => {
      const minutes = t * 6; // one clock-hour every 10 seconds
      minHand.rotation.z = -(minutes / 60) * Math.PI * 2;
      hourHand.rotation.z = -(minutes / 720) * Math.PI * 2;
    });
  }
  // --- Shape Garden: solids on pedestals, slowly turning ---
  {
    const shapes: THREE.Mesh[] = [];
    const defs: [THREE.BufferGeometry, number][] = [
      [new THREE.BoxGeometry(0.55, 0.55, 0.55), 0xe74c3c],
      [new THREE.ConeGeometry(0.4, 0.65, 4), 0xf1c40f],
      [new THREE.SphereGeometry(0.34, 16, 12), 0x3498db],
      [new THREE.CylinderGeometry(0.3, 0.3, 0.6, 16), 0x2ecc71],
      [new THREE.ConeGeometry(0.38, 0.7, 24), 0x9b59b6],
    ];
    defs.forEach(([geo, c], i) => {
      const x = -6.3 + i * 1.05, z = 2.2 + Math.sin(i) * 0.4;
      scene.add(shadows(at(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.7, 8), mat(0xc9c1d4)), x, 0.35, z)));
      const s = new THREE.Mesh(geo, mat(c));
      s.position.set(x, 1.1, z);
      scene.add(shadows(s));
      shapes.push(s);
    });
    movers.push((t) => shapes.forEach((s, i) => { s.rotation.y = t * 0.6 + i; s.position.y = 1.1 + Math.sin(t * 1.5 + i) * 0.05; }));
  }
  // --- camp: tent, crackling fire, log seats ---
  {
    const tent = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 3).rotateY(Math.PI / 2).rotateZ(Math.PI / 2), mat(0xe67e22));
    tent.position.set(9.0, 0.55, 0.2);
    tent.rotation.y = -1.2;
    scene.add(shadows(tent));
    const fire = new THREE.Group();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      fire.add(at(new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), mat(0x6f6a72)), Math.cos(a) * 0.5, 0.08, Math.sin(a) * 0.5));
    }
    for (const a of [0.4, 2.1, 3.7]) fire.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 5), bark), 0, 0.12, 0).rotateY(a).rotateZ(Math.PI / 2 - 0.2));
    const flames: THREE.Mesh[] = [];
    for (const [c, s] of [[0xff5a1f, 1], [0xffa31a, 0.75], [0xfff06a, 0.45]] as const) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.25 * s, 0.8 * s, 6), new THREE.MeshBasicMaterial({ color: c }));
      f.position.y = 0.3 + 0.4 * s - 0.2;
      fire.add(f);
      flames.push(f);
    }
    const fireLight = new THREE.PointLight(0xff8a30, 5, 6, 1.6);
    fireLight.position.y = 0.7;
    fire.add(fireLight);
    fire.position.set(8.0, 0, 3.0);
    scene.add(shadows(fire));
    const embers = particles(30, 0xffb040, 0.08, new THREE.Vector3(0.3, 2.2, 0.3), new THREE.Vector3(8.0, 0.4, 3.0));
    scene.add(embers);
    const eb = (embers.geometry.attributes.position!.array as Float32Array).slice();
    movers.push((t) => {
      flames.forEach((f, i) => { f.scale.set(1, 0.85 + Math.sin(t * 14 + i * 2) * 0.15, 1); f.rotation.y = t * (i + 1); });
      fireLight.intensity = 5 + Math.sin(t * 17) * 0.8 + Math.sin(t * 7) * 0.5;
      const p = embers.geometry.attributes.position!;
      for (let i = 0; i < p.count; i++) {
        const f = (t * 0.5 + i / p.count) % 1;
        p.setXYZ(i, eb[i * 3]! + Math.sin(t + i) * 0.2 * f, 0.4 + f * 2.2, eb[i * 3 + 2]!);
      }
      p.needsUpdate = true;
    });
    for (const [x, z, ry] of [[7.0, 4.2, 0.6], [9.3, 3.6, 2.0]] as const) {
      scene.add(shadows(at(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.2, 8).rotateZ(Math.PI / 2), bark), x, 0.22, z).rotateY(ry)));
    }
  }
  // --- prayer flags strung between two poles, fluttering ---
  {
    const A = new THREE.Vector3(-8, 2.8, -3.5), B = new THREE.Vector3(-2.6, 2.8, -8.5);
    for (const p of [A, B]) scene.add(shadows(at(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.9, 5), mat(0x6b4421)), p.x, 1.45, p.z)));
    const curve = new THREE.QuadraticBezierCurve3(A, A.clone().lerp(B, 0.5).setY(1.9), B);
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.015, 3), mat(0x444444)));
    const cols = [0x3498db, 0xffffff, 0xe74c3c, 0x2ecc71, 0xf1c40f];
    const flags: THREE.Mesh[] = [];
    const tri = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.18, 0, 0), new THREE.Vector3(0.18, 0, 0), new THREE.Vector3(0, -0.42, 0)]);
    tri.computeVertexNormals();
    for (let k = 1; k < 14; k++) {
      const f = new THREE.Mesh(tri, mat(cols[k % cols.length]!, { side: THREE.DoubleSide }));
      f.position.copy(curve.getPoint(k / 14));
      f.lookAt(f.position.clone().add(new THREE.Vector3(1, 0, -1).cross(new THREE.Vector3(0, 1, 0))));
      scene.add(f);
      flags.push(f);
    }
    movers.push((t) => flags.forEach((f, i) => { f.rotation.x = Math.sin(t * 4 + i) * 0.35; }));
  }
  // Falling snow.
  {
    const flakes = particles(700, 0xffffff, 0.09, new THREE.Vector3(18, 14, 18), new THREE.Vector3(0, 0, 0), false);
    scene.add(flakes);
    movers.push((t) => {
      const p = flakes.geometry.attributes.position!;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) - 0.02 - (i % 5) * 0.003;
        if (y < 0) y += 14;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(t + i) * 0.004);
      }
      p.needsUpdate = true;
    });
  }
  // Two eagles circling the summit.
  {
    const birds = [0, 1].map(() => {
      const b = new THREE.Group();
      const wingGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0.2), new THREE.Vector3(0, 0, -0.2), new THREE.Vector3(1, 0, 0)]);
      wingGeo.computeVertexNormals();
      const m = mat(0x4a3a2a, { side: THREE.DoubleSide });
      const l = new THREE.Mesh(wingGeo, m), r = new THREE.Mesh(wingGeo, m);
      r.rotation.y = Math.PI;
      b.add(l, r, new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.4, 2, 5).rotateX(Math.PI / 2), m));
      scene.add(b);
      return { b, l, r };
    });
    movers.push((t) => birds.forEach(({ b, l, r }, i) => {
      const a = t * 0.25 + i * Math.PI, R = 12 + i * 4;
      b.position.set(Math.cos(a) * R, 9 + i * 2 + Math.sin(t) * 0.5, Math.sin(a) * R - 6);
      b.rotation.set(0, -a, 0.3);
      const flap = Math.sin(t * 3 + i) * 0.35;
      l.rotation.z = flap; r.rotation.z = flap;
    }));
  }

  // Professor Tabby: a ginger tabby in a bobble hat, beside the abacus.
  movers.push(boss(scene, { fur: 0xe8964a, stripe: 0xa8521e }, "bobble-hat", 2.4, 0, -5.2, -0.4));

  return {
    scene, update: (t) => movers.forEach((m) => m(t)),
    camPos: new THREE.Vector3(1.5, 5.5, 12), camLook: new THREE.Vector3(2.2, 1.8, -2),
    entry: new THREE.Vector3(0, 0, 7.5), stand: new THREE.Vector3(0, 0, 1.2),
  };
}

// ============================================================================
// Science Lab: inside the lab building.
// ============================================================================
function lab(): AreaScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x24313f);
  lights(scene, 0xffffff, 0x8899aa, 0xe8f4ff, [4, 14, -12], 1.4);
  const movers: ((t: number) => void)[] = [];
  const W = 18, D = 13, Hh = 7; // room size

  // --- floor, walls, wainscot ---
  {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "#e9eef2"; g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#9fb4c4"; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64);
    g.strokeStyle = "#ffffff55"; g.lineWidth = 2; g.strokeRect(0, 0, 128, 128); g.strokeRect(0, 0, 64, 64); g.strokeRect(64, 64, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(W / 2, D / 2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: tex }));
    floor.receiveShadow = true;
    scene.add(floor);
    const wall = mat(0xd6ece6), wains = mat(0x5f8fa8), trim = mat(0xffffff);
    const walls: [number, number, number, number, number][] = [
      [0, Hh / 2, -D / 2, W, 0],            // back
      [-W / 2, Hh / 2, 0, D, Math.PI / 2],  // left
      [W / 2, Hh / 2, 0, D, -Math.PI / 2],  // right
    ];
    for (const [x, y, z, w, ry] of walls) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, Hh), wall);
      m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true;
      scene.add(m);
      const wn = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.1), wains);
      wn.position.set(x, 0.55, z).add(new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)).multiplyScalar(0.01));
      wn.rotation.y = ry;
      scene.add(wn);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.06), trim);
      rail.position.set(x, 1.12, z).add(new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)).multiplyScalar(0.03));
      rail.rotation.y = ry;
      scene.add(rail);
    }
  }
  // --- tall windows on the back wall, sky glowing through ---
  {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, "#6fb6ec"); grad.addColorStop(0.75, "#cfeaff"); grad.addColorStop(0.76, "#8fcf7a"); grad.addColorStop(1, "#6fae5a");
    g.fillStyle = grad; g.fillRect(0, 0, 64, 128);
    const sky = new THREE.CanvasTexture(c);
    sky.colorSpace = THREE.SRGBColorSpace;
    for (const x of [-6, 6]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.6), new THREE.MeshBasicMaterial({ map: sky }));
      pane.position.set(x, 3.4, -D / 2 + 0.02);
      scene.add(pane);
      const frame = mat(0xffffff);
      for (const [fx, fy, fw, fh] of [[0, 1.8, 2.6, 0.12], [0, -1.8, 2.6, 0.12], [-1.25, 0, 0.12, 3.7], [1.25, 0, 0.12, 3.7], [0, 0, 0.08, 3.6], [0, 0.3, 2.4, 0.08]] as const) {
        scene.add(at(new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.1), frame), x + fx, 3.4 + fy, -D / 2 + 0.06));
      }
      scene.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 0.35), frame), x, 1.55, -D / 2 + 0.17));
      // A little potted cactus on each sill.
      scene.add(shadows(at(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.22, 8), mat(0xc0643a)), x + 0.8, 1.71, -D / 2 + 0.2)));
      scene.add(shadows(at(new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.2, 2, 6), mat(0x4f9a40)), x + 0.8, 1.98, -D / 2 + 0.2)));
    }
  }
  // --- chalkboard with science sketches ---
  {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 512;
    const g = c.getContext("2d")!;
    g.fillStyle = "#2f4a3a"; g.fillRect(0, 0, 1024, 512);
    g.strokeStyle = "#ffffffd0"; g.fillStyle = "#ffffffe0"; g.lineWidth = 5; g.lineCap = "round";
    g.font = "bold 64px Trebuchet MS, sans-serif";
    g.fillText("H₂O", 60, 100);
    g.font = "bold 40px Trebuchet MS, sans-serif";
    g.fillText("ice  →  water  →  steam", 60, 180);
    // ice cube, droplet, steam
    g.strokeRect(80, 230, 70, 70);
    g.beginPath(); g.moveTo(330, 225); g.quadraticCurveTo(290, 290, 330, 305); g.quadraticCurveTo(370, 290, 330, 225); g.stroke();
    for (const x of [540, 575, 610]) { g.beginPath(); g.moveTo(x, 310); g.bezierCurveTo(x - 20, 280, x + 20, 260, x, 225); g.stroke(); }
    // sun and planet with orbit
    g.beginPath(); g.arc(800, 150, 42, 0, Math.PI * 2); g.stroke();
    for (let k = 0; k < 10; k++) { const a = k * 0.628; g.beginPath(); g.moveTo(800 + Math.cos(a) * 55, 150 + Math.sin(a) * 55); g.lineTo(800 + Math.cos(a) * 75, 150 + Math.sin(a) * 75); g.stroke(); }
    g.beginPath(); g.ellipse(800, 150, 170, 60, 0, 0, Math.PI * 2); g.setLineDash([12, 12]); g.stroke(); g.setLineDash([]);
    g.beginPath(); g.arc(960, 160, 16, 0, Math.PI * 2); g.fill();
    // magnet
    g.beginPath(); g.arc(160, 420, 50, Math.PI, 0); g.lineTo(210, 480); g.moveTo(110, 420); g.lineTo(110, 480); g.stroke();
    g.fillText("N", 95, 505); g.fillText("S", 197, 505);
    // a cat, of course
    g.beginPath(); g.arc(800, 420, 50, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(760, 390); g.lineTo(765, 345); g.lineTo(790, 372); g.moveTo(840, 390); g.lineTo(835, 345); g.lineTo(810, 372); g.stroke();
    g.beginPath(); g.arc(782, 412, 6, 0, Math.PI * 2); g.arc(818, 412, 6, 0, Math.PI * 2); g.fill();
    for (const s of [-1, 1]) for (const dy of [-6, 6]) { g.beginPath(); g.moveTo(800 + s * 20, 438); g.lineTo(800 + s * 85, 432 + dy); g.stroke(); }
    g.font = "bold 36px Trebuchet MS, sans-serif";
    g.fillText("whiskers feel gaps!", 400, 450);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshLambertMaterial({ map: tex }));
    board.position.set(0, 3.6, -D / 2 + 0.05);
    scene.add(board);
    const frame = mat(0x8b5a2b);
    for (const [fx, fy, fw, fh] of [[0, 1.55, 6.3, 0.15], [0, -1.55, 6.3, 0.15], [-3.08, 0, 0.15, 3.2], [3.08, 0, 0.15, 3.2]] as const) {
      scene.add(at(new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.1), frame), fx, 3.6 + fy, -D / 2 + 0.08));
    }
    scene.add(at(new THREE.Mesh(new THREE.BoxGeometry(5, 0.08, 0.2), frame), 0, 2.0, -D / 2 + 0.15));
    for (const [x, c2] of [[-1, 0xffffff], [-0.8, 0xffe066], [1.5, 0xff9ad5]] as const) {
      scene.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 6).rotateZ(Math.PI / 2), mat(c2)), x, 2.07, -D / 2 + 0.17));
    }
  }
  // --- periodic-table poster on the left wall ---
  {
    const c = document.createElement("canvas");
    c.width = 360; c.height = 220;
    const g = c.getContext("2d")!;
    g.fillStyle = "#fffaf0"; g.fillRect(0, 0, 360, 220);
    const palette = ["#ff8a80", "#ffd180", "#ffff8d", "#b9f6ca", "#80d8ff", "#b388ff", "#ff80ab"];
    for (let r = 0; r < 7; r++) for (let col = 0; col < 18; col++) {
      if (r === 0 && col > 0 && col < 17) continue;
      if ((r === 1 || r === 2) && col > 1 && col < 12) continue;
      g.fillStyle = palette[(col + r) % palette.length]!;
      g.fillRect(8 + col * 19, 20 + r * 27, 17, 25);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.85), new THREE.MeshLambertMaterial({ map: tex }));
    poster.position.set(-W / 2 + 0.03, 3.6, -1.5);
    poster.rotation.y = Math.PI / 2;
    scene.add(poster);
  }
  // --- big wall thermometer, rising and falling ---
  {
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.6, 0.5), mat(0xffffff)), 0, 0, 0));
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.0, 8), mat(0xeeeeee, { transparent: true, opacity: 0.6 })), 0.08, 0.1, 0));
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), mat(0xe53935)), 0.08, -1.0, 0));
    const red = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 8).translate(0, 0.5, 0), mat(0xe53935));
    red.position.set(0.08, -0.9, 0);
    g.add(red);
    for (let k = 0; k < 9; k++) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.15), mat(0x333333)), 0.04, -0.8 + k * 0.22, 0.15));
    g.position.set(-W / 2 + 0.05, 3.4, 2.4);
    scene.add(g);
    movers.push((t) => { red.scale.y = 0.9 + Math.sin(t * 0.4) * 0.7; });
  }
  // --- shelves of jars on the right wall ---
  {
    const g = new THREE.Group();
    const wood = mat(0xa0703a);
    for (const y of [1.6, 2.6, 3.6, 4.6]) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 4), wood), 0, y, 0));
    const jarCols = [0xff6b6b, 0x6be675, 0x5ec8ff, 0xffe066, 0xc39bff, 0xff9f43];
    const glass = new THREE.MeshPhongMaterial({ color: 0xe8f8ff, transparent: true, opacity: 0.35, shininess: 120 });
    for (const y of [1.6, 2.6, 3.6, 4.6]) {
      for (let z = -1.7; z < 1.8; z += range(0.4, 0.6)) {
        const h = range(0.3, 0.55), r = range(0.12, 0.18);
        if (rnd() < 0.3) {
          // a few books between the jars
          g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.32, h, 0.1), mat(choose(jarCols))), 0, y + 0.04 + h / 2, z));
          continue;
        }
        g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), glass), 0, y + 0.04 + h / 2, z));
        const fill = range(0.4, 0.85);
        g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, h * fill, 10), mat(choose(jarCols), { emissive: 0x111111 })), 0, y + 0.04 + (h * fill) / 2, z));
        g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.05, 0.05, 10), mat(0x8b5a2b)), 0, y + 0.06 + h, z));
      }
    }
    g.position.set(W / 2 - 0.25, 0, -3.5);
    scene.add(shadows(g));
  }
  // --- main lab bench: flasks bubbling, Bunsen burner, test tubes, microscope ---
  {
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.12, 1.4), mat(0x3a4656)), 0, 1.0, 0));
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.9, 1.2), mat(0xe8eef4)), 0, 0.47, 0));
    for (let k = 0; k < 4; k++) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.75, 0.02), mat(0xc9d6e2)), -1.95 + k * 1.3, 0.5, 0.61));
    for (let k = 0; k < 4; k++) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.04), mat(0x888888)), -1.95 + k * 1.3, 0.75, 0.63));
    const glass = new THREE.MeshPhongMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.35, shininess: 120, side: THREE.DoubleSide });
    const bubbles: { m: THREE.Mesh; x: number; ph: number }[] = [];
    for (const [x, liquid] of [[-2.2, 0x6be675], [-1.6, 0xff6bd6], [-1.0, 0x5ec8ff]] as const) {
      g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.45, 14, 1, true), glass), x, 1.29, 0));
      g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.22, 10, 1, true), glass), x, 1.62, 0));
      const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.21, 0.22, 14), mat(liquid, { emissive: liquid, emissiveIntensity: 0.4 }));
      liq.position.set(x, 1.17, 0);
      g.add(liq);
      for (let k = 0; k < 3; k++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), mat(liquid, { emissive: liquid, emissiveIntensity: 0.7 }));
        g.add(b);
        bubbles.push({ m: b, x, ph: k / 3 });
      }
    }
    // Test-tube rack.
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.25), mat(0x8b5a2b)), 0.1, 1.35, 0));
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.25), mat(0x8b5a2b)), 0.1, 1.1, 0));
    [0xff6b6b, 0xffe066, 0x6be675, 0x5ec8ff, 0xc39bff].forEach((c, k) => {
      const x = -0.22 + k * 0.16;
      g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.5, 8, 1, true), glass), x, 1.33, 0));
      g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, range(0.15, 0.3), 8), mat(c, { emissive: c, emissiveIntensity: 0.3 })), x, 1.2, 0));
    });
    // Bunsen burner with a flickering blue flame.
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.06, 10), mat(0x555f6a)), 1.0, 1.09, 0));
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8), mat(0x8a96a3)), 1.0, 1.3, 0));
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 8), new THREE.MeshBasicMaterial({ color: 0x4fa8ff, transparent: true, opacity: 0.85 }));
    flame.position.set(1.0, 1.64, 0);
    g.add(flame);
    // Microscope.
    const scope = new THREE.Group();
    const dark = mat(0x2b3440), silver = mat(0xc0c8d0);
    scope.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.5), dark), 0, 0.03, 0));
    scope.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), dark), 0, 0.3, -0.18).rotateX(0.25));
    scope.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.3), silver), 0, 0.22, 0.02));
    scope.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.42, 10), silver), 0, 0.52, 0.0).rotateX(-0.35));
    scope.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8), dark), 0, 0.33, 0.06));
    scope.position.set(1.8, 1.06, 0);
    scope.rotation.y = -0.5;
    g.add(scope);
    // Horseshoe magnet with paper clips clinging on.
    const magnet = new THREE.Group();
    magnet.add(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.07, 8, 16, Math.PI), mat(0xe53935)));
    for (const x of [-0.18, 0.18]) {
      magnet.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.14), mat(0xe53935)), x, -0.1, 0));
      magnet.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.14), silver), x, -0.24, 0));
      magnet.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 4, 10), silver), x, -0.33, 0).rotateY(0.5));
    }
    magnet.rotation.x = -Math.PI / 2;
    magnet.position.set(2.45, 1.12, 0.25);
    g.add(magnet);
    g.position.set(1.8, 0, -3.3);
    scene.add(shadows(g));
    movers.push((t) => {
      bubbles.forEach(({ m, x, ph }) => {
        const f = (t * 0.9 + ph) % 1;
        m.position.set(x + Math.sin(f * 9 + ph * 10) * 0.025, 1.25 + f * 0.6, 0);
        m.scale.setScalar(1 - f * 0.6);
      });
      flame.scale.set(1, 0.85 + Math.sin(t * 20) * 0.15, 1);
    });
  }
  // --- Tesla coil in the back-left corner, crackling ---
  {
    const g = new THREE.Group();
    const metal = mat(0x8a96a3), copper = mat(0xc87533);
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.5, 16), mat(0x2b3440)), 0, 0.25, 0));
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 2.8, 16), copper), 0, 1.9, 0));
    for (let k = 0; k < 18; k++) g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.018, 4, 16).rotateX(Math.PI / 2), mat(0xe0954a)), 0, 0.6 + k * 0.15, 0));
    g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.22, 12, 24).rotateX(Math.PI / 2), metal), 0, 3.45, 0));
    const zap = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xc8a8ff }));
    g.add(zap);
    const glow = new THREE.PointLight(0xb08aff, 0, 7, 1.5);
    glow.position.y = 3.5;
    g.add(glow);
    g.position.set(-6.8, 0, -4.4);
    scene.add(shadows(g));
    let next = 0;
    movers.push((t) => {
      if (t < next) return;
      next = t + range(0.06, 0.18);
      const pts: number[] = [];
      const on = rnd() < 0.75;
      if (on) for (let b = 0; b < 4; b++) {
        const a = rnd() * Math.PI * 2;
        let x = Math.cos(a) * 0.7, y = 3.45, z = Math.sin(a) * 0.7;
        for (let s = 0; s < 5; s++) {
          const nx = x + Math.cos(a) * 0.25 + range(-0.15, 0.15), ny = y + range(-0.25, 0.3), nz = z + Math.sin(a) * 0.25 + range(-0.15, 0.15);
          pts.push(x, y, z, nx, ny, nz);
          x = nx; y = ny; z = nz;
        }
      }
      zap.geometry.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      glow.intensity = on ? range(3, 7) : 0;
    });
  }
  // --- hanging solar-system model ---
  {
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.5, 4), mat(0x666666)), 0, 1.25, 0));
    const sun = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffc83a }));
    g.add(sun);
    const sunLight = new THREE.PointLight(0xffd070, 3, 6, 1.6);
    g.add(sunLight);
    const planets: { p: THREE.Group; speed: number }[] = [];
    [[0.75, 0.08, 0xb0a090, 1.6], [1.1, 0.13, 0xe8c070, 1.2], [1.5, 0.14, 0x3a8adf, 1.0], [1.9, 0.11, 0xd0603a, 0.8], [2.5, 0.28, 0xd8a878, 0.5], [3.1, 0.22, 0xe8d4a0, 0.38]]
      .forEach(([r, size, c, speed], i) => {
        const orbit = new THREE.Mesh(new THREE.TorusGeometry(r!, 0.008, 3, 64).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
        g.add(orbit);
        const pivot = new THREE.Group();
        const planet = new THREE.Mesh(new THREE.SphereGeometry(size!, 14, 10), mat(c!));
        planet.position.x = r!;
        pivot.add(planet);
        if (i === 5) planet.add(new THREE.Mesh(new THREE.RingGeometry(0.3, 0.45, 24).rotateX(-Math.PI / 2.3), mat(0xc8b080, { side: THREE.DoubleSide })));
        if (i === 2) planet.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mat(0xdddddd)), 0.24, 0, 0));
        pivot.rotation.y = i * 1.3;
        g.add(pivot);
        planets.push({ p: pivot, speed: speed! });
      });
    g.position.set(-2.2, 4.8, 2.0);
    g.scale.setScalar(0.75);
    scene.add(g);
    movers.push((t) => planets.forEach(({ p, speed }, i) => { p.rotation.y = i * 1.3 + t * speed * 0.6; }));
  }
  // --- spinning globe on a side table ---
  {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 128;
    const g2 = c.getContext("2d")!;
    g2.fillStyle = "#3a8adf"; g2.fillRect(0, 0, 256, 128);
    g2.fillStyle = "#5cb85c";
    for (let k = 0; k < 14; k++) { g2.beginPath(); g2.ellipse(range(0, 256), range(25, 105), range(10, 32), range(8, 22), rnd() * 3, 0, Math.PI * 2); g2.fill(); }
    g2.fillStyle = "#ffffff"; g2.fillRect(0, 0, 256, 8); g2.fillRect(0, 120, 256, 8);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 16), mat(0x8b5a2b)), 0, 0.9, 0));
    for (let k = 0; k < 3; k++) g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 5), mat(0x6b4421)), Math.cos(k * 2.1) * 0.35, 0.45, Math.sin(k * 2.1) * 0.35));
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.1, 10), mat(0xd4a017)), 0, 0.99, 0));
    const tiltG = new THREE.Group();
    tiltG.position.y = 1.5; tiltG.rotation.z = 0.41;
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 16), new THREE.MeshLambertMaterial({ map: tex }));
    tiltG.add(globe);
    tiltG.add(new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.02, 4, 32, Math.PI), mat(0xd4a017)).rotateZ(-Math.PI / 2));
    g.add(tiltG);
    g.position.set(-6.3, 0, 2.6);
    scene.add(shadows(g));
    movers.push((t) => { globe.rotation.y = t * 0.5; });
  }
  // --- aquarium with fish (living things!) ---
  {
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 2.6), mat(0x5f8fa8)), 0, 0.5, 0));
    const tank = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 2.4), new THREE.MeshPhongMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.35, shininess: 120, depthWrite: false }));
    tank.position.y = 1.5;
    g.add(tank);
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.12, 2.35), mat(0xe8d4a0)), 0, 1.07, 0));
    for (let k = 0; k < 5; k++) {
      const weed = new THREE.Mesh(new THREE.ConeGeometry(0.06, range(0.4, 0.7), 4), mat(0x2ecc71));
      weed.position.set(range(-0.35, 0.35), 1.35, range(-1, 1));
      g.add(weed);
    }
    const fish = [0xff8c1a, 0xffd23f, 0xff5c8a].map((c) => {
      const f = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(c));
      body.scale.set(0.6, 1, 1.6);
      f.add(body);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.12, 3), mat(c));
      tail.rotation.x = Math.PI / 2;
      tail.position.z = -0.18;
      f.add(tail);
      g.add(f);
      return f;
    });
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.06, 2.44), mat(0x2b3440)), 0, 2.02, 0));
    g.position.set(W / 2 - 1.2, 0, 2.8);
    scene.add(shadows(g));
    movers.push((t) => fish.forEach((f, i) => {
      const a = t * (0.5 + i * 0.15) + i * 2;
      f.position.set(Math.sin(a * 1.3) * 0.25, 1.4 + i * 0.15 + Math.sin(t * 2 + i) * 0.05, Math.sin(a) * 0.95);
      f.rotation.y = Math.cos(a) > 0 ? 0 : Math.PI;
    }));
  }
  // --- potted plants, stools, a round rug ---
  for (const [x, z, s] of [[-7.8, 5, 1.2], [7.9, -5.6, 1], [-7.8, -5.6, 1.1]] as const) {
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.6, 10), mat(0xc0643a)), 0, 0.3, 0));
    for (let k = 0; k < 7; k++) g.add(at(new THREE.Mesh(new THREE.IcosahedronGeometry(range(0.25, 0.4), 0), choose(leafMats)), range(-0.3, 0.3), range(0.8, 1.6), range(-0.3, 0.3)));
    g.scale.setScalar(s);
    scene.add(shadows(at(g, x, 0, z)));
  }
  {
    const rug = new THREE.Mesh(new THREE.CircleGeometry(2.2, 40).rotateX(-Math.PI / 2), mat(0x4f86c6));
    rug.position.set(0, 0.01, 1.4);
    rug.receiveShadow = true;
    scene.add(rug);
    for (const [r, c] of [[1.7, 0xffd54a], [1.1, 0xffffff]] as const) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.12, r, 40).rotateX(-Math.PI / 2), mat(c));
      ring.position.set(0, 0.015, 1.4);
      scene.add(ring);
    }
  }
  // --- ceiling lamps ---
  for (const x of [-4, 0, 4]) {
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 2, 3), mat(0x333333)), 0, 1, 0));
    g.add(new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.4, 16, 1, true), mat(0x4f86c6, { side: THREE.DoubleSide })));
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff6d8 })), 0, -0.15, 0));
    const l = new THREE.PointLight(0xfff0d0, 6, 9, 1.4);
    l.position.y = -0.3;
    g.add(l);
    g.position.set(x, 5.8, 0);
    scene.add(g);
  }
  // Dust motes in the window light.
  {
    const dust = particles(120, 0xfff6d8, 0.05, new THREE.Vector3(8, 6, 5), new THREE.Vector3(0, 0.5, -1));
    scene.add(dust);
    movers.push((t) => { dust.rotation.y = Math.sin(t * 0.05) * 0.1; dust.position.y = Math.sin(t * 0.3) * 0.2; });
  }

  // Dr. Pickles: a black cat in lab goggles, standing on a stool by the bench.
  scene.add(shadows(at(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.35, 0.7, 12), mat(0x3a4656)), -1.6, 0.35, -2.2)));
  movers.push(boss(scene, { fur: 0x2a2a30, stripe: 0x1a1a1e }, "goggles", -1.6, 0.7, -2.2, 0.4));

  return {
    scene, update: (t) => movers.forEach((m) => m(t)),
    camPos: new THREE.Vector3(1.5, 6, 12.5), camLook: new THREE.Vector3(2.2, 2, -1.5),
    entry: new THREE.Vector3(0, 0, 6), stand: new THREE.Vector3(0, 0, 1.4),
  };
}
