/* Recepciones, ubicaciones y ventas por lote. */
(function(){
'use strict';
const round=n=>Math.round((n+Number.EPSILON)*1e6)/1e6;
function balance(state){
 const sold=new Map();
 for(const sale of state.sales||[]){
  if(sale.lotId&&!sale.voided)sold.set(sale.lotId,round((sold.get(sale.lotId)||0)+sale.units));
 }
 return new Map((state.lots||[]).map(lot=>[lot.id,round(lot.units-(sold.get(lot.id)||0))]));
}
function location(lot){return lot.moves.at(-1)||lot.receipt;}
function label(place){return place.area+(place.rack?` · Rack ${place.rack} · Nivel ${place.level} · Posición ${place.position}`:' · Sin estantería');}
function lotKey(lot){return JSON.stringify([lot.productId,lot.container.toLocaleLowerCase('es'),lot.code.toLocaleLowerCase('es')]);}
function calendarDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T00:00:00Z');
 return Number.isFinite(+date)&&date.toISOString().slice(0,10)===value;
}
function validate(state){
 const grouped=new Map(),keys=new Set();
 for(const lot of state.lots||[]){
  const key=lotKey(lot);
  if(keys.has(key))throw new Error('El mismo producto, contenedor y lote aparecen en dos recepciones.');
  keys.add(key);grouped.set(lot.id,lot);
 }
 const remaining=balance(state);
 for(const sale of state.sales||[]){
  if(!sale.lotId)continue;
  const lot=grouped.get(sale.lotId);
  if(!lot||lot.productId!==sale.productId||sale.date<lot.receipt.date)throw new Error('Una venta tiene un lote incompatible con su producto o fecha.');
  if(remaining.get(lot.id)<0)throw new Error('Las ventas superan las unidades recibidas del lote '+lot.code+'.');
 }
}
function warehouse(state){
 const racks=[[],[],[]],remaining=balance(state),products=new Map(state.products.map(p=>[p.id,p.name]));
 const tracked=new Set((state.lots||[]).map(lot=>lot.productId));
 const legacy=(state.gu4?.locations||[]).filter(loc=>!tracked.has(loc.productId));
 for(const loc of legacy){
  const name=products.get(loc.productId),rack=racks[loc.rack-1];
  if(name&&rack&&loc.qty>0)rack.push({name,qty:Number(loc.qty),level:loc.level,position:loc.position});
 }
 for(const lot of state.lots||[]){
  const place=location(lot),qty=remaining.get(lot.id),rack=racks[place.rack-1];
  if(rack&&qty>0)rack.push({name:products.get(lot.productId)||lot.productName,qty,level:place.level,position:place.position,lot:lot.code,container:lot.container,area:place.area});
 }
 const totals=racks.map(rack=>round(rack.reduce((sum,entry)=>sum+entry.qty,0)));
 const positions=racks.map(rack=>[...new Map(rack.map(entry=>[`${entry.level}-${entry.position}`,{level:entry.level,position:entry.position}])).values()]);
 return {racks,totals,positions};
}
function soldOut(lot,sales){
 if(!lot)return null;
 const dated=sales.filter(s=>!s.voided&&s.lotId===lot.id).sort((a,b)=>a.date.localeCompare(b.date));
 let remaining=lot.units;
 for(const sale of dated){
  remaining=round(remaining-sale.units);
  if(remaining<=0)return {date:sale.date,days:(Date.parse(sale.date)-Date.parse(lot.receipt.date))/86400000};
 }
 return null;
}
window.GUTrace={balance,location,label,lotKey,calendarDate,validate,warehouse,soldOut};
})();