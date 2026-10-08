import {createHash} from 'node:crypto';
import {DomainError,post} from './domain.ts';
import type {State,Command} from './domain.ts';
import {STARTER_HOME} from './interiors.ts';
import {consumeSupply} from './commerce.ts';
import {ROOM_RULES,edgeId,edgePassable,fixtureAccessible,crossesPartition,homeRooms} from './home-layout.ts';
import type {Partition} from './home-layout.ts';
import {DAY} from './rules.ts';
import {BUILDINGS,RESIDENTIAL_PLOTS} from './neighbourhood.ts';
import type {HomeVisit} from './home-visits.ts';

export const FURNITURE=[
 {id:'bed',name:'Upholstered double bed',category:'bedroom',w:2,h:2,price:85000,action:'Rest'},
 {id:'pantry',name:'Kitchen cabinet',category:'kitchen',w:1,h:1,price:32000,action:'RequestFoodAssistance'},
 {id:'sofa',name:'Three-seat sofa',category:'living',w:3,h:1,price:60000,action:'Sit'},
 {id:'desk',name:'Oak writing desk',category:'study',w:2,h:1,price:35000,action:'Read'},
 {id:'sink',name:'Kitchen sink unit',category:'kitchen',w:1,h:1,price:28000,action:'Wash'},
 {id:'wardrobe',name:'Double wardrobe',category:'bedroom',w:1,h:2,price:48000,action:'Dress'},
 {id:'armchair',name:'Lounge armchair',category:'living',w:1,h:1,price:25000,action:'Sit'},
 {id:'dining-table',name:'Four-person dining table',category:'dining',w:2,h:2,price:42000,action:'inspect'},
 {id:'dining-chair',name:'Dining chair',category:'dining',w:1,h:1,price:9500,action:'Sit'},
 {id:'bookshelf',name:'Tall bookcase',category:'study',w:1,h:2,price:30000,action:'Read'},
 {id:'sideboard',name:'Living-room sideboard',category:'living',w:2,h:1,price:33000,action:'inspect'},
 {id:'plant',name:'Indoor palm planter',category:'decor',w:1,h:1,price:7000,action:'inspect'},
 {id:'coffee-table',name:'Low coffee table',category:'living',w:2,h:1,price:19000,action:'inspect'},
 {id:'fridge',name:'Kitchen refrigerator',category:'kitchen',w:1,h:1,price:68000,action:'inspect'}
];
export const FINISHES=['walnut','oak','cream','slate','sage','terracotta','navy'];
type Placement={x:number;y:number;rotation:number};
export type FurnitureItem={id:string;owner:string;model:string;finish:string;homeId:string|null;placement:Placement|null;starter:boolean;alias?:string;purchaseKey?:string;version:number};
export type Home={id:string;region:string;width:number;height:number;version:number;wall:string;floor:string;parkingSpaces:number;partitions?:Partition[];roomSettings?:Record<string,{name:string;floor:string}>};
type Parking={id:string;vehicleId:string;homeId:string;actor:string;slot:number;status:'parked'|'released';version:number};
export type FurnishingState={homes:Record<string,Home>;items:Record<string,FurnitureItem>;npcStock:Record<string,number>;parking:Record<string,Parking>;visits?:Record<string,HomeVisit>};
const get=(s:State)=>s.furnishing??={homes:{},items:{},npcStock:{},parking:{}};
const hash=(s:string)=>createHash('sha256').update(s).digest('hex').slice(0,24);
export function homeIdentity(s:State,actor:string,region=s.world?.positions[actor]?.region){
 const c=s.citizens[actor],pos=s.world?.positions[actor];if(!c||!pos)throw new DomainError('CITIZEN_REQUIRED','Create a citizen first.');
 const asset=s.property?.assets[c.housing],tenancy=Object.values(s.property?.tenancies??{}).find(t=>t.property===c.housing&&t.status!=='ended');
 if(asset?.kind==='home'&&asset.status==='ready'&&asset.region===region&&(tenancy?tenancy.tenant===actor:asset.owner===actor))return{id:asset.id,region:asset.region,privateHome:true};
 return{id:'starter_'+hash(actor+':'+region),region:region!,privateHome:false};
}
export function homeFor(s:State,actor:string){
 const identity=homeIdentity(s,actor),m=get(s);let home=m.homes[identity.id];const created=!home;
 if(!home){home=m.homes[identity.id]={id:identity.id,region:identity.region,width:identity.privateHome?14:10,height:identity.privateHome?12:8,version:1,wall:'cream',floor:'oak',parkingSpaces:identity.privateHome?2:1};
 }
 if(!Object.values(m.items).some(item=>item.homeId===home.id)){
  if(!created)home.version++;
  for(const f of STARTER_HOME.fixtures){const id='furniture_'+hash(home.id+':'+actor+':'+f.id),existing=m.items[id];if(existing){existing.homeId=home.id;existing.placement={x:f.x,y:f.y,rotation:0};existing.version++;}else m.items[id]={id,owner:actor,model:f.id,finish:['bed','sofa'].includes(f.id)?'sage':'oak',homeId:home.id,placement:{x:f.x,y:f.y,rotation:0},starter:true,alias:f.id,version:1};
   if(home.partitions?.length){const item=m.items[id];let placed=false;const candidates=[{x:f.x,y:f.y,rotation:0}];for(let y=0;y<home.height;y++)for(let x=0;x<home.width;x++)for(const rotation of [0,90])candidates.push({x,y,rotation});
    for(const candidate of candidates){item.placement=candidate;try{validateLayout(s,home);placed=true;break;}catch(error){if(!(error instanceof DomainError))throw error;}}
    if(!placed){item.homeId=null;item.placement=null;if(['bed','pantry'].includes(item.model))throw new DomainError('HOME_LAYOUT','The home must provide room for the protected bed and pantry.');}
   }}
 }

 return home;
}
export function residenceEntrance(s:State,actor:string){
 return entranceForHome(s,homeFor(s,actor),actor);
}
export function entranceForHome(s:State,home:Home,actor:string){
 const asset=s.property?.assets[home.id];
 if(!asset){const shelter=BUILDINGS.find(b=>b.id==='shelter')!;return{...shelter,homeId:home.id,address:'Starter shelter',facadeId:null,parking:{x:0,y:6}};}
 const plot=RESIDENTIAL_PLOTS.find(p=>asset.id==='npc-'+home.region+'-'+p.catalogueKind);
 if(!plot)throw new DomainError('HOME_ADDRESS_UNAVAILABLE','This residence needs an authored street address before entry.');
 return{...plot,id:'residence:'+home.id,homeId:home.id,name:asset.owner===actor?'Your home':'Your rented home',parking:{x:plot.x+plot.w,y:plot.y+plot.h-1}};
}
export function releaseResidence(s:State,homeId:string,actor:string){
 const m=s.furnishing;if(!m)return;for(const item of Object.values(m.items))if(item.homeId===homeId&&item.owner===actor){item.homeId=null;item.placement=null;item.version++;}
 for(const record of Object.values(m.parking))if(record.homeId===homeId&&record.actor===actor&&record.status==='parked'){record.status='released';record.version++;}
 if(m.homes[homeId])m.homes[homeId].version++;
 const pos=s.world?.positions[actor];if(pos?.homeId===homeId&&!s.world?.activeTrips[actor]){pos.interior=null;delete pos.homeId;delete pos.interiorX;delete pos.interiorY;delete pos.activity;pos.leaseVersion++;}
}
export function changeResidence(s:State,actor:string,housing:string){
 const citizen=s.citizens[actor];if(!citizen)throw new DomainError('CITIZEN_REQUIRED','Create a citizen first.');
 if(citizen.housing===housing)return;
 if(s.world?.positions[actor])releaseResidence(s,homeIdentity(s,actor).id,actor);
 citizen.housing=housing;
}
export function homeFixtures(s:State,home:Home){return Object.values(get(s).items).filter(i=>i.homeId===home.id&&i.placement).map(i=>{const model=FURNITURE.find(f=>f.id===i.model)!,p=i.placement!,rotated=p.rotation%180!==0;return{id:i.alias??i.id,instanceId:i.id,name:model.name,model:model.id,finish:i.finish,rotation:p.rotation,x:p.x,y:p.y,w:rotated?model.h:model.w,h:rotated?model.w:model.h,action:model.action,copy:model.name};});}
export function usableHome(s:State,actor:string){const home=homeFor(s,actor),pos=s.world!.positions[actor];if(pos.interior!=='shelter'||pos.homeId&&pos.homeId!==home.id)throw new DomainError('HOME_REQUIRED','Enter your current local home first.');return home;}
export function homeWalkable(s:State,home:Home,x:number,y:number){return Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<home.width&&y<home.height&&!homeFixtures(s,home).some(f=>x>=f.x&&x<f.x+f.w&&y>=f.y&&y<f.y+f.h);}
export function homeStep(s:State,home:Home,x:number,y:number,nx:number,ny:number){return Math.abs(x-nx)+Math.abs(y-ny)===1&&homeWalkable(s,home,nx,ny)&&edgePassable(home,x,y,nx,ny);}
function clearHomeActivities(s:State,home:Home){for(const p of Object.values(s.world?.positions??{}))if(p.homeId===home.id)delete p.activity;}
function validateLayout(s:State,home:Home){
 const fixtures=homeFixtures(s,home),occupied=new Set<string>(),edges=new Set<string>();
 if(home.partitions!==undefined&&!Array.isArray(home.partitions)||home.partitions&&home.partitions.length>ROOM_RULES.maxSegments)throw new DomainError('INVALID_PARTITION','The partition catalogue is invalid.');
 for(const p of home.partitions??[]){
  if(!['h','v'].includes(p.axis)||!Number.isInteger(p.x)||!Number.isInteger(p.y)||typeof p.door!=='boolean'||p.id!==edgeId(p.axis,p.x,p.y)||edges.has(p.id)||(p.axis==='v'?(p.x<1||p.x>=home.width||p.y<0||p.y>=home.height):(p.y<1||p.y>=home.height||p.x<0||p.x>=home.width)))throw new DomainError('INVALID_PARTITION','Place each wall on a unique interior tile edge.');edges.add(p.id);
  if(p.door&&(p.axis==='v'?(!homeWalkable(s,home,p.x-1,p.y)||!homeWalkable(s,home,p.x,p.y)):(!homeWalkable(s,home,p.x,p.y-1)||!homeWalkable(s,home,p.x,p.y))))throw new DomainError('DOOR_BLOCKED','Keep both sides of every doorway clear.');
  if(fixtures.some(f=>crossesPartition(f,p)))throw new DomainError('WALL_FURNITURE','Move furniture out of the proposed wall line first.');
 }
 for(const [id,setting] of Object.entries(home.roomSettings??{}))if(!homeRooms(home).some(r=>r.id===id)||typeof setting.name!=='string'||!setting.name.trim()||setting.name.length>40||/[\u0000-\u001f]/.test(setting.name)||!FINISHES.includes(setting.floor))throw new DomainError('INVALID_ROOM','Choose an existing room and valid name/finish.');
 for(const f of fixtures)for(let x=f.x;x<f.x+f.w;x++)for(let y=f.y;y<f.y+f.h;y++){const tile=x+':'+y;if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=home.width||y>=home.height||occupied.has(tile)||x===4&&(y===6||y===7))throw new DomainError('FURNITURE_COLLISION','Keep furnishings inside the room and clear of other objects, the arrival tile and exit.');occupied.add(tile);}
 for(const pos of Object.values(s.world?.positions??{}))if(pos.interior==='shelter'&&pos.homeId===home.id&&!homeWalkable(s,home,pos.interiorX??4,pos.interiorY??6))throw new DomainError('FURNITURE_OCCUPIED','A citizen is standing in that space.');
 const seen=new Set(['4:6']),queue=[[4,6]];for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const tile=(x+dx)+':'+(y+dy);if(!seen.has(tile)&&homeStep(s,home,x,y,x+dx,y+dy)){seen.add(tile);queue.push([x+dx,y+dy]);}}}
 if(seen.size!==home.width*home.height-occupied.size||!seen.has('4:7')||fixtures.some(f=>![...seen].some(tile=>{const [x,y]=tile.split(':').map(Number);return fixtureAccessible(home,x,y,f);})))throw new DomainError('FURNITURE_PATH','Keep a reachable path to the exit and every furnishing.');
}
export function furnishingCommand(s:State,actor:string,c:Command,now:number,key:string):Record<string,unknown>|undefined{
 if(!['BuyFurniture','PlaceFurniture','StoreFurniture','CustomiseHome','BuildHomePartition','RemoveHomePartition','CustomiseRoom','ParkVehicle','UnparkVehicle'].includes(c.type))return;
 const home=homeFor(s,actor),m=get(s),p=c.payload,pos=s.world!.positions[actor];
 if(s.world!.activeTrips[actor])throw new DomainError('IN_TRANSIT','Finish your journey first.');
 if(c.type==='BuyFurniture'){
  const model=FURNITURE.find(f=>f.id===p.modelId);if(!model||p.acceptedPrice!==model.price||p.acceptTerms!==true||!FINISHES.includes(String(p.finish)))throw new DomainError('FURNITURE_TERMS','Review the exact catalogue price and finish.');
  if(Object.values(m.items).filter(i=>i.owner===actor&&!i.starter).length>=100)throw new DomainError('FURNITURE_CAPACITY','Your furniture storage is full.');
  const stockKey=pos.region+':'+Math.floor(now/DAY)+':'+model.id;if((m.npcStock[stockKey]??0)>=20)throw new DomainError('FURNITURE_STOCK','This local model is sold out for today.');
  const id='furniture_'+hash(key);post(s,key,now,'Furniture catalogue purchase',[{account:'citizen:'+actor,amount:-model.price},{account:'system:furniture-provider',amount:model.price}]);
  m.items[id]={id,owner:actor,model:model.id,finish:String(p.finish),homeId:null,placement:null,starter:false,purchaseKey:key,version:1};m.npcStock[stockKey]=(m.npcStock[stockKey]??0)+1;return{furnitureId:id,amount:model.price,message:'Furniture purchased once and placed in your personal storage.'};
 }
 if(c.type==='PlaceFurniture'||c.type==='StoreFurniture'){
  usableHome(s,actor);if(p.homeVersion!==home.version)throw new DomainError('HOME_CHANGED','Refresh the current layout before editing.');
  const item=m.items[String(p.furnitureId)];if(!item||item.owner!==actor||item.homeId&&item.homeId!==home.id)throw new DomainError('FURNITURE_PERMISSION','You may arrange only your own furniture in this home.',403);
  if(item.starter&&c.type==='StoreFurniture'&&['bed','pantry'].includes(item.model))throw new DomainError('ESSENTIAL_FURNITURE','Keep the starter bed and pantry available.');
  if(c.type==='StoreFurniture'){item.homeId=null;item.placement=null;}else{
   if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||!Number.isInteger(p.rotation)||![0,90,180,270].includes(Number(p.rotation))||!FINISHES.includes(String(p.finish)))throw new DomainError('FURNITURE_PLACEMENT','Choose an exact room tile, quarter turn and catalogue finish.');
   item.homeId=home.id;item.placement={x:Number(p.x),y:Number(p.y),rotation:Number(p.rotation)};item.finish=String(p.finish);
  }
  validateLayout(s,home);item.version++;home.version++;clearHomeActivities(s,home);return{furnitureId:item.id,homeVersion:home.version,message:'Home layout saved. Your furniture stays yours.'};
 }
 if(['BuildHomePartition','RemoveHomePartition','CustomiseRoom'].includes(c.type)){
  usableHome(s,actor);if(p.homeVersion!==home.version)throw new DomainError('HOME_CHANGED','Refresh the current layout before editing.');
  if(c.type==='CustomiseRoom'){
   const room=homeRooms(home).find(r=>r.id===p.roomId),name=typeof p.name==='string'?p.name.trim():'';
   if(!room||!name||name.length>40||/[\u0000-\u001f]/.test(name)||!FINISHES.includes(String(p.floor)))throw new DomainError('INVALID_ROOM','Choose an existing room, name and catalogue finish.');
   home.roomSettings??={};home.roomSettings[room.id]={name,floor:String(p.floor)};home.version++;return{homeVersion:home.version,roomId:room.id,message:'Room name and floor finish saved.'};
  }
  const asset=s.property?.assets[home.id];if(asset&&asset.owner!==actor)throw new DomainError('CONSTRUCTION_PERMISSION','Structural alterations require the current home owner. Tenant furnishings and finishes remain yours to arrange.',403);
  if(c.type==='RemoveHomePartition'){
   const ids=p.partitionIds;if(!Array.isArray(ids)||!ids.length||ids.length>20||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length||ids.some(id=>!home.partitions?.some(e=>e.id===id)))throw new DomainError('INVALID_PARTITION','Choose existing wall segments.');
   if(p.acceptDiscard!==true)throw new DomainError('PARTITION_TERMS','Confirm removal without a material or labour refund.');home.partitions=home.partitions!.filter(e=>!ids.includes(e.id));
   const rooms=homeRooms(home);home.roomSettings=Object.fromEntries(Object.entries(home.roomSettings??{}).filter(([id])=>rooms.some(r=>r.id===id)));validateLayout(s,home);home.version++;clearHomeActivities(s,home);return{homeVersion:home.version,message:'Selected partitions removed. Spent construction inputs are not refunded.'};
  }
  const {axis,x,y,length,doorAt}=p;
  if(!['h','v'].includes(String(axis))||!Number.isInteger(x)||!Number.isInteger(y)||!Number.isInteger(length)||Number(length)<1||Number(length)>20||doorAt!==null&&(!Number.isInteger(doorAt)||Number(doorAt)<0||Number(doorAt)>=Number(length)))throw new DomainError('INVALID_PARTITION','Use an interior wall line and an optional doorway offset.');
  const labour=Number(length)*ROOM_RULES.labourPerSegment+(doorAt===null?0:ROOM_RULES.doorSurcharge),materials=Math.ceil(Number(length)/ROOM_RULES.segmentsPerMaterial);
  if(p.acceptedLabour!==labour||p.acceptedMaterials!==materials||p.acceptTerms!==true)throw new DomainError('PARTITION_TERMS','Review the exact labour cost, material quantity and no-refund construction terms.');
  const partitions:Partition[]=Array.from({length:Number(length)},(_,i)=>{const px=Number(x)+(axis==='h'?i:0),py=Number(y)+(axis==='v'?i:0);return{id:edgeId(String(axis),px,py),axis:axis as 'h'|'v',x:px,y:py,door:i===doorAt,builtBy:actor,purchaseKey:key};});
  home.partitions=[...(home.partitions??[]),...partitions];validateLayout(s,home);
  consumeSupply(s,'citizen:'+actor,home.region,'materials',materials,now,key+':partitions','system:interior-construction','Verified interior partitions');
  post(s,key,now,'Interior partition construction',[{account:'citizen:'+actor,amount:-labour},{account:'system:construction-provider',amount:labour}]);home.version++;clearHomeActivities(s,home);
  return{homeId:home.id,homeVersion:home.version,partitions,labour,materials,message:'Walls and doorway built with recorded materials. Every room remains reachable.'};
 }
 if(c.type==='CustomiseHome'){
  usableHome(s,actor);if(p.homeVersion!==home.version||!FINISHES.includes(String(p.wall))||!FINISHES.includes(String(p.floor)))throw new DomainError('HOME_CHANGED','Review the current room and available finishes.');home.wall=String(p.wall);home.floor=String(p.floor);home.version++;return{homeVersion:home.version,message:'Wall and floor finishes saved.'};
 }
 const vehicle=s.mobility?.vehicles[String(p.vehicleId)];if(!vehicle||vehicle.owner!==actor)throw new DomainError('VEHICLE_PERMISSION','Park only a vehicle you own.',403);
 const existing=Object.values(m.parking).find(r=>r.vehicleId===vehicle.id&&r.status==='parked');
 const entrance=residenceEntrance(s,actor);
 if(pos.interior||Math.abs(pos.x-entrance.door.x)+Math.abs(pos.y-entrance.door.y)>1)throw new DomainError('PARKING_DISTANCE','Walk to your home entrance before parking or retrieving a vehicle.');
 if(c.type==='UnparkVehicle'){if(!existing||existing.actor!==actor||vehicle.region!==pos.region)throw new DomainError('PARKING_PERMISSION','Return to your parked vehicle first.');existing.status='released';existing.version++;vehicle.version++;return{vehicleId:vehicle.id,message:'Vehicle retrieved from its parking space.'};}
 if(pos.interior||vehicle.region!==pos.region||vehicle.status!=='parked'||Object.values(s.mobility?.repairs??{}).some(r=>r.vehicle===vehicle.id&&r.status==='reserved')||Object.values(s.mobility?.sales??{}).some(r=>r.vehicle===vehicle.id&&['open','reserved'].includes(r.status)))throw new DomainError('VEHICLE_BUSY','Use a local available vehicle outside, after completing sales, repairs and journeys.');
 const slot=Number(p.slot);if(!Number.isInteger(p.slot)||slot<1||slot>home.parkingSpaces||existing||Object.values(m.parking).some(r=>r.homeId===home.id&&r.slot===slot&&r.status==='parked'))throw new DomainError('PARKING_OCCUPIED','Choose an available parking space.');
 const id='parking_'+hash(key);m.parking[id]={id,vehicleId:vehicle.id,homeId:home.id,actor,slot,status:'parked',version:1};vehicle.version++;return{parkingId:id,vehicleId:vehicle.id,message:'Your vehicle occupies one recorded home parking space.'};
}
export function furnishingView(s:State,actor:string,now:number){if(!s.citizens[actor])return null;const copy=structuredClone(s),home=homeFor(copy,actor),m=get(copy);return{home,rooms:homeRooms(home),construction:{...ROOM_RULES,canBuild:!s.property?.assets[home.id]||s.property.assets[home.id].owner===actor,materials:Object.values(s.commerce?.batches??{}).filter(b=>b.owner==='citizen:'+actor&&b.region===home.region&&b.goods==='materials'&&b.expiresAt>now&&b.quality>0).reduce((n,b)=>n+b.quantity,0)},catalogue:FURNITURE,finishes:FINISHES,items:Object.values(m.items).filter(i=>i.owner===actor).map(i=>({...i,owner:s.citizens[actor].id})),parking:Object.values(m.parking).filter(r=>r.actor===actor).map(r=>({...r,actor:s.citizens[actor].id})),fixtures:homeFixtures(copy,home)};}
export function reconcileFurnishing(s:State){const m=s.furnishing;if(!m)return;for(const home of Object.values(m.homes)){validateLayout(s,home);for(const p of home.partitions??[]){const receipt=s.commands[p.purchaseKey]?.receipt;if(!s.citizens[p.builtBy]||!receipt||receipt.type!=='BuildHomePartition'||receipt.actorId!==p.builtBy||receipt.detail.homeId!==home.id||!Array.isArray(receipt.detail.partitions)||!receipt.detail.partitions.some(e=>e&&typeof e==='object'&&['id','axis','x','y','door','builtBy','purchaseKey'].every(k=>(e as Record<string,unknown>)[k]===(p as unknown as Record<string,unknown>)[k])))throw new Error('Partition lacks construction evidence');}}for(const item of Object.values(m.items)){
 if(!s.citizens[item.owner]||!FURNITURE.some(f=>f.id===item.model)||!FINISHES.includes(item.finish)||!!item.homeId!==!!item.placement||item.homeId&&!m.homes[item.homeId])throw new Error('Furniture ownership or placement mismatch');
 if(!item.starter){const command=s.commands[item.purchaseKey??''];if(!command||command.receipt.type!=='BuyFurniture'||command.receipt.actorId!==item.owner||command.receipt.detail.furnitureId!==item.id||command.receipt.detail.amount!==FURNITURE.find(f=>f.id===item.model)!.price)throw new Error('Furniture lacks purchase evidence');}
 }
 const slots=new Set<string>(),vehicles=new Set<string>();for(const r of Object.values(m.parking))if(r.status==='parked'){const v=s.mobility?.vehicles[r.vehicleId],h=m.homes[r.homeId],slot=r.homeId+':'+r.slot;if(!v||!h||v.owner!==r.actor||v.region!==h.region||v.status!=='parked'||r.slot<1||r.slot>h.parkingSpaces||slots.has(slot)||vehicles.has(v.id))throw new Error('Parking title, location or capacity mismatch');slots.add(slot);vehicles.add(v.id);}
}
