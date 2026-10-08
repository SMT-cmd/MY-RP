// Walls lie on tile edges. Doorways connect rooms without consuming floor tiles.
export type Partition={id:string;axis:'h'|'v';x:number;y:number;door:boolean;builtBy:string;purchaseKey:string};
export type Layout={width:number;height:number;floor:string;partitions?:Partition[];roomSettings?:Record<string,{name:string;floor:string}>};
export const ROOM_RULES={version:'interior-1.0',labourPerSegment:2500,doorSurcharge:1000,segmentsPerMaterial:3,maxSegments:100};
export const edgeId=(axis:string,x:number,y:number)=>axis+':'+x+':'+y;
export function edgePassable(home:Layout,x:number,y:number,nx:number,ny:number,ignoreDoors=false){
 const id=x!==nx?edgeId('v',Math.max(x,nx),y):edgeId('h',x,Math.max(y,ny));return !(home.partitions??[]).some(p=>p.id===id&&(ignoreDoors||!p.door));
}
export function fixtureAccessible(home:Layout,x:number,y:number,f:{x:number;y:number;w:number;h:number}){
 const nx=Math.max(f.x,Math.min(x,f.x+f.w-1)),ny=Math.max(f.y,Math.min(y,f.y+f.h-1));return Math.abs(x-nx)+Math.abs(y-ny)===1&&edgePassable(home,x,y,nx,ny);
}
export function crossesPartition(f:{x:number;y:number;w:number;h:number},p:Partition){return p.axis==='v'?f.x<p.x&&p.x<f.x+f.w&&f.y<=p.y&&p.y<f.y+f.h:f.y<p.y&&p.y<f.y+f.h&&f.x<=p.x&&p.x<f.x+f.w;}
export function homeRooms(home:Layout){
 const seen=new Set<number>(),rooms=[];
 for(let y=0;y<home.height;y++)for(let x=0;x<home.width;x++){
  const first=y*home.width+x;if(seen.has(first))continue;const tiles=[{x,y}];seen.add(first);
  for(let i=0;i<tiles.length;i++){const t=tiles[i];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=t.x+dx,ny=t.y+dy,k=ny*home.width+nx;if(nx>=0&&ny>=0&&nx<home.width&&ny<home.height&&!seen.has(k)&&edgePassable(home,t.x,t.y,nx,ny,true)){seen.add(k);tiles.push({x:nx,y:ny});}}}
  const id='room_'+first,setting=home.roomSettings?.[id];rooms.push({id,name:setting?.name??'Room '+(rooms.length+1),floor:setting?.floor??home.floor,area:tiles.length,tiles});
 }
 return rooms;
}
