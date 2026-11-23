/* Inventarios GU 3.3 · microinteracciones y audio opcional; sin recursos externos. */
(function(){
'use strict';
const KEY='inventarios-gu-sonido-suave-v33';
let enabled=true;
try{enabled=localStorage.getItem(KEY)!=='off';}catch{}
let context=null,last=0;
let capacityAlarmActive=false,capacityAlarmPending=false,capacityVoice=null;
function play(type='tap'){
 if(!enabled||document.hidden)return;
 const time=Date.now();if(time-last<420)return;last=time;
 const Ctx=window.AudioContext||window.webkitAudioContext;
 if(!Ctx)return;
 try{
  if(!context)context=new Ctx();
  if(context.state==='suspended')context.resume().catch(()=>{});
  const now=context.currentTime;
  const osc=context.createOscillator(),volume=context.createGain();
  osc.type='sine';osc.frequency.setValueAtTime(type==='info'?690:type==='success'?660:470,now);
  if(type==='success')osc.frequency.exponentialRampToValueAtTime(880,now+.075);
  else osc.frequency.exponentialRampToValueAtTime(type==='close'?370:540,now+.085);
  volume.gain.setValueAtTime(.0001,now);
  volume.gain.linearRampToValueAtTime(.011,now+.015); // Muy suave, no se reproduce al pasar el cursor
  volume.gain.exponentialRampToValueAtTime(.0001,now+.12);
  osc.connect(volume).connect(context.destination);
  osc.start(now);osc.stop(now+.135);
 }catch{} // Dispositivos sin Web Audio siguen funcionando
}
function stopCapacityAlarm(){
 capacityAlarmPending=false;
 if(!capacityVoice)return;
 try{capacityVoice.stop();}catch{}
 capacityVoice=null;
}
function flushCapacityAlarm(fromGesture=false){
 if(!enabled||!capacityAlarmPending||document.hidden)return;
 const Ctx=window.AudioContext||window.webkitAudioContext;
 if(!Ctx)return;
 if(context?.state!=='running'&&!fromGesture&&!window.navigator?.userActivation?.isActive)return;
 try{
  if(!context)context=new Ctx();
  if(context.state!=='running'){
   context.resume().then(()=>{
    if(context.state==='running')flushCapacityAlarm();
   }).catch(()=>{});
   return;
  }
  capacityAlarmPending=false;
  const now=context.currentTime,osc=context.createOscillator(),volume=context.createGain();
  osc.type='triangle';
  osc.frequency.setValueAtTime(245,now);
  osc.frequency.exponentialRampToValueAtTime(520,now+.55);
  osc.frequency.exponentialRampToValueAtTime(275,now+1.05);
  osc.frequency.exponentialRampToValueAtTime(475,now+1.48);
  osc.frequency.exponentialRampToValueAtTime(240,now+1.92);
  volume.gain.setValueAtTime(.0001,now);
  volume.gain.linearRampToValueAtTime(.022,now+.18);
  volume.gain.setValueAtTime(.022,now+1.4);
  volume.gain.exponentialRampToValueAtTime(.0001,now+1.92);
  osc.connect(volume).connect(context.destination);
  osc.onended=()=>{if(capacityVoice===osc)capacityVoice=null;};
  capacityVoice=osc;
  osc.start(now);osc.stop(now+1.96);
 }catch{}
}
function setCapacityAlarm(value){
 const active=Boolean(value);
 if(active===capacityAlarmActive)return;
 capacityAlarmActive=active;
 if(!active){stopCapacityAlarm();return;}
 capacityAlarmPending=enabled;
 flushCapacityAlarm();
}
function setEnabled(value){
 enabled=Boolean(value);
 if(!enabled)stopCapacityAlarm();
 try{localStorage.setItem(KEY,enabled?'on':'off');}catch{}
 return enabled;
}
function isEnabled(){return enabled;}
function unlockCapacityAlarm(event){if(event.isTrusted)flushCapacityAlarm(true);}
document.addEventListener('click',unlockCapacityAlarm,true);
document.addEventListener('keydown',unlockCapacityAlarm,true);
document.addEventListener('visibilitychange',()=>flushCapacityAlarm());
// Se usan solo eventos poco frecuentes; NUNCA cada hover ni edición de celda.
document.addEventListener('click',event=>{
 const btn=event.target.closest('[data-gu-sound]');
 if(!btn)return;
 setEnabled(btn.dataset.guSound==='on');
 const status=document.getElementById('gu-sound-state');
 if(status)status.textContent=enabled?'Activados':'Silenciados';
 document.querySelectorAll('[data-gu-sound]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.guSound==='on')===enabled)));
 if(enabled)play('info');
});
window.GUFeedback={play,setEnabled,isEnabled,setCapacityAlarm};
})();
