import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {footTarget,legAngles} from './motion.js';
import {attachAuthoredCharacter} from './authored-characters.js';

export const finishes={walnut:0x76513c,oak:0xba956a,cream:0xe8dfd0,slate:0x586675,sage:0x809882,terracotta:0xb57254,navy:0x354d68};
const materials=new Map();
export function material(color,roughness=.8,metalness=0){const id=[new THREE.Color(color).getHexString(),roughness,metalness].join(':');if(!materials.has(id))materials.set(id,new THREE.MeshStandardMaterial({color,roughness,metalness}));return materials.get(id);}
export function mesh(parent,geometry,mat,x=0,y=0,z=0){const object=new THREE.Mesh(geometry,mat);object.position.set(x,y,z);object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;}
export function box(parent,w,h,d,x,y,z,color,radius=0){return mesh(parent,radius?new RoundedBoxGeometry(w,h,d,2,Math.min(radius,w/4,h/4,d/4)):new THREE.BoxGeometry(w,h,d),material(color),x,y,z);}
function sphere(parent,r,x,y,z,color,sx=1,sy=1,sz=1){const m=mesh(parent,new THREE.SphereGeometry(r,12,10),material(color),x,y,z);m.scale.set(sx,sy,sz);return m;}
function capsule(parent,r,length,x,y,z,color){return mesh(parent,new THREE.CapsuleGeometry(r,length,4,10),material(color),x,y,z);}
function group(parent,x=0,y=0,z=0){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}

// Original articulated adult geometry, with a 1.81 m height and small head.
// The rig is independent of game authority and can later accept authored assets.
export function adultModel({skin=0x805238,shirt=0x2e7477,trousers=0x303f52,hair='crop',hairColour=0x282521,frame=1,outfit='tee',body:bodyType='male'}={},template=null,eyeTexture=null){
 const root=new THREE.Group(),body=group(root);root.name='Adult citizen';
 body.scale.set(frame,1,Math.sqrt(frame));root.userData.appearance={skin,shirt,trousers,hair,hairColour,frame,outfit,body:bodyType};const accessories=[];
 mesh(body,new THREE.CylinderGeometry(.17,.145,.48,12),material(shirt),0,1.245,0).scale.set(1.24,1,.8);
 if(outfit==='tunic'){const hem=mesh(body,new THREE.CylinderGeometry(.185,.225,.31,16),material(shirt),0,1.015,0);hem.scale.z=.76;accessories.push(hem);}
 if(outfit==='linen'||outfit==='jacket'){
  for(const side of [-1,1]){const collar=box(body,.08,.025,.09,side*.05,1.48,.095,outfit==='jacket'?0xe5dccb:shirt,.008);collar.rotation.z=side*.35;accessories.push(collar);}
  for(const y of [1.16,1.27,1.38])accessories.push(sphere(body,.009,0,y,.138,outfit==='jacket'?0xc2b492:0xe6dbc5));
  if(outfit==='jacket')accessories.push(box(body,.085,.34,.012,0,1.27,.14,0xe5dccb,.006));
 }
 box(body,.30,.12,.22,0,.995,0,trousers,.035);
 capsule(body,.045,.06,0,1.54,0,skin);
 const head=group(body,0,1.69,0);head.name='Head';
 const profile=[[.045,-.126],[.067,-.105],[.087,-.068],[.104,-.020],[.107,.036],[.09,.083],[.055,.114],[.008,.126]].map(([r,y])=>new THREE.Vector2(r,y));
 mesh(head,new THREE.LatheGeometry(profile,20),material(skin)).scale.z=.94;
 const hairRoot=group(head);hairRoot.name='Hair '+hair;
 if(hair==='crop')sphere(hairRoot,.12,0,.072,-.012,hairColour,.91,.48,.96);
 if(hair==='afro'){
  sphere(hairRoot,.17,0,.096,-.02,hairColour,1,.85,.94);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;sphere(hairRoot,.055,Math.sin(a)*.12,.12,Math.cos(a)*.105-.024,hairColour);}
 }
 if(hair==='locs'||hair==='braids'){
  sphere(hairRoot,.12,0,.075,-.016,hairColour,.94,.48,1);
  for(let i=0;i<11;i++){const a=(i/10)*Math.PI*1.6+Math.PI*.2,x=Math.sin(a)*.112,z=Math.cos(a)*.115-.025;
   capsule(hairRoot,.014,hair==='locs'?.23:.11,x,hair==='locs'?-.04:.015,z,hairColour);
  }
  if(hair==='braids')sphere(hairRoot,.071,0,.057,-.135,hairColour,1,.85,1);
 }
 const eyes=[];
 for(const side of [-1,1]){
  sphere(head,.027,side*.109,-.012,0,skin,.65,1,.58);
  const eye=group(head,side*.041,.018,.090);sphere(eye,.015,0,0,0,0xe4dbce,1,.55,.55);sphere(eye,.006,0,0,.010,0x241e19,1,1,.55);eyes.push(eye);
  box(head,.036,.009,.012,side*.042,.047,.096,0x30241e,.003);
 }
 sphere(head,.024,0,-.009,.101,skin,.65,1,1);box(head,.018,.039,.021,0,.012,.094,skin,.006);
 box(head,.042,.008,.013,0,-.062,.086,0x603e30,.004);
 const hips=[],arms=[];
 for(const side of [-1,1]){
  const hip=group(body,side*.098,.94,0),knee=group(hip,0,-.43,0),ankle=group(knee,0,-.43,0);
  hip.name=side<0?'Left hip':'Right hip';knee.name=side<0?'Left knee':'Right knee';
  capsule(hip,.073,.29,0,-.205,0,trousers);capsule(knee,.061,.30,0,-.21,0,trousers);
  box(ankle,.145,.14,.245,0,-.01,.058,0x282b29,.035);hips.push({hip,knee,ankle,side});
  const shoulder=group(body,side*.219,1.45,0),elbow=group(shoulder,0,-.29,0);shoulder.name=side<0?'Left shoulder':'Right shoulder';elbow.name=side<0?'Left elbow':'Right elbow';
  capsule(shoulder,.064,.10,0,-.067,0,shirt);capsule(shoulder,.050,.13,0,-.19,0,outfit==='tee'?skin:shirt);capsule(elbow,.041,.19,0,-.135,0,outfit==='tee'?skin:shirt);sphere(elbow,.045,0,-.295,.005,skin,.68,1.15,.55);arms.push({shoulder,elbow,side});
 }
 const book=group(body,0,1.12,.31);box(book,.25,.024,.17,0,0,0,0xd0b889,.008);box(book,.23,.010,.16,0,.014,0,0xf0e9db);book.visible=false;
 function pose(time,walkWeight,activity,reduced=false,{distance=time*1.5,seatHeight=.575,activityWeight=1,activityTime=time}={}){
  const weight=reduced?0:Math.max(0,Math.min(1,walkWeight)),phase=Math.sin(distance/1.2*Math.PI*2),a=activityWeight;
  body.position.set(0,(-.11+.014*Math.cos(distance/1.2*Math.PI*4))*weight,0);body.rotation.set(0,0,0);head.rotation.set(0,0,phase*.006*weight);book.visible=activity==='Read';
  for(const {hip,knee,ankle,side} of hips){const foot=footTarget(distance,side,weight),angles=legAngles(foot.z/Math.sqrt(frame),.94+body.position.y,foot.y);hip.rotation.set(angles.hip,0,0);knee.rotation.set(angles.knee,0,0);ankle.rotation.set(angles.ankle,0,0);}
  for(const {shoulder,elbow,side} of arms){shoulder.rotation.set(-phase*side*.30*weight,0,side*.045);elbow.rotation.set(-.10-Math.max(0,phase*side)*.14*weight,0,0);}
  if(activity==='Sit'){
   body.position.y=(seatHeight+.015-.94)*a;
   // Solve the feet at the current pelvis height through lowering/standing.
   for(const leg of hips){const angles=legAngles(.40*a,.94+body.position.y,.08);leg.hip.rotation.x=angles.hip;leg.knee.rotation.x=angles.knee;leg.ankle.rotation.x=angles.ankle;}
   for(const arm of arms){arm.shoulder.rotation.x=-.25*a;arm.elbow.rotation.x=-.55*a;}
  }
  if(activity==='Rest'){body.rotation.x=-Math.PI/2*a;body.position.set(0,.83*a,.86*a);}
  if(['Read','Dress'].includes(activity)){head.rotation.x=.10*a;for(const arm of arms){arm.shoulder.rotation.x=-.45*a;arm.elbow.rotation.x=-1.18*a;}}
  if(activity==='Wash'){const rub=reduced?0:Math.sin(activityTime*10);head.rotation.x=.18*a;for(const arm of arms){arm.shoulder.rotation.set((-.68+rub*arm.side*.055)*a,0,arm.side*-.28*a);arm.elbow.rotation.set((-.32-rub*arm.side*.08)*a,0,0);}}
  const blink=!reduced&&time%4.7>4.58?.10:1;for(const eye of eyes)eye.scale.y=blink;
 }
 pose(0,0);const rig={root,body,head,hips,arms,eyes,pose,book,accessories};attachAuthoredCharacter(rig,{skin,shirt,trousers,hair,hairColour,frame,outfit},template,eyeTexture);return rig;
}
function legs(g,w,d,height){for(const x of [-1,1])for(const z of [-1,1])box(g,.10,height,.10,x*(w/2-.15),height/2,z*(d/2-.15),0x6e503a,.012);}
function cabinet(g,w,d,height,color,shelves=false){
 box(g,w,.08,d,0,.07,0,color,.014);box(g,w,.08,d,0,height,0,color,.014);for(const side of [-1,1])box(g,.07,height,d,side*(w-.07)/2,height/2,0,color,.012);
 box(g,w,height,.05,0,height/2,-(d-.05)/2,color,.008);
 if(shelves){for(let level=1;level<5;level++){const y=height*level/5;box(g,w,.055,d,0,y,0,color,.008);for(let i=0;i<5;i++)box(g,.07,.21,.17,-w/2+.17+i*.12,y+.13,d/2-.13,[0x8c5c4c,0x536b79,0xbeb08b][i%3],.01);}}
 else for(const side of [-1,1]){box(g,w/2-.04,height-.17,.05,side*w/4,height/2,d/2,color,.008);box(g,.027,.14,.035,side*.08,height*.55,d/2+.04,0xcbb998,.008);}
}
export function furnitureModel(f){
 const root=new THREE.Group(),g=group(root),color=finishes[f.finish]??finishes.oak;const kind=f.kind??f.model;let w=f.rotation%180?f.h:f.w,d=f.rotation%180?f.w:f.h;
 root.name=f.name??f.model;root.rotation.y=-(f.rotation??0)*Math.PI/180;
 if(['wardrobe','bookshelf','display-case'].includes(kind)&&w<d){[w,d]=[d,w];g.rotation.y=Math.PI/2;}
 if(kind==='bench'){
  legs(g,w-.16,d-.12,.43);for(let i=0;i<5;i++)box(g,w-.10,.06,.12,0,.47,-d/2+.16+i*.15,color,.014);
  for(const side of [-1,1])box(g,.08,.70,.08,side*(w/2-.20),.74,-d/2+.10,0x475a51,.01);
  for(const y of [.70,.90,1.10])box(g,w-.12,.12,.06,0,y,-d/2+.09,color,.012);
 }else if(['bed','single-bed'].includes(kind)){
  legs(g,w,d,.30);box(g,w,.18,d,0,.36,0,finishes.walnut,.045);box(g,w-.12,.24,d-.10,0,.54,0,0xe5dfd3,.075);box(g,w-.10,.075,d*.63,0,.69,d*.14,color,.026);box(g,w,.94,.13,0,.62,-d/2+.03,color,.05);
  for(const side of [-1,1])box(g,w*.38,.12,.40,side*w*.21,.72,-d/2+.34,0xf2ebdf,.05);
 }else if(['sofa','loveseat','armchair','dining-chair','chaise'].includes(kind)){
  const width=w-.12,depth=d-.12;legs(g,width,depth,.20);box(g,width,.22,depth,0,.32,0,color,.065);box(g,width,.66,.19,0,.67,-depth/2+.05,color,.08);
  if(kind!=='dining-chair')for(const side of [-1,1])box(g,.17,.46,depth,side*(width-.12)/2,.53,0,color,.065);
  const seats=f.seats||(kind==='sofa'?3:kind==='loveseat'?2:1);for(let i=0;i<seats;i++){const sx=(i-(seats-1)/2)*(width-.30)/seats;box(g,(width-.28)/seats-.025,.13,depth-.25,sx,.51,.05,color,.045);}
 }else if(['desk','dining-table','coffee-table','side-table'].includes(kind)){
  const height=kind==='coffee-table'?.40:kind==='side-table'?.58:.77;legs(g,w-.12,d-.12,height-.06);box(g,w-.08,.09,d-.08,0,height-.02,0,color,.026);if(kind==='desk'){box(g,.42,.018,.28,-.23,height+.045,-.10,0xe8e2d7,.008);box(g,.15,.14,.15,.30,height+.08,-.14,0xccc7b4,.014);}
 }else if(kind==='plant'){
  mesh(g,new THREE.CylinderGeometry(.25,.19,.40,12),material(0xb2916d),0,.20,0);capsule(g,.018,.80,0,.82,0,0x526a44);
  for(let i=0;i<8;i++){const angle=i*Math.PI/4,leaf=sphere(g,.35,Math.sin(angle)*.22,.90+(i%2)*.16,Math.cos(angle)*.22,0x4e7b47,.35,.16,1);leaf.rotation.y=angle;leaf.rotation.x=-.4;}
 }else if(kind==='ottoman'){
  legs(g,w-.10,d-.10,.20);box(g,w-.12,.27,d-.12,0,.39,0,color,.10);box(g,w-.14,.13,d-.14,0,.51,0,color,.055);
 }else if(['floor-lamp','table-lamp','studio-light'].includes(kind)){
  const table=kind==='table-lamp',height=table?1.14:kind==='studio-light'?1.50:1.78;if(table){cabinet(g,.78,.72,.62,color);box(g,.82,.045,.76,0,.66,0,color,.016);}
  mesh(g,new THREE.CylinderGeometry(.26,.29,.055,20),material(f.style==='brass'?0xb69a61:0x454c49,.4,.6),0,table?.71:.045,0);capsule(g,.023,height-(table?.76:.12),0,(height+(table?.76:.12))/2,0,0xb6aa86);
  if(kind==='studio-light')mesh(g,new THREE.TorusGeometry(.25,.045,8,24),material(color,.5),0,height,0);else mesh(g,new THREE.CylinderGeometry(.16,.29,.31,20,1,true),material(color,.65),0,height-.06,0);
  const bulbMaterial=new THREE.MeshStandardMaterial({color:0xffe5bd,emissive:0xffd4a0,emissiveIntensity:0,roughness:.5}),bulb=mesh(g,new THREE.SphereGeometry(kind==='studio-light'?.13:.08,12,10),bulbMaterial,0,height-.10,0);bulb.userData.ownedMaterial=true;root.userData.lighting={bulb,height:height-.10,fixtureId:f.id};
 }else if(kind==='vanity'){
  cabinet(g,w-.13,d-.13,.82,color);box(g,w-.10,.07,d-.10,0,.89,0,0xdbd9cc,.022);box(g,.55,.035,.47,0,.94,.05,0x829c9f,.08);box(g,w*.57,.78,.075,0,1.48,-d/2+.09,0x92aaa9,.04);box(g,w*.63,.06,.09,0,1.88,-d/2+.09,color,.02);
 }else if(kind==='kitchen-island'){
  cabinet(g,w-.14,d-.17,.88,color);box(g,w-.06,.09,d-.06,0,.96,0,0xe6e0d4,.026);box(g,.45,.025,.31,-.42,1.02,0,0x997952,.016);
 }else if(kind==='display-case'){
  cabinet(g,w-.10,d-.10,1.84,color,true);const glass=new THREE.MeshStandardMaterial({color:0xc2d6d3,transparent:true,opacity:.20,roughness:.18,metalness:.1}),pane=mesh(g,new THREE.BoxGeometry(w-.24,1.65,.025),glass,0,.94,d/2-.04);pane.userData.ownedMaterial=true;
 }else if(kind==='sink'){

  cabinet(g,w-.12,d-.12,.83,color);box(g,w-.08,.07,d-.08,0,.90,0,0xd7d7cb,.026);box(g,.50,.02,.46,0,.94,.07,0x819da2,.085);mesh(g,new THREE.TorusGeometry(.13,.02,6,16,Math.PI),material(0xbfc5c5,.3,.65),0,1.05,-.19).rotation.y=Math.PI/2;
 }else if(kind==='fridge'){
  box(g,w-.13,1.74,d-.15,0,.89,0,color,.045);for(const [y,h] of [[.61,1.08],[1.45,.47]]){box(g,w-.17,h,.065,0,y,d/2-.055,0xd9dfdb,.025);box(g,.034,.23,.05,w/2-.21,y,d/2-.005,0x777f7f,.008);}
 }else cabinet(g,w-.10,d-.10,kind==='bookshelf'||kind==='wardrobe'?1.86:kind==='pantry'?1.20:.93,color,kind==='bookshelf');
 if(f.style==='woven')for(let i=0;i<5;i++)box(g,Math.max(.20,w-.30),.018,.012,0,.25+i*.055,d/2-.035,0xc8b18a,.003);
 if(f.style==='carved')for(const side of [-1,1])box(g,.035,.26,.035,side*(w/2-.09),.37,d/2-.05,0xb99a68,.008);
 if(f.style==='metal'||f.style==='brass')for(const side of [-1,1])box(g,.045,.20,Math.max(.18,d-.24),side*(w/2-.13),.14,0,f.style==='brass'?0xbca46f:0x596663,.009);
 if(f.style==='angled')for(const side of [-1,1]){const leg=box(g,.065,.23,.065,side*(w/2-.17),.15,d/2-.16,0x76513c,.012);leg.rotation.z=side*.20;}
 if(f.style==='soft'&&['sofa','loveseat','armchair','chaise'].includes(kind))for(const side of [-1,1]){const cushion=box(g,.26,.25,.13,side*(w/2-.32),.77,-d/2+.29,0xe4d5bc,.055);cushion.rotation.z=side*.15;}
 root.traverse(object=>object.userData.fixtureId=f.id);return root;
}
export function partitionModel(p,color){
 const root=new THREE.Group();root.name=p.id;root.position.set(p.x+(p.axis==='h'?.5:0),0,p.y+(p.axis==='v'?.5:0));root.rotation.y=p.axis==='v'?Math.PI/2:0;
 if(p.door){for(const side of [-1,1])box(root,.12,2.35,.13,side*.44,1.175,0,finishes.walnut,.015);box(root,1,.40,.13,0,2.55,0,color,.012);box(root,.76,.035,.16,0,.02,0,finishes.walnut,.008);}
 else box(root,1,2.75,.12,0,1.375,0,color,.012);
 return root;
}
export function treeModel(){
 const root=new THREE.Group();capsule(root,.12,2.20,0,1.20,0,0x79664c);
 for(const [x,y,z,scale] of [[0,2.80,0,1],[-.38,2.50,.15,.72],[.33,2.40,-.22,.80]])sphere(root,.60,x,y,z,0x668358,scale,scale,scale);
 return root;
}
export function vehicleModel(model='compact'){
 const root=new THREE.Group(),van=model==='van',width=van?1.78:1.64,length=van?4.44:4.05,paint=van?0xd5d9cc:0x5b7a7a;root.name=van?'Delivery van':'Compact car';box(root,width,.45,length,0,.66,0,paint,.14);box(root,width-.13,van?1.12:.57,van?3.15:2.08,0,van?1.34:1.13,-.18,paint,.11);box(root,width-.17,.10,length-.13,0,.46,0,0x394543,.045);box(root,width-.22,.06,.10,0,.74,length/2+.01,0x929e97,.018);
 for(const side of [-1,1]){for(const z of [-length*.30,length*.30]){mesh(root,new THREE.CylinderGeometry(.32,.32,.14,20),material(0x242c2a,.9),side*(width/2-.025),.34,z).rotation.z=Math.PI/2;mesh(root,new THREE.CylinderGeometry(.19,.19,.15,16),material(0xb7beb4,.38,.7),side*(width/2-.02),.34,z).rotation.z=Math.PI/2;}for(const z of van?[.61]:[-.65,.45]){box(root,.018,.38,.83,side*(width-.11)/2,van?1.46:1.18,z,0x46646a,.025);box(root,.025,.035,.16,side*(width+.01)/2,.91,z-.22,0xc0c6ba,.009);}box(root,.31,.14,.045,side*(width/2-.25),.72,length/2+.015,0xf6e7bf,.025);box(root,.28,.17,.045,side*(width/2-.24),.72,-length/2-.015,0xb25f4b,.02);box(root,.13,.08,.21,side*(width/2+.015),1.12,.90,paint,.035);}
 box(root,width-.26,van?.47:.42,.025,0,van?1.47:1.19,van?1.42:.875,0x46646a,.035);box(root,width-.29,.36,.025,0,van?1.50:1.16,van?-1.77:-1.24,0x46646a,.025);box(root,.34,.12,.03,0,.58,length/2+.05,0xeee9d8,.01);return root;
}
export function disposeModels(root){const geometries=new Set(),mats=new Set();root.traverse(o=>{o.userData.disposeAuthored?.();if(o.geometry)geometries.add(o.geometry);if(o.userData.ownedMaterial&&o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);});for(const g of geometries)g.dispose();for(const m of mats)m.dispose();return geometries.size;}

export function disposeMaterialCache(){for(const m of materials.values())m.dispose();materials.clear();}
