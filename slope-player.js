(() => {
 const q=s=>document.querySelector(s),canvas=q('#unity-canvas'),start=q('#load-game'),retry=q('#retry-game'),status=q('#load-status'),progress=q('#load-progress');
 let loading=false,instance=null,slowTimer;
 const fail=message=>{clearTimeout(slowTimer);status.textContent=message;start.hidden=true;retry.hidden=false;progress.hidden=true;q('#load-screen').hidden=false};
 const focus=()=>{canvas.focus();instance?.Module?.WebAudio?.audioContext?.resume?.().catch(()=>{})};
 retry.onclick=()=>location.reload();q('#restart-game').onclick=()=>location.reload();q('#focus-game').onclick=focus;
 q('#fullscreen-game').onclick=async()=>{try{await q('#slope-player').requestFullscreen();q('#control-status').textContent='';focus()}catch{q('#control-status').textContent='Fullscreen is unavailable. Use your browser’s fullscreen control.'}};
 start.onclick=()=>{
  if(loading)return;loading=true;start.disabled=true;
  const probe=document.createElement('canvas');let gl;try{gl=probe.getContext('webgl2')||probe.getContext('webgl')}catch{}
  if(!gl){fail('WebGL is unavailable in this browser. Enable graphics acceleration or try another supported device. No game files were downloaded.');return}
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  progress.hidden=false;status.textContent='Loading Slope… 0%';
  slowTimer=setTimeout(()=>{status.textContent='Still loading. The first download may take a minute on a slow connection.';retry.hidden=false},60000);
  const script=document.createElement('script');script.src='slope-unity-loader.js';script.onerror=()=>fail('The game loader could not download. Check your connection, then retry.');
  script.onload=async()=>{
   try{
    instance=await createUnityInstance(canvas,{dataUrl:'slope-build.data',frameworkUrl:'slope-framework.js',codeUrl:'slope-build.wasm',streamingAssetsUrl:'slope-streaming-assets',companyName:'Y8',productName:'Slope',productVersion:'1.2',devicePixelRatio:Math.min(window.devicePixelRatio||1,1.5)},value=>{progress.value=Math.round(value*100);status.textContent='Loading Slope… '+progress.value+'%'});
    window.myGameInstance=instance;clearTimeout(slowTimer);q('#load-screen').hidden=true;status.textContent='Game loaded.';focus();
   }catch(error){console.error('Slope startup failed:',error);fail('Slope could not start. Check WebGL support, available memory and your connection, then retry.')}
  };
  document.body.append(script);
 };
})();
