import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Box3,Vector3} from 'three';
// JavaScript rendering models are deliberately separate from game authority.
// @ts-expect-error Browser geometry module has no TypeScript declaration.
import {adultModel,furnitureModel,vehicleModel,disposeModels} from '../web/scene/models.js';
// @ts-expect-error Browser geometry module has no TypeScript declaration.
import {sceneGeometry,crowdModels} from '../web/scene/engine.js';
import {homeFor} from '../src/furnishing.ts';
import {FURNITURE} from '../src/furnishing.ts';
test('nearby adult rigs use public profiles and positions with a bounded crowd',()=>{
 const people=Array.from({length:40},(_,i)=>({id:'public-citizen-'+i,name:'Neighbour '+i,x:i,y:7,facing:'left',avatar:{skin:'#895c40',shirt:'#377f80',trousers:'#30465c',hair:'braids',hairColour:'#282623',outfit:'tunic',frame:1}}));
 const crowd=crowdModels(people);assert.equal(crowd.length,32);
 for(const [i,{person,rig}] of crowd.entries()){assert.equal(person.id,people[i].id);assert.equal(rig.root.userData.citizenId,people[i].id);assert.deepEqual(rig.root.position.toArray(),[i+.5,0,7.5]);const size=new Box3().setFromObject(rig.root).getSize(new Vector3());assert.ok(size.y>1.75&&size.y<1.95);disposeModels(rig.root);}
});
import {initialState,execute,citizenView} from '../src/domain.ts';
import {createApp} from '../src/http.ts';
import {walkTo} from './helpers.ts';
import {APPEARANCE,DEFAULT_APPEARANCE,appearanceRender} from '../src/appearance.ts';

test('curated adult styles retain articulated proportions and render saved colours and hair',()=>{
 for(const hair of APPEARANCE.hair)for(const outfit of APPEARANCE.outfit)for(const frame of APPEARANCE.frame){
  const render=appearanceRender({...DEFAULT_APPEARANCE,hair:hair.id,outfit:outfit.id,frame:frame.id,skin:'cocoa',top:'wine',bottom:'sand'}),rig=adultModel(render);rig.root.updateMatrixWorld(true);const size=new Box3().setFromObject(rig.root).getSize(new Vector3());assert.ok(size.y>1.7&&size.y<2.1);assert.ok(size.x<.75);assert.equal(rig.root.userData.appearance.skin,'#70462f');assert.equal(rig.root.userData.appearance.shirt,'#824c55');assert.equal(rig.root.userData.appearance.trousers,'#9b8a70');const group=rig.head.children.find((o:{name:string})=>o.name==='Hair '+hair.id);assert.ok(group);assert.equal(group.children.length===0,hair.id==='shaved');rig.pose(.2,1);assert.notEqual(rig.hips[0].hip.rotation.x,rig.hips[1].hip.rotation.x);disposeModels(rig.root);
 }
});

test('adult rig stays life-sized, turns in three dimensions and has independent walking joints',()=>{
 const rig=adultModel();rig.root.updateMatrixWorld(true);const size=new Box3().setFromObject(rig.root).getSize(new Vector3());assert.ok(size.y>1.7&&size.y<1.9,'Adult should be human-scale');assert.ok(size.x<.65,'Head/body should not have toy proportions');
 const still=rig.hips.map((j:{hip:{rotation:{x:number}}})=>j.hip.rotation.x);rig.pose(.2,1);assert.notDeepEqual(rig.hips.map((j:{hip:{rotation:{x:number}}})=>j.hip.rotation.x),still);assert.notEqual(rig.hips[0].hip.rotation.x,rig.hips[1].hip.rotation.x);rig.pose(.2,1,null,true);assert.deepEqual(rig.hips.map((j:{hip:{rotation:{x:number}}})=>j.hip.rotation.x),still);
 rig.pose(0,0,'Sit');assert.ok(rig.body.position.y<0);rig.pose(0,0,'Rest');assert.ok(Math.abs(rig.body.rotation.x)>1.5);rig.pose(0,0,null);assert.equal(rig.body.rotation.x,0);assert.ok(disposeModels(rig.root)>0);
});
test('every purchased model renders within its recorded footprint after each quarter turn',()=>{
 for(const f of FURNITURE)for(const rotation of [0,90,180,270]){const w=rotation%180?f.h:f.w,h=rotation%180?f.w:f.h,object=furnitureModel({...f,model:f.id,finish:'walnut',rotation,w,h});object.updateMatrixWorld(true);const size=new Box3().setFromObject(object).getSize(new Vector3());assert.ok(size.x<=w+.16,`${f.id} rotation ${rotation} exceeds floor width: ${size.x}`);assert.ok(size.z<=h+.16,`${f.id} rotation ${rotation} exceeds floor depth: ${size.z}`);assert.ok(size.y>.25);disposeModels(object);}
 for(const model of ['compact','van']){const object=vehicleModel(model),size=new Box3().setFromObject(object).getSize(new Vector3());assert.ok(size.x<1&&size.z<2&&size.y<1.3);disposeModels(object);}
});
test('main room geometry uses authoritative owned fixtures and rotated dimensions',()=>{
 let s=execute(initialState(),'resident',{id:'create_scene_resident',type:'CreateCitizen',payload:{name:'Resident',state:'Lagos',adultConfirmed:true}},100).state;s=walkTo(s,'resident',4,7,1000);s=execute(s,'resident',{id:'enter_scene_home',type:'EnterBuilding',payload:{buildingId:'shelter'}},5000).state;const world=citizenView(s,'resident',5000).world!;
 const geometry=sceneGeometry(world);assert.equal(geometry.fixtures.length,world.home!.fixtures.length);for(const fixture of world.home!.fixtures){const object=geometry.fixtures.find((o:{children:{userData:{fixtureId?:string}}[]})=>o.children.some(c=>c.userData.fixtureId===fixture.id));assert.ok(object);assert.equal(object.position.x,fixture.x+fixture.w/2);assert.equal(object.position.z,fixture.y+fixture.h/2);}disposeModels(geometry.root);
});
test('main engine dependencies are served locally and the import map has an exact CSP hash',async t=>{
 const server=createApp({store:{snapshot:()=>initialState(),dispatch:async()=>{throw Error();}},authenticate:async()=>{throw Error();}});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));const a=server.address();if(!a||typeof a==='string')throw Error();const origin='http://127.0.0.1:'+a.port,response=await fetch(origin),html=await response.text(),map=html.match(/<script type="importmap">(.*?)<\/script>/)![1];assert.ok(response.headers.get('Content-Security-Policy')!.includes("'sha256-"+createHash('sha256').update(map).digest('base64')+"'"));
 for(const path of ['/scene/engine.js','/scene/models.js','/scene/motion.js','/engine/three.module.js','/engine/three.core.js','/engine/rounded-box.js','/walking.js']){const r=await fetch(origin+path);assert.equal(r.status,200,path);assert.match(r.headers.get('Content-Type')!,/javascript/);}
 assert.equal((await fetch(origin+'/engine/package.json')).status,500);const source=await readFile(new URL('../web/world-3d-controller.js',import.meta.url),'utf8');assert.doesNotMatch(source,/https:\/\/|cdn\./);
});

test('expanded street geometry renders the same interactive buildings and public seats as the server',()=>{
 const state=execute(initialState(),'scene-walker',{id:'create_street_scene',type:'CreateCitizen',payload:{name:'Walker',state:'Lagos',adultConfirmed:true}},100).state,world=citizenView(state,'scene-walker',100).world!,geometry=sceneGeometry(world);
 const buildings=new Set<string>(),seats=new Set<string>();geometry.root.traverse((o:{userData:{buildingId?:string;streetObjectId?:string}})=>{if(o.userData.buildingId)buildings.add(o.userData.buildingId);if(o.userData.streetObjectId)seats.add(o.userData.streetObjectId);});assert.deepEqual([...buildings].sort(),world.map.buildings.map(b=>b.id).sort());assert.deepEqual([...seats].sort(),world.map.streetObjects.map(o=>o.id).sort());assert.equal(geometry.places.length,buildings.size+seats.size);disposeModels(geometry.root);
});

test('multi-room geometry places walls on canonical edges and distinguishes doorway openings',()=>{
 let s=execute(initialState(),'room-renderer',{id:'create_room_renderer',type:'CreateCitizen',payload:{name:'Resident',state:'Lagos',adultConfirmed:true}},100).state;s=walkTo(s,'room-renderer',4,7,1000);s=execute(s,'room-renderer',{id:'room_render_enter',type:'EnterBuilding',payload:{buildingId:'shelter'}},5000).state;
 s=execute(s,'room-renderer',{id:'room_render_materials',type:'BuyNPCSupply',payload:{goodsId:'materials',quantity:4,acceptedUnitPrice:2000}},6000).state;s=execute(s,'room-renderer',{id:'room_render_build',type:'BuildHomePartition',payload:{axis:'h',x:0,y:3,length:10,doorAt:4,acceptedLabour:26000,acceptedMaterials:4,acceptTerms:true,homeVersion:1}},7000).state;
 const world=citizenView(s,'room-renderer',7000).world!,geometry=sceneGeometry(world),home=homeFor(s,'room-renderer');assert.equal(geometry.partitions.length,10);for(const p of home.partitions!){const object=geometry.partitions.find((o:{name:string})=>o.name===p.id);assert.equal(object.position.x,p.x+.5);assert.equal(object.position.z,p.y);if(p.door)assert.ok(object.children.length>1,'Doorways should have posts and an open passage');}disposeModels(geometry.root);
});
