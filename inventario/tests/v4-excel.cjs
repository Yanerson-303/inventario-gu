const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..','..','public'),window={JSZip:require(path.join(root,'jszip.min.js'))};
vm.runInNewContext(fs.readFileSync(path.join(root,'gu4-excel.js'),'utf8'),{window,Number,String,Array,Math,Intl});
(async()=>{
 const X=window.GU4Excel,parsed=X.csvParse('Producto;Categoría;Valor\n"Caja A";Almacén;10\n"Caja; B";Especial;20\n');
 assert.equal(parsed.length,3);assert.equal(parsed[2][0],'Caja; B');
 const template=await X.template();const zip=await window.JSZip.loadAsync(await template.arrayBuffer());
 assert(zip.file('xl/worksheets/sheet1.xml'));
 assert((await zip.file('xl/worksheets/sheet1.xml').async('string')).includes('Producto ejemplo'));
 const wb=await X.writeWorkbook([{name:'Una',rows:[['A','B'],['fórmula =2+2',1]]},{name:'Dos',rows:[['C'],[23]]}]);
 const archive=await window.JSZip.loadAsync(await wb.arrayBuffer());
 assert(archive.file('xl/worksheets/sheet2.xml'));
 assert((await archive.file('xl/worksheets/sheet1.xml').async('string')).includes('fórmula =2+2'));
 console.log('✓ V4 Excel: CSV con comillas, plantilla XLSX y exportación XLSX multihola.');
})().catch(e=>{console.error(e);process.exitCode=1;});
