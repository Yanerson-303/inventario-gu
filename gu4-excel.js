/* Importación/exportación XLSX y CSV sin conexión. JSZip local (MIT/GPLv3). */
(function(){'use strict';
const xEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const fields=['name','category','unit','quantityN','quantityV','value','average','boxes'];
function norm(x){return String(x??'').toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');}
const aliases={name:['producto','nombre','nombreproducto','name','referencia'],category:['categoria','category','grupo'],unit:['unidad','unit','medida'],quantityN:['cantidadn','l','cantn'],quantityV:['cantidadv','m','cantv'],value:['valor','valorunitario','precio','precio unitario','o'],average:['promedio','average','s'],boxes:['cajas','cajax','unidadesporcaja','u']};
function toRecords(rows){if(!rows.length)throw new Error('La hoja está vacía.');const keys=rows[0].map(v=>norm(v));let cols={};
 for(const field of fields){const idx=keys.findIndex(k=>aliases[field].some(alias=>norm(alias)===k));if(idx>=0)cols[field]=idx;}
 if(cols.name===undefined)throw new Error('Falta la columna «Producto» o «Nombre». Descarga la plantilla XLSX.');
 return rows.slice(1).filter(r=>String(r[cols.name]??'').trim()).slice(0,10000).map(row=>{const out={};for(const field of fields)out[field]=cols[field]===undefined?(field==='unit'?'unidad':field==='category'?'':'0'):String(row[cols[field]]??'');return out;});
}
function csvParse(input){let rows=[],row=[],cell='',quote=false,delimiter=';';const first=(String(input).replace(/^\ufeff/,'').split(/\r?\n/,1)[0]||'');if((first.match(/\t/g)||[]).length>(first.match(/;/g)||[]).length)delimiter='\t';else if((first.match(/,/g)||[]).length>(first.match(/;/g)||[]).length)delimiter=',';
 const text=String(input).replace(/^\ufeff/,'');for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){cell+='"';i++;}else quote=!quote;}else if(c===delimiter&&!quote){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(s=>s!==''))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quote)throw new Error('CSV con comillas sin cerrar.');row.push(cell);if(row.some(v=>v!==''))rows.push(row);return rows;
}
function xmlDoc(xml){const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw new Error('XML del libro de Excel inválido.');return doc;}
const nodes=(node,name)=>Array.from(node.getElementsByTagNameNS('*',name));
function cellColumn(ref){let col=0;for(const c of String(ref).match(/^[A-Z]+/)?.[0]||''){col=col*26+c.charCodeAt(0)-64;}return col-1;}
async function xlsxRows(file){if(!window.JSZip)throw new Error('No se cargó el componente de Excel local.');const zip=await window.JSZip.loadAsync(await file.arrayBuffer());const sharedEntry=zip.file('xl/sharedStrings.xml');let shared=[];
 if(sharedEntry){const xml=await sharedEntry.async('string');if(xml.length>12*1024*1024)throw new Error('Tabla de cadenas de Excel demasiado grande.');const doc=xmlDoc(xml);shared=nodes(doc,'si').map(si=>nodes(si,'t').map(t=>t.textContent).join(''));}
 const sheet=Object.keys(zip.files).sort().find(name=>/^xl\/worksheets\/sheet\d+\.xml$/.test(name));if(!sheet)throw new Error('El XLSX no contiene hojas compatibles.');const sheetXML=await zip.file(sheet).async('string');if(sheetXML.length>18*1024*1024)throw new Error('Hoja demasiado grande.');const doc=xmlDoc(sheetXML),rows=[];
 for(const r of nodes(doc,'row')){const output=[];for(const c of nodes(r,'c')){const index=cellColumn(c.getAttribute('r'));if(index<0||index>150)continue;const type=c.getAttribute('t'),v=nodes(c,'v')[0]?.textContent??'';let content=type==='s'?shared[Number(v)]??'':type==='inlineStr'?nodes(c,'t').map(t=>t.textContent).join(''):v;output[index]=String(content);}rows.push(output);if(rows.length>10002)break;}
 return rows;
}
async function parseFile(file){if(file.size>15*1024*1024)throw new Error('Máximo 15 MB por archivo.');const ext=file.name.toLowerCase().split('.').at(-1);const rows=ext==='xlsx'?await xlsxRows(file):['csv','tsv'].includes(ext)?csvParse(await file.text()):null;if(!rows)throw new Error('Usa archivos .xlsx, .csv o .tsv.');return toRecords(rows);}
function column(n){let out='';for(let i=n+1;i>0;i=Math.floor((i-1)/26))out=String.fromCharCode(65+(i-1)%26)+out;return out;}
function worksheet(rows){const xmlRows=rows.map((row,ri)=>`<row r="${ri+1}">${row.map((v,ci)=>{const ref=column(ci)+(ri+1);if(typeof v==='number'&&Number.isFinite(v))return `<c r="${ref}"><v>${v}</v></c>`;return `<c r="${ref}" t="inlineStr"><is><t>${xEsc(v)}</t></is></c>`;}).join('')}</row>`).join('');return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>${xmlRows}</sheetData></worksheet>`;}
async function writeWorkbook(tabs){if(!window.JSZip)throw new Error('Componente de Excel no disponible.');const zip=new window.JSZip();const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 zip.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${tabs.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
 zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
 zip.file('xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tabs.map((t,i)=>`<sheet name="${xEsc(t.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`);
 zip.file('xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tabs.map((t,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`);
 tabs.forEach((t,i)=>zip.file(`xl/worksheets/sheet${i+1}.xml`,worksheet(t.rows)));
 return zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:5}});
}
function template(){return writeWorkbook([{name:'Productos',rows:[['Producto','Categoría','Unidad','Cantidad.N','Cantidad.V','Valor','Promedio','Cajas'],['Producto ejemplo','Almacén','unidad',0,0,1000,0,12]]}]);}
function report(s,C,Core){const totals=C.totals(s,s.products),allocation=Core.allocations(s,C),forecast=Core.forecasts(s,C),alerts=Core.alerts(s,C);
 return writeWorkbook([
  {name:'Resumen',rows:[['Inventarios GU 4.0','Resumen local'],['Productos',s.products.length],['Volumen H',totals.quantity],['Saldo N',totals.balance],['Valorización P',totals.value],['Unidades ubicadas',allocation.assigned],['Unidades sin ubicar',allocation.unassigned],['Alertas',alerts.length],['Proyección de movimientos semanal',forecast.available?forecast.week:'Sin datos fechados']]},
  {name:'Consolidado',rows:[['Producto','Categoría','H','J','N','P','Valor unitario',...s.periods.map(w=>w.label)],...s.products.map(p=>{const r=C.result(s,p);return [p.name,p.category||'',r.H,r.J,r.N,r.P,p.value,...r.weekly];})]},
  {name:'Ubicaciones',rows:[['Producto','Rack','Nivel','Posición','Unidades'],...s.gu4.locations.map(l=>[s.products.find(p=>p.id===l.productId)?.name||'(eliminado)',l.rack,l.level,l.position,l.qty])]},
  {name:'Alertas',rows:[['Producto','Tipo','Detalle'],...alerts.map(a=>[a.name,a.type,a.message])]},
  {name:'Conteos',rows:[['ID','Fecha','Estado','Producto','Esperado','Contado','Diferencia'],...s.gu4.counts.flatMap(c=>c.lines.map(l=>[c.id,c.createdAt,c.status,l.productName,l.expected,l.counted,l.difference]))]}
 ]);
}
window.GU4Excel={parseFile,template,report,writeWorkbook,csvParse};
})();
