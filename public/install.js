/* Instalación PWA y preparación offline. Sin servicios externos. */
(()=>{'use strict';
let promptEvent=null;const $=s=>document.querySelector(s);
const secure=location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname);
const status=message=>{const el=$('#install-status');if(el)el.textContent=message;};
function open(){const el=$('#install-dialog');if(!el)return;el.hidden=false;status(!secure?'Abre la aplicación desde HTTPS o localhost para activar instalación y uso offline.':navigator.serviceWorker?.controller?'Lista para funcionar sin conexión en este navegador.':'Pulsa «Preparar uso sin internet» y espera la confirmación.');$('#install-now').hidden=!promptEvent;$('#install-cache').disabled=!secure;}
function close(){$('#install-dialog').hidden=true;}
async function offlineRequest(task,timeoutMessage){
 let timer;
 try{
  return await Promise.race([task,new Promise((_,reject)=>{
   timer=setTimeout(()=>reject(new Error(timeoutMessage)),30000);
  })]);
 }finally{clearTimeout(timer);}
}
async function prepareOffline(button){
 if(!secure||!('serviceWorker'in navigator)){
  status('La preparación offline requiere HTTPS o localhost y un navegador compatible.');return;
 }
 button.disabled=true;status('Guardando los archivos para usarlos sin internet…');
 let channel;
 try{
  const registration=await navigator.serviceWorker.register('./sw.js');
  const worker=registration.active||(await offlineRequest(navigator.serviceWorker.ready,'La aplicación no terminó de instalarse. Revisa la conexión e inténtalo de nuevo.')).active;
  channel=new MessageChannel();
  await offlineRequest(new Promise((resolve,reject)=>{
   channel.port1.onmessage=event=>{
    if(event.data?.ok)resolve();
    else reject(new Error(event.data?.error||'No se guardaron todos los archivos.'));
   };
   worker.postMessage({type:'CACHE_OFFLINE'},[channel.port2]);
  }),'El navegador no confirmó la descarga de los archivos.');
  status('Archivos guardados. Prueba desactivar internet y volver a abrir la aplicación.');
 }catch(error){status('Error al preparar: '+error.message);}
 finally{channel?.port1.close();button.disabled=false;}
}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptEvent=e;});
window.addEventListener('appinstalled',()=>{promptEvent=null;status('Aplicación instalada.');});
window.GUInstall={open};
document.addEventListener('DOMContentLoaded',()=>{$('#install-close')?.addEventListener('click',close);$('#install-dialog')?.addEventListener('click',e=>{if(e.target.id==='install-dialog')close();});
$('#install-now')?.addEventListener('click',async()=>{if(!promptEvent){status('En iPhone usa Safari → Compartir → Añadir a pantalla de inicio. En PC o Android usa el menú del navegador para instalar.');return;}const e=promptEvent;promptEvent=null;await e.prompt();const result=await e.userChoice;status(result.outcome==='accepted'?'Instalación aceptada.':'Puedes instalarla después desde el menú del navegador.');});
$('#install-cache')?.addEventListener('click',event=>prepareOffline(event.currentTarget));
$('#install-storage')?.addEventListener('click',async()=>{if(!navigator.storage?.persist){status('Tu navegador no permite solicitar almacenamiento persistente. Descarga copias JSON con regularidad.');return;}try{const ok=await navigator.storage.persist();status(ok?'El navegador concedió almacenamiento persistente. Sigue haciendo copias JSON.':'No se concedió persistencia. Guarda respaldos JSON fuera del navegador.');}catch(e){status('No fue posible solicitar persistencia: '+e.message);}});
});
})();
