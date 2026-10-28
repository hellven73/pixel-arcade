import assert from 'node:assert/strict';
import {validateDeck} from './study-slides.js';
import {workspaceUrl} from './study-google.js';
const deck={title:'Maths',slides:[{bg:'#ffffff',notes:'Notes',elements:[{type:'text',text:'<script>not executable</script>',x:20,y:20,w:300,h:100,fontSize:36,color:'#111111'}]}]};
const valid=validateDeck(deck);assert.equal(valid.slides[0].elements[0].text,'<script>not executable</script>');assert.notEqual(valid.slides[0].id,validateDeck(deck).slides[0].id);
for(const bad of [{slides:[]},{slides:Array(61).fill(deck.slides[0])},{slides:[{...deck.slides[0],bg:'url(https://evil.test)'}]},{slides:[{...deck.slides[0],elements:[{...deck.slides[0].elements[0],x:NaN}]}]},{slides:[{...deck.slides[0],elements:[{type:'image',x:0,y:0,w:100,h:100,src:'https://evil.test/track.png'}]}]}])assert.throws(()=>validateDeck(bad));
assert.equal(workspaceUrl('https://docs.google.com/presentation/d/example/edit'),'https://docs.google.com/presentation/d/example/edit');for(const bad of ['javascript:alert(1)','https://docs.google.com.evil.test/a','https://evil.test/','https://name:password@docs.google.com/document/d/a','http://docs.google.com/a'])assert.throws(()=>workspaceUrl(bad));
console.log('Passed: slide import bounds and unsafe image/style rejection; plain text preservation; Google URL allowlist rejects executable, spoofed, insecure and credential-bearing URLs.');
// Exercise the real standalone-export handler and verify user text cannot close its JSON script.
const {readFileSync,writeFileSync}=await import('node:fs');
const source=readFileSync('study-slides.js','utf8'),begin=source.indexOf("q('#slides-html').onclick="),end=source.indexOf('\nreturn {async show',begin);let exported;
const exportFn=new Function('doc','downloadFile',source.slice(begin,end).replace("q('#slides-html').onclick=",'return '))(valid,(name,content,type)=>{exported={name,content,type}});exportFn();assert.equal(exported.type,'text/html');assert.ok(exported.content.includes('\\u003cscript>not executable'));assert.equal((exported.content.match(/<script(?: |>|\n)/g)||[]).length,2);assert.ok(exported.content.includes('ResizeObserver'));
if(process.env.PIXEL_TEST_EXPORT_PATH)writeFileSync(process.env.PIXEL_TEST_EXPORT_PATH,exported.content);
console.log('Passed: real HTML export handler emits a standalone presentation and escapes user text at the script boundary.');
