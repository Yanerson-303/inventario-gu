const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const folder=path.resolve(__dirname,'..');
const win={};
const scope={window:win,Date,Number,Math,Intl};
for(const f of ['calc.js','insights.js'])vm.runInNewContext(fs.readFileSync(path.join(folder,f),'utf8'),scope);
const C=win.AlmendraCalc,I=win.GUIInsights;
const state={
 products:[
 {id:'p1',name:'Artículo A',quantityN:5,quantityV:2,value:100,average:0,boxes:0},
 {id:'p2',name:'Artículo B',quantityN:0,quantityV:0,value:20,average:1,boxes:10},
 {id:'p3',name:'Artículo C',quantityN:0,quantityV:0,value:15,average:1,boxes:12}],
 periods:[{id:'w1',label:'Primero',start:'2026-11-01',end:'2026-11-07'},
          {id:'w2',label:'Segundo',start:'2026-02-30',end:'2026-03-07'}],
 movements:{w1:{p1:{c1:3},p3:{c1:1}},w2:{p1:{c1:2},p3:{c1:1}}}
};
const before=JSON.stringify(state);
const a=I.analyze(state,C,C.totals(state,state.products).rows);
assert.equal(a.productCount,3);
assert.equal(a.referenced,2);
assert.equal(a.dated,1);
assert.equal(a.counts.negative,1);
assert.equal(a.counts.zero,1);
assert.equal(a.counts.boxes,1);
assert.equal(a.counts.average,1);
assert.equal(a.counts.unregistered,1);
assert.equal(a.issues.length,5);
const comp=I.comparison(state,C);
assert.equal(comp.previous,4);
assert.equal(comp.current,3);
assert.equal(comp.difference,-1);
assert.equal(comp.percent,-25);
assert.equal(JSON.stringify(state),before,'Los diagnósticos son de solo lectura');
assert.equal(I.comparison({...state,periods:[state.periods[0]]},C),null);
console.log('✓ Diagnósticos, fechas inválidas, comparación y no-mutación: 12 comprobaciones.');
