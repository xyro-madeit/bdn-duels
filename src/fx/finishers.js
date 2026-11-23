// Finishers (round-ending kill effects), ported from BDN Arena and adapted to a module.
// play(kind, pos, yaw, color, model) — model is the victim's 3D model (hidden or cloned by the effect).
import * as THREE from 'three';
import { sfx } from '../audio/sfx.js';

let scene = null, camera = null;
const effects = [];
export function initFinishers(s, c) { scene = s; camera = c; }
export function updateFinishers(dt) { for (let i = effects.length - 1; i >= 0; i--) if (!effects[i].update(dt)) effects.splice(i, 1); }

const V3 = THREE.Vector3;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOutBack = (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
const shared = (o) => { o.userData.shared = true; return o; };
const unitBox = shared(new THREE.BoxGeometry(1, 1, 1));
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
function makeGlow(color, scale, op) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.setScalar(scale); return s; }
function disposeObj(o) { o.traverse((c) => { if (c.geometry && !c.geometry.userData.shared) c.geometry.dispose(); if (c.material) { const ms = Array.isArray(c.material) ? c.material : [c.material]; ms.forEach((m) => { if (!m.userData.shared) m.dispose(); }); } }); }
function remove(o) { scene.remove(o); disposeObj(o); }
function addFx(update) { effects.push({ update }); }
const Snd = {
  ghost: () => sfx.ghost && sfx.ghost(), thud: () => sfx.thud && sfx.thud(), zap: () => sfx.zap && sfx.zap(),
  pop: () => sfx.pop && sfx.pop(), shatter: () => sfx.shatter && sfx.shatter(), noise: () => sfx.burn && sfx.burn(),
  pixel: () => sfx.pixel && sfx.pixel(), spotlight: () => sfx.spotlight && sfx.spotlight(), balloon: () => sfx.balloon && sfx.balloon(),
};
function fadeGroup(g,a){g.traverse(c=>{if(c.material){const ms=Array.isArray(c.material)?c.material:[c.material];ms.forEach(m=>{if(m.userData.shared)return;m.transparent=true;if(m.userData.baseOp===undefined)m.userData.baseOp=m.opacity;m.opacity=m.userData.baseOp*clamp(a,0,1);});}});}
function cloneModel(model,matFn){const c=model.clone(true);const sprites=[];c.traverse(o=>{if(o.isMesh){o.geometry.userData.shared=true;o.material=matFn(o.material);}if(o.isSprite)sprites.push(o);});sprites.forEach(s=>s.parent.remove(s));return c;}
function makeCoffin(){
 const out=[[-1.1,-.26],[-.55,-.45],[1.1,-.24],[1.1,.24],[-.55,.45],[-1.1,.26]];
 const shape=(sx=1,sy=1)=>{const s=new THREE.Shape();out.forEach(([x,y],i)=>i?s.lineTo(x*sx,y*sy):s.moveTo(x*sx,y*sy));s.closePath();return s;};
 const outer=shape();const hole=new THREE.Path();out.slice().reverse().forEach(([x,y],i)=>i?hole.lineTo(x*.92,y*.8):hole.moveTo(x*.92,y*.8));hole.closePath();outer.holes.push(hole);
 const wood=new THREE.MeshStandardMaterial({color:0x4a2a18,roughness:.55,emissive:0x1a0a04,side:THREE.DoubleSide});
 const lining=new THREE.MeshStandardMaterial({color:0x2fd4a8,emissive:0x0e5a46,roughness:.4,side:THREE.DoubleSide});
 const gold=new THREE.MeshStandardMaterial({color:0xffd166,emissive:0x6b4a00,metalness:.8,roughness:.3});
 const g=new THREE.Group();
 const walls=new THREE.Mesh(new THREE.ExtrudeGeometry(outer,{depth:.6,bevelEnabled:false}),wood);walls.rotation.x=-Math.PI/2;g.add(walls);
 const base=new THREE.Mesh(new THREE.ExtrudeGeometry(shape(),{depth:.06,bevelEnabled:false}),lining);base.rotation.x=-Math.PI/2;g.add(base);
 const lidPivot=new THREE.Group();lidPivot.position.set(0,.6,-.45);g.add(lidPivot);
 const lid=new THREE.Mesh(new THREE.ExtrudeGeometry(shape(),{depth:.08,bevelEnabled:false}),wood);lid.rotation.x=-Math.PI/2;lid.position.set(0,0,.45);lidPivot.add(lid);
 const c1=new THREE.Mesh(new THREE.BoxGeometry(.8,.03,.09),gold);c1.position.set(-.15,.095,.45);lidPivot.add(c1);
 const c2=new THREE.Mesh(new THREE.BoxGeometry(.09,.03,.42),gold);c2.position.set(-.35,.095,.45);lidPivot.add(c2);
 const gl=makeGlow(0x3dffc8,3.2,.35);gl.position.y=.3;g.add(gl);
 return{group:g,lid:lidPivot};
}
function fxGhost(pos,yaw,color,model){
 if(model)model.visible=false;
 Snd.ghost();
 const gm=new THREE.MeshStandardMaterial({color:0x5dffd0,emissive:0x1fe0a8,emissiveIntensity:.9,transparent:true,opacity:.55,depthWrite:false,roughness:.3});
 const em=new THREE.MeshBasicMaterial({color:0x04241c,transparent:true,opacity:.9});
 const ghost=new THREE.Group();
 const add=(geo,mat,x,y,z,rx=0,rz=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.x=rx;m.rotation.z=rz;ghost.add(m);return m;};
 add(new THREE.SphereGeometry(.36,20,14),gm,0,1.5,0);
 add(new THREE.CylinderGeometry(.36,.5,.9,20,1,true),gm,0,1.05,0);
 add(new THREE.ConeGeometry(.5,.75,20,1,true),gm,0,.23,0,Math.PI);
 add(new THREE.CylinderGeometry(.06,.1,.5,10),gm,-.5,1.2,0,0,.8);
 add(new THREE.CylinderGeometry(.06,.1,.5,10),gm,.5,1.2,0,0,-.8);
 add(new THREE.SphereGeometry(.065,10,8),em,-.12,1.56,-.31);add(new THREE.SphereGeometry(.065,10,8),em,.12,1.56,-.31);
 const mouth=add(new THREE.SphereGeometry(.07,10,8),em,0,1.4,-.33);mouth.scale.set(1,1.4,.5);
 const gl=makeGlow(0x3dffc8,2.8,.45);gl.position.y=1.1;ghost.add(gl);
 ghost.position.copy(pos);ghost.rotation.y=yaw;scene.add(ghost);
 const cof=makeCoffin();const cy=pos.y+3.3;cof.group.position.set(pos.x,cy,pos.z);cof.group.rotation.order='YXZ';cof.group.rotation.y=Math.atan2(camera.position.x-pos.x,camera.position.z-pos.z);cof.group.rotation.x=.6;
 cof.group.scale.setScalar(0.001);cof.lid.rotation.x=-1.9;scene.add(cof.group);
 const startQ=new THREE.Quaternion(),endQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,-Math.PI/2,0,'YXZ'));
 const startP=new V3(),endP=new V3(.68,.32,0);
 let t=0,attached=false,thud=false;
 addFx(dt=>{t+=dt;
  if(t<1.6){const k=t/1.6;ghost.position.y=pos.y+easeOut(k)*2.6;ghost.position.x=pos.x+Math.sin(t*5)*.15;ghost.rotation.z=Math.sin(t*4)*.12;ghost.scale.setScalar(1+Math.sin(t*9)*.03);}
  if(t>.8&&t<1.6)cof.group.scale.setScalar(Math.max(.001,easeOutBack((t-.8)/.8)));
  if(t>=1.6&&!attached){attached=true;cof.group.scale.setScalar(1);cof.group.updateMatrixWorld(true);cof.group.attach(ghost);startQ.copy(ghost.quaternion);startP.copy(ghost.position);}
  if(attached&&t<2.5){const k=easeInOut(clamp((t-1.6)/.9,0,1));ghost.quaternion.copy(startQ).slerp(endQ,k);ghost.position.lerpVectors(startP,endP,k);ghost.scale.setScalar(lerp(1,.8,k));}
  if(t>=2.5&&t<3.1)cof.lid.rotation.x=lerp(-1.9,0,Math.pow((t-2.5)/.6,3));
  if(t>=3.1&&!thud){thud=true;cof.lid.rotation.x=0;Snd.thud();fxPuff(cof.group.position.clone().add(new V3(0,.6,0)),0x3dffc8);}
  if(t>3.1)cof.group.position.y=cy+Math.sin((t-3.1)*3)*.08+Math.max(0,t-3.9)*1.4;
  if(t>3.9)fadeGroup(cof.group,1-(t-3.9)/.9);
  if(t>4.8){remove(cof.group);if(ghost.parent)ghost.parent.remove(ghost);disposeObj(ghost);return false;}
  return true;});
}
function fxPuff(p,color){for(let i=0;i<10;i++){const s=makeGlow(color,.6,.6);s.position.copy(p);scene.add(s);const v=new V3(rand(-1,1),rand(-.2,.6),rand(-1,1)).normalize().multiplyScalar(rand(1.5,3));let t=0;addFx(dt=>{t+=dt;s.position.addScaledVector(v,dt);v.multiplyScalar(.92);s.scale.setScalar(.6+t*1.5);s.material.opacity=.6*(1-t/.7);if(t>.7){remove(s);return false;}return true;});}}
// ⚡ Lightning
function fxLightning(pos,yaw,color,model){
 Snd.zap();
 const grp=new THREE.Group();scene.add(grp);
 const core=new THREE.MeshBasicMaterial({color:0xeaf6ff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
 const halo=new THREE.MeshBasicMaterial({color:0x7fb8ff,transparent:true,opacity:.35,blending:THREE.AdditiveBlending,depthWrite:false});
 const cyl=new THREE.CylinderGeometry(1,1,1,6,1,true);
 const bolt=(a,b,r,depth=0)=>{let prev=a.clone();const N=12;for(let i=1;i<=N;i++){const k=i/N;const q=a.clone().lerp(b,k);if(i<N){q.x+=rand(-1.1,1.1);q.z+=rand(-1.1,1.1);}const d=q.clone().sub(prev),len=d.length();[[core,r],[halo,r*3.2]].forEach(([m,rr])=>{const s=new THREE.Mesh(cyl,m);s.position.copy(prev).addScaledVector(d,.5);s.quaternion.setFromUnitVectors(new V3(0,1,0),d.clone().normalize());s.scale.set(rr,len,rr);grp.add(s);});if(depth<1&&i>3&&i<N-1&&Math.random()<.3)bolt(q.clone(),q.clone().add(new V3(rand(-5,5),rand(-6,-2),rand(-5,5))),r*.5,depth+1);prev=q;}};
 bolt(new V3(pos.x+rand(-4,4),pos.y+48,pos.z+rand(-4,4)),new V3(pos.x,pos.y+.5,pos.z),.07);
 const L=new THREE.PointLight(0xaad4ff,9,45);L.position.set(pos.x,pos.y+4,pos.z);scene.add(L);
 const scorch=new THREE.Mesh(new THREE.CircleGeometry(1.7,28),new THREE.MeshBasicMaterial({color:0x0a0806,transparent:true,opacity:.8,depthWrite:false}));scorch.rotation.x=-Math.PI/2;scorch.position.set(pos.x,pos.y+.04,pos.z);scene.add(scorch);
 let char=null;if(model){char=cloneModel(model,()=>new THREE.MeshStandardMaterial({color:0x121012,emissive:0x401500,emissiveIntensity:.8,transparent:true}));char.position.copy(model.position);char.rotation.copy(model.rotation);scene.add(char);model.visible=false;}
 fxPuff(new V3(pos.x,pos.y+.5,pos.z),0x9fd0ff);
 let t=0;addFx(dt=>{t+=dt;
  if(t<.55){core.opacity=Math.random()>.3?1:.15;halo.opacity=core.opacity*.35;L.intensity=Math.random()*10;}else{core.opacity=Math.max(0,1-(t-.55)/.25);halo.opacity=core.opacity*.35;L.intensity=Math.max(0,9*(1-(t-.55)/.3));}
  if(char&&t>.7){char.position.y-=dt*.6;fadeGroup(char,1-(t-.7)/1.4);}
  if(t>2)scorch.material.opacity=.8*(1-(t-2)/2);
  if(t>4){remove(grp);scene.remove(L);remove(scorch);if(char)remove(char);cyl.dispose();return false;}return true;});
}
// 🎆 Confetti
const confGeo=shared(new THREE.PlaneGeometry(.14,.07));
function fxConfetti(pos,yaw,color,model){
 if(model)model.visible=false;Snd.pop();
 const cols=[0xff4d6d,0xffd166,0x3dffc8,0x4cc9f0,0xb98cff,0xff7ad9];const mats=cols.map(c=>new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide,transparent:true}));
 const grp=new THREE.Group();scene.add(grp);const ps=[];
 for(let i=0;i<180;i++){const m=new THREE.Mesh(confGeo,mats[i%6]);m.position.set(pos.x+rand(-.3,.3),pos.y+rand(.5,1.8),pos.z+rand(-.3,.3));m.rotation.set(rand(0,6),rand(0,6),rand(0,6));grp.add(m);ps.push({m,v:new V3(rand(-4,4),rand(5,11),rand(-4,4)),w:new V3(rand(-12,12),rand(-12,12),rand(-12,12))});}
 fxPuff(new V3(pos.x,pos.y+1,pos.z),0xffd166);
 let t=0;addFx(dt=>{t+=dt;for(const p of ps){p.v.y-=9*dt;p.v.multiplyScalar(.975);if(p.v.y<-2.2)p.v.y=-2.2;p.m.position.addScaledVector(p.v,dt);if(p.m.position.y<pos.y+.03){p.m.position.y=pos.y+.03;p.v.set(0,0,0);}else{p.m.position.x+=Math.sin(t*6+p.w.x)*dt*.6;p.m.rotation.x+=p.w.x*dt;p.m.rotation.y+=p.w.y*dt;}}
  if(t>3)mats.forEach(m=>m.opacity=1-(t-3)/1);if(t>4){remove(grp);return false;}return true;});
}
// 💎 Shatter
function fxShatter(pos,yaw,color,model,count=46,size=1){
 if(model)model.visible=false;if(count>20)Snd.shatter();
 const mat=new THREE.MeshStandardMaterial({color,roughness:.4,metalness:.3,emissive:color,emissiveIntensity:.25,transparent:true});
 const grp=new THREE.Group();scene.add(grp);const ps=[];const base=model||size<=1?pos.y:Math.max(0,pos.y-2.5);
 for(let i=0;i<count;i++){const s=rand(.1,.26)*size;const m=new THREE.Mesh(unitBox,mat);m.scale.setScalar(s);const off=new V3(rand(-.32,.32)*size,rand(0,1.9)*(size>1?.6:1),rand(-.22,.22)*size).applyAxisAngle(new V3(0,1,0),yaw);m.position.copy(pos).add(off);m.castShadow=true;grp.add(m);const out=off.clone();out.y=0;out.normalize();ps.push({m,s,v:out.multiplyScalar(rand(2,5)).add(new V3(0,rand(2,6),0)),w:new V3(rand(-9,9),rand(-9,9),rand(-9,9))});}
 let t=0;addFx(dt=>{t+=dt;for(const p of ps){p.v.y-=18*dt;p.m.position.addScaledVector(p.v,dt);if(p.m.position.y<base+p.s/2){p.m.position.y=base+p.s/2;p.v.y*=-.35;p.v.x*=.7;p.v.z*=.7;p.w.multiplyScalar(.7);}p.m.rotation.x+=p.w.x*dt;p.m.rotation.y+=p.w.y*dt;}
  if(t>1.8)mat.opacity=1-(t-1.8)/.8;if(t>2.6){remove(grp);return false;}return true;});
}
// 🔥 Ember dissolve
function fxEmber(pos,yaw,color,model){
 let c=null;if(model){c=cloneModel(model,m=>{const n=m.clone();n.transparent=true;n.emissive=new THREE.Color(0xff5a00);n.emissiveIntensity=0;return n;});c.position.copy(model.position);c.rotation.copy(model.rotation);scene.add(c);model.visible=false;}
 Snd.noise();
 const N=170,geo=new THREE.BufferGeometry();const arr=new Float32Array(N*3),vel=[];for(let i=0;i<N;i++){arr[i*3]=pos.x+rand(-.35,.35);arr[i*3+1]=pos.y+rand(0,1.9);arr[i*3+2]=pos.z+rand(-.3,.3);vel.push(new V3(rand(-.4,.4),rand(1.2,3.2),rand(-.4,.4)));}
 geo.setAttribute('position',new THREE.BufferAttribute(arr,3));
 const pm=new THREE.PointsMaterial({size:.16,map:glowTex,color:0xff8a2a,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});const pts=new THREE.Points(geo,pm);scene.add(pts);
 let t=0;addFx(dt=>{t+=dt;if(c){c.traverse(o=>{if(o.isMesh)o.material.emissiveIntensity=Math.min(2.5,t*2.5);});fadeGroup(c,1-t/1.5);c.scale.y=Math.max(.01,1-t/1.6);}
  for(let i=0;i<N;i++){const v=vel[i];arr[i*3]+=(v.x+Math.sin(t*3+i)*.5)*dt;arr[i*3+1]+=v.y*dt;arr[i*3+2]+=(v.z+Math.cos(t*3+i)*.5)*dt;}geo.attributes.position.needsUpdate=true;pm.opacity=t<1.6?1:1-(t-1.6)/.9;
  if(t>2.5){if(c)remove(c);remove(pts);return false;}return true;});
}

// ---- new finishers
// Pixel Delete: the body breaks into glowing voxels that drift up and blink out of existence
function fxPixel(pos, yaw, color, model) {
  if (model) model.visible = false;
  Snd.pixel();
  const grp = new THREE.Group(); scene.add(grp);
  const cols = [0x36d6b0, 0x7ff9ff, 0xffffff, 0x2a9d8f];
  const mats = cols.map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true }));
  const ps = [];
  for (let i = 0; i < 90; i++) {
    const m = new THREE.Mesh(unitBox, mats[i % mats.length]);
    const s = rand(0.06, 0.13); m.scale.setScalar(s);
    m.position.set(pos.x + rand(-0.35, 0.35), pos.y + rand(0, 1.9), pos.z + rand(-0.25, 0.25));
    grp.add(m);
    ps.push({ m, v: new V3(rand(-0.4, 0.4), rand(0.6, 2.2), rand(-0.4, 0.4)), off: rand(0.6, 2.2), s });
  }
  let t = 0;
  addFx((dt) => {
    t += dt;
    for (const p of ps) {
      p.m.position.addScaledVector(p.v, dt);
      // snap to a 4 cm grid so the motion reads as "digital"
      p.m.position.x = Math.round(p.m.position.x / 0.04) * 0.04; p.m.position.z = Math.round(p.m.position.z / 0.04) * 0.04;
      if (t > p.off) p.m.visible = Math.random() > (t - p.off) * 2;
    }
    if (t > 3.2) { remove(grp); return false; }
    return true;
  });
}

// Balloon Float: a bunch of balloons tie onto the body and carry it up into the sky
function fxBalloon(pos, yaw, color, model) {
  Snd.balloon();
  const body = model ? cloneModel(model, (m) => { const n = m.clone(); n.transparent = true; return n; }) : null;
  if (model) model.visible = false;
  const grp = new THREE.Group(); grp.position.copy(pos); scene.add(grp);
  if (body) { body.position.set(0, 0, 0); body.rotation.set(0, yaw, 0); grp.add(body); }
  const cols = [0xff4d6d, 0xffd166, 0x36d6b0, 0x4cc9f0, 0xb98cff];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const top = new V3(Math.cos(a) * 0.45, 3.1 + rand(-0.2, 0.3), Math.sin(a) * 0.45);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), new THREE.MeshStandardMaterial({ color: cols[i], roughness: 0.3, transparent: true }));
    b.scale.set(1, 1.2, 1); b.position.copy(top); grp.add(b);
    const str = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(0, 2.0, 0), top.clone().add(new V3(0, -0.3, 0))]), new THREE.LineBasicMaterial({ color: 0xffffff }));
    grp.add(str);
  }
  let t = 0;
  addFx((dt) => {
    t += dt;
    const k = Math.max(0, t - 0.5);
    grp.position.y = pos.y + k * k * 1.6;
    grp.rotation.y += dt * 0.6;
    grp.position.x = pos.x + Math.sin(t * 2) * 0.15;
    if (t > 4) fadeGroup(grp, 1 - (t - 4) / 1);
    if (t > 5) { remove(grp); return false; }
    return true;
  });
}

// Spotlight Bow: a spotlight snaps on, the body takes a bow, then the light cuts out
function fxSpotlight(pos, yaw, color, model) {
  const body = model ? cloneModel(model, (m) => { const n = m.clone(); n.transparent = true; return n; }) : null;
  if (model) model.visible = false;
  const grp = new THREE.Group(); scene.add(grp);
  if (body) { body.position.copy(pos); body.rotation.set(0, yaw, 0); grp.add(body); }
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 9, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.position.set(pos.x, pos.y + 4.5, pos.z); grp.add(cone);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(pos.x, pos.y + 0.03, pos.z); grp.add(pool);
  const L = new THREE.SpotLight(0xfff3c4, 0, 14, 0.35, 0.4); L.position.set(pos.x, pos.y + 9, pos.z); L.target.position.copy(pos); grp.add(L, L.target);
  Snd.spotlight();
  let t = 0, bowed = false;
  addFx((dt) => {
    t += dt;
    const on = t < 0.15 ? t / 0.15 : t < 2.6 ? 1 : Math.max(0, 1 - (t - 2.6) / 0.12);
    cone.material.opacity = 0.18 * on; pool.material.opacity = 0.35 * on; L.intensity = 40 * on;
    if (body) {
      const k = t < 0.6 ? 0 : t < 1.1 ? (t - 0.6) / 0.5 : t < 1.9 ? 1 : Math.max(0, 1 - (t - 1.9) / 0.4);
      body.rotation.x = -0.8 * Math.sin(k * Math.PI / 2); // bow forward from the hips
      if (!bowed && t > 1.1) { bowed = true; Snd.pop(); }
    }
    if (t > 2.75 && body) body.visible = false;
    if (t > 3.2) { remove(grp); return false; }
    return true;
  });
}

export const FINISHERS = {
  ghost: { name: 'Ghost & Coffin', desc: 'A ghost floats up into an open coffin, and the lid slams shut.', fn: fxGhost },
  lightning: { name: 'Thunder Strike', desc: 'A bolt from the sky chars them and scorches the ground.', fn: fxLightning },
  confetti: { name: 'Party Pop', desc: 'They burst into a cloud of confetti.', fn: fxConfetti },
  shatter: { name: 'Shatter', desc: 'The body cracks into cubes that bounce away.', fn: (p, y, c, m) => fxShatter(p, y, c, m) },
  ember: { name: 'Ember Dissolve', desc: 'They glow hot and burn away into rising embers.', fn: fxEmber },
  pixel: { name: 'Pixel Delete', desc: 'They break into glowing voxels that blink out of existence.', fn: fxPixel },
  balloon: { name: 'Balloon Float', desc: 'A bunch of balloons carries them up into the sky.', fn: fxBalloon },
  spotlight: { name: 'Spotlight Bow', desc: 'A spotlight snaps on, they take a bow, lights out.', fn: fxSpotlight },
};
export function playFinisher(kind, pos, yaw, color, model) {
  const f = FINISHERS[kind] || FINISHERS.shatter;
  try { f.fn(pos.clone(), yaw, color, model); } catch (e) { console.error(e); if (model) model.visible = false; }
}
