const canvas=document.getElementById('pieceTurntable');
const ctx=canvas.getContext('2d',{alpha:true});
const fallback=document.getElementById('pieceFallback');
const stage=document.getElementById('pieceStage');
const cache=new Map();
let current=null,angle=0,zoom=1,request=0;

function loadImage(src){
  if(!cache.has(src))cache.set(src,new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;}));
  return cache.get(src);
}
function imageBox(image,part=0,parts=1,split=null){
  const regionX=split===null?Math.round(image.width*part/parts):(part===0?0:split);
  const regionW=split===null?Math.round(image.width/parts):(part===0?split:image.width-split);
  const work=document.createElement('canvas');work.width=regionW;work.height=image.height;
  const c=work.getContext('2d',{willReadFrequently:true});
  c.drawImage(image,regionX,0,regionW,image.height,0,0,regionW,image.height);
  const data=c.getImageData(0,0,regionW,image.height).data;
  let left=regionW,right=0,top=image.height,bottom=0;
  for(let y=0;y<image.height;y+=2)for(let x=0;x<regionW;x+=2){
    if(data[(y*regionW+x)*4+3]>35){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  }
  if(right<left)return {image,x:regionX,y:0,w:regionW,h:image.height};
  const pad=5;return {image,x:regionX+Math.max(0,left-pad),y:Math.max(0,top-pad),w:Math.min(regionW,right-left+pad*2),h:Math.min(image.height,bottom-top+pad*2)};
}
async function show(asset){
  const token=++request;
  try{
    const frontImage=await loadImage(`assets/${asset}.webp`);
    if(token!==request)return;
    current={asset,views:[imageBox(frontImage)]};
    fallback.hidden=true;render();
    let side,back;
    if(asset==='ramses'){
      [side,back]=await Promise.all([loadImage('assets/turnaround/ramses-side.webp'),loadImage('assets/turnaround/ramses-back.webp')]);
      if(token!==request)return;
      side=imageBox(side);back=imageBox(back);
    }else{
      const sheet=await loadImage(`assets/turnaround/${asset}.webp`);
      if(token!==request)return;
      const split=asset.startsWith('isis')?Math.round(sheet.width*.43):null;
      side=imageBox(sheet,0,2,split);back=imageBox(sheet,1,2,split);
    }
    const diagonals=await loadImage(`assets/turnaround/${asset}-diagonals.webp`);
    if(token!==request)return;
    const frontDiagonal=imageBox(diagonals,0,2);
    const backDiagonal=imageBox(diagonals,1,2);
    current.views=[current.views[0],frontDiagonal,side,backDiagonal,back,backDiagonal,side,frontDiagonal];
    render();
  }catch(error){
    if(token===request){fallback.src=`assets/${asset}.webp`;fallback.hidden=false;console.warn('Vues de la pièce indisponibles',error);}
  }
}
function resize(){
  const rect=stage.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.max(1,Math.round(rect.width*ratio));canvas.height=Math.max(1,Math.round(rect.height*ratio));
  canvas.style.width=rect.width+'px';canvas.style.height=rect.height+'px';
  ctx.setTransform(ratio,0,0,ratio,0,0);render();
}
function drawView(view,opacity=1,mirror=false){
  if(!view)return;
  const w=canvas.clientWidth,h=canvas.clientHeight;
  const fit=Math.min(w*.88/view.w,h*.9/view.h)*zoom;
  const width=view.w*fit,height=view.h*fit;
  ctx.save();ctx.globalAlpha=opacity;ctx.translate(w/2,h*.53);ctx.scale(mirror?-1:1,1);
  ctx.shadowColor='rgba(0,10,20,.48)';ctx.shadowBlur=18;ctx.shadowOffsetY=8;
  ctx.drawImage(view.image,view.x,view.y,view.w,view.h,-width/2,-height/2,width,height);
  ctx.restore();
}
function render(){
  if(!canvas.width)return;
  const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);
  if(!current)return;
  const normalized=((angle%360)+360)%360;
  const position=normalized/45,base=Math.floor(position)%8,next=(base+1)%8;
  const fraction=position-Math.floor(position);
  // Each original view stays intact. A short eased dissolve joins adjacent views.
  const blendStart=.32,blendEnd=.68;
  const t=Math.max(0,Math.min(1,(fraction-blendStart)/(blendEnd-blendStart)));
  const blend=t*t*(3-2*t);
  if(blend<1)drawView(current.views[base]||current.views[0],1,base>4);
  if(blend>0)drawView(current.views[next]||current.views[0],blend,next>4);
  const names=['Face','Trois quarts','Profil','Trois quarts arrière','Dos','Trois quarts arrière','Profil','Trois quarts'];
  const label=document.getElementById('pieceViewName');if(label)label.textContent=names[Math.round(position)%8];
}
window.addEventListener('castpiecechange',event=>show(event.detail.asset));
window.addEventListener('pieceviewchange',event=>{angle=event.detail.angle;render();});
document.getElementById('pieceZoom').addEventListener('input',event=>{zoom=Number(event.target.value)/100;document.getElementById('pieceZoomValue').textContent=Math.round(zoom*100)+' %';render();});
new ResizeObserver(resize).observe(stage);
