// Anime ("cel") look: flat bands of light instead of smooth shading, plus the
// ink outline drawn by three's OutlineEffect in main.ts. Every material in the
// game comes from `toonMat` or gets converted by `toonify`.

import * as THREE from "three";

// Four light bands: deep shadow, shadow, lit, highlight. Nearest filtering
// keeps the steps crisp instead of blending them back into smooth shading.
const gradientMap = (() => {
  const t = new THREE.DataTexture(new Uint8Array([110, 170, 225, 255]), 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();

export type MatParams = THREE.MeshToonMaterialParameters & { flatShading?: boolean };

export const toonMat = (color: number, extra: MatParams = {}) => {
  const { flatShading: _ignored, ...rest } = extra; // toon is smooth-shaded by design
  return new THREE.MeshToonMaterial({ color, gradientMap, ...rest });
};

const NO_OUTLINE = { visible: false };
const converted = new WeakMap<THREE.Material, THREE.Material>();

function convert(m: THREE.Material): THREE.Material {
  const hit = converted.get(m);
  if (hit) return hit;
  let out = m;
  if (m instanceof THREE.MeshLambertMaterial) {
    out = new THREE.MeshToonMaterial({
      color: m.color, map: m.map, emissive: m.emissive, emissiveIntensity: m.emissiveIntensity,
      vertexColors: m.vertexColors, transparent: m.transparent, opacity: m.opacity,
      side: m.side, depthWrite: m.depthWrite, fog: m.fog, gradientMap,
    });
  }
  // Glass, water and glows read wrong with an ink line round them.
  if (out.transparent) out.userData.outlineParameters = NO_OUTLINE;
  converted.set(m, out);
  return out;
}

/**
 * Convert a built scene to the toon look. Swaps Lambert materials for toon ones
 * and turns outlines off where they'd be noise: transparent things and big
 * instanced scatter (thousands of grass blades with ink lines = a dark smudge).
 */
export function toonify(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material);
    const busy = (o as THREE.InstancedMesh).isInstancedMesh && (o as THREE.InstancedMesh).count > 150;
    if (busy) {
      for (const m of ([] as THREE.Material[]).concat(mesh.material)) m.userData.outlineParameters = NO_OUTLINE;
    }
  });
}
