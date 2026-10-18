// Presentation only. Camera-relative input still produces one server-validated tile.
export const CAMERA_VIEWS=['third-person','close','aerial'];
export function cameraStep(dx,dy,yaw){
 const x=dx*Math.cos(yaw)+dy*Math.sin(yaw),y=-dx*Math.sin(yaw)+dy*Math.cos(yaw);
 return Math.abs(x)>Math.abs(y)?{dx:Math.sign(x),dy:0}:{dx:0,dy:Math.sign(y)};
}
export function cameraPosition(target,yaw,pitch,distance){
 const horizontal=Math.cos(pitch)*distance;
 return{x:target.x+Math.sin(yaw)*horizontal,y:target.y+Math.sin(pitch)*distance,z:target.z+Math.cos(yaw)*horizontal};
}
// Sweep the camera through expanded world-space bounds to protect its near plane.
export function clipCamera(target,desired,obstacles,padding=.22){
 const delta={x:desired.x-target.x,y:desired.y-target.y,z:desired.z-target.z};let nearest=1;
 for(const box of obstacles){
  const inside=['x','y','z'].every(k=>target[k]>box.min[k]-padding&&target[k]<box.max[k]+padding);
  if(inside)continue; // The occupied seat must not imprison the camera.
  let enter=0,leave=1;
  for(const k of ['x','y','z']){
   const min=box.min[k]-padding,max=box.max[k]+padding,d=delta[k];
   if(Math.abs(d)<1e-9){if(target[k]<min||target[k]>max){enter=2;break;}continue;}
   const a=(min-target[k])/d,b=(max-target[k])/d;enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));
  }
  if(enter<=leave&&enter>=0&&enter<nearest)nearest=Math.max(0,enter-.015);
 }
 return{x:target.x+delta.x*nearest,y:target.y+delta.y*nearest,z:target.z+delta.z*nearest};
}
