const game=document.querySelector('main.app');
const history=document.getElementById('historyView');
const menu=document.getElementById('worldMenu');
const toggle=document.getElementById('worldMenuToggle');
let loaded;
toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));menu.hidden=!open;});
document.addEventListener('click',event=>{if(!event.target.closest('.world-navigation')){menu.hidden=true;toggle.setAttribute('aria-expanded','false');}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.hidden=true;toggle.setAttribute('aria-expanded','false');}});
async function route(){
 const active=location.hash.startsWith('#histoire');
 game.hidden=active;history.hidden=!active;window.scrollTo({top:0,behavior:'instant'});document.body.classList.toggle('history-open',active);
 document.getElementById('worldCurrent').textContent=active?'Histoire de l’Égypte':'Jouer aux échecs';
 document.querySelectorAll('[data-world]').forEach(a=>a.setAttribute('aria-current',a.dataset.world===(active?'history':'game')?'page':'false'));
 menu.hidden=true;toggle.setAttribute('aria-expanded','false');
 if(active){history.setAttribute('aria-busy','true');try{loaded??=import('./history.js?v=20261110-6');await loaded;}catch(error){history.innerHTML='<p class="history-load-error">La rubrique n’a pas pu se charger. Rechargez la page pour réessayer.</p>';console.error(error);}finally{history.removeAttribute('aria-busy');}}
 else window.dispatchEvent(new Event('resize'));
}
window.addEventListener('hashchange',route);route();
