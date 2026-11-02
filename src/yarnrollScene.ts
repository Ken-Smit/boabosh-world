// Yarn Roll: a little bowling lane, its toy mice, the aim arrow and the controls.
// Rules live in yarnroll.ts; this file only feeds it input and draws what comes back.
// At Christmas: Snowball Roll, with snowmen and presents in a snowy lane.

import * as THREE from "three";
import type { AreaScene } from "./areas.ts";
import type { Cat } from "./cat.ts";
import * as xmas from "./christmas.ts";
import { toonify } from "./toon.ts";
import { mat, at, shadows, label, makeOak, makePine } from "./world.ts";
import { CONFIG, HOMES, LANE, aimFromDrag, keyStart, newYarnRound, roll, step, type YarnRound } from "./yarnroll.ts";
import * as sfx from "./sound.ts";

export type YarnRoll = AreaScene & {
  /** `cheer` makes the player's cat do a happy move. */
  begin: (cat: Cat, done: (g: YarnRound) => void, cheer: () => void) => void;
  /** Ends any game and takes down its listeners and HUD. Safe to call twice. */
  stop: () => void;
  playing: () => boolean;
  /** Built with the Christmas look? */
  jolly: boolean;
  closeUp: number;
};

const SEAT = new THREE.Vector3(-LANE.hw - 1.05, 0, 2.3); // where the player's cat watches from
const SEAT_FACE = 1.15;
const GOLD = 0xffe066;

function glow(color: number) {
  const m = new THREE.MeshBasicMaterial({ color });
  m.userData.outlineParameters = { visible: false };
  return m;
}

/** A plush toy mouse, standing up on its hind paws like a bowling pin. */
function toyMouse(n: number) {
  const g = new THREE.Group();
  const fur = mat([0xb9b4c7, 0xd8c6a8, 0xc9c9d6][n % 3]!), pink = mat(0xf7a8b8), dark = mat(0x2b2433);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 12), fur);
  body.scale.set(1, 1.2, 0.95);
  g.add(at(body, 0, 0.3, 0));
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), fur), 0, 0.66, 0.02));
  for (const s of [-1, 1]) {
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8).scale(1, 1, 0.35), fur), s * 0.15, 0.84, 0));
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8).scale(1, 1, 0.35), pink), s * 0.15, 0.84, 0.03));
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), dark), s * 0.07, 0.7, 0.17));
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), pink), s * 0.1, 0.05, 0.14)); // feet
  }
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), pink), 0, 0.64, 0.2));
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 6, 16, Math.PI * 1.3), pink);
  tail.rotation.y = Math.PI / 2;
  g.add(at(tail, 0, 0.26, -0.3));
  return shadows(g);
}

/** One of the Christmas "mice": a small snowman in a Santa hat, or a wrapped present. */
function jollyPin(n: number) {
  if (n % 2) { const p = xmas.present(1.15, n); return p; }
  const s = xmas.snowman(0.46);
  // His top hat comes off for the Santa hat. christmas.ts builds the hat as the only parts up here.
  s.children.forEach((c) => { if (c.position.y > 1.5) c.visible = false; });
  const red = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.46, 12), mat(0xd62839));
  s.add(at(red, 0, 1.78, -0.02));
  s.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.09, 14), mat(0xffffff)), 0, 1.57, -0.02));
  s.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mat(0xffffff)), 0, 2.02, -0.02));
  return shadows(s);
}

/** The ball: a yarn ball wrapped in strands, or a lumpy snowball. */
function makeBall(jolly: boolean) {
  const g = new THREE.Group(), r = LANE.ballR;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), mat(jolly ? 0xffffff : 0xe2574c)));
  if (jolly) {
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, y = -0.8 + (i / 8) * 1.6, w = Math.sqrt(1 - y * y);
      g.add(at(new THREE.Mesh(new THREE.SphereGeometry(r * 0.3, 8, 6), mat(0xeef6fc)), Math.cos(a) * w * r * 0.85, y * r * 0.85, Math.sin(a) * w * r * 0.85));
    }
  } else {
    const strand = mat(0xf58b7f);
    for (let i = 0; i < 6; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(r * 0.99, 0.018, 6, 28), strand);
      t.rotation.set(i * 1.05, i * 0.7, 0);
      g.add(t);
    }
  }
  return shadows(g);
}

export function buildLane(): YarnRoll {
  const jolly = document.body.classList.contains("christmas");
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(jolly ? 0xc4def2 : 0xbfe3f5);
  scene.add(new THREE.HemisphereLight(jolly ? 0xe6f1ff : 0xfff4dc, jolly ? 0xb4c6dc : 0x8aa86a, 1.7));
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.9);
  sun.position.set(5, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, far: 40 });
  scene.add(sun);

  // Ground and lane.
  const { hw, near, far } = LANE, len = near - far + 2.4, midZ = (near + far) / 2;
  const ground = new THREE.Mesh(new THREE.BoxGeometry(60, 0.1, 50), mat(jolly ? 0xf6fafd : 0x8fc76b));
  ground.position.y = -0.06;
  ground.receiveShadow = true;
  scene.add(ground);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, 0.06, len), mat(jolly ? 0xdcebf7 : 0xe2bb82));
  floor.receiveShadow = true;
  scene.add(at(floor, 0, 0, midZ));
  // Little arrows on the lane, like a real bowling alley, and a start line.
  const mark = mat(jolly ? 0x8fc3e6 : 0xb5834a);
  for (const x of [-1.2, -0.6, 0, 0.6, 1.2]) {
    const tri = new THREE.Mesh(new THREE.CircleGeometry(0.2, 3).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), mark);
    scene.add(at(tri, x, 0.04, 0.6 + Math.abs(x) * 0.5));
  }
  scene.add(at(new THREE.Mesh(new THREE.BoxGeometry(hw * 2, 0.02, 0.08), mark), 0, 0.04, near - 0.9));

  // Bumpers: candy-cane stripes at Christmas, a stitched cushion otherwise.
  const stripeA = mat(jolly ? 0xd62839 : 0xc96f4a), stripeB = mat(jolly ? 0xffffff : 0xf3d9a8);
  const segs = 14, segLen = len / segs, seg = new THREE.BoxGeometry(0.34, 0.42, segLen);
  for (const s of [-1, 1]) for (let i = 0; i < segs; i++) {
    const m = new THREE.Mesh(seg, i % 2 ? stripeA : stripeB);
    scene.add(shadows(at(m, s * (hw + 0.17), 0.2, far - 1.2 + segLen * (i + 0.5))));
  }
  // A soft bank behind the mice stops the ball: snow, or a row of cushions.
  const bank = mat(jolly ? 0xffffff : 0xc96f4a);
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 10), bank);
    b.scale.set(1, 0.7, 0.7);
    scene.add(shadows(at(b, -2.1 + i * 0.7, 0.25, far - 1.3)));
  }

  const signMat = new THREE.MeshBasicMaterial({ map: label(jolly ? "SNOWBALL ROLL" : "YARN ROLL", jolly ? "#d62839" : "#8b5a2b", "#fff7e6", 1024, 192, 112) });
  signMat.userData.outlineParameters = { visible: false };
  scene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.98), signMat), 0, 2.15, far - 2));
  for (const s of [-1, 1]) scene.add(shadows(at(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2, 8), mat(0x6b4a2b)), s * 2.3, 1, far - 2.05)));

  // A cozy garden round the lane. At Christmas xmas.dress adds the trees and snow instead.
  if (!jolly) {
    const leaf = mat(0x3d8b45); // its own: the shared leaf colours get frosted at Christmas
    for (const [x, z, s, oak] of [[-5.2, -5.5, 1.1, 1], [5.4, -6, 1.2, 0], [-6.2, -1.5, 1, 0], [6, -1, 1.1, 1]] as const) scene.add(at((oak ? makeOak : makePine)(s, leaf), x, 0, z));
    const petals = [0xffffff, 0xffd23f, 0xff8fd0, 0xc9a0ff];
    for (let i = 0; i < 26; i++) {
      const s = i % 2 ? 1 : -1, x = s * (hw + 0.9 + ((i * 37) % 30) / 8), z = -6 + ((i * 53) % 110) / 10;
      if (s < 0 && Math.hypot(x - SEAT.x, z - SEAT.z) < 1) continue; // not under the cat
      scene.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(petals[i % 4]!)), x, 0.12, z));
    }
  }

  // The mice. Each has a stand (where it is, which way it fell) and a tip (how far over it is).
  const mice = HOMES.map((_, i) => {
    const root = new THREE.Group(), tip = new THREE.Group();
    tip.add(jolly ? jollyPin(i) : toyMouse(i));
    root.add(tip);
    scene.add(root);
    return { root, tip, fall: 0, wob: 0, pop: 0, spin: 0 };
  });

  const ball = makeBall(jolly);
  scene.add(ball);

  // The aim arrow lies on the lane, pointing up it. Longer and warmer with more power.
  const arrowMat = glow(0x5ad06a);
  const arrow = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 1).translate(0, 0, -0.5), arrowMat);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.6, 3).rotateX(-Math.PI / 2).scale(1, 0.12, 1), arrowMat);
  arrow.add(shaft, head);
  arrow.visible = false;
  scene.add(arrow);

  // Happy sparkles, kept in a pool so a game makes no garbage.
  const sparks = Array.from({ length: 36 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), glow(jolly ? [0xffffff, 0xd62839, 0x4fd16a, GOLD][i % 4]! : [GOLD, 0xffffff, 0xff8fd0, 0x7fd8ff][i % 4]!));
    m.visible = false;
    scene.add(m);
    return Object.assign(m, { life: 0, vel: new THREE.Vector3() });
  });
  let nextSpark = 0;
  const burst = (x: number, z: number, n = 8) => {
    for (let i = 0; i < n; i++) {
      const s = sparks[nextSpark++ % sparks.length]!;
      s.visible = true; s.life = 0.8;
      s.position.set(x, 0.5, z);
      s.vel.set((Math.random() - 0.5) * 4, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 4);
    }
  };

  toonify(scene);

  const $ = (id: string) => document.getElementById(id)!;
  const hud = $("yr-hud"), gotEl = $("yr-got"), leftEl = $("yr-left"), sayEl = $("yr-say"), meter = $("yr-power"), fill = meter.firstElementChild as HTMLElement;
  const canvas = $("scene");
  const BALL_ICON = jolly ? "❄️" : "🧶", MOUSE_ICON = jolly ? "⛄" : "🐭", BALL_NAME = jolly ? "snowball" : "yarn ball";
  $("yr-icon").textContent = MOUSE_ICON;
  $("yr-goal").textContent = String(CONFIG.goal);

  const camPos = new THREE.Vector3(0, 9.4, 10.2), camLook = new THREE.Vector3(0, 0, -0.5);

  let game: YarnRound | null = null, me: Cat | null = null;
  let onDone: ((g: YarnRound) => void) | null = null, onCheer: (() => void) | null = null;
  let controls: AbortController | null = null;
  let last = 0, endIn = 0, sayLeft = 0, chase = -1, goalSaid = false;
  // What's being aimed. Keyboard aim is shown once a key is pressed; a drag shows its own.
  const keys = new Set<string>();
  let aim = 0, power = 0, showing = false, dragging = false;

  const say = (text: string, seconds = 0) => { sayEl.textContent = text; sayLeft = seconds; };
  const put = (el: HTMLElement, text: string) => { if (el.textContent !== text) el.textContent = text; };

  function setKeyAim() {
    const k = keyStart(game ? game.rnd : Math.random);
    aim = k.aim; power = k.power;
  }
  function restock(popping: boolean) {
    mice.forEach((m, i) => {
      const [x, z] = HOMES[i]!;
      m.root.position.set(x, 0, z);
      m.root.rotation.y = 0;
      m.tip.rotation.set(0, 0, 0);
      m.fall = 0; m.wob = 0; m.spin = 0;
      m.pop = popping ? 0.0001 : 0;
      m.tip.scale.setScalar(popping ? 0.01 : 1);
    });
  }
  function letGo() {
    if (!game || !roll(game, aim, power)) return;
    sfx.yarnRoll(power);
    showing = dragging = false;
    say("");
  }

  function stop() {
    controls?.abort();
    controls = null;
    if (me) {
      me.group.position.y = 0;
      me.group.rotation.y = 0;
      me = null;
    }
    game = null; onDone = null; onCheer = null; chase = -1;
    keys.clear(); showing = dragging = false;
    hud.hidden = true;
    arrow.visible = false;
    for (const s of sparks) { s.visible = false; s.life = 0; }
    restock(false);
    ball.position.set(0, LANE.ballR, near);
  }

  function begin(cat: Cat, done: (g: YarnRound) => void, cheer: () => void) {
    stop();
    game = newYarnRound();
    me = cat; onDone = done; onCheer = cheer; endIn = 0; last = 0; goalSaid = false;
    cat.group.position.copy(SEAT);
    cat.group.rotation.y = SEAT_FACE;
    setKeyAim();
    hud.hidden = false;
    say(`Pull back on the ${BALL_NAME}, then let go!`);

    // Everything below dies with this controller, so leaving can't leave a listener behind.
    controls = new AbortController();
    const signal = controls.signal;
    const AIM = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);
    addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault(); // a focused button mustn't get this press too
        if (!e.repeat && !dragging) letGo();
      } else if (AIM.has(e.code)) {
        keys.add(e.code);
        e.preventDefault();
        if (game?.phase === "aim" && !dragging) showing = true;
      }
    }, { signal });
    addEventListener("keyup", (e) => { keys.delete(e.code); }, { signal });

    // The drag: one pointer only, and capture keeps it working off the edge of the screen.
    let finger = -1, sx = 0, sy = 0, keyAim = 0, keyPower = 0;
    const reach = () => Math.max(80, Math.min(innerWidth, innerHeight) * 0.22); // phones held sideways have little room to pull
    const cancel = () => {
      if (finger < 0) return;
      finger = -1;
      dragging = showing = false;
      aim = keyAim; power = keyPower;
    };
    canvas.addEventListener("pointerdown", (e) => {
      if (finger >= 0 || game?.phase !== "aim") return;
      sfx.unlock();
      finger = e.pointerId; sx = e.clientX; sy = e.clientY;
      keyAim = aim; keyPower = power;
      canvas.setPointerCapture(finger);
      dragging = showing = true;
      aim = 0; power = 0;
      say("");
      e.preventDefault();
    }, { signal });
    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerId !== finger) return;
      ({ aim, power } = aimFromDrag(e.clientX - sx, e.clientY - sy, reach()));
    }, { signal });
    canvas.addEventListener("pointerup", (e) => {
      if (e.pointerId !== finger) return;
      if (power < CONFIG.minPull) { cancel(); say("Pull back farther, then let go!", 2); return; }
      finger = -1;
      letGo();
    }, { signal });
    canvas.addEventListener("pointercancel", (e) => { if (e.pointerId === finger) cancel(); }, { signal });
    addEventListener("blur", () => { keys.clear(); cancel(); }, { signal });
  }

  function play(g: YarnRound, t: number, dt: number) {
    if (g.phase === "aim" && !dragging) {
      const k = (c: string) => (keys.has(c) ? 1 : 0);
      aim = Math.max(-CONFIG.maxAim, Math.min(CONFIG.maxAim, aim + (k("ArrowRight") - k("ArrowLeft")) * dt * 0.7));
      power = Math.max(CONFIG.minPull, Math.min(1, power + (k("ArrowUp") - k("ArrowDown")) * dt * 0.8));
    }

    for (const e of step(g, dt)) {
      if (e.type === "knock") {
        const m = mice[e.mouse]!, s = g.mice[e.mouse]!;
        m.fall = 0.0001;
        m.root.rotation.y = Math.atan2(s.vx, s.vz);
        m.spin = (e.mouse % 2 ? 1 : -1) * 5;
        for (const o of mice) if (o !== m && o.fall === 0 && o.root.position.distanceTo(m.root.position) < 1.7) o.wob = 1;
        burst(s.x, s.z);
        sfx.yarnKnock(jolly);
      } else if (e.type === "bump") {
        sfx.boing();
      } else if (e.type === "rolled") {
        if (e.strike) {
          say(jolly ? "STRIKE! Ho ho ho! 🎉" : "STRIKE! 🎉", 1.2);
          sfx.yarnStrike();
          sfx.meow("happy", 0.2);
          chase = t; // the cat can't help it: off it goes after them
          for (let i = 0; i < 3; i++) burst(0, -3.4, 12);
        } else if (e.cleared) {
          say("All down! ⭐", 1.2); sfx.chime(); onCheer!();
        } else if (e.got >= 3) {
          say(`Great roll! +${e.got}`, 1.2); sfx.meow("happy"); onCheer!();
        } else if (e.got) {
          say(`+${e.got}`, 1);
        }
        if (g.total >= CONFIG.goal && !goalSaid) { goalSaid = true; say("You reached the goal! ⭐", 1.2); }
      } else if (e.type === "reset") {
        restock(true);
        sfx.pop();
      } else if (e.type === "ready") {
        setKeyAim();
        say(g.used < 2 ? `Pull back on the ${BALL_NAME}, then let go!` : "");
      } else if (e.type === "end") {
        say(g.total >= CONFIG.goal ? "You did it! 🎉" : g.total >= CONFIG.goal - 2 ? "So close! 💛" : "Good rolling! 💛", 2);
        endIn = 1.5;
      }
    }

    // The mice: slide with the rules, tip over silly, wiggle on their backs, pop back up.
    g.mice.forEach((s, i) => {
      const m = mice[i]!;
      if (m.fall > 0) {
        m.root.position.x = s.x; m.root.position.z = s.z;
        m.fall = Math.min(1, m.fall + dt * 3.2);
        const e = 1 - (1 - m.fall) ** 2;
        m.tip.rotation.x = e * 1.5;
        m.root.position.y = Math.sin(m.fall * Math.PI) * 0.35;
        m.root.rotation.y += m.spin * (1 - e) * dt;
        m.tip.rotation.z = m.fall >= 1 ? Math.sin(t * 9 + i) * 0.1 : 0; // kicking its feet
      } else if (m.pop > 0) {
        m.pop = Math.min(1, m.pop + dt * 3);
        m.tip.scale.setScalar(Math.max(0.01, m.pop + Math.sin(m.pop * Math.PI) * 0.3));
        if (m.pop >= 1) { m.pop = 0; m.tip.scale.setScalar(1); }
      } else {
        m.wob = Math.max(0, m.wob - dt * 1.3);
        m.tip.rotation.z = Math.sin(t * 13 + i) * (0.03 + m.wob * 0.28); // always a little nervous
      }
    });

    // The ball: rolls as it goes, and is pulled back a little while aiming.
    const b = g.ball, dirX = Math.sin(aim), dirZ = -Math.cos(aim);
    if (g.phase === "aim") {
      const back = showing ? power * 0.55 : 0;
      ball.position.set(b.x - dirX * back, LANE.ballR, b.z - dirZ * back);
      ball.scale.setScalar(1);
    } else if (g.phase === "roll" || b.moving) {
      const dx = b.x - ball.position.x, dz = b.z - ball.position.z, d = Math.hypot(dx, dz);
      if (d > 0) ball.rotateOnWorldAxis(new THREE.Vector3(dz / d, 0, -dx / d), d / LANE.ballR);
      ball.position.set(b.x, LANE.ballR, b.z);
    }
    if (g.phase === "pause" || g.phase === "over") {
      // Off it trundles into the bank, out of the way.
      ball.scale.setScalar(Math.max(0.001, ball.scale.x - dt * 2));
    }

    // The arrow and power meter.
    const aiming = g.phase === "aim" && showing;
    arrow.visible = aiming && power > 0.02;
    meter.classList.toggle("on", aiming);
    if (aiming) {
      arrow.position.set(ball.position.x + dirX * LANE.ballR, 0.08, ball.position.z + dirZ * LANE.ballR);
      arrow.rotation.y = -aim;
      const length = 0.5 + power * 3.2;
      shaft.scale.z = length;
      head.position.z = -length - 0.3;
      arrowMat.color.setHex(power < 0.4 ? 0x5ad06a : power < 0.75 ? 0xffc23f : 0xff5a4a);
      const w = `${Math.round(power * 100)}%`;
      if (fill.style.width !== w) { fill.style.width = w; fill.style.background = power < 0.4 ? "#5ad06a" : power < 0.75 ? "#ffc23f" : "#ff5a4a"; }
    }

    // The cat: after a strike it dashes up the lane side and back, tail high.
    const c = me!.group;
    if (chase >= 0) {
      const a = (t - chase) / 2.2;
      if (a >= 1) { chase = -1; c.position.copy(SEAT); c.rotation.y = SEAT_FACE; }
      else {
        const out = a < 0.5, along = out ? a * 2 : 2 - a * 2;
        c.position.set(SEAT.x, Math.abs(Math.sin(t * 13)) * 0.16, SEAT.z + (-3.6 - SEAT.z) * along);
        c.rotation.y = out ? Math.PI : 0;
      }
    }

    // HUD.
    put(gotEl, String(g.total));
    put(leftEl, BALL_ICON.repeat(CONFIG.rolls - g.used) || "🏁");
    if (sayLeft > 0) {
      sayLeft -= dt;
      if (sayLeft <= 0) put(sayEl, "");
    }

    if (g.phase === "over") {
      endIn -= dt;
      if (endIn <= 0) { const finish = onDone!; stop(); finish(g); }
    }
  }

  function update(t: number) {
    // Long frames are clamped: a hidden tab stops the animation loop, so the game simply waits.
    const dt = last ? Math.min(0.05, t - last) : 0;
    last = t;
    for (const s of sparks) if (s.life > 0) {
      s.life -= dt;
      s.visible = s.life > 0;
      s.vel.y -= 7 * dt;
      s.position.addScaledVector(s.vel, dt);
      s.rotation.y += dt * 6;
    }
    if (game) play(game, t, dt);
  }

  restock(false);
  ball.position.set(0, LANE.ballR, near);
  if (jolly) xmas.dress(scene, "lane");
  return {
    scene, camPos, camLook, update, begin, stop,
    entry: SEAT.clone(), stand: SEAT.clone(), jolly,
    closeUp: 0.35, // only the lane and the cat need to fit, so upright phones can sit closer
    playing: () => game !== null,
  };
}
