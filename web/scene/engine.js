import * as THREE from 'three';
import {adultModel,furnitureModel,vehicleModel,partitionModel,treeModel,finishes,box,mesh,material,disposeModels,disposeMaterialCache} from './models.js';
import {adjacentMotion,sampleMotion,activityAnchor,activityTimeline} from './motion.js';
import {createCameraRig,groundPick} from './camera.js';
import {createCityEnvironment,createSurfaceLibrary} from './environment.js';
import {sampleNavigation} from './navigation.js';
import {createActivityEffects} from './activity-effects.js';
import {createCharacterLibrary} from './authored-characters.js';
import {updateHomeLights} from './lighting.js';
import {createWorldAssetLibrary,fitAsset} from './world-assets.js';
import {FURNITURE_ASSETS,buildingAsset,furnitureAsset,carAsset,requiredAssets} from './asset-catalogue.js';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const heading={front:0,back:Math.PI,left:-Math.PI/2,right:Math.PI/2};
export function crowdModels(people=[]){return people.slice(0,32).map(person=>{const rig=adultModel(person.avatar);rig.root.position.set(person.x+.5,0,person.y+.5);rig.root.rotation.y=heading[person.facing]??0;rig.root.name=person.name;rig.root.userData.citizenId=person.id;return{person,rig};});}
export function sceneGeometry(world,assets=null,surfaces=null){
 const root=new THREE.Group(),room=world.home??world.venue,walls=[],fixtures=[],places=[],partitions=[],lights=[],solids=[];let environment=null;
 const furnishing=f=>{const key=furnitureAsset(f),template=assets?.get(key);if(!template)return furnitureModel(f);const form=FURNITURE_ASSETS[f.kind??f.model??f.id],turned=f.rotation%180,object=fitAsset(template,(turned?f.h:f.w)-.1,(turned?f.w:f.h)-.1,form[3],f.rotation??0,finishes[f.finish]);object.name=f.name;object.traverse(o=>o.userData.fixtureId=f.id);if(f.action==='Light'){const original=furnitureModel(f),lamp=original.userData.lighting;if(lamp){original.traverse(o=>{if(o.isMesh)o.visible=o===lamp.bulb;});object.add(original);object.userData.lighting=lamp;}}return object;};
 if(room){
  box(root,room.width,.10,room.height,room.width/2,-.055,room.height/2,finishes[room.floor]??finishes.oak);
  const geometry=new THREE.BoxGeometry(.48,.012,.99),boards=new THREE.InstancedMesh(geometry,surfaces?.material('wood',.48,.99)??material(0xffffff),room.width*2*room.height),matrix=new THREE.Matrix4();let index=0;
  const floors=new Map((room.rooms??[]).flatMap(r=>r.tiles.map(t=>[t.x+':'+t.y,r.floor])));for(let x=0;x<room.width*2;x++)for(let z=0;z<room.height;z++){matrix.makeTranslation((x+.5)/2,.004,z+.5);boards.setMatrixAt(index,matrix);boards.setColorAt(index++,new THREE.Color(finishes[floors.get(Math.floor(x/2)+':'+z)]??finishes[room.floor]??finishes.oak));}boards.receiveShadow=true;root.add(boards);
  walls.push(box(root,room.width,2.75,.12,room.width/2,1.375,-.06,finishes[room.wall]??finishes.cream));walls.push(box(root,.12,2.75,room.height,-.06,1.375,room.height/2,finishes[room.wall]??finishes.cream));
  const shellColour=finishes[room.wall]??finishes.cream,exitX=room.exit?.x??4;
  walls.push(box(root,.12,2.75,room.height,room.width+.06,1.375,room.height/2,shellColour));
  const south=new THREE.Group();root.add(south);if(exitX>0)box(south,exitX,2.75,.12,exitX/2,1.375,room.height+.06,shellColour);if(room.width>exitX+1)box(south,room.width-exitX-1,2.75,.12,(room.width+exitX+1)/2,1.375,room.height+.06,shellColour);box(south,1,.40,.12,exitX+.5,2.55,room.height+.06,shellColour);walls.push(south);
  if(surfaces)for(const wall of walls)wall.traverse(part=>{if(part.isMesh)part.material=surfaces.material('plaster',part.geometry.parameters.width??room.width,2.75,shellColour);});
  box(root,room.width,.08,.05,room.width/2,.055,.03,finishes.walnut);box(root,.05,.08,room.height,.03,.055,room.height/2,finishes.walnut);
  for(const f of room.fixtures){const object=furnishing(f);object.position.set(f.x+f.w/2,0,f.y+f.h/2);root.add(object);fixtures.push(object);if(object.userData.lighting){const lamp=object.userData.lighting,light=new THREE.PointLight(0xffd4a0,0,5,2);light.castShadow=false;light.position.set(object.position.x,lamp.height,object.position.z);root.add(light);lights.push({...lamp,light});}}
  // Architectural details are part of the shell, not purchasable inventory.
  for(const x of [room.width*.25,room.width*.70]){box(root,1.55,1.25,.035,x,1.65,.02,0x9fb9c2,.025);for(const side of [-1,1])box(root,.065,1.38,.08,x+side*.8,1.65,.05,0xe5dfd2,.012);box(root,1.7,.07,.18,x,1.0,.10,0xe5dfd2,.012);box(root,.035,1.25,.08,x,1.65,.065,0xf1e7cf);for(const side of [-1,1])box(root,.22,1.65,.10,x+side*.96,1.48,.10,0xcbb9a3,.04);}
  for(let z=.7;z<room.height;z+=1.6){box(root,.035,1.4,.70,.025,1.35,z,0xb89463,.025);box(root,.055,1.18,.50,.045,1.35,z,0x243a4b,.012);}
  for(const p of room.partitions??[]){const wall=partitionModel(p,finishes[room.wall]??finishes.cream);root.add(wall);partitions.push(wall);}
  box(root,.70,.025,.44,4.5,.018,7.5,0x466951,.012);
 }else{
  const ground=box(root,world.map.width,.10,world.map.height,world.map.width/2,-.07,world.map.height/2,0x709c54);if(surfaces)ground.material=surfaces.material('grass',world.map.width,world.map.height,0xa6b88c);
  const roads=world.map.roads??[{x:0,y:6,w:world.map.width,h:3}];
  for(const road of roads){const asphalt=box(root,road.w,.025,road.h,road.x+road.w/2,.005,road.y+road.h/2,0x424b51);if(surfaces)asphalt.material=surfaces.material('asphalt',road.w,road.h,0xb4b9bc);
   if(road.w>road.h){for(const z of [road.y+.3,road.y+road.h-.3])box(root,road.w,.07,.60,road.x+road.w/2,.025,z,0xc9c4b6);}
   else{for(const x of [road.x+.2,road.x+road.w-.2])box(root,.40,.07,road.h,x,.025,road.y+road.h/2,0xc9c4b6);}
  }
  for(const object of world.map.obstacles??[]){
   if(object.kind==='tree'){const template=assets?.get('suburban/tree-large'),tree=template?fitAsset(template,1.4,1.4,3.8):treeModel();tree.position.set(object.x+.5,0,object.y+.5);root.add(tree);}
   else{const template=assets?.get(buildingAsset(object)),building=template?fitAsset(template,object.w-.12,object.h-.12):new THREE.Group();building.name=object.name;building.position.set(object.x+object.w/2,0,object.y+object.h/2);root.add(building);if(!template){box(building,object.w,2.8,object.h,0,1.4,0,object.colour,.025);box(building,object.w+.18,.18,object.h+.18,0,2.87,0,0x7b796d,.025);for(const side of [-1,1])for(const x of [-1.5,1.5]){box(building,.70,.85,.06,x,1.70,side*(object.h/2+.025),0x879ea2,.025);box(building,.04,.85,.08,x,1.70,side*(object.h/2+.055),0xe8dfd0);}}
    const entrance=[world.residence,...(world.guestEntrances??[])].find(e=>e?.facadeId===object.id);if(entrance){const b=entrance;building.name=b.name;box(building,.82,2.0,.09,b.door.x+.5-(object.x+object.w/2),1.0,object.h/2+.05,finishes.walnut,.025);box(building,1.3,.08,.55,0,2.22,object.h/2+.22,0xe3d3b9,.02);box(building,.82,.012,.50,0,.02,object.h/2+.30,0x466951);building.traverse(o=>o.userData.buildingId=b.id);places.push(building);}
   }
  }
  for(const object of world.map.streetObjects??[]){const bench=furnishing({...object,finish:'walnut'});bench.position.set(object.x+object.w/2,0,object.y+object.h/2);bench.traverse(o=>o.userData.streetObjectId=object.id);root.add(bench);places.push(bench);}
  for(const b of world.map.buildings){
   const template=assets?.get(buildingAsset(b)),g=template?fitAsset(template,b.w-.12,b.h-.12):new THREE.Group();g.name=b.name;g.position.set(b.x+b.w/2,0,b.y+b.h/2);root.add(g);const wallColor=new THREE.Color(b.colour??0xe3d3b9);
   if(!template){box(g,b.w,2.55,b.h,0,1.275,0,wallColor,.025);box(g,b.w+.18,.15,b.h+.18,0,2.65,0,0x98654a,.025);}
   const front=b.door.y>=b.y+b.h?1:-1;box(g,.78,1.80,.075,b.door.x+.5-(b.x+b.w/2),.90,front*(b.h/2+.045),0x536760,.035);
   for(const x of [-b.w*.28,b.w*.28]){box(g,.73,.80,.055,x,1.58,front*(b.h/2+.05),0x809ea2,.025);box(g,.04,.80,.08,x,1.58,front*(b.h/2+.08),0xeee3cc);}
   box(g,b.w-.25,.20,.35,0,2.18,front*(b.h/2+.14),0xf3ead7,.02);g.traverse(o=>o.userData.buildingId=b.id);places.push(g);
  }
  environment=createCityEnvironment(world,assets);root.add(environment.root);
  const guide=adultModel({shirt:0x7e8864,skin:0x73452f,trousers:0x5e534a});guide.root.position.set(world.map.guide.x+.5,0,world.map.guide.y+.5);guide.root.name=world.map.guide.name;root.add(guide.root);
  for(const bay of world.parking?.bays??[]){const px=bay.x+bay.w/2,pz=bay.y+bay.h/2;box(root,bay.w-.02,.018,bay.h-.02,px,.022,pz,0x89998c);for(const x of [bay.x+.03,bay.x+bay.w-.03])box(root,.025,.010,bay.h-.10,x,.040,pz,0xe6dfc9);const parked=world.parking.vehicles.find(v=>v.slot===bay.slot);if(parked){const template=assets?.get(carAsset(parked.model)),car=template?fitAsset(template,1.7,4.15,null):vehicleModel(parked.model);car.position.set(px,.03,pz);root.add(car);}}

 }
 root.updateMatrixWorld(true);
 if(room){for(const wall of [...walls,...partitions])wall.traverse(part=>{if(part.isMesh)solids.push(new THREE.Box3().setFromObject(part));});}
 else for(const b of [...world.map.buildings,...(world.map.obstacles??[]).filter(o=>o.kind!=='tree')])solids.push(new THREE.Box3(new THREE.Vector3(b.x,0,b.y),new THREE.Vector3(b.x+b.w,14,b.y+b.h)));
 return{root,walls,fixtures,places,partitions,lights,solids,environment};
}
export function createEngine(host,onFailure,onReady=()=>{}){
 let firstPaint=true;
 const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.outputColorSpace=THREE.SRGBColorSpace;
 const canvas=renderer.domElement;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Your city and furnished rooms in 3D. Drag to look around, or tap a destination.');canvas.className='world-3d-canvas';host.replaceChildren(canvas);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xb7d9ee);scene.fog=new THREE.Fog(0xb7d9ee,28,88);const ambient=new THREE.HemisphereLight(0xfff8e9,0x789a76,2.1);scene.add(ambient);
 const sun=new THREE.DirectionalLight(0xffe8c4,2.9);sun.position.set(8,15,9);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-18;sun.shadow.camera.right=18;sun.shadow.camera.top=18;sun.shadow.camera.bottom=-18;sun.shadow.normalBias=.035;scene.add(sun);scene.add(sun.target);
 const library=createCharacterLibrary(),worldAssets=createWorldAssetLibrary(),surfaces=createSurfaceLibrary(),makeAdult=appearance=>adultModel(appearance,library.get(appearance?.body??'male'),library.eyeTexture);
 let actor=makeAdult(),avatarSignature='';scene.add(actor.root);const effects=createActivityEffects();scene.add(effects.root);
 const neighbours=new Map(),raycaster=new THREE.Raycaster(),indoorSky=new THREE.Color(0xc8d7db),outdoorSky=new THREE.Color(0xb7d9ee);let sky=null;
 let world=null,geometry=null,signature='',frame=null,quality='medium',lastPaint=0,previousTime=0,motion=null,walkWeight=0,distance=0,yaw=0,targetYaw=0,selection=null,ghost=null,alive=true,paused=false,raised=false,receivedAt=0,clockServerTime=0,activityStart=0,activitySignature='',cameraTeleport=true,playerCar=null,playerCarKey='';
 const walkPosition=new THREE.Vector3(),pointers=new Map();let drag=null,pinch=null;
 new THREE.TextureLoader().load('/assets/world/materials/sky-color.webp',texture=>{if(!alive){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;texture.mapping=THREE.EquirectangularReflectionMapping;sky=texture;if(world&&!world.home&&!world.venue)scene.background=sky;},undefined,()=>{});
 const controls=document.createElement('div');controls.className='world-camera-controls';const status=document.createElement('p');status.className='hint';status.textContent='Drag to look around · pinch or scroll to zoom · tap to walk or interact';host.append(controls,status);
 const listeners=new AbortController(),options={signal:listeners.signal};const rig=createCameraRig({onChange:detail=>window.dispatchEvent(new CustomEvent('camera-state',{detail}))});
 const destinationRing=new THREE.Mesh(new THREE.RingGeometry(.22,.29,32),new THREE.MeshBasicMaterial({color:0xffcf73,side:THREE.DoubleSide,depthWrite:false}));destinationRing.rotation.x=-Math.PI/2;destinationRing.visible=false;scene.add(destinationRing);
 const currentRoom=()=>world?.home??world?.venue??null;
 window.addEventListener('walk-target',e=>{const d=e.detail,room=currentRoom();destinationRing.visible=!!d&&!!world&&(d.homeId??d.venueId??null)===(room?.id??null)&&d.leaseVersion===world.position.leaseVersion;if(destinationRing.visible)destinationRing.position.set(d.x+.5,.04,d.y+.5);},options);
 window.addEventListener('camera-mode',e=>{if(rig.setMode(e.detail?.mode)){raised=false;cameraTeleport=true;}},options);
 window.addEventListener('camera-look',e=>{const yaw=e.detail?.yaw,pitch=e.detail?.pitch;if(Number.isFinite(yaw)&&Number.isFinite(pitch))rig.orbit(yaw,pitch);},options);
 const button=(text,label,action)=>{const b=document.createElement('button');b.type='button';b.dataset.gameUi='';b.textContent=text;b.setAttribute('aria-label',label);b.title=label;b.addEventListener('click',action,options);controls.append(b);};
 button('−','Zoom out',()=>rig.zoom(.15));button('+','Zoom in',()=>rig.zoom(-.15));button('◎','Find my character',()=>{rig.center();selection=null;setGhost(null);});button('Walls','Raise or cut away walls in overview',()=>{raised=!raised;if(rig.mode!=='overview')rig.setMode('overview');});
 function resize(){const width=Math.max(host.clientWidth||960,320),height=Math.max(host.clientHeight||Math.min(width*.625,600),200);renderer.setSize(width,height);rig.resize(width,height);}
 const observer=new ResizeObserver(resize);observer.observe(host);resize();
 function clearGeometry(){if(geometry){scene.remove(geometry.root);disposeModels(geometry.root);geometry=null;}}
 function syncCrowd(next){
  const present=new Set(),now=performance.now();
  for(const person of [...(next.people??[]).slice(0,32),...(next.npcs??[]).slice(0,6)]){
   present.add(person.id);const signature=JSON.stringify([person.avatar,library.revision]),previous=neighbours.get(person.id);let item=previous;
   if(!item||item.signature!==signature){const adult=makeAdult(person.avatar),position=previous?.position??new THREE.Vector3(person.x+.5,0,person.y+.5);adult.root.position.copy(position);if(previous){scene.remove(previous.rig.root);disposeModels(previous.rig.root);}if(person.kind==='npc')adult.root.traverse(o=>o.userData.npcId=person.id);item={rig:adult,position,signature,person,motion:previous?.motion??null,distance:previous?.distance??0,yaw:heading[person.facing]??0,activityKey:previous?.activityKey??'',activityStart:previous?.activityStart??now};neighbours.set(person.id,item);scene.add(adult.root);}
   const before=previous?.person;if(before&&(before.x!==person.x||before.y!==person.y)){const to={x:person.x+.5,z:person.y+.5},steps=Math.abs(before.x-person.x)+Math.abs(before.y-person.y);if(!person.navigation&&steps===1)item.motion=adjacentMotion({x:item.position.x,z:item.position.z},to,now,person.kind==='npc'?1500:undefined);else{item.motion=null;item.position.set(to.x,0,to.z);item.distance=0;}}
   const activityKey=JSON.stringify(person.activity??null);if(activityKey!==item.activityKey){item.activityKey=activityKey;item.activityStart=Math.max(now,item.motion?.end??0);}item.person=person;
  }
  for(const [id,item] of neighbours)if(!present.has(id)){scene.remove(item.rig.root);disposeModels(item.rig.root);neighbours.delete(id);}
 }
 function setGhost(value){if(ghost){scene.remove(ghost);disposeModels(ghost);ghost.material.dispose();ghost=null;}if(!value)return;ghost=new THREE.Mesh(new THREE.BoxGeometry(value.w,.04,value.h),new THREE.MeshBasicMaterial({color:value.valid?0x4d956b:0xb94e47,transparent:true,opacity:.55,depthWrite:false}));ghost.position.set(value.x+value.w/2,.045,value.y+value.h/2);scene.add(ghost);}
 function refreshGhost(point){if(!selection||!world?.home||selection.homeId!==world.home.id)return;const room=world.home,x=Math.floor(point.x),y=Math.floor(point.z),w=selection.rotation%180?selection.h:selection.w,h=selection.rotation%180?selection.w:selection.h;
  const overlap=room.fixtures.some(f=>f.instanceId!==selection.itemId&&x<f.x+f.w&&x+w>f.x&&y<f.y+f.h&&y+h>f.y),actorX=room.x,actorY=room.y;
  const wallConflict=(room.partitions??[]).some(p=>(p.axis==='v'?x<p.x&&p.x<x+w&&y<=p.y&&p.y<y+h:y<p.y&&p.y<y+h&&x<=p.x&&p.x<x+w)||(p.door&&[[p.x,p.y],[p.x-(p.axis==='v'?1:0),p.y-(p.axis==='h'?1:0)]].some(([dx,dy])=>x<=dx&&dx<x+w&&y<=dy&&dy<y+h)));
  const valid=!wallConflict&&x>=0&&y>=0&&x+w<=room.width&&y+h<=room.height&&!overlap&&!(x<=4&&4<x+w&&y<=7&&6<y+h)&&!(x<=actorX&&actorX<x+w&&y<=actorY&&actorY<y+h);setGhost({x,y,w,h,valid});window.dispatchEvent(new CustomEvent('furniture-floor-select',{detail:{itemId:selection.itemId,homeId:room.id,homeVersion:room.version,x,y,valid}}));
 }
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();onFailure();},options);
 canvas.addEventListener('wheel',e=>{e.preventDefault();rig.zoom(clamp(e.deltaY,-200,200)*.0015);},{...options,passive:false});canvas.addEventListener('contextmenu',e=>e.preventDefault(),options);
 canvas.addEventListener('pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,pan:e.shiftKey||e.button===1||e.button===2};if(pointers.size>1){drag.moved=true;pinch=null;}canvas.setPointerCapture(e.pointerId);},options);
 canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size>1){const [a,b]=[...pointers.values()],next={distance:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2};if(pinch){rig.zoom(Math.log(Math.max(1,pinch.distance)/Math.max(1,next.distance)));rig.pan(next.x-pinch.x,next.y-pinch.y);}pinch=next;if(drag)drag.moved=true;return;}if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.lastX,dy=e.clientY-drag.lastY;if(Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)>5)drag.moved=true;if(!drag.moved)return;if(drag.pan||rig.mode==='overview')rig.pan(dx,dy);else rig.orbit(-dx*.0055,dy*.0045);drag.lastX=e.clientX;drag.lastY=e.clientY;},options);
 canvas.addEventListener('pointerup',e=>{
  const wasMulti=pointers.size>1;pointers.delete(e.pointerId);pinch=null;if(!drag)return;const moved=drag.moved||wasMulti||e.button>0;drag=null;if(moved||!world||!geometry)return;
  const bounds=canvas.getBoundingClientRect(),camera=rig.camera;raycaster.setFromCamera(new THREE.Vector2((e.clientX-bounds.left)/bounds.width*2-1,-(e.clientY-bounds.top)/bounds.height*2+1),camera);const room=currentRoom(),point=groundPick(camera,e.clientX,e.clientY,bounds,room??world.map);
  if(selection){if(point)refreshGhost(point);return;}
  if(room){const fixtureHit=raycaster.intersectObjects(geometry.fixtures,true)[0],wallHit=raycaster.intersectObjects([...geometry.walls.filter(w=>w.visible),...geometry.partitions],true)[0],fixture=fixtureHit&&(!wallHit||fixtureHit.distance<wallHit.distance)?fixtureHit.object.userData.fixtureId:null;if(fixture){window.dispatchEvent(new CustomEvent(world.home?'home-fixture-select':'venue-fixture-select',{detail:{fixtureId:fixture,...(world.home?{homeId:room.id}:{venueId:room.id}),leaseVersion:world.position.leaseVersion}}));return;}}
  else{const npc=raycaster.intersectObjects([...neighbours.values()].filter(n=>n.person.kind==='npc').map(n=>n.rig.root),true)[0]?.object.userData.npcId;if(npc){window.dispatchEvent(new CustomEvent('npc-select',{detail:{npcId:npc}}));return;}const object=raycaster.intersectObjects(geometry.places,true)[0]?.object.userData;if(object?.buildingId){window.dispatchEvent(new CustomEvent('building-select',{detail:{buildingId:object.buildingId,leaseVersion:world.position.leaseVersion}}));return;}if(object?.streetObjectId){window.dispatchEvent(new CustomEvent('street-object-select',{detail:{objectId:object.streetObjectId,leaseVersion:world.position.leaseVersion}}));return;}}
  if(point)window.dispatchEvent(new CustomEvent('world-tile-select',{detail:{x:Math.floor(point.x),y:Math.floor(point.z),homeId:world.home?.id??null,venueId:world.venue?.id??null,leaseVersion:world.position.leaseVersion}}));
 },options);
 canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);drag=null;pinch=null;},options);
 window.addEventListener('furniture-edit',e=>{selection=e.detail;setGhost(null);if(selection&&Number.isInteger(selection.x)&&Number.isInteger(selection.y))refreshGhost({x:selection.x+.5,z:selection.y+.5});status.textContent=selection?'Tap a clear floor tile, then save the position. Red footprints need a different position.':'Drag to look around · pinch or scroll to zoom · tap to walk or interact';},options);
 function poseActivity(adult,activity,basePosition,visualNow,renderTime,start,walking,reduced,walkDistance,actorYaw){
  adult.root.position.copy(basePosition);adult.root.rotation.y=actorYaw;let kind=null,seatHeight=.575,activityWeight=1,timeline=null,fixture=null,contactDistance=0;const room=currentRoom();
  if(activity&&!walking&&visualNow>=activity.startedAt&&visualNow<(activity.endsAt??activity.startedAt+10000)){const f=(room?.fixtures??world?.map.streetObjects??[]).find(f=>f.id===activity.fixtureId);if(f){kind=activity.kind;fixture=f;timeline=activityTimeline(kind,activity.startedAt,visualNow,activity.endsAt);const anchor=activityAnchor(f,kind,{x:basePosition.x,z:basePosition.z},activity.slot),contact=timeline.contactWeight;activityWeight=timeline.weight;seatHeight=anchor.seatHeight;contactDistance=Math.hypot(anchor.x-basePosition.x,anchor.z-basePosition.z)*contact;adult.root.position.x+=(anchor.x-basePosition.x)*contact;adult.root.position.z+=(anchor.z-basePosition.z)*contact;adult.root.rotation.y+=Math.atan2(Math.sin(anchor.yaw-actorYaw),Math.cos(anchor.yaw-actorYaw))*Math.min(1,contact*2);}}
  adult.pose(renderTime/1000,timeline?.walkWeight??(walking?1:0),kind,reduced,{distance:walkDistance+contactDistance,seatHeight,activityWeight,activityPhase:timeline?.phase,activityProgress:timeline?.phaseProgress,contactHeight:kind==='Wash'?.94:kind==='Clean'?.55:1.35,elapsedSeconds:activity?Math.max(0,visualNow-activity.startedAt)/1000:0,durationSeconds:activity?((activity.endsAt??activity.startedAt+10000)-activity.startedAt)/1000:0});return{timeline,fixture};
 }
 function tick(time){
  if(!alive||paused)return;frame=requestAnimationFrame(tick);if(document.hidden||time-lastPaint<(quality==='high'?16:33))return;const dt=Math.min((time-previousTime)/1000||0,.05);previousTime=time;lastPaint=time;const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false,visualNow=clockServerTime+time-receivedAt;
  let travelled=0,moving=false;const navigation=world?.navigation??world?.position.navigation;
  if(navigation){const point=sampleNavigation(navigation,visualNow);travelled=Math.hypot(point.x+.5-walkPosition.x,point.y+.5-walkPosition.z);walkPosition.set(point.x+.5,0,point.y+.5);moving=point.moving;targetYaw=heading[point.facing]??targetYaw;motion=null;}
  else if(motion){const point=sampleMotion(motion,time,reduced);travelled=Math.hypot(point.x-walkPosition.x,point.z-walkPosition.z);walkPosition.set(point.x,0,point.z);if(point.done)motion=null;moving=!!motion||travelled>0;}
  distance+=reduced?0:travelled;walkWeight=THREE.MathUtils.damp(walkWeight,moving?1:0,12,dt);const difference=Math.atan2(Math.sin(targetYaw-yaw),Math.cos(targetYaw-yaw));yaw+=difference*(reduced?1:Math.min(dt*16,1));const driving=world?.driving?.active&&!currentRoom();actor.root.visible=!driving;
  const contact=poseActivity(actor,world?.position.activity,walkPosition,visualNow,time,activityStart,moving,reduced,distance,yaw);effects.update({activity:world?.position.activity,fixture:contact.fixture,timeline:contact.timeline,actor,time,reduced,quality});if(playerCar){playerCar.visible=!!driving;playerCar.position.copy(walkPosition);playerCar.rotation.y=yaw;}
  const room=currentRoom(),camera=rig.update({position:driving?walkPosition:actor.root.position,dt,solids:geometry?.solids??[],teleport:cameraTeleport,reducedMotion:reduced,bounds:room??world?.map,home:!!room});cameraTeleport=false;sun.position.set(walkPosition.x+8,15,walkPosition.z+9);sun.target.position.copy(walkPosition);sun.target.updateMatrixWorld();
  for(const item of neighbours.values()){let travelled=0,walking=false,crowdFacing=item.person.facing;if(item.person.navigation){const p=sampleNavigation(item.person.navigation,visualNow);travelled=Math.hypot(p.x+.5-item.position.x,p.y+.5-item.position.z);item.position.set(p.x+.5,0,p.y+.5);walking=p.moving;crowdFacing=p.facing;}else if(item.motion){const point=sampleMotion(item.motion,time,reduced);travelled=Math.hypot(point.x-item.position.x,point.z-item.position.z);item.position.set(point.x,0,point.z);if(point.done)item.motion=null;walking=!!item.motion||travelled>0;}item.distance+=reduced?0:travelled;const target=heading[crowdFacing]??0,difference=Math.atan2(Math.sin(target-item.yaw),Math.cos(target-item.yaw));item.yaw+=difference*(reduced?1:Math.min(dt*16,1));poseActivity(item.rig,item.person.activity,item.position,visualNow,time,item.activityStart,walking,reduced,item.distance,item.yaw);}
  const cutaway=[Math.cos(rig.yaw)>0,Math.sin(rig.yaw)>0,Math.sin(rig.yaw)<0,Math.cos(rig.yaw)<0];for(let i=0;i<(geometry?.walls.length??0);i++)geometry.walls[i].visible=rig.mode!=='overview'||raised||cutaway[i];for(const p of geometry?.partitions??[])p.scale.y=rig.mode!=='overview'||raised?1:.45;
  geometry?.environment?.update(visualNow,reduced,quality);updateHomeLights(geometry,room?.fixtures??[],time,reduced,quality);renderer.render(scene,camera);if(firstPaint){firstPaint=false;rig.announce();onReady();}
 }
 function update(next,mode){
  if(!alive)return;quality=mode;paused=mode==='low';if(paused){if(frame)cancelAnimationFrame(frame);frame=null;return;}
  const old=world,room=next.home??next.venue??next.position,oldRoom=old?.home??old?.venue??old?.position,roomId=next.home?.id??next.venue?.id,oldRoomId=old?.home?.id??old?.venue?.id,nextSignature=JSON.stringify([next.map.id,next.position.region,next.position.interior,roomId,next.home?.version??next.venue?.version,next.residence,next.guestEntrances,next.parking,worldAssets.revision]);
  const nextAvatar=JSON.stringify([next.avatar??{},library.revision]);if(nextAvatar!==avatarSignature){const previous=actor;actor=makeAdult(next.avatar??{});actor.root.position.copy(previous.root.position);actor.root.rotation.copy(previous.root.rotation);scene.remove(previous.root);disposeModels(previous.root);scene.add(actor.root);avatarSignature=nextAvatar;}
  world=next;const loadingRevision=worldAssets.revision;worldAssets.load(requiredAssets(next)).then(()=>{if(alive&&world===next&&worldAssets.revision!==loadingRevision)update(world,quality);});const updateAt=performance.now(),serverTime=next.serverTime??Date.now();if(!old||serverTime>clockServerTime){clockServerTime=serverTime;receivedAt=updateAt;}
  const activityKey=JSON.stringify(next.position.activity??null);if(activityKey!==activitySignature){activitySignature=activityKey;activityStart=Math.max(updateAt,motion?.end??0);}const changedRoom=oldRoomId!==roomId||old?.position.interior!==next.position.interior||old?.position.region!==next.position.region;
  if(changedRoom){for(const item of neighbours.values()){scene.remove(item.rig.root);disposeModels(item.rig.root);}neighbours.clear();}syncCrowd(next);if(signature!==nextSignature){clearGeometry();geometry=sceneGeometry(next,worldAssets,surfaces);scene.add(geometry.root);signature=nextSignature;selection=null;setGhost(null);}effects.setFixtures(next.home?.fixtures??[],next.homeCare);
  const to={x:room.x+.5,z:room.y+.5},navigation=next.navigation??next.position.navigation;
  if(navigation){motion=null;if(!old||changedRoom){const p=sampleNavigation(navigation,clockServerTime+updateAt-receivedAt);walkPosition.set(p.x+.5,0,p.y+.5);cameraTeleport=true;}}
  else if(old&&!changedRoom&&(old.navigation??old.position.navigation)){const correction=Math.hypot(to.x-walkPosition.x,to.z-walkPosition.z);if(correction>.001&&correction<=4)motion=adjacentMotion({x:walkPosition.x,z:walkPosition.z},to,updateAt,150);else{motion=null;walkPosition.set(to.x,0,to.z);if(correction>4)cameraTeleport=true;}}
  else if(old&&!changedRoom&&Math.abs(oldRoom.x-room.x)+Math.abs(oldRoom.y-room.y)===1)motion=adjacentMotion({x:walkPosition.x,z:walkPosition.z},to,updateAt);
  else if(!old||oldRoom.x!==room.x||oldRoom.y!==room.y||changedRoom){motion=null;walkPosition.set(to.x,0,to.z);distance=0;walkWeight=0;rig.center();cameraTeleport=true;}else if(!next.position.activity&&!motion)walkPosition.set(to.x,0,to.z);
  targetYaw=heading[next.position.facing]??0;const car=next.driving?.active,carKey=car?JSON.stringify([car.vehicleId,car.model,worldAssets.revision]):'';if(carKey!==playerCarKey){if(playerCar){scene.remove(playerCar);disposeModels(playerCar);playerCar=null;}if(car){const template=worldAssets.get(carAsset(car.model));playerCar=template?fitAsset(template,1.35,2.85,null):vehicleModel(car.model);if(!template)playerCar.scale.set(.8,.8,.8);playerCar.name='Your driven vehicle';scene.add(playerCar);}playerCarKey=carKey;}
  scene.fog.near=roomId?25:28;scene.fog.far=roomId?55:88;scene.background=roomId?indoorSky:sky??outdoorSky;ambient.intensity=roomId?1.85:2.1;renderer.shadowMap.enabled=mode==='high';if(!frame)frame=requestAnimationFrame(tick);
 }
 for(const body of ['male','female'])library.load(body).then(loaded=>{if(loaded&&alive&&world&&!paused)update(world,quality);});
 function destroy(){if(!alive)return;alive=false;listeners.abort();observer.disconnect();if(frame)cancelAnimationFrame(frame);clearGeometry();setGhost(null);destinationRing.geometry.dispose();destinationRing.material.dispose();effects.dispose();disposeModels(actor.root);if(playerCar)disposeModels(playerCar);for(const item of neighbours.values())disposeModels(item.rig.root);neighbours.clear();library.dispose();worldAssets.dispose();surfaces.dispose();sky?.dispose();disposeMaterialCache();renderer.dispose();renderer.forceContextLoss();host.replaceChildren();}
 return{update,destroy};
}
