// Presentation of the server's validated timed path; never sends coordinates.
export function sampleNavigation(plan,serverNow){
 if(!plan||!Array.isArray(plan.points)||plan.points.length<1||!Number.isFinite(plan.stepMs)||plan.stepMs<=0)return null;
 const progress=Math.max(0,(serverNow-plan.startedAt)/plan.stepMs),index=Math.min(plan.points.length-1,Math.floor(progress)),a=plan.points[index],b=plan.points[Math.min(index+1,plan.points.length-1)],t=Math.min(1,progress-index),dx=b.x-a.x,dy=b.y-a.y,previous=plan.points[Math.max(0,index-1)];
 const facing=dx>0?'right':dx<0?'left':dy>0?'front':dy<0?'back':a.x>previous.x?'right':a.x<previous.x?'left':a.y>previous.y?'front':'back';
 return{x:a.x+dx*t,y:a.y+dy*t,facing,moving:index<plan.points.length-1,done:index===plan.points.length-1,mode:plan.mode};
}
