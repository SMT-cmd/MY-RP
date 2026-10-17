import * as THREE from 'three';
import {box,material,vehicleModel} from './models.js';
import {fitAsset} from './world-assets.js';

const surfaceScale={asphalt:2.3,grass:4,plaster:2,wood:2.1};
// Local CC0 surfaces are loaded once, repeated at metre scale and reused.
export function createSurfaceLibrary({loadTexture=(url,ready)=>new THREE.TextureLoader().load(url,ready)}={}){
 const sources=new Map(),materials=new Map(),textures=new Set();let alive=true;
 function source(kind,channel){const key=kind+'-'+channel;if(sources.has(key))return sources.get(key);const clones=new Set(),map=loadTexture('/assets/world/materials/'+key+'.webp',()=>{if(alive)for(const t of clones)t.needsUpdate=true;});map.colorSpace=channel==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;const record={map,clones};sources.set(key,record);return record;}
 function materialFor(kind,width,depth,color=0xffffff){
  if(!surfaceScale[kind])throw Error('Unknown world surface');const key=[kind,width,depth,new THREE.Color(color).getHexString()].join(':');if(materials.has(key))return materials.get(key);
  const maps={};for(const [slot,channel] of [['map','color'],['normalMap','normal'],['roughnessMap','roughness']]){const record=source(kind,channel),t=record.map.clone();t.repeat.set(width/surfaceScale[kind],depth/surfaceScale[kind]);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.needsUpdate=!!record.map.image;record.clones.add(t);textures.add(t);maps[slot]=t;}
  const mat=new THREE.MeshStandardMaterial({...maps,color,roughness:1,normalScale:new THREE.Vector2(kind==='grass'?.24:.45,kind==='grass'?.24:.45)});materials.set(key,mat);return mat;
 }
 return{material:materialFor,dispose(){alive=false;for(const mat of materials.values())mat.dispose();for(const texture of textures)texture.dispose();for(const record of sources.values())record.map.dispose();materials.clear();textures.clear();sources.clear();}};
}

// Background traffic never controls player vehicles or collisions.
export function trafficRoutes(map){return (map.roads??[]).filter(r=>r.w>=12&&r.h>=2).slice(0,5).flatMap((r,i)=>[
 {id:i*2,x0:r.x+.6,z0:r.y+r.h*.35,x1:r.x+r.w-.6,z1:r.y+r.h*.35,speed:3.1+i*.13,phase:(i*.217)%1},
 {id:i*2+1,x0:r.x+r.w-.6,z0:r.y+r.h*.66,x1:r.x+.6,z1:r.y+r.h*.66,speed:2.8+i*.11,phase:(.37+i*.173)%1}
]);}
export function sampleTraffic(route,seconds){const length=Math.hypot(route.x1-route.x0,route.z1-route.z0),t=((seconds*route.speed/Math.max(length,1)+route.phase)%1+1)%1;return{x:route.x0+(route.x1-route.x0)*t,z:route.z0+(route.z1-route.z0)*t,yaw:Math.atan2(route.x1-route.x0,route.z1-route.z0)};}
export function createCityEnvironment(world,assets=null){
 const root=new THREE.Group();root.name='Street detail and distant environment';const moving=[],roadList=world.map.roads??[],bounds=world.map,marks=[],poles=[],heads=[];
 for(const road of roadList){
  const horizontal=road.w>road.h,length=horizontal?road.w:road.h;
  for(let d=2;d<length-1;d+=3){const x=horizontal?road.x+d:road.x+road.w/2,z=horizontal?road.y+road.h/2:road.y+d;marks.push({x,z,w:horizontal?1.15:.045,d:horizontal?.045:1.15});}
  if(horizontal)for(let x=road.x+8;x<road.x+road.w-3;x+=22){const z=road.y+.13;poles.push({x,z});heads.push({x:x+.34,z:z+.25});}
  if(horizontal)for(const crossing of roadList.filter(r=>r.w<r.h))for(let n=0;n<5;n++)marks.push({x:crossing.x-.8,z:road.y+.35+n*(road.h-.7)/4,w:.65,d:.20});
 }
 const instances=(geo,mat,items,place)=>{if(!items.length)return;const mesh=new THREE.InstancedMesh(geo,mat,items.length),m=new THREE.Matrix4();for(let i=0;i<items.length;i++){place(m,items[i]);mesh.setMatrixAt(i,m);}mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;};
 instances(new THREE.BoxGeometry(1,.008,1),material(0xf3edcc),marks,(m,v)=>m.compose(new THREE.Vector3(v.x,.037,v.z),new THREE.Quaternion(),new THREE.Vector3(v.w,1,v.d)));
 instances(new THREE.CylinderGeometry(.035,.055,3.4,6),material(0x354f59,.5,.35),poles,(m,v)=>m.makeTranslation(v.x,1.70,v.z));
 const bulbs=instances(new THREE.BoxGeometry(.65,.09,.25),new THREE.MeshStandardMaterial({color:0xf0e9d8,emissive:0xffd5a0,emissiveIntensity:.6,roughness:.45}),heads,(m,v)=>m.makeTranslation(v.x,3.4,v.z));if(bulbs)bulbs.userData.ownedMaterial=true;
 const sea=new THREE.Mesh(new THREE.PlaneGeometry(120,bounds.height+200),new THREE.MeshStandardMaterial({color:0x2c9cb3,roughness:.24,metalness:.28}));sea.rotation.x=-Math.PI/2;sea.position.set(bounds.width+62,-.075,bounds.height/2);sea.userData.ownedMaterial=true;root.add(sea);box(root,1.5,.18,bounds.height,bounds.width+.75,-.025,bounds.height/2,0xc9c3ae);
 for(let i=0;i<16;i++){const x=i*8-10,z=-12-(i%3)*5,height=5+(i*7%13),building=box(root,3.5+(i%3),height,4.5,x,height/2,z,[0x8aa8ae,0x9fabb5,0x7f9f9e][i%3]);building.castShadow=false;for(let y=2;y<height-1;y+=2)box(root,3.65+(i%3),.12,4.65,x,y,z,0xa7bdc3);}
 for(const route of trafficRoutes(world.map).slice(0,8)){const key=route.id%4===0?'cars/van':route.id%3===0?'cars/suv-luxury':'cars/sedan',template=assets?.get(key),vehicle=template?fitAsset(template,1.25,2.75,null):vehicleModel(route.id%4===0?'van':'sedan');if(!template)vehicle.scale.set(.75,.75,.75);vehicle.name='Ambient road traffic';root.add(vehicle);moving.push({route,vehicle});}
 return{root,update(time,reduced=false,quality='medium'){const count=quality==='high'?8:4;for(let i=0;i<moving.length;i++){const item=moving[i];item.vehicle.visible=i<count;const p=sampleTraffic(item.route,reduced?0:time/1000);item.vehicle.position.set(p.x,.025,p.z);item.vehicle.rotation.y=p.yaw;}}};
}
