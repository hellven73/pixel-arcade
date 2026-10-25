// Portable Pixel API Worker. Bind D1 as DB. No runtime secrets are included.
// Admin: PIXEL_ADMIN_USERNAME. Developer TV: FRAMEX_PASSWORD_HASH, FRAMEX_PASSWORD_SALT, FRAMEX_SESSION_KEY.
import {Chess} from './backend-chess-engine.js';
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
async function limited(req:Request,action:string,username=''){const ip=req.headers.get('cf-connecting-ip')||'local-preview';const key=await digest(action+':'+ip+':'+username),now=Date.now(),max=action.startsWith('recovery-')?5:action==='party-move'?600:action==='social-dm'?180:action.startsWith('social-')?90:action==='activity'?240:action==='register'?6:action==='chat-typing'?600:action==='chat-send'?180:action.startsWith('chat-')?90:15;await env.DB!.prepare('INSERT INTO auth_limits(key,attempts,resets_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN resets_at<=? THEN 1 ELSE attempts+1 END,resets_at=CASE WHEN resets_at<=? THEN excluded.resets_at ELSE resets_at END').bind(key,now+15*60*1000,now,now).run();const row=await env.DB!.prepare('SELECT attempts FROM auth_limits WHERE key=?').bind(key).first<{attempts:number}>();return (row?.attempts||0)>max}
async function parseBody(req:Request){if(!(req.headers.get('content-type')||'').startsWith('application/json'))return null;const value=await req.text();if(value.length>4096)return null;try{return JSON.parse(value)}catch{return null}}

function isAdmin(user:{username:string}|null){const configured=String((env as unknown as Record<string,string>).PIXEL_ADMIN_USERNAME||'').trim().toLowerCase();return !!user&&/^[a-z0-9_]{3,24}$/.test(configured)&&user.username===configured}
const PUBLIC_LOBBY_ID='pixel-public-lobby';
const PUBLIC_CHANNEL_ID='pixel-public-general';
async function ensurePublicLobby(user:{userId:string}){const joined=await env.DB!.prepare('SELECT id FROM chat_members WHERE server=? AND user=?').bind(PUBLIC_LOBBY_ID,user.userId).first();if(joined)return;await env.DB!.batch([env.DB!.prepare('INSERT OR IGNORE INTO chat_servers(id,name,owner,invite) VALUES(?,?,?,?)').bind(PUBLIC_LOBBY_ID,'Pixel Community','system:public-lobby','public-lobby-not-an-invite'),env.DB!.prepare('INSERT OR IGNORE INTO chat_channels(id,server,name) VALUES(?,?,?)').bind(PUBLIC_CHANNEL_ID,PUBLIC_LOBBY_ID,'general'),env.DB!.prepare('INSERT OR IGNORE INTO chat_members(id,server,user,seen,typing) VALUES(?,?,?,?,NULL)').bind(PUBLIC_LOBBY_ID+':'+user.userId,PUBLIC_LOBBY_ID,user.userId,Date.now())])}



const sql=()=>env.DB!;
const pair=(a:string,b:string)=>[a,b].sort().join(':');
const accountByName=(n:string)=>sql().prepare('SELECT user_id AS userId,username FROM arcade_accounts WHERE username=?').bind(String(n||'').toLowerCase()).first<any>();
async function blocked(a:string,b:string){return !!await sql().prepare('SELECT id FROM user_blocks WHERE (blocker=? AND blocked=?) OR (blocker=? AND blocked=?)').bind(a,b,b,a).first()}
async function friends(a:string,b:string){return !await blocked(a,b)&&!!await sql().prepare("SELECT id FROM friendships WHERE id=? AND status='accepted'").bind(pair(a,b)).first()}
async function restriction(u:any){if(isAdmin(u))return null;const r=await sql().prepare('SELECT banned,muted_until,reason FROM moderation_actions WHERE user_id=?').bind(u.userId).first<any>();return r&&(r.banned||r.muted_until>Date.now())?(r.banned?'This account is suspended from community features.':'This account is muted until '+new Date(r.muted_until).toISOString()+'.'):null}
async function publicProfile(id:string){return sql().prepare("SELECT a.user_id AS userId,a.username,COALESCE(p.name,a.username) AS name,COALESCE(s.bio,'') AS bio,COALESCE(s.avatar,'✦') AS avatar,COALESCE(s.accent,'#9b9fff') AS accent,COALESCE(s.banner,'aurora') AS banner,a.created_at AS joined FROM arcade_accounts a LEFT JOIN players p ON p.user_id=a.user_id LEFT JOIN social_profiles s ON s.user_id=a.user_id WHERE a.user_id=?").bind(id).first<any>()}

// @ts-nocheck

const supported=['chess','ttt','connect','dots-boxes'];
function initial(game){return {turn:1,winner:null,finished:false,moves:0,...(game==='chess'?{pgn:''}:game==='dots-boxes'?{edges:{},boxes:{},scores:[0,0]}:{board:Array(game==='ttt'?9:42).fill(0)})}}
function advance(game,state,move,player){const s=structuredClone(state);if(s.finished||s.turn!==player)throw Error('Wait for your turn.');if(game==='chess'){const c=new Chess();if(s.pgn)c.loadPgn(s.pgn);let m;try{m=c.move({from:move.from,to:move.to,promotion:['q','r','b','n'].includes(move.promotion)?move.promotion:'q'})}catch{}if(!m)throw Error('Illegal chess move.');s.pgn=c.pgn();s.turn=c.turn()==='w'?1:2;s.finished=c.isGameOver();s.winner=c.isCheckmate()?player:s.finished?0:null}else if(game==='dots-boxes'){const key=move.edge;if(typeof key!=='string'||!/^([hv])-([0-4])-([0-4])$/.test(key))throw Error('Choose an edge.');const [d,r0,c0]=key.split('-'),r=+r0,col=+c0;if((d==='h'&&col>=4)||(d==='v'&&r>=4)||s.edges[key])throw Error('Choose an unused edge.');s.edges[key]=player;let gained=0;for(let y=0;y<4;y++)for(let x=0;x<4;x++){const id=y+'-'+x;if(!s.boxes[id]&&['h-'+y+'-'+x,'h-'+(y+1)+'-'+x,'v-'+y+'-'+x,'v-'+y+'-'+(x+1)].every(e=>s.edges[e])){s.boxes[id]=player;s.scores[player-1]++;gained++}}if(!gained)s.turn=3-player;if(s.scores[0]+s.scores[1]===16){s.finished=true;s.winner=s.scores[0]===s.scores[1]?0:s.scores[0]>s.scores[1]?1:2}}else{let index=move.cell;if(game==='connect'){const col=move.column;if(!Number.isInteger(col)||col<0||col>6)throw Error('Choose a column.');index=-1;for(let r=5;r>=0;r--)if(!s.board[r*7+col]){index=r*7+col;break}}if(!Number.isInteger(index)||index<0||index>=s.board.length||s.board[index])throw Error('Choose an empty space.');s.board[index]=player;const w=game==='ttt'?3:7,h=game==='ttt'?3:6,need=game==='ttt'?3:4;let win=false;for(let r=0;r<h;r++)for(let col=0;col<w;col++)for(const [dy,dx]of [[0,1],[1,0],[1,1],[1,-1]]){let n=0;for(let k=0;k<need;k++){const y=r+dy*k,x=col+dx*k;if(y<0||y>=h||x<0||x>=w||s.board[y*w+x]!==player)break;n++}if(n===need)win=true}s.finished=win||s.board.every(Boolean);s.winner=win?player:s.finished?0:null;s.turn=3-player}s.moves++;return s}
function dayKey(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()))}
function toggle(board,cell){if(!Number.isInteger(cell)||cell<0||cell>24)throw Error('Invalid tile.');const r=Math.floor(cell/5),c=cell%5;for(const [dy,dx]of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){const y=r+dy,x=c+dx;if(y>=0&&y<5&&x>=0&&x<5)board[y*5+x]^=1}return board}
function dailyBoard(day){let seed=2166136261;for(const c of day)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;const b=Array(25).fill(0);for(let i=0;i<12;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;toggle(b,seed%25)}if(b.every(v=>!v))toggle(b,12);return b}

const routes:Record<string,any>={
"/api/auth/register":(()=>{



async function POST(req:Request){
 if(!sameOrigin(req))return json({error:'Invalid origin.'},403);
 const b=await parseBody(req);const username=typeof b?.username==='string'?b.username.trim().toLowerCase():'';const password=b?.password;
 if(!/^[a-z0-9_]{3,24}$/.test(username))return json({error:'Use 3–24 letters, numbers or underscores for your username.'},400);
 if(typeof password!=='string'||password.length<7||password.length>128)return json({error:'Use a password with 7–128 characters.'},400);
 if(await limited(req,'register'))return json({error:'Too many sign-up attempts. Try again in 15 minutes.'},429);
 const existing=await env.DB!.prepare('SELECT user_id FROM arcade_accounts WHERE username=?').bind(username).first();if(existing)return json({error:'That username is taken. Choose another.'},409);
 const userId='arcade:'+crypto.randomUUID(),salt=randomHex(16),hash=await passwordHash(password,salt),now=Date.now(),token=randomHex(),recoveryCode=randomHex(24),recoveryHash=await digest(recoveryCode);
 try{await env.DB!.batch([
 env.DB!.prepare('INSERT INTO arcade_accounts(user_id,username,password_hash,salt,created_at) VALUES(?,?,?,?,?)').bind(userId,username,hash,salt,now),
 env.DB!.prepare('INSERT INTO password_recovery(user_id,backup_hash,updated_at) VALUES(?,?,?)').bind(userId,recoveryHash,now),
 env.DB!.prepare('INSERT INTO players(user_id,name,created_at) VALUES(?,?,?)').bind(userId,b.username.trim(),now),
 env.DB!.prepare('INSERT INTO account_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(token),userId,now+(githubClient(req)?GITHUB_SESSION_TTL:ACCOUNT_TTL)*1000)
 ])}catch(error){if(String(error).includes('UNIQUE'))return json({error:'That username is taken. Choose another.'},409);throw error}
 if(githubClient(req))return json({ok:true,recoveryCode:recoveryCode.match(/.{8}/g)!.join('-'),token,expiresAt:now+GITHUB_SESSION_TTL*1000},201);
 return json({ok:true,recoveryCode:recoveryCode.match(/.{8}/g)!.join('-')},201,{'Set-Cookie':sessionCookie(req,token)});
}

return {POST};})(),
"/api/auth/login":(()=>{



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
"/api/auth/logout":(()=>{


async function POST(req:Request){if(!sameOrigin(req))return json({error:'Invalid origin.'},403);const token=tokenFrom(req);if(token)await env.DB!.prepare('DELETE FROM account_tokens WHERE token_hash=?').bind(await digest(token)).run();return json({ok:true},200,{'Set-Cookie':sessionCookie(req,'',0)})}

return {POST};})(),
"/api/auth/recovery":(()=>{


const newCode=()=>randomHex(24).match(/.{8}/g)!.join('-');
const invalid=()=>json({error:'The username or recovery code is invalid, expired or already used.'},400);
async function POST(req:Request){
 if(!sameOrigin(req))return json({error:'Invalid origin.'},403);const b=await parseBody(req);if(!b||!['setup','change','reset','issue'].includes(b.action))return json({error:'Invalid request.'},400);
 if(await limited(req,'recovery-ip'))return json({error:'Too many recovery attempts. Try again in 15 minutes.'},429);
 const db=env.DB!,now=Date.now();let target:any,condition='',conditionArgs:any[]=[];
 if(b.action==='reset'){
 const username=typeof b.username==='string'?b.username.trim().toLowerCase():'';
 if(await limited(req,'recovery-user',username))return json({error:'Too many recovery attempts. Try again in 15 minutes.'},429);
 if(!/^[a-z0-9_]{3,24}$/.test(username)||typeof b.code!=='string'||!/^[a-f0-9-]{48,64}$/i.test(b.code.trim()))return invalid();const code=b.code.trim().replace(/-/g,'').toLowerCase();if(code.length!==48)return invalid();
 const hash=await digest(code);target=await db.prepare('SELECT a.user_id,a.password_hash FROM arcade_accounts a JOIN password_recovery r ON r.user_id=a.user_id WHERE a.username=? AND (r.backup_hash=? OR (r.reset_hash=? AND r.reset_expires>?))').bind(username,hash,hash,now).first<any>();if(!target)return invalid();
 condition=' AND EXISTS(SELECT 1 FROM password_recovery r WHERE r.user_id=arcade_accounts.user_id AND (r.backup_hash=? OR (r.reset_hash=? AND r.reset_expires>?)))';conditionArgs=[hash,hash,now];
 }else{
 const user=await getAccount(req);if(!user)return json({error:'Sign in before managing account security.'},401);
 if(typeof b.currentPassword!=='string'||b.currentPassword.length>128)return json({error:'Confirm your current password.'},400);
 const account=await db.prepare('SELECT user_id,password_hash,salt FROM arcade_accounts WHERE user_id=?').bind(user.userId).first<any>();if(!account||!equal(await passwordHash(b.currentPassword,account.salt),account.password_hash))return json({error:'Current password is incorrect.'},403);
 target=account;
 if(b.action==='issue'){
 if(!isAdmin(user))return json({error:'Administrator access required.'},403);if(b.verified!==true)return json({error:'Verify the player’s identity before issuing a reset code.'},400);
 const username=typeof b.username==='string'?b.username.trim().toLowerCase():'';const other=await db.prepare('SELECT user_id,username FROM arcade_accounts WHERE username=?').bind(username).first<any>();if(!other)return json({error:'Account not found.'},404);if(isAdmin(other))return json({error:'Administrators must use their own saved recovery code or current password.'},403);
 const code=newCode(),expiresAt=now+15*60000,codeHash=await digest(code.replace(/-/g,''));await db.batch([db.prepare("INSERT INTO password_recovery(user_id,backup_hash,reset_hash,reset_expires,updated_at) VALUES(?,'',?,?,?) ON CONFLICT(user_id) DO UPDATE SET reset_hash=excluded.reset_hash,reset_expires=excluded.reset_expires,updated_at=excluded.updated_at").bind(other.user_id,codeHash,expiresAt,now),db.prepare('INSERT INTO recovery_audit VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),user.userId,other.user_id,'admin-issued',now)]);return json({ok:true,resetCode:code,username:other.username,expiresAt});
 }
 if(b.action==='setup'){
 const code=newCode(),hash=await digest(code.replace(/-/g,''));const result=await db.prepare('INSERT INTO password_recovery(user_id,backup_hash,reset_hash,reset_expires,updated_at) SELECT user_id,?,NULL,NULL,? FROM arcade_accounts WHERE user_id=? AND password_hash=? ON CONFLICT(user_id) DO UPDATE SET backup_hash=excluded.backup_hash,reset_hash=NULL,reset_expires=NULL,updated_at=excluded.updated_at WHERE EXISTS(SELECT 1 FROM arcade_accounts a WHERE a.user_id=excluded.user_id AND a.password_hash=?)').bind(hash,now,user.userId,account.password_hash,account.password_hash).run();if(!(result.meta?.changes||result.changes))return json({error:'Your account changed. Sign in and try again.'},409);return json({ok:true,recoveryCode:code});
 }
 condition=' AND password_hash=?';conditionArgs=[account.password_hash];
 }
 if(typeof b.newPassword!=='string'||b.newPassword.length<7||b.newPassword.length>128)return json({error:'Use a new password with 7–128 characters.'},400);
 const salt=randomHex(16),hash=await passwordHash(b.newPassword,salt),code=newCode(),backupHash=await digest(code.replace(/-/g,''));
 const results=await db.batch([
 db.prepare('UPDATE arcade_accounts SET password_hash=?,salt=? WHERE user_id=?'+condition).bind(hash,salt,target.user_id,...conditionArgs),
 db.prepare('DELETE FROM account_tokens WHERE user_id=? AND EXISTS(SELECT 1 FROM arcade_accounts a WHERE a.user_id=? AND a.password_hash=?)').bind(target.user_id,target.user_id,hash),
 db.prepare('INSERT INTO password_recovery(user_id,backup_hash,reset_hash,reset_expires,updated_at) SELECT user_id,?,NULL,NULL,? FROM arcade_accounts WHERE user_id=? AND password_hash=? ON CONFLICT(user_id) DO UPDATE SET backup_hash=excluded.backup_hash,reset_hash=NULL,reset_expires=NULL,updated_at=excluded.updated_at').bind(backupHash,now,target.user_id,hash),
 db.prepare('INSERT INTO recovery_audit(id,actor,target,event,created_at) SELECT ?,user_id,user_id,?,? FROM arcade_accounts WHERE user_id=? AND password_hash=?').bind(crypto.randomUUID(),b.action==='reset'?'code-reset':'password-change',now,target.user_id,hash)
 ]);
 if(!(results[0].meta?.changes||results[0].changes))return invalid();return json({ok:true,recoveryCode:code,signedOut:true},200,{'Set-Cookie':sessionCookie(req,'',0)});
}

return {POST};})(),
"/api/profile":(()=>{



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
"/api/session":(()=>{



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
"/api/chat":(()=>{



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
 const q=(url.searchParams.get('q')||'').slice(0,80);messages=(await db().prepare('SELECT m.*,a.username FROM chat_messages m JOIN arcade_accounts a ON a.user_id=m.author WHERE m.channel=? AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker=? AND b.blocked=m.author) OR (b.blocker=m.author AND b.blocked=?)) AND (? = \'\' OR instr(lower(m.body),lower(?))>0) ORDER BY m.created DESC,m.id DESC LIMIT 100').bind(channel,user.userId,user.userId,q,q).all()).results.reverse();
 reactions=(await db().prepare('SELECT r.* FROM chat_reactions r JOIN chat_messages m ON r.message=m.id WHERE m.channel=? ORDER BY m.created DESC LIMIT 1000').bind(channel).all()).results;
 }const settings=await db().prepare('SELECT slow_seconds FROM chat_settings WHERE server=?').bind(server).first<any>();return json({user,servers,restriction:await restriction(user),server:{...s,isPublic:s.id===PUBLIC_LOBBY_ID,slowSeconds:settings?.slow_seconds||0,canModerate:s.owner===user.userId||isAdmin(user),invite:s.owner===user.userId?s.invite:undefined},channels,members,messages,reactions});
}
async function POST(req:Request){
 if(!sameOrigin(req))return json({error:'Invalid origin.'},403);const user=await getAccount(req);if(!user)return json({error:'Log in to chat.'},401);
 await ensurePublicLobby(user);const b=await parseBody(req);if(!b||typeof b.action!=='string')return json({error:'Invalid request.'},400);
 // Separate actions have independent limits; normal polling is read-only.
 if(await limited(req,'chat-'+b.action,user.userId))return json({error:'Slow down a little. Try again in a few minutes.'},429);
 if(['create','join'].includes(b.action)){const deny=await restriction(user);if(deny)return json({error:deny},403)}
 const uid=user.userId,id=crypto.randomUUID(),now=Date.now(),name=typeof b.name==='string'?b.name.trim().slice(0,40):'';
 if(b.action==='create'){if(!name)return json({error:'Name your server.'},400);const count=await db().prepare('SELECT COUNT(*) AS n FROM chat_members WHERE user=?').bind(uid).first<any>();if(count.n>=30)return json({error:'You can join up to 30 servers.'},400);await db().batch([db().prepare('INSERT INTO chat_servers VALUES(?,?,?,?)').bind(id,name,uid,randomHex(16)),db().prepare('INSERT INTO chat_members VALUES(?,?,?,?,NULL)').bind(id+':'+uid,id,uid,now),db().prepare('INSERT INTO chat_channels VALUES(?,?,?)').bind(crypto.randomUUID(),id,'general')]);return json({ok:true,server:id});}
 if(b.action==='join'){if(typeof b.invite!=='string'||!/^[a-f0-9]{32}$/.test(b.invite))return json({error:'Invalid invite code.'},400);const s=await db().prepare('SELECT id FROM chat_servers WHERE invite=?').bind(b.invite).first<any>();if(!s)return json({error:'Invite not found.'},404);const count=await db().prepare('SELECT COUNT(*) AS n FROM chat_members WHERE user=?').bind(uid).first<any>();if(count.n>=30)return json({error:'You can join up to 30 servers.'},400);await db().prepare('INSERT OR IGNORE INTO chat_members VALUES(?,?,?,?,NULL)').bind(s.id+':'+uid,s.id,uid,now).run();return json({ok:true,server:s.id});}
 if(typeof b.server!=='string')return json({error:'Choose a server.'},400);const s=await member(b.server,uid);if(!s)return json({error:'Server access denied.'},403);const owner=s.owner===uid||isAdmin(user);if(s.id===PUBLIC_LOBBY_ID&&['leave','kick','invite'].includes(b.action))return json({error:'The public community lobby is joined automatically and cannot be left or invite-managed.'},403);
 if(b.action==='channel'){if(!owner)return json({error:'Only the server owner can create channels.'},403);if(!name)return json({error:'Name your channel.'},400);await db().prepare('INSERT INTO chat_channels VALUES(?,?,?)').bind(id,s.id,name).run();return json({ok:true,channel:id});}
 if(b.action==='invite'){if(!owner)return json({error:'Owner access required.'},403);await db().prepare('UPDATE chat_servers SET invite=? WHERE id=?').bind(randomHex(16),s.id).run();return json({ok:true});}
 if(b.action==='kick'||b.action==='leave'){const target=b.action==='leave'?uid:b.user;if(typeof target!=='string'||(!owner&&target!==uid)||target===s.owner)return json({error:'Cannot remove this member.'},403);await db().prepare('DELETE FROM chat_members WHERE server=? AND user=?').bind(s.id,target).run();return json({ok:true});}
 if(typeof b.channel!=='string')return json({error:'Choose a channel.'},400);const c=await db().prepare('SELECT id FROM chat_channels WHERE id=? AND server=?').bind(b.channel,s.id).first();if(!c)return json({error:'Channel access denied.'},403);
 if(b.action==='typing'){await db().prepare('UPDATE chat_members SET typing=?,seen=? WHERE server=? AND user=?').bind(b.active?b.channel+'|'+now:null,now,s.id,uid).run();return json({ok:true});}
 if(['send','edit','react','typing','create','join','channel'].includes(b.action)){const deny=await restriction(user);if(deny)return json({error:deny},403)}
 if(b.action==='send'){const setting=await db().prepare('SELECT slow_seconds FROM chat_settings WHERE server=?').bind(s.id).first<any>();if(setting?.slow_seconds&&!owner){const last=await db().prepare('SELECT m.created FROM chat_messages m JOIN chat_channels c ON c.id=m.channel WHERE c.server=? AND m.author=? ORDER BY m.created DESC LIMIT 1').bind(s.id,uid).first<any>();if(last&&now-last.created<setting.slow_seconds*1000)return json({error:'Slow mode: wait '+setting.slow_seconds+' seconds between messages.'},429)}const body=typeof b.body==='string'?b.body.trim():'';if(!body||body.length>2000)return json({error:'Messages need 1–2000 characters.'},400);const recent=await db().prepare('SELECT created FROM chat_messages WHERE author=? ORDER BY created DESC LIMIT 1').bind(uid).first<any>();if(recent&&now-recent.created<800)return json({error:'Wait a moment before sending again.'},429);await db().prepare('INSERT INTO chat_messages(id,channel,author,body,created) VALUES(?,?,?,?,?)').bind(id,c.id,uid,body,now).run();return json({ok:true});}
 if(typeof b.message!=='string')return json({error:'Choose a message.'},400);const m=await db().prepare('SELECT * FROM chat_messages WHERE id=? AND channel=?').bind(b.message,c.id).first<any>();if(!m)return json({error:'Message not found.'},404);
 if(b.action==='react'){if(!['❤️','👍','😂','🎮','🔥'].includes(b.emoji))return json({error:'Choose a reaction.'},400);const key=m.id+':'+uid+':'+b.emoji;const r=await db().prepare('SELECT id FROM chat_reactions WHERE id=?').bind(key).first();await (r?db().prepare('DELETE FROM chat_reactions WHERE id=?').bind(key):db().prepare('INSERT INTO chat_reactions VALUES(?,?,?,?)').bind(key,m.id,uid,b.emoji)).run();return json({ok:true});}
 if(b.action==='edit'){if(m.author!==uid)return json({error:'You can edit only your messages.'},403);const body=typeof b.body==='string'?b.body.trim():'';if(!body||body.length>2000)return json({error:'Messages need 1–2000 characters.'},400);await db().prepare('UPDATE chat_messages SET body=?,edited=? WHERE id=?').bind(body,now,m.id).run();}
 else if(b.action==='delete'){if(m.author!==uid&&!owner)return json({error:'Cannot delete this message.'},403);await db().batch([db().prepare('DELETE FROM chat_reactions WHERE message=?').bind(m.id),db().prepare('DELETE FROM chat_messages WHERE id=?').bind(m.id)]);}
 else if(b.action==='pin'){if(!owner)return json({error:'Only owners can pin messages.'},403);await db().prepare('UPDATE chat_messages SET pinned=? WHERE id=?').bind(m.pinned?0:1,m.id).run();}else return json({error:'Unknown action.'},400);
 return json({ok:true});
}

return {GET,POST};})(),
"/api/dev/framex":(()=>{



const config=()=>env as unknown as Record<string,string>;
const cookieName='px-framex-dev';
const cookie=(token:string,age=3600)=>`${cookieName}=${token}; Path=/api/dev; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
async function sign(value:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(config().FRAMEX_SESSION_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function authorized(req:Request){if(!config().FRAMEX_SESSION_KEY)return false;const token=githubClient(req)?(req.headers.get('x-pixel-dev-token')||''):(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';const parts=token.split('.');if(parts.length!==3||!/^\d+$/.test(parts[0])||! /^[a-f0-9]{32}$/.test(parts[1])||! /^[a-f0-9]{64}$/.test(parts[2]))return false;const expiry=Number(parts[0]);return expiry>Date.now()&&expiry<=Date.now()+3600000&&equal(await sign(parts[0]+'.'+parts[1]),parts[2])}
async function POST(req:Request){if(!sameOrigin(req))return json({error:'Invalid origin.'},403);const body=await parseBody(req);if(typeof body?.password!=='string'||body.password.length>128)return json({error:'Enter the developer password.'},400);if(await limited(req,'framex-dev'))return json({error:'Too many attempts. Try again in 15 minutes.'},429);const cfg=config();if(!cfg.FRAMEX_PASSWORD_HASH||!cfg.FRAMEX_PASSWORD_SALT||!cfg.FRAMEX_SESSION_KEY)return json({error:'Developer access is not configured.'},503);if(!equal(await passwordHash(body.password,cfg.FRAMEX_PASSWORD_SALT),cfg.FRAMEX_PASSWORD_HASH))return json({error:'Incorrect developer password.'},401);const value=(Date.now()+3600000)+'.'+randomHex(16);const token=value+'.'+await sign(value);return githubClient(req)?json({ok:true,devToken:token}):json({ok:true},200,{'Set-Cookie':cookie(token)})}
async function DELETE(req:Request){if(!sameOrigin(req))return json({error:'Invalid origin.'},403);return json({ok:true},200,{'Set-Cookie':cookie('',0)})}
async function GET(req:Request){const allowed=await authorized(req);if(new URL(req.url).searchParams.has('status'))return json({unlocked:allowed});if(!allowed)return new Response('<!doctype html><html><body style="background:#101714;color:#d2f5df;font:18px system-ui;padding:40px"><h1>Developer access required</h1><p>Unlock FrameX TV from the arcade menu first.</p></body></html>',{status:401,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});const html='<!doctype html><html><head><meta name="referrer" content="no-referrer"><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;background:#101714}</style></head><body><iframe src="https://framextv.cc/" title="FrameX TV" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen></iframe></body></html>';if(githubClient(req))return json({html});return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-src https://framextv.cc; frame-ancestors 'self'",'X-Content-Type-Options':'nosniff'}})}

return {POST,DELETE,GET};})(),
"/api/admin":(()=>{


async function GET(req:Request){const user=await getAccount(req);if(!user)return json({error:'Sign in to an administrator account.'},401);if(!isAdmin(user))return json({error:'Administrator access is not enabled for this account.'},403);const now=Date.now(),db=env.DB!;const [totals,accounts,visits,games]=await Promise.all([
 db.prepare('SELECT (SELECT COUNT(*) FROM arcade_accounts) AS accounts,(SELECT COUNT(*) FROM site_visits WHERE seen_at>?) AS active,(SELECT COUNT(*) FROM site_visits WHERE created_at>?) AS visits24h,(SELECT COUNT(*) FROM chat_messages) AS messages').bind(now-90000,now-86400000).first(),
 db.prepare('SELECT a.username,a.created_at AS createdAt,p.name AS displayName,(SELECT MAX(v.seen_at) FROM site_visits v WHERE v.user_id=a.user_id) AS lastSeen,(SELECT COALESCE(SUM(s.seconds),0) FROM sessions s WHERE s.user_id=a.user_id) AS playtime FROM arcade_accounts a LEFT JOIN players p ON p.user_id=a.user_id ORDER BY a.created_at DESC LIMIT 200').all(),
 db.prepare('SELECT v.page,v.created_at AS startedAt,v.seen_at AS lastSeen,a.username FROM site_visits v LEFT JOIN arcade_accounts a ON a.user_id=v.user_id WHERE v.seen_at>? ORDER BY v.seen_at DESC LIMIT 200').bind(now-30*86400000).all(),
 db.prepare('SELECT game_id AS gameId,MAX(game_name) AS name,COUNT(*) AS sessions,SUM(seconds) AS seconds FROM sessions GROUP BY game_id ORDER BY seconds DESC LIMIT 20').all()]);
 return json({totals,accounts:accounts.results,visits:visits.results,games:games.results,generatedAt:now,retentionDays:30})}

return {GET};})(),
"/api/activity":(()=>{


const pages=new Set(['home','all','mini','big','tv','music','custom','chat','apps','browser','notes','community','calculator','chess','ai','admin','social','parties','challenges','moderation']);
async function POST(req:Request){if(!sameOrigin(req))return json({error:'Invalid origin.'},403);if(await limited(req,'activity'))return json({error:'Too many activity updates.'},429);const b=await parseBody(req);if(!b||typeof b.id!=='string'||!/^[a-f0-9-]{36}$/i.test(b.id)||!pages.has(b.page))return json({error:'Invalid activity.'},400);const user=await getAccount(req),now=Date.now();await env.DB!.prepare('DELETE FROM site_visits WHERE seen_at<?').bind(now-30*86400000).run();await env.DB!.prepare('INSERT INTO site_visits(id,user_id,page,created_at,seen_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET user_id=COALESCE(excluded.user_id,site_visits.user_id),page=excluded.page,seen_at=excluded.seen_at').bind(b.id,user?.userId||null,b.page,now,now).run();return json({ok:true})}

return {POST};})(),
"/api/social":(()=>{


async function GET(req:Request){const u=await getAccount(req);if(!u)return json({error:'Sign in to use friends and messages.'},401);const q=new URL(req.url).searchParams,target=q.get('username');if(target){const t=await accountByName(target);if(!t)return json({error:'Player not found.'},404);if(t.userId!==u.userId&&await blocked(u.userId,t.userId))return json({error:'This profile is unavailable.'},403);return json({profile:await publicProfile(t.userId)})}const [links,blocks]=await Promise.all([sql().prepare('SELECT f.*,a.username FROM friendships f JOIN arcade_accounts a ON a.user_id=CASE WHEN f.sender=? THEN f.receiver ELSE f.sender END WHERE f.sender=? OR f.receiver=? ORDER BY f.created DESC LIMIT 200').bind(u.userId,u.userId,u.userId).all(),sql().prepare('SELECT b.blocked AS userId,a.username FROM user_blocks b JOIN arcade_accounts a ON a.user_id=b.blocked WHERE b.blocker=?').bind(u.userId).all()]);let messages:any[]=[];const withUser=q.get('with');if(withUser){const t=await accountByName(withUser);if(!t||!await friends(u.userId,t.userId))return json({error:'DMs are available between accepted friends only.'},403);messages=(await sql().prepare('SELECT m.*,a.username FROM direct_messages m JOIN arcade_accounts a ON a.user_id=m.sender WHERE (m.sender=? AND m.receiver=?) OR (m.sender=? AND m.receiver=?) ORDER BY m.created DESC,m.id DESC LIMIT 100').bind(u.userId,t.userId,t.userId,u.userId).all()).results.reverse()}return json({user:u,profile:await publicProfile(u.userId),links:links.results,blocks:blocks.results,messages,restriction:await restriction(u)})}
async function POST(req:Request){if(!sameOrigin(req))return json({error:'Invalid origin.'},403);const u=await getAccount(req);if(!u)return json({error:'Sign in first.'},401);const b=await parseBody(req);if(!b||typeof b.action!=='string')return json({error:'Invalid request.'},400);if(await limited(req,'social-'+b.action,u.userId))return json({error:'Too many requests. Try again later.'},429);const uid=u.userId,now=Date.now();
if(b.action==='profile'){const name=String(b.name||'').trim(),bio=String(b.bio||'').trim(),avatar=String(b.avatar||''),accent=String(b.accent||''),banner=String(b.banner||'');if(name.length<2||name.length>24||bio.length>240||!['✦','🐱','🦊','🐼','🐸','👾','🎮','♞','🌙','⚡','🌸','🚀'].includes(avatar)||!/^#[0-9a-f]{6}$/i.test(accent)||!['aurora','sunset','ocean','midnight'].includes(banner))return json({error:'Check your profile fields.'},400);await sql().batch([sql().prepare('INSERT INTO players VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET name=excluded.name').bind(uid,name,now),sql().prepare('INSERT INTO social_profiles VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET bio=excluded.bio,avatar=excluded.avatar,accent=excluded.accent,banner=excluded.banner').bind(uid,bio,avatar,accent,banner)]);return json({ok:true})}
const t=await accountByName(b.username);if(!t||t.userId===uid)return json({error:'Choose another registered player.'},400);const tid=t.userId,id=pair(uid,tid);
if(b.action==='block'){await sql().batch([sql().prepare('INSERT OR IGNORE INTO user_blocks VALUES(?,?,?)').bind(uid+':'+tid,uid,tid),sql().prepare('DELETE FROM friendships WHERE id=?').bind(id)]);return json({ok:true})}
if(b.action==='unblock'){await sql().prepare('DELETE FROM user_blocks WHERE blocker=? AND blocked=?').bind(uid,tid).run();return json({ok:true})}
if(await blocked(uid,tid))return json({error:'This interaction is unavailable.'},403);
if(b.action==='request'){const r=await restriction(u);if(r)return json({error:r},403);const count=await sql().prepare('SELECT COUNT(*) AS n FROM friendships WHERE sender=? OR receiver=?').bind(uid,uid).first<any>();if(count.n>=200)return json({error:'Friend list limit reached.'},400);const old=await sql().prepare('SELECT id FROM friendships WHERE id=?').bind(id).first();if(old)return json({error:'A request or friendship already exists.'},409);await sql().prepare("INSERT INTO friendships VALUES(?,?,?,'pending',?)").bind(id,uid,tid,now).run();return json({ok:true})}
if(b.action==='accept'){const r=await sql().prepare("UPDATE friendships SET status='accepted' WHERE id=? AND receiver=? AND status='pending'").bind(id,uid).run();return json({ok:true})}
if(b.action==='remove'){await sql().prepare('DELETE FROM friendships WHERE id=? AND (sender=? OR receiver=?)').bind(id,uid,uid).run();return json({ok:true})}
if(b.action==='dm'){const r=await restriction(u);if(r)return json({error:r},403);if(!await friends(uid,tid))return json({error:'Accept the friend request before messaging.'},403);const body=typeof b.body==='string'?b.body.trim():'';if(!body||body.length>2000)return json({error:'Messages need 1–2000 characters.'},400);const last=await sql().prepare('SELECT created FROM direct_messages WHERE sender=? ORDER BY created DESC LIMIT 1').bind(uid).first<any>();if(last&&now-last.created<800)return json({error:'Wait a moment before sending again.'},429);await sql().prepare('INSERT INTO direct_messages VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),uid,tid,body,now).run();return json({ok:true})}
return json({error:'Unknown action.'},400)}

return {GET,POST};})(),
"/api/party":(()=>{



async function room(code:string){return sql().prepare('SELECT * FROM party_rooms WHERE code=? AND expires>?').bind(String(code||'').toUpperCase(),Date.now()).first<any>()}
async function response(r:any,uid:string){const [host,guest]=await Promise.all([sql().prepare('SELECT username FROM arcade_accounts WHERE user_id=?').bind(r.host).first<any>(),r.guest?sql().prepare('SELECT username FROM arcade_accounts WHERE user_id=?').bind(r.guest).first<any>():null]);return {code:r.code,game:r.game,host:host?.username,guest:guest?.username||null,player:r.host===uid?1:2,state:JSON.parse(r.state),version:r.version,expires:r.expires}}
async function GET(req:Request){const u=await getAccount(req);if(!u)return json({error:'Sign in to join a party.'},401);const code=new URL(req.url).searchParams.get('code');if(!code){const list=await sql().prepare('SELECT code,game,expires FROM party_rooms WHERE (host=? OR guest=?) AND expires>? ORDER BY updated DESC LIMIT 20').bind(u.userId,u.userId,Date.now()).all();return json({rooms:list.results,supported})}const r=await room(code);if(!r||![r.host,r.guest].includes(u.userId))return json({error:'Room unavailable. Join using its code first.'},403);if(r.guest&&await blocked(r.host,r.guest))return json({error:'This room is unavailable.'},403);return json(await response(r,u.userId))}
async function POST(req:Request){if(!sameOrigin(req))return json({error:'Invalid origin.'},403);const u=await getAccount(req);if(!u)return json({error:'Sign in first.'},401);const denied=await restriction(u);if(denied)return json({error:denied},403);const b=await parseBody(req);if(!b||await limited(req,'party-'+b.action,u.userId))return json({error:'Too many actions.'},429);const now=Date.now();if(b.action==='create'){if(!supported.includes(b.game))return json({error:'This game has no integrated online room support.'},400);const count=await sql().prepare("SELECT COUNT(*) AS n FROM party_rooms WHERE host=? AND expires>? AND json_extract(state,'$.finished')=0").bind(u.userId,now).first<any>();if(count.n>=10)return json({error:'You already have 10 active rooms. Leave one first.'},400);const code=crypto.randomUUID().replace(/-/g,'').slice(0,10).toUpperCase();await sql().prepare('INSERT INTO party_rooms VALUES(?,?,?,?,?,?,0,?,?,?)').bind(crypto.randomUUID(),code,b.game,u.userId,null,JSON.stringify(initial(b.game)),now,now,now+86400000).run();return json({code},201)}const r=await room(b.code);if(!r)return json({error:'Room expired or not found.'},404);if(b.action==='join'){if(r.host===u.userId||r.guest===u.userId)return json({code:r.code});if(r.guest)return json({error:'This room is full.'},409);if(await blocked(r.host,u.userId))return json({error:'This room is unavailable.'},403);const result=await sql().prepare('UPDATE party_rooms SET guest=?,version=version+1,updated=? WHERE id=? AND guest IS NULL').bind(u.userId,now,r.id).run();if(!result.meta?.changes&&!result.changes)return json({error:'Another player joined first.'},409);return json({code:r.code})}if(![r.host,r.guest].includes(u.userId))return json({error:'Join this room first.'},403);if(r.guest&&await blocked(r.host,r.guest))return json({error:'This room is unavailable.'},403);if(b.action==='leave'){const s=JSON.parse(r.state);if(!s.finished){s.finished=true;s.winner=null;s.aborted=true;await sql().prepare('UPDATE party_rooms SET state=?,version=version+1,expires=?,updated=? WHERE id=? AND version=?').bind(JSON.stringify(s),now+60000,now,r.id,r.version).run()}return json({ok:true})}if(b.action!=='move'||!r.guest)return json({error:'Wait for another player to join.'},400);if(b.version!==r.version)return json({error:'The board changed. Refresh and try again.'},409);let state;try{state=advance(r.game,JSON.parse(r.state),b.move||{},r.host===u.userId?1:2)}catch(e:any){return json({error:e.message},400)}const result=await sql().prepare('UPDATE party_rooms SET state=?,version=version+1,updated=? WHERE id=? AND version=?').bind(JSON.stringify(state),now,r.id,r.version).run();if(!result.meta?.changes&&!result.changes)return json({error:'The board changed. Refresh and try again.'},409);return json({ok:true})}

return {GET,POST};})(),
"/api/challenges":(()=>{



async function GET(req:Request){const day=dayKey(),u=await getAccount(req);const [daily,all,mine]=await Promise.all([sql().prepare('SELECT a.username,s.moves,s.points FROM daily_scores s JOIN arcade_accounts a ON a.user_id=s.user_id LEFT JOIN moderation_actions m ON m.user_id=s.user_id WHERE s.day=? AND COALESCE(m.banned,0)=0 ORDER BY s.moves,s.created LIMIT 50').bind(day).all(),sql().prepare('SELECT a.username,SUM(s.points) AS points,COUNT(*) AS days FROM daily_scores s JOIN arcade_accounts a ON a.user_id=s.user_id LEFT JOIN moderation_actions m ON m.user_id=s.user_id WHERE COALESCE(m.banned,0)=0 GROUP BY s.user_id ORDER BY points DESC,days DESC,a.username LIMIT 50').all(),u?sql().prepare('SELECT moves,points FROM daily_scores WHERE user_id=? AND day=?').bind(u.userId,day).first():null]);return json({day,timeZone:'Australia/Sydney',board:dailyBoard(day),daily:daily.results,allTime:all.results,mine,authenticated:!!u})}
async function POST(req:Request){if(!sameOrigin(req))return json({error:'Invalid origin.'},403);const u=await getAccount(req);if(!u)return json({error:'Sign in to submit your challenge.'},401);const deny=await restriction(u);if(deny)return json({error:deny},403);if(await limited(req,'challenge',u.userId))return json({error:'Too many submissions.'},429);const b=await parseBody(req),day=dayKey();if(!b||b.day!==day||!Array.isArray(b.moves)||b.moves.length<1||b.moves.length>200||!b.moves.every((x:any)=>Number.isInteger(x)&&x>=0&&x<25))return json({error:'Invalid or expired challenge. Load today’s puzzle again.'},400);const board=dailyBoard(day);for(const move of b.moves)toggle(board,move);if(board.some(Boolean))return json({error:'Switch off every light before submitting.'},400);const points=Math.max(1,1000-b.moves.length*5);await sql().prepare('INSERT INTO daily_scores VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET moves=MIN(daily_scores.moves,excluded.moves),points=MAX(daily_scores.points,excluded.points)').bind(day+':'+u.userId,u.userId,day,b.moves.length,points,Date.now()).run();return json({ok:true,moves:b.moves.length,points})}

return {GET,POST};})(),
"/api/moderation":(()=>{


async function GET(req:Request){const u=await getAccount(req);if(!u||!isAdmin(u))return json({error:'Administrator access required.'},403);const [reports,restrictions,settings]=await Promise.all([sql().prepare('SELECT r.*,a.username AS reporterName,t.username AS targetName FROM user_reports r JOIN arcade_accounts a ON a.user_id=r.reporter JOIN arcade_accounts t ON t.user_id=r.target ORDER BY r.created DESC LIMIT 200').all(),sql().prepare('SELECT m.user_id AS userId,a.username,m.muted_until AS mutedUntil,m.banned,m.reason FROM moderation_actions m JOIN arcade_accounts a ON a.user_id=m.user_id WHERE m.banned=1 OR m.muted_until>?').bind(Date.now()).all(),sql().prepare('SELECT * FROM chat_settings').all()]);return json({reports:reports.results,restrictions:restrictions.results,settings:settings.results})}
async function POST(req:Request){if(!sameOrigin(req))return json({error:'Invalid origin.'},403);const u=await getAccount(req);if(!u)return json({error:'Sign in first.'},401);const b=await parseBody(req);if(!b||await limited(req,'moderation-'+b.action,u.userId))return json({error:'Too many requests.'},429);const now=Date.now();
if(b.action==='report'){const reason=typeof b.reason==='string'?b.reason.trim():'';if(reason.length<3||reason.length>500)return json({error:'Explain the report in 3–500 characters.'},400);let target='',snapshot='',kind=String(b.kind||''),messageId=null;if(kind==='chat'){const m=await sql().prepare('SELECT m.* FROM chat_messages m JOIN chat_channels c ON c.id=m.channel JOIN chat_members cm ON cm.server=c.server WHERE m.id=? AND cm.user=?').bind(b.message,u.userId).first<any>();if(!m)return json({error:'Message unavailable.'},404);target=m.author;snapshot=m.body;messageId=m.id}else if(kind==='dm'){const m=await sql().prepare('SELECT * FROM direct_messages WHERE id=? AND (sender=? OR receiver=?)').bind(b.message,u.userId,u.userId).first<any>();if(!m)return json({error:'Message unavailable.'},404);target=m.sender;snapshot=m.body;messageId=m.id}else if(kind==='profile'){const t=await accountByName(b.username);if(!t)return json({error:'Player unavailable.'},404);target=t.userId;const p=await sql().prepare('SELECT bio FROM social_profiles WHERE user_id=?').bind(target).first<any>();snapshot=t.username+' · '+(p?.bio||'')}else return json({error:'Invalid report type.'},400);if(target===u.userId)return json({error:'You cannot report yourself.'},400);const old=await sql().prepare("SELECT id FROM user_reports WHERE reporter=? AND target=? AND COALESCE(message_id,'')=? AND status='open'").bind(u.userId,target,messageId||'').first();if(old)return json({error:'You have already reported this item.'},409);await sql().prepare("INSERT INTO user_reports(id,reporter,target,kind,message_id,snapshot,reason,status,created) VALUES(?,?,?,?,?,?,?,'open',?)").bind(crypto.randomUUID(),u.userId,target,kind,messageId,snapshot,reason,now).run();return json({ok:true})}
if(!isAdmin(u))return json({error:'Administrator access required.'},403);
if(b.action==='resolve'){if(!['resolved','dismissed'].includes(b.status))return json({error:'Invalid status.'},400);await sql().prepare('UPDATE user_reports SET status=?,reviewer=? WHERE id=?').bind(b.status,u.userId,b.id).run();return json({ok:true})}
if(b.action==='slow'){if(!Number.isInteger(b.seconds)||b.seconds<0||b.seconds>300)return json({error:'Slow mode must be 0–300 seconds.'},400);const server=await sql().prepare('SELECT id FROM chat_servers WHERE id=?').bind(b.server).first();if(!server)return json({error:'Server unavailable.'},404);await sql().prepare('INSERT INTO chat_settings VALUES(?,?) ON CONFLICT(server) DO UPDATE SET slow_seconds=excluded.slow_seconds').bind(b.server,b.seconds).run();return json({ok:true})}
if(b.action==='delete-message'){await sql().batch([sql().prepare('DELETE FROM chat_reactions WHERE message=?').bind(b.id),sql().prepare('DELETE FROM chat_messages WHERE id=?').bind(b.id)]);return json({ok:true})}
if(b.action==='restrict'){const t=await accountByName(b.username);if(!t||isAdmin(t))return json({error:'Choose a non-administrator account.'},400);if(![0,10,60,1440].includes(b.minutes)||typeof b.banned!=='boolean'||typeof b.reason!=='string'||b.reason.length>300)return json({error:'Invalid moderation action.'},400);await sql().prepare('INSERT INTO moderation_actions VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET muted_until=excluded.muted_until,banned=excluded.banned,reason=excluded.reason,actor=excluded.actor,updated=excluded.updated').bind(t.userId,b.minutes?now+b.minutes*60000:0,b.banned?1:0,b.reason,u.userId,now).run();return json({ok:true})}return json({error:'Unknown action.'},400)}

return {GET,POST};})(),
};
const endpoint=new URL(request.url).pathname,github=request.headers.get('origin')===GITHUB_ORIGIN;
if(github&&request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders()});
const fn=routes[endpoint]?.[request.method];let response:Response;
try{response=fn?await fn(request):Response.json({error:'Not found.'},{status:404})}catch{return Response.json({error:'Service error.'},{status:500,headers:github?corsHeaders():{}})}
if(github&&githubClient(request)){const headers=new Headers(response.headers);for(const [key,value]of Object.entries(corsHeaders()))headers.set(key,value);headers.delete('set-cookie');return new Response(response.body,{status:response.status,headers})}return response;
}};
