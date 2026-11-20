// Prueba del problema original: Web Preview bloquea IndexedDB con SecurityError.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../db.js'),'utf8');

async function check(mode){
 const records=new Map();
 function windowMock(){
   const window={};
   Object.defineProperty(window,'indexedDB',{get(){throw new DOMException('IDBFactory.open() called in an invalid security context','SecurityError')}});
   if(mode==='blocked')Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage denied','SecurityError')}});
   else window.localStorage={setItem:(k,v)=>records.set(k,v),getItem:k=>records.get(k)??null,removeItem:k=>records.delete(k)};
   return window;
 }
 function createDb(){const window=windowMock();vm.runInNewContext(source,{window,DOMException,Promise,JSON,Object,String});return window.AlmendraDB;}
 const db=createDb();
 assert.equal(await db.load(),null);
 assert.equal(db.mode(),mode==='blocked'?'memory':'localStorage');
 assert.equal(db.persistent(),mode!=='blocked');
 await db.save({products:[{id:'p1',name:'Producto de prueba'}],quantity:7});
 assert.equal((await db.load()).products[0].name,'Producto de prueba');
 await db.backup({id:'b1',type:'manual',createdAt:'2026-11-20T10:00:00Z',data:{quantity:7}});
 assert.equal((await db.backups()).length,1);
 assert.equal((await db.getBackup('b1')).data.quantity,7);
 await db.deleteBackup('b1');
 assert.equal((await db.backups()).length,0);
 if(mode==='blocked')assert.equal(await createDb().load(),null,'el modo temporal nunca finge persistencia');
 else assert.equal((await createDb().load()).quantity,7,'localStorage debe persistir al recargar');
 console.log('✓',mode,'carga, escritura, respaldo, restauración y retención');
}
(async()=>{await check('blocked');await check('local')})().catch(e=>{console.error(e);process.exitCode=1;});
