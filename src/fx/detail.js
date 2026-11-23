import * as THREE from 'three';

// Surface detail for the Blender weapon models. The meshes have no UVs, so detail is projected
// triplanar in object space: brushed + scratched metal, stippled polymer, wood grain, rubber.
// Each kind modulates base color (wear / grain) and roughness (scratches catch the light).
function canvasTex(draw, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
const TEX = {};
function tex(kind) {
  if (TEX[kind]) return TEX[kind];
  if (kind === 'metal') TEX[kind] = canvasTex((g, s) => {
    g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) { const v = 110 + rnd() * 40 | 0; g.fillStyle = `rgba(${v},${v},${v},0.35)`; g.fillRect(rnd() * s, rnd() * s, rnd() * 60 + 10, 1); } // brushed
    for (let i = 0; i < 70; i++) { // scratches: bright, thin, random angles
      g.strokeStyle = `rgba(230,230,230,${0.3 + rnd() * 0.5})`; g.lineWidth = rnd() < 0.8 ? 0.6 : 1.2;
      const x = rnd() * s, y = rnd() * s, a = rnd() * Math.PI, l = 8 + rnd() * 50;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    for (let i = 0; i < 40; i++) { const r = 4 + rnd() * 14; const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, 'rgba(60,60,60,0.25)'); gr.addColorStop(1, 'rgba(60,60,60,0)'); g.save(); g.translate(rnd() * s, rnd() * s); g.fillStyle = gr; g.fillRect(-r, -r, r * 2, r * 2); g.restore(); } // grime blotches
  });
  if (kind === 'poly') TEX[kind] = canvasTex((g, s) => {
    g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 5000; i++) { const v = rnd() < 0.5 ? 95 : 165; g.fillStyle = `rgba(${v},${v},${v},0.55)`; const z = 1 + rnd() * 1.6; g.fillRect(rnd() * s, rnd() * s, z, z); } // stipple
    for (let i = 0; i < 25; i++) { g.strokeStyle = 'rgba(200,200,200,0.35)'; g.lineWidth = 0.7; const x = rnd() * s, y = rnd() * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd() * 20 - 10, y + rnd() * 20 - 10); g.stroke(); } // scuffs
  });
  if (kind === 'wood') TEX[kind] = canvasTex((g, s) => {
    g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 1) { // grain: wavy bands running along the long axis
      const w = Math.sin(y * 0.09 + Math.sin(y * 0.021) * 3) * 0.5 + 0.5, v = 100 + w * 60 + rnd() * 10 | 0;
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, y, s, 1);
    }
    for (let i = 0; i < 6; i++) { const x = rnd() * s, y = rnd() * s, r = 5 + rnd() * 8; g.strokeStyle = 'rgba(70,70,70,0.6)'; g.lineWidth = 1.5; for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(x, y, r * (1 + k * 0.6) * 2.2, r * (1 + k * 0.6) * 0.6, 0, 0, Math.PI * 2); g.stroke(); } } // knots
  });
  if (kind === 'rubber') TEX[kind] = canvasTex((g, s) => {
    g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 3000; i++) { const v = 100 + rnd() * 56 | 0; g.fillStyle = `rgba(${v},${v},${v},0.5)`; g.fillRect(rnd() * s, rnd() * s, 2, 2); }
  });
  return TEX[kind];
}

// material name -> [kind, tiles per meter, color amount, roughness amount]
function kindFor(m) {
  const n = m.name || '';
  if (/Glass|Dot|Tritium|Core|Label/.test(n)) return null;
  if (/Wood|Leather/.test(n) || (n === 'M_Furniture' && m.metalness < 0.2 && m.color.r > m.color.b * 1.6 && m.color.r > 0.08)) return ['wood', 8, 1.0, 0.3];
  if (/Rubber|Tape|Wrap|Same/.test(n)) return ['rubber', 22, 0.45, 0.25];
  if (/Polymer|Furniture/.test(n) && m.metalness < 0.4) return ['poly', 26, 0.55, 0.35];
  return ['metal', 7, 0.6, 0.7];
}

export function addDetail(mat) {
  if (!mat || mat.userData.detail || !mat.isMeshStandardMaterial) return;
  const k = kindFor(mat); if (!k) return;
  mat.userData.detail = true;
  const [kind, scale, colAmt, roughAmt] = k;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tDetail = { value: tex(kind) };
    sh.uniforms.uScale = { value: scale };
    sh.uniforms.uCol = { value: colAmt };
    sh.uniforms.uRough = { value: roughAmt };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjP; varying vec3 vObjN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjP = position; vObjN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tDetail; uniform float uScale; uniform float uCol; uniform float uRough;
varying vec3 vObjP; varying vec3 vObjN;
float detailTri() {
  vec3 w = pow(abs(normalize(vObjN)), vec3(4.0)); w /= (w.x + w.y + w.z);
  vec3 p = vObjP * uScale;
  return texture2D(tDetail, p.zy).r * w.x + texture2D(tDetail, p.xz).r * w.y + texture2D(tDetail, p.xy).r * w.z;
}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat dtl = detailTri();\ndiffuseColor.rgb *= 1.0 + (dtl - 0.5) * 2.0 * uCol;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor - (dtl - 0.5) * 2.0 * uRough, 0.04, 1.0);');
  };
  mat.customProgramCacheKey = () => 'detail-' + kind;
  mat.needsUpdate = true;
}
