import * as THREE from 'three';

// Tracers, bullet holes and impact puffs. Pooled-ish: decals are capped and recycled.
const tracerGeo = new THREE.CylinderGeometry(0.008, 0.008, 1, 5, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
const decalGeo = new THREE.PlaneGeometry(0.07, 0.07);
const decalMat = new THREE.MeshBasicMaterial({ color: 0x2a2633, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const puffGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);

export class Impacts {
  constructor(scene) {
    this.scene = scene;
    this.live = [];
    this.decals = [];
  }

  tracer(from, to, color = 0xfff2b0) {
    const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    const len = from.distanceTo(to);
    m.position.copy(from); m.lookAt(to); m.scale.set(1, 1, len);
    this.scene.add(m);
    this.live.push({ obj: m, t: 0, life: 0.06, fade: m.material });
  }

  hole(point, normal) {
    const d = new THREE.Mesh(decalGeo, decalMat);
    const n = new THREE.Vector3(...normal);
    d.position.copy(point).addScaledVector(n, 0.003);
    d.lookAt(d.position.clone().add(n));
    d.rotation.z = Math.random() * Math.PI;
    this.scene.add(d);
    this.decals.push(d);
    if (this.decals.length > 80) { const old = this.decals.shift(); this.scene.remove(old); }
  }

  puff(point, normal, color = 0xe8e2d2, n = 6) {
    const N = new THREE.Vector3(...(normal || [0, 1, 0]));
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
      m.position.copy(point);
      const v = N.clone().multiplyScalar(1.5 + Math.random() * 2).add(new THREE.Vector3((Math.random() - 0.5) * 2.5, Math.random() * 1.5, (Math.random() - 0.5) * 2.5));
      this.scene.add(m);
      this.live.push({ obj: m, t: 0, life: 0.35, v, fade: m.material, spin: Math.random() * 10 });
    }
  }

  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.t += dt;
      if (p.v) { p.v.y -= 9 * dt; p.obj.position.addScaledVector(p.v, dt); p.obj.rotation.x += p.spin * dt; p.obj.scale.setScalar(1 - p.t / p.life * 0.6); }
      p.fade.opacity = Math.max(0, 1 - p.t / p.life);
      if (p.t >= p.life) { this.scene.remove(p.obj); p.fade.dispose(); this.live.splice(i, 1); }
    }
  }
}
