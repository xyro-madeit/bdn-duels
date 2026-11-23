import * as THREE from 'three';

// Practice targets: training mannequins with head/body hitboxes, HP bar, marker (shows through
// walls when marked/pinged/burning), knockback, launch (uppercut), burn and a respawn.
const MANNEQUIN = { shell: 0xcfc6b6, joint: 0x3d4045, visor: 0x1b1d20, accent: 0xb5432f };
const mats = {};
const mat = (c, o = {}) => mats[c] || (mats[c] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.05, ...o }));

function block(parent, w, h, d, color, x, y, z, o) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, o));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function buildAvatar(c = MANNEQUIN) {
  const g = new THREE.Group();
  block(g, 0.2, 0.42, 0.22, c.shell, -0.13, 0.21, 0); block(g, 0.2, 0.42, 0.22, c.shell, 0.13, 0.21, 0);   // shins
  block(g, 0.22, 0.08, 0.24, c.joint, -0.13, 0.45, 0); block(g, 0.22, 0.08, 0.24, c.joint, 0.13, 0.45, 0); // knees
  block(g, 0.21, 0.38, 0.23, c.shell, -0.13, 0.68, 0); block(g, 0.21, 0.38, 0.23, c.shell, 0.13, 0.68, 0); // thighs
  block(g, 0.5, 0.16, 0.28, c.joint, 0, 0.92, 0);                       // hips
  block(g, 0.56, 0.5, 0.3, c.shell, 0, 1.24, 0);                          // torso
  block(g, 0.2, 0.2, 0.02, c.accent, 0, 1.28, -0.16, { roughness: 0.4 }); // target plate
  block(g, 0.16, 0.56, 0.18, c.shell, -0.38, 1.2, 0); block(g, 0.16, 0.56, 0.18, c.shell, 0.38, 1.2, 0);
  block(g, 0.12, 0.08, 0.12, c.joint, 0, 1.53, 0);                        // neck
  const head = block(g, 0.34, 0.38, 0.34, c.shell, 0, 1.75, 0);
  block(head, 0.28, 0.1, 0.02, c.visor, 0, 0.04, -0.17, { metalness: 0.6, roughness: 0.2 });
  return g;
}

const markerTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.translate(32, 32); g.rotate(Math.PI / 4);
  g.fillStyle = '#ff4d3d'; g.fillRect(-14, -14, 28, 28);
  g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(-14, -14, 28, 28);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

export class Dummy {
  constructor(scene, x, y, z, opts = {}) {
    this.isDummy = true;
    this.home = new THREE.Vector3(x, y, z);
    this.spawnHome = this.home.clone();
    this.pos = this.home.clone();
    this.move = opts.move || null; // { axis:'x'|'z', range, speed }
    this.t = Math.random() * 10;
    this.maxHp = 100; this.hp = 100;
    this.alive = true; this.respawnT = 0; this.deathT = 0;
    this.yOff = 0; this.vy = 0;
    this.model = buildAvatar();
    this.bar = makeBar();
    this.model.add(this.bar.sprite);
    this.marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTex, depthTest: false, transparent: true }));
    this.marker.scale.setScalar(0.35); this.marker.position.y = 2.55; this.marker.renderOrder = 10; this.marker.visible = false;
    this.model.add(this.marker);
    scene.add(this.model);
    this.vel = new THREE.Vector3();
  }

  hitboxes() {
    const p = this.pos, y = p.y + this.yOff;
    return [
      { part: 'head', min: [p.x - 0.2, y + 1.55, p.z - 0.2], max: [p.x + 0.2, y + 1.95, p.z + 0.2] },
      { part: 'body', min: [p.x - 0.48, y, p.z - 0.2], max: [p.x + 0.48, y + 1.55, p.z + 0.2] },
    ];
  }

  knock(v) { this.knockV = v.clone(); }
  launch(vy) { this.vy = vy; }
  burn(dps, time) { this.burnDps = dps; this.burnT = time; this.burnTick = 0; }
  mark(time) { this.markT = Math.max(this.markT || 0, time); }

  damage(n) {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - n);
    this.bar.draw(this.hp / this.maxHp);
    if (this.hp <= 0) { this.alive = false; this.deathT = 0; this.respawnT = 2; return true; }
    return false;
  }

  // onDot(dummy, dmg) is called for burn ticks
  update(dt, lookAt, onDot) {
    this.t += dt;
    if (this.alive && this.move) {
      const prev = this.pos.clone();
      const off = Math.sin(this.t * this.move.speed) * this.move.range;
      this.pos.copy(this.home); this.pos[this.move.axis] += off;
      this.vel.subVectors(this.pos, prev).divideScalar(dt);
    }
    if (this.knockV) {
      this.home.addScaledVector(this.knockV, dt); if (!this.move) this.pos.copy(this.home);
      this.knockV.multiplyScalar(Math.exp(-dt * 6)); if (this.knockV.lengthSq() < 0.01) this.knockV = null;
    }
    if (this.vy || this.yOff > 0) { this.vy -= 24 * dt; this.yOff += this.vy * dt; if (this.yOff <= 0) { this.yOff = 0; this.vy = 0; } }
    if (this.burnT > 0 && this.alive) {
      this.burnT -= dt; this.burnTick += dt;
      if (this.burnTick >= 0.5) { this.burnTick -= 0.5; onDot && onDot(this, this.burnDps * 0.5); }
    }
    if (this.markT > 0) this.markT -= dt;
    this.marker.visible = this.alive && (this.markT > 0 || this.burnT > 0);
    this.marker.material.color.setHex(this.burnT > 0 && !(this.markT > 0) ? 0xffa040 : 0xffffff);

    if (!this.alive) {
      this.deathT += dt;
      const k = Math.min(1, this.deathT / 0.25);
      this.model.rotation.x = -k * 1.4; // topple backward
      this.respawnT -= dt;
      if (this.respawnT <= 0) {
        this.alive = true; this.hp = this.maxHp; this.bar.draw(1); this.popT = 0; this.burnT = 0; this.markT = 0;
        this.home.copy(this.spawnHome); this.pos.copy(this.home); this.model.rotation.x = 0; this.yOff = 0; this.vy = 0; this.finished = false;
      }
    } else if (this.popT !== undefined && this.popT < 1) {
      this.popT += dt / 0.25;
      this.model.scale.setScalar(Math.min(1, 0.6 + this.popT * 0.4));
    } else this.model.scale.setScalar(1);
    this.model.position.set(this.pos.x, this.pos.y + this.yOff, this.pos.z);
    if (lookAt && this.alive) this.model.rotation.y = Math.atan2(lookAt.x - this.pos.x, lookAt.z - this.pos.z) + Math.PI;
    this.model.visible = this.alive || (this.deathT < 1.2 && !this.finished);
  }
}

function makeBar() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 16;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sprite.scale.set(0.8, 0.1, 1); sprite.position.y = 2.2;
  const draw = (f) => {
    const g = c.getContext('2d'); g.clearRect(0, 0, 128, 16);
    g.fillStyle = 'rgba(10,12,15,.75)'; g.fillRect(0, 0, 128, 16);
    g.fillStyle = f > 0.5 ? '#e8ecef' : f > 0.25 ? '#ffb347' : '#ff4d3d';
    g.fillRect(3, 3, 122 * f, 10);
    tex.needsUpdate = true;
  };
  draw(1);
  return { sprite, draw };
}
