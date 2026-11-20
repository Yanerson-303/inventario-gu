/* Cache-first para archivos versionados; navegación con respaldo offline. */
const VERSION='almendra-app-v2.1.0';
const CORE=['./','./index.html','./styles.css','./db.js','./calc.js','./charts.js','./warehouse.js','./app.js','./install.js','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest','./descargas/Almendra_PC.html','./descargas/Almendra_Movil_iPhone_Android.html'];
async function prepare(){const cache=await caches.open(VERSION);await cache.addAll(CORE);}
self.addEventListener('install',event=>event.waitUntil(prepare().then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('almendra-app-')&&k!==VERSION).map(k=>caches.delete(k)));await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data?.type==='CACHE_OFFLINE'){event.waitUntil(prepare().then(()=>event.ports[0]?.postMessage({ok:true})).catch(error=>event.ports[0]?.postMessage({ok:false,error:String(error)})));}});
self.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET')return;const url=new URL(req.url);if(url.origin!==self.location.origin)return;
 event.respondWith((async()=>{const cache=await caches.open(VERSION);const cached=await cache.match(req,{ignoreSearch:true});
 if(req.mode==='navigate'){try{const response=await fetch(req);if(response.ok)await cache.put(req,response.clone());return response;}catch{return cached||await cache.match('./index.html')||Response.error();}}
 if(cached)return cached;try{const response=await fetch(req);if(response.ok)await cache.put(req,response.clone());return response;}catch{return Response.error();}
 })());});
