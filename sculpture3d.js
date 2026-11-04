import * as THREE from './vendor/three.module.js';

const stage=document.getElementById('pieceStage');
const flatCanvas=document.getElementById('pieceTurntable');
const zoomSlider=document.getElementById('pieceZoom');
const sourceCache=new Map();
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(36,1,.1,50);
const root=new THREE.Group();scene.add(root);
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
  root.remove(mesh);mesh.geometry.dispose();
  Object.values(mesh.material.uniforms).forEach(u=>{if(u.value?.isTexture)u.value.dispose();});
  mesh.material.dispose();mesh=null;
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
    const geometry=makeShape(front,side),material=makeMaterial([front,quarter,side,rearQuarter,back]);
    dispose();mesh=new THREE.Mesh(geometry,material);root.add(mesh);
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
  mesh.material.uniforms.viewAngle.value=angle*Math.PI/180;
  const radius=6.4/zoom;
  camera.position.set(0,1.65,radius);
  camera.lookAt(0,1.65,0);renderer.render(scene,camera);
}
window.addEventListener('castpiecechange',event=>show(event.detail.asset));
window.addEventListener('pieceviewchange',event=>{angle=event.detail.angle;draw();});
zoomSlider.addEventListener('input',event=>{zoom=Number(event.target.value)/100;draw();});
if(renderer)new ResizeObserver(resize).observe(stage);
