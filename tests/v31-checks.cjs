const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const dir=path.resolve(__dirname,'..');const file=p=>fs.readFileSync(path.join(dir,p),'utf8');
const app=file('app.js'),ui=file('ui.js'),warehouse=file('warehouse.js'),index=file('index.html'),sw=file('sw.js');
for(const x of ['renderDashboard','renderWeekly','renderFinal','renderProducts','renderClients','renderAudit','renderBackup','renderSettings','renderProjections']) assert(app.includes('function '+x),'Falta módulo '+x);
for(const x of ['data-final-filter','data-client-filter','data-density-change','product-sort','audit-search','audit-window','csv-audit','data-review-more']) assert(app.includes(x),'Falta control '+x);
assert(ui.includes('showModal')||ui.includes('dialog.showModal'), 'Ayuda debe abrir modal');
assert(ui.includes('textContent=detail'),'La ayuda no debe inyectar HTML sin escapar');
assert(warehouse.includes('clearTimeout(idleTimer)'),'Reinicio de cuadro 3D debe limpiar temporizador');
assert(index.includes('ui.js')&&index.includes('ux.css'));
assert(sw.includes('ui.js')&&sw.includes('ux.css'));
for(const name of ['PC','Movil_iPhone_Android']){
 const content=file('descargas/Inventarios_GU_'+name+'.html');
 assert(content.includes('window.GUIHelp={'),'Ayuda ausente');
 assert(content.includes('INVENTARIOS GU 3.4 — CONTROL'),'Versión antigua');
 assert(!/<script[^>]+src=/.test(content),'Dependencias JS externas');
 assert(!/<link[^>]+rel="stylesheet"/.test(content),'CSS externo');
}
console.log('✓ Módulos conservados; filtros, ayuda, almacén y dos descargas autónomas.');
