// ============================================================
//  Modelos 3D procedurais (estilo cartunesco com contorno)
//  Lote local: x em [-fw/2, fw/2], z em [-fd/2, fd/2], frente em z = +fd/2 (rua)
// ============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _c = new THREE.Color();
const ROUND = /Cylinder|Cone|Sphere/;

export class Kit {
  constructor(){ this.g = []; this.e = []; this.smoke = []; this.T = null; this.floors = 1; this.capMul = 1; }
  add(geo, color, x=0, y=0, z=0, o={}){
    const round = ROUND.test(geo.type);
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    geo.dispose();
    g.clearGroups();
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    if (o.rx) g.rotateX(o.rx);
    if (o.rz) g.rotateZ(o.rz);
    if (o.ry) g.rotateY(o.ry);
    if (o.s) g.scale(o.s, o.s, o.s);
    g.translate(x, y, z);
    if (this.T){ if (this.T.ry) g.rotateY(this.T.ry); g.translate(this.T.x, 0, this.T.z); }
    _c.set(color);
    const n = g.attributes.position.count, c = new Float32Array(n*3);
    for (let i=0;i<n;i++){ c[i*3]=_c.r; c[i*3+1]=_c.g; c[i*3+2]=_c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    this.g.push(g);
    if (o.edges !== false) this.e.push(new THREE.EdgesGeometry(g, o.ea ?? (round ? 50 : 28)));
    return this;
  }
  at(x, z, ry, fn){ const prev = this.T; this.T = { x, z, ry }; fn(); this.T = prev; }
  addSmoke(x, y, z){
    const v = new THREE.Vector3(x, y, z);
    if (this.T){ if (this.T.ry) v.applyAxisAngle(new THREE.Vector3(0,1,0), this.T.ry); v.x += this.T.x; v.z += this.T.z; }
    this.smoke.push([v.x, v.y, v.z]);
  }
  geometry(){ return this.g.length ? mergeGeometries(this.g) : null; }
  edges(){ return this.e.length ? mergeGeometries(this.e) : new THREE.BufferGeometry(); }
  dispose(){ this.g.forEach(g=>g.dispose()); this.e.forEach(g=>g.dispose()); }
}

// ---------- primitivas ----------
export const box = (w,h,d) => new THREE.BoxGeometry(w,h,d);
export const cyl = (rt,rb,h,s=12) => new THREE.CylinderGeometry(rt,rb,h,s);
export const cone = (r,h,s=12) => new THREE.ConeGeometry(r,h,s);
export const ball = (r) => new THREE.IcosahedronGeometry(r, 0);
export const dome = (r) => new THREE.SphereGeometry(r, 14, 7, 0, Math.PI*2, 0, Math.PI/2);
export function gable(w,d,h){
  const s = new THREE.Shape(); s.moveTo(-w/2,0); s.lineTo(w/2,0); s.lineTo(0,h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth:d, bevelEnabled:false }); g.translate(0,0,-d/2); return g;
}
function shed(w,d,h){
  const s = new THREE.Shape(); s.moveTo(-w/2,0); s.lineTo(w/2,0); s.lineTo(w/2,h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth:d, bevelEnabled:false }); g.translate(0,0,-d/2); return g;
}
function hip(W, D, h){ const g = new THREE.ConeGeometry(Math.SQRT1_2, h, 4, 1); g.rotateY(Math.PI/4); g.scale(W, 1, D); g.translate(0, h/2, 0); return g; }
const halfCyl = (r,len) => new THREE.CylinderGeometry(r, r, len, 14, 1, false, 0, Math.PI);
export const pick = (R, a) => a[Math.floor(R()*a.length)];
const rint = (R, a, b) => a + Math.floor(R()*(b-a+1));

// ---------- paletas ----------
const WALLS  = ['#f3e6c8','#ecd0a6','#e2bc8f','#cfdde3','#efd8bd','#f4dc9f','#e6c7c0','#d7e3c4','#f1e1d0','#c9d9c0'];
const ROOFS  = ['#c4552f','#a9442b','#7e4b3b','#5f707b','#b8683a','#8f3f35','#4f6a7a'];
const BRICK  = ['#b5583f','#a24b3a','#c06a4a','#9c5a45'];
const GREENS = ['#5d9a3f','#6aa847','#4f8a3a','#7bb24f','#568f43'];
const CARS   = ['#d9443a','#3f7fc4','#f2c14e','#ffffff','#4a4f57','#5aa36b','#e98b2a'];
const GLASS = '#a3d3e6', DOOR = '#6b4a35', TRIM = '#f8f2e4', INK = '#3a2e28', WATER = '#6fb7dd';

// ---------- detalhes ----------
export function addTree(k, x, z, R, s=1){
  k.add(cyl(0.03*s,0.045*s,0.22*s,6), '#7a5236', x, 0.11*s, z);
  if (R() < 0.4) k.add(cone(0.17*s, 0.5*s, 7), pick(R,['#3f7a3e','#4a8642','#2f6b3a']), x, 0.42*s, z, { ry:R()*3, ea:28 });
  else k.add(ball((0.19+R()*0.07)*s), pick(R,GREENS), x, 0.36*s, z, { ry:R()*3 });
}
const bush = (k,x,z,R,s=1) => k.add(ball(0.07*s), pick(R,GREENS), x, 0.06*s, z, { ry:R()*3 });
const ground = (k, fw, fd, c='#9fcb6c', y=0.01) => k.add(box(fw-0.04, 0.02, fd-0.04), c, 0, y, 0, { edges:false });
function car(k, x, z, alongX, R){
  const c = pick(R, CARS);
  if (alongX){ k.add(box(0.26,0.05,0.13), c, x,0.045,z); k.add(box(0.13,0.045,0.11), '#cfe6ef', x-0.01,0.09,z); }
  else { k.add(box(0.13,0.05,0.26), c, x,0.045,z); k.add(box(0.11,0.045,0.13), '#cfe6ef', x,0.09,z-0.01); }
}
function truck(k, x, z, R){
  k.add(box(0.16,0.12,0.14), pick(R,['#d9443a','#3f7fc4','#f2f0ea']), x,0.08,z+0.18);
  k.add(box(0.17,0.16,0.36), '#e9e6df', x,0.1,z-0.08);
}
// cerca no perímetro de um lote (sem a frente)
function fenceLot(k, fw, fd, c='#f4efe6', h=0.07, front=false){
  const x = fw/2-0.03, z = fd/2-0.03;
  k.add(box(fw-0.06,h,0.02), c, 0,h/2,-z);
  k.add(box(0.02,h,fd-0.06), c, -x,h/2,0);
  k.add(box(0.02,h,fd-0.06), c, x,h/2,0);
  if (front){ const seg = (fw-0.4)/2; k.add(box(seg,h,0.02), c, -fw/2+0.03+seg/2,h/2,z); k.add(box(seg,h,0.02), c, fw/2-0.03-seg/2,h/2,z); }
}
function pool(k, x, z, w, d){ k.add(box(w+0.06,0.025,d+0.06), '#f2efe8', x,0.012,z, { edges:false }); k.add(box(w,0.03,d), WATER, x,0.016,z); }
function parking(k, x, z, w, d, R, cars=true){
  k.add(box(w,0.024,d), '#8a8d92', x,0.012,z, { edges:false });
  const n = Math.max(1, Math.floor(w/0.22));
  for (let i=0;i<=n;i++) k.add(box(0.015,0.026,d*0.4), '#f3ecd6', x-w/2+i*w/n, 0.013, z, { edges:false });
  if (cars) for (let i=0;i<n;i++) if (R()<0.6) car(k, x-w/2+(i+0.5)*w/n, z, false, R);
}
function windows(k, { W, D, cx=0, cz=0, y0=0, floors=1, fh=0.3, ww=0.09, wh=0.11, color=GLASS, gap=0.22, faces='fblr', skip=null, frame=null }){
  for (let f=0; f<floors; f++){
    const y = y0 + fh*f + fh*0.55;
    const nx = Math.max(1, Math.floor(W/gap)), nz = Math.max(1, Math.floor(D/gap));
    for (let i=0;i<nx;i++){
      const x = cx - W/2 + W*(i+0.5)/nx;
      if (faces.includes('f') && !(skip && skip(f,i,nx))){
        if (frame) k.add(box(ww+0.03,wh+0.03,0.012), frame, x,y,cz+D/2+0.004, { edges:false });
        k.add(box(ww,wh,0.02), color, x,y,cz+D/2+0.006, { edges:false });
      }
      if (faces.includes('b')) k.add(box(ww,wh,0.02), color, x,y,cz-D/2-0.006, { edges:false });
    }
    for (let i=0;i<nz;i++){
      const z = cz - D/2 + D*(i+0.5)/nz;
      if (faces.includes('l')) k.add(box(0.02,wh,ww), color, cx-W/2-0.006,y,z, { edges:false });
      if (faces.includes('r')) k.add(box(0.02,wh,ww), color, cx+W/2+0.006,y,z, { edges:false });
    }
  }
}
function gableRoof(k, W, D, h, color, y, alongX, cx=0, cz=0, o=0.05){
  if (alongX) k.add(gable(D+o*2, W+o*2, h), color, cx, y, cz, { ry:Math.PI/2 });
  else k.add(gable(W+o*2, D+o*2, h), color, cx, y, cz);
}
function flatRoof(k, W, D, y, cx=0, cz=0, c=TRIM, par='#cfc8b8'){
  k.add(box(W+0.04,0.04,D+0.04), c, cx, y+0.02, cz);
  k.add(box(Math.max(0.02,W-0.06),0.012,Math.max(0.02,D-0.06)), par, cx, y+0.046, cz, { edges:false });
}
function door(k, x, y, z, c=DOOR, w=0.12, h=0.2){ k.add(box(w,h,0.025), c, x, y+h/2, z); }
// quintal nos fundos de um lote mais fundo
function backyard(k, R, fw, z0, z1){
  const d = z1 - z0; if (d < 0.5) return;
  const zc = (z0+z1)/2;
  const r = R();
  if (r < 0.3 && fw >= 1) pool(k, 0, zc, Math.min(0.5, fw*0.5), Math.min(0.32, d*0.45));
  else if (r < 0.6){ for (let i=0;i<4;i++) k.add(box(Math.min(0.6,fw*0.6),0.04,0.06), i%2?'#5d9a3f':'#7bb24f', 0,0.025,z0+0.2+i*0.12); }
  else k.add(box(0.22,0.18,0.18), pick(R,['#b98656','#cfdde3']), -fw/2+0.2,0.09,z0+0.18);
  addTree(k, fw/2-0.2, z0+0.2, R, 0.7);
  if (d > 1.2) addTree(k, -fw/2+0.22, zc+0.2, R, 0.7);
}

// ============================================================
//  PEÇAS 1x1 reaproveitadas (centro 0, frente em z = +0.48)
// ============================================================
const P = {
  casaTerrea(k,R){
    k.add(box(0.13,0.022,0.24), '#d9c9a5', 0,0.022,0.36, { edges:false });
    const W=0.6+R()*0.12, D=0.5, H=0.32, wall=pick(R,WALLS);
    k.add(box(W+0.04,0.04,D+0.04), '#cfc6b3', 0,0.02,-0.04);
    k.add(box(W,H,D), wall, 0,H/2+0.03,-0.04);
    gableRoof(k, W, D, 0.27, pick(R,ROOFS), H+0.03, R()<0.5, 0, -0.04, 0.06);
    door(k, 0, 0.03, D/2-0.04+0.002);
    windows(k, { W, D, cz:-0.04, y0:0.03, fh:H, faces:'flr', skip:(f,i,n)=>n%2 && i===(n>>1), frame:TRIM });
    if (R()<0.6) addTree(k, -0.34, 0.33, R, 0.6); else bush(k,-0.3,0.33,R);
    bush(k, 0.32, 0.32, R);
  },
  sobrado(k,R){
    k.add(box(0.13,0.022,0.2), '#d9c9a5', 0.1,0.022,0.37, { edges:false });
    const W=0.62, D=0.52, H=0.6, wall=pick(R,WALLS);
    k.add(box(W,H,D), wall, 0,H/2,-0.06);
    k.add(box(W+0.02,0.03,D+0.02), TRIM, 0,0.31,-0.06);
    gableRoof(k, W, D, 0.26, pick(R,ROOFS), H, true, 0, -0.06, 0.06);
    door(k, 0.1, 0, D/2-0.06+0.002);
    windows(k, { W, D, cz:-0.06, floors:2, fh:0.3, faces:'flr', skip:(f,i)=>f===0&&i===1, frame:TRIM });
    k.add(box(0.36,0.03,0.14), TRIM, -0.08,0.32,D/2-0.06+0.07);
    k.add(box(0.36,0.08,0.015), '#ffffff', -0.08,0.37,D/2-0.06+0.14);
    if (R()<0.5) car(k, -0.3, 0.33, false, R); else addTree(k,-0.32,0.32,R,0.6);
  },
  chale(k,R){
    const W=0.5, D=0.56, H=0.22, wood=pick(R,['#b98656','#a8774b','#c79a68']);
    k.add(box(W,H,D), wood, 0,H/2,-0.04);
    k.add(gable(W+0.14, D+0.1, 0.46), pick(R,['#5b3a2c','#3f4d57','#7e4b3b']), 0,H,-0.04);
    k.add(gable(W-0.12, 0.02, 0.3), wood, 0,H,D/2-0.04+0.01, { edges:false });
    k.add(cyl(0.05,0.05,0.02,12), GLASS, 0,H+0.12,D/2-0.04+0.02, { rx:Math.PI/2 });
    door(k, 0, 0, D/2-0.04+0.002, '#5b3a2c');
    k.add(box(0.07,0.25,0.07), '#9b4c37', 0.12,H+0.3,-0.15);
    addTree(k,-0.33,0.3,R,0.7);
  },
  garagem(k,R){
    k.add(box(0.26,0.022,0.3), '#cfcac0', 0.27,0.022,0.31, { edges:false });
    const wall = pick(R,WALLS), roof = pick(R,ROOFS);
    k.add(box(0.5,0.34,0.5), wall, -0.15,0.17,-0.08);
    gableRoof(k, 0.5, 0.5, 0.25, roof, 0.34, false, -0.15, -0.08, 0.05);
    k.add(box(0.3,0.24,0.42), wall, 0.27,0.12,-0.1);
    flatRoof(k, 0.3, 0.42, 0.24, 0.27, -0.1);
    k.add(box(0.22,0.17,0.02), '#d8d2c4', 0.27,0.09,0.115);
    door(k, -0.15, 0, 0.172);
    windows(k, { W:0.5, D:0.5, cx:-0.15, cz:-0.08, fh:0.34, faces:'fl', skip:(f,i,n)=>n%2&&i===(n>>1), frame:TRIM });
    if (R()<0.6) car(k, 0.27, 0.34, false, R);
  },
  // lojas
  shop(k, R, { W=0.78, D=0.58, H=0.42, wall, awn=['#d9443a','#f6efe4'], sign='#2f6f4f' }){
    k.add(box(0.96,0.022,0.96), '#d8d2c4', 0,0.011,0, { edges:false });
    const cz = -0.1, fz = cz + D/2;
    k.add(box(W,H,D), wall, 0,H/2,cz);
    k.add(box(W*0.72,H*0.42,0.02), GLASS, -W*0.08,H*0.3,fz+0.006, { edges:false });
    door(k, W*0.36, 0, fz+0.004, '#4a3328', 0.11, 0.22);
    const n = 6, sw = W/n;
    for (let i=0;i<n;i++) k.add(box(sw,0.018,0.2), awn[i%2], -W/2+sw*(i+0.5), H*0.66, fz+0.09, { rx:0.4 });
    flatRoof(k, W, D, H, 0, cz);
    k.add(box(W*0.62,0.11,0.03), sign, 0,H+0.1,fz-0.03);
    return { fz, H };
  },
};
const SHOPS = [
  { nome:'Padaria', f(k,R){ const { fz, H } = P.shop(k,R,{ wall:'#f1d9b0', awn:['#8a5a3b','#f6e7cc'], sign:'#8a5a3b' }); k.add(cyl(0.04,0.04,0.18,12), '#e0a35a', 0,H+0.1,fz+0.005, { rz:Math.PI/2 }); } },
  { nome:'Mercadinho', f(k,R){ P.shop(k,R,{ wall:'#f4ecdb', awn:['#3f9a52','#f6efe4'], sign:'#2f6f4f' }); k.add(box(0.14,0.08,0.12), '#e98b2a', -0.28,0.04,0.36); k.add(box(0.14,0.08,0.12), '#7cbf3f', -0.1,0.04,0.36); } },
  { nome:'Farmácia', f(k,R){ const { fz, H } = P.shop(k,R,{ wall:'#f7f7f4', awn:['#3aa36b','#ffffff'], sign:'#ffffff' }); k.add(box(0.05,0.15,0.03), '#3aa36b', 0,H+0.1,fz+0.002); k.add(box(0.15,0.05,0.03), '#3aa36b', 0,H+0.1,fz+0.002); } },
  { nome:'Restaurante', f(k,R){ P.shop(k,R,{ W:0.82, wall:'#e9c9a0', awn:['#b8362e','#f6efe4'], sign:'#b8362e' }); for (const x of [-0.28,0.05]){ k.add(cyl(0.06,0.06,0.015,12), '#ffffff', x,0.08,0.38); k.add(cone(0.13,0.06,10), pick(R,['#b8362e','#f2c14e']), x,0.22,0.38); k.add(cyl(0.008,0.008,0.2,4), '#5c5048', x,0.1,0.38, { edges:false }); } } },
  { nome:'Loja de roupas', f(k,R){ const { fz } = P.shop(k,R,{ wall:pick(R,['#f3cfd8','#d9cdea','#f6e0c8']), awn:['#c74a7a','#ffffff'], sign:'#c74a7a' }); k.add(box(0.03,0.14,0.03), '#f6efe4', -0.18,0.11,fz+0.04); k.add(ball(0.03), '#f6efe4', -0.18,0.2,fz+0.04); } },
  { nome:'Café', f(k,R){ P.shop(k,R,{ W:0.66, D:0.52, H:0.36, wall:'#b98656', awn:['#3a2e28','#e9d9bd'], sign:'#3a2e28' }); k.add(cyl(0.05,0.05,0.015,12), '#ffffff', 0.25,0.08,0.36); k.add(cone(0.12,0.05,10), '#e9d9bd', 0.25,0.2,0.36); k.add(cyl(0.006,0.006,0.18,4), '#5c5048', 0.25,0.09,0.36, { edges:false }); } },
  { nome:'Sorveteria', f(k,R){ const { H } = P.shop(k,R,{ W:0.7, wall:'#bfe6d6', awn:['#f39bb3','#ffffff'], sign:'#f39bb3' }); k.add(cone(0.08,0.22,10), '#e0a35a', 0.2,H+0.17,-0.1, { rx:Math.PI }); k.add(ball(0.09), '#f6c1cf', 0.2,H+0.3,-0.1); } },
  { nome:'Lanchonete', f(k,R){ P.shop(k,R,{ W:0.72, wall:'#f4dc6a', awn:['#d9443a','#f4dc6a'], sign:'#d9443a' }); k.add(cyl(0.012,0.012,0.7,6), '#5c5048', 0.38,0.35,0.38, { edges:false }); k.add(cyl(0.11,0.11,0.03,16), '#d9443a', 0.38,0.72,0.38, { rx:Math.PI/2 }); } },
];

// ============================================================
//  RESIDENCIAL COMUM  (lux: 0 simples, 1 médio, 2 alto padrão)
// ============================================================
function smallHouse(piece){
  return (k,R,fw,fd) => {
    ground(k, fw, fd);
    k.at(0, fd/2-0.5, 0, ()=>P[piece](k,R));
    if (fd > 1) backyard(k, R, fw, -fd/2, fd/2-1);
    if (R()<0.6) fenceLot(k, fw, fd);
    k.floors = piece==='sobrado' ? 2 : 1;
  };
}
const resLow = [
  { nome:'Casa térrea', lux:0, sizes:[[1,1],[1,2]], f:smallHouse('casaTerrea') },
  { nome:'Sobrado', lux:1, sizes:[[1,1],[1,2]], f:smallHouse('sobrado') },
  { nome:'Chalé', lux:1, sizes:[[1,1],[1,2]], f:smallHouse('chale') },
  { nome:'Casa com garagem', lux:1, sizes:[[1,1],[1,2]], f:smallHouse('garagem') },
  { nome:'Casa com varanda', lux:1, sizes:[[1,1],[2,1],[2,2]], f(k,R,fw,fd){
    ground(k, fw, fd);
    const W = fw*0.66, D = 0.42, H = 0.3, cz = fd/2-0.62, wall = pick(R,WALLS), roof = pick(R,ROOFS);
    k.add(box(W,H,D), wall, 0,H/2+0.03,cz);
    k.add(box(W+0.04,0.03,D+0.04), '#cfc6b3', 0,0.015,cz);
    gableRoof(k, W, D, 0.25, roof, H+0.03, true, 0, cz, 0.05);
    const pz = cz + D/2 + 0.1;
    k.add(box(W,0.04,0.2), '#c9a77c', 0,0.02,pz);
    const np = Math.max(3, Math.round(W/0.3)+1);
    for (let i=0;i<np;i++) k.add(box(0.03,0.27,0.03), TRIM, -W/2+0.03+i*(W-0.06)/(np-1),0.17,pz+0.08);
    k.add(box(W+0.06,0.03,0.24), roof, 0,0.32,pz, { rx:-0.12 });
    door(k, 0, 0.03, cz+D/2+0.002);
    windows(k, { W, D, cz, y0:0.03, fh:H, faces:'flr', skip:(f,i,n)=>n%2&&i===(n>>1), frame:TRIM });
    bush(k,-fw/2+0.15,fd/2-0.1,R); bush(k,fw/2-0.15,fd/2-0.1,R);
    if (fd > 1) backyard(k, R, fw, -fd/2, cz-D/2-0.05);
    fenceLot(k, fw, fd);
  }},
  { nome:'Casa moderna', lux:2, sizes:[[1,1],[2,1],[2,2],[3,2]], f(k,R,fw,fd){
    ground(k, fw, fd, '#a6d07a');
    const c1 = pick(R,['#f5f5f2','#e9e6df','#dcd7cf']), c2 = pick(R,['#5d646b','#8a6f5a','#4f6a7a','#b8a58e']);
    const W1 = fw*0.62, D1 = Math.min(fd,1.5)*0.42, cz = fd/2 - 0.2 - D1/2 - 0.12;
    k.add(box(W1,0.3,D1), c1, -fw*0.08,0.15,cz);
    flatRoof(k, W1, D1, 0.3, -fw*0.08, cz, '#f8f6f1', '#d4cfc6');
    const W2 = W1*0.66, D2 = D1*0.86;
    k.add(box(W2,0.26,D2), c2, fw*0.05,0.43,cz-0.04);
    flatRoof(k, W2, D2, 0.56, fw*0.05, cz-0.04, '#f8f6f1', '#d4cfc6');
    k.add(box(W1*0.55,0.2,0.02), GLASS, -fw*0.12,0.13,cz+D1/2+0.006, { edges:false });
    k.add(box(W2*0.7,0.14,0.02), GLASS, fw*0.05,0.45,cz-0.04+D2/2+0.006, { edges:false });
    door(k, -fw*0.08+W1/2-0.1, 0, cz+D1/2+0.002, '#3b3f44');
    k.add(box(0.3,0.022,fd/2-cz-D1/2), '#e5e2dc', fw/2-0.25,0.022,(fd/2+cz+D1/2)/2, { edges:false });
    car(k, fw/2-0.25, fd/2-0.18, false, R);
    if (fw*fd >= 4) pool(k, -fw*0.15, -fd/2+0.35, Math.min(0.9, fw*0.35), 0.3);
    else if (fd > 1) backyard(k, R, fw, -fd/2, cz-D1/2-0.05);
    bush(k,-fw/2+0.15,fd/2-0.12,R); bush(k,-fw/2+0.3,fd/2-0.12,R,0.8);
    k.floors = 2;
  }},
  { nome:'Casas em fileira', lux:0, sizes:[[1,1],[2,1],[3,1],[4,1],[2,2],[3,2]], f(k,R,fw,fd){
    ground(k, fw, fd);
    const n = fw*2, uw = (fw-0.08)/n, cz = fd/2-0.45, roof = pick(R,ROOFS);
    for (let i=0;i<n;i++){
      const x = -fw/2+0.04+uw*(i+0.5), wall = pick(R,WALLS), h = 0.4+R()*0.06;
      k.add(box(uw-0.01,h,0.5), wall, x,h/2,cz);
      k.add(gable(uw+0.01,0.56,0.18), R()<0.7?roof:pick(R,ROOFS), x,h,cz);
      door(k, x+uw*0.2, 0, cz+0.252, DOOR, 0.08, 0.17);
      k.add(box(0.08,0.08,0.02), GLASS, x-uw*0.18,0.15,cz+0.256, { edges:false });
      k.add(box(0.08,0.08,0.02), GLASS, x,0.31,cz+0.256, { edges:false });
      bush(k, x-uw*0.2, fd/2-0.1, R, 0.7);
    }
    if (fd > 1) for (let i=0;i<fw;i++) backyard(k, R, 1, -fd/2, cz-0.3);
    k.floors = 2;
  }},
  { nome:'Chácara', lux:1, capMul:0.4, sizes:[[2,2],[2,3],[3,3]], f(k,R,fw,fd){
    ground(k, fw, fd, '#93c464');
    k.at(-fw/2+0.55, fd/2-0.55, 0, ()=>P.casaTerrea(k,R));
    for (let r=0;r<fd-1;r++) for (let c=0;c<fw;c++) if (!(r===0 && c===0)) addTree(k, -fw/2+0.5+c, fd/2-1.5-r+ (c%2)*0.2, R, 0.8);
    for (let i=0;i<5;i++) k.add(box(0.5,0.05,0.06), i%2?'#5d9a3f':'#8bbf55', fw/2-0.45,0.03,fd/2-0.25-i*0.12);
    k.add(box(0.12,0.022,0.5), '#cdb88f', -fw/2+0.55,0.02,fd/2-0.2, { edges:false });
    fenceLot(k, fw, fd, '#a8774b', 0.08, true);
    k.floors = 1;
  }},
  { nome:'Mansão', lux:2, capMul:0.35, sizes:[[2,2],[3,2],[2,3],[3,3],[4,3],[3,4],[4,4]], f(k,R,fw,fd){
    ground(k, fw, fd, '#8fc45d');
    const wall = pick(R,['#f6efe2','#efe4cf','#e8dcc8','#f2ece6']), roof = pick(R,['#4f5a63','#8f3f35','#5f707b','#7e4b3b']);
    const W = fw*0.55, D = Math.min(fd*0.38, 1.3), H = 0.62, cz = fd/2 - 0.55 - D/2;
    k.add(box(W+0.06,0.06,D+0.06), '#d8cfbc', 0,0.03,cz);
    k.add(box(W,H,D), wall, 0,H/2+0.06,cz);
    k.add(box(W+0.03,0.03,D+0.03), TRIM, 0,0.36,cz);
    k.add(hip(W+0.1, D+0.1, 0.36), roof, 0,H+0.06,cz);
    const ww = W*0.32;
    k.add(box(ww,0.34,D*0.8), wall, -W/2-ww/2+0.02,0.2,cz+0.04);
    k.add(hip(ww+0.08, D*0.8+0.08, 0.2), roof, -W/2-ww/2+0.02,0.37,cz+0.04);
    windows(k, { W, D, cz, y0:0.06, floors:2, fh:0.3, ww:0.1, wh:0.15, frame:'#ffffff', skip:(f,i,n)=>f===0&&i===(n>>1) });
    for (let i=0;i<4;i++) k.add(cyl(0.025,0.025,0.56,10), '#fbf7ee', -0.21+i*0.14,0.34,cz+D/2+0.12);
    k.add(box(0.56,0.04,0.2), wall, 0,0.64,cz+D/2+0.1);
    k.add(gable(0.6,0.2,0.12), wall, 0,0.66,cz+D/2+0.1);
    door(k, 0, 0.06, cz+D/2+0.004, '#5b3a2c', 0.14, 0.26);
    // garagem
    const gx = W/2 + 0.32;
    if (gx + 0.25 < fw/2){ k.add(box(0.42,0.26,0.4), wall, gx,0.13,cz+D/2-0.2); flatRoof(k, 0.42, 0.4, 0.26, gx, cz+D/2-0.2); k.add(box(0.34,0.18,0.02), '#d8d2c4', gx,0.1,cz+D/2+0.006); car(k, gx, fd/2-0.3, false, R); }
    // entrada e jardim
    k.add(box(0.22,0.022,fd/2-cz-D/2), '#e3d3ad', 0,0.022,(fd/2+cz+D/2)/2, { edges:false });
    if (fw*fd >= 9){ k.add(cyl(0.18,0.2,0.07,16), '#cfc8b8', 0,0.05,fd/2-0.4); k.add(cyl(0.15,0.15,0.02,16), WATER, 0,0.09,fd/2-0.4, { edges:false }); }
    pool(k, fw*0.12, -fd/2 + Math.min(0.6, (fd/2+cz-D/2)/2+0.1), Math.min(1.0, fw*0.32), Math.min(0.45, (fd/2+cz-D/2)*0.5));
    for (let i=0;i<fw;i++) addTree(k, -fw/2+0.3+i*(fw-0.6)/Math.max(1,fw-1), -fd/2+0.22, R, 0.8);
    for (let i=0;i<Math.max(2,fw);i++) bush(k, -fw/2+0.15+i*0.18, fd/2-0.12, R, 0.9);
    fenceLot(k, fw, fd, '#ffffff', 0.1, true);
    for (const x of [-0.2,0.2]) k.add(box(0.05,0.16,0.05), '#e6dccb', x,0.08,fd/2-0.03);
    k.floors = 2;
  }},
  { nome:'Condomínio de casas', lux:1, capMul:0.8, sizes:[[3,3],[4,3],[3,4],[4,4]], f(k,R,fw,fd){
    ground(k, fw, fd, '#a6d07a');
    k.add(box(0.36,0.024,fd-0.1), '#8a8d92', 0,0.012,0, { edges:false });
    const pieces = ['casaTerrea','sobrado','garagem','casaTerrea'];
    for (let r=0;r<fd-1;r++){
      for (const s of [-1,1]){
        const x = s*(fw/2-0.5);
        if (Math.abs(x) < 0.55) continue;
        k.at(x, fd/2-1.5-r, s<0 ? Math.PI/2 : -Math.PI/2, ()=>P[pick(R,pieces)](k,R));
      }
    }
    k.add(box(0.2,0.22,0.2), '#e6dccb', 0.32,0.11,fd/2-0.2); flatRoof(k, 0.2, 0.2, 0.22, 0.32, fd/2-0.2);
    k.add(box(0.36,0.03,0.02), '#d9443a', 0,0.16,fd/2-0.05);
    addTree(k, 0, -fd/2+0.35, R, 0.9);
    fenceLot(k, fw, fd, '#d8cfbc', 0.14, true);
    k.floors = 2;
  }},
];

// ============================================================
//  RESIDENCIAL ALTA DENSIDADE
// ============================================================
const resHigh = [
  { nome:'Prédio de tijolos', lux:0, sizes:[[1,1],[2,1],[2,2]], f(k,R,fw,fd){
    ground(k, fw, fd, '#cfc9bb');
    const fl = rint(R,4,6), fh = 0.26, W = fw-0.2, D = fd-0.3, H = fl*fh, c = pick(R,BRICK), cz = -0.04;
    k.add(box(W,H,D), c, 0,H/2,cz);
    k.add(box(W+0.03,0.05,D+0.03), '#e9dcc4', 0,H+0.025,cz);
    k.add(box(W+0.02,0.03,D+0.02), '#e9dcc4', 0,fh,cz);
    windows(k, { W, D, cz, floors:fl, fh, ww:0.1, wh:0.13, frame:'#f3ead6', skip:(f,i,n)=>f===0&&i===(n>>1) });
    door(k, 0, 0, cz+D/2+0.002, '#4a3328', 0.16, 0.2);
    const y = H+0.05;
    for (let t=0; t<fw; t++){ const x = -W/2+0.25+t; k.add(cyl(0.09,0.09,0.14,12), '#a37b5a', x,y+0.12,-D/4); k.add(cone(0.1,0.06,12), '#6b5446', x,y+0.22,-D/4); }
    k.floors = fl;
  }},
  { nome:'Edifício residencial', lux:1, sizes:[[1,1],[2,1],[2,2]], f(k,R,fw,fd){
    ground(k, fw, fd, '#d7d2c8');
    const fl = rint(R,6,10), fh = 0.24, W = fw-0.26, D = fd-0.34, H = fl*fh, cz = -0.05;
    const c = pick(R,['#f2f0ea','#e8e2d6','#dfe6ea','#efe4d2']), acc = pick(R,['#5f8fb8','#c4552f','#5aa36b','#8a6f5a']);
    k.add(box(W,H,D), c, 0,H/2,cz);
    k.add(box(0.2,H+0.02,0.02), acc, -W/2+0.1,H/2,cz+D/2+0.006, { edges:false });
    windows(k, { W, D, cz, floors:fl, fh, ww:0.1, wh:0.12, faces:'blr' });
    windows(k, { W:W-0.2, D, cx:0.1, cz, floors:fl, fh, ww:0.1, wh:0.12, faces:'f' });
    for (let f=1; f<fl; f++){ k.add(box(W*0.45,0.025,0.1), '#ffffff', W*0.15,f*fh,cz+D/2+0.05); k.add(box(W*0.45,0.06,0.01), GLASS, W*0.15,f*fh+0.04,cz+D/2+0.1, { edges:false }); }
    flatRoof(k, W, D, H, 0, cz);
    k.add(box(0.18,0.1,0.16), '#bfb8aa', -W/4,H+0.1,cz-D/4);
    door(k, -W/2+0.1, 0, cz+D/2+0.008, '#3b3f44', 0.14, 0.18);
    bush(k,-fw/2+0.12,fd/2-0.1,R); bush(k,fw/2-0.12,fd/2-0.1,R);
    k.floors = fl;
  }},
  { nome:'Prédio clássico', lux:1, sizes:[[1,1],[2,1],[3,1],[2,2]], f(k,R,fw,fd){
    ground(k, fw, fd, '#d9d2c0');
    const fl = rint(R,4,5), fh = 0.27, W = fw-0.18, D = fd-0.28, H = fl*fh, cz = -0.04, c = pick(R,['#f1e3c4','#e9d2b0','#f3e9d9','#dfe3d6']);
    k.add(box(W+0.02,fh,D+0.02), '#bfae92', 0,fh/2,cz);
    k.add(box(W,H-fh,D), c, 0,fh+(H-fh)/2,cz);
    k.add(box(W+0.05,0.04,D+0.05), TRIM, 0,H,cz);
    k.add(gable(D+0.04, W+0.04, 0.24), '#4f5a63', 0,H+0.02,cz, { ry:Math.PI/2 });
    for (let i=0;i<fw*2;i++){ const x = -W/2+(i+0.5)*W/(fw*2); k.add(box(0.12,0.12,0.1), '#4f5a63', x,H+0.08,cz+D/2-0.12); k.add(box(0.07,0.07,0.02), GLASS, x,H+0.08,cz+D/2-0.065, { edges:false }); }
    windows(k, { W, D, cz, y0:fh, floors:fl-1, fh, ww:0.09, wh:0.15, frame:'#ffffff' });
    const nd = fw*3; for (let i=0;i<nd;i++) k.add(box(0.16,0.16,0.02), i===(nd>>1)?'#4a3328':GLASS, -W/2+(i+0.5)*W/nd,0.1,cz+D/2+0.012, { edges:false });
    k.floors = fl;
  }},
  { nome:'Torre residencial', lux:2, sizes:[[1,1],[2,2]], f(k,R,fw,fd){
    ground(k, fw, fd, '#d4cfc4'); bush(k,-fw/2+0.12,fd/2-0.12,R); addTree(k,fw/2-0.15,fd/2-0.15,R,0.6);
    const c = pick(R,['#e6e9ec','#f0ebe2','#dce4e9']), g = pick(R,[GLASS,'#9cc7d9','#b5d8e3']), s = Math.min(fw,fd);
    const parts = [[0.78*s,4],[0.6*s,4],[0.42*s,rint(R,2,4)]]; let y = 0, fl = 0;
    for (const [w,n] of parts){ const h = n*0.24; k.add(box(w,h,w), c, 0,y+h/2,-0.04); windows(k, { W:w, D:w, cz:-0.04, y0:y, floors:n, fh:0.24, ww:0.11, wh:0.13, color:g }); k.add(box(w+0.04,0.03,w+0.04), '#bfc7cc', 0,y+h,-0.04); y += h; fl += n; }
    k.add(cyl(0.008,0.008,0.35,4), '#5c5048', 0,y+0.17,-0.04);
    k.floors = fl;
  }},
  { nome:'Conjunto habitacional', lux:0, sizes:[[2,3],[3,3],[4,3],[3,4],[4,4]], f(k,R,fw,fd){
    ground(k, fw, fd, '#a9cf7c');
    const fl = rint(R,4,5), fh = 0.25, H = fl*fh, nb = fw >= 3 ? 2 : 1, c = pick(R,['#efe4cf','#e6d7c3','#dfe3d6','#f0d9c4']);
    const bw = 0.75, bd = fd-0.5;
    for (let i=0;i<nb;i++){
      const x = nb===1 ? -fw/2+0.55 : (i===0 ? -fw/2+0.5 : fw/2-0.5);
      k.add(box(bw,H,bd), c, x,H/2,0);
      windows(k, { W:bw, D:bd, cx:x, floors:fl, fh, ww:0.09, wh:0.12 });
      flatRoof(k, bw, bd, H, x, 0);
      k.add(box(0.04,H,bd+0.01), pick(R,['#c4552f','#3f7fc4','#5aa36b']), x+(i?-1:1)*bw/2,H/2,0, { edges:false });
    }
    const px = nb===1 ? 0.45 : 0;
    k.add(box(0.7,0.02,0.7), '#e3d3ad', px,0.02,0, { edges:false });
    k.add(box(0.3,0.15,0.04), '#d9443a', px-0.1,0.1,0.1); k.add(box(0.04,0.2,0.04), '#3f7fc4', px+0.18,0.1,-0.12);
    addTree(k, px, fd/2-0.4, R, 0.8); addTree(k, px, -fd/2+0.4, R, 0.8);
    k.floors = fl;
  }},
  { nome:'Bloco com pátio', lux:1, sizes:[[3,3],[4,3],[3,4],[4,4]], f(k,R,fw,fd){
    ground(k, fw, fd, '#d7d2c8');
    const fl = rint(R,5,7), fh = 0.25, H = fl*fh, t = 0.7, c = pick(R,['#f1e3c4','#dfe3e8','#efe0d0','#e6e2da']), cz = -0.05;
    const W = fw-0.2, D = fd-0.3;
    k.add(box(W,H,t), c, 0,H/2,cz+D/2-t/2);
    k.add(box(t,H,D-t), c, -W/2+t/2,H/2,cz-t/2);
    k.add(box(t,H,D-t), c, W/2-t/2,H/2,cz-t/2);
    windows(k, { W, D:t, cz:cz+D/2-t/2, floors:fl, fh, ww:0.1, wh:0.13, faces:'fb' });
    windows(k, { W:t, D:D-t, cx:-W/2+t/2, cz:cz-t/2, floors:fl, fh, ww:0.1, wh:0.13, faces:'lr' });
    windows(k, { W:t, D:D-t, cx:W/2-t/2, cz:cz-t/2, floors:fl, fh, ww:0.1, wh:0.13, faces:'lr' });
    flatRoof(k, W, t, H, 0, cz+D/2-t/2); flatRoof(k, t, D-t, H, -W/2+t/2, cz-t/2); flatRoof(k, t, D-t, H, W/2-t/2, cz-t/2);
    k.add(box(W*0.5,fh*0.8,0.02), '#4a3328', 0,fh*0.4,cz+D/2+0.006, { edges:false });
    addTree(k, 0, cz-0.3, R, 1.0); addTree(k, -0.5, -fd/2+0.4, R, 0.7); addTree(k, 0.5, -fd/2+0.4, R, 0.7);
    k.floors = fl;
  }},
];

// ============================================================
//  COMERCIAL COMUM
// ============================================================
const comLow = [
  ...SHOPS.map(s => ({ nome:s.nome, lux:1, sizes:[[1,1]], f(k,R,fw,fd){ k.at(0,0,0,()=>s.f(k,R)); } })),
  { nome:'Galeria de lojas', lux:1, sizes:[[2,1],[3,1],[4,1]], f(k,R,fw,fd){
    for (let i=0;i<fw;i++) k.at(-fw/2+0.5+i, 0, 0, ()=>pick(R,SHOPS).f(k,R));
  }},
  { nome:'Supermercado', lux:1, sizes:[[2,2],[3,2],[2,3],[3,3]], f(k,R,fw,fd){
    ground(k, fw, fd, '#d8d2c4');
    const W = fw-0.2, D = Math.min(fd*0.55, 1.6), H = 0.5, cz = -fd/2+0.1+D/2, c = pick(R,['#f4ecdb','#eef0f2']), band = pick(R,['#d9443a','#3f9a52','#f2b33d']);
    k.add(box(W,H,D), c, 0,H/2,cz);
    k.add(box(W+0.01,0.1,D+0.01), band, 0,H-0.08,cz);
    k.add(box(W*0.6,0.2,0.02), GLASS, 0,0.12,cz+D/2+0.006, { edges:false });
    k.add(box(W*0.7,0.03,0.16), band, 0,0.26,cz+D/2+0.08);
    flatRoof(k, W, D, H, 0, cz);
    k.add(box(0.7,0.16,0.04), '#ffffff', 0,H+0.1,cz+D/2-0.05);
    parking(k, 0, (cz+D/2+fd/2)/2+0.05, W, fd/2-cz-D/2-0.15, R);
    for (let i=0;i<3;i++) k.add(box(0.12,0.08,0.18), '#c9d2d6', W/2-0.15,0.05,cz+D/2+0.15+i*0.02);
  }},
  { nome:'Posto de gasolina', lux:1, sizes:[[2,1],[2,2]], f(k,R,fw,fd){
    ground(k, fw, fd, '#cfcac0');
    const cz = fd/2-0.5;
    for (const x of [-0.45,0.45]) for (const z of [-0.2,0.2]) k.add(box(0.04,0.36,0.04), '#f2f0ea', x,0.18,cz+z);
    k.add(box(1.2,0.06,0.62), '#d9443a', 0,0.39,cz); k.add(box(1.22,0.03,0.64), '#ffffff', 0,0.35,cz);
    for (const x of [-0.25,0.25]){ k.add(box(0.08,0.14,0.06), '#f2f0ea', x,0.07,cz); k.add(box(0.06,0.04,0.065), '#d9443a', x,0.11,cz); }
    car(k, -0.25, cz+0.15, false, R); car(k, 0.25, cz-0.12, false, R);
    const sz = fd > 1 ? -fd/2+0.45 : cz-0.32; const sx = fd > 1 ? 0 : fw/2-0.25;
    k.add(box(fd>1?0.8:0.36,0.28,0.4), '#f4ecdb', sx,0.14,sz); flatRoof(k, fd>1?0.8:0.36, 0.4, 0.28, sx, sz);
    k.add(box(0.06,0.6,0.06), '#5c5048', fw/2-0.12,0.3,fd/2-0.12); k.add(box(0.22,0.2,0.04), '#d9443a', fw/2-0.12,0.62,fd/2-0.12);
  }},
];

// ============================================================
//  COMERCIAL ALTA DENSIDADE
// ============================================================
const comHigh = [
  { nome:'Torre de escritórios', lux:2, sizes:[[1,1],[2,1],[2,2]], f(k,R,fw,fd){
    ground(k, fw, fd, '#d6d3cc');
    const fl = rint(R,7,15), fh = 0.22, W = fw-0.28, D = fd-0.28, H = fl*fh, g = pick(R,['#7fb6d1','#6fa3c4','#8fc3cf','#7aa6b8']);
    k.add(box(W,H,D), g, 0,H/2,-0.04);
    for (let f=0; f<=fl; f++) k.add(box(W+0.02,0.03,D+0.02), '#eef2f3', 0,f*fh,-0.04);
    for (const x of [-W/2,W/2]) for (const z of [-D/2,D/2]) k.add(box(0.04,H,0.04), '#dfe5e8', x,H/2,-0.04+z, { edges:false });
    k.add(box(W*0.4,0.12,D*0.35), '#bfc7cc', 0.1,H+0.06,-0.1);
    if (fl > 11) k.add(cyl(0.01,0.01,0.5,4), '#5c5048', -W/4,H+0.25,-0.1);
    k.add(box(0.24,0.03,0.16), '#3b3f44', 0,0.2,D/2+0.04);
    door(k, 0, 0, D/2-0.04+0.004, '#3b3f44', 0.18, 0.16);
    k.floors = fl;
  }},
  { nome:'Banco', lux:2, sizes:[[1,1],[2,1],[2,2]], f(k,R,fw,fd){
    ground(k, fw, fd, '#e0d6c0');
    const W = fw-0.16, D = fd-0.34, H = 0.62, c = '#efe6d2', cz = -0.08;
    k.add(box(W+0.06,0.06,D+0.06), '#cfc6b3', 0,0.03,cz+0.02);
    k.add(box(W,H,D), c, 0,H/2+0.06,cz);
    const nc = fw*4+1; for (let i=0;i<nc;i++) k.add(cyl(0.028,0.028,H-0.08,10), '#fbf7ee', -W/2+0.08+i*(W-0.16)/(nc-1),H/2+0.02,cz+D/2+0.07);
    k.add(box(W,0.06,0.12), c, 0,H,cz+D/2+0.05);
    k.add(gable(W+0.02,0.14,0.16), c, 0,H+0.03,cz+D/2+0.05);
    k.add(box(0.16,0.24,0.02), '#4a3328', 0,0.18,cz+D/2+0.006);
    windows(k, { W, D, cz, y0:0.06, floors:2, fh:0.28, faces:'lr', frame:'#ffffff' });
    flatRoof(k, W, D, H+0.06, 0, cz, c);
    k.floors = 3;
  }},
  { nome:'Hotel', lux:2, sizes:[[1,1],[2,1],[2,2]], f(k,R,fw,fd){
    ground(k, fw, fd, '#d9d2c4');
    const fl = rint(R,6,9), fh = 0.24, W = fw-0.24, D = fd-0.4, H = fl*fh, cz = -0.1, c = pick(R,['#f3e6c8','#e6d3c2','#dfe3e8']);
    k.add(box(W,H,D), c, 0,H/2,cz);
    windows(k, { W, D, cz, y0:fh, floors:fl-1, fh, ww:0.1, wh:0.13 });
    k.add(box(W,fh,0.02), GLASS, 0,fh/2,cz+D/2+0.006, { edges:false });
    k.add(box(0.4,0.03,0.24), '#b8362e', 0,0.22,fd/2-0.2);
    k.add(box(0.06,H*0.6,0.16), '#b8362e', W/2+0.03,H*0.6,cz+D/2-0.1);
    flatRoof(k, W, D, H, 0, cz);
    if (fw*fd >= 4) pool(k, 0, -fd/2+0.2, W*0.5, 0.2);
    k.floors = fl;
  }},
  { nome:'Loja de departamentos', lux:1, sizes:[[2,1],[2,2],[3,2],[2,3]], f(k,R,fw,fd){
    ground(k, fw, fd, '#d8d2c4');
    const W = fw-0.12, D = fd-0.24, H = 0.66+(fd>1?0.2:0), cz = -0.06, c = pick(R,['#f4ecdb','#e9e2d6']), band = pick(R,['#d9443a','#3f7fc4','#f2b33d','#3aa36b']);
    k.add(box(W,H,D), c, 0,H/2,cz);
    k.add(box(W+0.01,0.12,D+0.01), band, 0,H-0.1,cz);
    k.add(box(W*0.84,0.2,0.02), GLASS, 0,0.14,cz+D/2+0.006, { edges:false });
    k.add(box(W*0.84,0.16,0.02), GLASS, 0,0.42,cz+D/2+0.006, { edges:false });
    k.add(box(W*0.9,0.03,0.14), band, 0,0.28,cz+D/2+0.06);
    flatRoof(k, W, D, H, 0, cz);
    k.floors = 3;
  }},
  { nome:'Prédio misto', lux:1, sizes:[[1,1],[2,1],[3,1]], f(k,R,fw,fd){
    ground(k, fw, fd, '#d8d2c4');
    const fl = 5, fh = 0.25, W = fw-0.2, D = fd-0.3, H = fl*fh, cz = -0.06, c = pick(R,WALLS), awn = pick(R,[['#d9443a','#fff'],['#3f7fc4','#fff'],['#3f9a52','#fff']]);
    k.add(box(W,fh,D), '#e9e2d6', 0,fh/2,cz);
    k.add(box(W*0.8,fh*0.6,0.02), GLASS, 0,fh*0.4,cz+D/2+0.006, { edges:false });
    const n = fw*6; for (let i=0;i<n;i++) k.add(box(W/n,0.018,0.16), awn[i%2], -W/2+W/n*(i+0.5), fh*0.9, cz+D/2+0.06, { rx:0.4 });
    k.add(box(W,H-fh,D), c, 0,fh+(H-fh)/2,cz);
    windows(k, { W, D, cz, y0:fh, floors:fl-1, fh, ww:0.1, wh:0.13, frame:TRIM });
    flatRoof(k, W, D, H, 0, cz);
    k.floors = fl;
  }},
  { nome:'Shopping', lux:2, sizes:[[3,3],[4,3],[3,4],[4,4]], f(k,R,fw,fd){
    ground(k, fw, fd, '#d8d2c4');
    const W = fw-0.3, D = fd*0.6, H = 0.8, cz = -fd/2+0.15+D/2, c = pick(R,['#f2ede4','#e9e6df']), acc = pick(R,['#3f7fc4','#d9443a','#5aa36b']);
    k.add(box(W,H,D), c, 0,H/2,cz);
    k.add(box(W+0.01,0.08,D+0.01), acc, 0,H-0.12,cz);
    k.add(box(W*0.3,0.5,0.03), GLASS, 0,0.25,cz+D/2+0.01, { edges:false });
    k.add(box(W*0.34,0.06,0.3), acc, 0,0.52,cz+D/2+0.12);
    flatRoof(k, W, D, H, 0, cz);
    k.add(dome(Math.min(W,D)*0.18), '#a9d6e8', 0,H+0.04,cz);
    for (const s of [-1,1]) k.add(box(W*0.25,0.3,D*0.6), c, s*W*0.3,H+0.15,cz);
    k.add(box(1.0,0.2,0.05), '#ffffff', 0,H+0.14,cz+D/2-0.05);
    parking(k, 0, (cz+D/2+fd/2)/2, W, fd/2-cz-D/2-0.12, R);
    k.floors = 3;
  }},
];

// ============================================================
//  INDUSTRIAL COMUM
// ============================================================
const concrete = (k, fw, fd) => ground(k, fw, fd, '#bdb7a9');
function crates(k,R,x,z,n=3){ for (let i=0;i<n;i++) k.add(box(0.12,0.1,0.12), '#c49a5a', x+(i%2)*0.13, 0.05+(i>1?0.1:0), z, { ry:R()*0.4 }); }
const indLow = [
  { nome:'Galpão', sizes:[[1,1],[1,2],[2,1],[2,2],[2,3]], f(k,R,fw,fd){
    concrete(k, fw, fd);
    const c = pick(R,['#a9b6bd','#c7bfae','#9fb0a0']), W = fw-0.24, D = fd-0.3, r = W/2;
    k.add(box(W,0.2,D), c, 0,0.1,-0.08);
    k.add(halfCyl(r,D), pick(R,['#7b8794','#8c939a','#b0623d']), 0,0.2,-0.08, { rx:Math.PI/2, rz:Math.PI/2 });
    k.add(box(Math.min(0.5,W*0.4),0.26,0.02), '#5c6670', 0,0.13,-0.08+D/2+0.006);
    crates(k,R,W/2-0.15,fd/2-0.12,2);
  }},
  { nome:'Oficina', sizes:[[1,1],[2,1]], f(k,R,fw,fd){
    concrete(k, fw, fd);
    const c = pick(R,['#e7d7b8','#d9cfc0','#cfd8dc']), W = fw-0.14;
    k.add(box(W,0.34,0.6), c, 0,0.17,-0.1);
    flatRoof(k, W, 0.6, 0.34, 0, -0.1, '#9aa3aa', '#8a9399');
    const n = fw*2; for (let i=0;i<n;i++){ const x = -W/2+(i+0.5)*W/n; k.add(box(0.3*Math.min(1,W/(n*0.4)),0.24,0.02), '#8a9399', x,0.12,0.205); }
    k.add(box(Math.min(0.4,W*0.5),0.08,0.03), '#f2b33d', 0,0.4,0.18);
    for (let i=0;i<3;i++) k.add(cyl(0.05,0.05,0.035,12), '#2f2f33', fw/2-0.14,0.02+i*0.036,0.36);
  }},
  { nome:'Depósito', sizes:[[1,1],[2,1],[2,2]], f(k,R,fw,fd){
    concrete(k, fw, fd);
    const c = pick(R,['#c9d2d6','#d8cdb8','#b9c4b0']), W = fw-0.3, D = fd*0.55;
    const cz = -fd/2+0.1+D/2;
    k.add(box(W,0.36,D), c, -0.06,0.18,cz);
    k.add(shed(D+0.02,W+0.02,0.1), '#7b8794', -0.06,0.36,cz, { ry:Math.PI/2 });
    k.add(box(Math.min(0.5,W*0.4),0.24,0.02), '#5c6670', -0.06,0.12,cz+D/2+0.006);
    crates(k,R,W/2-0.1,fd/2-0.2,4); crates(k,R,-W/2+0.05,fd/2-0.2,2);
    k.add(box(0.1,0.08,0.16), '#f2b33d', 0.1,0.06,fd/2-0.25);
  }},
  { nome:'Marcenaria', sizes:[[1,1],[2,1],[2,2]], f(k,R,fw,fd){
    concrete(k, fw, fd);
    const W = fw*0.6, D = fd*0.5, cz = -fd/2+0.1+D/2;
    k.add(box(W,0.32,D), '#c79a68', -fw*0.1,0.16,cz);
    gableRoof(k, W, D, 0.2, '#5b3a2c', 0.32, true, -fw*0.1, cz, 0.05);
    k.add(box(0.22,0.22,0.02), '#6b4a35', -fw*0.1,0.11,cz+D/2+0.006);
    const px = fw/2-0.3;
    for (let r=0;r<2;r++) for (let i=0;i<4-r;i++) k.add(cyl(0.035,0.035,0.34,8), '#8a6646', px-0.1+i*0.072+r*0.036, 0.035+r*0.065, fd/2-0.2, { rz:Math.PI/2, ry:Math.PI/2 });
  }},
  { nome:'Serralheria', sizes:[[1,1],[2,1]], f(k,R,fw,fd){
    concrete(k, fw, fd);
    const W = fw-0.24;
    k.add(box(W,0.3,0.56), '#9aa7ad', 0,0.15,-0.14);
    flatRoof(k, W, 0.56, 0.3, 0, -0.14, '#7b8794', '#6e777d');
    k.add(box(0.3,0.22,0.02), '#3b3f44', -W/4,0.11,0.146);
    k.add(cyl(0.035,0.04,0.3,10), '#6e777d', W/2-0.15,0.45,-0.25);
    for (let i=0;i<4;i++) k.add(box(0.36,0.02,0.025), '#7a8086', W/4,0.012+i*0.022,0.34);
    k.addSmoke(W/2-0.15,0.66,-0.25);
  }},
];

// ============================================================
//  INDUSTRIAL ALTA DENSIDADE
// ============================================================
const indHigh = [
  { nome:'Fábrica', sizes:[[1,1],[2,1],[2,2],[3,2],[3,3],[4,3],[4,4]], f(k,R,fw,fd){
    concrete(k, fw, fd);
    const c = pick(R,['#d9c8a6','#c9c2b4','#cfd2c8']), W = fw-0.16, D = fd*0.68, H = 0.48 + 0.08*Math.min(fw,fd), cz = -fd/2+0.08+D/2;
    k.add(box(W,H,D), c, 0,H/2,cz);
    const n = Math.max(2, Math.round(W/0.3)); for (let i=0;i<n;i++) k.add(shed(W/n,D+0.02,0.14), '#7b8794', -W/2+W/n*(i+0.5),H,cz);
    const nd = Math.max(1, fw); for (let i=0;i<nd;i++) k.add(box(0.2,0.2,0.02), '#5c6670', -W/2+(i+0.5)*W/nd,0.1,cz+D/2+0.006);
    const nch = Math.max(1, Math.min(3, Math.floor(fw*fd/3)));
    for (let i=0;i<nch;i++){
      const x = W/2-0.12-i*0.22, h = H+0.45+i*0.12, zc = -fd/2+0.2;
      k.add(cyl(0.05,0.065,h,12), '#b54a35', x,h/2,zc); k.add(cyl(0.056,0.056,0.06,12), '#f2ede4', x,h-0.1,zc);
      k.addSmoke(x,h+0.04,zc);
    }
    if (fd > 1) for (let i=0;i<fw;i++) if (R()<0.6) truck(k, -W/2+0.2+i*0.9, fd/2-0.3, R);
    k.floors = 2;
  }},
  { nome:'Tanques', sizes:[[1,1],[2,2],[3,2],[3,3]], f(k,R,fw,fd){
    concrete(k, fw, fd);
    for (let i=0;i<fw;i++) for (let j=0;j<fd;j++){
      const x = -fw/2+0.5+i, z = -fd/2+0.5+j, r = 0.26+R()*0.08, h = 0.34+R()*0.3;
      if (fw*fd > 1 && i===fw-1 && j===fd-1){ k.add(box(0.5,0.3,0.4), '#a9b6bd', x,0.15,z); flatRoof(k, 0.5, 0.4, 0.3, x, z); continue; }
      k.add(cyl(r,r,h,18), pick(R,['#e9e6df','#dfe5e8','#f2ede4']), x,h/2,z);
      k.add(dome(r), '#cfd3d6', x,h,z);
      k.add(box(0.02,h,0.02), '#d9443a', x+r,h/2,z, { edges:false });
    }
    if (fw > 1) k.add(cyl(0.025,0.025,fw-0.4,8), '#7a8086', 0,0.3,0, { rz:Math.PI/2 });
  }},
  { nome:'Armazém logístico', sizes:[[2,1],[2,2],[3,2],[3,3],[4,3]], f(k,R,fw,fd){
    concrete(k, fw, fd);
    const c = pick(R,['#c7ccd0','#d6cfbf','#b7c3c9']), W = fw-0.14, D = fd*0.62, H = 0.62, cz = -fd/2+0.08+D/2;
    k.add(box(W,H,D), c, 0,H/2,cz);
    const nr = Math.round(W/0.13); for (let i=0;i<nr;i++) k.add(box(0.02,H,0.02), '#9aa3aa', -W/2+i*W/nr,H/2,cz+D/2+0.006, { edges:false });
    const nd = Math.max(2, fw*2-1);
    for (let i=0;i<nd;i++){ const x = -W/2+(i+0.5)*W/nd; k.add(box(0.18,0.18,0.02), '#5c6670', x,0.09,cz+D/2+0.012); k.add(box(0.2,0.03,0.1), '#f2b33d', x,0.2,cz+D/2+0.06); }
    flatRoof(k, W, D, H, 0, cz, '#9aa3aa', '#8a9399');
    for (let i=0;i<nd;i++) if (R()<0.55) truck(k, -W/2+(i+0.5)*W/nd, cz+D/2+0.33, R);
  }},
  { nome:'Usina', sizes:[[2,2],[3,3]], f(k,R,fw,fd){
    concrete(k, fw, fd);
    const s = fw/2;
    k.add(box(0.5*s,0.5,0.5*s), '#cfc6b3', -0.18*s,0.25,-0.18*s);
    flatRoof(k, 0.5*s, 0.5*s, 0.5, -0.18*s, -0.18*s, '#9aa3aa', '#8a9399');
    k.add(cyl(0.16*s,0.2*s,0.62*s,18), '#e6e2da', 0.24*s,0.31*s,0.2*s);
    k.add(cyl(0.165*s,0.165*s,0.05,18), '#d9443a', 0.24*s,0.55*s,0.2*s);
    k.add(cyl(0.05,0.06,1.0*s,12), '#8c939a', 0.25*s,0.5*s,-0.3*s);
    k.addSmoke(0.24*s,0.68*s,0.2*s); k.addSmoke(0.25*s,1.04*s,-0.3*s);
  }},
];

export const ZONE_MODELS = { res:[resLow, resHigh], com:[comLow, comHigh], ind:[indLow, indHigh] };

// ============================================================
//  ESPECIAIS
// ============================================================
export function prefeitura(k, R, s){
  ground(k, s, s, '#e3d8c2', 0.012);
  const W = s*0.72, D = s*0.36, H = 0.5 + s*0.06, cz = -s*0.1;
  k.add(box(W+0.1,0.1,D+0.1), '#d3c9b4', 0,0.05,cz);
  k.add(box(W,H,D), '#f3ead6', 0,H/2+0.1,cz);
  windows(k, { W, D, cz, y0:0.1, floors:2, fh:H/2, ww:0.09, wh:0.15, faces:'lrb', frame:'#ffffff' });
  const nwin = Math.round(W/0.3); for (let i=0;i<nwin;i++){ const x = -W/2+(i+0.5)*W/nwin; if (Math.abs(x) > 0.35+s*0.05) for (const f of [0,1]) k.add(box(0.09,0.15,0.02), GLASS, x,0.1+H/4+f*H/2,cz+D/2+0.006, { edges:false }); }
  const pw = 0.6 + s*0.12, nc = 4 + s;
  for (let i=0;i<nc;i++) k.add(cyl(0.03,0.03,H-0.04,12), '#fbf7ee', -pw/2+0.05+i*(pw-0.1)/(nc-1),H/2+0.08,cz+D/2+0.14);
  k.add(box(pw+0.06,0.07,0.26), '#f6efe0', 0,H+0.1,cz+D/2+0.12);
  k.add(gable(pw+0.1,0.26,0.16+s*0.02), '#f6efe0', 0,H+0.135,cz+D/2+0.12);
  k.add(box(0.2,0.3,0.02), '#5b3a2c', 0,0.25,cz+D/2+0.006);
  for (let i=0;i<3;i++) k.add(box(pw-i*0.06,0.04,0.12), '#d8cfbc', 0,0.02+i*0.04,cz+D/2+0.34-i*0.08);
  flatRoof(k, W, D, H+0.1, 0, cz, '#e6dcc6', '#d8cfbc');
  if (s >= 3){ // alas laterais
    for (const sx of [-1,1]){ const ww = s*0.16; k.add(box(ww,H*0.7,D*1.3), '#efe3cc', sx*(W/2+ww/2),H*0.35+0.1,cz+D*0.15); flatRoof(k, ww, D*1.3, H*0.7+0.1, sx*(W/2+ww/2), cz+D*0.15, '#e6dcc6', '#d8cfbc'); }
  }
  const th = 0.36 + (s>=4 ? 0.5 : 0);
  k.add(box(0.36,th,0.36), '#f3ead6', 0,H+0.1+th/2,cz);
  k.add(cyl(0.11,0.11,0.02,20), '#ffffff', 0,H+0.1+th-0.15,cz+0.19, { rx:Math.PI/2 });
  k.add(box(0.012,0.08,0.01), INK, 0,H+0.1+th-0.13,cz+0.205, { edges:false });
  const dy = H+0.1+th;
  k.add(cyl(0.2,0.2,0.05,20), '#e6dcc6', 0,dy+0.025,cz);
  k.add(dome(0.19 + (s>=5?0.06:0)), '#5f8fb8', 0,dy+0.05,cz);
  k.add(cone(0.03,0.14,8), '#d4af37', 0,dy+0.3+(s>=5?0.06:0),cz);
  k.add(cyl(0.008,0.008,0.9,6), '#8c939a', s/2-0.25,0.45,s/2-0.25, { edges:false });
  k.add(box(0.22,0.13,0.01), '#3f7fc4', s/2-0.14,0.82,s/2-0.25);
  // jardins e praça cívica
  const gz = s/2 - 0.4;
  for (const sx of [-1,1]) k.add(box(s*0.3,0.03,0.5), '#86c05a', sx*s*0.3,0.025,gz, { edges:false });
  if (s >= 5){ k.add(cyl(0.3,0.32,0.08,20), '#cfc8b8', 0,0.05,s/2-0.45); k.add(cyl(0.26,0.26,0.02,20), WATER, 0,0.1,s/2-0.45, { edges:false }); k.add(cyl(0.04,0.06,0.3,10), '#cfc8b8', 0,0.2,s/2-0.45); }
  const nt = s*2; for (let i=0;i<nt;i++) addTree(k, -s/2+0.25+i*(s-0.5)/(nt-1), -s/2+0.25, R, 0.65);
  addTree(k,-s/2+0.25,s/2-0.3,R,0.7);
}
export const SPECIAL_MODELS = {
  parque(k,R){
    k.add(box(0.96,0.03,0.96), '#7ab850', 0,0.015,0, { edges:false });
    k.add(box(0.96,0.034,0.15), '#e3d3ad', 0,0.017,0, { edges:false });
    k.add(box(0.15,0.034,0.96), '#e3d3ad', 0,0.017,0, { edges:false });
    k.add(cyl(0.2,0.22,0.08,16), '#cfc8b8', 0,0.06,0);
    k.add(cyl(0.17,0.17,0.02,16), WATER, 0,0.1,0, { edges:false });
    k.add(cyl(0.035,0.05,0.2,10), '#cfc8b8', 0,0.17,0);
    for (const [x,z] of [[-0.3,-0.3],[0.3,0.3],[0.3,-0.3],[-0.3,0.3]]) addTree(k,x,z,R,0.75);
    k.add(box(0.2,0.04,0.06), '#8a5a3b', 0.3,0.06,0.13);
  },
  processadora(k,R){
    k.add(box(1.94,0.03,1.94), '#bdb7a9', 0,0.015,0, { edges:false });
    k.add(box(1.3,0.55,0.95), '#d9c8a6', -0.2,0.275,-0.15);
    for (let i=0;i<3;i++) k.add(shed(0.43,0.97,0.18), '#7b8794', -0.63+i*0.433,0.55,-0.15);
    k.add(box(0.5,0.36,0.5), '#a9b6bd', 0.6,0.18,0.5);
    k.add(cyl(0.08,0.11,1.15,12), '#b54a35', 0.66,0.575,-0.58);
    k.add(cyl(0.087,0.087,0.1,12), '#f2ede4', 0.66,0.95,-0.58);
    k.add(box(0.36,0.3,0.02), '#5c6670', -0.2,0.15,0.34);
    k.add(cyl(0.06,0.06,0.2,12), '#e0a35a', -0.2,0.4,0.35, { rz:Math.PI/2 });
    for (let i=0;i<3;i++) k.add(box(0.16,0.13,0.16), '#c49a5a', -0.75+i*0.2, 0.065, 0.62, { ry:R()*0.5 });
    k.addSmoke(0.66,1.18,-0.58);
  },
};

// ============================================================
//  FAZENDAS
// ============================================================
// lote de plantação (centro x,z no mundo)
export function farmTile(k, x, z, level, R, alongX){
  k.add(box(0.98,0.03,0.98), level>=3 ? '#8f6e45' : '#9c7a4f', x,0.015,z, { edges:false });
  const crop = level>=3 ? ['#d6b84a','#e4c95a'] : level===2 ? ['#d9bb52','#e7cd63'] : ['#ccb25a','#dcc26a'];
  for (let i=0;i<4;i++){
    const o = -0.36 + i*0.24;
    if (alongX) k.add(box(0.9,0.07+level*0.01,0.13), crop[i%2], x,0.055,z+o, { edges:false });
    else k.add(box(0.13,0.07+level*0.01,0.9), crop[i%2], x+o,0.055,z, { edges:false });
  }
}
export function farmFence(k, x, z, side){ // side: 'n','s','e','w'
  const c = '#8a6646';
  if (side==='n' || side==='s'){ const zz = z + (side==='s'?0.48:-0.48); k.add(box(0.98,0.05,0.02), c, x,0.06,zz); k.add(box(0.03,0.1,0.03), c, x-0.45,0.05,zz); }
  else { const xx = x + (side==='e'?0.48:-0.48); k.add(box(0.02,0.05,0.98), c, xx,0.06,z); k.add(box(0.03,0.1,0.03), c, xx,0.05,z-0.45); }
}
export function barn(k, x, z, ry, level, R){
  k.at(x, z, ry, ()=>{
    k.add(box(0.98,0.03,0.98), '#b7a07a', 0,0.015,0, { edges:false });
    k.add(box(0.52,0.36,0.42), '#b8462e', -0.12,0.18,-0.08);
    k.add(gable(0.58,0.48,0.24), '#5b3a2c', -0.12,0.36,-0.08);
    k.add(box(0.2,0.24,0.02), '#f2e6cf', -0.12,0.12,0.135);
    k.add(box(0.2,0.012,0.022), '#b8462e', -0.12,0.12,0.137, { rz:0.9, edges:false });
    const silos = level>=3 ? 2 : 1, sh = level>=2 ? 0.7 : 0.5;
    for (let i=0;i<silos;i++){ const sx = 0.28, sz = -0.2+i*0.3; k.add(cyl(0.11,0.11,sh,14), '#dedad0', sx,sh/2,sz); k.add(cone(0.13,0.14,14), '#7d8a92', sx,sh+0.07,sz); }
    if (level>=3){ k.add(box(0.03,0.5,0.03), '#7a8086', 0.38,0.25,0.36); k.add(cyl(0.12,0.12,0.02,10), '#7a8086', 0.38,0.5,0.36); }
  });
}
export function sprinkler(k, x, z){ k.add(cyl(0.012,0.012,0.22,6), '#7a8086', x,0.11,z, { edges:false }); k.add(cyl(0.04,0.01,0.03,8), '#5c6670', x,0.23,z); }
export function tractorKit(){
  const k = new Kit();
  k.add(box(0.2,0.08,0.13), '#3f9a52', 0,0.08,0);
  k.add(box(0.08,0.09,0.1), '#cfe6ef', -0.04,0.165,0);
  k.add(box(0.09,0.012,0.12), '#3f9a52', -0.04,0.215,0);
  for (const [x,r] of [[-0.06,0.06],[0.07,0.04]]) for (const z of [-0.075,0.075]) k.add(cyl(r,r,0.03,10), '#2f2f33', x,r,z, { rx:Math.PI/2 });
  k.add(box(0.06,0.06,0.18), '#d9bb52', 0.15,0.05,0);
  return k;
}
