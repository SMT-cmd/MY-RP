import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,execute,citizenView,DomainError} from '../src/domain.ts';
import type {State} from '../src/domain.ts';
import {walkTo} from './helpers.ts';
import {MAP,BUILDINGS,STREET_OBJECTS,streetWalkable,districtAt,CORE_MAP} from '../src/neighbourhood.ts';
import {travelQuote} from '../src/world.ts';
import {homeTile} from '../src/interiors.ts';
import {reconcile,exportBackup,restoreBackup} from '../src/recovery.ts';
let seq=0;const apply=(s:State,type:string,payload:Record<string,unknown>,now:number)=>execute(s,'traveller',{id:'world_test_'+ ++seq,type,payload},now);
const create=()=>apply(initialState(),'CreateCitizen',{name:'Ada',state:'Lagos',adultConfirmed:true},1000).state;
const code=(value:string)=>(error:unknown)=>error instanceof DomainError&&error.code===value;
test('world movement validates distance, collision, rate and location lease',()=>{
 let s=create();assert.throws(()=>apply(s,'MoveCitizen',{dx:3,dy:0},2000),code('INVALID_MOVE'));assert.throws(()=>apply(s,'EnterBuilding',{buildingId:'clinic'},2000),code('TOO_FAR'));
 s=apply(s,'MoveCitizen',{dx:0,dy:-1},2000).state;assert.throws(()=>apply(s,'MoveCitizen',{dx:0,dy:-1},2001),code('MOVE_COOLDOWN'));
 s=apply(s,'MoveCitizen',{dx:1,dy:0},2500).state;assert.throws(()=>apply(s,'MoveCitizen',{dx:0,dy:-1},3000),code('PATH_BLOCKED'));
 s=walkTo(s,'traveller',4,7,3500);s=apply(s,'EnterBuilding',{buildingId:'shelter',leaseVersion:1},6000).state;assert.equal(s.world!.positions.traveller.interior,'shelter');assert.throws(()=>apply(s,'ExitBuilding',{leaseVersion:1},6500),code('STALE_LEASE'));
 s=apply(s,'ExitBuilding',{leaseVersion:2},6500).state;assert.equal(s.world!.positions.traveller.leaseVersion,3);assert.equal(citizenView(s,'traveller',6500).world?.position.interior,null);
});
test('interstate travel reserves one fare and keeps one lease through retries and disconnect',()=>{
 let s=create();s=walkTo(s,'traveller',17,7,2000);s=apply(s,'EnterBuilding',{buildingId:'terminal'},10000).state;const quote=travelQuote('Lagos','Kano'),start={id:'world_trip_unique',type:'BeginTravel',payload:{destination:'Kano',acceptedFee:quote.fee}};
 const booked=execute(s,'traveller',start,11000);s=booked.state;assert.equal(execute(s,'traveller',start,21000).replayed,true);assert.throws(()=>apply(s,'MoveCitizen',{dx:1,dy:0},22000),code('IN_TRANSIT'));assert.throws(()=>apply(s,'ArriveTravel',{},12000),code('JOURNEY_PENDING'));assert.throws(()=>apply(s,'CancelTravel',{},16000),code('BUS_DEPARTED'));
 const arrive={id:'world_arrive_unique',type:'ArriveTravel',payload:{}};s=execute(s,'traveller',arrive,11000+quote.duration).state;assert.equal(execute(s,'traveller',arrive,999999).replayed,true);assert.equal(s.world!.positions.traveller.region,'Kano');assert.equal(s.world!.positions.traveller.leaseVersion,3);assert.equal(s.balances['escrow:trip_traveller:world_trip_unique'],0);assert.equal(s.balances['system:bus-provider'],quote.fee);
});
test('furnished home movement and interactions use server position, protected stock and existing rest cooldowns',()=>{
 let s=create();assert.throws(()=>apply(s,'InteractHomeFixture',{fixtureId:'bed'},2000),code('HOME_REQUIRED'));
 s=walkTo(s,'traveller',4,7,2000);s=apply(s,'EnterBuilding',{buildingId:'shelter'},6000).state;
 assert.deepEqual([s.world!.positions.traveller.interiorX,s.world!.positions.traveller.interiorY],[4,6]);
 assert.throws(()=>apply(s,'InteractHomeFixture',{fixtureId:'bed',x:1,y:1},6500),code('TOO_FAR'));
 let clock=7000;const move=(dx:number,dy:number)=>{s=apply(s,'MoveInterior',{dx,dy,leaseVersion:2},clock).state;clock+=300;};
 for(const [dx,dy] of [[0,-1],[0,-1],[0,-1],[-1,0],[0,-1]])move(dx,dy);
 assert.equal(s.world!.positions.traveller.facing,'back');assert.throws(()=>apply(s,'MoveInterior',{dx:-1,dy:0},clock),code('PATH_BLOCKED'));
 const rest={id:'home_rest_once',type:'InteractHomeFixture',payload:{fixtureId:'bed',leaseVersion:2}};s=execute(s,'traveller',rest,clock).state;
 assert.equal(execute(s,'traveller',rest,clock+10).replayed,true);assert.throws(()=>apply(s,'InteractHomeFixture',{fixtureId:'bed'},clock+20),code('REST_COOLDOWN'));
 const queue:[[number,number],[number,number][]][]=[[[3,2],[]]],seen=new Set(['3,2']);let route:[number,number][]=[];
 for(let i=0;i<queue.length;i++){const [[x,y],path]=queue[i];if(x===8&&y===2){route=path;break;}for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){const nx=x+dx,ny=y+dy,k=`${nx},${ny}`;if(homeTile(nx,ny)&&!seen.has(k)){seen.add(k);queue.push([[nx,ny],[...path,[dx,dy]]]);}}}
 for(const [dx,dy] of route)move(dx,dy);
 const before=s.balances['citizen:traveller'];s=apply(s,'InteractHomeFixture',{fixtureId:'pantry'},clock).state;s=apply(s,'InteractHomeFixture',{fixtureId:'pantry'},clock+1).state;
 assert.equal(s.balances['citizen:traveller'],before);assert.throws(()=>apply(s,'InteractHomeFixture',{fixtureId:'pantry'},clock+2),code('ASSISTANCE_LIMIT'));
 assert.throws(()=>apply(s,'InteractHomeFixture',{fixtureId:'other-citizens-bed'},clock),code('FIXTURE_NOT_FOUND'));
 const recovered=restoreBackup(exportBackup(s));assert.equal(citizenView(recovered,'traveller',clock).world!.home!.x,8);reconcile(recovered);
 const forged=structuredClone(s);forged.world!.positions.traveller.interiorX=8;forged.world!.positions.traveller.interiorY=1;assert.throws(()=>reconcile(forged),/Invalid starter home position/);
 s=apply(s,'ExitBuilding',{leaseVersion:2},clock+500).state;assert.equal(s.world!.positions.traveller.x,4);assert.equal(s.world!.positions.traveller.y,7);assert.equal(s.world!.positions.traveller.interiorX,undefined);
 assert.throws(()=>apply(s,'MoveInterior',{dx:1,dy:0,leaseVersion:2},clock+1000),code('STALE_LEASE'));
});

test('expanded main neighbourhood preserves old streets, connects every district and keeps public seats authoritative',()=>{
 const originalBlocked=(x:number,y:number)=>CORE_MAP.buildings.some(b=>x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h);
 for(let x=0;x<CORE_MAP.width;x++)for(let y=0;y<CORE_MAP.height;y++)if(!originalBlocked(x,y))assert.equal(streetWalkable(x,y),true,'Existing saved street tile must survive');
 const queue=[[7,7]],seen=new Set(['7:7']);for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=nx+':'+ny;if(!seen.has(k)&&streetWalkable(nx,ny)){seen.add(k);queue.push([nx,ny]);}}}
 for(let x=0;x<MAP.width;x++)for(let y=0;y<MAP.height;y++)if(streetWalkable(x,y))assert.ok(seen.has(x+':'+y),'All walkable tiles must connect to the service road');
 for(const b of BUILDINGS)assert.ok(seen.has(b.door.x+':'+b.door.y));for(const d of MAP.districts)assert.ok(seen.has(d.landmark.x+':'+d.landmark.y));
 let s=create();const lease=s.world!.positions.traveller.leaseVersion;s=walkTo(s,'traveller',44,21,2000);assert.equal(s.world!.positions.traveller.district,'Residential quarter');assert.equal(districtAt(44,21),'Residential quarter');assert.equal(s.world!.positions.traveller.leaseVersion,lease);
 assert.throws(()=>apply(s,'InteractStreetObject',{objectId:STREET_OBJECTS[0].id},50000),code('TOO_FAR'));const bench=STREET_OBJECTS[8];s=walkTo(s,'traveller',bench.x,bench.y+1,51000);assert.throws(()=>apply(s,'MoveCitizen',{dx:0,dy:-1},90000),code('PATH_BLOCKED'));
 const balance=s.balances['citizen:traveller'],journals=s.journals.length,hunger=s.citizens.traveller.life!.needs.hunger;const sit={id:'courtyard_sit_once',type:'InteractStreetObject',payload:{objectId:bench.id,leaseVersion:lease}};
 s=execute(s,'traveller',sit,90500).state;assert.equal(execute(s,'traveller',sit,90600).replayed,true);assert.equal(s.world!.positions.traveller.activity?.kind,'Sit');assert.equal(s.balances['citizen:traveller'],balance);assert.equal(s.journals.length,journals);assert.equal(s.citizens.traveller.life!.needs.hunger,hunger);
 const reopened=restoreBackup(exportBackup(s));assert.deepEqual(reopened.world!.positions.traveller,s.world!.positions.traveller);
 for(const tile of [[MAP.width,0],[-1,0],[STREET_OBJECTS[8].x,STREET_OBJECTS[8].y]]){const forged=structuredClone(s);[forged.world!.positions.traveller.x,forged.world!.positions.traveller.y]=tile;assert.throws(()=>reconcile(forged),/Invalid authoritative street position/);}
});
