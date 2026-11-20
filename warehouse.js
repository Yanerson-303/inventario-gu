/* Bodega isométrica SVG sin dependencias. Los saldos provienen del consolidado real. */
(function(){
'use strict';
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>new Intl.NumberFormat('es-CO',{maximumFractionDigits:2}).format(n);
const box=(x,y,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0 13 -7 26 0 13 8Z" fill="#efc48b" stroke="#a56d3d" stroke-width=".8"/><path d="M0 0 13 8 13 25 0 17Z" fill="#b77c49"/><path d="M13 8 26 0 26 17 13 25Z" fill="#d69b60"/><path d="M8 -4 20 3 17 5 5 -2Z" fill="#fff0d4" opacity=".75"/></g>`;
function rack(x,y,index,items){
 const count=items.reduce((a,p)=>a+p.qty,0),visible=Math.min(16,Math.floor(count));
 let crates='';for(let i=0;i<visible;i++){const level=i>=8?1:0,slot=i%8;crates+=box(x+12+(slot%2)*36+Math.floor(slot/2)*4,y+83-(Math.floor(slot/2)*18)-level*42,.95);}
 return `<g class="warehouse-rack" data-rack="${index}"><path d="M${x} ${y+124} l98 -53 28 16 -98 53Z" fill="#b8c3cc" opacity=".35"/>
 <path d="M${x} ${y+15} l90 -48 32 17 -90 48Z" fill="#dbe3e8" opacity=".4"/>
 ${[0,1].map(l=>`<path d="M${x+5} ${y+101-l*42} l94 -50 27 14 -94 50Z" fill="#e78937" stroke="#a65b20" stroke-width="2"/>`).join('')}
 <path d="M${x+5} ${y+25}v100 M${x+36} ${y+42}v100 M${x+99} ${y-26}v100 M${x+126} ${y-11}v100" stroke="#2877a5" stroke-width="6" stroke-linecap="round"/>
 ${crates}<g transform="translate(${x+65} ${y-49})"><rect x="-38" y="-15" width="76" height="30" rx="9" fill="#193b54" stroke="#7eb7cf"/><text text-anchor="middle" y="6" fill="white" font-size="17" font-weight="bold">${fmt(count)}</text></g></g>`;
}
function render(state,calc){
 const products=(state.products||[]).map(p=>({id:p.id,name:p.name,qty:Math.max(0,calc.result(state,p).N)}));
 const racks=[[],[],[]];products.forEach((p,i)=>racks[i%3].push(p));
 const totals=racks.map(r=>r.reduce((s,p)=>s+p.qty,0));
 const total=totals.reduce((a,b)=>a+b,0);
 const x=[145,350,555];let out=`<section class="card warehouse-card" aria-label="Bodega virtual sincronizada"><div class="warehouse-heading"><div><span class="eyebrow">INVENTARIO VISUAL</span><h2>Bodega en tiempo real</h2><p>Las cajas representan unidades disponibles del saldo consolidado. Máximo 16 cajas dibujadas por rack; el número indica la cantidad completa.</p></div><div class="warehouse-total"><strong>${fmt(total)}</strong><span>unidades disponibles</span></div></div><div class="warehouse-scene"><svg viewBox="0 0 930 550" role="img" aria-label="Vista isométrica de tres racks. Rack izquierdo ${fmt(totals[0])} unidades, central ${fmt(totals[1])}, derecho ${fmt(totals[2])}." xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="warehouseFloor" x2="1" y2="1"><stop stop-color="#e9eff3"/><stop offset="1" stop-color="#bacbd5"/></linearGradient></defs>
 <path d="M75 130 640 35 882 180 306 505Z" fill="url(#warehouseFloor)" stroke="#849eae" stroke-width="4"/>
 <path d="M75 130 640 35 640 3 75 94Z" fill="#a9bbc7"/><path d="M640 35 882 180 882 139 640 3Z" fill="#8095a4"/>
 <path d="M105 200 340 335 M280 155 520 292 M455 105 700 246" stroke="#f8fbfd" stroke-width="5" opacity=".65"/>
 <path d="M135 325 360 458 M350 275 585 411 M565 220 785 345" stroke="#f1c75d" stroke-width="3" stroke-dasharray="13 9" opacity=".9"/>
 ${rack(145,220,1,racks[0])}${rack(350,192,2,racks[1])}${rack(555,164,3,racks[2])}
 <g transform="translate(665 66)"><path d="M0 0 115 -17 115 65 0 84Z" fill="#f8fafb" stroke="#698395" stroke-width="3"/><path d="M10 16 103 1 103 41 10 57Z" fill="#a6d6e9"/><path d="M31 54 67 49 67 67 31 72Z" fill="#d8a579"/><text x="58" y="-25" text-anchor="middle" fill="#23435c" font-size="14" font-weight="bold">OFICINA INVENTARIO</text><circle cx="57" cy="31" r="8" fill="#e6b58e"/><path d="M46 43q11 -9 22 -3l4 13 -27 4Z" fill="#345b8b"/></g>
 <g transform="translate(455 352)"><circle cx="0" cy="0" r="10" fill="#f1b87d"/><path d="M-13 12 10 8 19 37 -9 41Z" fill="#f19b30"/><path d="M-3 40 -13 61 M13 39 27 59" stroke="#243d58" stroke-width="7"/><path d="M15 13 33 20" stroke="#243d58" stroke-width="6"/><rect x="25" y="13" width="19" height="16" rx="2" fill="#e6f4fb" stroke="#235e88"/><path d="M-12 -8q12 -17 24 -3" fill="#f7cb3f" stroke="#f7cb3f" stroke-width="7"/></g>
 <g transform="translate(665 355)"><path d="M0 0 110 -55 155 -30 45 25Z" fill="#e6b980" stroke="#936d49" stroke-width="3"/>${box(34,-31,1.3)}${box(75,-50,.9)}<text x="78" y="55" text-anchor="middle" fill="#23435c" font-size="14" font-weight="bold">ZONA DE ACOMODO</text></g>
 <path d="M295 498 385 449 430 475 341 524Z" fill="#75bca5" opacity=".6"/><path d="M344 506l18 -29 10 17" fill="none" stroke="#238566" stroke-width="7"/><text x="360" y="541" text-anchor="middle" font-size="16" font-weight="bold" fill="#254c60">ENTRADA LIBRE</text>
 </svg></div><div class="warehouse-rack-summary">${racks.map((r,i)=>`<div class="warehouse-rack-item"><span>Rack ${i+1} · ${['Izquierdo','Central','Derecho'][i]}</span><strong>${fmt(totals[i])} unidades</strong><small>${r.length?r.map(p=>`${E(p.name)}: ${fmt(p.qty)}`).join(' · '):'Sin productos asignados'}</small></div>`).join('')}</div><p class="warehouse-note">Distribución visual automática entre los tres racks. No representa ubicaciones físicas registradas. Los saldos negativos se consideran cero para la visualización.</p></section>`;
 return out;
}
window.AlmendraWarehouse={render};
})();
