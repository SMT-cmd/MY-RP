import * as THREE from 'three';

// Reused, bounded presentation particles. They never grant needs or rewards.
export function createActivityEffects(){
 const root=new THREE.Group(),water=new THREE.Group(),foam=new THREE.Group(),dirt=new THREE.Group();root.name='Home activity water, soap and care';root.add(water,foam,dirt);
 const waterMaterial=new THREE.MeshStandardMaterial({color:0x9cdef2,transparent:true,opacity:.72,roughness:.16,depthWrite:false}),soapMaterial=new THREE.MeshStandardMaterial({color:0xf4fbff,transparent:true,opacity:.85,roughness:.48,depthWrite:false}),towelMaterial=new THREE.MeshStandardMaterial({color:0xf4e5d0,roughness:.95}),stainMaterial=new THREE.MeshStandardMaterial({color:0x9b8f6e,roughness:1});
 const dropGeometry=new THREE.SphereGeometry(.018,5,4),bubbleGeometry=new THREE.SphereGeometry(.028,6,4),stainGeometry=new THREE.CircleGeometry(.035,7),drops=[],bubbles=[];
 for(let i=0;i<30;i++){const mesh=new THREE.Mesh(dropGeometry,waterMaterial);mesh.scale.set(.65,2.8,.65);water.add(mesh);drops.push(mesh);}
 for(let i=0;i<12;i++){const mesh=new THREE.Mesh(bubbleGeometry,soapMaterial);foam.add(mesh);bubbles.push(mesh);}
 const towel=new THREE.Mesh(new THREE.BoxGeometry(.22,.025,.16),towelMaterial),brush=new THREE.Mesh(new THREE.BoxGeometry(.14,.055,.085),towelMaterial),flush=new THREE.Mesh(new THREE.TorusGeometry(.14,.012,5,16),waterMaterial);flush.rotation.x=Math.PI/2;root.add(towel,brush,flush);
 const left=new THREE.Vector3(),right=new THREE.Vector3(),hands=new THREE.Vector3();
 function clear(){water.visible=foam.visible=towel.visible=brush.visible=flush.visible=false;}
 function handPoint(actor){const handNodes=actor?.hands??actor?.arms?.map(arm=>arm.hand);if(handNodes?.[0]?.getWorldPosition&&handNodes?.[1]?.getWorldPosition){actor.root.updateMatrixWorld(true);handNodes[0].getWorldPosition(left);handNodes[1].getWorldPosition(right);return hands.copy(left).add(right).multiplyScalar(.5);}const p=actor?.root?.position;hands.set(p?.x??0,.95,p?.z??0);if(actor?.root){hands.x+=Math.sin(actor.root.rotation.y)*.42;hands.z+=Math.cos(actor.root.rotation.y)*.42;}return hands;}
 function fixturePoint(f,x,y,z){const angle=-(f.rotation??0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);return{x:f.x+f.w/2+x*c+z*s,y,z:f.y+f.h/2-x*s+z*c};}
 function setFixtures(fixtures=[],care=null){dirt.clear();let total=0;for(const f of fixtures){const amount=care?.fixtures?.find(c=>c.fixtureInstanceId===f.instanceId)?.dirt??0;if(amount<25)continue;const n=Math.min(5,Math.floor(amount/20));for(let i=0;i<n&&total<40;i++,total++){const mark=new THREE.Mesh(stainGeometry,stainMaterial),p=fixturePoint(f,Math.sin(i*2.4)*.19,f.action==='Toilet'?.43:.93,Math.cos(i*1.7)*.16);mark.rotation.x=-Math.PI/2;mark.position.set(p.x,p.y+.003,p.z);mark.scale.setScalar(.65+(i%3)*.3);dirt.add(mark);}}}
 function update({activity,fixture:f,timeline:t,actor,time=0,reduced=false,quality='medium'}={}){
  clear();if(!activity||!f||!t)return;
  const shower=activity.kind==='Shower',hand=handPoint(actor),tap=fixturePoint(f,0,shower?2.03:1.09,shower?-.26:-.18),count=reduced?0:quality==='low'?10:30;
  water.visible=!!t.water&&count>0;for(let i=0;i<drops.length;i++){const d=drops[i];d.visible=i<count;if(!d.visible)continue;const p=((time*.0014+i*.137)%1+1)%1,spread=shower?.26:.025;d.position.set(tap.x+Math.sin(i*3.1)*spread,tap.y-p*(shower?1.65:.20),tap.z+Math.cos(i*1.8)*spread);}
  foam.visible=!!t.foam;for(let i=0;i<bubbles.length;i++){const b=bubbles[i];b.visible=!reduced||i<4;const phase=reduced?0:time*.002;b.position.set(hand.x+Math.sin(i*2.4+phase)*.085,hand.y+Math.cos(i*1.7+phase)*.045,hand.z+Math.cos(i*2.2+phase)*.065);b.scale.setScalar(.6+(i%3)*.2);}
  towel.visible=!!t.towel;if(towel.visible){towel.position.copy(hand);towel.rotation.set(.15,actor?.root?.rotation.y??0,reduced?0:Math.sin(time*.009)*.13);}
  brush.visible=!!t.scrub;if(brush.visible){brush.position.copy(hand);brush.position.y-=.025;brush.rotation.y=actor?.root?.rotation.y??0;}
  flush.visible=!!t.flush;if(flush.visible){const p=fixturePoint(f,0,.43,.09);flush.position.set(p.x,p.y,p.z);flush.rotation.z=reduced?0:time*.004;}
 }
 clear();return{root,update,setFixtures,clear,dispose(){root.clear();for(const g of [dropGeometry,bubbleGeometry,stainGeometry,towel.geometry,brush.geometry,flush.geometry])g.dispose();for(const m of [waterMaterial,soapMaterial,towelMaterial,stainMaterial])m.dispose();}};
}
