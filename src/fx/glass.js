import * as THREE from 'three';

// "Warped air" glass for the Crystal Shard and Glass Cannon. The game copies the finished world
// frame into GLASS.tex right before drawing the first-person weapon; the glass samples that copy
// offset by its surface normal (refraction), adds a slow heat-haze wobble, a cool tint and a bright
// fresnel rim so the edges stay readable. Anywhere without a scene copy (menus, third person) it
// falls back to a frosted, see-through look.
export const GLASS = { tex: null };

const mat = new THREE.ShaderMaterial({
  uniforms: { tScene: { value: null }, uHas: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uTint: { value: new THREE.Color(0xd8f2ff) } },
  transparent: true,
  vertexShader: /* glsl */`
    varying vec3 vN; varying vec3 vV; varying vec3 vW;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vW = position;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tScene; uniform float uHas; uniform vec2 uRes; uniform float uTime; uniform vec3 uTint;
    varying vec3 vN; varying vec3 vV; varying vec3 vW;
    void main() {
      vec3 n = normalize(vN);
      float fres = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 2.4);
      vec2 haze = vec2(sin(vW.y * 60.0 + uTime * 3.0), cos(vW.x * 55.0 + uTime * 2.4)) * 0.004;
      vec3 col; float a;
      if (uHas > 0.5) {
        vec2 uv = gl_FragCoord.xy / uRes + n.xy * 0.05 + haze;
        // slight chromatic split for a crystal feel
        col = vec3(texture2D(tScene, uv + n.xy * 0.004).r, texture2D(tScene, uv).g, texture2D(tScene, uv - n.xy * 0.004).b);
        col = col * uTint * 1.05 + fres * 0.55 + pow(max(n.y, 0.0), 12.0) * 0.4;
        a = 1.0;
      } else {
        col = uTint * 0.55 + fres * 0.6;
        a = 0.35 + fres * 0.5;
      }
      gl_FragColor = vec4(col, a);
    }`,
});
export const glassMaterial = () => mat;

// Called by the game each frame before the viewmodel pass when a glass item is held.
export function prepareGlass(renderer, t) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  if (!GLASS.tex || GLASS.tex.image.width !== size.x || GLASS.tex.image.height !== size.y) {
    if (GLASS.tex) GLASS.tex.dispose();
    GLASS.tex = new THREE.FramebufferTexture(size.x, size.y);
  }
  renderer.copyFramebufferToTexture(GLASS.tex, new THREE.Vector2(0, 0));
  mat.uniforms.tScene.value = GLASS.tex; mat.uniforms.uHas.value = 1; mat.uniforms.uRes.value.copy(size); mat.uniforms.uTime.value = t;
}
export function releaseGlass() { mat.uniforms.tScene.value = null; mat.uniforms.uHas.value = 0; }
