import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js?v=20261110-6';
// The camera really travels through 270 degrees around a three-dimensional site mesh.
export async function createGizaOrbit(container,{onContextLost=()=>{}}={}){
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.setClearColor(0,0);renderer.domElement.setAttribute('aria-hidden','true');container.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1,.03,120);scene.fog=new THREE.FogExp2('#dcc598',.012);
 const gltf=await new GLTFLoader().loadAsync('assets/history/giza-plateau-140k.glb');const model=gltf.scene;
 // The source photograph already contains its lighting; avoid painting false shadows.
 model.traverse(obj=>{if(obj.isMesh){const old=obj.material;obj.material=new THREE.MeshBasicMaterial({map:old.map,color:0xfff6df,side:THREE.DoubleSide});if(old.map){old.map.colorSpace=THREE.SRGBColorSpace;old.map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());}old.dispose();}});scene.add(model);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshBasicMaterial({color:'#a68e69'}));ground.rotation.x=-Math.PI/2;ground.position.y=.77;scene.add(ground);
 const target=new THREE.Vector3(0,1.18,1.2),markers={khufu:new THREE.Vector3(-1.01957,2.20373,-2.16173),khafre:new THREE.Vector3(-1.15478,2.17261,1.56133),menkaure:new THREE.Vector3(-.56322,1.55652,4.943),sphinx:new THREE.Vector3(4.03455,1.16,-1.3754)};
 const labels=Object.entries(markers).map(([id,point])=>{const el=document.createElement('span');el.className='giza-monument-label';el.textContent=({khufu:'Khéops',khafre:'Khéphren',menkaure:'Mykérinos',sphinx:'Sphinx'})[id];container.append(el);return{el,point};});
 let progress=.5,zoom=1,shown=false,disposed=false,lastW=0,lastH=0;
 function render(){if(!shown||disposed)return;const width=innerWidth,height=innerHeight;if(width!==lastW||height!==lastH){renderer.setSize(width,height,false);lastW=width;lastH=height;}camera.aspect=width/height;
  const angle=-.29+(progress-.5)*Math.PI*1.5;const fov=width<700?61:56;const radius=Math.max(10.6,5.3/(Math.tan(THREE.MathUtils.degToRad(fov/2))*camera.aspect))/zoom;
  camera.position.set(target.x+Math.cos(angle)*radius,target.y+radius*Math.tan(THREE.MathUtils.degToRad(20)),target.z+Math.sin(angle)*radius);
  camera.fov=fov;camera.updateProjectionMatrix();camera.lookAt(target);renderer.render(scene,camera);
  for(const {el,point}of labels){const projected=point.clone().project(camera),x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height;el.hidden=projected.z>1||projected.z<0||x<20||x>width-20||y<140||y>height*.72;el.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-125%)`;}
 }
 const lost=e=>{e.preventDefault();onContextLost();};renderer.domElement.addEventListener('webglcontextlost',lost);
 return {update(value){progress=value;render();},setZoom(value){zoom=Math.max(.7,Math.min(1.5,value));render();},setVisible(value){if(shown===value)return;shown=value;container.hidden=!value;if(value)render();},resize:render,destroy(){disposed=true;renderer.domElement.removeEventListener('webglcontextlost',lost);model.traverse(obj=>{if(obj.isMesh){obj.geometry.dispose();obj.material.map?.dispose();obj.material.dispose();}});ground.geometry.dispose();ground.material.dispose();renderer.dispose();container.replaceChildren();}};
}
