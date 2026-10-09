// Authored representative neighbourhoods, not real cadastral or nationwide maps.
// Original service footprints stay stable so saved positions and doors survive.
export const BUILDINGS=[
 {id:'shelter',name:'Starter shelter',x:2,y:3,w:4,h:3,door:{x:4,y:6},colour:0xc48c50},
 {id:'school',name:'Foundation school',x:8,y:2,w:5,h:4,door:{x:10,y:6},colour:0x76a48c},
 {id:'clinic',name:'Community clinic',x:15,y:3,w:4,h:3,door:{x:17,y:6},colour:0xd2c8a5},
 {id:'market',name:'Food market',x:2,y:9,w:4,h:3,door:{x:4,y:8},colour:0xcc774d},
 {id:'work',name:'NPC work desk',x:8,y:9,w:5,h:3,door:{x:10,y:8},colour:0x839aaf},
 {id:'terminal',name:'Bus terminal',x:15,y:9,w:4,h:3,door:{x:17,y:8},colour:0xb29cbb}
];
export const CORE_MAP={width:22,height:14,buildings:BUILDINGS,guide:{x:7,y:7,name:'Aunty Bisi',role:'Citizen welcome guide'}};
const facades:{id:string;kind:string;name:string;x:number;y:number;w:number;h:number;colour:number}[]=[];
for(let row=0;row<3;row++)for(let column=0;column<3;column++){
 if(row===0&&column===0)continue;
 for(const [index,offset] of [[0,3],[1,12]])facades.push({id:`facade-${column}-${row}-${index}`,kind:'facade',name:'Neighbourhood residence',x:column*22+offset,y:row*14+2,w:5,h:4,colour:[0xc6b397,0xb19e82,0xa5b49d][(row+column+index)%3]});
}
const trees=[];
for(let row=0;row<3;row++)for(let column=0;column<3;column++)for(const offset of [3,17]){if(row===0&&column===0)continue;trees.push({id:`tree-${column}-${row}-${offset}`,kind:'tree',name:'Street shade tree',x:column*22+offset,y:row*14+11,w:1,h:1,colour:0x779064});}
export const STREET_OBJECTS=Array.from({length:9},(_,index)=>{const column=index%3,row=Math.floor(index/3);return{id:'bench-'+index,name:'Courtyard bench',model:'bench',x:column*22+9,y:index===0?15:row*14+11,w:2,h:1,rotation:0,action:'Sit',copy:'Sit in the public courtyard.'};});
export const MAP={...CORE_MAP,id:'neighbourhood-2',width:66,height:42,obstacles:[...facades,...trees],streetObjects:STREET_OBJECTS,
 districts:['Centre','Market quarter','Residential quarter'].map((name,index)=>({name,x:index*22,y:0,w:22,h:42,landmark:{x:index*22+10,y:21}})),
 roads:[...Array.from({length:3},(_,i)=>({x:0,y:i*14+6,w:66,h:3,name:['Welcome road','Neighbourhood road','Courtyard road'][i]})),...Array.from({length:3},(_,i)=>({x:i*22+20,y:0,w:2,h:42,name:['Centre lane','Market lane','Residential lane'][i]}))]
};
// Stable authored plots for the finite regional property catalogue. The land
// plot keeps its address when construction changes its kind to a home.
export const RESIDENTIAL_PLOTS=([
 {catalogueKind:'home',facadeId:'facade-1-0-0',address:'1 Market Lane'},
 {catalogueKind:'land',facadeId:'facade-1-0-1',address:'2 Market Lane'}
] as const).map(plot=>{const facade=facades.find(f=>f.id===plot.facadeId)!;return{...facade,...plot,door:{x:facade.x+2,y:facade.y+facade.h}};});
export function districtAt(x:number,y:number){return MAP.districts.find(d=>x>=d.x&&x<d.x+d.w&&y>=d.y&&y<d.y+d.h)?.name;}
export function streetWalkable(x:number,y:number){return Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<MAP.width&&y<MAP.height&&![...BUILDINGS,...MAP.obstacles,...STREET_OBJECTS].some(b=>x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h);}
