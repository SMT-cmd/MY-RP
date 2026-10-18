import * as THREE from 'three';
import {adultModel,furnitureModel,vehicleModel,partitionModel,treeModel,finishes,box,mesh,material,disposeModels,disposeMaterialCache} from './models.js';
import {adjacentMotion,sampleMotion,activityAnchor} from './motion.js';
import {createCharacterLibrary} from './authored-characters.js';
import {updateHomeLights} from './lighting.js';
import {createWorldAssetLibrary,fitAsset} from './world-assets.js';
import {FURNITURE_ASSETS,buildingAsset,furnitureAsset,carAsset,requiredAssets} from './asset-catalogue.js';
import {cameraStep,cameraPosition,clipCamera} from './camera.js';
import {startActivity,sampleActivity,stopActivity} from './activity.js';
import {createActivityEffects} from './activity-effects.js';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const heading={front:0,back:Math.PI,left:-Math.PI/2,right:Math.PI/2};
export function crowdModels(people=[]){return people.slice(0,32).map(person=>{const rig=adultModel(person.avatar);rig.root.position.set(person.x+.5,0,person.y+.5);rig.root.rotation.y=heading[person.facing]??0;rig.root.name=person.name;rig.root.userData.citizenId=person.id;return{person,rig};});}
export function sceneGeometry(world,assets=null){
 const root=new THREE.Group(),room=world.home,walls=[],fixtures=[],places=[],partitions=[],lights=[];
 const furnishing=f=>{const key=furnitureAsset(f),template=assets?.get(key);if(!template)return furnitureModel(f);const form=FURNITURE_ASSETS[f.kind??f.model??f.id],turned=f.rotation%180,object=fitAsset(template,(turned?f.h:f.w)-.1,(turned?f.w:f.h)-.1,form[3],f.rotation??0,finishes[f.finish]);object.name=f.name;object.traverse(o=>o.userData.fixtureId=f.id);if(f.action==='Light'){const original=furnitureModel(f),lamp=original.userData.lighting;if(lamp){original.traverse(o=>{if(o.isMesh)o.visible=o===lamp.bulb;});object.add(original);object.userData.lighting=lamp;}}return object;};
 if(room){
  box(root,room.width,.10,room.height,room.width/2,-.055,room.height/2,finishes[room.floor]??finishes.oak);
  const geometry=new THREE.BoxGeometry(.48,.012,.99),boards=new THREE.InstancedMesh(geometry,material(0xffffff),room.width*2*room.height),matrix=new THREE.Matrix4();let index=0;
  const floors=new Map((room.rooms??[]).flatMap(r=>r.tiles.map(t=>[t.x+':'+t.y,r.floor])));for(let x=0;x<room.width*2;x++)for(let z=0;z<room.height;z++){matrix.makeTranslation((x+.5)/2,.004,z+.5);boards.setMatrixAt(index,matrix);boards.setColorAt(index++,new THREE.Color(finishes[floors.get(Math.floor(x/2)+':'+z)]??finishes[room.floor]??finishes.oak));}boards.receiveShadow=true;root.add(boards);
  walls.push(box(root,room.width,2.75,.12,room.width/2,1.375,-.06,finishes[room.wall]??finishes.cream));walls.push(box(root,.12,2.75,room.height,-.06,1.375,room.height/2,finishes[room.wall]??finishes.cream));
  // Complete the room for eye-level views. Keep the existing southern exit.
  walls.push(box(root,.12,2.75,room.height,room.width+.06,1.375,room.height/2,finishes[room.wall]??finishes.cream));
  const south=new THREE.Group(),wallColour=finishes[room.wall]??finishes.cream;root.add(south);walls.push(south);
  box(south,4,2.75,.12,2,1.375,room.height+.06,wallColour);box(south,room.width-5,2.75,.12,5+(room.width-5)/2,1.375,room.height+.06,wallColour);box(south,1,.55,.12,4.5,2.475,room.height+.06,wallColour);
  box(root,room.width,.08,.05,room.width/2,.055,.03,finishes.walnut);box(root,.05,.08,room.height,.03,.055,room.height/2,finishes.walnut);
  for(const f of room.fixtures){const object=furnishing(f);object.position.set(f.x+f.w/2,0,f.y+f.h/2);root.add(object);fixtures.push(object);if(object.userData.lighting){const lamp=object.userData.lighting,light=new THREE.PointLight(0xffd4a0,0,5,2);light.castShadow=false;light.position.set(object.position.x,lamp.height,object.position.z);root.add(light);lights.push({...lamp,light});}}
  // Architectural details are part of the shell, not purchasable inventory.
  for(const x of [room.width*.25,room.width*.70]){box(root,1.55,1.25,.035,x,1.65,.02,0x9fb9c2,.025);for(const side of [-1,1])box(root,.065,1.38,.08,x+side*.8,1.65,.05,0xe5dfd2,.012);box(root,1.7,.07,.18,x,1.0,.10,0xe5dfd2,.012);box(root,.035,1.25,.08,x,1.65,.065,0xf1e7cf);for(const side of [-1,1])box(root,.22,1.65,.10,x+side*.96,1.48,.10,0xcbb9a3,.04);}
  for(let z=.7;z<room.height;z+=1.6){box(root,.035,1.4,.70,.025,1.35,z,0xb89463,.025);box(root,.055,1.18,.50,.045,1.35,z,0x243a4b,.012);}
  for(const p of room.partitions??[]){const wall=partitionModel(p,finishes[room.wall]??finishes.cream);root.add(wall);partitions.push(wall);}
  box(root,.70,.025,.44,4.5,.018,7.5,0x466951,.012);
 }else{
  box(root,world.map.width,.10,world.map.height,world.map.width/2,-.07,world.map.height/2,0x9ba98a);
  const roads=world.map.roads??[{x:0,y:6,w:world.map.width,h:3}];
  for(const road of roads){box(root,road.w,.025,road.h,road.x+road.w/2,.005,road.y+road.h/2,0x687471);
   if(road.w>road.h){for(const z of [road.y+.3,road.y+road.h-.3])box(root,road.w,.07,.60,road.x+road.w/2,.025,z,0xd1cabc);for(let x=road.x+1;x<road.x+road.w;x+=2)box(root,.85,.008,.035,x,.028,road.y+road.h/2,0xe3dbb1);}
   else{for(const x of [road.x+.2,road.x+road.w-.2])box(root,.40,.07,road.h,x,.025,road.y+road.h/2,0xd1cabc);}
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
  const guide=adultModel({shirt:0x7e8864,skin:0x73452f,trousers:0x5e534a});guide.root.position.set(world.map.guide.x+.5,0,world.map.guide.y+.5);guide.root.name=world.map.guide.name;root.add(guide.root);
  for(const bay of world.parking?.bays??[]){const px=bay.x+bay.w/2,pz=bay.y+bay.h/2;box(root,bay.w-.02,.018,bay.h-.02,px,.022,pz,0x89998c);for(const x of [bay.x+.03,bay.x+bay.w-.03])box(root,.025,.010,bay.h-.10,x,.040,pz,0xe6dfc9);const parked=world.parking.vehicles.find(v=>v.slot===bay.slot);if(parked){const template=assets?.get(carAsset(parked.model)),car=template?fitAsset(template,1.7,4.15,null):vehicleModel(parked.model);car.position.set(px,.03,pz);root.add(car);}}

 }
 return{root,walls,fixtures,places,partitions,lights};
}
export function createEngine(host,onFailure,onReady=()=>{}){
 let firstPaint=true;
 const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;
 const canvas=renderer.domElement;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Your city and furnished home in 3D');canvas.className='world-3d-canvas';host.replaceChildren(canvas);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xcbd2dc);scene.add(new THREE.HemisphereLight(0xfff5e2,0x73836b,2));
 const sun=new THREE.DirectionalLight(0xfff1d7,2.5);sun.position.set(8,15,9);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-18;sun.shadow.camera.right=18;sun.shadow.camera.top=18;sun.shadow.camera.bottom=-18;sun.shadow.normalBias=.035;scene.add(sun);scene.add(sun.target);
 const library=createCharacterLibrary(),worldAssets=createWorldAssetLibrary(),makeAdult=appearance=>adultModel(appearance,library.get(appearance?.body??'male'),library.eyeTexture);
 const aerialCamera=new THREE.OrthographicCamera(-8,8,5,-5,.05,260),perspectiveCamera=new THREE.PerspectiveCamera(58,1,.05,260);let camera=perspectiveCamera,viewMode='third-person',pitch=.26,orbitDistance=4.4,cameraBounds=[];
 let actor=makeAdult(),avatarSignature='';scene.add(actor.root);const effects=createActivityEffects();scene.add(effects.root);let activityTrack=null,prediction=null;
 const neighbours=new Map();
 const target=new THREE.Vector3(),raycaster=new THREE.Raycaster(),floorPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();
 let world=null,geometry=null,signature='',frame=null,quality='medium',lastPaint=0,previousTime=0,motion=null,walkWeight=0,distance=0,yaw=0,targetYaw=0,cameraYaw=Math.PI,zoom=1.7,follow=true,drag=null,selection=null,ghost=null,alive=true,paused=false,raised=false,receivedAt=0,clockServerTime=0,activityStart=0,activitySignature='';
 const walkPosition=new THREE.Vector3();
 const controls=document.createElement('details');controls.className='world-camera-controls';const cameraSummary=document.createElement('summary');cameraSummary.textContent='Camera';cameraSummary.dataset.gameUi='';const cameraOptions=document.createElement('div');cameraOptions.className='camera-options';controls.append(cameraSummary,cameraOptions);const status=document.createElement('p');status.className='hint';status.textContent='Third person · drag to look around · scroll to zoom · WASD follows the camera';host.append(controls,status);
 const listeners=new AbortController(),options={signal:listeners.signal};
 window.addEventListener('citizen-step-preview',event=>{const d=event.detail,room=world?.home??world?.position;if(!world||prediction||!room||d.leaseVersion!==world.position.leaseVersion||d.homeId!==(world.home?.id??null)||d.region!==world.position.region||d.from.x!==room.x||d.from.y!==room.y)return;const now=performance.now();prediction=d;activityTrack=stopActivity(activityTrack,now,walkPosition);motion=adjacentMotion({x:walkPosition.x,z:walkPosition.z},{x:d.to.x+.5,z:d.to.y+.5},now);targetYaw=Math.atan2(d.to.x-d.from.x,d.to.y-d.from.y);},options);
 window.addEventListener('citizen-step-settled',event=>{const d=event.detail;if(!prediction||prediction.id!==d.id)return;prediction=null;if(!world)return;const room=world.home??world.position;motion=adjacentMotion({x:walkPosition.x,z:walkPosition.z},{x:room.x+.5,z:room.y+.5},performance.now(),200);},options);
 const destinationRing=new THREE.Mesh(new THREE.RingGeometry(.22,.29,32),new THREE.MeshBasicMaterial({color:0xe3b46b,side:THREE.DoubleSide,depthWrite:false}));destinationRing.rotation.x=-Math.PI/2;destinationRing.visible=false;scene.add(destinationRing);
 window.addEventListener('walk-target',e=>{const d=e.detail;destinationRing.visible=!!d&&!!world&&d.homeId===(world.home?.id??null)&&d.leaseVersion===world.position.leaseVersion;if(destinationRing.visible)destinationRing.position.set(d.x+.5,.04,d.y+.5);},options);
 const button=(text,action)=>{const b=document.createElement('button');b.type='button';b.dataset.gameUi='';b.textContent=text;b.addEventListener('click',action,options);cameraOptions.append(b);return b;};
 const viewButtons=new Map();function setView(mode){window.dispatchEvent(new CustomEvent('game-input-release'));viewMode=mode;camera=mode==='aerial'?aerialCamera:perspectiveCamera;follow=true;pitch=mode==='close'?.12:.26;orbitDistance=mode==='close'?2.3:4.4;for(const [name,b] of viewButtons)b.setAttribute('aria-pressed',String(name===mode));canvas.dataset.view=mode;status.textContent=mode==='aerial'?'Aerial view · drag to pan · scroll to zoom':'Third person · drag to look around · scroll to zoom · WASD follows the camera';resize();}
 for(const [mode,label] of [['third-person','Third person'],['close','Close character'],['aerial','Aerial / map']])viewButtons.set(mode,button(label,()=>{setView(mode);controls.open=false;cameraSummary.focus();}));
 window.GameCamera={step:(dx,dy)=>cameraStep(dx,dy,viewMode==='aerial'?0:cameraYaw)};
 button('Raise / cut away walls',()=>raised=!raised);
 const zoomBy=amount=>{if(viewMode==='aerial')zoom=clamp(zoom-amount,.5,2.2);else orbitDistance=clamp(orbitDistance+amount*3,1.6,9);};
 button('Zoom out',()=>zoomBy(.15));button('Zoom in',()=>zoomBy(-.15));button('Rotate left',()=>cameraYaw-=Math.PI/4);button('Rotate right',()=>cameraYaw+=Math.PI/4);button('Find my character',()=>{follow=true;selection=null;setGhost(null);});
 function resize(){const width=Math.max(host.clientWidth||960,320),height=Math.max(host.clientHeight||Math.min(width*.625,600),200);renderer.setSize(width,height);const aspect=width/height;aerialCamera.left=-5.2*aspect;aerialCamera.right=5.2*aspect;aerialCamera.top=5.2;aerialCamera.bottom=-5.2;aerialCamera.updateProjectionMatrix();perspectiveCamera.aspect=aspect;perspectiveCamera.updateProjectionMatrix();}
 const observer=new ResizeObserver(resize);observer.observe(host);setView('third-person');
 function clearGeometry(){if(geometry){scene.remove(geometry.root);disposeModels(geometry.root);geometry=null;}}
 function syncCrowd(next){
  const present=new Set(),now=performance.now();
  for(const person of [...(next.people??[]).slice(0,32),...(next.npcs??[]).slice(0,6)]){
   present.add(person.id);const signature=JSON.stringify([person.avatar,library.revision]),previous=neighbours.get(person.id);let item=previous;
   if(!item||item.signature!==signature){
    const rig=makeAdult(person.avatar),position=previous?.position??new THREE.Vector3(person.x+.5,0,person.y+.5);rig.root.position.copy(position);
    if(previous){scene.remove(previous.rig.root);disposeModels(previous.rig.root);}
    if(person.kind==='npc')rig.root.traverse(o=>o.userData.npcId=person.id);
    item={rig,position,signature,person,motion:previous?.motion??null,distance:previous?.distance??0,yaw:heading[person.facing]??0,activityKey:previous?.activityKey??'',activityStart:previous?.activityStart??now,activityTrack:previous?.activityTrack??null};neighbours.set(person.id,item);scene.add(rig.root);
   }
   const before=previous?.person;
   if(before&&(before.x!==person.x||before.y!==person.y)){
    const to={x:person.x+.5,z:person.y+.5},steps=Math.abs(before.x-person.x)+Math.abs(before.y-person.y);
    if(steps===1)item.motion=adjacentMotion({x:item.position.x,z:item.position.z},to,now,person.kind==='npc'?1500:undefined);
    else{item.motion=null;item.position.set(to.x,0,to.z);item.distance=0;}
   }
   const activityKey=JSON.stringify(person.activity??null);if(activityKey!==item.activityKey){item.activityKey=activityKey;item.activityStart=Math.max(now,item.motion?.end??0);const f=next.home?.fixtures.find(f=>f.id===person.activity?.fixtureId);item.activityTrack=f?startActivity(f,person.activity,{x:item.position.x,z:item.position.z,yaw:item.yaw},item.activityStart,Math.max(0,(next.serverTime??Date.now())-person.activity.startedAt)):stopActivity(item.activityTrack,now,item.position);}item.person=person;
  }
  for(const [id,item] of neighbours)if(!present.has(id)){scene.remove(item.rig.root);disposeModels(item.rig.root);neighbours.delete(id);}
 }
 function setGhost(value){if(ghost){scene.remove(ghost);disposeModels(ghost);ghost.material.dispose();ghost=null;}if(!value)return;ghost=new THREE.Mesh(new THREE.BoxGeometry(value.w,.04,value.h),new THREE.MeshBasicMaterial({color:value.valid?0x4d956b:0xb94e47,transparent:true,opacity:.55,depthWrite:false}));ghost.position.set(value.x+value.w/2,.045,value.y+value.h/2);scene.add(ghost);}
 function refreshGhost(point){if(!selection||!world?.home||selection.homeId!==world.home.id)return;const room=world.home,x=Math.floor(point.x),y=Math.floor(point.z),w=selection.rotation%180?selection.h:selection.w,h=selection.rotation%180?selection.w:selection.h;
  const overlap=room.fixtures.some(f=>f.instanceId!==selection.itemId&&x<f.x+f.w&&x+w>f.x&&y<f.y+f.h&&y+h>f.y),actorX=room.x,actorY=room.y;
  const wallConflict=(room.partitions??[]).some(p=>(p.axis==='v'?x<p.x&&p.x<x+w&&y<=p.y&&p.y<y+h:y<p.y&&p.y<y+h&&x<=p.x&&p.x<x+w)||(p.door&&[[p.x,p.y],[p.x-(p.axis==='v'?1:0),p.y-(p.axis==='h'?1:0)]].some(([dx,dy])=>x<=dx&&dx<x+w&&y<=dy&&dy<y+h)));
  const valid=!wallConflict&&x>=0&&y>=0&&x+w<=room.width&&y+h<=room.height&&!overlap&&!(x<=4&&4<x+w&&y<=7&&6<y+h)&&!(x<=actorX&&actorX<x+w&&y<=actorY&&actorY<y+h);
  setGhost({x,y,w,h,valid});window.dispatchEvent(new CustomEvent('furniture-floor-select',{detail:{itemId:selection.itemId,homeId:room.id,homeVersion:room.version,x,y,valid}}));
 }
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();onFailure();},options);
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoomBy(e.deltaY*.0015);},{...options,passive:false});
 canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,tx:target.x,tz:target.z,yaw:cameraYaw,pitch,moved:false};canvas.setPointerCapture(e.pointerId);},options);
 canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>5){drag.moved=true;if(viewMode==='aerial')follow=false;}if(!drag.moved)return;if(viewMode!=='aerial'){cameraYaw=drag.yaw-dx*.007;pitch=clamp(drag.pitch+dy*.004,.08,1.15);return;}const scale=10.4/(canvas.clientHeight*zoom),c=Math.cos(cameraYaw),s=Math.sin(cameraYaw);target.x=drag.tx-(dx*c+dy*s)*scale;target.z=drag.tz+(dx*s-dy*c)*scale;},options);
 canvas.addEventListener('pointerup',e=>{if(!drag)return;const moved=drag.moved;drag=null;if(moved||!world)return;const bounds=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-bounds.left)/bounds.width*2-1,-(e.clientY-bounds.top)/bounds.height*2+1),camera);
  if(selection){if(raycaster.ray.intersectPlane(floorPlane,hit))refreshGhost(hit);return;}
  if(world.home){const fixture=raycaster.intersectObjects(geometry.fixtures,true)[0]?.object.userData.fixtureId;if(fixture){window.dispatchEvent(new CustomEvent('home-fixture-select',{detail:{fixtureId:fixture,homeId:world.home.id,leaseVersion:world.position.leaseVersion}}));return;}}
  if(!world.home){const npc=raycaster.intersectObjects([...neighbours.values()].filter(n=>n.person.kind==='npc').map(n=>n.rig.root),true)[0]?.object.userData.npcId;if(npc){window.dispatchEvent(new CustomEvent('npc-select',{detail:{npcId:npc}}));return;}const object=raycaster.intersectObjects(geometry.places,true)[0]?.object.userData;if(object?.buildingId){window.dispatchEvent(new CustomEvent('building-select',{detail:{buildingId:object.buildingId,leaseVersion:world.position.leaseVersion}}));return;}if(object?.streetObjectId){window.dispatchEvent(new CustomEvent('street-object-select',{detail:{objectId:object.streetObjectId,leaseVersion:world.position.leaseVersion}}));return;}}
  if(raycaster.ray.intersectPlane(floorPlane,hit))window.dispatchEvent(new CustomEvent('world-tile-select',{detail:{x:Math.floor(hit.x),y:Math.floor(hit.z),homeId:world.home?.id??null,leaseVersion:world.position.leaseVersion}}));
 },options);canvas.addEventListener('pointercancel',()=>drag=null,options);
 window.addEventListener('furniture-edit',e=>{selection=e.detail;setGhost(null);if(selection&&Number.isInteger(selection.x)&&Number.isInteger(selection.y))refreshGhost({x:selection.x+.5,z:selection.y+.5});status.textContent=selection?'Click a clear floor tile, then save the position below. Red footprints need a different position.':'Drag to pan · scroll to zoom · click a reachable object to use it';},options);
 function tick(time){if(!alive||paused)return;frame=requestAnimationFrame(tick);if(document.hidden||time-lastPaint<(quality==='high'?16:33))return;const dt=Math.min((time-previousTime)/1000||0,.05);previousTime=time;lastPaint=time;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
  let travelled=0;if(motion){const point=sampleMotion(motion,time,reduced);travelled=Math.hypot(point.x-walkPosition.x,point.z-walkPosition.z);walkPosition.set(point.x,0,point.z);if(point.done)motion=null;}
  const moving=!!motion||travelled>0;distance+=reduced?0:travelled;actor.root.position.copy(walkPosition);
  walkWeight=THREE.MathUtils.damp(walkWeight,moving?1:0,12,dt);const difference=Math.atan2(Math.sin(targetYaw-yaw),Math.cos(targetYaw-yaw));yaw+=difference*(reduced?1:Math.min(dt*16,1));actor.root.rotation.y=yaw;
  const presentation=sampleActivity(activityTrack,time,walkPosition,reduced);
  if(presentation){actor.root.position.set(presentation.x,0,presentation.z);actor.root.rotation.y=presentation.yaw;canvas.dataset.activityPhase=presentation.phase;}
  else{if(!activityTrack||time>=activityTrack.start)activityTrack=null;delete canvas.dataset.activityPhase;}
  const p=presentation;actor.pose(time/1000,p?.walkWeight??walkWeight,p?.kind??null,reduced,{distance,seatHeight:p?.seatHeight??.575,activityWeight:p?.weight??1,activityTime:activityTrack?(time-activityTrack.start)/1000:0});
  effects.update(activityTrack?.fixture,p?.water,time,reduced);
  if(follow)target.set(actor.root.position.x,viewMode==='aerial'?.65:1.35,actor.root.position.z);
  if(viewMode==='aerial'){camera.zoom=zoom;camera.updateProjectionMatrix();camera.position.set(target.x+Math.sin(cameraYaw)*14,target.y+12,target.z+Math.cos(cameraYaw)*14);}
  else{let point=clipCamera(target,cameraPosition(target,cameraYaw,pitch,orbitDistance),cameraBounds);for(const lift of [.45,.65,.85,1.05]){if(Math.hypot(point.x-target.x,point.y-target.y,point.z-target.z)>=Math.min(2.4,orbitDistance*.85))break;if(lift>pitch)point=clipCamera(target,cameraPosition(target,cameraYaw,lift,orbitDistance),cameraBounds);}camera.position.set(point.x,point.y,point.z);}
  camera.lookAt(target);camera.updateMatrixWorld();
  for(const item of neighbours.values()){
   let travelled=0;if(item.motion){const point=sampleMotion(item.motion,time,reduced);travelled=Math.hypot(point.x-item.position.x,point.z-item.position.z);item.position.set(point.x,0,point.z);if(point.done)item.motion=null;}
   item.distance+=reduced?0:travelled;const walking=!!item.motion||travelled>0,target=heading[item.person.facing]??0,difference=Math.atan2(Math.sin(target-item.yaw),Math.cos(target-item.yaw));item.yaw+=difference*(reduced?1:Math.min(dt*16,1));item.rig.root.rotation.y=item.yaw;item.rig.root.position.copy(item.position);
   const p=sampleActivity(item.activityTrack,time,item.position,reduced);
   if(p){item.rig.root.position.set(p.x,0,p.z);item.rig.root.rotation.y=p.yaw;}else if(!item.activityTrack||time>=item.activityTrack.start)item.activityTrack=null;
   item.rig.pose(time/1000,p?.walkWeight??(walking?1:0),p?.kind??null,reduced,{distance:item.distance,seatHeight:p?.seatHeight??.575,activityWeight:p?.weight??1,activityTime:item.activityTrack?(time-item.activityTrack.start)/1000:0});
  }
  if(geometry?.walls.length){geometry.walls[0].visible=viewMode!=='aerial'||Math.cos(cameraYaw)>0;geometry.walls[1].visible=viewMode!=='aerial'||Math.sin(cameraYaw)>0;geometry.walls[2].visible=viewMode!=='aerial'||Math.sin(cameraYaw)<0;geometry.walls[3].visible=viewMode!=='aerial'||Math.cos(cameraYaw)<0;}
  for(const p of geometry?.partitions??[])p.scale.y=viewMode!=='aerial'||raised?1:.45;
  updateHomeLights(geometry,world?.home?.fixtures??[],time,reduced,quality);renderer.render(scene,camera);if(firstPaint){firstPaint=false;onReady();}
 }
 function update(next,mode){if(!alive)return;quality=mode;paused=mode==='low';if(paused){if(frame)cancelAnimationFrame(frame);frame=null;return;}const old=world,room=next.home??next.position,oldRoom=old?.home??old?.position,nextSignature=JSON.stringify([next.map.id,next.position.region,next.position.interior,next.home?.id,next.home?.version,next.residence,next.guestEntrances,next.parking,worldAssets.revision]);
  const nextAvatar=JSON.stringify([next.avatar??{},library.revision]);if(nextAvatar!==avatarSignature){const previous=actor;actor=makeAdult(next.avatar??{});actor.root.position.copy(previous.root.position);actor.root.rotation.copy(previous.root.rotation);scene.remove(previous.root);disposeModels(previous.root);scene.add(actor.root);avatarSignature=nextAvatar;}
  world=next;const loadingRevision=worldAssets.revision;worldAssets.load(requiredAssets(next)).then(()=>{if(alive&&world===next&&worldAssets.revision!==loadingRevision)update(world,quality);});const updateAt=performance.now(),serverTime=next.serverTime??Date.now();if(!old||serverTime>clockServerTime){clockServerTime=serverTime;receivedAt=updateAt;}const activityKey=JSON.stringify(next.position.activity??null),changedActivity=activityKey!==activitySignature;
  const changedLocation=!!old&&(old.home?.id!==next.home?.id||old.position.interior!==next.position.interior||old.position.region!==next.position.region);
  if(changedLocation){activityTrack=null;prediction=null;}
  if(old?.home?.id!==next.home?.id||old?.position.interior!==next.position.interior||old?.position.region!==next.position.region){for(const item of neighbours.values()){scene.remove(item.rig.root);disposeModels(item.rig.root);}neighbours.clear();}syncCrowd(next);if(signature!==nextSignature){clearGeometry();geometry=sceneGeometry(next,worldAssets);scene.add(geometry.root);signature=nextSignature;geometry.root.updateMatrixWorld(true);cameraBounds=geometry.root.children.flatMap(o=>o===geometry.walls[3]?o.children:[o]).map(o=>new THREE.Box3().setFromObject(o)).filter(b=>b.max.y>1);selection=null;setGhost(null);}
  const to={x:room.x+.5,z:room.y+.5};const predicted=prediction&&prediction.to.x===room.x&&prediction.to.y===room.y&&!changedLocation;if(predicted){prediction=null;}else if(old&&old.position.region===next.position.region&&old.position.interior===next.position.interior&&old.home?.id===next.home?.id&&Math.abs(oldRoom.x-room.x)+Math.abs(oldRoom.y-room.y)===1){motion=adjacentMotion({x:walkPosition.x,z:walkPosition.z},to,updateAt);}
  else if(!old||oldRoom.x!==room.x||oldRoom.y!==room.y||old.home?.id!==next.home?.id||old.position.region!==next.position.region||old.position.interior!==next.position.interior){motion=null;walkPosition.set(to.x,0,to.z);actor.root.position.copy(walkPosition);distance=0;walkWeight=0;follow=true;}
  else if(!next.position.activity&&!motion&&!prediction){walkPosition.set(to.x,0,to.z);actor.root.position.copy(walkPosition);}
  if(changedActivity){activitySignature=activityKey;activityStart=Math.max(updateAt,motion?.end??0);const f=(next.home?.fixtures??next.map.streetObjects??[]).find(f=>f.id===next.position.activity?.fixtureId);
   activityTrack=f?startActivity(f,next.position.activity,{x:room.x+.5,z:room.y+.5,yaw},activityStart,Math.max(0,serverTime-next.position.activity.startedAt)):stopActivity(activityTrack,updateAt,walkPosition);
  }
  targetYaw=heading[next.position.facing]??0;if(!old||changedLocation)cameraYaw=targetYaw+Math.PI;renderer.shadowMap.enabled=mode==='high';if(!frame)frame=requestAnimationFrame(tick);
 }
 for(const body of ['male','female'])library.load(body).then(loaded=>{if(loaded&&alive&&world&&!paused)update(world,quality);});
 function destroy(){if(!alive)return;alive=false;delete window.GameCamera;effects.dispose();listeners.abort();observer.disconnect();if(frame)cancelAnimationFrame(frame);clearGeometry();setGhost(null);destinationRing.geometry.dispose();destinationRing.material.dispose();disposeModels(actor.root);for(const item of neighbours.values())disposeModels(item.rig.root);neighbours.clear();library.dispose();worldAssets.dispose();disposeMaterialCache();renderer.dispose();renderer.forceContextLoss();host.replaceChildren();}
 return{update,destroy};
}
