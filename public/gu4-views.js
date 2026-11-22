/* Distribución de las tarjetas del panel. */
(function(){'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function layoutDashboard(root,s,editing=false){if(!root||!window.GU4Core)return;const panels=Array.from(root.querySelectorAll('.metric-panel[data-metric]'));if(!panels.length)return;
 const pref=s.gu4,order=pref.panelOrder,board=document.createElement('section');board.className='gu4-dashboard-board';board.id='gu4-dashboard-board';board.setAttribute('aria-label','Métricas configurables');
 const before=root.querySelector('.stats-grid');if(!before)return;before.parentNode.insertBefore(board,before);
 const toolbar=document.createElement('div');toolbar.className='gu4-layout-toolbar';toolbar.innerHTML=`<span>Panel · ${panels.length} tarjetas</span><button class="btn btn-small" type="button" data-gu4-layout="toggle" aria-pressed="${editing}">${editing?'Terminar edición':'Organizar panel'}</button>${editing?'<button class="btn btn-small" type="button" data-gu4-reset-layout="1">Restablecer</button>':''}`;board.before(toolbar);
 const sorted=panels.sort((a,b)=>{const x=order.indexOf(a.dataset.metric),y=order.indexOf(b.dataset.metric);return (x===-1?999:x)-(y===-1?999:y);});
 sorted.forEach(panel=>{const id=panel.dataset.metric;board.append(panel);panel.classList.toggle('gu4-wide-card',pref.panelSizes[id]==='wide'||(!pref.panelSizes[id]&&['bodega','proyecciones','grafico-semanal','grafico-productos','revision','tendencias','vista-rapida','actividad'].includes(id)));
  panel.classList.toggle('gu4-editing',editing);if(editing){const tools=document.createElement('div');tools.className='gu4-panel-order';tools.innerHTML=`<span>Ordenar</span><button type="button" data-gu4-move="${esc(id)}" data-gu4-direction="-1" aria-label="Mover tarjeta hacia arriba">↑</button><button type="button" data-gu4-move="${esc(id)}" data-gu4-direction="1" aria-label="Mover tarjeta hacia abajo">↓</button><button type="button" data-gu4-resize="${esc(id)}" aria-label="Alternar tamaño">${panel.classList.contains('gu4-wide-card')?'Normal':'Ancha'}</button>`;panel.prepend(tools);}
 });
 for(const wrapper of root.querySelectorAll('.stats-grid,.dashboard-visual-row,.dashboard-grid,.dashboard-v3-row,.dashboard-bottom')){if(!wrapper.querySelector('.metric-panel'))wrapper.remove();}
}
window.GU4Views={layoutDashboard};
})();
