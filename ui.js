/* Inventarios GU 3.1 — ayuda contextual accesible, sin dependencias. */
(function(){'use strict';
const INTRO={
 'Bodega virtual':'Los racks distribuyen los productos visualmente. El número indica unidades de saldo positivo; se dibujan hasta 16 cajas por rack y no representan ubicaciones físicas reales. Arrastra para girar, usa zoom y selecciona un rack.',
 'Centro de revisión':'Detecta saldos negativos, saldos cero, parámetros de cajas y promedio pendientes y productos sin movimientos. Las observaciones nunca modifican los datos. Filtra y descarga el CSV para analizar todos los casos.',
 'Proyección de movimiento':'Proyección lineal del volumen registrado por día, basada exclusivamente en períodos con fechas válidas. Semana: 7 días; mes: 30; año: 365. No es pronóstico de ventas ni de stock disponible.',
 'Comparativa de períodos':'Compara los dos períodos finales en el orden del registro. La variación es descriptiva y no representa ganancias ni demanda futura.',
 'Movimiento por semana':'Suma de movimientos registrados por período, incluidos espacios no visibles en la tabla semanal.',
 'Productos con mayor registro':'Se muestran los seis productos con mayor magnitud de movimientos acumulados.',
 'Vista rápida del inventario':'Resumen de las referencias con más movimientos. Abre el producto para revisar sus parámetros.',
 'Actividad reciente':'Últimas acciones guardadas en el historial local; no es una auditoría inalterable de múltiples usuarios.',
 'Copias guardadas en este equipo':'Los respaldos internos quedan en este navegador y pueden desaparecer si se borran los datos locales. Descarga periódicamente un JSON externo.',
 'Copias temporales de esta sesión':'Este entorno no asegura conservación. Descarga un JSON externo antes de cerrar.',
 'Paletas de color':'Ajusta los colores sin modificar productos, movimientos ni importes.',
 'Preferencias de trabajo':'Moneda, paginación y densidad de interfaz se guardan junto a tus ajustes.',
 'Aplicación para PC, Android y iPhone':'PWA instalable desde HTTPS; las descargas HTML funcionan de manera autónoma, pero el guardado local puede variar por navegador.'
};
function help(text,title='Información'){
 const b=document.createElement('button'); b.type='button';b.className='gu-info';b.textContent='i';b.dataset.guHelp=String(text||'');b.dataset.guTitle=title;
 b.setAttribute('aria-label',`Información: ${title}`); b.title=`Información sobre ${title}`;return b;
}
function attach(h,details,title){if(!h||!details)return;const b=help(details,title||h.textContent.trim());h.insertAdjacentElement('afterend',b);}
function enhance(root=document){
 root.querySelectorAll('.page-heading').forEach(box=>{const h=box.querySelector('h1'),p=box.querySelector(':scope > div > p');if(h&&p){attach(h,p.textContent);p.remove();}});
 root.querySelectorAll('.card-title').forEach(box=>{const h=box.querySelector('h3,h2');if(!h)return;const p=box.querySelector('p');const title=h.textContent.trim();const desc=[p?.textContent.trim(),INTRO[title]].filter(Boolean).join(' ');if(desc)attach(h,desc,title);p?.remove();});
 root.querySelectorAll('.stat-card').forEach(card=>{const lbl=card.querySelector('.stat-label'),foot=card.querySelector('.stat-foot');if(lbl&&foot){attach(lbl,foot.textContent,lbl.textContent);foot.remove();}});
 root.querySelectorAll('.backup-action').forEach(card=>{const h=card.querySelector('h3'),p=card.querySelector('p');if(h&&p){attach(h,p.textContent);p.remove();}});
 root.querySelectorAll('.warehouse-heading h2').forEach(h=>attach(h,INTRO['Bodega virtual'],'Bodega virtual'));
 root.querySelectorAll('.table-hint, .help-note').forEach(p=>{if(p.closest('.modal,.storage-alert,.danger-zone'))return; const b=help(p.textContent,'Detalles de esta sección');p.replaceWith(b);b.classList.add('gu-info-inline');});
 root.querySelectorAll('.forecast-note, .trend-card .review-foot').forEach(p=>{const h=p.closest('.card')?.querySelector('.card-title h3');if(h){const b=h.nextElementSibling;if(b?.classList.contains('gu-info'))b.dataset.guHelp+=' '+p.textContent;else attach(h,p.textContent);p.remove();}});
 root.querySelectorAll('.client-cell label span.muted').forEach(el=>{el.remove();});
 root.querySelectorAll('.banner:not(.alert):not(.storage-alert) p').forEach(p=>{const h=p.closest('.banner')?.querySelector('h3');if(h){attach(h,p.textContent);p.remove();}});
}
let dialog,previousFocus;
function openInfo(title,detail){
 if(!dialog){dialog=document.createElement('dialog');dialog.id='gu-help-dialog';dialog.className='gu-help-dialog';dialog.innerHTML='<div class="gu-help-head"><strong></strong><button type="button" class="gu-help-close" aria-label="Cerrar información">×</button></div><p></p><div class="gu-help-actions"><button type="button" class="btn btn-primary">Entendido</button></div>';document.body.append(dialog);
 dialog.querySelector('.gu-help-close').addEventListener('click',()=>dialog.close());dialog.querySelector('.gu-help-actions button').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>previousFocus?.focus?.());dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});}
 previousFocus=document.activeElement;dialog.querySelector('.gu-help-head strong').textContent=title;dialog.querySelector('p').textContent=detail;
 if(typeof dialog.showModal==='function')dialog.showModal();else alert(title+'\n\n'+detail);
}
document.addEventListener('click',event=>{const b=event.target.closest('[data-gu-help]');if(!b)return;event.preventDefault();openInfo(b.dataset.guTitle||'Información',b.dataset.guHelp||'');});
window.GUIHelp={enhance,open:openInfo,info:help};
})();
