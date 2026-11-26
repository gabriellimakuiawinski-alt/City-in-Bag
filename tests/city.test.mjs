import test from 'node:test';
import assert from 'node:assert/strict';
import {roadPath,roadSamples} from '../roads.js';
import {decodeCity} from '../saves.js';

const road={kind:'rua',shape:'line',a:{x:3,z:6},b:{x:15,z:6},level:0,one:false,bend:0.7};
test('uma curva de três pontos segue o controle e preserva as pontas',()=>{
  const p=roadSamples({...road,shape:'curve',control:{x:7,z:14}});
  assert.deepEqual(p[0],{x:3,z:6,h:0});
  assert.deepEqual(p.at(-1),{x:15,z:6,h:0});
  assert.ok(p.some(v=>v.z>9.9));
});
test('túnel e viaduto se conectam ao solo pelas rampas e cruzam em níveis distintos',()=>{
  const flat=roadPath(road,48);
  for(const level of [-1,1,2]){
    const path=roadPath({...road,level},48);
    assert.equal(path[0].id,flat[0].id);
    assert.equal(path.at(-1).id,flat.at(-1).id);
    assert.notEqual(path.find(n=>n.x===9).id,flat.find(n=>n.x===9).id);
    const deck=roadPath({...road,level,ramps:'none'},48);
    assert.ok(deck.every(n=>n.band!==0));
  }
});
test('a rotatória fecha o circuito sem um nó de trânsito no centro',()=>{
  const r={...road,shape:'ring',a:{x:12,z:12},b:{x:15,z:12}};
  const path=roadPath(r,48);
  assert.equal(path[0].id,path.at(-1).id);
  assert.ok(path.every(n=>n.x!==12||n.z!==12));
});
function oldCity(){
  return {v:4,t:[0,1,0,0],z:[0,0,0,0],d:[0,0,0,0],b:[],f:[],nextId:1,
    S:{money:500,day:2,happy:70,trigo:0,alim:2,merc:3,goal:0,stage:0,speed:1,dem:[0,0,0,0],demR:[1,0,0]}};
}
test('v4 recupera a estrada e cria as camadas adicionadas na v5',()=>{
  const city=decodeCity(JSON.stringify(oldCity()),2,{},{});
  assert.deepEqual(city.r,[0,1,0,0]);
  assert.equal(city.v,6);
  assert.equal(city.S.money,500);
});
test('o importador recusa um arquivo incompleto antes de aplicar a cidade',()=>{
  const invalid=oldCity();invalid.t.pop();
  assert.throws(()=>decodeCity(JSON.stringify(invalid),2,{},{}));
});
