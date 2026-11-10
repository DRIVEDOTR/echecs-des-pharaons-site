export function createGizaPanorama(root,{onManual=()=>{}}={}){
 const world=root.querySelector('#historyWorld'),image=root.querySelector('#gizaPanorama'),artBox=root.querySelector('#gizaArtBox'),aperture=root.querySelector('.world-art-aperture'),slot=root.querySelector('#panoramaWindow'),scroller=root.querySelector('#timelineScroll'),container=root.querySelector('#gizaOrbit'),status=root.querySelector('#panoramaStatus');
 const travel=root.querySelector('#panoramaOverview'),orbitButton=root.querySelector('#panoramaImmersion');
 let progress=0,mode='travel',frame=0,drag=null,orbit=null,orbitPromise=null,zoom=1,paintedProgress=0,lastTime=0;
 const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
 function paint(time){frame=0;const active=root.dataset.mode==='timeline'&&!root.hidden;orbit?.setVisible(active&&mode==='orbit');if(!active){lastTime=0;return;}
  const delta=Math.min(80,Math.max(1,time-(lastTime||time-16)));lastTime=time;
  paintedProgress=reduced?progress:paintedProgress+(progress-paintedProgress)*(1-Math.exp(-delta/82));if(Math.abs(progress-paintedProgress)<.00015)paintedProgress=progress;
  const box=slot.getBoundingClientRect(),w=innerWidth,h=innerHeight;
  world.style.background=mode==='orbit'?'linear-gradient(#567f9d 0%,#a0bdc7 30%,#e7d4ad 56%,#d4b381 100%)':'linear-gradient(#557599 0%,#8b9db4 24%,#c4b9aa 39%,#b8966a 63%,#c09a66 100%)';
  aperture.hidden=mode==='orbit';aperture.style.top='0px';aperture.style.height=h+'px';
  const imgW=w*1.42*zoom,imgH=imgW*1.5;artBox.style.width=imgW+'px';artBox.style.height=imgH+'px';artBox.style.left=((w-imgW)/2-(paintedProgress-.5)*w*.98)+'px';artBox.style.top=(box.top+box.height*.5-imgH*.365)+'px';
  root.dataset.panorama=mode;root.dataset.journeyProgress=progress.toFixed(5);root.dataset.orbitDegrees=(270*(paintedProgress-.5)).toFixed(2);if(mode==='orbit')orbit?.update(paintedProgress);
  const angle=Math.round(270*(progress-.5));root.querySelector('#panoramaAngle').textContent=mode==='orbit'?`${angle>0?'+':''}${angle}°`:'Gizeh · est / sud-est';if(paintedProgress!==progress)schedule();
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(paint);}
 async function setMode(value){mode=value;onManual();travel.setAttribute('aria-pressed',String(value==='travel'));orbitButton.setAttribute('aria-pressed',String(value==='orbit'));status.textContent=value==='orbit'?'Chargement du plateau en 3D…':'Travelling illustré · le décor suit votre parcours.';schedule();
  if(value==='orbit')try{if(!orbitPromise)orbitPromise=import('./giza-orbit.js?v=20261110-6').then(m=>m.createGizaOrbit(container,{onContextLost:()=>{setMode('travel');status.textContent='La vue 3D a été interrompue. Le travelling reste disponible.';}})).catch(err=>{orbitPromise=null;throw err;});orbit=await orbitPromise;orbit.setZoom(zoom);orbit.setVisible(mode==='orbit');status.textContent=mode==='orbit'?'Orbite réelle de 270° · modèle photographique du plateau.':'Travelling illustré · le décor suit votre parcours.';schedule();}catch(error){console.error('Giza orbit unavailable',error);mode='travel';travel.setAttribute('aria-pressed','true');orbitButton.setAttribute('aria-pressed','false');status.textContent='La vue 3D n’a pas pu charger. Réessayez « Orbite 270° ».';schedule();}
 }
 travel.addEventListener('click',()=>setMode('travel'));orbitButton.addEventListener('click',()=>setMode('orbit'));
 root.querySelector('#panoramaZoom').addEventListener('input',e=>{zoom=Number(e.target.value);orbit?.setZoom(zoom);schedule();});
 root.querySelector('#panoramaFocus').addEventListener('click',e=>{const focus=!root.classList.contains('landscape-focused');root.classList.toggle('landscape-focused',focus);e.currentTarget.setAttribute('aria-pressed',String(focus));e.currentTarget.textContent=focus?'Afficher la frise':'Contempler le paysage';schedule();});
 slot.tabIndex=0;slot.setAttribute('role','group');slot.addEventListener('pointerdown',e=>{if(e.target.closest('button,input,summary,details,label'))return;onManual();drag={x:e.clientX,left:scroller.scrollLeft};slot.setPointerCapture(e.pointerId);});
 slot.addEventListener('pointermove',e=>{if(!drag)return;scroller.scrollTo({left:drag.left-(e.clientX-drag.x)/Math.max(220,slot.clientWidth*1.3)*(scroller.scrollWidth-scroller.clientWidth),behavior:'instant'});});for(const ev of ['pointerup','pointercancel'])slot.addEventListener(ev,()=>drag=null);
 slot.addEventListener('keydown',e=>{if(e.target!==slot||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();onManual();if(e.key==='Home')scroller.scrollTo({left:0,behavior:'instant'});else if(e.key==='End')scroller.scrollTo({left:scroller.scrollWidth,behavior:'instant'});else scroller.scrollBy({left:(e.key==='ArrowRight'?1:-1)*scroller.clientWidth*.8,behavior:reduced?'instant':'smooth'});});
 new ResizeObserver(schedule).observe(slot);window.addEventListener('resize',()=>{orbit?.resize();schedule();});window.addEventListener('hashchange',schedule);image.addEventListener('load',schedule);document.addEventListener('visibilitychange',()=>{if(document.hidden)orbit?.setVisible(false);else schedule();});schedule();return {update(value){progress=Math.max(0,Math.min(1,value));schedule();},resize:schedule};
}
