/* Inventarios GU 3.0: diagnósticos no destructivos. Nunca modifica datos ni fórmulas. */
(function(){'use strict';
const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const label=name=>String(name||'Producto sin nombre');
const strictDate=s=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const [y,m,d]=s.split('-').map(Number),dt=new Date(Date.UTC(y,m-1,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d;};
function analyze(state,Calc,rows){
 const products=Array.isArray(state.products)?state.products:[];
 const periods=Array.isArray(state.periods)?state.periods:[];
 const categories=[
 {id:'negative',name:'Saldo negativo',level:'danger',description:'Requiere verificar el origen de las cantidades.'},
 {id:'zero',name:'Saldo en cero',level:'warn',description:'Productos sin saldo calculado.'},
 {id:'boxes',name:'Cajas sin definir',level:'warn',description:'No se puede desglosar el saldo por cajas.'},
 {id:'average',name:'Promedio sin definir',level:'info',description:'No se puede calcular la relación R / S.'},
 {id:'unregistered',name:'Sin movimientos',level:'info',description:'Referencias sin cantidades en los períodos.'}
 ];
 const issues=[];
 let referenced=0;
 const byId=Array.isArray(rows)?new Map(rows.map(r=>[r.product?.id,r])):null;
 const push=(id,p,detail)=>issues.push({id,productId:p.id,name:label(p.name),detail});
 for(const p of products){
   const r=byId?.get(p.id)||Calc.result(state,p),N=finite(r.N),H=finite(r.H);
   if(H!==0)referenced++;
   if(N<0)push('negative',p,`Saldo ${N}`);
   if(N===0)push('zero',p,'Saldo calculado: 0');
   if(N!==0&&finite(p.boxes)<=0)push('boxes',p,'Unidades por caja sin valor positivo');
   if(N!==0&&finite(p.average)===0)push('average',p,'Promedio S sin configurar');
   if(H===0)push('unregistered',p,'Ningún movimiento registrado');
 }
 const dates=periods.map(p=>{
   if(!strictDate(p.start)||!strictDate(p.end))return false;
   const start=new Date(p.start+'T12:00:00'),end=new Date(p.end+'T12:00:00');
   const days=Math.round((end-start)/86400000)+1;
   return days>0&&days<=366;
 });
 const counts=Object.fromEntries(categories.map(c=>[c.id,issues.filter(i=>i.id===c.id).length]));
 return {categories,issues,counts,productCount:products.length,referenced,dated:dates.filter(Boolean).length,periodCount:periods.length,
 critical:counts.negative,unconfigured:counts.boxes+counts.average};
}
function comparison(state,Calc){
 const periods=state.periods||[];
 if(periods.length<2)return null;
 const total=p=>(state.products||[]).reduce((sum,product)=>sum+finite(Calc.qty(state,p.id,product.id)),0);
 const previous=periods.at(-2),current=periods.at(-1);
 const a=total(previous),b=total(current),diff=b-a,pct=a!==0?diff/Math.abs(a)*100:null;
 return {previousLabel:previous.label,currentLabel:current.label,previous:a,current:b,difference:diff,percent:pct};
}
window.GUIInsights={analyze,comparison};
})();
