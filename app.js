const $ = (id) => document.getElementById(id);
const canvas = $('board');
const ctx = canvas.getContext('2d');
const world = document.querySelector('.world');
const panorama = $('panorama');
const scenes = [
  {angle:0,asset:'giza'},
  {angle:53,asset:'luxor-karnak'},
  {angle:104,asset:'karnak'},
  {angle:158,asset:'kom-ombo-philae'},
  {angle:211,asset:'philae'},
  {angle:257,asset:'abu-simbel'},
  {angle:311,asset:'white-desert'}
];
const sceneLayers=scenes.map(scene=>{const layer=document.createElement('div');layer.className='scene-layer';layer.style.setProperty('--scene-image',`url('assets/${scene.asset}.webp')`);layer.style.backgroundImage=`url('assets/${scene.asset}.webp')`;panorama.appendChild(layer);return layer;});
const promotionDialog = $('promotionDialog');
const glyphs = {w:{k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'},b:{k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}};
const pieceArt = {
  w:{k:'ramses',q:'nefertari',r:'obelisk',n:'horus',p:'pyramid',isis:'isis',osiris:'osiris'},
  b:{k:'tutankhamun',q:'nefertiti',r:'obelisk-dark',n:'horus-dark',p:'pyramid-dark',isis:'isis-dark',osiris:'osiris-dark'}
};
const pieceNames={ramses:'Ramsès II',nefertari:'Néfertari',tutankhamun:'Toutankhamon',nefertiti:'Néfertiti',obelisk:'Obélisque',horus:'Horus',pyramid:'Pyramide',isis:'Isis',osiris:'Osiris','obelisk-dark':'Obélisque sombre','horus-dark':'Horus sombre','pyramid-dark':'Pyramide sombre','isis-dark':'Isis sombre','osiris-dark':'Osiris sombre'};
const art={};
for(const name of Object.keys(pieceNames)){const img=new Image();img.src=`assets/${name}.webp`;img.onload=()=>render();art[name]=img;}
function pieceArtName(p){return pieceArt[p.c][p.t==='b'?(p.variant||'isis'):p.t];}
const places = [
  {angle:0,region:'PLATEAU DE GIZEH',name:'Les pyramides de Gizeh'},
  {angle:53,region:'RIVE EST DU NIL',name:'Le temple de Louxor'},
  {angle:104,region:'RIVE EST DU NIL',name:'Le temple de Karnak'},
  {angle:158,region:'HAUTE-ÉGYPTE',name:'Le temple de Kom Ombo'},
  {angle:211,region:'ÎLE DU NIL',name:'Le temple de Philae'},
  {angle:257,region:'NUBIE',name:'Le temple d’Abou Simbel'},
  {angle:311,region:'DÉSERT OCCIDENTAL',name:'Le désert blanc'}
];
let state, selected = null, legal = [], hover = null, keyCell = {r:6,c:4};
let gameType='human',playerNames={w:'Joueur 1',b:'Joueur 2'},botTimer=null,moveAnimation=null,pendingTurnYaw=null;
let mode = 'follow', yawOffset = 0, fixedBase = 0, targetYaw = 0, currentYaw = 0, pitch = 48;
let dragging = false, pointerStart = null, wasDrag = false, soundOn = false, audioCtx = null, scenicMode = false;
let size = {w:0,h:0,dpr:1}, geom = null, squarePolys = [], zoom=1;
let framePending = false;
let captureEffects=[];
const files = 'abcdefgh';
const saveKey = 'echecs-des-pharaons:partie:v1';
let savedGame = null, saveDirty = false;

function initialState(){
  const back = ['r','n','b','q','k','b','n','r'];
  const board = Array.from({length:8},()=>Array(8).fill(null));
  for(let c=0;c<8;c++){
    board[0][c]={t:back[c],c:'b',...(back[c]==='b'?{variant:c===2?'isis':'osiris'}:{})}; board[1][c]={t:'p',c:'b'};
    board[6][c]={t:'p',c:'w'}; board[7][c]={t:back[c],c:'w',...(back[c]==='b'?{variant:c===2?'isis':'osiris'}:{})};
  }
  return {board,turn:'w',castling:{w:{k:true,q:true},b:{k:true,q:true}},ep:null,moves:[],snapshots:[],result:null};
}
function cloneForTest(s){return {board:s.board.map(row=>row.map(p=>p?{...p}:null)),turn:s.turn,castling:{w:{...s.castling.w},b:{...s.castling.b}},ep:s.ep?{...s.ep}:null};}
function inside(r,c){return r>=0&&r<8&&c>=0&&c<8;}
function opponent(c){return c==='w'?'b':'w';}
function makeMove(fr,fc,tr,tc,extra={}){return {fr,fc,tr,tc,...extra};}
function pseudoMoves(s,r,c,attacks=false){
  const p=s.board[r][c]; if(!p)return [];
  const out=[], foe=opponent(p.c);
  const add=(rr,cc,extra={})=>{if(inside(rr,cc))out.push(makeMove(r,c,rr,cc,extra));};
  if(p.t==='p'){
    const dir=p.c==='w'?-1:1, start=p.c==='w'?6:1;
    for(const dc of [-1,1]){
      const rr=r+dir,cc=c+dc;
      if(!inside(rr,cc))continue;
      if(attacks || (s.board[rr][cc]&&s.board[rr][cc].c===foe))add(rr,cc);
      else if(s.ep&&s.ep.r===rr&&s.ep.c===cc)add(rr,cc,{enPassant:true});
    }
    if(!attacks && inside(r+dir,c) && !s.board[r+dir][c]){
      add(r+dir,c);
      if(r===start&&!s.board[r+dir*2][c])add(r+dir*2,c,{doublePawn:true});
    }
  } else if(p.t==='n'){
    for(const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]){
      const rr=r+dr,cc=c+dc;
      if(inside(rr,cc)&&(attacks||!s.board[rr][cc]||s.board[rr][cc].c===foe))add(rr,cc);
    }
  } else if(p.t==='k'){
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
      if(!dr&&!dc)continue;const rr=r+dr,cc=c+dc;
      if(inside(rr,cc)&&(attacks||!s.board[rr][cc]||s.board[rr][cc].c===foe))add(rr,cc);
    }
    if(!attacks && c===4 && r===(p.c==='w'?7:0) && !inCheck(s,p.c)){
      if(s.castling[p.c].k&&!s.board[r][5]&&!s.board[r][6]&&s.board[r][7]?.t==='r'&&s.board[r][7]?.c===p.c&&!isAttacked(s,r,5,foe)&&!isAttacked(s,r,6,foe))add(r,6,{castle:'k'});
      if(s.castling[p.c].q&&!s.board[r][1]&&!s.board[r][2]&&!s.board[r][3]&&s.board[r][0]?.t==='r'&&s.board[r][0]?.c===p.c&&!isAttacked(s,r,3,foe)&&!isAttacked(s,r,2,foe))add(r,2,{castle:'q'});
    }
  } else {
    const directions=[];
    if(p.t==='r'||p.t==='q')directions.push([1,0],[-1,0],[0,1],[0,-1]);
    if(p.t==='b'||p.t==='q')directions.push([1,1],[1,-1],[-1,1],[-1,-1]);
    for(const [dr,dc] of directions){
      let rr=r+dr,cc=c+dc;
      while(inside(rr,cc)){
        if(!s.board[rr][cc])add(rr,cc);
        else {if(attacks||s.board[rr][cc].c===foe)add(rr,cc);break;}
        rr+=dr;cc+=dc;
      }
    }
  }
  return out;
}
function isAttacked(s,r,c,by){
  for(let rr=0;rr<8;rr++)for(let cc=0;cc<8;cc++)if(s.board[rr][cc]?.c===by){
    if(pseudoMoves(s,rr,cc,true).some(m=>m.tr===r&&m.tc===c))return true;
  }
  return false;
}
function inCheck(s,color){
  for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(s.board[r][c]?.t==='k'&&s.board[r][c]?.c===color)return isAttacked(s,r,c,opponent(color));
  return false;
}
function applyMove(s,m,promotion='q'){
  const p=s.board[m.fr][m.fc], target=s.board[m.tr][m.tc];
  s.board[m.fr][m.fc]=null;
  if(m.enPassant)s.board[m.fr][m.tc]=null;
  if(m.castle){
    const rookFrom=m.castle==='k'?7:0,rookTo=m.castle==='k'?5:3;
    s.board[m.fr][rookTo]=s.board[m.fr][rookFrom]; s.board[m.fr][rookFrom]=null;
  }
  s.board[m.tr][m.tc]=(p.t==='p'&&(m.tr===0||m.tr===7))?{t:promotion,c:p.c,...(promotion==='b'?{variant:'isis'}:{})}:p;
  if(p.t==='k'){s.castling[p.c].k=false;s.castling[p.c].q=false;}
  if(p.t==='r'&&m.fr===(p.c==='w'?7:0)){
    if(m.fc===0)s.castling[p.c].q=false;if(m.fc===7)s.castling[p.c].k=false;
  }
  if(target?.t==='r'&&m.tr===(target.c==='w'?7:0)){
    if(m.tc===0)s.castling[target.c].q=false;if(m.tc===7)s.castling[target.c].k=false;
  }
  s.ep=m.doublePawn?{r:(m.fr+m.tr)/2,c:m.fc}:null;
  s.turn=opponent(s.turn);
  return !!target||!!m.enPassant;
}
function legalMovesFor(s,r,c){
  const p=s.board[r][c];if(!p||p.c!==s.turn)return [];
  return pseudoMoves(s,r,c).filter(m=>{if(s.board[m.tr][m.tc]?.t==='k')return false;const test=cloneForTest(s);applyMove(test,m);return !inCheck(test,p.c);});
}
function allLegal(s){
  const out=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(s.board[r][c]?.c===s.turn)out.push(...legalMovesFor(s,r,c));return out;
}
function notation(m,p,capture,promotion){
  const labels={k:'R',q:'D',r:'T',b:'F',n:'C',p:''};
  if(m.castle)return m.castle==='k'?'O-O':'O-O-O';
  return (labels[p.t]||'')+files[m.fc]+(8-m.fr)+(capture?'×':'–')+files[m.tc]+(8-m.tr)+(promotion?'='+labels[promotion]:'');
}
function evaluateForComputer(s){
  const value={p:100,n:315,b:335,r:510,q:920,k:0};let score=0;
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const p=s.board[r][c];if(!p)continue;
    const center=3.5-Math.max(Math.abs(c-3.5),Math.abs(r-3.5));
    const advance=p.t==='p'?(p.c==='b'?r:7-r)*5:0;
    const activity=p.t==='k'?0:center*8;
    score+=(p.c==='b'?1:-1)*(value[p.t]+activity+advance);
  }
  return score;
}
function computerMove(){
  botTimer=null;if(gameType!=='computer'||state.turn!=='b'||state.result||moveAnimation)return;
  const options=allLegal(state);if(!options.length)return;
  let best=options[0],bestScore=-Infinity;
  for(const move of options){
    const after=cloneForTest(state);applyMove(after,move);
    const replies=allLegal(after);let score;
    if(!replies.length)score=inCheck(after,'w')?100000:0;
    else{
      score=Infinity;
      for(const reply of replies){const result=cloneForTest(after);applyMove(result,reply);score=Math.min(score,evaluateForComputer(result));}
    }
    score+=(Math.random()-.5)*3;
    if(score>bestScore){bestScore=score;best=move;}
  }
  play(best);
}
function scheduleComputer(){
  clearTimeout(botTimer);
  if(gameType==='computer'&&state.turn==='b'&&!state.result&&!moveAnimation)botTimer=setTimeout(computerMove,450);
}
function play(m,promotion='q'){
  if(state.result||moveAnimation)return;
  const p=state.board[m.fr][m.fc], promote=p.t==='p'&&(m.tr===0||m.tr===7);
  const victim=m.enPassant?state.board[m.fr][m.tc]:state.board[m.tr][m.tc];
  const start=performance.now(),duration=victim?3500:850;
  moveAnimation={m,p:{...p},start,duration};
  if(victim)captureEffects.push(makeCaptureEffect(victim,m.enPassant?m.fr:m.tr,m.tc,start+850));
  const snapshot=JSON.stringify({board:state.board,turn:state.turn,castling:state.castling,ep:state.ep,moves:state.moves,result:state.result});
  const capture=applyMove(state,m,promotion);
  state.snapshots.push(snapshot);
  let text=notation(m,p,capture,promote?promotion:null);
  const check=inCheck(state,state.turn), possible=allLegal(state);
  if(possible.length===0){state.result=check?'mat':'pat';text+=check?'#':'';}
  else if(check)text+='+';
  state.moves.push(text);selected=null;legal=[];keyCell={r:m.tr,c:m.tc};
  saveDirty=true;
  if(mode==='follow')pendingTurnYaw=targetYaw+(state.turn==='b'?180:-180);
  updateGameUI();updateSaveUI();chirp(capture);startAnimation();render();
}
function choose(r,c){
  if(state.result||moveAnimation||(gameType==='computer'&&state.turn==='b'))return;
  const move=legal.find(m=>m.tr===r&&m.tc===c);
  if(move){
    if(state.board[move.fr][move.fc].t==='p'&&(r===0||r===7)){
      promotionDialog.querySelector('button[value="q"] img').src=`assets/${state.turn==='w'?'nefertari':'nefertiti'}.webp`;
      for(const [type,name] of [['r','obelisk'],['b','isis'],['n','horus']])promotionDialog.querySelector(`button[value="${type}"] img`).src=`assets/${name}${state.turn==='b'?'-dark':''}.webp`;
      promotionDialog.showModal();
      promotionDialog.addEventListener('close',()=>play(move,promotionDialog.returnValue||'q'),{once:true});
    }else play(move);
    return;
  }
  if(state.board[r][c]?.c===state.turn){selected={r,c};legal=legalMovesFor(state,r,c);}
  else {selected=null;legal=[];}
  keyCell={r,c};render();
}
function reset(keepView=false){clearTimeout(botTimer);moveAnimation=null;pendingTurnYaw=null;captureEffects=[];state=initialState();selected=null;legal=[];saveDirty=true;if(keepView){if(mode==='follow')targetYaw=yawOffset;}else{targetYaw=0;currentYaw=0;yawOffset=0;fixedBase=0;mode='follow';pitch=48;$('heightRange').value=48;}updateGameModeUI();updateControls();updateGameUI();updateSaveUI();startAnimation();render();}
function undo(){if(!state.snapshots.length)return;clearTimeout(botTimer);moveAnimation=null;pendingTurnYaw=null;captureEffects=[];const count=gameType==='computer'&&state.turn==='w'&&state.snapshots.length>=2?2:1;for(let i=0;i<count;i++){const snap=JSON.parse(state.snapshots.pop());Object.assign(state,snap);}selected=null;legal=[];saveDirty=true;if(mode==='follow')targetYaw=(state.turn==='b'?180:0)+yawOffset;updateControls();updateGameUI();updateSaveUI();startAnimation();render();scheduleComputer();}
function validGame(s){
  return s&&Array.isArray(s.board)&&s.board.length===8&&s.board.every(row=>Array.isArray(row)&&row.length===8&&row.every(p=>p===null||(p&&['k','q','r','b','n','p'].includes(p.t)&&['w','b'].includes(p.c))))&&
    ['w','b'].includes(s.turn)&&s.castling&&['w','b'].every(c=>s.castling[c]&&typeof s.castling[c].k==='boolean'&&typeof s.castling[c].q==='boolean')&&
    (s.ep===null||(s.ep&&Number.isInteger(s.ep.r)&&Number.isInteger(s.ep.c)&&inside(s.ep.r,s.ep.c)))&&
    Array.isArray(s.moves)&&s.moves.every(m=>typeof m==='string'&&m.length<30)&&Array.isArray(s.snapshots)&&s.snapshots.every(x=>typeof x==='string'&&x.length<20000)&&
    [null,'mat','pat'].includes(s.result);
}
function loadSavedGame(){
  try{const raw=localStorage.getItem(saveKey);if(!raw)return;const parsed=JSON.parse(raw);if([1,2].includes(parsed.version)&&validGame(parsed.game))savedGame=parsed;}
  catch(_){savedGame=null;}
}
function updateSaveUI(message='',error=false){
  $('resumeGame').disabled=!savedGame;
  const status=$('saveStatus');status.classList.toggle('error',error);
  if(message){status.textContent=message;return;}
  if(!savedGame){status.textContent='Aucune partie sauvegardée sur cet appareil.';return;}
  const date=new Date(savedGame.savedAt);
  const when=Number.isNaN(date.getTime())?'':` le ${new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short'}).format(date)}`;
  status.textContent=`Partie sauvegardée${when} · ${savedGame.game.moves.length} coup${savedGame.game.moves.length>1?'s':''}${saveDirty?' · changements non sauvegardés':''}.`;
}
function saveGame(){
  const game=JSON.parse(JSON.stringify(state));
  const view={mode,yawOffset,fixedBase,targetYaw,pitch,zoom};
  const record={version:2,savedAt:new Date().toISOString(),game,view,settings:{gameType,playerNames:{...playerNames}}};
  try{localStorage.setItem(saveKey,JSON.stringify(record));savedGame=record;saveDirty=false;updateSaveUI();}
  catch(_){updateSaveUI('La sauvegarde est indisponible dans ce navigateur.',true);}
}
function resumeGame(){
  if(!savedGame||!validGame(savedGame.game))return;
  clearTimeout(botTimer);moveAnimation=null;pendingTurnYaw=null;captureEffects=[];state=JSON.parse(JSON.stringify(savedGame.game));selected=null;legal=[];hover=null;saveDirty=false;
  gameType=savedGame.settings?.gameType==='computer'?'computer':'human';
  const names=savedGame.settings?.playerNames;
  playerNames={w:typeof names?.w==='string'?names.w.slice(0,24):'Joueur 1',b:typeof names?.b==='string'?names.b.slice(0,24):'Joueur 2'};
  updateGameModeUI();
  const view=savedGame.view||{};
  mode=view.mode==='fixed'?'fixed':'follow';
  yawOffset=Number.isFinite(view.yawOffset)?view.yawOffset:0;
  fixedBase=Number.isFinite(view.fixedBase)?view.fixedBase:0;
  targetYaw=Number.isFinite(view.targetYaw)?view.targetYaw:0;
  currentYaw=targetYaw;
  pitch=Number.isFinite(view.pitch)?Math.max(25,Math.min(75,view.pitch)):48;
  zoom=Number.isFinite(view.zoom)?Math.max(.7,Math.min(2.3,view.zoom)):1;
  $('heightRange').value=Math.round(pitch);$('zoomRange').value=Math.round(zoom*100);
  updateControls();updateGameUI();updateSaveUI('Partie reprise. À vous de jouer.');render();scheduleComputer();
}
function updateGameModeUI(){
  for(const [type,id] of [['computer','computerMode'],['human','humanMode']]){
    const button=$(id),active=gameType===type;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
  }
  $('playerNames').hidden=gameType!=='human';
  $('whiteName').value=playerNames.w;$('blackName').value=playerNames.b;
  $('gameModeHelp').textContent=gameType==='computer'?'Vous jouez le camp clair. L’ordinateur joue le camp sombre.':'Deux personnes jouent à tour de rôle sur cet appareil.';
}
function setGameType(type){
  if(gameType===type)return;
  gameType=type;reset(true);
}
function updateGameUI(){
  $('turnText').textContent=gameType==='computer'?(state.turn==='w'?'Vous':'Ordinateur'):(playerNames[state.turn].trim()||`Joueur ${state.turn==='w'?1:2}`);
  $('turnIcon').src=`assets/${state.turn==='w'?'ramses':'tutankhamun'}.webp`;
  $('royalNames').textContent=(state.turn==='w'?'Camp clair · Ramsès II':'Camp sombre · Toutankhamon');
  $('gameStatus').textContent=state.result==='mat'?'Échec et mat — partie terminée':state.result==='pat'?'Pat — partie terminée':inCheck(state,state.turn)?'Échec au roi':gameType==='computer'&&state.turn==='b'?'L’ordinateur réfléchit…':state.moves.length?'À vous de jouer':'La partie commence';
  $('undoBtn').disabled=!state.snapshots.length;
  $('moveCount').textContent=String(state.moves.length).padStart(2,'0');
  $('moves').innerHTML=state.moves.length?state.moves.map((move,i)=>`<span class="move"><b>${Math.floor(i/2)+1}${i%2?'…':'.'}</b>${move}</span>`).join(''):'<span class="empty-moves">Le premier coup écrira l’histoire.</span>';
}
function updateControls(){
  $('followBtn').classList.toggle('active',mode==='follow');$('fixedBtn').classList.toggle('active',mode==='fixed');
  $('followBtn').setAttribute('aria-pressed',mode==='follow');$('fixedBtn').setAttribute('aria-pressed',mode==='fixed');
  $('modeHelp').textContent=mode==='follow'?'La vue se place derrière les pièces du joueur dont c’est le tour.':'Le décor et le plateau gardent leur angle quand le tour change.';
  const base=mode==='follow'?(state.turn==='b'?180:0):fixedBase;
  const angle=((targetYaw-base+180)%360+360)%360-180;
  $('angleRange').value=Math.round(angle);$('angleValue').textContent=Math.round(angle)+'°';
  $('heightValue').textContent=pitch+'°';
  $('zoomValue').textContent=Math.round(zoom*100)+' %';
}
function markViewChanged(){saveDirty=true;updateSaveUI();}
function setMode(next){if(mode===next)return;const prior=targetYaw;mode=next;if(next==='fixed')fixedBase=prior-yawOffset;else targetYaw=(state.turn==='b'?180:0)+yawOffset;markViewChanged();updateControls();startAnimation();}
function resize(){const rect=world.getBoundingClientRect();size={w:rect.width,h:rect.height,dpr:Math.min(window.devicePixelRatio||1,2)};canvas.width=Math.round(size.w*size.dpr);canvas.height=Math.round(size.h*size.dpr);canvas.style.width=size.w+'px';canvas.style.height=size.h+'px';ctx.setTransform(size.dpr,0,0,size.dpr,0,0);render();}
function projection(){
  const rad=currentYaw*Math.PI/180,tilt=pitch*Math.PI/180;
  const cos=Math.cos(rad),sin=Math.sin(rad),depth=Math.sin(tilt);
  const heightGuard=Math.max(1,depth/.74);
  const diagonal=Math.abs(Math.sin(2*rad));
  const scale=Math.min(size.w/14.5,size.h/13)*zoom/heightGuard;
  const lowerEdge=Math.max(...[[-4,-4],[4,-4],[4,4],[-4,4]].map(([x,y])=>{
    const dy=x*sin+y*cos;
    return (dy*scale*depth+.78*scale*Math.cos(tilt))/(1-dy/16);
  }));
  const centeredY=size.h*(.60-.14*diagonal);
  const overflow=Math.max(0,centeredY+lowerEdge-(size.h-24));
  return {
    cos,sin,depth,rise:Math.cos(tilt),
    scale,cx:size.w*.5,cy:centeredY-Math.min(size.h*.08,overflow)
  };
}
function project(x,y,z=0){const g=geom;const rx=x*g.cos-y*g.sin,dy=x*g.sin+y*g.cos;const factor=1/(1-dy/16);return {x:g.cx+rx*g.scale*factor,y:g.cy+(dy*g.scale*g.depth-z*g.scale*g.rise)*factor,factor};}
function pathPoly(points){ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);ctx.closePath();}
function cellPoints(r,c){return [project(c-4,r-4),project(c-3,r-4),project(c-3,r-3),project(c-4,r-3)];}
function pointInPoly(x,y,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)hit=!hit;}return hit;}
function cellAt(x,y){for(let i=squarePolys.length-1;i>=0;i--){const item=squarePolys[i];if(pointInPoly(x,y,item.poly))return {r:item.r,c:item.c};}return null;}
function drawRim(){
  const points=[[-4,-4],[4,-4],[4,4],[-4,4]],normals=[[0,-1],[1,0],[0,1],[-1,0]];
  const signs=['𓋹','𓂀','𓆣','𓇳','𓊹','𓍯','𓃀'];
  points.forEach(([x,y],i)=>{
    const [nx,ny]=normals[i];if(nx*geom.sin+ny*geom.cos<.02)return;
    const [xx,yy]=points[(i+1)%4],a=project(x,y),b=project(xx,yy),d=project(xx,yy,-.78),c=project(x,y,-.78);
    pathPoly([a,b,d,c]);
    const shade=ctx.createLinearGradient(a.x,a.y,c.x,c.y);
    shade.addColorStop(0,'#e6bd75');shade.addColorStop(.1,'#745738');shade.addColorStop(.26,'#192e4b');shade.addColorStop(.74,'#132b4b');shade.addColorStop(.9,'#5d472e');shade.addColorStop(1,'#c99b58');
    ctx.fillStyle=shade;ctx.fill();ctx.strokeStyle='rgba(227,185,108,.76)';ctx.lineWidth=1.4;ctx.stroke();
    for(const t of [.16,.85]){ctx.beginPath();ctx.moveTo(a.x+(c.x-a.x)*t,a.y+(c.y-a.y)*t);ctx.lineTo(b.x+(d.x-b.x)*t,b.y+(d.y-b.y)*t);ctx.strokeStyle='rgba(233,191,111,.57)';ctx.lineWidth=Math.max(.7,geom.scale*.015);ctx.stroke();}
    ctx.save();ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(d.x,d.y);ctx.lineTo(c.x,c.y);ctx.clip();
    const span=Math.hypot(b.x-a.x,b.y-a.y),count=Math.max(2,Math.min(12,Math.floor(span/38)));
    for(let n=0;n<count;n++){
      const t=(n+.5)/count,top={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},bottom={x:c.x+(d.x-c.x)*t,y:c.y+(d.y-c.y)*t};
      ctx.save();ctx.translate((top.x+bottom.x)/2,(top.y+bottom.y)/2);let theta=Math.atan2(b.y-a.y,b.x-a.x);if(theta>Math.PI/2||theta< -Math.PI/2)theta+=Math.PI;ctx.rotate(theta);
      ctx.font=`${Math.max(9,Math.min(17,geom.scale*.27))}px 'Noto Sans Egyptian Hieroglyphs','Apple Symbols',serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(237,197,120,.77)';ctx.fillText(signs[(n+i*2)%signs.length],0,0);ctx.restore();
    }
    ctx.restore();
  });
}
function drawBoard(){
  ctx.clearRect(0,0,size.w,size.h);geom=projection();squarePolys=[];
  const corners=[project(-4,-4),project(4,-4),project(4,4),project(-4,4)];
  ctx.save();ctx.shadowColor='rgba(4,18,34,.6)';ctx.shadowBlur=44;ctx.shadowOffsetY=28;pathPoly([project(-4,-4,-.78),project(4,-4,-.78),project(4,4,-.78),project(-4,4,-.78)]);ctx.fillStyle='#10263c';ctx.fill();ctx.restore();
  drawRim();
  ctx.save();pathPoly(corners);ctx.fillStyle='#b48a4f';ctx.fill();ctx.restore();
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const poly=cellPoints(r,c);squarePolys.push({r,c,poly});pathPoly(poly);
    const light=(r+c)%2===0;
    const grain=ctx.createLinearGradient(poly[0].x,poly[0].y,poly[2].x,poly[2].y);
    if(light){grain.addColorStop(0,'#fff1cc');grain.addColorStop(.48,'#e5c990');grain.addColorStop(1,'#cba66b');}
    else{grain.addColorStop(0,'#173961');grain.addColorStop(.52,'#102747');grain.addColorStop(1,'#29527a');}
    let fill=grain;
    if(selected?.r===r&&selected?.c===c)fill='#f5bd63';
    else if(legal.some(m=>m.tr===r&&m.tc===c))fill=(r+c)%2===0?'#eac18a':'#4a6888';
    else if(hover?.r===r&&hover?.c===c)fill=(r+c)%2===0?'#f9eac9':'#2d5175';
    ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=light?'rgba(132,89,39,.43)':'rgba(226,181,96,.48)';ctx.lineWidth=1.15;ctx.stroke();
    if((r*3+c*5)%3!==0){
      const center=project(c-3.5,r-3.5);ctx.save();pathPoly(poly);ctx.clip();ctx.filter='blur(.85px)';
      ctx.globalAlpha=light?.20:.28;ctx.fillStyle=light?'#8e692f':'#dfbb77';
      ctx.font=`${Math.max(7,geom.scale*.17)}px 'Noto Sans Egyptian Hieroglyphs','Apple Symbols',serif`;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(['𓋹','𓂀','𓆣','𓇳','𓊹'][(r*2+c)%5],center.x,center.y);ctx.restore();
    }
    if(legal.some(m=>m.tr===r&&m.tc===c)){
      const p=project(c-3.5,r-3.5);ctx.beginPath();ctx.arc(p.x,p.y,Math.max(4,geom.scale*.085),0,Math.PI*2);ctx.fillStyle='rgba(251,244,207,.72)';ctx.fill();
    }
  }
  pathPoly(corners);ctx.strokeStyle='#e1b670';ctx.lineWidth=5;ctx.stroke();
  const pieces=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(state.board[r][c]&&!(moveAnimation&&r===moveAnimation.m.tr&&c===moveAnimation.m.tc))pieces.push({r,c,p:state.board[r][c],pos:project(c-3.5,r-3.5)});
  pieces.sort((a,b)=>a.pos.y-b.pos.y);
  for(const item of pieces)drawPiece(item);
  drawCaptureEffects();
  drawMovingPiece();
}
function makeCaptureEffect(piece,r,c,start){
  const particles=[];
  for(let i=0;i<210;i++){
    const a=Math.random()*Math.PI*2,spread=Math.sqrt(Math.random()),height=Math.random();
    particles.push({x:Math.cos(a)*spread*.26,y:-height*.95,z:Math.sin(a)*spread*.17,drift:(Math.random()-.5)*.28,delay:Math.random()*.21,size:.012+Math.random()*.022});
  }
  return {r,c,piece,start,duration:2350,particles};
}
function drawCaptureEffects(){
  const now=performance.now(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  captureEffects=captureEffects.filter(effect=>now-effect.start<(reduced?450:effect.duration));
  for(const effect of captureEffects){
    if(now<effect.start){drawPiece({p:effect.piece,pos:project(effect.c-3.5,effect.r-3.5)});continue;}
    const t=Math.min(1,(now-effect.start)/(reduced?450:effect.duration));
    const base=project(effect.c-3.5,effect.r-3.5),unit=geom.scale*base.factor;
    ctx.save();
    const fall=Math.min(1,t/.44),wind=Math.max(0,(t-.48)/.52),sand=effect.piece.c==='w'?'#e4be78':'#a78a66';
    const image=art[pieceArtName(effect.piece)];
    if(image?.complete&&image.naturalWidth&&fall<1){
      const height=unit*({p:.72,r:1.16,n:1.2,b:1.27,q:1.43,k:1.5}[effect.piece.t]);
      const width=height*image.naturalWidth/image.naturalHeight;
      const top=base.y-height+unit*.05;
      ctx.save();ctx.beginPath();ctx.rect(base.x-width/2,top+height*fall,width,height*(1-fall));ctx.clip();
      ctx.globalAlpha=(1-fall*.7);ctx.drawImage(image,base.x-width/2,top,width,height);ctx.restore();
    }
    ctx.globalAlpha=(1-wind)*.88;
    ctx.fillStyle=sand;
    ctx.beginPath();ctx.ellipse(base.x+wind*unit*.48,base.y+unit*.015,unit*(.08+.22*fall),unit*(.02+.055*fall)*(1-wind*.6),0,0,Math.PI*2);ctx.fill();
    for(const grain of effect.particles){
      const progress=Math.min(1,Math.max(0,(fall-grain.delay)/(1-grain.delay)));
      const x=base.x+unit*(grain.x+grain.drift*progress+wind*(.25+grain.z*2+progress*.82));
      const y=base.y+unit*(grain.y*(1-progress)+grain.z*.2-wind*(.12+grain.delay*.23));
      ctx.globalAlpha=(1-wind)*(progress<1?.86:.67);
      ctx.fillStyle=grain.delay>.12?'#f2dba9':sand;
      ctx.beginPath();ctx.arc(x,y,Math.max(.65,unit*grain.size*(1-wind*.55)),0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
}
function drawMovingPiece(){
  if(!moveAnimation)return;
  const {m,p,start,duration}=moveAnimation;
  const t=Math.min(1,(performance.now()-start)/duration),travel=t*t*(3-2*t);
  const x=m.fc-3.5+(m.tc-m.fc)*travel,y=m.fr-3.5+(m.tr-m.fr)*travel;
  drawPiece({p,pos:project(x,y,Math.sin(Math.PI*t)*.28)});
}
function drawPiece({p,pos}){
  const s=geom.scale*pos.factor,white=p.c==='w',name=pieceArtName(p),img=art[name];
  ctx.save();
  ctx.shadowColor='rgba(7,22,28,.55)';ctx.shadowBlur=s*.17;ctx.shadowOffsetY=s*.1;
  ctx.beginPath();ctx.ellipse(pos.x,pos.y+s*.025,s*.34,s*.12,0,0,Math.PI*2);
  ctx.fillStyle=white?'#ead8a4':'#17253e';ctx.fill();
  ctx.shadowColor='transparent';ctx.lineWidth=Math.max(1.5,s*.035);ctx.strokeStyle=white?'#fff0bf':'#c99b56';ctx.stroke();
  if(img?.complete&&img.naturalWidth){
    const height=s*({p:.72,r:1.16,n:1.2,b:1.27,q:1.43,k:1.5}[p.t]);
    const width=height*img.naturalWidth/img.naturalHeight;
    ctx.shadowColor='rgba(4,22,27,.65)';ctx.shadowBlur=s*.13;ctx.shadowOffsetY=s*.09;
    ctx.drawImage(img,pos.x-width/2,pos.y-height+s*.05,width,height);
  }else{
    ctx.font=`${Math.round(s*.7)}px Georgia,serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=white?'#fff1cb':'#d2a665';ctx.fillText(glyphs[p.c][p.t],pos.x,pos.y-s*.4);
  }
  ctx.restore();
}
function updateLandscape(){
  const angle=((currentYaw%360)+360)%360;
  const nearest=scenes.map((scene,i)=>({i,d:Math.abs(((angle-scene.angle+540)%360)-180)})).sort((a,b)=>a.d-b.d);
  const blend=Math.max(0,Math.min(.5,(10-(nearest[1].d-nearest[0].d))/20));
  sceneLayers.forEach((layer,i)=>{layer.style.opacity=i===nearest[0].i?String(1-blend):i===nearest[1].i?String(blend):'0';const delta=((angle-scenes[i].angle+540)%360)-180;layer.style.transform=`scale(1.06) translate(${Math.max(-25,Math.min(25,-delta*.3))}px,${-(pitch-48)*.65}px)`;});
  $('azimuth').textContent=String(Math.round(angle)).padStart(3,'0')+'°';
  $('compassNeedle').style.transform=`rotate(${currentYaw+45}deg)`;
  const shifted=(angle+25)%360;let index=0;
  for(let i=places.length-1;i>=0;i--)if(shifted>=places[i].angle){index=i;break;}
  const place=places[index];$('landmarkRegion').textContent=place.region;$('landmarkName').textContent=place.name;$('landmarkIndex').textContent=String(index+1).padStart(2,'0')+' / 07';
  $('sun').style.left=(64-Math.sin(currentYaw*Math.PI/180)*26)+'%';
  $('sun').style.top=(18-(pitch-48)*.15)+'%';
}
function render(){if(!size.w)return;if(scenicMode){ctx.clearRect(0,0,size.w,size.h);squarePolys=[];}else drawBoard();updateLandscape();}
function startAnimation(){if(!framePending){framePending=true;requestAnimationFrame(animation);}}
function animation(){
  framePending=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const now=performance.now();
  if(moveAnimation&&now-moveAnimation.start>=moveAnimation.duration){
    moveAnimation=null;
    if(pendingTurnYaw!==null){targetYaw=pendingTurnYaw;pendingTurnYaw=null;yawOffset=targetYaw-(state.turn==='b'?180:0);updateControls();}
    scheduleComputer();
  }
  const diff=targetYaw-currentYaw;
  if(Math.abs(diff)>.03)currentYaw+=reduced?diff:diff*.14;
  else currentYaw=targetYaw;
  render();
  if(Math.abs(targetYaw-currentYaw)>.03||moveAnimation||captureEffects.length)startAnimation();
}
function localPoint(e){const rect=canvas.getBoundingClientRect();return {x:e.clientX-rect.left,y:e.clientY-rect.top};}
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointerStart={...localPoint(e),yaw:targetYaw,pitch};dragging=true;wasDrag=false;});
canvas.addEventListener('pointermove',e=>{const p=localPoint(e);if(dragging&&pointerStart){const dx=p.x-pointerStart.x,dy=p.y-pointerStart.y;if(Math.abs(dx)+Math.abs(dy)>8)wasDrag=true;if(wasDrag){const sensitivity=matchMedia('(max-width:600px)').matches?.16:.55;targetYaw=pointerStart.yaw+dx*sensitivity;pitch=Math.max(25,Math.min(75,pointerStart.pitch-dy*.08));$('heightRange').value=Math.round(pitch);markViewChanged();updateControls();startAnimation();render();}}else{hover=cellAt(p.x,p.y);render();}});
canvas.addEventListener('pointerup',e=>{if(!wasDrag&&!scenicMode){const p=localPoint(e),cell=cellAt(p.x,p.y);if(cell)choose(cell.r,cell.c);}dragging=false;pointerStart=null;wasDrag=false;});
canvas.addEventListener('pointercancel',()=>{dragging=false;pointerStart=null;wasDrag=false;});
canvas.addEventListener('pointerleave',()=>{if(!dragging){hover=null;render();}});
canvas.tabIndex=0;
canvas.addEventListener('keydown',e=>{let handled=true;if(e.key==='ArrowUp')keyCell.r=Math.max(0,keyCell.r-1);else if(e.key==='ArrowDown')keyCell.r=Math.min(7,keyCell.r+1);else if(e.key==='ArrowLeft')keyCell.c=Math.max(0,keyCell.c-1);else if(e.key==='ArrowRight')keyCell.c=Math.min(7,keyCell.c+1);else if(e.key==='Enter'||e.key===' ')choose(keyCell.r,keyCell.c);else handled=false;if(handled){e.preventDefault();hover={...keyCell};render();}});
$('followBtn').addEventListener('click',()=>setMode('follow'));
$('fixedBtn').addEventListener('click',()=>setMode('fixed'));
$('computerMode').addEventListener('click',()=>setGameType('computer'));
$('humanMode').addEventListener('click',()=>setGameType('human'));
for(const [id,color] of [['whiteName','w'],['blackName','b']])$(id).addEventListener('input',event=>{playerNames[color]=event.target.value.slice(0,24);saveDirty=true;updateGameUI();updateSaveUI();});
const castRoster={
  w:[['ramses','Ramsès II','Souverain · Roi'],['nefertari','Néfertari','Souveraine · Reine'],['horus','Horus','Cavalier'],['isis','Isis','Fou gauche'],['osiris','Osiris','Fou droit'],['obelisk','Obélisque','Tour'],['pyramid','Pyramide','Pion']],
  b:[['tutankhamun','Toutankhamon','Souverain · Roi'],['nefertiti','Néfertiti','Souveraine · Reine'],['horus-dark','Horus','Cavalier'],['isis-dark','Isis','Fou gauche'],['osiris-dark','Osiris','Fou droit'],['obelisk-dark','Obélisque','Tour'],['pyramid-dark','Pyramide','Pion']]
};
let castSide='w',castIndex=0,pieceAngle=0,pieceSpinning=false,piecePointer=null,pieceAnimation=0;
function setPieceAngle(angle){pieceAngle=((angle%360)+360)%360;$('pieceAngle').value=Math.round(pieceAngle);$('pieceAngleValue').textContent=Math.round(pieceAngle)+'°';window.dispatchEvent(new CustomEvent('pieceviewchange',{detail:{angle:pieceAngle}}));}
function showCastPiece(){
  const [asset,name,role]=castRoster[castSide][castIndex],src=`assets/${asset}.webp`;
  $('pieceFallback').src=src;$('pieceName').textContent=name;$('pieceRole').textContent=role;
  window.dispatchEvent(new CustomEvent('castpiecechange',{detail:{asset,side:castSide,index:castIndex}}));
  $('pieceCamp').textContent=`CAMP ${castSide==='w'?'CLAIR':'SOMBRE'} · ${String(castIndex+1).padStart(2,'0')} / 07`;
  $('pieceStage').setAttribute('aria-label',`${name}, ${role}. Glissez ou utilisez les flèches pour tourner la pièce sur 360 degrés.`);
  const grid=$('castGrid');grid.replaceChildren();
  castRoster[castSide].forEach(([image,label,caption],index)=>{
    const button=document.createElement('button');button.type='button';button.setAttribute('aria-pressed',String(index===castIndex));
    const img=document.createElement('img');img.src=`assets/${image}.webp`;img.alt='';
    const title=document.createElement('strong');title.textContent=label;
    const sub=document.createElement('span');sub.textContent=caption.split(' · ').pop();
    button.append(img,title,sub);button.addEventListener('click',()=>{castIndex=index;setPieceAngle(0);showCastPiece();});grid.append(button);
  });
}
function stopPieceSpin(){pieceSpinning=false;$('pieceSpin').setAttribute('aria-pressed','false');$('pieceSpin').textContent='Faire tourner automatiquement';cancelAnimationFrame(pieceAnimation);}
function animatePiece(){if(!pieceSpinning||!$('castDialog').open)return;setPieceAngle(pieceAngle+.7);pieceAnimation=requestAnimationFrame(animatePiece);}
$('castButton').addEventListener('click',()=>{showCastPiece();$('castDialog').showModal();});
$('closeCast').addEventListener('click',()=>$('castDialog').close());
$('castDialog').addEventListener('close',stopPieceSpin);
document.querySelectorAll('[data-cast]').forEach(button=>button.addEventListener('click',()=>{
  castSide=button.dataset.cast;
  document.querySelectorAll('[data-cast]').forEach(item=>{item.classList.toggle('active',item===button);item.setAttribute('aria-pressed',item===button?'true':'false');});
  setPieceAngle(0);showCastPiece();
}));
$('pieceAngle').addEventListener('input',e=>{stopPieceSpin();setPieceAngle(Number(e.target.value));});
$('pieceSpin').addEventListener('click',()=>{pieceSpinning=!pieceSpinning;$('pieceSpin').setAttribute('aria-pressed',String(pieceSpinning));$('pieceSpin').textContent=pieceSpinning?'Arrêter la rotation':'Faire tourner automatiquement';if(pieceSpinning)animatePiece();else cancelAnimationFrame(pieceAnimation);});
$('pieceStage').addEventListener('pointerdown',e=>{stopPieceSpin();$('pieceStage').setPointerCapture(e.pointerId);piecePointer={x:e.clientX,angle:pieceAngle};});
$('pieceStage').addEventListener('pointermove',e=>{if(piecePointer)setPieceAngle(piecePointer.angle+(e.clientX-piecePointer.x)*.8);});
$('pieceStage').addEventListener('pointerup',()=>{piecePointer=null;});
$('pieceStage').addEventListener('pointercancel',()=>{piecePointer=null;});
$('pieceStage').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();stopPieceSpin();setPieceAngle(pieceAngle+(e.key==='ArrowRight'?15:-15));}});
$('exploreBtn').addEventListener('click',()=>{scenicMode=!scenicMode;$('exploreBtn').setAttribute('aria-pressed',scenicMode);$('exploreBtn').textContent=scenicMode?'Afficher le plateau':'Explorer le décor';$('sceneHint').textContent=scenicMode?'Glissez pour parcourir le panorama à 360°':'Glissez sur le plateau pour explorer · Cliquez pour jouer';render();});
$('angleRange').addEventListener('input',e=>{const base=mode==='follow'?(state.turn==='b'?180:0):fixedBase;targetYaw=base+Number(e.target.value);yawOffset=Number(e.target.value);markViewChanged();updateControls();startAnimation();});
$('heightRange').addEventListener('input',e=>{pitch=Number(e.target.value);markViewChanged();updateControls();render();});
$('zoomRange').addEventListener('input',e=>{zoom=Number(e.target.value)/100;markViewChanged();updateControls();render();});
document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{const preset=button.dataset.preset;const value=preset==='front'?0:preset==='left'?-90:90;const base=mode==='follow'?(state.turn==='b'?180:0):fixedBase;targetYaw=base+value;yawOffset=value;markViewChanged();updateControls();startAnimation();}));
$('newGame').addEventListener('click',()=>reset(true));$('undoBtn').addEventListener('click',undo);
$('saveGame').addEventListener('click',saveGame);$('resumeGame').addEventListener('click',resumeGame);
$('soundBtn').addEventListener('click',()=>{soundOn=!soundOn;$('soundBtn').classList.toggle('active',soundOn);$('soundBtn').setAttribute('aria-label',soundOn?'Désactiver les sons':'Activer les sons');if(soundOn)chirp(false);});
function chirp(capture){if(!soundOn)return;try{audioCtx??=new (window.AudioContext||window.webkitAudioContext)();const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type='sine';osc.frequency.setValueAtTime(capture?330:440,audioCtx.currentTime);osc.frequency.exponentialRampToValueAtTime(capture?220:550,audioCtx.currentTime+.13);gain.gain.setValueAtTime(.08,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.18);osc.connect(gain).connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+.18);}catch(_){}}
window.addEventListener('resize',resize);
new ResizeObserver(resize).observe(world);
window.addEventListener('load',()=>requestAnimationFrame(resize));
document.fonts.ready.then(()=>requestAnimationFrame(resize));
reset();loadSavedGame();saveDirty=false;updateSaveUI();resize();
