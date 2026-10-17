import * as THREE from 'three';

const clamp=THREE.MathUtils.clamp;
export const CAMERA_MODES=Object.freeze(['third-person','close','overview']);
const profiles={
 'third-person':{distance:5.4,pitch:.30,height:1.14,fov:58,min:2.5,max:11},
 close:{distance:2.2,pitch:.12,height:1.48,fov:62,min:.85,max:4.8},
 overview:{distance:28,pitch:1.04,height:.25,fov:48,min:9,max:64}
};

// Collision here is presentational; it never changes player coordinates.
export function avoidCameraSolids(focus,wanted,solids=[],radius=.18){
 const direction=new THREE.Vector3().subVectors(wanted,focus),distance=direction.length();
 if(distance<.001)return wanted.clone();
 direction.divideScalar(distance);const ray=new THREE.Ray(focus,direction),expanded=new THREE.Box3(),point=new THREE.Vector3();let allowed=distance;
 for(const solid of solids){
  if(!solid||solid.isEmpty())continue;
  expanded.copy(solid).expandByScalar(radius);
  if(expanded.containsPoint(focus))continue;
  if(ray.intersectBox(expanded,point))allowed=Math.min(allowed,Math.max(.12,point.distanceTo(focus)-.08));
 }
 return focus.clone().addScaledVector(direction,allowed);
}

export function cameraRelativeStep(direction,yaw){
 if(!['forward','up','back','down','right','left'].includes(direction)||!Number.isFinite(yaw))return null;
 const forward=direction==='forward'||direction==='up',back=direction==='back'||direction==='down';
 const x=forward?-Math.sin(yaw):back?Math.sin(yaw):direction==='right'?Math.cos(yaw):-Math.cos(yaw);
 const z=forward?-Math.cos(yaw):back?Math.cos(yaw):direction==='right'?-Math.sin(yaw):Math.sin(yaw);
 return Math.abs(x)>Math.abs(z)?{x:Math.sign(x),y:0}:{x:0,y:Math.sign(z)};
}

export function groundPick(camera,clientX,clientY,rect,bounds,maxDistance=110){
 if(!rect.width||!rect.height||!Number.isFinite(clientX)||!Number.isFinite(clientY))return null;
 const uv=new THREE.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);
 const raycaster=new THREE.Raycaster();camera.updateMatrixWorld();raycaster.setFromCamera(uv,camera);
 const hit=raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());
 if(!hit||hit.distanceTo(camera.position)>maxDistance)return null;
 if(bounds&&(hit.x<0||hit.z<0||hit.x>=bounds.width||hit.z>=bounds.height))return null;
 return hit;
}

export function createCameraRig({aspect=1,onChange=()=>{}}={}){
 const perspective=new THREE.PerspectiveCamera(58,aspect,.055,110);
 const overview=new THREE.OrthographicCamera(-10*aspect,10*aspect,10,-10,.055,160);
 let mode='third-person',yaw=Math.PI,pitch=profiles[mode].pitch,distance=profiles[mode].distance,initialized=false,following=true;
 const focus=new THREE.Vector3(),desiredFocus=new THREE.Vector3(),pan=new THREE.Vector3(),wanted=new THREE.Vector3();
 let width=960,height=600;
 const change=()=>onChange({mode,available:true,yaw,pitch,following});
 const camera=()=>mode==='overview'?overview:perspective;
 function resize(w,h){width=Math.max(1,w);height=Math.max(1,h);aspect=width/height;perspective.aspect=aspect;perspective.updateProjectionMatrix();overview.left=-10*aspect;overview.right=10*aspect;overview.top=10;overview.bottom=-10;overview.updateProjectionMatrix();}
 function setMode(value){if(!CAMERA_MODES.includes(value))return false;if(value===mode)return true;mode=value;distance=profiles[mode].distance;pitch=profiles[mode].pitch;pan.set(0,0,0);following=true;perspective.fov=profiles[mode].fov;perspective.updateProjectionMatrix();change();return true;}
 function orbit(deltaYaw,deltaPitch=0){yaw+=clamp(deltaYaw,-1.8,1.8);pitch=clamp(pitch+clamp(deltaPitch,-.8,.8),mode==='overview'?.70:-.12,mode==='overview'?1.48:.93);change();}
 function zoom(delta){const p=profiles[mode];distance=clamp(distance*Math.exp(delta),p.min,p.max);change();}
 function movePan(dx,dy){const scale=mode==='overview'?20*(distance/28)/height:2*distance*Math.tan(THREE.MathUtils.degToRad(perspective.fov)/2)/height;pan.x-=Math.cos(yaw)*dx*scale+Math.sin(yaw)*dy*scale;pan.z+=Math.sin(yaw)*dx*scale-Math.cos(yaw)*dy*scale;following=false;change();}
 function center(){following=true;pan.set(0,0,0);change();}
 function update({position,dt=1/60,solids=[],teleport=false,reducedMotion=false,bounds=null,home=false}={}){
  if(!position)return camera();const p=profiles[mode];desiredFocus.set(position.x,p.height,position.z).add(pan);
  if(bounds&&!following){desiredFocus.x=clamp(desiredFocus.x,0,bounds.width);desiredFocus.z=clamp(desiredFocus.z,0,bounds.height);}
  if(!initialized||teleport||reducedMotion){focus.copy(desiredFocus);initialized=true;}else focus.lerp(desiredFocus,1-Math.exp(-Math.max(0,dt)*14));
  const horizontal=distance*Math.cos(pitch);wanted.set(focus.x+Math.sin(yaw)*horizontal,focus.y+Math.sin(pitch)*distance,focus.z+Math.cos(yaw)*horizontal);
  const active=camera();active.position.copy(mode==='overview'?wanted:avoidCameraSolids(focus,wanted,solids));active.position.y=Math.max(.25,active.position.y);active.lookAt(focus);
  if(mode==='overview'){overview.zoom=28/distance;overview.updateProjectionMatrix();}
  const far=home?55:110;if(perspective.far!==far){perspective.far=far;perspective.updateProjectionMatrix();}active.updateMatrixWorld();return active;
 }
 resize(width,height);
 return{get camera(){return camera();},get mode(){return mode;},get yaw(){return yaw;},get pitch(){return pitch;},get following(){return following;},get focus(){return focus;},get distance(){return distance;},resize,setMode,orbit,zoom,pan:movePan,center,update,announce:change};
}
