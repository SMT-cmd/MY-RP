import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Box3,Vector3,SkinnedMesh} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
// @ts-expect-error Browser renderer has no declaration.
import {adultModel,furnitureModel,disposeModels} from '../web/scene/models.js';
async function loadBody(body:string){const b=await readFile(new URL('../web/assets/characters/adult-'+body+'.glb',import.meta.url));return(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;}
test('adult clothes are independent skinned tailored surfaces with normalized joint weights and bounded fabric draws',async()=>{
 for(const body of ['male','female']){
  const template=await loadBody(body);let source:SkinnedMesh|undefined,originalIndices=0;template.traverse(o=>{if(o instanceof SkinnedMesh&&/SuperHero|Superhero/.test(o.name)){source=o;originalIndices=o.geometry.index!.count;}});assert.ok(source&&originalIndices>0);
  for(const outfit of ['tee','linen','tunic','jacket']){
   const rig=adultModel({body,outfit},template),peer=adultModel({body,outfit},template),parts=rig.authored.garments as SkinnedMesh[];
   assert.ok(parts.length>=6&&parts.length<=8,'cuffs and laces batch into fabric draws');const regions=new Set(parts.map(p=>(p.material as {userData:Record<string,unknown>}).userData.appearanceRegion));assert.ok(regions.has('top')&&regions.has('bottom'));
   const seams=parts.flatMap(p=>p.userData.garmentParts??[{name:p.name,layer:p.userData.garment}]);assert.ok(seams.some(s=>s.layer==='cuff')&&seams.some(s=>s.layer==='shoe')&&seams.some(s=>s.layer==='waistband'));if(outfit!=='tee')assert.ok(seams.some(s=>s.layer==='pocket'));if(outfit==='jacket')assert.ok(seams.some(s=>s.layer==='lapel'));
   let triangles=0;for(const part of parts){assert.notEqual(part.geometry,peer.authored.garments[0].geometry);assert.notEqual(part.skeleton.bones[0],peer.authored.garments[0].skeleton.bones[0]);const weights=part.geometry.getAttribute('skinWeight'),joints=part.geometry.getAttribute('skinIndex');for(let i=0;i<weights.count;i++){assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-6);assert.ok(joints.getX(i)<part.skeleton.bones.length&&joints.getY(i)<part.skeleton.bones.length);}triangles+=part.geometry.index!.count/3;}
   assert.ok(triangles<5000,'tailoring adds bounded geometry');
   for(const [kind,phase] of [['Sit','Lower'],['Sit','hold'],['Rest','rest'],['Wash','ReachTap'],['Wash','Rub'],['Wash','Rinse'],['Wash','Dry'],['Clean','Scrub'],['Shower','Dry'],['Toilet','hold']]){rig.pose(.3,0,kind,false,{activityPhase:phase,activityWeight:.75,seatHeight:.47,contactHeight:.94});rig.root.updateMatrixWorld(true);for(const part of parts){part.computeBoundingBox();assert.ok(Number.isFinite(part.boundingBox!.min.y)&&Number.isFinite(part.boundingBox!.max.y));}}
   rig.pose(0,0);rig.root.updateMatrixWorld(true);const bounds=new Box3();rig.authored.root.traverse((o:unknown)=>{if(o instanceof SkinnedMesh){o.computeBoundingBox();bounds.union(o.boundingBox!.clone().applyMatrix4(o.matrixWorld));}});assert.ok(bounds.min.y>-.03&&bounds.max.y>1.7&&bounds.max.y<1.9);
   disposeModels(rig.root);peer.pose(.4,1);assert.ok(Number.isFinite(peer.authored.bones.get('hand_l').quaternion.w));disposeModels(peer.root);
  }
  assert.equal(source.geometry.index!.count,originalIndices,'tailoring never clips the shared template');
 }
});
test('handwashing, drying and cleaning move the articulated hands through different contact targets',async()=>{
 const rig=adultModel({},await loadBody('male')),hand=rig.authored.bones.get('hand_l'),point=()=>{rig.root.updateMatrixWorld(true);return hand.getWorldPosition(new Vector3());};
 rig.pose(.1,0,'Wash',false,{activityPhase:'Rub',contactHeight:.94});const first=point();rig.pose(.6,0,'Wash',false,{activityPhase:'Rub',contactHeight:.94});assert.ok(point().distanceTo(first)>.015,'rubbing moves arms');
 rig.pose(.28,0,'Wash',false,{activityPhase:'Dry',contactHeight:.94});const dry=point();assert.ok(dry.y>first.y+.07,'drying raises hands to the towel');
 rig.pose(.28,0,'Clean',false,{activityPhase:'Scrub',contactHeight:.72});assert.ok(point().y<dry.y-.10,'cleaning reaches down');
 rig.pose(.28,0,'Wash',true,{activityPhase:'Rub',contactHeight:.94});const reduced=point();rig.pose(2.6,0,'Wash',true,{activityPhase:'Rub',contactHeight:.94});assert.ok(point().distanceTo(reduced)<1e-6,'reduced motion retains stable contact');disposeModels(rig.root);
});
test('bathroom furnishings have floor-standing bowl and privacy shower geometry within their tile',()=>{
 for(const kind of ['toilet','shower']){const model=furnitureModel({id:kind,kind,w:1,h:1,rotation:0}),bounds=new Box3().setFromObject(model),size=bounds.getSize(new Vector3());assert.ok(size.x<1&&size.z<1&&bounds.min.y>=-.001);assert.ok(kind==='shower'?size.y>2:size.y>.8);disposeModels(model);}
});
test('approaching and leaving an activity preserves walking before the character lowers or lies down',()=>{
 const rig=adultModel(),options={distance:.3,activityWeight:0};rig.pose(.2,1,null,false,options);const body=rig.body.position.clone(),legs=rig.hips.map((l:{hip:{quaternion:{clone:()=>unknown}}})=>l.hip.quaternion.clone());
 for(const kind of ['Sit','Toilet','Rest']){rig.pose(.2,1,kind,false,options);assert.ok(rig.body.position.distanceTo(body)<1e-8);rig.hips.forEach((l:{hip:{quaternion:{angleTo:(q:unknown)=>number}}},i:number)=>assert.ok(l.hip.quaternion.angleTo(legs[i])<1e-7));}disposeModels(rig.root);
});
test('lowering into a seat keeps both feet grounded throughout the transition',()=>{
 for(const frame of [.91,1,1.13]){const rig=adultModel({frame});for(const activityWeight of [.1,.25,.5,.75,1]){rig.pose(.2,0,'Sit',false,{activityWeight});rig.root.updateMatrixWorld(true);for(const leg of rig.hips)assert.ok(Math.abs(leg.ankle.getWorldPosition(new Vector3()).y-.08)<1e-7);}disposeModels(rig.root);}
});
