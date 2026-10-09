import * as THREE from 'three';
import {adultModel,furnitureModel,vehicleModel,partitionModel,treeModel,finishes,box,mesh,material,disposeModels,disposeMaterialCache} from './models.js';
import {adjacentMotion,sampleMotion,activityAnchor} from './motion.js';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const heading={front:0,back:Math.PI,left:-Math.PI/2,right:Math.PI/2};
export function crowdModels(people=[]){return people.slice(0,32).map(person=>{const rig=adultModel(person.avatar);rig.root.position.set(person.x+.5,0,person.y+.5);rig.root.rotation.y=heading[person.facing]??0;rig.root.name=person.name;rig.root.userData.citizenId=person.id;return{person,rig};});}
export function sceneGeometry(world){
 const root=new THREE.Group(),room=world.home,walls=[],fixtures=[],places=[],partitions=[];
 if(room){
  box(root,room.width,.10,room.height,room.width/2,-.055,room.height/2,finishes[room.floor]??finishes.oak);
  const geometry=new THREE.BoxGeometry(.48,.012,.99),boards=new THREE.InstancedMesh(geometry,material(0xffffff),room.width*2*room.height),matrix=new THREE.Matrix4();let index=0;
  const floors=new Map((room.rooms??[]).flatMap(r=>r.tiles.map(t=>[t.x+':'+t.y,r.floor])));for(let x=0;x<room.width*2;x++)for(let z=0;z<room.height;z++){matrix.makeTranslation((x+.5)/2,.004,z+.5);boards.setMatrixAt(index,matrix);boards.setColorAt(index++,new THREE.Color(finishes[floors.get(Math.floor(x/2)+':'+z)]??finishes[room.floor]??finishes.oak));}boards.receiveShadow=true;root.add(boards);
  walls.push(box(root,room.width,2.75,.12,room.width/2,1.375,-.06,finishes[room.wall]??finishes.cream));walls.push(box(root,.12,2.75,room.height,-.06,1.375,room.height/2,finishes[room.wall]??finishes.cream));
  box(root,room.width,.08,.05,room.width/2,.055,.03,finishes.walnut);box(root,.05,.08,room.height,.03,.055,room.height/2,finishes.walnut);
  for(const f of room.fixtures){const object=furnitureModel(f);object.position.set(f.x+f.w/2,0,f.y+f.h/2);root.add(object);fixtures.push(object);}
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
   if(object.kind==='tree'){const tree=treeModel();tree.position.set(object.x+.5,0,object.y+.5);root.add(tree);}
   else{const building=new THREE.Group();building.name=object.name;building.position.set(object.x+object.w/2,0,object.y+object.h/2);root.add(building);box(building,object.w,2.8,object.h,0,1.4,0,object.colour,.025);box(building,object.w+.18,.18,object.h+.18,0,2.87,0,0x7b796d,.025);for(const side of [-1,1])for(const x of [-1.5,1.5]){box(building,.70,.85,.06,x,1.70,side*(object.h/2+.025),0x879ea2,.025);box(building,.04,.85,.08,x,1.70,side*(object.h/2+.055),0xe8dfd0);}
    const entrance=[world.residence,...(world.guestEntrances??[])].find(e=>e?.facadeId===object.id);if(entrance){const b=entrance;building.name=b.name;box(building,.82,2.0,.09,b.door.x+.5-(object.x+object.w/2),1.0,object.h/2+.05,finishes.walnut,.025);box(building,1.3,.08,.55,0,2.22,object.h/2+.22,0xe3d3b9,.02);box(building,.82,.012,.50,0,.02,object.h/2+.30,0x466951);building.traverse(o=>o.userData.buildingId=b.id);places.push(building);}
   }
  }
  for(const object of world.map.streetObjects??[]){const bench=furnitureModel({...object,finish:'walnut'});bench.position.set(object.x+object.w/2,0,object.y+object.h/2);bench.traverse(o=>o.userData.streetObjectId=object.id);root.add(bench);places.push(bench);}
  for(const b of world.map.buildings){
   const g=new THREE.Group();g.name=b.name;g.position.set(b.x+b.w/2,0,b.y+b.h/2);root.add(g);const wallColor=new THREE.Color(b.colour??0xe3d3b9);
   box(g,b.w,2.55,b.h,0,1.275,0,wallColor,.025);box(g,b.w+.18,.15,b.h+.18,0,2.65,0,0x98654a,.025);
   const front=b.door.y>=b.y+b.h?1:-1;box(g,.78,1.80,.075,b.door.x+.5-(b.x+b.w/2),.90,front*(b.h/2+.045),0x536760,.035);
   for(const x of [-b.w*.28,b.w*.28]){box(g,.73,.80,.055,x,1.58,front*(b.h/2+.05),0x809ea2,.025);box(g,.04,.80,.08,x,1.58,front*(b.h/2+.08),0xeee3cc);}
   box(g,b.w-.25,.20,.35,0,2.18,front*(b.h/2+.14),0xf3ead7,.02);g.traverse(o=>o.userData.buildingId=b.id);places.push(g);
  }
  const guide=adultModel({shirt:0x7e8864,skin:0x73452f,trousers:0x5e534a});guide.root.position.set(world.map.guide.x+.5,0,world.map.guide.y+.5);guide.root.name=world.map.guide.name;root.add(guide.root);
  for(let slot=1;slot<=(world.parking?.spaces??1);slot++){
   const origin=world.parking?.origin??{x:0,y:6},px=origin.x+slot-.5,pz=origin.y+1;box(root,.98,.018,1.98,px,.022,pz,0x89998c);
   for(const x of [origin.x+slot-1+.03,origin.x+slot-.03])box(root,.025,.010,1.90,x,.040,pz,0xe6dfc9);
   const parked=world.parking?.vehicles.find(v=>v.slot===slot);if(parked){const car=vehicleModel(parked.model);car.position.set(px,.03,pz);root.add(car);}
  }
 }
 return{root,walls,fixtures,places,partitions};
}
export function createEngine(host,onFailure){
 const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;
 const canvas=renderer.domElement;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Your city and furnished home in 3D');canvas.className='world-3d-canvas';host.replaceChildren(canvas);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xe5e9df);scene.add(new THREE.HemisphereLight(0xfff5e2,0x73836b,2));
 const sun=new THREE.DirectionalLight(0xfff1d7,2.5);sun.position.set(8,15,9);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-18;sun.shadow.camera.right=18;sun.shadow.camera.top=18;sun.shadow.camera.bottom=-18;sun.shadow.normalBias=.035;scene.add(sun);scene.add(sun.target);
 const camera=new THREE.OrthographicCamera(-8,8,5,-5,.05,100);let actor=adultModel(),avatarSignature='';scene.add(actor.root);
 const neighbours=new Map();
 const target=new THREE.Vector3(),raycaster=new THREE.Raycaster(),floorPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();
 let world=null,geometry=null,signature='',frame=null,quality='medium',lastPaint=0,previousTime=0,motion=null,walkWeight=0,distance=0,yaw=0,targetYaw=0,cameraYaw=Math.PI/4,zoom=1.1,follow=true,drag=null,selection=null,ghost=null,alive=true,paused=false,raised=false,receivedAt=0,clockServerTime=0,activityStart=0,activitySignature='';
 const walkPosition=new THREE.Vector3();
 const controls=document.createElement('div');controls.className='world-camera-controls';const status=document.createElement('p');status.className='hint';status.textContent='Drag to pan · scroll to zoom · click a reachable object to use it';host.append(controls,status);
 const listeners=new AbortController(),options={signal:listeners.signal};
 const button=(text,action)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',action,options);controls.append(b);};
 button('Raise / cut away walls',()=>raised=!raised);
 button('Zoom out',()=>zoom=clamp(zoom-.15,.5,2.2));button('Zoom in',()=>zoom=clamp(zoom+.15,.5,2.2));button('Rotate left',()=>cameraYaw-=Math.PI/4);button('Rotate right',()=>cameraYaw+=Math.PI/4);button('Find my character',()=>{follow=true;selection=null;setGhost(null);});
 function resize(){const width=Math.max(host.clientWidth||960,320),height=clamp(width*.625,280,600);renderer.setSize(width,height);const aspect=width/height;camera.left=-5.2*aspect;camera.right=5.2*aspect;camera.top=5.2;camera.bottom=-5.2;camera.updateProjectionMatrix();}
 const observer=new ResizeObserver(resize);observer.observe(host);resize();
 function clearGeometry(){if(geometry){scene.remove(geometry.root);disposeModels(geometry.root);geometry=null;}}
 function syncCrowd(next){
  const present=new Set(),now=performance.now();
  for(const person of (next.people??[]).slice(0,32)){
   present.add(person.id);const signature=JSON.stringify(person.avatar),previous=neighbours.get(person.id);let item=previous;
   if(!item||item.signature!==signature){
    const rig=adultModel(person.avatar),position=previous?.position??new THREE.Vector3(person.x+.5,0,person.y+.5);rig.root.position.copy(position);
    if(previous){scene.remove(previous.rig.root);disposeModels(previous.rig.root);}
    item={rig,position,signature,person,motion:previous?.motion??null,distance:previous?.distance??0,yaw:heading[person.facing]??0,activityKey:previous?.activityKey??'',activityStart:previous?.activityStart??now};neighbours.set(person.id,item);scene.add(rig.root);
   }
   const before=previous?.person;
   if(before&&(before.x!==person.x||before.y!==person.y)){
    const to={x:person.x+.5,z:person.y+.5},steps=Math.abs(before.x-person.x)+Math.abs(before.y-person.y);
    if(steps===1)item.motion=adjacentMotion({x:item.position.x,z:item.position.z},to,now);
    else{item.motion=null;item.position.set(to.x,0,to.z);item.distance=0;}
   }
   const activityKey=JSON.stringify(person.activity??null);if(activityKey!==item.activityKey){item.activityKey=activityKey;item.activityStart=Math.max(now,item.motion?.end??0);}item.person=person;
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
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(zoom-e.deltaY*.0015,.5,2.2);},{...options,passive:false});
 canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,tx:target.x,tz:target.z,moved:false};canvas.setPointerCapture(e.pointerId);},options);
 canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>5){drag.moved=true;follow=false;}if(!drag.moved)return;const scale=10.4/(canvas.clientHeight*zoom),c=Math.cos(cameraYaw),s=Math.sin(cameraYaw);target.x=drag.tx-(dx*c+dy*s)*scale;target.z=drag.tz+(dx*s-dy*c)*scale;},options);
 canvas.addEventListener('pointerup',e=>{if(!drag)return;const moved=drag.moved;drag=null;if(moved||!world)return;const bounds=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-bounds.left)/bounds.width*2-1,-(e.clientY-bounds.top)/bounds.height*2+1),camera);
  if(selection){if(raycaster.ray.intersectPlane(floorPlane,hit))refreshGhost(hit);return;}
  if(world.home){const fixture=raycaster.intersectObjects(geometry.fixtures,true)[0]?.object.userData.fixtureId;if(fixture){window.dispatchEvent(new CustomEvent('home-fixture-select',{detail:{fixtureId:fixture,homeId:world.home.id,leaseVersion:world.position.leaseVersion}}));return;}}
  if(!world.home){const object=raycaster.intersectObjects(geometry.places,true)[0]?.object.userData;if(object?.buildingId){window.dispatchEvent(new CustomEvent('building-select',{detail:{buildingId:object.buildingId,leaseVersion:world.position.leaseVersion}}));return;}if(object?.streetObjectId){window.dispatchEvent(new CustomEvent('street-object-select',{detail:{objectId:object.streetObjectId,leaseVersion:world.position.leaseVersion}}));return;}}
  if(raycaster.ray.intersectPlane(floorPlane,hit))window.dispatchEvent(new CustomEvent('world-tile-select',{detail:{x:Math.floor(hit.x),y:Math.floor(hit.z),homeId:world.home?.id??null,leaseVersion:world.position.leaseVersion}}));
 },options);canvas.addEventListener('pointercancel',()=>drag=null,options);
 window.addEventListener('furniture-edit',e=>{selection=e.detail;setGhost(null);if(selection&&Number.isInteger(selection.x)&&Number.isInteger(selection.y))refreshGhost({x:selection.x+.5,z:selection.y+.5});status.textContent=selection?'Click a clear floor tile, then save the position below. Red footprints need a different position.':'Drag to pan · scroll to zoom · click a reachable object to use it';},options);
 function tick(time){if(!alive||paused)return;frame=requestAnimationFrame(tick);if(document.hidden||time-lastPaint<(quality==='high'?16:33))return;const dt=Math.min((time-previousTime)/1000||0,.05);previousTime=time;lastPaint=time;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
  let travelled=0;if(motion){const point=sampleMotion(motion,time,reduced);travelled=Math.hypot(point.x-walkPosition.x,point.z-walkPosition.z);walkPosition.set(point.x,0,point.z);if(point.done)motion=null;}
  const moving=!!motion||travelled>0;distance+=reduced?0:travelled;actor.root.position.copy(walkPosition);
  walkWeight=THREE.MathUtils.damp(walkWeight,moving?1:0,12,dt);const difference=Math.atan2(Math.sin(targetYaw-yaw),Math.cos(targetYaw-yaw));yaw+=difference*(reduced?1:Math.min(dt*16,1));actor.root.rotation.y=yaw;
  let kind=null,seatHeight=.575,activityWeight=1;const activity=world?.position.activity,visualNow=clockServerTime+time-receivedAt;
  if(activity&&visualNow>=activity.startedAt&&visualNow-activity.startedAt<10000&&!moving){
   const f=(world.home?.fixtures??world.map.streetObjects??[]).find(f=>f.id===activity.fixtureId);
   if(f){kind=activity.kind;const anchor=activityAnchor(f,kind,{x:walkPosition.x,z:walkPosition.z},activity.slot),t=reduced?1:clamp((time-activityStart)/350,0,1);activityWeight=t*t*(3-2*t);seatHeight=anchor.seatHeight;
    actor.root.position.x=walkPosition.x+(anchor.x-walkPosition.x)*activityWeight;actor.root.position.z=walkPosition.z+(anchor.z-walkPosition.z)*activityWeight;
    actor.root.rotation.y=yaw+Math.atan2(Math.sin(anchor.yaw-yaw),Math.cos(anchor.yaw-yaw))*activityWeight;
   }
  }
  actor.pose(time/1000,kind?0:walkWeight,kind,reduced,{distance,seatHeight,activityWeight});if(follow)target.set(actor.root.position.x,.65,actor.root.position.z);camera.zoom=zoom;camera.updateProjectionMatrix();camera.position.set(target.x+Math.sin(cameraYaw)*14,target.y+12,target.z+Math.cos(cameraYaw)*14);camera.lookAt(target);
  for(const item of neighbours.values()){
   let travelled=0;if(item.motion){const point=sampleMotion(item.motion,time,reduced);travelled=Math.hypot(point.x-item.position.x,point.z-item.position.z);item.position.set(point.x,0,point.z);if(point.done)item.motion=null;}
   item.distance+=reduced?0:travelled;const walking=!!item.motion||travelled>0,target=heading[item.person.facing]??0,difference=Math.atan2(Math.sin(target-item.yaw),Math.cos(target-item.yaw));item.yaw+=difference*(reduced?1:Math.min(dt*16,1));item.rig.root.rotation.y=item.yaw;item.rig.root.position.copy(item.position);
   let kind=null,seatHeight=.575,activityWeight=1;const activity=item.person.activity;
   if(world.home&&activity&&!walking&&visualNow>=activity.startedAt&&visualNow-activity.startedAt<10000){const f=world.home.fixtures.find(f=>f.id===activity.fixtureId);if(f){kind=activity.kind;const anchor=activityAnchor(f,kind,item.position,activity.slot),t=reduced?1:clamp((time-item.activityStart)/350,0,1);activityWeight=t*t*(3-2*t);seatHeight=anchor.seatHeight;item.rig.root.position.x+=(anchor.x-item.position.x)*activityWeight;item.rig.root.position.z+=(anchor.z-item.position.z)*activityWeight;item.rig.root.rotation.y+=Math.atan2(Math.sin(anchor.yaw-item.yaw),Math.cos(anchor.yaw-item.yaw))*activityWeight;}}
   item.rig.pose(time/1000,kind?0:walking?1:0,kind,reduced,{distance:item.distance,seatHeight,activityWeight});
  }
  if(geometry?.walls.length){geometry.walls[0].visible=Math.cos(cameraYaw)>0;geometry.walls[1].visible=Math.sin(cameraYaw)>0;}
  for(const p of geometry?.partitions??[])p.scale.y=raised?1:.45;
  renderer.render(scene,camera);
 }
 function update(next,mode){if(!alive)return;quality=mode;paused=mode==='low';if(paused){if(frame)cancelAnimationFrame(frame);frame=null;return;}const old=world,room=next.home??next.position,oldRoom=old?.home??old?.position,nextSignature=JSON.stringify([next.map.id,next.position.region,next.position.interior,next.home?.id,next.home?.version,next.residence,next.guestEntrances,next.parking]);
  const nextAvatar=JSON.stringify(next.avatar??{});if(nextAvatar!==avatarSignature){const previous=actor;actor=adultModel(next.avatar??{});actor.root.position.copy(previous.root.position);actor.root.rotation.copy(previous.root.rotation);scene.remove(previous.root);disposeModels(previous.root);scene.add(actor.root);avatarSignature=nextAvatar;}
  world=next;const updateAt=performance.now(),serverTime=next.serverTime??Date.now();if(!old||serverTime>clockServerTime){clockServerTime=serverTime;receivedAt=updateAt;}const activityKey=JSON.stringify(next.position.activity??null);if(activityKey!==activitySignature){activitySignature=activityKey;activityStart=Math.max(updateAt,motion?.end??0);}if(old?.home?.id!==next.home?.id||old?.position.interior!==next.position.interior||old?.position.region!==next.position.region){for(const item of neighbours.values()){scene.remove(item.rig.root);disposeModels(item.rig.root);}neighbours.clear();}syncCrowd(next);if(signature!==nextSignature){clearGeometry();geometry=sceneGeometry(next);scene.add(geometry.root);signature=nextSignature;selection=null;setGhost(null);}
  const to={x:room.x+.5,z:room.y+.5};if(old&&old.position.region===next.position.region&&old.position.interior===next.position.interior&&old.home?.id===next.home?.id&&Math.abs(oldRoom.x-room.x)+Math.abs(oldRoom.y-room.y)===1){motion=adjacentMotion({x:walkPosition.x,z:walkPosition.z},to,updateAt);}
  else if(!old||oldRoom.x!==room.x||oldRoom.y!==room.y||old.home?.id!==next.home?.id||old.position.region!==next.position.region||old.position.interior!==next.position.interior){motion=null;walkPosition.set(to.x,0,to.z);actor.root.position.copy(walkPosition);distance=0;walkWeight=0;follow=true;}
  else if(!next.position.activity&&!motion){walkPosition.set(to.x,0,to.z);actor.root.position.copy(walkPosition);}
  targetYaw=heading[next.position.facing]??0;renderer.shadowMap.enabled=mode==='high';if(!frame)frame=requestAnimationFrame(tick);
 }
 function destroy(){if(!alive)return;alive=false;listeners.abort();observer.disconnect();if(frame)cancelAnimationFrame(frame);clearGeometry();setGhost(null);disposeModels(actor.root);for(const item of neighbours.values())disposeModels(item.rig.root);neighbours.clear();disposeMaterialCache();renderer.dispose();renderer.forceContextLoss();host.replaceChildren();}
 return{update,destroy};
}
