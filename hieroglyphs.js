// Outline data from Noto Sans Egyptian Hieroglyphs (SIL OFL, bundled with the site).
// Each sign remains a real Egyptian Unicode sign, including inside exported SVGs.
const response=await fetch('assets/history/hieroglyph-paths.json?v=20261110-6');
if(!response.ok)throw new Error('Les dessins des signes ne sont pas disponibles.');
const paths=await response.json();
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let serial=0;
export const palettes={
 lapis:{name:'Lapis · or · rouge',colors:['#174879','#b07b28','#a23c2c'],outline:'#183b58'},
 malachite:{name:'Malachite · lapis · or',colors:['#287161','#1c4b7b','#b5802b'],outline:'#18483f'},
 carnelian:{name:'Cornaline · or · lapis',colors:['#a94330','#ba842c','#254b78'],outline:'#693a28'}
};
export function signDrawing(glyph,x,y,w,h,{palette='lapis',id='sign',colored=true}={}){
 const p=paths[glyph];if(!p)return '';
 const scale=Math.min(w/p.w,h/p.h),dx=x+(w-p.w*scale)/2,dy=y+(h-p.h*scale)/2;
 const colors=(palettes[palette]||palettes.lapis).colors;
 return `<g transform="translate(${dx.toFixed(3)} ${dy.toFixed(3)}) scale(${scale.toFixed(6)})"><defs><linearGradient id="${id}" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="${colors[1]}"/><stop offset=".28" stop-color="${colors[1]}"/><stop offset=".285" stop-color="${colors[0]}"/><stop offset=".76" stop-color="${colors[0]}"/><stop offset=".765" stop-color="${colors[2]}"/><stop offset="1" stop-color="${colors[2]}"/></linearGradient></defs>${colored&&p.s?`<path d="${p.s}" fill="url(#${id})" opacity=".8"/>`:""}<path d="${p.d}" fill="${colored?`url(#${id})`:colors[0]}" stroke="${(palettes[palette]||palettes.lapis).outline}" stroke-width="${(.45/scale).toFixed(3)}" stroke-linejoin="round" paint-order="stroke fill"/></g>`;
}
export function cartoucheDrawing(tokens,{x=0,y=0,w=180,h=500,palette='lapis',enclosure='cartouche',id='cartouche',columns=1}={}){
 const glyphs=Array.from(tokens).flatMap(t=>typeof t==='string'?[...t]:[...t.glyph]).filter(g=>paths[g]);
 const p=palettes[palette]||palettes.lapis;
 let frame='';
 if(enclosure==='cartouche')frame=`<rect x="${x+6}" y="${y+6}" width="${w-12}" height="${h-25}" rx="${w/2}" fill="#fff7df44" stroke="${p.colors[1]}" stroke-width="5"/><rect x="${x+13}" y="${y+13}" width="${w-26}" height="${h-39}" rx="${(w-26)/2}" fill="none" stroke="${p.colors[0]}" stroke-width="1.6"/><path d="M${x+18} ${y+h-14}H${x+w-18}m0 6H${x+18}" fill="none" stroke="${p.colors[0]}" stroke-width="4" stroke-linecap="round"/>`;
 else if(enclosure==='serekh')frame=`<path d="M${x+9} ${y+14}H${x+w-9}V${y+h-16}H${x+9}Z" fill="#fff7df55" stroke="${p.colors[1]}" stroke-width="4"/><path d="M${x+9} ${y+h-83}H${x+w-9}" stroke="${p.colors[0]}" stroke-width="2"/>${Array.from({length:5},(_,i)=>`<path d="M${x+19+i*(w-38)/4} ${y+h-75}v50" stroke="${p.colors[0]}" stroke-width="3"/>`).join('')}`;
 const inset=enclosure==='none'?10:30,bottom=enclosure==='serekh'?100:38,innerW=w-inset*2,innerH=h-inset-bottom;
 const count=Math.max(1,glyphs.length),cols=columns===2?2:count>10?2:1,rows=Math.ceil(count/cols),cellH=Math.min(innerH/rows,innerW*.95),top=y+inset+(innerH-cellH*rows)/2;
 const draws=glyphs.map((g,i)=>signDrawing(g,x+inset+(i%cols)*innerW/cols+3,top+Math.floor(i/cols)*cellH+3,innerW/cols-6,cellH-6,{palette,id:`${id}-${i}`})).join('');
 return frame+draws;
}
export function signSvg(glyph,{palette='lapis',size=90}={}){const id=`hiero-${++serial}`;return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${signDrawing(glyph,8,8,84,84,{palette,id})}</svg>`;}
export function historicalNamePanel(entry){
 if(!entry)return '';
 const names=entry.names||(entry.status==='checked'?[{label:entry.kind+' · '+entry.reading,transliteration:entry.transliteration,glyphs:entry.glyphs,enclosure:entry.frame,meaning:entry.meaning}]:[]);
 return `<section class="ancient-name-panel"><span class="history-kicker">SON NOM DANS L’ÉCRITURE ÉGYPTIENNE</span><div class="ancient-name-list">${names.map((n,i)=>{const id=`ancient-${++serial}`;return `<figure><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 400" role="img" aria-label="${esc(n.label)} : ${esc(n.transliteration)}">${cartoucheDrawing(n.glyphs||'',{w:180,h:400,enclosure:n.enclosure||'none',id})}</svg><figcaption><b>${esc(n.label)}</b><em>${esc(n.transliteration)}</em><span>${esc(n.meaning||'')}</span></figcaption></figure>`;}).join('')}</div>${entry.note?`<p>${esc(entry.note)}</p>`:''}<p>Graphie normalisée, recomposée pour la lecture ; disposition et couleurs éditoriales.</p>${entry.sources?.length?`<details class="source-disclosure"><summary>Graphie et références</summary>${entry.attestation?`<p>${esc(entry.attestation)}</p>`:''}<div>${entry.sources.map(s=>`<a href="${esc(typeof s==='string'?s:s.url)}" target="_blank" rel="noopener noreferrer">${esc(typeof s==='string'?'Voir l’attestation':s.label||'Voir l’attestation')} ↗</a>`).join('')}</div></details>`:''}</section>`;
}
