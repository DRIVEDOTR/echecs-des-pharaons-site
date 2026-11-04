import * as THREE from './vendor/three.module.js';

const stage=document.getElementById('pieceStage');
const flatCanvas=document.getElementById('pieceTurntable');
const zoomSlider=document.getElementById('pieceZoom');
const sourceCache=new Map();
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(36,1,.1,50);
const root=new THREE.Group();scene.add(root);
scene.add(new THREE.AmbientLight(0xffffff,2.15));
const keyLight=new THREE.DirectionalLight(0xffdfaa,2.4);keyLight.position.set(-3,6,6);scene.add(keyLight);
let renderer=null,mesh=null,angle=0,zoom=1,request=0;

try{
  renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.domElement.className='sculpture-canvas';
  renderer.domElement.setAttribute('aria-hidden','true');
  stage.appendChild(renderer.domElement);
}catch(error){console.warn('La sculpture 3D est indisponible sur cet appareil.',error);}

function loadImage(src){
  if(!sourceCache.has(src))sourceCache.set(src,new Promise((resolve,reject)=>{
    const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;
  }));
  return sourceCache.get(src);
}
function extract(image,part=0,parts=1,split=null){
  const regionX=split===null?Math.round(image.width*part/parts):(part?split:0);
  const regionW=split===null?Math.round(image.width/parts):(part?image.width-split:split);
  const scan=document.createElement('canvas');scan.width=regionW;scan.height=image.height;
  const context=scan.getContext('2d',{willReadFrequently:true});
  context.drawImage(image,regionX,0,regionW,image.height,0,0,regionW,image.height);
  const pixels=context.getImageData(0,0,regionW,image.height).data;
  let left=regionW,right=0,top=image.height,bottom=0;
  for(let y=0;y<image.height;y+=2)for(let x=0;x<regionW;x+=2){
    if(pixels[(y*regionW+x)*4+3]>35){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  }
  if(right<left)throw new Error('Image sans silhouette');
  const x=Math.max(0,left-4),y=Math.max(0,top-4),w=Math.min(regionW-x,right-left+10),h=Math.min(image.height-y,bottom-top+10);
  const cut=document.createElement('canvas');cut.width=w;cut.height=h;
  cut.getContext('2d').drawImage(scan,x,y,w,h,0,0,w,h);
  return cut;
}
function profile(canvas,height=3.3){
  const w=canvas.width,h=canvas.height,data=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;
  const worldWidth=height*w/h;
  return Array.from({length:150},(_,i)=>{
    const row=Math.min(h-1,Math.max(0,Math.round((1-i/149)*(h-1))));
    let left=w,right=-1;
    for(let x=0;x<w;x++)if(data[(row*w+x)*4+3]>35){left=Math.min(left,x);right=Math.max(right,x);}
    if(right<left)return {min:-.018,max:.018};
    return {min:(left/w-.5)*worldWidth,max:((right+1)/w-.5)*worldWidth};
  });
}
function rigidProfile(canvas){
  const w=canvas.width,h=canvas.height,data=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;
  const worldWidth=3.3*w/h;
  const rows=Array.from({length:150},(_,i)=>{
    const y=Math.min(h-1,Math.max(0,Math.round((1-i/149)*(h-1))));
    let start=-1,bestStart=0,bestEnd=0;
    for(let x=0;x<=w;x++){
      const solid=x<w&&data[(y*w+x)*4+3]>60;
      if(solid&&start<0)start=x;
      if(!solid&&start>=0){if(x-start>bestEnd-bestStart){bestStart=start;bestEnd=x;}start=-1;}
    }
    return {min:(bestStart/w-.5)*worldWidth,max:(bestEnd/w-.5)*worldWidth};
  });
  return rows.map((_,i)=>{
    const near=rows.slice(Math.max(0,i-3),Math.min(rows.length,i+4));
    const mins=near.map(row=>row.min).sort((a,b)=>a-b),maxs=near.map(row=>row.max).sort((a,b)=>a-b);
    const middle=Math.floor(near.length/2);
    return {min:mins[middle],max:maxs[middle]};
  });
}
function makeShape(front,side){
  const fp=profile(front),sp=profile(side),rings=fp.length,segments=72;
  const vertices=[],indices=[];
  for(let j=0;j<rings;j++){
    const f=fp[j],s=sp[j],cx=(f.min+f.max)/2,cz=-(s.min+s.max)/2;
    const rx=Math.max(.012,(f.max-f.min)/2),rz=Math.max(.012,(s.max-s.min)/2);
    for(let i=0;i<segments;i++){
      const a=i*2*Math.PI/segments;
      vertices.push(cx+rx*Math.cos(a),j/(rings-1)*3.3,cz+rz*Math.sin(a));
    }
  }
  for(let j=0;j<rings-1;j++)for(let i=0;i<segments;i++){
    const a=j*segments+i,b=j*segments+(i+1)%segments,c=a+segments,d=b+segments;
    indices.push(a,c,b,b,c,d);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}
function texture(canvas){
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;
  t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
  t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;
  t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  return t;
}
function pedestalTexture(dark){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
  const ctx=canvas.getContext('2d'),background=ctx.createLinearGradient(0,0,0,256);
  background.addColorStop(0,dark?'#09214b':'#063d67');
  background.addColorStop(.5,dark?'#08173d':'#0c3161');
  background.addColorStop(1,dark?'#132454':'#0c4770');
  ctx.fillStyle=background;ctx.fillRect(0,0,1024,256);
  ctx.strokeStyle='#c89843';ctx.lineWidth=9;
  ctx.strokeRect(4,12,1016,232);
  ctx.strokeStyle='#f4ca76';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(0,33);ctx.lineTo(1024,33);ctx.moveTo(0,223);ctx.lineTo(1024,223);ctx.stroke();
  for(let i=0;i<16;i++){
    const x=(i+.5)*64;
    ctx.strokeStyle='#c89843';ctx.lineWidth=6;
    ctx.beginPath();ctx.moveTo(x-29,202);ctx.quadraticCurveTo(x-33,90,x,65);ctx.quadraticCurveTo(x+33,90,x+29,202);ctx.stroke();
    ctx.fillStyle='#24a6a8';ctx.beginPath();ctx.moveTo(x,83);ctx.quadraticCurveTo(x-16,125,x,183);ctx.quadraticCurveTo(x+16,125,x,83);ctx.fill();
    ctx.fillStyle='#ddb35a';ctx.beginPath();ctx.arc(x,65,8,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#d5a652';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,183);ctx.lineTo(x,221);ctx.stroke();
  }
  const map=texture(canvas);map.wrapS=THREE.RepeatWrapping;return map;
}
function makePedestal(radius,height,dark){
  const group=new THREE.Group();
  const gold=new THREE.MeshStandardMaterial({color:'#d5a157',metalness:.67,roughness:.25});
  const stone=new THREE.MeshStandardMaterial({color:dark?'#25366c':'#f1d7a2',metalness:.1,roughness:.42});
  const ornament=new THREE.MeshStandardMaterial({map:pedestalTexture(dark),metalness:.18,roughness:.43});
  const bands=[
    {bottom:0,top:height*.14,radius:radius*1.02,material:gold},
    {bottom:height*.14,top:height*.22,radius:radius*.98,material:stone},
    {bottom:height*.22,top:height*.70,radius:radius*.94,material:ornament},
    {bottom:height*.70,top:height*.82,radius:radius*.99,material:gold},
    {bottom:height*.82,top:height,radius:radius*.92,material:stone}
  ];
  for(const band of bands){
    const h=band.top-band.bottom;
    const part=new THREE.Mesh(new THREE.CylinderGeometry(band.radius,band.radius,h,64,1),band.material);
    part.position.y=(band.top+band.bottom)/2;group.add(part);
  }
  for(const y of [height*.14,height*.22,height*.70,height*.82]){
    const radiusAt=y<height*.70?radius*.985:radius*.995;
    const ring=new THREE.Mesh(new THREE.TorusGeometry(radiusAt,height*.018,10,64),gold);
    ring.rotation.x=Math.PI/2;ring.position.y=y;group.add(ring);
  }
  return group;
}
function makeRigidFace(front,side,back,left,baseHeight,dark){
  const sources=[front,side,back,left],profiles=sources.map(source=>rigidProfile(source));
  const result=new THREE.Group(),rings=profiles[0].length;
  const baseEnd=Math.round(baseHeight/3.3*(rings-1));
  const atBase=profiles[0][baseEnd],atFoot=profiles[0][0];
  const radius=Math.max((atBase.max-atBase.min)*.54,(atFoot.max-atFoot.min)*.5);
  result.add(makePedestal(radius,baseHeight,dark));
  for(let face=0;face<4;face++){
    const source=sources[face],silhouette=profiles[face],opposite=profiles[(face+1)%4];
    const width=3.3*source.width/source.height;
    const points=[],uvs=[],indices=[];
    for(let j=baseEnd;j<rings;j++){
      const band=silhouette[j],depth=opposite[j];
      const half=Math.max(.012,(band.max-band.min)/2);
      const across=Math.max(.012,(depth.max-depth.min)/2);
      const center=(band.min+band.max)/2;
      const y=j/(rings-1)*3.3;
      const pair=face===0?[[center-half,across],[center+half,across]]:
        face===1?[[across,center+half],[across,center-half]]:
        face===2?[[center+half,-across],[center-half,-across]]:
        [[-across,center-half],[-across,center+half]];
      for(let k=0;k<2;k++){
        points.push(pair[k][0],y,pair[k][1]);
        uvs.push(.5+(k?band.max:band.min)/width,y/3.3);
      }
      if(j<rings-1){const a=(j-baseEnd)*2,b=a+2;indices.push(a,b,a+1,a+1,b,b+1);}
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    const material=new THREE.MeshBasicMaterial({map:texture(source),transparent:true,alphaTest:.045,side:THREE.DoubleSide,depthWrite:true});
    result.add(new THREE.Mesh(geometry,material));
  }
  return result;
}
function makeMaterial(views){
  const names=['front','quarter','side','rearQuarter','back'];
  const uniforms={viewAngle:{value:0}};
  names.forEach((name,i)=>{uniforms['tex'+i]={value:texture(views[i])};uniforms['width'+i]={value:3.3*views[i].width/views[i].height};});
  return new THREE.ShaderMaterial({uniforms,transparent:true,side:THREE.FrontSide,depthWrite:true,
    vertexShader:`
      varying vec3 vPos;
      varying vec3 vNorm;
      varying vec3 vWorldNorm;
      void main(){
        vPos=position;vNorm=normal;vWorldNorm=normalize(mat3(modelMatrix)*normal);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }`,
    fragmentShader:`
      uniform sampler2D tex0;uniform sampler2D tex1;uniform sampler2D tex2;uniform sampler2D tex3;uniform sampler2D tex4;
      uniform float width0;uniform float width1;uniform float width2;uniform float width3;uniform float width4;
      uniform float viewAngle;
      varying vec3 vPos;varying vec3 vNorm;varying vec3 vWorldNorm;
      const float PI=3.141592653589793;
      vec4 viewColor(sampler2D tex,float a,float width,float mirror){
        float x=vPos.x*cos(a)-vPos.z*sin(a);
        float u=.5+x/width;u=mix(u,1.0-u,mirror);
        float v=vPos.y/3.3;
        if(u<0.0||u>1.0||v<0.0||v>1.0)return vec4(0.0);
        return texture2D(tex,vec2(u,v));
      }
      float blendWeight(vec2 eye,vec2 direction){
        float distance=acos(clamp(dot(eye,direction),-1.0,1.0));
        return 1.0-smoothstep(.375,.41,distance);
      }
      void main(){
        vec2 n=vec2(vNorm.x,vNorm.z);
        if(length(n)<.08)n=vec2(vPos.x,vPos.z);
        n=normalize(n+vec2(.00001));
        vec2 eye=vec2(sin(viewAngle),cos(viewAngle));
        vec4 c0=viewColor(tex0,0.0,width0,0.0);
        vec4 c1=viewColor(tex1,PI/4.0,width1,0.0);
        vec4 c2=viewColor(tex2,PI/2.0,width2,0.0);
        vec4 c3=viewColor(tex3,3.0*PI/4.0,width3,0.0);
        vec4 c4=viewColor(tex4,PI,width4,0.0);
        vec4 c5=viewColor(tex3,5.0*PI/4.0,width3,1.0);
        vec4 c6=viewColor(tex2,3.0*PI/2.0,width2,1.0);
        vec4 c7=viewColor(tex1,7.0*PI/4.0,width1,1.0);
        float w0=blendWeight(eye,vec2(0.0,1.0));
        float w1=blendWeight(eye,vec2(.707107,.707107));
        float w2=blendWeight(eye,vec2(1.0,0.0));
        float w3=blendWeight(eye,vec2(.707107,-.707107));
        float w4=blendWeight(eye,vec2(0.0,-1.0));
        float w5=blendWeight(eye,vec2(-.707107,-.707107));
        float w6=blendWeight(eye,vec2(-1.0,0.0));
        float w7=blendWeight(eye,vec2(-.707107,.707107));
        float weight=w0+w1+w2+w3+w4+w5+w6+w7;
        float opacity=c0.a*w0+c1.a*w1+c2.a*w2+c3.a*w3+c4.a*w4+c5.a*w5+c6.a*w6+c7.a*w7;
        if(opacity<.015)discard;
        vec3 color=(c0.rgb*c0.a*w0+c1.rgb*c1.a*w1+c2.rgb*c2.a*w2+c3.rgb*c3.a*w3+c4.rgb*c4.a*w4+c5.rgb*c5.a*w5+c6.rgb*c6.a*w6+c7.rgb*c7.a*w7)/opacity;
        float light=.82+.22*max(dot(normalize(vWorldNorm),normalize(vec3(-.4,.8,.7))),0.0);
        gl_FragColor=vec4(color*light,clamp(opacity/max(weight,.001)*1.5,0.0,1.0));
        #include <colorspace_fragment>
      }`
  });
}
function dispose(){
  if(!mesh)return;
  root.remove(mesh);
  mesh.traverse(child=>{
    if(!child.isMesh)return;
    child.geometry.dispose();
    for(const material of Array.isArray(child.material)?child.material:[child.material]){
      if(material.uniforms)Object.values(material.uniforms).forEach(u=>{if(u.value?.isTexture)u.value.dispose();});
      material.map?.dispose();material.dispose();
    }
  });
  mesh=null;
}
async function show(asset){
  if(!renderer)return;
  const token=++request;
  try{
    const frontImage=await loadImage(`assets/${asset}.webp`);
    let side,back;
    if(asset==='ramses'){
      const images=await Promise.all([loadImage('assets/turnaround/ramses-side.webp'),loadImage('assets/turnaround/ramses-back.webp')]);
      side=extract(images[0]);back=extract(images[1]);
    }else{
      const sheet=await loadImage(`assets/turnaround/${asset}.webp`);
      const split=asset.startsWith('isis')?Math.round(sheet.width*.43):null;
      side=extract(sheet,0,2,split);back=extract(sheet,1,2,split);
    }
    const sheet=await loadImage(`assets/turnaround/${asset}-diagonals.webp`);
    if(token!==request)return;
    const front=extract(frontImage),quarter=extract(sheet,0,2),rearQuarter=extract(sheet,1,2);
    const rigid=asset.startsWith('pyramid')||asset.startsWith('obelisk');
    dispose();
    if(rigid)mesh=makeRigidFace(side,back,side,back,asset.startsWith('pyramid')?.72:.86,asset.endsWith('-dark'));
    else mesh=new THREE.Mesh(makeShape(front,side),makeMaterial([front,quarter,side,rearQuarter,back]));
    root.add(mesh);
    flatCanvas.hidden=true;renderer.domElement.hidden=false;
    resize();draw();
  }catch(error){if(token===request){console.warn('Modèle 3D indisponible pour cette pièce',error);flatCanvas.hidden=false;renderer.domElement.hidden=true;}}
}
function resize(){
  if(!renderer)return;
  const rect=stage.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
  camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();
  renderer.setSize(rect.width,rect.height,false);draw();
}
function draw(){
  if(!renderer||!mesh||renderer.domElement.hidden)return;
  root.rotation.y=-angle*Math.PI/180;
  if(mesh.material?.uniforms)mesh.material.uniforms.viewAngle.value=angle*Math.PI/180;
  const radius=6.4/zoom;
  camera.position.set(0,1.65,radius);
  camera.lookAt(0,1.65,0);renderer.render(scene,camera);
}
window.addEventListener('castpiecechange',event=>show(event.detail.asset));
window.addEventListener('pieceviewchange',event=>{angle=event.detail.angle;draw();});
zoomSlider.addEventListener('input',event=>{zoom=Number(event.target.value)/100;draw();});
if(renderer)new ResizeObserver(resize).observe(stage);
