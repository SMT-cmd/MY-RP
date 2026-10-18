import * as THREE from 'three';
// A bounded, original water/soap effect. No media downloads or audio autoplay.
export function createActivityEffects(){
 const root=new THREE.Group();root.name='Hand washing water and soap';root.visible=false;
 const water=new THREE.MeshBasicMaterial({color:0x9edbea,transparent:true,opacity:.68,depthWrite:false}),soap=new THREE.MeshBasicMaterial({color:0xf2fcff,transparent:true,opacity:.8,depthWrite:false});
 const stream=new THREE.Mesh(new THREE.CylinderGeometry(.012,.019,.20,6),water);stream.position.y=1.02;root.add(stream);
 const drops=[],geometry=new THREE.SphereGeometry(.015,6,4);
 for(let i=0;i<14;i++){const drop=new THREE.Mesh(geometry,i<8?water:soap);root.add(drop);drops.push(drop);}
 function update(fixture,active,time,reduced=false){
  root.visible=!!fixture&&!!active;if(!root.visible)return;
  const yaw=-(fixture.rotation??0)*Math.PI/180;root.position.set(fixture.x+fixture.w/2,0,fixture.y+fixture.h/2);root.rotation.y=yaw;
  for(let i=0;i<drops.length;i++){const drop=drops[i],phase=reduced?.5:(time/600+i*.23)%1,angle=i*2.4;
   drop.position.set(Math.sin(angle)*(.06+phase*.08),i<8?1.10-phase*.25:.94+Math.sin(phase*Math.PI)*.03,Math.cos(angle)*(.05+phase*.07));drop.scale.setScalar(i<8?1:.6+phase);
  }
 }
 return{root,update,dispose(){stream.geometry.dispose();geometry.dispose();water.dispose();soap.dispose();root.removeFromParent();}};
}
