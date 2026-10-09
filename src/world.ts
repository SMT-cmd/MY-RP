import {appearanceRender,DEFAULT_APPEARANCE} from './appearance.ts';
import { DomainError,post } from './domain.ts';
import type {State,Command,Citizen} from './domain.ts';
import {settleEmergencyTransport} from './healthcare.ts';
import {settleVehicleJourney} from './mobility.ts';
import {REGIONS,regionByName} from './geography.ts';
import {STARTER_HOME,fixtureDistance} from './interiors.ts';
import {lifeCommand} from './life.ts';
import {commerceCommand} from './commerce.ts';
import {homeFor,residenceEntrance,usableHome,homeFixtures,homeWalkable,homeStep} from './furnishing.ts';

import {fixtureAccessible,homeRooms} from './home-layout.ts';
import {MAP,BUILDINGS,STREET_OBJECTS,streetWalkable,districtAt} from './neighbourhood.ts';
import {usableInterior,guestEntrances,settleHomeVisits,authorisedInterior,HOME_VISIT_RULES} from './home-visits.ts';
import {fixtureUse,claimFixtureUse,fixtureCapacity,homeUseRevision} from './furniture-use.ts';
export {MAP,BUILDINGS,CORE_MAP} from './neighbourhood.ts';
type Position={region:string;district:string;interior:string|null;x:number;y:number;leaseVersion:number;lastMoveAt:number;visited:string[];interiorX?:number;interiorY?:number;facing?:string;homeId?:string;visitId?:string;activity?:{kind:string;fixtureId:string;startedAt:number;slot?:number;instanceId?:string;useKey?:string}};
export type Trip={id:string;actor:string;origin:string;destination:string;departAt:number;arriveAt:number;fee:number;status:'travelling'|'arrived'|'cancelled';leaseVersion:number;vehicleId?:string;vehicleFuel?:number;vehicleWear?:number;careCaseId?:string};
export type WorldState={positions:Record<string,Position>;trips:Record<string,Trip>;activeTrips:Record<string,string>};
export const initialWorld=():WorldState=>({positions:{},trips:{},activeTrips:{}});
export function positionFor(state:State,c:Citizen,now:number){state.world??=initialWorld();return state.world.positions[c.actorId]??={region:c.state,district:'Centre',interior:null,x:7,y:7,leaseVersion:1,lastMoveAt:now-500,visited:[]};}
export function travelQuote(origin:string,destination:string,state?:State){
  if(!regionByName(destination)||origin===destination)throw new DomainError('INVALID_ROUTE','Choose a different Nigerian state or FCT.',400);
  // Representative authored routes, not real road distances. Every region is reachable.
  const distance=60+Math.abs(REGIONS.findIndex(r=>r.name===origin)-REGIONS.findIndex(r=>r.name===destination))*18;
  const fuelPrice=state?.commerce?.fuelPrice??300,road=state?.commerce?.roads[origin+'>'+destination]??100;
  const fuel=Math.ceil(distance*.02*fuelPrice),wear=Math.ceil(distance*(100-road)*.2),service=distance*14;
  return{distance,fee:5000+service+fuel+wear,duration:Math.ceil((15000+distance*100)*(1+(100-road)/100)),mode:'NPC intercity bus',components:{base:5000,service,fuel,wear},explanation:'₦50 base fare + route service + measured fuel consumption + road wear. Damaged roads increase time and cost.'};
}
export function worldCommand(state:State,actor:string,command:Command,now:number,key:string):Record<string,unknown>|undefined{
  if(!['MoveCitizen','MoveInterior','InteractHomeFixture','InteractStreetObject','EnterBuilding','ExitBuilding','MeetGuide','BeginTravel','ArriveTravel','CancelTravel'].includes(command.type))return;
  const c=state.citizens[actor];if(!c)throw new DomainError('CITIZEN_REQUIRED','Create your citizen first.');const pos=positionFor(state,c,now),world=state.world!,p=command.payload,trip=world.trips[world.activeTrips[actor]];
  if(p.leaseVersion!==undefined&&p.leaseVersion!==pos.leaseVersion)throw new DomainError('STALE_LEASE','Your location changed. Refresh before moving again.');
  if(trip&&trip.status==='travelling'&&!['ArriveTravel','CancelTravel'].includes(command.type))throw new DomainError('IN_TRANSIT','Finish the current journey before taking another world action.');
  if(command.type==='MoveInterior'||command.type==='InteractHomeFixture'){
    if(pos.interior!=='shelter')throw new DomainError('HOME_REQUIRED','Enter your starter shelter first.');
    const home=usableInterior(state,actor,now),x=pos.interiorX??STARTER_HOME.spawn.x,y=pos.interiorY??STARTER_HOME.spawn.y;
    if(command.type==='MoveInterior'){
      const {dx,dy}=p;if(!Number.isInteger(dx)||!Number.isInteger(dy)||Math.abs(dx as number)+Math.abs(dy as number)!==1)throw new DomainError('INVALID_MOVE','Move one adjacent tile.',400);
      if(now-pos.lastMoveAt<250)throw new DomainError('MOVE_COOLDOWN','Wait for the next movement step.');
      if(!homeStep(state,home,x,y,x+(dx as number),y+(dy as number)))throw new DomainError('PATH_BLOCKED','Walk around the furniture.');
      delete pos.activity;pos.interiorX=x+(dx as number);pos.interiorY=y+(dy as number);pos.facing=(dx as number)>0?'right':(dx as number)<0?'left':(dy as number)>0?'front':'back';pos.lastMoveAt=now;
      return{interiorPosition:{x:pos.interiorX,y:pos.interiorY},leaseVersion:pos.leaseVersion};
    }
    const fixture=homeFixtures(state,home).find(f=>f.id===p.fixtureId||f.instanceId===p.fixtureId);if(!fixture)throw new DomainError('FIXTURE_NOT_FOUND','Choose a furnishing in your home.',404);
    if(pos.visitId&&!HOME_VISIT_RULES.actions.includes(fixture.action))throw new DomainError('GUEST_PERMISSION','This furnishing is reserved for the resident. Guests may sit, read, wash and inspect.',403);
    if(!fixtureAccessible(home,x,y,fixture))throw new DomainError('TOO_FAR','Walk beside the furnishing before interacting.');
    const slot=fixtureCapacity(fixture)?claimFixtureUse(state,home,fixture,actor,now,p.useSlot):undefined;
    const result=fixture.action==='Rest'?lifeCommand(state,actor,{...command,type:'Rest'},now,key):fixture.action==='RequestFoodAssistance'?commerceCommand(state,actor,{...command,type:'RequestFoodAssistance',payload:{}},now,key):{message:fixture.copy};
    if(slot!==undefined)pos.activity={kind:fixture.action,fixtureId:fixture.id,instanceId:fixture.instanceId,slot,startedAt:now,useKey:key};
    return{...result,fixtureId:fixture.id,...(slot!==undefined?{homeId:home.id,fixtureInstanceId:fixture.instanceId,fixtureUseSlot:slot,activityKind:fixture.action}:{})};
  }
  if(command.type==='MoveCitizen'){
    if(pos.interior)throw new DomainError('INTERIOR_ACTIVE','Use the exit to return to the city.');
    const {dx,dy}=p;if(!Number.isInteger(dx)||!Number.isInteger(dy)||Math.abs(dx as number)+Math.abs(dy as number)!==1)throw new DomainError('INVALID_MOVE','Move one adjacent tile.',400);
    if(now-pos.lastMoveAt<250)throw new DomainError('MOVE_COOLDOWN','Wait for the next movement step.');const x=pos.x+(dx as number),y=pos.y+(dy as number);
    if(!streetWalkable(x,y))throw new DomainError('PATH_BLOCKED','Use the street and the marked door.');
    delete pos.activity;pos.x=x;pos.y=y;pos.district=districtAt(x,y)!;pos.facing=(dx as number)>0?'right':(dx as number)<0?'left':(dy as number)>0?'front':'back';pos.lastMoveAt=now;return{position:{x,y},leaseVersion:pos.leaseVersion};
  }
  if(command.type==='InteractStreetObject'){
    if(pos.interior)throw new DomainError('CITY_REQUIRED','Return to the neighbourhood first.');
    const object=STREET_OBJECTS.find(o=>o.id===p.objectId);if(!object)throw new DomainError('STREET_OBJECT_NOT_FOUND','Choose an available public object.',404);
    if(fixtureDistance(pos.x,pos.y,object)>1)throw new DomainError('TOO_FAR','Walk beside the public object first.');
    pos.activity={kind:object.action,fixtureId:object.id,startedAt:now};return{objectId:object.id,message:object.copy};
  }
  if(command.type==='EnterBuilding'){
    const own=residenceEntrance(state,actor),guest=guestEntrances(state,actor,now).find(e=>e.id===p.buildingId),entrance=guest??own,isHome=p.buildingId===own.id||!!guest;
    const building=isHome?entrance:BUILDINGS.find(b=>b.id===p.buildingId&&b.id!=='shelter');if(!building||pos.interior)throw new DomainError('INVALID_BUILDING','Choose an available service, your residence or an accepted home invitation.',400);
    if(Math.abs(pos.x-building.door.x)+Math.abs(pos.y-building.door.y)>1)throw new DomainError('TOO_FAR','Walk to the marked door first.');
    const interior=isHome?'shelter':building.id;delete pos.activity;pos.interior=interior;if(isHome){pos.homeId=entrance.homeId;if(guest)pos.visitId=guest.visitId;pos.interiorX=STARTER_HOME.spawn.x;pos.interiorY=STARTER_HOME.spawn.y;pos.facing='back';}pos.leaseVersion++;if(!guest&&!pos.visited.includes(interior))pos.visited.push(interior);return{buildingId:building.id,...(isHome?{homeId:entrance.homeId,address:entrance.address,...(guest?{visitId:guest.visitId}:{})}:{}),message:'You entered '+building.name+'.'};
  }
  if(command.type==='ExitBuilding'){if(!pos.interior)throw new DomainError('NOT_INSIDE','You are already in the city.');pos.interior=null;delete pos.interiorX;delete pos.interiorY;delete pos.homeId;delete pos.visitId;delete pos.activity;pos.leaseVersion++;return{message:'You returned to the city.'};}
  if(command.type==='MeetGuide'){
    if(pos.interior||Math.abs(pos.x-MAP.guide.x)+Math.abs(pos.y-MAP.guide.y)>2)throw new DomainError('TOO_FAR','Meet Aunty Bisi beside the main road.');
    if(!pos.visited.includes('guide'))pos.visited.push('guide');return{message:'Welcome! Visit the starter shelter, buy a meal and finish a paid starter task. School stays available beside your work.',guide:MAP.guide.name};
  }
  if(command.type==='BeginTravel'){
    if(pos.interior!=='terminal')throw new DomainError('TERMINAL_REQUIRED','Enter the bus terminal to book an interstate journey.');
    const quote=travelQuote(pos.region,String(p.destination),state);if(p.acceptedFee!==quote.fee)throw new DomainError('QUOTE_CHANGED','Review the current fare before booking.');
    const id='trip_'+key;post(state,key,now,'Reserved intercity fare',[{account:'citizen:'+actor,amount:-quote.fee},{account:'escrow:'+id,amount:quote.fee}]);
    world.trips[id]={id,actor,origin:pos.region,destination:String(p.destination),departAt:now,arriveAt:now+quote.duration,fee:quote.fee,status:'travelling',leaseVersion:pos.leaseVersion};world.activeTrips[actor]=id;return{tripId:id,...quote,arriveAt:now+quote.duration,message:'Fare reserved. Your existing location lease remains locked during travel.'};
  }
  if(!trip||trip.status!=='travelling')throw new DomainError('NO_JOURNEY','There is no active journey.');
  if(command.type==='CancelTravel'){
    if(now-trip.departAt>=5000)throw new DomainError('BUS_DEPARTED','The bus has departed. Complete your journey.');
    if(trip.fee)post(state,key,now,'Cancelled intercity fare',[{account:'escrow:'+trip.id,amount:-trip.fee},{account:'citizen:'+actor,amount:trip.fee}]);settleVehicleJourney(state,trip,key,now,true);settleEmergencyTransport(state,trip.id,true);trip.status='cancelled';delete world.activeTrips[actor];return{message:'Your fare was refunded.'};
  }
  if(now<trip.arriveAt)throw new DomainError('JOURNEY_PENDING','The journey is still in progress.');
  if(trip.fee)post(state,key,now,'Completed intercity fare',[{account:'escrow:'+trip.id,amount:-trip.fee},{account:trip.vehicleId?'treasury:state:'+trip.origin:'system:bus-provider',amount:trip.fee}]);settleVehicleJourney(state,trip,key,now,false);settleEmergencyTransport(state,trip.id,false);trip.status='arrived';delete world.activeTrips[actor];pos.region=trip.destination;pos.district='Centre';pos.interior=trip.careCaseId?'clinic':null;pos.x=17;pos.y=7;pos.leaseVersion++;pos.lastMoveAt=now;
  return{region:pos.region,leaseVersion:pos.leaseVersion,incidentIds:Object.values(state.incidents?.records??{}).filter(i=>i.source===trip.id).map(i=>i.id),message:'You arrived safely. The destination now holds your single location lease.'};
}
export function worldView(state:State,actor:string,now:number){
  const citizen=state.citizens[actor];if(!citizen)return null;const copy=structuredClone(state);settleHomeVisits(copy,now);const position=positionFor(copy,copy.citizens[actor],now),trip=state.world?.trips[state.world.activeTrips[actor]];
  position.district=districtAt(position.x,position.y)!;
  const room=position.interior==='shelter'?(position.visitId?authorisedInterior(copy,actor,now):homeFor(copy,actor)):null;
  const visit=position.visitId?copy.furnishing?.visits?.[position.visitId]:null;
  const home=room&&(!position.homeId||position.homeId===room.id)?{...room,useRevision:homeUseRevision(copy,room,now),guest:!!visit,name:visit?copy.citizens[visit.host].name+"'s home":residenceEntrance(copy,actor).name,address:visit?guestEntrances(copy,actor,now).find(e=>e.visitId===visit.id)?.address:residenceEntrance(copy,actor).address,spawn:STARTER_HOME.spawn,exit:STARTER_HOME.exit,x:position.interiorX??4,y:position.interiorY??6,rooms:homeRooms(room),fixtures:homeFixtures(copy,room).map(f=>({...f,use:fixtureUse(copy,room,f,actor,now),allowed:!visit||HOME_VISIT_RULES.actions.includes(f.action),nearby:fixtureAccessible(room,position.interiorX??4,position.interiorY??6,f)}))}:null;
  const residence=homeFor(copy,actor),entrance=residenceEntrance(copy,actor),parking={homeId:residence.id,origin:entrance.parking,spaces:residence.parkingSpaces,vehicles:Object.values(copy.furnishing!.parking).filter(r=>r.actor===actor&&r.homeId===residence.id&&r.status==='parked').map(r=>({slot:r.slot,vehicleId:r.vehicleId,model:state.mobility?.vehicles[r.vehicleId]?.model}))};
  const visits=guestEntrances(copy,actor,now),enterable=[...BUILDINGS.filter(b=>b.id!=='shelter'),entrance,...visits];
  return{serverTime:now,map:MAP,residence:entrance,guestEntrances:visits,avatar:appearanceRender(citizen.appearance??DEFAULT_APPEARANCE),position,home,parking,nearbyStreetObjects:position.interior?[]:STREET_OBJECTS.filter(o=>fixtureDistance(position.x,position.y,o)<=1),trip:trip??null,region:regionByName(position.region),nearby:enterable.filter(b=>Math.abs(position.x-b.door.x)+Math.abs(position.y-b.door.y)<=1).map(b=>({id:b.id,name:b.name})),routes:REGIONS.filter(r=>r.name!==position.region).map(r=>({destination:r.name,...travelQuote(position.region,r.name,state)}))};
}
