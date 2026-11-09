// All terrain pixels are geographically registered NOAA ETOPO 2022 altitudes.
export function paintAtlas(svg,geo,monuments,escape,project,labels){
 const shortNames={'giza-khufu':'Gizeh · Khéops','giza-khafre':'Khéphren','giza-menkaure':'Mykérinos',saqqara:'Saqqarah','red-pyramid':'Pyramide rouge','bent-pyramid':'Pyramide rhomboïdale',karnak:'Karnak',luxor:'Louxor · Thèbes',hatshepsut:'Hatchepsout','medinet-habu':'Médinet Habou','abu-simbel':'Abou Simbel',philae:'Philae','kom-ombo':'Kom Ombo',edfu:'Edfou',esna:'Esna',dendera:'Dendéra',aswan:'Assouan'};
 const pins=monuments.map(s=>{const[x,y]=project(s.lon,s.lat);const[dx,dy,anchor]=labels[s.id]||[14,-5,'start'];const name=shortNames[s.id]||s.name;return `<g class="site-pin" role="button" tabindex="0" data-map-site="${s.id}" aria-label="${escape(s.name)}" aria-pressed="false"><title>${escape(s.name)} · ${escape(s.city)}</title><path class="map-label-leader"/><circle class="pin-core" cx="${x}" cy="${y}" r="3"/><circle class="pin-halo" cx="${x}" cy="${y}" r="8"/><text class="map-label" x="${x+dx}" y="${y+dy}" text-anchor="${anchor}">${escape(name)}</text></g>`;}).join('');
 const grid=[];for(let lon=26;lon<=36;lon+=2){const[x]=project(lon,25);grid.push(`<path class="atlas-grid" d="M${x} 0V900"/>`);}for(let lat=22;lat<=32;lat+=2){const[,y]=project(30,lat);grid.push(`<path class="atlas-grid" d="M0 ${y}H800"/>`);}
 svg.innerHTML=`<defs>
  <clipPath id="atlas-land-clip"><path d="${geo.landPath}"/></clipPath>
  <radialGradient id="atlas-sea"><stop stop-color="#468496"/><stop offset="1" stop-color="#205669"/></radialGradient>
  <linearGradient id="atlas-dusk" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0a263a" stop-opacity=".18"/><stop offset=".5" stop-color="#061f30" stop-opacity=".15"/><stop offset="1" stop-color="#041522" stop-opacity=".45"/></linearGradient>
  <radialGradient id="atlas-vignette"><stop offset=".45" stop-color="#02121e" stop-opacity="0"/><stop offset="1" stop-color="#02121e" stop-opacity=".38"/></radialGradient>
  <filter id="atlas-valley-texture" x="-15%" y="-15%" width="130%" height="130%"><feTurbulence type="fractalNoise" baseFrequency=".035 .09" numOctaves="2" seed="13" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation=".35"/></filter>
  <filter id="atlas-coast-shadow"><feDropShadow dx="0" dy="1.1" stdDeviation="1.7" flood-color="#00101b" flood-opacity=".75"/></filter>
 </defs>
 <rect width="800" height="900" fill="url(#atlas-sea)"/>
 <path class="atlas-coast-depth" d="${geo.landPath}"/>
 <g clip-path="url(#atlas-land-clip)"><rect width="800" height="900" fill="#927344"/><image class="atlas-relief-image" href="assets/history/egypt-terrain-dem.jpg" x="0" y="0" width="800" height="900" preserveAspectRatio="none"/>

 <path class="atlas-valley" d="${geo.nilePath}"/>
 </g>
 <path class="atlas-shoreline" d="${geo.landPath}"/>
 <path class="atlas-river-bank" d="${geo.nilePath}"/>
 <path class="atlas-river" d="${geo.nilePath}"/>
 <path class="atlas-delta-river" d="${geo.deltaPath}"/>
 ${grid.join('')}

 <text class="map-water-label" x="480" y="35" text-anchor="middle">MER MÉDITERRANÉE</text>
 <text class="map-water-label" x="725" y="555" text-anchor="middle" transform="rotate(64 725 555)">MER ROUGE</text>
 <text class="map-region-label" x="185" y="475" text-anchor="middle" transform="rotate(-84 185 475)">DÉSERT OCCIDENTAL</text>
 <text class="map-region-label" x="590" y="380" text-anchor="middle" transform="rotate(65 590 380)">DÉSERT ORIENTAL</text>
 <text class="map-region-label" x="632" y="207" text-anchor="middle">SINAÏ</text>
 <text class="map-region-label" x="395" y="850" text-anchor="middle">NUBIE</text>
 ${pins}
 <g class="map-modern-city"><title>Le Caire · repère actuel</title><circle cx="${project(31.2357,30.0444)[0]}" cy="${project(31.2357,30.0444)[1]}" r="2"/><text class="map-label" x="${project(31.2357,30.0444)[0]+14}" y="${project(31.2357,30.0444)[1]-14}">Le Caire*</text></g>
 `;
}
