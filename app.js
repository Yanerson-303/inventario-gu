/*
  INVENTARIOS GU 4.0 — CONTROL DE INVENTARIO LOCAL
  Basado en la documentación de Software.xlsx. El PDF no contiene el inventario original.
  Sin servicios externos, sin envío de datos y sin librerías de terceros.
*/
(function(){
'use strict';
const DB=window.AlmendraDB, C=window.AlmendraCalc, Graph=window.AlmendraCharts, Insights=window.GUIInsights, Icons=window.GUIcons, Help=window.GUIHelp, M=window.GUMetricVisuals, GU4=window.GU4Core, G4Views=window.GU4Views, G4Excel=window.GU4Excel;
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
let state=null,view='dashboard',periodId='w1',slotOffset=0,slotCount=10,page=0,query='',clientQuery='',reviewFilter='all',reviewShowAll=false,finalFilter='all',productSort='original',clientFilter='all',auditQuery='',auditWindow='all';
let undoStack=[],saveTimer=null,saveQueue=Promise.resolve(),saveFailure=false,storageConflict=false,autoBackupDue=false,weeklyFocusNext=null;
let gu4Stage=[],gu4Sheet=null,gu4LayoutEditing=false;
const tabId=id('tab');
const titleMap={dashboard:'Panel general',weekly:'Registro semanal',final:'Consolidado',products:'Productos',clients:'Clientes / espacios',audit:'Historial',backup:'Copias y migración',settings:'Configuración',warehouse4:'Bodega física 4.0',counts4:'Conteos físicos',intelligence4:'Predicciones y alertas',imports4:'Excel e informes'};
function newState(){
 return {version:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),settings:{palette:'almond',mode:'light',currency:'COP',pageSize:20,density:'comfortable',lastAutoBackup:0},products:[],clients:Array.from({length:100},(_,i)=>({id:'c'+(i+1),code:'A-'+(i+1),name:'',active:true})),periods:Array.from({length:5},(_,i)=>({id:'w'+(i+1),label:'Semana '+(i+1),start:'',end:'',locked:false})),movements:{},prices:{},weekTotals:{},audit:[],gu4:{version:1,locations:[],counts:[],panelOrder:[],panelSizes:{},preferences:{warningThreshold:3}}};
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
 document.body.dataset.palette=state.settings.palette;document.body.dataset.mode=state.settings.mode;document.body.dataset.density=state.settings.density==='compact'?'compact':'comfortable';
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
 const activeViews={dashboard:renderDashboard,weekly:renderWeekly,final:renderFinal,products:renderProducts,clients:renderClients,audit:renderAudit,backup:renderBackup,settings:renderSettings,warehouse4:()=>G4Views.warehouse(state,C),counts4:()=>G4Views.counts(state,C,gu4Stage),intelligence4:()=>G4Views.intelligence(state,C),imports4:()=>G4Views.imports(state,C,gu4Sheet)};
 $('#main-content').innerHTML=storageNotice()+(storageConflict?'<div class="banner alert"><div><h3>Conflicto entre pestañas</h3><p>Se detectaron cambios desde otra pestaña. Recarga para recuperar la última versión antes de editar.</p></div><button class="btn" data-action="reload">Recargar</button></div>':'')+activeViews[view]();
 if(view==='dashboard')G4Views?.layoutDashboard($('#main-content'),state,gu4LayoutEditing);
 Icons?.enhance($('#main-content'));Help?.enhance($('#main-content'));
 if(view==='dashboard')requestAnimationFrame(()=>{drawDashboard();window.AlmendraWarehouse?.mount();});
 if(view==='warehouse4')requestAnimationFrame(()=>window.AlmendraWarehouse?.mount());
 if(view==='weekly'&&weeklyFocusNext){const next=weeklyFocusNext;weeklyFocusNext=null;requestAnimationFrame(()=>{const target=$$('.week-scroll-2d tbody tr')[next.r]?.cells?.[next.c]?.querySelector('input:not(:disabled)');target?.focus();target?.select?.();});}
}
const metricVisibilityKey='inventarios-gu-metricas-v22'; // Compatibilidad con preferencias de 2.2
const metricLabels={volumen:'Volumen semanal',saldo:'Saldo calculado',valor:'Valorización',productos:'Productos',stock:'Unidades en stock',referencias:'Referencias con stock',bodega:'Bodega 3D',proyecciones:'Proyecciones', 'grafico-semanal':'Gráfico semanal','grafico-productos':'Productos destacados',revision:'Revisión',tendencias:'Comparativa', 'vista-rapida':'Vista rápida',actividad:'Actividad'};
function metricPrefs(){try{return JSON.parse(localStorage.getItem(metricVisibilityKey)||'{}')||{}}catch{return {}}}
const metricIconNames={volumen:'calendar-days',saldo:'activity',valor:'trending-up',productos:'package',stock:'boxes',referencias:'archive',bodega:'boxes',proyecciones:'trending-up','grafico-semanal':'activity','grafico-productos':'bar-chart-3',revision:'shield-check',tendencias:'trending-up','vista-rapida':'layers',actividad:'history'};
function metricButton(id,collapsed=false){
 const title=esc(metricLabels[id]||id),verb=collapsed?'Expandir':'Contraer';
 return `<button type="button" class="metric-toggle metric-icon-control" data-metric-toggle="${id}" aria-expanded="${!collapsed}" aria-label="${verb} ${title}" title="${verb} ${title}">${Icons.svg(metricIconNames[id]||'package')}</button>`;
}
function metricBox(id,html){
 const collapsed=!!metricPrefs()[id],icon=metricButton(id);
 // Las tarjetas KPI usan su propio icono como botón; las demás lo colocan en el encabezado.
 if(html.includes('class="stat-icon"'))html=html.replace(/<div class="stat-icon">[\s\S]*?<\/div>/,`<div class="stat-icon stat-icon-container">${icon}</div>`);
 else if(/class="warehouse-heading"/.test(html))html=html.replace(/(<div class="warehouse-heading"[^>]*>)/,`$1${icon}`);
 else if(/class="card-title/.test(html))html=html.replace(/(<div class="card-title[^"]*"[^>]*>)/,`$1${icon}`);
 else html=`<div class="metric-inline-title">${icon}<strong>${esc(metricLabels[id]||id)}</strong></div>`+html;
 return `<div class="metric-panel ${collapsed?'metric-collapsed':''}" data-metric="${id}"><div class="metric-folded-bar">${metricButton(id,true)}<span class="metric-folded-title">${esc(metricLabels[id]||id)}</span></div><div class="metric-content">${html}</div></div>`;
}
function renderDashboard(){
 const all=C.totals(state,state.products);
 const open=state.periods.filter(p=>!p.locked).length;
 const top=all.rows.slice().sort((a,b)=>Math.abs(b.H)-Math.abs(a.H)).slice(0,6);
 const recent=state.audit.slice(0,5),review=Insights.analyze(state,C,all.rows);
 const weeklyValues=state.periods.map(p=>({label:p.label,value:state.products.reduce((a,pr)=>a+C.qty(state,p.id,pr.id),0)}));
 return `${heading('VISTA GENERAL','Panel de control','Resumen del inventario, actualizado con los movimientos.',`<button class="btn" data-nav="weekly">Abrir semanas</button><button class="btn btn-primary" data-action="new-product">+ Nuevo producto</button>`)}
 <div class="dashboard-tools" role="group" aria-label="Personalizar indicadores"><div><strong>Personalizar panel</strong></div><div class="dashboard-tools-actions"><button type="button" class="btn btn-small" data-dashboard-panels="expand">Mostrar todas</button><button type="button" class="btn btn-small" data-dashboard-panels="collapse">Contraer todas</button><button type="button" class="btn btn-small" data-dashboard-panels="reset">Restablecer vista</button><button type="button" class="btn btn-small" data-dashboard-export="csv">Exportar resumen CSV</button></div></div>
 ${renderStockAlerts(all)}
 ${!state.products.length?`<div class="banner"><div><h3>Inventario vacío</h3><p>Añade productos para comenzar.</p></div><button class="btn btn-primary" data-action="demo">Ver demostración</button></div>`:''}
 ${all.negative?`<div class="banner alert"><div><h3>${all.negative} producto(s) con saldo negativo</h3><p>Los valores negativos se conservan como en la fórmula de Excel. Verifica si representan faltantes, pedidos u otra operación.</p></div><button class="btn" data-nav="final">Revisar saldos</button></div>`:''}
 <section class="stats-grid" aria-label="Indicadores generales">
 ${metricBox('volumen',statCard('Volumen de las semanas',format(all.quantity),'Suma de todas las entradas · H','▦',M.spark(weeklyValues.slice(-12),'Volumen por período',{left:'Por semanas',right:'Últimos registros',emptyWhenZero:true})))}
 ${metricBox('saldo',statCard('Saldo calculado',format(all.balance),'H − (Cantidad.N + Cantidad.V)','◎',M.balances(all.rows)))}
 ${metricBox('valor',statCard('Valorización total',money(all.value),'Suma de saldo × valor unitario · P','◈',M.valueMix(all.rows)))}
 ${metricBox('productos',statCard('Productos registrados',format(state.products.length,0),`${open} períodos abiertos · ${state.clients.length} espacios`,'◇',M.catalogue(all.rows)))}
 ${metricBox('stock',statCard('Unidades en stock',format(all.rows.reduce((sum,r)=>sum+Math.max(0,r.N),0)),'Suma de saldos positivos disponibles · N','▣',M.stockTop(all.rows)))}
 ${metricBox('referencias',statCard('Referencias con stock',format(all.rows.filter(r=>r.N>0).length,0),`${all.rows.filter(r=>r.N===0).length} sin saldo · ${all.negative} con saldo negativo`,'◉',M.references(all.rows)))}
 </section>
 <div class="dashboard-visual-row">
 ${metricBox('bodega',window.AlmendraWarehouse?.render(state,C)||'')}
 ${metricBox('proyecciones',renderProjections())}
 </div>
 <div class="dashboard-grid">${metricBox('grafico-semanal',`<article class="card card-pad"><div class="card-title"><div><h3>Movimiento por semana</h3><p>Unidades registradas, incluyendo las columnas ocultas.</p></div><span class="badge">TODAS</span></div><canvas class="chart" id="weekly-chart" role="img" aria-label="Línea temporal de cantidades registradas por período"></canvas><details class="chart-data-summary"><summary>Ver cifras por semana</summary><div class="table-scroll"><table class="data-table"><thead><tr><th>Período</th><th class="num">Unidades</th></tr></thead><tbody>${weeklyValues.map(x=>`<tr><td>${esc(x.label)}</td><td class="num">${format(x.value)}</td></tr>`).join('')}</tbody></table></div></details></article>`)}
 ${metricBox('grafico-productos',`<article class="card card-pad"><div class="card-title"><div><h3>Productos con mayor registro</h3><p>Volumen absoluto acumulado.</p></div><span class="badge">TOP 6</span></div>${top.length?`<canvas class="chart" id="top-chart" role="img" aria-label="Barras de productos con mayor registro"></canvas><details class="chart-data-summary"><summary>Ver cifras</summary><div class="table-scroll"><table class="data-table"><thead><tr><th>Producto</th><th class="num">Unidades</th></tr></thead><tbody>${top.map(r=>`<tr><td>${esc(r.product.name)}</td><td class="num">${format(r.H)}</td></tr>`).join('')}</tbody></table></div></details>`:empty('Sin movimientos','Añade tu primer producto y registra cantidades.')}</article>`)}</div>
 <div class="dashboard-v3-row">${metricBox('revision',renderReviewCenter(review))}${metricBox('tendencias',renderPeriodComparison(review))}</div>
 <div class="dashboard-bottom">${metricBox('vista-rapida',`<article class="card card-pad"><div class="card-title"><div><h3>Vista rápida del inventario</h3><p>Resumen de los productos que contienen más registros.</p></div><button class="btn btn-small" data-nav="final">Ver consolidado</button></div>${top.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th>Producto</th><th class="num">Registrado</th><th class="num">Saldo</th><th class="num">Valor total</th></tr></thead><tbody>${top.map(r=>`<tr><td>${productButton(r.product)}</td><td class="num">${format(r.H)}</td><td class="num">${statusBalance(r.N)}</td><td class="num">${money(r.P)}</td></tr>`).join('')}</tbody></table></div>`:empty('Aún no hay productos','Agrega un producto para visualizarlo aquí.','new-product','Crear producto')}</article>`)}
 ${metricBox('actividad',`<article class="card card-pad"><div class="card-title"><div><h3>Actividad reciente</h3><p>Últimas modificaciones guardadas en este equipo.</p></div><button class="btn btn-small" data-nav="audit">Historial</button></div>${recent.length?recent.map(r=>`<div class="activity-item"><div class="activity-icon">✎</div><div class="activity-body"><b>${esc(r.label)}</b><p>Registro local</p></div><span class="activity-time">${esc(stamp(r.at))}</span></div>`).join(''):empty('Sin actividad','Tus cambios aparecerán aquí.')}</article>`)}</div>`;
}
function renderReviewCenter(info){
 const active=info.categories.find(c=>c.id===reviewFilter);
 const filtered=active?info.issues.filter(x=>x.id===active.id):info.issues;
 const n=Math.min(filtered.length,reviewShowAll?500:6);
 return `<section class="card card-pad control-center" aria-label="Centro de revisión del inventario"><div class="card-title gu-control-head"><div><span class="eyebrow">CONTROL Y CALIDAD DE DATOS</span><h3>Centro de revisión</h3><p>Observaciones para verificar, sin modificar tus registros.</p></div><button class="btn btn-small" data-action="csv-review">Exportar revisión</button></div>
 <div class="health-strip"><div><span>Referencias con registros</span><strong>${info.referenced} / ${info.productCount}</strong><div class="health-meter"><i style="width:${info.productCount?Math.round(info.referenced/info.productCount*100):0}%"></i></div></div><div><span>Períodos con fechas válidas</span><strong>${info.dated} / ${info.periodCount}</strong><div class="health-meter"><i style="width:${info.periodCount?Math.round(info.dated/info.periodCount*100):0}%"></i></div></div><div><span>Saldos negativos</span><strong class="${info.critical?'text-danger':''}">${info.critical}</strong><small>Requieren revisión</small></div></div>
 <div class="gu-review-chart"><h4>Observaciones por tipo</h4>${M.issueBars(info)}</div>
 <div class="review-filters" role="group" aria-label="Filtrar observaciones"><button type="button" data-review-filter="all" aria-pressed="${reviewFilter==='all'}" class="${reviewFilter==='all'?'active':''}">Todas <b>${info.issues.length}</b></button>${info.categories.map(c=>`<button type="button" data-review-filter="${c.id}" aria-pressed="${reviewFilter===c.id}" class="${reviewFilter===c.id?'active':''}">${esc(c.name)} <b>${info.counts[c.id]}</b></button>`).join('')}</div>
 <div class="review-list">${filtered.length?filtered.slice(0,n).map(i=>`<div class="review-row"><span class="review-state ${i.id==='negative'?'risk':i.id==='zero'?'caution':''}">${esc(info.categories.find(c=>c.id===i.id)?.name||i.id)}</span><div class="review-row-info"><b>${esc(i.name)}</b><small>${esc(i.detail)}</small></div><button type="button" class="btn btn-small" data-action="edit-product" data-id="${esc(i.productId)}">Revisar</button></div>`).join(''):`<div class="review-empty">No hay observaciones con este filtro.</div>`}</div>
 <div class="review-actions"><small class="muted">${filtered.length>n?`${n} / ${filtered.length}`:`${filtered.length} casos`}</small>${filtered.length>6?`<button type="button" class="btn btn-small" data-review-more="1" aria-expanded="${reviewShowAll}">${reviewShowAll?'Ver menos':'Ver más'}</button>`:''}</div></section>`;
}
function renderPeriodComparison(info){
 const comp=Insights.comparison(state,C);
 return `<section class="card card-pad trend-card" aria-label="Comparativa de períodos"><div class="card-title"><div><span class="eyebrow">EVOLUCIÓN DE LOS REGISTROS</span><h3>Comparativa de períodos</h3><p>Últimos dos períodos según el orden de registro.</p></div><span class="badge">DESCRIPTIVO</span></div>${comp?`<div class="trend-pair"><div><span>${esc(comp.previousLabel)}</span><strong>${format(comp.previous)}</strong></div><div><span>${esc(comp.currentLabel)}</span><strong>${format(comp.current)}</strong></div></div><div class="trend-change"><span class="${comp.difference<0?'text-danger':comp.difference>0?'text-good':''}">${comp.difference>0?'+':''}${format(comp.difference)} unidades</span><small>${comp.percent===null?'Sin base anterior para calcular porcentaje':(comp.percent>0?'+':'')+format(comp.percent)+'% frente al período anterior'}</small></div>`:'<div class="review-empty">Se necesitan al menos dos períodos para comparar sus movimientos.</div>'}${comp?`<div class="gu-trend-visual">${M.barRows([{label:comp.previousLabel,value:comp.previous},{label:comp.currentLabel,value:comp.current}],'Comparativa entre los últimos dos períodos')}</div>`:''}<div class="trend-info"><div><span class="trend-dot"></span><b>${format(info.productCount,0)}</b><small>Productos en el catálogo</small></div><div><span class="trend-dot success"></span><b>${format(info.referenced,0)}</b><small>Con movimientos registrados</small></div></div><p class="review-foot">Una variación de registros no demuestra ventas, ganancias ni demanda futura. Usa las fechas y el contexto de tus operaciones.</p><button class="btn btn-small trend-open" data-nav="weekly">Consultar semanas</button></section>`;
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
  return {label:p.label,start:p.start,days,quantity:state.products.reduce((sum,pr)=>sum+C.qty(state,p.id,pr.id),0)};
 }).filter(Boolean);
 const days=observations.reduce((sum,p)=>sum+p.days,0);
 const quantity=observations.reduce((sum,p)=>sum+p.quantity,0);
 const daily=days?quantity/days:null;
 const periods=[['Diaria',1],['Semanal',7],['Mensual',30],['Anual',365]];
 const ready=daily!==null&&observations.length>0;
 return `<section class="card forecast-card" aria-label="Proyección de movimiento"><div class="card-title"><div><h3>Proyección de movimiento</h3><p>Estimación según los registros y fechas de los períodos.</p></div><span class="badge">ESTIMACIÓN</span></div><div class="forecast-grid">${periods.map(([label,span])=>`<div class="forecast-item"><span>${label}</span><strong class="mono">${ready?format(daily*span):'—'}</strong><small>${ready?'unidades estimadas':'Sin datos fechados'}</small></div>`).join('')}</div><div class="forecast-chart">${ready?M.spark(observations.slice().sort((a,b)=>a.start.localeCompare(b.start)).map(o=>({label:o.label,value:o.quantity/o.days})),'Ritmo diario registrado por período',{left:'Ritmo por período',right:'Unid./día'}):M.spark([],'Sin fechas')}</div><p class="forecast-note">${ready?`Base: ${format(days,0)} días con fechas válidas · ${observations.length} períodos · Mes 30 días · Año 365 · No equivale a ventas.`:'Para calcular proyecciones, registra las fechas de inicio y fin de al menos un período semanal. No se inventan datos.'}</p></section>`;
}
function statCard(label,value,foot,icon,visual=''){return `<article class="card stat-card ${visual?'visual-stat':''}"><div class="stat-icon">${Icons?.svg(icon)||icon}</div><div class="stat-label">${esc(label)}</div><div class="stat-value mono">${esc(value)}</div>${visual?`<div class="stat-visual">${visual}</div>`:''}<div class="stat-foot">${esc(foot)}</div></article>`;}
function drawDashboard(){
 const weekly=state.periods.map(p=>({label:p.label,value:state.products.reduce((a,pr)=>a+C.qty(state,p.id,pr.id),0)}));
 Graph.line('weekly-chart',weekly.slice(-14));window.GUChartHover?.attach('weekly-chart','line',weekly.slice(-14));
 const top=state.products.map(p=>({label:p.name,value:C.result(state,p).H})).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)).slice(0,6);
 if(top.length){Graph.horizontal('top-chart',top);window.GUChartHover?.attach('top-chart','horizontal',top);}
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
 return `${heading('CAPTURA DE DATOS','Registro semanal','Registra cantidades por espacio. Enter avanza una fila; Alt + flechas navega entre celdas.',`<button class="btn" data-action="edit-period">Editar período</button><button class="btn btn-primary" data-action="new-period">+ Semana</button>`)}
 <div class="week-tabs" role="tablist" aria-label="Períodos">${state.periods.map(p=>`<button class="week-tab ${p.id===period.id?'active':''}" data-period-tab="${esc(p.id)}" role="tab" aria-selected="${p.id===period.id}">${esc(p.label)}${p.locked?' · 🔒':''}</button>`).join('')}</div>
 <div class="period-head"><div><span class="badge ${locked?'warn':'good'}">${locked?'Período cerrado':'Período editable'}</span> <span class="muted" style="font-size:12px;margin-left:8px">${esc(period.start||'Sin fecha de inicio')} ${period.end?'→ '+esc(period.end):''}</span></div><div class="summary-inline"><span>Volumen de la semana: <strong>${format(weekQty)}</strong></span><span>Productos: <strong>${state.products.length}</strong></span></div></div>
 <div class="tool-strip"><div class="left">${searchBar()}${slotSelect()}</div><div class="right"><button class="btn btn-small" data-action="clients">Editar nombres A-1…</button><button class="btn btn-small" data-action="new-product">+ Producto</button></div></div>
 ${locked?'<div class="banner alert"><div><h3>Este período está bloqueado</h3><p>Para corregir movimientos, reabre el período desde «Editar período». La acción quedará registrada en el historial.</p></div><button class="btn" data-action="edit-period">Administrar</button></div>':''}
 <p class="table-hint">Desplazamiento horizontal y vertical. Enter ↓ · Alt + flechas para navegar. En móvil: tarjetas.</p>${desktop}${mobile}<p class="table-hint">* «Estimado» es un cálculo nuevo de la web (Stock semanal × Precio). La columna «Total manual» reproduce el campo editable CZ del Excel y no se confunde con el estimado. Los espacios no visibles siguen contando en Stock.</p>`;
}
function renderFinal(){
 const filteredProducts=productsFiltered(),all=filteredProducts.filter(p=>{const n=C.result(state,p).N;return finalFilter==='all'||(finalFilter==='positive'?n>0:finalFilter==='zero'?n===0:n<0);}),sel=selection(all),allTotals=C.totals(state,state.products),visibleTotals=C.totals(state,all);
 const columns=[['quantityN','Cantidad.N (L)'],['quantityV','Cantidad.V (M)'],['value','Valor (O)'],['average','Promedio (S)'],['boxes','Cajas (U)']];
 const editable=(p,field)=>numInput('product-field',p[field]??0,`data-product="${esc(p.id)}" data-field="${field}" aria-label="${esc(field)} de ${esc(p.name)}"`);
 const table=sel.rows.length?`<div class="card final-table"><div class="table-scroll"><table class="data-table"><thead><tr><th class="sticky-first">Producto</th>${state.periods.map(p=>`<th class="num">${esc(p.label)}</th>`).join('')}<th class="num">Registrado H</th><th class="num">Cantidad.N</th><th class="num">Cantidad.V</th><th class="num">L+M (J)</th><th class="num">Saldo N</th><th class="num">Valor O</th><th class="num">Total P</th><th class="num">Q</th><th class="num">R = -Q</th><th class="num">Promedio S</th><th class="num">Meses T</th><th class="num">Cajas U</th><th>CYU (V)</th></tr></thead><tbody>${sel.rows.map(pr=>{const r=C.result(state,pr);return `<tr><td class="sticky-first">${productButton(pr)}</td>${r.weekly.map((n,i)=>`<td class="num"><button class="product-link mono" data-action="jump-week" data-id="${esc(pr.id)}" data-period="${esc(state.periods[i].id)}">${format(n)}</button></td>`).join('')}<td class="num t-em">${format(r.H)}</td><td>${editable(pr,'quantityN')}</td><td>${editable(pr,'quantityV')}</td><td class="num">${format(r.J)}</td><td class="num t-em">${statusBalance(r.N)}</td><td>${editable(pr,'value')}</td><td class="num t-em">${money(r.P)}</td><td class="num">${format(r.Q)}</td><td class="num">${format(r.R)}</td><td>${editable(pr,'average')}</td><td class="num">${r.T===null?'<span class="badge warn">Sin promedio</span>':format(r.T)}</td><td>${editable(pr,'boxes')}</td><td>${r.V===null?'<span class="badge warn">Sin cajas</span>':esc(r.V)}</td></tr>`;}).join('')}</tbody></table></div>${pageFoot(sel,'productos')}</div>`:empty('No hay resultados',state.products.length?'No hay coincidencias con ese nombre.':'Agrega un producto o importa una copia de tus datos.','new-product','Añadir producto');
 const cards=sel.rows.length?`<div class="final-mobile">${sel.rows.map(p=>{const r=C.result(state,p);return `<article class="card card-pad"><div class="week-product-head">${productButton(p)}<span class="badge ${r.N<0?'danger':'good'}">Saldo: ${format(r.N)}</span></div><div class="mini-summary-grid"><div><small>Registrado (H)</small><b>${format(r.H)}</b></div><div><small>Valorización (P)</small><b>${money(r.P)}</b></div><div><small>Meses (T)</small><b>${r.T===null?'—':format(r.T)}</b></div><div><small>Cajas / unidades</small><b>${esc(r.V??'—')}</b></div></div><div class="week-product-grid">${columns.map(([key,label])=>`<div class="field"><label>${esc(label)}</label><input class="form-control" type="number" inputmode="decimal" step="any" value="${esc(p[key]??0)}" data-edit="product-field" data-field="${key}" data-product="${esc(p.id)}"></div>`).join('')}</div><div class="week-product-foot"><span>Ver registro semanal</span><button class="btn btn-small" data-action="jump-week" data-id="${esc(p.id)}" data-period="${esc(state.periods[0].id)}">Abrir →</button></div></article>`;}).join('')}${pageFoot(sel,'productos')}</div>`:`<div class="final-mobile">${empty('Sin resultados','Crea productos o importa una copia de tus datos.','new-product','Añadir producto')}</div>`;
 return `${heading('CONSOLIDADO / FINAL','Consolidado','Saldos y valorización calculados según las fórmulas originales.',`<button class="btn" data-action="csv-final">Exportar CSV</button><button class="btn btn-primary" data-nav="weekly">Ir a semanas</button>`)}
 <div class="final-summary"><div class="mini-kpi">H · Registro total<strong>${format(allTotals.quantity)}</strong></div><div class="mini-kpi">N · Saldo total<strong class="${allTotals.balance<0?'text-danger':''}">${format(allTotals.balance)}</strong></div><div class="mini-kpi">P · Valor global<strong>${money(allTotals.value)}</strong></div><div class="mini-kpi">Productos filtrados<strong>${all.length} de ${state.products.length}</strong></div></div>
 <div class="tool-strip"><div class="left">${searchBar()}</div><div class="right"><span class="muted" style="font-size:11px">Subtotal: ${money(visibleTotals.value)}</span></div></div>
 <div class="gu-filterbar" role="group" aria-label="Filtrar saldos"><span class="gu-filter-label">Saldo</span>${[['all','Todos'],['positive','Positivo'],['zero','En cero'],['negative','Negativo']].map(([k,label])=>`<button type="button" data-final-filter="${k}" aria-pressed="${finalFilter===k}">${label}</button>`).join('')}<span class="muted">${all.length} referencias</span></div>
 <div class="final-desktop">${table}</div>${cards}<div class="help-note"><b>Reglas originales:</b> H = Σ semanas; J = L + M; N = H − J; P = N × O; Q = N; R = −Q; T = R / S (vacío si S = 0); V = COCIENTE(R,U) / RESIDUO(R,U), con aviso si U ≤ 0. El saldo puede ser negativo y no se convierte en valor absoluto.</div>`;
}
function renderProducts(){
 const all=productsFiltered().slice();
 if(productSort==='name')all.sort((a,b)=>a.name.localeCompare(b.name,'es'));
 else if(productSort==='stock')all.sort((a,b)=>C.result(state,a).N-C.result(state,b).N);
 else if(productSort==='value')all.sort((a,b)=>C.result(state,b).P-C.result(state,a).P);
 const sel=selection(all);
 return `${heading('CATÁLOGO MAESTRO','Productos','Catálogo y parámetros por referencia.',`<button class="btn btn-primary" data-action="new-product">+ Añadir producto</button>`)}
 <div class="tool-strip"><div class="left">${searchBar('Buscar en el catálogo…')}</div><div class="right"><label class="gu-sort-label"><span class="muted">Ordenar</span><select class="form-control" id="product-sort"><option value="original" ${productSort==='original'?'selected':''}>Registro</option><option value="name" ${productSort==='name'?'selected':''}>Nombre</option><option value="stock" ${productSort==='stock'?'selected':''}>Menor stock</option><option value="value" ${productSort==='value'?'selected':''}>Mayor valor</option></select></label><span class="muted">${all.length} / ${state.products.length}</span></div></div>
 ${sel.rows.length?`<div class="list-cards">${sel.rows.map(p=>{const r=C.result(state,p);return `<article class="card catalog-row"><div><div class="catalog-name">${esc(p.name)}</div><div class="catalog-meta">${esc(p.category||'Sin categoría')} · ${esc(p.unit||'unidad')} · ${esc(p.id.slice(0,13))}</div></div><div class="catalog-value">Registrado <b>${format(r.H)}</b></div><div class="catalog-value">Saldo <b class="${r.N<0?'text-danger':''}">${format(r.N)}</b></div><div class="catalog-value">Valorización <b>${money(r.P)}</b></div><div class="catalog-actions"><button class="icon-btn" data-action="edit-product" data-id="${esc(p.id)}" title="Editar producto">✎</button><button class="icon-btn" data-action="remove-product" data-id="${esc(p.id)}" title="Eliminar producto">×</button></div></article>`;}).join('')}</div>${pageFoot(sel,'productos')}`:empty('Catálogo vacío',state.products.length?'Ningún producto coincide con la búsqueda.':'No se incorporaron nombres porque el PDF no contiene el inventario real.','new-product','Crear mi primer producto')}`;
}
function renderClients(){
 const q=clientQuery.toLocaleLowerCase('es').trim();const all=state.clients.filter(c=>(clientFilter==='all'||(clientFilter==='named'?!!c.name?.trim():!c.name?.trim()))&&`${c.code} ${c.name||''}`.toLocaleLowerCase('es').includes(q));
 return `${heading('COLUMNAS A-1…A-100','Clientes y espacios','Nombra espacios sin modificar sus registros.',`<button class="btn btn-primary" data-action="add-client">+ Añadir espacio</button>`)}
 <div class="banner"><div><h3>${state.clients.length} espacios disponibles</h3><p>Los primeros 100 son equivalentes a las columnas A-1 hasta A-100 del Excel. Puedes agregar más sin modificar tus registros anteriores.</p></div><button class="btn" data-nav="weekly">Abrir registro</button></div>
 <div class="tool-strip"><div class="left"><label class="search"><input id="client-search" type="search" class="form-control" placeholder="Buscar A-1, nombre…" value="${esc(clientQuery)}"></label></div></div>
 <div class="gu-filterbar" role="group" aria-label="Filtrar espacios"><span class="gu-filter-label">Ver</span>${[['all','Todos'],['named','Con alias'],['unnamed','Sin alias']].map(([k,label])=>`<button type="button" data-client-filter="${k}" aria-pressed="${clientFilter===k}">${label}</button>`).join('')}<span class="muted">${all.length} / ${state.clients.length}</span></div>
 <div class="client-grid">${all.map(c=>`<div class="card client-cell"><label for="client-${esc(c.id)}">${esc(c.code)} <span class="muted">· Identificador fijo</span></label><input id="client-${esc(c.id)}" data-edit="client-name" data-id="${esc(c.id)}" class="form-control" maxlength="90" value="${esc(c.name||'')}" placeholder="Nombre o alias"></div>`).join('')}</div>${!all.length?empty('Sin coincidencias','Prueba con otro código o nombre.'):''}`;
}
function renderAudit(){
 const cutoff=Date.now()-7*86400000,search=auditQuery.toLocaleLowerCase('es').trim();
 const log=state.audit.filter(e=>(auditWindow==='all'||new Date(e.at).getTime()>=cutoff)&&`${e.label} ${e.actor||''}`.toLocaleLowerCase('es').includes(search));
 return `${heading('TRAZABILIDAD','Historial','Registro local de cambios (máximo 350).',`<button class="btn" data-nav="backup">Respaldar historial</button>`)}
 <div class="banner"><div><h3>Registro de este dispositivo</h3><p>Este historial es informativo y se incluye en el JSON de respaldo. No equivale a auditoría a prueba de manipulación ni identifica usuarios diferentes.</p></div></div>
 <div class="gu-audit-tools"><input id="audit-search" class="form-control" type="search" autocomplete="off" aria-label="Buscar en historial" placeholder="Buscar movimiento…" value="${esc(auditQuery)}"><select id="audit-window" class="form-control" aria-label="Período del historial"><option value="all" ${auditWindow==='all'?'selected':''}>Todo el historial</option><option value="7d" ${auditWindow==='7d'?'selected':''}>Últimos 7 días</option></select><button type="button" class="btn btn-small" data-action="csv-audit">Exportar CSV</button></div><div class="gu-summary-bar"><b>${log.length} acciones</b><small>${state.audit.length} en total · solo este dispositivo</small></div>
 <div class="audit-list">${log.length?log.map(e=>`<article class="card audit-row"><div><b>${esc(e.label)}</b><p>${esc(e.actor||'Este dispositivo')}</p></div><time datetime="${esc(e.at)}">${esc(stamp(e.at))}</time></article>`).join(''):empty('Sin modificaciones','Las ediciones aparecerán después del primer cambio.')}</div>`;
}
let backupsCache=[];
async function refreshBackups(){try{backupsCache=await DB.backups();}catch{backupsCache=[];}}
function renderBackup(){
 const last=backupsCache[0];const lastStamp=last?stamp(last.createdAt):'Sin copias internas';
 return `${heading('DATOS EN TUS MANOS','Copias de seguridad','Guarda versiones internas, descarga un archivo portátil y restaura los mismos datos en otro teléfono o computador.',`<button class="btn btn-primary" data-action="export-json">↧ Descargar respaldo</button>`)}
 <div class="gu-summary-bar"><div><b>${backupsCache.length} copias internas</b> <small>· Última: ${esc(lastStamp)}</small></div><button class="btn btn-small" data-action="manual-snapshot">Crear copia</button></div>
 <div class="backups-grid"><article class="card backup-action"><div class="backup-icon">⇩</div><h3>Exportar todos los datos</h3><p>Archivo JSON con productos, espacios, semanas, cantidades, precios, configuración e historial. También puedes cifrarlo con contraseña.</p><div class="page-tools"><button class="btn btn-primary" data-action="export-json">Descargar JSON</button><button class="btn" data-action="export-encrypted">Cifrar y descargar</button></div></article>
 <article class="card backup-action"><div class="backup-icon">⇧</div><h3>Importar o migrar datos</h3><p>Selecciona un archivo de respaldo de Inventarios GU o versiones anteriores. Puedes reemplazar todos los datos o fusionarlos por identificador para evitar duplicados.</p><div class="page-tools"><button class="btn btn-primary" data-action="import-file">Seleccionar archivo</button></div></article></div>
 <div class="card card-pad" style="margin-bottom:19px"><div class="card-title"><div><h3>${DB.mode?.()==='memory'?'Copias temporales de esta sesión':'Copias guardadas en este equipo'}</h3><p>Las copias internas están en el mismo navegador, no en la nube.</p></div><button class="btn btn-small" data-action="manual-snapshot">+ Crear copia interna</button></div>
 ${backupsCache.length?backupsCache.map(b=>`<div class="backup-item"><div class="backup-icon" style="width:35px;height:35px;font-size:17px;flex-shrink:0;margin:0">${b.type==='auto'?'◷':'▣'}</div><div class="backup-item-main"><b>${esc(b.label)}</b><small>${esc(stamp(b.createdAt))} · ${b.type==='auto'?'Automática':'Manual'}</small></div><div class="backup-item-actions"><button class="btn btn-small" data-action="restore-snapshot" data-id="${esc(b.id)}">Restaurar</button><button class="icon-btn" data-action="download-snapshot" data-id="${esc(b.id)}" title="Descargar">↓</button><button class="icon-btn" data-action="delete-snapshot" data-id="${esc(b.id)}" title="Eliminar">×</button></div></div>`).join(''):empty('Sin copias internas','Crea una copia de seguridad para conservar una versión recuperable en este navegador.')}</div>
 <div class="card card-pad"><div class="card-title"><div><h3>Exportaciones para Excel</h3><p>Archivos CSV separados por punto y coma; Excel puede abrirlos.</p></div></div><div class="page-tools"><button class="btn" data-action="csv-final">Descargar consolidado CSV</button><button class="btn" data-action="csv-movements">Descargar registros CSV</button></div><div class="help-note">Para migrar o restaurar la aplicación completa usa el <b>JSON</b>, no los CSV. El PDF recibido no trae los valores del Excel original; para importarlos directamente desde XLSX hace falta disponer del archivo XLSX.</div></div>
 <div class="banner alert" style="margin-top:20px"><div><h3>Importante sobre la conservación de datos</h3><p>Si borras los datos de navegación, el teléfono se restablece o se pierde el dispositivo, también se borran las copias internas. Descarga respaldos JSON periódicamente y guárdalos fuera del navegador.</p></div></div>`;
}
function paletteSwatch(label,key,description,a,b,c){return `<button class="theme-card ${state.settings.palette===key?'selected':''}" data-palette-change="${key}"><div class="theme-preview" style="background:${b}"><span style="background:${a}"></span><span style="background:${b}"><i style="display:block;width:48%;background:${c};border-radius:4px"></i><i style="display:block;width:48%;background:#fff6;border-radius:4px"></i></span></div><b>${label}</b><small>${description}</small></button>`;}
function renderSettings(){return `${heading('PERSONALIZACIÓN','Configuración','Apariencia, preferencias y aplicación.')}
 <div class="settings-grid"><article class="card card-pad"><div class="card-title"><div><h3>Paletas de color</h3><p>Tres estilos que cambian toda la interfaz.</p></div></div><div class="theme-grid">${paletteSwatch('Almendra','almond','Crema y marrón','#78583e','#f3eee7','#d6b993')}${paletteSwatch('Rojo y oro','redgold','Inspiración oriental','#9b292b','#f9ead9','#dbb15e')}${paletteSwatch('Gris y plata','silver','Diseño metálico','#576878','#edf0f4','#bbc6d0')}</div><div class="section-label">Luminosidad</div><div class="mode-switch"><button class="btn ${state.settings.mode==='light'?'active':''}" data-mode-change="light">☀ Modo diurno</button><button class="btn ${state.settings.mode==='dark'?'active':''}" data-mode-change="dark">☾ Modo oscuro</button></div></article>
 <article class="card card-pad"><div class="card-title"><div><h3>Preferencias de trabajo</h3><p>Se guardan localmente con el resto de tu configuración.</p></div></div><div class="field" style="margin-bottom:16px"><label>Moneda para valorización</label><select id="setting-currency" class="form-control"><option value="COP" ${state.settings.currency==='COP'?'selected':''}>COP · Peso colombiano</option><option value="USD" ${state.settings.currency==='USD'?'selected':''}>USD · Dólar</option><option value="EUR" ${state.settings.currency==='EUR'?'selected':''}>EUR · Euro</option><option value="MXN" ${state.settings.currency==='MXN'?'selected':''}>MXN · Peso mexicano</option><option value="CNY" ${state.settings.currency==='CNY'?'selected':''}>CNY · Yuan chino</option></select></div><div class="field"><label>Productos mostrados por página</label><select id="setting-pagesize" class="form-control"><option value="10" ${state.settings.pageSize===10?'selected':''}>10</option><option value="20" ${state.settings.pageSize===20?'selected':''}>20</option><option value="40" ${state.settings.pageSize===40?'selected':''}>40</option><option value="80" ${state.settings.pageSize===80?'selected':''}>80</option></select></div><div class="section-label">Densidad de interfaz</div><div class="gu-density-options" role="group" aria-label="Densidad visual"><button type="button" class="btn btn-small" data-density-change="comfortable" aria-pressed="${state.settings.density!=='compact'}">Cómoda</button><button type="button" class="btn btn-small" data-density-change="compact" aria-pressed="${state.settings.density==='compact'}">Compacta</button></div><div class="section-label">Sonidos discretos</div><div class="gu-density-options gu-sound-options" role="group" aria-label="Sonidos de interfaz"><button type="button" class="btn btn-small" data-gu-sound="on" aria-pressed="${window.GUFeedback?.isEnabled()!==false}">Activar</button><button type="button" class="btn btn-small" data-gu-sound="off" aria-pressed="${window.GUFeedback?.isEnabled()===false}">Silenciar</button><span class="gu-sound-status" id="gu-sound-state" aria-live="polite">${window.GUFeedback?.isEnabled()===false?'Silenciados':'Activados'}</span></div><div class="section-label">Información de almacenamiento</div><div class="info-list"><div class="info-row"><span>Productos</span><b>${state.products.length}</b></div><div class="info-row"><span>Espacios</span><b>${state.clients.length}</b></div><div class="info-row"><span>Semanas / períodos</span><b>${state.periods.length}</b></div><div class="info-row"><span>Última modificación</span><b>${esc(stamp(state.updatedAt))}</b></div><div class="info-row"><span>Almacenamiento</span><b>IndexedDB + cookies visuales</b></div></div></article></div>
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
 mutation(`Producto eliminado: ${p.name}`,()=>{state.products=state.products.filter(x=>x.id!==productId);if(state.gu4?.locations)state.gu4.locations=state.gu4.locations.filter(x=>x.productId!==productId);for(const key of ['movements','prices','weekTotals'])for(const period of Object.values(state[key]))delete period[productId];});
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
 const clean={version:1,createdAt:string(raw.createdAt,40)||new Date().toISOString(),updatedAt:new Date().toISOString(),settings:{palette,mode,currency,pageSize,density:['compact','comfortable'].includes(settings.density)?settings.density:'comfortable',lastAutoBackup:0},products,clients,periods,movements:normalizeMatrix(raw.movements,true),prices:normalizeMatrix(raw.prices,false),weekTotals:normalizeMatrix(raw.weekTotals,false),audit};
 clean.gu4=GU4?.normalizeGu4(raw.gu4,clean)||newState().gu4;return clean;
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
 if(GU4){const l=local.gu4||newState().gu4,r=remote.gu4||newState().gu4;out.gu4=GU4.normalizeGu4({...l,locations:[...(r.locations||[]),...(l.locations||[])],counts:[...(r.counts||[]),...(l.counts||[])]},out);}
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
const searchTargets=[['dashboard','Panel general'],['weekly','Registro semanal'],['final','Consolidado'],['products','Productos'],['clients','Clientes / espacios'],['audit','Historial'],['backup','Copias y migración'],['settings','Configuración'],['warehouse4','Bodega física 4.0'],['counts4','Conteo físico'],['intelligence4','Predicciones y alertas'],['imports4','Excel e informes']];
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
 window.GUFeedback?.play('tap');render();
});
document.addEventListener('click',e=>{if(e.target.closest('[data-dashboard-export]'))exportDashboardCSV()});
document.addEventListener('click',e=>{const btn=e.target.closest('[data-review-filter]');if(!btn)return;reviewFilter=btn.dataset.reviewFilter;reviewShowAll=false;render();});
document.addEventListener('click',e=>{if(e.target.closest('[data-review-more]')){reviewShowAll=!reviewShowAll;render();}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-final-filter]');if(!b)return;finalFilter=b.dataset.finalFilter;page=0;render();});
document.addEventListener('click',e=>{const b=e.target.closest('[data-client-filter]');if(!b)return;clientFilter=b.dataset.clientFilter;render();});
document.addEventListener('click',e=>{const b=e.target.closest('[data-density-change]');if(!b||!state)return;const v=b.dataset.densityChange;if(!['comfortable','compact'].includes(v)||v===state.settings.density)return;mutation('Densidad de interfaz: '+v,()=>state.settings.density=v);});
document.addEventListener('click',e=>{const btn=e.target.closest('[data-metric-toggle]');if(!btn)return;const panel=btn.closest('.metric-panel');if(!panel)return;const collapsed=!panel.classList.contains('metric-collapsed');const prefs=metricPrefs();prefs[btn.dataset.metricToggle]=collapsed;try{localStorage.setItem(metricVisibilityKey,JSON.stringify(prefs))}catch{}window.GUFeedback?.play(collapsed?'close':'tap');render();});
// GU 4.0: acciones delegadas; el inventario original continúa como fuente única de stock.
document.addEventListener('click',async e=>{
 const node=e.target.closest('[data-gu4-select-position]');if(node){const [rack,level,position]=node.dataset.gu4SelectPosition.split('-').map(Number),form=$('#gu4-location-form');if(!form)return;
  form.elements.rack.value=rack;form.elements.level.value=level;form.elements.position.value=position;
  const existing=state.gu4.locations.find(l=>l.rack===rack&&l.level===level&&l.position===position);
  if(existing){form.elements.productId.value=existing.productId;form.elements.qty.value=existing.qty;}else{form.elements.qty.value='';}
  form.scrollIntoView?.({behavior:'smooth',block:'nearest'});return;}
 const clear=e.target.closest('[data-gu4-clear-position]');if(clear){const form=$('#gu4-location-form');if(!form)return;
  const key={rack:Number(form.elements.rack.value),level:Number(form.elements.level.value),position:Number(form.elements.position.value)};
  if(!state.gu4.locations.some(l=>GU4.slot(l)===GU4.slot(key))){toast('La posición ya está libre.');return;}
  if(!confirm(`¿Liberar la posición R${key.rack}-N${key.level}-P${key.position}? No se modifica el stock.`))return;
  mutation('Se liberó ubicación física',()=>GU4.clearLocation(state,key));return;}
 const drop=e.target.closest('[data-gu4-remove-stage]');if(drop){gu4Stage=gu4Stage.filter(l=>l.productId!==drop.dataset.gu4RemoveStage);render();return;}
 if(e.target.closest('[data-gu4-create-count]')){if(!gu4Stage.length)return;
  try{mutation('Conteo físico registrado',()=>GU4.makeCount(state,C,gu4Stage,new Date().toISOString(),id('count')));gu4Stage=[];render();toast('Conteo guardado para revisión.');}catch(err){toast(err.message);}return;}
 const detail=e.target.closest('[data-gu4-show-count]');if(detail){const c=state.gu4.counts.find(x=>x.id===detail.dataset.gu4ShowCount);if(!c)return;
  showModal('Detalle del conteo',`<div class="modal-body"><p>${esc(stamp(c.createdAt))} · ${c.status==='applied'?'Ajustado':'Pendiente'}</p><div class="table-scroll"><table class="data-table"><thead><tr><th>Producto</th><th>Esperado</th><th>Contado</th><th>Diferencia</th></tr></thead><tbody>${c.lines.map(l=>`<tr><td>${esc(l.productName)}</td><td>${format(l.expected)}</td><td>${format(l.counted)}</td><td>${format(l.difference)}</td></tr>`).join('')}</tbody></table></div></div>`,`<button class="btn" data-action="close-modal">Cerrar</button>`);return;}
 const apply=e.target.closest('[data-gu4-apply-count]');if(apply){const count=state.gu4.counts.find(x=>x.id===apply.dataset.gu4ApplyCount);if(!count)return;
  const delta=count.lines.reduce((n,l)=>n+Math.abs(l.difference),0);
  if(!confirm(`¿Aplicar los ajustes de ${count.lines.length} producto(s)? Diferencia absoluta: ${format(delta)}. Se modificará Cantidad.N y se guardará una copia preventiva.`))return;
  try{await DB.backup({id:id('before-count'),createdAt:new Date().toISOString(),type:'manual',label:'Antes de aplicar conteo físico',data:clone(state)});
   const ok=mutation('Conteo físico aplicado: '+count.id,()=>GU4.applyCount(state,C,count.id));if(ok)toast('Ajuste aplicado; copia preventiva disponible.');
  }catch(err){toast('No se aplicó el conteo: '+err.message);}return;}
 if(e.target.closest('[data-gu4-choose-sheet]')){$('#gu4-sheet-file')?.click();return;}
 if(e.target.closest('[data-gu4-cancel-sheet]')){gu4Sheet=null;render();return;}
 if(e.target.closest('[data-gu4-template]')){try{downloadBlob(await G4Excel.template(),'Inventarios_GU_4_Plantilla.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');}catch(err){toast(err.message);}return;}
 if(e.target.closest('[data-gu4-xlsx]')){try{downloadBlob(await G4Excel.report(state,C,GU4),filename('Inventarios_GU_4_Informe','xlsx'),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');}catch(err){toast(err.message);}return;}
 if(e.target.closest('[data-gu4-print]')){printGu4Report();return;}
 if(e.target.closest('[data-gu4-offline-help]')){$('#install-open')?.click();return;}
 const edit=e.target.closest('[data-gu4-edit-product]');if(edit){productModal(edit.dataset.gu4EditProduct);return;}
 const layout=e.target.closest('[data-gu4-layout]');if(layout){gu4LayoutEditing=!gu4LayoutEditing;render();return;}
 const move=e.target.closest('[data-gu4-move]');if(move){const ids=$$('.metric-panel[data-metric]').map(x=>x.dataset.metric),ix=ids.indexOf(move.dataset.gu4Move),dest=ix+Number(move.dataset.gu4Direction);
  if(ix<0||dest<0||dest>=ids.length)return;[ids[ix],ids[dest]]=[ids[dest],ids[ix]];mutation('Distribución del panel reorganizada',()=>{state.gu4.panelOrder=ids;});return;}
 const resize=e.target.closest('[data-gu4-resize]');if(resize){const name=resize.dataset.gu4Resize,element=$(`.metric-panel[data-metric="${name}"]`);const currentlyWide=!!element?.classList.contains('gu4-wide-card');mutation('Tamaño de tarjeta actualizado',()=>state.gu4.panelSizes[name]=currentlyWide?'normal':'wide');return;}
});
document.addEventListener('submit',e=>{
 const form=e.target;
 if(form.id==='gu4-location-form'){e.preventDefault();const d=new FormData(form);try{mutation('Ubicación física guardada',()=>GU4.setLocation(state,C,Object.fromEntries(d)));toast('Posición actualizada.');}catch(err){toast(err.message);}return;}
 if(form.id==='gu4-count-form'){e.preventDefault();const d=new FormData(form),productId=String(d.get('productId')||''),counted=Number(d.get('counted'));
  if(!state.products.some(p=>p.id===productId)||!Number.isFinite(counted)||counted<0){toast('Selecciona un producto y una cantidad válida.');return;}
  gu4Stage=gu4Stage.filter(x=>x.productId!==productId).concat([{productId,counted}]);render();return;}
 if(form.id==='gu4-threshold-form'){e.preventDefault();const threshold=Number(new FormData(form).get('threshold'));if(!Number.isFinite(threshold)||threshold<0||threshold>100000){toast('Umbral inválido.');return;}
  mutation('Umbral de alertas actualizado',()=>{state.gu4.preferences.warningThreshold=threshold;});return;}
 if(form.id==='gu4-import-form'){e.preventDefault();if(!gu4Sheet?.length)return;
  const mode=String(new FormData(form).get('importMode')||'only-new'),existing=gu4Sheet.filter(p=>p.exists).length;
  if(!confirm(`¿Importar ${gu4Sheet.length} productos? ${existing} coinciden. Modo: ${mode==='update'?'actualizar coincidencias':'solo nuevos'}. Se creará copia preventiva.`))return;
  (async()=>{try{await DB.backup({id:id('before-sheet'),createdAt:new Date().toISOString(),type:'manual',label:'Antes de importar Excel o CSV',data:clone(state)});
   let summary;const ok=mutation('Productos importados desde Excel/CSV',()=>{summary=GU4.applyProducts(state,gu4Sheet,mode,()=>id('prod'),new Date().toISOString());});
   if(ok){gu4Sheet=null;toast(`Importación: ${summary.added} nuevos, ${summary.updated} actualizados, ${summary.skipped} omitidos.`);await refreshBackups();}
  }catch(err){toast('Importación cancelada: '+err.message);}})();return;}
});
$('#gu4-sheet-file')?.addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;
 try{gu4Sheet=GU4.validateImport(await G4Excel.parseFile(file),state);navigate('imports4');toast(`Archivo revisado: ${gu4Sheet.length} productos.`);}catch(err){toast('No se importó: '+err.message);}
});
function printGu4Report(){const totals=C.totals(state,state.products),alertas=GU4.alerts(state,C),r=GU4.allocations(state,C);
 const container=document.createElement('section');container.id='gu4-print-report';container.innerHTML=`<h1>Inventarios GU 4.0 · Informe</h1><p>Emitido ${esc(stamp(new Date().toISOString()))}. Datos almacenados localmente.</p><div class="gu4-print-stat">Productos: ${state.products.length} · Saldo N: ${format(totals.balance)} · Valor P: ${money(totals.value)} · Sin ubicar: ${format(r.unassigned)} · Alertas: ${alertas.length}</div><table><thead><tr><th>Producto</th><th>Saldo N</th><th>Valor P</th></tr></thead><tbody>${totals.rows.map(x=>`<tr><td>${esc(x.product.name)}</td><td>${format(x.N)}</td><td>${money(x.P)}</td></tr>`).join('')}</tbody></table><p>Saldo original: H − (Cantidad.N + Cantidad.V). La información no representa ventas automáticamente.</p>`;
 document.body.append(container);const finish=()=>{container.remove();window.removeEventListener('afterprint',finish);};window.addEventListener('afterprint',finish,{once:true});setTimeout(()=>{try{window.print();}catch(err){finish();toast('El navegador no permite imprimir: '+err.message);}},80);
}
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
  case 'csv-audit':csvDownload([['Fecha','Acción','Origen'],...state.audit.filter(e=>(auditWindow==='all'||new Date(e.at).getTime()>=Date.now()-7*86400000)&&`${e.label} ${e.actor||''}`.toLocaleLowerCase('es').includes(auditQuery.toLocaleLowerCase('es').trim())).map(e=>[e.at,e.label,e.actor||'Este dispositivo'])],'Historial_3_1');break;
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
   if(el.id==='product-sort'){productSort=el.value;page=0;render();return;}
   if(el.id==='audit-window'){auditWindow=el.value;render();return;}
 if(el.id==='slot-offset'){slotOffset=Number(el.value)||0;page=0;render();return;}
 if(el.id==='setting-currency'){const currency=el.value;if(['COP','USD','EUR','MXN','CNY'].includes(currency))mutation('Moneda cambiada a '+currency,()=>state.settings.currency=currency);return;}
 if(el.id==='setting-pagesize'){const count=Number(el.value);if([10,20,40,80].includes(count))mutation('Tamaño de página cambiado',()=>{state.settings.pageSize=count;page=0;});return;}
});
document.addEventListener('input',e=>{
 const el=e.target;
 if(el.id==='product-search'){const pos=el.selectionStart;query=el.value;page=0;render();const next=$('#product-search');if(next){next.focus();try{next.setSelectionRange(pos,pos);}catch{}}}
 if(el.id==='client-search'){const pos=el.selectionStart;clientQuery=el.value;render();const next=$('#client-search');if(next){next.focus();try{next.setSelectionRange(pos,pos);}catch{}}}
 if(el.id==='audit-search'){const pos=el.selectionStart;auditQuery=el.value;render();const next=$('#audit-search');if(next){next.focus();try{next.setSelectionRange(pos,pos);}catch{}}}
});
document.addEventListener('keydown',e=>{
 const cell=e.target.closest?.('.week-scroll-2d td');
 if(cell&&e.target.matches('input[data-edit]')&&(e.key==='Enter'||(e.altKey&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)))){
  const tr=cell.closest('tr'), tbody=tr?.parentElement, rows=tbody?.querySelectorAll('tr');
  if(tr&&rows){const dy=e.key==='Enter'||e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0;const dx=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;
   const ri=Array.from(rows).indexOf(tr),nextRow=rows[ri+dy],ti=cell.cellIndex+dx;
   const target=nextRow?.cells?.[ti]?.querySelector('input:not(:disabled)');
   if(target){e.preventDefault();weeklyFocusNext={r:ri+dy,c:ti};target.focus();target.select?.();requestAnimationFrame(()=>{if(weeklyFocusNext){weeklyFocusNext=null;}});return;}
  }
 }
 if(e.key==='Escape' &&!$('#command-palette')?.hidden){closePalette();return;}
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
  if(loaded&&!loaded.gu4){await DB.backup({id:id('before4'),createdAt:new Date().toISOString(),type:'manual',label:'Copia antes de migrar a 4.0',data:clone(loaded)});}
 GU4?.ensure(state);
 if(!loaded||!loaded.gu4)await DB.save(state);
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
