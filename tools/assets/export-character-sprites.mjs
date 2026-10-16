// Export only the project's existing CC0 meshes and authored pose driver.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {adultModel,disposeModels} from '../../web/scene/models.js';
const out=new URL('../../../character-projection/',import.meta.url);await mkdir(out,{recursive:true});
const headings={front:0,right:Math.PI/2,back:Math.PI,left:-Math.PI/2};
const defaults={skin:0x895c40,shirt:0x377f80,trousers:0x30465c,hairColour:0x282623};
const frames=[];
for(const body of ['male','female']){
 const bytes=await readFile(new URL('../../web/assets/characters/adult-'+body+'.glb',import.meta.url));const template=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
 for(const outfit of ['tee','linen','tunic','jacket']){
  const rig=adultModel({...defaults,body,frame:1,hair:'crop',outfit},template);
  for(const [face,yaw] of Object.entries(headings))for(let phase=0;phase<8;phase++){
   const kind=phase===5?'Sit':phase===6?'Rest':phase===7?'Read':null;
   rig.pose(phase*.16,phase>=1&&phase<=4?1:0,kind,false,{distance:(phase-1)*.3,seatHeight:.575,activityWeight:1});rig.root.rotation.y=yaw;rig.root.updateMatrixWorld(true);
   const tris=[],colors=[],categories=[];
   rig.root.traverse(object=>{
    if(!object.isMesh)return;for(let parent=object;parent;parent=parent.parent)if(!parent.visible)return;
    const g=object.geometry,index=g.index,positions=g.getAttribute('position'),materials=Array.isArray(object.material)?object.material:[object.material],groups=g.groups.length?g.groups:[{start:0,count:index?index.count:positions.count,materialIndex:0}];
    for(const group of groups){const material=materials[group.materialIndex??0];if(!material||material.transparent&&material.opacity<.1)continue;const color=material.color?.getHex()??0xffffff;const rgb=[color>>16&255,color>>8&255,color&255];const category=color===defaults.skin?1:color===defaults.shirt?2:color===defaults.trousers?3:color===defaults.hairColour?4:0;
     for(let i=group.start;i<group.start+group.count;i+=3){for(let k=0;k<3;k++){const vertex=index?index.getX(i+k):i+k,v=new THREE.Vector3().fromBufferAttribute(positions,vertex);if(object.isSkinnedMesh)object.applyBoneTransform(vertex,v);v.applyMatrix4(object.matrixWorld);tris.push(v.x,v.y,v.z);}colors.push(...rgb);categories.push(category);}
    }
   });
   const name=body+'-'+outfit+'-'+face+'-'+phase;await writeFile(new URL(name+'.f32',out),new Uint8Array(new Float32Array(tris).buffer));await writeFile(new URL(name+'.rgb',out),new Uint8Array(colors));await writeFile(new URL(name+'.cat',out),new Uint8Array(categories));frames.push({name,body,outfit,face,phase,count:categories.length});
  }disposeModels(rig.root);
 }
}
await writeFile(new URL('frames.json',out),JSON.stringify(frames));console.log('Exported',frames.length,'posed character frames to',out.pathname);
