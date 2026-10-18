// Plan adjacent steps only. The server authorises each move and interaction.
(()=>{
 function search(world,goal){
  const interior=world.home??world.venue,room=interior??world.map,start=interior??world.position,obstacles=interior?interior.fixtures:[...world.map.buildings,...(world.map.obstacles??[]),...(world.map.streetObjects??[])];
  const walkable=(x,y)=>x>=0&&y>=0&&x<room.width&&y<room.height&&!obstacles.some(f=>x>=f.x&&x<f.x+f.w&&y>=f.y&&y<f.y+f.h);
  const openEdge=(x,y,nx,ny)=>!interior||(interior.partitions??[]).every(p=>p.door||p.id!==(x!==nx?'v:'+Math.max(x,nx)+':'+y:'h:'+x+':'+Math.max(y,ny)));
  const queue=[{x:start.x,y:start.y,parent:-1}],seen=new Set([start.x+':'+start.y]);
  for(let i=0;i<queue.length;i++){
   const node=queue[i];if(goal(node.x,node.y)){const steps=[];let current=i;while(queue[current].parent>=0){const child=queue[current],parent=queue[child.parent];steps.push({dx:child.x-parent.x,dy:child.y-parent.y});current=child.parent;}return steps.reverse();}
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=node.x+dx,y=node.y+dy,k=x+':'+y;if(!seen.has(k)&&walkable(x,y)&&openEdge(node.x,node.y,x,y)){seen.add(k);queue.push({x,y,parent:i});}}
  }return null;
 }
 function path(world,x,y){const room=world.home??world.venue??world.map;if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=room.width||y>=room.height)return null;return search(world,(tx,ty)=>tx===x&&ty===y);}
 function approachCells(f){
  const r=((f.rotation??0)%360+360)%360,cells=[];
  if(f.action==='Rest'){if(r%180===0){for(let y=f.y;y<f.y+f.h;y++)cells.push({x:f.x-1,y},{x:f.x+f.w,y});}else for(let x=f.x;x<f.x+f.w;x++)cells.push({x,y:f.y-1},{x,y:f.y+f.h});return cells;}
  if(!['Sit','Read','Wash','Dress','Toilet','Shower','Clean'].includes(f.action))return null;
  if(r===90||r===270)for(let y=f.y;y<f.y+f.h;y++)cells.push({x:r===90?f.x-1:f.x+f.w,y});else for(let x=f.x;x<f.x+f.w;x++)cells.push({x,y:r===180?f.y-1:f.y+f.h});return cells;
 }
 function approach(world,object){if(object.door)return search(world,(x,y)=>Math.abs(x-object.door.x)+Math.abs(y-object.door.y)<=1);const interior=world.home??world.venue,contacts=interior?approachCells(object):null;const reachable=(x,y,requireFront)=>{const nx=Math.max(object.x,Math.min(x,object.x+object.w-1)),ny=Math.max(object.y,Math.min(y,object.y+object.h-1));return(!requireFront||!contacts||contacts.some(c=>c.x===x&&c.y===y))&&Math.abs(x-nx)+Math.abs(y-ny)===1&&(!interior||(interior.partitions??[]).every(p=>p.door||p.id!==(x!==nx?'v:'+Math.max(x,nx)+':'+y:'h:'+x+':'+Math.max(y,ny))));};const front=search(world,(x,y)=>reachable(x,y,true));return front??(['Wash','Clean','Read','Dress'].includes(object.action)?search(world,(x,y)=>reachable(x,y,false)):null);}
 window.Walking={path,approach,approachCells};
})();
