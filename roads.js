// Coordinates are measured from lot centres. At-grade intersections share a
// graph node. A separate node band keeps each structural level independent.
export function roadSamples(road) {
  const {a,b,shape,bend,level} = road;
  const dx=b.x-a.x, dz=b.z-a.z, length=Math.hypot(dx,dz);
  const ring=shape==='ring', radius=Math.max(1.6,Math.min(5,length));
  const steps=Math.max(2,Math.ceil((ring?2*Math.PI*radius:(road.control?Math.hypot(road.control.x-a.x,road.control.z-a.z)+Math.hypot(b.x-road.control.x,b.z-road.control.z):length)*(1+Math.abs(bend)))*5));
  const points=[];
  for(let i=0;i<=steps;i++){
    const u=i/steps, bulge=shape==='curve'?2*u*(1-u)*bend:0;
    let x=ring?a.x+radius*Math.cos(2*Math.PI*u):a.x+dx*u-dz*bulge;
    let z=ring?a.z+radius*Math.sin(2*Math.PI*u):a.z+dz*u+dx*bulge;
    if(road.control){
      const v=1-u;
      x=v*v*a.x+2*u*v*road.control.x+u*u*b.x;
      z=v*v*a.z+2*u*v*road.control.z+u*u*b.z;
    }
    const ramps=road.ramps||'both';
    const rise=Math.min(1,['both','start'].includes(ramps)?u*length/2:1,['both','end'].includes(ramps)?(1-u)*length/2:1);
    points.push({x,z,h:level*rise});
  }
  if(!road.offset) return points;
  return points.map((p,i)=>{
    const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
    const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1;
    return {...p,x:p.x-dz/len*road.offset,z:p.z+dx/len*road.offset};
  });
}

export function roadPath(road,size) {
  const samples=roadSamples(road), path=[];
  for(const p of samples){
    const x=Math.round(p.x), z=Math.round(p.z);
    const band=Math.abs(p.h)<0.24?0:road.level<0?2:road.level===2?3:1;
    const id=x+z*size+band*size*size;
    if(path.at(-1)?.id!==id) path.push({id,x,z,band,p});
  }
  return path;
}

export function addRoadMesh(kit, road, box, centre, water, heat, island) {
  const pts=roadSamples(road), width=road.kind==='avenida'?1.22:0.83;
  if(Math.hypot(road.b.x-road.a.x,road.b.z-road.a.z)===0 && road.shape!=='ring'){
    kit.add(box(width,0.07,width),'#666972',centre(road.a.x),0.045,centre(road.a.z),{edges:false});return;
  }
  // Each section shares its two kerb positions with the following section.
  const deck=p=>p.h*0.85+(water(Math.round(p.x),Math.round(p.z))?0.11:0.045);
  const sides=pts.map((p,i)=>{
    const loop=road.shape==='ring';
    const a=pts[i===0&&loop?pts.length-2:Math.max(i-1,0)],b=pts[i===pts.length-1&&loop?1:Math.min(pts.length-1,i+1)];
    const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1;
    return {x:dz/len,z:-dx/len};
  });
  for(let i=1;i<pts.length;i++){
    const a=pts[i-1], b=pts[i], x=(a.x+b.x)/2, z=(a.z+b.z)/2;
    if(road.shape!=='ring' && Math.abs((a.h+b.h)/2)<0.24 && island(Math.round(x),Math.round(z))) continue;
    const y=(deck(a)+deck(b))/2, dx=b.x-a.x, dz=b.z-a.z, dy=deck(b)-deck(a);
    const length=Math.hypot(dx,dz), ry=Math.atan2(dx,dz), rx=-Math.atan2(dy,length);
    const opts={ry,rx,edges:false};
    const base=heat?.(Math.round(x),Math.round(z)) || '#666972';
    const slab=box(1,1,1), pos=slab.attributes.position;
    for(let v=0;v<pos.count;v++){
      const end=pos.getZ(v)>0?i:i-1, p=pts[end], normal=sides[end], offset=pos.getX(v)*width;
      pos.setXYZ(v,centre(p.x)+normal.x*offset,deck(p)+pos.getY(v)*0.07,centre(p.z)+normal.z*offset);
    }
    slab.computeVertexNormals();
    kit.add(slab,base,0,0,0,{edges:false});
    if(i%4<2 || road.kind==='avenida') kit.add(box(0.042,0.012,length+0.01),road.kind==='avenida'?'#d9bd70':'#eee9d5',centre(x),y+0.042,centre(z),opts);
    if(road.one && i%12===0){
      for(const sign of [-1,1]) kit.add(box(0.045,0.012,0.18),'#fff4ce',centre(x)-sign*Math.cos(ry)*0.05,y+0.05,centre(z)+sign*Math.sin(ry)*0.05,{...opts,ry:ry+sign*0.65});
    }
    if((y>0.4 || water(Math.round(x),Math.round(z))) && i%10===0) kit.add(box(0.16,Math.max(0.15,y),0.16),'#b5afa3',centre(x),y/2,centre(z),{edges:false});
    if(road.level<0 && (i===2 || i===pts.length-2)){
      for(const sign of [-1,1]) kit.add(box(0.1,0.5,0.2),'#a49e92',centre(x)+Math.cos(ry)*width*0.5*sign,0.24,centre(z)-Math.sin(ry)*width*0.5*sign,opts);
      kit.add(box(width+0.13,0.1,0.2),'#aaa69d',centre(x),0.48,centre(z),{ry,edges:false});
    }
  }
}
