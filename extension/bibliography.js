const Bibliography = (() => {
  const clean = value => String(value || '').replace(/[ﬁﬂﬀﬃﬄ]/g, c => ({'ﬁ':'fi','ﬂ':'fl','ﬀ':'ff','ﬃ':'ffi','ﬄ':'ffl'}[c]))
    .replace(/([˘´`ˆ˜¨˚ˇ˝])\s?([A-Za-z])/g, (_, d, c) => c + ({'˘':'̆','´':'́','`':'̀','ˆ':'̂','˜':'̃','¨':'̈','˚':'̊','ˇ':'̌','˝':'̋'}[d]))
    .replace(/([A-Za-z])\s?([¸˛])/g, (_, c, d) => c + (d === '¸' ? '̧' : '̨')).normalize('NFC').replace(/\s+/g,' ').trim();
  const HEADING = /^(?:\d+[.\s]+)?(?:references|bibliography|références|bibliographie|literatur|literature cited)\s*[:.]?$/i;
  const LABEL = /^\s*\[([^\]]{1,40})\]\s*(.*)$/;
  const NUMBER = /^\s*(\d{1,4})[.)]\s+(.*)$/;
  const CONTACT = /^(?:d[ée]partement de|department of|email(?: address)?\s*:|e-mail\s*:)/i;
  const END = /^(?:appendix|appendices|acknowledg(?:e)?ments?|author information|supporting information)\b/i;
  function lines(tc, width = 612) {
    const rows = [];
    for (const item of tc.items || []) {
      if (!clean(item.str) || !item.transform) continue;
      const x = item.transform[4], y = item.transform[5], h = Math.hypot(item.transform[2],item.transform[3]) || 10;
      let row = rows.find(r => Math.abs(r.y-y) < Math.min(2.2,h*.22));
      if (!row) rows.push(row = {y,parts:[]});
      row.parts.push({x,x2:x+(item.width || 0),y,h,s:item.str});
    }
    rows.sort((a,b)=>b.y-a.y); rows.forEach(r=>r.parts.sort((a,b)=>a.x-b.x));
    const gaps = r => r.parts.slice(1).map((p,i)=>[r.parts[i].x2,p.x]).filter(([l,g])=>g-l > Math.max(4,width*.009) && (l+g)/2 > width*.38 && (l+g)/2 < width*.64);
    const full = rows.filter(r => r.parts.length > 1 && Math.max(...r.parts.map(p=>p.x2)) - r.parts[0].x > width*.5);
    let cut = null, best = 0;
    for (const m of [...new Set(full.flatMap(r=>gaps(r).map(([l,g])=>Math.round((l+g)/2))))]) {
      const n = full.filter(r=>gaps(r).some(([l,g])=>l < m-1 && g > m+1)).length;
      if (n > best) { best = n; cut = m; }
    }
    if (best < Math.max(3, full.length*.3)) cut = null;
    const make = parts => ({x:parts[0].x,x2:Math.max(...parts.map(p=>p.x2)),y:parts[0].y,top:Math.max(...parts.map(p=>p.y+p.h)),bottom:Math.min(...parts.map(p=>p.y-p.h*.25)),text:clean(parts.map(p=>p.s).join(' '))});
    if (cut == null) return rows.map(r=>make(r.parts));
    const left=[],right=[];
    for(const row of rows) for(const [out,parts] of [[left,row.parts.filter(p=>p.x<cut)],[right,row.parts.filter(p=>p.x>=cut)]]) if(parts.length)out.push({...make(parts),column:out===left?0:1});
    return [...left,...right];
  }
  function parse(all) {
    const entries = new Map(), duplicate = new Set();
    const re = all.filter(l=>LABEL.test(l.text)).length >= all.filter(l=>NUMBER.test(l.text)).length ? LABEL : NUMBER;
    let current=null;
    for (const line of all) {
      const text=clean(line.text);
      if (!text || HEADING.test(text) || /^\d{1,4}$/.test(text)) continue;
      if (END.test(text) || CONTACT.test(text)) break;
      if (/^(?:\d+\s+)?[A-Z][A-Z\s.,'’&–—-]{7,}(?:\s+\d+)?$/.test(text) && !/\b(?:18|19|20)\d\d\b/.test(text)) continue;
      const match=text.match(re);
      if (match) {
        const label=match[1].replace(/\s+/g,'');
        if (entries.has(label) || duplicate.has(label)) {entries.delete(label);duplicate.add(label);current=null;continue;}
        current={label,text:match[2],page:line.page,rows:[line]};entries.set(label,current);
      } else if (current && current.text.length < 5000) {
        current.text = /[\p{L}]-$/u.test(current.text) && /^[\p{L}]/u.test(text) ? current.text.slice(0,-1)+text : current.text+' '+text;
        current.rows.push(line);
      }
    }
    return {entries,duplicate};
  }
  function labels(text, entries) {
    const out=[]; const add=s=>{if(entries.has(s) && !out.includes(s))out.push(s);};
    const groups=[...String(text || '').matchAll(/\[([^\]]{1,100})\]/g)].map(m=>m[1]);
    if (!groups.length) groups.push(String(text || '').trim().replace(/^\[|\]$/g,''));
    for(const group of groups)for(const part of group.split(/[,;]/)){
      const p=part.trim(),range=p.match(/^(\d+)\s*[–−-]\s*(\d+)$/);
      if(range){for(let i=+range[1];i<=+range[2] && i-(+range[1])<30;i++)add(String(i));} else add(p);
    }
    return out;
  }
  function at(entries, point) {
    if (!point || point.top == null) return null;
    const candidates=[];
    for (const entry of entries.values()) {
      const rows=entry.rows.filter(r=>r.page===point.page);if(!rows.length)continue;
      const left=Math.min(...rows.map(r=>r.x)),right=Math.max(...rows.map(r=>r.x2)),top=Math.max(...rows.map(r=>r.top))+3,bottom=Math.min(...rows.map(r=>r.bottom))-2;
      if(point.top>top || point.top<bottom)continue;
      if(point.left!=null && (point.left<left-24 || point.left>right+24))continue;
      candidates.push(entry);
    }
    return candidates.length===1 ? candidates[0] : null;
  }
  class Index {
    constructor(reader){this.reader=reader;this.pdf=null;this.entries=new Map();this.duplicate=new Set();this.start=0;}
    async page(pdf,i){const pg=await pdf.getPage(i),tc=await pg.getTextContent();return lines(tc,pg.getViewport({scale:1}).width).filter(l=>l.bottom>20).map(l=>({...l,page:i}));}
    async build({fresh=false}={}) {
      const R=this.reader,pdf=R.pdf,generation=R.gen;
      if(!pdf)return new Map();
      if(!fresh && this.pdf===pdf && this.ready)return this.entries;
      const all=[], pages=new Map();let start=null;
      for(let i=pdf.numPages;i>=1;i--){const page=await this.page(pdf,i);pages.set(i,page);const k=page.findIndex(l=>HEADING.test(l.text));if(k>=0){start={page:i,k};break;}}
      if(start)for(let i=start.page;i<=pdf.numPages;i++){const page=pages.get(i)||await this.page(pdf,i);all.push(...(i===start.page?page.slice(start.k+1):page));}
      const result=parse(all);
      if(R.pdf!==pdf || R.gen!==generation)throw new Error('The PDF changed; click the reference again');
      this.pdf=pdf;this.entries=result.entries;this.duplicate=result.duplicate;this.start=start?.page || 0;this.ready=true;
      return this.entries;
    }
    async point(dest) {
      try{const pdf=this.reader.pdf;let d=dest;if(typeof d==='string')d=await pdf.getDestination(d);if(!Array.isArray(d))return null;const type=d[1]?.name;
        return {page:(d[0] && typeof d[0]==='object'?await pdf.getPageIndex(d[0]):d[0])+1,top:type==='XYZ'?d[3]:/^(FitH|FitBH)$/.test(type||'')?d[2]:type==='FitR'?d[5]:null,left:type==='XYZ'?d[2]:type==='FitR'?d[2]:null};
      }catch{return null;}
    }
    async resolve(dest,{printed='',fresh=true}={}) {
      const pdf=this.reader.pdf,generation=this.reader.gen;
      if(typeof dest==='string' && /^(?:section|subsection|theorem|lemma|equation|remark|definition|figure|table|page)[.:]/i.test(dest)) return [];
      const entries=await this.build({fresh}),point=await this.point(dest);
      if(pdf!==this.reader.pdf || generation!==this.reader.gen) throw new Error('The PDF changed; click the reference again');
      if(point && this.start && point.page<this.start && !/^cite[.:]/i.test(String(dest)))return [];
      const hit=at(entries,point),selected=labels(printed,entries);
      if(selected.length)return selected.map(label=>({...entries.get(label),selection:'Printed citation label',warning:hit && !selected.includes(hit.label)?'The PDF link points to another entry; the printed citation label is used.':''}));
      if (/^\s*(?:\[[^\]]+\]|[A-Za-z+_-]*\d+[A-Za-z]?)\s*$/.test(printed || '') && !selected.length) return [];
      const name=typeof dest==='string'?dest.replace(/^cite[.:]/i,''):'';
      if(/^cite[.:]/i.test(String(dest)) && entries.has(name))return [{...entries.get(name),selection:'Named citation label'}];
      if(hit)return [{...hit,selection:'Destination inside this bibliography entry'}];
      return [];
    }
  }
  return {Index,clean,lines,parse,labels,at};
})();
if(typeof module!=='undefined')module.exports=Bibliography;
