import{r as e}from"./rolldown-runtime-hePW80VL.js";import{f as t,g as n}from"./react-D3U949a_.js";var r=e(n(),1),i={ink:`#08164a`,navy:`#0a1f63`,blue:`#1f5fff`,blue2:`#4f86ff`,sky:`#a9c6ff`,pale:`#e8f0ff`,white:`#ffffff`,bright:`#3d74f5`,water:`#2c74ff`,coral:`#ff7a8a`,mint:`#7fe0b4`,wood:`#c98b4e`,bread:`#e8c7a6`,meat:`#8a4a22`},a=i.ink,o=`M0-10C1-3 3-1 10 0 3 1 1 3 0 10-1 3-3 1-10 0-3-1-1-3 0-10Z`,s=(e,t,n,r=`#fff`,i=`tw`)=>`<g transform="translate(${e} ${t}) scale(${n/10})"><path class="${i}" d="${o}" fill="${r}"/></g>`,c=e=>Math.round(e*10)/10,l=(e,t,n,r)=>[(1-r)**2*e[0]+2*(1-r)*r*t[0]+r*r*n[0],(1-r)**2*e[1]+2*(1-r)*r*t[1]+r*r*n[1]],u=(e,t,n,r)=>{let i=2*(1-r)*(t[0]-e[0])+2*r*(n[0]-t[0]),a=2*(1-r)*(t[1]-e[1])+2*r*(n[1]-t[1]),o=Math.hypot(i,a);return[a/o,-i/o]};function d(e,t,n=1,r=`smile`){let o=r=>`<circle cx="${c(e+r*n)}" cy="${t}" r="${c(9*n)}" fill="#fff" stroke="${a}" stroke-width="${c(3.5*n)}"/><circle cx="${c(e+r*n+2.5*n)}" cy="${c(t+1.5*n)}" r="${c(4*n)}" fill="${a}"/><circle cx="${c(e+r*n+4*n)}" cy="${c(t-1*n)}" r="${c(1.4*n)}" fill="#fff"/>`,s=r===`open`?`<path d="M${c(e-9*n)} ${c(t+16*n)}Q${e} ${c(t+32*n)} ${c(e+9*n)} ${c(t+16*n)}Z" fill="${a}"/><path d="M${c(e-5*n)} ${c(t+23*n)}Q${e} ${c(t+29*n)} ${c(e+5*n)} ${c(t+23*n)}" fill="${i.coral}"/>`:`<path d="M${c(e-9*n)} ${c(t+17*n)}Q${e} ${c(t+27*n)} ${c(e+9*n)} ${c(t+17*n)}" fill="none" stroke="${a}" stroke-width="${c(4*n)}" stroke-linecap="round"/>`;return`${o(-14)}${o(14)}${s}<circle cx="${c(e-26*n)}" cy="${c(t+16*n)}" r="${c(6*n)}" fill="${i.coral}" opacity=".55"/><circle cx="${c(e+26*n)}" cy="${c(t+16*n)}" r="${c(6*n)}" fill="${i.coral}" opacity=".55"/>`}var f=(e,t,n=14)=>`<path d="${e}" fill="none" stroke="${a}" stroke-width="${n+8}" stroke-linecap="round" stroke-linejoin="round"/><path d="${e}" fill="none" stroke="${t}" stroke-width="${n}" stroke-linecap="round" stroke-linejoin="round"/>`,p=(e,t,n=1)=>`<circle cx="${e}" cy="${t}" r="${c(13*n)}" fill="#fff" stroke="${a}" stroke-width="4.5"/><path d="M${c(e-5*n)} ${c(t-4*n)}l${c(4*n)} ${c(6*n)}" stroke="${a}" stroke-width="2.5" stroke-linecap="round"/>`,m=(e,t,n=!1)=>`<g transform="translate(${e} ${t})${n?` scale(-1 1)`:``}"><path d="M-22 0C-22-14-4-16 8-12C20-9 26-4 26 4C26 10 20 12 0 12C-16 12-22 9-22 0Z" fill="#fff" stroke="${a}" stroke-width="4.5"/><path d="M-20 7H24" stroke="${i.blue}" stroke-width="5"/><circle cx="-6" cy="-6" r="2.5" fill="${a}"/><circle cx="3" cy="-7" r="2.5" fill="${a}"/></g>`;function h(){let e=[150,612],t=[330,62],n=[510,612],r=``,o=[];for(let i=0;i<=40;i++){let s=i/40,[d,f]=l(e,t,n,s),[p,m]=u(e,t,n,s);o.push([d-p*30,f-m*30]),i>0&&i<40&&(r+=`<line x1="${c(d)}" y1="${c(f)}" x2="${c(d-p*30)}" y2="${c(f-m*30)}" stroke="${a}" stroke-width="2.4" opacity=".8"/>`)}let h=`M`+o.map(([e,t])=>`${c(e)} ${c(t)}`).join(`L`),g=``;for(let e=0,t=300;t<612;t+=20,e++){g+=`<line x1="100" y1="${t}" x2="560" y2="${t}" stroke="#b9cdf7" stroke-width="2"/>`;for(let n=96+e%2*22;n<560;n+=44)g+=`<line x1="${n}" y1="${t}" x2="${n}" y2="${t+20}" stroke="#b9cdf7" stroke-width="2"/>`}let _=``;for(let e=0,t=252;t<600;t+=22,e++){_+=`<line x1="14" y1="${t}" x2="112" y2="${t}" stroke="#b9cdf7" stroke-width="2"/>`;for(let n=20+e%2*18;n<112;n+=36)_+=`<line x1="${n}" y1="${t}" x2="${n}" y2="${t+22}" stroke="#b9cdf7" stroke-width="2"/>`}let v=[618,640,664,688].map((e,t)=>`<path class="wave" style="animation-delay:${t*.4}s" d="M${-20+t*14} ${e}q14-8 28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="${.55-t*.1}"/>`).join(``),y=`<g class="bob">
    ${f(`M338 228C368 210 374 186 368 168`,i.blue)}
    ${p(368,162)}
    ${f(`M292 236C272 246 266 260 266 272`,i.blue)}
    <rect x="238" y="264" width="52" height="34" rx="6" fill="${i.bright}" stroke="${a}" stroke-width="4.5"/>
    <path d="M252 264v-8h24v8" fill="none" stroke="${a}" stroke-width="4.5"/>
    <line x1="238" y1="278" x2="290" y2="278" stroke="${a}" stroke-width="3"/>
    ${p(266,268,.9)}
    ${f(`M306 282V294`,i.blue,12)}${f(`M328 282V294`,i.blue,12)}
    <path d="M282 280C276 220 286 178 316 178C346 178 356 220 350 280Z" fill="${i.blue}" stroke="${a}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M292 250h48" stroke="#fff" stroke-width="4" stroke-dasharray="2 8" stroke-linecap="round" opacity=".7"/>
    ${d(316,208,.9)}
    <path d="M286 178C286 148 346 148 346 178Z" fill="#fff" stroke="${a}" stroke-width="4.5"/>
    <rect x="278" y="174" width="76" height="10" rx="5" fill="#fff" stroke="${a}" stroke-width="4.5"/>
    <path d="M316 152v20" stroke="${i.blue}" stroke-width="5"/>
    ${m(304,296,!0)}${m(330,296)}
  </g>`,b=`<g transform="translate(470 520)">
    <path d="M90 -10C60 0 40 20 10 40" fill="none" stroke="${a}" stroke-width="6" stroke-linecap="round"/>
    ${[[60,0,-30],[36,22,20],[74,18,60]].map(([e,t,n])=>`<path d="M${e} ${t}c-14-6-24-20-22-34c14 2 26 16 22 34Z" fill="${i.mint}" stroke="${a}" stroke-width="3.5" transform="rotate(${n} ${e} ${t})"/>`).join(``)}
    <g class="swing-soft"><line x1="22" y1="30" x2="22" y2="46" stroke="${a}" stroke-width="4"/><circle cx="22" cy="62" r="17" fill="${i.coral}" stroke="${a}" stroke-width="4.5"/><path d="M16 46l6 6 6-6" fill="${i.coral}" stroke="${a}" stroke-width="3.5" stroke-linejoin="round"/><path d="M12 58q4-6 10-6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/></g>
  </g>`;return`<svg viewBox="0 0 560 700" xmlns="http://www.w3.org/2000/svg" class="art">
  <defs><clipPath id="towerclip"><rect x="12" y="246" width="102" height="230"/></clipPath><clipPath id="spandrel"><path d="M110 452Q330 128 552 452L552 612L510 612Q330 62 150 612L110 612Z"/></clipPath></defs>
  <!-- river Neretva -->
  <path d="M-20 600H520Q556 640 548 720H-20Z" fill="${i.water}"/>
  ${v}
  <!-- banks -->
  <path d="M-10 430L70 440L128 496L150 612L170 720H-10Z" fill="#cfdcff" stroke="${a}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M30 520l30 14M60 580l40 6M14 640l50-10" stroke="${a}" stroke-width="3" stroke-linecap="round" opacity=".5"/>
  <path d="M500 612L516 540L548 556L556 720H490Z" fill="#cfdcff" stroke="${a}" stroke-width="5" stroke-linejoin="round"/>
  <!-- Tara tower -->
  <rect x="12" y="246" width="102" height="230" fill="#f4f7ff" stroke="${a}" stroke-width="5"/>
  <g clip-path="url(#towerclip)">${_}</g>
  <path d="M0 250L63 168L126 250Z" fill="${i.blue}" stroke="${a}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M30 230L63 188L96 230M44 248L63 222L82 248" fill="none" stroke="#fff" stroke-width="3" opacity=".55"/>
  <path d="M63 168v-22" stroke="${a}" stroke-width="5" stroke-linecap="round"/><circle cx="63" cy="142" r="6" fill="${i.bright}" stroke="${a}" stroke-width="4"/>
  <path d="M48 330v-18a15 15 0 0 1 30 0v18Z" fill="${i.navy}" stroke="${a}" stroke-width="4.5"/>
  <path d="M48 410v-18a15 15 0 0 1 30 0v18Z" fill="${i.navy}" stroke="${a}" stroke-width="4.5"/>
  <path d="M54 322v-8a9 9 0 0 1 9-8" stroke="#fff" stroke-width="3" fill="none" opacity=".6"/>
  <!-- the bridge -->
  <path d="M110 452Q330 128 552 452L552 612L510 612Q330 62 150 612L110 612Z" fill="#f4f7ff"/>
  <g clip-path="url(#spandrel)">${g}</g>
  <path d="${h}" fill="none" stroke="${a}" stroke-width="3.5"/>
  ${r}
  <path d="M110 452Q330 128 552 452L552 612L510 612Q330 62 150 612L110 612Z" fill="none" stroke="${a}" stroke-width="5" stroke-linejoin="round"/>
  <!-- parapet -->
  <path d="M104 446Q330 116 556 446" fill="none" stroke="${a}" stroke-width="24" stroke-linecap="round"/>
  <path d="M104 446Q330 116 556 446" fill="none" stroke="#dbe7ff" stroke-width="14" stroke-linecap="round"/>
  <path d="M104 440Q330 110 556 440" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"/>
  ${y}
  ${b}
  ${s(250,150,12)}${s(420,220,9)}${s(200,230,7)}${s(470,120,14)}
</svg>`}function g(){let e=`<g class="dive"><g transform="translate(200 330) rotate(160)">
    ${f(`M-14 70C-18 110-16 140-20 168`,i.blue,15)}${f(`M14 70C18 110 16 140 20 168`,i.blue,15)}
    ${m(-22,176,!0).replace(`translate(-22 176)`,`translate(-22 176) rotate(90)`)}${m(22,176).replace(`translate(22 176)`,`translate(22 176) rotate(90)`)}
    <path d="M-40 0C-44 -50 -26 -84 0 -84C26 -84 44 -50 40 0C38 40 26 76 0 76C-26 76-38 40-40 0Z" fill="${i.blue}" stroke="${a}" stroke-width="5"/>
    <path d="M-38 30C-30 46 30 46 38 30L36 52C26 74-26 74-36 52Z" fill="#fff" stroke="${a}" stroke-width="4.5"/>
    <path d="M-34 44h68" stroke="${i.blue}" stroke-width="5"/>
    <g transform="rotate(180)">${d(0,26,.95,`open`)}</g>
    ${f(`M-30 -56C-38 -96 -20 -130 -6 -150`,i.blue,14)}${f(`M30 -56C38 -96 20 -130 6 -150`,i.blue,14)}
    ${p(-4,-158)}${p(6,-160)}
  </g></g>`;return`<svg viewBox="0 0 400 720" xmlns="http://www.w3.org/2000/svg" class="art">
  ${[[120,120,90],[160,90,120],[200,70,100],[240,110,80]].map(([e,t,n],r)=>`<path class="speed" style="animation-delay:${r*.15}s" d="M${e} ${t}v${-n}" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>`).join(``)}${e}${`<g transform="translate(240 640)">
    <ellipse cx="0" cy="40" rx="150" ry="26" fill="${i.water}" stroke="${a}" stroke-width="5"/>
    <path d="M-110 36q20-10 40 0t40 0t40 0t40 0t40 0" fill="none" stroke="#fff" stroke-width="3.5" opacity=".7"/>
    <path class="splash" d="M-60 30C-70 0-60-30-44-50C-40-24-30-6-24 12C-20-20-8-50 0-70C10-44 16-14 18 10C28-14 40-30 54-40C58-10 52 14 56 30Z" fill="#fff" stroke="${a}" stroke-width="5" stroke-linejoin="round"/>
    ${[[-84,-40,9],[84,-60,7],[-30,-96,6],[40,-100,8],[110,-10,6],[-118,0,7]].map(([e,t,n])=>`<circle class="drop" cx="${e}" cy="${t}" r="${n}" fill="#fff" stroke="${a}" stroke-width="3.5"/>`).join(``)}
  </g>`}
  ${s(80,240,14)}${s(330,200,10)}${s(60,420,9)}${s(340,470,16)}${s(300,330,7)}
</svg>`}var _=(e,t,n=1,r=!1,o=!1)=>`<g transform="translate(${e} ${t}) scale(${r?-n:n} ${n})"><g class="${o?`flap`:`peck`}">
  ${o?`<path d="M-6 -6C-30 -46 -50 -40 -60 -30C-44 -24 -30 -14 -16 0Z" fill="#dbe6ff" stroke="${a}" stroke-width="4" stroke-linejoin="round"/>`:``}
  <path d="M-34 4L-54 -4L-50 12Z" fill="#9db6ee" stroke="${a}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M-36 4C-36 -16-14-24 6-20C16-34 34-34 38-20C40-10 34 0 30 6C26 22 6 28-14 24C-28 22-36 14-36 4Z" fill="#f4f7ff" stroke="${a}" stroke-width="4.5" stroke-linejoin="round"/>
  <path d="M14 -6C12 4 6 10-2 12" fill="none" stroke="#7fd0c8" stroke-width="5" stroke-linecap="round"/>
  ${o?``:`<path d="M-24 2C-14-12 4-10 10 2C0 12-14 12-24 2Z" fill="#c4d4f6" stroke="${a}" stroke-width="3.5"/><path d="M-16 4h12M-12 9h10" stroke="${a}" stroke-width="2" opacity=".6"/>`}
  <circle cx="26" cy="-20" r="3.6" fill="${a}"/><path d="M38 -18L48 -14L38 -12Z" fill="${i.bright}" stroke="${a}" stroke-width="3" stroke-linejoin="round"/>
  ${o?``:`<path d="M-4 24v10M8 22v12" stroke="${i.coral}" stroke-width="4" stroke-linecap="round"/>`}
</g></g>`;function v(){let e=``;for(let t=0;t<6;t++)for(let n=0;n<12;n++){let r=n*52+t%2*26-10,i=608+t*18;e+=`<ellipse cx="${r}" cy="${i}" rx="${22-t}" ry="${8+t*.4}" fill="${(n+t)%3?`#e2ebff`:`#cfdcff`}" stroke="${a}" stroke-width="2.4"/>`}let t=(e,t,n,r,o)=>{let s=``;for(let i=-r;i<n+r;i+=12)s+=`<line x1="${e+i}" y1="${t}" x2="${e+i+r}" y2="${t+r}" stroke="#fff" stroke-width="2.2"/><line x1="${e+i+r}" y1="${t}" x2="${e+i}" y2="${t+r}" stroke="#fff" stroke-width="2.2"/>`;return`<clipPath id="${o}"><path d="M${e} ${t+r}V${t+24}a${n/2} 24 0 0 1 ${n} 0V${t+r}Z"/></clipPath><path d="M${e} ${t+r}V${t+24}a${n/2} 24 0 0 1 ${n} 0V${t+r}Z" fill="${i.navy}"/><g clip-path="url(#${o})" opacity=".85">${s}</g><path d="M${e} ${t+r}V${t+24}a${n/2} 24 0 0 1 ${n} 0V${t+r}Z" fill="none" stroke="${a}" stroke-width="4"/>`},n=(e,t)=>`<g transform="translate(${e} ${t})"><rect x="-6" y="0" width="12" height="10" rx="3" fill="${i.bright}" stroke="${a}" stroke-width="3.5"/><path d="M0 10v6" stroke="${a}" stroke-width="4"/><path class="pour" d="M0 18v38" stroke="#8fd0ff" stroke-width="5" stroke-linecap="round"/></g>`,r=`M0 0`;for(let e=0;e<Math.PI*7;e+=.3){let t=4+e*4.2;r+=`L${c(Math.cos(e)*t)} ${c(Math.sin(e)*t*.62)}`}let o=`<g transform="translate(118 540)"><g class="bob">
    ${f(`M44 -10C70 -24 78 -52 72 -76`,i.bread)}
    <g transform="translate(72 -86) rotate(-20)"><rect x="-6" y="-40" width="12" height="52" rx="5" fill="#dfe6f5" stroke="${a}" stroke-width="4"/><path d="M-16-44a16 16 0 1 1 32 0l-8 4v-12h-16v12Z" fill="#dfe6f5" stroke="${a}" stroke-width="4" stroke-linejoin="round"/></g>
    ${p(72,-76)}
    ${f(`M-44 0C-64 10-68 30-60 44`,i.bread)}${p(-60,48)}
    ${f(`M-18 40V66`,i.bread,12)}${f(`M18 40V66`,i.bread,12)}
    <ellipse cx="0" cy="0" rx="62" ry="44" fill="${i.bread}" stroke="${a}" stroke-width="5"/>
    <clipPath id="burekc"><ellipse cx="0" cy="0" rx="58" ry="40"/></clipPath><path clip-path="url(#burekc)" d="${r}" fill="none" stroke="#c78f3c" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M-44-24q10-8 22-6M20-34q14 0 24 10" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".7"/>
    <ellipse cx="0" cy="0" rx="62" ry="44" fill="none" stroke="${a}" stroke-width="5"/>
    ${d(0,-6,.85)}
    ${m(-20,70,!0)}${m(22,70)}
  </g></g>`;return`<svg viewBox="0 0 560 700" xmlns="http://www.w3.org/2000/svg" class="art">
  <!-- kaldrma -->
  <clipPath id="kal"><path d="M-10 596H500Q556 606 552 720H-10Z"/></clipPath><g clip-path="url(#kal)"><rect x="-10" y="596" width="580" height="120" fill="#cfdcff"/>${e}</g><path d="M-10 596H500Q556 606 552 720" fill="none" stroke="${a}" stroke-width="5"/>
  <!-- steps -->
  <path d="M150 600L170 584H410L430 600Z" fill="#f4f7ff" stroke="${a}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M170 584L186 570H394L410 584Z" fill="#e2ebff" stroke="${a}" stroke-width="5" stroke-linejoin="round"/>
  <!-- basin -->
  <path d="M176 570V540H404V570Z" fill="#f4f7ff" stroke="${a}" stroke-width="5"/>
  <path d="M188 552h204" stroke="#b9cdf7" stroke-width="3"/>
  <!-- octagon: two side faces + front -->
  <path d="M196 540V380L236 360V540Z" fill="#dbe7ff" stroke="${a}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M384 540V380L344 360V540Z" fill="#dbe7ff" stroke="${a}" stroke-width="5" stroke-linejoin="round"/>
  <rect x="236" y="360" width="108" height="180" fill="#f4f7ff" stroke="${a}" stroke-width="5"/>
  ${t(250,380,80,110,`lat1`)}
  <path d="M206 520V408l20-10V520Z" fill="${i.navy}" stroke="${a}" stroke-width="4"/>
  <path d="M374 520V408l-20-10V520Z" fill="${i.navy}" stroke="${a}" stroke-width="4"/>
  <path d="M210 420l12-6M210 444l12-6M210 468l12-6M210 492l12-6M370 420l-12-6M370 444l-12-6M370 468l-12-6M370 492l-12-6" stroke="#fff" stroke-width="2.5" opacity=".7"/>
  <rect x="236" y="500" width="108" height="40" fill="#e2ebff" stroke="${a}" stroke-width="4"/>
  ${[260,290,320].map(e=>n(e,510)).join(``)}
  <!-- eaves -->
  <path d="M150 372L196 344H384L430 372L384 382H196Z" fill="${i.blue}" stroke="${a}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M170 368L206 352H374L410 368" fill="none" stroke="#fff" stroke-width="3" opacity=".5"/>
  ${[180,214,248,290,332,366,400].map(e=>`<path d="M${e} 378l-4 12h8Z" fill="${i.blue}" stroke="${a}" stroke-width="3" stroke-linejoin="round"/>`).join(``)}
  <!-- dome -->
  <path d="M206 344C206 270 250 228 290 228C330 228 374 270 374 344Z" fill="${i.blue2}" stroke="${a}" stroke-width="5"/>
  <path d="M236 344C236 286 260 240 290 230M344 344C344 286 320 240 290 230M290 230V344" fill="none" stroke="${a}" stroke-width="3.5"/>
  <path d="M222 320C224 290 236 266 254 250" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".55"/>
  <rect x="282" y="206" width="16" height="24" rx="4" fill="${i.bright}" stroke="${a}" stroke-width="4"/>
  <circle cx="290" cy="198" r="9" fill="${i.bright}" stroke="${a}" stroke-width="4"/><path d="M290 189v-22" stroke="${a}" stroke-width="4" stroke-linecap="round"/>
  ${o}
  ${_(470,610,1)}${_(370,640,.85,!0)}${_(220,646,.8)}
  ${_(330,170,.9,!1,!0)}${_(130,300,.75,!0,!0)}
  ${s(470,360,12)}${s(120,200,9)}${s(520,140,14)}${s(250,160,8)}
</svg>`}function y(){let e=``;for(let t=0;t<7;t++)e+=`<path d="M${-30+t*10} 26l5 8 5-8" fill="none" stroke="#fff" stroke-width="2.4" opacity=".8"/>`;return`<svg viewBox="0 0 400 720" xmlns="http://www.w3.org/2000/svg" class="art">
  <g class="swing">
    <line x1="330" y1="-30" x2="236" y2="236" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    <g transform="translate(220 320) rotate(-28)">
      <path d="M40 -40C70 -60 104 -60 140 -50" fill="none" stroke="${a}" stroke-width="16" stroke-linecap="round"/>
      <path d="M40 -40C70 -60 104 -60 140 -50" fill="none" stroke="${i.wood}" stroke-width="8" stroke-linecap="round"/>
      <path d="M-40 -56H44L56 -46C58 10 60 60 40 80H-40C-60 60-58 10-56-46Z" fill="${i.blue}" stroke="${a}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M-56 -46L-80 -62L-48 -56Z" fill="${i.blue}" stroke="${a}" stroke-width="5" stroke-linejoin="round"/>
      <rect x="-46" y="-64" width="96" height="14" rx="6" fill="${i.sky}" stroke="${a}" stroke-width="4.5"/>
      <path d="M-50 18H54M-46 44H50" stroke="#fff" stroke-width="3" opacity=".75"/>
      <g transform="translate(2 6)">${e}</g>
      ${d(0,-16,.85)}
    </g>
    <g transform="translate(236 236)">${p(0,0)}</g>
  </g>
  <!-- the pour -->
  <path class="pour" d="M128 296C110 330 104 380 108 430" fill="none" stroke="#5b3216" stroke-width="9" stroke-linecap="round"/>
  <!-- tray (tepsija) with fildžan, sugar and rahat-lokum -->
  <g transform="translate(120 520)"><g class="bob">
    <ellipse cx="0" cy="40" rx="110" ry="24" fill="${i.sky}" stroke="${a}" stroke-width="5"/>
    <ellipse cx="0" cy="34" rx="92" ry="17" fill="#e2ebff" stroke="${a}" stroke-width="3"/>
    <path d="M-80 34q10 8 20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0" fill="none" stroke="${i.blue}" stroke-width="2.5" opacity=".7"/>
    <ellipse cx="-6" cy="30" rx="34" ry="8" fill="#fff" stroke="${a}" stroke-width="4"/>
    <path d="M-30 -40H18L12 8C10 20 4 26-6 26C-16 26-22 20-24 8Z" fill="#fff" stroke="${a}" stroke-width="5" stroke-linejoin="round"/>
    <ellipse cx="-6" cy="-40" rx="24" ry="6" fill="#5b3216" stroke="${a}" stroke-width="4"/>
    <path d="M-26 -18H14" stroke="${i.blue}" stroke-width="5"/><path d="M-24 -6H12" stroke="${i.blue}" stroke-width="2.5"/>
    <circle cx="-16" cy="-12" r="2.4" fill="${i.blue}"/><circle cx="-6" cy="-12" r="2.4" fill="${i.blue}"/><circle cx="4" cy="-12" r="2.4" fill="${i.blue}"/>
    <path class="steam" d="M-14 -56c-8-12 8-18 0-30M2 -56c-8-12 8-18 0-30" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>
    <rect x="34" y="6" width="22" height="18" rx="3" fill="#fff" stroke="${a}" stroke-width="3.5"/><rect x="58" y="12" width="20" height="16" rx="3" fill="#fff" stroke="${a}" stroke-width="3.5"/>
    <g transform="translate(-74 10)"><rect x="-14" y="0" width="24" height="20" rx="4" fill="#ffb3c1" stroke="${a}" stroke-width="3.5"/><rect x="6" y="6" width="24" height="20" rx="4" fill="#fff" stroke="${a}" stroke-width="3.5"/><path d="M-10 4h4M10 10h4M-4 10h3" stroke="#fff" stroke-width="2.4"/></g>
  </g></g>
  ${s(60,180,14)}${s(330,420,12)}${s(40,380,8)}${s(350,600,10)}${s(280,120,7)}
</svg>`}function b(){let e=[60,130,200,270,340,410,480,550].map(e=>`<rect x="100" y="${e}" width="120" height="16" rx="6" fill="${i.blue2}" stroke="${a}" stroke-width="5"/>`).join(``),t=``;for(let e=0;e<22;e++){let n=e*2.4,r=18+e*37%60;t+=`<circle cx="${c(Math.cos(n)*r)}" cy="${c(Math.sin(n)*r*.5+30)}" r="2.6" fill="#c78f3c"/>`}let n=(e,t,n)=>`<g transform="translate(${e} ${t}) rotate(${n})"><rect x="-9" y="-36" width="18" height="52" rx="9" fill="${i.meat}" stroke="${a}" stroke-width="4"/><path d="M-3 -28v14M3 -6v10" stroke="#b36a3a" stroke-width="3" stroke-linecap="round"/></g>`;return`<svg viewBox="0 0 560 700" xmlns="http://www.w3.org/2000/svg" class="art">
  <g transform="rotate(-14 170 330)">
    <rect x="88" y="10" width="24" height="640" rx="9" fill="${i.blue}" stroke="${a}" stroke-width="5"/>
    <rect x="208" y="10" width="24" height="640" rx="9" fill="${i.blue}" stroke="${a}" stroke-width="5"/>
    ${e}
    <!-- somun climbing -->
    <g transform="translate(330 360)">
      ${f(`M-70 -30C-100 -50 -112 -80 -110 -106`,i.bread)}${p(-110,-112)}
      ${f(`M-74 30C-100 40 -110 70 -108 92`,i.bread)}${p(-108,98)}
      ${f(`M-30 90C-34 120 -60 140 -90 150`,i.bread,13)}${m(-100,150,!0)}
      ${f(`M30 90C36 130 30 160 20 190`,i.bread,13)}${m(14,196)}
      <path d="M-90 -20C-90 -90 90 -90 90 -20V60C90 110-90 110-90 60Z" fill="${i.bread}" stroke="${a}" stroke-width="5"/>
      <path d="M-74 -40C-60 -66 60 -66 74 -40" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".6"/>
      <g transform="translate(0 0)">${t}</g>
      <!-- the pocket full of ćevapi + luk -->
      ${[-56,-36,-16,4,24,44].map((e,t)=>n(e,-70+t%2*6,-10+t*4)).join(``)}
      <path d="M-82 -56C-60 -40 60 -40 82 -56" fill="${i.bread}" stroke="${a}" stroke-width="5"/>
      ${[[-50,-62],[-6,-66],[34,-60]].map(([e,t])=>`<path d="M${e} ${t}q8-14 18 0" fill="#fff" stroke="${a}" stroke-width="3"/><path d="M${e+4} ${t-2}q5-7 10 0" fill="none" stroke="#e6b7ff" stroke-width="2"/>`).join(``)}
      ${d(0,10,1.05,`open`)}
    </g>
  </g>
  <!-- steam from the hot ćevapi -->
  <path class="steam" d="M300 200c-10-14 10-22 0-36M330 190c-10-14 10-22 0-36M360 200c-10-14 10-22 0-36" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>
  ${s(450,160,14)}${s(500,420,10)}${s(40,120,9)}${s(470,560,12)}${s(420,300,7)}
</svg>`}function x(){let e=``;[i.blue,i.bright,`#fff`,i.blue,i.bright,`#fff`,i.blue].forEach((t,n)=>{e+=`<rect x="${-70+n*20}" y="-10" width="20" height="22" fill="${t}"/>`});let t=`<g transform="translate(110 600)"><g class="spin">
    <circle r="44" fill="#fff" stroke="${a}" stroke-width="5"/>
    <path d="M0-16L15-5L9 13H-9L-15-5Z" fill="${a}"/>
    <path d="M0-16V-43M15-5L41-13M9 13L25 36M-9 13L-25 36M-15-5L-41-13" stroke="${a}" stroke-width="3.5"/>
    <path d="M-12-42L0-44L12-42L4-34H-4Z M38-24L44-6L36 2L32-14Z M-38-24L-44-6L-36 2L-32-14Z" fill="${a}"/>
    <path d="M-26-26a34 34 0 0 1 20-10" stroke="${i.sky}" stroke-width="5" fill="none" stroke-linecap="round"/>
  </g></g>`;return`<svg viewBox="0 0 400 720" xmlns="http://www.w3.org/2000/svg" class="art">
  <g class="swing">
    <line x1="340" y1="-30" x2="236" y2="300" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    ${f(`M218 372C226 330 232 310 240 296`,i.blue)}${f(`M248 372C246 346 240 330 232 322`,i.blue)}
    ${p(242,290)}${p(230,322)}
    ${f(`M196 540C186 580 176 610 168 628`,i.blue)}${f(`M268 540C280 580 290 610 300 628`,i.blue)}
    ${m(160,636,!0)}${m(306,636)}
    <path d="M160 360C160 330 300 330 304 360L318 520C320 556 150 556 148 520Z" fill="${i.blue}" stroke="${a}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M150 470H316" stroke="#fff" stroke-width="5"/>
    <text x="232" y="520" text-anchor="middle" font-family="'Bricolage Grotesque', Figtree, sans-serif" font-weight="900" font-size="34" fill="#fff" stroke="${a}" stroke-width="1.5">11</text>
    ${d(232,400,1,`open`)}
    <g transform="translate(232 452)">
      <path d="M-74 -10H74V12H-74Z" fill="#fff"/>${e}
      <path d="M-74 -10H74V12H-74Z" fill="none" stroke="${a}" stroke-width="4"/>
      <g class="flutter"><path d="M50 10L60 80L84 76L74 10Z" fill="${i.bright}" stroke="${a}" stroke-width="4" stroke-linejoin="round"/><path d="M54 30L80 26M58 52L82 48" stroke="${i.blue}" stroke-width="6"/><path d="M60 80l4 10M68 79l4 10M76 78l4 10" stroke="${a}" stroke-width="3" stroke-linecap="round"/></g>
    </g>
  </g>
  ${t}
  ${s(70,220,14)}${s(340,430,12)}${s(40,420,8)}${s(340,600,9)}${s(110,120,7)}
</svg>`}var S=t(),C={stariMost:h,diver:g,sebilj:v,dzezva:y,cevapi:b,navijac:x},w={},T=e=>w[e]??=C[e](),E=[{key:`mostar`,left:`stariMost`,right:`diver`},{key:`carsija`,left:`sebilj`,right:`dzezva`},{key:`cevapi`,left:`cevapi`,right:`navijac`}],D={diver:[`diver`,`60 140 330 440`],dzezva:[`dzezva`,`60 180 340 420`],navijac:[`navijac`,`110 250 260 420`],majstor:[`stariMost`,`226 130 190 190`],burek:[`sebilj`,`20 440 200 190`],somun:[`cevapi`,`200 170 270 290`],most:[`stariMost`,`90 120 480 420`],sebilj:[`sebilj`,`80 150 470 560`]};function O({name:e,viewBox:t,className:n=``,...i}){let a=(0,r.useId)().replace(/[^a-zA-Z0-9]/g,``),o=(0,r.useMemo)(()=>{let n=T(e).replace(/id="([^"]+)"/g,`id="$1-${a}"`).replace(/url\(#([^)]+)\)/g,`url(#$1-${a})`);return t&&(n=n.replace(/viewBox="[^"]+"/,`viewBox="${t}"`)),n},[e,t,a]);return(0,S.jsx)(`span`,{className:`bosnia-art ${n}`.trim(),"aria-hidden":`true`,dangerouslySetInnerHTML:{__html:o},...i})}function k({crop:e,className:t=``}){let[n,r]=D[e];return(0,S.jsx)(O,{name:n,viewBox:r,className:`is-crop ${t}`})}var A=()=>typeof window<`u`&&window.matchMedia(`(prefers-reduced-motion: reduce)`).matches;function j(e,t=9e3){let[n,i]=(0,r.useState)(()=>Math.floor(Math.random()*e));return(0,r.useEffect)(()=>{if(e<2||A())return;let n=window.setInterval(()=>{document.hidden||i(t=>{let n=Math.floor(Math.random()*(e-1));return n>=t?n+1:n})},t);return()=>window.clearInterval(n)},[e,t]),n}export{j as i,k as n,E as r,O as t};