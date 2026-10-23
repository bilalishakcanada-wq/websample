var e=1600,t=`#071647`,n=`#ffd27a`,r=`#24346f`,i=`#f2c14e`,a=e=>Math.round(e*10)/10;function o(e){let t=e;return()=>(t=t*16807%2147483647)/2147483647}function s(n,r,i){return`<defs>
  <linearGradient id="${n}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${i}" stop-opacity="0"/><stop offset=".3" stop-color="${i}" stop-opacity=".45"/><stop offset=".62" stop-color="${r}" stop-opacity=".85"/><stop offset="1" stop-color="${r}" stop-opacity=".9"/></linearGradient>
  <linearGradient id="${n}-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t}" stop-opacity="0"/><stop offset="1" stop-color="${t}"/></linearGradient>
  <radialGradient id="${n}-glow"><stop offset="0" stop-color="#fff3d0" stop-opacity=".9"/><stop offset=".35" stop-color="#ffd9a0" stop-opacity=".35"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></radialGradient>
  </defs><rect width="${e}" height="300" fill="url(#${n}-sky)"/>`}var c=t=>`<rect y="260" width="${e}" height="40" fill="url(#${t}-fade)"/>`;function l(t,n,r=110){let i=o(t),s=``;for(let t=0;t<n;t++)s+=`<circle class="cs-tw" style="animation-delay:${a(i()*4)}s" cx="${a(i()*e)}" cy="${a(6+i()*r)}" r="${a(.8+i()*1.5)}" fill="#fff"/>`;return s}var u=(e,t,n,r,i=`#ffd38a`)=>`<circle cx="${t}" cy="${n}" r="${r*3.2}" fill="url(#${e}-glow)"/><circle cx="${t}" cy="${n}" r="${r}" fill="${i}"/>`,d=(t,n,r,i,a=!1)=>a?`<mask id="${t}-moon"><rect width="${e}" height="300" fill="#fff"/><circle cx="${n+i*.45}" cy="${r-i*.25}" r="${i*.9}" fill="#000"/></mask><circle cx="${n}" cy="${r}" r="${i*3}" fill="url(#${t}-glow)" opacity=".6"/><circle cx="${n}" cy="${r}" r="${i}" fill="#fff3d0" mask="url(#${t}-moon)"/>`:`<circle cx="${n}" cy="${r}" r="${i*3.2}" fill="url(#${t}-glow)" opacity=".7"/><circle cx="${n}" cy="${r}" r="${i}" fill="#fff6dc"/><circle cx="${n-i*.3}" cy="${r-i*.2}" r="${i*.22}" fill="#efe0b8"/><circle cx="${n+i*.35}" cy="${r+i*.3}" r="${i*.15}" fill="#efe0b8"/>`;function f(e,t,n,r,i=90,s=()=>0){let c=o(e),l=[];for(let e=-60;e<=1660+i;e+=i)l.push([e,t-c()*n-s(e)]);let u=`M-60 300L${l[0][0]} ${a(l[0][1])}`;for(let e=1;e<l.length-1;e++)u+=`Q${l[e][0]} ${a(l[e][1])} ${a((l[e][0]+l[e+1][0])/2)} ${a((l[e][1]+l[e+1][1])/2)}`;return`<path d="${u}L1660 300Z" fill="${r}"/>`}function p(e,i,s,c,l={}){let u=o(e),d=l.scale??1,f=l.walls??[`#f4ecdf`,`#e9dfcf`,`#dfe6f5`,`#f1e2c8`,`#e8d6c0`],p=l.roofs??[`#6f7aa6`,`#5d6894`,`#7c86ad`],m=l.lit??.45,h=``,g=i;for(;g<s;){let e=(24+u()*22)*d,i=(20+u()*20)*d,o=(10+u()*8)*d,s=c(g+e/2)-i,l=f[Math.floor(u()*f.length)],_=p[Math.floor(u()*p.length)];h+=`<rect x="${a(g)}" y="${a(s)}" width="${a(e)}" height="${a(i+8)}" fill="${l}"/>`,h+=`<rect x="${a(g+e*.64)}" y="${a(s)}" width="${a(e*.36)}" height="${a(i+8)}" fill="${t}" opacity=".2"/>`,h+=`<path d="M${a(g-3*d)} ${a(s)}L${a(g+e*.25)} ${a(s-o)}L${a(g+e*.75)} ${a(s-o)}L${a(g+e+3*d)} ${a(s)}Z" fill="${_}"/>`;let v=e>34*d?3:2,y=i>30*d?2:1;for(let t=0;t<v;t++)for(let i=0;i<y;i++){let o=u()<m,c=o&&u()<.25?` class="cs-flick" style="animation-delay:${a(u()*5)}s"`:``;h+=`<rect${c} x="${a(g+(t+.5)*e/v-2.5*d)}" y="${a(s+6*d+i*12*d)}" width="${a(5*d)}" height="${a(7*d)}" fill="${o?n:r}"/>`}g+=e+(u()*7-1)*d}return h}function m(e,r,o,s=`#f3f1ea`,c=`#5d6894`){let l=r-o;return`<path d="M${e-9} ${r}V${a(r-o*.22)}H${e+9}V${r}Z" fill="${s}"/>
  <rect x="${e-6}" y="${l+30}" width="12" height="${o-30}" fill="${s}"/>
  <rect x="${e+1}" y="${l+30}" width="5" height="${o-30}" fill="${t}" opacity=".16"/>
  <path d="M${e-11} ${a(l+o*.3)}h22l-4 7h-14z" fill="${s}"/><rect x="${e-11}" y="${a(l+o*.3-3)}" width="22" height="3" fill="${c}"/>
  <rect x="${e-2}" y="${a(l+o*.3+10)}" width="4" height="7" rx="2" fill="${n}" class="cs-flick"/>
  <path d="M${e-7} ${l+31}L${e} ${l}L${e+7} ${l+31}Z" fill="${c}"/>
  <path d="M${e} ${l}v-10" stroke="${i}" stroke-width="1.6"/><circle cx="${e}" cy="${l-12}" r="2.2" fill="${i}"/>`}var h=(e,t,n,r,o=n*.9)=>`<path d="M${e-n} ${t}A${n} ${a(o)} 0 0 1 ${e+n} ${t}Z" fill="${r}"/><path d="M${e} ${a(t-o)}v-9" stroke="${i}" stroke-width="1.6"/><circle cx="${e}" cy="${a(t-o-10)}" r="2" fill="${i}"/>`;function g(e,n,r,i,o){let s=e+r/2,c=``;for(let i=0;i<3;i++){let o=e+8+i*((r-16)/3);c+=`<path d="M${a(o+3)} ${n}V${n-14}a${a((r-16)/6-3)} 8 0 0 1 ${a((r-16)/3-6)} 0V${n}Z" fill="${t}" opacity=".45"/>`}return`<rect x="${e}" y="${n-38}" width="${r}" height="38" fill="${i}"/><rect x="${e+r*.66}" y="${n-38}" width="${a(r*.34)}" height="38" fill="${t}" opacity=".14"/>${c}${h(s,n-38,r*.36,o)}`}var _=(e,t,n,r=`#1f6b63`)=>`<rect x="${a(e-1.5*n)}" y="${a(t-8*n)}" width="${a(3*n)}" height="${a(8*n)}" fill="#3a2e4f"/><circle cx="${e}" cy="${a(t-16*n)}" r="${a(10*n)}" fill="${r}"/><circle cx="${a(e-7*n)}" cy="${a(t-11*n)}" r="${a(7*n)}" fill="${r}"/><circle cx="${a(e+7*n)}" cy="${a(t-11*n)}" r="${a(7*n)}" fill="${r}"/><circle cx="${a(e-3*n)}" cy="${a(t-20*n)}" r="${a(4*n)}" fill="#fff" opacity=".1"/>`,v=(e,t,n,r=`#174f4f`)=>`<ellipse cx="${e}" cy="${a(t-n/2)}" rx="${a(n*.16)}" ry="${a(n/2)}" fill="${r}"/>`;function y(e,t,n,r,i=1,s=[`#1f6b63`,`#24806b`,`#1a5a5c`]){let c=o(e),l=``;for(let e=t;e<n;e+=(14+c()*18)*i)l+=_(a(e),r(e),i*(.8+c()*.5),s[Math.floor(c()*s.length)]);return l}function b(t,n,r,i,s,c=0,l=e,u=28){let d=o(s),f=``;for(let e=0;e<u;e++){let e=c+d()*(l-c),t=n+6+d()*(300-n-16);f+=`<path class="cs-shim" style="animation-delay:${a(d()*3.6)}s" d="M${a(e)} ${a(t)}h${a(12+d()*40)}" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>`}return`<linearGradient id="${t}-w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${r}"/><stop offset="1" stop-color="${i}"/></linearGradient><rect x="${c}" y="${n}" width="${l-c}" height="${300-n}" fill="url(#${t}-w)"/>${f}`}function x(e,t,r,i=n){let s=o(e),c=``;for(let e=r+6;e<294;e+=7){let n=10+s()*30+(e-r)*.5;c+=`<path class="cs-shim" style="animation-delay:${a(s()*3)}s" d="M${a(t-n/2)} ${e}h${a(n)}" stroke="${i}" stroke-opacity=".7" stroke-width="2.4" stroke-linecap="round"/>`}return c}var S=(e,t,n,r=`#1a2563`)=>`<g transform="translate(0 ${e})"><g class="cs-fly" style="animation-duration:${t}s;animation-delay:-${n}s">${[[0,0],[24,9],[44,-5],[62,6]].map(([e,t])=>`<path class="cs-flap" d="M${e-7} ${t}q4-5 7 0q3-5 7 0" fill="none" stroke="${r}" stroke-width="2" stroke-linecap="round"/>`).join(``)}</g></g>`,C=t=>`<svg viewBox="0 0 ${e} 300" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">${t}</svg>`;function w(){let e=e=>205+e/640*46,i=e=>252-(e-960)/640*58,a=`M646 258L670 170Q800 100 930 170L954 258H912Q800 56 688 258Z`;return C(`${s(`mo`,`#ff8a6b`,`#6b5bd6`)}${l(3,26,90)}${u(`mo`,1080,128,30)}
  ${f(7,150,60,`#3d3f93`)}${f(9,186,40,`#2c3082`,110)}
  ${S(110,52,8)}${S(140,64,30)}
  <path d="M0 300V196Q160 184 300 202T640 250V300Z" fill="#1f2b70"/>
  <path d="M960 300V250Q1150 224 1300 208T1600 190V300Z" fill="#1f2b70"/>
  ${p(11,0,600,t=>e(t)-26,{scale:.8,lit:.35})}
  ${p(12,1e3,1600,e=>i(e)-26,{scale:.8,lit:.35})}
  ${v(380,228,48)}${v(400,230,38)}${v(1110,236,46)}
  ${g(430,240,84,`#f1ebdf`,`#7c86ad`)}${m(532,242,132)}
  ${m(1210,236,112)}
  <rect x="1418" y="80" width="18" height="130" fill="#ece3d3"/><rect x="1428" y="80" width="8" height="130" fill="${t}" opacity=".16"/><path d="M1414 80L1427 32L1440 80Z" fill="#5d6894"/><rect x="1423" y="96" width="8" height="12" rx="4" fill="${n}"/>
  ${p(13,10,610,e,{lit:.45})}
  ${p(14,1010,1600,i,{lit:.45})}
  ${y(15,560,640,t=>e(t)+2,.9)}${y(16,1010,1080,e=>i(e)+2,.9)}
  ${b(`mo`,250,`#22b8a4`,`#12608c`,17)}
  ${x(18,1080,250)}
  <g transform="translate(0 516) scale(1 -1)" opacity=".22"><path d="${a}" fill="#ead9bd"/></g>
  <path d="M590 262Q610 236 650 240T700 262Z" fill="#8f8aa6"/><path d="M900 262Q930 232 980 238T1030 262Z" fill="#8f8aa6"/>
  <rect x="596" y="150" width="64" height="108" fill="#e3d2b4"/><rect x="636" y="150" width="24" height="108" fill="${t}" opacity=".15"/>
  <path d="M590 150L628 116L666 150Z" fill="#5d6894"/><path d="M612 196v-8a5 5 0 0 1 10 0v8Z" fill="${n}"/><path d="M612 226v-8a5 5 0 0 1 10 0v8Z" fill="${r}"/>
  <rect x="940" y="136" width="70" height="122" fill="#dccaa9"/><rect x="984" y="136" width="26" height="122" fill="${t}" opacity=".15"/>
  <path d="M934 136Q975 98 1016 136Z" fill="#5d6894"/><path d="M962 180v-9a6 6 0 0 1 12 0v9Z" fill="${n}" class="cs-flick"/><path d="M962 214v-9a6 6 0 0 1 12 0v9Z" fill="${r}"/>
  <path d="${a}" fill="#ead9bd"/>
  <path d="M694 258Q800 66 906 258" fill="none" stroke="#bfa57c" stroke-width="5" stroke-dasharray="3 9"/>
  <path d="M670 166Q800 96 930 166" fill="none" stroke="#f7eedd" stroke-width="5" stroke-linecap="round"/>
  <g transform="translate(800 132)"><g class="cs-bob"><circle cx="0" cy="-17" r="3.2" fill="#0b1a4f"/><path d="M0-13V-3M0-3l-3 7M0-3l3 7M0-11l-5-8M0-11l5-8" stroke="#0b1a4f" stroke-width="2.2" stroke-linecap="round"/></g></g>
  ${c(`mo`)}`)}function T(){let i=e=>Math.min(262,150+e/600*86),a=e=>Math.min(262,236-(e-1e3)/600*86),o=``;for(let e=170;e<262;e+=11)o+=`<rect x="670" y="${e}" width="260" height="5" fill="#c8553d"/>`;let u=``;for(let e=128;e<166;e+=9)u+=`<rect x="762" y="${e}" width="76" height="4" fill="#c8553d"/>`;let _=``;for(let e=672;e<928;e+=14)_+=`<rect x="${e}" y="158" width="8" height="8" fill="#f0c27a"/>`;let v=``;for(let[e,t]of[[184,9],[222,9]])for(let i=0;i<t;i++){let t=684+i*27;(e!==222||i!==4)&&(v+=`<path d="M${t} ${e+20}V${e+8}a6 7 0 0 1 12 0V${e+20}Z" fill="${(i*7+e)%3?n:r}"${i%4==1?` class="cs-flick"`:``}/>`)}let y=``;for(let e=0;e<9;e++)y+=`<path d="M1482 ${236-e*19}L1520 ${226-e*19}" stroke="${n}" stroke-width="2" opacity="${e%3?.45:.85}"/>`;return C(`${s(`sa`,`#ff9fb0`,`#7a6cf0`)}${l(21,34,100)}${d(`sa`,1330,58,18,!0)}
  ${f(23,130,70,`#34408f`,100)}${f(25,170,40,`#28337f`,120)}
  ${S(120,58,12)}
  <path d="M0 300V150Q300 170 600 236L620 300Z" fill="#1f2b70"/><path d="M1600 300V150Q1300 170 1000 236L980 300Z" fill="#1f2b70"/>
  ${p(31,0,560,e=>i(e)-4,{scale:.7,lit:.4})}
  ${p(32,1040,1600,e=>a(e)-4,{scale:.7,lit:.4})}
  ${p(33,0,600,e=>Math.min(262,i(e)+30),{scale:.85,lit:.45})}
  ${p(34,1e3,1600,e=>Math.min(262,a(e)+30),{scale:.85,lit:.45})}
  <rect x="1478" y="66" width="46" height="196" fill="#4f86ff"/><path d="M1478 66L1500 52L1524 66Z" fill="#9fc0ff"/><rect x="1501" y="66" width="23" height="196" fill="#9fc0ff" opacity=".35"/>${y}
  <rect x="398" y="186" width="76" height="76" fill="#e8dccb"/><circle cx="436" cy="212" r="11" fill="${n}"/><circle cx="436" cy="212" r="11" fill="none" stroke="#c8553d" stroke-width="3"/>
  <rect x="392" y="140" width="22" height="122" fill="#e8dccb"/><rect x="458" y="140" width="22" height="122" fill="#e8dccb"/><rect x="406" y="140" width="8" height="122" fill="${t}" opacity=".14"/><rect x="472" y="140" width="8" height="122" fill="${t}" opacity=".14"/>
  <path d="M390 140L403 104L416 140Z" fill="#5d6894"/><path d="M456 140L469 104L482 140Z" fill="#5d6894"/><path d="M400 160v-8a3 3 0 0 1 6 0v8Z" fill="${n}"/><path d="M466 160v-8a3 3 0 0 1 6 0v8Z" fill="${n}"/>
  <rect x="670" y="166" width="260" height="96" fill="#f0c27a"/>${o}${_}
  <rect x="662" y="146" width="22" height="116" fill="#f0c27a"/><rect x="916" y="146" width="22" height="116" fill="#f0c27a"/>
  <path d="M662 146h22v-7h-5v4h-4v-4h-4v4h-4v-4h-5Z" fill="#f0c27a"/><path d="M916 146h22v-7h-5v4h-4v-4h-4v4h-4v-4h-5Z" fill="#f0c27a"/>
  <rect x="762" y="124" width="76" height="42" fill="#f0c27a"/>${u}${h(800,124,30,`#5fa79a`,26)}
  <rect x="860" y="146" width="78" height="116" fill="${t}" opacity=".12"/>
  ${v}<path d="M786 262V236a14 14 0 0 1 28 0V262Z" fill="${n}"/>
  ${g(1100,262,110,`#efe8da`,`#7c86ad`)}${h(1112,224,12,`#7c86ad`)}${m(1236,262,160)}
  <rect x="972" y="254" width="76" height="8" fill="#cfc3b0"/>
  <rect x="984" y="214" width="52" height="40" fill="#9a6232"/>
  <path d="M990 254v-24a6 6 0 0 1 12 0v24Zm14 0v-24a6 6 0 0 1 12 0v24Zm14 0v-24a6 6 0 0 1 12 0v24Z" fill="#5a3a24"/>
  <path d="M968 214L1052 214L1042 202L978 202Z" fill="#6e4426"/>${h(1010,202,25,`#3f8f78`,28)}
  <circle cx="964" cy="259" r="3" fill="#b9bfd6"/><circle cx="1058" cy="258" r="3" fill="#b9bfd6"/><circle cx="1066" cy="260" r="2.5" fill="#b9bfd6"/>
  <rect y="262" width="${e}" height="8" fill="#1a2566"/>
  ${b(`sa`,270,`#3a7fd0`,`#1d3f8f`,35,0,e,18)}
  <path d="M250 270Q280 258 310 270M300 270Q330 258 360 270" fill="none" stroke="#e3d3b5" stroke-width="5"/><rect x="246" y="262" width="118" height="5" fill="#e3d3b5"/>
  <g transform="translate(0 232)"><g class="cs-tram"><rect x="0" y="0" width="120" height="28" rx="6" fill="#f4e9d0"/><rect x="0" y="18" width="120" height="6" fill="#c8553d"/>${[10,32,54,76,98].map(e=>`<rect x="${e}" y="5" width="14" height="10" rx="2" fill="${n}"/>`).join(``)}<path d="M50 0l10-10l10 10" fill="none" stroke="#b9bfd6" stroke-width="2"/><circle cx="22" cy="30" r="4" fill="#0b1a4f"/><circle cx="98" cy="30" r="4" fill="#0b1a4f"/></g></g>
  ${c(`sa`)}`)}function E(){let u=``;for(let e=192;e<262;e+=9)u+=`<rect x="500" y="${e}" width="120" height="4" fill="#b9473a"/>`;for(let e=162;e<192;e+=9)u+=`<rect x="534" y="${e}" width="52" height="4" fill="#b9473a"/>`;for(let e=112;e<262;e+=9)u+=`<rect x="640" y="${e}" width="32" height="4" fill="#b9473a"/>`;let p=``;for(let e=60;e<460;e+=16)p+=`<rect x="${e}" y="222" width="9" height="8" fill="#b7ab98"/>`;let _=``,v=o(41);for(let e=1090;e<1580;e+=70){let t=60+v()*70;_+=`<rect x="${e}" y="${a(262-t)}" width="58" height="${a(t)}" fill="${v()<.5?`#3b4aa0`:`#46559f`}"/>`;for(let i=262-t+8;i<252;i+=13)for(let t=e+7;t<e+52;t+=12){let e=v()<.5;_+=`<rect${e&&v()<.2?` class="cs-flick"`:``} x="${t}" y="${a(i)}" width="6" height="7" fill="${e?n:r}"/>`}}let w=(e,t)=>`<path d="M${e} ${t}v-14M${e-4} ${t-10}h8M${e-3} ${t-5}l6 -2" stroke="${i}" stroke-width="1.8"/>`;return C(`${s(`bl`,`#ffb86b`,`#5f8cff`)}${l(43,40,120)}${d(`bl`,1240,64,22)}
  ${f(45,196,34,`#2e3a8f`,120)}${f(47,220,22,`#24307f`,140)}
  ${S(130,60,18)}
  ${y(49,0,e,()=>250,1.2,[`#1d5a5c`,`#1f6b63`,`#24806b`])}
  ${_}
  <rect x="500" y="190" width="120" height="72" fill="#e7b56a"/>
  <rect x="534" y="160" width="52" height="32" fill="#e7b56a"/>
  <rect x="640" y="110" width="32" height="152" fill="#e7b56a"/>
  ${u}
  <rect x="590" y="160" width="30" height="102" fill="${t}" opacity=".12"/><rect x="660" y="110" width="12" height="152" fill="${t}" opacity=".14"/>
  <path d="M532 160A28 34 0 0 1 588 160Z" fill="${i}"/><path d="M548 140a10 18 0 0 1 10-14" fill="none" stroke="#fff6cf" stroke-width="3" opacity=".7"/>${w(560,126)}
  <path d="M640 110A16 20 0 0 1 672 110Z" fill="${i}"/>${w(656,90)}
  ${h(510,190,10,i)}${h(610,190,10,i)}
  <path d="M552 262v-26a8 8 0 0 1 16 0v26Z" fill="${n}"/><path d="M650 150v-10a6 6 0 0 1 12 0v10Z" fill="${n}" class="cs-flick"/>
  ${g(856,262,108,`#f6f3ea`,`#8a94bb`)}${h(872,224,11,`#8a94bb`)}${h(948,224,11,`#8a94bb`)}${m(990,262,176)}
  <rect x="60" y="228" width="400" height="34" fill="#b7ab98"/>${p}
  <rect x="96" y="200" width="54" height="62" fill="#c4b8a4"/><path d="M96 200h54v-8h-8v5h-8v-5h-7v5h-8v-5h-8v5h-7v-5h-8Z" fill="#c4b8a4"/>
  <rect x="132" y="200" width="18" height="62" fill="${t}" opacity=".14"/><path d="M286 262v-20a12 12 0 0 1 24 0v20Z" fill="#3b3550"/>
  ${y(51,180,440,()=>232,.8,[`#1f6b63`,`#24806b`])}
  ${b(`bl`,262,`#2f8fbf`,`#163f84`,53)}
  ${x(54,1240,262,`#fff3d0`)}
  <g transform="translate(700 278)"><g class="cs-boat"><g class="cs-bob"><path d="M-70 0Q0 12 70 0L62 6Q0 14 -62 6Z" fill="#c98b4e"/><circle cx="-24" cy="-14" r="4" fill="#0b1a4f"/><path d="M-24-10v10" stroke="#0b1a4f" stroke-width="5" stroke-linecap="round"/><circle cx="24" cy="-14" r="4" fill="#0b1a4f"/><path d="M24-10v10M14-4l26 18" stroke="#0b1a4f" stroke-width="3" stroke-linecap="round"/><path d="M-34-4l-26 18" stroke="#0b1a4f" stroke-width="3" stroke-linecap="round"/></g></g></g>
  ${c(`bl`)}`)}function D(){let e=e=>240-(e-80)/330*104,r=e=>132+(e-620)/290*96,i=``;for(let e=420;e<600;e+=14)i+=`<rect x="${e}" y="86" width="8" height="8" fill="#c9bba3"/>`;let o=``;for(let e=1046;e<1108;e+=8)o+=`<path class="cs-fall" style="animation-delay:-${a(e*7%9/10)}s" d="M${e} 176V262" stroke="#fff" stroke-width="3" stroke-dasharray="14 6" opacity=".85"/>`;let d=``;for(let[e,r]of[1180,1240,1300,1370,1430,1500,1560].entries()){let i=162-e%2*4;d+=`<path d="M${r+3} ${i+14}v14M${r+21} ${i+14}v14" stroke="#5a3a24" stroke-width="2.5"/><rect x="${r}" y="${i-2}" width="24" height="16" fill="#8a5a34"/><rect x="${r+14}" y="${i-2}" width="10" height="16" fill="${t}" opacity=".2"/><path d="M${r-4} ${i-2}L${r+12} ${i-22}L${r+28} ${i-2}Z" fill="#5a3a24"/>${e%3==0?`<rect x="${r+8}" y="${i+3}" width="5" height="6" fill="${n}" class="cs-flick"/>`:``}`}return C(`${s(`ja`,`#ffcf7a`,`#2fb8c0`)}${l(61,30,90)}${u(`ja`,1360,150,20,`#ffe0a0`)}
  ${f(63,130,60,`#2a3a8c`,100)}${f(65,166,36,`#21317d`,120)}
  ${S(100,56,4)}${S(126,70,40)}
  <path d="M60 300V244Q240 210 380 132Q510 88 640 128Q780 176 920 230V300Z" fill="#20306f"/>
  <rect x="418" y="94" width="186" height="40" fill="#c9bba3"/>${i}<rect x="560" y="94" width="44" height="40" fill="${t}" opacity=".14"/>
  <rect x="588" y="66" width="38" height="68" fill="#c9bba3"/><path d="M588 66h38v-8h-6v4h-7v-4h-6v4h-7v-4h-6v4h-6Z" fill="#c9bba3"/><path d="M500 134v-16a9 9 0 0 1 18 0v16Z" fill="#3b3550"/>
  ${p(67,120,410,t=>e(t)+4,{scale:.75})}${p(68,640,900,e=>r(e)+4,{scale:.75})}
  <rect x="322" y="70" width="22" height="98" fill="#d8c9ac"/><rect x="335" y="70" width="9" height="98" fill="${t}" opacity=".15"/><path d="M318 70L333 34L348 70Z" fill="#5d6894"/><path d="M329 90v-8a4 4 0 0 1 8 0v8Z" fill="${n}"/>
  <rect x="690" y="100" width="20" height="56" fill="#e8dccb"/><path d="M686 100L700 78L714 100Z" fill="#5d6894"/><circle cx="700" cy="114" r="6" fill="#fff6dc"/><path d="M700 110v4h3" stroke="${t}" stroke-width="1.4" fill="none"/>
  ${p(69,90,420,t=>Math.min(262,e(t)+44),{scale:.9})}${p(70,630,920,e=>Math.min(262,r(e)+40),{scale:.9})}
  <path d="M1110 300V176H1600V300Z" fill="#1d2d72"/>
  ${f(71,160,22,`#24357f`,80,e=>e<1100?-200:0)}
  <rect x="1110" y="174" width="490" height="16" fill="#49c3cf"/><path d="M1130 180h40M1260 184h50M1420 179h60" stroke="#fff" stroke-opacity=".6" stroke-width="2" class="cs-shim"/>
  ${d}
  ${y(72,1130,1600,()=>240,1.1)}
  <path d="M940 300V214Q980 176 1040 176H1112Q1150 186 1170 300Z" fill="#555c8a"/><path d="M948 210Q985 178 1040 176H1112Q1140 180 1150 196L1132 190Q1100 182 1040 184Q990 186 948 214Z" fill="#2f8a6a"/>
  <path d="M970 240l20-12M1130 220l14 10M990 270l18-6" stroke="#3f4470" stroke-width="3"/>
  <linearGradient id="ja-fall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bff3f6"/><stop offset="1" stop-color="#fff"/></linearGradient>
  <path d="M1040 176H1112L1116 262H1036Z" fill="url(#ja-fall)" opacity=".9"/>${o}
  ${b(`ja`,258,`#2bb3c0`,`#16588f`,73)}
  <ellipse class="cs-mist" cx="1054" cy="262" rx="24" ry="10" fill="#fff" opacity=".35"/><ellipse class="cs-mist" style="animation-delay:-1s" cx="1078" cy="258" rx="30" ry="12" fill="#fff" opacity=".3"/><ellipse class="cs-mist" style="animation-delay:-2s" cx="1104" cy="263" rx="22" ry="9" fill="#fff" opacity=".35"/>
  ${c(`ja`)}`)}function O(){let e=1490,t=[70,82,94,106,116,122,116,106,94,82,70],n=(1380-t.reduce((e,t)=>e+t,0))/(t.length+1),r=e=>190-8*Math.sin(Math.PI*(e-110)/1380),i=`M110 262V${a(r(110))}`;for(let t=150;t<=e;t+=40)i+=`L${t} ${a(r(t))}`;i+=`L${e} ${a(r(e))}V262Z`;let o=``,d=``,h=110+n;for(let e of t){let t=252-e*.46;o+=`M${a(h)} 262V252Q${a(h+e/2)} ${a(2*t-252)} ${a(h+e)} 252V262Z`,h+=e+n}h=110;for(let e=0;e<=t.length;e++)d+=`<path d="M${a(h)} 262V240L${a(h+n/2)} 228L${a(h+n)} 240V262Z" fill="#cdb894"/>`,h+=n+(t[e]??0);let g=`${i}${o}`;return C(`${s(`vi`,`#ffb347`,`#8a63d8`)}${l(81,24,80)}${u(`vi`,800,176,40,`#ffd27a`)}
  ${f(83,186,26,`#3b3f95`,110)}
  <path d="M0 300V56Q130 64 270 118Q430 178 640 236V300Z" fill="#2a2f80"/><path d="M1600 300V66Q1470 74 1330 128Q1160 188 960 236V300Z" fill="#2a2f80"/>
  ${y(85,10,600,e=>Math.min(250,70+e*.28+30),1,[`#1f5d5a`,`#1a4f58`,`#236a62`])}
  ${y(86,1010,1590,e=>Math.min(250,236-(e-960)*.27+30),1,[`#1f5d5a`,`#1a4f58`,`#236a62`])}
  ${p(87,1040,1380,e=>Math.min(244,236-(e-960)*.27+46),{scale:.75})}${m(1290,222,104)}
  ${p(88,230,560,e=>Math.min(244,70+e*.28+44),{scale:.75})}
  ${S(110,60,20)}${S(146,72,48)}
  ${b(`vi`,248,`#28b39a`,`#0f5f7f`,89)}
  ${x(90,800,248)}
  <g transform="translate(0 504) scale(1 -1)" opacity=".2"><path d="${g}" fill="#e3d3b5" fill-rule="evenodd"/></g>
  <path d="${g}" fill="#e3d3b5" fill-rule="evenodd"/>
  ${d}
  <path d="${i.split(`V262Z`)[0].replace(`M110 262V`,`M110 `)}" fill="none" stroke="#f7eedd" stroke-width="5" stroke-linecap="round" transform="translate(0 -2)"/>
  <rect x="770" y="170" width="60" height="12" fill="#e3d3b5"/><rect x="770" y="168" width="60" height="4" fill="#f7eedd"/>
  <circle cx="788" cy="162" r="3" fill="#0b1a4f"/><path d="M788 165v7" stroke="#0b1a4f" stroke-width="3" stroke-linecap="round"/>
  ${c(`vi`)}`)}var k=[{key:`mostar`,name:`Mostar`,svg:w()},{key:`sarajevo`,name:`Sarajevo`,svg:T()},{key:`banja-luka`,name:`Banja Luka`,svg:E()},{key:`jajce`,name:`Jajce`,svg:D()},{key:`visegrad`,name:`Višegrad`,svg:O()}];export{k as CITY_SCENES};