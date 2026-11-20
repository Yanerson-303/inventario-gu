/* Inventarios GU 4.0 — motor independiente. No modifica las fórmulas de 3.4. */
(function(){'use strict';
const LIMIT=10000;
const validId=x=>/^[A-Za-z0-9_-]{1,110}$/.test(String(x||''));
const qty=x=>{const n=Number(x);return Number.isFinite(n)?n:0;};
const slot=x=>`${x.rack}-${x.level}-${x.position}`;
const defaultV4=()=>({version:1,locations:[],counts:[],panelOrder:[],panelSizes:{},preferences:{warningThreshold:3}});
function ensure(s){if(!s.gu4||typeof s.gu4!=='object')s.gu4=defaultV4();const d=s.gu4;
 if(!Array.isArray(d.locations))d.locations=[];if(!Array.isArray(d.counts))d.counts=[];
 if(!Array.isArray(d.panelOrder))d.panelOrder=[];if(!d.panelSizes||typeof d.panelSizes!=='object')d.panelSizes={};
 if(!d.preferences||typeof d.preferences!=='object')d.preferences={warningThreshold:3};
 if(!Number.isFinite(Number(d.preferences.warningThreshold))||Number(d.preferences.warningThreshold)<0)d.preferences.warningThreshold=3;
 d.version=1;return d;
}
function stock(s,C,pid){const p=s.products.find(p=>p.id===pid);return p?qty(C.result(s,p).N):0;}
function allocations(s,C){const d=ensure(s),map=new Map();d.locations.forEach(l=>{map.set(l.productId,(map.get(l.productId)||0)+qty(l.qty));});
 const productRows=s.products.map(p=>{const available=Math.max(0,stock(s,C,p.id)),assigned=map.get(p.id)||0;return {id:p.id,name:p.name,available,assigned,unassigned:Math.max(0,available-assigned),over:Math.max(0,assigned-available)};});
 const racks=[1,2,3].map(rack=>{const records=d.locations.filter(x=>x.rack===rack);return {rack,records,units:records.reduce((a,b)=>a+qty(b.qty),0),positions:records.length};});
 return {productRows,racks,assigned:d.locations.reduce((a,b)=>a+qty(b.qty),0),unassigned:productRows.reduce((a,b)=>a+b.unassigned,0),overassigned:productRows.filter(p=>p.over>1e-8)};
}
function setLocation(s,C,record){const d=ensure(s);let rack=Number(record.rack),level=Number(record.level),position=Number(record.position),amount=Number(record.qty),productId=String(record.productId||'');
 if(![1,2,3].includes(rack)||![1,2].includes(level)||!Number.isInteger(position)||position<1||position>8)throw new Error('Ubicación fuera de los 3 racks, 2 niveles o 8 posiciones.');
 if(!s.products.some(p=>p.id===productId))throw new Error('Selecciona un producto válido.');
 if(!Number.isFinite(amount)||amount<=0||amount>1e12)throw new Error('La cantidad debe ser positiva y válida.');
 const entry={rack,level,position,qty:amount,productId};const existing=d.locations.find(x=>slot(x)===slot(entry));
 if(existing&&existing.productId!==productId)throw new Error('Esta posición está ocupada. Libérala antes de asignar otro producto.');
 const assignedOther=d.locations.reduce((sum,x)=>sum+(x.productId===productId && slot(x)!==slot(entry)?qty(x.qty):0),0);
 if(assignedOther+amount>Math.max(0,stock(s,C,productId))+1e-8)throw new Error('La asignación supera el saldo positivo disponible del producto.');
 if(existing)Object.assign(existing,entry);else d.locations.push(entry);return entry;
}
function clearLocation(s,record){const d=ensure(s),key=slot(record);const before=d.locations.length;d.locations=d.locations.filter(x=>slot(x)!==key);return d.locations.length!==before;}
function makeCount(s,C,lines,now=new Date().toISOString(),ident='count-'+Date.now()){
 const accepted=[],seen=new Set();
 for(const l of lines){const p=s.products.find(p=>p.id===l.productId);if(!p||seen.has(p.id))throw new Error('Conteo con producto desconocido o repetido.');
 const counted=Number(l.counted);if(!Number.isFinite(counted)||counted<0||counted>1e12)throw new Error('Cantidad contada no válida.');seen.add(p.id);
 const expected=stock(s,C,p.id);accepted.push({productId:p.id,productName:p.name,expected,counted,difference:counted-expected});}
 if(!accepted.length)throw new Error('Añade un producto al conteo.');
 const entry={id:ident,createdAt:now,status:'pending',lines:accepted,appliedAt:null};ensure(s).counts.unshift(entry);ensure(s).counts=ensure(s).counts.slice(0,300);return entry;
}
function cancelCount(s,ident,now=new Date().toISOString()){
 const item=ensure(s).counts.find(c=>c.id===ident);if(!item||item.status!=='pending')throw new Error('El conteo no está pendiente.');
 item.status='cancelled';item.cancelledAt=now;return item;
}
function applyCount(s,C,ident,now=new Date().toISOString()){
 const entry=ensure(s).counts.find(x=>x.id===ident);if(!entry||entry.status!=='pending')throw new Error('Conteo no disponible o ya aplicado.');
 for(const line of entry.lines){const p=s.products.find(p=>p.id===line.productId);if(!p||Math.abs(stock(s,C,p.id)-qty(line.expected))>1e-7)throw new Error('El stock cambió desde el conteo. Crea un conteo nuevo antes de ajustar.');}
 entry.adjustments=[];
 for(const line of entry.lines){const p=s.products.find(p=>p.id===line.productId),before=qty(p.quantityN);
 // N = H - (Cantidad.N + Cantidad.V). Ajustar Cantidad.N conserva la fórmula original.
 p.quantityN=before-qty(line.difference);entry.adjustments.push({productId:p.id,before,after:p.quantityN});}
 entry.status='applied';entry.appliedAt=now;return entry;
}
function validateImport(raw,s){const existing=new Set(s.products.map(p=>p.name.trim().toLocaleLowerCase('es')));const dupe=new Set(),result=[];
 for(const row of raw.slice(0,LIMIT)){
  const name=String(row.name??'').trim().slice(0,110);if(!name)continue;
  const key=name.toLocaleLowerCase('es');const numeric=['quantityN','quantityV','value','average','boxes'];
  const product={name};
  if(Object.hasOwn(row,'category'))product.category=String(row.category||'').slice(0,70);
  if(Object.hasOwn(row,'unit'))product.unit=String(row.unit||'unidad').slice(0,30)||'unidad';
  for(const field of numeric){
   if(!Object.hasOwn(row,field)||String(row[field]).trim()==='')continue;
   const source=String(row[field]).trim().replace(',','.');const v=Number(source);
   if(!Number.isFinite(v)||Math.abs(v)>1e12)throw new Error(`Valor inválido en ${field} para ${name}.`);
   product[field]=v;
  }
  if(dupe.has(key))throw new Error(`Producto repetido dentro del archivo: ${name}.`);dupe.add(key);
  result.push({...product,exists:existing.has(key)});
 }
 if(!result.length)throw new Error('No hay productos válidos en el archivo.');return result;
}
function applyProducts(s,imported,mode,idGen,now){if(!['only-new','update'].includes(mode))throw new Error('Modo de importación inválido.');let added=0,updated=0,skipped=0;
 for(const item of imported){const p=s.products.find(p=>p.name.trim().toLocaleLowerCase('es')===item.name.toLocaleLowerCase('es'));
 const defaults={category:'',unit:'unidad',quantityN:0,quantityV:0,value:0,average:0,boxes:0};
 const fields=Object.fromEntries(['name','category','unit','quantityN','quantityV','value','average','boxes'].filter(k=>Object.hasOwn(item,k)).map(k=>[k,item[k]]));
 if(p){if(mode==='only-new'){skipped++;continue;}Object.assign(p,fields);updated++;}
 else{s.products.push({id:idGen(),createdAt:now,...defaults,...fields});added++;}}
 return {added,updated,skipped};
}
function normalizeGu4(source,s){const out=defaultV4(),input=source&&typeof source==='object'?source:{};
 const validProducts=new Set(s.products.map(p=>p.id));const occupied=new Set();
 if(Array.isArray(input.locations))for(const l of input.locations.slice(0,48)){
  if(!l||!validProducts.has(l.productId)||![1,2,3].includes(Number(l.rack))||![1,2].includes(Number(l.level))||!Number.isInteger(Number(l.position))||Number(l.position)<1||Number(l.position)>8||!Number.isFinite(Number(l.qty))||Number(l.qty)<=0)continue;
  const item={productId:l.productId,rack:Number(l.rack),level:Number(l.level),position:Number(l.position),qty:Number(l.qty)},key=slot(item);if(!occupied.has(key)){occupied.add(key);out.locations.push(item);}
 }
 if(Array.isArray(input.counts))out.counts=input.counts.slice(0,300).filter(c=>c&&validId(c.id)&&['pending','applied','cancelled'].includes(c.status)&&Array.isArray(c.lines)).map(c=>({id:c.id,createdAt:String(c.createdAt||'').slice(0,40),status:c.status,appliedAt:c.appliedAt?String(c.appliedAt).slice(0,40):null,cancelledAt:c.cancelledAt?String(c.cancelledAt).slice(0,40):null,lines:c.lines.slice(0,1000).filter(l=>l&&validId(l.productId)).map(l=>({productId:l.productId,productName:String(l.productName||'').slice(0,110),expected:qty(l.expected),counted:qty(l.counted),difference:qty(l.difference)})),adjustments:Array.isArray(c.adjustments)?c.adjustments.slice(0,1000).filter(x=>x&&validId(x.productId)).map(x=>({productId:x.productId,before:qty(x.before),after:qty(x.after)})):[]}));
 out.panelOrder=Array.isArray(input.panelOrder)?input.panelOrder.filter(x=>typeof x==='string'&&/^[a-z0-9-]+$/.test(x)).slice(0,50):[];
 if(input.panelSizes&&typeof input.panelSizes==='object')for(const [k,v]of Object.entries(input.panelSizes)){if(/^[a-z0-9-]+$/.test(k)&&['wide','normal'].includes(v))out.panelSizes[k]=v;}
 out.preferences.warningThreshold=Math.min(100000,Math.max(0,qty(input.preferences?.warningThreshold??3)));
 return out;
}
function forecasts(s,C){const periods=s.periods.filter(p=>/^\d{4}-\d{2}-\d{2}$/.test(p.start)&&/^\d{4}-\d{2}-\d{2}$/.test(p.end)&&Date.parse(p.end)>=Date.parse(p.start)).sort((a,b)=>b.end.localeCompare(a.end)).slice(0,8);
 const nDays=p=>Math.max(1,Math.round((Date.parse(p.end)-Date.parse(p.start))/86400000)+1);
 const ordered=periods.slice().sort((a,b)=>a.start.localeCompare(b.start));
 if(ordered.some((p,i)=>i>0&&p.start<=ordered[i-1].end))return {available:false,periods:periods.length,days:0,reason:'Hay períodos con fechas superpuestas. Corrige el registro antes de proyectar movimientos.'};
 let sum=0,days=0;for(const p of periods){days+=nDays(p);sum+=s.products.reduce((a,prod)=>a+qty(C.qty(s,p.id,prod.id)),0);}
 if(periods.length<2||days<7)return {available:false,periods:periods.length,days,reason:'Se necesitan al menos 2 períodos fechados y 7 días de historial.'};
 const perDay=sum/days;const avg=sum/periods.length;
 const recent=s.products.map(prod=>{const moves=periods.map(p=>qty(C.qty(s,p.id,prod.id)));const dayRate=moves.reduce((a,b)=>a+b,0)/days;return {id:prod.id,name:prod.name,day:dayRate,week:dayRate*7,month:dayRate*30,year:dayRate*365};}).sort((a,b)=>Math.abs(b.week)-Math.abs(a.week));
 return {available:true,periods:periods.length,days,averagePerPeriod:avg,day:perDay,week:perDay*7,month:perDay*30,year:perDay*365,confidence:periods.length>=6?'media':periods.length>=4?'limitada':'baja',products:recent};
}
function alerts(s,C,daysSince=Date.now()){
 const alloc=allocations(s,C),issues=[];const threshold=ensure(s).preferences.warningThreshold;
 for(const p of alloc.productRows){if(stock(s,C,p.id)<0)issues.push({type:'danger',name:p.name,message:'Saldo negativo',id:p.id});else if(stock(s,C,p.id)===0)issues.push({type:'warn',name:p.name,message:'Sin saldo',id:p.id});else if(p.available<=threshold)issues.push({type:'warn',name:p.name,message:`Stock bajo (≤ ${threshold})`,id:p.id});
  if(p.over>1e-8)issues.push({type:'danger',name:p.name,message:`Asignación excedida: ${p.over}`,id:p.id});
  else if(p.unassigned>1e-8)issues.push({type:'info',name:p.name,message:`Sin ubicar: ${p.unassigned}`,id:p.id});}
 const cutoff=daysSince-30*86400000;const recent= s.periods.some(p=>p.start&&Date.parse(p.start)>=cutoff);
 if(s.products.length&&!recent)issues.push({type:'info',name:'Historial',message:'Sin períodos fechados en los últimos 30 días',id:''});
 return issues.slice(0,1000);
}
window.GU4Core={ensure,allocations,stock,slot,setLocation,clearLocation,makeCount,applyCount,cancelCount,validateImport,applyProducts,normalizeGu4,forecasts,alerts};
})();
