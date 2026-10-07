import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('./', import.meta.url);
const layout = JSON.parse(await readFile(new URL('world-layout.json', root), 'utf8'));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const p = (x,y,z=0) => [490+(x-y)*31,95+(x+y)*16-z];
const points = a => a.map(v=>p(...v).join(',')).join(' ');
const poly = (vertices,fill,extra='') => `<polygon points="${points(vertices)}" fill="${fill}" ${extra}/>`;
const box = (x,y,w,h,z,roof,front,side,base=0) => poly([[x,y,z],[x+w,y,z],[x+w,y+h,z],[x,y+h,z]],roof)+poly([[x,y+h,z],[x+w,y+h,z],[x+w,y+h,base],[x,y+h,base]],front)+poly([[x+w,y,z],[x+w,y+h,z],[x+w,y+h,base],[x+w,y,base]],side);
const at = (x,y,z,contents,extra='') => `<g transform="translate(${p(x,y,z).join(' ')})" ${extra}>${contents}</g>`;
const tree = (x,y) => at(x,y,0,`<ellipse rx="26" ry="11" fill="#284a3733"/><path d="M0 0L0-54" stroke="#785a39" stroke-width="7"/><path d="M0-51Q-30-77-42-46Q-19-60 0-47Q23-70 43-44Q22-55 0-47Q-13-86-23-71Q-10-72 0-48Q13-84 25-72Q14-70 0-49" fill="#428967"/><path d="M0-48Q-18-57-38-49M0-48Q21-56 39-46" fill="none" stroke="#285e47" stroke-width="2"/>`);
const person = (x,y,shirt,skin='#774a35') => at(x,y,0,`<ellipse rx="10" ry="5" fill="#203a3730"/><path d="M-4-6L-5 0M4-6L5 0" stroke="#344757" stroke-width="5" stroke-linecap="round"/><path d="M-7-20L-8-8M7-20L8-8" stroke="${skin}" stroke-width="4" stroke-linecap="round"/><rect x="-7" y="-23" width="14" height="17" rx="5" fill="${shirt}"/><circle cy="-29" r="7" fill="${skin}"/><path d="M-7-30Q-5-40 4-35L7-30" fill="#302925"/>`);
const names={shelter:'Starter home',school:'Foundation school',clinic:'Community clinic',market:'Neighbourhood market',work:'Work & opportunity',terminal:'Bus terminal'};
const colours={shelter:['#b55e42','#ecd8ab','#c2a17a'],school:['#58886b','#f1e8c9','#c2cba8'],clinic:['#82a49d','#f4f0d9','#c6d4c5'],market:['#ba704e','#ddb887','#b58d69'],work:['#6b8996','#ebe1c3','#bec8ba'],terminal:['#bf9860','#ece2c2','#c4b792']};
let ground = poly([[0,0,0],[22,0,0],[22,14,0],[0,14,0]],'#c8d6b3')+poly([[0,14,0],[22,14,0],[22,14,-21],[0,14,-21]],'#ae9872')+poly([[22,0,0],[22,14,0],[22,14,-21],[22,0,-21]],'#8b9875');
for(let y=0;y<14;y++)for(let x=0;x<22;x++)if((x*3+y*7)%11===0)ground+=poly([[x+.1,y+.2,0],[x+.9,y+.2,0],[x+.9,y+.9,0],[x+.1,y+.9,0]],'#bacba1');
ground+=poly([[0,6,1],[22,6,1],[22,9,1],[0,9,1]],'#e8dcc0');
ground+=poly([[0,6.6,2],[22,6.6,2],[22,8.4,2],[0,8.4,2]],'#7f8b86');
ground+=poly([[6.3,0,1],[7.5,0,1],[7.5,14,1],[6.3,14,1]],'#e8dcc0');
ground+=poly([[13.3,0,1],[14.4,0,1],[14.4,14,1],[13.3,14,1]],'#e8dcc0');
for(let x=0;x<22;x+=1.7)ground+=poly([[x,7.45,3],[x+.9,7.45,3],[x+.9,7.53,3],[x,7.53,3]],'#e8e7c9');
for(let x=7.2;x<8.5;x+=.25)ground+=poly([[x,6.7,3],[x+.13,6.7,3],[x+.13,8.3,3],[x,8.3,3]],'#ececd4');
const objects=[];
for(const b of layout.buildings){
 const [roof,front,side]=colours[b.id]; const height=b.id==='market'?29:53;
 let art=box(b.x,b.y,b.w,b.h,height,roof,front,side);
 art+=poly([[b.x-.12,b.y-.12,height+4],[b.x+b.w+.12,b.y-.12,height+4],[b.x+b.w+.12,b.y+b.h+.12,height+4],[b.x-.12,b.y+b.h+.12,height+4]],roof,`stroke="#4f514733" stroke-width="2"`);
 for(let i=0;i<b.w-1;i++)art+=poly([[b.x+.35+i,b.y+b.h,36],[b.x+.9+i,b.y+b.h,36],[b.x+.9+i,b.y+b.h,22],[b.x+.35+i,b.y+b.h,22]],'#557a77',`stroke="#efedd9" stroke-width="2"`);
 for(let i=0;i<b.h-1;i++)art+=poly([[b.x+b.w,b.y+.3+i,36],[b.x+b.w,b.y+.8+i,36],[b.x+b.w,b.y+.8+i,22],[b.x+b.w,b.y+.3+i,22]],'#59756f',`stroke="#efedd9" stroke-width="2"`);
 const doorY=b.y<7?b.y+b.h:b.y;
 if(b.y<7)art+=poly([[b.door.x-.3,doorY,24],[b.door.x+.3,doorY,24],[b.door.x+.3,doorY,0],[b.door.x-.3,doorY,0]],'#40564b');
 if(b.id==='clinic')art+=at(b.x+b.w/2,b.y+b.h,41,'<rect x="-9" y="-8" width="18" height="17" rx="3" fill="#fff4df"/><path d="M-5 0H5M0-5V5" stroke="#bb644e" stroke-width="4"/>');
 if(b.id==='school')art+=at(b.x+.2,b.y+.5,54,'<path d="M0 0V-48" stroke="#6d7363" stroke-width="2"/><path d="M1-46H26V-31H1" fill="#f5f3da"/><path d="M1-46H9V-31H1M18-46H26V-31H18" fill="#389271"/>');
 if(b.id==='shelter')art+=box(b.x+.3,b.y+.3,.6,.5,height+15,'#535f61','#454c4d','#64706e',height+4);
 if(b.id==='market')for(let i=0;i<3;i++){
  art+=box(b.x+i*1.2,b.y-.75,1.05,.65,18,i%2?'#e5b457':'#b75844','#d8aa79','#b28659');
  art+=at(b.x+.5+i*1.2,b.y-.6,22,'<circle cx="-7" r="4" fill="#d48344"/><circle r="4" fill="#64914d"/><circle cx="7" r="4" fill="#eac363"/>');
 }
 objects.push({depth:b.x+b.y+b.w+b.h,art});
}
for(const [x,y] of [[1,1],[5,1],[10,0.8],[17,1],[21,1],[.8,5],[20.5,5],[1,12],[7,13],[14,13],[21,12.5]])objects.push({depth:x+y,art:tree(x,y)});
const bus=box(16.1,7.5,2.2,.85,21,'#edc554','#d9a43b','#b58c32')+poly([[16.2,8.35,19],[18,8.35,19],[18,8.35,11],[16.2,8.35,11]],'#315659')+at(16.4,8.35,0,'<circle r="6" fill="#394849"/>')+at(17.8,8.35,0,'<circle r="6" fill="#394849"/>');
objects.push({depth:24.6,art:bus});
for(const [x,y,c] of [[4.5,8.6,'#d77f49'],[10.4,6.2,'#66888f'],[16.8,6.3,'#ded7c2'],[11.8,8.7,'#ac6a80'],[18.8,8.9,'#6a9781']])objects.push({depth:x+y,art:person(x,y,c)});
objects.sort((a,b)=>a.depth-b.depth);
const guide=person(7.6,6.6,'#c99649')+at(7.6,6.6,55,'<circle r="12" fill="#fff4ce" stroke="#b7863d"/><text text-anchor="middle" y="5" font-size="16" font-weight="700" fill="#62491f">!</text>');
let markers='';
for(const b of layout.buildings){const [x,y]=p(b.x+b.w/2,b.y+b.h/2,91);const label=names[b.id];const width=Math.max(124,label.length*7+28);markers+=`<g data-place="${b.id}" tabindex="0" role="button" aria-label="Walk to ${esc(label)}" class="place-marker" transform="translate(${x} ${y})"><rect x="${-width/2}" y="-14" width="${width}" height="30" rx="15" fill="#fff9e9" stroke="#d4d9c0"/><text text-anchor="middle" y="5" fill="#385749" font-size="12" font-weight="600">${esc(label)}</text><path d="M-4 16L0 21L4 16" fill="#fff9e9"/></g>`;}
const scene=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1250 800" id="world-scene" aria-labelledby="scene-title scene-description" role="img"><title id="scene-title">MY RP representative Nigerian neighbourhood</title><desc id="scene-description">An isometric street with a starter home, school, community clinic, produce market, work desk, yellow bus, palm trees, and adult citizens. Use the labelled location controls to explore.</desc><defs><radialGradient id="backdrop"><stop stop-color="#f7edce"/><stop offset="1" stop-color="#edf0df"/></radialGradient></defs><rect width="1250" height="800" fill="url(#backdrop)"/>${ground}<g class="scene-detail">${objects.map(o=>o.art).join('')}</g>${guide}<g id="player" transform="translate(${p(7,7).join(' ')})"><ellipse rx="14" ry="6" fill="#284e4633"/><ellipse rx="21" ry="11" fill="none" stroke="#f8f5d0" stroke-width="2"/><path d="M-4-6L-5 0M4-6L5 0" stroke="#2e4858" stroke-width="5" stroke-linecap="round"/><path d="M-8-22L-10-9M8-22L10-9" stroke="#875735" stroke-width="4" stroke-linecap="round"/><rect x="-8" y="-25" width="16" height="20" rx="5" fill="#3b9291"/><circle cy="-32" r="8" fill="#875735"/><path d="M-8-33Q-6-43 4-39L8-33" fill="#2c2928"/><path d="M-3-25V-14" stroke="#f6ead0" stroke-width="2"/></g>${markers}</svg>`;
const [css,js,template]=await Promise.all(['style.css','app.js','template.html'].map(n=>readFile(new URL(n,root),'utf8')));
const hash=s=>`'sha256-${createHash('sha256').update(s).digest('base64')}'`;
const script=`const LAYOUT = ${JSON.stringify(layout)};\n${js}`;
const csp=`default-src 'none'; script-src ${hash(script)}; style-src ${hash(css)}; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;
const html=template.replace('<!--STYLE-->',`<style>${css}</style>`).replace('<!--SCENE-->',scene).replace('<!--SCRIPT-->',`<script>${script}</script>`).replace('<!--CSP-->',esc(csp));
await writeFile(new URL('preview.html',root),html);
await writeFile(new URL('scene.svg',root),scene);
await writeFile(new URL('security.json',root),JSON.stringify({csp}));
console.log(`Built playable preview: ${Buffer.byteLength(html)} bytes. No external assets or database connection.`);
