/*
  Almacenamiento en cascada:
  1) IndexedDB (durable y apto para inventarios).
  2) localStorage (alternativa persistente de capacidad limitada).
  3) Memoria (solo vista previa; no persiste tras recargar).
  La selección se hace una vez. Nunca se presenta la memoria como almacenamiento permanente.
*/
(function(){
'use strict';
const NAME='almendra_inventory_v1';
const MAIN_KEY=NAME+'_main';
const BACKUPS_KEY=NAME+'_backups';
const DRIVE_KEY=NAME+'_drive';
let selected=null, selection=null, dbPromise=null;
const memory={main:null,backups:{},drive:null};
const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));

function idb(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){
      reject(new Error('IndexedDB no disponible'));
      return;
    }
    let req;
    try{req=window.indexedDB.open(NAME,1);}catch(err){reject(err);return;}
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains('settings'))db.createObjectStore('settings');
      if(!db.objectStoreNames.contains('backups'))db.createObjectStore('backups',{keyPath:'id'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('No se pudo abrir IndexedDB'));
    req.onblocked=()=>reject(new Error('Otra pestaña bloqueó IndexedDB'));
  });
  return dbPromise;
}
function testLocalStorage(){
  try{
    const store=window.localStorage;
    const probe=NAME+'_probe';
    store.setItem(probe,'ok');
    if(store.getItem(probe)!=='ok')return null;
    store.removeItem(probe);
    return store;
  }catch{return null;}
}
function choose(){
  if(selection)return selection;
  selection=(async()=>{
    try{
      await idb();
      selected={kind:'indexeddb',persistent:true};
    }catch(error){
      const ls=testLocalStorage();
      if(ls)selected={kind:'localStorage',persistent:true,store:ls,reason:String(error?.message||error)};
      else selected={kind:'memory',persistent:false,reason:String(error?.message||error)};
    }
    return selected;
  })();
  return selection;
}
function indexedRequest(store,mode,action){
  return idb().then(db=>new Promise((resolve,reject)=>{
    let tx;
    try{tx=db.transaction(store,mode);}catch(err){reject(err);return;}
    let result;
    const request=action(tx.objectStore(store));
    request.onsuccess=()=>{result=request.result;};
    request.onerror=()=>reject(request.error||new Error('Error de almacenamiento'));
    tx.oncomplete=()=>resolve(result);
    tx.onerror=()=>reject(tx.error||new Error('Error en la transacción'));
    tx.onabort=()=>reject(tx.error||new Error('Transacción cancelada'));
  }));
}
function localRead(store,key,defaultValue){
  const raw=store.getItem(key);
  return raw===null?copy(defaultValue):JSON.parse(raw);
}
function localWrite(store,key,value){
  try{store.setItem(key,JSON.stringify(value));}
  catch(e){
    if(e?.name==='QuotaExceededError')throw new Error('El almacenamiento alternativo está lleno. Descarga una copia JSON y utiliza la aplicación en HTTPS para usar IndexedDB.');
    throw e;
  }
}
async function run(action,...args){
  const backend=await choose();
  if(backend.kind==='indexeddb'){
    switch(action){
      case 'load':return indexedRequest('settings','readonly',s=>s.get('main'));
      case 'save':return indexedRequest('settings','readwrite',s=>s.put(copy(args[0]),'main'));
      case 'driveLink':return indexedRequest('settings','readonly',s=>s.get('drive'));
      case 'saveDriveLink':return indexedRequest('settings','readwrite',s=>s.put(copy(args[0]),'drive'));
      case 'applyDrive':return indexedRequest('settings','readwrite',s=>{
        s.put(copy(args[0]),'main');
        return s.put(copy(args[1]),'drive');
      });
      case 'backup':return indexedRequest('backups','readwrite',s=>s.put(copy(args[0])));
      case 'backups':return (await indexedRequest('backups','readonly',s=>s.getAll())).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
      case 'getBackup':return indexedRequest('backups','readonly',s=>s.get(args[0]));
      case 'deleteBackup':return indexedRequest('backups','readwrite',s=>s.delete(args[0]));
    }
  }
  const store=backend.store;
  if(action==='driveLink')return backend.kind==='memory'?copy(memory.drive):localRead(store,DRIVE_KEY,null);
  if(action==='saveDriveLink'){
    if(backend.kind==='memory')memory.drive=copy(args[0]);else localWrite(store,DRIVE_KEY,args[0]);
    return;
  }
  if(action==='applyDrive'){
    if(!backend.persistent)throw new Error('No hay almacenamiento persistente para cargar el inventario de Drive.');
    const previous=store.getItem(DRIVE_KEY);
    localWrite(store,DRIVE_KEY,args[1]);
    try{localWrite(store,MAIN_KEY,args[0]);}catch(error){
      if(previous===null)store.removeItem(DRIVE_KEY);else store.setItem(DRIVE_KEY,previous);
      throw error;
    }
    return;
  }
  if(action==='load')return copy(backend.kind==='memory'?memory.main:localRead(store,MAIN_KEY,null));
  if(action==='save'){
    if(backend.kind==='memory')memory.main=copy(args[0]);
    else localWrite(store,MAIN_KEY,args[0]);
    return;
  }
  const backups=backend.kind==='memory'?memory.backups:localRead(store,BACKUPS_KEY,{});
  if(action==='backups')return Object.values(backups).map(copy).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  if(action==='getBackup')return copy(backups[args[0]]);
  if(action==='backup')backups[args[0].id]=copy(args[0]);
  if(action==='deleteBackup')delete backups[args[0]];
  if(backend.kind!=='memory')localWrite(store,BACKUPS_KEY,backups);
}
window.AlmendraDB={
  load:()=>run('load'),
  save:data=>run('save',data),
  driveLink:()=>run('driveLink'),
  saveDriveLink:link=>run('saveDriveLink',link),
  applyDrive:(data,link)=>run('applyDrive',data,link),
  backup:data=>run('backup',data),
  backups:()=>run('backups'),
  getBackup:key=>run('getBackup',key),
  deleteBackup:key=>run('deleteBackup',key),
  mode:()=>selected?.kind||'checking',
  persistent:()=>Boolean(selected?.persistent),
  reason:()=>selected?.reason||''
};
})();
