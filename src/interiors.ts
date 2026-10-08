// Authored collision and interaction geometry, shared by the game and preview.
export const STARTER_HOME={width:10,height:8,spawn:{x:4,y:6},exit:{x:4,y:7},fixtures:[
 {id:'bed',name:'Your bed',x:1,y:1,w:2,h:2,action:'Rest',copy:'Rest safely. Existing rest cooldowns still apply.'},
 {id:'pantry',name:'Kitchen pantry',x:8,y:1,w:1,h:1,action:'RequestFoodAssistance',copy:'Request a capped protective meal from actual NPC food stock.'},
 {id:'sofa',name:'Living room sofa',x:6,y:4,w:3,h:1,action:'inspect',copy:'A comfortable place to sit. This starter furnishing belongs to your shelter.'},
 {id:'desk',name:'Study desk',x:1,y:4,w:2,h:1,action:'inspect',copy:'Your study space. Qualifications still require official lessons, exams and practice.'},
 {id:'sink',name:'Kitchen sink',x:8,y:3,w:1,h:1,action:'inspect',copy:'A simple kitchen sink. Paid utilities and clinical recovery use their separate recorded systems.'},
 {id:'wardrobe',name:'Wardrobe',x:6,y:1,w:1,h:2,action:'inspect',copy:'Your starter clothes are stored here. This does not transfer or grant tradeable items.'}
]};
export function homeTile(x:number,y:number){return Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<STARTER_HOME.width&&y<STARTER_HOME.height&&!STARTER_HOME.fixtures.some(f=>x>=f.x&&x<f.x+f.w&&y>=f.y&&y<f.y+f.h);}
export function fixtureDistance(x:number,y:number,f:typeof STARTER_HOME.fixtures[number]){return Math.max(f.x-x,0,x-(f.x+f.w-1))+Math.max(f.y-y,0,y-(f.y+f.h-1));}
