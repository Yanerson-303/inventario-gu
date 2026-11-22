const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'..','..','public');
const index=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(dir,'sw.js'),'utf8');
const download='descargas/Inventarios_GU_PC.html';
const files=['styles.css','ux.css','gu4.css','gu4-boot.css','gu4-boot.js','gu4-core.js','gu4-views.js','ui.js','motion.js','chart-hover.js','icons.js','insights.js','db.js','calc.js','charts.js','metric-visuals.js','warehouse.js','app.js','install.js','icon.svg','icon-192.png','icon-512.png','manifest.webmanifest',download];
for(const file of files){assert(fs.existsSync(path.join(dir,file)),file+' ausente');assert(sw.includes('./'+file)||file==='styles.css'&&sw.includes('./styles.css'),'No caché PWA: '+file);}
assert(index.includes('v4.1')); 
assert(index.includes(`href="./${download}" download="Inventarios_GU_PC.html"`));
assert(index.includes(`href="./${download}" download="Inventarios_GU_Movil_iPhone_Android.html"`));
assert(index.includes('data-action="global-search"'));
assert(index.includes('id="command-palette"'));
for(const file of files.filter(f=>f.startsWith('descargas/'))){
 const source=fs.readFileSync(path.join(dir,file),'utf8');
 const appPos=source.indexOf('INVENTARIOS GU 4.1 — CONTROL DE INVENTARIO LOCAL');
 const domPos=source.indexOf('id="main-content"');
 assert(appPos>domPos,'El script de la edición autónoma debe ejecutarse después del DOM');
 assert(source.includes('window.GUIInsights'),'Diagnóstico no incluido en edición autónoma');
 assert(source.includes('window.GU4Core'),'Motor GU4 no incluido en edición autónoma');
 assert(!/<script[^>]*src=/.test(source),'Archivo autónomo con script externo');
 assert(!/<link[^>]+rel="stylesheet"/.test(source),'Archivo autónomo con CSS externo');
}
console.log('✓ Archivos locales, enlaces, precaché y versiones HTML autónomas.');
