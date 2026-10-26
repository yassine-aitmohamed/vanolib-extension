const ESC=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
function loadPdfjs(){ const L=window.pdfjsLib; L.GlobalWorkerOptions.workerSrc=chrome.runtime.getURL('pdf.worker.min.js'); return Promise.resolve(L); }
const HLC={yellow:'rgba(255,212,0,.5)',green:'rgba(90,205,120,.45)',blue:'rgba(90,155,255,.4)',pink:'rgba(255,105,165,.42)'};
const HLB={yellow:'#f2c94c',green:'#5acd78',blue:'#5a9bff',pink:'#ff69a5'};
const READERS=[];

class Reader{
  constructor(host,o={}){
    this.o=Object.assign({side:false,hlTab:true,back:null,theme:'day',autohide:false},o);
    this.host=host;this.states={};this.hls={};this.gen=0;this.sg=0;this.scale=1;this.fit='auto';this.spread=false;this.hits=[];this.hitIdx=0;this.tab='th';
    READERS.push(this);this.build();
  }
  $(s){return this.rdr.querySelector(s)}
  build(){
    this.host.innerHTML=`<div class="rdr t-${this.o.theme} ${this.o.side?'side':''} ${this.o.autohide?'ah':''}">
     <div class="rtb">
      <button data-a="side" title="Sidebar: pages, outline${this.o.hlTab?', highlights':''}">▥</button>
      ${this.o.back?`<button data-a="back" class="back">${this.o.back}</button>`:''}
      <span class="sep"></span>
      <button data-a="prev" title="Previous page (←)">‹</button><input class="pgin" value="–" title="Go to page"><span class="num">/ –</span><button data-a="next" title="Next page (→)">›</button>
      <span class="sep"></span>
      <button data-a="zout" title="Zoom out (⌘−)">−</button><button data-a="z100" class="zl" title="Actual size">100%</button><button data-a="zin" title="Zoom in (⌘+ or pinch)">+</button>
      <button data-a="fitw" title="Fit width (⌘0)">↔</button><button data-a="fitp" title="Fit whole page">⤢</button><button data-a="spread" title="Two-page spread">⧉</button>
      <span class="title"></span>
      <button class="sw" data-t="day" style="background:#fff" title="Day"></button><button class="sw" data-t="sepia" style="background:#f1e4c8" title="Sepia"></button><button class="sw" data-t="night" style="background:#1d1d20" title="Night (smart dark: colours preserved)"></button>
      <span class="sep"></span>
      <button data-a="find" title="Search in document (⌘F)">⌕</button><button data-a="open" title="Open a PDF from your computer (or drag &amp; drop)">⇪</button><button data-a="fs" title="Full screen">⛶</button>
      <input type="file" accept="application/pdf,.pdf" hidden>
     </div>
     <div class="rbody">
      <div class="rprog"><i></i></div>
      <div class="rside"><div class="rstabs"><button data-s="th" class="on">Pages</button><button data-s="ol">Outline</button>${this.o.hlTab?'<button data-s="hl">Highlights</button>':''}</div><div class="rspane"></div></div>
      <div class="rview" tabindex="0"><div class="rpages"></div></div>
      <div class="rempty"><div><b>No paper open</b>Pick an article, or drop a PDF here.</div></div>
      <div class="rsearch"><span>⌕</span><input placeholder="Find in document"><span class="cnt"></span><button data-a="sprev" title="Previous (⇧↵)">↑</button><button data-a="snext" title="Next (↵)">↓</button><button data-a="sclose" title="Close (esc)">✕</button></div>
      <div class="rsel">${Object.keys(HLC).map(c=>`<button class="c" data-c="${c}" style="background:${HLB[c]}" title="Highlight ${c}"></button>`).join('')}<button class="t" data-a="copy">Copy</button></div>
      <div class="rdrop">Drop the PDF to open it</div>
      <div class="rtoast"></div>
     </div></div>`;
    this.rdr=this.host.firstElementChild;this.view=this.$('.rview');this.pages=this.$('.rpages');this.pane=this.$('.rspane');
    this.rdr.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(b)this.act(b.dataset.a)});
    $$('.sw',this.rdr).forEach(b=>b.onclick=()=>this.setTheme(b.dataset.t));this.setTheme(this.o.theme,true);
    $$('.rstabs button',this.rdr).forEach(b=>b.onclick=()=>{this.tab=b.dataset.s;this.renderSide()});
    const pin=this.$('.pgin');pin.onkeydown=e=>{if(e.key==='Enter'){this.goto(+pin.value||1);pin.blur()}};pin.onfocus=()=>pin.select();
    const fi=this.$('input[type=file]');fi.onchange=async()=>{const f=fi.files[0];if(f)this.openFile(f.name,await f.arrayBuffer());fi.value=''};
    this.view.addEventListener('scroll',()=>this.onScroll(),{passive:true});
    this.view.addEventListener('wheel',e=>{if(!e.ctrlKey||!this.pdf)return;e.preventDefault();const r=this.view.getBoundingClientRect();this.fit=null;this.setScale(this.scale*Math.exp(-e.deltaY*0.01),e.clientX-r.left,e.clientY-r.top)},{passive:false});
    new ResizeObserver(()=>{if(this.pdf&&this.fit){clearTimeout(this.rt);this.rt=setTimeout(()=>this.setScale(this.fitScale(this.fit)),80)}}).observe(this.view);
    const si=this.$('.rsearch input');
    si.oninput=()=>{clearTimeout(this.st);this.st=setTimeout(()=>this.search(si.value),220)};
    si.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();this.stepHit(e.shiftKey?-1:1)}};
    this.view.addEventListener('mousedown',e=>{const tl=e.target.closest('.textLayer');if(tl)tl.classList.add('selecting');if(!e.target.closest('.rsel'))this.hideSel()});
    document.addEventListener('mouseup',()=>{$$('.textLayer.selecting',this.rdr).forEach(t=>t.classList.remove('selecting'));setTimeout(()=>this.checkSel(),0)});
    $$('.rsel .c',this.rdr).forEach(b=>b.onmousedown=e=>{e.preventDefault();this.addHL(b.dataset.c)});
    let dc=0;
    this.rdr.addEventListener('dragenter',e=>{if([...e.dataTransfer.types].includes('Files')){dc++;this.rdr.classList.add('drag')}});
    this.rdr.addEventListener('dragleave',()=>{if(--dc<=0){dc=0;this.rdr.classList.remove('drag')}});
    this.rdr.addEventListener('dragover',e=>e.preventDefault());
    this.rdr.addEventListener('drop',async e=>{e.preventDefault();dc=0;this.rdr.classList.remove('drag');const f=[...e.dataTransfer.files].find(f=>/pdf$/i.test(f.type)||/\.pdf$/i.test(f.name));if(f)this.openFile(f.name,await f.arrayBuffer());else this.toast('Not a PDF file')});
    if(this.o.autohide){const wake=()=>{this.rdr.classList.remove('idle');clearTimeout(this.it);this.it=setTimeout(()=>{if(!this.$('.rsearch.on')&&!this.$('.rtb:hover'))this.rdr.classList.add('idle')},2200)};this.rdr.addEventListener('mousemove',wake);this.wake=wake}
  }
  toast(m){const t=this.$('.rtoast');t.textContent=m;t.classList.add('on');clearTimeout(this.tt);this.tt=setTimeout(()=>t.classList.remove('on'),1600)}
  act(a){
    const P=this.pdf;
    if(a==='side')this.rdr.classList.toggle('side'),this.renderSide();
    else if(a==='back')this.o.onBack&&this.o.onBack();
    else if(a==='open')this.$('input[type=file]').click();
    else if(a==='fs'){if(this.o.fullscreen)return this.o.fullscreen();try{document.fullscreenElement?document.exitFullscreen():this.rdr.requestFullscreen()}catch(e){}}
    else if(!P)return;
    else if(a==='prev')this.goto(this.cur-(this.spread?2:1));
    else if(a==='next')this.goto(this.cur+(this.spread?2:1));
    else if(a==='zin'){this.fit=null;this.setScale(this.scale*1.15)}
    else if(a==='zout'){this.fit=null;this.setScale(this.scale/1.15)}
    else if(a==='z100'){this.fit=null;this.setScale(1)}
    else if(a==='fitw'){this.fit='width';this.setScale(this.fitScale('width'))}
    else if(a==='fitp'){this.fit='page';this.setScale(this.fitScale('page'))}
    else if(a==='spread'){this.spread=!this.spread;this.rdr.classList.toggle('spread',this.spread);this.$('[data-a=spread]').classList.toggle('on',this.spread);this.setScale(this.fit?this.fitScale(this.fit):this.scale,undefined,undefined,true)}
    else if(a==='find')this.openSearch();
    else if(a==='sclose')this.closeSearch();
    else if(a==='snext')this.stepHit(1);
    else if(a==='sprev')this.stepHit(-1);
    else if(a==='copy'){const t=getSelection().toString();try{navigator.clipboard.writeText(t)}catch(e){document.execCommand('copy')}this.hideSel();this.toast('Copied')}
  }
  setTheme(t,silent){if(!silent&&this.o.onTheme)this.o.onTheme(t);this.theme=t;this.rdr.classList.remove('t-day','t-sepia','t-night');this.rdr.classList.add('t-'+t);$$('.sw',this.rdr).forEach(b=>b.classList.toggle('on',b.dataset.t===t))}
  empty(msg){const e=this.$('.rempty');e.style.display=msg?'grid':'none';if(msg)e.innerHTML=`<div>${msg}</div>`}
  snap(){const v=this.view;return{scale:this.scale,fit:this.fit,spread:this.spread,ratio:v.scrollTop/Math.max(1,v.scrollHeight-v.clientHeight),page:this.cur,pages:this.n}}
  saveState(){if(this.pdf&&this.key){this.states[this.key]=this.snap();this.persist(true)}}
  persist(now){if(!this.o.persist||!this.pdf||!this.key||this.key.startsWith('file:'))return;clearTimeout(this.pt);const k=this.key,go=()=>{if(this.key===k&&this.pdf&&this.view.clientHeight)this.o.persist(k,this.snap())};if(now)go();else this.pt=setTimeout(go,1500)}
  clear(){this.saveState();this.gen++;if(this.pdf)try{this.pdf.destroy()}catch(e){}this.pdf=null;this.key=null;this.pages.innerHTML='';this.pane.innerHTML='';this.$('.num').textContent='/ –';this.$('.pgin').value='–';this.$('.rprog i').style.width='0';this.closeSearch();this.empty('<b>No paper open</b>Pick an article, or drop a PDF here.')}
  openFile(name,buf){const doc={key:'file:'+name+':'+buf.byteLength,title:name.replace(/\.pdf$/i,''),bytes:()=>new Uint8Array(buf.slice(0)),file:true};if(this.o.onFile)this.o.onFile(doc);else this.open(doc)}
  async open(doc){
    if(this.pdf&&this.key===doc.key)return;
    this.saveState();const gen=++this.gen;
    if(this.pdf)try{this.pdf.destroy()}catch(e){}
    this.pdf=null;this.key=doc.key;this.title=doc.title||'';this.$('.title').textContent=this.title;
    this.pages.innerHTML='';this.pg=[];this.tc={};this.ptext={};this.hits=[];this.thumbDone={};this.closeSearch();this.hideSel();
    this.empty('Loading…');
    if(doc.prepare){this.empty('Downloading from arXiv…');let pr=null;try{pr=await doc.prepare()}catch(e){pr={ok:false,error:String(e)}}if(gen!==this.gen)return;if(pr&&pr.ok===false){this.empty('<b>PDF unavailable</b>'+ESC(pr.error||''));return}this.empty('Loading…')}
    if(!this.states[doc.key]&&this.o.loadDoc&&!doc.file){try{const rr=await this.o.loadDoc(doc.key);if(gen!==this.gen)return;if(rr&&rr.state)this.states[doc.key]=rr.state;if(rr&&rr.highlights)this.hls[doc.key]=rr.highlights}catch(e){}}
    let L;try{L=await loadPdfjs()}catch(e){if(gen===this.gen)this.empty('<b>PDF engine unavailable</b>PDF.js could not be loaded (no internet?).<br>In the real app it is bundled locally.');return}
    let pdf;try{pdf=await L.getDocument(Object.assign(doc.url?{url:doc.url,withCredentials:true}:{data:doc.bytes()},{isEvalSupported:false})).promise}catch(e){if(gen===this.gen)this.empty('<b>Could not open this PDF</b>'+ESC(e.message||e));return}
    if(gen!==this.gen){try{pdf.destroy()}catch(e){}return}
    this.L=L;this.pdf=pdf;this.n=pdf.numPages;this.po=[];this.sz=[];
    for(let i=1;i<=this.n;i++){const p=await pdf.getPage(i);if(gen!==this.gen)return;this.po[i]=p;const v=p.getViewport({scale:1});this.sz[i]=[v.width,v.height]}
    this.maxW=Math.max(...this.sz.slice(1).map(s=>s[0]));this.maxH=Math.max(...this.sz.slice(1).map(s=>s[1]));
    const fr=document.createDocumentFragment();
    for(let i=1;i<=this.n;i++){const d=document.createElement('div');d.className='pg';d.dataset.n=i;
      d.innerHTML=`<canvas width="1" height="1"></canvas><div class="hlL"></div><div class="textLayer"></div><div class="lnk"></div><span class="pgno">${i}</span>`;this.pg[i]=d;fr.appendChild(d)}
    this.pages.appendChild(fr);this.empty(null);
    this.$('.num').textContent='/ '+this.n;this.hls[this.key]=this.hls[this.key]||[];
    const st=this.states[this.key];
    this.spread=st?!!st.spread:false;this.rdr.classList.toggle('spread',this.spread);this.$('[data-a=spread]').classList.toggle('on',this.spread);
    this.fit=st?(st.fit===undefined?'auto':st.fit):'auto';this.scale=this.fit||!st.scale?this.fitScale(this.fit||'auto'):st.scale;this.layout();
    this.view.scrollTop=st?(st.ratio||0)*(this.view.scrollHeight-this.view.clientHeight):0;this.view.scrollLeft=0;
    this.cur=0;this.onScroll(true);this.renderSide();this.drawAllHL();this.o.onOpen&&this.o.onOpen(doc,this);
    if(this.o.autohide&&this.wake)this.wake();
  }
  fitScale(m){const v=this.view,c=this.spread?2:1,w=(v.clientWidth-56-(c-1)*14)/(this.maxW*c);
    if(m==='auto')return Math.max(.5,Math.min(w,1.5));if(m==='width')return w;return Math.min(w,(v.clientHeight-48)/this.maxH)}
  layout(){for(let i=1;i<=this.n;i++){const d=this.pg[i];d.style.width=Math.floor(this.sz[i][0]*this.scale)+'px';d.style.height=Math.floor(this.sz[i][1]*this.scale)+'px';d.style.setProperty('--scale-factor',this.scale)}
    this.$('.zl').textContent=Math.round(this.scale*100)+'%'}
  pageAt(y){let p=1;for(let i=1;i<=this.n;i++){if(this.pg[i].offsetTop<=y)p=i;else break}return p}
  setScale(s,ax,ay,force){if(!this.pdf)return;s=Math.max(.3,Math.min(5,s));if(!force&&Math.abs(s-this.scale)<1e-3)return;
    const v=this.view;if(ay==null)ay=v.clientHeight*.25;if(ax==null)ax=v.clientWidth/2;
    const y=v.scrollTop+ay,p=this.pageAt(y),d=this.pg[p],rel=(y-d.offsetTop)/d.offsetHeight,rx=(v.scrollLeft+ax)/Math.max(1,v.scrollWidth);
    this.scale=s;this.layout();v.scrollTop=d.offsetTop+rel*d.offsetHeight-ay;v.scrollLeft=rx*v.scrollWidth-ax;
    clearTimeout(this.zt);this.zt=setTimeout(()=>this.renderVisible(),140);this.onScroll(true,true)}
  onScroll(now,noRender){if(!this.pdf)return;if(this.raf&&!now)return;
    const run=()=>{this.raf=0;if(!this.pdf||!this.view.clientHeight)return;const v=this.view,c=this.pageAt(v.scrollTop+v.clientHeight*.35),r=v.scrollTop/Math.max(1,v.scrollHeight-v.clientHeight);
      this.$('.rprog i').style.width=(r*100)+'%';
      if(c!==this.cur){this.cur=c;const pin=this.$('.pgin');if(document.activeElement!==pin)pin.value=c;
        $$('.rth',this.pane).forEach(t=>t.classList.toggle('on',+t.dataset.n===c));const t=$(`.rth[data-n="${c}"]`,this.pane);if(t&&this.rdr.classList.contains('side'))t.scrollIntoView({block:'nearest'})}
      if(!noRender)this.renderVisible();this.persist();this.o.onProgress&&this.o.onProgress(this.key,c,this.n,r)};
    if(now)run();else this.raf=requestAnimationFrame(run)}
  renderVisible(){if(!this.pdf)return;const v=this.view,top=v.scrollTop-900,bot=v.scrollTop+v.clientHeight+900;
    for(let i=1;i<=this.n;i++){const d=this.pg[i],y=d.offsetTop,h=d.offsetHeight;
      if(y+h>top&&y<bot)this.renderPage(i);else if(d._sc&&(y+h<top-4000||y>bot+4000))this.release(i)}}
  release(i){const d=this.pg[i];d.querySelector('canvas').replaceWith(Object.assign(document.createElement('canvas'),{width:1,height:1}));d.querySelector('.textLayer').innerHTML='';d._sc=null;d._divs=null;d._marked=null}
  text(i){return this.tc[i]||(this.tc[i]=this.po[i].getTextContent())}
  renderPage(i){const d=this.pg[i],sc=this.scale,gen=this.gen;if(!d)return Promise.resolve();
    if(d._sc===sc)return Promise.resolve();if(d._busy===sc)return d._p;d._busy=sc;
    d._p=(async()=>{const page=this.po[i],vp=page.getViewport({scale:sc});let dpr=Math.min(window.devicePixelRatio||1,3);
      while(vp.width*vp.height*dpr*dpr>16e6&&dpr>1)dpr-=.5;
      const cv=document.createElement('canvas');cv.width=Math.floor(vp.width*dpr);cv.height=Math.floor(vp.height*dpr);
      try{await page.render({canvasContext:cv.getContext('2d'),viewport:vp,transform:dpr!==1?[dpr,0,0,dpr,0,0]:null}).promise}catch(e){d._busy=null;return}
      if(gen!==this.gen||this.scale!==sc){d._busy=null;return}
      d.querySelector('canvas').replaceWith(cv);
      const tl=d.querySelector('.textLayer'),tc=await this.text(i);if(gen!==this.gen||this.scale!==sc){d._busy=null;return}
      const tl2=tl.cloneNode(false),divs=[];
      try{await this.L.renderTextLayer({textContentSource:tc,container:tl2,viewport:vp,textDivs:divs}).promise}catch(e){}
      const eoc=document.createElement('div');eoc.className='endOfContent';tl2.appendChild(eoc);tl.replaceWith(tl2);
      d._divs=divs;d._strs=tc.items.filter(it=>it.str!==undefined).map(it=>it.str);d._marked=null;
      if(!d._links){d._links=1;this.links(i,page,vp)}
      d._sc=sc;d._busy=null;this.applyMarks(i)})();
    return d._p}
  async links(i,page,vp){let an=[];try{an=await page.getAnnotations({intent:'display'})}catch(e){}
    const L=this.pg[i].querySelector('.lnk'),W=vp.width,H=vp.height;
    for(const a of an){if(a.subtype!=='Link'||!a.rect)continue;const r=vp.convertToViewportRectangle(a.rect),x=Math.min(r[0],r[2]),y=Math.min(r[1],r[3]),w=Math.abs(r[2]-r[0]),h=Math.abs(r[3]-r[1]);
      const el=document.createElement('a');Object.assign(el.style,{left:x/W*100+'%',top:y/H*100+'%',width:w/W*100+'%',height:h/H*100+'%'});
      if(a.url){el.href=a.url;el.title=a.url;el.onclick=e=>{e.preventDefault();this.o.openUrl?this.o.openUrl(a.url):window.open(a.url,'_blank')}}
      else if(a.dest){el.title='Go to target';el.onclick=e=>{e.preventDefault();this.dest(a.dest)}}else continue;
      L.appendChild(el)}}
  async dest(dst){try{let d=dst;if(typeof d==='string')d=await this.pdf.getDestination(d);if(!Array.isArray(d))return;
    const idx=(typeof d[0]==='object'&&d[0])?await this.pdf.getPageIndex(d[0]):d[0];const k=d[1]&&d[1].name;
    const top=k==='XYZ'?d[3]:(k==='FitH'||k==='FitBH')?d[2]:null;this.goto(idx+1,top,true)}catch(e){}}
  goto(n,top,smooth){if(!this.pdf)return;n=Math.max(1,Math.min(this.n,n|0));const d=this.pg[n];let y=d.offsetTop-14;
    if(top!=null){const vp=this.po[n].getViewport({scale:this.scale});y=d.offsetTop+vp.convertToViewportPoint(0,top)[1]-30}
    this.view.scrollTo({top:Math.max(0,y),behavior:smooth?'smooth':'auto'})}
  async renderSide(){$$('.rstabs button',this.rdr).forEach(b=>b.classList.toggle('on',b.dataset.s===this.tab));
    const P=this.pane;if(!this.pdf){P.innerHTML='';return}const gen=this.gen;
    if(this.tab==='th'){P.innerHTML='';const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){io.unobserve(e.target);this.thumb(+e.target.dataset.n,e.target.querySelector('.c'),gen)}}),{root:P,rootMargin:'300px'});
      for(let i=1;i<=this.n;i++){const t=document.createElement('div');t.className='rth'+(i===this.cur?' on':'');t.dataset.n=i;t.innerHTML=`<div class="c" style="height:${Math.round(128*this.sz[i][1]/this.sz[i][0])}px"></div>${i}`;t.onclick=()=>this.goto(i,null,true);P.appendChild(t);io.observe(t)}}
    else if(this.tab==='ol'){P.innerHTML='<div class="rmsg">…</div>';let ol=null;try{ol=await this.pdf.getOutline()}catch(e){}if(gen!==this.gen||this.tab!=='ol')return;
      if(!ol||!ol.length){P.innerHTML='<div class="rmsg">This PDF has no built-in outline.</div>';return}
      const box=document.createElement('div');box.className='rol';const add=(items,l)=>items.forEach(it=>{const e=document.createElement('div');e.className='l'+Math.min(l,2);e.textContent=it.title;e.onclick=()=>it.dest?this.dest(it.dest):it.url&&(this.o.openUrl?this.o.openUrl(it.url):window.open(it.url,'_blank'));box.appendChild(e);if(it.items&&it.items.length)add(it.items,l+1)});add(ol,0);P.innerHTML='';P.appendChild(box)}
    else this.renderHLList()}
  async thumb(i,box,gen){if(gen!==this.gen)return;const p=this.po[i],dpr=Math.min(devicePixelRatio||1,2),vp=p.getViewport({scale:128*dpr/this.sz[i][0]}),cv=document.createElement('canvas');cv.width=vp.width;cv.height=vp.height;
    try{await p.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise}catch(e){return}if(gen===this.gen)box.appendChild(cv)}
  openSearch(){if(!this.pdf)return;const s=this.$('.rsearch'),i=s.querySelector('input');s.classList.add('on');const sel=getSelection().toString().trim();if(sel&&sel.length<60){i.value=sel;this.search(sel)}i.focus();i.select()}
  closeSearch(){const s=this.$('.rsearch');if(!s)return;s.classList.remove('on');if(this.hits&&this.hits.length){this.hits=[];for(let i=1;i<=(this.n||0);i++)this.applyMarks(i)}this.$('.rsearch .cnt').textContent=''}
  async search(q){const g=++this.sg,cnt=this.$('.rsearch .cnt');this.hits=[];q=q.trim();
    if(!q||!this.pdf){cnt.textContent='';for(let i=1;i<=this.n;i++)this.applyMarks(i);return}
    const ql=q.toLowerCase(),gen=this.gen;cnt.textContent='…';
    for(let i=1;i<=this.n;i++){const tc=await this.text(i);if(g!==this.sg||gen!==this.gen)return;
      if(!this.ptext[i]){let s='';const map=[];tc.items.filter(it=>it.str!==undefined).forEach(it=>{map.push(s.length);s+=it.str;if(it.hasEOL)s+=' '});this.ptext[i]={s:s.toLowerCase(),map}}
      const{s}=this.ptext[i];let p=s.indexOf(ql);while(p>=0){this.hits.push({page:i,start:p,end:p+ql.length,i:this.hits.length});p=s.indexOf(ql,p+1)}}
    if(!this.hits.length){cnt.textContent='0 results';for(let i=1;i<=this.n;i++)this.applyMarks(i);return}
    const k=this.hits.findIndex(h=>h.page>=this.cur);this.showHit(k<0?0:k)}
  stepHit(d){if(!this.hits.length)return;this.showHit((this.hitIdx+d+this.hits.length)%this.hits.length)}
  async showHit(k){this.hitIdx=k;const h=this.hits[k];this.$('.rsearch .cnt').textContent=`${k+1} / ${this.hits.length}`;
    for(let i=1;i<=this.n;i++)if(i!==h.page)this.applyMarks(i);
    this.goto(h.page);await this.renderPage(h.page);this.applyMarks(h.page);
    const m=this.pg[h.page].querySelector('mark.cur');if(m){const vr=this.view.getBoundingClientRect(),mr=m.getBoundingClientRect();this.view.scrollTo({top:this.view.scrollTop+mr.top-vr.top-this.view.clientHeight/3,behavior:'smooth'})}}
  applyMarks(i){const d=this.pg&&this.pg[i];if(!d||!d._divs)return;const divs=d._divs,strs=d._strs;
    if(d._marked){for(const k of d._marked)if(divs[k])divs[k].textContent=strs[k];d._marked=null}
    const hs=this.hits.filter(h=>h.page===i);if(!hs.length||!this.ptext[i])return;const map=this.ptext[i].map,seg={};
    hs.forEach(h=>{for(let k=0;k<strs.length;k++){const a=map[k],b=a+strs[k].length,s=Math.max(a,h.start),e=Math.min(b,h.end);if(s<e)(seg[k]=seg[k]||[]).push([s-a,e-a,h.i===this.hitIdx])}});
    d._marked=Object.keys(seg).map(Number);
    for(const k of d._marked){if(!divs[k])continue;const str=strs[k];let o='',p=0;seg[k].sort((x,y)=>x[0]-y[0]).forEach(([s,e,c])=>{s=Math.max(s,p);o+=ESC(str.slice(p,s))+`<mark${c?' class="cur"':''}>`+ESC(str.slice(s,e))+'</mark>';p=e});divs[k].innerHTML=o+ESC(str.slice(p))}}
  checkSel(){const s=getSelection();if(!this.pdf||s.isCollapsed||!s.rangeCount||!this.view.contains(s.anchorNode)){this.hideSel();return}
    const r=s.getRangeAt(0).getBoundingClientRect(),b=this.$('.rbody').getBoundingClientRect(),el=this.$('.rsel');
    el.style.left=(r.left+r.width/2-b.left)+'px';el.style.top=Math.max(50,r.top-b.top-8)+'px';el.classList.add('on')}
  hideSel(){const e=this.$('.rsel');e&&e.classList.remove('on')}
  addHL(color){const s=getSelection();if(s.isCollapsed)return;const text=s.toString().replace(/\s+/g,' ').trim(),parts={};
    const pages=[];for(let i=1;i<=this.n;i++)if(this.pg[i]._sc)pages.push([i,this.pg[i].getBoundingClientRect()]);
    for(const r of s.getRangeAt(0).getClientRects()){if(r.width<1||r.height<1)continue;const cx=r.left+r.width/2,cy=r.top+r.height/2;
      for(const[i,pr]of pages){if(cx>=pr.left&&cx<=pr.right&&cy>=pr.top&&cy<=pr.bottom){if(r.height>pr.height*.08)break;
        const q=[(r.left-pr.left)/pr.width,(r.top-pr.top)/pr.height,r.width/pr.width,r.height/pr.height];const L=(parts[i]=parts[i]||[]);
        if(!L.some(z=>Math.abs(z[0]-q[0])<1e-3&&Math.abs(z[1]-q[1])<1e-3))L.push(q);break}}}
    const ks=Object.keys(parts);if(!ks.length)return;
    const hl={id:Date.now()+Math.random(),color,text,note:'',parts,page:Math.min(...ks.map(Number)),at:new Date().toISOString()};
    this.hls[this.key].push(hl);s.removeAllRanges();this.hideSel();ks.forEach(i=>this.drawHL(+i));this.changedHL();this.toast('Highlight saved')}
  drawHL(i){const L=this.pg[i]&&this.pg[i].querySelector('.hlL');if(!L)return;L.innerHTML='';
    (this.hls[this.key]||[]).forEach(h=>(h.parts[i]||[]).forEach(q=>{const e=document.createElement('i');e.dataset.id=h.id;Object.assign(e.style,{left:q[0]*100+'%',top:q[1]*100+'%',width:q[2]*100+'%',height:q[3]*100+'%',background:HLC[h.color]});L.appendChild(e)}))}
  drawAllHL(){for(let i=1;i<=this.n;i++)this.drawHL(i)}
  delHL(id){const L=this.hls[this.key];const h=L.find(x=>x.id==id);if(!h)return;L.splice(L.indexOf(h),1);Object.keys(h.parts).forEach(i=>this.drawHL(+i));this.changedHL()}
  gotoHL(id){const h=(this.hls[this.key]||[]).find(x=>x.id==id);if(!h)return;const d=this.pg[h.page],q=h.parts[h.page][0];
    this.view.scrollTo({top:d.offsetTop+q[1]*d.offsetHeight-this.view.clientHeight/3,behavior:'smooth'});
    setTimeout(()=>{$$(`.hlL i[data-id="${h.id}"]`,this.rdr).forEach(e=>{e.classList.add('flash');setTimeout(()=>e.classList.remove('flash'),900)})},350)}
  noteChanged(){clearTimeout(this.nt);const k=this.key;this.nt=setTimeout(()=>this.o.saveHL&&!k.startsWith('file:')&&this.o.saveHL(k,this.hls[k]||[]),600)}
  changedHL(){if(this.o.saveHL&&!this.key.startsWith('file:'))this.o.saveHL(this.key,this.hls[this.key]||[]);if(this.tab==='hl')this.renderHLList();this.o.onHL&&this.o.onHL(this.hls[this.key]||[],this)}
  renderHLList(){if(this.tab!=='hl')return;const L=this.hls[this.key]||[];
    this.pane.innerHTML=L.length?L.map(h=>`<div class="rhl" data-id="${h.id}" style="border-color:${HLB[h.color]}">${ESC(h.text.slice(0,140))}${h.text.length>140?'…':''}<small>p. ${h.page}</small><button class="x" data-x="${h.id}">✕</button></div>`).join(''):'<div class="rmsg">Select text in the PDF, then pick a colour to highlight it.</div>';
    $$('.rhl',this.pane).forEach(e=>e.onclick=ev=>{if(ev.target.dataset.x)this.delHL(ev.target.dataset.x);else this.gotoHL(e.dataset.id)})}
  active(){return this.rdr.offsetParent!==null}
  onKey(e){const mod=e.metaKey||e.ctrlKey,k=e.key,inp=/INPUT|TEXTAREA/.test(e.target.tagName);
    if(mod&&k.toLowerCase()==='f'&&this.pdf){e.preventDefault();e.stopPropagation();this.openSearch();return}
    if(k==='Escape'){if(this.$('.rsearch.on')){this.closeSearch();e.stopPropagation()}else if(this.$('.rsel.on')){this.hideSel();e.stopPropagation()}return}
    if(!this.pdf)return;
    if(mod&&(k==='='||k==='+')){e.preventDefault();this.act('zin');return}
    if(mod&&k==='-'){e.preventDefault();this.act('zout');return}
    if(mod&&k==='0'){e.preventDefault();this.act('fitw');return}
    if(inp||mod)return;
    if(k==='ArrowRight'){e.preventDefault();this.act('next')}else if(k==='ArrowLeft'){e.preventDefault();this.act('prev')}
    else if(k==='Home'){e.preventDefault();this.goto(1)}else if(k==='End'){e.preventDefault();this.goto(this.n)}}
}
document.addEventListener('keydown',e=>{const r=READERS.find(r=>r.active());if(r)r.onKey(e)},true);
