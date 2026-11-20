/* Instalación PWA y preparación offline. Sin servicios externos. */
(()=>{'use strict';
let promptEvent=null;const $=s=>document.querySelector(s);
const secure=location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname);
const status=message=>{const el=$('#install-status');if(el)el.textContent=message;};
function network(){const el=$('#network-state');if(!el)return;const online=navigator.onLine;el.textContent=online?'● En línea':'● Sin internet';el.classList.toggle('offline',!online);}
function open(){const el=$('#install-dialog');if(!el)return;el.hidden=false;status(!secure?'Abre la aplicación desde HTTPS o localhost para activar instalación y uso offline.':navigator.serviceWorker?.controller?'Lista para funcionar sin conexión en este navegador.':'Pulsa «Preparar uso sin internet» y espera la confirmación.');$('#install-now').hidden=!promptEvent;$('#install-cache').disabled=!secure;}
function close(){$('#install-dialog').hidden=true;}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptEvent=e;});
window.addEventListener('appinstalled',()=>{promptEvent=null;status('Aplicación instalada.');});
window.addEventListener('online',network);window.addEventListener('offline',network);
document.addEventListener('DOMContentLoaded',()=>{network();$('#install-open')?.addEventListener('click',open);$('#install-close')?.addEventListener('click',close);$('#install-dialog')?.addEventListener('click',e=>{if(e.target.id==='install-dialog')close();});
$('#install-now')?.addEventListener('click',async()=>{if(!promptEvent){status('En iPhone usa Safari → Compartir → Añadir a pantalla de inicio. En PC o Android usa el menú del navegador para instalar.');return;}const e=promptEvent;promptEvent=null;await e.prompt();const result=await e.userChoice;status(result.outcome==='accepted'?'Instalación aceptada.':'Puedes instalarla después desde el menú del navegador.');});
$('#install-cache')?.addEventListener('click',async()=>{if(!secure||!('serviceWorker'in navigator)){status('La preparación offline requiere HTTPS o localhost y un navegador compatible.');return;}try{const reg=await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;const worker=reg.active||reg.waiting||reg.installing;if(worker){const channel=new MessageChannel();channel.port1.onmessage=e=>status(e.data?.ok?'Archivos guardados. Prueba desactivar internet y volver a abrir la aplicación.':'No se pudieron guardar todos los archivos: '+(e.data?.error||''));worker.postMessage({type:'CACHE_OFFLINE'},[channel.port2]);}else status('Aplicación preparada.');}catch(e){status('Error al preparar: '+e.message);}});
$('#install-storage')?.addEventListener('click',async()=>{if(!navigator.storage?.persist){status('Tu navegador no permite solicitar almacenamiento persistente. Descarga copias JSON con regularidad.');return;}try{const ok=await navigator.storage.persist();status(ok?'El navegador concedió almacenamiento persistente. Sigue haciendo copias JSON.':'No se concedió persistencia. Guarda respaldos JSON fuera del navegador.');}catch(e){status('No fue posible solicitar persistencia: '+e.message);}});
});
})();
