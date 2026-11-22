/* Gráficas Canvas sin librerías ni conexión a Internet. */
(function(){
'use strict';
const compact=n=>new Intl.NumberFormat('es-CO',{maximumFractionDigits:1,notation:Math.abs(n)>9999?'compact':'standard'}).format(n);
function prepare(canvas){if(!canvas)return null;const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return null;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);const st=getComputedStyle(document.body);return {ctx,w:rect.width,h:rect.height,accent:st.getPropertyValue('--accent').trim()||'#78573e',text:st.getPropertyValue('--muted').trim()||'#847c72',grid:st.getPropertyValue('--line').trim()||'#ede5d9',positive:st.getPropertyValue('--good').trim()||'#6e8b70'};}
function rounded(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,Math.max(0,w),Math.max(0,h),r);ctx.fill();}
function bars(id,items){const c=prepare(document.getElementById(id));if(!c)return;const {ctx,w,h,accent,text,grid}=c;const left=45,right=14,top=22,bottom=41,uw=w-left-right,uh=h-top-bottom;const values=items.map(d=>Number(d.value)||0),max=Math.max(1,...values.map(Math.abs));const minV=Math.min(0,...values);const maxV=Math.max(0,...values);const range=Math.max(1,maxV-minV);const baseline=top+uh*(maxV/range);ctx.lineWidth=1;ctx.font='11px system-ui';ctx.fillStyle=text;ctx.textAlign='right';for(let i=0;i<=4;i++){const v=minV+range*i/4;const y=top+uh*(1-i/4);ctx.strokeStyle=grid;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();ctx.fillText(compact(v),left-9,y+4);}const slot=uw/Math.max(items.length,1);items.forEach((d,i)=>{const width=Math.min(48,slot*.56),x=left+slot*i+(slot-width)/2,y=top+uh*(maxV-(Number(d.value)||0))/range;ctx.fillStyle=accent;rounded(ctx,x,Math.min(y,baseline),width,Math.max(2,Math.abs(y-baseline)),6);ctx.fillStyle=text;ctx.textAlign='center';const label=String(d.label);ctx.fillText(label.length>11?label.slice(0,9)+'…':label,x+width/2,h-17);});}
function horizontal(id,items){const c=prepare(document.getElementById(id));if(!c)return;const {ctx,w,h,accent,text,grid}=c;const left=Math.min(132,w*.34),right=55,top=14,room=Math.max(0,w-left-right),rowHeight=Math.min(52,(h-top-12)/Math.max(items.length,1));const max=Math.max(1,...items.map(x=>Math.abs(Number(x.value)||0)));ctx.font='12px system-ui';items.forEach((x,i)=>{const y=top+i*rowHeight+5;ctx.fillStyle=text;ctx.textAlign='right';const s=String(x.label);ctx.fillText(s.length>17?s.slice(0,15)+'…':s,left-10,y+15);ctx.fillStyle=grid;rounded(ctx,left,y,room,19,6);ctx.fillStyle=accent;rounded(ctx,left,y,Math.max(Math.abs(Number(x.value)||0)>0?3:0,Math.abs(Number(x.value)||0)/max*room),19,6);ctx.fillStyle=text;ctx.textAlign='left';ctx.fillText(compact(x.value),left+room+9,y+15);});}
function line(id,items){
 const c=prepare(document.getElementById(id));if(!c)return;
 const {ctx,w,h,text,grid,accent,positive}=c;
 const data=(items||[]).filter(d=>Number.isFinite(Number(d.value)));
 const L=w<420?39:51,R=16,T=22,B=43,CW=w-L-R,CH=h-T-B;
 ctx.font='11px system-ui';ctx.lineWidth=1;
 if(!data.length){ctx.textAlign='center';ctx.fillStyle=text;ctx.fillText('Sin períodos registrados',w/2,h/2);return;}
 const vals=data.map(d=>Number(d.value)),min=Math.min(0,...vals),max=Math.max(0,...vals);
 const delta=Math.max(1,max-min);
 const y=v=>T+CH*(max-v)/delta;
 const x=i=>L+CW*(data.length===1?.5:i/(data.length-1));
 ctx.textAlign='right';ctx.fillStyle=text;
 for(let i=0;i<=4;i++){const n=min+delta*i/4,yy=y(n);ctx.strokeStyle=grid;ctx.beginPath();ctx.moveTo(L,yy);ctx.lineTo(w-R,yy);ctx.stroke();ctx.fillText(compact(n),L-7,yy+4);}
 const skip=Math.max(1,Math.ceil(data.length/5));
 ctx.textAlign='center';ctx.fillStyle=text;
 data.forEach((d,i)=>{if(i%skip!==0&&i!==data.length-1)return;const name=String(d.label??i+1);const label=name.length>11?name.slice(0,9)+'…':name;ctx.fillText(label,x(i),h-16);});
 if(vals.every(v=>v===0)){ctx.textAlign='center';ctx.fillStyle=text;ctx.fillText('Sin movimientos registrados',w/2,Math.max(22,T+CH/2-14));}
 ctx.strokeStyle=accent;ctx.lineJoin='round';ctx.lineCap='round';ctx.lineWidth=2.7;ctx.beginPath();data.forEach((d,i)=>i?ctx.lineTo(x(i),y(vals[i])):ctx.moveTo(x(i),y(vals[i])));ctx.stroke();
 data.forEach((d,i)=>{ctx.beginPath();ctx.arc(x(i),y(vals[i]),data.length>18?2.1:3.3,0,Math.PI*2);ctx.fillStyle=positive;ctx.fill();ctx.strokeStyle=accent;ctx.lineWidth=1.3;ctx.stroke();});
}
window.AlmendraCharts={bars,horizontal,line};
})();
