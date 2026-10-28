// A dependency-free canvas sculpture. No WebGL, downloads, or audio required.
export function createWelcome({onSetup,resuming=false}) {
  const dialog=document.createElement('dialog');
  dialog.className='pixel-intro';
  dialog.setAttribute('aria-label','Welcome to Pixel Arcade');
  dialog.innerHTML=`
    <div class="welcome-atmosphere" aria-hidden="true"></div>
    <div class="welcome-top"><span class="welcome-brand"><b>✳</b> PIXEL ARCADE<span class="welcome-edition">A SPACE FOR YOUR DOWNTIME</span></span><button type="button" class="welcome-skip">Skip intro ↗</button></div>
    <div class="welcome-stage">
      <div class="welcome-art"><canvas class="welcome-canvas" tabindex="0" role="button" aria-label="Interactive sculpture. Drag to rotate, click or press Space to ripple. Arrow keys rotate." aria-describedby="welcome-art-hint"></canvas><span class="welcome-art-caption"><i></i> LIVE GENERATIVE PLAYGROUND</span></div>
      <div class="welcome-copy"><div class="welcome-eyebrow"><span></span> GOOD TIMES, BY DESIGN.</div><h1><span>Make room</span><span>for <em>play.</em></span></h1><p>A few games. Your favourite people.<br>A little world that moves with you.</p><div class="welcome-actions"><button type="button" class="welcome-enter">Enter the arcade <span>↗</span></button><button type="button" class="welcome-setup">${resuming?'Resume guided setup':'Make it yours'} <span>→</span></button></div><span class="welcome-note">INSTANT PLAY. ENDLESS POSSIBILITIES.</span></div>
      <span class="welcome-side-note" aria-hidden="true">LESS SCROLLING. MORE LIVING.</span>
    </div>
    <div class="welcome-bottom"><div class="welcome-modes" role="group" aria-label="Sculpture style"><button type="button" data-art="0" aria-pressed="true"><small>01</small> Orbit</button><button type="button" data-art="1" aria-pressed="false"><small>02</small> Bloom</button><button type="button" data-art="2" aria-pressed="false"><small>03</small> Wave</button></div><div class="welcome-hint" id="welcome-art-hint">MOVE TO EXPLORE <span>·</span> TAP TO RIPPLE</div><button type="button" class="welcome-motion" aria-pressed="false">Ⅱ Pause motion</button></div>
    <div class="welcome-status" role="status" aria-live="polite"></div>`;
  document.body.append(dialog);
  const q=s=>dialog.querySelector(s),canvas=q('canvas'),ctx=canvas.getContext('2d'),media=matchMedia('(prefers-reduced-motion: reduce)');
  let mode=0,paused=media.matches,frame=0,time=0,last=0,width=0,height=0,rotation=0,tilt=0,pointerX=0,pointerY=0,drag=null,ripple=0,leaving=false,returnFocus=null,exitTimer;
  const colors=[[181,235,215],[195,181,255],[255,186,151]];
  function draw(){
    if(!ctx||!width||!height)return;
    ctx.clearRect(0,0,width,height);
    const mobile=width<760,cx=width*(mobile?.52:.70),cy=height*(mobile?.24:.49),size=Math.min(width*(mobile?.43:.31),height*(mobile?.24:.47));
    const [r,g,b]=colors[mode],rgb=`${r},${g},${b}`;
    const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,size*1.4);glow.addColorStop(0,`rgba(${rgb},.08)`);glow.addColorStop(1,`rgba(${rgb},0)`);ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
    const yaw=rotation+time*.13+pointerX*.17,pitch=.38+tilt+pointerY*.14,roll=-.47;
    const sy=Math.sin(yaw),co=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch),sr=Math.sin(roll),cr=Math.cos(roll);
    function project(x,y,z){const a=x*co+z*sy,c=-x*sy+z*co,d=y*cp-c*sp,e=y*sp+c*cp,f=a*cr-d*sr,h=a*sr+d*cr,p=3.8/(3.8+e);return [cx+f*size*p,cy+h*size*p,e]}
    // Continuous meridians make the form readable even when motion is disabled.
    const lines=mobile?40:64,segments=mobile?96:140;
    for(let j=0;j<lines;j++){
      const v=j/lines*Math.PI*2;ctx.beginPath();let depth=0;
      for(let k=0;k<=segments;k++){
        const u=k/segments*Math.PI*2;
        let x,y,z;
        const pulse=ripple*Math.sin(u*5-time*3)*.055;
        if(mode===0){const tube=.29+Math.sin(u*3+v*2+time*.7)*.055+pulse,rad=.71+tube*Math.cos(v);x=rad*Math.cos(u);y=tube*Math.sin(v);z=rad*Math.sin(u)}
        else if(mode===1){const rad=.70+Math.sin(u*5+time*.55)*.13*Math.sin(v)+pulse;x=rad*Math.sin(v)*Math.cos(u);y=rad*Math.cos(v);z=rad*Math.sin(v)*Math.sin(u);x*=1.13;y*=1.13;z*=1.13}
        else{const rad=.61+.22*Math.cos(v);x=rad*Math.cos(u);z=rad*Math.sin(u);y=.32*Math.sin(v)+.22*Math.sin(u*3+v+time*.75)+pulse}
        const p=project(x,y,z);depth+=p[2];if(k===0)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1]);
      }
      const alpha=.17+(.75-depth/(segments+1))*.23;ctx.strokeStyle=`rgba(${rgb},${Math.min(.6,alpha)})`;ctx.lineWidth=.65;ctx.stroke();
    }
    // Sparse drifting points surround the sculpture without distracting from the copy.
    for(let i=0;i<30;i++){const a=i*2.399+time*.025,dist=size*(1.12+(i%5)*.11),x=cx+Math.cos(a)*dist,y=cy+Math.sin(a)*dist*.8;ctx.fillStyle=`rgba(${rgb},${.16+(i%3)*.09})`;ctx.beginPath();ctx.arc(x,y,i%6===0?1.8:.8,0,Math.PI*2);ctx.fill()}
    if(ripple>.02){ctx.strokeStyle=`rgba(${rgb},${ripple*.4})`;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(cx,cy,size*(1.6-ripple*.7),size*(1.15-ripple*.45),-.47,0,Math.PI*2);ctx.stroke()}
  }
  function tick(now){frame=0;if(!dialog.open||paused||document.hidden||leaving)return;const dt=Math.min((now-(last||now))/1000,.05);last=now;time+=dt;ripple=Math.max(0,ripple-dt*.75);draw();frame=requestAnimationFrame(tick)}
  function run(){cancelAnimationFrame(frame);frame=0;last=0;if(dialog.open&&!paused&&!document.hidden&&!leaving)frame=requestAnimationFrame(tick);else draw()}
  function resize(){const rect=canvas.parentElement.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=Math.min(devicePixelRatio||1,1.75);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx?.setTransform(dpr,0,0,dpr,0,0);draw()}
  function updateMotion(){q('.welcome-motion').textContent=paused?'▶ Resume motion':'Ⅱ Pause motion';q('.welcome-motion').setAttribute('aria-pressed',String(paused));dialog.classList.toggle('welcome-still',paused);run()}
  function pulse(){ripple=1;q('.welcome-status').textContent='Ripple released';if(paused)draw()}
  q('.welcome-motion').onclick=()=>{paused=!paused;updateMotion()};
  for(const b of dialog.querySelectorAll('[data-art]'))b.onclick=()=>{mode=Number(b.dataset.art);dialog.style.setProperty('--welcome-accent',`rgb(${colors[mode].join(',')})`);dialog.querySelectorAll('[data-art]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));ripple=1;draw();q('.welcome-status').textContent=['Orbit selected','Bloom selected','Wave selected'][mode]};
  dialog.addEventListener('pointermove',e=>{const rect=canvas.getBoundingClientRect();pointerX=(e.clientX-rect.left)/width-.5;pointerY=(e.clientY-rect.top)/height-.5;if(drag){rotation+=(e.clientX-drag.x)*.007;tilt=Math.max(-1,Math.min(1,tilt+(e.clientY-drag.y)*.005));drag.moved+=Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y);drag.x=e.clientX;drag.y=e.clientY}if(paused)draw()});
  canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,moved:0};canvas.setPointerCapture(e.pointerId);canvas.classList.add('is-dragging')});
  canvas.addEventListener('pointerup',()=>{if(drag&&drag.moved<8)pulse();drag=null;canvas.classList.remove('is-dragging')});
  canvas.addEventListener('pointercancel',()=>{drag=null;canvas.classList.remove('is-dragging')});
  canvas.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();pulse()}else if(e.key.startsWith('Arrow')){e.preventDefault();if(e.key==='ArrowLeft')rotation-=.2;if(e.key==='ArrowRight')rotation+=.2;if(e.key==='ArrowUp')tilt-=.1;if(e.key==='ArrowDown')tilt+=.1;draw()}});
  function enter(setup=false){if(leaving)return;leaving=true;try{sessionStorage.setItem('px-intro-session-v2','1');localStorage.setItem('px-intro-seen-v3','1')}catch{}cancelAnimationFrame(frame);dialog.classList.add('welcome-leaving');const finish=()=>{dialog.close();leaving=false;dialog.classList.remove('welcome-leaving');if(setup)onSetup();else returnFocus?.focus()};exitTimer=setTimeout(finish,media.matches?0:620)}
  q('.welcome-enter').onclick=()=>enter();q('.welcome-skip').onclick=()=>enter();q('.welcome-setup').onclick=()=>enter(true);dialog.addEventListener('cancel',e=>{e.preventDefault();enter()});dialog.addEventListener('close',()=>{clearTimeout(exitTimer);cancelAnimationFrame(frame);drag=null;leaving=false;dialog.classList.remove('welcome-leaving')});
  new ResizeObserver(()=>{if(dialog.open)resize()}).observe(dialog);
  document.addEventListener('visibilitychange',run);media.addEventListener('change',e=>{paused=e.matches;updateMotion()});
  function show(){if(dialog.open)return;returnFocus=document.activeElement;dialog.showModal();resize();updateMotion()}
  return {show};
}
