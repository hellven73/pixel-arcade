import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const code=fs.readFileSync('slope-player.js','utf8');
function setup({graphics=true,reject=false}={}){
 const nodes={};for(const id of ['unity-canvas','load-game','retry-game','load-status','load-progress','restart-game','focus-game','fullscreen-game','slope-player','control-status','load-screen'])nodes['#'+id]={hidden:false,disabled:false,textContent:'',value:0,focus(){this.focused=true},requestFullscreen:async()=>{}};
 const scripts=[];let calls=0,config,reloaded=false;
 const ctx={document:{querySelector:s=>nodes[s],createElement:tag=>tag==='canvas'?{getContext:()=>graphics?{getExtension:()=>null}:null}:{},body:{append:s=>scripts.push(s)}},window:{devicePixelRatio:3},location:{reload:()=>{reloaded=true}},setTimeout:()=>1,clearTimeout(){},console:{error(){}},createUnityInstance:async(c,o,progress)=>{calls++;config=o;progress(.5);if(reject)throw Error('failed');return {}}};
 vm.runInNewContext(code,ctx);return {nodes,scripts,get calls(){return calls},get config(){return config},get reloaded(){return reloaded}};
}
const unsupported=setup({graphics:false});unsupported.nodes['#load-game'].onclick();assert.equal(unsupported.scripts.length,0);assert.match(unsupported.nodes['#load-status'].textContent,/WebGL is unavailable/);assert.equal(unsupported.nodes['#retry-game'].hidden,false);
const ok=setup();ok.nodes['#load-game'].onclick();ok.nodes['#load-game'].onclick();assert.equal(ok.scripts.length,1);await ok.scripts[0].onload();assert.equal(ok.calls,1);assert.equal(ok.nodes['#load-screen'].hidden,true);assert.equal(ok.nodes['#unity-canvas'].focused,true);assert.equal(ok.config.devicePixelRatio,1.5);
for(const field of ['dataUrl','frameworkUrl','codeUrl']){const p=ok.config[field];assert.ok(fs.existsSync(p));assert.match(new URL(p,'https://hellven73.github.io/pixel-arcade/slope.html').pathname,/^\/pixel-arcade\/slope-/)}
const bad=setup({reject:true});bad.nodes['#load-game'].onclick();await bad.scripts[0].onload();assert.match(bad.nodes['#load-status'].textContent,/could not start/);assert.equal(bad.nodes['#retry-game'].hidden,false);bad.nodes['#retry-game'].onclick();assert.ok(bad.reloaded);
const network=setup();network.nodes['#load-game'].onclick();network.scripts[0].onerror();assert.match(network.nodes['#load-status'].textContent,/loader could not download/);
assert.equal(fs.readFileSync('slope-build.wasm').subarray(0,4).toString('hex'),'0061736d');assert.match(fs.readFileSync('slope-build.data').subarray(0,16).toString(),/^UnityWebData/);
const game=JSON.parse(fs.readFileSync('originals.json')).find(g=>g.id==='original-21');assert.equal(game.embed,'./slope.html');assert.equal(game.providerLaunch,false);assert.equal(game.external,false);
assert.ok(!fs.readFileSync('slope-sdk.js','utf8').includes('2b8f3125c2f5fcc029e5'));
assert.ok(fs.readFileSync('hub.js','utf8').includes('new URL(current.embed,document.baseURI)'));
console.log('Passed: local asset paths and headers, preflight, successful startup, duplicate clicks, download failure, Unity rejection, retry, SDK real request path and catalogue routing.');
