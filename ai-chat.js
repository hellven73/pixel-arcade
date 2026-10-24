import {streamAnswer} from './ai-engine.js';
const page=document.createElement('section');page.id='ai-page';page.hidden=true;
page.innerHTML=`<div class="ai-heading"><div><span class="eyebrow">A LITTLE HELP, A BIG IDEA</span><h1>Meet Pixel AI<span>✦</span></h1><p>Ask a question. Untangle an idea. Make something new.</p></div><a href="manual.html#ai">How it works ↗</a></div>
<div class="ai-workspace"><div class="ai-toolbar"><span class="ai-provider">✦ Powered by Puter AI</span><div><button id="ai-connect" disabled>Loading AI…</button><button id="ai-disconnect" hidden>Disconnect</button><button id="ai-clear">New chat</button></div></div>
<div class="ai-consent">Messages and recent conversation context are sent to Puter and its AI provider when you press Send. Your Puter allowance or credits apply. <a href="https://puter.com/dashboard" target="_blank" rel="noopener noreferrer">Check usage ↗</a> · <a href="https://puter.com/privacy" target="_blank" rel="noopener noreferrer">Privacy ↗</a></div>
<div id="ai-messages" tabindex="0" aria-label="AI conversation"><div id="ai-welcome"><span class="ai-orbit">✦</span><h2>What’s on your mind?</h2><p>I can explain things, brainstorm ideas, help with code and talk games.</p><div class="ai-prompts"><button>Explain how a chess fork works</button><button>Give me an idea for a tiny browser game</button><button>Help me understand quadratic equations</button></div></div></div>
<p id="ai-status" role="status" aria-live="polite">Connect your Puter account to get started.</p><button id="ai-retry" hidden>Retry last message</button>
<form id="ai-form"><label class="sr-only" for="ai-input">Message Pixel AI</label><textarea id="ai-input" rows="2" maxlength="6000" placeholder="Ask Pixel AI anything…" required></textarea><div class="ai-composer-bottom"><small>Enter to send · Shift + Enter for a new line</small><button id="ai-stop" type="button" hidden>Stop</button><button id="ai-send" type="submit" class="primary" disabled>Send ↗</button></div></form>
<p class="ai-footnote">AI can make mistakes. Check important answers. This tab keeps the conversation in memory only; reloading clears it. Clearing here does not delete provider records.</p></div>`;
document.querySelector('main>footer').before(page);
const $=id=>page.querySelector('#'+id),log=$('ai-messages'),input=$('ai-input');
let sdkPromise,connected=false,busy=false,controller,history=[],retryText='';
const system={role:'system',content:'You are Pixel AI, a friendly general assistant inside Pixel Arcade. Explain clearly and accurately. Help with games, learning, writing and code. Do not claim you can control the site, view private accounts, or browse live information. The arcade has games, chess, calculator, notes, an external Scramjet browser, and a separate hosted community chat. Be honest about limitations.'};
function status(text){$('ai-status').textContent=text}
function controls(){ $('ai-send').disabled=!connected||busy;$('ai-connect').hidden=connected;$('ai-disconnect').hidden=!connected;$('ai-disconnect').disabled=busy;$('ai-clear').disabled=busy;$('ai-stop').hidden=!busy;input.disabled=busy;$('ai-retry').disabled=busy||!connected; }
function load(){
 if(sdkPromise)return sdkPromise;
 sdkPromise=new Promise((resolve,reject)=>{
  if(window.puter)return resolve(window.puter);
  const script=document.createElement('script');script.src='https://js.puter.com/v2/';script.async=true;
  const timer=setTimeout(()=>{script.remove();reject(new Error('AI service took too long to load. Check your connection and try again.'))},20000);
  script.onload=()=>{clearTimeout(timer);window.puter?resolve(window.puter):reject(new Error('AI service did not initialize.'))};
  script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error('Could not load Puter. Your network may block the service.'))};document.head.append(script);
 }).catch(e=>{sdkPromise=null;throw e});return sdkPromise;
}
async function prepare(){try{await load();connected=!!window.puter.auth.isSignedIn();$('ai-connect').textContent='Connect with Puter';$('ai-connect').disabled=false;controls();status(connected?'Connected · Ready for your question.':'Connect with Puter, then send your first message.')}catch(e){$('ai-connect').textContent='Reload AI service';$('ai-connect').disabled=false;status(e.message)}}
$('ai-connect').onclick=async()=>{
 if(!window.puter){await prepare();return}
 try{const signingIn=window.puter.auth.signIn();$('ai-connect').disabled=true;status('Finish signing in in the Puter window.');await signingIn;connected=!!window.puter.auth.isSignedIn();if(!connected)throw new Error('Sign-in was not completed. Try Connect again.');status('Connected · Ready for your question.');input.focus()}catch{status('Sign-in was not completed. Allow the Puter popup and press Connect again.')}finally{$('ai-connect').disabled=false;controls()}
};
$('ai-disconnect').onclick=async()=>{try{await window.puter.auth.signOut();connected=false;reset();status('Disconnected. Connect again whenever you are ready.')}catch{status('Could not disconnect. Try again.')}controls()};
function reset(){history=[];retryText='';log.querySelectorAll('.ai-message').forEach(el=>el.remove());$('ai-welcome').hidden=false;$('ai-retry').hidden=true;input.value=''}
$('ai-clear').onclick=()=>{reset();status(connected?'New chat · Ready for your question.':'Connect with Puter to start.');input.focus()};
function row(role,text){$('ai-welcome').hidden=true;const article=document.createElement('article');article.className='ai-message ai-'+role;const label=document.createElement('strong');label.textContent=role==='user'?'YOU':'PIXEL AI';const body=document.createElement('div');body.className='ai-message-text';body.textContent=text;article.append(label,body);if(role==='assistant'){const copy=document.createElement('button');copy.textContent='Copy';copy.onclick=async()=>{try{await navigator.clipboard.writeText(body.textContent);copy.textContent='Copied';setTimeout(()=>copy.textContent='Copy',1600)}catch{status('Copy unavailable. Select the answer text to copy it.')}};article.append(copy)}log.append(article);log.scrollTop=log.scrollHeight;return body}
async function send(text){
 if(busy||!connected||!text.trim())return;
 busy=true;retryText=text;$('ai-retry').hidden=true;controller=new AbortController();controls();row('user',text);const output=row('assistant','Thinking…');let partial='';status('Pixel AI is thinking…');
 const timeout=setTimeout(()=>controller.abort(),120000);
 try{
  const answer=await streamAnswer(window.puter,[system,...history,{role:'user',content:text}],{signal:controller.signal,onText:value=>{partial=value;output.textContent=value;log.scrollTop=log.scrollHeight;status('Pixel AI is replying…')}});
  history.push({role:'user',content:text},{role:'assistant',content:answer});
  while(history.length>40||JSON.stringify(history).length>50000)history.splice(0,2);
  retryText='';status('Ready · Recent messages provide context for your next question.');
 }catch(e){
  if(!partial)output.textContent=controller.signal.aborted?'Response stopped.':'No response received.';
  const raw=String(e?.message||e?.error?.message||e?.error||'The AI service could not answer.');
  status(controller.signal.aborted?'Response stopped. Retry when you are ready.':/credit|allowance|balance|quota|limit/i.test(raw)?'Puter usage limit reached. Check your allowance in the Puter dashboard.':'Could not finish: '+raw.slice(0,250));$('ai-retry').hidden=false;
 }finally{clearTimeout(timeout);busy=false;controls();input.focus()}
}
$('ai-form').onsubmit=e=>{e.preventDefault();const text=input.value.trim();if(!connected){status('Connect with Puter first.');return}if(text&&!busy){input.value='';send(text)}};
input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('ai-form').requestSubmit()}};
$('ai-stop').onclick=()=>controller?.abort();$('ai-retry').onclick=()=>send(retryText);
page.querySelectorAll('.ai-prompts button').forEach(button=>button.onclick=()=>{input.value=button.textContent;input.focus()});
window.pixelAI={show(){if(!busy)prepare()}};
