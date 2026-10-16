import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createApp} from '../src/http.ts';
import {initialState,DomainError} from '../src/domain.ts';
// @ts-expect-error Browser JavaScript module is exercised with actual GLB data below.
import {fitAsset} from '../web/scene/world-assets.js';
const root=new URL('../web/',import.meta.url);
test('reviewed local models embed their textures and preserve checksummed publisher evidence',async()=>{
 const manifest=JSON.parse(await readFile(new URL('assets/world/manifest.json',root),'utf8'));assert.equal(manifest.licence,'CC0-1.0');assert.equal(Object.keys(manifest.assets).length,50);let bytes=0;
 for(const asset of Object.values(manifest.assets) as {url:string;bytes:number;sha256:string}[]){const data=await readFile(new URL(asset.url.slice(1),root));bytes+=data.length;assert.equal(data.length,asset.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),asset.sha256);assert.equal(data.subarray(0,4).toString(),'glTF');const doc=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());assert.ok(doc.meshes.length);for(const buffer of doc.buffers)assert.equal(buffer.uri,undefined);for(const image of doc.images??[]){assert.equal(image.uri,undefined);assert.ok(Number.isSafeInteger(image.bufferView));}}
 assert.ok(bytes<4_000_000);for(const pack of Object.keys(manifest.packs))assert.match(await readFile(new URL('assets/world/LICENSE-'+pack+'.txt',root),'utf8'),/CC0/);
});
test('an actual downloaded furnishing fits the authoritative footprint and owns independent geometry/materials',async()=>{
 const data=await readFile(new URL('assets/world/furniture/loungeDesignSofa.glb',root));const template=(await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'')).scene,a=fitAsset(template,2,1,1.1,90,0x76513c),b=fitAsset(template,2,1,1.1,0,0x354d68);a.updateMatrixWorld(true);b.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(a),size=box.getSize(new THREE.Vector3());assert.ok(Math.abs(size.x-1)<.00001);assert.ok(Math.abs(size.z-2)<.00001);assert.ok(Math.abs(size.y-1.1)<.00001);assert.ok(Math.abs(box.min.y)<.00001);const first=(root:THREE.Object3D)=>{let mesh:THREE.Mesh|null=null;root.traverse(o=>{if(!mesh&&(o as THREE.Mesh).isMesh)mesh=o as THREE.Mesh;});return mesh! as THREE.Mesh;};assert.notEqual(first(a).geometry,first(b).geometry);assert.notEqual(first(a).geometry,first(template).geometry);assert.notEqual(first(a).material,first(b).material);
});
test('both accelerated and Canvas art are public local assets while arbitrary paths and private APIs remain protected',async t=>{
 const server=createApp({store:{snapshot:()=>initialState(),dispatch:async()=>{throw Error();}},authenticate:async()=>{throw new DomainError('AUTH_REQUIRED','Sign in.',401);}});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise<void>(r=>server.close(()=>r())));const a=server.address();if(!a||typeof a==='string')throw Error();const origin='http://127.0.0.1:'+a.port;
 for(const [path,type] of [['/assets/world/commercial/building-skyscraper-a.glb','model/gltf-binary'],['/assets/world/sprites/furniture-loungeSofaLong-0.webp','image/webp'],['/assets/world/characters/female-jacket.webp','image/webp'],['/assets/world/characters/male-tunic-mask.webp','image/webp'],['/scene/sprites.js','text/javascript']]){const response=await fetch(origin+path);assert.equal(response.status,200);assert.ok(response.headers.get('content-type')!.startsWith(type));assert.deepEqual(Buffer.from(await response.arrayBuffer()),await readFile(new URL(path.slice(1),root)));}
 assert.equal((await fetch(origin+'/api/citizen')).status,401);assert.equal((await fetch(origin+'/assets/world/furniture/not-allowed.glb')).status,401);const html=await(await fetch(origin+'/')).text();assert.doesNotMatch(html,/href="\/world-art.html"|generated with AI|art-credit/i);
});
