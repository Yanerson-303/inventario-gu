/* Bodega isométrica interactiva, sin dependencias externas ni datos duplicados. */
(function(){'use strict';
const fmt=n=>new Intl.NumberFormat('es-CO',{maximumFractionDigits:2}).format(n);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let scene=null,raf=0;
function render(state,C){
 const products=(state.products||[]).map(p=>({name:p.name,qty:Math.max(0,Number(C.result(state,p).N)||0)}));
 const racks=[[],[],[]];products.forEach((p,i)=>racks[i%3].push(p));
 const totals=racks.map(a=>a.reduce((s,p)=>s+p.qty,0));
 scene={racks,totals,angle:-.72,zoom:1,selected:-1,paused:false,frame:0};
 return `<section class="card warehouse-card" aria-label="Bodega virtual interactiva"><div class="warehouse-heading"><div><span class="eyebrow">ALMACÉN DIGITAL · VISTA 3D</span><h2>Bodega virtual</h2></div><div class="warehouse-total"><strong>${fmt(totals.reduce((a,b)=>a+b,0))}</strong><span>unidades disponibles</span></div></div><div class="warehouse-viewport"><canvas id="warehouse-canvas" role="img" aria-label="Bodega isométrica interactiva con tres racks, oficina, trabajador y zona de preparación"></canvas><div class="warehouse-overlay"><span class="warehouse-live"><i></i> INVENTARIO SINCRONIZADO</span><div class="warehouse-controls"><button type="button" data-warehouse="left" title="Girar a la izquierda" aria-label="Girar a la izquierda">↶</button><button type="button" data-warehouse="right" title="Girar a la derecha" aria-label="Girar a la derecha">↷</button><button type="button" data-warehouse="in" title="Acercar" aria-label="Acercar">+</button><button type="button" data-warehouse="out" title="Alejar" aria-label="Alejar">−</button><button type="button" data-warehouse="reset" title="Restablecer vista" aria-label="Restablecer vista">⌂</button></div></div><span class="warehouse-hint">Arrastra para girar · rueda para zoom · selecciona un rack</span></div><div class="warehouse-mini-racks">${totals.map((n,i)=>`<button type="button" class="warehouse-mini-rack" data-warehouse="rack${i}" aria-label="Ver rack ${i+1}"><span class="warehouse-mini-dot"></span><span>Rack ${i+1}</span><strong>${fmt(n)}</strong></button>`).join('')}</div><div id="warehouse-detail" class="warehouse-detail" aria-live="polite">Selecciona un rack para consultar sus productos. Las cajas se dibujan hasta un límite de 16 por rack; el contador muestra el saldo completo.</div></section>`;
}
function mount(){
 cancelAnimationFrame(raf);const canvas=document.getElementById('warehouse-canvas');if(!canvas||!scene)return;
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const s=scene;let W=0,H=0,scale=1,cx=0,cy=0,hit=[];
 function resize(){const rect=canvas.getBoundingClientRect();W=Math.max(250,rect.width);H=Math.max(220,rect.height);const dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);scale=Math.min(W/820,H/500)*s.zoom;cx=W*.5;cy=H*.57;}
 function project(x,y,z){const a=s.angle;const X=x*Math.cos(a)-y*Math.sin(a),Y=x*Math.sin(a)+y*Math.cos(a);return [cx+X*scale,cy+(Y*.51-z*.9)*scale];}
 function polygon(pts,fill,stroke=null,line=1){ctx.beginPath();pts.forEach((p,i)=>{const v=project(...p);i?ctx.lineTo(...v):ctx.moveTo(...v)});ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line*scale;ctx.stroke();}}
 function cube(x,y,z,w,d,h,colors){const p=(xx,yy,zz)=>[xx,yy,zz];polygon([p(x,y,z),p(x+w,y,z),p(x+w,y+d,z),p(x,y+d,z)],'#66717a');polygon([p(x,y,z),p(x,y+d,z),p(x,y+d,z+h),p(x,y,z+h)],colors[1]);polygon([p(x+w,y,z),p(x+w,y+d,z),p(x+w,y+d,z+h),p(x+w,y,z+h)],colors[2]);polygon([p(x,y,z+h),p(x+w,y,z+h),p(x+w,y+d,z+h),p(x,y+d,z+h)],colors[0]);}
 function line(a,b,color,width=2){const p=project(...a),q=project(...b);ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.strokeStyle=color;ctx.lineWidth=width*scale;ctx.stroke();}
 function text(t,x,y,z,color='#fff',size=12){const p=project(x,y,z);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 ${Math.max(9,size*scale)}px system-ui,sans-serif`;ctx.lineWidth=3;ctx.strokeStyle='rgba(13,25,35,.75)';ctx.strokeText(t,...p);ctx.fillStyle=color;ctx.fillText(t,...p);}
 function draw(){if(!canvas.isConnected){cancelAnimationFrame(raf);return;}const r=canvas.getBoundingClientRect();if(Math.abs(r.width-W)>1||Math.abs(r.height-H)>1)resize();ctx.clearRect(0,0,W,H);const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#172535');bg.addColorStop(1,'#263d4e');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 // Suelo industrial, cuadrícula, muros abiertos, carriles y entrada.
 polygon([[-350,-190,0],[350,-190,0],[350,190,0],[-350,190,0]],'#8c989f','#a9b7c0');
 for(let x=-350;x<=350;x+=50)line([x,-190,.3],[x,190,.3],'#a5b1b8',.6);
 for(let y=-190;y<=190;y+=50)line([-350,y,.3],[350,y,.3],'#a5b1b8',.6);
 cube(-350,-190,0,700,9,106,['#647580','#465864','#3d4f5c']);cube(-350,-190,0,9,380,106,['#647580','#43535e','#3b4d59']);
 for(let x=-300;x<=300;x+=110){line([x,-179,105],[x,-179,115],'#f1f6f8',4);}
 // Líneas de circulación, pasillo trasero y zona de preparación.
 for(const x of [-260,-30,200]){line([x-55,-142,1],[x-55,143,1],'#f5c43d',3);line([x+55,-142,1],[x+55,143,1],'#f5c43d',3);}
 line([-330,155,1],[330,155,1],'#f5c43d',4);line([-330,-150,1],[330,-150,1],'#f5c43d',4);
 polygon([[170,95,1],[335,95,1],[335,175,1],[170,175,1]],'#697985','#f5c43d',2);
 // Oficina de inventario, en el fondo.
 cube(190,-184,0,140,55,68,['#e1e7e8','#a9bbc6','#899fac']);cube(205,-127,19,110,3,38,['#91c7dc','#5c9cb7','#5b98b0']);cube(235,-123,19,45,12,24,['#263d56','#182c41','#1d344a']);text('INVENTARIO',261,-128,81,'#ffffff',11);
 // Persona en oficina.
 cube(276,-128,20,9,8,17,['#f2b982','#d49b6f','#bc8b64']);
 // Zona de acomodo, mesa, paquetes y carretilla.
 cube(195,105,0,65,28,17,['#d4b28a','#9a7453','#b28a60']);cube(200,108,17,20,15,17,['#eac18b','#b57e4e','#d49b61']);cube(227,112,17,19,13,13,['#eac18b','#b57e4e','#d49b61']);cube(281,117,0,35,24,9,['#d4b28a','#9a7453','#b28a60']);line([318,115,2],[318,115,34],'#f5b12b',4);text('PREPARACIÓN',247,167,3,'#fff',10);
 hit=[];
 // Estanterías: 3 filas de dos niveles, cajas reales limitadas por rack.
 for(let k=0;k<3;k++){const x=-290+k*230,y=-100,w=100,d=190,n=s.totals[k],count=Math.min(16,Math.floor(n));
 polygon([[x-9,y-10,1],[x+w+9,y-10,1],[x+w+9,y+d+10,1],[x-9,y+d+10,1]],s.selected===k?'#b3aa79':'#788991',s.selected===k?'#ffe082':'#d1ad40',2);
 for(const z of [4,48]){cube(x,y,z,w,d,5,['#f0a13b','#c47827','#d98c2f']);}
 for(const xx of [x,x+w])for(const yy of [y,y+d])cube(xx-3,yy-3,0,6,6,101,['#3983b5','#225b88','#276da0']);
 for(let j=0;j<count;j++){const level=j>=8?1:0,slot=j%8,col=slot%2,row=Math.floor(slot/2);cube(x+9+col*43,y+9+row*43,level?54:10,34,32,29,['#edc08a','#bb8151','#d79d65']);}
 for(const z of [4,48]){line([x,y,z],[x+w,y,z],'#ffc36a',2);line([x,y+d,z],[x+w,y+d,z],'#ffc36a',2);}
 text(fmt(n),x+w/2,y+d/2,119,'#ffffff',19);text(`RACK ${k+1}`,x+w/2,y+d/2,137,'#ffdb83',11);
 hit.push({k,p:project(x+w/2,y+d/2,75)});
 }
 // Trabajador recorriendo pasillo, con casco, chaleco y tableta.
 const wy=45+Math.sin(s.frame*.012)*31;cube(-145,wy,0,12,12,27,['#ef9a31','#d97920','#f3ad46']);cube(-146,wy,27,14,13,12,['#f3c486','#dca36f','#c28d5e']);cube(-148,wy-2,39,18,17,4,['#f6d43d','#e4b72a','#d6a522']);line([-141,wy,0],[-146,wy+12,-10],'#27394c',5);line([-133,wy,0],[-126,wy+12,-10],'#27394c',5);cube(-123,wy,18,12,9,2,['#9ed5ec','#3e789c','#3e789c']);
 text('ENTRADA',0,183,2,'#fff',12);
 if(!s.paused)s.frame++;raf=requestAnimationFrame(draw);
 }
 function detail(k){s.selected=k;document.querySelectorAll('.warehouse-mini-rack').forEach((b,i)=>b.classList.toggle('active',i===k));const el=document.getElementById('warehouse-detail');if(!el)return;const ps=s.racks[k];el.innerHTML=`<strong>Rack ${k+1} · ${fmt(s.totals[k])} unidades</strong><span>${ps.length?ps.map(p=>`${esc(p.name)}: ${fmt(p.qty)}`).join(' · '):'Sin productos asignados'}</span>`;}
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);canvas._drag={x:e.clientX,y:e.clientY,angle:s.angle,moved:false};});
 canvas.addEventListener('pointermove',e=>{if(!canvas._drag)return;const dx=e.clientX-canvas._drag.x;if(Math.abs(dx)>4)canvas._drag.moved=true;s.angle=canvas._drag.angle+dx*.007;});
 canvas.addEventListener('pointerup',e=>{const d=canvas._drag;canvas._drag=null;if(!d||d.moved)return;const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;let best=null,dist=Infinity;for(const h of hit){const dd=Math.hypot(x-h.p[0],y-h.p[1]);if(dd<dist){dist=dd;best=h.k;}}if(dist<85*scale&&best!==null)detail(best);});
 canvas.addEventListener('wheel',e=>{e.preventDefault();s.zoom=Math.max(.65,Math.min(1.7,s.zoom*(e.deltaY>0?.92:1.08)));resize();},{passive:false});
 canvas.addEventListener('pointercancel',()=>canvas._drag=null);
 document.querySelectorAll('[data-warehouse]').forEach(b=>b.addEventListener('click',()=>{const v=b.dataset.warehouse;if(v==='left')s.angle-=.22;else if(v==='right')s.angle+=.22;else if(v==='in')s.zoom=Math.min(1.7,s.zoom*1.13);else if(v==='out')s.zoom=Math.max(.65,s.zoom/1.13);else if(v==='reset'){s.angle=-.72;s.zoom=1;s.selected=-1;}else if(v.startsWith('rack'))detail(Number(v.slice(4)));resize();}));
 resize();draw();
 }
 window.AlmendraWarehouse={render,mount};
})();
