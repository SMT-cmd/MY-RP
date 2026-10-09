(()=>{
 let prompt=null;
 const status=message=>{const output=document.getElementById('pwa-status');if(output)output.textContent=message;};
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;const button=document.getElementById('install-game');if(button)button.hidden=false;});
 window.addEventListener('appinstalled',()=>{prompt=null;const button=document.getElementById('install-game');if(button)button.hidden=true;status('Game installed. A connection is required for saved actions.');});
 document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('install-game')?.addEventListener('click',async()=>{if(!prompt)return;const current=prompt;prompt=null;try{await current.prompt();const choice=await current.userChoice;status(choice.outcome==='accepted'?'Installation requested.':'Installation dismissed.');}catch{status('Use your browser menu to install when available.');}document.getElementById('install-game').hidden=true;});
  if(!window.isSecureContext||!('serviceWorker' in navigator))return;
  navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(registration=>{
   status(registration.active?'Public offline help is available. Saved actions need a connection.':'Saving public offline help…');
   const watch=()=>{const worker=registration.installing;if(!worker)return;const changed=()=>{if(worker.state==='installed')status(navigator.serviceWorker.controller?'An update is ready. Finish pending actions, then close and reopen your game tabs.':'Public offline help is available. Saved actions need a connection.');if(worker.state==='redundant')status('Offline help could not be saved. The connected game remains available.');};worker.addEventListener('statechange',changed);changed();};
   registration.addEventListener('updatefound',watch);watch();
  }).catch(()=>status('Offline help could not be saved. The connected game remains available.'));
 });
})();
