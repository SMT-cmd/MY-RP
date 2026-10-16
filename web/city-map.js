window.CityMapUI=(()=>{
 const page=document.querySelector('[data-game-page="map"]'),panel=document.createElement('section'),title=document.createElement('h3'),hint=document.createElement('p');panel.id='city-map';title.textContent='Your neighbourhood';hint.textContent='Tap a street to walk there. Tap your home or a service to visit.';panel.append(title,hint);page.prepend(panel);let view=null,canvas=null;
 if(window.CanvasRenderingContext2D){canvas=document.createElement('canvas');canvas.width=660;canvas.height=420;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Neighbourhood streets, services and your confirmed position');panel.append(canvas);}
 function paint(){const w=view?.world;if(!canvas||!w||page.hidden)return;const c=canvas.getContext('2d');if(!c)return;const sx=canvas.width/w.map.width,sy=canvas.height/w.map.height;c.clearRect(0,0,canvas.width,canvas.height);c.fillStyle='#142c2a';c.fillRect(0,0,canvas.width,canvas.height);
  for(const [i,d] of (w.map.districts??[]).entries()){c.fillStyle=i%2?'#1b3439':'#233838';c.fillRect(d.x*sx,d.y*sy,d.w*sx,d.h*sy);c.fillStyle='#849d9b';c.font='10px sans-serif';c.fillText(d.name,d.x*sx+5,canvas.height-7);}
  for(const r of w.map.roads??[]){c.fillStyle='#69727a';c.fillRect(r.x*sx,r.y*sy,r.w*sx,r.h*sy);}
  for(const b of [...w.map.buildings,...(w.map.obstacles??[]).filter(o=>o.kind!=='tree')]){c.fillStyle=b.x>=66?'#698c9f':'#ad9d84';c.fillRect(b.x*sx,b.y*sy,b.w*sx,b.h*sy);}
  if(w.residence){const b=w.residence;c.fillStyle='#e6b76b';c.fillRect(b.x*sx,b.y*sy,b.w*sx,b.h*sy);}
  c.beginPath();c.arc((w.position.x+.5)*sx,(w.position.y+.5)*sy,5,0,Math.PI*2);c.fillStyle='#fff5dd';c.fill();c.lineWidth=2;c.strokeStyle='#e6b76b';c.stroke();title.textContent=(w.region?.capital??'Your city')+' · '+w.map.width+' × '+w.map.height+' neighbourhood';
 }
 canvas?.addEventListener('click',e=>{const w=view?.world;if(!w||w.position.interior||w.trip)return;const box=canvas.getBoundingClientRect(),x=Math.floor((e.clientX-box.left)/box.width*w.map.width),y=Math.floor((e.clientY-box.top)/box.height*w.map.height),b=[...w.map.buildings.filter(b=>b.id!=='shelter'),w.residence,...(w.guestEntrances??[])].find(b=>b&&x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h);window.GameUI?.close(false);window.dispatchEvent(new CustomEvent(b?'building-select':'world-tile-select',{detail:b?{buildingId:b.id,leaseVersion:w.position.leaseVersion}:{x,y,homeId:null,leaseVersion:w.position.leaseVersion}}));});
 return{observe(next){view=next;panel.hidden=!next?.world||!!next.world.position.interior;if(!panel.hidden)paint();},paint};
})();
