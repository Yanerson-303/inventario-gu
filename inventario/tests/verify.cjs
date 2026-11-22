// Pruebas sin dependencias: ejecutar `node tests/verify.cjs`.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {webcrypto}=require('node:crypto');
const folder=path.resolve(__dirname,'..','..','public');
const main={};
const context={window:main, console,Number,Math,Object,Array,String,Intl};
vm.runInNewContext(fs.readFileSync(path.join(folder,'calc.js'),'utf8'),context);
const Calc=main.AlmendraCalc;
const product={id:'p1',name:'Producto de prueba',quantityN:4,quantityV:6,value:10,average:2,boxes:5};
const data={periods:[{id:'w1'},{id:'w2'},{id:'w3'},{id:'w4'},{id:'w5'}],movements:{w1:{p1:{c1:3,c2:2}},w2:{p1:{c1:13}}}};
let x=Calc.result(data,product);
assert.equal(x.weekly[0],5,'CX debe sumar los espacios de la semana');
assert.equal(x.H,18,'H debe sumar las cinco semanas');
assert.equal(x.J,10,'J debe sumar L y M');
assert.equal(x.N,8,'N debe ser H−J');
assert.equal(x.P,80,'P debe ser N×O');
assert.equal(x.Q,8);assert.equal(x.R,-8);assert.equal(x.T,-4);
assert.equal(x.V,'-1 / 2','COCIENTE(-8,5) y RESIDUO(-8,5)');
x=Calc.result(data,{...product,average:0,boxes:0});
assert.equal(x.T,null);assert.equal(x.V,null);
assert.equal(Calc.totals(data,[product]).quantity,18);
console.log('✓ 12 comprobaciones de fórmulas completadas.');

// Smoke-test de UI con elementos falsos: detecta referencias faltantes y errores de render.
const elements=new Map();const handlers={};let lastSaved=null,backups=[];
function element(q){if(!elements.has(q))elements.set(q,{innerHTML:'',textContent:'',className:'',content:'',disabled:false,addEventListener(type,fn){handlers[q+':'+type]=fn;},classList:{toggle(){},contains(){return false;}},setAttribute(){},remove(){},append(){},focus(){},querySelector(){return null;}});return elements.get(q);}
const d={cookie:'',body:{dataset:{}},addEventListener(type,fn){handlers[type]=fn;},querySelector:element,querySelectorAll(){return [];},createElement(tag){return {className:'',textContent:'',append(){},remove(){},click(){}};}};
const DB={load:async()=>null,save:async s=>{lastSaved=s;},backups:async()=>backups,getBackup:async id=>backups.find(b=>b.id===id),backup:async b=>{backups.push(b);},deleteBackup:async id=>{backups=backups.filter(x=>x.id!==id);}};
const ctx={window:{AlmendraDB:DB,AlmendraCalc:Calc,AlmendraCharts:{bars(){},horizontal(){},line(){}},addEventListener(){} ,scrollTo(){}},document:d,navigator:{},crypto:webcrypto,location:{protocol:'file:',hostname:''},localStorage:{setItem(){}},console,Number,Math,Object,Array,String,Intl,Date,JSON,Promise,setTimeout,clearTimeout,requestAnimationFrame:fn=>fn(),confirm:()=>true,URL,Blob,TextEncoder,TextDecoder};
vm.runInNewContext(fs.readFileSync(path.join(folder,'insights.js'),'utf8'),ctx);
vm.runInNewContext(fs.readFileSync(path.join(folder,'metric-visuals.js'),'utf8'),ctx);
ctx.window.GUIcons={svg(){return '<svg></svg>';},enhance(){}};
vm.runInNewContext(fs.readFileSync(path.join(folder,'app.js'),'utf8'),ctx);
function click(kind,data){const e={target:{closest(query){if(query==='[data-action]'&&kind==='action')return {dataset:data};if(query==='[data-nav]'&&kind==='nav')return {dataset:data};if(query==='[data-period-tab]'&&kind==='period')return {dataset:data};return null;}}};return handlers.click(e);}
(async()=>{
 await new Promise(r=>setTimeout(r,40));
 assert.match(element('#main-content').innerHTML,/Panel de control/);
 await click('action',{action:'demo'});
 assert.match(element('#main-content').innerHTML,/>6<\/div>/); // conteo del catálogo
 await click('nav',{nav:'weekly'});
 assert.match(element('#main-content').innerHTML,/data-edit="movement"/);
 await click('nav',{nav:'final'});
 assert.match(element('#main-content').innerHTML,/Cantidad.N/);
 await click('nav',{nav:'backup'});
 assert.match(element('#main-content').innerHTML,/Cifrar y descargar/);
 await click('nav',{nav:'clients'});
 assert.match(element('#main-content').innerHTML,/A-100/);
 await click('action',{action:'add-client'});
 assert.match(element('#main-content').innerHTML,/A-101/);
 await click('nav',{nav:'settings'});
 assert.match(element('#main-content').innerHTML,/Rojo y oro/);
 await new Promise(r=>setTimeout(r,350));
 assert.equal(lastSaved.products.length,6);
 assert.equal(lastSaved.clients.length,101);
 console.log('✓ Renderizado inicial, demostración, 6 vistas, ampliación de clientes, auto-guardado.');
 const firstProduct=lastSaved.products[0].id;
 await click('action',{action:'remove-product',id:firstProduct});
 await new Promise(r=>setTimeout(r,350));
 assert.equal(lastSaved.products.length,5);
 assert(backups.some(b=>b.label.startsWith('Copia preventiva')&&b.data.products.length===6));
 console.log('✓ La eliminación genera copia preventiva y conserva recuperación del catálogo.');
})().catch(err=>{console.error(err);process.exitCode=1;});
