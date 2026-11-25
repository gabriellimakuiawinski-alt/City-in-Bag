import {roadSamples,roadPath,addRoadMesh} from './roads.js';
import {decodeCity} from './saves.js';
import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Kit, box, cyl, addTree, ZONE_MODELS, SPECIAL_MODELS, SERVICE_MODELS, carGeometry, truckGeometry, LANDMARKS, prefeitura as prefModel, farmTile, farmFence, barn, sprinkler, tractorKit } from './models.js';

// ================== CONFIG ==================
const N = 48;
const DAY = 1.5;
const SAVE_KEY = 'cidade_proto_v6';
const T = { EMPTY:0, ROAD:1, WATER:2, TREE:3, BUILD:4, BRIDGE:5, FARM:6, RAIL:7, RAILBR:8, PILLAR:9, ROCK:10 };
const Z = { NONE:0, RES:1, COM:2, IND:3, OFF:4 };
const ZKEY = [null,'res','com','ind','off'];
const ZNAME = [null,'Residencial','Comercial','Industrial','Escritórios'];
const ZCOL = [null, ['#5fbf4a','#2f8f3a'], ['#4f8fe0','#2f5fb8'], ['#e6b43a','#c4801e'], ['#a07ae0','#7350c0']];
const CLASSES = [
  { nome:'Baixa', cor:'#8fd06a', tax:0.24, stage:0 },
  { nome:'Média', cor:'#4fae3a', tax:0.38, stage:1 },
  { nome:'Alta',  cor:'#2a7a2a', tax:0.65, stage:2 },
];
// quem pode trabalhar onde (índices de classe)
const JOBCLS = { ind:[0], fazenda:[0], processadora:[0], com0:[0,1], com1:[2,1], off:[2,1], prefeitura:[1], marco:[0,1], serv:[0,1,2] };
const MARCOS = {
  torretv:       { nome:'Torre de TV',    ic:'tv',       custo:6000,  manut:20, w:2, visit:25, jobs:6 },
  catedral:      { nome:'Catedral',       ic:'catedral', custo:8000,  manut:25, w:3, visit:35, jobs:6 },
  parquecentral: { nome:'Parque central', ic:'parque',   custo:5000,  manut:18, w:4, visit:30, jobs:8 },
  estadio:       { nome:'Estádio',        ic:'estadio',  custo:15000, manut:40, w:4, visit:60, jobs:14 },
};

const STAGES = [
  { nome:'Vila',           pop:0,     maxArea:4 },
  { nome:'Cidade pequena', pop:1000,  maxArea:9 },
  { nome:'Cidade',         pop:5000,  maxArea:12 },
  { nome:'Metrópole',      pop:20000, maxArea:16 },
];
const PREF_COST = { 3:3000, 4:8000, 5:20000 };
const FARM_LOT = 25;
const EQUIP = [null, { nome:'Ferramentas manuais', mult:1 }, { nome:'Trator', mult:1.5, base:400, lot:30 }, { nome:'Colheitadeira e irrigação', mult:2, base:1000, lot:80 }];

const SERV = {
  floresta:{nome:'Madeireira',ic:'tree',custo:900,manut:5,w:2,jobs:5},
  serraria:{nome:'Serraria',ic:'box',custo:1800,manut:8,w:2,jobs:8,stage:1},
  eolica:     { nome:'Turbina eólica', ic:'power', custo:1200, manut:4, w:1, power:14, grupo:'energia' },
  carvao:     { nome:'Usina a carvão', ic:'power', custo:2500, manut:10, w:2, power:80, polui:3, jobs:8, grupo:'energia' },
  solar:      { nome:'Usina solar', ic:'power', custo:4500, manut:6, w:2, power:45, stage:1, grupo:'energia' },
  nuclear:    { nome:'Usina nuclear', ic:'power', custo:18000, manut:40, w:3, power:320, stage:3, jobs:20, grupo:'energia' },
  caixa:      { nome:"Caixa d'água", ic:'water', custo:600, manut:2, w:1, water:16, grupo:'agua' },
  bomba:      { nome:"Bomba d'água", ic:'water', custo:2200, manut:8, w:2, water:90, rio:true, jobs:4, grupo:'agua' },
  tratamento: { nome:'Estação de tratamento', ic:'water', custo:9000, manut:25, w:3, water:300, stage:2, jobs:10, grupo:'agua' },
  escola:     { nome:'Escola', ic:'school', custo:2000, manut:12, w:2, raio:9, jobs:8, serv:'edu' },
  universidade:{ nome:'Universidade', ic:'school', custo:9000, manut:35, w:3, raio:16, jobs:20, serv:'edu', stage:2, visit:10 },
  posto:      { nome:'Posto de saúde', ic:'health', custo:900, manut:5, w:1, raio:6, jobs:4, serv:'saude' },
  hospital:   { nome:'Hospital', ic:'health', custo:3500, manut:20, w:2, raio:12, jobs:14, serv:'saude', stage:1 },
  policia:    { nome:'Polícia', ic:'police', custo:1200, manut:8, w:1, raio:8, jobs:6, serv:'seg' },
  bombeiros:  { nome:'Bombeiros', ic:'fire', custo:1200, manut:8, w:1, raio:8, jobs:6, serv:'fogo' },
  armazem:    { nome:'Armazém', ic:'box', custo:1500, manut:5, w:2, jobs:6, estoque:400 },
  garagem:    { nome:'Garagem de ônibus', ic:'bus', custo:2000, manut:12, w:2, jobs:8, onibus:4 },
  ponto:      { nome:'Ponto de ônibus', ic:'bus', custo:150, manut:1, w:1, raio:4, transit:'bus' },
  metro:      { nome:'Estação de metrô', ic:'metro', custo:3500, manut:15, w:1, raio:6, stage:1, jobs:3, transit:'metro' },
  estacao:    { nome:'Estação de trem', ic:'train', custo:4000, manut:15, w:2, raio:7, jobs:6, needs:'rail', transit:'trem' },
  aeroporto:  { nome:'Aeroporto', ic:'plane', custo:30000, manut:60, w:5, stage:3, jobs:30, visit:120, polui:3, unique:true },
  bancos:     { nome:'Bancos e árvore', ic:'deco', custo:60, manut:0, w:1, deco:true },
  poste:      { nome:'Postes e jardim', ic:'deco', custo:50, manut:0, w:1, deco:true },
  canteiro:   { nome:'Canteiro de flores', ic:'deco', custo:80, manut:0, w:1, deco:true },
  estatua:    { nome:'Estátua', ic:'deco', custo:250, manut:1, w:1, deco:true },
  chafariz:   { nome:'Chafariz', ic:'deco', custo:300, manut:1, w:1, deco:true },
};
const SPECIAL = {
  prefeitura:   { nome:'Prefeitura', ic:'pref', custo:1500, w:2, unique:true },
  parque:       { nome:'Praça', ic:'praca', custo:150, manut:1, w:1 },
  processadora: { nome:'Fábrica de alimentos', curto:'Alimentos', ic:'food', custo:500, manut:4, w:2, jobs:6 },
  ...SERV,
  ...Object.fromEntries(Object.entries(MARCOS).map(([k,m])=>[k,{ ...m, unique:true, marco:true }])),
};
const isMarco = t => !!MARCOS[t];
const isServ = t => !!SERV[t];

const TOOLS = [
  { id:'ver',  ic:'hand', nome:'Ver', cat:'ver' },
  { id:'rua',  ic:'road', nome:'Rua', custo:10, cat:'ruas' },
  { id:'avenida', ic:'avenue', nome:'Avenida', custo:30, cat:'ruas' },
  { id:'viaduto', ic:'viaduct', nome:'Viaduto', custo:60, cat:'ruas', sub:'R$ 60/trecho' },
  { id:'arvore',  ic:'tree', nome:'Árvore', custo:10, cat:'ruas' },
  { id:'demolir', ic:'demo', nome:'Demolir', cat:'ruas' },
  { id:'ponto', ic:'bus', nome:'Ponto de ônibus', custo:150, cat:'transporte' },
  { id:'garagem', ic:'bus', nome:'Garagem de ônibus', custo:2000, cat:'transporte' },
  { id:'metro', ic:'metro', nome:'Metrô', custo:3500, cat:'transporte', stage:1 },
  { id:'trilho', ic:'rail', nome:'Trilho', custo:25, cat:'transporte' },
  { id:'viatrem', ic:'viaduct', nome:'Viaduto de trem', custo:80, cat:'transporte', sub:'R$ 80/trecho' },
  { id:'estacao', ic:'train', nome:'Estação de trem', custo:4000, cat:'transporte' },
  { id:'aeroporto', ic:'plane', nome:'Aeroporto', custo:30000, cat:'transporte', stage:3 },
  { id:'zres', ic:'res',  nome:'Casas', zone:Z.RES, tag:'var(--r)', cat:'bairros' },
  { id:'zcom', ic:'com',  nome:'Comércio', zone:Z.COM, tag:'var(--c)', cat:'bairros' },
  { id:'zind', ic:'ind',  nome:'Indústria', zone:Z.IND, tag:'var(--i)', cat:'bairros' },
  { id:'zoff', ic:'off',  nome:'Escritórios', zone:Z.OFF, tag:'var(--o)', cat:'bairros', stage:1 },
  { id:'distrito', ic:'district', nome:'Distrito', cat:'bairros', sub:'pintar' },
  { id:'semdistrito', ic:'district', nome:'Tirar distrito', cat:'bairros', sub:'apagar' },
  { id:'eolica', ic:'power', nome:'Eólica', custo:1200, cat:'servicos' },
  { id:'carvao', ic:'power', nome:'Usina a carvão', custo:2500, cat:'servicos' },
  { id:'solar', ic:'power', nome:'Usina solar', custo:4500, cat:'servicos', stage:1 },
  { id:'nuclear', ic:'power', nome:'Usina nuclear', custo:18000, cat:'servicos', stage:3 },
  { id:'caixa', ic:'water', nome:"Caixa d'água", custo:600, cat:'servicos' },
  { id:'bomba', ic:'water', nome:"Bomba d'água", custo:2200, cat:'servicos' },
  { id:'tratamento', ic:'water', nome:'Tratamento', custo:9000, cat:'servicos', stage:2 },
  { id:'escola', ic:'school', nome:'Escola', custo:2000, cat:'servicos' },
  { id:'universidade', ic:'school', nome:'Universidade', custo:9000, cat:'servicos', stage:2 },
  { id:'posto', ic:'health', nome:'Posto de saúde', custo:900, cat:'servicos' },
  { id:'hospital', ic:'health', nome:'Hospital', custo:3500, cat:'servicos', stage:1 },
  { id:'policia', ic:'police', nome:'Polícia', custo:1200, cat:'servicos' },
  { id:'bombeiros', ic:'fire', nome:'Bombeiros', custo:1200, cat:'servicos' },
  ...['floresta','serraria'].map(id=>({id,...SERV[id],cat:'producao'})),
  { id:'fazenda', ic:'farm', nome:'Fazenda', sub:'R$ 25/lote', cat:'producao' },
  { id:'processadora', ic:'food', nome:'Alimentos', custo:500, cat:'producao' },
  { id:'armazem', ic:'box', nome:'Armazém', custo:1500, cat:'producao' },
  { id:'prefeitura', ic:'pref', nome:'Prefeitura', custo:1500, cat:'cidade' },
  { id:'parque', ic:'praca', nome:'Praça', custo:150, cat:'cidade' },
  { id:'bancos', ic:'deco', nome:'Bancos', custo:60, cat:'cidade' },
  { id:'poste', ic:'deco', nome:'Postes', custo:50, cat:'cidade' },
  { id:'canteiro', ic:'deco', nome:'Canteiro', custo:80, cat:'cidade' },
  { id:'estatua', ic:'deco', nome:'Estátua', custo:250, cat:'cidade' },
  { id:'chafariz', ic:'deco', nome:'Chafariz', custo:300, cat:'cidade' },
  ...Object.entries(MARCOS).map(([id,m])=>({ id, ic:m.ic, nome:m.nome, custo:m.custo, cat:'cidade', stage:1 })),
];
const CATS = [
  { id:'ver', ic:'hand', nome:'Ver', cor:'#fff6e3' },
  { id:'ruas', ic:'road', nome:'Obras', cor:'#e4e1da' },
  { id:'transporte', ic:'bus', nome:'Linhas', cor:'#d6ecf4' },
  { id:'bairros', ic:'res', nome:'Bairros', cor:'#d9f0c8' },
  { id:'servicos', ic:'power', nome:'Serviços', cor:'#fbe0d4' },
  { id:'producao', ic:'farm', nome:'Produção', cor:'#fbe6b0' },
  { id:'cidade', ic:'pref', nome:'Cidade', cor:'#ecdcf6' },
];
const ROAD_COST = 10, BRIDGE_COST = 50, TREE_COST = 10, AVE_COST = 30, VIA_COST = 60, RAIL_COST = 25, RAILBR_COST = 70, VIATREM_COST = 80;
const DIST_NAMES = ['Centro','Jardim das Flores','Vila Nova','Bela Vista','Parque das Águas','Alto da Colina','Vila Operária','Jardim América','Porto Velho','Morada do Sol','Vila Esperança','Recanto Verde','Jardim Primavera','Boa Vista','Vila Mariana','Lago Azul'];
const DIST_COLS = ['#ff8a65','#4fc3f7','#aed581','#ba68c8','#ffd54f','#4db6ac','#f06292','#7986cb','#a1887f','#90a4ae','#dce775','#e57373'];
const POLICIES = {
  verde:    { nome:'Bairro verde', desc:'Terreno valoriza, indústria não cresce' },
  imposto:  { nome:'Imposto reduzido', desc:'Moradores pagam 30% menos e ficam mais felizes' },
  comercio: { nome:'Incentivo comercial', desc:'Comércio e escritórios crescem mais' },
  silencio: { nome:'Sem caminhões', desc:'Menos poluição e barulho, indústria rende menos' },
};

const GOALS = [
  { txt:'Desenhe uma rua',                              prog:()=>[Math.min(countRoads(),1),1] },
  { txt:'Pinte um bairro residencial ao lado da rua',   prog:()=>[Math.min(countZone(Z.RES),6),6] },
  { txt:'Chegue a 20 moradores',                        prog:()=>[Math.min(popTotal(),20),20] },
  { txt:'Crie bairros comerciais e industriais',        prog:()=>[Math.min(countB('com'),2)+Math.min(countB('ind'),2),4] },
  { txt:'Pinte uma fazenda (no mínimo 2×2)',            prog:()=>[Math.min(farms.size,1),1] },
  { txt:'Construa a fábrica de alimentos',              prog:()=>[Math.min(countB('processadora'),1),1] },
  { txt:'Construa a prefeitura',                        prog:()=>[Math.min(countB('prefeitura'),1),1] },
  { txt:'Compre um trator para uma fazenda',            prog:()=>[[...farms.values()].some(f=>f.level>=2)?1:0,1] },
  { txt:'Construa uma fonte de energia e de água',      prog:()=>[Math.min([...blds.values()].filter(b=>SERV[b.type]?.power).length,1)+Math.min([...blds.values()].filter(b=>SERV[b.type]?.water).length,1),2] },
  { txt:'Construa uma escola',                          prog:()=>[Math.min(countB('escola'),1),1] },
  { txt:'Crie uma linha de ônibus (garagem e 2 pontos)', prog:()=>[Math.min(countB('garagem'),1)+Math.min(countB('ponto'),2),3] },
  { txt:'Chegue a 1.000 moradores',                     prog:()=>[Math.min(popTotal(),1000),1000] },
  { txt:'Faça crescer um prédio de alta densidade',     prog:()=>[[...blds.values()].some(b=>b.dens===1)?1:0,1] },
  { txt:'Crie um bairro de escritórios',                prog:()=>[Math.min(countB('off'),2),2] },
  { txt:'Construa seu primeiro marco',                  prog:()=>[Math.min([...blds.values()].filter(b=>isMarco(b.type)).length,1),1] },
  { txt:'Amplie a prefeitura',                          prog:()=>[[...blds.values()].some(b=>b.type==='prefeitura'&&b.s>=3)?1:0,1] },
  { txt:'Ligue duas estações de trem',                  prog:()=>[Math.min(trainLinks,1),1] },
  { txt:'Crie um distrito',                             prog:()=>[Math.min(S.districts.length,1),1] },
  { txt:'Tenha 100 moradores de classe alta',           prog:()=>[Math.min(popByClass()[2],100),100] },
  { txt:'Chegue a 5.000 moradores',                     prog:()=>[Math.min(popTotal(),5000),5000] },
  { txt:'Chegue a 20.000 moradores (Metrópole)',       prog:()=>[Math.min(popTotal(),20000),20000] },
];

// ================== UTIL ==================
function rng(seed){ let a = seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const idx = (x,z) => z*N + x;
const inb = (x,z) => x>=0 && z>=0 && x<N && z<N;
const fmt = n => Math.round(n).toLocaleString('pt-BR');
const $ = s => document.querySelector(s);
const ico = (id, cls='ico') => `<svg class="${cls}"><use href="#i-${id}"/></svg>`;
const ib = id => `<span class="ib">${ico(id)}</span>`;
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
const grid = { t:new Uint8Array(N*N), b:new Int32Array(N*N).fill(-1), z:new Uint8Array(N*N), d:new Uint8Array(N*N), f:new Int32Array(N*N).fill(-1), r:new Uint8Array(N*N), e:new Uint8Array(N*N), dist:new Uint8Array(N*N) };
const cov = { edu:new Uint8Array(N*N), saude:new Uint8Array(N*N), seg:new Uint8Array(N*N), fogo:new Uint8Array(N*N), transit:new Float32Array(N*N) };
let trainLinks = 0;
const lv = new Float32Array(N*N), poll = new Uint8Array(N*N), park = new Uint8Array(N*N), nearWater = new Uint8Array(N*N);
const blds = new Map(), farms = new Map();
let nextId = 1, S;
const fresh = () => ({ roads:[],roadBase:{},lines:[],tax:100,budget:100,imports:false,wood:0,focus:'equilibrio',map:'rio',awards:[], districts:[], distSel:0, traffic:0, power:[0,0], water:[0,0], transitShare:0, money:12000, day:1, trigo:0, alim:30, merc:20, happy:70, speed:1, goal:0, inc:0, stage:0, alerts:[], dem:[0.6,0.2,0.3,-1], demR:[0.6,-1,-1], visit:0 });

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
const dirty = { roads:false, water:false, trees:false, zones:false, farms:false, dist:false, metro:false };

function genTerrain(seed){
  const R = rng(seed);
  grid.t.fill(T.EMPTY); grid.z.fill(0); grid.d.fill(0); grid.b.fill(-1); grid.f.fill(-1); grid.r.fill(0); grid.e.fill(0); grid.dist.fill(0);
  const ph = R()*6;
  for (let x=0;x<N;x++){
    const c = 5.5 + 2.6*Math.sin(x*0.17+ph) + 1.2*Math.sin(x*0.45+ph*2);
    for (let z=0;z<N;z++) if (S.map==='ilhas' ? Math.abs(z-c-9)<2 || (x>22 && Math.abs(z-31+5*Math.sin(x/6))<3) : S.map==='vale' ? Math.abs(x-27-6*Math.sin(z/9))<2.5 : Math.abs(z+0.5-c)<1.4) grid.t[idx(x,z)] = T.WATER;
  }
  for (let x=0;x<16;x++){ grid.t[idx(x,28)] = T.ROAD; grid.r[idx(x,28)] = 1; }
  const centers = Array.from({length:20}, ()=>[R()*N, R()*N, 2+R()*4.5]);
  for (let z=0;z<N;z++) for (let x=0;x<N;x++){
    const i=idx(x,z); if (grid.t[i]!==T.EMPTY) continue;
    if (Math.abs(z-28)<=4 && x<24) continue;
    if(S.map==='vale' && (x<6+3*Math.cos(z/6) || x>41-4*Math.sin(z/7))){
      grid.t[i]=T.ROCK;continue;
    }
    let p = 0.02;
    for (const [cx,cz,r] of centers){ const d=Math.hypot(x-cx,z-cz); if (d<r) p = Math.max(p, 0.75*(1-d/r)+0.1); }
    if (R() < p) grid.t[i] = T.TREE;
  }
}
const isWater = (x,z) => inb(x,z) && (grid.t[idx(x,z)]===T.WATER || grid.t[idx(x,z)]===T.BRIDGE);
const isRoad = (x,z) => inb(x,z) && !islands.has(idx(x,z)) && (grid.t[idx(x,z)]===T.ROAD || grid.t[idx(x,z)]===T.BRIDGE);
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
const isRail = (x,z) => inb(x,z) && (grid.t[idx(x,z)]===T.RAIL || grid.t[idx(x,z)]===T.RAILBR);
const isRoadAny = (x,z) => isRoad(x,z);
const singleLots=new Set();
const isSingle=i=>singleLots.has(i);
const engineered = new Map(), groundRoads = new Set(), islands=new Set();
const underDeck=i=>islands.has(i)||engineered.has(i+N*N)||engineered.has(i+3*N*N);
const roadSettings={shape:'line', bend:0.7, level:0, one:false};
let heatVisible=false;
let tripRoutes=[];
const heat=new Float32Array(N*N*4), tripsByNode=new Map();
function heatColor(x,z){
  if(!heatVisible) return null;
  const i=idx(x,z), flow=Math.max(heat[i],heat[i+N*N],heat[i+2*N*N],heat[i+3*N*N]);
  return flow>1?'#df5841':flow>0.55?'#e4a944':'#5cae89';
}
const snapEdges=new Map();
const joins=[];
function legacyRoad(i){
  const t=S.roadBase[i]?.[0]??(!groundRoads.has(i)?grid.t[i]:T.EMPTY);
  return t===T.ROAD || t===T.BRIDGE;
}
function indexRoads(){
  joins.length=0;
  snapEdges.clear();
  engineered.clear(); groundRoads.clear(); islands.clear();singleLots.clear();
  for(const r of S.roads.filter(r=>r.shape==='ring')){
    const radius=clamp(Math.hypot(r.b.x-r.a.x,r.b.z-r.a.z),1.6,5);
    for(let z=r.a.z-5;z<=r.a.z+5;z++)for(let x=r.a.x-5;x<=r.a.x+5;x++){
      if(inb(x,z)&&Math.hypot(x-r.a.x,z-r.a.z)<radius-0.63)islands.add(idx(x,z));
    }
  }
  for(const road of S.roads){
    const pts=roadSamples(road);
    for(let j=1;j<pts.length;j++){
      const p=pts[j],q=pts[j-1],i=idx(Math.round((p.x+q.x)/2),Math.round((p.z+q.z)/2));
      if(!snapEdges.has(i))snapEdges.set(i,[]);
      snapEdges.get(i).push([q,p,road,j===1,j===pts.length-1]);
    }
    if(road.a.x===road.b.x && road.a.z===road.b.z && road.shape!=='ring')singleLots.add(idx(road.a.x,road.a.z));
    for(const n of roadPath(road,N)){
      if(!n.band && islands.has(n.id)) continue;
      engineered.set(n.id,n.p);
      if(!n.band) groundRoads.add(n.id);
    }
  }
  for(const road of S.roads){
    if(road.shape==='ring')continue;
    const pts=roadSamples(road),last=pts.length-1;
    for(const [j,near] of [[0,1],[last,last-1]]){
      const tip=pts[j],prev=pts[near],cx=Math.round(tip.x),cz=Math.round(tip.z);
      const dx=tip.x-prev.x,dz=tip.z-prev.z,len=Math.hypot(dx,dz);
      let nearest=null,limit=1.18,targetStart=false,targetEnd=false;
      const consider=(x,z,h,start=false,end=false)=>{
        const vx=x-tip.x,vz=z-tip.z,d=Math.hypot(vx,vz);
        if(d>=limit||Math.abs(h-tip.h)>0.15)return;
        if(d>0.18 && len && (vx*dx+vz*dz)<d*len*0.45)return;
        if(d>0.18 && Math.abs(h)<0.24){
          for(const t of [0.25,0.5,0.75]){
            const i=idx(Math.round(tip.x+vx*t),Math.round(tip.z+vz*t));
            if(islands.has(i)||[T.RAIL,T.RAILBR,T.BUILD,T.FARM,T.ROCK,T.WATER].includes(grid.t[i]))return;
          }
        }
        nearest={x,z,h};limit=d;targetStart=start;targetEnd=end;
      };
      for(let z=cz-2;z<=cz+2;z++)for(let x=cx-2;x<=cx+2;x++){
        if(!inb(x,z))continue;
        const i=idx(x,z);
        if(islands.has(i))continue;
        if(legacyRoad(i))consider(x,z,0);
        for(const [a,b,owner,first,final] of snapEdges.get(i)||[]){
          if(owner===road)continue;
          const ex=b.x-a.x,ez=b.z-a.z,t=clamp(((tip.x-a.x)*ex+(tip.z-a.z)*ez)/(ex*ex+ez*ez||1),0,1);
          consider(a.x+t*ex,a.z+t*ez,a.h+t*(b.h-a.h),owner.one&&first&&t<0.001,owner.one&&final&&t>0.999);
        }
      }
      if(nearest){
        const band=h=>Math.abs(h)<0.24?0:h<0?2:h>1.35?3:1;
        const id=p=>idx(Math.round(p.x),Math.round(p.z))+band(p.h)*N*N;
        const a=tip,b=nearest;
        joins.push({a,b,from:id(a),to:id(b),out:(!road.one||j===last)&&!targetEnd,back:(!road.one||j===0)&&!targetStart,width:road.kind==='avenida'?1.22:0.83});
      }
    }
  }
}
function roadPoint(p){
  return {x:clamp(p.fx===undefined?p.x:p.fx-0.5,0,N-1),z:clamp(p.fz===undefined?p.z:p.fz-0.5,0,N-1)};
}
function snapPoint(p,height){
  if(!$('#snapRoad').checked) return p;
  let best=p, distance=1.12;
  const consider=(x,z)=>{const d=Math.hypot(x-p.x,z-p.z);if(d<distance){distance=d;best={x,z};}};
  const cx=Math.round(p.x),cz=Math.round(p.z);
  for(let z=cz-1;z<=cz+1;z++)for(let x=cx-1;x<=cx+1;x++){
    if(!inb(x,z))continue;
    const i=idx(x,z);
    if(!height && legacyRoad(i) && !islands.has(i))consider(x,z);
    for(const edge of snapEdges.get(i)||[]){
      const [a,b]=edge,dx=b.x-a.x,dz=b.z-a.z;
      const t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);
      if(Math.abs(a.h+t*(b.h-a.h)-height)<0.18)consider(a.x+dx*t,a.z+dz*t);
    }
  }
  return best;
}
function designRoad(start,end){
  const kind=tool==='avenida'?'avenida':'rua';
  const level=tool==='viaduto'?Math.max(1,roadSettings.level):roadSettings.level;
  const shape=roadSettings.shape, curved=['free','tangent'].includes(shape);
  if(shape==='upgrade'){
    const p=roadPoint(end);
    let selected=null,nearest=0.82;
    for(const existing of S.roads){
      if(existing.level!==level)continue;
      for(const v of roadSamples(existing)){
        const d=Math.hypot(v.x-p.x,v.z-p.z);
        if(d<nearest){nearest=d;selected=existing;}
      }
    }
    if(!selected)return {items:[],err:'Toque numa via desenhada nesta altura',label:'Toque numa via desenhada nesta altura',n:0,cost:0};
    const road={...selected,kind,one:selected.shape==='ring'||roadSettings.one};
    if($('#reverseRoad').checked && road.shape!=='ring'){
      [road.a,road.b]=[road.b,road.a];road.bend=-road.bend;
      if(road.offset)road.offset=-road.offset;
      if(road.ramps==='start')road.ramps='end';else if(road.ramps==='end')road.ramps='start';
    }
    const cost=kind==='avenida' && selected.kind!=='avenida'?20*roadPath(road,N).length:0;
    const err=cost>S.money?'Dinheiro insuficiente':'';
    return {road,replace:selected,items:[],err,cost,label:err||('Substituir · R$ '+fmt(cost))};
  }
  const ramps=roadSettings.ramps||'both';
  let a=curveClicks[0]||snapPoint(roadPoint(start),['both','start'].includes(ramps)?0:level);
  let b=roadPoint(end);
  if($('#snapAngle').checked && shape==='line'){
    const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),angle=Math.round(Math.atan2(dz,dx)*12/Math.PI)*Math.PI/12;
    b={x:clamp(a.x+len*Math.cos(angle),0,N-1),z:clamp(a.z+len*Math.sin(angle),0,N-1)};
  }
  b=snapPoint(b,['both','end'].includes(ramps)?0:level);
  if(shape==='ring')a={x:Math.round(a.x),z:Math.round(a.z)};
  const road={...roadSettings,level,kind,a,b,shape:curved?'curve':shape};
  if(curved) road.control=curveClicks[1]||a;
  if(shape==='tangent' && tangent){
    const dist=Math.hypot(b.x-a.x,b.z-a.z)*0.5;
    road.control={x:clamp(a.x+tangent.x*dist,0,N-1),z:clamp(a.z+tangent.z*dist,0,N-1)};
  }
  if(road.shape==='ring'){road.one=true;road.level=0;}
  const spacing=+$('#spacingRoad').value;
  if(shape==='grid'){
    const endPoint=road.b, corners=curveClicks;
    const axis=corners[1]||endPoint;
    const dx=axis.x-a.x,dz=axis.z-a.z,width=Math.hypot(dx,dz);
    if(width<0.35||corners.length<2)return validateRoad({...road,shape:'line',b:axis});
    const ux=dx/width,uz=dz/width,depth=(endPoint.x-axis.x)*(-uz)+(endPoint.z-axis.z)*ux;
    const pos=(w,d)=>({x:a.x+ux*w-uz*d,z:a.z+uz*w+ux*d});
    const children=[];
    const add=(p,q)=>children.push({...road,a:p,b:q,shape:'line',level:0,one:false});
    const nx=Math.max(1,Math.round(width/spacing)),nz=Math.max(1,Math.round(Math.abs(depth)/spacing));
    for(let j=0;j<=nx;j++)add(pos(width*j/nx,0),pos(width*j/nx,depth));
    for(let j=0;j<=nz;j++)add(pos(0,depth*j/nz),pos(width,depth*j/nz));
    return groupRoads(children);
  }
  if($('#parallelRoad').checked && shape!=='ring')return groupRoads([road,{...road,offset:spacing}]);
  return validateRoad(road);
}
function groupRoads(roads){
  const plans=roads.map(validateRoad),first=plans[0],cost=plans.reduce((sum,p)=>sum+p.cost,0);
  const err=plans.find(p=>p.err)?.err || (cost>S.money?'Dinheiro insuficiente':'');
  return {...first,roads,cost,err,label:err||('R$ '+fmt(cost)+' · '+roads.length+' vias')};
}
function validateRoad(road){
  const {a,b,kind,shape}=road;
  const nodes=roadPath(road,N),length=Math.hypot(b.x-a.x,b.z-a.z);
  const cost=nodes.reduce((s,n)=>s+(road.level<0?80:road.level>0?60:isWater(n.x,n.z)?50:kind==='avenida'?30:10),0);
  let err='';
  if([a,b].some(p=>p.x<0||p.x>N-1||p.z<0||p.z>N-1))err='Traçado fora do mapa';
  else if(road.shape==='ring' && Array.from({length:121},(_,j)=>[a.x+j%11-5,a.z+Math.floor(j/11)-5]).some(([x,z])=>inb(x,z)&&Math.hypot(x-a.x,z-a.z)<clamp(length,1.6,5)-0.5 && [T.BUILD,T.FARM,T.RAIL,T.WATER].includes(grid.t[idx(x,z)]))) err='Libere a ilha central da rotatória';
  else if(nodes.some(n=>!inb(n.x,n.z))) err='Traçado fora do mapa';
  else if(nodes.some(n=>grid.e[idx(n.x,n.z)] && n.band===1)) err='Já existe um viaduto nessa altura';
  else if(nodes.some(n=>!n.band && ![T.EMPTY,T.TREE,T.WATER,T.BRIDGE,T.ROAD].includes(grid.t[idx(n.x,n.z)]))) err='A entrada ou pista ocupa um lote construído';
  else if(nodes.some(n=>n.band!==2 && grid.b[idx(n.x,n.z)]>=0)) err='Prédio no traçado';
  else if(road.level && road.ramps!=='none' && length<5) err='Arraste pelo menos 5 lotes para as rampas';
  else if(length<0.35 && shape!=='ring') err='Escolha o fim da via';
  else if(cost>S.money) err='Dinheiro insuficiente';
  const items=nodes.map(n=>[n.x,n.z,err?'bad':'ok']);
  return {road,items,n:nodes.length,cost,err,label:err||(length.toFixed(1)+' lotes · '+Math.round(Math.atan2(b.z-a.z,b.x-a.x)*180/Math.PI)+'° · R$ '+fmt(cost))};
}
function applyRoad(road){
  // Redrawing the same alignment replaces its class or direction.
  const same=(p,q)=>p?.x===q?.x && p?.z===q?.z;
  S.roads=S.roads.filter(r=>{
    if((r.offset||0)!==(road.offset||0)||r.shape!==road.shape||r.level!==road.level||!same(r.control,road.control)) return true;
    const forward=same(r.a,road.a)&&same(r.b,road.b);
    const reverse=r.shape!=='ring'&&same(r.a,road.b)&&same(r.b,road.a);
    return !(forward||reverse) || (r.shape==='curve'&&!r.control&&r.bend!==(forward?road.bend:-road.bend));
  });
  S.roads.push(road);
  for(const n of roadPath(road,N)){
    if(n.band) continue;
    const i=n.id;
    S.roadBase[i]??=[grid.t[i]===T.TREE?T.EMPTY:grid.t[i],grid.r[i]];
    grid.t[i]=isWater(n.x,n.z)?T.BRIDGE:T.ROAD;
    grid.r[i]=road.kind==='avenida'?2:1; grid.z[i]=0;
  }
  indexRoads();
  for(const f of farms.values()) pickBarn(f);
  dirty.roads=dirty.trees=dirty.water=dirty.zones=dirty.farms=true;
}
function removeRoadSegments(items){
  const touched=new Set(items.map(([x,z])=>idx(x,z)));
  const layer=$('#demoLayer').value;
  const removed=new Set();
  S.roads=S.roads.filter(r=>{
    if(layer!=='auto' && r.level!==+layer) return true;
    const hits=roadPath(r,N).filter(n=>touched.has(idx(n.x,n.z)));
    if(!hits.length)return true;
    if(layer==='auto' && items.length===1 && removed.size) return true;
    hits.forEach(n=>removed.add(idx(n.x,n.z)));
    return false;
  });
  indexRoads();
  for(const [key,base] of Object.entries(S.roadBase)){
    if(groundRoads.has(+key)||islands.has(+key)) continue;
    grid.t[key]=base[0]; grid.r[key]=base[1]; delete S.roadBase[key];
  }
  dirty.roads=dirty.water=true;
  return removed;
}
function extendGraph(add){
  for(const r of S.roads){
    const nodes=roadPath(r,N);
    for(const n of nodes) if(!islands.has(n.id) && !G.road.has(n.id)) G.road.set(n.id,[]);
    for(let j=1;j<nodes.length;j++){
      const a=nodes[j-1].id, b=nodes[j].id;
      if(islands.has(a)||islands.has(b)) continue;
      add(G.road,a,b); if(!r.one) add(G.road,b,a);
    }
  }
}

function rebuildRoads(updateGraph=true){
  indexRoads();
  const k = new Kit();
  const ER = (x,z) => inb(x,z) && (grid.e[idx(x,z)]===1 || grid.e[idx(x,z)]===3);   // camada elevada de rua (deck ou rampa)
  const ET = (x,z) => inb(x,z) && (grid.e[idx(x,z)]===2 || grid.e[idx(x,z)]===4);
  for (let z=0;z<N;z++) for (let x=0;x<N;x++){
    const i = idx(x,z), t = grid.t[i], e = grid.e[i], X=wx(x), Zc=wx(z);
    // ---------- rua / avenida / ponte ----------
    if (!islands.has(i) && legacyRoad(i) && (t===T.ROAD || t===T.BRIDGE)){
      const n={ e:isRoad(x+1,z), w:isRoad(x-1,z), s:isRoad(x,z+1), nn:isRoad(x,z-1) };
      if (t===T.BRIDGE){
        k.add(box(1,0.08,1), '#9b7650', X,0.06,Zc, { edges:false });
        k.add(box(0.86,0.01,0.86), '#6e7177', X,0.105,Zc, { edges:false });
        if (!n.e) k.add(box(0.06,0.12,1), '#6b4f36', X+0.47,0.16,Zc);
        if (!n.w) k.add(box(0.06,0.12,1), '#6b4f36', X-0.47,0.16,Zc);
        if (!n.s) k.add(box(1,0.12,0.06), '#6b4f36', X,0.16,Zc+0.47);
        if (!n.nn) k.add(box(1,0.12,0.06), '#6b4f36', X,0.16,Zc-0.47);
      } else {
        const ave = grid.r[i]===2;
        k.add(box(1,0.03,1), heatColor(x,z) || (ave ? '#5d6066' : '#6e7177'), X,0.015,Zc, { edges:false });
        if (!n.e)  k.add(box(0.12,0.05,1), '#d5d0c4', X+0.44,0.025,Zc, { edges:false });
        if (!n.w)  k.add(box(0.12,0.05,1), '#d5d0c4', X-0.44,0.025,Zc, { edges:false });
        if (!n.s)  k.add(box(1,0.05,0.12), '#d5d0c4', X,0.025,Zc+0.44, { edges:false });
        if (!n.nn) k.add(box(1,0.05,0.12), '#d5d0c4', X,0.025,Zc-0.44, { edges:false });
        const hz = n.e||n.w, vt = n.s||n.nn;
        if (ave && hz && !vt){ k.add(box(1,0.05,0.1), '#7ab850', X,0.025,Zc, { edges:false }); if ((x+z)%2===0) k.add(cyl(0.012,0.012,0.4,5), '#3b3f44', X,0.2,Zc, { edges:false }); }
        else if (ave && vt && !hz){ k.add(box(0.1,0.05,1), '#7ab850', X,0.025,Zc, { edges:false }); if ((x+z)%2===0) k.add(cyl(0.012,0.012,0.4,5), '#3b3f44', X,0.2,Zc, { edges:false }); }
        else if (hz && !vt) for (const o of [-0.25,0.25]) k.add(box(0.22,0.033,0.04), '#f3ecd6', X+o,0.017,Zc, { edges:false });
        else if (vt && !hz) for (const o of [-0.25,0.25]) k.add(box(0.04,0.033,0.22), '#f3ecd6', X,0.017,Zc+o, { edges:false });
        if (hz && vt && (n.e+n.w+n.s+n.nn)>=3) for (const o of [-0.33,-0.11,0.11,0.33]){ k.add(box(0.08,0.032,0.14), '#f3ecd6', X+o,0.017,Zc+0.38, { edges:false }); }
      }
    }
    // ---------- trilhos ----------
    if (t===T.RAIL || t===T.RAILBR){
      if (t===T.RAILBR){ k.add(box(1,0.1,0.7), '#7a8086', X,0.07,Zc, { edges:false }); }
      const nb = DIRS.filter(([,dx,dz])=>isRail(x+dx,z+dz) || ET(x+dx,z+dz));
      const segs = nb.length ? nb : [[0,1,0],[0,-1,0]];
      for (const [,dx,dz] of segs){
        const cx = X+dx*0.25, cz = Zc+dz*0.25, y = t===T.RAILBR ? 0.12 : 0.0;
        if (dx){ k.add(box(0.52,0.04,0.46), '#a39883', cx,y+0.02,Zc, { edges:false }); for (const o of [-0.17,0,0.17]) k.add(box(0.06,0.02,0.4), '#7a5a3e', cx+o,y+0.045,Zc, { edges:false }); for (const o of [-0.1,0.1]) k.add(box(0.52,0.025,0.025), '#8c939a', cx,y+0.065,Zc+o, { edges:false }); }
        else { k.add(box(0.46,0.04,0.52), '#a39883', X,y+0.02,cz, { edges:false }); for (const o of [-0.17,0,0.17]) k.add(box(0.4,0.02,0.06), '#7a5a3e', X,y+0.045,cz+o, { edges:false }); for (const o of [-0.1,0.1]) k.add(box(0.025,0.025,0.52), '#8c939a', X+o,y+0.065,cz, { edges:false }); }
      }
    }
    // ---------- vias elevadas ----------
    if (e===1 || e===2){
      const isR = e===1, H = 0.62, same = isR ? ER : ET;
      k.add(box(1,0.08,1), '#bfb8aa', X,H-0.04,Zc);
      k.add(box(1,0.012,1), isR ? '#6e7177' : '#a39883', X,H+0.006,Zc, { edges:false });
      const nb = { e:same(x+1,z), w:same(x-1,z), s:same(x,z+1), nn:same(x,z-1) };
      if (!nb.e) k.add(box(0.05,0.1,1), '#e9e6df', X+0.475,H+0.05,Zc);
      if (!nb.w) k.add(box(0.05,0.1,1), '#e9e6df', X-0.475,H+0.05,Zc);
      if (!nb.s) k.add(box(1,0.1,0.05), '#e9e6df', X,H+0.05,Zc+0.475);
      if (!nb.nn) k.add(box(1,0.1,0.05), '#e9e6df', X,H+0.05,Zc-0.475);
      if (!isR){ const hz = nb.e||nb.w; for (const o of [-0.1,0.1]) k.add(hz ? box(1,0.025,0.025) : box(0.025,0.025,1), '#8c939a', hz?X:X+o, H+0.02, hz?Zc+o:Zc, { edges:false }); }
      else if ((nb.e||nb.w) && !(nb.s||nb.nn)) for (const o of [-0.25,0.25]) k.add(box(0.22,0.014,0.04), '#f3ecd6', X+o,H+0.012,Zc, { edges:false });
      else if ((nb.s||nb.nn) && !(nb.e||nb.w)) for (const o of [-0.25,0.25]) k.add(box(0.04,0.014,0.22), '#f3ecd6', X,H+0.012,Zc+o, { edges:false });
      if (t===T.PILLAR || t===T.WATER || t===T.EMPTY || t===T.TREE) k.add(box(0.18,H-0.08,0.18), '#cfc8b8', X,(H-0.08)/2,Zc);
      else { const hz = isRoad(x+1,z)||isRoad(x-1,z)||isRail(x+1,z)||isRail(x-1,z); for (const o of [-0.46,0.46]) k.add(box(hz?0.08:0.08,H-0.08,0.08), '#cfc8b8', hz?X:X+o,(H-0.08)/2,hz?Zc+o:Zc); }
    }
    if (e===3 || e===4){
      const same = e===3 ? (xx,zz)=>inb(xx,zz)&&grid.e[idx(xx,zz)]===1 : (xx,zz)=>inb(xx,zz)&&grid.e[idx(xx,zz)]===2;
      const d = DIRS.find(([,dx,dz])=>same(x+dx,z+dz));
      if (d){
        const [,dx,dz] = d, a = Math.atan2(0.62, 1.05);
        const o = dx ? { rz: dx>0 ? a : -a } : { rx: dz>0 ? -a : a };
        k.add(dx ? box(1.12,0.07,0.9) : box(0.9,0.07,1.12), e===3 ? '#6e7177' : '#a39883', X+dx*0.02,0.31,Zc+dz*0.02, o);
        k.add(dx ? box(1.12,0.1,0.04) : box(0.04,0.1,1.12), '#e9e6df', X+(dz?0.45:0)+dx*0.02,0.37,Zc+(dx?0.45:0)+dz*0.02, o);
        k.add(dx ? box(1.12,0.1,0.04) : box(0.04,0.1,1.12), '#e9e6df', X-(dz?0.45:0)+dx*0.02,0.37,Zc-(dx?0.45:0)+dz*0.02, o);
      }
    }
  }
  for(const road of S.roads) addRoadMesh(k,road,box,wx,isWater,heatColor,(x,z)=>islands.has(idx(x,z)));
  for(const {a,b,width} of joins){
    const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
    const deck=p=>0.058+p.h*0.85+(isWater(Math.round(p.x),Math.round(p.z))?0.065:0);
    const ya=deck(a),yb=deck(b),color=heatColor(Math.round(a.x),Math.round(a.z))||'#666972';
    if(length>0.02)k.add(box(width,0.065,Math.hypot(length,yb-ya)+0.04),color,wx((a.x+b.x)/2),(ya+yb)/2,wx((a.z+b.z)/2),{ry:Math.atan2(dx,dz),rx:-Math.atan2(yb-ya,length),edges:false});
    for(const p of [a,b])k.add(cyl(width/2,width/2,0.064,16),color,wx(p.x),deck(p)+0.002,wx(p.z),{edges:false});
  }
  roadObj = swap(roadObj, kitObject(k, { shadow:false }));
  if(updateGraph) buildGraphs();
}

// ---------- grafos de transporte (duas camadas: chão e elevado) ----------
const G = { road:new Map(), rail:new Map(), comp:new Int32Array(N*N*4).fill(-1) };
const node = (i, L) => i + L*N*N;
function nodePos(n, out, rail=false){ const p=!rail && engineered.get(n); if(p) return out.set(wx(p.x),p.h*0.85+(isWater(Math.round(p.x),Math.round(p.z))?0.11:0.045),wx(p.z)); const L = n >= N*N ? 1 : 0, i = n % (N*N), x = i%N, z = (i/N)|0; out.set(wx(x), L ? 0.64 : ((grid.e[i]===3||grid.e[i]===4) ? 0.33 : (grid.t[i]===T.BRIDGE||grid.t[i]===T.RAILBR ? 0.11 : 0.03)), wx(z)); return out; }
function buildGraphs(){
  G.road.clear(); G.rail.clear();
  const add = (m, a, b) => { (m.get(a) || m.set(a, []).get(a)).push(b); };
  for (let z=0;z<N;z++) for (let x=0;x<N;x++){
    const i = idx(x,z);
    for (const [,dx,dz] of DIRS){
      const nx=x+dx, nz=z+dz; if (!inb(nx,nz)) continue; const j = idx(nx,nz);
      if (isRoad(x,z) && isRoad(nx,nz) && (legacyRoad(i)&&legacyRoad(j) || !(groundRoads.has(i) && groundRoads.has(j)) || isSingle(i)||isSingle(j))) add(G.road, node(i,0), node(j,0));
      if (grid.e[i]===1 && grid.e[j]===1) add(G.road, node(i,1), node(j,1));
      if (grid.e[i]===3 && grid.e[j]===1){ add(G.road, node(i,0), node(j,1)); add(G.road, node(j,1), node(i,0)); }
      if (isRail(x,z) && isRail(nx,nz)) add(G.rail, node(i,0), node(j,0));
      if (grid.e[i]===2 && grid.e[j]===2) add(G.rail, node(i,1), node(j,1));
      if (grid.e[i]===4 && grid.e[j]===2){ add(G.rail, node(i,0), node(j,1)); add(G.rail, node(j,1), node(i,0)); }
    }
  }
  // componentes da rede de ruas (para energia e água)
  extendGraph(add);
  for(const j of joins){
    if(j.from===j.to)continue;
    if(j.out)add(G.road,j.from,j.to);
    if(j.back)add(G.road,j.to,j.from);
  }
  const physical=new Map();
  for(const [a,edges] of G.road) for(const b of edges){add(physical,a,b);add(physical,b,a);}
  G.comp.fill(-1); let c = 0;
  for (const n of G.road.keys()){
    if (G.comp[n] >= 0) continue;
    const q = [n]; G.comp[n] = c;
    while (q.length){ const a = q.pop(); for (const b of physical.get(a) || []) if (G.comp[b] < 0){ G.comp[b] = c; q.push(b); } }
    c++;
  }
  for (let i=0;i<N*N;i++) if (isRoad(i%N,(i/N)|0) && G.comp[i] < 0) G.comp[i] = c++;
  tripRoutes=[]; agents=[]; vehiclesDirty = true; if (typeof computeTrains==='function' && blds) computeTrains();
}
function compOf(b){
  for (const [x,z] of footprint(b)) for (const [,dx,dz] of DIRS){ const nx=x+dx, nz=z+dz; if (isRoad(nx,nz)) return G.comp[idx(nx,nz)]; }
  return -1;
}
function bfsPath(graph, from, targets){
  const prev = new Map([[from, -1]]), q = [from];
  for(let head=0;head<q.length;head++){const a=q[head]; if (targets.has(a) && a !== from) { const p = []; let c = a; while (c !== -1){ p.push(c); c = prev.get(c); } return p.reverse(); } for (const b of graph.get(a) || []) if (!prev.has(b)){ prev.set(b, a); q.push(b); } }
  return null;
}
function rebuildTrees(){
  const k = new Kit();
  for (let z=0;z<N;z++) for (let x=0;x<N;x++){
    const i=idx(x,z);
    if(grid.t[i]===T.ROCK){
      const h=0.35+0.14*Math.max(0,7-Math.min(x,47-x));
      k.add(cyl(0.55,0.8,h,6),'#9b9987',wx(x),h/2,wx(z),{ry:0.4,edges:false});
      continue;
    }
    if(grid.t[i]!==T.TREE) continue;
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
    const a = b.fw*b.fd*[1,1,1.25,1.5][b.lvl||1], f = b.floors||1, cm = b.capMul||1;
    if (b.type==='res') return { cap: Math.max(2, Math.round(b.dens ? a*f*3.2*cm : a*3*(0.6+0.4*f)*cm)), jobs:0, manut:0 };
    if (b.type==='com') return { cap:0, jobs: b.dens ? Math.round(a*Math.max(3,f)*1.6) : a*3, manut:0 };
    if (b.type==='off') return { cap:0, jobs: b.dens ? Math.round(a*Math.max(3,f)*1.8) : a*4, manut:0 };
    return { cap:0, jobs: b.dens ? a*6 : a*4, manut:0 };
  }
  if (isMarco(b.type)) return { cap:0, jobs:MARCOS[b.type].jobs, manut:MARCOS[b.type].manut };
  if (b.type==='prefeitura') return { cap:0, jobs:4+b.s*2, manut:4+b.s*3 };
  const d = SPECIAL[b.type]; return { cap:0, jobs:d.jobs||0, manut:d.manut||0 };
}
function footprint(b){ const r=[]; for(let dz=0;dz<b.gd;dz++) for(let dx=0;dx<b.gw;dx++) r.push([b.gx+dx, b.gz+dz]); return r; }
function sqTiles(w, ax, az){ const r=[]; for(let dz=0;dz<w;dz++) for(let dx=0;dx<w;dx++) r.push([ax+dx, az+dz]); return r; }
function roadSide(w, ax, az, pred=isRoad){
  const sides = [
    [0,           Array.from({length:w},(_,i)=>[ax+i, az+w])],
    [Math.PI/2,   Array.from({length:w},(_,i)=>[ax+w, az+i])],
    [-Math.PI/2,  Array.from({length:w},(_,i)=>[ax-1, az+i])],
    [Math.PI,     Array.from({length:w},(_,i)=>[ax+i, az-1])],
  ];
  for (const [rot, tiles] of sides) if (tiles.some(([x,z])=>pred(x,z))) return rot;
  return null;
}
const hasRoad = b => b.zone ? footprint(b).some(([x,z])=>roadAdj1(x,z)) : SERV[b.type]?.deco ? true : SERV[b.type]?.needs==='rail' ? roadSide(b.gw,b.gx,b.gz,isRail)!==null : roadSide(b.gw,b.gx,b.gz)!==null;

function makeKit(b){
  const k = new Kit(), R = rng(b.seed);
  if (b.zone) modelOf(b).f(k, R, b.fw, b.fd);
  else if (b.type==='prefeitura') prefModel(k, R, b.s);
  else if (isMarco(b.type)) LANDMARKS[b.type](k, R);
  else if(b.type==='floresta'){SERVICE_MODELS.armazem(k,R);addTree(k,0.7,0.6,R,0.65);}
  else if(b.type==='serraria') SPECIAL_MODELS.processadora(k,R);
  else if (SERVICE_MODELS[b.type]) SERVICE_MODELS[b.type](k, R);
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
  b.height = isMarco(b.type) ? 3 : 0.3 + (k.floors||1)*0.25;
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
function clearFx(b){ for (const g of b.fx||[]) fxGroup.remove(g); b.fx = []; if (b.warn){ world.remove(b.warn); b.warn = null; } b.warnT = null; }
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
  const b = { id:o.id ?? nextId++, type:o.type, zone:!!o.zone, dens:o.dens||0, v:o.v||0, cls:o.cls||0, lvl:o.lvl||1, pw:true, wt:true, fw:o.fw||1, fd:o.fd||1, s:o.s||0,
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
// avisos sobre os prédios: sem rua, sem energia, sem água
function iconTex(draw){ const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'); x.strokeStyle='#3a2e28'; x.lineWidth=5; x.lineJoin='round'; draw(x); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return new THREE.SpriteMaterial({ map:t, depthTest:false }); }
const WARN_MATS = {
  road: iconTex(x=>{ x.fillStyle='#ffcf4a'; x.beginPath(); x.moveTo(32,6); x.lineTo(59,55); x.lineTo(5,55); x.closePath(); x.fill(); x.stroke(); x.fillStyle='#3a2e28'; x.fillRect(29,22,6,18); x.beginPath(); x.arc(32,47,3.6,0,7); x.fill(); }),
  power: iconTex(x=>{ x.fillStyle='#fff6e3'; x.beginPath(); x.arc(32,32,27,0,7); x.fill(); x.stroke(); x.fillStyle='#f2c14e'; x.beginPath(); x.moveTo(36,10); x.lineTo(20,36); x.lineTo(31,36); x.lineTo(27,54); x.lineTo(45,26); x.lineTo(34,26); x.closePath(); x.fill(); x.lineWidth=3; x.stroke(); }),
  water: iconTex(x=>{ x.fillStyle='#fff6e3'; x.beginPath(); x.arc(32,32,27,0,7); x.fill(); x.stroke(); x.fillStyle='#4f9fd8'; x.beginPath(); x.moveTo(32,11); x.bezierCurveTo(44,28,46,34,46,40); x.arc(32,40,14,0,Math.PI); x.bezierCurveTo(18,34,20,28,32,11); x.fill(); x.lineWidth=3; x.stroke(); }),
};
function setWarn(b, type){
  if (b.warnT === type) return;
  if (b.warn){ world.remove(b.warn); b.warn = null; }
  b.warnT = type;
  if (type){ const s = new THREE.Sprite(WARN_MATS[type]); s.scale.setScalar(0.42); s.position.copy(b.center).setY(b.height+0.5); s.renderOrder = 10; world.add(s); b.warn = s; }
}

// ================== VEÍCULOS ==================
let vehiclesDirty = true, trainsDirty = true, quality = 'alta';
const MAXV = () => quality==='alta' ? 90 : 36;
const vehMat = new THREE.MeshToonMaterial({ vertexColors:true, gradientMap:gradTex });
const carMesh = new THREE.InstancedMesh(carGeometry(), vehMat, 90); carMesh.count = 0; carMesh.castShadow = true;
const truckMesh = new THREE.InstancedMesh(truckGeometry(), vehMat, 30); truckMesh.count = 0; truckMesh.castShadow = true;
const busGeo = (()=>{ const k = new Kit(); k.add(box(0.15,0.13,0.42), '#ffffff', 0,0.1,0); k.add(box(0.152,0.05,0.38), '#cfe6ef', 0,0.13,0, { edges:false }); for (const z of [-0.13,0.13]) for (const x of [-0.07,0.07]) k.add(box(0.02,0.05,0.05), '#2f2f33', x,0.025,z); const g = k.geometry(); k.dispose(); return g; })();
const busMesh = new THREE.InstancedMesh(busGeo, vehMat, 24); busMesh.count = 0; busMesh.castShadow = true;
world.add(carMesh, truckMesh, busMesh);
const CARCOL = ['#d9443a','#3f7fc4','#f2c14e','#f4f4f0','#4a4f57','#5aa36b','#e98b2a','#9b6fd6','#69c3d3'].map(c=>new THREE.Color(c));
let agents = [];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _s = new THREE.Vector3(1,1,1), _up = new THREE.Vector3(0,1,0);
function accessNode(b){
  for(const [x,z] of footprint(b)) for(const [,dx,dz] of DIRS){
    if(isRoad(x+dx,z+dz)) return idx(x+dx,z+dz);
  }
  return -1;
}
function activeLines(){
  const result=[];
  for(const line of S.lines){
    const stops=line.stops.map(id=>blds.get(id)).filter(b=>b?.road);
    if(stops.length<2) continue;
    if(line.type==='metro'){result.push({source:line,type:'metro',stops,path:[]});continue;}
    if(![...blds.values()].some(b=>b.type==='garagem' && b.road && G.comp[accessNode(b)]===G.comp[accessNode(stops[0])])) continue;
    const path=[];
    let valid=true;
    for(let j=0;j<stops.length;j++){
      const a=accessNode(stops[j]),b=accessNode(stops[(j+1)%stops.length]);
      if(a===b) continue;
      const leg=bfsPath(G.road,a,new Set([b]));
      if(!leg){valid=false;break;}
      path.push(...leg.slice(0,-1));
    }
    if(valid && path.length>1) result.push({source:line,type:'bus',stops,path:[...path,path[0]]});
  }
  return result;
}
function assignTrips(list,lines){
  heat.fill(0); tripsByNode.clear(); tripRoutes=[];
  const jobs=list.filter(b=>b.road && bStat(b).jobs);
  const shops=list.filter(b=>b.road && ['com','armazem','processadora','serraria'].includes(b.type));
  const starts=list.filter(b=>b.road && (b.pop>0 || ['ind','floresta','serraria'].includes(b.type)));
  const stride=Math.max(1,Math.ceil(starts.length/80));
  for(let j=0;j<starts.length;j+=stride){
    const b=starts[j], freight=b.type!=='res', targets=freight?shops:jobs;
    if(!targets.length) continue;
    const dest=targets[b.id%targets.length], from=accessNode(b),to=accessNode(dest);
    if(from===to || from<0 || to<0) continue;
    const path=bfsPath(G.road,from,new Set([to]));
    if(!path) continue;
    const volume=stride*(freight?bStat(b).jobs*0.25:b.pop*0.32)*(freight?1:1-S.transitShare);
    const trip={kind:freight?'truck':'car',path,from:b,to:dest,volume};
    tripRoutes.push(trip);
    for(const n of path){
      heat[n]+=volume/(grid.r[n%(N*N)]===2?44:22);
      if(!tripsByNode.has(n)||tripsByNode.get(n).volume<volume) tripsByNode.set(n,trip);
    }
  }
  for(const l of lines) if(l.type==='bus') tripRoutes.push({kind:'bus',path:l.path});
}
function syncVehicles(){
  const quota={car:MAXV(),truck:quality==='alta'?30:10,bus:Math.min(24,4*[...blds.values()].filter(b=>b.type==='garagem'&&b.road).length)};
  const previous=new Map();
  for(const agent of agents){
    if(agent.pos>=agent.path.length-1 || !G.road.get(agent.from)?.includes(agent.to)) continue;
    const key=agent.routeKey;
    if(!previous.has(key))previous.set(key,[]);
    previous.get(key).push(agent);
  }
  agents=[];
  for(const route of tripRoutes){
    const path=route.path, count=Math.min(quota[route.kind],route.kind==='bus'?4:Math.max(1,Math.ceil(route.volume/6)));
    if(!count || path.length<2) continue;
    quota[route.kind]-=count;
    const key=route.kind+':'+path.join(',');
    const retained=(previous.get(key)||[]).splice(0,count);
    agents.push(...retained);
    for(let i=retained.length;i<count;i++){
      const pos=Math.min(path.length-2,Math.floor(path.length*i/count));
      agents.push({kind:route.kind,path,pos,routeKey:key,from:path[pos],to:path[pos+1],t:0,sp:route.kind==='car'?1.5:1,col:CARCOL[i%CARCOL.length],wait:0});
    }
  }
}
function updateVehicles(dt){
  const slow = 1 / Math.max(1, (S.traffic||0)*0.9);
  const counts = { car:0, truck:0, bus:0 }, mesh = { car:carMesh, truck:truckMesh, bus:busMesh };
  for (const a of agents){
    if(a.pos>=a.path.length-1 || !G.road.get(a.from)?.includes(a.to)) continue;
    if (a.wait > 0) a.wait -= dt; else a.t += dt*a.sp*S.speed*slow/Math.max(1,heat[a.from]);
    while(a.t>=1 && a.pos<a.path.length-1){a.t--;a.pos++;a.from=a.path[a.pos];a.to=a.path[a.pos+1]??a.from;}
    if(a.from===a.to || !G.road.get(a.from)?.includes(a.to)) continue;
    nodePos(a.from, _a); nodePos(a.to, _b);
    _p.lerpVectors(_a, _b, a.t);
    const dx = _b.x-_a.x, dz = _b.z-_a.z, len = Math.hypot(dx,dz) || 1;
    _p.x += -dz/len*0.17; _p.z += dx/len*0.17;   // mão direita
    const yaw = Math.atan2(dx, dz);
    const pitch = Math.atan2(_b.y-_a.y, len);
    _q.setFromEuler(new THREE.Euler(-pitch, yaw, 0, 'YXZ'));
    _m.compose(_p, _q, _s);
    const m = mesh[a.kind], c = counts[a.kind]++;
    if (c >= m.instanceMatrix.count) continue;
    m.setMatrixAt(c, _m);
    m.setColorAt(c, a.kind==='bus' ? CARCOL[2] : a.kind==='truck' ? CARCOL[3] : a.col);
  }
  for (const k of ['car','truck','bus']){ const m = mesh[k]; m.count = counts[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
}
// trens
let trains = [];
const trainKit = (loco)=>{ const k = new Kit(); k.add(box(0.2,0.2,0.44), loco ? '#d9443a' : '#f2f0ea', 0,0.16,0); k.add(box(0.205,0.06,0.4), '#a3d3e6', 0,0.2,0, { edges:false }); k.add(box(0.21,0.03,0.46), '#3b3f44', 0,0.05,0); if (loco) k.add(box(0.18,0.08,0.06), '#3b3f44', 0,0.12,0.22); return kitObject(k); };
const locoObj = trainKit(true), wagonObj = trainKit(false);
function rebuildTrains(){
  for (const t of trains) for (const c of t.cars) world.remove(c);
  trains = trainRoutes.slice(0, 8).map(p=>({ pts:p.map(n=>nodePos(n, new THREE.Vector3(),true)), t:0, dir:1, cars:[locoObj.clone(), wagonObj.clone(), wagonObj.clone()] }));
  for (const t of trains) for (const c of t.cars) world.add(c);
  trainsDirty = false;
}
function posOnPath(pts, s, out){ const n = pts.length; s = clamp(s, 0, n-1.001); const i = Math.floor(s), u = s-i; return out.lerpVectors(pts[i], pts[Math.min(n-1,i+1)], u); }
function updateTrains(dt){
  for (const tr of trains){
    const n = tr.pts.length; if (n < 2) continue;
    if (tr.wait > 0){ tr.wait -= dt; } else {
      tr.t += dt * 1.6 * tr.dir * (S.speed ? 1 : 0.25);
      if (tr.t >= n-1){ tr.t = n-1; tr.dir = -1; tr.wait = 1.5; } else if (tr.t <= 0){ tr.t = 0; tr.dir = 1; tr.wait = 1.5; }
    }
    tr.cars.forEach((c, k)=>{
      const s = tr.t - tr.dir*k*0.48;
      posOnPath(tr.pts, s, _a); posOnPath(tr.pts, s + 0.05*tr.dir, _b);
      c.position.copy(_a); c.position.y += 0.03;
      c.rotation.set(0, Math.atan2(_b.x-_a.x, _b.z-_a.z) || c.rotation.y, 0);
    });
  }
}
// linhas de metrô (desenhadas quando a categoria Transporte está aberta)
let metroObj = null;
function rebuildMetro(){
  if (metroObj){ world.remove(metroObj); disposeObj(metroObj); metroObj = null; }
  const k=new Kit();
  const pairs=activeLines().filter(l=>l.type==='metro').flatMap(l=>l.stops.slice(1).map((b,i)=>[l.stops[i],b]));
  if(!pairs.length){k.dispose();return;}
  for(const [a,b] of pairs){
    const dx = b.center.x-a.center.x, dz = b.center.z-a.center.z, len = Math.hypot(dx,dz);
    k.add(box(0.16, 0.03, len), '#7350c0', (a.center.x+b.center.x)/2, 0.05, (a.center.z+b.center.z)/2, { ry: Math.atan2(dx, dz), edges:false });
  }
  const g = k.geometry(); k.dispose();
  metroObj = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors:true, transparent:true, opacity:0.75, depthTest:false }));
  metroObj.renderOrder = 4; metroObj.visible = cat==='transporte' || tool==='metro'; world.add(metroObj);
}

// ================== DISTRITOS: camada e nomes ==================
let distObj = null, distLabels = [];
function labelSprite(text, color){
  const c = document.createElement('canvas'), x = c.getContext('2d'); x.font = '44px "Lilita One", sans-serif';
  const w = Math.ceil(x.measureText(text).width) + 48; c.width = w; c.height = 76;
  x.font = '44px "Lilita One", sans-serif'; x.fillStyle = '#fff6e3'; x.strokeStyle = '#3a2e28'; x.lineWidth = 6;
  x.beginPath(); x.roundRect(4,6,w-8,62,22); x.fill(); x.stroke();
  x.fillStyle = color; x.beginPath(); x.arc(30,37,10,0,7); x.fill(); x.lineWidth = 3; x.stroke();
  x.fillStyle = '#3a2e28'; x.fillText(text, 46, 52);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:t, depthTest:false })); s.scale.set(w/76*0.55, 0.55, 1); s.renderOrder = 12; return s;
}
function rebuildDistricts(){
  if (distObj){ world.remove(distObj); disposeObj(distObj); distObj = null; }
  for (const l of distLabels) world.remove(l); distLabels = [];
  const k = new Kit(), sum = S.districts.map(()=>[0,0,0]);
  for (let i=0;i<N*N;i++){ const d = grid.dist[i]; if (!d) continue; const x=i%N, z=(i/N)|0; sum[d-1][0]+=x; sum[d-1][1]+=z; sum[d-1][2]++;
    const D = S.districts[d-1]; if (!D) continue;
    for (const [,dx,dz] of DIRS){ const nx=x+dx, nz=z+dz; if (!inb(nx,nz) || grid.dist[idx(nx,nz)]!==d) k.add(box(dx?0.08:1, 0.02, dz?0.08:1), D.cor, wx(x)+dx*0.46, 0.07, wx(z)+dz*0.46, { edges:false }); }
  }
  const g = k.geometry(); k.dispose();
  if (g){ distObj = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors:true, transparent:true, opacity:0.85 })); distObj.renderOrder = 3; world.add(distObj); }
  S.districts.forEach((D, j)=>{ const [sx,sz,n] = sum[j]; if (!n) return; const l = labelSprite(D.nome, D.cor); l.position.set(wx(sx/n), 1.6, wx(sz/n)); world.add(l); distLabels.push(l); });
  showDistricts();
}
function showDistricts(){ const on = tool==='distrito' || tool==='semdistrito' || cat==='bairros' || showDistAlways; if (distObj) distObj.visible = on; for (const l of distLabels) l.visible = on || showDistAlways; }
let showDistAlways = true;

// ================== SOM ==================
let AC = null, sfxOn = true, musicOn = true, musicTimer = null;
function audio(){ if (!AC){ try{ AC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if (AC?.state==='suspended') AC.resume(); return AC; }
function tone(f, t0, dur, type='triangle', vol=0.12){ const a = AC; if (!a) return; const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, a.currentTime+t0); g.gain.setValueAtTime(0, a.currentTime+t0); g.gain.linearRampToValueAtTime(vol, a.currentTime+t0+0.01); g.gain.exponentialRampToValueAtTime(0.0008, a.currentTime+t0+dur); o.connect(g).connect(a.destination); o.start(a.currentTime+t0); o.stop(a.currentTime+t0+dur+0.05); }
function noise(t0, dur, vol=0.15){ const a = AC; if (!a) return; const b = a.createBuffer(1, a.sampleRate*dur, a.sampleRate), d = b.getChannelData(0); for (let i=0;i<d.length;i++) d[i] = (Math.random()*2-1)*(1-i/d.length); const s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter(); f.type='lowpass'; f.frequency.value = 900; s.buffer = b; g.gain.value = vol; s.connect(f).connect(g).connect(a.destination); s.start(a.currentTime+t0); }
function sfx(kind){
  if (!sfxOn || !audio()) return;
  if (kind==='click') tone(660, 0, 0.06, 'square', 0.04);
  else if (kind==='build'){ tone(392,0,0.09); tone(587,0.07,0.14); }
  else if (kind==='road') tone(220, 0, 0.07, 'square', 0.05);
  else if (kind==='demo'){ noise(0, 0.25, 0.18); tone(110,0,0.2,'sawtooth',0.05); }
  else if (kind==='goal'){ [523,659,784].forEach((f,i)=>tone(f, i*0.09, 0.18)); }
  else if (kind==='stage'){ [523,659,784,1046].forEach((f,i)=>tone(f, i*0.12, 0.3, 'triangle', 0.14)); }
  else if (kind==='err') tone(160, 0, 0.15, 'square', 0.05);
}
const SCALE = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3];
const CHORDS = [[0,2,4],[3,5,7],[4,6,1],[3,5,0]];
let beat = 0;
function musicStep(){
  if (!musicOn || !AC || AC.state!=='running') return;
  const ch = CHORDS[Math.floor(beat/8) % CHORDS.length];
  if (beat % 8 === 0) for (const n of ch) tone(SCALE[n%8]/2, 0, 2.6, 'sine', 0.025);
  if (beat % 2 === 0 || Math.random() < 0.35){ const n = ch[Math.random()*3|0] + (Math.random()<0.4 ? 2 : 0); tone(SCALE[n%8]*(Math.random()<0.25?2:1), 0, 0.5, 'triangle', 0.035); }
  beat++;
}
function startMusic(){ if (!musicTimer) musicTimer = setInterval(musicStep, 340); }

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
const popByClass = () => { const p=[0,0,0]; for (const b of blds.values()) if (b.type==='res') p[b.cls]+=b.pop; return p; };
const clsOk = c => S.stage >= CLASSES[c].stage;
const marcoSlots = () => S.stage - [...blds.values()].filter(b=>isMarco(b.type)).length;
const countRoads = () => { let n=0; for (let i=0;i<N*N;i++) if (grid.t[i]===T.ROAD||grid.t[i]===T.BRIDGE) n++; return Math.max(0, n-16); };
const countAve = () => { let n=0; for (let i=0;i<N*N;i++) if (grid.t[i]===T.ROAD && grid.r[i]===2) n++; return n; };
const countElev = () => { let n=0; for (let i=0;i<N*N;i++) if (grid.e[i]) n++; return n; };
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
    else if (isMarco(b.type)) mark(b, 6, park);
    else if (SERV[b.type]?.polui) mark(b, SERV[b.type].polui, poll);
    else if (SERV[b.type]?.deco) mark(b, 2, park);
  }
  const pf = list.find(b=>b.type==='prefeitura');
  for (let i=0;i<N*N;i++){
    const dd = grid.dist[i] ? S.districts[grid.dist[i]-1] : null;
    let v = 0.3 + (park[i]?0.22:0) + (nearWater[i]?0.12:0) - (poll[i]?0.35:0) + (cov.edu[i]?0.06:0) + (cov.saude[i]?0.06:0) + (cov.seg[i]?0.05:0) + (cov.fogo[i]?0.03:0) + cov.transit[i]*0.15 + (dd?.pol?.verde?0.15:0) - (dd?.pol?.silencio?-0.05:0);
    if (pf){ const x=i%N, z=(i/N)|0; if (Math.abs(x-(pf.gx+pf.gw/2))<=pf.gw/2+4 && Math.abs(z-(pf.gz+pf.gd/2))<=pf.gd/2+4) v += 0.12; }
    lv[i] = clamp(v,0,1);
  }
}

// ================== SERVIÇOS, ENERGIA, ÁGUA, TRANSPORTE ==================
function markR(arr, b, r, val=1){
  const cx = b.gx + b.gw/2, cz = b.gz + b.gd/2, r2 = (r + b.gw/2)**2;
  for (let z=Math.floor(cz-r-b.gd/2); z<=cz+r+b.gd/2; z++) for (let x=Math.floor(cx-r-b.gw/2); x<=cx+r+b.gw/2; x++){
    if (!inb(x,z)) continue; const dx = x+0.5-cx, dz = z+0.5-cz; if (dx*dx+dz*dz <= r2){ const i = idx(x,z); arr[i] = Math.max(arr[i], val); }
  }
}
function computeServices(list){
  cov.edu.fill(0); cov.saude.fill(0); cov.seg.fill(0); cov.fogo.fill(0); cov.transit.fill(0);
  const lines=activeLines();
  const served=new Set(lines.flatMap(l=>l.stops));
  for (const b of list){
    const d = SERV[b.type]; if (!d || !b.road) continue;
    const eff = b.staff !== undefined && bStat(b).jobs ? Math.max(0.5, b.staff/bStat(b).jobs) : 1;
    if (d.serv) markR(cov[d.serv], b, d.raio*eff*S.budget/100);
    if (d.transit==='bus' && served.has(b)) markR(cov.transit, b, d.raio, 0.35);
    if (d.transit==='metro' && served.has(b)) markR(cov.transit, b, d.raio, 0.7);
    if (d.transit==='trem' && b.linked) markR(cov.transit, b, d.raio, 0.6);
  }
  // energia e água por rede de ruas
  const comps = new Map();
  const C = id => comps.get(id) || comps.set(id, { p:0, w:0, dp:0, dw:0 }).get(id);
  for (const b of list){
    b.comp = compOf(b);
    const d = SERV[b.type];
    if (d?.power && b.road) C(b.comp).p += d.power * (d.jobs ? 0.5 + 0.5*Math.min(1,(b.staff||0)/(d.jobs)) : 1);
    if (d?.water && b.road) C(b.comp).w += d.water * (d.jobs ? 0.5 + 0.5*Math.min(1,(b.staff||0)/(d.jobs)) : 1);
    const need=b.zone ? 0.12+0.035*(b.pop+b.staff) : (d?.deco?0:0.5);
    b.need = need;
    if (b.comp >= 0){ C(b.comp).dp += need; C(b.comp).dw += need; }
  }
  for(const c of comps.values()){c.p*=S.budget/100;c.w*=S.budget/100;}
  let P = [0,0], W = [0,0];
  for (const c of comps.values()){ P[0]+=c.p; P[1]+=c.dp; W[0]+=c.w; W[1]+=c.dw; }
  S.power = P; S.water = W;
  const pop = popTotal(), grace = pop <= 60;
  for (const b of list){
    const c = comps.get(b.comp), h = (b.id*2654435761 % 1000)/1000;
    if (grace || SERV[b.type]?.deco){ b.pw = b.wt = true; continue; }
    b.pw = !!c && c.dp > 0 && h < c.p / c.dp;
    b.wt = !!c && c.dw > 0 && h < c.w / c.dw;
  }
}
function servicesAt(b){ const i = idx(b.gx + (b.gw>>1), b.gz + (b.gd>>1)); return (cov.edu[i]?1:0) + (cov.saude[i]?1:0) + (cov.seg[i]?1:0) + (cov.fogo[i]?1:0); }
// prédios sobem de nível com energia, água, serviços e terreno valorizado
function levelUp(list){
  for (const b of list){
    if (!b.zone || b.anim || !b.road || !b.pw || !b.wt) continue;
    const lvl = b.lvl || 1; if (lvl >= 3) continue;
    const v = lv[idx(b.gx,b.gz)], sv = servicesAt(b);
    const ok = lvl===1 ? (v >= 0.35 && sv >= 1) : (v >= 0.5 && sv >= 3);
    if (!ok || Math.random() > 0.02) continue;
    b.lvl = lvl + 1; unspawn(b); spawnVisual(b, true);
  }
}
// ---------- trens: ligam estações vizinhas pela malha de trilhos ----------
let trainRoutes = [], trainSig = '';
function stationNodes(b){ const s = new Set(); for (const [x,z] of footprint(b)) for (const [,dx,dz] of DIRS){ const nx=x+dx, nz=z+dz; if (isRail(nx,nz)) s.add(node(idx(nx,nz),0)); } return s; }
function computeTrains(){
  const st = [...blds.values()].filter(b=>b.type==='estacao');
  trainRoutes = []; trainLinks = 0;
  for (const b of st) b.linked = false;
  for (let i=0;i<st.length;i++) for (let j=i+1;j<st.length;j++){
    const A = stationNodes(st[i]), B = stationNodes(st[j]); if (!A.size || !B.size) continue;
    const p = bfsPath(G.rail, [...A][0], B);
    if (p && p.length > 1){ trainRoutes.push(p); st[i].linked = st[j].linked = true; trainLinks++; }
  }
  const sig = trainRoutes.map(r=>r[0]+'-'+r[r.length-1]+'-'+r.length).join('|');
  if (sig !== trainSig){ trainSig = sig; trainsDirty = true; }
}
// ---------- distritos ----------
const distOf = b => grid.dist[idx(b.gx + (b.gw>>1), b.gz + (b.gd>>1))];
const policy = (b, p) => { const d = distOf(b); return d && S.districts[d-1]?.pol?.[p]; };
function newDistrict(){
  const used = new Set(S.districts.map(d=>d.nome));
  const nome = DIST_NAMES.find(n=>!used.has(n)) || `Distrito ${S.districts.length+1}`;
  S.districts.push({ nome, cor: DIST_COLS[S.districts.length % DIST_COLS.length], pol:{} });
  return S.districts.length;
}

// ================== SIMULAÇÃO ==================
function jobKey(b){
  if (isServ(b.type)) return 'serv';
  if (b.type==='com') return b.dens ? 'com1' : 'com0';
  if (isMarco(b.type)) return 'marco';
  return b.type;
}
function tick(){
  S.day++;
  const list = [...blds.values()];
  for (const b of list) b.road = hasRoad(b);
  computeServices(list);
  computeLand(list);
  for (const b of list) setWarn(b, !b.road ? 'road' : !b.pw ? 'power' : !b.wt ? 'water' : null);
  const ok = b => (b.pw && b.wt) ? 1 : 0.5;

  const houses = list.filter(b=>b.type==='res');
  const popC = [0,0,0]; for (const h of houses) popC[h.cls] += h.pop;
  const pop = popC[0]+popC[1]+popC[2];
  const pool = popC.map(p=>Math.floor(p*0.5));
  const workers = pool.reduce((a,b)=>a+b,0);
  // empregos agrupados por quem pode trabalhar
  const jobB = list.filter(b=>bStat(b).jobs && b.road);
  const farmL = [...farms.values()].filter(f=>f.barn>=0);
  const groups = {};
  for (const b of jobB){ const k = jobKey(b); (groups[k] ||= { jobs:0, items:[] }); groups[k].jobs += bStat(b).jobs; groups[k].items.push(b); }
  if (farmL.length){ groups.fazenda ||= { jobs:0, items:[] }; for (const f of farmL){ groups.fazenda.jobs += farmJobs(f); groups.fazenda.items.push(f); } }
  const order = ['fazenda','processadora','com0','serv','prefeitura','ind','com1','off','marco'];
  const free = [0,0,0];
  let totalJobs = 0;
  for (const k of order){
    const g = groups[k]; if (!g) continue; totalJobs += g.jobs;
    let need = g.jobs;
    for (const c of (JOBCLS[k]||[0,1])){ const t = Math.min(need, pool[c]); pool[c] -= t; need -= t; }
    g.ratio = g.jobs ? (g.jobs-need)/g.jobs : 0;
    for (const c of (JOBCLS[k]||[0,1])) free[c] += need;
  }
  for (const b of list){ b.staff=0; b.out=0; }
  for (const f of farms.values()){ f.staff=0; f.out=0; }
  for (const k in groups) for (const it of groups[k].items) it.staff = Math.round((it.tiles ? farmJobs(it) : bStat(it).jobs) * groups[k].ratio);
  const unemployed = pool.reduce((a,b)=>a+b,0);
  const sr = b => b.staff/bStat(b).jobs;

  for (const f of farmL){ const p = farmLots(f)*0.4*EQUIP[f.level].mult*(f.staff/farmJobs(f)); S.trigo += p; f.out = p; }
  for (const b of jobB) if (b.type==='processadora'){ const use = Math.min(S.trigo, 8*sr(b)*ok(b)); S.trigo -= use; S.alim += use; b.out = use; }
  for (const b of jobB) if (b.type==='ind'){ const p = bStat(b).jobs*0.2*sr(b)*ok(b)*(policy(b,'silencio')?0.8:1); S.merc += p; b.out = p; }

  for(const b of jobB){
    if(b.type==='floresta'){b.out=3*sr(b)*ok(b);S.wood+=b.out;}
    if(b.type==='serraria'){const used=Math.min(S.wood,6*sr(b)*ok(b));S.wood-=used;b.out=used*1.6;S.merc+=b.out;}
  }
  const depots=jobB.filter(b=>b.type==='armazem').length;
  const importUnits=S.imports?Math.min(4+depots*12,Math.max(0,pop*0.07-S.alim),Math.max(0,S.money)/2):0;
  S.alim+=importUnits;
  // turismo
  const marcos = list.filter(b=>(isMarco(b.type) || SERV[b.type]?.visit) && b.road);
  for (const m of marcos) m.out = (MARCOS[m.type]||SERV[m.type]).visit * (0.4 + 0.6*sr(m)) * (0.5 + S.happy/200) * ok(m);
  const visit = marcos.reduce((s,m)=>s+m.out,0); S.visit = visit;

  const shops = jobB.filter(b=>b.type==='com');
  const capOf = b => bStat(b).jobs*1.4*sr(b)*ok(b)/Math.max(1, Math.sqrt(S.traffic||1));
  const cap = shops.reduce((s,b)=>s+capOf(b),0);
  const dF = pop*0.05, dG = pop*0.04;
  const sF = Math.min(dF, S.alim, cap); S.alim -= sF;
  const sG = Math.min(dG, S.merc, cap - sF); S.merc -= sG;
  const sT = Math.min(visit*0.1, Math.max(0, cap - sF - sG));
  for (const b of shops) b.out = cap ? (sF+sG+sT)*capOf(b)/cap : 0;
  let export_ = 0;
  if (S.merc > 60){ export_ = Math.min(S.merc-60, 10); S.merc -= export_; }
  if (S.trigo > 200){ const e = Math.min(S.trigo-200, 10); S.trigo -= e; export_ += e*0.5; }

  const small = pop <= 60;
  const foodR = small ? 1 : (dF ? sF/dF : 1);
  const goodsR = small ? 1 : (dG ? sG/dG : 1);
  const staffOf = t => jobB.filter(b=>b.type===t).reduce((s,b)=>s+b.staff,0);
  let taxes = staffOf('com')*0.2 + staffOf('ind')*0.2 + staffOf('off')*0.35;
  for (const h of houses) taxes += h.pop*CLASSES[h.cls].tax*(policy(h,'imposto')?0.7:1);
  taxes*=S.tax/100;
  const tourism=(visit*0.6+sT*1.5)*(S.focus==='turismo'?1.45:S.focus==='industria'?0.8:1);
  const timber=Math.min(S.wood,depots*4);
  S.wood-=timber; S.wood=Math.min(S.wood,100+400*depots);
  const sales=sF*0.6+sG*0.8+(export_*0.5+timber*1.25)*(S.focus==='industria'?1.5:S.focus==='turismo'?0.8:1);
  let maint = countRoads()*0.1 + pop*0.05 + countAve()*0.1 + countElev()*0.3; for (const b of list) maint += bStat(b).manut*(isServ(b.type)?S.budget/100:1);
  for (const f of farms.values()) maint += farmLots(f)*0.05*f.level;
  maint+=S.roads.reduce((sum,r)=>sum+(r.level?0.17:0.02)*Math.hypot(r.a.x-r.b.x,r.a.z-r.b.z),0);
  const importCost=importUnits*2;
  S.ledger={taxes,sales,tourism,maint,importCost,timber,importUnits};
  S.inc = taxes + sales + tourism - maint-importCost; S.money += S.inc;
  const stockCap = 250 + list.filter(b=>b.type==='armazem'&&b.road).length*400;
  S.stockCap = stockCap;
  S.trigo = Math.min(S.trigo, stockCap); S.alim = Math.min(S.alim, stockCap); S.merc = Math.min(S.merc, stockCap);

  let nearPark = 0, polluted = 0, servOk = 0, noUtil = 0, transitH = 0, distBonus = 0, popH = 0;
  for (const h of houses){
    const fp = footprint(h); if (fp.some(([x,z])=>park[idx(x,z)])) nearPark++; if (fp.some(([x,z])=>poll[idx(x,z)])) polluted++;
    servOk += servicesAt(h)/4; if (!h.pw || !h.wt) noUtil++;
    const ci = idx(h.gx,h.gz); transitH += cov.transit[ci]*h.pop; popH += h.pop;
    if (policy(h,'imposto')) distBonus += 5; if (policy(h,'verde')) distBonus += 3;
  }
  const nH = Math.max(1, houses.length);
  S.transitShare = popH ? Math.min(0.6, transitH/popH) : 0;
  // trânsito: viagens de carro contra capacidade das vias
  if(S.day%3===0 || !tripRoutes.length) assignTrips(list,activeLines());
  const trips = (pop*0.32 + totalJobs*0.12) * (1 - S.transitShare);
  const structuralNodes=[...engineered.keys()].filter(n=>n>=N*N).length;
  const capRoad = structuralNodes*7+countRoads()*7 + countAve()*9 + countElev()*10 + 30;
  const busy=heat.reduce((sum,h)=>sum+Math.max(0,h-1),0);
  S.traffic=trips/capRoad+busy/Math.max(1,G.road.size);
  if(heatVisible && S.day%6===0) rebuildRoads(false);
  const unempR = (!small && workers>0) ? unemployed/workers : 0;
  const servNeed = S.stage >= 1 ? 1 : (pop > 150 ? 0.5 : 0);
  const target = clamp(30 - (S.tax-100)*0.28 + 38*foodR + 10*goodsR + 15*nearPark/nH + (prefB()?6:0) + Math.min(8, marcos.length*3) + 12*servOk/nH*servNeed - 12*servNeed + 6*S.transitShare + distBonus/nH - 45*unempR - 25*polluted/nH - 30*noUtil/nH - clamp((S.traffic-1)*12, 0, 15), 0, 100);
  S.happy += (target - S.happy)*0.12;

  // demanda: residencial por classe, comércio, indústria, escritórios
  const jobsOf = t => list.filter(b=>b.type===t).reduce((s,b)=>s+bStat(b).jobs,0);
  const base = [8 + (pop<40?14:0), 5, 3];
  S.demR = [0,1,2].map(c => !clsOk(c) ? -1 : clamp((free[c] - pool[c] + base[c]) / (8 + popC[c]*0.15) - (S.happy<40?0.5:0), -1, 1));
  const dR = Math.max(...S.demR);
  const dC = clamp((pop*0.18 + 3 + visit*0.08 - jobsOf('com')) / (4 + pop*0.05), -1, 1);
  const dI = clamp((pop*0.22 + 4 - jobsOf('ind')) / (5 + pop*0.06), -1, 1);
  const dO = S.stage < 1 ? -1 : clamp(((popC[1]+popC[2])*0.3 + 4 - jobsOf('off')) / (5 + pop*0.05), -1, 1);
  S.dem = [dR, dC, dI, dO];

  growZones();
  const gChance = S.happy>=40 && dR>-0.4 ? (S.happy-35)/65*0.35 : 0;
  for (const h of houses){ const c = bStat(h).cap; if (h.road && h.pw && h.wt && h.pop<c && S.demR[h.cls] > -0.5 && Math.random()<gChance) h.pop = Math.min(c, h.pop + Math.max(1, Math.round(c*0.12*Math.random()))); }
  if (S.happy < 35) for (const h of houses) if (h.pop>0 && Math.random() < (35-S.happy)/35*0.15) h.pop--;
  climbClass(houses);
  levelUp(list);
  computeTrains();

  const p2 = popTotal();
  while (S.stage < STAGES.length-1 && p2 >= STAGES[S.stage+1].pop){ S.stage++; sfx('stage'); toast(`Agora você é ${STAGES[S.stage].nome}!`, 'city'); onStageUp(); }

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
  if (!small && goodsR < 0.7 && shops.length) A.push(['box', jobB.some(b=>b.type==='ind') ? (unemployed ? 'Indústria não dá conta: pinte mais zona industrial' : 'Indústrias sem trabalhadores: precisa de mais moradores') : 'Lojas sem mercadorias: pinte zona industrial']);
  if (unempR > 0.25) A.push(['job', S.stage>=1 && pool[1]+pool[2] > pool[0] ? 'Desemprego na classe média e alta: pinte escritórios' : 'Desemprego: pinte zonas comerciais ou industriais']);
  if (polluted/nH > 0.2) A.push(['smog','Indústria perto das casas deixa moradores infelizes']);
  if (totalJobs && workers/totalJobs < 0.6) A.push(['pop','Faltam trabalhadores: pinte zona residencial']);
  if (S.power[1] > S.power[0] + 0.5 && pop > 60) A.push(['power', S.power[0] ? 'Falta energia: construa mais usinas' : 'Sem energia: construa uma usina ligada às ruas']);
  if (S.water[1] > S.water[0] + 0.5 && pop > 60) A.push(['water', S.water[0] ? "Falta água: construa mais caixas d'água ou bombas" : "Sem água: construa uma caixa d'água ligada às ruas"]);
  if (S.traffic > 1.15) A.push(['car','Trânsito pesado: avenidas, viadutos ou transporte público']);
  if (servNeed && servOk/nH < 0.5) A.push(['school','Faltam serviços: escola, saúde, polícia e bombeiros']);
  if (S.money < 0) A.push(['money-bad','Cofres no vermelho']);
  const badges=[pop>60 && foodR>=0.9, pop>=1000 && S.inc>0, pop>=5000 && (timber>=2 || visit>=20), pop>=20000 && S.happy>=60 && S.inc>=0];
  badges.forEach((ok,i)=>{if(ok&&!S.awards.includes(i)){S.awards.push(i);S.money+=[500,2000,6000,15000][i];toast('Desafio municipal concluído','star');}});
  S.alerts = A;
  checkGoals();
}
function onStageUp(){
  updateDens(); buildToolbar();
  const c = CLASSES.findIndex(k=>k.stage===S.stage);
  if (c > 0) setTimeout(()=>toast(`Classe ${CLASSES[c].nome.toLowerCase()} chegando à cidade`, 'pop'), 2300);
}
// famílias sobem de classe: a casa é reformada para um modelo melhor
function climbClass(houses){
  for (const h of houses){
    if (h.cls >= 2 || !clsOk(h.cls+1) || h.anim) continue;
    const st = bStat(h); if (h.pop < st.cap*0.9) continue;
    const v = lv[idx(h.gx,h.gz)]; if (v < [0.5,0.66][h.cls] || S.happy < 55) continue;
    if (h.cls===1 && !cov.edu[idx(h.gx,h.gz)]) continue;
    if (Math.random() > 0.015) continue;
    const list = ZONE_MODELS.res[h.dens];
    const opts = list.map((m,i)=>[m,i]).filter(([m])=>m.lux===h.cls+1 && m.sizes.some(([a,b])=>a===h.fw&&b===h.fd));
    if (!opts.length) continue;
    const [, vi] = opts[Math.random()*opts.length|0];
    unspawn(h); h.cls++; h.v = vi; h.seed = Math.random()*1e9|0;
    spawnVisual(h, true); h.pop = Math.min(h.pop, bStat(h).cap);
    dirty.zones = true;
  }
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
  const cand = [[],[],[],[],[]];
  for (let z=0;z<N;z++) for (let x=0;x<N;x++){
    const i = idx(x,z), zn = grid.z[i];
    if (zn && free(grid.t[i]) && roadAdj1(x,z)) cand[zn].push([x,z]);
  }
  const maxA = STAGES[S.stage].maxArea;
  const demOf = [0, S.dem[0], S.dem[1], S.dem[2], S.dem[3]];
  for (let zn=1; zn<=4; zn++){
    const d = demOf[zn]; if (d <= 0.05 || !cand[zn].length) continue;
    const tries = 1 + Math.floor(d*3);
    for (let t=0; t<tries && cand[zn].length; t++){
      if (Math.random() > d*0.85) continue;
      const [x,z] = cand[zn].splice(Math.random()*cand[zn].length|0, 1)[0];
      const i0 = idx(x,z); if (!free(grid.t[i0])) continue;
      const dens = grid.d[i0]; if (dens && !highOk()) continue;
      const dI = grid.dist[i0] ? S.districts[grid.dist[i0]-1]?.pol || {} : {};
      if (zn===3 && dI.verde) continue;
      if ((zn===2||zn===4) && !dI.comercio && Math.random() < 0.25) continue;
      const type = ZKEY[zn], list = ZONE_MODELS[type][dens];
      // classe que se muda: sorteada pela demanda de cada classe, limitada pelo valor do terreno
      let cls = 0;
      if (type==='res'){
        const w = S.demR.map((v,c)=> v>0.05 ? v : 0);
        let tot = w.reduce((a,b)=>a+b,0), r = Math.random()*tot;
        for (let c=0;c<3;c++){ r -= w[c]; if (r <= 0 && w[c] > 0){ cls = c; break; } }
        while (cls > 0 && lv[i0] < [0,0.3,0.5][cls]) cls--;
      }
      const dirs = DIRS.filter(([,dx,dz])=>isRoad(x+dx,z+dz));
      const opts = [];
      for (const [rot,dx,dz] of dirs) list.forEach((m,v)=>{
        if (type==='res' && m.lux !== cls) return;
        for (const [fw,fd] of m.sizes){
          const a = fw*fd; if (a > maxA) continue;
          for (let o=0;o<fw;o++){
            const tiles = lotTiles(x,z,dx,dz,fw,fd,o);
            if (!tiles.every(([tx,tz])=>inb(tx,tz) && grid.z[idx(tx,tz)]===zn && grid.d[idx(tx,tz)]===dens && free(grid.t[idx(tx,tz)]) && !underDeck(idx(tx,tz)))) continue;
            opts.push({ w:Math.pow(a, type==='res' ? 0.9 : 1.1), rot, v, fw, fd, tiles });
          }
        }
      });
      if (!opts.length) continue;
      let r = Math.random()*opts.reduce((s,o)=>s+o.w,0), pickO = opts[0];
      for (const o of opts){ r -= o.w; if (r <= 0){ pickO = o; break; } }
      const xs = pickO.tiles.map(t=>t[0]), zs = pickO.tiles.map(t=>t[1]);
      const gx = Math.min(...xs), gz = Math.min(...zs), gw = Math.max(...xs)-gx+1, gd = Math.max(...zs)-gz+1;
      placeB({ type, zone:true, dens, cls, v:pickO.v, fw:pickO.fw, fd:pickO.fd, gx, gz, gw, gd, rot:pickO.rot, pop: type==='res' ? 1 : 0 }, true);
    }
  }
}

function checkGoals(){
  while (S.goal < GOALS.length){
    const [a,b] = GOALS[S.goal].prog();
    if (a>=b){ S.goal++; sfx('goal'); toast(S.goal<GOALS.length ? 'Meta concluída!' : 'Todas as metas concluídas!', S.goal<GOALS.length?'check':'star'); } else break;
  }
}

// ================== PREFEITURA ==================
function expandOptions(b){
  const ns = b.s+1, old = new Set(footprint(b).map(([x,z])=>idx(x,z))), out = [];
  for (const ox of [b.gx-1, b.gx]) for (const oz of [b.gz-1, b.gz]){
    const tiles = sqTiles(ns, ox, oz);
    if (!tiles.every(([x,z])=>inb(x,z))) continue;
    const blocked = tiles.filter(([x,z])=>{ const i=idx(x,z); return !old.has(i) && (!free(grid.t[i])||underDeck(i)); });
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
    const data = { v:6, S:{...S, alerts:[]}, t:Array.from(grid.t), z:Array.from(grid.z), d:Array.from(grid.d), r:Array.from(grid.r), e:Array.from(grid.e), dist:Array.from(grid.dist), nextId,
      b:[...blds.values()].map(b=>({ id:b.id, type:b.type, zone:b.zone, dens:b.dens, cls:b.cls, lvl:b.lvl, v:b.v, fw:b.fw, fd:b.fd, s:b.s, gx:b.gx, gz:b.gz, gw:b.gw, gd:b.gd, rot:b.rot, pop:b.pop, seed:b.seed })),
      f:[...farms.values()].map(f=>({ id:f.id, tiles:[...f.tiles], level:f.level, seed:f.seed })) };
    lastSave = JSON.stringify(data);
    localStorage.setItem(SAVE_KEY, lastSave);
  }catch(e){}
}
let lastSave = '';
function load(src){
  try{
    const raw=src ?? (localStorage.getItem(SAVE_KEY) || localStorage.getItem('cidade_proto_v5') || localStorage.getItem('cidade_proto_v4'));
    if(!raw) return false;
    const d=decodeCity(raw,N,SPECIAL,ZONE_MODELS);
    applyCity(d);
    return true;
  }catch(e){console.warn(e);return false;}
}
function applyCity(d){
    closeInfo();
    for(const id of [...blds.keys()]) removeB(id);
    for(const f of [...farms.values()]) removeFarm(f);
    agents=[]; tripRoutes=[]; heat.fill(0); tripsByNode.clear();
    S = Object.assign(fresh(), d.S);
    if(d.legacyLines){for(const type of ['metro','bus']){const stops=d.b.filter(b=>b.type===(type==='bus'?'ponto':'metro')).map(b=>b.id);if(stops.length>1)S.lines.push({type,stops});}}
    grid.t.set(d.t); grid.z.set(d.z); grid.d.set(d.d); grid.r.set(d.r); grid.e.set(d.e); grid.dist.set(d.dist); grid.b.fill(-1); grid.f.fill(-1);
    for (let i=0;i<N*N;i++) if (grid.t[i]===T.BUILD || grid.t[i]===T.FARM) grid.t[i]=T.EMPTY;
    nextId = d.nextId;
    rebuildWater();
    for (const b of d.b){ const nb = placeB(b, false); nb.lvl = b.lvl || 1; }
    for (const f of d.f) newFarm(f.tiles, f);

}
function newGame(){
  for (const id of [...blds.keys()]) removeB(id);
  for (const f of [...farms.values()]) removeFarm(f);
  S = fresh(); S.map=$('#mapChoice').value; nextId = 1; agents=[]; tripRoutes=[]; heat.fill(0); tripsByNode.clear();
  genTerrain(Math.random()*1e6|0); grid.r.fill(0); grid.e.fill(0); grid.dist.fill(0);
  for (let i=0;i<N*N;i++) if (grid.t[i]===T.ROAD) grid.r[i] = 1;
  rebuildAll(); resetCamera(); setSpeed(1); save();
}
function rebuildAll(){ rebuildWater(); rebuildRoads(); rebuildTrees(); rebuildZones(); rebuildFarms(); dirty.dist = dirty.metro = true; trainsDirty = true; }

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
const pvOk = mk('#5fd35a'), pvBad = mk('#e5533f'), pvSkip = mk('#ffffff',0.22), pvFarm = mk('#e7cd63',0.6), pvDist = mk('#ffb74d',0.5);
const pvZone = [null, [mk('#5fbf4a',0.6),mk('#2f8f3a',0.6)], [mk('#4f8fe0',0.6),mk('#2f5fb8',0.6)], [mk('#e6b43a',0.6),mk('#c4801e',0.6)], [mk('#a07ae0',0.6),mk('#7350c0',0.6)]];
const pvPool = []; const pvGroup = new THREE.Group(); world.add(pvGroup);
function pvTile(i, x, z, mat, w=1, h=0.08){
  let m = pvPool[i]; if (!m){ m = new THREE.Mesh(pvGeo, pvOk); m.renderOrder=5; pvPool[i]=m; pvGroup.add(m); } m.rotation.y=0;
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
  const k = new Kit(); if(type==="floresta") SERVICE_MODELS.armazem(k,rng(42)); else if(type==="serraria") SPECIAL_MODELS.processadora(k,rng(42)); else if (type==='prefeitura') prefModel(k, rng(42), 2); else if (isMarco(type)) LANDMARKS[type](k, rng(42)); else if (SERVICE_MODELS[type]) SERVICE_MODELS[type](k, rng(42)); else SPECIAL_MODELS[type](k, rng(42));
  ghost = kitObject(k);
  ghost.traverse(o=>{ if (o.isMesh){ o.material = ghostMat; o.castShadow=false; } if (o.isLineSegments) o.visible=false; });
  ghost.visible = false; world.add(ghost);
}
const roadPreview=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0x45c990,transparent:true,opacity:0.66,depthTest:false,side:THREE.DoubleSide}));
roadPreview.renderOrder=6;roadPreview.visible=false;world.add(roadPreview);
function previewRoads(pl){
  const vertices=[];
  for(const road of pl.roads||[pl.road]){
    const pts=roadSamples(road),width=road.kind==='avenida'?0.61:0.415;
    let prev=null;
    for(let i=0;i<pts.length;i++){
      const p=pts[i],a=pts[Math.max(0,i-1)],b=pts[Math.min(i+1,pts.length-1)];
      const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,y=Math.max(0.12,p.h*0.85+0.12);
      const left=[wx(p.x)-dz/len*width,y,wx(p.z)+dx/len*width],right=[wx(p.x)+dz/len*width,y,wx(p.z)-dx/len*width];
      if(prev)vertices.push(...prev[0],...left,...right,...prev[0],...right,...prev[1]);
      prev=[left,right];
    }
  }
  roadPreview.geometry.dispose();
  roadPreview.geometry=new THREE.BufferGeometry();
  roadPreview.geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  roadPreview.material.color.set(pl.err?'#e66151':'#46c693');roadPreview.visible=true;
}
function clearPreview(){ roadPreview.visible=false; pvPool.forEach(m=>m.visible=false); if (ghost) ghost.visible=false; hideTip(); }
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
  if (['rua','avenida','viaduto'].includes(tool)) return designRoad(a,b);
  if (tool==='trilho'){
    let cost=0, n=0; const items=[];
    for (const [x,z] of lPath(a,b)){
      if (!inb(x,z)){ items.push([x,z,'bad']); continue; }
      const t = grid.t[idx(x,z)];
      if (t===T.RAIL || t===T.RAILBR) items.push([x,z,'skip']);
      else if (free(t)){ items.push([x,z,'ok']); cost+=RAIL_COST; n++; }
      else if (t===T.WATER){ items.push([x,z,'ok']); cost+=RAILBR_COST; n++; }
      else items.push([x,z,'bad']);
    }
    return { items, cost, n, label: items.some(it=>it[2]==='bad') ? 'Trilho não cruza rua: use um viaduto' : `Trilho · ${n} trechos · R$ ${fmt(cost)}` };
  }
  if (tool==='viatrem'){
    const road = false, path = lPath(a,b), items = []; let err = null;
    if (path.length < 3) err = 'Arraste pelo menos 3 lotes';
    path.forEach(([x,z], k)=>{
      if (!inb(x,z)){ items.push([x,z,'bad']); err = err || 'Fora do mapa'; return; }
      const i = idx(x,z), t = grid.t[i], end = k===0 || k===path.length-1;
      let ok;
      if (end) ok = !grid.e[i] && (free(t) || (road ? t===T.ROAD : t===T.RAIL));
      else ok = !grid.e[i] && (free(t) || [T.ROAD,T.BRIDGE,T.RAIL,T.RAILBR,T.WATER].includes(t));
      items.push([x,z, ok ? 'ok' : 'bad']); if (!ok) err = err || 'Caminho bloqueado';
    });
    const cost = path.length * (road ? VIA_COST : VIATREM_COST);
    if (!err && cost > S.money) err = 'Dinheiro insuficiente';
    return { items, cost, n:path.length, via:true, err, label: err || `${road?'Viaduto':'Viaduto de trem'} · ${path.length} trechos · R$ ${fmt(cost)}` };
  }
  if (tool==='distrito' || tool==='semdistrito'){
    const items = []; let n = 0;
    for (const [x,z] of rect(a,b)){ if (!inb(x,z)) continue; items.push([x,z, tool==='distrito' ? 'dist' : (grid.dist[idx(x,z)] ? 'bad' : 'skip')]); n++; }
    const start = inb(a.x,a.z) ? grid.dist[idx(a.x,a.z)] : 0;
    const single = a.x===b.x && a.z===b.z;
    return { items, cost:0, n, dist:true, start, single, label: tool==='semdistrito' ? `Tirar distrito · ${n} lotes` : single && start ? `Abrir ${S.districts[start-1].nome}` : start ? `Ampliar ${S.districts[start-1].nome} · ${n} lotes` : `Novo distrito · ${n} lotes` };
  }
  if (tl.zone){
    if (tl.stage && S.stage < tl.stage) return { items:[], cost:0, n:0, err:'lock', label:`Libera em ${STAGES[tl.stage].nome}` };
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
    for (const [x,z] of rect(a,b)){ if (!inb(x,z)) continue; const i=idx(x,z), t=grid.t[i]; const on = underDeck(i)||engineered.has(i+2*N*N)||t===T.ROAD||t===T.BRIDGE||t===T.TREE||t===T.BUILD||t===T.FARM||t===T.RAIL||t===T.RAILBR||t===T.PILLAR||grid.e[i]>0||grid.z[i]>0; items.push([x,z,on?'bad':'skip']); if(on) n++; }
    return { items, cost:0, n, label: n ? `Demolir ${n} ${n>1?'itens':'item'}` : 'Nada para demolir' };
  }
  if (SPECIAL[tool]){
    const d = SPECIAL[tool]; let err = null;
    for (const [x,z] of sqTiles(d.w, b.ax, b.az)){ if (!inb(x,z)){ err='Fora do mapa'; break; } if ((!free(grid.t[idx(x,z)])||underDeck(idx(x,z)))){ err='Espaço ocupado'; break; } }
    if (!err && d.stage && S.stage < d.stage) err = `Libera em ${STAGES[d.stage].nome}`;
    if (!err && d.needs==='rail' && roadSide(d.w,b.ax,b.az,isRail)===null) err = 'Precisa de trilho ao lado';
    if (!err && !d.deco && d.needs!=='rail' && roadSide(d.w,b.ax,b.az)===null) err = 'Precisa de rua ao lado';
    if (!err && d.rio){ let near = false; for (let z=b.az-2; z<b.az+d.w+2; z++) for (let x=b.ax-2; x<b.ax+d.w+2; x++) if (isWater(x,z)) near = true; if (!near) err = 'Precisa ficar perto do rio'; }
    if (!err && d.marco && S.stage < 1) err = `Marcos liberam em ${STAGES[1].nome}`;
    if (!err && d.unique && countB(tool)) err = d.marco ? 'Esse marco já existe' : 'Só pode existir uma';
    if (!err && d.marco && marcoSlots() <= 0) err = 'Sem vaga: cada etapa libera 1 marco';
    if (!err && S.money < d.custo) err = 'Dinheiro insuficiente';
    return { building:true, ax:b.ax, az:b.az, ok:!err, err, cost:d.custo, label: err || `${d.nome} · R$ ${fmt(d.custo)}` };
  }
  return null;
}
function anchorFor(p){ const w = SPECIAL[tool]?.w || 1; return { ...p, ax:Math.round(p.fx - w/2), az:Math.round(p.fz - w/2) }; }
function showPlan(pl, cx, cy){
  clearPreview(); if (!pl) return;
  if(pl.road){
    previewRoads(pl);
  }else if (pl.building){
    const w = SPECIAL[tool].w;
    pvTile(0, pl.ax, pl.az, pl.ok?pvOk:pvBad, w, 0.06);
    if (ghost){ ghost.visible = true; ghost.position.set(pl.ax+w/2-N/2, 0, pl.az+w/2-N/2); ghost.rotation.y = roadSide(w,pl.ax,pl.az, SERV[tool]?.needs==='rail' ? isRail : isRoad) ?? 0; }
  } else {
    pl.items.slice(0,500).forEach(([x,z,s],i)=> pvTile(i, x, z, s==='zone'?pvZone[pl.zone][zoneDens] : s==='farm' ? (pl.err?pvBad:pvFarm) : s==='dist' ? pvDist : s==='ok'?pvOk : s==='bad'?pvBad : pvSkip, 1, tool==='demolir'?0.5:0.05));
  }
  showTip(pl.label, cx, cy, pl.building ? !pl.ok : (!!pl.err || pl.cost > S.money));
}
function commit(pl){
  if(pl?.err&&!pl.road&&roadSettings.shape==='upgrade'&&['rua','avenida','viaduto'].includes(tool)){toast(pl.err);return;}
  if(pl?.road){if(pl.err){toast(pl.err);return;} if(pl.replace) S.roads.splice(S.roads.indexOf(pl.replace),1);for(const road of pl.roads||[pl.road])applyRoad(road);S.money-=pl.cost;sfx('road');afterChange();return;}
  if (!pl) return;
  if (pl.building){
    if (!pl.ok){ toast(pl.err, 'warn'); return; }
    S.money -= pl.cost;
    const w = SPECIAL[tool].w;
    placeB({ type:tool, s: tool==='prefeitura' ? 2 : 0, gx:pl.ax, gz:pl.az, gw:w, gd:w, rot:roadSide(w,pl.ax,pl.az, SERV[tool]?.needs==='rail' ? isRail : isRoad) ?? 0 }, true);
    sfx('build'); if (tool==='metro') dirty.metro = true; if (tool==='estacao') computeTrains();
    if (isMarco(tool)) toast(`${SPECIAL[tool].nome} inaugurado!`, 'star');
    afterChange(); return;
  }
  if (pl.dist){
    if (tool==='semdistrito'){ for (const [x,z] of pl.items) grid.dist[idx(x,z)] = 0; }
    else if (pl.single && pl.start){ openDistrict(pl.start); return; }
    else { const d = pl.start || newDistrict(); for (const [x,z] of pl.items) grid.dist[idx(x,z)] = d; if (!pl.start) setTimeout(()=>openDistrict(d), 50); }
    // remove distritos vazios
    const used = new Set(grid.dist); S.districts.forEach((D,j)=>{ if (!used.has(j+1)) D.vazio = true; else delete D.vazio; });
    dirty.dist = true; afterChange(); return;
  }
  if (pl.via){
    if (pl.err){ toast(pl.err, 'warn'); sfx('err'); return; }
    S.money -= pl.cost;
    const road = tool==='viaduto';
    pl.items.forEach(([x,z], k)=>{
      const i = idx(x,z), end = k===0 || k===pl.items.length-1;
      if (grid.t[i]===T.TREE){ grid.t[i] = T.EMPTY; dirty.trees = true; }
      grid.z[i] = 0;
      if (end){ grid.t[i] = road ? T.ROAD : T.RAIL; if (road && !grid.r[i]) grid.r[i] = 1; grid.e[i] = road ? 3 : 4; }
      else { grid.e[i] = road ? 1 : 2; if (grid.t[i]===T.EMPTY) grid.t[i] = T.PILLAR; }
    });
    dirty.roads = dirty.zones = true; sfx('build'); afterChange(); return;
  }
  if (pl.zone){
    if (pl.err){ toast(pl.label, 'lock'); return; }
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
    const removed=removeRoadSegments(pl.items);
    let farmsTouched = false;
    for (const [x,z,s] of pl.items){
      if (s!=='bad') continue; const i=idx(x,z), t=grid.t[i];
      if(removed.has(i)||($('#demoLayer').value!=='auto' && +$('#demoLayer').value!==0))continue;
      if (grid.e[i]){ const e = grid.e[i]; grid.e[i] = 0; if (t===T.PILLAR) grid.t[i] = T.EMPTY; dirty.roads = true; if (e===1||e===2) continue; }
      if (t===T.BUILD){ const bt = blds.get(grid.b[i])?.type; removeB(grid.b[i]); if (bt==='metro') dirty.metro = true; }
      else if (t===T.RAIL){ grid.t[i]=T.EMPTY; dirty.roads=true; }
      else if (t===T.RAILBR){ grid.t[i]=T.WATER; dirty.roads=dirty.water=true; }
      else if (t===T.PILLAR){ grid.t[i]=T.EMPTY; dirty.roads=true; }
      else if (t===T.FARM){ removeFarmTile(i); farmsTouched = true; }
      else if (t===T.ROAD){ grid.t[i]=T.EMPTY; grid.r[i]=0; dirty.roads=true; }
      else if (t===T.BRIDGE){ grid.t[i]=T.WATER; dirty.roads=dirty.water=true; }
      else if (t===T.TREE){ grid.t[i]=T.EMPTY; dirty.trees=true; }
      grid.z[i]=0; grid.d[i]=0; dirty.zones=true;
    }
    if (farmsTouched || dirty.roads) for (const f of farms.values()) pickBarn(f);
    dirty.farms = true; sfx('demo');
    afterChange(); return;
  }
  if (!pl.n) return;
  if (pl.cost > S.money){ toast('Dinheiro insuficiente', 'warn'); return; }
  S.money -= pl.cost;
  for (const [x,z,s] of pl.items){
    if (s!=='ok') continue; const i=idx(x,z), t=grid.t[i];
    if (tool==='trilho'){ if (t===T.TREE) dirty.trees=true; if (t===T.WATER){ grid.t[i]=T.RAILBR; dirty.water=true; } else grid.t[i]=T.RAIL; grid.z[i]=0; }
    else if (tool==='arvore'){ grid.t[i]=T.TREE; dirty.trees=true; }
  }
  sfx('road');
  if (tool==='rua' || tool==='avenida' || tool==='trilho'){ dirty.roads = dirty.zones = true; for (const f of farms.values()) if (f.barn<0) { pickBarn(f); dirty.farms = true; } }
  afterChange();
}
function afterChange(){ checkGoals(); updateHUD(); save(); }

// ================== INPUT ==================
const pointers = new Map();
let drag = null, tapCand = null;
canvas.addEventListener('pointerdown', e=>{
  document.body.classList.remove('adjusting','summary');
  $('#adjustTool').setAttribute('aria-expanded','false');$('#summaryBtn').setAttribute('aria-expanded','false');
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
    const pl = plan(drag.a, drag.b);
    if(pl?.road){
      const shape=roadSettings.shape, tap=Math.hypot(drag.a.fx-drag.b.fx,drag.a.fz-drag.b.fz)<0.3;
      if(shape==='upgrade'){commit(pl);resetStroke();}
      else if(!curveClicks.length && (tap||['free','tangent','grid'].includes(shape))){
        curveClicks.push(pl.road.a);toast(shape==='grid'?'Toque para definir a largura':['free','tangent'].includes(shape)?'Toque na direção inicial':'Toque no fim do trecho');
      }else if(['free','tangent','grid'].includes(shape) && curveClicks.length===1 && !tangent){
        curveClicks.push(roadPoint(drag.b));toast(shape==='grid'?'Toque para definir a profundidade':'Toque no fim da curva');
      }else if(!pl.err){
        commit(pl);
        curveClicks=['ring','grid'].includes(shape)?[]:[pl.road.b];tangent=null;
        if(shape==='tangent'){
          const dx=pl.road.b.x-pl.road.control.x,dz=pl.road.b.z-pl.road.control.z,len=Math.hypot(dx,dz);
          if(len>0.01)tangent={x:dx/len,z:dz/len};
        }
      }else toast(pl.err);
    }else commit(pl);
    drag=null;
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
    if(heatVisible && (isRoad(t[0],t[1]) || underDeck(i) || engineered.has(i+2*N*N))){
      const n=[i,i+N*N,i+2*N*N,i+3*N*N].sort((a,b)=>heat[b]-heat[a])[0];
      const trip=tripsByNode.get(n);
      const desc=b=>(SPECIAL[b.type]?.nome||ZNAME[ZKEY.indexOf(b.type)])+' ('+b.gx+', '+b.gz+')';
      toast('Uso '+Math.round(heat[n]*100)+'% · '+(trip?desc(trip.from)+' → '+desc(trip.to):'Sem viagens registradas'),'car');return;
    }
    if (grid.b[i]>=0 && blds.has(grid.b[i])){ selected = { kind:'b', id:grid.b[i] }; renderInfo(); $('#info').style.display='block'; return; }
    if (grid.f[i]>=0 && farms.has(grid.f[i])){ selected = { kind:'f', id:grid.f[i] }; renderInfo(); $('#info').style.display='block'; return; }
  }
  closeInfo();
}
function closeInfo(){ selected=null; $('#info').style.display='none'; }
function infoRefresh(){ if (selected?.kind==='d') return; renderInfo(); }
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
  const icon = b.zone ? (b.dens ? 'high' : {res:'res',com:'com',ind:'ind',off:'off'}[b.type]) : SPECIAL[b.type].ic;
const dn = distOf(b) ? ' · ' + (S.districts[distOf(b)-1]?.nome || '') : '';
  const sub = (b.zone ? `${ZNAME[{res:1,com:2,ind:3,off:4}[b.type]]} · ${b.dens?'alta densidade':'comum'} · ${b.fw}×${b.fd}` : (b.type==='prefeitura' ? `${b.s}×${b.s} · ${STAGES[S.stage].nome}` : isMarco(b.type) ? 'Marco da cidade' : SERV[b.type]?.deco ? 'Decoração' : 'Serviço da cidade')) + dn;
  if (b.type==='res') rows.push(['Classe', `<span class="cls" style="background:${CLASSES[b.cls].cor}"></span>${CLASSES[b.cls].nome}`]);
  if (b.type==='res') rows.push(['Moradores', `${b.pop} / ${st.cap}`]);
  if (isMarco(b.type) || SERV[b.type]?.visit) rows.push(['Visitantes', `${Math.round(b.out)}/dia`]);
  if (b.type==='prefeitura'){ rows.push(['Energia', `${fmt(S.power[0])} / ${fmt(S.power[1])} MW`]); rows.push(['Água', `${fmt(S.water[0])} / ${fmt(S.water[1])} m³`]); rows.push(['Trânsito', `${Math.round(S.traffic*100)}% da capacidade`]); rows.push(['Transporte público', `${Math.round(S.transitShare*100)}% dos moradores`]); }
  if (b.type==='prefeitura'){ const pc = popByClass(); CLASSES.forEach((c,i)=>{ if (clsOk(i)) rows.push([`Classe ${c.nome.toLowerCase()}`, fmt(pc[i])]); }); if (S.visit) rows.push(['Turistas', `${Math.round(S.visit)}/dia`]); }
  if (st.jobs) rows.push(['Funcionários', `${b.staff} / ${st.jobs}`]);
  if (b.zone && b.floors > 1) rows.push(['Andares', b.floors]);
  if (b.zone) rows.push(['Nível', '★'.repeat(b.lvl||1) + '☆'.repeat(3-(b.lvl||1))]);
  const sv = SERV[b.type];
  if (sv?.power) rows.push(['Energia gerada', `${sv.power} MW`]);
  if (sv?.water) rows.push(['Água gerada', `${sv.water} m³`]);
  if (sv?.raio) rows.push(['Alcance', `${sv.raio} lotes`]);
  if (sv?.estoque) rows.push(['Estoque extra', `+${sv.estoque}`]);
  if (sv?.onibus) rows.push(['Ônibus', sv.onibus]);
  if (b.type==='estacao') rows.push(['Linha', b.linked ? 'ligada a outra estação' : 'sem ligação']);
  if (['metro','ponto'].includes(b.type)) rows.push(['Linha',activeLines().some(l=>l.stops.includes(b))?'em operação':'sem serviço']);

  if (!sv?.deco && !sv?.power && !sv?.water){ rows.push(['Energia', b.pw ? 'ok' : '<span style="color:var(--bad)">falta</span>']); rows.push(['Água', b.wt ? 'ok' : '<span style="color:var(--bad)">falta</span>']); }
  if (b.zone){ const i = idx(b.gx,b.gz); rows.push(['Serviços', ['edu','saude','seg','fogo'].filter(k=>cov[k][i]).map(k=>({edu:'escola',saude:'saúde',seg:'polícia',fogo:'bombeiros'})[k]).join(', ') || 'nenhum']); }
  if(b.type==='floresta')rows.push(['Madeira',b.out.toFixed(1)+'/dia']);
  if(b.type==='serraria')rows.push(['Mercadorias',b.out.toFixed(1)+'/dia']);
  if (b.type==='processadora') rows.push(['Alimento', `${b.out.toFixed(1)}/dia`]);
  if (b.type==='ind') rows.push(['Mercadorias', `${b.out.toFixed(1)}/dia`]);
  if (b.type==='com') rows.push(['Vendas', `${b.out.toFixed(1)}/dia`]);
  if (b.type==='off') rows.push(['Impostos', `R$ ${(b.staff*0.35).toFixed(1)}/dia`]);
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
  $('#iDel').onclick = ()=>{ const t = b.type; removeB(b.id, true); if (t==='metro') dirty.metro = true; if (t==='estacao') computeTrains(); sfx('demo'); afterChange(); };
  $('#iClose').onclick = closeInfo;
}
function openDistrict(d){
  const D = S.districts[d-1]; if (!D) return;
  selected = { kind:'d', id:d }; renderDistrict(); $('#info').style.display = 'block';
}
function renderDistrict(){
  const d = selected.id, D = S.districts[d-1]; if (!D){ closeInfo(); return; }
  let pop = 0, nb = 0; for (const b of blds.values()) if (distOf(b)===d){ nb++; pop += b.pop; }
  const el = $('#info');
  el.innerHTML = `<h3 style="background:${D.cor}55">${ico('district')}Distrito</h3>
    <div class="sub">Nome</div><input id="dName" class="nameIn" value="${D.nome.replace(/"/g,'&quot;')}" maxlength="24">
    ${row('Moradores', fmt(pop))}${row('Prédios', nb)}
    <div class="sub">Regras</div>
    ${Object.entries(POLICIES).map(([k,p])=>`<button class="pol${D.pol[k]?' on':''}" data-p="${k}"><b>${p.nome}</b><small>${p.desc}</small></button>`).join('')}
    <div class="btns"><button class="danger" id="dDel">Desfazer</button><button id="iClose">Fechar</button></div>`;
  $('#dName').onchange = e=>{ D.nome = e.target.value.trim() || D.nome; dirty.dist = true; save(); };
  $('#dName').onkeydown = e=>{ e.stopPropagation(); if (e.key==='Enter') e.target.blur(); };
  el.querySelectorAll('.pol').forEach(bt=>bt.onclick = ()=>{ D.pol[bt.dataset.p] = !D.pol[bt.dataset.p]; sfx('click'); renderDistrict(); save(); });
  $('#dDel').onclick = ()=>{ for (let i=0;i<N*N;i++) if (grid.dist[i]===d) grid.dist[i] = 0; D.vazio = true; dirty.dist = true; closeInfo(); save(); };
  $('#iClose').onclick = closeInfo;
}

// teclado
const keys = new Set();
addEventListener('keydown', e=>{
  if(e.target.matches('input,select,textarea,button')) return;
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
let cat = null;
function toolLocked(t){ return t.stage && S.stage < t.stage; }
function buildToolbar(){
  const tb = $('#toolbar');
  tb.innerHTML = '';
  CATS.forEach(c=>{
    const b = document.createElement('button'); b.className = 'cat'; b.dataset.cat = c.id; b.style.setProperty('--bg', c.cor);
    b.innerHTML = `${ico(c.ic)}<span>${c.nome}</span>`;
    b.onclick = ()=>openCat(c.id); tb.appendChild(b);
  });
  renderTray(); markTools();
}
function viewHooks(){ showDistricts(); if (metroObj) metroObj.visible = cat==='transporte' || tool==='metro'; }
function openCat(id){
  sfx('click');
  if (id==='ver' || id==='demolir'){ cat = null; selectTool(id==='ver' ? 'ver' : (tool==='demolir' ? 'ver' : 'demolir')); return; }
  cat = (cat===id) ? null : id;
  renderTray(); markTools(); viewHooks();
}
function renderTray(){
  const tr = $('#tray');
  document.body.classList.toggle('tray-open', !!cat);
  if (!cat){ tr.style.display = 'none'; return; }
  const c = CATS.find(c=>c.id===cat);
  tr.style.display = 'flex'; tr.style.setProperty('--bg', c.cor);
  tr.innerHTML = `<div class="trayHead">${ico(c.ic)}${c.nome}${cat==='marcos' ? `<small>${S.stage<1 ? 'libera na Cidade pequena' : marcoSlots() > 0 ? `${marcoSlots()} vaga${marcoSlots()>1?'s':''}` : 'sem vaga nesta etapa'}</small>` : ''}</div><div class="trayItems"></div>`;
  const box = tr.querySelector('.trayItems');
  TOOLS.filter(t=>t.cat===cat).forEach(t=>{
    const b = document.createElement('button'); const lock = toolLocked(t), built = isMarco(t.id) && countB(t.id);
    b.className = 'tool' + (lock ? ' locked' : '') + (built ? ' done' : ''); b.dataset.tool = t.id;
    b.innerHTML = `<span class="ib">${ico(lock ? 'lock' : t.ic)}</span><span class="nm">${t.nome}</span><span class="c">${built ? 'construído' : lock ? STAGES[t.stage].nome : t.custo ? 'R$ '+fmt(t.custo) : (t.sub || (t.zone ? 'zona' : ''))}</span>${t.tag?`<i class="tag" style="background:${t.tag}"></i>`:''}`;
    b.onclick = ()=>{ if (lock){ toast(`Libera em ${STAGES[t.stage].nome} (${fmt(STAGES[t.stage].pop)} moradores)`, 'lock'); return; } selectTool(t.id); };
    box.appendChild(b);
  });
  markTools();
}
function markTools(){
  $('#demoOptions').hidden=tool!=='demolir';
  $('#roadDesign').hidden=!['rua','avenida','viaduto'].includes(tool);
  const tc = curTool().cat;
  document.querySelectorAll('.cat').forEach(b=>b.classList.toggle('on', cat ? b.dataset.cat===cat : b.dataset.cat===tc));
  document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('on', b.dataset.tool===tool));
}
function selectTool(id){
  resetStroke();
  document.body.classList.remove('summary','adjusting');
  $('#summaryBtn').setAttribute('aria-expanded','false');
  $('#adjustTool').setAttribute('aria-expanded','false');
  if (tool===id && id!=='ver') id = 'ver';
  tool = id;
  document.body.classList.toggle('working',id!=='ver');
  $('#activeName').textContent=curTool().nome;
  $('#adjustTool').hidden=!['rua','avenida','viaduto'].includes(id);
  drag = null; clearPreview();
  if (id==='ver'){ cat = null; renderTray(); }
  markTools(); viewHooks();
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
function setSpeed(s){ S.speed = s; $('#speedBtn').textContent=s?s+'×':'Ⅱ'; document.querySelectorAll('[data-sp]').forEach(b=>b.classList.toggle('on', +b.dataset.sp===s)); }

let toastT;
function toast(msg, ic='warn'){ const t=$('#toast'); t.innerHTML = ico(ic)+msg; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'), 2100); }
function showTip(txt, x, y, bad){ const t=$('#tip'); t.textContent=txt; t.style.display='block'; t.style.color = bad ? 'var(--bad)' : 'var(--ink)';
  const w=t.offsetWidth; t.style.left = clamp(x - w/2, 6, innerWidth-w-6)+'px'; t.style.top = Math.max(6, y - 60)+'px'; }
function hideTip(){ $('#tip').style.display='none'; }
function layoutPanels(){ const hb = $('#hud').getBoundingClientRect().bottom + 6; $('#goal').style.top = hb+'px'; $('#info').style.top = hb+'px'; }
addEventListener('resize', layoutPanels);
function barHtml(b){
  if (b.lock) return `<div class="tr lock" title="bloqueado">${ico('lock')}</div>`;
  const hh = Math.abs(b.v)*50;
  return `<div class="tr${b.r?' thin':''}"><i style="background:${b.v>=0?b.col:'#c9483a'};height:${hh}%;top:${b.v>=0?50-hh:50}%"></i></div>`;
}
function updateHUD(){
  let pop=0, cap=0; for (const b of blds.values()) if (b.type==='res'){ pop+=b.pop; cap+=bStat(b).cap; }
  const h = Math.round(S.happy), face = h>=70?'f3':h>=50?'f2':h>=30?'f1':'f0';
  const inc = S.inc>=0 ? `<small class="pos">+${fmt(S.inc)}</small>` : `<small class="neg">${fmt(S.inc)}</small>`;
  $('#stats').innerHTML = [
    `${ib('coin')}${fmt(S.money)} ${inc}`,
    `${ib('pop')}${fmt(pop)}<small>/${fmt(cap)}</small>`,
    `${ib(face)}${h}%`,
    `${ib('wheat')}${fmt(S.trigo)}<i class="sep"></i>${ico('bread')}${fmt(S.alim)}<i class="sep"></i>${ico('box')}${fmt(S.merc)}`,
    `${ib('cal')}${S.day}`,
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
  const bars = [
    ...CLASSES.map((c,i)=>({ v:S.demR[i], col:c.cor, lab:['B','M','A'][i], lock:!clsOk(i), r:true })),
    { v:S.dem[1], col:'#4f8fe0', lab:'C' }, { v:S.dem[2], col:'#e6b43a', lab:'I' }, { v:S.dem[3], col:'#a07ae0', lab:'E', lock:S.stage<1 },
  ];
  $('#rci').innerHTML = `<div class="rgrp"><div class="cols">${bars.slice(0,3).map(barHtml).join('')}</div><span class="lab" style="color:#3f8f33">R</span></div>` + bars.slice(3).map(b=>`<div class="rgrp"><div class="cols">${barHtml(b)}</div><span class="lab" style="color:${b.col}">${b.lab}</span></div>`).join('');
  if (selected && selected.kind!=='d') renderInfo();
  if (cat==='marcos' || cat==='bairros') { const sig = S.stage+'|'+marcoSlots()+'|'+countB('torretv')+countB('catedral')+countB('estadio')+countB('parquecentral'); if (sig!==trSig){ trSig = sig; renderTray(); } }
}
let trSig = '';
const show = (id,on)=>$(id).style.display = on ? 'grid' : 'none';
let speedBeforeMenu = 1;
$('#menuBtn').onclick = ()=>{ speedBeforeMenu = S.speed; setSpeed(0); show('#menu',true); };
$('#mClose').onclick = ()=>{ show('#menu',false); setSpeed(speedBeforeMenu); };
$('#mHelp').onclick = ()=>{ show('#menu',false); show('#help',true); };
$('#hClose').onclick = ()=>{ show('#help',false); setSpeed(speedBeforeMenu); try{localStorage.setItem(SAVE_KEY+'_help','1');}catch(e){} };
$('#mNew').onclick = ()=>{ show('#menu',false); show('#confirmNew',true); };
$('#cNo').onclick = ()=>{ show('#confirmNew',false); setSpeed(speedBeforeMenu); };
$('#cYes').onclick = ()=>{ show('#confirmNew',false); newGame(); };

// ================== LOOP ==================
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), Y = new THREE.Vector3(0,1,0), tv = new THREE.Vector3();
let last = performance.now(), acc = 0, hudT = 0, saveT = 0, clock = 0, vehT = 0;
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
  if (dirty.dist){ dirty.dist=false; rebuildDistricts(); }
  if (dirty.metro){ dirty.metro=false; rebuildMetro(); }
  if (trainsDirty) rebuildTrains();
  vehT += dt; if (vehT > 0.5){ vehT = 0; syncVehicles(); }
  updateVehicles(dt); updateTrains(dt);
  let rb = 0; for (const [k,c] of chunks) if (c.dirty && rb < 3){ rebuildChunk(k,c); rb++; }
  hudT += dt; if (hudT > 0.25){ hudT = 0; updateHUD(); }
  saveT += dt; if (saveT > 15){ saveT = 0; save(); }
  const phase=(S.day%32+acc/DAY)*Math.PI/16;
  const daylight=(1+Math.cos(phase))/2;
  sun.intensity=0.62+1.48*daylight;
  scene.background.setRGB(0.16+0.37*daylight,0.22+0.53*daylight,0.34+0.49*daylight);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
addEventListener('resize', ()=>{ camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
document.addEventListener('visibilitychange', ()=>{ if (document.hidden) save(); });

// ================== OPÇÕES ==================
function saveOpts(){ try{ localStorage.setItem('cib_opts', JSON.stringify({ sfx:sfxOn, music:musicOn, q:quality })); }catch(e){} }
function setQuality(q){
  quality = q; renderer.setPixelRatio(q==='alta' ? Math.min(devicePixelRatio, 2) : 1); sun.castShadow = q==='alta';
  renderer.setSize(innerWidth, innerHeight); renderOpts();
}
function renderOpts(){
  if (!$('#oSfx')) return;
  $('#oSfx').textContent = 'Sons: ' + (sfxOn ? 'ligados' : 'desligados');
  $('#oMus').textContent = 'Música: ' + (musicOn ? 'ligada' : 'desligada');
  $('#oQ').textContent = 'Gráficos: ' + (quality==='alta' ? 'bonitos' : 'leves');
}
$('#oSfx').onclick = ()=>{ sfxOn = !sfxOn; saveOpts(); renderOpts(); sfx('click'); };
$('#oMus').onclick = ()=>{ musicOn = !musicOn; if (musicOn){ audio(); startMusic(); } saveOpts(); renderOpts(); };
$('#oQ').onclick = ()=>{ setQuality(quality==='alta' ? 'leve' : 'alta'); saveOpts(); };
$('#oCopy').onclick = async ()=>{ save(); try{ await navigator.clipboard.writeText(btoa(unescape(encodeURIComponent(lastSave)))); toast('Cidade copiada! Cole no outro aparelho', 'check'); }catch(e){ $('#saveBox').value = btoa(unescape(encodeURIComponent(lastSave))); show('#menu',false); show('#saveModal',true); } };
for(const version of [4,5]){
  const button=$('#restore'+version);
  try{button.hidden=!localStorage.getItem('cidade_proto_v'+version);}catch{button.hidden=true;}
  button.onclick=()=>{
    const raw=localStorage.getItem('cidade_proto_v'+version);
    if(raw){$('#saveBox').value=btoa(unescape(encodeURIComponent(raw)));show('#menu',false);show('#saveModal',true);}
  };
}
$('#oPaste').onclick = ()=>{ $('#saveBox').value = ''; show('#menu',false); show('#saveModal',true); };
$('#sLoad').onclick = ()=>{
  try{ const txt = decodeURIComponent(escape(atob($('#saveBox').value.trim())));
    const d=decodeCity(txt,N,SPECIAL,ZONE_MODELS);
    save(); const backup=lastSave;
    try{ applyCity(d); rebuildAll(); }catch(e){applyCity(decodeCity(backup,N,SPECIAL,ZONE_MODELS));rebuildAll();throw e;}
    setSpeed(d.S.speed);save();show('#saveModal',false);toast('Cidade carregada!', 'check');
  }catch(e){ toast('Código inválido', 'warn'); }
};
$('#sClose').onclick = ()=>{ show('#saveModal',false); setSpeed(speedBeforeMenu); };
renderOpts();

const missionLabels=['Abasteça uma vila com mais de 60 moradores','Feche o dia no azul com 1.000 moradores','Com 5.000 moradores, exporte 2 madeiras/dia ou receba 20 turistas/dia','Sustente 20.000 moradores com felicidade de 60% e saldo positivo'];
function refreshPlanning(){
  for(const field of ['budget','tax']){
    $('#'+field).value=S[field]; $('#'+field+'Value').textContent=S[field]+'%';
  }
  $('#imports').checked=S.imports; $('#heat').checked=heatVisible; $('#focus').value=S.focus;
  $('#focusHint').textContent={equilibrio:'Receitas regulares em todos os setores.',industria:'Exportações rendem 50% a mais. A receita turística cai 20%.',turismo:'Turismo rende 45% a mais. Exportações rendem 20% a menos.'}[S.focus];
  const l=S.ledger||{};
  $('#ledger').innerHTML=[['Impostos',l.taxes],['Vendas e exportações',l.sales],['Turismo',l.tourism],['Manutenção',-l.maint],['Importações',-l.importCost],['Saldo diário',S.inc]].map(([name,value])=>row(name,'R$ '+fmt(value||0))).join('')+row('Estoque de madeira',fmt(S.wood));
  $('#missions').innerHTML=missionLabels.map((label,i)=>row(label,S.awards.includes(i)?'Concluído':'R$ '+fmt([500,2000,6000,15000][i]))).join('');
  const lines=$('#lines'); lines.replaceChildren();
  const active=activeLines();
  S.lines.forEach((line,i)=>{
    const item=document.createElement('div'); item.className='lineEditor';
    const label=document.createElement('b'); label.textContent=(line.type==='bus'?'Ônibus ':'Metrô ')+(i+1);
    item.append(label);
    const stops=line.stops.map(id=>blds.get(id)).filter(Boolean);
    const order=document.createElement('p');order.textContent=stops.map(b=>'('+b.gx+', '+b.gz+')').join(' → ')||'Adicione as paradas em ordem.';
    item.append(order);
    const select=document.createElement('select');select.setAttribute('aria-label','Adicionar parada');
    select.add(new Option('Escolher parada…',''));
    for(const b of blds.values()) if(b.type===(line.type==='bus'?'ponto':'metro') && !line.stops.includes(b.id)) select.add(new Option(SPECIAL[b.type].nome+' ('+b.gx+', '+b.gz+')',String(b.id)));
    select.onchange=()=>{if(select.value)line.stops.push(+select.value);saveLines();}; item.append(select);
    const undo=document.createElement('button');undo.textContent='Tirar última';undo.onclick=()=>{line.stops.pop();saveLines();};item.append(undo);
    const del=document.createElement('button');del.textContent='Excluir linha';del.onclick=()=>{S.lines.splice(i,1);saveLines();};item.append(del);
    const status=document.createElement('small');status.textContent=active.some(l=>l.source===line)?'Em operação':line.type==='bus'?'Precisa de garagem e circuito entre os pontos.':'Precisa de duas estações com rua.';
    item.append(status);lines.append(item);
  });
}
function saveLines(){dirty.metro=true;tripRoutes=[];agents=[];save();refreshPlanning();}
$('#planOpen').onclick=()=>{show('#menu',false);show('#planning',true);refreshPlanning();};
$('#planClose').onclick=()=>{show('#planning',false);setSpeed(speedBeforeMenu);};
document.querySelectorAll('[data-page]').forEach(bt=>bt.onclick=()=>{
  for(const key of ['finance','mobility','goals']) $('#'+key).hidden=key!==bt.dataset.page;
});
for(const key of ['tax','budget']) $('#'+key).oninput=e=>{S[key]=+e.target.value;save();refreshPlanning();};
$('#imports').onchange=e=>{S.imports=e.target.checked;save();};
$('#focus').onchange=e=>{S.focus=e.target.value;save();refreshPlanning();};
$('#heat').onchange=e=>{heatVisible=e.target.checked;rebuildRoads(false);};
for(const [id,type] of [['newBus','bus'],['newMetro','metro']]) $('#'+id).onclick=()=>{S.lines.push({type,stops:[]});saveLines();};
let curveClicks=[],tangent=null;
function resetStroke(){curveClicks=[];tangent=null;clearPreview();}
function backStep(){if(tangent){resetStroke();return;}curveClicks.pop();clearPreview();}
canvas.addEventListener('contextmenu',e=>{if(['rua','avenida','viaduto'].includes(tool)){e.preventDefault();backStep();}});
$('#restartRoad').onclick=()=>{resetStroke();document.body.classList.remove('adjusting');toast('Toque no início da nova via');};
$('#summaryBtn').onclick=e=>e.currentTarget.setAttribute('aria-expanded',document.body.classList.toggle('summary'));
$('#speedBtn').onclick=()=>setSpeed(S.speed===0?1:S.speed===1?3:0);
$('#finishTool').onclick=()=>selectTool('ver');
$('#changeTool').onclick=()=>{const id=curTool().cat;selectTool('ver');openCat(id);};
$('#adjustTool').onclick=e=>e.currentTarget.setAttribute('aria-expanded',document.body.classList.toggle('adjusting'));

$('#parallelRoad').onchange=()=>$('#spaceRoad').hidden=!$('#parallelRoad').checked && roadSettings.shape!=='grid';
$('#roadShape').onchange=e=>{$('#reverseField').hidden=e.target.value!=='upgrade';$('#spaceRoad').hidden=e.target.value!=='grid' && !$('#parallelRoad').checked;roadSettings.shape=e.target.value;resetStroke();$('#bendField').hidden=e.target.value!=='curve';if(e.target.value==='free')toast('Toque no início, na direção da curva e no fim');};
$('#roadLevel').onchange=e=>{resetStroke();roadSettings.level=+e.target.value;$('#rampField').hidden=!roadSettings.level;};
$('#ramps').onchange=e=>roadSettings.ramps=e.target.value;
$('#oneWay').onchange=e=>roadSettings.one=e.target.checked;
$('#bend').oninput=e=>roadSettings.bend=+e.target.value;

// ================== INÍCIO ==================
S = fresh();
if (!load()) genTerrain(7);
rebuildAll(); computeTrains();
try{ const o = JSON.parse(localStorage.getItem('cib_opts')||'{}'); sfxOn = o.sfx ?? true; musicOn = o.music ?? true; if (o.q) setQuality(o.q); }catch(e){}
addEventListener('pointerdown', ()=>{ if (audio() && musicOn) startMusic(); }, { once:false, passive:true });
buildToolbar(); selectTool('ver'); setSpeed(S.speed ?? 1);
updateHUD();
$('#loading').remove();
let seenHelp = false; try{ seenHelp = !!localStorage.getItem(SAVE_KEY+'_help') || !!localStorage.getItem('cidade_proto_v2_help'); }catch(e){}
if (!seenHelp){ speedBeforeMenu = S.speed || 1; setSpeed(0); show('#help', true); }
window.__game = { openCat, computeTrains, get trains(){return trains;}, get agents(){return agents;}, newDistrict, openDistrict, cov, G, get S(){return S;}, blds, farms, grid, placeB, tick, camera, controls, selectTool, commit, plan, idx, T, N, Z, STAGES, rebuildAll, ZONE_MODELS, setZoneDens:d=>{zoneDens=d;}, dirty, expandPref, upgradeFarm, upgradeAllFarms, newFarm, lv };
requestAnimationFrame(frame);
