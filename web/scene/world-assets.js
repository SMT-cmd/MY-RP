import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export function fitAsset(template,width,depth,height=null,rotation=0,tint=null){
 const root=new THREE.Group(),model=template.clone(true);root.add(model);
 model.traverse(o=>{if(!o.isMesh)return;o.geometry=o.geometry.clone();o.castShadow=true;o.receiveShadow=true;o.material=(Array.isArray(o.material)?o.material:[o.material]).map(source=>{const m=source.clone();if(tint&&!m.map&&source.color?.getHex()!==0xffffff)m.color.lerp(new THREE.Color(tint),.45);m.roughness=Math.max(.45,m.roughness??.8);return m;});if(o.material.length===1)o.material=o.material[0];o.userData.ownedMaterial=true;});
 const b=new THREE.Box3().setFromObject(model),size=b.getSize(new THREE.Vector3()),centre=b.getCenter(new THREE.Vector3());
 const scale=Math.min(width/Math.max(size.x,.001),depth/Math.max(size.z,.001));
 model.scale.multiply(new THREE.Vector3(width/Math.max(size.x,.001),height===null?scale:height/Math.max(size.y,.001),depth/Math.max(size.z,.001)));
 model.position.set(-centre.x*model.scale.x,-b.min.y*model.scale.y,-centre.z*model.scale.z);root.rotation.y=-rotation*Math.PI/180;root.userData.asset=true;return root;
}
export function createWorldAssetLibrary(){
 const abort=new AbortController(),templates=new Map(),pending=new Map();let alive=true,revision=0;
 const release=root=>{const textures=new Set();root.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}});for(const t of textures){t.image?.close?.();t.dispose();}};
 const load=key=>{if(templates.has(key))return Promise.resolve(true);if(pending.has(key))return pending.get(key);const promise=(async()=>{const r=await fetch('/assets/world/'+key+'.glb',{signal:abort.signal,credentials:'omit'});if(!r.ok)throw Error();const data=await r.arrayBuffer();if(!alive)return false;const gltf=await new GLTFLoader().parseAsync(data,'');if(!alive){release(gltf.scene);return false;}templates.set(key,gltf.scene);revision++;return true;})().catch(()=>false);pending.set(key,promise);return promise;};
 return{get revision(){return revision;},get:key=>templates.get(key),async load(keys){const todo=[...new Set(keys)];await Promise.all(Array.from({length:Math.min(4,todo.length)},async()=>{while(alive&&todo.length)await load(todo.shift());}));},dispose(){alive=false;abort.abort();for(const root of templates.values())release(root);templates.clear();}};
}
