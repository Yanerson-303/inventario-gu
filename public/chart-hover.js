/* GU 3.3 · Resaltado interactivo de gráficos Canvas, sin bibliotecas externas. */
(function(){'use strict';
function attach(id,type,items){
 const canvas=document.getElementById(id);
 if(!canvas||canvas.dataset.guHoverReady==='1')return;
 const data=(Array.isArray(items)?items:[]).filter(d=>d&&Number.isFinite(Number(d.value)));
 if(!data.length)return;
 canvas.dataset.guHoverReady='1';
 const card=canvas.closest('.card');if(!card)return;
 card.style.position='relative';
 const tip=document.createElement('div');tip.className='metric-chart-tooltip';tip.hidden=true;tip.setAttribute('role','status');card.append(tip);
 let active=-1;
 const restore=()=>{if(type==='line')window.AlmendraCharts.line(id,data);else window.AlmendraCharts.horizontal(id,data);};
 const hilite=(i)=>{
   if(i===active)return;active=i;restore();if(i<0)return;
   const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
   const ctx=canvas.getContext('2d');const scale=canvas.width/r.width;ctx.save();ctx.setTransform(scale,0,0,scale,0,0);
   const w=r.width,h=r.height;
   if(type==='line'){
    const L=w<420?39:51,R=16,T=22,B=43,vals=data.map(x=>Number(x.value));
    const min=Math.min(0,...vals),max=Math.max(0,...vals),range=Math.max(1,max-min);
    const x=L+(w-L-R)*(data.length===1?.5:i/(data.length-1));
    const y=T+(h-T-B)*(max-vals[i])/range;
    ctx.beginPath();ctx.moveTo(x,T);ctx.lineTo(x,h-B);ctx.strokeStyle='rgba(120,120,120,.17)';ctx.lineWidth=1;ctx.stroke();
    ctx.shadowBlur=12;ctx.shadowColor='rgba(224,155,62,.48)';ctx.beginPath();ctx.arc(x,y,5.8,0,2*Math.PI);ctx.fillStyle='#edb65f';ctx.fill();ctx.shadowBlur=0;
    ctx.beginPath();ctx.arc(x,y,2.4,0,2*Math.PI);ctx.fillStyle='#fff';ctx.fill();
   }else{
    const L=Math.min(132,w*.34),R=55,T=14,rowH=Math.min(52,(h-T-12)/Math.max(data.length,1));
    const max=Math.max(1,...data.map(x=>Math.abs(Number(x.value)||0)));
    const width=Math.abs(Number(data[i].value)||0)/max*Math.max(0,w-L-R);
    const y=T+i*rowH+5;
    ctx.shadowBlur=12;ctx.shadowColor='rgba(214,160,71,.38)';ctx.fillStyle='rgba(244,189,97,.26)';
    ctx.fillRect(L,y,Math.max(2,width),19);ctx.shadowBlur=0;
   }
   ctx.restore();
 };
 function mouse(event){
  if(event.pointerType==='touch')return;
  const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
  const L=rect.width<420?39:51,R=16;
  let index=-1;
  if(type==='line'){
   const frac=(x-L)/Math.max(1,rect.width-L-R);
   if(frac>=-.08&&frac<=1.08&&y>=5&&y<=rect.height-30)index=Math.max(0,Math.min(data.length-1,Math.round(frac*(data.length-1))));
  }else{
   const rowH=Math.min(52,(rect.height-26)/Math.max(data.length,1));
   const i=Math.floor((y-14)/rowH);
   if(i>=0&&i<data.length&&x>=Math.min(132,rect.width*.34)&&x<=rect.width-50)index=i;
  }
  hilite(index);
  if(index<0){tip.hidden=true;canvas.style.cursor='default';return;}
  const value=new Intl.NumberFormat('es-CO',{maximumFractionDigits:2}).format(Number(data[index].value));
  tip.textContent=`${data[index].label}: ${value}`;
  const cardRect=card.getBoundingClientRect();
  tip.style.left=`${Math.max(75,Math.min(cardRect.width-75,event.clientX-cardRect.left))}px`;
  tip.style.top=`${Math.max(55,event.clientY-cardRect.top-8)}px`;
  tip.hidden=false;canvas.style.cursor='crosshair';
 }
 canvas.addEventListener('pointermove',mouse,{passive:true});
 canvas.addEventListener('pointerleave',()=>{hilite(-1);tip.hidden=true;canvas.style.cursor='default';});
}
window.GUChartHover={attach};
})();
