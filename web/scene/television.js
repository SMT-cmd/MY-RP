import * as THREE from 'three';
// Original animated programmes. No external video, player data, tracking or audio.
export function televisionSurface(){
 const canvas=typeof document==='undefined'?null:document.createElement('canvas');if(canvas){canvas.width=384;canvas.height=216;}
 const context=canvas?.getContext('2d'),texture=canvas?new THREE.CanvasTexture(canvas):new THREE.DataTexture(new Uint8Array([5,8,14,255]),1,1);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
 const material=new THREE.MeshStandardMaterial({color:0xffffff,map:texture,emissive:0xffffff,emissiveMap:texture,emissiveIntensity:.45,roughness:.35});let last=-Infinity;
 return{material,update(screen,time,reduced=false){if(!context||time-last<200)return;last=time;const c=context;c.fillStyle='#050a12';c.fillRect(0,0,384,216);if(!screen?.enabled){c.fillStyle='#526074';c.font='16px sans-serif';c.fillText('MY RP',160,112);texture.needsUpdate=true;return;}
  const t=reduced?0:time/1000;
  if(screen.channel==='nature'){c.fillStyle='#75b8d8';c.fillRect(0,0,384,216);c.fillStyle='#f9d789';c.beginPath();c.arc(295,56,24,0,Math.PI*2);c.fill();for(let i=0;i<4;i++){c.fillStyle=['#507d71','#477566','#2e645a','#194d49'][i];c.beginPath();c.moveTo(0,216);for(let x=0;x<=384;x+=8)c.lineTo(x,110+i*20+Math.sin(x*.016+i+t*.06)*22);c.lineTo(384,216);c.fill();}}
  else if(screen.channel==='learning'){c.fillStyle='#183851';c.fillRect(0,0,384,216);c.fillStyle='#efbe6c';c.font='bold 24px sans-serif';c.fillText('A life in Nigeria',20,75);c.fillStyle='#f0f4f6';c.font='18px sans-serif';const facts=['36 states and the FCT','Learn. Work. Build a home.','Virtual money has no cash value.'];c.fillText(facts[Math.floor(t/7)%facts.length],20,118);}
  else{c.fillStyle='#13283e';c.fillRect(0,0,384,216);for(let i=0;i<9;i++){c.fillStyle=i%2?'#426376':'#305063';c.fillRect(i*48,90-(i%3)*20,38,100);c.fillStyle='#dba95b';for(let y=90-(i%3)*20;y<175;y+=18)c.fillRect(i*48+8,y+7,7,7);}c.fillStyle='#e6b261';c.fillRect((t*24)%440-40,166,38,13);c.fillStyle='#f8f4e9';c.font='bold 22px sans-serif';c.fillText('YOUR CITY. YOUR STORY.',18,39);}
  c.fillStyle='#08131ed9';c.fillRect(0,190,384,26);c.fillStyle='#e9eef5';c.font='12px sans-serif';c.fillText('MY RP · original in-game programme · silent',12,208);texture.needsUpdate=true;
 },dispose(){texture.dispose();material.dispose();}};
}
export function updateTelevisions(objects,fixtures,time,reduced){for(const object of objects??[]){const screen=object.userData.television;if(screen)screen.update(fixtures.find(f=>f.id===object.userData.televisionId)?.screen,time,reduced);}}
