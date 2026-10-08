// Plan adjacent steps only. The server authorises each move and interaction.
(()=>{
 function search(world,goal){
  const room=world.home??world.map,start=world.home??world.position,obstacles=world.home?world.home.fixtures:[...world.map.buildings,...(world.map.obstacles??[]),...(world.map.streetObjects??[])];
  const walkable=(x,y)=>x>=0&&y>=0&&x<room.width&&y<room.height&&!obstacles.some(f=>x>=f.x&&x<f.x+f.w&&y>=f.y&&y<f.y+f.h);
  const openEdge=(x,y,nx,ny)=>!world.home||(world.home.partitions??[]).every(p=>p.door||p.id!==(x!==nx?'v:'+Math.max(x,nx)+':'+y:'h:'+x+':'+Math.max(y,ny)));
  const queue=[{x:start.x,y:start.y,parent:-1}],seen=new Set([start.x+':'+start.y]);
  for(let i=0;i<queue.length;i++){
   const node=queue[i];if(goal(node.x,node.y)){const steps=[];let current=i;while(queue[current].parent>=0){const child=queue[current],parent=queue[child.parent];steps.push({dx:child.x-parent.x,dy:child.y-parent.y});current=child.parent;}return steps.reverse();}
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=node.x+dx,y=node.y+dy,k=x+':'+y;if(!seen.has(k)&&walkable(x,y)&&openEdge(node.x,node.y,x,y)){seen.add(k);queue.push({x,y,parent:i});}}
  }return null;
 }
 function path(world,x,y){const room=world.home??world.map;if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=room.width||y>=room.height)return null;return search(world,(tx,ty)=>tx===x&&ty===y);}
 function approach(world,object){if(object.door)return search(world,(x,y)=>Math.abs(x-object.door.x)+Math.abs(y-object.door.y)<=1);return search(world,(x,y)=>{const nx=Math.max(object.x,Math.min(x,object.x+object.w-1)),ny=Math.max(object.y,Math.min(y,object.y+object.h-1));return Math.abs(x-nx)+Math.abs(y-ny)===1&&(!world.home||(world.home.partitions??[]).every(p=>p.door||p.id!==(x!==nx?'v:'+Math.max(x,nx)+':'+y:'h:'+x+':'+Math.max(y,ny))));});}
 window.Walking={path,approach};
})();
