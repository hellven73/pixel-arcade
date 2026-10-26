// Dock magnification uses layout coordinates so scaled icons cannot move the hit targets.
const dock=document.querySelector('.app-dock');
if(dock){
  dock.classList.add('motion-dock');
  for(const button of dock.querySelectorAll('.dock-button')){const glyph=document.createElement('span');glyph.className='dock-glyph';glyph.append(...button.childNodes);const label=document.createElement('span');label.className='dock-tooltip';label.textContent=button.getAttribute('aria-label')||button.title;label.setAttribute('aria-hidden','true');button.append(glyph,label)}
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover:hover) and (pointer:fine)');
  let frame=0,x=null;
  function reset(){cancelAnimationFrame(frame);frame=0;x=null;for(const b of dock.querySelectorAll('.dock-button')){b.style.removeProperty('--dock-scale');b.style.removeProperty('--dock-lift');b.style.removeProperty('--dock-shift')}}
  function paint(){frame=0;if(reduced.matches||x===null)return reset();const rect=dock.getBoundingClientRect();for(const b of dock.querySelectorAll('.dock-button')){if(b.hidden)continue;const center=rect.left+b.offsetLeft+b.offsetWidth/2-dock.scrollLeft,delta=center-x,distance=Math.abs(delta),weight=distance<145?(1+Math.cos(distance/145*Math.PI))/2:0;b.style.setProperty('--dock-scale',(1+weight*.44).toFixed(3));b.style.setProperty('--dock-lift',(-weight*13).toFixed(2)+'px');b.style.setProperty('--dock-shift',(Math.sign(delta)*Math.sin(Math.min(distance/145,1)*Math.PI)*8).toFixed(2)+'px')}}
  function update(value){x=value;if(!frame)frame=requestAnimationFrame(paint)}
  dock.addEventListener('pointermove',e=>{if(fine.matches&&e.pointerType!=='touch')update(e.clientX)});
  dock.addEventListener('pointerleave',()=>{const focused=dock.querySelector(':focus-visible');if(focused){const r=focused.getBoundingClientRect();update(r.left+r.width/2)}else reset()});
  dock.addEventListener('focusin',e=>{if(e.target.matches('.dock-button:focus-visible')){const r=e.target.getBoundingClientRect();update(r.left+r.width/2)}});
  dock.addEventListener('focusout',e=>{if(!dock.contains(e.relatedTarget))reset()});
  dock.addEventListener('scroll',reset,{passive:true});reduced.addEventListener('change',reset);fine.addEventListener('change',reset);
}
