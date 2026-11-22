/* Inventarios GU 4.1 · Vista de acceso interactiva, automática y sin red. */
(function(){'use strict';
 const entry=document.getElementById('gu-entry');if(!entry)return;
 const canvas=entry.querySelector('#gu-entry-canvas'),ctx=canvas?.getContext('2d');
 const status=entry.querySelector('[data-entry-status]'),progress=entry.querySelector('[data-entry-progress]'),meta=entry.querySelector('[data-entry-meta]');
 const MIN=3000,start=performance.now(),reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
 let ready=false,failed=false,finished=false,raf=0,angle=-.59,target=-.59,zoom=1,drag=null,last=0,size={w:0,h:0,dpr:1};
 let positions=[[],[],[]],totals=[0,0,0],records=0;
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const finish=()=>{if(finished||!ready||performance.now()-start<MIN)return;finished=true;entry.classList.add('gu-entry-exit');entry.setAttribute('aria-hidden','true');document.body.classList.remove('gu-entry-active');setTimeout(()=>{cancelAnimationFrame(raf);entry.remove();},550);};
 function resized(){const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;const dpr=clamp(window.devicePixelRatio||1,1,2);if(Math.abs(rect.width-size.w)>.5||Math.abs(rect.height-size.h)>.5||dpr!==size.dpr){size={w:rect.width,h:rect.height,dpr};canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}}
 function frame(t){if(finished||!canvas?.isConnected)return;raf=requestAnimationFrame(frame);if(document.hidden||t-last<28)return;last=t;
  resized();const {w,h}=size;if(!w||!h)return;
  if(!drag&&!reduce)target+=.0013;
  const diff=(target-angle);angle+=diff*.12;
  ctx.clearRect(0,0,w,h);const bg=ctx.createRadialGradient(w*.53,h*.45,10,w*.53,h*.45,Math.max(w,h)*.75);bg.addColorStop(0,'#263c50');bg.addColorStop(.64,'#102332');bg.addColorStop(1,'#07131e');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  const sc=Math.min(w/930,h/635)*zoom*.91,cx=w*.5,cy=h*.62;
  function P(x,y,z){const xx=x*Math.cos(angle)-y*Math.sin(angle),yy=x*Math.sin(angle)+y*Math.cos(angle);return [cx+xx*sc,cy+(yy*.52-z*.88)*sc];}
  function poly(pts,fill,stroke,width=1){ctx.beginPath();pts.forEach((p,i)=>{const q=P(...p);i?ctx.lineTo(...q):ctx.moveTo(...q)});ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(.6,width*sc);ctx.stroke();}}
  function line(a,b,color,width=2){ctx.beginPath();ctx.moveTo(...P(...a));ctx.lineTo(...P(...b));ctx.strokeStyle=color;ctx.lineWidth=Math.max(.65,width*sc);ctx.stroke();}
  function cube(x,y,z,dx,dy,dz,top,front,side){const A=[x,y,z],B=[x+dx,y,z],C=[x+dx,y+dy,z],D=[x,y+dy,z],E=[x,y,z+dz],F=[x+dx,y,z+dz],G=[x+dx,y+dy,z+dz],H=[x,y+dy,z+dz];poly([A,B,F,E],front);poly([B,C,G,F],side);poly([E,F,G,H],top);}
  function label(txt,x,y,z,color,size=12){const p=P(x,y,z);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 ${Math.max(8,size*sc)}px system-ui`;ctx.lineWidth=Math.max(1,3*sc);ctx.strokeStyle='#102233';ctx.strokeText(txt,...p);ctx.fillStyle=color;ctx.fillText(txt,...p);}
  // Base y perímetro abierto: rack izquierdo, central, derecho, acceso libre y oficina posterior.
  poly([[-390,-215,-3],[390,-215,-3],[390,220,-3],[-390,220,-3]],'#8597a2','#8fa4b0',2);
  for(let x=-390;x<=390;x+=48)line([x,-215,-2],[x,220,-2],'#9fabb4',.6);
  for(let y=-215;y<=220;y+=48)line([-390,y,-2],[390,y,-2],'#9fabb4',.6);
  cube(-390,-215,0,780,8,102,'#8a9ba6','#344e62','#5d7180');cube(-390,-215,0,7,435,102,'#748995','#3d596c','#344c5e');
  for(let i=0;i<5;i++){const x=-317+i*139;cube(x,-207,99,65,9,3,'#f5e3aa','#d5c28d','#d5c28d');}
  for(const x of [-262,-12,238]){line([x-66,-166,1],[x-66,136,1],'#ecc343',3);line([x+66,-166,1],[x+66,136,1],'#ecc343',3);}
  line([-369,150,1],[365,150,1],'#ecc343',3);line([-369,-166,1],[365,-166,1],'#ecc343',3);
  // Oficina acristalada en la parte posterior.
  cube(212,-207,0,153,65,80,'#b0c2ce','#6b8fa6','#58798d');cube(228,-147,20,123,4,42,'#9ad3e1','#4b829f','#3b6f89');cube(253,-144,22,45,9,24,'#3d5b75','#182b47','#263f57');cube(291,-132,28,12,13,16,'#e5bb81','#d69a67','#ba825b');label('INVENTARIO',287,-153,88,'#fff',12);
  // Mesa para clasificación y pallet cerca de la entrada.
  poly([[202,98,1],[365,98,1],[365,206,1],[202,206,1]],'#6c838d','#e8bf48',2);
  cube(218,113,0,71,32,20,'#b9a184','#806852','#957c5f');cube(224,118,20,24,22,17,'#efd0a4','#b58962','#d0a174');cube(253,118,20,28,24,14,'#e6c18c','#af7e52','#c39260');label('ACOMODO',279,202,2,'#f9fbfc',11);
  // Estructura de los tres racks, 2 niveles y cajas según ubicaciones físicas.
  for(let r=0;r<3;r++){
   const x=-310+r*239,y=-130,dx=105,dy=232;
   poly([[x-12,y-12,0],[x+dx+12,y-12,0],[x+dx+12,y+dy+12,0],[x-12,y+dy+12,0]],'#788f9c','#efbb46',2);
   for(const level of [7,63])cube(x,y,level,dx,dy,6,'#ed9f3b','#bb7226','#c57a2b');
   for(const px of [x,x+dx])for(const py of [y,y+dy])cube(px-4,py-4,0,8,8,131,'#3f92c4','#18567f','#236b9a');
   for(const slot of positions[r]){
    const level=slot.level-1,cell=slot.position-1,col=cell%2,row=Math.floor(cell/2);
    const xx=x+9+col*47,yy=y+10+row*53,zz=level?69:14;
    cube(xx,yy,zz,37,39,37,'#ebc69c','#b27c52','#d99c68');line([xx+18,yy,zz+37],[xx+18,yy+39,zz+37],'#bd956e',2);
   }
   label(String(totals[r]),x+dx*.5,y+dy*.5,148,'#fff',23);label('RACK '+(r+1),x+dx*.5,y+dy*.5,168,'#ffdb8a',12);
  }
  // Operario con chaleco reflectivo y tableta.
  const wy=28+(reduce?0:Math.sin(t*.001)*19);
  cube(-175,wy,0,14,15,30,'#ffad44','#e48028','#dc7527');cube(-176,wy,30,15,15,13,'#efc38b','#d9a46f','#cb9260');cube(-178,wy-1,43,18,18,5,'#ffe16d','#ddb73b','#e0bd44');cube(-154,wy,23,16,12,3,'#b3d6e3','#305b78','#2a597b');
  label('ENTRADA',0,208,1,'#e7f6f3',13);
  const elapsed=t-start,percent=ready?100:Math.min(92,Math.floor(elapsed/MIN*84));progress.style.width=percent+'%';
  if(ready){status.textContent=failed?'Revisa el estado de la aplicación':'Inventario preparado';meta.textContent=failed?'Se mostrará la información de recuperación.':`${records} productos · ${totals.reduce((a,b)=>a+b,0)} unidades ubicadas`;finish();}
 }
 function complete(detail){if(ready)return;ready=true;failed=!detail?.ok;
  if(detail?.ok){records=Number(detail.products)||0;const next=detail.racks||[];totals=[0,1,2].map(i=>Math.max(0,Number(next[i])||0));positions=[0,1,2].map(i=>(detail.positions?.[i]||[]).filter(slot=>[1,2].includes(slot.level)&&slot.position>=1&&slot.position<=8));}
  if(!ctx){setTimeout(()=>{entry.remove();document.body.classList.remove('gu-entry-active');},Math.max(0,MIN-(performance.now()-start)));return;}
  finish();}
 window.addEventListener('gu:app-ready',event=>complete(event.detail));
 document.body.classList.add('gu-entry-active');
 if(!ctx){status.textContent='Preparando inventario';return;}
 canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,a:target};canvas.setPointerCapture?.(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(drag)target=drag.a+(e.clientX-drag.x)*.006;});
 const end=()=>{drag=null;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(zoom-e.deltaY*.0008,.7,1.55);},{passive:false});
 canvas.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){target-=.17;e.preventDefault();}if(e.key==='ArrowRight'){target+=.17;e.preventDefault();}if(e.key==='+'){zoom=clamp(zoom+.1,.7,1.55);e.preventDefault();}if(e.key==='-'){zoom=clamp(zoom-.1,.7,1.55);e.preventDefault();}});
 raf=requestAnimationFrame(frame);
 // No se exige pulsar entrar: si el navegador no finaliza la carga, aparece el mensaje de recuperación.
 setTimeout(()=>{if(ready||finished)return;ready=true;failed=true;status.textContent='La carga está tardando';meta.textContent='Comprueba la información de recuperación';const main=document.getElementById('main-content');if(main?.querySelector('.loading-view'))main.innerHTML='<section class="card card-pad"><h2>No se pudo completar la carga</h2><p>Revisa el almacenamiento del navegador o recarga la página. Conserva tu respaldo JSON.</p></section>';finish();},20000);
})();
