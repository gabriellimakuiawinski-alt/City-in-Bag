import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Kit, box, addTree, ZONE_MODELS, SPECIAL_MODELS, prefeitura as prefModel, farmTile, farmFence, barn, sprinkler, tractorKit } from './models.js';

// ================== CONFIG ==================
const N = 48;
const DAY = 1.5;
const SAVE_KEY = 'cidade_proto_v3';
const T = { EMPTY:0, ROAD:1, WATER:2, TREE:3, BUILD:4, BRIDGE:5, FARM:6 };
const Z = { NONE:0, RES:1, COM:2, IND:3 };
const ZKEY = [null,'res','com','ind'];
const ZNAME = [null,'Residencial','Comercial','Industrial'];
const ZCOL = [null, ['#5fbf4a','#2f8f3a'], ['#4f8fe0','#2f5fb8'], ['#e6b43a','#c4801e']];

const STAGES = [
  { nome:'Vila',           pop:0,     maxArea:4 },
  { nome:'Cidade pequena', pop:1000,  maxArea:9 },
  { nome:'Cidade',         pop:5000,  maxArea:12 },
  { nome:'Metrópole',      pop:20000, maxArea:16 },
];
const PREF_COST = { 3:3000, 4:8000, 5:20000 };
const FARM_LOT = 25;
const EQUIP = [null, { nome:'Ferramentas manuais', mult:1 }, { nome:'Trator', mult:1.5, base:400, lot:30 }, { nome:'Colheitadeira e irrigação', mult:2, base:1000, lot:80 }];

const SPECIAL = {
  prefeitura:   { nome:'Prefeitura', ic:'pref', custo:1500, w:2, unique:true },
  parque:       { nome:'Praça', ic:'praca', custo:150, manut:1, w:1 },
  processadora: { nome:'Fábrica de alimentos', curto:'Alimentos', ic:'food', custo:500, manut:4, w:2, jobs:6 },
};

const TOOLS = [
  { id:'ver',  ic:'hand', nome:'Ver' },
  { id:'rua',  ic:'road', nome:'Rua', custo:10 },
  { id:'zres', ic:'res',  nome:'Casas', zone:Z.RES, tag:'var(--r)', sep:true },
  { id:'zcom', ic:'com',  nome:'Comércio', zone:Z.COM, tag:'var(--c)' },
  { id:'zind', ic:'ind',  nome:'Indústria', zone:Z.IND, tag:'var(--i)' },
  { id:'fazenda', ic:'farm', nome:'Fazenda', sub:'R$ 25/lote', sep:true },
  { id:'processadora', ic:'food', nome:'Alimentos', custo:500 },
  { id:'prefeitura', ic:'pref', nome:'Prefeitura', custo:1500 },
  { id:'parque', ic:'praca', nome:'Praça', custo:150 },
  { id:'arvore',  ic:'tree', nome:'Árvore', custo:10, sep:true },
  { id:'demolir', ic:'demo', nome:'Demolir' },
];
const ROAD_COST = 10, BRIDGE_COST = 50, TREE_COST = 10;

const GOALS = [
  { txt:'Desenhe uma rua',                              prog:()=>[Math.min(countRoads(),1),1] },
  { txt:'Pinte um bairro residencial ao lado da rua',   prog:()=>[Math.min(countZone(Z.RES),6),6] },
  { txt:'Chegue a 20 moradores',                        prog:()=>[Math.min(popTotal(),20),20] },
  { txt:'Crie bairros comerciais e industriais',        prog:()=>[Math.min(countB('com'),2)+Math.min(countB('ind'),2),4] },
  { txt:'Pinte uma fazenda (no mínimo 2×2)',            prog:()=>[Math.min(farms.size,1),1] },
  { txt:'Construa a fábrica de alimentos',              prog:()=>[Math.min(countB('processadora'),1),1] },
  { txt:'Construa a prefeitura',                        prog:()=>[Math.min(countB('prefeitura'),1),1] },
  { txt:'Compre um trator para uma fazenda',            prog:()=>[[...farms.values()].some(f=>f.level>=2)?1:0,1] },
  { txt:'Chegue a 1.000 moradores',                     prog:()=>[Math.min(popTotal(),1000),1000] },
  { txt:'Faça crescer um prédio de alta densidade',     prog:()=>[[...blds.values()].some(b=>b.dens===1)?1:0,1] },
  { txt:'Amplie a prefeitura',                          prog:()=>[[...blds.values()].some(b=>b.type==='prefeitura'&&b.s>=3)?1:0,1] },
];

// ================== UTIL ==================
function rng(seed){ let a = seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const idx = (x,z) => z*N + x;
const inb = (x,z) => x>=0 && z>=0 && x<N && z<N;
const fmt = n => Math.round(n).toLocaleString('pt-BR');
const $ = s => document.querySelector(s);
const ico = (id, cls='ico') => `<svg class="${cls}"><use href="#i-${id}"/></svg>`;
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const wx = x => x - N/2 + 0.5;
const DIRS = [[0,0,1],[Math.PI/2,1,0],[-Math.PI/2,-1,0],[Math.PI,0,-1]];

// ================== RENDER ==================
const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#bfe0ea');
scene.fog = new THREE.Fog('#bfe0ea', 65, 130);
const camera = new THREE.PerspectiveCamera(40, innerWidth/innerHeight, 0.1, 320);
const controls = new MapControls(camera, canvas);
Object.assign(controls, { enableDamping:true, dampingFactor:0.12, minDistance:4, maxDistance:70, maxPolarAngle:1.2, minPolarAngle:0.25, screenSpacePanning:false, zoomToCursor:true });
function resetCamera(){ const p = innerHeight > innerWidth ? 1.5 : 1; controls.target.set(-9,0,6.5); camera.position.set(-9+9*p, 15*p, 6.5+15*p); }
resetCamera();

scene.add(new THREE.HemisphereLight('#fff3dc', '#6f8f52', 1.25));
const sun = new THREE.DirectionalLight('#fff6e8', 2.1);
sun.position.set(-14, 26, 12); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left:-30, right:30, top:30, bottom:-30, near:1, far:90 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun);

const gradTex = new THREE.DataTexture(new Uint8Array([110,110,110,255, 185,185,185,255, 255,255,255,255]), 3, 1, THREE.RGBAFormat);
gradTex.minFilter = gradTex.magFilter = THREE.NearestFilter; gradTex.needsUpdate = true;
const toonV = new THREE.MeshToonMaterial({ vertexColors:true, gradientMap:gradTex });
const edgeMat = new THREE.LineBasicMaterial({ color:'#3a2e28', transparent:true, opacity:0.8 });
const ghostMat = new THREE.MeshBasicMaterial({ vertexColors:true, transparent:true, opacity:0.55, depthWrite:false });
const zoneMat = new THREE.MeshBasicMaterial({ vertexColors:true, transparent:true, opacity:0.55, depthWrite:false });

function kitObject(k, { shadow=true }={}){
  const grp = new THREE.Group(); const g = k.geometry();
  if (g){ const m = new THREE.Mesh(g, toonV); m.castShadow = shadow; m.receiveShadow = true; grp.add(m); }
  grp.add(new THREE.LineSegments(k.edges(), edgeMat));
  k.dispose(); return grp;
}
function disposeObj(o){ o.traverse(c=>c.geometry?.dispose()); }

// ================== ESTADO ==================
const grid = { t:new Uint8Array(N*N), b:new Int32Array(N*N).fill(-1), z:new Uint8Array(N*N), d:new Uint8Array(N*N), f:new Int32Array(N*N).fill(-1) };
const lv = new Float32Array(N*N), poll = new Uint8Array(N*N), park = new Uint8Array(N*N), nearWater = new Uint8Array(N*N);
const blds = new Map(), farms = new Map();
let nextId = 1, S;
const fresh = () => ({ money:10000, day:1, trigo:0, alim:30, merc:20, happy:70, speed:1, goal:0, inc:0, stage:0, alerts:[], dem:[0.6,0.2,0.3] });

// ================== MUNDO ==================
const world = new THREE.Group(); scene.add(world);
const bGroup = new THREE.Group(); world.add(bGroup);
const fxGroup = new THREE.Group(); world.add(fxGroup);
const outer = new THREE.Mesh(new THREE.PlaneGeometry(300,300), new THREE.MeshToonMaterial({ color:'#86b15a', gradientMap:gradTex }));
outer.rotation.x = -Math.PI/2; outer.position.y = -0.03; outer.receiveShadow = true; world.add(outer);
const groundM = new THREE.Mesh(new THREE.PlaneGeometry(N,N), new THREE.MeshToonMaterial({ color:'#9ccb68', gradientMap:gradTex }));
groundM.rotation.x = -Math.PI/2; groundM.receiveShadow = true; world.add(groundM);
const gridLines = (()=>{
  const p=[]; for(let i=0;i<=N;i++){ const v=i-N/2; p.push(-N/2,0.006,v, N/2,0.006,v, v,0.006,-N/2, v,0.006,N/2); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p,3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color:'#2f4a22', transparent:true, opacity:0.18 }));
})();
gridLines.visible = false; world.add(gridLines);

let roadObj=null, waterObj=null, treeObj=null, zoneObj=null, farmObj=null;
const dirty = { roads:false, water:false, trees:false, zones:false, farms:false };

function genTerrain(seed){
  const R = rng(seed);
  grid.t.fill(T.EMPTY); grid.z.fill(0); grid.d.fill(0); grid.b.fill(-1); grid.f.fill(-1);
  const ph = R()*6;
  for (let x=0;x<N;x++){
    const c = 5.5 + 2.6*Math.sin(x*0.17+ph) + 1.2*Math.sin(x*0.45+ph*2);
    for (let z=0;z<N;z++) if (Math.abs(z+0.5-c) < 1.4) grid.t[idx(x,z)] = T.WATER;
  }
  for (let x=0;x<16;x++) grid.t[idx(x,28)] = T.ROAD;
  const centers = Array.from({length:20}, ()=>[R()*N, R()*N, 2+R()*4.5]);
  for (let z=0;z<N;z++) for (let x=0;x<N;x++){
    const i=idx(x,z); if (grid.t[i]!==T.EMPTY) continue;
    if (Math.abs(z-28)<=4 && x<24) continue;
    let p = 0.02;
    for (const [cx,cz,r] of centers){ const d=Math.hypot(x-cx,z-cz); if (d<r) p = Math.max(p, 0.75*(1-d/r)+0.1); }
    if (R() < p) grid.t[i] = T.TREE;
  }
}
const isWater = (x,z) => inb(x,z) && (grid.t[idx(x,z)]===T.WATER || grid.t[idx(x,z)]===T.BRIDGE);
const isRoad = (x,z) => inb(x,z) && (grid.t[idx(x,z)]===T.ROAD || grid.t[idx(x,z)]===T.BRIDGE);
const roadAdj1 = (x,z) => isRoad(x+1,z)||isRoad(x-1,z)||isRoad(x,z+1)||isRoad(x,z-1);
function roadDir(x,z,maxD=1){ for (let d=1; d<=maxD; d++) for (const [rot,dx,dz] of DIRS) if (isRoad(x+dx*d, z+dz*d)) return rot; return null; }
const free = t => t===T.EMPTY || t===T.TREE;

function swap(old, nu){ if (old){ world.remove(old); disposeObj(old); } if (nu) world.add(nu); return nu; }
function rebuildWater(){
  const k = new Kit();
  nearWater.fill(0);
  for (let z=0;z<N;z++) for (let x=0;x<N;x++){
    if (isWater(x,z)){
      k.add(box(1,0.02,1), '#63aed6', wx(x),0.004,wx(z), { edges:false });
      for (let dz=-3;dz<=3;dz++) for (let dx=-3;dx<=3;dx++) if (inb(x+dx,z+dz)) nearWater[idx(x+dx,z+dz)] = 1;
    } else for (const [,dx,dz] of DIRS) if (isWater(x+dx,z+dz))
      k.add(box(dx?0.14:1, 0.012, dz?0.14:1), '#e6d39b', wx(x)+dx*0.43, 0.006, wx(z)+dz*0.43, { edges:false });
  }
  waterObj = swap(waterObj, kitObject(k, { shadow:false }));
}
function rebuildRoads(){
  const k = new Kit();
  for (let z=0;z<N;z++) for (let x=0;x<N;x++){
    const t = grid.t[idx(x,z)]; if (t!==T.ROAD && t!==T.BRIDGE) continue;
    const X=wx(x), Zc=wx(z), n={ e:isRoad(x+1,z), w:isRoad(x-1,z), s:isRoad(x,z+1), nn:isRoad(x,z-1) };
    if (t===T.BRIDGE){
      k.add(box(1,0.08,1), '#9b7650', X,0.06,Zc, { edges:false });
      k.add(box(0.86,0.01,0.86), '#6e7177', X,0.105,Zc, { edges:false });
      if (!n.e) k.add(box(0.06,0.12,1), '#6b4f36', X+0.47,0.16,Zc);
      if (!n.w) k.add(box(0.06,0.12,1), '#6b4f36', X-0.47,0.16,Zc);
      if (!n.s) k.add(box(1,0.12,0.06), '#6b4f36', X,0.16,Zc+0.47);
      if (!n.nn) k.add(box(1,0.12,0.06), '#6b4f36', X,0.16,Zc-0.47);
      continue;
    }
    k.add(box(1,0.03,1), '#6e7177', X,0.015,Zc, { edges:false });
    if (!n.e)  k.add(box(0.12,0.05,1), '#d5d0c4', X+0.44,0.025,Zc, { edges:false });
    if (!n.w)  k.add(box(0.12,0.05,1), '#d5d0c4', X-0.44,0.025,Zc, { edges:false });
    if (!n.s)  k.add(box(1,0.05,0.12), '#d5d0c4', X,0.025,Zc+0.44, { edges:false });
    if (!n.nn) k.add(box(1,0.05,0.12), '#d5d0c4', X,0.025,Zc-0.44, { edges:false });
    const hz = n.e||n.w, vt = n.s||n.nn;
    if (hz && !vt) for (const o of [-0.25,0.25]) k.add(box(0.22,0.033,0.04), '#f3ecd6', X+o,0.017,Zc, { edges:false });
    if (vt && !hz) for (const o of [-0.25,0.25]) k.add(box(0.04,0.033,0.22), '#f3ecd6', X,0.017,Zc+o, { edges:false });
  }
  roadObj = swap(roadObj, kitObject(k, { shadow:false }));
}
function rebuildTrees(){
  const k = new Kit();
  for (let z=0;z<N;z++) for (let x=0;x<N;x++){
    const i = idx(x,z); if (grid.t[i]!==T.TREE) continue;
    const R = rng(i*7919+13), cnt = R()<0.45 ? 2 : 1;
    for (let j=0;j<cnt;j++) addTree(k, wx(x)+(R()-0.5)*0.45, wx(z)+(R()-0.5)*0.45, R, 0.9+R()*0.5);
  }
  treeObj = swap(treeObj, kitObject(k));
}
function rebuildZones(){
  const k = new Kit();
  for (let z=0;z<N;z++) for (let x=0;x<N;x++){
    const i = idx(x,z), zn = grid.z[i];
    if (!zn || !free(grid.t[i])) continue;
    k.add(box(0.86,0.01,0.86), ZCOL[zn][grid.d[i]], wx(x),0.014,wx(z), { edges:false });
    if (roadDir(x,z,4)===null) k.add(box(0.5,0.011,0.5), '#ffffff', wx(x),0.016,wx(z), { edges:false });
  }
  const g = k.geometry(); k.dispose();
  const m = g ? new THREE.Mesh(g, zoneMat) : null; if (m) m.renderOrder = 1;
  zoneObj = swap(zoneObj, m);
}

// ================== PRÉDIOS ==================
const CH = 8;
const chunks = new Map();
const ckey = b => (((b.gx+b.gw/2)/CH)|0)+','+(((b.gz+b.gd/2)/CH)|0);
function markChunk(b){ const k = ckey(b); let c = chunks.get(k); if (!c){ c = { obj:null, dirty:true }; chunks.set(k,c); } c.dirty = true; }
function rebuildChunk(key, c){
  if (c.obj){ bGroup.remove(c.obj); disposeObj(c.obj); c.obj = null; }
  c.dirty = false;
  const gs = [], es = [];
  for (const b of blds.values()) if (!b.anim && ckey(b)===key){ gs.push(b.geo); if (b.egeo.attributes.position) es.push(b.egeo); }
  if (!gs.length) return;
  const grp = new THREE.Group();
  const m = new THREE.Mesh(mergeGeometries(gs), toonV); m.castShadow = true; m.receiveShadow = true; grp.add(m);
  if (es.length) grp.add(new THREE.LineSegments(mergeGeometries(es), edgeMat));
  bGroup.add(grp); c.obj = grp;
}

const modelOf = b => b.zone ? ZONE_MODELS[b.type][b.dens][b.v] : null;
const bName = b => b.zone ? modelOf(b).nome : SPECIAL[b.type].nome;
function bStat(b){
  if (b.zone){
    const a = b.fw*b.fd, f = b.floors||1, cm = b.capMul||1;
    if (b.type==='res') return { cap: Math.max(2, Math.round(b.dens ? a*f*3.2*cm : a*3*(0.6+0.4*f)*cm)), jobs:0, manut:0 };
    if (b.type==='com') return { cap:0, jobs: b.dens ? Math.round(a*Math.max(3,f)*1.6) : a*3, manut:0 };
    return { cap:0, jobs: b.dens ? a*6 : a*4, manut:0 };
  }
  if (b.type==='prefeitura') return { cap:0, jobs:4+b.s*2, manut:4+b.s*3 };
  const d = SPECIAL[b.type]; return { cap:0, jobs:d.jobs||0, manut:d.manut||0 };
}
function footprint(b){ const r=[]; for(let dz=0;dz<b.gd;dz++) for(let dx=0;dx<b.gw;dx++) r.push([b.gx+dx, b.gz+dz]); return r; }
function sqTiles(w, ax, az){ const r=[]; for(let dz=0;dz<w;dz++) for(let dx=0;dx<w;dx++) r.push([ax+dx, az+dz]); return r; }
function roadSide(w, ax, az){
  const sides = [
    [0,           Array.from({length:w},(_,i)=>[ax+i, az+w])],
    [Math.PI/2,   Array.from({length:w},(_,i)=>[ax+w, az+i])],
    [-Math.PI/2,  Array.from({length:w},(_,i)=>[ax-1, az+i])],
    [Math.PI,     Array.from({length:w},(_,i)=>[ax+i, az-1])],
  ];
  for (const [rot, tiles] of sides) if (tiles.some(([x,z])=>isRoad(x,z))) return rot;
  return null;
}
const hasRoad = b => b.zone ? footprint(b).some(([x,z])=>roadAdj1(x,z)) : roadSide(b.gw,b.gx,b.gz)!==null;

function makeKit(b){
  const k = new Kit(), R = rng(b.seed);
  if (b.zone) modelOf(b).f(k, R, b.fw, b.fd);
  else if (b.type==='prefeitura') prefModel(k, R, b.s);
  else SPECIAL_MODELS[b.type](k, R);
  return k;
}
function buildGeo(b){
  const k = makeKit(b);
  const cx = b.gx + b.gw/2 - N/2, cz = b.gz + b.gd/2 - N/2;
  const m = new THREE.Matrix4().makeRotationY(b.rot).setPosition(cx, 0, cz);
  b.geo = k.geometry(); b.geo.applyMatrix4(m);
  b.egeo = k.edges(); if (b.egeo.attributes.position) b.egeo.applyMatrix4(m);
  b.center = new THREE.Vector3(cx, 0, cz);
  b.smoke = k.smoke.map(p => new THREE.Vector3(...p).applyMatrix4(m));
  b.floors = k.floors; b.capMul = b.zone ? (modelOf(b).capMul || 1) : 1;
  b.height = 0.3 + (k.floors||1)*0.25;
  k.dispose();
}
const anims = [];
const smokeGeo = new THREE.IcosahedronGeometry(0.08, 0);
const smokeMat = new THREE.MeshToonMaterial({ color:'#ece9e3', gradientMap:gradTex, transparent:true, opacity:0.85 });
function addFx(b){
  b.fx = [];
  for (const p of b.smoke){
    const g = new THREE.Group(); g.position.copy(p);
    for (let i=0;i<4;i++){ const m = new THREE.Mesh(smokeGeo, smokeMat); m.userData.ph = i/4; g.add(m); }
    fxGroup.add(g); b.fx.push(g);
  }
}
function clearFx(b){ for (const g of b.fx||[]) fxGroup.remove(g); b.fx = []; if (b.warn){ world.remove(b.warn); b.warn = null; } }
function spawnVisual(b, animate){
  buildGeo(b); addFx(b);
  if (animate){
    const temp = new THREE.Group(); temp.position.copy(b.center);
    const m = new THREE.Mesh(b.geo.clone().translate(-b.center.x,0,-b.center.z), toonV); m.castShadow = true; temp.add(m);
    if (b.egeo.attributes.position) temp.add(new THREE.LineSegments(b.egeo.clone().translate(-b.center.x,0,-b.center.z), edgeMat));
    temp.scale.setScalar(0.01); bGroup.add(temp);
    b.anim = { o:temp, t:0, b }; anims.push(b.anim);
  } else markChunk(b);
}
function placeB(o, animate){
  const b = { id:o.id ?? nextId++, type:o.type, zone:!!o.zone, dens:o.dens||0, v:o.v||0, fw:o.fw||1, fd:o.fd||1, s:o.s||0,
              gx:o.gx, gz:o.gz, gw:o.gw, gd:o.gd, rot:o.rot||0, pop:o.pop||0, staff:0, out:0, seed:o.seed ?? (Math.random()*1e9|0), road:true };
  for (const [x,z] of footprint(b)){ const i=idx(x,z); if (grid.t[i]===T.TREE) dirty.trees=true; grid.t[i]=T.BUILD; grid.b[i]=b.id; if (!b.zone){ grid.z[i]=0; } }
  blds.set(b.id, b);
  spawnVisual(b, animate);
  dirty.zones = true;
  return b;
}
function unspawn(b){
  if (b.anim){ bGroup.remove(b.anim.o); disposeObj(b.anim.o); anims.splice(anims.indexOf(b.anim),1); b.anim = null; }
  clearFx(b); b.geo.dispose(); b.egeo.dispose(); markChunk(b);
}
function removeB(id, keepZone=false){
  const b = blds.get(id); if (!b) return;
  for (const [x,z] of footprint(b)){ const i=idx(x,z); grid.t[i]=T.EMPTY; grid.b[i]=-1; if (!keepZone){ grid.z[i]=0; grid.d[i]=0; } }
  unspawn(b); blds.delete(id);
  dirty.zones = true;
  if (selected?.kind==='b' && selected.id===id) closeInfo();
}

// aviso
const warnTex = (()=>{ const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d');
  x.fillStyle='#ffcf4a'; x.strokeStyle='#3a2e28'; x.lineWidth=5; x.lineJoin='round';
  x.beginPath(); x.moveTo(32,6); x.lineTo(59,55); x.lineTo(5,55); x.closePath(); x.fill(); x.stroke();
  x.fillStyle='#3a2e28'; x.fillRect(29,22,6,18); x.beginPath(); x.arc(32,47,3.6,0,7); x.fill();
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; })();
const warnMat = new THREE.SpriteMaterial({ map:warnTex, depthTest:false });
function setWarn(b, on){
  if (on && !b.warn){ const s=new THREE.Sprite(warnMat); s.scale.setScalar(0.42); s.position.copy(b.center).setY(b.height+0.5); s.renderOrder=10; world.add(s); b.warn=s; }
  if (!on && b.warn){ world.remove(b.warn); b.warn=null; }
}

// ================== FAZENDAS ==================
let tractors = [];
const tractorGeo = (()=>{ const k = tractorKit(); const o = kitObject(k); return o; })();
function farmLots(f){ return Math.max(1, f.tiles.size - 1); }
function farmJobs(f){ return Math.max(1, Math.ceil(farmLots(f)/3 * (f.level>=3 ? 0.75 : 1))); }
function upgradeCost(f){ const e = EQUIP[f.level+1]; return e ? e.base + e.lot*farmLots(f) : 0; }
function pickBarn(f){
  let best = -1;
  for (const i of [...f.tiles].sort((a,b)=>a-b)){ const x = i%N, z = (i/N)|0; if (roadAdj1(x,z)){ best = i; break; } }
  f.barn = best;
}
function newFarm(tiles, o={}){
  const f = { id:o.id ?? nextId++, tiles:new Set(), level:o.level||1, seed:o.seed ?? (Math.random()*1e9|0), staff:0, out:0, barn:-1 };
  f.alongX = rng(f.seed)() < 0.5;
  farms.set(f.id, f);
  for (const i of tiles) addFarmTile(f, i);
  pickBarn(f);
  return f;
}
function addFarmTile(f, i){ if (grid.t[i]===T.TREE) dirty.trees = true; grid.t[i] = T.FARM; grid.f[i] = f.id; grid.z[i] = 0; f.tiles.add(i); }
function removeFarmTile(i){
  const f = farms.get(grid.f[i]); grid.t[i] = T.EMPTY; grid.f[i] = -1;
  if (!f) return;
  f.tiles.delete(i);
  if (!f.tiles.size){ farms.delete(f.id); if (selected?.kind==='f' && selected.id===f.id) closeInfo(); }
  else if (f.barn===i) pickBarn(f);
}
function removeFarm(f){ for (const i of [...f.tiles]) removeFarmTile(i); dirty.farms = true; dirty.zones = true; }
function rebuildFarms(){
  const k = new Kit();
  for (const t of tractors){ world.remove(t.o); } tractors = [];
  for (const f of farms.values()){
    const R = rng(f.seed);
    const path = [];
    for (const i of f.tiles){
      const x = i%N, z = (i/N)|0, X = wx(x), Zc = wx(z);
      if (i===f.barn){ barn(k, X, Zc, roadDir(x,z) ?? 0, f.level, R); continue; }
      farmTile(k, X, Zc, f.level, R, f.alongX);
      if (f.level>=3 && (x+z)%2===0) sprinkler(k, X+0.3, Zc+0.3);
      for (const [side,dx,dz] of [['s',0,1],['n',0,-1],['e',1,0],['w',-1,0]]){
        const nx=x+dx, nz=z+dz; if (!(inb(nx,nz) && grid.f[idx(nx,nz)]===f.id)) farmFence(k, X, Zc, side);
      }
      path.push(i);
    }
    if (f.level>=2 && path.length){
      path.sort((a,b)=>{ const za=(a/N)|0, zb=(b/N)|0, xa=a%N, xb=b%N; if (f.alongX){ if (za!==zb) return za-zb; return (za%2?xb-xa:xa-xb); } if (xa!==xb) return xa-xb; return (xa%2?zb-za:za-zb); });
      const o = tractorGeo.clone(); world.add(o);
      tractors.push({ o, f, pts: path.map(i=>new THREE.Vector3(wx(i%N),0.02,wx((i/N)|0))), t: rng(f.seed+1)()*path.length });
    }
  }
  const obj = kitObject(k);
  farmObj = swap(farmObj, obj);
}

// ================== CONTAGENS ==================
const countB = type => { let n=0; for (const b of blds.values()) if (b.type===type) n++; return n; };
const popTotal = () => { let n=0; for (const b of blds.values()) n+=b.pop; return n; };
const countRoads = () => { let n=0; for (let i=0;i<N*N;i++) if (grid.t[i]===T.ROAD||grid.t[i]===T.BRIDGE) n++; return Math.max(0, n-16); };
const countZone = zn => { let n=0; for (let i=0;i<N*N;i++) if (grid.z[i]===zn) n++; return n; };
const prefB = () => [...blds.values()].find(b=>b.type==='prefeitura');
const highOk = () => S.stage >= 1;

// ================== VALOR DO TERRENO ==================
function computeLand(list){
  poll.fill(0); park.fill(0);
  const mark = (b, r, arr) => { for (let z=b.gz-r; z<b.gz+b.gd+r; z++) for (let x=b.gx-r; x<b.gx+b.gw+r; x++) if (inb(x,z)) arr[idx(x,z)] = 1; };
  for (const b of list){
    if (b.type==='ind') mark(b, b.dens?3:2, poll);
    else if (b.type==='processadora') mark(b, 2, poll);
    else if (b.type==='parque') mark(b, 3, park);
  }
  const pf = list.find(b=>b.type==='prefeitura');
  for (let i=0;i<N*N;i++){
    let v = 0.35 + (park[i]?0.25:0) + (nearWater[i]?0.15:0) - (poll[i]?0.35:0);
    if (pf){ const x=i%N, z=(i/N)|0; if (Math.abs(x-(pf.gx+pf.gw/2))<=pf.gw/2+4 && Math.abs(z-(pf.gz+pf.gd/2))<=pf.gd/2+4) v += 0.12; }
    lv[i] = clamp(v,0,1);
  }
}

// ================== SIMULAÇÃO ==================
function tick(){
  S.day++;
  const list = [...blds.values()];
  for (const b of list){ b.road = hasRoad(b); setWarn(b, !b.road); }
  computeLand(list);

  const houses = list.filter(b=>b.type==='res');
  const pop = houses.reduce((s,b)=>s+b.pop,0);
  const workers = Math.floor(pop*0.5);
  const jobB = list.filter(b=>bStat(b).jobs && b.road);
  const farmL = [...farms.values()].filter(f=>f.barn>=0);
  const totalJobs = jobB.reduce((s,b)=>s+bStat(b).jobs,0) + farmL.reduce((s,f)=>s+farmJobs(f),0);
  const ratio = totalJobs ? Math.min(1, workers/totalJobs) : 0;
  for (const b of list){ b.staff=0; b.out=0; }
  for (const f of farms.values()){ f.staff=0; f.out=0; }
  for (const b of jobB) b.staff = Math.round(bStat(b).jobs*ratio);
  for (const f of farmL) f.staff = Math.round(farmJobs(f)*ratio);
  const unemployed = Math.max(0, workers-totalJobs);
  const sr = b => b.staff/bStat(b).jobs;

  for (const f of farmL){ const p = farmLots(f)*0.4*EQUIP[f.level].mult*(f.staff/farmJobs(f)); S.trigo += p; f.out = p; }
  for (const b of jobB) if (b.type==='processadora'){ const use = Math.min(S.trigo, 6*sr(b)); S.trigo -= use; S.alim += use; b.out = use; }
  for (const b of jobB) if (b.type==='ind'){ const p = bStat(b).jobs*0.2*sr(b); S.merc += p; b.out = p; }

  const shops = jobB.filter(b=>b.type==='com');
  const capOf = b => bStat(b).jobs*1.4*sr(b);
  const cap = shops.reduce((s,b)=>s+capOf(b),0);
  const dF = pop*0.05, dG = pop*0.04;
  const sF = Math.min(dF, S.alim, cap); S.alim -= sF;
  const sG = Math.min(dG, S.merc, cap - sF); S.merc -= sG;
  for (const b of shops) b.out = cap ? (sF+sG)*capOf(b)/cap : 0;
  let export_ = 0;
  if (S.merc > 60){ export_ = Math.min(S.merc-60, 10); S.merc -= export_; }
  if (S.trigo > 200){ const e = Math.min(S.trigo-200, 10); S.trigo -= e; export_ += e*0.5; }

  const small = pop <= 25;
  const foodR = small ? 1 : (dF ? sF/dF : 1);
  const goodsR = small ? 1 : (dG ? sG/dG : 1);
  const comStaff = shops.reduce((s,b)=>s+b.staff,0), indStaff = jobB.filter(b=>b.type==='ind').reduce((s,b)=>s+b.staff,0);
  const taxes = pop*0.15 + comStaff*0.2 + indStaff*0.2;
  const sales = sF*0.6 + sG*0.8 + export_*0.5;
  let maint = countRoads()*0.1 + pop*0.06; for (const b of list) maint += bStat(b).manut;
  for (const f of farms.values()) maint += farmLots(f)*0.05*f.level;
  S.inc = taxes + sales - maint; S.money += S.inc;
  S.trigo = Math.min(S.trigo, 999); S.alim = Math.min(S.alim, 999); S.merc = Math.min(S.merc, 999);

  let nearPark = 0, polluted = 0;
  for (const h of houses){ const fp = footprint(h); if (fp.some(([x,z])=>park[idx(x,z)])) nearPark++; if (fp.some(([x,z])=>poll[idx(x,z)])) polluted++; }
  const nH = Math.max(1, houses.length);
  const unempR = (!small && workers>0) ? unemployed/workers : 0;
  const target = clamp(30 + 38*foodR + 10*goodsR + 15*nearPark/nH + (prefB()?6:0) - 45*unempR - 25*polluted/nH, 0, 100);
  S.happy += (target - S.happy)*0.12;

  const comJobs = list.filter(b=>b.type==='com').reduce((s,b)=>s+bStat(b).jobs,0);
  const indJobs = list.filter(b=>b.type==='ind').reduce((s,b)=>s+bStat(b).jobs,0);
  const dR = clamp((totalJobs - workers + 8 + (pop<40?14:0)) / (10 + pop*0.12) - (S.happy<40?0.5:0), -1, 1);
  const dC = clamp((pop*0.2 + 3 - comJobs) / (4 + pop*0.05), -1, 1);
  const dI = clamp((pop*0.28 + 4 - indJobs) / (5 + pop*0.06), -1, 1);
  S.dem = [dR, dC, dI];

  growZones();
  const gChance = S.happy>=40 && dR>-0.4 ? (S.happy-35)/65*0.35 : 0;
  for (const h of houses){ const c = bStat(h).cap; if (h.road && h.pop<c && Math.random()<gChance) h.pop = Math.min(c, h.pop + Math.max(1, Math.round(c*0.12*Math.random()))); }
  if (S.happy < 35) for (const h of houses) if (h.pop>0 && Math.random() < (35-S.happy)/35*0.15) h.pop--;

  // etapas
  const p2 = popTotal();
  while (S.stage < STAGES.length-1 && p2 >= STAGES[S.stage+1].pop){ S.stage++; toast(`Agora você é ${STAGES[S.stage].nome}!`, 'city'); updateDens(); }

  const A = [];
  if (list.some(b=>!b.road)) A.push(['warn','Prédio sem acesso à rua']);
  if ([...farms.values()].some(f=>f.barn<0)) A.push(['farm','Fazenda sem acesso à rua']);
  if (!small && foodR < 0.9){
    if (!farms.size) A.push(['bread','Falta comida: pinte uma fazenda']);
    else if (!countB('processadora')) A.push(['bread','Falta comida: construa a fábrica de alimentos']);
    else if (!shops.length) A.push(['com','Sem comércio para vender comida']);
    else if (sF+sG >= cap-0.01) A.push(['com','Comércio lotado: pinte mais zona comercial']);
    else if (S.trigo > 30) A.push(['food','Fábricas de alimentos no limite: construa outra']);
    else A.push(['bread','Falta comida: aumente as fazendas ou compre equipamentos']);
  }
  if (!small && goodsR < 0.7 && shops.length) A.push(['box','Lojas sem mercadorias: pinte zona industrial']);
  if (unempR > 0.25) A.push(['job','Desemprego: pinte zonas comerciais ou industriais']);
  if (polluted/nH > 0.2) A.push(['smog','Indústria perto das casas deixa moradores infelizes']);
  if (totalJobs && ratio < 0.6) A.push(['pop','Faltam trabalhadores: pinte zona residencial']);
  if (S.money < 0) A.push(['money-bad','Cofres no vermelho']);
  S.alerts = A;
  checkGoals();
}

// encontra lotes livres e escolhe o modelo (maior que couber, ponderado pelo valor do terreno)
function lotTiles(x, z, dx, dz, fw, fd, o){
  const r = [];
  for (let i=0;i<fw;i++) for (let j=0;j<fd;j++){
    if (dz) r.push([x - o + i, z - dz*j]); else r.push([x - dx*j, z - o + i]);
  }
  return r;
}
function growZones(){
  const cand = [[],[],[],[]];
  for (let z=0;z<N;z++) for (let x=0;x<N;x++){
    const i = idx(x,z), zn = grid.z[i];
    if (zn && free(grid.t[i]) && roadAdj1(x,z)) cand[zn].push([x,z]);
  }
  const maxA = STAGES[S.stage].maxArea;
  for (let zn=1; zn<=3; zn++){
    const d = S.dem[zn-1]; if (d <= 0.05 || !cand[zn].length) continue;
    const tries = 1 + Math.floor(d*3);
    for (let t=0; t<tries && cand[zn].length; t++){
      if (Math.random() > d*0.85) continue;
      const [x,z] = cand[zn].splice(Math.random()*cand[zn].length|0, 1)[0];
      const i0 = idx(x,z); if (!free(grid.t[i0])) continue;
      const dens = grid.d[i0]; if (dens && !highOk()) continue;
      const type = ZKEY[zn], list = ZONE_MODELS[type][dens];
      const bucket = lv[i0] < 0.35 ? 0 : lv[i0] < 0.6 ? 1 : 2;
      const dirs = DIRS.filter(([,dx,dz])=>isRoad(x+dx,z+dz));
      const opts = [];
      for (const [rot,dx,dz] of dirs) list.forEach((m,v)=>{
        for (const [fw,fd] of m.sizes){
          const a = fw*fd; if (a > maxA) continue;
          for (let o=0;o<fw;o++){
            const tiles = lotTiles(x,z,dx,dz,fw,fd,o);
            if (!tiles.every(([tx,tz])=>inb(tx,tz) && grid.z[idx(tx,tz)]===zn && grid.d[idx(tx,tz)]===dens && free(grid.t[idx(tx,tz)]))) continue;
            let w = Math.pow(a, type==='res' ? 0.9 : 1.1);
            if (type==='res' && m.lux!==undefined) w *= [3,1,0.2][Math.abs(m.lux-bucket)];
            opts.push({ w, rot, v, fw, fd, tiles, dz });
          }
        }
      });
      if (!opts.length) continue;
      let r = Math.random()*opts.reduce((s,o)=>s+o.w,0), pickO = opts[0];
      for (const o of opts){ r -= o.w; if (r <= 0){ pickO = o; break; } }
      const xs = pickO.tiles.map(t=>t[0]), zs = pickO.tiles.map(t=>t[1]);
      const gx = Math.min(...xs), gz = Math.min(...zs), gw = Math.max(...xs)-gx+1, gd = Math.max(...zs)-gz+1;
      placeB({ type, zone:true, dens, v:pickO.v, fw:pickO.fw, fd:pickO.fd, gx, gz, gw, gd, rot:pickO.rot, pop: type==='res' ? 1 : 0 }, true);
    }
  }
}

function checkGoals(){
  while (S.goal < GOALS.length){
    const [a,b] = GOALS[S.goal].prog();
    if (a>=b){ S.goal++; toast(S.goal<GOALS.length ? 'Meta concluída!' : 'Todas as metas concluídas!', S.goal<GOALS.length?'check':'star'); } else break;
  }
}

// ================== PREFEITURA ==================
function expandOptions(b){
  const ns = b.s+1, old = new Set(footprint(b).map(([x,z])=>idx(x,z))), out = [];
  for (const ox of [b.gx-1, b.gx]) for (const oz of [b.gz-1, b.gz]){
    const tiles = sqTiles(ns, ox, oz);
    if (!tiles.every(([x,z])=>inb(x,z))) continue;
    const blocked = tiles.filter(([x,z])=>{ const i=idx(x,z); return !old.has(i) && !free(grid.t[i]); });
    out.push({ ox, oz, blocked, road: roadSide(ns, ox, oz) });
  }
  return out;
}
function expandPref(b){
  const ns = b.s+1, cost = PREF_COST[ns];
  if (S.stage + 2 < ns){ toast(`Chegue a ${STAGES[ns-2].nome} para ampliar`, 'lock'); return; }
  if (S.money < cost){ toast('Dinheiro insuficiente', 'warn'); return; }
  const opts = expandOptions(b);
  const ok = opts.find(o=>!o.blocked.length && o.road!==null);
  if (!ok){
    const best = opts.sort((a,c)=>a.blocked.length-c.blocked.length)[0];
    if (best){ flashTiles(best.blocked); toast('Libere os lotes marcados para ampliar', 'warn'); }
    return;
  }
  S.money -= cost;
  unspawn(b);
  for (const [x,z] of footprint(b)){ const i=idx(x,z); grid.t[i]=T.EMPTY; grid.b[i]=-1; }
  b.s = ns; b.gx = ok.ox; b.gz = ok.oz; b.gw = b.gd = ns; b.rot = ok.road;
  for (const [x,z] of footprint(b)){ const i=idx(x,z); if (grid.t[i]===T.TREE) dirty.trees=true; grid.t[i]=T.BUILD; grid.b[i]=b.id; grid.z[i]=0; }
  spawnVisual(b, true);
  dirty.zones = true;
  toast(`Prefeitura ampliada para ${ns}×${ns}!`, 'pref');
  afterChange();
}
function upgradeFarm(f, silent){
  if (f.level >= 3) return false;
  const c = upgradeCost(f);
  if (S.money < c){ if (!silent) toast('Dinheiro insuficiente', 'warn'); return false; }
  S.money -= c; f.level++; dirty.farms = true;
  if (!silent){ toast(`${EQUIP[f.level].nome} comprado!`, 'farm'); afterChange(); }
  return true;
}
function upgradeAllFarms(){
  const list = [...farms.values()].filter(f=>f.level<3);
  const total = list.reduce((s,f)=>s+upgradeCost(f),0);
  if (!list.length) return;
  if (S.money < total){ toast('Dinheiro insuficiente', 'warn'); return; }
  for (const f of list) upgradeFarm(f, true);
  toast(`${list.length} ${list.length>1?'fazendas melhoradas':'fazenda melhorada'}!`, 'farm');
  afterChange();
}

// ================== SALVAR ==================
function save(){
  try{
    const data = { v:3, S:{...S, alerts:[]}, t:Array.from(grid.t), z:Array.from(grid.z), d:Array.from(grid.d), nextId,
      b:[...blds.values()].map(b=>({ id:b.id, type:b.type, zone:b.zone, dens:b.dens, v:b.v, fw:b.fw, fd:b.fd, s:b.s, gx:b.gx, gz:b.gz, gw:b.gw, gd:b.gd, rot:b.rot, pop:b.pop, seed:b.seed })),
      f:[...farms.values()].map(f=>({ id:f.id, tiles:[...f.tiles], level:f.level, seed:f.seed })) };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }catch(e){}
}
function load(){
  try{
    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false;
    const d = JSON.parse(raw); if (d.v!==3) return false;
    S = Object.assign(fresh(), d.S);
    grid.t.set(d.t); grid.z.set(d.z); grid.d.set(d.d); grid.b.fill(-1); grid.f.fill(-1);
    for (let i=0;i<N*N;i++) if (grid.t[i]===T.BUILD || grid.t[i]===T.FARM) grid.t[i]=T.EMPTY;
    nextId = d.nextId;
    rebuildWater();
    for (const b of d.b) placeB(b, false);
    for (const f of d.f) newFarm(f.tiles, f);
    return true;
  }catch(e){ console.warn(e); return false; }
}
function newGame(){
  for (const id of [...blds.keys()]) removeB(id);
  for (const f of [...farms.values()]) removeFarm(f);
  S = fresh(); nextId = 1;
  genTerrain(Math.random()*1e6|0);
  rebuildAll(); resetCamera(); setSpeed(1); save();
}
function rebuildAll(){ rebuildWater(); rebuildRoads(); rebuildTrees(); rebuildZones(); rebuildFarms(); }

// ================== FERRAMENTAS ==================
let tool = 'ver', zoneDens = 0;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), gplane = new THREE.Plane(new THREE.Vector3(0,1,0),0), hitP = new THREE.Vector3();
function setRay(cx, cy){ const r = canvas.getBoundingClientRect(); ndc.set(((cx-r.left)/r.width)*2-1, -((cy-r.top)/r.height)*2+1); ray.setFromCamera(ndc, camera); }
function pick3(cx, cy){
  setRay(cx, cy);
  if (!ray.ray.intersectPlane(gplane, hitP)) return null;
  return { fx:hitP.x+N/2, fz:hitP.z+N/2, x:Math.floor(hitP.x+N/2), z:Math.floor(hitP.z+N/2) };
}
const pvGeo = new THREE.BoxGeometry(1,1,1);
const mk = (c,o=0.45) => new THREE.MeshBasicMaterial({ color:c, transparent:true, opacity:o, depthWrite:false });
const pvOk = mk('#5fd35a'), pvBad = mk('#e5533f'), pvSkip = mk('#ffffff',0.22), pvFarm = mk('#e7cd63',0.6);
const pvZone = [null, [mk('#5fbf4a',0.6),mk('#2f8f3a',0.6)], [mk('#4f8fe0',0.6),mk('#2f5fb8',0.6)], [mk('#e6b43a',0.6),mk('#c4801e',0.6)]];
const pvPool = []; const pvGroup = new THREE.Group(); world.add(pvGroup);
function pvTile(i, x, z, mat, w=1, h=0.08){
  let m = pvPool[i]; if (!m){ m = new THREE.Mesh(pvGeo, pvOk); m.renderOrder=5; pvPool[i]=m; pvGroup.add(m); }
  m.visible = true; m.material = mat; m.scale.set(w*0.96, h, w*0.96); m.position.set(x + w/2 - N/2, h/2+0.015, z + w/2 - N/2);
}
let flashT = 0; const flashMeshes = [];
function flashTiles(tiles){
  for (const m of flashMeshes) world.remove(m); flashMeshes.length = 0;
  for (const [x,z] of tiles){ const m = new THREE.Mesh(pvGeo, pvBad); m.scale.set(0.96,0.8,0.96); m.position.set(wx(x),0.4,wx(z)); m.renderOrder = 6; world.add(m); flashMeshes.push(m); }
  flashT = 3;
}
let ghost = null;
function setGhost(type){
  if (ghost){ world.remove(ghost); disposeObj(ghost); ghost=null; }
  if (!type) return;
  const k = new Kit(); if (type==='prefeitura') prefModel(k, rng(42), 2); else SPECIAL_MODELS[type](k, rng(42));
  ghost = kitObject(k);
  ghost.traverse(o=>{ if (o.isMesh){ o.material = ghostMat; o.castShadow=false; } if (o.isLineSegments) o.visible=false; });
  ghost.visible = false; world.add(ghost);
}
function clearPreview(){ pvPool.forEach(m=>m.visible=false); if (ghost) ghost.visible=false; hideTip(); }
function lPath(a, b){
  const r = []; const sx = Math.sign(b.x-a.x), sz = Math.sign(b.z-a.z);
  let x=a.x, z=a.z; r.push([x,z]);
  if (Math.abs(b.x-a.x) >= Math.abs(b.z-a.z)){ while (x!==b.x){ x+=sx; r.push([x,z]); } while (z!==b.z){ z+=sz; r.push([x,z]); } }
  else { while (z!==b.z){ z+=sz; r.push([x,z]); } while (x!==b.x){ x+=sx; r.push([x,z]); } }
  return r;
}
function rect(a,b){ const r=[]; for (let z=Math.min(a.z,b.z); z<=Math.max(a.z,b.z); z++) for (let x=Math.min(a.x,b.x); x<=Math.max(a.x,b.x); x++) r.push([x,z]); return r; }
const curTool = () => TOOLS.find(t=>t.id===tool);

function plan(a, b){
  const tl = curTool();
  if (tool==='rua'){
    let cost=0, n=0; const items=[];
    for (const [x,z] of lPath(a,b)){
      if (!inb(x,z)){ items.push([x,z,'bad']); continue; }
      const t = grid.t[idx(x,z)];
      if (t===T.ROAD || t===T.BRIDGE) items.push([x,z,'skip']);
      else if (free(t)){ items.push([x,z,'ok']); cost+=ROAD_COST; n++; }
      else if (t===T.WATER){ items.push([x,z,'ok']); cost+=BRIDGE_COST; n++; }
      else items.push([x,z,'bad']);
    }
    return { items, cost, n, label:`Rua · ${n} trechos · R$ ${fmt(cost)}` };
  }
  if (tl.zone){
    const items=[]; let n=0;
    for (const [x,z] of rect(a,b)){ if (!inb(x,z)) continue; if (free(grid.t[idx(x,z)])){ items.push([x,z,'zone']); n++; } else items.push([x,z,'skip']); }
    return { items, cost:0, n, zone:tl.zone, label:`${ZNAME[tl.zone]} ${zoneDens?'alta':'comum'} · ${n} lotes` };
  }
  if (tool==='fazenda'){
    const items=[], valid=new Set();
    for (const [x,z] of rect(a,b)){ if (!inb(x,z)) continue; const i=idx(x,z); if (free(grid.t[i])){ items.push([x,z,'farm']); valid.add(i); } else items.push([x,z,'skip']); }
    const touch = new Set();
    for (const i of valid){ const x=i%N, z=(i/N)|0; for (const [,dx,dz] of DIRS){ const nx=x+dx, nz=z+dz; if (inb(nx,nz) && grid.f[idx(nx,nz)]>=0) touch.add(grid.f[idx(nx,nz)]); } }
    const n = valid.size, cost = n*FARM_LOT;
    let err = null;
    if (!n) err = 'Nada para plantar aqui';
    else if (!touch.size){
      let has22 = false;
      for (const i of valid){ const x=i%N, z=(i/N)|0; if (valid.has(idx(x+1,z)) && valid.has(idx(x,z+1)) && valid.has(idx(x+1,z+1)) && x+1<N){ has22 = true; break; } }
      if (!has22) err = 'Fazenda precisa de no mínimo 2×2';
      else if (![...valid].some(i=>roadAdj1(i%N,(i/N)|0))) err = 'Fazenda precisa encostar numa rua';
    }
    if (!err && cost > S.money) err = 'Dinheiro insuficiente';
    return { items, cost, n, farm:{ valid, touch }, err, label: err || `${touch.size?'Ampliar fazenda':'Nova fazenda'} · ${n} lotes · R$ ${fmt(cost)}` };
  }
  if (tool==='arvore'){
    let cost=0, n=0; const items=[];
    for (const [x,z] of lPath(a,b)){ if (inb(x,z) && grid.t[idx(x,z)]===T.EMPTY){ items.push([x,z,'ok']); cost+=TREE_COST; n++; } else items.push([x,z,'skip']); }
    return { items, cost, n, label:`Árvores · ${n} · R$ ${fmt(cost)}` };
  }
  if (tool==='demolir'){
    const items=[]; let n=0;
    for (const [x,z] of rect(a,b)){ if (!inb(x,z)) continue; const i=idx(x,z), t=grid.t[i]; const on = t===T.ROAD||t===T.BRIDGE||t===T.TREE||t===T.BUILD||t===T.FARM||grid.z[i]>0; items.push([x,z,on?'bad':'skip']); if(on) n++; }
    return { items, cost:0, n, label: n ? `Demolir ${n} ${n>1?'itens':'item'}` : 'Nada para demolir' };
  }
  if (SPECIAL[tool]){
    const d = SPECIAL[tool]; let err = null;
    for (const [x,z] of sqTiles(d.w, b.ax, b.az)){ if (!inb(x,z)){ err='Fora do mapa'; break; } if (!free(grid.t[idx(x,z)])){ err='Espaço ocupado'; break; } }
    if (!err && roadSide(d.w,b.ax,b.az)===null) err = 'Precisa de rua ao lado';
    if (!err && d.unique && countB(tool)) err = 'Só pode existir uma';
    if (!err && S.money < d.custo) err = 'Dinheiro insuficiente';
    return { building:true, ax:b.ax, az:b.az, ok:!err, err, cost:d.custo, label: err || `${d.nome} · R$ ${fmt(d.custo)}` };
  }
  return null;
}
function anchorFor(p){ const w = SPECIAL[tool]?.w || 1; return { ...p, ax:Math.round(p.fx - w/2), az:Math.round(p.fz - w/2) }; }
function showPlan(pl, cx, cy){
  clearPreview(); if (!pl) return;
  if (pl.building){
    const w = SPECIAL[tool].w;
    pvTile(0, pl.ax, pl.az, pl.ok?pvOk:pvBad, w, 0.06);
    if (ghost){ ghost.visible = true; ghost.position.set(pl.ax+w/2-N/2, 0, pl.az+w/2-N/2); ghost.rotation.y = roadSide(w,pl.ax,pl.az) ?? 0; }
  } else {
    pl.items.slice(0,500).forEach(([x,z,s],i)=> pvTile(i, x, z, s==='zone'?pvZone[pl.zone][zoneDens] : s==='farm' ? (pl.err?pvBad:pvFarm) : s==='ok'?pvOk : s==='bad'?pvBad : pvSkip, 1, tool==='demolir'?0.5:0.05));
  }
  showTip(pl.label, cx, cy, pl.building ? !pl.ok : (pl.err || pl.cost > S.money));
}
function commit(pl){
  if (!pl) return;
  if (pl.building){
    if (!pl.ok){ toast(pl.err, 'warn'); return; }
    S.money -= pl.cost;
    const w = SPECIAL[tool].w;
    placeB({ type:tool, s: tool==='prefeitura' ? 2 : 0, gx:pl.ax, gz:pl.az, gw:w, gd:w, rot:roadSide(w,pl.ax,pl.az) ?? 0 }, true);
    afterChange(); return;
  }
  if (pl.zone){
    for (const [x,z,s] of pl.items) if (s==='zone'){ const i=idx(x,z); grid.z[i]=pl.zone; grid.d[i]=zoneDens; }
    dirty.zones = true; afterChange(); return;
  }
  if (tool==='fazenda'){
    if (pl.err){ toast(pl.err, 'warn'); return; }
    S.money -= pl.cost;
    const ids = [...pl.farm.touch];
    if (ids.length){
      const f = farms.get(ids[0]);
      for (const i of pl.farm.valid) addFarmTile(f, i);
      for (const oid of ids.slice(1)){ const o = farms.get(oid); if (!o) continue; for (const i of o.tiles){ grid.f[i] = f.id; f.tiles.add(i); } farms.delete(oid); }
      if (f.barn < 0) pickBarn(f);
    } else newFarm(pl.farm.valid);
    dirty.farms = dirty.zones = true; afterChange(); return;
  }
  if (tool==='demolir'){
    let farmsTouched = false;
    for (const [x,z,s] of pl.items){
      if (s!=='bad') continue; const i=idx(x,z), t=grid.t[i];
      if (t===T.BUILD) removeB(grid.b[i]);
      else if (t===T.FARM){ removeFarmTile(i); farmsTouched = true; }
      else if (t===T.ROAD){ grid.t[i]=T.EMPTY; dirty.roads=true; }
      else if (t===T.BRIDGE){ grid.t[i]=T.WATER; dirty.roads=dirty.water=true; }
      else if (t===T.TREE){ grid.t[i]=T.EMPTY; dirty.trees=true; }
      grid.z[i]=0; grid.d[i]=0; dirty.zones=true;
    }
    if (farmsTouched || dirty.roads) for (const f of farms.values()) pickBarn(f);
    dirty.farms = true;
    afterChange(); return;
  }
  if (!pl.n) return;
  if (pl.cost > S.money){ toast('Dinheiro insuficiente', 'warn'); return; }
  S.money -= pl.cost;
  for (const [x,z,s] of pl.items){
    if (s!=='ok') continue; const i=idx(x,z), t=grid.t[i];
    if (tool==='rua'){ if (t===T.TREE) dirty.trees=true; if (t===T.WATER){ grid.t[i]=T.BRIDGE; dirty.water=true; } else grid.t[i]=T.ROAD; grid.z[i]=0; }
    else if (tool==='arvore'){ grid.t[i]=T.TREE; dirty.trees=true; }
  }
  if (tool==='rua'){ dirty.roads = dirty.zones = true; for (const f of farms.values()) if (f.barn<0) { pickBarn(f); dirty.farms = true; } }
  afterChange();
}
function afterChange(){ checkGoals(); updateHUD(); save(); }

// ================== INPUT ==================
const pointers = new Map();
let drag = null, tapCand = null;
canvas.addEventListener('pointerdown', e=>{
  pointers.set(e.pointerId, 1);
  if (pointers.size > 1){ drag=null; tapCand=null; clearPreview(); return; }
  if (e.pointerType==='mouse' && e.button!==0) return;
  if (tool==='ver'){ tapCand = { id:e.pointerId, x:e.clientX, y:e.clientY }; return; }
  const p = pick3(e.clientX, e.clientY); if (!p) return;
  const a = anchorFor(p); drag = { id:e.pointerId, a, b:a };
  showPlan(plan(a, a), e.clientX, e.clientY);
});
addEventListener('pointermove', e=>{
  if (tapCand && tapCand.id===e.pointerId && Math.hypot(e.clientX-tapCand.x, e.clientY-tapCand.y) > 8) tapCand = null;
  if (tool==='ver') return;
  if (drag && drag.id===e.pointerId){
    const p = pick3(e.clientX, e.clientY); if (!p) return;
    drag.b = anchorFor(p); showPlan(plan(drag.a, drag.b), e.clientX, e.clientY);
  } else if (!drag && e.pointerType==='mouse' && e.target===canvas && pointers.size===0){
    const p = pick3(e.clientX, e.clientY); if (!p) return;
    const a = anchorFor(p); showPlan(plan(a,a), e.clientX, e.clientY);
  }
});
addEventListener('pointerup', e=>{
  pointers.delete(e.pointerId);
  if (drag && drag.id===e.pointerId){
    const pl = plan(drag.a, drag.b); drag = null; commit(pl);
    if (e.pointerType==='mouse'){ const p=pick3(e.clientX,e.clientY); if (p){ const a=anchorFor(p); showPlan(plan(a,a), e.clientX, e.clientY); } }
    else clearPreview();
  }
  if (tapCand && tapCand.id===e.pointerId){ tapCand=null; selectAt(e.clientX, e.clientY); }
});
addEventListener('pointercancel', e=>{ pointers.delete(e.pointerId); if (drag?.id===e.pointerId){ drag=null; clearPreview(); } tapCand=null; });
canvas.addEventListener('pointerleave', e=>{ if (e.pointerType==='mouse' && !drag) clearPreview(); });
function setControlsForTool(){
  if (tool==='ver'){
    controls.mouseButtons = { LEFT:THREE.MOUSE.PAN, MIDDLE:THREE.MOUSE.DOLLY, RIGHT:THREE.MOUSE.ROTATE };
    controls.touches = { ONE:THREE.TOUCH.PAN, TWO:THREE.TOUCH.DOLLY_ROTATE };
  } else {
    controls.mouseButtons = { LEFT:null, MIDDLE:THREE.MOUSE.PAN, RIGHT:THREE.MOUSE.ROTATE };
    controls.touches = { ONE:null, TWO:THREE.TOUCH.DOLLY_PAN };
  }
}

// ================== SELEÇÃO / INFO ==================
let selected = null;
function tileHit(cx, cy){
  setRay(cx, cy);
  const objs = [...bGroup.children]; if (farmObj) objs.push(farmObj);
  const hits = ray.intersectObjects(objs, true).filter(h=>h.object.isMesh);
  if (hits.length){ const p = hits[0].point.clone().addScaledVector(ray.ray.direction, 0.03); return [Math.floor(p.x+N/2), Math.floor(p.z+N/2)]; }
  const p = pick3(cx,cy); return p ? [p.x, p.z] : null;
}
function selectAt(cx, cy){
  const t = tileHit(cx, cy);
  if (t && inb(t[0],t[1])){
    const i = idx(t[0],t[1]);
    if (grid.b[i]>=0 && blds.has(grid.b[i])){ selected = { kind:'b', id:grid.b[i] }; renderInfo(); $('#info').style.display='block'; return; }
    if (grid.f[i]>=0 && farms.has(grid.f[i])){ selected = { kind:'f', id:grid.f[i] }; renderInfo(); $('#info').style.display='block'; return; }
  }
  closeInfo();
}
function closeInfo(){ selected=null; $('#info').style.display='none'; }
const row = (a,v) => `<div class="row"><span>${a}</span><b>${v}</b></div>`;
function renderInfo(){
  if (!selected) return;
  const el = $('#info');
  if (selected.kind==='f'){
    const f = farms.get(selected.id); if (!f){ closeInfo(); return; }
    const next = EQUIP[f.level+1];
    el.innerHTML = `<h3>${ico('farm')}Fazenda</h3><div class="sub">Nível ${f.level} · ${EQUIP[f.level].nome}</div>`
      + row('Lotes', farmLots(f)) + row('Funcionários', `${f.staff} / ${farmJobs(f)}`) + row('Trigo', `${f.out.toFixed(1)}/dia`) + row('Produção', `×${EQUIP[f.level].mult}`)
      + (f.barn<0 ? `<div class="warn">${ico('warn')}Sem acesso à rua</div>` : '')
      + `<div class="btns">${next ? `<button class="big" id="iUp">${next.nome} · R$ ${fmt(upgradeCost(f))}</button>` : ''}</div>`
      + `<div class="btns"><button class="danger" id="iDel">Demolir</button><button id="iClose">Fechar</button></div>`;
    if (next) $('#iUp').onclick = ()=>upgradeFarm(f);
    $('#iDel').onclick = ()=>{ removeFarm(f); closeInfo(); afterChange(); };
    $('#iClose').onclick = closeInfo;
    return;
  }
  const b = blds.get(selected.id); if (!b){ closeInfo(); return; }
  const st = bStat(b), rows = [];
  const icon = b.zone ? (b.dens ? 'high' : {res:'res',com:'com',ind:'ind'}[b.type]) : SPECIAL[b.type].ic;
  const sub = b.zone ? `${ZNAME[{res:1,com:2,ind:3}[b.type]]} · ${b.dens?'alta densidade':'comum'} · ${b.fw}×${b.fd}` : (b.type==='prefeitura' ? `${b.s}×${b.s} · ${STAGES[S.stage].nome}` : 'Prédio especial');
  if (b.type==='res') rows.push(['Moradores', `${b.pop} / ${st.cap}`]);
  if (st.jobs) rows.push(['Funcionários', `${b.staff} / ${st.jobs}`]);
  if (b.zone && b.floors > 1) rows.push(['Andares', b.floors]);
  if (b.type==='processadora') rows.push(['Alimento', `${b.out.toFixed(1)}/dia`]);
  if (b.type==='ind') rows.push(['Mercadorias', `${b.out.toFixed(1)}/dia`]);
  if (b.type==='com') rows.push(['Vendas', `${b.out.toFixed(1)}/dia`]);
  if (b.type==='parque') rows.push(['Efeito', 'Casas felizes']);
  if (b.zone) rows.push(['Valor do terreno', `${Math.round(lv[idx(b.gx,b.gz)]*100)}%`]);
  if (st.manut) rows.push(['Manutenção', `R$ ${st.manut}/dia`]);
  let extra = '';
  if (b.type==='prefeitura'){
    const ns = b.s+1;
    if (PREF_COST[ns]){
      const can = S.stage + 2 >= ns;
      extra += `<div class="btns"><button class="big" id="iExp" ${can?'':'style="opacity:.55"'}>${can?'':ico('lock')}Ampliar ${ns}×${ns} · R$ ${fmt(PREF_COST[ns])}</button></div>`;
      if (!can) extra += `<div class="sub">Libera em ${STAGES[ns-2].nome} (${fmt(STAGES[ns-2].pop)} moradores)</div>`;
    }
    const up = [...farms.values()].filter(f=>f.level<3);
    if (up.length) extra += `<div class="btns"><button id="iFarms">${ico('farm')}Melhorar ${up.length} ${up.length>1?'fazendas':'fazenda'} · R$ ${fmt(up.reduce((s,f)=>s+upgradeCost(f),0))}</button></div>`;
  }
  const warn = !b.road ? `<div class="warn">${ico('warn')}Sem acesso à rua</div>` : (st.jobs && b.staff===0 ? `<div class="warn">${ico('pop')}Sem trabalhadores</div>` : '');
  el.innerHTML = `<h3>${ico(icon)}${bName(b)}</h3><div class="sub">${sub}</div>${rows.map(([a,v])=>row(a,v)).join('')}${warn}${extra}
    <div class="btns"><button class="danger" id="iDel">Demolir</button><button id="iClose">Fechar</button></div>`;
  if ($('#iExp')) $('#iExp').onclick = ()=>expandPref(b);
  if ($('#iFarms')) $('#iFarms').onclick = upgradeAllFarms;
  $('#iDel').onclick = ()=>{ removeB(b.id, true); afterChange(); };
  $('#iClose').onclick = closeInfo;
}

// teclado
const keys = new Set();
addEventListener('keydown', e=>{
  const k = e.key.toLowerCase(); keys.add(k);
  if (k==='q') rotateCam(1);
  if (k==='e') rotateCam(-1);
  if (k==='escape') selectTool('ver');
  const n = parseInt(e.key); if (n>=1 && n<=9) selectTool(TOOLS[n-1].id);
});
addEventListener('keyup', e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur', ()=>keys.clear());
let pendingRot = 0;
function rotateCam(dir){ pendingRot += dir*Math.PI/4; }
$('#rotL').onclick = ()=>rotateCam(1);
$('#rotR').onclick = ()=>rotateCam(-1);

// ================== UI ==================
const tb = $('#toolbar');
TOOLS.forEach(t=>{
  const b = document.createElement('button'); b.className = 'tool panel' + (t.sep ? ' sepl' : ''); b.dataset.tool = t.id;
  b.innerHTML = `${ico(t.ic)}<span class="nm">${t.nome}</span><span class="c">${t.custo ? 'R$ '+fmt(t.custo) : (t.sub || (t.zone ? 'zona' : '&nbsp;'))}</span>${t.tag?`<i class="tag" style="background:${t.tag}"></i>`:''}`;
  b.onclick = ()=>selectTool(t.id); tb.appendChild(b);
});
function selectTool(id){
  if (tool===id && id!=='ver') id = 'ver';
  tool = id; drag = null; clearPreview();
  document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('on', b.dataset.tool===id));
  gridLines.visible = id!=='ver';
  setGhost(SPECIAL[id] ? id : null);
  setControlsForTool();
  $('#dens').style.display = curTool().zone ? 'flex' : 'none';
  updateDens();
  if (id!=='ver') closeInfo();
}
function updateDens(){
  if (zoneDens && !highOk()) zoneDens = 0;
  document.querySelectorAll('#dens button').forEach(b=>{
    const d = +b.dataset.d; b.classList.toggle('on', d===zoneDens); b.classList.toggle('locked', d===1 && !highOk());
    if (d===1) b.innerHTML = `${ico(highOk()?'high':'lock')}Alta densidade`;
  });
}
document.querySelectorAll('#dens button').forEach(b=> b.onclick = ()=>{
  const d = +b.dataset.d;
  if (d===1 && !highOk()){ toast(`Libera em ${STAGES[1].nome} (${fmt(STAGES[1].pop)} moradores)`, 'lock'); return; }
  zoneDens = d; updateDens();
});
document.querySelectorAll('[data-sp]').forEach(b=> b.onclick = ()=>setSpeed(+b.dataset.sp));
function setSpeed(s){ S.speed = s; document.querySelectorAll('[data-sp]').forEach(b=>b.classList.toggle('on', +b.dataset.sp===s)); }

let toastT;
function toast(msg, ic='warn'){ const t=$('#toast'); t.innerHTML = ico(ic)+msg; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'), 2100); }
function showTip(txt, x, y, bad){ const t=$('#tip'); t.textContent=txt; t.style.display='block'; t.style.color = bad ? 'var(--bad)' : 'var(--ink)';
  const w=t.offsetWidth; t.style.left = clamp(x - w/2, 6, innerWidth-w-6)+'px'; t.style.top = Math.max(6, y - 60)+'px'; }
function hideTip(){ $('#tip').style.display='none'; }
function layoutPanels(){ const hb = $('#hud').getBoundingClientRect().bottom + 6; $('#goal').style.top = hb+'px'; $('#info').style.top = hb+'px'; }
addEventListener('resize', layoutPanels);
function updateHUD(){
  let pop=0, cap=0; for (const b of blds.values()) if (b.type==='res'){ pop+=b.pop; cap+=bStat(b).cap; }
  const h = Math.round(S.happy), face = h>=70?'f3':h>=50?'f2':h>=30?'f1':'f0';
  const inc = S.inc>=0 ? `<small class="pos">+${fmt(S.inc)}</small>` : `<small class="neg">${fmt(S.inc)}</small>`;
  $('#stats').innerHTML = [
    `${ico('coin')}${fmt(S.money)} ${inc}`,
    `${ico('pop')}${fmt(pop)}<small>/${fmt(cap)}</small>`,
    `${ico(face)}${h}%`,
    `${ico('wheat')}${fmt(S.trigo)}<i class="sep"></i>${ico('bread')}${fmt(S.alim)}<i class="sep"></i>${ico('box')}${fmt(S.merc)}`,
    `${ico('cal')}${S.day}`,
  ].map((s,i)=>`<div class="chip panel${i===4?' opt':''}">${s}</div>`).join('');
  layoutPanels();
  const g = $('#goal'), st = STAGES[S.stage], nx = STAGES[S.stage+1];
  const stLine = `<div class="stage">${ico('city')}<span>${st.nome}</span>${nx?`<small>${fmt(pop)}/${fmt(nx.pop)}</small>`:''}</div>`;
  if (S.goal < GOALS.length){
    const [a,b] = GOALS[S.goal].prog();
    g.innerHTML = `${stLine}<b>${ico('star')}Meta ${S.goal+1}/${GOALS.length}</b>${GOALS[S.goal].txt}<div class="bar"><i style="width:${Math.round(a/b*100)}%"></i></div>`;
  } else g.innerHTML = `${stLine}<b>${ico('star')}Metas concluídas</b>Continue crescendo sua cidade!`;
  const al = $('#alert');
  if (S.alerts.length && !curTool().zone){ al.innerHTML = ico(S.alerts[0][0]) + S.alerts[0][1]; al.style.display='flex'; } else al.style.display='none';
  const cols = ['#5fbf4a','#4f8fe0','#e6b43a'];
  ['dR','dC','dI'].forEach((id,i)=>{ const v = S.dem[i], el = $('#'+id), hh = Math.abs(v)*50;
    el.style.background = v>=0 ? cols[i] : '#c9483a'; el.style.height = hh+'%'; el.style.top = v>=0 ? (50-hh)+'%' : '50%'; });
  if (selected) renderInfo();
}
const show = (id,on)=>$(id).style.display = on ? 'grid' : 'none';
let speedBeforeMenu = 1;
$('#menuBtn').onclick = ()=>{ speedBeforeMenu = S.speed; setSpeed(0); show('#menu',true); };
$('#mClose').onclick = ()=>{ show('#menu',false); setSpeed(speedBeforeMenu||1); };
$('#mHelp').onclick = ()=>{ show('#menu',false); show('#help',true); };
$('#hClose').onclick = ()=>{ show('#help',false); setSpeed(speedBeforeMenu||1); try{localStorage.setItem(SAVE_KEY+'_help','1');}catch(e){} };
$('#mNew').onclick = ()=>{ show('#menu',false); show('#confirmNew',true); };
$('#cNo').onclick = ()=>{ show('#confirmNew',false); setSpeed(speedBeforeMenu||1); };
$('#cYes').onclick = ()=>{ show('#confirmNew',false); newGame(); };

// ================== LOOP ==================
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), Y = new THREE.Vector3(0,1,0), tv = new THREE.Vector3();
let last = performance.now(), acc = 0, hudT = 0, saveT = 0, clock = 0;
function frame(now){
  const dt = Math.min(0.1, (now-last)/1000); last = now; clock += dt;
  if (S.speed > 0){ acc += dt*S.speed; let n=0; while (acc >= DAY && n<4){ acc -= DAY; tick(); n++; } }
  let mx = 0, mz = 0;
  if (keys.has('w')||keys.has('arrowup')) mz += 1;
  if (keys.has('s')||keys.has('arrowdown')) mz -= 1;
  if (keys.has('a')||keys.has('arrowleft')) mx -= 1;
  if (keys.has('d')||keys.has('arrowright')) mx += 1;
  if (mx||mz){
    camera.getWorldDirection(fwd); fwd.y=0; fwd.normalize(); right.crossVectors(fwd, Y);
    const sp = camera.position.distanceTo(controls.target)*0.9*dt;
    const mv = fwd.multiplyScalar(mz*sp).add(right.multiplyScalar(mx*sp));
    camera.position.add(mv); controls.target.add(mv);
  }
  if (Math.abs(pendingRot) > 0.0005){
    const step = pendingRot*Math.min(1, dt*10); pendingRot -= step;
    const off = camera.position.clone().sub(controls.target).applyAxisAngle(Y, step);
    camera.position.copy(controls.target).add(off);
  }
  controls.update();
  const tx = clamp(controls.target.x, -N/2, N/2), tz = clamp(controls.target.z, -N/2, N/2);
  if (tx!==controls.target.x || tz!==controls.target.z){ camera.position.x += tx-controls.target.x; camera.position.z += tz-controls.target.z; controls.target.x=tx; controls.target.z=tz; }
  controls.target.y = 0;

  for (let i=anims.length-1;i>=0;i--){
    const a = anims[i]; a.t += dt/0.4;
    const t = Math.min(1,a.t), c1=1.70158, c3=c1+1, s = 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2);
    a.o.scale.setScalar(Math.max(0.01,s));
    if (t>=1){ bGroup.remove(a.o); disposeObj(a.o); a.b.anim = null; markChunk(a.b); anims.splice(i,1); }
  }
  for (const b of blds.values()){
    if (!b.fx.length) continue;
    const on = b.staff > 0;
    for (const g of b.fx){ g.visible = on; if (!on) continue;
      g.children.forEach(m=>{ const p = (clock*0.35 + m.userData.ph) % 1; m.position.set(p*0.25, p*0.9, -p*0.1); m.scale.setScalar(0.5+p*1.6); }); }
  }
  for (const tr of tractors){
    const n = tr.pts.length; tr.o.visible = tr.f.staff > 0 && n > 0;
    if (!tr.o.visible) continue;
    tr.t = (tr.t + dt*0.6) % Math.max(1, n);
    const i0 = Math.floor(tr.t), u = tr.t - i0, a = tr.pts[i0], b = tr.pts[(i0+1)%n];
    tv.copy(a).lerp(b, u); tr.o.position.copy(tv);
    if (a.distanceToSquared(b) > 0.01) tr.o.rotation.y = Math.atan2(-(b.z-a.z), b.x-a.x);
  }
  if (flashT > 0){ flashT -= dt; const v = flashT > 0 && Math.floor(flashT*4)%2===0; for (const m of flashMeshes) m.visible = v; if (flashT <= 0){ for (const m of flashMeshes) world.remove(m); flashMeshes.length = 0; } }
  if (dirty.water){ dirty.water=false; rebuildWater(); }
  if (dirty.roads){ dirty.roads=false; rebuildRoads(); }
  if (dirty.trees){ dirty.trees=false; rebuildTrees(); }
  if (dirty.zones){ dirty.zones=false; rebuildZones(); }
  if (dirty.farms){ dirty.farms=false; rebuildFarms(); }
  let rb = 0; for (const [k,c] of chunks) if (c.dirty && rb < 3){ rebuildChunk(k,c); rb++; }
  hudT += dt; if (hudT > 0.25){ hudT = 0; updateHUD(); }
  saveT += dt; if (saveT > 15){ saveT = 0; save(); }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
addEventListener('resize', ()=>{ camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
document.addEventListener('visibilitychange', ()=>{ if (document.hidden) save(); });

// ================== INÍCIO ==================
S = fresh();
if (!load()) genTerrain(7);
rebuildAll();
selectTool('ver'); setSpeed(S.speed ?? 1);
updateHUD();
$('#loading').remove();
let seenHelp = false; try{ seenHelp = !!localStorage.getItem(SAVE_KEY+'_help') || !!localStorage.getItem('cidade_proto_v2_help'); }catch(e){}
if (!seenHelp){ speedBeforeMenu = S.speed || 1; setSpeed(0); show('#help', true); }
window.__game = { get S(){return S;}, blds, farms, grid, placeB, tick, camera, controls, selectTool, commit, plan, idx, T, N, Z, STAGES, rebuildAll, ZONE_MODELS, setZoneDens:d=>{zoneDens=d;}, dirty, expandPref, upgradeFarm, upgradeAllFarms, newFarm, lv };
requestAnimationFrame(frame);
