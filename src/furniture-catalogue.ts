// Prices are virtual NGN minor units; preserve original acquisition prices.
export type FurnitureModel={id:string;name:string;category:string;w:number;h:number;price:number;action:string;kind:string;collection:string;style:string;seats:number;lightable:boolean;currency:'virtual-ngn'};
const ORIGINAL_FURNITURE=[
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
export const FURNITURE_COLLECTIONS=[{id:'reed',name:'Reed',style:'woven',factor:1},{id:'marina',name:'Marina',style:'metal',factor:1.25},{id:'heritage',name:'Heritage',style:'carved',factor:1.5},{id:'atelier',name:'Atelier',style:'angled',factor:1.75},{id:'horizon',name:'Horizon',style:'soft',factor:2},{id:'regal',name:'Regal',style:'brass',factor:2.5}];
const FORMS=[
 {kind:'sofa',name:'Family sofa',category:'living',w:3,h:1,price:65000,action:'Sit',seats:3},
 {kind:'loveseat',name:'Two-seat sofa',category:'living',w:2,h:1,price:44000,action:'Sit',seats:2},
 {kind:'armchair',name:'Lounge chair',category:'living',w:1,h:1,price:28000,action:'Sit'},
 {kind:'dining-chair',name:'Dining chair',category:'dining',w:1,h:1,price:11000,action:'Sit'},
 {kind:'chaise',name:'Chaise lounge',category:'living',w:2,h:1,price:39000,action:'Sit'},
 {kind:'ottoman',name:'Upholstered ottoman',category:'living',w:1,h:1,price:14500,action:'Sit'},
 {kind:'bench',name:'Entry bench',category:'living',w:2,h:1,price:22000,action:'Sit',seats:2},
 {kind:'bed',name:'Double bed',category:'bedroom',w:2,h:2,price:90000,action:'Rest'},
 {kind:'single-bed',name:'Single bed',category:'bedroom',w:1,h:2,price:55000,action:'Rest'},
 {kind:'desk',name:'Writing desk',category:'study',w:2,h:1,price:38000,action:'Read'},
 {kind:'dining-table',name:'Dining table',category:'dining',w:2,h:2,price:46000,action:'inspect'},
 {kind:'coffee-table',name:'Coffee table',category:'living',w:2,h:1,price:21000,action:'inspect'},
 {kind:'side-table',name:'Occasional table',category:'living',w:1,h:1,price:13000,action:'inspect'},
 {kind:'bookshelf',name:'Bookcase',category:'study',w:1,h:2,price:34000,action:'Read'},
 {kind:'wardrobe',name:'Wardrobe',category:'bedroom',w:1,h:2,price:52000,action:'Dress'},
 {kind:'sideboard',name:'Sideboard',category:'living',w:2,h:1,price:37000,action:'inspect'},
 {kind:'display-case',name:'Glass display cabinet',category:'decor',w:1,h:2,price:48000,action:'inspect'},
 {kind:'kitchen-island',name:'Kitchen island',category:'kitchen',w:2,h:1,price:73000,action:'inspect'},
 {kind:'vanity',name:'Washstand and mirror',category:'bath',w:2,h:1,price:58000,action:'Wash'},
 {kind:'plant',name:'Palm planter',category:'decor',w:1,h:1,price:9500,action:'inspect'},
 {kind:'floor-lamp',name:'Floor lamp',category:'lighting',w:1,h:1,price:18000,action:'Light',lightable:true},
 {kind:'table-lamp',name:'Bedside light and table',category:'lighting',w:1,h:1,price:16000,action:'Light',lightable:true},
 {kind:'studio-light',name:'Colour studio lamp',category:'lighting',w:1,h:1,price:32000,action:'Light',lightable:true}
];
export const FURNITURE:FurnitureModel[]=[...ORIGINAL_FURNITURE.map(f=>({...f,kind:f.id,collection:'original',style:'classic',seats:f.id==='sofa'?3:f.action==='Sit'?1:0,lightable:false,currency:'virtual-ngn' as const})),...FURNITURE_COLLECTIONS.flatMap(c=>FORMS.map(f=>({...f,id:c.id+'-'+f.kind,name:c.name+' '+f.name,price:Math.round(f.price*c.factor/100)*100,collection:c.id,style:c.style,seats:f.seats??(f.action==='Sit'?1:0),lightable:f.lightable??false,currency:'virtual-ngn' as const})))];
export const LIGHT_SCENES=[{id:'warm',name:'Warm evening',color:'#ffd4a0'},{id:'daylight',name:'Clear daylight',color:'#e5f2ff'},{id:'ocean',name:'Ocean blue',color:'#8ed7f0'},{id:'sunset',name:'Sunset rose',color:'#f2a88d'},{id:'club',name:'Lounge colour',color:'#b6a3f0'}];
export type FurnitureLight={enabled:boolean;scene:string;brightness:number;version:number;commandKey:string};
export const lightView=(light?:FurnitureLight)=>({enabled:light?.enabled??false,scene:light?.scene??'warm',brightness:light?.brightness??70,version:light?.version??0});
