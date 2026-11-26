export function decodeCity(raw, size, special, models) {
  const city=JSON.parse(raw), area=size*size;
  function require(ok){if(!ok) throw new Error('Dados de cidade inválidos');}
  const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
  require([4,5,6].includes(city.v) && city.S && Array.isArray(city.b) && Array.isArray(city.f));
  if(city.v===4){
    city.r=city.t.map(t=>t===1?1:0);
    city.e=Array(area).fill(0); city.dist=Array(area).fill(0);
  }
  for(const [key,max] of Object.entries({t:10,z:4,d:1,r:2,e:4,dist:255})){
    require(Array.isArray(city[key]) && city[key].length===area && city[key].every(v=>integer(v,0,max)));
  }
  const s=city.S, ids=new Set(), occupied=new Set();
  for(const key of ['money','day','happy','trigo','alim','merc','goal']) require(Number.isFinite(s[key]));
  require(integer(s.stage,0,3) && integer(s.goal,0,1000) && [0,1,3].includes(s.speed));
  require(Array.isArray(s.dem) && s.dem.length===4 && s.dem.every(Number.isFinite));
  require(Array.isArray(s.demR) && s.demR.length===3 && s.demR.every(Number.isFinite));
  require((s.districts??[]).every(d=>typeof d.nome==='string' && /^#[0-9a-f]{6}$/i.test(d.cor) && typeof d.pol==='object' && d.pol));
  function occupy(i){require(integer(i,0,area-1)&&!occupied.has(i));occupied.add(i);}
  for(const entity of [...city.b,...city.f]){require(integer(entity.id,1,Number.MAX_SAFE_INTEGER)&&!ids.has(entity.id));ids.add(entity.id);}
  require(integer(city.nextId,1,Number.MAX_SAFE_INTEGER)&&[...ids].every(id=>id<city.nextId));
  for(const b of city.b){
    require(b.zone?Object.hasOwn(models,b.type)&&!!models[b.type]?.[b.dens]?.[b.v]:Object.hasOwn(special,b.type));
    require(integer(b.gw,1,5)&&integer(b.gd,1,5)&&integer(b.gx,0,size-b.gw)&&integer(b.gz,0,size-b.gd));
    require(integer(b.cls??0,0,2)&&Number.isFinite(b.pop??0));
    for(let z=b.gz;z<b.gz+b.gd;z++)for(let x=b.gx;x<b.gx+b.gw;x++)occupy(z*size+x);
  }
  for(const f of city.f){require(integer(f.level,1,3)&&Array.isArray(f.tiles)&&f.tiles.length);f.tiles.forEach(occupy);}
  const point=p=>p&&[p.x,p.z].every(v=>Number.isFinite(v)&&v>=0&&v<=size-1);
  require(Array.isArray(s.roads??[]) && (s.roads??[]).length<=area*4);
  for(const r of s.roads??[]) require((r.offset===undefined||[2,4,6].includes(Math.abs(r.offset)))&&point(r.a)&&point(r.b)&&['line','curve','ring'].includes(r.shape)&&['rua','avenida'].includes(r.kind)&&[-1,0,1,2].includes(r.level)&&Math.abs(r.bend)<=2&&typeof r.one==='boolean'&&(!r.control||point(r.control))&&(!r.ramps||['both','start','end','none'].includes(r.ramps)));
  require(Object.entries(s.roadBase??{}).every(([i,t])=>integer(+i,0,area-1)&&Array.isArray(t)&&integer(t[0],0,9)&&integer(t[1],0,2)));
  require((s.lines??[]).every(l=>['bus','metro'].includes(l.type)&&Array.isArray(l.stops)&&l.stops.every(Number.isSafeInteger)));
  for(const k of ['tax','budget']) if(k in s) require(integer(s[k],50,150));
  require(Array.isArray(s.awards??[]) && (s.awards??[]).every(v=>integer(v,0,3)));
  require(['equilibrio','industria','turismo'].includes(s.focus??'equilibrio'));
  require(Number.isFinite(s.wood??0));
  for(const b of city.b)require(integer(b.lvl??1,1,3));
  s.alerts=[]; city.legacyLines=city.v<6; city.v=6;
  return city;
}
