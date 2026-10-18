(()=>{
 let host=null;
 window.DrivingUI={render(view,send,locked){if(!host){host=document.createElement('div');host.id='driving-status';document.getElementById('mobility-records').before(host);}const w=view.world,d=w?.driving;host.hidden=!d;host.replaceChildren();if(!d)return;const button=(label,type,payload={})=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=locked;b.onclick=()=>send(type,{...payload,leaseVersion:w.position.leaseVersion});host.append(b);};
 if(d.active){const p=document.createElement('p');p.textContent=d.active.shuttle?'On the complimentary showroom shuttle.':'Driving: choose a road destination. Stop before getting out.';host.append(p);if(w.navigation)button('Brake / stop route','StopNavigation');else button('Park and step out','ExitVehicle');}
 else{if(d.shuttle)button(d.shuttle.name+' · free','BeginShowroomShuttle',{destination:d.shuttle.destination});for(const v of d.available.filter(v=>v.nearby&&!v.driving&&!v.parkedAtHome))button('Enter '+v.model,'EnterVehicle',{vehicleId:v.vehicleId});}
 }};
})();
