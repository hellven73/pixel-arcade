// GitHub Pages provides the interface. These authenticated calls provide shared data.
(()=>{const base='https://pixel-arcade-wg-1023.aquapine16.chatgpt.site',key='px-api-session';let token='',expiresAt=0,devToken='';try{const saved=JSON.parse(sessionStorage.getItem(key)||'{}');if(saved.expiresAt>Date.now()&&/^[a-f0-9]{64}$/.test(saved.token||'')){token=saved.token;expiresAt=saved.expiresAt}devToken=sessionStorage.getItem('px-dev-session')||''}catch{}
function clear(){token='';expiresAt=0;try{sessionStorage.removeItem(key)}catch{}}
async function request(path,options={}){if(!path.startsWith('/api/'))throw Error('Invalid service path.');if(expiresAt&&expiresAt<=Date.now())clear();const headers=new Headers(options.headers||{});headers.set('X-Pixel-Client','github-pages');if(token)headers.set('Authorization','Bearer '+token);if(path.startsWith('/api/dev/framex')&&devToken)headers.set('X-Pixel-Dev-Token',devToken);
 let response;try{response=await fetch(base+path,{...options,headers,credentials:'omit'})}catch{throw Error('Could not reach Pixel services. Check your connection and try again.')}
 const data=await response.json().catch(()=>({error:'Pixel services returned an unexpected response.'}));
 if(!response.ok){if(response.status===401&&(path==='/api/profile'||path.startsWith('/api/chat')))clear();throw Object.assign(new Error(data.error||'Could not complete that request.'),{status:response.status})}
 if(/^\/api\/auth\/(login|register)$/.test(path)&&/^[a-f0-9]{64}$/.test(data.token||'')){token=data.token;expiresAt=data.expiresAt;try{sessionStorage.setItem(key,JSON.stringify({token,expiresAt}))}catch{}}
 if(path==='/api/auth/logout'||(path==='/api/auth/recovery'&&data.signedOut))clear();
 if(path.startsWith('/api/dev/framex')){if(data.devToken){devToken=data.devToken;try{sessionStorage.setItem('px-dev-session',devToken)}catch{}}if(options.method==='DELETE'){devToken='';try{sessionStorage.removeItem('px-dev-session')}catch{}}}
 return data;
}window.pixelApi={request};})();
