/* Cache-first para archivos versionados; navegación con respaldo offline. */
const VERSION='inventarios-gu-v8.6-2026-11-25-proyecciones';
const CORE=['./','./index.html','./styles.css','./ux.css','./gu4.css','./gu4-boot.css','./gu4-boot.js','./ui.js','./motion.js','./db.js','./calc.js','./charts.js','./chart-hover.js','./metric-visuals.js','./trace.js','./warehouse.js','./gu4-core.js','./gu4-views.js','./vendor/html2canvas.min.js','./jszip.min.js','./gu4-excel.js','./drive.js','./app.js','./insights.js','./icons.js','./install.js','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest','./descargas/Inventarios_GU_PC.html'];
async function prepare(){const cache=await caches.open(VERSION);await cache.addAll(CORE);const missing=await Promise.all(CORE.map(url=>cache.match(url).then(x=>!x)));if(missing.some(Boolean))throw new Error('Faltan archivos sin conexión.');return true;}
self.addEventListener('install',event=>event.waitUntil(prepare().then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('inventarios-gu-')&&k!==VERSION).map(k=>caches.delete(k)));await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data?.type==='CACHE_OFFLINE'){event.waitUntil(prepare().then(()=>event.ports[0]?.postMessage({ok:true})).catch(error=>event.ports[0]?.postMessage({ok:false,error:String(error)})));}});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 event.respondWith((async()=>{
  const cache=await caches.open(VERSION).catch(()=>null);
  const cached=await cache?.match(req,{ignoreSearch:true}).catch(()=>undefined);
  if(req.mode!=='navigate'&&cached)return cached;
  try{
   const response=await fetch(req);
   if(response.ok&&cache)await cache.put(req,response.clone()).catch(()=>{});
   return response;
  }catch{
   if(cached)return cached;
   const home=req.mode==='navigate'&&['./','./index.html'].some(path=>new URL(path,self.registration.scope).pathname===url.pathname);
   return (home&&await cache?.match('./index.html').catch(()=>undefined))||Response.error();
  }
 })());
});
