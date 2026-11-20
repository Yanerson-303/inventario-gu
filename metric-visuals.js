/* Inventarios GU 3.3 · Visualizaciones pequeñas con SVG, sin dependencias.
   Son lecturas de datos; no modifican saldos ni movimientos. */
(function () {
'use strict';
const esc = v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v=>Number.isFinite(Number(v))?Number(v):0;
const fmt = v=>new Intl.NumberFormat('es-CO',{maximumFractionDigits:1,notation:Math.abs(v)>=10000?'compact':'standard'}).format(num(v));
const clamp = (v,a,b)=>Math.min(b,Math.max(a,v));
function empty(label='Sin registros') {return `<div class="metric-vis-empty">${esc(label)}</div>`;}
function spark(items, label='Evolución de los movimientos', opts={}) {
 const data=(Array.isArray(items)?items:[]).filter(d=>d&&Number.isFinite(Number(d.value)));
 if(!data.length)return empty('Sin períodos para graficar');
 const vals=data.map(d=>num(d.value));
 if(vals.every(v=>v===0)&&opts.emptyWhenZero)return empty('Sin movimientos registrados');
 const w=240,h=76,pad=8,min=Math.min(0,...vals),max=Math.max(0,...vals),range=Math.max(1,max-min);
 const pts=vals.map((v,i)=>[pad+(w-2*pad)*(data.length===1?.5:i/(data.length-1)),pad+(h-2*pad)*(max-v)/range]);
 const zeroY=pad+(h-2*pad)*max/range;
 const points=pts.map(([x,y])=>x.toFixed(2)+','+y.toFixed(2)).join(' ');
 const dots=pts.map(([x,y],i)=>`<circle class="metric-point" tabindex="0" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${data.length<9?3.1:2.4}" fill="var(--accent)"><title>${esc(data[i].label??'Período')}: ${esc(fmt(data[i].value))}</title></circle>`).join('');
 const last=fmt(vals.at(-1));
 const values=data.map(d=>`${String(d.label??'Período')}: ${fmt(d.value)}`).join(' · ');
 return `<div class="metric-mini-chart"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="metric-spark" role="img" aria-label="${esc(label)}. ${esc(values)}"><line x1="8" y1="${zeroY.toFixed(2)}" x2="232" y2="${zeroY.toFixed(2)}" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 4"/><polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>${dots}</svg><div class="metric-mini-foot"><span>${esc(opts.left||'Primer período')}</span><span>${esc(opts.right||`Último: ${last}`)}</span></div></div>`;
}
function barRows(items,label='Comparación de valores',opts={}){
 const rows=(Array.isArray(items)?items:[]).filter(i=>i&&Number.isFinite(Number(i.value)));
 if(!rows.length)return empty(opts.empty||'Sin datos para comparar');
 const max=Math.max(1,...rows.map(i=>Math.abs(num(i.value))));
 return `<div class="metric-mini-bars" role="img" aria-label="${esc(label)}: ${esc(rows.map(i=>`${i.label} ${fmt(i.value)}`).join(', '))}">${rows.slice(0,5).map(i=>{const amount=num(i.value),width=clamp(Math.abs(amount)/max*100,0,100);return `<div class="metric-bar-row" tabindex="0" aria-label="${esc(i.label)}: ${esc(fmt(amount))}"><div class="metric-bar-top"><span title="${esc(i.label)}">${esc(i.label)}</span><b class="mono">${esc(fmt(amount))}</b></div><div class="metric-bar-track"><i style="width:${width.toFixed(2)}%;background:${esc(i.color||'var(--accent)')}"></i></div></div>`}).join('')}</div>`;
}
function donut(items,label='Distribución',opts={}){
 const rows=(Array.isArray(items)?items:[]).map(x=>({label:String(x.label),value:Math.max(0,num(x.value)),color:x.color||'var(--accent)'}));
 const total=rows.reduce((a,b)=>a+b.value,0);
 if(!total)return empty(opts.empty||'Sin valores para distribuir');
 const circumference=2*Math.PI*34;let offset=0;
 const paths=rows.filter(r=>r.value>0).map(r=>{const len=r.value/total*circumference;const p=`<circle class="metric-slice" cx="46" cy="46" r="34" fill="none" stroke="${esc(r.color)}" stroke-width="12" stroke-dasharray="${Math.max(0,len-0.4).toFixed(2)} ${circumference.toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 46 46)" tabindex="0"><title>${esc(r.label)}: ${esc(fmt(r.value))}</title></circle>`;offset+=len;return p;}).join('');
 const aria=rows.map(r=>`${r.label}: ${fmt(r.value)} (${Math.round(r.value/total*100)}%)`).join('; ');
 return `<div class="metric-donut-wrap"><svg class="metric-donut" viewBox="0 0 92 92" role="img" aria-label="${esc(label)}. ${esc(aria)}"><circle cx="46" cy="46" r="34" stroke="var(--line)" fill="none" stroke-width="12"/>${paths}<text x="46" y="45" fill="var(--text)" font-size="15" font-weight="800" text-anchor="middle">${esc(opts.center||fmt(total))}</text><text x="46" y="58" fill="var(--muted)" font-size="7" text-anchor="middle">${esc(opts.sub||'total')}</text></svg><div class="metric-legend">${rows.map(r=>`<div class="metric-legend-row"><i style="background:${esc(r.color)}"></i><span>${esc(r.label)}</span><b class="mono">${fmt(r.value)}</b></div>`).join('')}</div></div>`;
}
function valueMix(rows){
 const positives=(rows||[]).filter(r=>num(r.P)>0).sort((a,b)=>b.P-a.P);
 const first=positives.slice(0,3),others=positives.slice(3).reduce((s,r)=>s+num(r.P),0);
 const parts=[...first.map(r=>({label:r.product.name,value:r.P})),...(others>0?[{label:'Otros',value:others,color:'var(--gold)'}]:[])];
 const colors=['var(--accent)','var(--good)','var(--warn)'];parts.forEach((r,i)=>r.color=r.color||colors[i%colors.length]);
 const negatives=(rows||[]).filter(r=>num(r.P)<0);
 return `<div class="metric-visual-stack">${donut(parts,'Composición del valor positivo',{sub:'valor +',empty:'Sin valorizaciones positivas'})}${negatives.length?`<span class="metric-chart-note">${negatives.length} valorización(es) negativa(s), no incluidas en la torta.</span>`:''}</div>`;
}
function stockTop(rows){
 const items=(rows||[]).filter(r=>num(r.N)>0).sort((a,b)=>b.N-a.N).slice(0,3).map(r=>({label:r.product.name,value:r.N}));
 return barRows(items,'Unidades disponibles por producto',{empty:'No hay unidades positivas'});
}
function catalogue(rows){
 const present=(rows||[]).filter(r=>num(r.H)!==0).length;
 return donut([{label:'Con movimientos',value:present,color:'var(--accent)'},{label:'Sin movimientos',value:(rows||[]).length-present,color:'var(--line)'}],'Estado de registro del catálogo',{sub:'productos',empty:'Sin productos'});
}
function references(rows){
 return donut([{label:'Con stock',value:(rows||[]).filter(r=>num(r.N)>0).length,color:'var(--good)'},{label:'En cero',value:(rows||[]).filter(r=>num(r.N)===0).length,color:'var(--warn)'},{label:'Negativas',value:(rows||[]).filter(r=>num(r.N)<0).length,color:'var(--danger)'}],'Estado de las referencias',{sub:'refs.',empty:'Sin referencias'});
}
function balances(rows){
 const plus=(rows||[]).reduce((s,r)=>s+Math.max(0,num(r.N)),0);
 const minus=(rows||[]).reduce((s,r)=>s+Math.max(0,-num(r.N)),0);
 return `<div class="metric-visual-stack">${barRows([{label:'Saldo positivo',value:plus,color:'var(--good)'},{label:'Faltante calculado',value:minus,color:'var(--danger)'}],'Saldo positivo y faltantes')}<span class="metric-chart-note">Saldo neto = positivo − faltante.</span></div>`;
}
function issueBars(info){return barRows((info?.categories||[]).map(c=>({label:c.name,value:info.counts?.[c.id]||0,color:c.level==='danger'?'var(--danger)':c.level==='warn'?'var(--warn)':'var(--accent)'})),'Observaciones por tipo');}
window.GUMetricVisuals={spark,barRows,donut,valueMix,stockTop,catalogue,references,balances,issueBars};
})();
