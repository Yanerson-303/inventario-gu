/*
  INVENTARIOS GU 3.0 — CONTROL DE INVENTARIO LOCAL
  Basado en la documentación de Software.xlsx. El PDF no contiene el inventario original.
  Sin servicios externos, sin envío de datos y sin librerías de terceros.
*/
(function(){
'use strict';
const DB=window.AlmendraDB, C=window.AlmendraCalc, Graph=window.AlmendraCharts, Insights=window.GUIInsights, Icons=window.GUIcons;
const $=(q,root=document)=>root.querySelector(q);
const $$=(q,root=document)=>Array.from(root.querySelectorAll(q));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=(n,d=2)=>new Intl.NumberFormat('es-CO',{maximumFractionDigits:d,minimumFractionDigits:0}).format(Number(n)||0);
const money=n=>new Intl.NumberFormat('es-CO',{style:'currency',currency:state?.settings?.currency||'COP',maximumFractionDigits:0}).format(Number(n)||0);
const stamp=v=>{try{return new Date(v).toLocaleString('es-CO',{dateStyle:'medium',timeStyle:'short'});}catch{return String(v)}};
const id=prefix=>prefix+'-'+(crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
const clone=x=>JSON.parse(JSON.stringify(x));
const safeid=s=>/^[A-Za-z0-9_-]{1,110}$/.test(String(s));
const getCookie=k=>document.cookie.split('; ').find(x=>x.startsWith(k+'='))?.split('=').slice(1).join('=')||'';
const cookie=(k,v)=>{try{document.cookie=`${k}=${encodeURIComponent(v)}; max-age=31536000; path=/; SameSite=Lax`;}catch{}};
const nf=v=>{const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?n:null;};
const numInput=(field,value,attrs='')=>`<input class="cell-input ${value!==''&&Number(value)!==0?'changed':''}" type="number" inputmode="decimal" step="any" value="${value===''?'':esc(value)}" data-edit="${esc(field)}" ${attrs}>`;
let state=null,view='dashboard',periodId='w1',slotOffset=0,slotCount=10,page=0,query='',clientQuery='',reviewFilter='all';
let undoStack=[],saveTimer=null,saveQueue=Promise.resolve(),saveFailure=false,storageConflict=false,autoBackupDue=false;
const tabId=id('tab');
const titleMap={dashboard:'Panel general',weekly:'Registro semanal',final:'Consolidado',products:'Productos',clients:'Clientes / espacios',audit:'Historial',backup:'Copias y migración',settings:'Configuración'};
function newState(){
 return {version:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),settings:{palette:'almond',mode:'light',currency:'COP',pageSize:20,lastAutoBackup:0},products:[],clients:Array.from({length:100},(_,i)=>({id:'c'+(i+1),code:'A-'+(i+1),name:'',active:true})),periods:Array.from({length:5},(_,i)=>({id:'w'+(i+1),label:'Semana '+(i+1),start:'',end:'',locked:false})),movements:{},prices:{},weekTotals:{},audit:[]};
}
function toast(message){const el=document.createElement('div');el.className='toast';el.textContent=message;$('#toast-area').append(el);setTimeout(()=>el.remove(),3900);}
function indicator(label,type=''){const el=$('#save-indicator');if(!el)return;el.className='save-indicator '+type;el.innerHTML=`<span class="save-dot"></span> ${esc(label)}`;}
function storageNotice(){
 const mode=DB.mode?.()||'indexeddb';
 if(mode==='memory')return `<div class="banner alert storage-alert" role="status"><div><h3>Vista previa · los datos no se guardan permanentemente</h3><p>Este visor bloquea IndexedDB y el almacenamiento local. Puedes usar y probar todas las pantallas, pero al cerrar o actualizar esta página perderás los cambios. <b>Descarga un respaldo JSON antes de salir.</b></p></div><button type="button" class="btn btn-primary" data-action="export-json">Descargar copia</button></div>`;
 if(mode==='localStorage')return `<div class="banner storage-alert" role="status"><div><h3>Modo de almacenamiento alternativo</h3><p>IndexedDB no está disponible. Se está usando el almacenamiento local del navegador, con capacidad limitada. Descarga respaldos JSON; para uso continuo, abre la aplicación desde HTTPS o localhost.</p></div><button type="button" class="btn" data-action="export-json">Respaldar</button></div>`;
 return '';
}
function savedStatus(){const mode=DB.mode?.();indicator(mode==='memory'?'Solo en esta sesión':mode==='localStorage'?'Guardado limitado':'Guardado local',mode==='memory'?'error':'');}
function syncTheme(){
 document.body.dataset.palette=state.settings.palette;document.body.dataset.mode=state.settings.mode;
 document.querySelector('meta[name="theme-color"]').content=state.settings.mode==='dark'?'#24211e':state.settings.palette==='redgold'?'#f7e9db':state.settings.palette==='silver'?'#e8ecf1':'#e8dbc6';
 $('#quick-theme').textContent=state.settings.mode==='dark'?'☀':'☾';
 cookie('almendra_palette',state.settings.palette);cookie('almendra_mode',state.settings.mode);
}
function markRevision(){try{localStorage.setItem('almendra-last-revision',JSON.stringify({tabId,at:Date.now()}));}catch{}}
function scheduleSave(){
 indicator('Guardando…','pending');
 clearTimeout(saveTimer);
 saveTimer=setTimeout(()=>{
  const snapshot=clone(state);
  const createAutoBackup=autoBackupDue;autoBackupDue=false;
  saveQueue=saveQueue.catch(()=>{}).then(async()=>{
    if(storageConflict)throw new Error('Se detectaron cambios de otra pestaña. No se sobrescribió el almacenamiento.');
    await DB.save(snapshot);
    if(createAutoBackup){
      await DB.backup({id:id('auto'),createdAt:snapshot.updatedAt,type:'auto',label:'Respaldo automático',data:snapshot});
      const all=await DB.backups();const autos=all.filter(x=>x.type==='auto');
      await Promise.all(autos.slice(12).map(x=>DB.deleteBackup(x.id)));
      await refreshBackups();
    }
    markRevision();saveFailure=false;savedStatus();
  }).catch(err=>{saveFailure=true;indicator('Error al guardar','error');toast('No se pudo guardar: '+err.message);});
 },180);
}
function mutation(label,fn,refresh=true){
 if(storageConflict){toast('Otra pestaña cambió los datos. Recarga para evitar sobrescribir cambios.');return false;}
 undoStack.push(clone(state));if(undoStack.length>20)undoStack.shift();
 try{fn();}catch(error){state=undoStack.pop();toast(error.message);return false;}
 const now=new Date().toISOString();state.updatedAt=now;
 state.audit.unshift({id:id('evt'),at:now,label,actor:'Este dispositivo'});state.audit=state.audit.slice(0,350);
 if(!state.settings.lastAutoBackup || Date.now()-Number(state.settings.lastAutoBackup)>12*60*60*1000){state.settings.lastAutoBackup=Date.now();autoBackupDue=true;}
 scheduleSave();if(refresh)render();else updateHeader();return true;
}
function undo(){if(!undoStack.length){toast('No hay cambios para deshacer.');return;}if(storageConflict){toast('Recarga para resolver el conflicto de pestañas.');return;}state=undoStack.pop();state.updatedAt=new Date().toISOString();state.audit.unshift({id:id('undo'),at:state.updatedAt,label:'Se deshizo el último cambio',actor:'Este dispositivo'});scheduleSave();render();toast('Última modificación deshecha.');}
function updateHeader(){
 $('#breadcrumb-title').textContent=titleMap[view];
 $$('[data-nav]').forEach(btn=>{btn.classList.toggle('active',btn.dataset.nav===view);if(btn.classList.contains('nav-item'))btn.setAttribute('aria-current',btn.dataset.nav===view?'page':'false');});
 $('#undo-btn').disabled=undoStack.length===0;
}
function navigate(destination){if(!titleMap[destination])return;view=destination;query='';page=0;render();window.scrollTo({top:0,behavior:'instant'});}
function switchPeriod(next){if(!state.periods.some(p=>p.id===next))return;periodId=next;page=0;render();}
function productsFiltered(){const q=query.toLocaleLowerCase('es').trim();return state.products.filter(p=>`${p.name} ${p.category||''} ${p.unit||''}`.toLocaleLowerCase('es').includes(q));}
function selection(items){const limit=state.settings.pageSize||20;const last=Math.max(0,Math.ceil(items.length/limit)-1);page=Math.min(page,last);return {rows:items.slice(page*limit,(page+1)*limit),total:items.length,last};}
function pageFoot(sel,label){return `<div class="table-footer"><span><b>${sel.total}</b> ${esc(label)} · página ${page+1} de ${sel.last+1}</span><div class="pager"><button data-page="prev" ${page<=0?'disabled':''}>Anterior</button><button data-page="next" ${page>=sel.last?'disabled':''}>Siguiente</button></div></div>`;}
function empty(title,description,action='',name=''){return `<div class="empty-state"><div class="empty-icon">◇</div><h2>${esc(title)}</h2><p>${esc(description)}</p>${action?`<button class="btn btn-primary" data-action="${esc(action)}">${esc(name)}</button>`:''}</div>`;}
function heading(eyebrow,title,subtitle,tools=''){return `<div class="page-heading"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>${tools?`<div class="page-tools">${tools}</div>`:''}</div>`;}
function searchBar(placeholder='Buscar producto…'){return `<label class="search"><input id="product-search" class="form-control" type="search" value="${esc(query)}" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" autocomplete="off"></label>`;}
function productButton(p){return `<button class="product-link" title="Editar ${esc(p.name)}" data-action="edit-product" data-id="${esc(p.id)}">${esc(p.name)}</button>`;}
function statusBalance(n){return `<span class="${n<0?'text-danger':n>0?'text-good':''} mono">${format(n)}</span>`;}
function render(){
 if(!state)return;updateHeader();syncTheme();
 const activeViews={dashboard:renderDashboard,weekly:renderWeekly,final:renderFinal,products:renderProducts,clients:renderClients,audit:renderAudit,backup:renderBackup,settings:renderSettings};
 $('#main-content').innerHTML=storageNotice()+(storageConflict?'<div class="banner alert"><div><h3>Conflicto entre pestañas</h3><p>Se detectaron cambios desde otra pestaña. Recarga para recuperar la última versión antes de editar.</p></div><button class="btn" data-action="reload">Recargar</button></div>':'')+activeViews[view]();
 Icons?.enhance($('#main-content'));
 if(view==='dashboard')requestAnimationFrame(()=>{drawDashboard();window.AlmendraWarehouse?.mount();});
}
const metricVisibilityKey='inventarios-gu-metricas-v22'; // Compatibilidad con preferencias de 2.2
function metricPrefs(){try{return JSON.parse(localStorage.getItem(metricVisibilityKey)||'{}')||{}}catch{return {}}}
function metricBox(id,html){const collapsed=!!metricPrefs()[id];return `<div class="metric-panel ${collapsed?'metric-collapsed':''}" data-metric="${id}"><button type="button" class="metric-toggle" data-metric-toggle="${id}" aria-expanded="${!collapsed}" aria-label="${collapsed?'Mostrar':'Minimizar'} métrica" title="${collapsed?'Mostrar':'Minimizar'}">${collapsed?'＋ Mostrar':'− Minimizar'}</button><div class="metric-content">${html}</div></div>`}
function renderDashboard(){
 const all=C.totals(state,state.products);
 const open=state.periods.filter(p=>!p.locked).length;
 const top=all.rows.slice().sort((a,b)=>Math.abs(b.H)-Math.abs(a.H)).slice(0,6);
 const recent=state.audit.slice(0,5),review=Insights.analyze(state,C,all.rows);
 return `${heading('VISTA GENERAL','Tu negocio, en perspectiva','Todos los períodos y productos, actualizados con cada registro.',`<button class="btn" data-nav="weekly">Abrir semanas</button><button class="btn btn-primary" data-action="new-product">+ Nuevo producto</button>`)}
 <div class="dashboard-tools" role="group" aria-label="Personalizar indicadores"><div><strong>Tu panel, a tu manera</strong><span>Organiza las tarjetas sin modificar los datos.</span></div><div class="dashboard-tools-actions"><button type="button" class="btn btn-small" data-dashboard-panels="expand">Mostrar todas</button><button type="button" class="btn btn-small" data-dashboard-panels="collapse">Minimizar todas</button><button type="button" class="btn btn-small" data-dashboard-panels="reset">Restablecer vista</button><button type="button" class="btn btn-small" data-dashboard-export="csv">Exportar resumen CSV</button></div></div>
 ${renderStockAlerts(all)}
 ${!state.products.length?`<div class="banner"><div><h3>Tu espacio está listo para comenzar</h3><p>El PDF no incluía productos originales. Añade productos o activa datos de demostración para explorar la interfaz.</p></div><button class="btn btn-primary" data-action="demo">Ver demostración</button></div>`:''}
 ${all.negative?`<div class="banner alert"><div><h3>${all.negative} producto(s) con saldo negativo</h3><p>Los valores negativos se conservan como en la fórmula de Excel. Verifica si representan faltantes, pedidos u otra operación.</p></div><button class="btn" data-nav="final">Revisar saldos</button></div>`:''}
 <section class="stats-grid" aria-label="Indicadores generales">
 ${metricBox('volumen',statCard('Volumen de las semanas',format(all.quantity),'Suma de todas las entradas · H','▦'))}
 ${metricBox('saldo',statCard('Saldo calculado',format(all.balance),'H − (Cantidad.N + Cantidad.V)','◎'))}
 ${metricBox('valor',statCard('Valorización total',money(all.value),'Suma de saldo × valor unitario · P','◈'))}
 ${metricBox('productos',statCard('Productos registrados',format(state.products.length,0),`${open} períodos abiertos · ${state.clients.length} espacios`,'◇'))}
 ${metricBox('stock',statCard('Unidades en stock',format(all.rows.reduce((sum,r)=>sum+Math.max(0,r.N),0)),'Suma de saldos positivos disponibles · N','▣'))}
 ${metricBox('referencias',statCard('Referencias con stock',format(all.rows.filter(r=>r.N>0).length,0),`${all.rows.filter(r=>r.N===0).length} sin saldo · ${all.negative} con saldo negativo`,'◉'))}
 </section>
 <div class="dashboard-visual-row">
 ${metricBox('bodega',window.AlmendraWarehouse?.render(state,C)||'')}
 ${metricBox('proyecciones',renderProjections())}
 </div>
 <div class="dashboard-grid">${metricBox('grafico-semanal',`<article class="card card-pad"><div class="card-title"><div><h3>Movimiento por semana</h3><p>Unidades registradas, incluyendo las columnas ocultas.</p></div><span class="badge">TODAS</span></div><canvas class="chart" id="weekly-chart" role="img" aria-label="Gráfico de cantidades por semana"></canvas></article>`)}
 ${metricBox('grafico-productos',`<article class="card card-pad"><div class="card-title"><div><h3>Productos con mayor registro</h3><p>Volumen absoluto acumulado.</p></div><span class="badge">TOP 6</span></div>${top.length?'<canvas class="chart" id="top-chart" role="img" aria-label="Gráfico de principales productos"></canvas>':empty('Sin movimientos','Añade tu primer producto y registra cantidades.')}</article>`)}</div>
 <div class="dashboard-v3-row">${metricBox('revision',renderReviewCenter(review))}${metricBox('tendencias',renderPeriodComparison(review))}</div>
 <div class="dashboard-bottom">${metricBox('vista-rapida',`<article class="card card-pad"><div class="card-title"><div><h3>Vista rápida del inventario</h3><p>Resumen de los productos que contienen más registros.</p></div><button class="btn btn-small" data-nav="final">Ver consolidado</button></div>${top.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th>Producto</th><th class="num">Registrado</th><th class="num">Saldo</th><th class="num">Valor total</th></tr></thead><tbody>${top.map(r=>`<tr><td>${productButton(r.product)}</td><td class="num">${format(r.H)}</td><td class="num">${statusBalance(r.N)}</td><td class="num">${money(r.P)}</td></tr>`).join('')}</tbody></table></div>`:empty('Aún no hay productos','Agrega un producto para visualizarlo aquí.','new-product','Crear producto')}</article>`)}
 ${metricBox('actividad',`<article class="card card-pad"><div class="card-title"><div><h3>Actividad reciente</h3><p>Últimas modificaciones guardadas en este equipo.</p></div><button class="btn btn-small" data-nav="audit">Historial</button></div>${recent.length?recent.map(r=>`<div class="activity-item"><div class="activity-icon">✎</div><div class="activity-body"><b>${esc(r.label)}</b><p>Registro local</p></div><span class="activity-time">${esc(stamp(r.at))}</span></div>`).join(''):empty('Sin actividad','Tus cambios aparecerán aquí.')}</article>`)}</div>`;
}
function renderReviewCenter(info){
 const active=info.categories.find(c=>c.id===reviewFilter);
 const filtered=active?info.issues.filter(x=>x.id===active.id):info.issues;
 const n=Math.min(filtered.length,6);
 return `<section class="card card-pad control-center" aria-label="Centro de revisión del inventario"><div class="card-title gu-control-head"><div><span class="eyebrow">CONTROL Y CALIDAD DE DATOS</span><h3>Centro de revisión</h3><p>Observaciones para verificar, sin modificar tus registros.</p></div><button class="btn btn-small" data-action="csv-review">Exportar revisión</button></div>
 <div class="health-strip"><div><span>Referencias con registros</span><strong>${info.referenced} / ${info.productCount}</strong><div class="health-meter"><i style="width:${info.productCount?Math.round(info.referenced/info.productCount*100):0}%"></i></div></div><div><span>Períodos con fechas válidas</span><strong>${info.dated} / ${info.periodCount}</strong><div class="health-meter"><i style="width:${info.periodCount?Math.round(info.dated/info.periodCount*100):0}%"></i></div></div><div><span>Saldos negativos</span><strong class="${info.critical?'text-danger':''}">${info.critical}</strong><small>Requieren revisión</small></div></div>
 <div class="review-filters" role="group" aria-label="Filtrar observaciones"><button type="button" data-review-filter="all" aria-pressed="${reviewFilter==='all'}" class="${reviewFilter==='all'?'active':''}">Todas <b>${info.issues.length}</b></button>${info.categories.map(c=>`<button type="button" data-review-filter="${c.id}" aria-pressed="${reviewFilter===c.id}" class="${reviewFilter===c.id?'active':''}">${esc(c.name)} <b>${info.counts[c.id]}</b></button>`).join('')}</div>
 <div class="review-list">${filtered.length?filtered.slice(0,6).map(i=>`<div class="review-row"><span class="review-state ${i.id==='negative'?'risk':i.id==='zero'?'caution':''}">${esc(info.categories.find(c=>c.id===i.id)?.name||i.id)}</span><div class="review-row-info"><b>${esc(i.name)}</b><small>${esc(i.detail)}</small></div><button type="button" class="btn btn-small" data-action="edit-product" data-id="${esc(i.productId)}">Revisar</button></div>`).join(''):`<div class="review-empty">No hay observaciones con este filtro.</div>`}</div>
 <p class="review-foot">${filtered.length>n?`Mostrando ${n} de ${filtered.length}. Exporta CSV para revisar todos los casos.`:'Los avisos son orientativos; las cantidades y las fórmulas originales no se alteran.'}</p></section>`;
}
function renderPeriodComparison(info){
 const comp=Insights.comparison(state,C);
 return `<section class="card card-pad trend-card" aria-label="Comparativa de períodos"><div class="card-title"><div><span class="eyebrow">EVOLUCIÓN DE LOS REGISTROS</span><h3>Comparativa de períodos</h3><p>Últimos dos períodos según el orden de registro.</p></div><span class="badge">DESCRIPTIVO</span></div>${comp?`<div class="trend-pair"><div><span>${esc(comp.previousLabel)}</span><strong>${format(comp.previous)}</strong></div><div><span>${esc(comp.currentLabel)}</span><strong>${format(comp.current)}</strong></div></div><div class="trend-change"><span class="${comp.difference<0?'text-danger':comp.difference>0?'text-good':''}">${comp.difference>0?'+':''}${format(comp.difference)} unidades</span><small>${comp.percent===null?'Sin base anterior para calcular porcentaje':(comp.percent>0?'+':'')+format(comp.percent)+'% frente al período anterior'}</small></div>`:'<div class="review-empty">Se necesitan al menos dos períodos para comparar sus movimientos.</div>'}<div class="trend-info"><div><span class="trend-dot"></span><b>${format(info.productCount,0)}</b><small>Productos en el catálogo</small></div><div><span class="trend-dot success"></span><b>${format(info.referenced,0)}</b><small>Con movimientos registrados</small></div></div><p class="review-foot">Una variación de registros no demuestra ventas, ganancias ni demanda futura. Usa las fechas y el contexto de tus operaciones.</p><button class="btn btn-small trend-open" data-nav="weekly">Consultar semanas</button></section>`;
}
function exportReviewCSV(){
 const info=Insights.analyze(state,C);
 csvDownload([['Tipo','Producto','Producto_ID','Detalle'],...info.issues.map(i=>[info.categories.find(c=>c.id===i.id)?.name||i.id,i.name,i.productId,i.detail])],'Revision_3_0');
}
function renderStockAlerts(all){
 const zero=all.rows.filter(r=>Number(r.N)===0);
 const negative=all.rows.filter(r=>Number(r.N)<0);
 if(!zero.length&&!negative.length)return '';
 const examples=[...negative,...zero].slice(0,4).map(r=>esc(r.product.name)).join(', ');
 return `<div class="stock-alert-summary" role="status"><span class="stock-alert-dot" aria-hidden="true"></span><div><strong>Revisión de existencias: ${negative.length} negativas · ${zero.length} en cero</strong><p>${examples}${negative.length+zero.length>4?' y otros productos':''}. Consulta el consolidado para verificar cantidades.</p></div><button class="btn btn-small" data-nav="final">Revisar</button></div>`;
}
function exportDashboardCSV(){
 const totals=C.totals(state,state.products);
 const rows=[['Producto','Saldo disponible','Cantidad registrada','Valor total'],...totals.rows.map(r=>[r.product.name,r.N,r.H,r.P])];
 // Evita que hojas de cálculo interpreten nombres de productos como fórmulas.
 const cell=v=>{let t=String(v??'');if(/^[\s]*[=+@-]/.test(t)&&typeof v==='string')t="'"+t;return '"'+t.replace(/"/g,'""')+'"'};
 const csv='\uFEFF'+rows.map(r=>r.map(cell).join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download='Inventarios_GU_resumen_3_0.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function renderProjections(){
 // Proyección lineal de movimiento registrado: solo semanas con fechas válidas.
 // No se asume que los movimientos equivalgan a ventas ni se pronostica stock futuro.
 const observations=state.periods.map(p=>{
  const start=p.start?new Date(p.start+'T12:00:00'):null;
  const end=p.end?new Date(p.end+'T12:00:00'):null;
  if(!start||!end||!Number.isFinite(+start)||!Number.isFinite(+end)||end<start)return null;
  const days=Math.floor((end-start)/86400000)+1;
  if(days<1||days>366)return null;
  return {days,quantity:state.products.reduce((sum,pr)=>sum+C.qty(state,p.id,pr.id),0)};
 }).filter(Boolean);
 const days=observations.reduce((sum,p)=>sum+p.days,0);
 const quantity=observations.reduce((sum,p)=>sum+p.quantity,0);
 const daily=days?quantity/days:null;
 const periods=[['Diaria',1],['Semanal',7],['Mensual',30],['Anual',365]];
 const ready=daily!==null&&observations.length>0;
 return `<section class="card forecast-card" aria-label="Proyección de movimiento"><div class="card-title"><div><h3>Proyección de movimiento</h3><p>Estimación según los registros y fechas de los períodos.</p></div><span class="badge">ESTIMACIÓN</span></div><div class="forecast-grid">${periods.map(([label,span])=>`<div class="forecast-item"><span>${label}</span><strong class="mono">${ready?format(daily*span):'—'}</strong><small>${ready?'unidades estimadas':'Sin datos fechados'}</small></div>`).join('')}</div><p class="forecast-note">${ready?`Promedio de ${format(quantity)} unidades registradas durante ${format(days,0)} días de ${observations.length} período(s) con fechas. Mes = 30 días; año = 365 días. No representa ventas ni stock futuro.`:'Para calcular proyecciones, registra las fechas de inicio y fin de al menos un período semanal. No se inventan datos.'}</p></section>`;
}
function statCard(label,value,foot,icon){return `<article class="card stat-card"><div class="stat-icon">${Icons?.svg(icon)||icon}</div><div class="stat-label">${esc(label)}</div><div class="stat-value mono">${esc(value)}</div><div class="stat-foot">${esc(foot)}</div></article>`;}
function drawDashboard(){
 const weekly=state.periods.map(p=>({label:p.label,value:state.products.reduce((a,pr)=>a+C.qty(state,p.id,pr.id),0)}));
 Graph.bars('weekly-chart',weekly.slice(-14));
 const top=state.products.map(p=>({label:p.name,value:C.result(state,p).H})).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)).slice(0,6);
 if(top.length)Graph.horizontal('top-chart',top);
}
function activePeriod(){let p=state.periods.find(p=>p.id===periodId);if(!p){p=state.periods[0];periodId=p.id;}return p;}
function currentSlots(){const limit=slotCount===0?state.clients.length:slotCount;return state.clients.slice(slotOffset,slotOffset+limit);}
function slotSelect(){const total=state.clients.length;const block=Math.min(slotCount||total,total);let ranges='';for(let i=0;i<total;i+=Math.max(block,1)){const end=Math.min(i+block,total);ranges+=`<option value="${i}" ${slotOffset===i?'selected':''}>A-${i+1} a A-${end}</option>`;}
 return `<div class="field"><label>Espacios visibles</label><select class="form-control" id="slot-count"><option value="10" ${slotCount===10?'selected':''}>10 espacios</option><option value="20" ${slotCount===20?'selected':''}>20 espacios</option><option value="50" ${slotCount===50?'selected':''}>50 espacios</option><option value="0" ${slotCount===0?'selected':''}>Todos (${total})</option></select></div><div class="field"><label>Ir al bloque</label><select class="form-control" id="slot-offset" ${slotCount===0?'disabled':''}>${ranges}</select></div>`;}
function renderWeekly(){
 const period=activePeriod(),slots=currentSlots(),all=productsFiltered(),sel=selection(all),locked=period.locked,weekQty=state.products.reduce((s,p)=>s+C.qty(state,period.id,p.id),0);
 const cols=slots.map(cl=>`<th class="slot-col" title="${esc(cl.name||cl.code)}">${esc(cl.name||cl.code)}</th>`).join('');
 const desktop=sel.rows.length?`<div class="week-desktop week-table-wrap"><div class="table-scroll week-scroll-2d" tabindex="0" aria-label="Tabla semanal con desplazamiento horizontal y vertical"><table class="data-table"><thead><tr><th class="sticky-first">Producto</th>${cols}<th class="num last-head">Stock (CX)</th><th class="num last-head">Precio (CY)</th><th class="num last-head">Total manual (CZ)</th><th class="num last-head">Estimado*</th></tr></thead><tbody>${sel.rows.map(pr=>{
  const qty=C.qty(state,period.id,pr.id),prc=state.prices[period.id]?.[pr.id]??'',total=state.weekTotals[period.id]?.[pr.id]??'';
  return `<tr><td class="sticky-first">${productButton(pr)}</td>${slots.map(cl=>`<td class="week-cell">${numInput('movement',state.movements[period.id]?.[pr.id]?.[cl.id]??'',`data-period="${esc(period.id)}" data-product="${esc(pr.id)}" data-client="${esc(cl.id)}" aria-label="${esc(pr.name)} / ${esc(cl.name||cl.code)}" ${locked?'disabled':''}`)}</td>`).join('')}<td class="num t-em">${format(qty)}</td><td class="week-cell">${numInput('price',prc,`data-period="${esc(period.id)}" data-product="${esc(pr.id)}" aria-label="Precio ${esc(pr.name)}" ${locked?'disabled':''}`)}</td><td class="week-cell">${numInput('week-total',total,`data-period="${esc(period.id)}" data-product="${esc(pr.id)}" aria-label="Total manual ${esc(pr.name)}" ${locked?'disabled':''}`)}</td><td class="num">${money(qty*(prc===''?0:prc))}</td></tr>`;
 }).join('')}</tbody></table></div>${pageFoot(sel,'productos')}</div>`:empty('No hay productos que mostrar',state.products.length?'No hay coincidencias para tu búsqueda.':'Crea un producto para comenzar a registrar cantidades.','new-product','Añadir producto');
 const mobile=sel.rows.length?`<div class="week-mobile">${sel.rows.map(pr=>{const qty=C.qty(state,period.id,pr.id);return `<article class="card week-product"><div class="week-product-head"><h3>${productButton(pr)}</h3><span class="badge ${qty<0?'danger':qty>0?'good':''}">Total ${format(qty)}</span></div><div class="week-product-grid">${slots.map(cl=>`<div class="field"><label>${esc(cl.name?cl.code+' · '+cl.name:cl.code)}</label><input class="form-control" type="number" inputmode="decimal" step="any" placeholder="0" data-edit="movement" value="${esc(state.movements[period.id]?.[pr.id]?.[cl.id]??'')}" data-period="${esc(period.id)}" data-product="${esc(pr.id)}" data-client="${esc(cl.id)}" ${locked?'disabled':''}></div>`).join('')}</div><div class="week-product-grid" style="margin-top:13px"><div class="field"><label>Precio unitario (CY)</label><input class="form-control" type="number" inputmode="decimal" step="any" data-edit="price" value="${esc(state.prices[period.id]?.[pr.id]??'')}" data-period="${esc(period.id)}" data-product="${esc(pr.id)}" ${locked?'disabled':''}></div><div class="field"><label>Total manual (CZ)</label><input class="form-control" type="number" inputmode="decimal" step="any" data-edit="week-total" value="${esc(state.weekTotals[period.id]?.[pr.id]??'')}" data-period="${esc(period.id)}" data-product="${esc(pr.id)}" ${locked?'disabled':''}></div></div><div class="week-product-foot"><span>Estimado: cantidad × precio</span><strong>${money(qty*(state.prices[period.id]?.[pr.id]||0))}</strong></div></article>`;}).join('')}${pageFoot(sel,'productos')}</div>`:'';
 return `${heading('CAPTURA DE DATOS','Registro por semana','Edita cantidades en cada cruce entre producto y espacio. El total semanal y el consolidado se recalculan solos.',`<button class="btn" data-action="edit-period">Editar período</button><button class="btn btn-primary" data-action="new-period">+ Semana</button>`)}
 <div class="week-tabs" role="tablist" aria-label="Períodos">${state.periods.map(p=>`<button class="week-tab ${p.id===period.id?'active':''}" data-period-tab="${esc(p.id)}" role="tab" aria-selected="${p.id===period.id}">${esc(p.label)}${p.locked?' · 🔒':''}</button>`).join('')}</div>
 <div class="period-head"><div><span class="badge ${locked?'warn':'good'}">${locked?'Período cerrado':'Período editable'}</span> <span class="muted" style="font-size:12px;margin-left:8px">${esc(period.start||'Sin fecha de inicio')} ${period.end?'→ '+esc(period.end):''}</span></div><div class="summary-inline"><span>Volumen de la semana: <strong>${format(weekQty)}</strong></span><span>Productos: <strong>${state.products.length}</strong></span></div></div>
 <div class="tool-strip"><div class="left">${searchBar()}${slotSelect()}</div><div class="right"><button class="btn btn-small" data-action="clients">Editar nombres A-1…</button><button class="btn btn-small" data-action="new-product">+ Producto</button></div></div>
 ${locked?'<div class="banner alert"><div><h3>Este período está bloqueado</h3><p>Para corregir movimientos, reabre el período desde «Editar período». La acción quedará registrada en el historial.</p></div><button class="btn" data-action="edit-period">Administrar</button></div>':''}
 <p class="table-hint">Desplaza la tabla hacia los lados y hacia abajo para ver más espacios y productos. En móvil se mantiene la vista por tarjetas.</p>${desktop}${mobile}<p class="table-hint">* «Estimado» es un cálculo nuevo de la web (Stock semanal × Precio). La columna «Total manual» reproduce el campo editable CZ del Excel y no se confunde con el estimado. Los espacios no visibles siguen contando en Stock.</p>`;
}
function renderFinal(){
 const all=productsFiltered(),sel=selection(all),allTotals=C.totals(state,state.products),visibleTotals=C.totals(state,all);
 const columns=[['quantityN','Cantidad.N (L)'],['quantityV','Cantidad.V (M)'],['value','Valor (O)'],['average','Promedio (S)'],['boxes','Cajas (U)']];
 const editable=(p,field)=>numInput('product-field',p[field]??0,`data-product="${esc(p.id)}" data-field="${field}" aria-label="${esc(field)} de ${esc(p.name)}"`);
 const table=sel.rows.length?`<div class="card final-table"><div class="table-scroll"><table class="data-table"><thead><tr><th class="sticky-first">Producto</th>${state.periods.map(p=>`<th class="num">${esc(p.label)}</th>`).join('')}<th class="num">Registrado H</th><th class="num">Cantidad.N</th><th class="num">Cantidad.V</th><th class="num">L+M (J)</th><th class="num">Saldo N</th><th class="num">Valor O</th><th class="num">Total P</th><th class="num">Q</th><th class="num">R = -Q</th><th class="num">Promedio S</th><th class="num">Meses T</th><th class="num">Cajas U</th><th>CYU (V)</th></tr></thead><tbody>${sel.rows.map(pr=>{const r=C.result(state,pr);return `<tr><td class="sticky-first">${productButton(pr)}</td>${r.weekly.map((n,i)=>`<td class="num"><button class="product-link mono" data-action="jump-week" data-id="${esc(pr.id)}" data-period="${esc(state.periods[i].id)}">${format(n)}</button></td>`).join('')}<td class="num t-em">${format(r.H)}</td><td>${editable(pr,'quantityN')}</td><td>${editable(pr,'quantityV')}</td><td class="num">${format(r.J)}</td><td class="num t-em">${statusBalance(r.N)}</td><td>${editable(pr,'value')}</td><td class="num t-em">${money(r.P)}</td><td class="num">${format(r.Q)}</td><td class="num">${format(r.R)}</td><td>${editable(pr,'average')}</td><td class="num">${r.T===null?'<span class="badge warn">Sin promedio</span>':format(r.T)}</td><td>${editable(pr,'boxes')}</td><td>${r.V===null?'<span class="badge warn">Sin cajas</span>':esc(r.V)}</td></tr>`;}).join('')}</tbody></table></div>${pageFoot(sel,'productos')}</div>`:empty('No hay resultados',state.products.length?'No hay coincidencias con ese nombre.':'Agrega un producto o importa una copia de tus datos.','new-product','Añadir producto');
 const cards=sel.rows.length?`<div class="final-mobile">${sel.rows.map(p=>{const r=C.result(state,p);return `<article class="card card-pad"><div class="week-product-head">${productButton(p)}<span class="badge ${r.N<0?'danger':'good'}">Saldo: ${format(r.N)}</span></div><div class="mini-summary-grid"><div><small>Registrado (H)</small><b>${format(r.H)}</b></div><div><small>Valorización (P)</small><b>${money(r.P)}</b></div><div><small>Meses (T)</small><b>${r.T===null?'—':format(r.T)}</b></div><div><small>Cajas / unidades</small><b>${esc(r.V??'—')}</b></div></div><div class="week-product-grid">${columns.map(([key,label])=>`<div class="field"><label>${esc(label)}</label><input class="form-control" type="number" inputmode="decimal" step="any" value="${esc(p[key]??0)}" data-edit="product-field" data-field="${key}" data-product="${esc(p.id)}"></div>`).join('')}</div><div class="week-product-foot"><span>Ver registro semanal</span><button class="btn btn-small" data-action="jump-week" data-id="${esc(p.id)}" data-period="${esc(state.periods[0].id)}">Abrir →</button></div></article>`;}).join('')}${pageFoot(sel,'productos')}</div>`:`<div class="final-mobile">${empty('Sin resultados','Crea productos o importa una copia de tus datos.','new-product','Añadir producto')}</div>`;
 return `${heading('CONSOLIDADO / FINAL','Todas tus cifras, conectadas','Fórmulas basadas en la hoja Final del Excel. Las columnas con casillas son editables; el resto se calcula automáticamente.',`<button class="btn" data-action="csv-final">Exportar CSV</button><button class="btn btn-primary" data-nav="weekly">Ir a semanas</button>`)}
 <div class="final-summary"><div class="mini-kpi">H · Registro total<strong>${format(allTotals.quantity)}</strong></div><div class="mini-kpi">N · Saldo total<strong class="${allTotals.balance<0?'text-danger':''}">${format(allTotals.balance)}</strong></div><div class="mini-kpi">P · Valor global<strong>${money(allTotals.value)}</strong></div><div class="mini-kpi">Productos filtrados<strong>${all.length} de ${state.products.length}</strong></div></div>
 <div class="tool-strip"><div class="left">${searchBar()}</div><div class="right"><span class="muted" style="font-size:11px">Subtotal filtrado: ${money(visibleTotals.value)}</span></div></div>
 <div class="final-desktop">${table}</div>${cards}<div class="help-note"><b>Reglas originales:</b> H = Σ semanas; J = L + M; N = H − J; P = N × O; Q = N; R = −Q; T = R / S (vacío si S = 0); V = COCIENTE(R,U) / RESIDUO(R,U), con aviso si U ≤ 0. El saldo puede ser negativo y no se convierte en valor absoluto.</div>`;
}
function renderProducts(){
 const all=productsFiltered(),sel=selection(all);
 return `${heading('CATÁLOGO MAESTRO','Tus productos','Crea, renombra y ajusta parámetros sin romper la relación con las semanas.',`<button class="btn btn-primary" data-action="new-product">+ Añadir producto</button>`)}
 <div class="tool-strip"><div class="left">${searchBar('Buscar en el catálogo…')}</div><div class="right"><span class="muted">${state.products.length} productos en total</span></div></div>
 ${sel.rows.length?`<div class="list-cards">${sel.rows.map(p=>{const r=C.result(state,p);return `<article class="card catalog-row"><div><div class="catalog-name">${esc(p.name)}</div><div class="catalog-meta">${esc(p.category||'Sin categoría')} · ${esc(p.unit||'unidad')} · ${esc(p.id.slice(0,13))}</div></div><div class="catalog-value">Registrado <b>${format(r.H)}</b></div><div class="catalog-value">Saldo <b class="${r.N<0?'text-danger':''}">${format(r.N)}</b></div><div class="catalog-value">Valorización <b>${money(r.P)}</b></div><div class="catalog-actions"><button class="icon-btn" data-action="edit-product" data-id="${esc(p.id)}" title="Editar producto">✎</button><button class="icon-btn" data-action="remove-product" data-id="${esc(p.id)}" title="Eliminar producto">×</button></div></article>`;}).join('')}</div>${pageFoot(sel,'productos')}`:empty('Catálogo vacío',state.products.length?'Ningún producto coincide con la búsqueda.':'No se incorporaron nombres porque el PDF no contiene el inventario real.','new-product','Crear mi primer producto')}`;
}
function renderClients(){
 const q=clientQuery.toLocaleLowerCase('es').trim();const all=state.clients.filter(c=>`${c.code} ${c.name||''}`.toLocaleLowerCase('es').includes(q));
 return `${heading('COLUMNAS A-1…A-100','Clientes y espacios','Cada espacio puede tener un alias. Cambiarlo actualiza todas las semanas sin perder cantidades.',`<button class="btn btn-primary" data-action="add-client">+ Añadir espacio</button>`)}
 <div class="banner"><div><h3>${state.clients.length} espacios disponibles</h3><p>Los primeros 100 son equivalentes a las columnas A-1 hasta A-100 del Excel. Puedes agregar más sin modificar tus registros anteriores.</p></div><button class="btn" data-nav="weekly">Abrir registro</button></div>
 <div class="tool-strip"><div class="left"><label class="search"><input id="client-search" type="search" class="form-control" placeholder="Buscar A-1, nombre…" value="${esc(clientQuery)}"></label></div></div>
 <div class="client-grid">${all.map(c=>`<div class="card client-cell"><label for="client-${esc(c.id)}">${esc(c.code)} <span class="muted">· Identificador fijo</span></label><input id="client-${esc(c.id)}" data-edit="client-name" data-id="${esc(c.id)}" class="form-control" maxlength="90" value="${esc(c.name||'')}" placeholder="Nombre o alias"></div>`).join('')}</div>${!all.length?empty('Sin coincidencias','Prueba con otro código o nombre.'):''}`;
}
function renderAudit(){
 const log=state.audit;
 return `${heading('TRAZABILIDAD','Historial de actividad','Las últimas 350 acciones se registran localmente para ayudarte a identificar correcciones.',`<button class="btn" data-nav="backup">Respaldar historial</button>`)}
 <div class="banner"><div><h3>Registro de este dispositivo</h3><p>Este historial es informativo y se incluye en el JSON de respaldo. No equivale a auditoría a prueba de manipulación ni identifica usuarios diferentes.</p></div></div>
 <div class="audit-list">${log.length?log.map(e=>`<article class="card audit-row"><div><b>${esc(e.label)}</b><p>${esc(e.actor||'Este dispositivo')}</p></div><time datetime="${esc(e.at)}">${esc(stamp(e.at))}</time></article>`).join(''):empty('Sin modificaciones','Las ediciones aparecerán después del primer cambio.')}</div>`;
}
let backupsCache=[];
async function refreshBackups(){try{backupsCache=await DB.backups();}catch{backupsCache=[];}}
function renderBackup(){
 return `${heading('DATOS EN TUS MANOS','Copias de seguridad','Guarda versiones internas, descarga un archivo portátil y restaura los mismos datos en otro teléfono o computador.',`<button class="btn btn-primary" data-action="export-json">↧ Descargar respaldo</button>`)}
 <div class="backups-grid"><article class="card backup-action"><div class="backup-icon">⇩</div><h3>Exportar todos los datos</h3><p>Archivo JSON con productos, espacios, semanas, cantidades, precios, configuración e historial. También puedes cifrarlo con contraseña.</p><div class="page-tools"><button class="btn btn-primary" data-action="export-json">Descargar JSON</button><button class="btn" data-action="export-encrypted">Cifrar y descargar</button></div></article>
 <article class="card backup-action"><div class="backup-icon">⇧</div><h3>Importar o migrar datos</h3><p>Selecciona un archivo de respaldo de Inventarios GU o versiones anteriores. Puedes reemplazar todos los datos o fusionarlos por identificador para evitar duplicados.</p><div class="page-tools"><button class="btn btn-primary" data-action="import-file">Seleccionar archivo</button></div></article></div>
 <div class="card card-pad" style="margin-bottom:19px"><div class="card-title"><div><h3>${DB.mode?.()==='memory'?'Copias temporales de esta sesión':'Copias guardadas en este equipo'}</h3><p>Las copias internas están en el mismo navegador, no en la nube.</p></div><button class="btn btn-small" data-action="manual-snapshot">+ Crear copia interna</button></div>
 ${backupsCache.length?backupsCache.map(b=>`<div class="backup-item"><div class="backup-icon" style="width:35px;height:35px;font-size:17px;flex-shrink:0;margin:0">${b.type==='auto'?'◷':'▣'}</div><div class="backup-item-main"><b>${esc(b.label)}</b><small>${esc(stamp(b.createdAt))} · ${b.type==='auto'?'Automática':'Manual'}</small></div><div class="backup-item-actions"><button class="btn btn-small" data-action="restore-snapshot" data-id="${esc(b.id)}">Restaurar</button><button class="icon-btn" data-action="download-snapshot" data-id="${esc(b.id)}" title="Descargar">↓</button><button class="icon-btn" data-action="delete-snapshot" data-id="${esc(b.id)}" title="Eliminar">×</button></div></div>`).join(''):empty('Sin copias internas','Crea una copia de seguridad para conservar una versión recuperable en este navegador.')}</div>
 <div class="card card-pad"><div class="card-title"><div><h3>Exportaciones para Excel</h3><p>Archivos CSV separados por punto y coma; Excel puede abrirlos.</p></div></div><div class="page-tools"><button class="btn" data-action="csv-final">Descargar consolidado CSV</button><button class="btn" data-action="csv-movements">Descargar registros CSV</button></div><div class="help-note">Para migrar o restaurar la aplicación completa usa el <b>JSON</b>, no los CSV. El PDF recibido no trae los valores del Excel original; para importarlos directamente desde XLSX hace falta disponer del archivo XLSX.</div></div>
 <div class="banner alert" style="margin-top:20px"><div><h3>Importante sobre la conservación de datos</h3><p>Si borras los datos de navegación, el teléfono se restablece o se pierde el dispositivo, también se borran las copias internas. Descarga respaldos JSON periódicamente y guárdalos fuera del navegador.</p></div></div>`;
}
function paletteSwatch(label,key,description,a,b,c){return `<button class="theme-card ${state.settings.palette===key?'selected':''}" data-palette-change="${key}"><div class="theme-preview" style="background:${b}"><span style="background:${a}"></span><span style="background:${b}"><i style="display:block;width:48%;background:${c};border-radius:4px"></i><i style="display:block;width:48%;background:#fff6;border-radius:4px"></i></span></div><b>${label}</b><small>${description}</small></button>`;}
function renderSettings(){return `${heading('PERSONALIZACIÓN','El espacio a tu gusto','Elige una apariencia que funcione tanto en pantallas grandes como en tu teléfono.')}
 <div class="settings-grid"><article class="card card-pad"><div class="card-title"><div><h3>Paletas de color</h3><p>Tres estilos que cambian toda la interfaz.</p></div></div><div class="theme-grid">${paletteSwatch('Almendra','almond','Crema y marrón','#78583e','#f3eee7','#d6b993')}${paletteSwatch('Rojo y oro','redgold','Inspiración oriental','#9b292b','#f9ead9','#dbb15e')}${paletteSwatch('Gris y plata','silver','Diseño metálico','#576878','#edf0f4','#bbc6d0')}</div><div class="section-label">Luminosidad</div><div class="mode-switch"><button class="btn ${state.settings.mode==='light'?'active':''}" data-mode-change="light">☀ Modo diurno</button><button class="btn ${state.settings.mode==='dark'?'active':''}" data-mode-change="dark">☾ Modo oscuro</button></div></article>
 <article class="card card-pad"><div class="card-title"><div><h3>Preferencias de trabajo</h3><p>Se guardan localmente con el resto de tu configuración.</p></div></div><div class="field" style="margin-bottom:16px"><label>Moneda para valorización</label><select id="setting-currency" class="form-control"><option value="COP" ${state.settings.currency==='COP'?'selected':''}>COP · Peso colombiano</option><option value="USD" ${state.settings.currency==='USD'?'selected':''}>USD · Dólar</option><option value="EUR" ${state.settings.currency==='EUR'?'selected':''}>EUR · Euro</option><option value="MXN" ${state.settings.currency==='MXN'?'selected':''}>MXN · Peso mexicano</option><option value="CNY" ${state.settings.currency==='CNY'?'selected':''}>CNY · Yuan chino</option></select></div><div class="field"><label>Productos mostrados por página</label><select id="setting-pagesize" class="form-control"><option value="10" ${state.settings.pageSize===10?'selected':''}>10</option><option value="20" ${state.settings.pageSize===20?'selected':''}>20</option><option value="40" ${state.settings.pageSize===40?'selected':''}>40</option><option value="80" ${state.settings.pageSize===80?'selected':''}>80</option></select></div><div class="section-label">Información de almacenamiento</div><div class="info-list"><div class="info-row"><span>Productos</span><b>${state.products.length}</b></div><div class="info-row"><span>Espacios</span><b>${state.clients.length}</b></div><div class="info-row"><span>Semanas / períodos</span><b>${state.periods.length}</b></div><div class="info-row"><span>Última modificación</span><b>${esc(stamp(state.updatedAt))}</b></div><div class="info-row"><span>Almacenamiento</span><b>IndexedDB + cookies visuales</b></div></div></article></div>
 <div class="card card-pad" style="margin-top:18px"><div class="card-title"><div><h3>Administración rápida</h3><p>Acceso a las herramientas adicionales desde el teléfono.</p></div></div><div class="page-tools"><button class="btn" data-nav="clients">Clientes y espacios</button><button class="btn" data-nav="audit">Historial de cambios</button><button class="btn" data-nav="weekly">Semanas</button></div></div>
 <div class="card card-pad" style="margin-top:18px"><div class="card-title"><div><h3>Aplicación para PC, Android y iPhone</h3><p>Instalable desde el navegador, con modo sin conexión y datos locales.</p></div></div><button class="btn btn-primary" type="button" onclick="document.getElementById('install-open').click()">Instalar / preparar offline</button><p class="muted" style="margin-top:10px">Para usar en otro dispositivo, instala allí y transfiere los datos mediante Copias y migración.</p></div>
 <div class="settings-grid" style="margin-top:18px"><article class="card card-pad"><h3>Prueba de funcionamiento</h3><p class="muted">La demostración crea productos ficticios con cantidades de ejemplo. No debe confundirse con el Excel original.</p><button class="btn" data-action="demo">Añadir datos de demostración</button></article><article class="card card-pad danger-zone"><h3>Restablecer espacio</h3><p class="muted">Borra los productos, clientes modificados, períodos y registros actuales. Crea primero una copia descargable.</p><button class="btn btn-danger" data-action="reset">Borrar todos los datos</button></article></div>`;}
// Formularios de edición.
function showModal(title,body,foot=''){const root=$('#modal-root');root.innerHTML=`<div class="modal-cover" data-modal-cover="1"><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-action="close-modal" aria-label="Cerrar">×</button></div>${body}<div class="modal-foot">${foot}</div></section></div>`;setTimeout(()=>root.querySelector('input:not([type="hidden"]),select')?.focus(),10);}
function closeModal(){$('#modal-root').innerHTML='';}
function productModal(productId){
 const p=state.products.find(p=>p.id===productId);const isEdit=Boolean(p);
 const val=(k,def='')=>esc(p?.[k]??def);
 showModal(isEdit?'Editar producto':'Añadir producto',`<form id="product-form" data-id="${esc(productId||'')}" class="modal-body"><div class="modal-grid"><div class="field full"><label>Nombre del producto *</label><input name="name" class="form-control" maxlength="110" required value="${val('name')}" placeholder="Por ejemplo: Té de jazmín"></div><div class="field"><label>Categoría</label><input name="category" class="form-control" maxlength="70" value="${val('category')}" placeholder="Bebidas"></div><div class="field"><label>Unidad de medida</label><input name="unit" class="form-control" maxlength="30" value="${val('unit','unidad')}" placeholder="unidad"></div><div class="field"><label>Cantidad.N (L)</label><input type="number" step="any" name="quantityN" class="form-control" value="${val('quantityN',0)}"></div><div class="field"><label>Cantidad.V (M)</label><input type="number" step="any" name="quantityV" class="form-control" value="${val('quantityV',0)}"></div><div class="field"><label>Valor unitario (O)</label><input type="number" step="any" name="value" class="form-control" value="${val('value',0)}"></div><div class="field"><label>Promedio (S)</label><input type="number" step="any" name="average" class="form-control" value="${val('average',0)}"></div><div class="field full"><label>Unidades por caja (U)</label><input type="number" step="any" name="boxes" class="form-control" value="${val('boxes',0)}"><div class="field-help">Deja 0 si aún no has definido la presentación. El cálculo de cajas se mostrará como pendiente.</div></div></div></form>`,`<button class="btn" data-action="close-modal">Cancelar</button><button form="product-form" type="submit" class="btn btn-primary">${isEdit?'Guardar cambios':'Crear producto'}</button>`);
}
function periodModal(existing){
 const p=existing||{label:'Semana '+(state.periods.length+1),start:'',end:'',locked:false};
 showModal(existing?'Editar período':'Añadir período',`<form id="period-form" data-id="${esc(existing?.id||'')}" class="modal-body"><div class="modal-grid"><div class="field full"><label>Nombre del período</label><input name="label" maxlength="70" required class="form-control" value="${esc(p.label)}"></div><div class="field"><label>Fecha de inicio</label><input type="date" name="start" class="form-control" value="${esc(p.start)}"></div><div class="field"><label>Fecha de finalización</label><input type="date" name="end" class="form-control" value="${esc(p.end)}"></div>${existing?`<div class="field full"><label class="switch-line"><input type="checkbox" name="locked" ${p.locked?'checked':''}> Bloquear edición de cantidades, precios y total semanal</label></div>`:''}</div><p>Al bloquear un período no se eliminan registros; podrás reabrirlo después. Las fechas son independientes del número de semana.</p></form>`,`<button class="btn" data-action="close-modal">Cancelar</button>${existing&&state.periods.length>1?`<button class="btn btn-danger" data-action="remove-period" data-id="${esc(p.id)}">Eliminar</button>`:''}<button type="submit" form="period-form" class="btn btn-primary">Guardar período</button>`);
}
function getFormNum(form,key){const value=String(new FormData(form).get(key)??'').trim();if(value==='')return 0;const n=nf(value);if(n===null||Math.abs(n)>1e15)throw new Error(`«${key}» debe contener un número válido.`);return n;}
function submitProduct(form){
 const data=new FormData(form),name=String(data.get('name')||'').trim(),idToEdit=form.dataset.id;
 if(!name){toast('Escribe un nombre de producto.');return;}
 let numbers;try{numbers={quantityN:getFormNum(form,'quantityN'),quantityV:getFormNum(form,'quantityV'),value:getFormNum(form,'value'),average:getFormNum(form,'average'),boxes:getFormNum(form,'boxes')};}catch(e){toast(e.message);return;}
 const category=String(data.get('category')||'').trim(),unit=String(data.get('unit')||'unidad').trim()||'unidad';
 mutation(idToEdit?`Producto editado: ${name}`:`Producto creado: ${name}`,()=>{
  const p=idToEdit?state.products.find(x=>x.id===idToEdit):{id:id('prod'),createdAt:new Date().toISOString()};
  if(!p)throw new Error('Producto no encontrado.');Object.assign(p,{name,category,unit,...numbers});
  if(!idToEdit)state.products.push(p);
 });closeModal();
}
function submitPeriod(form){
 const data=new FormData(form),label=String(data.get('label')||'').trim(),start=String(data.get('start')||''),end=String(data.get('end')||'');
 if(!label){toast('Escribe un nombre para el período.');return;}
 if(start&&end&&start>end){toast('La fecha final no puede ser anterior a la inicial.');return;}
 const editId=form.dataset.id;
 mutation(editId?`Período actualizado: ${label}`:`Período creado: ${label}`,()=>{
   const p=editId?state.periods.find(x=>x.id===editId):{id:id('period'),locked:false};
   if(!p)throw new Error('Período no encontrado.');Object.assign(p,{label,start,end,locked:editId?data.has('locked'):false});
   if(!editId){state.periods.push(p);periodId=p.id;}
 });closeModal();
}
async function removalCheckpoint(label){
 const snapshot={id:id('safety'),createdAt:new Date().toISOString(),type:'manual',label:'Copia preventiva · '+label,data:clone(state)};
 await DB.backup(snapshot);await refreshBackups();
}
async function removeProduct(productId){
 const p=state.products.find(x=>x.id===productId);if(!p)return;
 if(!confirm(`¿Eliminar «${p.name}»? Se borrarán sus cantidades, precios y totales semanales. Se creará una copia interna preventiva.`))return;
 await removalCheckpoint('antes de eliminar producto');
 mutation(`Producto eliminado: ${p.name}`,()=>{state.products=state.products.filter(x=>x.id!==productId);for(const key of ['movements','prices','weekTotals'])for(const period of Object.values(state[key]))delete period[productId];});
}
async function removePeriod(pId){
 const p=state.periods.find(x=>x.id===pId);if(!p||state.periods.length<=1)return;
 if(!confirm(`¿Eliminar «${p.label}» y todos sus registros, precios y totales? Se creará una copia interna preventiva.`))return;
 await removalCheckpoint('antes de eliminar período');
 mutation(`Período eliminado: ${p.label}`,()=>{state.periods=state.periods.filter(x=>x.id!==pId);delete state.movements[pId];delete state.prices[pId];delete state.weekTotals[pId];if(periodId===pId)periodId=state.periods[0].id;});closeModal();
}
function editValue(el){
 const type=el.dataset.edit;
 if(!type)return;
 const pId=el.dataset.product,wId=el.dataset.period,cId=el.dataset.client;
 const p=state.products.find(p=>p.id===pId),w=state.periods.find(p=>p.id===wId);
 if(type==='client-name'){
  const c=state.clients.find(c=>c.id===el.dataset.id);if(!c)return;const name=el.value.trim().slice(0,90);
  if(name===c.name)return;mutation(`Espacio ${c.code} renombrado`,()=>c.name=name);return;
 }
 if(type==='product-field'){
  const field=el.dataset.field;if(!p||!['quantityN','quantityV','value','average','boxes'].includes(field))return;
  const n=nf(el.value.trim()||'0');if(n===null||Math.abs(n)>1e15){toast('Introduce un número válido.');render();return;}
  if(p[field]===n)return;mutation(`${p.name}: ${field} cambió de ${p[field]||0} a ${n}`,()=>p[field]=n);return;
 }
 if(!p||!w)return;if(w.locked){toast('Este período está cerrado.');render();return;}
 const raw=el.value.trim();const n=raw===''?null:nf(raw);
 if(n!==null && (n===null||Math.abs(n)>1e15)){toast('Introduce un número válido.');render();return;}
 if(raw!==''&&n===null){toast('Introduce un número válido.');render();return;}
 if(type==='movement'){
  const c=state.clients.find(c=>c.id===cId);if(!c)return;
  const prev=state.movements[wId]?.[pId]?.[cId];if((raw===''&&prev===undefined)||(raw!==''&&prev===n))return;
  mutation(`${w.label}: ${p.name}, ${c.name||c.code} → ${n===null?'vacío':n}`,()=>{
   if(!state.movements[wId])state.movements[wId]={};if(!state.movements[wId][pId])state.movements[wId][pId]={};
   if(n===null)delete state.movements[wId][pId][cId];else state.movements[wId][pId][cId]=n;
  });return;
 }
 if(type==='price'||type==='week-total'){
  const key=type==='price'?'prices':'weekTotals';const prev=state[key][wId]?.[pId];
  if((raw===''&&prev===undefined)||(raw!==''&&prev===n))return;
  mutation(`${w.label}: ${type==='price'?'Precio':'Total manual'} de ${p.name} → ${n===null?'vacío':n}`,()=>{
   if(!state[key][wId])state[key][wId]={};if(n===null)delete state[key][wId][pId];else state[key][wId][pId]=n;
  });
 }
}
function sampleData(){
 if(state.products.length && !confirm('Se agregarán 6 productos de ejemplo, sin borrar los tuyos. ¿Continuar?'))return;
 const catalog=[['Té verde','Infusiones',2,0,14000,12,12],['Té de jazmín','Infusiones',0,1,16000,10,10],['Té negro','Infusiones',1,0,13500,7,12],['Leche de almendras','Bebidas',2,4,8500,6,6],['Jarabe de lichi','Ingredientes',0,2,22000,5,8],['Infusión de frutas','Bebidas',0,0,11000,3,12]];
 mutation('Se agregaron productos de demostración (datos ficticios)',()=>{
   catalog.forEach((row,i)=>{
     const p={id:id('demo'),name:row[0],category:row[1],unit:'unidad',quantityN:row[2],quantityV:row[3],value:row[4],average:row[5],boxes:row[6],createdAt:new Date().toISOString()};state.products.push(p);
     state.periods.slice(0,5).forEach((w,wi)=>{
       if(!state.movements[w.id])state.movements[w.id]={};state.movements[w.id][p.id]={};
       for(let n=0;n<6;n++){const q=(i*3+wi*2+n)%8;if(q>1)state.movements[w.id][p.id][state.clients[n].id]=q;}
       if(!state.prices[w.id])state.prices[w.id]={};state.prices[w.id][p.id]=row[4];
     });
   });
 });toast('Se crearon seis productos de ejemplo. Puedes editarlos o eliminarlos.');
}
// Copias y migración (esquema versionado + SHA-256 cuando está disponible).
function downloadBlob(content,filename,type='application/json;charset=utf-8'){const blob=content instanceof Blob?content:new Blob([content],{type});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function filename(prefix,extension){return `${prefix}_${new Date().toISOString().slice(0,10)}.${extension}`;}
async function sha256(text){if(!crypto?.subtle)return null;const bytes=new TextEncoder().encode(text),hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');}
async function backupPackage(data){const body=clone(data);return {format:'almendra-inventario-backup',version:1,exportedAt:new Date().toISOString(),sha256:await sha256(JSON.stringify(body)),data:body};}
async function exportJSON(snapshot=state){const payload=await backupPackage(snapshot);downloadBlob(JSON.stringify(payload,null,2),filename('Inventarios_GU_Respaldo','json'));toast('Copia JSON descargada. Consérvala fuera del navegador.');}
function b64(bytes){let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(str);}
function fromB64(str){const binary=atob(str),array=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)array[i]=binary.charCodeAt(i);return array;}
async function encryptionKey(secret,salt,iterations,usage){const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,[usage]);}
let passwordResolve=null;
function askPassword(title,minimum=1){return new Promise(resolve=>{
 passwordResolve=resolve;
 showModal(title,`<form id="password-form" data-min="${minimum}" class="modal-body"><p>${minimum>1?'Se cifrará todo el respaldo con AES-GCM. Usa una contraseña de al menos 10 caracteres y guárdala: si la pierdes, no podrás recuperar el archivo.':'Escribe la contraseña utilizada al cifrar esta copia de seguridad.'}</p><div class="field"><label>Contraseña</label><input type="password" name="password" class="form-control" minlength="${minimum}" required autocomplete="off" placeholder="Contraseña de respaldo"></div></form>`,`<button class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="submit" form="password-form">Continuar</button>`);
 });}
async function encryptedExport(){
 if(!crypto?.subtle){toast('El cifrado necesita HTTPS o localhost y un navegador con Web Crypto.');return;}
 const secret=await askPassword('Cifrar copia de seguridad',10);if(!secret)return;
 try{const payload=await backupPackage(state),salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),iterations=250000,key=await encryptionKey(secret,salt,iterations,'encrypt');const bytes=new TextEncoder().encode(JSON.stringify(payload)),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,bytes);
 const wrapper={format:'almendra-inventario-encrypted',version:1,algorithm:'AES-256-GCM',kdf:'PBKDF2-SHA256',iterations,salt:b64(salt),iv:b64(iv),payload:b64(new Uint8Array(cipher))};downloadBlob(JSON.stringify(wrapper),filename('Inventarios_GU_Cifrado','json'));toast('Copia cifrada descargada. Conserva la contraseña.');
 }catch(e){toast('No fue posible cifrar el respaldo: '+e.message);}
}
async function decryptPackage(wrapped){
 if(!crypto?.subtle)throw new Error('La restauración cifrada necesita HTTPS o localhost.');
 const secret=await askPassword('Abrir copia cifrada',1);if(!secret)return null;
 if(![250000].includes(wrapped.iterations))throw new Error('Parámetros de cifrado no reconocidos.');
 try{const salt=fromB64(wrapped.salt),iv=fromB64(wrapped.iv),cipher=fromB64(wrapped.payload);if(salt.length!==16||iv.length!==12||cipher.length>60*1024*1024)throw new Error('Archivo cifrado no válido.');
 const key=await encryptionKey(secret,salt,wrapped.iterations,'decrypt'),plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,cipher);return JSON.parse(new TextDecoder().decode(plain));
 }catch{throw new Error('Contraseña incorrecta o archivo cifrado dañado.');}
}
function normalizeImported(raw){
 if(!raw||typeof raw!=='object'||!Array.isArray(raw.products)||!Array.isArray(raw.clients)||!Array.isArray(raw.periods))throw new Error('Este archivo no contiene un respaldo compatible de Inventarios GU.');
 if(raw.products.length>10000||raw.clients.length>10000||raw.periods.length>500||!raw.periods.length||!raw.clients.length)throw new Error('El respaldo tiene un tamaño o estructura no admitidos.');
 const makeUnique=(array,entity,normalize)=>{const seen=new Set();return array.map(v=>{if(!v||typeof v!=='object'||!safeid(v.id)||seen.has(v.id))throw new Error(`${entity}: identificador inválido o duplicado.`);seen.add(v.id);return normalize(v);});};
 const string=(v,max=130)=>String(v??'').slice(0,max);
 const decimal=v=>{const n=nf(v??0);if(n===null||Math.abs(n)>1e15)throw new Error('Respaldo con cantidades no numéricas o fuera de rango.');return n;};
 const products=makeUnique(raw.products,'Producto',p=>({id:p.id,name:string(p.name,110),category:string(p.category,70),unit:string(p.unit,30)||'unidad',quantityN:decimal(p.quantityN),quantityV:decimal(p.quantityV),value:decimal(p.value),average:decimal(p.average),boxes:decimal(p.boxes),createdAt:string(p.createdAt,40)}));
 const clients=makeUnique(raw.clients,'Cliente',c=>({id:c.id,code:string(c.code,35)||c.id,name:string(c.name,90),active:c.active!==false}));
 const periods=makeUnique(raw.periods,'Período',p=>({id:p.id,label:string(p.label,70)||'Período',start:/^\d{4}-\d{2}-\d{2}$/.test(p.start)?p.start:'',end:/^\d{4}-\d{2}-\d{2}$/.test(p.end)?p.end:'',locked:!!p.locked}));
 const periodIDs=new Set(periods.map(p=>p.id)),productIDs=new Set(products.map(p=>p.id)),clientIDs=new Set(clients.map(c=>c.id));
 let counter=0;
 function normalizeMatrix(source,withClient){const output=Object.create(null);if(source===undefined||source===null)return output;if(!source||typeof source!=='object'||Array.isArray(source))throw new Error('Estructura de registros no válida.');
  for(const [wid,productsMap] of Object.entries(source)){if(!periodIDs.has(wid))continue;if(!productsMap||typeof productsMap!=='object'||Array.isArray(productsMap))throw new Error('Registros de período no válidos.');
   const clean=Object.create(null);
   for(const [pid,item] of Object.entries(productsMap)){if(!productIDs.has(pid))continue;
    if(withClient){if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('Valores de celdas no válidos.');const matrix=Object.create(null);
      for(const [cid,value] of Object.entries(item)){if(!clientIDs.has(cid))continue;if(++counter>500000)throw new Error('Demasiadas celdas en el respaldo.');matrix[cid]=decimal(value);}
      clean[pid]=matrix;
    }else{if(++counter>500000)throw new Error('Demasiados valores en el respaldo.');clean[pid]=decimal(item);}
   }output[wid]=clean;
  }return output;
 }
 const settings=raw.settings||{};
 const palette=['almond','redgold','silver'].includes(settings.palette)?settings.palette:'almond';
 const mode=['dark','light'].includes(settings.mode)?settings.mode:'light';
 const currency=['COP','USD','EUR','MXN','CNY'].includes(settings.currency)?settings.currency:'COP';
 const pageSize=[10,20,40,80].includes(settings.pageSize)?settings.pageSize:20;
 const audit=Array.isArray(raw.audit)?raw.audit.slice(0,350).map(e=>({id:safeid(e.id)?e.id:id('evt'),label:string(e.label,240),actor:'Este dispositivo',at:string(e.at,50)})):[];
 return {version:1,createdAt:string(raw.createdAt,40)||new Date().toISOString(),updatedAt:new Date().toISOString(),settings:{palette,mode,currency,pageSize,lastAutoBackup:0},products,clients,periods,movements:normalizeMatrix(raw.movements,true),prices:normalizeMatrix(raw.prices,false),weekTotals:normalizeMatrix(raw.weekTotals,false),audit};
}
function mergeStates(local,remote){
 const mergeList=(a,b)=>{const byId=new Map(a.map(v=>[v.id,v]));for(const value of b)byId.set(value.id,value);return [...byId.values()];};
 const out=clone(local);
 out.products=mergeList(local.products,remote.products);out.clients=mergeList(local.clients,remote.clients);out.periods=mergeList(local.periods,remote.periods);
 for(const root of ['movements','prices','weekTotals']){
  for(const [wid,records] of Object.entries(remote[root])){
   if(!out[root][wid])out[root][wid]={};
   for(const [pid,value] of Object.entries(records)){
    if(root==='movements')out[root][wid][pid]={...(out[root][wid][pid]||{}),...value};
    else out[root][wid][pid]=value;
   }
  }
 }
 const byAudit=new Map([...remote.audit,...local.audit].map(e=>[e.id,e]));out.audit=[...byAudit.values()].sort((a,b)=>b.at.localeCompare(a.at)).slice(0,350);
 return out;
}
let pendingImport=null;
async function handleFile(file){
 if(!file)return;if(file.size>50*1024*1024){toast('El archivo supera 50 MB.');return;}
 try{const text=await file.text();let pkg=JSON.parse(text);
  if(pkg.format==='almendra-inventario-encrypted')pkg=await decryptPackage(pkg);
  if(!pkg)return;
  if(pkg.format!=='almendra-inventario-backup'||pkg.version!==1||!pkg.data)throw new Error('El archivo no es un respaldo JSON compatible de Inventarios GU.');
  if(pkg.sha256){const actual=await sha256(JSON.stringify(pkg.data));if(actual&&actual!==pkg.sha256)throw new Error('La verificación SHA-256 falló: el archivo fue modificado o está dañado.');}
  pendingImport=normalizeImported(pkg.data);
  showModal('Confirmar migración',`<div class="modal-body"><p>Respaldo compatible: <b>${pendingImport.products.length} productos</b>, <b>${pendingImport.clients.length} espacios</b>, <b>${pendingImport.periods.length} períodos</b>.</p><div class="section-label">Cómo aplicar la información</div><label class="switch-line" style="margin-bottom:15px"><input type="radio" name="import-mode" value="replace" checked> <span><b>Reemplazar todo</b><br>Restaurar exactamente los datos del archivo.</span></label><label class="switch-line"><input type="radio" name="import-mode" value="merge"> <span><b>Fusionar por identificador</b><br>Conservar ambos catálogos; si una celda comparte ID, prevalece la del archivo. No sumar valores repetidos.</span></label><div class="help-note">Se guardará una copia interna del estado actual antes de migrar.</div></div>`,`<button class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="confirm-import">Aplicar migración</button>`);
 }catch(e){toast('No se pudo importar: '+e.message);}
}
async function applyImport(){
 if(storageConflict){toast('Hay cambios en otra pestaña. Recarga antes de migrar.');return;}
 if(!pendingImport)return;
 const mode=$('input[name="import-mode"]:checked')?.value||'replace',incoming=pendingImport;
 try{await DB.backup({id:id('before'),type:'manual',createdAt:new Date().toISOString(),label:'Antes de importar',data:clone(state)});
  undoStack.push(clone(state));state=mode==='merge'?mergeStates(state,incoming):incoming;
  state.updatedAt=new Date().toISOString();state.audit.unshift({id:id('evt'),label:`Migración ${mode==='merge'?'fusionada':'restaurada'} desde JSON`,actor:'Este dispositivo',at:state.updatedAt});
  periodId=state.periods[0].id;slotOffset=0;page=0;query='';pendingImport=null;closeModal();scheduleSave();await refreshBackups();navigate('dashboard');toast('Migración realizada. Los datos se han recuperado.');
 }catch(e){toast('No se pudo completar la migración: '+e.message);}
}
async function makeSnapshot(){try{const entry={id:id('snapshot'),createdAt:new Date().toISOString(),type:'manual',label:'Copia manual',data:clone(state)};await DB.backup(entry);await refreshBackups();render();toast(DB.mode?.()==='memory'?'Copia temporal creada. Descarga un JSON antes de cerrar la vista previa.':'Copia interna creada. Descárgala si quieres protegerla fuera del navegador.');}catch(e){toast('No se pudo crear la copia: '+e.message);}}
async function restoreSnapshot(snapshotId){
 if(storageConflict){toast('Recarga antes de restaurar: otra pestaña ha cambiado los datos.');return;}
 const entry=backupsCache.find(b=>b.id===snapshotId);if(!entry)return;
 if(!confirm(`¿Restaurar la copia de ${stamp(entry.createdAt)}? Se reemplazarán los datos actuales. Se guardará una copia previa.`))return;
 try{await DB.backup({id:id('before'),createdAt:new Date().toISOString(),type:'manual',label:'Antes de restaurar',data:clone(state)});
  const recovered=normalizeImported(entry.data);undoStack.push(clone(state));state=recovered;state.updatedAt=new Date().toISOString();state.audit.unshift({id:id('evt'),at:state.updatedAt,actor:'Este dispositivo',label:'Copia interna restaurada'});
  periodId=state.periods[0].id;slotOffset=0;page=0;query='';scheduleSave();await refreshBackups();navigate('dashboard');toast('Se restauraron productos, movimientos y configuración.');
 }catch(e){toast('No fue posible restaurar: '+e.message);}
}
function csvEscape(value,textual=false){let string=String(value??'');if(textual&&/^[\s]*[=+@\-\t\r]/.test(string))string="'"+string;return '"'+string.replace(/"/g,'""')+'"';}
function csvDownload(rows,name){downloadBlob('\ufeff'+rows.map(row=>row.map((v,i)=>csvEscape(v,typeof v==='string')).join(';')).join('\r\n'),filename('Inventarios_GU_'+name,'csv'),'text/csv;charset=utf-8');toast('Archivo CSV descargado para abrir en Excel.');}
function csvFinal(){
 const header=['Producto','ID',...state.periods.map(p=>p.label),'H_Total_Semanas','L_CantidadN','M_CantidadV','J_LmasM','N_Stock','O_Valor','P_Total','Q_Cantidad','R_Cantidad2','S_Promedio','T_Meses','U_Cajas','V_CYU'];
 csvDownload([header,...state.products.map(p=>{const r=C.result(state,p);return [p.name,p.id,...r.weekly,r.H,p.quantityN,p.quantityV,r.J,r.N,p.value,r.P,r.Q,r.R,p.average,r.T??'',p.boxes,r.V??''];})],'Consolidado');
}
function csvMovements(){
 const rows=[['Período','Fecha_inicio','Fecha_fin','Producto','Producto_ID','Espacio','Nombre_espacio','Cantidad','Precio_semanal','Total_manual']];
 for(const w of state.periods)for(const p of state.products){const cells=state.movements[w.id]?.[p.id]||{};for(const [cid,quantity] of Object.entries(cells)){const client=state.clients.find(c=>c.id===cid);if(!client)continue;rows.push([w.label,w.start,w.end,p.name,p.id,client.code,client.name,quantity,state.prices[w.id]?.[p.id]??'',state.weekTotals[w.id]?.[p.id]??'']);}}
 csvDownload(rows,'Registros');
}
// Buscador global: navegación y acceso a productos con Ctrl/Cmd+K.
const searchTargets=[['dashboard','Panel general'],['weekly','Registro semanal'],['final','Consolidado'],['products','Productos'],['clients','Clientes / espacios'],['audit','Historial'],['backup','Copias y migración'],['settings','Configuración']];
function closePalette(){const dialog=$('#command-palette');if(dialog)dialog.hidden=true;}
function paletteOptions(){
 const input=$('#palette-input');if(!input||!state)return;
 const q=input.value.trim().toLocaleLowerCase('es');
 const menu=searchTargets.filter(x=>x[1].toLocaleLowerCase('es').includes(q)).slice(0,8);
 const products=state.products.filter(p=>`${p.name} ${p.category||''}`.toLocaleLowerCase('es').includes(q)).slice(0,12);
 const html=[...menu.map(([key,label])=>`<button type="button" class="command-result" data-command-view="${key}" role="option"><span class="command-kind">SECCIÓN</span><span>${esc(label)}</span><span class="command-arrow">↵</span></button>`),...products.map(p=>`<button type="button" class="command-result" data-command-product="${esc(p.id)}" role="option"><span class="command-kind">PRODUCTO</span><span>${esc(p.name)} <small>${esc(p.category||'')}</small></span><span class="command-arrow">↵</span></button>`)].join('');
 $('#palette-results').innerHTML=html||'<div class="command-empty">No hay resultados. Busca una sección o producto.</div>';
}
function openPalette(){if(!state)return;const dialog=$('#command-palette');dialog.hidden=false;$('#palette-input').value='';paletteOptions();$('#palette-input').focus();}
document.addEventListener('click',e=>{
 if(e.target.closest('[data-command-close]')){closePalette();return;}
 const v=e.target.closest('[data-command-view]');if(v){closePalette();navigate(v.dataset.commandView);return;}
 const p=e.target.closest('[data-command-product]');if(p){closePalette();productModal(p.dataset.commandProduct);return;}
 if(e.target.id==='command-palette')closePalette();
});
document.addEventListener('input',e=>{if(e.target.id==='palette-input')paletteOptions();});
// Eventos globales. La delegación mantiene editables las tablas tras cada actualización.
document.addEventListener('click',e=>{
 const btn=e.target.closest('[data-dashboard-panels]');if(!btn)return;
 const action=btn.dataset.dashboardPanels;
 const prefs=metricPrefs();
 if(action==='reset'){try{localStorage.removeItem(metricVisibilityKey)}catch{}}
 else document.querySelectorAll('.metric-panel[data-metric]').forEach(panel=>{prefs[panel.dataset.metric]=action==='collapse'});
 if(action!=='reset')try{localStorage.setItem(metricVisibilityKey,JSON.stringify(prefs))}catch{}
 render();
});
document.addEventListener('click',e=>{if(e.target.closest('[data-dashboard-export]'))exportDashboardCSV()});
document.addEventListener('click',e=>{const btn=e.target.closest('[data-review-filter]');if(!btn)return;reviewFilter=btn.dataset.reviewFilter;render();});
document.addEventListener('click',e=>{const btn=e.target.closest('[data-metric-toggle]');if(!btn)return;const panel=btn.closest('.metric-panel');if(!panel)return;const collapsed=panel.classList.toggle('metric-collapsed');const prefs=metricPrefs();prefs[btn.dataset.metricToggle]=collapsed;try{localStorage.setItem(metricVisibilityKey,JSON.stringify(prefs))}catch{}btn.textContent=collapsed?'＋ Mostrar':'− Minimizar';btn.setAttribute('aria-expanded',String(!collapsed));btn.title=collapsed?'Mostrar':'Minimizar';if(!collapsed){requestAnimationFrame(()=>{if(view==='dashboard'){drawDashboard();window.AlmendraWarehouse?.mount()}})}});
document.addEventListener('click',async e=>{
 const cover=e.target.closest('[data-modal-cover]');if(cover && e.target===cover){closeModal();if(passwordResolve){passwordResolve(null);passwordResolve=null;}return;}
 const nav=e.target.closest('[data-nav]');if(nav){navigate(nav.dataset.nav);return;}
 const tab=e.target.closest('[data-period-tab]');if(tab){switchPeriod(tab.dataset.periodTab);return;}
 const pg=e.target.closest('[data-page]');if(pg){page=Math.max(0,page+(pg.dataset.page==='next'?1:-1));render();return;}
 const palette=e.target.closest('[data-palette-change]');if(palette){if(state.settings.palette!==palette.dataset.paletteChange)mutation('Cambio de paleta visual',()=>state.settings.palette=palette.dataset.paletteChange);return;}
 const mode=e.target.closest('[data-mode-change]');if(mode){if(state.settings.mode!==mode.dataset.modeChange)mutation('Cambio de luminosidad',()=>state.settings.mode=mode.dataset.modeChange);return;}
 const btn=e.target.closest('[data-action]');if(!btn)return;
 const action=btn.dataset.action,targetId=btn.dataset.id;
 try{switch(action){
  case 'close-modal':closeModal();if(passwordResolve){passwordResolve(null);passwordResolve=null;}break;
  case 'new-product':productModal();break;
  case 'edit-product':productModal(targetId);break;
  case 'remove-product':await removeProduct(targetId);break;
  case 'new-period':periodModal();break;
  case 'edit-period':periodModal(activePeriod());break;
  case 'remove-period':await removePeriod(targetId);break;
  case 'clients':navigate('clients');break;
  case 'add-client':{const count=state.clients.length+1;mutation(`Espacio A-${count} creado`,()=>state.clients.push({id:id('client'),code:'A-'+count,name:'',active:true}));toast('Nuevo espacio A-'+count+' disponible en todas las semanas.');break;}
  case 'jump-week':periodId=btn.dataset.period||state.periods[0].id;query=state.products.find(p=>p.id===targetId)?.name||'';page=0;view='weekly';render();break;
  case 'demo':sampleData();break;
  case 'export-json':await exportJSON();break;
  case 'export-encrypted':await encryptedExport();break;
  case 'import-file':$('#backup-file').click();break;
  case 'manual-snapshot':await makeSnapshot();break;
  case 'restore-snapshot':await restoreSnapshot(targetId);break;
  case 'delete-snapshot':if(confirm('¿Eliminar esta copia de seguridad interna?')){await DB.deleteBackup(targetId);await refreshBackups();render();toast('Copia interna eliminada.');}break;
  case 'download-snapshot':{const backup=backupsCache.find(b=>b.id===targetId);if(backup)await exportJSON(backup.data);break;}
  case 'confirm-import':await applyImport();break;
  case 'csv-review':exportReviewCSV();break;
  case 'global-search':openPalette();break;
  case 'csv-final':csvFinal();break;
  case 'csv-movements':csvMovements();break;
  case 'reload':location.reload();break;
  case 'reset':{
    if(storageConflict){toast('Recarga antes de restablecer.');return;}
    if(!confirm('¿Borrar TODOS los datos de este espacio? Se guardará primero una copia interna, pero es recomendable descargar un JSON.'))return;
    if(!confirm('Última confirmación: ¿restablecer la aplicación a cero?'))return;
    await DB.backup({id:id('before-reset'),createdAt:new Date().toISOString(),type:'manual',label:'Antes de restablecer',data:clone(state)});
    undoStack.push(clone(state));state=newState();periodId='w1';page=0;query='';clientQuery='';slotOffset=0;await refreshBackups();scheduleSave();navigate('dashboard');toast('Espacio restablecido. Tu copia previa permanece en Copias.');break;
  }
 }}catch(err){toast('No se pudo completar la acción: '+err.message);}
});
document.addEventListener('submit',e=>{
 const form=e.target;if(!['product-form','period-form','password-form'].includes(form.id))return;e.preventDefault();
 if(form.id==='product-form')submitProduct(form);
 if(form.id==='period-form')submitPeriod(form);
 if(form.id==='password-form'){
  const secret=String(new FormData(form).get('password')||'');const min=Number(form.dataset.min)||1;
  if(secret.length<min){toast(`La contraseña requiere al menos ${min} caracteres.`);return;}
  const resolve=passwordResolve;passwordResolve=null;closeModal();resolve?.(secret);
 }
});
document.addEventListener('change',e=>{
 const el=e.target;
 if(el.matches('[data-edit]')){editValue(el);return;}
 if(el.id==='slot-count'){slotCount=Number(el.value);slotOffset=0;page=0;render();return;}
 if(el.id==='slot-offset'){slotOffset=Number(el.value)||0;page=0;render();return;}
 if(el.id==='setting-currency'){const currency=el.value;if(['COP','USD','EUR','MXN','CNY'].includes(currency))mutation('Moneda cambiada a '+currency,()=>state.settings.currency=currency);return;}
 if(el.id==='setting-pagesize'){const count=Number(el.value);if([10,20,40,80].includes(count))mutation('Tamaño de página cambiado',()=>{state.settings.pageSize=count;page=0;});return;}
});
document.addEventListener('input',e=>{
 const el=e.target;
 if(el.id==='product-search'){const pos=el.selectionStart;query=el.value;page=0;render();const next=$('#product-search');if(next){next.focus();try{next.setSelectionRange(pos,pos);}catch{}}}
 if(el.id==='client-search'){const pos=el.selectionStart;clientQuery=el.value;render();const next=$('#client-search');if(next){next.focus();try{next.setSelectionRange(pos,pos);}catch{}}}
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&!$('#command-palette')?.hidden){closePalette();return;}
 if(e.key==='Escape'&&$('#modal-root').innerHTML){closeModal();if(passwordResolve){passwordResolve(null);passwordResolve=null;}}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPalette();return;}
 if(!$('#command-palette')?.hidden&&['ArrowDown','ArrowUp','Enter'].includes(e.key)){
   const options=$$('#palette-results .command-result');
   if(!options.length)return;
   if(e.key==='Enter') {e.preventDefault();const target=options.find(x=>x===document.activeElement)||options[0];target.click();return;}
   e.preventDefault();const current=options.indexOf(document.activeElement),next=e.key==='ArrowDown'?(current+1)%options.length:(current<1?options.length-1:current-1);options[next].focus();return;
 }
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z' &&!e.target.matches('input,textarea,[contenteditable]')){e.preventDefault();undo();}
});
$('#undo-btn').addEventListener('click',undo);
$('#quick-theme').addEventListener('click',()=>{if(!state)return;mutation('Cambio de modo día/noche',()=>state.settings.mode=state.settings.mode==='dark'?'light':'dark');});
$('#quick-backup').addEventListener('click',()=>{if(state)exportJSON().catch(e=>toast(e.message));});
$('#backup-file').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';await handleFile(file);});
window.addEventListener('storage',e=>{if(e.key!=='almendra-last-revision'||!state)return;try{const note=JSON.parse(e.newValue);if(note.tabId!==tabId){storageConflict=true;indicator('Otra pestaña modificó los datos','error');render();}}catch{}});
let chartResizeTimer;window.addEventListener('resize',()=>{if(view!=='dashboard')return;clearTimeout(chartResizeTimer);chartResizeTimer=setTimeout(()=>drawDashboard(),150);});
async function init(){
 try{
  const loaded=await DB.load();
  state=loaded||newState();
  if(!Array.isArray(state.products)||!Array.isArray(state.clients)||!Array.isArray(state.periods)||!state.periods.length)throw new Error('Los datos locales parecen dañados. Restaura una copia de seguridad.');
  if(!state.weekTotals)state.weekTotals={};if(!state.prices)state.prices={};if(!state.movements)state.movements={};if(!state.audit)state.audit=[];
  if(!state.settings)state.settings=newState().settings;
  if(!loaded)await DB.save(state);
  periodId=state.periods[0].id;
  await refreshBackups();render();savedStatus();
  if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
 }catch(error){
  $('#main-content').innerHTML=`<div class="card card-pad"><h1>No se pudo abrir el espacio de datos</h1><p>${esc(error.message)}</p><p>Si existe un respaldo JSON, conserva ese archivo. Abre la aplicación desde HTTPS o localhost para recuperar los datos del navegador cuando estén disponibles.</p></div>`;
  indicator('Almacenamiento no disponible','error');
 }
}
init();
})();
