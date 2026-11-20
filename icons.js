/* Iconografía vectorial local, sin solicitudes externas. */
(function(){'use strict';
const paths={
 'layout-dashboard':'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
 'calendar-days':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
 'layers':'<path d="m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5"/>',
 'package':'<path d="m12 2 9 5-9 5-9-5 9-5Zm-9 5v10l9 5 9-5V7M12 12v10M7.5 4.5l9 5"/>',
 'users':'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3.2a4 4 0 0 1 0 7.6M22 21v-2a4 4 0 0 0-3-3.9"/><circle cx="9" cy="7" r="4"/>',
 'history':'<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8M3 3v5h5M12 7v5l3 2"/>',
 'database-backup':'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3 3.1 0 5.8-.52 7.42-1.32M21 5v5M3 12c0 1.66 4.03 3 9 3 1.1 0 2.2-.07 3.1-.2M16 18h6m-3-3-3 3 3 3"/>',
 'settings':'<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2.2 2.2-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1.01 1.52V21h-3.4v-.79A1.65 1.65 0 0 0 10.29 18.7a1.65 1.65 0 0 0-1.82.33l-.06.06-2.2-2.2.06-.06A1.65 1.65 0 0 0 6.6 15 1.65 1.65 0 0 0 5.08 14H4.3v-3.4h.78A1.65 1.65 0 0 0 6.6 9.59a1.65 1.65 0 0 0-.33-1.82l-.06-.06 2.2-2.2.06.06a1.65 1.65 0 0 0 1.82.33A1.65 1.65 0 0 0 11.3 4.4V3.6h3.4v.8a1.65 1.65 0 0 0 1.01 1.52 1.65 1.65 0 0 0 1.82-.33l.06-.06 2.2 2.2-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.52 1.01h.78V14h-.78A1.65 1.65 0 0 0 19.4 15Z"/>',
 'search':'<circle cx="10.8" cy="10.8" r="7.3"/><path d="m16.2 16.2 4.7 4.7"/>',
 'activity':'<path d="M3 12h4l3-8 4 16 3-8h4"/>',
 'bar-chart-3':'<path d="M3 3v18h18M8 16v-5M13 16V7M18 16V4"/>',
 'boxes':'<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>',
 'shield-check':'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
 'trending-up':'<path d="m3 17 6-6 4 4 8-8M15 7h6v6"/>',
 'archive':'<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8M10 12h4"/>',
 'download':'<path d="M12 3v12m-4-4 4 4 4-4M5 17v4h14v-4"/>',
 'wifi-off':'<path d="m2 2 20 20M8.5 8.5a11 11 0 0 1 13 1M2.5 9.5a16 16 0 0 1 2.5-1.7m1.2 6a8 8 0 0 1 6-1.8m5 1a8 8 0 0 1 2.5 1.8M12 20h.01"/>',
 'chevron-right':'<path d="m9 18 6-6-6-6"/>',
 'command':'<path d="M9 7V5a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v14a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V7Z"/>',
 'alert-triangle':'<path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
 'check-circle':'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
 'panel-right-open':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18m-6-12 3 3-3 3"/>',
 'filter':'<path d="M3 4h18l-7 8v7l-4 2v-9L3 4Z"/>'
};
const aliases={'◫':'layout-dashboard','▦':'calendar-days','▤':'layers','◇':'package','◎':'users','◴':'history','⇅':'database-backup','⚙':'settings','▣':'boxes','◉':'activity','◈':'trending-up'};
function svg(name){const content=paths[aliases[name]||name]||paths.package;return `<svg class="gu-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${content}</svg>`;}
function enhance(root=document){root.querySelectorAll('[data-gu-icon]').forEach(el=>{if(el.querySelector('svg'))return;el.innerHTML=svg(el.dataset.guIcon);});}
window.GUIcons={svg,enhance};
document.addEventListener('DOMContentLoaded',()=>enhance());
})();
