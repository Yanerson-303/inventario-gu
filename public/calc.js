/* Motor de fórmulas: réplica de Final!H,J,N,P,Q,R,T,V del documento técnico. */
(function(){
'use strict';
const num=value=>{const n=Number(value);return Number.isFinite(n)?n:0;};
const round=value=>Math.round((value+Number.EPSILON)*1e9)/1e9;
const qty=(state,periodId,productId)=>Object.values(state.movements?.[periodId]?.[productId]||{}).reduce((sum,v)=>sum+num(v),0);
function result(state,product){
  const weekly=state.periods.map(period=>round(qty(state,period.id,product.id)));
  const H=round(weekly.reduce((a,b)=>a+b,0));
  const J=round(num(product.quantityN)+num(product.quantityV));
  const N=round(H-J),P=round(N*num(product.value)),Q=N,R=round(-Q);
  const avg=num(product.average),box=num(product.boxes);
  // Excel QUOTIENT: truncamiento hacia cero. Excel MOD: signo del divisor.
  const T=avg===0?null:round(R/avg);
  let V=null;
  if(box>0){const quotient=Math.trunc(R/box);const mod=round(R-box*Math.floor(R/box));V=`${quotient} / ${mod}`;}
  return {weekly,H,G:H,J,N,P,Q,R,T,V,hasInvalidBox:box<=0,hasInvalidAvg:avg===0};
}
function totals(state,products){
  const rows=products.map(p=>({product:p,...result(state,p)}));
  return {rows,quantity:round(rows.reduce((s,r)=>s+r.H,0)),balance:round(rows.reduce((s,r)=>s+r.N,0)),value:round(rows.reduce((s,r)=>s+r.P,0)),negative:rows.filter(r=>r.N<0).length};
}
window.AlmendraCalc={num,round,qty,result,totals};
})();
