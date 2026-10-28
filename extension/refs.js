const Ref = (() => {
  const norm = s => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
  const STOP=new Set('the of and in on for a an to with by from at its is are as via de la le les des du et sur une un'.split(' '));
  const words=s=>norm(s).split(' ').filter(w=>w.length>2&&!STOP.has(w));
  const hash=s=>String(s || '');
  const dehyph=s=>String(s || '').replace(/(\p{L})-\s+(\p{L})/gu,'$1$2').replace(/[ﬁﬂ]/g,c=>c==='ﬁ'?'fi':'fl');
  function cleanDoi(value){let d=String(value || '').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').trim().replace(/[.,;:]+$/,'');while(d.endsWith(')')&&(d.match(/\)/g)||[]).length>(d.match(/\(/g)||[]).length)d=d.slice(0,-1);return d;}
  function ids(text) {
    let t=String(text || '');try{t=decodeURIComponent(t);}catch{}
    t=t.replace(/\s+/g,' ');
    let doi=cleanDoi((t.match(/\b10\.\d{4,9}\/[^\s,;"<>?#&]+/i)||[])[0]);
    if (/^https?:/i.test(t)) doi=doi.replace(/\.pdf$/i,'');
    const arxiv=((t.match(/(?:arxiv\s*:\s*(?:preprint\s*)?(?:arxiv:)?\s*|(?<![\w.-])(?:export\.)?arxiv\.org\/(?:abs|pdf)\/|10\.48550\/arxiv\.)(\d{4}\.\d{4,5}|[a-z-]+(?:\.[a-z]{2})?\/\d{7})(?:v\d+)?/i)||[])[1]||'');
    return {doi,arxiv,years:(t.match(/\b(?:18|19|20)\d\d\b/g)||[]).map(Number)};
  }
  function tokens(text){const out=[];const raw=dehyph(text).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const re=/([\p{L}\p{N}]+)|([^\p{L}\p{N}\s]+)/gu;let match,before='';while((match=re.exec(raw))){if(match[2]){before+=match[2];continue;}out.push({w:match[1],before,punct:!!before});before='';}return out;}
  function titleIn(entry,title) {
    const E=tokens(entry),T=tokens(title).map(t=>t.w);if(!T.length)return {ratio:0,start:false,end:false};
    for(let i=0;i+T.length<=E.length;i++){
      if(!T.every((w,j)=>E[i+j].w===w))continue;
      const next=E[i+T.length],start=i===0||E[i].punct;
      const continuation=next && (/^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)$/i.test(next.w)||/[:–—]/.test(next.before));
      const end=!next||!continuation&&(next.punct||/^\d{4}$/.test(next.w));
      if(start&&end)return {ratio:1,start:true,end:true};
    }
    return {ratio:0,start:false,end:false};
  }
  function authorsIn(entry,c){const text=' '+norm(entry)+' ';const families=(c.authors||[]).map(a=>norm(a.family||a.name||'')).filter(Boolean);const hit=families.filter(f=>text.includes(' '+f+' ')).length;return {first:!!families[0]&&text.includes(' '+families[0]+' '),share:families.length?hit/families.length:0,etal:/\bet\s+al\b/i.test(entry)};}
  function score(entry,c,src){const title=titleIn(entry,c.title),author=authorsIn(entry,c),years=ids(entry).years;const yearOk=!years.length||!!c.year&&years.some(y=>Math.abs(y-c.year)<=1);const authorOk=author.first&&(author.share===1||author.etal);const strong=title.ratio===1&&authorOk&&yearOk;return {s:strong?1:0,titleScore:title.ratio,start:title.start,end:title.end,author:authorOk,year:yearOk&&years.length>0,strong};}
  const linkedTitle = (a,b,linked=false) => sameTitle(a,b) || !!linked && ((/ i$/.test(norm(a)) && !/ (?:i|ii|iii|iv|v)$/.test(norm(b)) && norm(a).replace(/ i$/,'')===norm(b)) || (/ i$/.test(norm(b)) && !/ (?:i|ii|iii|iv|v)$/.test(norm(a)) && norm(b).replace(/ i$/,'')===norm(a)));
  const sameTitle=(a,b)=>!!norm(a)&&norm(dehyph(a))===norm(dehyph(b));
  function sameWork(a,b){if(a.doi&&b.doi)return cleanDoi(a.doi).toLowerCase()===cleanDoi(b.doi).toLowerCase();if(a.arxiv&&b.arxiv)return a.arxiv.replace(/v\d+$/,'')===b.arxiv.replace(/v\d+$/,'');return sameTitle(a.title,b.title)&&norm(a.authors?.[0]?.family)===norm(b.authors?.[0]?.family)&&a.year===b.year;}
  async function request(url,json=false){const c=new AbortController(),timer=setTimeout(()=>c.abort(),14000);try{const r=await fetch(url,{signal:c.signal,cache:'no-store',credentials:'omit',headers:json?{Accept:'application/json'}:{}});if(!r.ok)throw new Error('HTTP '+r.status);return json?await r.json():await r.text();}finally{clearTimeout(timer);}}
  const J=url=>request(url,true),X=url=>request(url);
  const fromCrossref=it=>({title:(it?.title?.[0]||'').replace(/<[^>]+>/g,'').trim(),authors:(it?.author||[]).map(a=>({given:a.given||'',family:a.family||a.name||''})),venue:it?.['container-title']?.[0]||'',year:(it?.issued||it?.['published-print']||it?.['published-online'])?.['date-parts']?.[0]?.[0]||0,volume:it?.volume||'',issue:it?.issue||'',pages:it?.page||'',doi:it?.DOI||'',url:it?.URL||(it?.DOI?'https://doi.org/'+it.DOI:'')});
  function fromArxiv(xml){const d=new DOMParser().parseFromString(xml,'text/xml');if(d.querySelector('parsererror'))throw new Error('Invalid arXiv response');return [...d.getElementsByTagNameNS('http://www.w3.org/2005/Atom','entry')].map(en=>{const g=tag=>(en.getElementsByTagNameNS('http://www.w3.org/2005/Atom',tag)[0]?.textContent||'').trim();const id=ids(g('id')).arxiv;return {title:g('title').replace(/\s+/g,' '),authors:[...en.getElementsByTagNameNS('http://www.w3.org/2005/Atom','name')].map(n=>{const p=n.textContent.trim().split(' ');return {family:p.pop(),given:p.join(' ')};}),venue:'arXiv preprint',year:+g('published').slice(0,4)||0,arxiv:id,doi:cleanDoi(en.getElementsByTagNameNS('http://arxiv.org/schemas/atom','doi')[0]?.textContent),url:id?'https://arxiv.org/abs/'+id:'',pdf:id?'https://arxiv.org/pdf/'+id:''};}).filter(c=>c.arxiv&&c.title);}
  let queue=Promise.resolve(),lastArxiv=0;
  function queryArxiv(params){const run=queue.catch(()=>{}).then(async()=>{await new Promise(r=>setTimeout(r,Math.max(0,3100-(Date.now()-lastArxiv))));lastArxiv=Date.now();return fromArxiv(await X('https://export.arxiv.org/api/query?'+new URLSearchParams({...params,max_results:'5'})));});queue=run;return run;}
  async function byDoi(doi){const j=await J('https://api.crossref.org/works/'+encodeURIComponent(doi));const c=fromCrossref(j.message);if(cleanDoi(c.doi).toLowerCase()!==cleanDoi(doi).toLowerCase())throw new Error('DOI response mismatch');return c;}
  async function byArxiv(id){const list=await queryArxiv({id_list:id});const c=list.find(c=>c.arxiv.toLowerCase()===id.replace(/v\d+$/,'').toLowerCase());if(!c)throw new Error('arXiv response mismatch');return c;}
  async function searchCrossref(entry){const j=await J('https://api.crossref.org/works?rows=8&select=DOI,title,author,issued,container-title,volume,issue,page,URL,publisher&query.bibliographic='+encodeURIComponent(entry.slice(0,600)));return (j.message?.items||[]).map(fromCrossref);}
  async function searchArxiv(entry, crossref = []) {
    const seed = crossref.find(c => authorsIn(entry, c).first);
    const quoted = entry.match(/[“"]([^”"]{12,400})[”"]/);
    const sentence = entry.split(/\.\s+/).filter(s => words(s).length >= 3).sort((a,b) => words(b).length-words(a).length)[0];
    const title = seed?.title || quoted?.[1] || sentence || entry;
    const w = [...new Set(words(title).filter(w => !/^\d+$/.test(w)))].sort((a,b) => b.length-a.length).slice(0,7);
    if (w.length < 2) return [];
    const family = seed?.authors?.[0]?.family;
    return queryArxiv({search_query:w.map(w=>'ti:'+w).join(' AND ')+(family?' AND au:'+norm(family):'')});
  }
  async function enrich(rec){const key=rec.doi?'DOI:'+rec.doi:rec.arxiv?'arXiv:'+rec.arxiv:'';if(!key)return rec;try{const j=await J('https://api.semanticscholar.org/graph/v1/paper/'+encodeURIComponent(key)+'?fields=title,externalIds,openAccessPdf,citationCount,url');const ex=j.externalIds||{};if(!sameTitle(j.title,rec.title))return rec;if(rec.doi&&ex.DOI&&cleanDoi(ex.DOI).toLowerCase()!==cleanDoi(rec.doi).toLowerCase())return rec;if(rec.arxiv&&ex.ArXiv&&rec.arxiv!==ex.ArXiv)return rec;if(!(rec.doi&&ex.DOI || rec.arxiv&&ex.ArXiv))return rec;rec.citations=j.citationCount;rec.s2=j.url||'';rec.s2id=j.paperId||'';if(!rec.pdf && j.openAccessPdf?.url && /^https?:/.test(j.openAccessPdf.url))rec.pdf=j.openAccessPdf.url;}catch{}return rec;}
  const pending=new Map();
  async function resolve(entry,opts={}) {
    entry=String(entry||'').replace(/\s+/g,' ').trim();
    if(!entry)return {status:'none',entry,how:'No reference text'};
    if(pending.has(entry))return pending.get(entry);
    const job=(async()=>{
      const id=ids(entry),none=how=>({status:'none',entry,how});let exact=null;
      const identifierOnly=words(entry.replace(id.doi,'').replace(id.arxiv,'').replace(/https?:\/\/doi.org\//gi,'').replace(/arxiv\s*:/gi,'')).length<2;
      try{if(id.doi&&!/^10\.48550\/arxiv\./i.test(id.doi))exact=await byDoi(id.doi);else if(id.arxiv)exact=await byArxiv(id.arxiv);}catch{}
      if(exact){if(identifierOnly||score(entry,exact,'identifier').strong)return {...await enrich(exact),status:'verified',entry,how:'Exact identifier and reference text checked live'};return none('Identifier metadata conflicts with the printed reference; original text retained');}
      const candidates=[];
      try{candidates.push(...await searchCrossref(entry));}catch{}
      let strong=candidates.filter(c=>score(entry,c,'Crossref').strong);
      if(!strong.length){try{candidates.push(...await searchArxiv(entry,candidates));}catch{}strong=candidates.filter(c=>score(entry,c,'arXiv').strong || c.arxiv && c.doi && candidates.some(j=>!j.arxiv && j.doi && cleanDoi(j.doi).toLowerCase()===cleanDoi(c.doi).toLowerCase() && score(entry,{...c,year:j.year},'journal-year').strong));}
      const unique=[];for(const c of strong)if(!unique.some(x=>sameWork(x,c)))unique.push(c);
      if(unique.length!==1)return none(unique.length?'Several matching records; no article selected':'No exact title/author match; original text retained');
      return {...await enrich(unique[0]),status:'verified',entry,how:'Full ordered title, authors and available year checked live'};
    })().finally(()=>pending.delete(entry));pending.set(entry,job);return job;
  }
  const AXID=/(?<![\w.-])arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5}|[a-z-]+(?:\.[a-z]{2})?\/\d{7})/i;
  const famOf=rec=>norm(rec.authors?.[0]?.family||'');
  async function arxivOf(rec){
    const proposals=[];if(rec.arxiv)proposals.push(rec.arxiv);
    if(!proposals.length && rec.doi)try{const w=await J('https://api.openalex.org/works/doi:'+encodeURIComponent(rec.doi)+'?select=title,doi,locations');if(sameTitle(w.title,rec.title)&&cleanDoi(w.doi).toLowerCase()===cleanDoi(rec.doi).toLowerCase())for(const l of w.locations||[]){const id=((l.landing_page_url||'')+' '+(l.pdf_url||'')).match(AXID)?.[1];if(id)proposals.push(id);}}catch{}
    if(!proposals.length && rec.doi)try{const j=await J('https://api.semanticscholar.org/graph/v1/paper/DOI:'+encodeURIComponent(rec.doi)+'?fields=title,externalIds');if(cleanDoi(j.externalIds?.DOI).toLowerCase()===cleanDoi(rec.doi).toLowerCase() && linkedTitle(j.title,rec.title,true) && j.externalIds?.ArXiv)proposals.push(j.externalIds.ArXiv);}catch{}
    const valid=c=>linkedTitle(c.title,rec.title,rec.doi&&c.doi&&cleanDoi(rec.doi).toLowerCase()===cleanDoi(c.doi).toLowerCase())&&!!famOf(rec)&&(c.authors||[]).some(a=>norm(a.family)===famOf(rec))&&(!rec.doi||!c.doi||cleanDoi(rec.doi).toLowerCase()===cleanDoi(c.doi).toLowerCase());
    for(const id of [...new Set(proposals)])try{const c=await byArxiv(id);if(valid(c))return c.arxiv;}catch{}
    if(rec.title)try{const w=words(rec.title).slice(0,7);const list=await queryArxiv({search_query:w.map(w=>'ti:'+w).join(' AND ')+(famOf(rec)?' AND au:'+famOf(rec):'')});const hits=list.filter(valid);if(hits.length===1)return hits[0].arxiv;}catch{}
    return '';
  }
  async function sources(rec){if(!rec||rec.status!=='verified')return [];const out=[];if(rec.pdf&&!/arxiv\.org/i.test(rec.pdf))out.push({url:rec.pdf,kind:'journal'});const ax=await arxivOf(rec);if(ax)out.push({url:'https://arxiv.org/pdf/'+ax,kind:'arxiv',id:ax});return out;}
  async function bibtex(rec){if(rec.status&&rec.status!=='verified')throw new Error('Reference not verified');if(rec.doi){for(const url of ['https://api.crossref.org/works/'+encodeURIComponent(rec.doi)+'/transform/application/x-bibtex'])try{const bib=await X(url);if(/^\s*@\w+\s*[{(]/.test(bib))return bib.trim();}catch{}}
    const esc=s=>String(s||'').replace(/[\\{}%&#_$]/g,c=>'\\'+c);const key=norm(rec.authors?.[0]?.family||'anon').replace(/\s/g,'')+(rec.year||'');const fields=[['title',rec.title],['author',(rec.authors||[]).map(a=>(a.family+(a.given?', '+a.given:''))).join(' and ')],['journal',rec.venue],['year',rec.year],['volume',rec.volume],['pages',rec.pages],['doi',rec.doi],['eprint',rec.arxiv],['archivePrefix',rec.arxiv?'arXiv':''],['url',rec.url]].filter(x=>x[1]);return `@${rec.venue&&rec.venue!=='arXiv preprint'?'article':'misc'}{${key},\n`+fields.map(([k,v])=>'  '+k+' = {'+esc(v)+'}').join(',\n')+'\n}';
  }
  const authorsShort=a=>!a?.length?'':a.length<=3?a.map(a=>a.family).join(', '):a[0].family+' et al.';
  return {resolve,cached:async()=>null,ids,score,titleIn,authorsIn,bibtex,arxivOf,sources,sameTitle,authorsShort,norm,words,hash,_fromCrossref:fromCrossref,_fromArxiv:fromArxiv};
})();
if(typeof module!=='undefined')module.exports=Ref;
