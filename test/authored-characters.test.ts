import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Box3,Vector3,SkinnedMesh,Object3D} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
// @ts-expect-error Browser geometry has no declaration.
import {adultModel,disposeModels} from '../web/scene/models.js';
// @ts-expect-error Browser asset lifecycle has no declaration.
import {createCharacterLibrary} from '../web/scene/authored-characters.js';
import {APPEARANCE,DEFAULT_APPEARANCE,appearanceRender} from '../src/appearance.ts';
async function template(body:string){
 const bytes=await readFile(new URL('../web/assets/characters/adult-'+body+'.glb',import.meta.url));assert.ok(bytes.length<1_100_000);const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString().trim());assert.equal(json.buffers.length,1);assert.equal(json.buffers[0].uri,undefined);assert.equal(json.images,undefined);assert.match(JSON.stringify(json.asset.extras),/CC0/);
 return (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}
test('local CC0 adult skins retain independent skeletons, ground contact and seat contact across all frames and outfits',async()=>{
 const templates={male:await template('male'),female:await template('female')};
 for(const frame of APPEARANCE.frame)for(const outfit of APPEARANCE.outfit){
  const appearance=appearanceRender({...DEFAULT_APPEARANCE,frame:frame.id,outfit:outfit.id}),rig=adultModel(appearance,templates[frame.body as keyof typeof templates]),peer=adultModel(appearance,templates[frame.body as keyof typeof templates]);
  assert.equal(rig.root.userData.characterSource,'Quaternius Universal Base Characters Standard · CC0-1.0');assert.notEqual(rig.authored.bones.get('foot_l'),peer.authored.bones.get('foot_l'));
  for(const distance of [0,.1,.3,.5,.6,.8,1.1]){rig.pose(distance/1.5,1,null,false,{distance});rig.root.updateMatrixWorld(true);for(const leg of rig.hips){const foot=rig.authored.bones.get('foot_'+(leg.side>0?'l':'r')).getWorldPosition(new Vector3()),target=leg.ankle.getWorldPosition(new Vector3());assert.ok(foot.distanceTo(target)<.025,`${frame.id}/${outfit.id} foot ${distance}: ${foot.distanceTo(target)}`);}}
  rig.pose(0,0,'Sit',false,{seatHeight:.575});rig.root.updateMatrixWorld(true);assert.ok(Math.abs(rig.authored.bones.get('thigh_l').getWorldPosition(new Vector3()).y-.59)<.005);
  rig.pose(0,0);rig.root.updateMatrixWorld(true);const bounds=new Box3();rig.authored.root.traverse((o:Object3D)=>{if(o instanceof SkinnedMesh){o.computeBoundingBox();bounds.union(o.boundingBox!.clone().applyMatrix4(o.matrixWorld));}});const size=bounds.getSize(new Vector3());assert.ok(size.y>1.7&&size.y<1.9);assert.ok(size.x<.8);assert.ok(bounds.min.y>-.03);
  const rest=rig.authored.bones.get('lowerarm_l').quaternion.clone();rig.pose(0,0,'Read');assert.ok(rest.angleTo(rig.authored.bones.get('lowerarm_l').quaternion)>.1);disposeModels(rig.root);peer.pose(.3,1);assert.ok(Number.isFinite(peer.authored.bones.get('foot_l').quaternion.w));disposeModels(peer.root);
 }
});
test('disposing an in-flight character library aborts work and fences late completions',async()=>{
 const original=globalThis.fetch;let resolve!:(value:Response)=>void,signal:AbortSignal|undefined;globalThis.fetch=async(_input,init)=>{signal=init?.signal??undefined;return new Promise<Response>(done=>resolve=done);};
 try{const library=createCharacterLibrary(),loading=library.load('male');library.dispose();assert.equal(signal?.aborted,true);resolve(new Response(new Uint8Array()));assert.equal(await loading,false);assert.equal(library.get('male'),undefined);assert.equal(library.revision,0);}finally{globalThis.fetch=original;}
});
