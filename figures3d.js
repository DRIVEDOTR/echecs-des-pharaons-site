import * as THREE from './vendor/three.module.js';

const mount=document.getElementById('pieceThreeMount');
const fallback=document.getElementById('pieceFallback');
const stage=document.getElementById('pieceStage');
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(36,1,.1,100);
const root=new THREE.Group();scene.add(root);
const palette={
  w:{stone:0xe9d8b5,cloth:0xf6e8c9,deep:0x334d61,lapis:0x174a6e,gold:0xd6a750,skin:0xb8794a,ink:0x172d40},
  b:{stone:0x343d53,cloth:0x142b49,deep:0x0c1b33,lapis:0x183b67,gold:0xc49750,skin:0xa36442,ink:0x091627}
};
const mat=(color,metalness=0,roughness=.57)=>new THREE.MeshStandardMaterial({color,metalness,roughness,side:THREE.DoubleSide});
let renderer=null,angle=0,tilt=10,active=false,current=null;
try{
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.7;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden','true');
  mount.append(renderer.domElement);
  fallback.hidden=true;
  active=true;
}catch(error){mount.hidden=true;fallback.hidden=false;console.warn('Aperçu 3D indisponible',error);}
scene.add(new THREE.AmbientLight(0xd6e6ff,2.2));
const key=new THREE.DirectionalLight(0xffe1a6,3.7);key.position.set(-3,6,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-5;key.shadow.camera.right=5;key.shadow.camera.top=6;key.shadow.camera.bottom=-5;scene.add(key);
const rim=new THREE.DirectionalLight(0x5a99c7,2.7);rim.position.set(3,4,-4);scene.add(rim);
const fill=new THREE.PointLight(0xffd698,35);fill.position.set(3,1,4);scene.add(fill);
const floor=new THREE.Mesh(new THREE.CylinderGeometry(1.33,1.43,.12,64),mat(0x173447,.25,.45));floor.position.y=-.12;floor.receiveShadow=true;scene.add(floor);
const floorTrim=new THREE.Mesh(new THREE.TorusGeometry(1.34,.018,8,90),mat(0xd8a656,.8,.22));floorTrim.rotation.x=Math.PI/2;floorTrim.position.y=-.045;scene.add(floorTrim);
function add(group,geo,material,x=0,y=0,z=0,rx=0,ry=0,rz=0){const mesh=new THREE.Mesh(geo,material);mesh.position.set(x,y,z);mesh.rotation.set(rx,ry,rz);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;}
function cylinder(g,r1,r2,h,y,m,segments=32,x=0,z=0){return add(g,new THREE.CylinderGeometry(r1,r2,h,segments),m,x,y,z);}
function orb(g,x,y,z,sx,sy,sz,m){const o=add(g,new THREE.SphereGeometry(1,24,16),m,x,y,z);o.scale.set(sx,sy,sz);return o;}
function band(g,r,y,thick,m){return add(g,new THREE.TorusGeometry(r,thick,7,64),m,0,y,0,Math.PI/2);}
function rod(g,a,b,r,m,r2=r){const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),d=q.clone().sub(p);const mesh=add(g,new THREE.CylinderGeometry(r2,r,d.length(),12),m,...p.clone().add(q).multiplyScalar(.5).toArray());mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return mesh;}
function wing(g,sign,y,colors,horus=false){
  const shape=new THREE.Shape();shape.moveTo(0,0);shape.bezierCurveTo(.35,.25,1.05,.24,1.24,.1);shape.bezierCurveTo(1.14,-.25,.66,-.86,.17,-.78);shape.lineTo(0,0);
  const geo=new THREE.ExtrudeGeometry(shape,{depth:.14,bevelEnabled:true,bevelThickness:.045,bevelSize:.05,bevelSegments:2,steps:1,curveSegments:18});
  const w=add(g,geo,colors.deep,sign*.25,y,-.3,0,0,sign===1?-.15:.15);w.scale.x=sign;
  for(let i=0;i<5;i++){const x=sign*(.43+i*.15),yy=y-.28-i*.09;rod(g,[sign*.23,y-.05,-.17],[x,yy,-.17],.026,colors.gold,.012);}
  if(horus)for(let i=0;i<4;i++)orb(g,sign*(.62+i*.14),y-.35-i*.08,-.23,.06,.09,.04,colors.lapis);
}
function base(g,c){
  cylinder(g,.76,.81,.14,.08,c.deep);cylinder(g,.72,.75,.09,.185,c.gold);cylinder(g,.64,.66,.15,.305,c.stone);band(g,.72,.19,.018,c.ink);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;orb(g,Math.sin(a)*.69,.235,Math.cos(a)*.69,.033,.025,.025,c.lapis);}
}
function face(g,c,y=2.77,animal=false){
  const head=orb(g,0,y,.02,.28,.35,.245,c.skin);
  if(animal){orb(g,0,y+.11,.18,.25,.28,.25,c.stone);add(g,new THREE.ConeGeometry(.13,.38,4),c.gold,0,y-.02,.47,Math.PI/2);orb(g,-.12,y+.13,.385,.035,.047,.02,c.ink);orb(g,.12,y+.13,.385,.035,.047,.02,c.ink);}
  else{
    orb(g,-.105,y+.035,.246,.028,.027,.015,c.ink);orb(g,.105,y+.035,.246,.028,.027,.015,c.ink);
    rod(g,[-.07,y-.17,.23],[.07,y-.17,.23],.012,c.deep);
    orb(g,0,y-.07,.259,.055,.09,.045,c.skin);
    for(const sign of [-1,1])orb(g,sign*.27,y-.01,.02,.055,.11,.08,c.skin);
  }
  return head;
}
function headdress(g,c,kind){
  if(kind==='nefertiti'){
    cylinder(g,.28,.24,.72,3.34,c.lapis,32);cylinder(g,.32,.29,.1,3.72,c.gold);band(g,.27,3.09,.034,c.gold);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;orb(g,Math.sin(a)*.281,3.47,Math.cos(a)*.281,.022,.16,.03,c.gold);}
  }else if(kind==='osiris'){
    cylinder(g,.17,.26,.63,3.35,c.stone,24);for(const sign of [-1,1])orb(g,sign*.34,3.36,0,.12,.44,.11,c.gold);
    orb(g,0,3.75,0,.1,.11,.1,c.gold);
  }else{
    orb(g,0,3.12,-.04,.39,.29,.31,c.lapis);
    for(const sign of [-1,1]){
      const flank=add(g,new THREE.ConeGeometry(.18,.92,16),c.lapis,sign*.29,2.66,-.035,0,0,sign*.08);flank.scale.z=.65;
      rod(g,[sign*.22,3.19,.16],[sign*.47,2.24,.1],.03,c.gold,.022);
    }
    band(g,.35,3.06,.04,c.gold);
    cylinder(g,.08,.055,.2,3.39,c.gold,12,0,.22);
    orb(g,0,3.48,.24,.045,.13,.045,c.lapis);
  }
}
function person(g,c,role){
  const queen=role==='nefertari'||role==='nefertiti',falcon=role==='horus',god=role==='isis'||role==='osiris';
  base(g,c);
  const robe=cylinder(g,queen?.25:.31,.57,1.55,1.12,queen?c.cloth:c.deep,40);robe.scale.z=.78;
  cylinder(g,.35,.25,.54,2.14,c.stone,36).scale.z=.75;
  cylinder(g,.23,.34,.22,2.44,c.gold,32).scale.z=.8;
  for(let i=0;i<10;i++){const a=i*Math.PI/5;rod(g,[Math.sin(a)*.51,.47,Math.cos(a)*.4],[Math.sin(a)*.34,1.88,Math.cos(a)*.26],.014,i%2?c.gold:c.lapis,.01);}
  for(const sign of [-1,1]){
    orb(g,sign*.39,2.32,0,.14,.18,.16,c.skin);
    rod(g,[sign*.42,2.26,0],[sign*.53,1.25,.19],.11,c.skin,.065);
    cylinder(g,.105,.11,.13,1.58,c.gold,16,sign*.51,.17);
    orb(g,sign*.53,1.22,.2,.12,.17,.12,c.skin);
  }
  face(g,c,2.78,falcon);
  if(role==='nefertari')headdress(g,c,'queen');
  else if(role==='nefertiti')headdress(g,c,'nefertiti');
  else if(role==='osiris')headdress(g,c,'osiris');
  else headdress(g,c,'pharaoh');
  if(queen){
    for(const sign of [-1,1]){
      rod(g,[sign*.24,2.38,.21],[sign*.42,.7,.27],.033,c.gold,.013);
      orb(g,sign*.32,2.25,.21,.055,.1,.035,c.lapis);
    }
    orb(g,0,2.35,.31,.17,.13,.045,c.lapis);
  }
  if(role==='ramses'||role==='tutankhamun'){
    rod(g,[.61,1.14,.26],[.61,3.1,.26],.043,c.gold,.04);
    orb(g,.61,3.22,.26,.11,.15,.11,c.gold);
    for(const sign of [-1,1])rod(g,[sign*.18,2.29,.3],[sign*.31,1.9,.34],.04,c.gold,.025);
  }
  if(role==='horus'){
    wing(g,-1,2.15,c,true);wing(g,1,2.15,c,true);
    orb(g,0,3.55,.04,.12,.22,.12,c.gold);
  }
  if(role==='isis'){
    wing(g,-1,2.05,c);wing(g,1,2.05,c);
    add(g,new THREE.TorusGeometry(.3,.06,10,40,Math.PI),c.gold,0,3.47,0,0,0,Math.PI);
    orb(g,0,3.55,0,.15,.15,.1,c.gold);
  }
  if(role==='osiris'){
    rod(g,[-.31,1.85,.38],[.28,2.5,.42],.035,c.gold);
    rod(g,[.31,1.86,.38],[-.3,2.5,.43],.035,c.gold);
  }
}
function pyramid(g,c){
  base(g,c);
  const body=add(g,new THREE.ConeGeometry(.72,1.45,4,1),c.stone,0,1.04,0,0,Math.PI/4);
  const cap=add(g,new THREE.ConeGeometry(.25,.5,4),c.gold,0,1.99,0,0,Math.PI/4);
  for(let i=0;i<5;i++){
    const r=.68-i*.105,y=.38+i*.24;
    add(g,new THREE.TorusGeometry(r,.018,6,4),i%2?c.gold:c.lapis,0,y,0,Math.PI/2,Math.PI/4);
  }
  for(let f=0;f<4;f++){
    const a=Math.PI/4+f*Math.PI/2;
    for(let j=0;j<3;j++){const rr=.43-j*.11,y=.72+j*.26;orb(g,Math.sin(a)*rr,y,Math.cos(a)*rr,.035,.04,.025,c.gold);}
  }
  body.receiveShadow=true;cap.receiveShadow=true;
}
function obelisk(g,c){
  base(g,c);
  cylinder(g,.36,.47,.22,.48,c.gold,4).rotation.y=Math.PI/4;
  cylinder(g,.27,.37,2.16,1.67,c.stone,4).rotation.y=Math.PI/4;
  add(g,new THREE.ConeGeometry(.31,.68,4),c.gold,0,3.09,0,0,Math.PI/4);
  for(let j=0;j<7;j++){
    const y=.77+j*.31,r=.36-j*.012;
    for(let f=0;f<4;f++){const a=Math.PI/4+f*Math.PI/2;orb(g,Math.sin(a)*r,y,Math.cos(a)*r,.035,.075,.025,j%2?c.lapis:c.gold);}
  }
  for(const y of [.6,2.77])band(g,.39,y,.034,c.gold);
}
function makeFigure(asset){
  const dark=asset.endsWith('-dark')||asset==='tutankhamun'||asset==='nefertiti';
  const role=asset.replace('-dark','');
  const colors=Object.fromEntries(Object.entries(palette[dark?'b':'w']).map(([k,v])=>[k,mat(v,k==='gold'?.72:.1,k==='gold'?.28:.58)]));
  const g=new THREE.Group();
  if(role==='pyramid')pyramid(g,colors);else if(role==='obelisk')obelisk(g,colors);else person(g,colors,role);
  return g;
}
function resize(){if(!active)return;const w=mount.clientWidth,h=mount.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();render();}
function render(){if(!active)return;const a=angle*Math.PI/180,t=tilt*Math.PI/180,r=8.8;camera.position.set(Math.sin(a)*r,2.2+Math.sin(t)*r*.56,Math.cos(a)*r);camera.lookAt(0,1.72,0);renderer.render(scene,camera);}
window.addEventListener('castpiecechange',event=>{
  if(current){root.remove(current);current.traverse(obj=>{if(obj.geometry)obj.geometry.dispose();});}
  current=makeFigure(event.detail.asset);root.add(current);fallback.src=`assets/${event.detail.asset}.webp`;requestAnimationFrame(resize);
});
window.addEventListener('pieceviewchange',event=>{angle=event.detail.angle;tilt=event.detail.tilt;render();});
new ResizeObserver(resize).observe(mount);
stage.addEventListener('pointerup',render);
