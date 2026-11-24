/*
  INVENTARIOS GU 4.1 — CONTROL DE INVENTARIO LOCAL
  Basado en la documentación de Software.xlsx. El PDF no contiene el inventario original.
  El inventario y la exportación de imágenes se procesan en el dispositivo.
*/
(function(){
'use strict';
const DB=window.AlmendraDB, C=window.AlmendraCalc, Insights=window.GUIInsights, Icons=window.GUIcons, Help=window.GUIHelp, M=window.GUMetricVisuals, GU4=window.GU4Core;
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
let state=null,view='dashboard',periodId='w1',page=0,query='',clientQuery='',finalFilter='all',productSort='original',clientFilter='all',auditQuery='',auditWindow='all';
let registerEmptyScope=null;
let undoStack=[],saveTimer=null,saveQueue=Promise.resolve(),saveFailure=false,storageConflict=false,autoBackupDue=false;
const tabId=id('tab');
const titleMap={dashboard:'Panel general',weekly:'Registro',final:'Consolidado',products:'Productos',clients:'Clientes / espacios',audit:'Historial',backup:'Copias y migración',settings:'Configuración',sales:'Comparar ventas'};
function newState(){
 return {version:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),settings:{palette:'almond',mode:'light',currency:'COP',pageSize:20,density:'comfortable',lastAutoBackup:0},products:[],clients:Array.from({length:100},(_,i)=>({id:'c'+(i+1),code:'A-'+(i+1),name:'',active:true})),periods:Array.from({length:5},(_,i)=>({id:'w'+(i+1),label:'Semana '+(i+1),start:'',end:'',locked:false})),movements:{},prices:{},weekTotals:{},sales:[],weeklyOrigins:{},lots:[],catalogGroups:[],audit:[],gu4:{version:1,locations:[],counts:[],panelOrder:[],panelSizes:{},preferences:{warningThreshold:3,productThresholds:{},forecastPeriods:8,importMode:'only-new'}}};
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
 $$('[data-nav]').forEach(btn=>{btn.classList.toggle('active',btn.dataset.nav===view);if(btn.classList.contains('nav-item'))btn.setAttribute('aria-current',btn.dataset.nav===view?'page':'false');});
 $('#undo-btn').disabled=undoStack.length===0;
}
function navigate(destination){if(!titleMap[destination])return;weeklyPreviewProduct='';view=destination;query='';page=0;render();window.scrollTo({top:0,behavior:'instant'});}
function switchPeriod(next){if(!state.periods.some(p=>p.id===next))return;if(weeklyPreviewProduct)query='';weeklyPreviewProduct='';registerEmptyScope=null;periodId=next;page=0;render();}
function productsFiltered(){const q=query.toLocaleLowerCase('es').trim();return state.products.filter(p=>`${p.name} ${p.category||''} ${p.productNumber||''} ${p.vesselNumber||''} ${p.boxNumber||''} ${p.unit||''}`.toLocaleLowerCase('es').includes(q));}
function selection(items){const limit=state.settings.pageSize||20;const last=Math.max(0,Math.ceil(items.length/limit)-1);page=Math.min(page,last);return {rows:items.slice(page*limit,(page+1)*limit),total:items.length,last};}
function pageFoot(sel,label){return `<div class="table-footer"><span><b>${sel.total}</b> ${esc(label)} · página ${page+1} de ${sel.last+1}</span><div class="pager"><button data-page="prev" ${page<=0?'disabled':''}>Anterior</button><button data-page="next" ${page>=sel.last?'disabled':''}>Siguiente</button></div></div>`;}
function empty(title,description,action='',name=''){return `<div class="empty-state"><div class="empty-icon">◇</div><h2>${esc(title)}</h2><p>${esc(description)}</p>${action?`<button class="btn btn-primary" data-action="${esc(action)}">${esc(name)}</button>`:''}</div>`;}
function heading(eyebrow,title,subtitle,tools=''){return `<div class="page-heading"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>${tools?`<div class="page-tools">${tools}</div>`:''}</div>`;}
function searchBar(placeholder='Buscar producto…'){return `<label class="search"><input id="product-search" class="form-control" type="search" value="${esc(query)}" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" autocomplete="off"></label>`;}
function productButton(p){return `<button class="product-link" title="Editar ${esc(p.name)}" data-action="edit-product" data-id="${esc(p.id)}">${esc(p.name)}</button>`;}
function statusBalance(n){return `<span class="${n<0?'text-danger':n>0?'text-good':''} mono">${format(n)}</span>`;}
function render(){
 if(!state)return;updateHeader();syncTheme();
 const activeViews={dashboard:renderDashboard,weekly:renderWeekly,final:renderFinal,products:renderProducts,clients:renderClients,audit:renderAudit,backup:renderBackup,settings:renderSettings,sales:renderSales};
 $('#main-content').innerHTML=storageNotice()+(storageConflict?'<div class="banner alert"><div><h3>Conflicto entre pestañas</h3><p>Se detectaron cambios desde otra pestaña. Recarga para recuperar la última versión antes de editar.</p></div><button class="btn" data-action="reload">Recargar</button></div>':'')+activeViews[view]();
 Icons?.enhance($('#main-content'));Help?.enhance($('#main-content'));
 const warehouse=$('#main-content').querySelector('.warehouse-viewport');
 if(warehouse){
  const overCapacity=view==='dashboard'?!!$('#main-content').querySelector('#capacity-alert-title'):catalogCapacity(C.totals(state,state.products).rows,purchases()).exceeded.length>0;
  if(overCapacity){
   warehouse.dataset.capacityAlarm='true';
   warehouse.insertAdjacentHTML('beforeend','<span class="warehouse-emergency">Emergencia · Sobrecupo</span>');
  }
  window.GUFeedback?.setCapacityAlarm?.(overCapacity);
  window.AlmendraWarehouse?.mount();
 }else window.GUFeedback?.setCapacityAlarm?.(false);
}
const metricVisibilityKey='inventarios-gu-metricas-v22'; // Compatibilidad con preferencias de 2.2
const metricLabels={volumen:'Unidades registradas',saldo:'Stock',valor:'Valor total del inventario',productos:'Productos',stock:'Unidades en stock',referencias:'Referencias con stock',bodega:'Bodega 3D',proyecciones:'Proyecciones', 'grafico-semanal':'Gráfico semanal','grafico-productos':'Productos destacados',revision:'Revisión',tendencias:'Comparativa', 'vista-rapida':'Vista rápida',actividad:'Actividad'};
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
function dashboardActions(){
 return `<div class="dashboard-actions" role="group" aria-label="Acciones del Panel general" data-html2canvas-ignore>
  <button type="button" class="btn" data-dashboard-menu="inventory" aria-haspopup="dialog">${Icons.svg('package')}<span>Inventario</span></button>
  <button type="button" class="btn" data-dashboard-menu="export" aria-haspopup="dialog">${Icons.svg('file-up')}<span>Exportar</span></button>
 </div><dialog id="dashboard-menu" class="dashboard-menu" aria-labelledby="dashboard-menu-title" data-html2canvas-ignore></dialog>`;
}
function openDashboardMenu(trigger){
 const dialog=$('#dashboard-menu'),kind=trigger.dataset.dashboardMenu;
 const titles={inventory:'Inventario',export:'Exportar panel'};
 const action=(label,attribute)=>`<button type="button" class="btn" ${attribute}>${esc(label)}</button>`;
 const prefs=metricPrefs();
 const menu={
  inventory:()=>action('Añadir producto','data-action="new-product"')+action('Abrir Registro','data-nav="weekly"')+action('Ver consolidado','data-nav="final"')+action('Comparar ventas','data-nav="sales"')+(!state.products.length?action('Cargar productos de prueba','data-action="demo"'):'')+`<details class="dashboard-menu-section"><summary>Mostrar u ocultar métricas</summary><div class="dashboard-menu-grid">${['volumen','saldo','valor'].map(id=>action(`${prefs[id]?'Mostrar':'Contraer'} ${metricLabels[id].toLowerCase()}`,`data-dashboard-metric="${id}"`)).join('')}</div></details>`,
  export:()=>action('Descargar imagen PNG','data-dashboard-export="png"')+action('Exportar resumen CSV','data-dashboard-export="csv"')
 };
 dialog.innerHTML=`<div class="modal-head"><h2 id="dashboard-menu-title">${titles[kind]}</h2><button type="button" class="icon-btn" data-dashboard-dismiss aria-label="Cerrar" autofocus>×</button></div><div class="modal-body dashboard-menu-body">${menu[kind]()}</div>`;
 // Los controles modales reutilizan las acciones del panel y de la bodega.
 dialog.onclick=e=>{
  const button=e.target.closest('button');
  if(e.target===dialog || button?.hasAttribute('data-dashboard-dismiss')){dialog.close();return;}
  if(!button)return;
  const {dashboardMetric, dashboardExport, nav, action}=button.dataset;
  if(dashboardMetric){
   dialog.close();
   $(`[data-metric-toggle="${dashboardMetric}"]`)?.click();
   $('[data-dashboard-menu="inventory"]')?.focus();
  }else if(!dashboardExport && (nav || action)){
   dialog.close();
  }
 };
 dialog.showModal();
}
function catalogCapacity(rows,sales){
 const soldByProduct=new Map();
 for(const sale of sales){
  if(!sale.voided)soldByProduct.set(sale.productId,(soldByProduct.get(sale.productId)||0)+C.num(sale.units));
 }
 const products=rows.map(({product,H})=>{
  const registered=Math.max(0,C.num(product.boxes));
  const weekly=Math.max(0,H),sold=C.round(soldByProduct.get(product.id)||0);
  return {product,registered,weekly,sold,excess:C.round(Math.max(weekly,sold)-registered)};
 });
 const totals=products.reduce((sum,row)=>{
  sum.registered+=row.registered;sum.weekly+=row.weekly;sum.sold+=row.sold;
  return sum;
 },{registered:0,weekly:0,sold:0});
 return {products,totals,exceeded:products.filter(row=>row.excess>0).sort((a,b)=>b.excess-a.excess)};
}
function renderCapacityAlert(exceeded){
 if(!exceeded.length)return '';
 const units=value=>format(value,9);
 return `<section class="banner alert capacity-alert" aria-labelledby="capacity-alert-title">
 <div role="alert"><h3 id="capacity-alert-title">Sobre cupo detectado</h3>
 <p>${format(exceeded.length,0)} ${exceeded.length===1?'producto supera':'productos superan'} las unidades guardadas en Productos.</p></div>
 <details><summary>Ver productos y cantidades</summary>
 ${traceTable(['Producto','Cupo registrado','Usadas en semanas','Vendidas','Unidades de exceso'],exceeded.map(row=>[
  esc(row.product.name),units(row.registered),units(row.weekly),units(row.sold),units(row.excess)
 ]))}
 <p>El exceso se calcula por producto usando la mayor cantidad entre Registro y ventas.</p>
 </details></section>`;
}
function renderDashboard(){
 const all=C.totals(state,state.products);
 const capacity=catalogCapacity(all.rows,purchases());
 const {registered,weekly,sold}=capacity.totals;
 const registeredBars=capacity.products.filter(row=>row.registered>0).sort((a,b)=>b.registered-a.registered).slice(0,5).map(row=>({label:row.product.name,value:row.registered}));
 return `${heading('VISTA GENERAL','Panel de control','Resumen del inventario, actualizado con los movimientos.')}
 ${renderCapacityAlert(capacity.exceeded)}
 ${renderStockAlerts(all)}
 ${!state.products.length?`<div class="banner"><div><h3>Inventario vacío</h3><p>Abre Inventario para añadir productos o cargar la demostración.</p></div></div>`:''}
 ${all.negative?`<div class="banner alert"><div><h3>${all.negative} producto(s) con saldo negativo</h3><p>Los valores negativos se conservan como en la fórmula de Excel. Verifica si representan faltantes, pedidos u otra operación.</p></div></div>`:''}
 <section class="stats-grid" aria-label="Indicadores generales">
 ${metricBox('volumen',statCard(metricLabels.volumen,format(registered,9),'Total de unidades guardadas en Productos.','▦',unitReportCard('sales',M.barRows(registeredBars,'Unidades guardadas por producto',{empty:'Aún no hay unidades guardadas en Productos'}), `Usadas en semanas: ${format(weekly,9)} · Vendidas: ${format(sold,9)}`)))}
 ${metricBox('saldo',statCard(metricLabels.saldo,format(all.balance),'Unidades registradas menos las cantidades N y V','◎',unitReportCard('stock',M.balances(all.rows))))}
 ${metricBox('valor',statCard(metricLabels.valor,money(all.value),'Saldo de cada producto multiplicado por su valor unitario','◈',unitReportCard('value',M.valueMix(all.rows))))}
 </section>
 <div class="dashboard-visual-row dashboard-warehouse">${window.AlmendraWarehouse?.render(state)||''}</div>
 ${dashboardActions()}`;
}
const unitReportSources={
 sales:{title:'Filtrar ventas · Unidades registradas',button:'Filtrar ventas',caption:'Unidades vendidas'},
 value:{title:'Filtrar valor · Inventario',button:'Filtrar valor',caption:'Valor registrado',description:'Multiplica las unidades del Registro por el valor unitario actual de cada producto. El saldo total del inventario aplica además los ajustes globales del producto. El período se determina con la fecha de inicio de cada registro.'},
 stock:{title:'Filtrar unidades registradas · Stock',button:'Filtrar unidades',caption:'Unidades registradas',description:'Las cantidades provienen del Registro. El período se determina con la fecha de inicio de cada registro.'}
};
const newUnitReport=source=>({
 source,group:'product',period:'week',year:'',month:'',week:'',cross:'',query:'',page:0,
 selected:{product:null,client:null}
});
const unitReports={sales:newUnitReport('sales'),stock:newUnitReport('stock'),value:newUnitReport('value')};
const unitReportMonths=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const unitReportYears=Array.from({length:1001},(_,i)=>String(2000+i));
const unitReportWeeks=['1','2','3','4','5'];
const reportColors=['#2369d0','#b43e1e','#07815e','#8b46bc','#a46c00','#007e93','#c72c67','#627420'];
const unitReportDay=(month,day)=>month+'-'+String(day).padStart(2,'0');
function unitReportRange({year,month,week,period}){
 if(period==='year')return {from:year+'-01-01',to:year+'-12-31',label:year};
 const monthKey=year+'-'+month.padStart(2,'0');
 const lastDay=new Date(Date.UTC(Number(year),Number(month),0)).getUTCDate();
 const day=value=>unitReportDay(monthKey,value);
 if(period==='month')return {from:day(1),to:day(lastDay),label:monthKey};
 const first=7*(Number(week)-1)+1,end=week==='5'?lastDay:first+6;
 return {from:day(first),to:day(end),label:`Semana ${week} · ${monthKey}`};
}
function unitReportTimeline(report){
 const range=unitReportRange(report);
 if(report.period==='year'){
  const periods=unitReportMonths.map((name,i)=>({
   key:unitReportDay(unitReportDay(report.year,i+1),1),
   label:name.slice(0,3)
  }));
  return {...range,periods};
 }
 const monthly=report.period==='month';
 const monthKey=range.from.slice(0,7);
 const monthName=unitReportMonths[Number(report.month)-1].slice(0,3).toLowerCase();
 const periods=[];
 for(let day=Number(range.from.slice(8));day<=Number(range.to.slice(8));day+=monthly?7:1){
  periods.push({
   key:unitReportDay(monthKey,day),
   label:monthly?'Semana '+Math.ceil(day/7):day+' '+monthName
  });
 }
 return {...range,periods};
}
function unitReportBucket(date,period){
 const monthKey=date.slice(0,7);
 if(period==='year')return unitReportDay(monthKey,1);
 if(period==='month')return unitReportDay(monthKey,1+7*Math.floor((Number(date.slice(8))-1)/7));
 return date;
}
function reportEntities(group,source){
 const items=new Map(group==='product'?state.products.map(p=>[p.id,p.name]):state.clients.map(c=>[c.id,salesClientLabel(c)]));
 for(const sale of source==='sales'?purchases():[]){
  if(sale.voided)continue;
  const id=group==='product'?sale.productId:sale.clientId;
  const name=group==='product'?sale.productName:sale.clientName;
  if(!items.has(id))items.set(id,name||id);
 }
 return [...items].map(([id,label])=>({id,label})).sort((a,b)=>a.label.localeCompare(b.label,'es',{numeric:true}));
}
function unitReportModel(report){
 const {source,group,period,cross}=report,weekly=source!=='sales';
 const undated=weekly&&period==='undated';
 const {from,to,label,periods:datedPeriods}=undated?{}:unitReportTimeline(report);
 const entities=reportEntities(group,source),byId=new Map();
 const withinDate=date=>date>=from&&date<=to;
 const registeredWeeks=weekly?state.periods.filter(week=>{
  const dated=calendarDate(week.start);
  return undated?!dated:dated&&withinDate(week.start);
 }):[];
 const periods=undated?registeredWeeks.map(week=>({key:week.id,label:week.label})):datedPeriods;
 const product=group==='product';
 const add=(productId,clientId,key,units)=>{
  if(cross&&(product?clientId:productId)!==cross)return;
  const id=product?productId:clientId;
  let row=byId.get(id);if(!row){row={total:0,values:new Map()};byId.set(id,row);}
  row.total=C.round(row.total+units);
  row.values.set(key,C.round((row.values.get(key)||0)+units));
 };
 if(weekly){
  const unitValues=source==='value'?new Map(state.products.map(product=>[product.id,C.num(product.value)])):null;
  for(const week of registeredWeeks){
   const key=undated?week.id:unitReportBucket(week.start,period);
   for(const [productId,clients] of Object.entries(state.movements?.[week.id]||{})){
    const multiplier=unitValues?(unitValues.get(productId)||0):1;
    for(const [clientId,quantity] of Object.entries(clients))add(productId,clientId,key,C.num(quantity)*multiplier);
   }
  }
 }else{
  for(const sale of purchases()){
   if(!sale.voided&&withinDate(sale.date))add(sale.productId,sale.clientId,unitReportBucket(sale.date,period),sale.units);
  }
 }
 const manual=report.selected[group];
 const ranked=manual?[]:entities.filter(item=>{
  const row=byId.get(item.id);
  return row&&[...row.values.values()].some(value=>value!==0);
 }).sort((a,b)=>Math.abs(byId.get(b.id).total)-Math.abs(byId.get(a.id).total));
 const selected=manual||new Map(ranked.slice(0,3).map((item,i)=>[item.id,reportColors[i]]));
 return {entities,periods,byId,selected,label};
}
function reportSeries(model){
 const entities=new Map(model.entities.map(item=>[item.id,item]));
 return [...model.selected].filter(([id])=>entities.has(id)).map(([id,color])=>({
  ...entities.get(id),color,values:model.periods.map(period=>model.byId.get(id)?.values.get(period.key)||0)
 }));
}
function reportAmount(report,amount){
 if(report.source!=='value')return traceQuantity(amount);
 return new Intl.NumberFormat('es-CO',{style:'currency',currency:state.settings.currency||'COP'}).format(amount);
}
function reportChart(model,report,compact=false){
 const series=reportSeries(model);
 if(!model.periods.length||!series.length){
  if(compact)return '';
  const message=report.selected[report.group]?'Marca las filas que quieras graficar.':'Sin datos para el período seleccionado.';
  return `<div class="metric-vis-empty">${message}</div>`;
 }
 const width=compact?320:620,height=compact?112:228,left=compact?37:55,right=width-18,top=12,bottom=height-32;
 const min=series.reduce((low,entry)=>entry.values.reduce((smallest,value)=>Math.min(smallest,value),low),0);
 const max=series.reduce((high,entry)=>entry.values.reduce((largest,value)=>Math.max(largest,value),high),0);
 const range=max-min||1;
 const last=model.periods.length-1;
 const x=i=>left+(right-left)*(last?i/last:.5);
 const y=value=>bottom-(bottom-top)*((value-min)/range);
 const tickGap=Math.max(1,Math.ceil(last/(compact?2:5)));
 const chart=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(unitReportSources[report.source].caption)} por período"><title>Datos de las filas seleccionadas. Las cifras exactas aparecen en la tabla.</title>
 ${[0,.5,1].map(r=>`<line x1="${left}" x2="${right}" y1="${y(min+range*r)}" y2="${y(min+range*r)}" stroke="var(--line)"/><text x="${left-5}" y="${y(min+range*r)+4}" text-anchor="end" fill="var(--muted)">${esc(new Intl.NumberFormat('es-CO',{notation:'compact',maximumFractionDigits:2}).format(min+range*r))}</text>`).join('')}
 ${model.periods.map(({label},i)=>i%tickGap===0||i===last?`<text x="${x(i)}" y="${bottom+21}" text-anchor="${last&&i===0?'start':last&&i===last?'end':'middle'}" fill="var(--muted)">${esc(label)}</text>`:'').join('')}
 ${series.map((entry,index)=>`<polyline points="${entry.values.map((value,i)=>x(i).toFixed(2)+','+y(value).toFixed(2)).join(' ')}" stroke="${entry.color}" fill="none" stroke-width="2.5" stroke-linejoin="round"${index?` stroke-dasharray="${4+index%6} ${3+index%3}"`:''}/>${entry.values.length<=20?entry.values.map((value,i)=>`<circle cx="${x(i)}" cy="${y(value)}" r="3" fill="${entry.color}"><title>${esc(entry.label)} · ${esc(model.periods[i].label)} · ${reportAmount(report,value)}</title></circle>`).join(''):''}`).join('')}</svg>`;
 return `<div class="unit-report-chart${compact?' unit-report-compact':''}">${model.label?`<div class="unit-report-period muted">${esc(model.label)}</div>`:''}${chart}<ul class="unit-report-legend">${series.map(item=>`<li><i style="background-color:${item.color}"></i>${esc(item.label)}</li>`).join('')}</ul></div>`;
}
function unitReportRows(model,report){
 const {selected}=model,showTotal=model.periods.length!==1;
 const query=report.query.toLocaleLowerCase('es').trim();
 const rows=model.entities.filter(item=>item.label.toLocaleLowerCase('es').includes(query));
 const size=16,last=Math.max(0,Math.ceil(rows.length/size)-1);
 report.page=Math.min(Math.max(0,report.page),last);
 const start=report.page*size;
 if(!rows.length)return '<p class="muted" role="status">Sin resultados para este filtro.</p>';
 return `<div class="table-scroll unit-report-table"><table class="data-table"><caption>${esc(unitReportSources[report.source].caption)}</caption><thead><tr><th scope="col">${report.group==='product'?'Producto':'Cliente'}</th>${model.periods.map(period=>`<th scope="col">${esc(period.label)}</th>`).join('')}${showTotal?'<th scope="col">Total</th>':''}</tr></thead><tbody>${rows.slice(start,start+size).map(item=>{
  const result=model.byId.get(item.id),color=selected.get(item.id);
  return `<tr><th scope="row"><label><input type="checkbox" data-unit-series value="${esc(item.id)}" ${color?'checked':''}>${color?`<i class="unit-report-dot" style="background-color:${color}"></i>`:''}<span>${esc(item.label)}</span></label></th>${model.periods.map(period=>`<td>${reportAmount(report,result?.values.get(period.key)||0)}</td>`).join('')}${showTotal?`<td><strong>${reportAmount(report,result?.total||0)}</strong></td>`:''}</tr>`;
 }).join('')}</tbody></table></div><div class="unit-report-pages"><span>${start+1}–${Math.min(start+size,rows.length)} de ${rows.length}</span><button class="btn btn-small" type="button" data-unit-page="-1" ${start===0?'disabled':''}>Anterior</button><button class="btn btn-small" type="button" data-unit-page="1" ${start/size>=last?'disabled':''}>Siguiente</button></div>`;
}
function unitReportCard(source,originalChart,summary=''){
 const report=unitReports[source];
 const preview=report.year?reportChart(unitReportModel(report),report,true):'';
 return `<div class="unit-report-card"><div id="unit-report-preview-${source}"><div data-unit-original ${preview?'hidden':''}>${originalChart}</div><div data-unit-custom ${preview?'':'hidden'}>${preview}</div></div>${summary?`<p class="muted capacity-summary">${esc(summary)}</p>`:''}<div class="unit-report-actions"><button type="button" class="btn btn-small" data-action="unit-report" data-id="${source}">${unitReportSources[source].button}</button><button type="button" class="btn btn-small" data-action="inventory-download" data-id="${source}">Descargar inventario</button></div></div>`;
}
function openInventoryDownload(source){
 showModal('Descargar inventario',`<div class="modal-body"><div class="unit-report-actions">
  <button type="button" class="btn" data-action="inventory-excel">Descargar Excel</button>
  <button type="button" class="btn" data-action="inventory-image" data-id="${source}">Descargar imagen del gráfico</button>
 </div></div>`);
 $('[data-action="inventory-excel"]').focus();
}
function openUnitReport(source){
 const report=unitReports[source],info=unitReportSources[source];
 const sales=source==='sales';
 if(!report.year){
  const weeksWithMovements=sales?[]:state.periods.filter(week=>
   Object.values(state.movements?.[week.id]||{}).some(clients=>Object.keys(clients).length)
  );
  const lastRecordedDate=sales
   ?purchases().reduce((date,sale)=>!sale.voided&&sale.date>date?sale.date:date,'')
   :weeksWithMovements.reduce((date,week)=>calendarDate(week.start)&&week.start>date?week.start:date,'');
  if(weeksWithMovements.length&&!lastRecordedDate)report.period='undated';
  const latest=lastRecordedDate||localSaleDate();
  const [year,month,day]=latest.split('-').map(Number);
  report.year=String(Math.min(3000,Math.max(2000,year)));
  report.month=String(month);
  report.week=String(Math.min(5,Math.ceil(day/7)));
 }
 const selectedOption=(value,current)=>value===current?' selected':'';
 const periodOptions=(values,current,label=value=>value)=>values.map(value=>`<option value="${value}"${selectedOption(value,current)}>${label(value)}</option>`).join('');
 const crossOptions=()=>'<option value="">Todos</option>'+salesOptions(reportEntities(report.group==='product'?'client':'product',source),report.cross,item=>item.label);
 showModal(info.title,`<div class="modal-body unit-report-body">
  <div class="sales-fields unit-report-filters">
   <label class="field">Período <select class="form-control" data-unit-filter="period"><option value="week"${selectedOption('week',report.period)}>Semana</option><option value="month"${selectedOption('month',report.period)}>Mes</option><option value="year"${selectedOption('year',report.period)}>Año</option>${sales?'':`<option value="undated"${selectedOption('undated',report.period)}>Semanas sin fecha</option>`}</select></label>
   <div data-unit-year ${report.period==='undated'?'hidden':''}><label class="field">Año <select class="form-control" data-unit-filter="year">${periodOptions(unitReportYears,report.year)}</select></label></div>
   <div data-unit-month ${['week','month'].includes(report.period)?'':'hidden'}><label class="field">Mes <select class="form-control" data-unit-filter="month">${periodOptions(unitReportMonths.map((_,i)=>String(i+1)),report.month,value=>unitReportMonths[value-1])}</select></label></div>
   <div data-unit-week ${report.period!=='week'?'hidden':''}><label class="field">Semana del mes <select class="form-control" data-unit-filter="week">${periodOptions(unitReportWeeks,report.week,value=>`Semana ${value} (${7*(value-1)+1}–${value==='5'?'fin de mes':7*value})`)}</select></label></div>
  </div>
  <div data-unit-chart></div>
  <details class="unit-report-advanced" data-unit-advanced${report.group!=='product'||report.cross||report.query?' open':''}>
   <summary>Más filtros</summary>
   <div class="sales-fields">
    <label class="field">Agrupar por <select class="form-control" data-unit-filter="group"><option value="product"${selectedOption('product',report.group)}>Producto</option><option value="client"${selectedOption('client',report.group)}>Cliente</option></select></label>
    <label class="field"><span data-unit-cross-label></span><select class="form-control" data-unit-filter="cross">${crossOptions()}</select></label>
    <label class="field">Buscar en la tabla <input class="form-control" type="search" data-unit-query value="${esc(report.query)}"></label>
   </div>
   ${info.description?`<p class="muted">${esc(info.description)}</p>`:''}
  </details>
  <div class="unit-report-selection">
   <span class="muted" data-unit-mode aria-live="polite"></span>
   <button class="btn btn-small" type="button" data-unit-auto hidden>Volver a selección automática</button>
  </div>
  <div data-unit-table></div>
 </div>`,`<button type="button" class="btn" data-action="close-modal">Cerrar</button>`);
 const root=$('.unit-report-body'),table=$('[data-unit-table]',root),chart=$('[data-unit-chart]',root);
 const auto=$('[data-unit-auto]',root),mode=$('[data-unit-mode]',root);
 let model;
 const labels=()=>{$('[data-unit-cross-label]',root).textContent=report.group==='product'?'Filtrar por cliente':'Filtrar por producto';};
 const refresh=(focus='')=>{
  model=unitReportModel(report);
  table.innerHTML=unitReportRows(model,report);
  chart.innerHTML=reportChart(model,report);
  const manual=!!report.selected[report.group];
  mode.textContent=manual?'Selección manual':'Selección automática · hasta 3 filas';
  auto.hidden=!manual;
  const target=$(`#unit-report-preview-${source}`);
  if(target){
   const custom=$('[data-unit-custom]',target),original=$('[data-unit-original]',target);
   const preview=reportChart(model,report,true);
   custom.innerHTML=preview;
   custom.hidden=!preview;
   original.hidden=!!preview;
  }
  if(focus)$$('[data-unit-series]',table).find(box=>box.value===focus)?.focus({preventScroll:true});
 };
 labels();refresh();
 root.addEventListener('input',event=>{
  if(!event.target.matches('[data-unit-query]'))return;
  report.query=event.target.value;report.page=0;
  table.innerHTML=unitReportRows(model,report);
 });
 root.addEventListener('change',event=>{
  const el=event.target,filter=el.dataset.unitFilter;
  if(el.hasAttribute('data-unit-series')){
   const selected=report.selected[report.group]??=new Map(model.selected);
   if(el.checked){
    const used=new Set(selected.values());
    let i=0,color;
    do{color=reportColors[i]||`hsl(${((i*137.508)%360).toFixed(3)}, 68%, 38%)`;i++;}while(used.has(color));
    selected.set(el.value,color);
   }else selected.delete(el.value);
   const scroller=$('.unit-report-table',table),scroll=scroller?.scrollLeft||0;
   refresh(el.value);
   const next=$('.unit-report-table',table);if(next)next.scrollLeft=scroll;
   return;
  }
  if(!filter)return;
  report[filter]=el.value;report.page=0;
  if(filter==='group'){
   report.query='';$('[data-unit-query]',root).value='';
   report.cross='';$('[data-unit-filter="cross"]',root).innerHTML=crossOptions();labels();
  }
  if(filter==='period'){
   $('[data-unit-year]',root).hidden=report.period==='undated';
   $('[data-unit-month]',root).hidden=!['week','month'].includes(report.period);
   $('[data-unit-week]',root).hidden=report.period!=='week';
  }
  refresh();
 });
 auto.addEventListener('click',()=>{
  report.selected[report.group]=null;
  refresh();
  ($('[data-unit-series]:checked',table)||$('[data-unit-filter="period"]',root)).focus();
 });
 root.addEventListener('click',event=>{
  const button=event.target.closest('[data-unit-page]');if(!button)return;
  report.page+=Number(button.dataset.unitPage);
  table.innerHTML=unitReportRows(model,report);
  ($(`[data-unit-page="${button.dataset.unitPage}"]:not(:disabled)`,table)||$('[data-unit-series]',table))?.focus({preventScroll:true});
 });
}
const Trace=window.GUTrace;
const traceQuantity=units=>format(units,6);
function traceTable(headings,rows){
 return `<div class="table-scroll trace-table"><table class="data-table"><thead><tr>${headings.map(label=>`<th scope="col">${esc(label)}</th>`).join('')}</tr></thead><tbody>${rows.map(cells=>`<tr>${cells.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function traceProductName(lot){return state.products.find(p=>p.id===lot.productId)?.name||lot.productName;}
function traceLotLabel(lot){return `${traceProductName(lot)} · Lote ${lot.code} · Contenedor ${lot.container}`;}
function traceMoney(sale,amount){return new Intl.NumberFormat('es-CO',{style:'currency',currency:sale.currency||'COP'}).format(amount);}
function purchases(){return Trace?.purchases?.(state)||state.sales||[];}
function purchaseOrigin(product){
 const groups=new Map(catalogGroups().map(group=>[group.id,group]));
 return {
  productNumber:product.productNumber||'',boxNumber:product.boxNumber||'',vesselNumber:product.vesselNumber||'',
  lotCode:product.boxNumber||'',container:'',catalogLot:!!product.boxNumber,rack:product.catalogRack?`Rack ${product.catalogRack}`:'',
  groups:(product.groupIds||[]).map(id=>groups.get(id)).filter(Boolean).map(({name,color})=>({name,color}))
 };
}
function originBadges(groups){
 return groups?.length?`<div class="catalog-tag-list">${groups.map(groupBadge).join('')}</div>`:'—';
}
function saleProductLabel(product){
 return [product.name,product.productNumber,product.boxNumber?`Caja ${product.boxNumber}`:'',product.vesselNumber?`Embarcación ${product.vesselNumber}`:''].filter(Boolean).join(' · ');
}
function provenanceTable(name,origin,date='',extra=[]){
 const when=date||'—';
 const data=[
  ['Producto',esc(name)],['Número de producto',esc(origin.productNumber||'—')],['Caja',esc(origin.boxNumber||'—')],
  ['Lote',esc(origin.lotCode||'—')],['Embarcación',esc(origin.vesselNumber||'—')],['Rack',esc(origin.rack||'—')],
  ['Grupos',originBadges(origin.groups)],['Fecha de registro',esc(when)],...extra
 ];
 return `<section class="product-provenance" aria-label="Registro de procedencia"><h3>Registro de procedencia</h3>${traceTable(['Dato','Registro'],data)}</section>`;
}
function tracePurchases(sales,entity){
 if(!sales.length)return '<p class="muted">Todavía no hay compras registradas.</p>';
 const lots=new Map((state.lots||[]).map(lot=>[lot.id,lot]));
 return traceTable(['Fecha','Semana',entity==='client'?'Producto':'Cliente','Número de caja','Lote / contenedor','Embarcación','Grupos','Ubicación de salida','Unidades','Precio unitario','Total','Referencia'],sales.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(sale=>{
  const origin=sale.origin;
  const lot=lots.get(sale.lotId);
  const name=entity==='client'?(sale.productName||state.products.find(p=>p.id===sale.productId)?.name):(sale.clientName||state.clients.find(c=>c.id===sale.clientId)?.name);
  const number=entity==='client'&&origin?.productNumber?`<small class="muted purchase-product-number">${esc(origin.productNumber)}</small>`:'';
  const lotCode=origin?.lotCode||lot?.code,container=origin?.container||lot?.container;
  return [sale.date,esc(sale.weeklyPeriodLabel||'—'),esc(name||'—')+number,esc(origin?.boxNumber||'—'),lotCode?esc(origin?.catalogLot?`${lotCode} (caja)`:container?`${lotCode} / ${container}`:lotCode):'Sin lote registrado',esc(origin?.vesselNumber||'—'),originBadges(origin?.groups),esc(sale.location||'—'),format(sale.units,6),sale.price==null?'—':traceMoney(sale,sale.price),sale.price==null?'—':traceMoney(sale,sale.price*sale.units),esc(sale.reference||'—')];
 }));
}
function clientTrace(clientId){
 const client=state.clients.find(c=>c.id===clientId);if(!client)return;
 const records=purchases().filter(sale=>sale.clientId===clientId&&!sale.voided);
 const months=[...new Set(records.map(sale=>sale.date.slice(0,7)))].sort().reverse();
 const products=new Map(records.map(sale=>[sale.productId,{id:sale.productId,name:sale.productName||state.products.find(p=>p.id===sale.productId)?.name||sale.productId}]));
 showModal(`Compras · ${salesClientLabel(client)}`,`<div class="modal-body trace-body client-purchases">
 <div class="sales-fields">
 <label class="field">Mes <select class="form-control" data-client-purchase-month><option value="">Todos los meses</option>${months.map(key=>`<option value="${key}">${key}</option>`).join('')}</select></label>
 <label class="field">Producto <select class="form-control" data-client-purchase-product><option value="">Todos los productos</option>${salesOptions([...products.values()],null,p=>p.name)}</select></label>
 <label class="field">Buscar procedencia <input type="search" class="form-control" data-client-purchase-origin placeholder="Caja, lote, embarcación, rack o grupo"></label>
 </div><div data-client-purchases-results></div></div>`,
 '<button type="button" class="btn" data-action="close-modal">Cerrar</button>');
 const root=$('.client-purchases'),month=root.querySelector('[data-client-purchase-month]'),product=root.querySelector('[data-client-purchase-product]'),origin=root.querySelector('[data-client-purchase-origin]');
 const lots=new Map((state.lots||[]).map(lot=>[lot.id,lot]));
 const refresh=()=>{
  const term=origin.value.trim().toLocaleLowerCase('es');
  const visible=records.filter(sale=>{
   if(month.value&&!sale.date.startsWith(month.value))return false;
   if(product.value&&sale.productId!==product.value)return false;
   const source=sale.origin,lot=lots.get(sale.lotId);
   return !term||[source?.boxNumber,source?.vesselNumber,source?.lotCode,source?.container,sale.location,lot?.code,lot?.container,...(source?.groups||[]).map(group=>group.name)].join(' ').toLocaleLowerCase('es').includes(term);
  });
  root.querySelector('[data-client-purchases-results]').innerHTML=`<p><strong>${format(sumSales(visible),6)} unidades compradas</strong></p>${tracePurchases(visible,'client')}`;
 };
 month.addEventListener('change',refresh);product.addEventListener('change',refresh);origin.addEventListener('input',refresh);refresh();
}
function calendarDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T00:00:00Z');
 return Number.isFinite(+date)&&date.toISOString().slice(0,10)===value;
}
function localSaleDate(){
 const now=new Date();
 return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
}
function previousSalesMonth(month){
 const date=new Date(month+'-01T00:00:00Z');
 date.setUTCMonth(date.getUTCMonth()-1);
 return date.toISOString().slice(0,7);
}
function sumSales(records){return C.round(records.reduce((total,sale)=>total+sale.units,0));}
function compareSales(current,previous){
 const change=C.round(current-previous);
 return `${change>0?'+':''}${traceQuantity(change)} unidades${previous?` (${change>0?'+':''}${format(change/previous*100)} %)`:' · sin base porcentual'}`;
}
function salesOptions(items,selected,label){
 return items.map(item=>`<option value="${esc(item.id)}"${item.id===selected?' selected':''}>${esc(label(item))}</option>`).join('');
}
const salesClientLabel=client=>client.name?`${client.name} · ${client.code}`:client.code;
const salesFilters={};
let speedQuery=null;
function renderSales(){
 const month=salesFilters.month||localSaleDate().slice(0,7),previous=previousSalesMonth(month);
 const products=state.products,clients=state.clients;
 const product=products.find(p=>p.id===salesFilters.product)||products[0];
 const first=clients.find(c=>c.id===salesFilters.firstClient)||clients[0];
 const second=clients.find(c=>c.id===salesFilters.secondClient&&c.id!==first?.id)||clients.find(c=>c.id!==first?.id);
 const records=purchases().filter(sale=>!sale.voided);
 const productNames=new Map(products.map(p=>[p.id,p.name]));
 const clientNames=new Map(clients.map(c=>[c.id,salesClientLabel(c)]));
 const current=records.filter(sale=>sale.date.startsWith(month));
 const old=records.filter(sale=>sale.date.startsWith(previous));
 const monthly=new Map([[month,0],[previous,0]]);
 const leaders=new Map();
 for(const sale of current){const entry=leaders.get(sale.productId)||{name:productNames.get(sale.productId)||sale.productName,units:0};entry.units=C.round(entry.units+sale.units);leaders.set(sale.productId,entry);}
 for(const sale of records){
  if(sale.productId===product?.id){const key=sale.date.slice(0,7);monthly.set(key,C.round((monthly.get(key)||0)+sale.units));}
 }
 const previousTotal=monthly.get(previous),currentTotal=monthly.get(month);
 const clientRows=[first,second].filter(Boolean).map(client=>{
  const total=sumSales(current.filter(s=>s.clientId===client.id)), prior=sumSales(old.filter(s=>s.clientId===client.id));
  return `<tr><th scope="row">${esc(salesClientLabel(client))}</th><td>${traceQuantity(prior)}</td><td>${traceQuantity(total)}</td><td>${compareSales(total,prior)}</td></tr>`;
 });
 const priorByProduct=new Map();
 for(const sale of old)priorByProduct.set(sale.productId,C.round((priorByProduct.get(sale.productId)||0)+sale.units));
 const ranking=[...leaders.entries()].sort(([,a],[,b])=>b.units-a.units||a.name.localeCompare(b.name,'es'));
 const table=(labels,rows)=>`<div class="table-scroll sales-table"><table class="data-table"><thead><tr>${labels.map(label=>`<th scope="col">${esc(label)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
 const lots=state.lots||[],remaining=Trace.balance(state);
 const received=lots.reduce((total,lot)=>total+lot.units,0);
 const available=[...remaining.values()].reduce((total,units)=>total+units,0);
 const unplaced=lots.reduce((total,lot)=>total+(Trace.location(lot).rack?0:remaining.get(lot.id)),0);
 const lotA=lots.find(lot=>lot.id===speedQuery?.a);
 const lotB=lots.find(lot=>lot.id===speedQuery?.b);
 let speedResult='';
 if(lotA&&lotB){
  const a=Trace.soldOut(lotA,records),b=Trace.soldOut(lotB,records);
  let outcome='Los dos lotes tienen unidades pendientes.';
  if(a&&b)outcome=a.days===b.days?'Los dos lotes se agotaron en el mismo número de días.':`${traceLotLabel(a.days<b.days?lotA:lotB)} se agotó más rápido.`;
  else if(a||b)outcome=`${traceLotLabel(a?lotA:lotB)} se agotó. El otro lote aún tiene existencias.`;
  speedResult=`<p role="status"><strong>${esc(outcome)}</strong></p>${table(['Lote','Llegada','Unidades recibidas','Unidades disponibles','Fecha de agotamiento','Días desde la llegada'],[[lotA,a],[lotB,b]].map(([lot,result])=>`<tr><th scope="row">${esc(traceLotLabel(lot))}</th><td>${lot.receipt.date}</td><td>${traceQuantity(lot.units)}</td><td>${traceQuantity(remaining.get(lot.id))}</td><td>${result?.date||'Pendiente'}</td><td>${result?format(result.days,0):'—'}</td></tr>`))}`;
 }
 const visible=[...current].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
 const salesPage=selection(visible);
 const lotsById=new Map(lots.map(lot=>[lot.id,lot]));
 return `${heading('MÉTRICAS','Comparar ventas','Consulta ventas por producto y cliente, y compara el tiempo de salida de dos productos.')}
 <p class="sales-note">Las compras se registran desde las casillas del Registro. Las ventas guardadas anteriormente también aparecen en el historial.</p>
 ${!products.length?empty('Agrega un producto para empezar','Después podrás registrar ventas y comparar resultados.','new-product','Añadir producto'):''}
 <section class="card card-pad sales-section"><h2 id="sales-monthly" tabindex="-1">Productos y clientes por mes</h2>
 <form id="sales-filters" class="sales-fields">
 <label class="field">Mes <input class="form-control" type="month" name="month" value="${month}" max="${localSaleDate().slice(0,7)}" required></label>
 <label class="field">Producto <select class="form-control" name="product">${salesOptions(products,product?.id,p=>p.name)}</select></label>
 <label class="field">Cliente externo 1 <select class="form-control" name="firstClient">${salesOptions(clients,first?.id,salesClientLabel)}</select></label>
 <label class="field">Cliente externo 2 <select class="form-control" name="secondClient"><option value="">Seleccionar</option>${salesOptions(clients,second?.id,salesClientLabel)}</select></label>
 <button class="btn" type="submit">Comparar</button></form>
 <h3>Productos más vendidos · ${month}</h3>
 ${ranking.length?table(['Producto',previous,month,'Variación mensual'],ranking.map(([id,row])=>{const prior=priorByProduct.get(id)||0;return `<tr><th scope="row">${esc(row.name)}</th><td>${traceQuantity(prior)}</td><td>${traceQuantity(row.units)}</td><td>${compareSales(row.units,prior)}</td></tr>`;})):'<p class="muted">Sin ventas registradas en este mes.</p>'}
 ${product?`<h3>Historial mensual · ${esc(product.name)}</h3><p>${previous}: <strong>${traceQuantity(previousTotal)}</strong> · ${month}: <strong>${traceQuantity(currentTotal)}</strong> · Variación: ${compareSales(currentTotal,previousTotal)}</p>${table(['Mes','Unidades vendidas'],[...monthly].sort(([a],[b])=>b.localeCompare(a)).map(([key,total])=>`<tr><th scope="row">${key}</th><td>${traceQuantity(total)}</td></tr>`))}`:''}
 <h3 id="sales-clients" tabindex="-1">Comparación de clientes externos</h3>
 ${clientRows.length?table(['Cliente',previous,month,'Variación mensual'],clientRows):''}
 ${!second?'<p class="muted">Selecciona dos clientes distintos para compararlos.</p>':`<p class="muted">Diferencia en ${month}: ${traceQuantity(Math.abs(sumSales(current.filter(s=>s.clientId===first.id))-sumSales(current.filter(s=>s.clientId===second.id))))} unidades entre los dos clientes.</p>`}
 </section>
 <section class="card card-pad sales-section"><h2 id="sales-turnover" tabindex="-1">Velocidad de venta por lote</h2><p>Compara los días reales entre la recepción y la venta de la última unidad de cada lote.</p>
 ${lots.length>=2?`<form id="sales-speed" class="sales-fields">
 <label class="field">Lote 1 <select class="form-control" name="a">${salesOptions(lots,lotA?.id||lots[0].id,traceLotLabel)}</select></label>
 <label class="field">Lote 2 <select class="form-control" name="b">${salesOptions(lots,lotB?.id||lots[1].id,traceLotLabel)}</select></label>
 <button class="btn" type="submit">Comparar velocidad</button></form>${speedResult}`:'<p class="muted">Este informe requiere dos lotes históricos con recepción registrada.</p>'}</section>
 <section class="card card-pad sales-section"><h2>Existencias por lote</h2><p><strong>${traceQuantity(received)}</strong> recibidas · <strong>${traceQuantity(received-available)}</strong> vendidas · <strong>${traceQuantity(available)}</strong> disponibles · <strong>${traceQuantity(unplaced)}</strong> sin rack.</p><p class="muted">Las ventas históricas sin lote siguen en los totales por mes y cliente. Las existencias por lote se calculan desde las recepciones y las ventas vinculadas.</p></section>
 <section class="sales-section dashboard-visual-row trace-warehouse" aria-label="Ubicaciones de los lotes">${window.AlmendraWarehouse?.render(state)||''}</section>
 <section class="card card-pad sales-section"><h2>Ventas registradas · ${month}</h2>
 ${salesPage.rows.length?table(['Fecha','Producto','Cliente','Lote','Unidades','Acción'],salesPage.rows.map(s=>`<tr><td>${s.date}</td><td>${esc(productNames.get(s.productId)||s.productName)}</td><td>${esc(clientNames.get(s.clientId)||s.clientName)}</td><td>${esc(s.origin?.lotCode||lotsById.get(s.lotId)?.code||'Sin lote registrado')}</td><td>${traceQuantity(s.units)}</td><td>${s.weeklyPeriodId?'Registro':`<button type="button" class="btn btn-small" data-action="void-sale" data-id="${esc(s.id)}">Anular</button>`}</td></tr>`))+pageFoot(salesPage,'ventas'):'<p class="muted">Todavía no hay ventas para este mes.</p>'}</section>`;
}
function submitSales(form){
 const data=Object.fromEntries(new FormData(form));
 if(form.id==='sales-filters'){
  if(!calendarDate(data.month+'-01')||data.month<'0001-02'||data.month>localSaleDate().slice(0,7))return toast('Selecciona un mes válido.');
  if(data.firstClient===data.secondClient)return toast('Selecciona dos clientes distintos.');
  Object.assign(salesFilters,data);page=0;render();return;
 }
 if(form.id==='sales-speed'){
  if(data.a===data.b||![data.a,data.b].every(id=>(state.lots||[]).some(lot=>lot.id===id)))return toast('Selecciona dos lotes distintos.');
  speedQuery={a:data.a,b:data.b};render();return;
 }
}
function voidSale(saleId){
 const sale=(state.sales||[]).find(item=>item.id===saleId&&!item.voided);
 if(sale&&confirm('¿Anular la venta seleccionada?'))mutation(`Venta anulada: ${sale.productName}`,()=>{sale.voided=true;});
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
 return `<div class="stock-alert-summary" role="status"><span class="stock-alert-dot" aria-hidden="true"></span><div><strong>Revisión de existencias: ${negative.length} negativas · ${zero.length} en cero</strong><p>${examples}${negative.length+zero.length>4?' y otros productos':''}. Consulta el consolidado para verificar cantidades.</p></div></div>`;
}
function dashboardInventoryRows(){
 const totals=C.totals(state,state.products);
 return [['Producto','Saldo disponible','Cantidad registrada','Valor total'],...totals.rows.map(r=>[r.product.name,r.N,r.H,r.P])];
}
async function exportInventoryExcel(){
 const workbook=await window.GU4Excel.writeWorkbook([{name:'Inventario',rows:dashboardInventoryRows()}]);
 downloadBlob(workbook,filename('Inventarios_GU_Inventario','xlsx'));
}
function exportDashboardCSV(){
 const rows=dashboardInventoryRows();
 // Evita que hojas de cálculo interpreten nombres de productos como fórmulas.
 const cell=v=>{let t=String(v??'');if(/^[\s]*[=+@-]/.test(t)&&typeof v==='string')t="'"+t;return '"'+t.replace(/"/g,'""')+'"'};
 const csv='\uFEFF'+rows.map(r=>r.map(cell).join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download='Inventarios_GU_resumen_3_0.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function exportDashboardImage(button,panel=$('#main-content'),name='Inventarios_GU_metricas.png'){
 button.disabled=true;
 try{
  const canvas=await window.html2canvas(panel,{
   backgroundColor:getComputedStyle(panel).getPropertyValue('--bg').trim()||null,
   logging:false,
   scale:Math.min(2,window.devicePixelRatio||1),
   onclone(doc,copy){
    copy.querySelectorAll('.metric-collapsed').forEach(card=>card.classList.remove('metric-collapsed'));
    // Los SVG se rasterizan fuera del árbol y necesitan colores explícitos.
    copy.querySelectorAll('svg [fill^="var("],svg [stroke^="var("]').forEach(node=>{
     for(const attribute of ['fill','stroke']){
      const token=node.getAttribute(attribute)?.match(/^var\((--[\w-]+)\)$/)?.[1];
      if(token)node.setAttribute(attribute,doc.defaultView.getComputedStyle(node).getPropertyValue(token).trim());
     }
    });
    copy.querySelectorAll('.unit-report-chart text').forEach(node=>{
     const font=doc.defaultView.getComputedStyle(node);
     node.style.fontFamily=font.fontFamily;
     node.style.fontSize=font.fontSize;
    });
   }
  });
  const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!png)throw new Error('No se pudo generar el archivo PNG.');
  downloadBlob(png,name);
 }catch(error){toast('No se pudo descargar la imagen: '+error.message);}
 finally{button.disabled=false;}
}
function statCard(label,value,foot,icon,visual=''){return `<article class="card stat-card ${visual?'visual-stat':''}"><div class="stat-icon">${Icons?.svg(icon)||icon}</div><div class="stat-label">${esc(label)}</div><div class="stat-value mono">${esc(value)}</div>${visual?`<div class="stat-visual">${visual}</div>`:''}<div class="stat-foot">${esc(foot)}</div></article>`;}
function activePeriod(){let p=state.periods.find(p=>p.id===periodId);if(!p){p=state.periods[0];periodId=p.id;}return p;}
function registerPeriodDate(period){
 if(calendarDate(period.start))return period.start;
 return calendarDate(period.end)?period.end:'';
}
function registerPeriodScope(period){
 const date=registerPeriodDate(period);
 return {year:date.slice(0,4),month:date.slice(5,7)};
}
function registerPeriods({year,month}){
 return state.periods.filter(period=>{
  const date=registerPeriodDate(period);
  return year?date.startsWith(year+'-'+month+'-'):!date;
 });
}
function renderRegisterFilters(scope){
 const undated=state.periods.some(period=>!registerPeriodDate(period));
 const periods=registerPeriods(scope);
 const labelCounts=new Map();
 for(const period of periods)labelCounts.set(period.label,(labelCounts.get(period.label)||0)+1);
 const years=[...new Set([...unitReportYears,scope.year,...state.periods.map(period=>registerPeriodScope(period).year)])].filter(Boolean).sort();
 const option=(value,label,current)=>`<option value="${esc(value)}"${value===current?' selected':''}>${esc(label)}</option>`;
 const withoutDate=(undated||!scope.year)?option('','Sin fecha',scope.year):'';
 const months=unitReportMonths.map((name,i)=>option(String(i+1).padStart(2,'0'),name,scope.month)).join('');
 const scopedIds=new Set(periods.map(period=>period.id));
 const other=state.periods.filter(period=>!scopedIds.has(period.id));
 const weekLabel=(period,showDate)=>period.label+(showDate?' · '+(registerPeriodDate(period)||'Sin fecha'):'')+(period.locked?' · Cerrada':'');
 return `<div class="register-period-filters" role="group" aria-label="Elegir período del registro">
  <label class="field">Semana<select class="form-control" id="register-week">
   ${periods.length?salesOptions(periods,periodId,period=>weekLabel(period,labelCounts.get(period.label)>1)):'<option value="" selected disabled>Sin semanas en este período</option>'}
   ${other.length?`<optgroup label="Otras semanas guardadas">${salesOptions(other,null,period=>weekLabel(period,true))}</optgroup>`:''}
  </select></label>
  <label class="field">Mes<select class="form-control" id="register-month">${withoutDate}${months}</select></label>
  <label class="field">Año<select class="form-control" id="register-year">${withoutDate}${years.map(year=>option(year,year,scope.year)).join('')}</select></label>
 </div>`;
}
function changeRegisterFilter(control,value){
 if(control==='register-week'){switchPeriod(value);return;}
 const current=registerEmptyScope||registerPeriodScope(activePeriod());
 const today=localSaleDate();
 const preferredMonth=current.month||today.slice(5,7);
 let next={year:'',month:''};
 if(value&&control==='register-month'){
  next={year:current.year||today.slice(0,4),month:value};
 }else if(value){
  const months=state.periods.map(registerPeriodScope).filter(scope=>scope.year===value).map(scope=>scope.month);
  const month=months.includes(preferredMonth)?preferredMonth:months.sort().at(-1)||preferredMonth;
  next={year:value,month};
 }
 const [period]=registerPeriods(next);
 if(period){switchPeriod(period.id);return;}
 if(weeklyPreviewProduct)query='';
 weeklyPreviewProduct='';registerEmptyScope=next;page=0;render();
}
let weeklyPreviewProduct='';
function weeklyProductIds(period){
 const ids=new Set(period.productIds||[]);
 for(const [id,movements] of Object.entries(state.movements[period.id]||{})){
  if(Object.keys(movements||{}).length)ids.add(id);
 }
 for(const id of Object.keys(state.prices[period.id]||{}))ids.add(id);
 for(const id of Object.keys(state.weekTotals[period.id]||{}))ids.add(id);
 return ids;
}
const weeklyNumber=value=>value==null?'—':format(value,9);
function weeklyQuantityCell(period,client,product,units){
 if(units==null||period.locked)return weeklyNumber(units);
 const label=`Revisar cantidad de ${product.name} para ${salesClientLabel(client)}: ${weeklyNumber(units)}`;
 return `<button type="button" class="weekly-quantity-link" data-action="weekly-cell" data-period="${esc(period.id)}" data-client="${esc(client.id)}" data-id="${esc(product.id)}" aria-label="${esc(label)}" aria-haspopup="dialog">${weeklyNumber(units)}</button>`;
}
function openWeeklyClientPicker(){
 const period=activePeriod();
 if(period.locked)return;
 showModal('Seleccionar cliente',`<div class="modal-body"><label class="field">Cliente
 <select class="form-control" id="weekly-client-choice" data-period="${esc(period.id)}"><option value="">Elige un cliente</option>
 ${salesOptions(state.clients,null,salesClientLabel)}</select></label></div>`);
}
function updateRegisterDate(field,value){
 const period=activePeriod();
 if(period.locked||period[field]===value)return;
 const start=field==='start'?value:period.start,end=field==='end'?value:period.end;
 if((value&&!calendarDate(value))||(start&&end&&start>end)){
  toast('La fecha final debe ser igual o posterior a la fecha de inicio.');
  render();return;
 }
 mutation(`Fechas actualizadas: ${period.label}`,()=>{period[field]=value;});
}
function toggleRegisterLock(){
 const period=activePeriod();
 mutation(`${period.locked?'Semana desbloqueada':'Semana bloqueada'}: ${period.label}`,()=>{period.locked=!period.locked;});
 $('[data-action="toggle-period-lock"]')?.focus();
}
function hasWeeklyOrigin(origin){
 return Boolean(origin?.boxNumber?.trim()&&origin?.vesselNumber?.trim()&&origin?.rack?.trim());
}
function weeklyCellOrigin(weekId,product,clientId){
 const previous=state.weeklyOrigins?.[Trace.weeklyKey(weekId,product.id,clientId)];
 return previous&&!previous.deleted&&hasWeeklyOrigin(previous.origin)?previous.origin:purchaseOrigin(product);
}
function weeklyCellModal(weekId,clientId,productId=''){
 const period=state.periods.find(item=>item.id===weekId),client=state.clients.find(item=>item.id===clientId);
 if(!period||!client)return;
 if(period.locked)return toast('Reabre el período para cambiar las cantidades.');
 if(!state.products.length){
  showModal('Productos del catálogo','<div class="modal-body"><p>Añade primero un producto al catálogo.</p></div>',
   '<button type="button" class="btn" data-action="close-modal">Cerrar</button><button type="button" class="btn btn-primary" data-action="weekly-catalog">Ir a Productos</button>');
  return;
 }
 showModal(`${period.label} · ${salesClientLabel(client)}`,`<form id="weekly-cell-form" class="modal-body" data-period="${esc(weekId)}" data-client="${esc(clientId)}">
 <div class="modal-grid">
 <div class="field full">
 <details class="weekly-product-select" id="weekly-product-select">
 <summary class="form-control" id="weekly-product-label">Selecciona un producto</summary>
 <div class="weekly-product-options">
  <label class="field">Buscar en el selector<input class="form-control" type="search" id="weekly-cell-search" placeholder="Nombre, producto, caja o embarcación" autocomplete="off"></label>
  <div id="weekly-product-results"></div>
 </div>
 </details><input type="hidden" name="productId">
 </div>
 <div class="field full sale-origin" data-weekly-origin aria-live="polite"></div>
 <label class="field full">Cantidad de este producto para el cliente<input class="form-control" type="number" name="units" min="0" max="1000000000000" step="0.000001" disabled required></label>
 </div><p class="muted">Escribe el total para esta semana. Guarda 0 para quitarlo del registro.</p></form>`,
 '<button type="button" class="btn" data-action="close-modal">Cancelar</button><button type="submit" class="btn btn-primary" form="weekly-cell-form" id="weekly-cell-save" disabled>Guardar cantidad</button>');
 const form=$('#weekly-cell-form'),search=$('#weekly-cell-search'),picker=form.elements.productId,units=form.elements.units;
 const originField=form.querySelector('[data-weekly-origin]'),save=$('#weekly-cell-save');
 const updateProduct=()=>{
  const product=state.products.find(p=>p.id===picker.value);
  const origin=product?weeklyCellOrigin(weekId,product,clientId):null;
  const complete=hasWeeklyOrigin(origin);
  units.disabled=!product;
  save.disabled=!complete;
  if(!product){
   units.value='';originField.innerHTML='';return;
  }
  units.value=state.movements[weekId]?.[product.id]?.[clientId]??'';
  const saved=state.weeklyOrigins?.[Trace.weeklyKey(weekId,product.id,clientId)];
  originField.innerHTML=provenanceTable(product.name,origin,saved&&!saved.deleted?saved.date:(product.createdAt?stamp(product.createdAt):''))+(complete?'':'<span role="status">Completa la caja, la embarcación y el rack en Productos para registrar o cambiar esta cantidad.</span>');
 };
 const results=$('#weekly-product-results'),dropdown=$('#weekly-product-select'),summary=$('#weekly-product-label');
 const showProducts=()=>{
  const term=search.value.trim().toLocaleLowerCase('es');
  const products=state.products.filter(p=>saleProductLabel(p).toLocaleLowerCase('es').includes(term));
  results.innerHTML=products.length?products.slice(0,60).map(p=>`<button type="button" class="weekly-product-option" data-weekly-option="${esc(p.id)}" aria-pressed="${p.id===picker.value}">${esc(saleProductLabel(p))}</button>`).join(''):'<p class="muted" role="status">No hay productos que coincidan.</p>';
  if(products.length>60)results.insertAdjacentHTML('beforeend','<p class="muted">Acota la búsqueda para ver otros productos.</p>');
 };
 const choose=(id)=>{
  const product=state.products.find(p=>p.id===id);
  picker.value=product?.id||'';
  summary.textContent=product?saleProductLabel(product):'Selecciona un producto';
  updateProduct();showProducts();
 };
 choose(productId);
 search.addEventListener('input',showProducts);
 dropdown.addEventListener('toggle',()=>{if(dropdown.open)search.focus();});
 results.addEventListener('click',event=>{
  const option=event.target.closest('[data-weekly-option]');if(!option)return;
  choose(option.dataset.weeklyOption);
  dropdown.open=false;
  summary.focus();
 });
 dropdown.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||!dropdown.open)return;
  event.stopPropagation();dropdown.open=false;summary.focus();
 });
}
function saveWeeklyCell(form){
 const {period:weekId,client:clientId}=form.dataset,period=state.periods.find(item=>item.id===weekId),client=state.clients.find(item=>item.id===clientId);
 if(!period||period.locked||!client)return toast('Esta casilla no está disponible para editar.');
 const data=new FormData(form),product=state.products.find(item=>item.id===data.get('productId'));
 const raw=String(data.get('units')??'').trim(),units=Number(raw);
 if(!product)return toast('Selecciona un producto del catálogo.');
 const origin=weeklyCellOrigin(weekId,product,clientId);
 if(!hasWeeklyOrigin(origin))return toast('Completa la caja, la embarcación y el rack en Productos.');
 if(!raw||!Number.isFinite(units)||units<0||units>1e12||Math.abs(units-Math.round(units*1e6)/1e6)>1e-9)return toast('Escribe una cantidad válida.');
 const key=Trace.weeklyKey(weekId,product.id,clientId),previous=state.weeklyOrigins?.[key];
 const existing=state.movements[weekId]?.[product.id]?.[clientId];
 if(units===0&&!existing&&!previous){closeModal();return;}
 if(mutation(`${period.label}: ${product.name} · ${salesClientLabel(client)} → ${format(units,6)}`,()=>{
  const movements=(state.movements[weekId]??={});
  const cells=(movements[product.id]??={});
  if(units>0)cells[clientId]=units;else delete cells[clientId];
  const record=previous&&!previous.deleted?previous:{
   periodId:weekId,productId:product.id,clientId,productName:product.name,clientName:salesClientLabel(client),date:localSaleDate(),
   price:state.prices[weekId]?.[product.id]??product.value??null,currency:state.settings.currency||'COP'
  };
  (state.weeklyOrigins??={})[key]={...record,origin,deleted:units===0,updatedAt:new Date().toISOString()};
  if(view==='weekly'&&periodId===weekId){
   weeklyPreviewProduct='';query='';
   const ids=weeklyProductIds(period),position=state.products.filter(item=>ids.has(item.id)).findIndex(item=>item.id===product.id);
   if(position>=0)page=Math.floor(position/(state.settings.pageSize||20));
  }
 }))closeModal();
}
function weeklyVisibleSelection(ids){
 return selection(state.products.filter(product=>ids.has(product.id)||product.id===weeklyPreviewProduct));
}
const weeklyVisibleClients=totals=>state.clients.filter(client=>totals.clients.has(client.id));
function weeklyRows(period,products){
 return products.map(({id,name})=>{
  const cells={...state.movements[period.id]?.[id]},stock=C.qty(state,period.id,id);
  const price=state.prices[period.id]?.[id],manual=state.weekTotals[period.id]?.[id];
  return {product:{id,name},cells,stock,price,manual,estimate:money(stock*C.num(price))};
 });
}
function weeklyColumnTotals(period){
 const clients=new Map();
 let stock=0;
 for(const product of state.products){
  for(const [clientId,quantity] of Object.entries(state.movements[period.id]?.[product.id]||{})){
   const amount=C.num(quantity);
   clients.set(clientId,(clients.get(clientId)||0)+amount);
   stock+=amount;
  }
 }
 return {clients,stock:C.round(stock)};
}
function weeklyClientTotal(totals,client){
 return weeklyNumber(C.round(totals.clients.get(client.id)||0));
}
function weeklyTable(period,slots,rows,totals,interactive=false){
 const cols=slots.map(client=>`<th scope="col" class="slot-col" title="${esc(salesClientLabel(client))}">${esc(interactive?(client.name||client.code):salesClientLabel(client))}</th>`).join('');
 return `<table class="data-table weekly-data-table"><thead><tr><th scope="col" class="sticky-first">Producto</th>${cols}<th scope="col" class="num last-head">Stock (CX)</th><th scope="col" class="num last-head">Precio (CY)</th><th scope="col" class="num last-head">Total manual (CZ)</th><th scope="col" class="num last-head">Estimado*</th></tr></thead>
 <tbody>${rows.map(({product,cells,stock,price,manual,estimate})=>`<tr><td class="sticky-first">${esc(product.name)}</td>${slots.map(client=>{
  const qty=cells[client.id];
  return `<td class="num">${interactive?weeklyQuantityCell(period,client,product,qty):weeklyNumber(qty)}</td>`;
 }).join('')}<td class="num t-em">${weeklyNumber(stock)}</td><td class="num">${weeklyNumber(price===''?null:price)}</td><td class="num">${weeklyNumber(manual===''?null:manual)}</td><td class="num">${estimate}</td></tr>`).join('')}</tbody>
 <tfoot><tr><th scope="row" class="sticky-first">Total semanal por cliente</th>${slots.map(client=>`<td class="num">${weeklyClientTotal(totals,client)}</td>`).join('')}<td class="num">${weeklyNumber(totals.stock)}</td><td colspan="3"></td></tr></tfoot></table>`;
}
function openWeeklyDownload(){
 const ids=weeklyProductIds(activePeriod()),visible=weeklyVisibleSelection(ids);
 showModal('Descargar imagen',`<div class="modal-body weekly-download-options">
  <button type="button" class="btn" data-action="weekly-image" data-id="visible"${visible.rows.length?'':' disabled'}>Tabla actual</button>
  <p class="muted">Productos y clientes que aparecen en la tabla actual.</p>
  <button type="button" class="btn" data-action="weekly-image" data-id="full"${ids.size?'':' disabled'}>Tabla completa de la semana</button>
  <p class="muted">Todos los productos y clientes del Registro.</p>
  <div class="muted" data-weekly-export-status role="status"></div>
 </div>`);
 $('[data-action="weekly-image"]:not(:disabled)')?.focus();
}
async function captureWeeklyImage(period,slots,rows,totals){
 const image=document.createElement('section');
 image.className='weekly-export';
 image.setAttribute('aria-hidden','true');
 image.innerHTML=`<h2>Registro · ${esc(period.label)}</h2>${weeklyTable(period,slots,rows,totals)}<p>* Estimado = stock semanal × precio.</p>`;
 document.body.append(image);
 try{
  const {width,height}=image.getBoundingClientRect(),maxEdge=15000,maxPixels=12000000;
  const scale=Math.min(2,window.devicePixelRatio||1,maxEdge/width,maxEdge/height,Math.sqrt(maxPixels/(width*height)));
  if(scale<1)return null;
  const canvas=document.createElement('canvas');
  try{
   canvas.width=Math.ceil(width*scale);
   canvas.height=Math.ceil(height*scale);
   if(!canvas.getContext('2d'))return null;
   await window.html2canvas(image,{canvas,scale,logging:false,backgroundColor:null});
   return await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  }
  finally{canvas.width=0;canvas.height=0;}
 }finally{image.remove();}
}
let weeklyImageInProgress=false;
async function exportWeeklyImage(full){
 if(weeklyImageInProgress)return toast('La imagen del registro se está preparando.');
 const period={...activePeriod()},ids=weeklyProductIds(period);
 const products=full?state.products.filter(product=>ids.has(product.id)):weeklyVisibleSelection(ids).rows;
 if(!products.length)return toast('No hay productos en esta tabla.');
 const rows=weeklyRows(period,products),totals=weeklyColumnTotals(period),images=[];
 const slots=(full?state.clients:weeklyVisibleClients(totals)).map(client=>({...client}));
 const capture=async (clients,products)=>{
  const png=clients.length<=120&&products.length<=160?await captureWeeklyImage(period,clients,products,totals):null;
  if(png){images.push(png);return;}
  const splitClients=clients.length>120||(clients.length>1&&products.length<=160&&clients.length*2>=products.length);
  const segments=splitClients?clients:products;
  if(segments.length<=1)throw new Error('El navegador no pudo generar la imagen.');
  const middle=Math.ceil(segments.length/2);
  for(const part of [segments.slice(0,middle),segments.slice(middle)]){
   await (splitClients?capture(part,products):capture(clients,part));
  }
 };
 const options=$$('[data-action="weekly-image"]:not(:disabled)');
 const status=$('[data-weekly-export-status]');
 const prefix='Inventarios_GU_Registro_'+(full?'Completo':'Actual');
 weeklyImageInProgress=true;
 options.forEach(option=>{option.disabled=true;});
 if(status)status.textContent='Preparando imagen…';
 try{
  await capture(slots,rows);
  if(images.length===1)downloadBlob(images[0],filename(prefix,'png'));
  else{
   const archive=new window.JSZip();
   images.forEach((png,i)=>archive.file(filename(prefix+'_Parte_'+String(i+1).padStart(2,'0'),'png'),png));
   downloadBlob(await archive.generateAsync({type:'blob',mimeType:'application/zip'}),filename(prefix,'zip'));
   toast('La tabla se descargó en varias imágenes dentro de un ZIP.');
  }
  if(options.some(option=>option.isConnected))closeModal();
 }finally{
  weeklyImageInProgress=false;
  options.forEach(option=>{option.disabled=false;});
  if(status)status.textContent='';
 }
}
function renderWeekly(){
 const period=activePeriod(),scope=registerEmptyScope||registerPeriodScope(period);
 const title=heading('CAPTURA DE DATOS',titleMap.weekly,'','<button class="btn btn-primary" data-action="new-period">+ Semana</button>');
 const filters=renderRegisterFilters(scope);
 if(registerEmptyScope)return `${title}${filters}${empty('Sin semanas en este período','Elige otro mes o año, o usa + Semana para añadir un período.')}`;
 const ids=weeklyProductIds(period),locked=period.locked;
 const sel=weeklyVisibleSelection(ids),rows=weeklyRows(period,sel.rows),totals=weeklyColumnTotals(period);
 const slots=weeklyVisibleClients(totals);
 const desktop=rows.length?`<div class="week-desktop week-table-wrap"><div class="table-scroll week-scroll-2d" tabindex="0" aria-label="Tabla semanal">${weeklyTable(period,slots,rows,totals,true)}</div>${pageFoot(sel,'productos')}</div>`:empty('No hay productos que mostrar',state.products.length?'Selecciona un cliente y registra una cantidad para añadir la fila.':'El catálogo está vacío.',state.products.length?'':'weekly-catalog','Ir a Productos');
 const mobile=rows.length?`<div class="week-mobile">${rows.map(({product,cells,stock,price,manual,estimate})=>`
  <article class="card week-product"><div class="week-product-head"><h3>${esc(product.name)}</h3><span class="badge ${stock<0?'danger':stock>0?'good':''}">Total ${weeklyNumber(stock)}</span></div>
  <div class="week-product-grid">${slots.map(client=>`<div class="field"><span>${esc(salesClientLabel(client))}</span><strong class="mono">${weeklyQuantityCell(period,client,product,cells[client.id])}</strong></div>`).join('')}</div>
  <div class="week-product-grid" style="margin-top:13px"><div class="field"><span>Precio unitario (CY)</span><strong>${weeklyNumber(price===''?null:price)}</strong></div><div class="field"><span>Total manual (CZ)</span><strong>${weeklyNumber(manual===''?null:manual)}</strong></div></div>
  <div class="week-product-foot"><span>Estimado: cantidad × precio</span><strong>${estimate}</strong></div></article>
 `).join('')}${slots.length?`<article class="card week-product" data-weekly-client-totals>
  <div class="week-product-head"><h3>Total semanal por cliente</h3></div>
  <div class="week-product-grid">${slots.map(client=>`<div class="field"><span>${esc(salesClientLabel(client))}</span><strong class="mono">${weeklyClientTotal(totals,client)}</strong></div>`).join('')}</div>
 </article>`:''}${pageFoot(sel,'productos')}</div>`:'';
 return `${title}${filters}
 <div class="register-week-dates">
  <label class="field">Inicio<input type="date" class="form-control" id="register-start" value="${esc(period.start)}"${locked?' disabled':''}></label>
  <label class="field">Fin<input type="date" class="form-control" id="register-end" value="${esc(period.end)}"${locked?' disabled':''}></label>
  <button type="button" class="btn btn-small" data-action="toggle-period-lock">${locked?'Desbloquear semana':'Bloquear semana'}</button>
 </div>
 <div class="tool-strip"><div class="left"><button type="button" class="btn btn-primary" data-action="weekly-client-picker" aria-haspopup="dialog"${locked?' disabled':''}>Seleccionar cliente</button></div>
 <div class="right"><button type="button" class="btn btn-small" data-action="clients">Editar nombres</button><button type="button" class="btn btn-small" data-action="weekly-download" aria-haspopup="dialog"${ids.size||rows.length?'':' disabled'}>Descargar imagen</button></div></div>
 ${desktop}${mobile}<p class="table-hint">* Estimado = stock semanal × precio.</p>`;
}
function renderFinal(){
 const filteredProducts=productsFiltered(),all=filteredProducts.filter(p=>{const n=C.result(state,p).N;return finalFilter==='all'||(finalFilter==='positive'?n>0:finalFilter==='zero'?n===0:n<0);}),sel=selection(all),allTotals=C.totals(state,state.products),visibleTotals=C.totals(state,all);
 const weeklyTotals=state.periods.map((_,index)=>C.round(allTotals.rows.reduce((total,row)=>total+row.weekly[index],0)));
 const columns=[['quantityN','Cantidad.N (L)'],['quantityV','Cantidad.V (M)'],['value','Valor (O)'],['average','Promedio (S)'],['boxes','Cajas (U)']];
 const editable=(p,field)=>numInput('product-field',p[field]??0,`data-product="${esc(p.id)}" data-field="${field}" aria-label="${esc(field)} de ${esc(p.name)}"`);
 const table=sel.rows.length?`<div class="card final-table"><div class="table-scroll"><table class="data-table"><thead><tr><th class="sticky-first">Producto</th>${state.periods.map(p=>`<th class="num">${esc(p.label)}</th>`).join('')}<th class="num">Registrado H</th><th class="num">Cantidad.N</th><th class="num">Cantidad.V</th><th class="num">L+M (J)</th><th class="num">Saldo N</th><th class="num">Valor O</th><th class="num">Total P</th><th class="num">Q</th><th class="num">R = -Q</th><th class="num">Promedio S</th><th class="num">Meses T</th><th class="num">Cajas U</th><th>CYU (V)</th></tr></thead><tbody>${sel.rows.map(pr=>{const r=C.result(state,pr);return `<tr><td class="sticky-first">${productButton(pr)}</td>${r.weekly.map((n,i)=>`<td class="num"><button class="product-link mono" data-action="jump-week" data-id="${esc(pr.id)}" data-period="${esc(state.periods[i].id)}">${format(n)}</button></td>`).join('')}<td class="num t-em">${format(r.H)}</td><td>${editable(pr,'quantityN')}</td><td>${editable(pr,'quantityV')}</td><td class="num">${format(r.J)}</td><td class="num t-em">${statusBalance(r.N)}</td><td>${editable(pr,'value')}</td><td class="num t-em">${money(r.P)}</td><td class="num">${format(r.Q)}</td><td class="num">${format(r.R)}</td><td>${editable(pr,'average')}</td><td class="num">${r.T===null?'<span class="badge warn">Sin promedio</span>':format(r.T)}</td><td>${editable(pr,'boxes')}</td><td>${r.V===null?'<span class="badge warn">Sin cajas</span>':esc(r.V)}</td></tr>`;}).join('')}</tbody></table></div>${pageFoot(sel,'productos')}</div>`:empty('No hay resultados',state.products.length?'No hay coincidencias con ese nombre.':'Agrega un producto o importa una copia de tus datos.','new-product','Añadir producto');
 const cards=sel.rows.length?`<div class="final-mobile">${sel.rows.map(p=>{const r=C.result(state,p);return `<article class="card card-pad"><div class="week-product-head">${productButton(p)}<span class="badge ${r.N<0?'danger':'good'}">Saldo: ${format(r.N)}</span></div><div class="mini-summary-grid"><div><small>Registrado (H)</small><b>${format(r.H)}</b></div><div><small>Valorización (P)</small><b>${money(r.P)}</b></div><div><small>Meses (T)</small><b>${r.T===null?'—':format(r.T)}</b></div><div><small>Cajas / unidades</small><b>${esc(r.V??'—')}</b></div></div><div class="week-product-grid">${columns.map(([key,label])=>`<div class="field"><label>${esc(label)}</label><input class="form-control" type="number" inputmode="decimal" step="any" value="${esc(p[key]??0)}" data-edit="product-field" data-field="${key}" data-product="${esc(p.id)}"></div>`).join('')}</div><div class="week-product-foot"><span>Ver Registro</span><button class="btn btn-small" data-action="jump-week" data-id="${esc(p.id)}" data-period="${esc(state.periods[0].id)}">Abrir →</button></div></article>`;}).join('')}${pageFoot(sel,'productos')}</div>`:`<div class="final-mobile">${empty('Sin resultados','Crea productos o importa una copia de tus datos.','new-product','Añadir producto')}</div>`;
 return `${heading('CONSOLIDADO / FINAL','Consolidado','Saldos y valorización calculados según las fórmulas originales.',`<button class="btn" data-action="csv-final">Exportar CSV</button><button class="btn btn-primary" data-nav="weekly">Ir a semanas</button>`)}
 <div class="final-summary"><div class="mini-kpi">H · Registro total<strong>${format(allTotals.quantity)}</strong></div><div class="mini-kpi">N · Saldo total<strong class="${allTotals.balance<0?'text-danger':''}">${format(allTotals.balance)}</strong></div><div class="mini-kpi">P · Valor global<strong>${money(allTotals.value)}</strong></div><div class="mini-kpi">Productos filtrados<strong>${all.length} de ${state.products.length}</strong></div></div>
 <section class="card card-pad final-week-totals" aria-labelledby="final-week-totals-title"><h2 id="final-week-totals-title">Totales por semana</h2>
 <div class="final-week-totals-scroll"><table class="data-table"><thead><tr><th scope="col">Semana</th><th scope="col" class="num">Total de unidades</th></tr></thead>
 <tbody>${state.periods.map((period,index)=>`<tr><th scope="row">${esc(period.label)}</th><td class="num">${format(weeklyTotals[index],9)}</td></tr>`).join('')}</tbody>
 <tfoot><tr><th scope="row">Todas las semanas</th><td class="num">${format(allTotals.quantity,9)}</td></tr></tfoot></table></div></section>
 <div class="tool-strip"><div class="left">${searchBar()}</div><div class="right"><span class="muted" style="font-size:11px">Subtotal: ${money(visibleTotals.value)}</span></div></div>
 <div class="gu-filterbar" role="group" aria-label="Filtrar saldos"><span class="gu-filter-label">Saldo</span>${[['all','Todos'],['positive','Positivo'],['zero','En cero'],['negative','Negativo']].map(([k,label])=>`<button type="button" data-final-filter="${k}" aria-pressed="${finalFilter===k}">${label}</button>`).join('')}<span class="muted">${all.length} referencias</span></div>
 <div class="final-desktop">${table}</div>${cards}<div class="help-note"><b>Reglas originales:</b> H = Σ semanas; J = L + M; N = H − J; P = N × O; Q = N; R = −Q; T = R / S (vacío si S = 0); V = COCIENTE(R,U) / RESIDUO(R,U), con aviso si U ≤ 0. El saldo puede ser negativo y no se convierte en valor absoluto.</div>`;
}
let catalogCategory='';
const groupKey=name=>name.trim().toLocaleLowerCase('es');
function catalogCategories(){
 const names=new Map();
 for(const product of state.products){const name=product.category?.trim();if(name&&!names.has(groupKey(name)))names.set(groupKey(name),name);}
 return [...names.values()].sort((a,b)=>a.localeCompare(b,'es'));
}
function categoryField(product){
 const current=product.category?.trim()||'';
 const options=catalogCategories().map(name=>`<option value="category:${esc(name)}"${groupKey(name)===groupKey(current)?' selected':''}>${esc(name)}</option>`).join('');
 return `<label class="field">Categoría <select class="form-control" name="category"><option value="">Sin categoría</option>${options}<option value="__new_category__">+ Nueva categoría</option></select></label>
 <label class="field" id="new-category-field" hidden>Nueva categoría <input class="form-control" name="newCategory" maxlength="70" disabled></label>`;
}
function groupBadge(group){
 return `<span class="catalog-tag catalog-group-badge" style="--group-color:${esc(group.color)}"><i aria-hidden="true"></i>${esc(group.name)}</span>`;
}
function productGroupChoices(product){
 const groups=catalogGroups();
 const selected=product?.groupIds||(product?[]:(view==='products'&&catalogGroup?[catalogGroup]:[]));
 return `<fieldset class="field full catalog-tag-fields"><legend>Grupos</legend>
 ${groups.length?groups.map(group=>`<label><input type="checkbox" name="groupIds" value="${esc(group.id)}"${selected.includes(group.id)?' checked':''}> ${groupBadge(group)}</label>`).join(''):'<p class="muted">Puedes crear grupos desde Gestionar grupos en Productos.</p>'}
 </fieldset>`;
}
let catalogGroup='';
function catalogGroups(){
 return (state.catalogGroups||[]).filter(group=>!group.deleted).sort((a,b)=>a.name.localeCompare(b.name,'es'));
}
function catalogGroupEditor(groupId=''){
 const groups=catalogGroups(),group=groups.find(item=>item.id===groupId);
 showModal('Grupos de productos',`<form id="catalog-group-form" class="modal-body">
 <label class="field">Grupo <select class="form-control" id="catalog-group-edit" name="groupId"><option value="">+ Nuevo grupo</option>${salesOptions(groups,group?.id,item=>item.name)}</select></label>
 <div class="catalog-tag-create"><label class="field">Nombre del grupo <input class="form-control" name="name" maxlength="50" value="${esc(group?.name||'')}" required></label>
 <label class="field">Color <input type="color" name="color" value="${esc(group?.color||'#4f6fae')}" required></label></div></form>`,
 `<button type="button" class="btn" data-action="close-modal">Cerrar</button>
 ${group?`<button type="button" class="btn btn-danger" data-action="remove-catalog-group" data-id="${esc(group.id)}">Eliminar grupo</button>`:''}
 <button type="submit" form="catalog-group-form" class="btn btn-primary">${group?'Guardar cambios':'Crear grupo'}</button>`);
}
function saveCatalogGroup(form){
 const data=new FormData(form),name=String(data.get('name')||'').trim().slice(0,50),color=String(data.get('color')||'');
 const groupId=String(data.get('groupId')||''),groups=catalogGroups(),group=groups.find(item=>item.id===groupId);
 if(groupId&&!group)return toast('El grupo ya no está disponible.');
 if(!name||!/^#[0-9a-f]{6}$/i.test(color))return toast('Escribe un nombre y elige un color.');
 if(groups.some(item=>item.id!==groupId&&groupKey(item.name)===groupKey(name)))return toast('Ya existe un grupo con ese nombre.');
 const savedId=group?.id||id('group');
 if(mutation(`Grupo ${group?'editado':'creado'}: ${name}`,()=>{
  if(group)Object.assign(group,{name,color});else (state.catalogGroups??=[]).push({id:savedId,name,color});
 }))catalogGroupEditor(savedId);
}
function removeCatalogGroup(groupId){
 const group=catalogGroups().find(item=>item.id===groupId);if(!group)return;
 if(!confirm(`¿Eliminar el grupo «${group.name}»? Los productos de este grupo quedarán sin grupo.`))return;
 if(mutation(`Grupo eliminado: ${group.name}`,()=>{
  group.deleted=true;
  for(const product of state.products)if(product.groupIds?.includes(groupId))product.groupIds=product.groupIds.filter(id=>id!==groupId);
 }))catalogGroupEditor();
}
function reconcileCatalogGroups(snapshot){
 // Prefiere los grupos existentes cuando una etiqueta anterior tiene el mismo nombre.
 const groups=snapshot.catalogGroups||[];
 const removed=groups.filter(group=>group.deleted);
 const deletedIds=new Set(removed.flatMap(group=>[group.id,...(group.aliases||[])]));
 const byName=new Map(),byId=new Map(),active=[];
 for(const candidate of [...groups,...(snapshot.catalogTags||[])]){
  if(candidate.deleted||deletedIds.has(candidate.id))continue;
  const ids=[candidate.id,...(candidate.aliases||[])].filter(id=>!deletedIds.has(id));
  const key=groupKey(candidate.name);
  let group=ids.map(id=>byId.get(id)).find(Boolean)||byName.get(key);
  if(!group){
   group={id:candidate.id,name:candidate.name,color:candidate.color,aliases:[]};
   active.push(group);byName.set(key,group);
  }
  for(const id of ids){
   if(byId.has(id))continue;
   byId.set(id,group);
   if(id!==group.id)group.aliases.push(id);
  }
 }
 snapshot.catalogGroups=[...active,...removed];
 delete snapshot.catalogTags;
 snapshot.products=snapshot.products.map(product=>{
  const {groupId,tagIds,...clean}=product;
  const hadGroups=Array.isArray(product.groupIds)||groupId!==undefined||(tagIds?.length>0);
  if(hadGroups){
   clean.groupIds=[...new Set([...(product.groupIds||[]),groupId,...(tagIds||[])].map(id=>byId.get(id)?.id).filter(Boolean))];
  }
  return clean;
 });
}
function renderProducts(){
 const categories=catalogCategories(),groups=catalogGroups(),byGroup=new Map(groups.map(group=>[group.id,group]));
 if(catalogGroup&&!byGroup.has(catalogGroup))catalogGroup='';
 if(catalogCategory&&!categories.some(name=>groupKey(name)===catalogCategory))catalogCategory='';
 const all=productsFiltered().filter(p=>(!catalogCategory||groupKey(p.category||'')===catalogCategory)&&(!catalogGroup||p.groupIds?.includes(catalogGroup)));
 if(productSort==='name')all.sort((a,b)=>(a.productNumber||a.name).localeCompare(b.productNumber||b.name,'es',{numeric:true}));
 else if(productSort==='stock')all.sort((a,b)=>C.result(state,a).N-C.result(state,b).N);
 else if(productSort==='value')all.sort((a,b)=>C.result(state,b).P-C.result(state,a).P);
 const sel=selection(all);
 return `${heading('CATÁLOGO MAESTRO','Productos','Consulta los números de embarcación, caja y producto junto con la cantidad y el precio unitario.',`<button class="btn btn-primary" data-action="new-product">+ Añadir producto</button><button class="btn" data-action="catalog-groups">Gestionar grupos</button>`)}
 <div class="tool-strip"><div class="left">${searchBar('Buscar por producto, embarcación o caja…')}</div><div class="right"><label class="gu-sort-label"><span class="muted">Ordenar</span><select class="form-control" id="product-sort"><option value="original" ${productSort==='original'?'selected':''}>Registro</option><option value="name" ${productSort==='name'?'selected':''}>Número de producto</option><option value="stock" ${productSort==='stock'?'selected':''}>Menor stock</option><option value="value" ${productSort==='value'?'selected':''}>Mayor valor</option></select></label><span class="muted">${all.length} / ${state.products.length}</span></div></div>
 <div class="catalog-group-filters">
 <label>Categoría <select class="form-control" id="catalog-category"><option value="">Todas</option>${categories.map(name=>`<option value="${esc(groupKey(name))}"${catalogCategory===groupKey(name)?' selected':''}>${esc(name)}</option>`).join('')}</select></label>
 <label>Grupo <select class="form-control" id="catalog-group"><option value="">Todos</option>${salesOptions(groups,catalogGroup,group=>group.name)}</select></label>
 ${byGroup.has(catalogGroup)?groupBadge(byGroup.get(catalogGroup)):''}</div>
 ${sel.rows.length?`<div class="card catalog-table"><div class="table-scroll"><table class="data-table" aria-label="Productos"><thead><tr><th scope="col">Número de embarcación</th><th scope="col">Número de caja</th><th scope="col" class="num">Cantidad de productos por caja</th><th scope="col">Número de producto</th><th scope="col" class="num">Precio por unidad</th><th scope="col">Acciones</th></tr></thead><tbody>
 ${sel.rows.map(p=>`<tr><td>${esc(p.vesselNumber||'—')}</td><td>${esc(p.boxNumber||'—')}</td><td class="num">${p.boxes?format(p.boxes,9):'—'}</td><th scope="row" class="catalog-product-number">${esc(p.productNumber||'—')}${p.name&&p.name!==p.productNumber?`<small class="muted">${esc(p.name)}</small>`:''}${p.catalogRack?`<small class="muted">Rack ${Number(p.catalogRack)}</small>`:''}${p.groupIds?.length?`<div class="catalog-tag-list">${p.groupIds.map(id=>byGroup.get(id)).filter(Boolean).map(groupBadge).join('')}</div>`:''}</th><td class="num">${catalogUnitPrice(p.value)}</td><td><div class="catalog-actions"><button type="button" class="btn btn-small" data-action="product-groups" data-id="${esc(p.id)}">Categoría</button><button type="button" class="icon-btn" data-action="edit-product" data-id="${esc(p.id)}" aria-label="Editar ${esc(p.name)}" title="Editar producto">✎</button><button type="button" class="icon-btn" data-action="remove-product" data-id="${esc(p.id)}" aria-label="Eliminar ${esc(p.name)}" title="Eliminar producto">×</button></div></td></tr>`).join('')}
 </tbody></table></div>${pageFoot(sel,'productos')}</div>`:empty('Catálogo vacío',state.products.length?'Ningún producto coincide con los filtros.':'Añade un producto para empezar a registrar tus cajas.','new-product','Añadir producto')}`;
}
function renderClients(){
 const q=clientQuery.toLocaleLowerCase('es').trim();const all=state.clients.filter(c=>(clientFilter==='all'||(clientFilter==='named'?!!c.name?.trim():!c.name?.trim()))&&`${c.code} ${c.name||''}`.toLocaleLowerCase('es').includes(q));
 return `${heading('COLUMNAS A-1…A-100','Clientes y espacios','Nombra espacios sin modificar sus registros.',`<button class="btn btn-primary" data-action="add-client">+ Añadir espacio</button>`)}
 <div class="banner"><div><h3>${state.clients.length} espacios disponibles</h3><p>Los primeros 100 son equivalentes a las columnas A-1 hasta A-100 del Excel. Puedes agregar más sin modificar tus registros anteriores.</p></div><button class="btn" data-nav="weekly">Abrir registro</button></div>
 <div class="tool-strip"><div class="left"><label class="search"><input id="client-search" type="search" class="form-control" placeholder="Buscar A-1, nombre…" value="${esc(clientQuery)}"></label></div></div>
 <div class="gu-filterbar" role="group" aria-label="Filtrar espacios"><span class="gu-filter-label">Ver</span>${[['all','Todos'],['named','Con alias'],['unnamed','Sin alias']].map(([k,label])=>`<button type="button" data-client-filter="${k}" aria-pressed="${clientFilter===k}">${label}</button>`).join('')}<span class="muted">${all.length} / ${state.clients.length}</span></div>
 <div class="client-grid">${all.map(c=>`<div class="card client-cell"><label for="client-${esc(c.id)}">${esc(c.code)} <span class="muted">· Identificador fijo</span></label><input id="client-${esc(c.id)}" data-edit="client-name" data-id="${esc(c.id)}" class="form-control" maxlength="90" value="${esc(c.name||'')}" placeholder="Nombre o alias"><button type="button" class="btn btn-small trace-client-button" data-action="client-trace" data-id="${esc(c.id)}">Ver compras</button></div>`).join('')}</div>${!all.length?empty('Sin coincidencias','Prueba con otro código o nombre.'):''}`;
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
 <div class="card card-pad" style="margin-top:18px"><div class="card-title"><div><h3>Administración rápida</h3><p>Acceso a las herramientas adicionales desde el teléfono.</p></div></div><div class="page-tools"><button class="btn" data-nav="clients">Clientes y espacios</button><button class="btn" data-nav="audit">Historial de cambios</button><button class="btn" data-nav="weekly">Registro</button></div></div>
 ${window.GUInstall?`<div class="card card-pad" style="margin-top:18px"><div class="card-title"><div><h3>Aplicación para PC, Android y iPhone</h3><p>Instalable desde el navegador, con modo sin conexión y datos locales.</p></div></div><button class="btn btn-primary" type="button" data-action="install-app">Instalar / preparar offline</button><p class="muted" style="margin-top:10px">Para usar en otro dispositivo, instala allí y transfiere los datos mediante Copias y migración.</p></div>`:''}
 <div class="settings-grid" style="margin-top:18px"><article class="card card-pad"><h3>Prueba de funcionamiento</h3><p class="muted">Carga 30 productos de prueba con precios enteros, clientes, semanas y lotes ficticios.</p><button class="btn" data-action="demo">Cargar 30 productos de prueba</button></article><article class="card card-pad danger-zone"><h3>Restablecer espacio</h3><p class="muted">Borra los productos, clientes modificados, períodos y registros actuales. Crea primero una copia descargable.</p><button class="btn btn-danger" data-action="reset">Borrar todos los datos</button></article></div>`;}
// Formularios de edición.
let productRemovalReview=null;
function showModal(title,body,foot=''){productRemovalReview=null;const root=$('#modal-root');root.innerHTML=`<div class="modal-cover" data-modal-cover="1"><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-action="close-modal" aria-label="Cerrar">×</button></div>${body}<div class="modal-foot">${foot}</div></section></div>`;setTimeout(()=>root.querySelector('input:not([type="hidden"]),select')?.focus(),10);}
function closeModal(){productRemovalReview=null;$('#modal-root').innerHTML='';}
function catalogUnitPrice(value){
 return new Intl.NumberFormat('es-CO',{style:'currency',currency:state.settings.currency||'COP',maximumFractionDigits:9}).format(C.num(value));
}
function productModal(productId){
 const product=state.products.find(item=>item.id===productId);
 const field=(name,label,example)=>`<label class="field">${label}<input type="text" class="form-control" name="${name}" maxlength="80" value="${esc(product?.[name]||'')}" placeholder="${example}" required></label>`;
 showModal(product?'Editar producto':'Añadir producto',`<form id="product-form" data-id="${esc(productId||'')}" class="modal-body">
 <div class="modal-grid">
 <label class="field full">Nombre del producto<input type="text" class="form-control" name="name" maxlength="110" value="${esc(product?.name||'')}" placeholder="Ej. Té de jazmín" required></label>
 ${field('vesselNumber','Número de embarcación','Ej. EMB-001')}
 ${field('boxNumber','Número de caja','Ej. 015')}
 <label class="field">Cantidad de productos por caja<input type="number" class="form-control" name="boxes" min="1" max="1000000000000000" step="1" value="${esc(product?.boxes||'')}" placeholder="Ej. 24" required></label>
 ${field('productNumber','Número de producto','Ej. PR-204')}
 <label class="field">Precio por unidad (${esc(state.settings.currency||'COP')})<input type="number" class="form-control" name="value" min="0" max="1000000000000000" step="any" value="${esc(product?.value??'')}" placeholder="Ej. 12500" required></label>
 <label class="field">Rack en bodega <select class="form-control" name="catalogRack"${product?'':' required'}><option value="">${product?'Sin rack asignado':'Selecciona un rack'}</option>${[1,2,3].map(number=>`<option value="${number}"${Number(product?.catalogRack)===number?' selected':''}>Rack ${number}</option>`).join('')}</select></label>
 ${productGroupChoices(product)}
 </div><div id="catalog-provenance-review" tabindex="-1" hidden></div></form>`,
 `<button type="button" class="btn" data-action="close-modal">Cancelar</button><button form="product-form" type="submit" class="btn btn-primary" id="catalog-product-save">Revisar procedencia</button>`);
}
function productGroupsModal(productId){
 const product=state.products.find(item=>item.id===productId);
 if(!product)return;
 showModal(`Categoría · ${product.name}`,`<form id="product-groups-form" data-id="${esc(productId)}" class="modal-body"><div class="modal-grid">${categoryField(product)}</div></form>`,
 `<button type="button" class="btn" data-action="close-modal">Cancelar</button><button type="submit" form="product-groups-form" class="btn btn-primary">Guardar categoría</button>`);
}
function periodModal(){
 const scope=view==='weekly'?(registerEmptyScope||registerPeriodScope(activePeriod())):null;
 const start=scope?.year?scope.year+'-'+scope.month+'-01':'';
 showModal('Añadir período',`<form id="period-form" class="modal-body"><div class="modal-grid">
  <label class="field full">Nombre del período<input name="label" maxlength="70" required class="form-control" value="Semana ${state.periods.length+1}"></label>
  <label class="field">Fecha de inicio<input type="date" name="start" class="form-control" value="${esc(start)}"></label>
  <label class="field">Fecha de finalización<input type="date" name="end" class="form-control"></label>
 </div></form>`,'<button class="btn" data-action="close-modal">Cancelar</button><button type="submit" form="period-form" class="btn btn-primary">Guardar período</button>');
}
function submitProduct(form){
 const data=new FormData(form),editId=form.dataset.id;
 const identifier=key=>String(data.get(key)||'').trim().slice(0,80);
 const vesselNumber=identifier('vesselNumber'),boxNumber=identifier('boxNumber'),productNumber=identifier('productNumber');
 const quantity=String(data.get('boxes')??'').trim(),price=String(data.get('value')??'').trim();
 const catalogRack=Number(data.get('catalogRack')||0);
 const boxes=nf(quantity),value=nf(price),name=String(data.get('name')||'').trim().slice(0,110);
 const groupIds=[...new Set(data.getAll('groupIds'))],known=new Set(catalogGroups().map(group=>group.id));
 if(!name)return toast('Escribe el nombre del producto.');
 if(![0,1,2,3].includes(catalogRack)||(!editId&&!catalogRack))return toast('Selecciona el rack donde se guardará la caja.');
 if(groupIds.some(id=>!known.has(id)))return toast('Selecciona grupos válidos.');
 if(!vesselNumber||!boxNumber||!productNumber)return toast('Completa los números de embarcación, caja y producto.');
 if(!quantity||!Number.isSafeInteger(boxes)||boxes<1||boxes>1e15)return toast('Escribe una cantidad entera mayor que cero por caja.');
 if(!price||value===null||value<0||value>1e15)return toast('Escribe un precio por unidad válido.');
 const existing=editId?state.products.find(item=>item.id===editId):null;
 if(editId&&!existing)return toast('Producto no encontrado.');
 const draft={name,vesselNumber,boxNumber,productNumber,boxes,value,groupIds,catalogRack};
 const fingerprint=JSON.stringify(draft);
 const confirmation=$('#catalog-provenance-review'),submit=$('#catalog-product-save');
 if(form.dataset.provenanceReviewed!==fingerprint){
  confirmation.innerHTML=provenanceTable(name,purchaseOrigin(draft),existing?.createdAt?stamp(existing.createdAt):localSaleDate(),[
   ['Cantidad por caja',format(boxes,9)],['Precio por unidad',catalogUnitPrice(value)]
  ]);
  confirmation.hidden=false;
  form.dataset.provenanceReviewed=fingerprint;
  submit.textContent=editId?'Confirmar cambios':'Confirmar y agregar';
  confirmation.focus();
  return;
 }
 if(mutation(editId?`Producto editado: ${name}`:`Producto creado: ${name}`,()=>{
  const product=existing||{id:id('prod'),createdAt:new Date().toISOString(),category:'',unit:'unidad',quantityN:0,quantityV:0,average:0};
  Object.assign(product,{name,vesselNumber,boxNumber,productNumber,boxes,value,groupIds,catalogRack});
  if(!existing)state.products.push(product);
 }))closeModal();
}
function submitProductGroups(form){
 const product=state.products.find(item=>item.id===form.dataset.id);
 if(!product)return toast('Producto no encontrado.');
 const data=new FormData(form);
 const choice=String(data.get('category')||''),requested=String(data.get('newCategory')||'').trim().slice(0,70);
 const category=choice==='__new_category__'?(catalogCategories().find(name=>groupKey(name)===groupKey(requested))||requested):choice.slice(9);
 if(choice==='__new_category__'&&!category)return toast('Escribe el nombre de la categoría.');
 if(mutation(`Categoría actualizada: ${product.name}`,()=>{product.category=category;}))closeModal();
}
function submitPeriod(form){
 const data=new FormData(form),label=String(data.get('label')||'').trim(),start=String(data.get('start')||''),end=String(data.get('end')||'');
 if(!label){toast('Escribe un nombre para el período.');return;}
 if(start&&end&&start>end){toast('La fecha final no puede ser anterior a la inicial.');return;}
 if(mutation(`Período creado: ${label}`,()=>{
  const period={id:id('period'),label,start,end,locked:false};
  state.periods.push(period);periodId=period.id;registerEmptyScope=null;weeklyPreviewProduct='';page=0;
 }))closeModal();
}
async function removalCheckpoint(label){
 const snapshot={id:id('safety'),createdAt:new Date().toISOString(),type:'manual',label:'Copia preventiva · '+label,data:clone(state)};
 await DB.backup(snapshot);await refreshBackups();
}
function canRemoveProduct(productId){
 return !state.lots?.some(lot=>lot.productId===productId)&&!purchases().some(sale=>!sale.voided&&sale.productId===productId);
}
function reviewProductRemoval(productId){
 const product=state.products.find(item=>item.id===productId);if(!product)return;
 if(!canRemoveProduct(productId))return toast('Este producto tiene compras o lotes vinculados. Se conserva para mantener el historial.');
 showModal(`Eliminar · ${product.name}`,`<div class="modal-body">
 ${provenanceTable(product.name,purchaseOrigin(product),product.createdAt?stamp(product.createdAt):'')}
 <p>Se borrarán sus cantidades, precios y totales semanales. Se creará una copia interna preventiva.</p></div>`,
 `<button type="button" class="btn" data-action="close-modal">Cancelar</button><button type="button" class="btn btn-danger" data-action="confirm-remove-product" data-id="${esc(product.id)}">Confirmar eliminación</button>`);
 productRemovalReview={id:product.id,fingerprint:JSON.stringify(product)};
}
async function removeProduct(productId){
 const product=state.products.find(item=>item.id===productId);
 const review=productRemovalReview;
 if(!product||review?.id!==productId||review.fingerprint!==JSON.stringify(product))return;
 if(!canRemoveProduct(productId))return toast('Este producto tiene compras o lotes vinculados.');
 await removalCheckpoint('antes de eliminar producto');
 if(productRemovalReview!==review||review.fingerprint!==JSON.stringify(state.products.find(item=>item.id===productId)))return;
 if(!canRemoveProduct(productId))return toast('Este producto tiene compras o lotes vinculados.');
 if(mutation(`Producto eliminado: ${product.name}`,()=>{
  state.products=state.products.filter(item=>item.id!==productId);
  for(const period of state.periods)if(period.productIds)period.productIds=period.productIds.filter(id=>id!==productId);
  if(state.gu4?.locations)state.gu4.locations=state.gu4.locations.filter(location=>location.productId!==productId);
  for(const key of ['movements','prices','weekTotals'])for(const period of Object.values(state[key]))delete period[productId];
 }))closeModal();
}
function editValue(el){
 const type=el.dataset.edit;
 if(!type)return;
 const pId=el.dataset.product;
 const p=state.products.find(p=>p.id===pId);
 if(type==='client-name'){
  const c=state.clients.find(c=>c.id===el.dataset.id);if(!c)return;const name=el.value.trim().slice(0,90);
  if(name===c.name)return;mutation(`Espacio ${c.code} renombrado`,()=>c.name=name);return;
 }
 if(type==='product-field'){
  const field=el.dataset.field;if(!p||!['quantityN','quantityV','value','average','boxes'].includes(field))return;
  const n=nf(el.value.trim()||'0');if(n===null||Math.abs(n)>1e15){toast('Introduce un número válido.');render();return;}
  if(p[field]===n)return;mutation(`${p.name}: ${field} cambió de ${p[field]||0} a ${n}`,()=>p[field]=n);return;
 }
}
function sampleData(){
 const catalog=[
  ['Infusiones','#277453',['Té verde','Té de jazmín','Té negro','Manzanilla','Menta','Hibisco']],
  ['Bebidas','#3569a6',['Leche de almendras','Bebida de avena','Agua de coco','Jugo de mango','Jugo de maracuyá','Limonada']],
  ['Jarabes','#9e3e50',['Jarabe de lichi','Jarabe de vainilla','Jarabe de menta','Jarabe de fresa','Jarabe de caramelo','Jarabe de canela']],
  ['Ingredientes','#986015',['Avena','Cacao','Coco rallado','Semillas de chía','Harina de almendras','Azúcar morena']],
  ['Alimentos','#684997',['Galletas de avena','Granola','Almendras tostadas','Barra de cacao','Fruta deshidratada','Crackers integrales']]
 ];
 const totalProducts=catalog.reduce((total,[,,names])=>total+names.length,0);
 const fresh=!state.products.length;
 if(!fresh&&!confirm(`Se agregarán ${totalProducts} productos de prueba y sus registros. ¿Continuar?`))return;
 const today=localSaleDate(),createdAt=new Date().toISOString();
 const dateBefore=days=>{
  const date=new Date(today+'T00:00:00Z');
  date.setUTCDate(date.getUTCDate()-days);
  return date.toISOString().slice(0,10);
 };
 if(mutation(`Demostración cargada: ${totalProducts} productos ficticios`,()=>{
  const clients=state.clients.filter(client=>client.id.startsWith('demo-client-')&&client.active!==false).slice(0,6);
  while(clients.length<6){
   const client={id:id('demo-client'),code:'A-'+(state.clients.length+1),name:'Cliente de prueba '+(clients.length+1),active:true};
   state.clients.push(client);clients.push(client);
  }
  const currency=state.settings.currency||'COP',priceStep=currency==='COP'?1000:1;
  const batch=id('demo').slice(-12).toUpperCase(),newPeriods=[],periods=[];
  const datedPeriods=state.periods.filter(period=>calendarDate(period.start)&&calendarDate(period.end)&&period.start<=period.end);
  for(let daysBack=0;periods.length<8;daysBack+=7){
   const start=dateBefore(daysBack+6),end=dateBefore(daysBack);
   const existing=state.periods.find(period=>period.id.startsWith('demo-period-')&&!period.locked&&period.start===start&&period.end===end);
   if(existing){periods.push(existing);continue;}
   const overlap=datedPeriods.find(period=>period.start<=end&&period.end>=start);
   if(overlap){
    daysBack=Math.round((Date.parse(today)-Date.parse(overlap.start))/86400000)-6;
    continue;
   }
   const period={id:id('demo-period'),label:`Prueba · ${start}`,start,end,locked:false};
   newPeriods.push(period);periods.push(period);
  }
  if(fresh)state.periods.unshift(...newPeriods);else state.periods.push(...newPeriods);
  const demoProducts=[],groups=state.catalogGroups??=[],origins=state.weeklyOrigins??={};
  for(const [category,color,names] of catalog){
   const name='Prueba · '+category;
   let group=groups.find(item=>!item.deleted&&groupKey(item.name)===groupKey(name));
   if(!group){group={id:id('demo-group'),name,color};groups.push(group);}
   for(const name of names){
    const index=demoProducts.length,code=batch+'-'+String(index+1).padStart(2,'0');
    const product={
     id:id('demo-product'),name:'Prueba · '+name,category,unit:'unidad',groupIds:[group.id],
     productNumber:'PR-'+code,boxNumber:'CJ-'+code,vesselNumber:'EMB-'+batch+'-'+(1+index%3),
     catalogRack:1+index%3,boxes:index===0?12:240+10*(index%5),
     value:(8+index)*priceStep,average:5+index%10,quantityN:0,quantityV:0,createdAt
    };
    demoProducts.push(product);
    if(index===totalProducts-1)continue;
    const origin=purchaseOrigin(product);
    let registered=0;
    periods.forEach((period,weekIndex)=>{
     const cells={};
     clients.forEach((client,clientIndex)=>{
      const units=(index*3+weekIndex*2+clientIndex*4)%9;
      if(!units)return;
      cells[client.id]=units;
      origins[Trace.weeklyKey(period.id,product.id,client.id)]={
       periodId:period.id,productId:product.id,clientId:client.id,productName:product.name,clientName:salesClientLabel(client),
       date:period.start,updatedAt:createdAt,origin,price:product.value,currency,deleted:false
      };
     });
     const units=Object.values(cells).reduce((total,qty)=>total+qty,0);
     registered+=units;
     (state.movements[period.id]??={})[product.id]=cells;
     (state.prices[period.id]??={})[product.id]=product.value;
     (state.weekTotals[period.id]??={})[product.id]=units*product.value;
    });
    product.quantityN=index===1?registered+5:index===2?registered:index%5;
    product.quantityV=index<3?0:index%3;
   }
  }
  state.products.push(...demoProducts);
  const lots=demoProducts.slice(0,3).map((product,i)=>{
   const receipt={date:dateBefore(8),area:'Bodega de prueba',rack:product.catalogRack,level:1,position:i+1};
   const lot={
    id:id('demo-lot'),productId:product.id,productName:product.name,code:product.boxNumber,
    container:'CONT-'+batch,units:10,receipt,moves:[]
   };
   (state.lots??=[]).push(lot);
   const client=clients[i];
   (state.sales??=[]).push({
    id:id('demo-sale'),date:dateBefore(6-i*3),productId:product.id,productName:product.name,
    clientId:client.id,clientName:salesClientLabel(client),lotId:lot.id,units:i===2?4:10,price:product.value,currency,
    location:Trace.label(receipt),reference:'Venta de prueba',
    origin:{...purchaseOrigin(product),lotCode:lot.code,container:lot.container,catalogLot:false},voided:false
   });
   return lot;
  });
  periodId=periods[0].id;registerEmptyScope=null;weeklyPreviewProduct='';page=0;
  if(fresh){
   Object.assign(salesFilters,{product:demoProducts[0].id,firstClient:clients[0].id,secondClient:clients[1].id});
   speedQuery={a:lots[0].id,b:lots[1].id};
  }
 }))toast(`Se agregaron ${totalProducts} productos de prueba con registros de compras y lotes.`);
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
function normalizePlace(input){
 const area=String(input?.area??'').trim().slice(0,120),rack=Number(input?.rack);
 const level=rack?Number(input?.level):0,position=rack?Number(input?.position):0;
 if(!calendarDate(input?.date)||!area||![0,1,2,3].includes(rack)||(rack&&(![1,2].includes(level)||!Number.isInteger(position)||position<1||position>8)))throw new Error('Revisa la fecha, el lugar y la posición.');
 return {date:input.date,area,rack,level,position,at:typeof input.at==='string'&&Number.isFinite(Date.parse(input.at))?new Date(input.at).toISOString():''};
}
function normalizePurchaseOrigin(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return undefined;
 const text=(value,length)=>String(value??'').slice(0,length);
 return {
  productNumber:text(raw.productNumber,80),boxNumber:text(raw.boxNumber,80),vesselNumber:text(raw.vesselNumber,80),
  lotCode:text(raw.lotCode,80),container:text(raw.container,80),rack:text(raw.rack,80),catalogLot:raw.catalogLot===true,
  groups:Array.isArray(raw.groups)?raw.groups.filter(group=>group&&typeof group.name==='string'&&typeof group.color==='string'&&/^#[0-9a-f]{6}$/i.test(group.color)).map(group=>({name:text(group.name,50),color:group.color})):[]
 };
}
function normalizeImported(raw){
 if(!raw||typeof raw!=='object'||!Array.isArray(raw.products)||!Array.isArray(raw.clients)||!Array.isArray(raw.periods))throw new Error('Este archivo no contiene un respaldo compatible de Inventarios GU.');
 if(raw.products.length>10000||raw.clients.length>10000||raw.periods.length>500||!raw.periods.length||!raw.clients.length)throw new Error('El respaldo tiene un tamaño o estructura no admitidos.');
 const makeUnique=(array,entity,normalize)=>{const seen=new Set();return array.map(v=>{if(!v||typeof v!=='object'||!safeid(v.id)||seen.has(v.id))throw new Error(`${entity}: identificador inválido o duplicado.`);seen.add(v.id);return normalize(v);});};
 const string=(v,max=130)=>String(v??'').slice(0,max);
 const decimal=v=>{const n=nf(v??0);if(n===null||Math.abs(n)>1e15)throw new Error('Respaldo con cantidades no numéricas o fuera de rango.');return n;};
 const catalogTags=makeUnique(Array.isArray(raw.catalogTags)?raw.catalogTags:[],'Etiqueta',tag=>{
  const name=string(tag.name,50).trim(),color=string(tag.color,7);
  if(!name||!/^#[0-9a-f]{6}$/i.test(color))throw new Error('Etiqueta de producto no válida.');
  return {id:tag.id,name,color};
 });
 const catalogGroups=makeUnique(Array.isArray(raw.catalogGroups)?raw.catalogGroups:[],'Grupo',group=>{
  const name=string(group.name,50).trim(),color=string(group.color,7);
  if(!name||!/^#[0-9a-f]{6}$/i.test(color))throw new Error('Grupo de productos no válido.');
  return {id:group.id,name,color,deleted:group.deleted===true,aliases:Array.isArray(group.aliases)?group.aliases.filter(id=>typeof id==='string'&&safeid(id)):[]};
 });
 const products=makeUnique(raw.products,'Producto',p=>({id:p.id,name:string(p.name,110),category:string(p.category,70),groupIds:Array.isArray(p.groupIds)?p.groupIds.filter(id=>typeof id==='string'&&safeid(id)):undefined,groupId:p.groupId===undefined?undefined:(typeof p.groupId==='string'&&safeid(p.groupId)?p.groupId:''),catalogRack:p.catalogRack===undefined?undefined:([1,2,3].includes(Number(p.catalogRack))?Number(p.catalogRack):0),vesselNumber:string(p.vesselNumber,80).trim(),boxNumber:string(p.boxNumber,80).trim(),productNumber:string(p.productNumber,80).trim(),tagIds:Array.isArray(p.tagIds)?p.tagIds.filter(safeid):[],unit:string(p.unit,30)||'unidad',quantityN:decimal(p.quantityN),quantityV:decimal(p.quantityV),value:decimal(p.value),average:decimal(p.average),boxes:decimal(p.boxes),createdAt:string(p.createdAt,40)}));
 const clients=makeUnique(raw.clients,'Cliente',c=>({id:c.id,code:string(c.code,35)||c.id,name:string(c.name,90),active:c.active!==false}));
 const periods=makeUnique(raw.periods,'Período',p=>({id:p.id,label:string(p.label,70)||'Período',start:/^\d{4}-\d{2}-\d{2}$/.test(p.start)?p.start:'',end:/^\d{4}-\d{2}-\d{2}$/.test(p.end)?p.end:'',locked:!!p.locked,productIds:Array.isArray(p.productIds)?[...new Set(p.productIds.filter(id=>typeof id==='string'&&safeid(id)))]:undefined}));
 const periodIDs=new Set(periods.map(p=>p.id)),productIDs=new Set(products.map(p=>p.id)),clientIDs=new Set(clients.map(c=>c.id));
 for(const period of periods)if(period.productIds)period.productIds=period.productIds.filter(id=>productIDs.has(id));
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
 const clean={version:1,createdAt:string(raw.createdAt,40)||new Date().toISOString(),updatedAt:new Date().toISOString(),settings:{palette,mode,currency,pageSize,density:['compact','comfortable'].includes(settings.density)?settings.density:'comfortable',lastAutoBackup:0},products,clients,periods,catalogTags,catalogGroups,movements:normalizeMatrix(raw.movements,true),prices:normalizeMatrix(raw.prices,false),weekTotals:normalizeMatrix(raw.weekTotals,false),audit};
 if(raw.sales!==undefined&&(!Array.isArray(raw.sales)||raw.sales.length>500000))throw new Error('Registro de ventas no válido.');
 if(raw.lots!==undefined&&(!Array.isArray(raw.lots)||raw.lots.length>100000))throw new Error('Registro de lotes no válido.');
 clean.lots=makeUnique(raw.lots||[],'Lote',lot=>{
  const code=string(lot.code,80).trim(),container=string(lot.container,80).trim(),units=decimal(lot.units);
  if(typeof lot.productId!=='string'||!safeid(lot.productId)||!code||!container||units<0.000001||units>1e12||!Array.isArray(lot.moves)||lot.moves.length>10000)throw new Error('Lote con datos de recepción no válidos.');
  const receipt=normalizePlace(lot.receipt),moves=lot.moves.map(normalizePlace);
  if(moves.some((place,i)=>place.date<(moves[i-1]||receipt).date))throw new Error('Los traslados deben estar en orden cronológico.');
  return {id:lot.id,productId:lot.productId,productName:string(lot.productName,110),code,container,units,receipt,moves};
 });
 clean.sales=makeUnique(raw.sales||[],'Venta',sale=>{
  const units=decimal(sale.units);
  if(typeof sale.productId!=='string'||typeof sale.clientId!=='string'||!safeid(sale.productId)||!safeid(sale.clientId)||!calendarDate(sale.date)||sale.date<'0001-02-01'||units<0.000001||units>1e12)throw new Error('Venta con fecha o cantidad no válida.');
  const price=sale.price==null?null:decimal(sale.price);
  const lotId=sale.lotId??'';
  if((lotId&&(typeof lotId!=='string'||!safeid(lotId)))||(price!==null&&(price<0||price>1e12)))throw new Error('Una venta tiene precio o lote no válido.');
  const origin=normalizePurchaseOrigin(sale.origin);
  return {id:sale.id,date:sale.date,productId:sale.productId,productName:string(sale.productName,110),clientId:sale.clientId,clientName:string(sale.clientName,130),units,lotId,location:string(sale.location,220),price,currency:['COP','USD','EUR','MXN','CNY'].includes(sale.currency)?sale.currency:'COP',reference:string(sale.reference,120),origin,voided:sale.voided===true};
 });
 clean.weeklyOrigins={};
 const savedOrigins=raw.weeklyOrigins;
 if(savedOrigins!==undefined&&(!savedOrigins||typeof savedOrigins!=='object'||Array.isArray(savedOrigins)))throw new Error('Procedencia semanal no válida.');
 let originCount=0;
 for(const entry of Object.values(savedOrigins||{})){
  if(++originCount>500000)throw new Error('Demasiados registros de procedencia semanal.');
  if(!entry||!periodIDs.has(entry.periodId)||!productIDs.has(entry.productId)||!clientIDs.has(entry.clientId)||!calendarDate(entry.date))continue;
  const {periodId,productId,clientId}=entry;
  const key=Trace.weeklyKey(periodId,productId,clientId);
  if(clean.weeklyOrigins[key])throw new Error('Procedencia semanal duplicada.');
  const deleted=entry.deleted===true,dates=Date.parse(entry.updatedAt);
  if(deleted&&clean.movements[periodId]?.[productId])delete clean.movements[periodId][productId][clientId];
  clean.weeklyOrigins[key]={
   periodId,productId,clientId,deleted,date:entry.date,updatedAt:Number.isFinite(dates)?new Date(dates).toISOString():entry.date+'T00:00:00.000Z',
   productName:string(entry.productName,110),clientName:string(entry.clientName,130),origin:normalizePurchaseOrigin(entry.origin),
   price:entry.price==null?null:decimal(entry.price),currency:['COP','USD','EUR','MXN','CNY'].includes(entry.currency)?entry.currency:'COP'
  };
 }
 reconcileCatalogGroups(clean);
 Trace?.validate(clean);
 clean.gu4=GU4?.normalizeGu4(raw.gu4,clean)||newState().gu4;return clean;
}
function mergeStates(local,remote){
 const mergeList=(a,b)=>{const byId=new Map(a.map(v=>[v.id,v]));for(const value of b)byId.set(value.id,value);return [...byId.values()];};
 const out=clone(local);
 const localProducts=new Map(local.products.map(product=>[product.id,product]));
 out.products=mergeList(local.products,remote.products).map(product=>{
  const prior=localProducts.get(product.id);
  if(!prior)return product;
  return {...product,groupIds:product.groupIds??prior.groupIds,catalogRack:product.catalogRack??prior.catalogRack,vesselNumber:product.vesselNumber||prior.vesselNumber||'',boxNumber:product.boxNumber||prior.boxNumber||'',productNumber:product.productNumber||prior.productNumber||''};
 });
 out.clients=mergeList(local.clients,remote.clients);
 const localPeriods=new Map(local.periods.map(period=>[period.id,period]));
 out.periods=mergeList(local.periods,remote.periods).map(period=>{
  const prior=localPeriods.get(period.id);
  if(!prior?.productIds&&!period.productIds)return period;
  return {...period,productIds:[...new Set([...(prior?.productIds||[]),...(period.productIds||[])])]};
 });
 const groupsById=new Map((local.catalogGroups||[]).map(group=>[group.id,group]));
 for(const group of remote.catalogGroups||[]){
  const previous=groupsById.get(group.id);
  groupsById.set(group.id,{...group,deleted:group.deleted||previous?.deleted||false,aliases:[...new Set([...(previous?.aliases||[]),...(group.aliases||[])])]});
 }
 out.catalogGroups=[...groupsById.values()];
 reconcileCatalogGroups(out);
 for(const root of ['movements','prices','weekTotals']){
  for(const [wid,records] of Object.entries(remote[root])){
   if(!out[root][wid])out[root][wid]={};
   for(const [pid,value] of Object.entries(records)){
    if(root==='movements')out[root][wid][pid]={...(out[root][wid][pid]||{}),...value};
    else out[root][wid][pid]=value;
   }
  }
 }
 const weeklyOrigins=new Map(Object.entries(local.weeklyOrigins||{}).map(([key,entry])=>[key,{entry,source:local}]));
 for(const [key,entry] of Object.entries(remote.weeklyOrigins||{})){
  if(!weeklyOrigins.has(key)||entry.updatedAt>=weeklyOrigins.get(key).entry.updatedAt)weeklyOrigins.set(key,{entry,source:remote});
 }
 out.weeklyOrigins={};
 for(const [key,{entry,source}] of weeklyOrigins){
  const {periodId,productId,clientId}=entry;
  const units=source.movements[periodId]?.[productId]?.[clientId];
  if(entry.deleted||!(units>0)){
   if(out.movements[periodId]?.[productId])delete out.movements[periodId][productId][clientId];
  }else{
   const products=(out.movements[periodId]??={});
   (products[productId]??={})[clientId]=units;
  }
  out.weeklyOrigins[key]=entry;
 }
 const salesById=new Map((local.sales||[]).map(sale=>[sale.id,sale]));
 for(const sale of remote.sales||[]){
  const matching=salesById.get(sale.id);
  salesById.set(sale.id,{...sale,origin:sale.origin??matching?.origin,voided:sale.voided||matching?.voided||false});
 }
 out.sales=[...salesById.values()];
 const lotsById=new Map((local.lots||[]).map(lot=>[lot.id,lot]));
 for(const lot of remote.lots||[]){
  const previous=lotsById.get(lot.id);
  if(!previous){lotsById.set(lot.id,lot);continue;}
  if(Trace.lotKey(previous)!==Trace.lotKey(lot)||previous.units!==lot.units||JSON.stringify(previous.receipt)!==JSON.stringify(lot.receipt))throw new Error('El respaldo contiene cambios incompatibles en la recepción de un lote.');
  const unique=new Map([...previous.moves,...lot.moves].map(place=>[JSON.stringify(place),place]));
  lotsById.set(lot.id,{...lot,moves:[...unique.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.at.localeCompare(b.at))});
 }
 out.lots=[...lotsById.values()];
 Trace?.validate(out);
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
  const merged=mode==='merge'?mergeStates(state,incoming):incoming;
  undoStack.push(clone(state));state=merged;
  state.updatedAt=new Date().toISOString();state.audit.unshift({id:id('evt'),label:`Migración ${mode==='merge'?'fusionada':'restaurada'} desde JSON`,actor:'Este dispositivo',at:state.updatedAt});
  periodId=state.periods[0].id;registerEmptyScope=null;page=0;query='';pendingImport=null;closeModal();scheduleSave();await refreshBackups();navigate('dashboard');toast('Migración realizada. Los datos se han recuperado.');
 }catch(e){toast('No se pudo completar la migración: '+e.message);}
}
async function makeSnapshot(){try{const entry={id:id('snapshot'),createdAt:new Date().toISOString(),type:'manual',label:'Copia manual',data:clone(state)};await DB.backup(entry);await refreshBackups();render();toast(DB.mode?.()==='memory'?'Copia temporal creada. Descarga un JSON antes de cerrar la vista previa.':'Copia interna creada. Descárgala si quieres protegerla fuera del navegador.');}catch(e){toast('No se pudo crear la copia: '+e.message);}}
async function restoreSnapshot(snapshotId){
 if(storageConflict){toast('Recarga antes de restaurar: otra pestaña ha cambiado los datos.');return;}
 const entry=backupsCache.find(b=>b.id===snapshotId);if(!entry)return;
 if(!confirm(`¿Restaurar la copia de ${stamp(entry.createdAt)}? Se reemplazarán los datos actuales. Se guardará una copia previa.`))return;
 try{await DB.backup({id:id('before'),createdAt:new Date().toISOString(),type:'manual',label:'Antes de restaurar',data:clone(state)});
  const recovered=normalizeImported(entry.data);undoStack.push(clone(state));state=recovered;state.updatedAt=new Date().toISOString();state.audit.unshift({id:id('evt'),at:state.updatedAt,actor:'Este dispositivo',label:'Copia interna restaurada'});
  periodId=state.periods[0].id;registerEmptyScope=null;page=0;query='';scheduleSave();await refreshBackups();navigate('dashboard');toast('Se restauraron productos, movimientos y configuración.');
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
const searchTargets=[['dashboard','Panel general'],['weekly','Registro'],['final','Consolidado'],['products','Productos'],['clients','Clientes / espacios'],['audit','Historial'],['backup','Copias y migración'],['settings','Configuración'],['sales','Comparar ventas']];
function closePalette(){const dialog=$('#command-palette');if(dialog)dialog.hidden=true;}
function paletteOptions(){
 const input=$('#palette-input');if(!input||!state)return;
 const q=input.value.trim().toLocaleLowerCase('es');
 const menu=searchTargets.filter(x=>x[1].toLocaleLowerCase('es').includes(q)).slice(0,8);
 const products=state.products.filter(p=>`${p.name} ${p.category||''} ${p.productNumber||''} ${p.vesselNumber||''} ${p.boxNumber||''}`.toLocaleLowerCase('es').includes(q)).slice(0,12);
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
 const trigger=e.target.closest('[data-dashboard-menu]');
 if(trigger){openDashboardMenu(trigger);return;}
 const button=e.target.closest('[data-dashboard-export]');
 if(!button||view!=='dashboard')return;
 if(button.dataset.dashboardExport==='png')exportDashboardImage(button);
 else exportDashboardCSV();
});
document.addEventListener('click',e=>{const b=e.target.closest('[data-final-filter]');if(!b)return;finalFilter=b.dataset.finalFilter;page=0;render();});
document.addEventListener('click',e=>{const b=e.target.closest('[data-client-filter]');if(!b)return;clientFilter=b.dataset.clientFilter;render();});
document.addEventListener('click',e=>{const b=e.target.closest('[data-density-change]');if(!b||!state)return;const v=b.dataset.densityChange;if(!['comfortable','compact'].includes(v)||v===state.settings.density)return;mutation('Densidad de interfaz: '+v,()=>state.settings.density=v);});
document.addEventListener('click',e=>{const btn=e.target.closest('[data-metric-toggle]');if(!btn)return;const panel=btn.closest('.metric-panel');if(!panel)return;const collapsed=!panel.classList.contains('metric-collapsed');const prefs=metricPrefs();prefs[btn.dataset.metricToggle]=collapsed;try{localStorage.setItem(metricVisibilityKey,JSON.stringify(prefs))}catch{}window.GUFeedback?.play(collapsed?'close':'tap');render();});
document.addEventListener('click',async e=>{
 const cover=e.target.closest('[data-modal-cover]');if(cover && e.target===cover){closeModal();if(passwordResolve){passwordResolve(null);passwordResolve=null;}return;}
 const nav=e.target.closest('[data-nav]');if(nav){navigate(nav.dataset.nav);return;}
 const pg=e.target.closest('[data-page]');if(pg){page=Math.max(0,page+(pg.dataset.page==='next'?1:-1));render();return;}
 const palette=e.target.closest('[data-palette-change]');if(palette){if(state.settings.palette!==palette.dataset.paletteChange)mutation('Cambio de paleta visual',()=>state.settings.palette=palette.dataset.paletteChange);return;}
 const mode=e.target.closest('[data-mode-change]');if(mode){if(state.settings.mode!==mode.dataset.modeChange)mutation('Cambio de luminosidad',()=>state.settings.mode=mode.dataset.modeChange);return;}
 const btn=e.target.closest('[data-action]');if(!btn)return;
 const action=btn.dataset.action,targetId=btn.dataset.id;
 try{switch(action){
  case 'close-modal':closeModal();if(passwordResolve){passwordResolve(null);passwordResolve=null;}break;
  case 'weekly-client-picker':openWeeklyClientPicker();break;
  case 'toggle-period-lock':toggleRegisterLock();break;
  case 'weekly-download':openWeeklyDownload();break;
  case 'weekly-image':await exportWeeklyImage(targetId==='full');break;
  case 'weekly-cell':weeklyCellModal(btn.dataset.period,btn.dataset.client,targetId);break;
  case 'weekly-catalog':closeModal();navigate('products');break;
  case 'new-product':productModal();break;
  case 'client-trace':clientTrace(targetId);break;
  case 'unit-report':openUnitReport(targetId||'sales');break;
  case 'inventory-download':openInventoryDownload(targetId);break;
  case 'inventory-excel':btn.disabled=true;try{await exportInventoryExcel();if(btn.isConnected)closeModal();}finally{btn.disabled=false;}break;
  case 'inventory-image':{
   const chart=$(`#unit-report-preview-${targetId}`);
   closeModal();
   const names={sales:'Unidades',stock:'Stock',value:'Valor'};
   await exportDashboardImage(btn,chart,filename('Inventarios_GU_'+names[targetId],'png'));
   break;
  }
  case 'void-sale':voidSale(targetId);break;
  case 'product-groups':productGroupsModal(targetId);break;
  case 'catalog-groups':catalogGroupEditor();break;
  case 'remove-catalog-group':removeCatalogGroup(targetId);break;
  case 'edit-product':productModal(targetId);break;
  case 'remove-product':reviewProductRemoval(targetId);break;
  case 'confirm-remove-product':await removeProduct(targetId);break;
  case 'new-period':periodModal();break;
  case 'clients':navigate('clients');break;
  case 'add-client':{const count=state.clients.length+1;mutation(`Espacio A-${count} creado`,()=>state.clients.push({id:id('client'),code:'A-'+count,name:'',active:true}));toast('Nuevo espacio A-'+count+' disponible en todas las semanas.');break;}
  case 'jump-week':{
   weeklyPreviewProduct=targetId;periodId=btn.dataset.period||state.periods[0].id;registerEmptyScope=null;query='';
   const ids=weeklyProductIds(activePeriod());
   const position=state.products.filter(product=>ids.has(product.id)||product.id===targetId).findIndex(product=>product.id===targetId);
   page=Math.floor(Math.max(0,position)/(state.settings.pageSize||20));
   view='weekly';render();break;
  }
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
  case 'install-app':window.GUInstall?.open();break;
  case 'global-search':openPalette();break;
  case 'csv-final':csvFinal();break;
  case 'csv-movements':csvMovements();break;
  case 'reload':location.reload();break;
  case 'reset':{
    if(storageConflict){toast('Recarga antes de restablecer.');return;}
    if(!confirm('¿Borrar TODOS los datos de este espacio? Se guardará primero una copia interna, pero es recomendable descargar un JSON.'))return;
    if(!confirm('Última confirmación: ¿restablecer la aplicación a cero?'))return;
    await DB.backup({id:id('before-reset'),createdAt:new Date().toISOString(),type:'manual',label:'Antes de restablecer',data:clone(state)});
    undoStack.push(clone(state));state=newState();periodId='w1';registerEmptyScope=null;page=0;query='';clientQuery='';await refreshBackups();scheduleSave();navigate('dashboard');toast('Espacio restablecido. Tu copia previa permanece en Copias.');break;
  }
 }}catch(err){toast('No se pudo completar la acción: '+err.message);}
});
document.addEventListener('submit',e=>{
 const form=e.target;if(form.id==='product-groups-form'){e.preventDefault();submitProductGroups(form);return;}
 if(form.id==='catalog-group-form'){e.preventDefault();saveCatalogGroup(form);return;}
 if(form.id==='weekly-cell-form'){e.preventDefault();saveWeeklyCell(form);return;}
 if(['sales-filters','sales-speed'].includes(form.id)){e.preventDefault();submitSales(form);return;}
 if(!['product-form','period-form','password-form'].includes(form.id))return;e.preventDefault();
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
 if(el.id==='catalog-category'||el.id==='catalog-group'){
  if(el.id==='catalog-category')catalogCategory=el.value;else catalogGroup=el.value;
  page=0;render();document.getElementById(el.id)?.focus();return;
 }
 if(el.id==='catalog-group-edit'){catalogGroupEditor(el.value);return;}
 if(el.form?.id==='product-groups-form'&&el.name==='category'){
  const field=$('#new-category-field'),input=el.form.elements.newCategory;
  field.hidden=el.value!=='__new_category__';input.disabled=field.hidden;input.required=!field.hidden;
  if(!field.hidden)input.focus();return;
 }
 if(el.matches('[data-edit]')){editValue(el);return;}
 if(['register-week','register-month','register-year'].includes(el.id)){
  changeRegisterFilter(el.id,el.value);document.getElementById(el.id)?.focus();return;
 }
 if(el.id==='register-start'||el.id==='register-end'){
  updateRegisterDate(el.id==='register-start'?'start':'end',el.value);
  document.getElementById(el.id)?.focus();return;
 }
 if(el.id==='weekly-client-choice'){
  if(el.value)weeklyCellModal(el.dataset.period,el.value);
  return;
 }
   if(el.id==='product-sort'){productSort=el.value;page=0;render();return;}
   if(el.id==='audit-window'){auditWindow=el.value;render();return;}
 if(el.id==='setting-currency'){const currency=el.value;if(['COP','USD','EUR','MXN','CNY'].includes(currency))mutation('Moneda cambiada a '+currency,()=>state.settings.currency=currency);return;}
 if(el.id==='setting-pagesize'){const count=Number(el.value);if([10,20,40,80].includes(count))mutation('Tamaño de página cambiado',()=>{state.settings.pageSize=count;page=0;});return;}
});
document.addEventListener('input',e=>{
 const el=e.target;
 if(el.form?.id==='product-form'&&el.form.dataset.provenanceReviewed){
  delete el.form.dataset.provenanceReviewed;
  $('#catalog-provenance-review').hidden=true;
  $('#catalog-product-save').textContent='Revisar procedencia';
 }
 if(el.id==='product-search'){const pos=el.selectionStart;query=el.value;page=0;render();const next=$('#product-search');if(next){next.focus();try{next.setSelectionRange(pos,pos);}catch{}}}
 if(el.id==='client-search'){const pos=el.selectionStart;clientQuery=el.value;render();const next=$('#client-search');if(next){next.focus();try{next.setSelectionRange(pos,pos);}catch{}}}
 if(el.id==='audit-search'){const pos=el.selectionStart;auditQuery=el.value;render();const next=$('#audit-search');if(next){next.focus();try{next.setSelectionRange(pos,pos);}catch{}}}
});
document.addEventListener('keydown',e=>{
 if(document.getElementById('dashboard-menu')?.open)return;
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
async function init(){
 try{
  const loaded=await DB.load();
  state=loaded||newState();
  if(!Array.isArray(state.products)||!Array.isArray(state.clients)||!Array.isArray(state.periods)||!state.periods.length)throw new Error('Los datos locales parecen dañados. Restaura una copia de seguridad.');
  if(!state.weekTotals)state.weekTotals={};if(!state.prices)state.prices={};if(!state.movements)state.movements={};if(!state.audit)state.audit=[];
  if(!state.settings)state.settings=newState().settings;
  const migrateGroups=!!state.catalogTags||state.products.some(p=>p.groupId!==undefined||p.tagIds!==undefined);
  if(migrateGroups)reconcileCatalogGroups(state);
  if(loaded&&!loaded.gu4){await DB.backup({id:id('before4'),createdAt:new Date().toISOString(),type:'manual',label:'Copia antes de migrar a 4.0',data:clone(loaded)});}
 GU4?.ensure(state);
 if(!loaded||!loaded.gu4||migrateGroups)await DB.save(state);
  periodId=state.periods[0].id;
  await refreshBackups();render();savedStatus();
  if(typeof CustomEvent!=='undefined'){
   const view=Trace?.warehouse(state);
   window.dispatchEvent(new CustomEvent('gu:app-ready',{detail:{ok:true,products:state.products.length,racks:view?.totals||[0,0,0],positions:view?.positions||[[],[],[]],capacityAlarm:!!$('#main-content').querySelector('#capacity-alert-title')}}));
  }

  if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
 }catch(error){
  $('#main-content').innerHTML=`<div class="card card-pad"><h1>No se pudo abrir el espacio de datos</h1><p>${esc(error.message)}</p><p>Si existe un respaldo JSON, conserva ese archivo. Abre la aplicación desde HTTPS o localhost para recuperar los datos del navegador cuando estén disponibles.</p></div>`;
  indicator('Almacenamiento no disponible','error');
  typeof CustomEvent!=='undefined'&&window.dispatchEvent(new CustomEvent('gu:app-ready',{detail:{ok:false}}));
 }
}
init();
})();
