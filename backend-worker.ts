// Portable Pixel API Worker. No secrets are included.
// Bind D1 as DB. Optional admin setting: PIXEL_ADMIN_USERNAME.
// Developer TV secrets: FRAMEX_PASSWORD_HASH, FRAMEX_PASSWORD_SALT, FRAMEX_SESSION_KEY.
// Only the owner's GitHub Pages origin may use browser bearer sessions.
const GITHUB_ORIGIN='https://hellven73.github.io';
function githubClient(req:Request){return req.headers.get('origin')===GITHUB_ORIGIN&&req.headers.get('x-pixel-client')==='github-pages'}
function apiOrigin(req:Request){return req.headers.get('origin')===new URL(req.url).origin||githubClient(req)}
const GITHUB_SESSION_TTL=24*60*60;
function corsHeaders(){return {'Access-Control-Allow-Origin':GITHUB_ORIGIN,'Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Pixel-Client, X-Pixel-Dev-Token','Access-Control-Max-Age':'600','Vary':'Origin','Cache-Control':'no-store'}}

export default {async fetch(request:Request,env:any){
const ACCOUNT_TTL=30*24*60*60;
const encoder=new TextEncoder();
const json=(body:unknown,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
function sameOrigin(req:Request){return apiOrigin(req)}
function cookieName(req:Request){return ['terminal.local','localhost','127.0.0.1'].includes(new URL(req.url).hostname)?'px-preview-session':'__Host-px-session'}
function sessionCookie(req:Request,token:string,maxAge=ACCOUNT_TTL){return `${cookieName(req)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${cookieName(req).startsWith('__Host-')?'; Secure':''}`}
const hex=(bytes:ArrayBuffer|Uint8Array)=>Array.from(new Uint8Array(bytes)).map(v=>v.toString(16).padStart(2,'0')).join('');
async function digest(s:string){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(s)))}
function randomHex(n=32){return hex(crypto.getRandomValues(new Uint8Array(n)))}
async function passwordHash(password:string,salt:string){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256))}
function equal(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
function tokenFrom(req:Request){if(githubClient(req)){const match=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.get('authorization')||'');return match?.[1]||null;}const name=cookieName(req);const value=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);return value&&/^[a-f0-9]{64}$/.test(value)?value:null}
async function getAccount(req:Request){const token=tokenFrom(req);if(!token)return null;return env.DB!.prepare('SELECT a.user_id AS userId,a.username FROM account_tokens t JOIN arcade_accounts a ON a.user_id=t.user_id WHERE t.token_hash=? AND t.expires_at>?').bind(await digest(token),Date.now()).first<{userId:string;username:string}>()}
async function limited(req:Request,action:string,username=''){const ip=req.headers.get('cf-connecting-ip')||'local-preview';const key=await digest(action+':'+ip+':'+username),now=Date.now(),max=action==='activity'?240:action==='register'?6:action==='chat-typing'?600:action==='chat-send'?180:action.startsWith('chat-')?90:15;await env.DB!.prepare('INSERT INTO auth_limits(key,attempts,resets_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN resets_at<=? THEN 1 ELSE attempts+1 END,resets_at=CASE WHEN resets_at<=? THEN excluded.resets_at ELSE resets_at END').bind(key,now+15*60*1000,now,now).run();const row=await env.DB!.prepare('SELECT attempts FROM auth_limits WHERE key=?').bind(key).first<{attempts:number}>();return (row?.attempts||0)>max}
async function parseBody(req:Request){if(!(req.headers.get('content-type')||'').startsWith('application/json'))return null;const value=await req.text();if(value.length>4096)return null;try{return JSON.parse(value)}catch{return null}}

function isAdmin(user:{username:string}|null){const configured=String((env as unknown as Record<string,string>).PIXEL_ADMIN_USERNAME||'').trim().toLowerCase();return !!user&&/^[a-z0-9_]{3,24}$/.test(configured)&&user.username===configured}
const PUBLIC_LOBBY_ID='pixel-public-lobby';
const PUBLIC_CHANNEL_ID='pixel-public-general';
async function ensurePublicLobby(user:{userId:string}){const joined=await env.DB!.prepare('SELECT id FROM chat_members WHERE server=? AND user=?').bind(PUBLIC_LOBBY_ID,user.userId).first();if(joined)return;await env.DB!.batch([env.DB!.prepare('INSERT OR IGNORE INTO chat_servers(id,name,owner,invite) VALUES(?,?,?,?)').bind(PUBLIC_LOBBY_ID,'Pixel Community','system:public-lobby','public-lobby-not-an-invite'),env.DB!.prepare('INSERT OR IGNORE INTO chat_channels(id,server,name) VALUES(?,?,?)').bind(PUBLIC_CHANNEL_ID,PUBLIC_LOBBY_ID,'general'),env.DB!.prepare('INSERT OR IGNORE INTO chat_members(id,server,user,seen,typing) VALUES(?,?,?,?,NULL)').bind(PUBLIC_LOBBY_ID+':'+user.userId,PUBLIC_LOBBY_ID,user.userId,Date.now())])}

const routes:any={'/api/auth/login':(()=>{
async function POST(req:Request){
 if(!sameOrigin(req))return json({error:'Invalid origin.'},403);
 const b=await parseBody(req);const username=typeof b?.username==='string'?b.username.trim().toLowerCase():'';
 if(!/^[a-z0-9_]{3,24}$/.test(username)||typeof b?.password!=='string'||b.password.length>128)return json({error:'Incorrect username or password.'},401);
 if(await limited(req,'login')||await limited(req,'username',username))return json({error:'Too many login attempts. Try again in 15 minutes.'},429);
 const account=await env.DB!.prepare('SELECT user_id,password_hash,salt FROM arcade_accounts WHERE username=?').bind(username).first<{user_id:string;password_hash:string;salt:string}>();
 const hash=await passwordHash(b.password,account?.salt||'00000000000000000000000000000000');if(!account||!equal(hash,account.password_hash))return json({error:'Incorrect username or password.'},401);
 const token=randomHex(),now=Date.now(),old=tokenFrom(req);if(old)await env.DB!.prepare('DELETE FROM account_tokens WHERE token_hash=?').bind(await digest(old)).run();
 await env.DB!.prepare('DELETE FROM account_tokens WHERE expires_at<=?').bind(now).run();
 await env.DB!.prepare('INSERT INTO account_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(token),account.user_id,now+(githubClient(req)?GITHUB_SESSION_TTL:ACCOUNT_TTL)*1000).run();
 if(githubClient(req))return json({ok:true,token,expiresAt:now+GITHUB_SESSION_TTL*1000},200);
 return json({ok:true},200,{'Set-Cookie':sessionCookie(req,token)});
}

return {POST};})(),
'/api/auth/register':(()=>{
async function POST(req:Request){
 if(!sameOrigin(req))return json({error:'Invalid origin.'},403);
 const b=await parseBody(req);const username=typeof b?.username==='string'?b.username.trim().toLowerCase():'';const password=b?.password;
 if(!/^[a-z0-9_]{3,24}$/.test(username))return json({error:'Use 3–24 letters, numbers or underscores for your username.'},400);
 if(typeof password!=='string'||password.length<7||password.length>128)return json({error:'Use a password with 7–128 characters.'},400);
 if(await limited(req,'register'))return json({error:'Too many sign-up attempts. Try again in 15 minutes.'},429);
 const existing=await env.DB!.prepare('SELECT user_id FROM arcade_accounts WHERE username=?').bind(username).first();if(existing)return json({error:'That username is taken. Choose another.'},409);
 const userId='arcade:'+crypto.randomUUID(),salt=randomHex(16),hash=await passwordHash(password,salt),now=Date.now(),token=randomHex();
 try{await env.DB!.batch([
 env.DB!.prepare('INSERT INTO arcade_accounts(user_id,username,password_hash,salt,created_at) VALUES(?,?,?,?,?)').bind(userId,username,hash,salt,now),
 env.DB!.prepare('INSERT INTO players(user_id,name,created_at) VALUES(?,?,?)').bind(userId,b.username.trim(),now),
 env.DB!.prepare('INSERT INTO account_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(token),userId,now+(githubClient(req)?GITHUB_SESSION_TTL:ACCOUNT_TTL)*1000)
 ])}catch(error){if(String(error).includes('UNIQUE'))return json({error:'That username is taken. Choose another.'},409);throw error}
 if(githubClient(req))return json({ok:true,token,expiresAt:now+GITHUB_SESSION_TTL*1000},201);
 return json({ok:true},201,{'Set-Cookie':sessionCookie(req,token)});
}

return {POST};})(),
'/api/auth/logout':(()=>{
async function POST(req:Request){if(!sameOrigin(req))return json({error:'Invalid origin.'},403);const token=tokenFrom(req);if(token)await env.DB!.prepare('DELETE FROM account_tokens WHERE token_hash=?').bind(await digest(token)).run();return json({ok:true},200,{'Set-Cookie':sessionCookie(req,'',0)})}

return {POST};})(),
'/api/profile':(()=>{
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function GET(req:Request){
 const user=await getAccount(req);if(!user)return json({authenticated:false},401);
 const profile=await env.DB!.prepare('SELECT name, created_at FROM players WHERE user_id=?').bind(user.userId).first();
 if(!profile)return json({authenticated:true,isAdmin:isAdmin(user),profile:null});
 const stats=await env.DB!.prepare('SELECT game_id, MAX(game_name) AS game_name, SUM(seconds) AS seconds, COUNT(*) AS sessions, MAX(created_at) AS last_played FROM sessions WHERE user_id=? GROUP BY game_id ORDER BY seconds DESC').bind(user.userId).all();
 return json({authenticated:true,isAdmin:isAdmin(user),profile,username:user.username,stats:stats.results});
}
async function POST(req:Request){
 const user=await getAccount(req);if(!user)return json({error:'Log in to your arcade account first.'},401);
 if(!apiOrigin(req))return json({error:'Invalid origin.'},403);
 const body:any=await req.json().catch(()=>null);const name=typeof body?.name==='string'?body.name.trim():'';
 if(name.length<2||name.length>24)return json({error:'Choose a player name with 2–24 characters.'},400);
 await env.DB!.prepare('INSERT INTO players(user_id,name,created_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET name=excluded.name').bind(user.userId,name,Date.now()).run();
 return json({ok:true});
}

return {GET,POST};})(),
'/api/session':(()=>{
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const allowed=new Set(['snake','breakout','pong','flap','dodge','runner','invaders','2048','memory','mines','ttt','connect','reaction','aim','lights','slide','simon','typing','minecraft262','bitlife','gta-vice-city','gta-san-andreas','falling-blocks','dots-boxes',...Array.from({length:29},(_,i)=>'original-'+i)]);
async function POST(req:Request){
 const user=await getAccount(req);if(!user)return json({error:'Sign in first.'},401);
 if(!apiOrigin(req))return json({error:'Invalid origin.'},403);
 const b:any=await req.json().catch(()=>null);
 if(!b||typeof b.id!=='string'||!/^[-a-z0-9]{20,80}$/i.test(b.id)||!(allowed.has(b.game)||(typeof b.game==='string'&&/^custom-[a-f0-9-]{36}$/.test(b.game)))||!Number.isInteger(b.seq)||b.seq<0||!Number.isFinite(b.seconds)||b.seconds<0||b.seconds>30)return json({error:'Invalid session.'},400);
 const player=await env.DB!.prepare('SELECT user_id FROM players WHERE user_id=?').bind(user.userId).first();if(!player)return json({error:'Create a player profile first.'},409);
 const now=Date.now();
 if(b.seq===0){await env.DB!.prepare('INSERT OR IGNORE INTO sessions(id,user_id,game_id,game_name,seconds,seq,updated_at,created_at) VALUES(?,?,?,?,0,0,?,?)').bind(b.id,user.userId,b.game,typeof b.name==='string'?b.name.slice(0,80):null,now,now).run();return json({ok:true})}
 const row=await env.DB!.prepare('SELECT game_id,seq,updated_at FROM sessions WHERE id=? AND user_id=?').bind(b.id,user.userId).first<{game_id:string;seq:number;updated_at:number}>();
 if(!row||row.game_id!==b.game)return json({error:'Session not found.'},404);
 if(b.seq<=row.seq)return json({ok:true});
 const seconds=Math.min(b.seconds,Math.max(0,(now-row.updated_at)/1000),30);
 await env.DB!.prepare('UPDATE sessions SET seconds=seconds+?,seq=?,updated_at=? WHERE id=? AND user_id=? AND seq=?').bind(Math.round(seconds*1000)/1000,b.seq,now,b.id,user.userId,row.seq).run();
 return json({ok:true});
}

return {POST};})(),
'/api/chat':(()=>{
const db=()=>env.DB!;
const member=(server:string,user:string)=>db().prepare('SELECT s.* FROM chat_servers s JOIN chat_members m ON m.server=s.id WHERE s.id=? AND m.user=?').bind(server,user).first<any>();
async function GET(req:Request){
 const user=await getAccount(req);if(!user)return json({error:'Log in to your arcade account to chat.'},401);
 await ensurePublicLobby(user);const url=new URL(req.url),server=url.searchParams.get('server'),channel=url.searchParams.get('channel');
 const servers=(await db().prepare('SELECT s.id,s.name,s.owner FROM chat_servers s JOIN chat_members m ON m.server=s.id WHERE m.user=? ORDER BY s.name').bind(user.userId).all()).results;
 if(!server)return json({user,servers});const s=await member(server,user.userId);if(!s)return json({error:'Join this server first.'},403);
 await db().prepare('UPDATE chat_members SET seen=? WHERE server=? AND user=?').bind(Date.now(),server,user.userId).run();
 const channels=(await db().prepare('SELECT * FROM chat_channels WHERE server=? ORDER BY name').bind(server).all()).results;
 const members=(await db().prepare('SELECT m.user,m.seen,m.typing,a.username FROM chat_members m JOIN arcade_accounts a ON a.user_id=m.user WHERE m.server=?').bind(server).all()).results.map((m:any)=>{const [typing,at]=String(m.typing||'').split('|');return {...m,typing,typingAt:Number(at)||0}});
 let messages:any[]=[],reactions:any[]=[];
 if(channel){if(!channels.some((c:any)=>c.id===channel))return json({error:'Channel not found.'},404);
 const q=(url.searchParams.get('q')||'').slice(0,80);messages=(await db().prepare('SELECT m.*,a.username FROM chat_messages m JOIN arcade_accounts a ON a.user_id=m.author WHERE m.channel=? AND (? = \'\' OR instr(lower(m.body),lower(?))>0) ORDER BY m.created DESC,m.id DESC LIMIT 100').bind(channel,q,q).all()).results.reverse();
 reactions=(await db().prepare('SELECT r.* FROM chat_reactions r JOIN chat_messages m ON r.message=m.id WHERE m.channel=? ORDER BY m.created DESC LIMIT 1000').bind(channel).all()).results;
 }return json({user,servers,server:{...s,isPublic:s.id===PUBLIC_LOBBY_ID,canModerate:s.owner===user.userId||isAdmin(user),invite:s.owner===user.userId?s.invite:undefined},channels,members,messages,reactions});
}
async function POST(req:Request){
 if(!sameOrigin(req))return json({error:'Invalid origin.'},403);const user=await getAccount(req);if(!user)return json({error:'Log in to chat.'},401);
 await ensurePublicLobby(user);const b=await parseBody(req);if(!b||typeof b.action!=='string')return json({error:'Invalid request.'},400);
 // Separate actions have independent limits; normal polling is read-only.
 if(await limited(req,'chat-'+b.action,user.userId))return json({error:'Slow down a little. Try again in a few minutes.'},429);
 const uid=user.userId,id=crypto.randomUUID(),now=Date.now(),name=typeof b.name==='string'?b.name.trim().slice(0,40):'';
 if(b.action==='create'){if(!name)return json({error:'Name your server.'},400);const count=await db().prepare('SELECT COUNT(*) AS n FROM chat_members WHERE user=?').bind(uid).first<any>();if(count.n>=30)return json({error:'You can join up to 30 servers.'},400);await db().batch([db().prepare('INSERT INTO chat_servers VALUES(?,?,?,?)').bind(id,name,uid,randomHex(16)),db().prepare('INSERT INTO chat_members VALUES(?,?,?,?,NULL)').bind(id+':'+uid,id,uid,now),db().prepare('INSERT INTO chat_channels VALUES(?,?,?)').bind(crypto.randomUUID(),id,'general')]);return json({ok:true,server:id});}
 if(b.action==='join'){if(typeof b.invite!=='string'||!/^[a-f0-9]{32}$/.test(b.invite))return json({error:'Invalid invite code.'},400);const s=await db().prepare('SELECT id FROM chat_servers WHERE invite=?').bind(b.invite).first<any>();if(!s)return json({error:'Invite not found.'},404);const count=await db().prepare('SELECT COUNT(*) AS n FROM chat_members WHERE user=?').bind(uid).first<any>();if(count.n>=30)return json({error:'You can join up to 30 servers.'},400);await db().prepare('INSERT OR IGNORE INTO chat_members VALUES(?,?,?,?,NULL)').bind(s.id+':'+uid,s.id,uid,now).run();return json({ok:true,server:s.id});}
 if(typeof b.server!=='string')return json({error:'Choose a server.'},400);const s=await member(b.server,uid);if(!s)return json({error:'Server access denied.'},403);const owner=s.owner===uid||isAdmin(user);if(s.id===PUBLIC_LOBBY_ID&&['leave','kick','invite'].includes(b.action))return json({error:'The public community lobby is joined automatically and cannot be left or invite-managed.'},403);
 if(b.action==='channel'){if(!owner)return json({error:'Only the server owner can create channels.'},403);if(!name)return json({error:'Name your channel.'},400);await db().prepare('INSERT INTO chat_channels VALUES(?,?,?)').bind(id,s.id,name).run();return json({ok:true,channel:id});}
 if(b.action==='invite'){if(!owner)return json({error:'Owner access required.'},403);await db().prepare('UPDATE chat_servers SET invite=? WHERE id=?').bind(randomHex(16),s.id).run();return json({ok:true});}
 if(b.action==='kick'||b.action==='leave'){const target=b.action==='leave'?uid:b.user;if(typeof target!=='string'||(!owner&&target!==uid)||target===s.owner)return json({error:'Cannot remove this member.'},403);await db().prepare('DELETE FROM chat_members WHERE server=? AND user=?').bind(s.id,target).run();return json({ok:true});}
 if(typeof b.channel!=='string')return json({error:'Choose a channel.'},400);const c=await db().prepare('SELECT id FROM chat_channels WHERE id=? AND server=?').bind(b.channel,s.id).first();if(!c)return json({error:'Channel access denied.'},403);
 if(b.action==='typing'){await db().prepare('UPDATE chat_members SET typing=?,seen=? WHERE server=? AND user=?').bind(b.active?b.channel+'|'+now:null,now,s.id,uid).run();return json({ok:true});}
 if(b.action==='send'){const body=typeof b.body==='string'?b.body.trim():'';if(!body||body.length>2000)return json({error:'Messages need 1–2000 characters.'},400);const recent=await db().prepare('SELECT created FROM chat_messages WHERE author=? ORDER BY created DESC LIMIT 1').bind(uid).first<any>();if(recent&&now-recent.created<800)return json({error:'Wait a moment before sending again.'},429);await db().prepare('INSERT INTO chat_messages(id,channel,author,body,created) VALUES(?,?,?,?,?)').bind(id,c.id,uid,body,now).run();return json({ok:true});}
 if(typeof b.message!=='string')return json({error:'Choose a message.'},400);const m=await db().prepare('SELECT * FROM chat_messages WHERE id=? AND channel=?').bind(b.message,c.id).first<any>();if(!m)return json({error:'Message not found.'},404);
 if(b.action==='react'){if(!['❤️','👍','😂','🎮','🔥'].includes(b.emoji))return json({error:'Choose a reaction.'},400);const key=m.id+':'+uid+':'+b.emoji;const r=await db().prepare('SELECT id FROM chat_reactions WHERE id=?').bind(key).first();await (r?db().prepare('DELETE FROM chat_reactions WHERE id=?').bind(key):db().prepare('INSERT INTO chat_reactions VALUES(?,?,?,?)').bind(key,m.id,uid,b.emoji)).run();return json({ok:true});}
 if(b.action==='edit'){if(m.author!==uid)return json({error:'You can edit only your messages.'},403);const body=typeof b.body==='string'?b.body.trim():'';if(!body||body.length>2000)return json({error:'Messages need 1–2000 characters.'},400);await db().prepare('UPDATE chat_messages SET body=?,edited=? WHERE id=?').bind(body,now,m.id).run();}
 else if(b.action==='delete'){if(m.author!==uid&&!owner)return json({error:'Cannot delete this message.'},403);await db().batch([db().prepare('DELETE FROM chat_reactions WHERE message=?').bind(m.id),db().prepare('DELETE FROM chat_messages WHERE id=?').bind(m.id)]);}
 else if(b.action==='pin'){if(!owner)return json({error:'Only owners can pin messages.'},403);await db().prepare('UPDATE chat_messages SET pinned=? WHERE id=?').bind(m.pinned?0:1,m.id).run();}else return json({error:'Unknown action.'},400);
 return json({ok:true});
}

return {GET,POST};})(),
'/api/dev/framex':(()=>{
const config=()=>env as unknown as Record<string,string>;
const cookieName='px-framex-dev';
const cookie=(token:string,age=3600)=>`${cookieName}=${token}; Path=/api/dev; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
async function sign(value:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(config().FRAMEX_SESSION_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function authorized(req:Request){if(!config().FRAMEX_SESSION_KEY)return false;const token=githubClient(req)?(req.headers.get('x-pixel-dev-token')||''):(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';const parts=token.split('.');if(parts.length!==3||!/^\d+$/.test(parts[0])||! /^[a-f0-9]{32}$/.test(parts[1])||! /^[a-f0-9]{64}$/.test(parts[2]))return false;const expiry=Number(parts[0]);return expiry>Date.now()&&expiry<=Date.now()+3600000&&equal(await sign(parts[0]+'.'+parts[1]),parts[2])}
async function POST(req:Request){if(!sameOrigin(req))return json({error:'Invalid origin.'},403);const body=await parseBody(req);if(typeof body?.password!=='string'||body.password.length>128)return json({error:'Enter the developer password.'},400);if(await limited(req,'framex-dev'))return json({error:'Too many attempts. Try again in 15 minutes.'},429);const cfg=config();if(!cfg.FRAMEX_PASSWORD_HASH||!cfg.FRAMEX_PASSWORD_SALT||!cfg.FRAMEX_SESSION_KEY)return json({error:'Developer access is not configured.'},503);if(!equal(await passwordHash(body.password,cfg.FRAMEX_PASSWORD_SALT),cfg.FRAMEX_PASSWORD_HASH))return json({error:'Incorrect developer password.'},401);const value=(Date.now()+3600000)+'.'+randomHex(16);const token=value+'.'+await sign(value);return githubClient(req)?json({ok:true,devToken:token}):json({ok:true},200,{'Set-Cookie':cookie(token)})}
async function DELETE(req:Request){if(!sameOrigin(req))return json({error:'Invalid origin.'},403);return json({ok:true},200,{'Set-Cookie':cookie('',0)})}
async function GET(req:Request){const allowed=await authorized(req);if(new URL(req.url).searchParams.has('status'))return json({unlocked:allowed});if(!allowed)return new Response('<!doctype html><html><body style="background:#101714;color:#d2f5df;font:18px system-ui;padding:40px"><h1>Developer access required</h1><p>Unlock FrameX TV from the arcade menu first.</p></body></html>',{status:401,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});const html='<!doctype html><html><head><meta name="referrer" content="no-referrer"><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;background:#101714}</style></head><body><iframe src="https://framextv.cc/" title="FrameX TV" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen></iframe></body></html>';if(githubClient(req))return json({html});return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-src https://framextv.cc; frame-ancestors 'self'",'X-Content-Type-Options':'nosniff'}})}

return {POST,DELETE,GET};})(),
'/api/admin':(()=>{
async function GET(req:Request){const user=await getAccount(req);if(!user)return json({error:'Sign in to an administrator account.'},401);if(!isAdmin(user))return json({error:'Administrator access is not enabled for this account.'},403);const now=Date.now(),db=env.DB!;const [totals,accounts,visits,games]=await Promise.all([
 db.prepare('SELECT (SELECT COUNT(*) FROM arcade_accounts) AS accounts,(SELECT COUNT(*) FROM site_visits WHERE seen_at>?) AS active,(SELECT COUNT(*) FROM site_visits WHERE created_at>?) AS visits24h,(SELECT COUNT(*) FROM chat_messages) AS messages').bind(now-90000,now-86400000).first(),
 db.prepare('SELECT a.username,a.created_at AS createdAt,p.name AS displayName,(SELECT MAX(v.seen_at) FROM site_visits v WHERE v.user_id=a.user_id) AS lastSeen,(SELECT COALESCE(SUM(s.seconds),0) FROM sessions s WHERE s.user_id=a.user_id) AS playtime FROM arcade_accounts a LEFT JOIN players p ON p.user_id=a.user_id ORDER BY a.created_at DESC LIMIT 200').all(),
 db.prepare('SELECT v.page,v.created_at AS startedAt,v.seen_at AS lastSeen,a.username FROM site_visits v LEFT JOIN arcade_accounts a ON a.user_id=v.user_id WHERE v.seen_at>? ORDER BY v.seen_at DESC LIMIT 200').bind(now-30*86400000).all(),
 db.prepare('SELECT game_id AS gameId,MAX(game_name) AS name,COUNT(*) AS sessions,SUM(seconds) AS seconds FROM sessions GROUP BY game_id ORDER BY seconds DESC LIMIT 20').all()]);
 return json({totals,accounts:accounts.results,visits:visits.results,games:games.results,generatedAt:now,retentionDays:30})}

return {GET};})(),
'/api/activity':(()=>{
const pages=new Set(['home','all','mini','big','tv','music','custom','chat','apps','browser','notes','community','calculator','chess','ai','admin']);
async function POST(req:Request){if(!sameOrigin(req))return json({error:'Invalid origin.'},403);if(await limited(req,'activity'))return json({error:'Too many activity updates.'},429);const b=await parseBody(req);if(!b||typeof b.id!=='string'||!/^[a-f0-9-]{36}$/i.test(b.id)||!pages.has(b.page))return json({error:'Invalid activity.'},400);const user=await getAccount(req),now=Date.now();await env.DB!.prepare('DELETE FROM site_visits WHERE seen_at<?').bind(now-30*86400000).run();await env.DB!.prepare('INSERT INTO site_visits(id,user_id,page,created_at,seen_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET user_id=COALESCE(excluded.user_id,site_visits.user_id),page=excluded.page,seen_at=excluded.seen_at').bind(b.id,user?.userId||null,b.page,now,now).run();return json({ok:true})}

return {POST};})()};
const path=new URL(request.url).pathname,github=request.headers.get('origin')===GITHUB_ORIGIN;
if(github&&request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders()});
const fn=routes[path]?.[request.method];let response:Response;
try{response=fn?await fn(request):Response.json({error:'Not found.'},{status:404})}catch{return Response.json({error:'Service error.'},{status:500,headers:github?corsHeaders():{}})}
if(github&&githubClient(request)){const headers=new Headers(response.headers);for(const [key,value]of Object.entries(corsHeaders()))headers.set(key,value);headers.delete('set-cookie');return new Response(response.body,{status:response.status,headers})}return response;
}};
