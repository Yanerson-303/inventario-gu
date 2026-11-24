/* Google Drive opcional. Los tokens de Google existen solo en memoria. */
(function(){
'use strict';
const scope='https://www.googleapis.com/auth/drive.appdata';
const name='Inventarios_GU_compartido_v1.json';
const driveBase='https://www.googleapis.com/drive/v3';
const uploadBase='https://www.googleapis.com/upload/drive/v3/files';
const fields='id,createdTime,version,appProperties';
let library=null;

function supported(){
 return location.protocol==='https:'||(location.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(location.hostname));
}
function loadLibrary(){
 if(window.google?.accounts?.oauth2)return Promise.resolve(window.google.accounts.oauth2);
 if(library)return library;
 library=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://accounts.google.com/gsi/client';script.async=true;
  const fail=()=>{
   clearTimeout(timer);script.remove();library=null;
   reject(new Error('No se pudo cargar el inicio de sesión de Google.'));
  };
  const timer=setTimeout(fail,15000);
  script.onerror=fail;
  script.onload=()=>{
   clearTimeout(timer);
   const oauth=window.google?.accounts?.oauth2;
   if(oauth)resolve(oauth);else fail();
  };
  document.head.append(script);
 });
 return library;
}
async function prepare(){
 if(!supported())throw new Error('Abre la versión web por HTTPS para conectar Drive.');
 const response=await fetch('/api/drive-config',{cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('La configuración de Google Drive no está disponible.');
 const {clientId}=await response.json();
 if(!/^[\w-]+\.apps\.googleusercontent\.com$/.test(clientId||'')){
  throw new Error('Google Drive aún no está configurado en este sitio.');
 }
 const oauth=await loadLibrary();
 return ()=>new Promise((resolve,reject)=>{
  const client=oauth.initTokenClient({
   client_id:clientId,scope,include_granted_scopes:false,
   callback:response=>{
    if(response.error||!response.access_token||!oauth.hasGrantedAllScopes(response,scope)){
     reject(new Error('Google no autorizó el acceso a los datos de la aplicación en Drive.'));return;
    }
    resolve(connect(response.access_token,Number(response.expires_in)));
   },
   error_callback:error=>reject(new Error(error.type==='popup_failed_to_open'?
    'Permite la ventana de Google y vuelve a intentarlo.':'Se cerró la ventana de Google.'))
  });
  client.requestAccessToken({prompt:'select_account'});
 });
}
function connect(token,lifetime){
 const expires=Date.now()+lifetime*1000;
 const expired=()=>Date.now()>=expires-15000;
 async function request(url,options={}){
  if(expired())throw Object.assign(new Error('Vuelve a conectar tu cuenta de Google.'),{status:401});
  const response=await fetch(url,{...options,cache:'no-store',signal:AbortSignal.timeout(30000),headers:{
   ...options.headers,Authorization:'Bearer '+token
  }});
  if(!response.ok){
   const message=response.status===401?'Vuelve a conectar tu cuenta de Google.':
    response.status===403?'Drive rechazó la solicitud. Verifica el permiso y que la API de Drive esté activada.':
    'Drive no pudo completar la solicitud ('+response.status+').';
   throw Object.assign(new Error(message),{status:response.status});
  }
  return response.json();
 }
 function upload(metadata,backup,fileId){
  const boundary='inventarios_gu_'+crypto.randomUUID().replaceAll('-','');
  const body=new Blob([
   '--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',JSON.stringify(metadata),
   '\r\n--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',JSON.stringify(backup),
   '\r\n--'+boundary+'--\r\n'
  ]);
  const url=uploadBase+(fileId?'/'+encodeURIComponent(fileId):'')+'?'+new URLSearchParams({uploadType:'multipart',fields});
  return request(url,{method:fileId?'PATCH':'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body});
 }
 return {
  expired,
  async account(){
   const {user}=await request(driveBase+'/about?'+new URLSearchParams({fields:'user(permissionId,emailAddress)'}));
   if(!user?.permissionId)throw new Error('No se pudo identificar la cuenta de Drive.');
   return {id:user.permissionId,email:user.emailAddress||''};
  },
  async workspace(){
   const params=new URLSearchParams({
    spaces:'appDataFolder',q:`name = '${name}' and trashed = false`,
    orderBy:'createdTime',fields:`nextPageToken,files(${fields})`,pageSize:'100'
   });
   const found=[];
   do{
    const page=await request(driveBase+'/files?'+params);
    found.push(...(page.files||[]));
    if(!page.nextPageToken)break;
    params.set('pageToken',page.nextPageToken);
   }while(true);
   // Drive permite nombres duplicados. Si dos conexiones crean archivos a la vez, gana el primero.
   return found.sort((a,b)=>a.createdTime.localeCompare(b.createdTime)||a.id.localeCompare(b.id))[0]||null;
  },
  read:fileId=>request(driveBase+'/files/'+encodeURIComponent(fileId)+'?alt=media'),
  create:(deviceId,backup)=>upload({
   name,mimeType:'application/json',parents:['appDataFolder'],appProperties:{publisher:deviceId}
  },backup),
  write:(fileId,backup)=>upload({mimeType:'application/json'},backup,fileId)
 };
}
window.GUDrive={supported,prepare};
})();
