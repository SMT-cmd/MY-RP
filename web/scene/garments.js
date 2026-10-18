import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Original MY RP tailoring for the locally licensed adult rig. Separate cloth
// surfaces share its skeleton, never citizen state or game authority.
let weaveTexture;
function weave(){
 if(weaveTexture)return weaveTexture;const size=32,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,value=174+((x+y)%2?18:0)+(x%4===0?12:0);data.set([value,value,value,255],i);}
 weaveTexture=new THREE.DataTexture(data,size,size);weaveTexture.wrapS=weaveTexture.wrapT=THREE.RepeatWrapping;weaveTexture.repeat.set(7,9);weaveTexture.needsUpdate=true;return weaveTexture;
}
export function disposeGarmentTextures(){weaveTexture?.dispose();weaveTexture=undefined;}
function cloth(color,region,owned,shade=1){const c=new THREE.Color(color).multiplyScalar(shade),m=new THREE.MeshStandardMaterial({color:c,roughness:.93,bumpMap:weave(),bumpScale:.0013,side:THREE.DoubleSide});m.userData.appearanceRegion=region;owned.add(m);return m;}
function solid(color,region,owned,roughness=.65){const m=new THREE.MeshStandardMaterial({color,roughness});m.userData.appearanceRegion=region;owned.add(m);return m;}
function position(bone){return bone.getWorldPosition(new THREE.Vector3());}
function blend(indexA,indexB,t){return{indices:[indexA,indexB,0,0],weights:[1-t,t,0,0]};}
function single(index){return blend(index,index,0);}
function between(y,knots){if(y<=knots[0].y)return single(knots[0].index);for(let i=1;i<knots.length;i++)if(y<=knots[i].y){const a=knots[i-1],b=knots[i];return blend(a.index,b.index,(y-a.y)/(b.y-a.y));}return single(knots.at(-1).index);}
function geometry(vertices,indices,uvs,weights){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(weights.flatMap(w=>w.indices),4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights.flatMap(w=>w.weights),4));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;}
function loft(rings,weightAt,segments=20,opening=0){
 const vertices=[],indices=[],uvs=[],weights=[];
 for(let j=0;j<rings.length;j++){const r=rings[j];for(let i=0;i<=segments;i++){const angle=opening+i/segments*(Math.PI*2-opening*2),x=r.x+Math.sin(angle)*r.rx,y=r.y,z=(r.z??0)+Math.cos(angle)*r.rz;vertices.push(x,y,z);uvs.push(i/segments,j/(rings.length-1));weights.push(weightAt(x,y,z));if(j&&i){const a=(j-1)*(segments+1)+i-1,b=j*(segments+1)+i-1;indices.push(a,a+1,b+1,a,b+1,b);}}}
 return geometry(vertices,indices,uvs,weights);
}
function sleeve(rings,side,weightAt,segments=16){
 const vertices=[],indices=[],uvs=[],weights=[];
 for(let j=0;j<rings.length;j++){const r=rings[j];for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,x=side*r.x,y=r.y+Math.sin(a)*r.r,z=r.z+Math.cos(a)*r.r;vertices.push(x,y,z);uvs.push(i/segments,j/(rings.length-1));weights.push(weightAt(x,y,z));if(j&&i){const k=(j-1)*(segments+1)+i-1,b=j*(segments+1)+i-1;if(side>0)indices.push(k,b,b+1,k,b+1,k+1);else indices.push(k,k+1,b+1,k,b+1,b);}}}
 return geometry(vertices,indices,uvs,weights);
}
function weightGeometry(g,weightAt){const p=g.getAttribute('position'),weights=[];for(let i=0;i<p.count;i++)weights.push(weightAt(p.getX(i),p.getY(i),p.getZ(i)));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(weights.flatMap(w=>w.indices),4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights.flatMap(w=>w.weights),4));if(!g.index)g.setIndex(Array.from({length:p.count},(_,i)=>i));return g;}
function add(source,g,material,name,layer){const m=new THREE.SkinnedMesh(g,material);m.name=name;m.userData.garment=layer;m.castShadow=m.receiveShadow=true;m.frustumCulled=false;m.position.copy(source.position);m.quaternion.copy(source.quaternion);m.scale.copy(source.scale);m.bindMode=source.bindMode;m.bind(source.skeleton,source.bindMatrix.clone());source.parent.add(m);return m;}
function panel(source,points,mat,name,weightAt,layer='detail'){const g=geometry(points.flat(),[0,1,2,0,2,3],[0,0,1,0,1,1,0,1],points.map(([x,y,z])=>weightAt(x,y,z)));return add(source,g,mat,name,layer);}
function batchTailoring(source,parts){
 // One draw per fabric. Each sewn piece retains vertices, seams and weights.
 const batches=new Map();for(const part of parts){const batch=batches.get(part.material)??[];batch.push(part);batches.set(part.material,batch);}
 return [...batches].map(([mat,pieces])=>{if(pieces.length===1)return pieces[0];const g=mergeGeometries(pieces.map(p=>p.geometry),false),combined=add(source,g,mat,'Tailored '+mat.userData.appearanceRegion+' pieces',mat.userData.appearanceRegion);combined.userData.garmentParts=pieces.map(p=>({name:p.name,layer:p.userData.garment}));for(const p of pieces){p.removeFromParent();p.geometry.dispose();}return combined;});
}
export function buildGarments(source,appearance,ownedMaterials){
 const bones=new Map(source.skeleton.bones.map((b,i)=>[b.name,{bone:b,index:i,p:position(b)}]));
 const b=name=>bones.get(name),pelvis=b('pelvis').p.y,neck=b('neck_01').p.y,shoulder=b('upperarm_l').p,foot=b('foot_l').p;
 const female=shoulder.x<.19,outfit=appearance.outfit??'tee',long=outfit!=='tee',jacket=outfit==='jacket',tunic=outfit==='tunic';
 const shirt=cloth(appearance.shirt??0x2e7477,'top',ownedMaterials),trim=cloth(appearance.shirt??0x2e7477,'top',ownedMaterials,.78),pants=cloth(appearance.trousers??0x303f52,'bottom',ownedMaterials),pantsTrim=cloth(appearance.trousers??0x303f52,'bottom',ownedMaterials,.74),lining=cloth(0xe7dfcc,'fixed',ownedMaterials),shoe=solid(0x292f34,'fixed',ownedMaterials),sole=solid(0xe5decf,'fixed',ownedMaterials),metal=solid(0xb6a77b,'fixed',ownedMaterials,.4);
 const spine=[b('pelvis'),b('spine_01'),b('spine_02'),b('spine_03')].map(v=>({index:v.index,y:v.p.y})),torsoWeight=(_x,y)=>between(y,spine),parts=[];
 const hem=pelvis+(tunic?-.16:jacket?-.025:.045),waist=pelvis+.13,chest=b('spine_03').p.y+.045,rx=female?.174:.199;
 const rings=[{x:0,y:hem,z:-.015,rx:rx+(tunic?.035:jacket?.018:0),rz:.144},{x:0,y:hem+.027,z:-.015,rx:rx+(tunic?.031:jacket?.017:0),rz:.143},{x:0,y:waist,z:-.015,rx:rx-.014,rz:.139},{x:0,y:b('spine_02').p.y+.025,z:-.015,rx:rx+.004,rz:female?.160:.153},{x:0,y:chest,z:-.020,rx:rx+.016,rz:female?.164:.162},{x:0,y:shoulder.y+.015,z:-.018,rx:Math.max(shoulder.x,rx)+.019,rz:.122},{x:0,y:neck+.001,z:-.026,rx:.073,rz:.071}];
 parts.push(add(source,loft(rings,torsoWeight,24,jacket?.16:0),shirt,'Tailored '+outfit+' body','top'));
 parts.push(add(source,loft([{...rings[0],y:hem-.004,rx:rings[0].rx+.002,rz:rings[0].rz+.002},{...rings[1],y:hem+.018,rx:rings[1].rx+.002,rz:rings[1].rz+.002}],torsoWeight),trim,'Stitched shirt hem','hem'));
 const collarY=neck+.002;parts.push(add(source,loft([{x:0,y:collarY-.008,z:-.026,rx:.076,rz:.074},{x:0,y:collarY+.013,z:-.026,rx:.075,rz:.073}],torsoWeight,24),trim,long?'Stand collar':'Ribbed neck opening','collar'));
 for(const side of [-1,1]){
  const suffix=side>0?'l':'r',upper=b('upperarm_'+suffix),lower=b('lowerarm_'+suffix),hand=b('hand_'+suffix),elbowX=Math.abs(lower.p.x),wristX=Math.abs(hand.p.x),end=long?wristX-.018:Math.abs(upper.p.x)+(elbowX-Math.abs(upper.p.x))*.69;
  const armWeight=x=>{const a=Math.abs(x),shoulderX=Math.abs(upper.p.x);if(a<shoulderX+.07)return blend(b('spine_03').index,upper.index,Math.max(0,Math.min(1,(a-shoulderX+.05)/.12)));return a<=elbowX?single(upper.index):blend(upper.index,lower.index,Math.min(1,(a-elbowX)/.035));};
  const srings=[{x:Math.abs(upper.p.x)-.035,y:upper.p.y,z:upper.p.z,r:.078},{x:Math.abs(upper.p.x)+.035,y:upper.p.y,z:upper.p.z,r:.073},{x:Math.min(end,elbowX-.018),y:upper.p.y,z:lower.p.z,r:long?.068:.066}];
  if(long)srings.push({x:elbowX+.035,y:lower.p.y,z:lower.p.z,r:.068},{x:end-.024,y:hand.p.y,z:hand.p.z,r:.055},{x:end,y:hand.p.y,z:hand.p.z,r:.053});
  parts.push(add(source,sleeve(srings,side,armWeight),shirt,(side>0?'Left':'Right')+(long?' shaped sleeve':' short sleeve'),'sleeve'));
  const last=srings.at(-1);parts.push(add(source,sleeve([{...last,x:end-.018,r:last.r+.002},{...last,x:end+.002,r:last.r+.002}],side,armWeight),trim,'Bound sleeve cuff','cuff'));
 }
 if(long){
  for(const side of [-1,1]){
   const s=side,top=neck-.015,z=.143;parts.push(panel(source,[[s*.022,top,.064],[s*.087,top-.035,.12],[s*.105,top-.14,z+.015],[s*.033,top-.10,z+.019]],jacket?lining:trim,'Folded collar',torsoWeight,'collar'));
   if(jacket)parts.push(panel(source,[[s*.037,top-.09,z+.016],[s*.109,top-.15,z+.019],[s*.074,top-.285,z+.023],[s*.024,top-.19,z+.024]],trim,'Jacket lapel',torsoWeight,'lapel'));
   const py=pelvis+.22,px=s*.102,pz=.135;parts.push(panel(source,[[px-.044,py,pz],[px+.044,py,pz],[px+.038,py-.075,pz+.007],[px-.038,py-.075,pz+.007]],trim,'Sewn patch pocket',torsoWeight,'pocket'));
  }
  if(jacket)parts.push(panel(source,[[-.055,neck-.038,.092],[.055,neck-.038,.092],[.045,hem+.018,.146],[-.045,hem+.018,.146]],lining,'Layered inner shirt',torsoWeight,'lining'));
  for(const y of [hem+.12,hem+.23,hem+.34]){const g=new THREE.SphereGeometry(.0065,8,6);g.translate(0,y,.153);parts.push(add(source,weightGeometry(g,torsoWeight),metal,'Shirt button','button'));}
 }
 const hipTop=pelvis+.067;parts.push(add(source,loft([{x:0,y:hipTop,z:-.035,rx:.181,rz:.148},{x:0,y:pelvis+.005,z:-.035,rx:.196,rz:.152},{x:0,y:pelvis-.10,z:-.033,rx:.196,rz:.145}],()=>single(b('pelvis').index)),pants,'Trouser waistband and seat','bottom'));
 parts.push(add(source,loft([{x:0,y:hipTop+.002,z:-.035,rx:.183,rz:.150},{x:0,y:hipTop-.021,z:-.035,rx:.183,rz:.150}],()=>single(b('pelvis').index)),pantsTrim,'Trouser waistband','waistband'));
 for(const side of [-1,1]){
  const suffix=side>0?'l':'r',thigh=b('thigh_'+suffix),knee=b('calf_'+suffix),ankle=b('foot_'+suffix),p=thigh.p,c=knee.p,f=ankle.p;
  const legWeight=(_x,y)=>y>=p.y-.06?blend(b('pelvis').index,thigh.index,.66):y>c.y+.045?single(thigh.index):y>c.y-.045?blend(thigh.index,knee.index,(c.y+.045-y)/.09):single(knee.index);
  const prings=[{x:p.x,y:p.y+.008,z:p.z,rx:.100,rz:.132},{x:p.x,y:p.y-.15,z:p.z,rx:.099,rz:.121},{x:c.x,y:c.y+.10,z:c.z,rx:.081,rz:.100},{x:c.x,y:c.y-.025,z:c.z,rx:.078,rz:.089},{x:c.x,y:f.y+.065,z:f.z+.018,rx:.065,rz:.075},{x:c.x,y:f.y+.040,z:f.z+.018,rx:.065,rz:.073}];
  parts.push(add(source,loft(prings,legWeight,18),pants,(side>0?'Left':'Right')+' tailored trouser leg','bottom'));
  const cuff=prings.at(-1);parts.push(add(source,loft([{...cuff,y:cuff.y+.022,rx:.067,rz:.076},{...cuff,y:cuff.y,rx:.067,rz:.076}],legWeight,18),pantsTrim,'Turned trouser cuff','trouser-cuff'));
  for(const [h,y,mat,name] of [[.116,.076,shoe,'Leather sneaker upper'],[.032,.024,sole,'Rubber sneaker sole']]){const g=new RoundedBoxGeometry(.155,h,.348,3,.020);g.translate(f.x,y,f.z+.076);parts.push(add(source,weightGeometry(g,()=>single(ankle.index)),mat,name,'shoe'));}
  for(const z of [.028,.057,.086]){const g=new THREE.BoxGeometry(.070,.006,.009);g.translate(f.x,.139,f.z+z);parts.push(add(source,weightGeometry(g,()=>single(ankle.index)),sole,'Sneaker lace','shoe'));}
 }
 return{parts:batchTailoring(source,parts),coverage:{hem,neck:neck-.005,shortSleeveEnd:Math.abs(shoulder.x)+(Math.abs(b('lowerarm_l').p.x)-Math.abs(shoulder.x))*.69,longSleeveEnd:Math.abs(b('hand_l').p.x)-.018,hipTop,footTop:foot.y+.065},boneIndices:bones};
}
export function exposedSkinGeometry(source,coverage,outfit){
 const g=source.clone(),p=g.getAttribute('position'),index=g.index,kept=[];
 const visible=(x,y)=>{if(y<coverage.hipTop)return false;if(y<coverage.neck&&Math.abs(x)<.255)return false;const sleeveEnd=outfit==='tee'?coverage.shortSleeveEnd:coverage.longSleeveEnd;if(y>coverage.hem&&y<coverage.neck+.11&&Math.abs(x)<sleeveEnd)return false;return true;};
 // Low-poly chest faces can extend far below their neck-centred centroid.
 // Retain the head/neck only when all vertices clear the collar boundary.
 for(let i=0;i<index.count;i+=3){const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2),head=Math.min(p.getY(a),p.getY(b),p.getY(c))>coverage.neck-.025;if(head||visible((p.getX(a)+p.getX(b)+p.getX(c))/3,(p.getY(a)+p.getY(b)+p.getY(c))/3))kept.push(a,b,c);}
 g.clearGroups();g.setIndex(kept);g.computeBoundingBox();g.computeBoundingSphere();return g;
}
