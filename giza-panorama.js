// One illustrated landscape, one timeline position. No independent autoplay or tiled copies.
export function createGizaPanorama(root,{onManual=()=>{}}={}){
 const world=root.querySelector('#historyWorld'),image=root.querySelector('#gizaPanorama'),artBox=root.querySelector('#gizaArtBox'),aperture=root.querySelector('.world-art-aperture'),windowSlot=root.querySelector('#panoramaWindow'),scroller=root.querySelector('#timelineScroll');
 const overview=root.querySelector('#panoramaOverview'),immersion=root.querySelector('#panoramaImmersion');
 let progress=0,immersive=false,frame=0,drag=null;
 function paint(){frame=0;const visible=root.dataset.mode==='timeline'&&!root.hidden;let box=visible?windowSlot.getBoundingClientRect():{top:85,height:Math.min(360,innerHeight*.4)};if(box.height<20||root.hidden)return;const width=innerWidth,height=box.height;
  aperture.style.top=box.top+'px';aperture.style.height=height+'px';
  // Keep the actual monument silhouette (.20–.77 in the illustration) inside the clear window.
  // Wide screens use empty sky/desert margins rather than cropping off peaks or the Sphinx.
  const imgHeight=immersive?height/.72:Math.min(width*1.16/3,height/.82),imgWidth=imgHeight*3;
  const left=immersive?(imgWidth>width?-progress*(imgWidth-width):(width-imgWidth)*progress):(width-imgWidth)/2+(0.5-progress)*Math.min(width*.12,imgWidth*.12);
  const top=height*.50-imgHeight*.49;
  artBox.style.width=imgWidth+'px';artBox.style.height=imgHeight+'px';artBox.style.left=left+'px';artBox.style.top=top+'px';
  const edgeColors=[[0,[37,124,156]],[.1,[48,135,167]],[.2,[72,151,178]],[.3,[97,167,188]],[.4,[130,180,192]],[.48,[155,186,189]],[.52,[171,187,185]],[.56,[192,174,143]],[.6,[211,157,106]],[.7,[230,172,111]],[.8,[201,143,87]],[.9,[201,135,75]],[1,[172,112,60]]];
  const stops=edgeColors.map(([y,rgb])=>`rgb(${rgb.join(',')}) ${Math.max(0,box.top+top+imgHeight*y)}px`);stops.push('#c99a59 100%');world.style.background=`linear-gradient(180deg,${stops.join(',')})`;
  aperture.style.background='transparent';
  root.style.setProperty('--giza-horizon',box.top+height*.60+'px');
  root.dataset.panorama=immersive?'immersion':'overview';root.dataset.journeyProgress=progress.toFixed(5);
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(paint);}
 function setImmersion(value){immersive=value;overview.setAttribute('aria-pressed',String(!value));immersion.setAttribute('aria-pressed',String(value));schedule();}
 overview.addEventListener('click',()=>setImmersion(false));immersion.addEventListener('click',()=>setImmersion(true));
 windowSlot.tabIndex=0;windowSlot.setAttribute('role','group');
 windowSlot.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;onManual();drag={x:e.clientX,left:scroller.scrollLeft};windowSlot.setPointerCapture(e.pointerId);});
 windowSlot.addEventListener('pointermove',e=>{if(!drag)return;const max=scroller.scrollWidth-scroller.clientWidth;scroller.scrollTo({left:drag.left-(e.clientX-drag.x)/Math.max(200,windowSlot.clientWidth*1.3)*max,behavior:'instant'});});
 for(const event of ['pointerup','pointercancel'])windowSlot.addEventListener(event,()=>drag=null);
 windowSlot.addEventListener('keydown',e=>{if(e.target!==windowSlot||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();onManual();if(e.key==='Home')scroller.scrollTo({left:0,behavior:'instant'});else if(e.key==='End')scroller.scrollTo({left:scroller.scrollWidth,behavior:'instant'});else scroller.scrollBy({left:(e.key==='ArrowRight'?1:-1)*scroller.clientWidth*.8,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});});
 new ResizeObserver(schedule).observe(windowSlot);window.addEventListener('resize',schedule);window.addEventListener('hashchange',schedule);image.addEventListener('load',schedule);schedule();
 return {update(value){progress=Math.max(0,Math.min(1,value));schedule();},resize:schedule};
}
