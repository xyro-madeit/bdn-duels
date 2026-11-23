import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildGun } from '../weapons/models.js';
import { tickCosmetics } from '../progression/cosmetics.js';

// Live locker previews: one shared offscreen renderer draws every visible card's model,
// slowly spinning a full 360°, into that card's own 2D canvas. Runs only while the locker is open.
export class Turntable {
  constructor(w = 280, h = 150) {
    this.w = w; this.h = h;
    this.r = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.r.setPixelRatio(1); this.r.setSize(w, h, false);
    this.r.toneMapping = THREE.ACESFilmicToneMapping; this.r.toneMappingExposure = 1.15;
    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(this.r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2, 3, 1.5); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fc8ff, 1.4); rim.position.set(-2, 1, -2); this.scene.add(rim);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
    this.items = []; this.on = false; this.t0 = performance.now();
  }

  // list: [{ canvas, def, cos }]
  set(list) {
    for (const it of this.items) this.scene.remove(it.holder);
    this.items = list.map((it, i) => {
      const gun = buildGun(it.def, it.cos || null);
      const pivot = new THREE.Group(); pivot.add(gun.group);
      if (gun.melee) gun.group.rotation.set(-0.85, 0, 0);
      // center the model on the spin axis
      const box = new THREE.Box3().setFromObject(pivot); const c = box.getCenter(new THREE.Vector3());
      gun.group.position.sub(c);
      const holder = new THREE.Group(); holder.add(pivot); holder.visible = false; this.scene.add(holder);
      const sphere = new THREE.Box3().setFromObject(holder).getBoundingSphere(new THREE.Sphere());
      return { ...it, holder, r: sphere.radius, phase: i * 0.7, ctx: it.canvas.getContext('2d') };
    });
  }

  start() {
    if (this.on) return; this.on = true;
    const loop = () => {
      if (!this.on) return;
      requestAnimationFrame(loop);
      const t = performance.now() / 1000;
      tickCosmetics(t);
      const a = this.w / this.h;
      for (const it of this.items) {
        if (!it.canvas.isConnected) continue;
        it.holder.visible = true;
        it.holder.rotation.set(0.18, t * 0.7 + it.phase, 0); // slow, constant 360° spin with a slight tilt
        const half = it.r * 0.62;
        Object.assign(this.cam, { left: -half * a, right: half * a, top: half, bottom: -half });
        this.cam.position.set(0, 0, 5); this.cam.lookAt(0, 0, 0); this.cam.updateProjectionMatrix();
        this.r.setClearColor(0, 0); this.r.clear(); this.r.render(this.scene, this.cam);
        it.ctx.clearRect(0, 0, it.canvas.width, it.canvas.height);
        it.ctx.drawImage(this.r.domElement, 0, 0, it.canvas.width, it.canvas.height);
        it.holder.visible = false;
      }
    };
    loop();
  }
  stop() { this.on = false; }
}
