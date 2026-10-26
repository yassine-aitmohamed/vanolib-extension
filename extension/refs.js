const Ref = (() => {
  const mem = new Map();
  const hasStore = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  const TTL = 1000 * 60 * 60 * 24 * 60;

  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  const STOP = new Set('the of and in on for a an to with by from at its is are as via de la le les des du et sur une un'.split(' '));
  const words = s => norm(s).split(' ').filter(w => w.length > 2 && !STOP.has(w));
  function hash(s) { let h = 2166136261; for (const c of norm(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

  function ids(text) {
    const t = String(text || '').replace(/\s+/g, ' ');
    const doi = ((t.match(/\b(10\.\d{4,9}\/[^\s,;"<>]+)/) || [])[1] || '').replace(/[.)\]]+$/, '');
    const arxiv = ((t.match(/arXiv[:\s]*(?:preprint\s*)?(?:arXiv:)?\s*([0-9]{4}\.[0-9]{4,5}|[a-z\-]+(?:\.[A-Z]{2})?\/[0-9]{7})/i) ||
                   t.match(/arxiv\.org\/(?:abs|pdf)\/([0-9]{4}\.[0-9]{4,5}|[a-z\-]+\/[0-9]{7})/i) || [])[1] || '').replace(/v\d+$/, '');
    const years = (t.match(/\b(1[89]\d\d|20\d\d)\b/g) || []).map(Number);
    return { doi, arxiv, years };
  }

  function score(entry, c) {
    const E = ' ' + norm(entry) + ' ';
    const tw = words(c.title);
    if (!tw.length) return { s: 0 };
    const found = tw.filter(w => E.includes(' ' + w + ' ') || E.includes(' ' + w)).length;
    const titleScore = found / tw.length;
    const fam = c.authors && c.authors[0] && norm(c.authors[0].family || '').split(' ').pop();
    const author = !!fam && fam.length > 1 && E.includes(' ' + fam);
    const { years } = ids(entry);
    const year = !!c.year && years.some(y => Math.abs(y - c.year) <= 1);
    return { s: titleScore * 0.6 + (author ? 0.25 : 0) + (year ? 0.15 : 0), titleScore, author, year };
  }

  async function J(url) {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  async function X(url) { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }

  const fromCrossref = it => ({
    title: (it.title && it.title[0] || '').replace(/<[^>]+>/g, '').trim(),
    authors: (it.author || []).map(a => ({ given: a.given || '', family: a.family || a.name || '' })),
    venue: (it['container-title'] && it['container-title'][0]) || (it.publisher === 'arXiv' ? 'arXiv' : '') || '',
    year: ((it.issued || it['published-print'] || it['published-online'] || {})['date-parts'] || [[0]])[0][0] || 0,
    volume: it.volume || '', pages: it.page || '',
    doi: it.DOI || '', url: it.URL || (it.DOI ? 'https://doi.org/' + it.DOI : '')
  });
  function fromArxiv(xml) {
    const d = new DOMParser().parseFromString(xml, 'text/xml');
    return [...d.querySelectorAll('entry')].map(en => {
      const g = k => ((en.querySelector(k) || {}).textContent || '').trim();
      const id = (g('id').match(/abs\/(.+?)(v\d+)?$/) || [])[1] || '';
      const doiEl = [...en.children].find(n => n.localName === 'doi');
      const jrEl = [...en.children].find(n => n.localName === 'journal_ref');
      return {
        title: g('title').replace(/\s+/g, ' '),
        authors: [...en.querySelectorAll('author > name')].map(n => { const p = n.textContent.trim().split(' '); return { family: p.pop(), given: p.join(' ') }; }),
        venue: jrEl ? jrEl.textContent.trim() : 'arXiv preprint', year: +g('published').slice(0, 4) || 0,
        arxiv: id, doi: doiEl ? doiEl.textContent.trim() : '', url: id ? 'https://arxiv.org/abs/' + id : '', pdf: id ? 'https://arxiv.org/pdf/' + id : ''
      };
    }).filter(x => x.title && x.title !== 'Error');
  }

  async function byDoi(doi) { const j = await J('https://api.crossref.org/works/' + encodeURIComponent(doi)); return fromCrossref(j.message); }
  async function byArxiv(id) { return fromArxiv(await X('https://export.arxiv.org/api/query?id_list=' + encodeURIComponent(id)))[0]; }
  async function searchCrossref(entry) {
    const q = entry.replace(/\s+/g, ' ').replace(/^[^A-Za-zÀ-ÿ]*/, '').slice(0, 300);
    const j = await J('https://api.crossref.org/works?rows=5&select=DOI,title,author,issued,container-title,volume,page,URL,publisher&query.bibliographic=' + encodeURIComponent(q));
    return ((j.message && j.message.items) || []).map(fromCrossref);
  }
  async function searchArxiv(entry) {
    const w = words(entry).filter(x => !/^\d+$/.test(x)).slice(0, 10);
    if (w.length < 3) return [];
    return fromArxiv(await X('https://export.arxiv.org/api/query?max_results=5&search_query=' + encodeURIComponent(w.map(x => 'all:' + x).join(' AND '))));
  }
  async function enrich(rec) {
    const key = rec.doi ? 'DOI:' + rec.doi : rec.arxiv ? 'arXiv:' + rec.arxiv : '';
    if (!key) return rec;
    try {
      const j = await J('https://api.semanticscholar.org/graph/v1/paper/' + encodeURIComponent(key) + '?fields=title,externalIds,openAccessPdf,citationCount,url');
      if (j.title && rec.title) {
        const a = words(j.title), b = new Set(words(rec.title));
        if (!a.length || a.filter(w => b.has(w)).length / a.length < 0.7) return rec;
      }
      const ex = j.externalIds || {};
      rec.arxiv = rec.arxiv || ex.ArXiv || '';
      rec.doi = rec.doi || ex.DOI || '';
      rec.pdf = rec.pdf || (rec.arxiv ? 'https://arxiv.org/pdf/' + rec.arxiv : (j.openAccessPdf && j.openAccessPdf.url) || '');
      rec.citations = j.citationCount;
      rec.s2 = j.url || '';
      rec.s2id = j.paperId || '';
    } catch (e) {}
    if (rec.arxiv && !rec.pdf) rec.pdf = 'https://arxiv.org/pdf/' + rec.arxiv;
    return rec;
  }

  async function cacheGet(k) {
    if (mem.has(k)) return mem.get(k);
    if (!hasStore) return null;
    const o = (await chrome.storage.local.get('ref:' + k))['ref:' + k];
    if (o && Date.now() - o.at < TTL) { mem.set(k, o); return o; }
    return null;
  }
  function cachePut(k, v) { v.at = Date.now(); mem.set(k, v); if (hasStore) chrome.storage.local.set({ ['ref:' + k]: v }); }

  const pending = new Map();
  async function resolve(entry, opts = {}) {
    const k = hash(entry);
    if (!opts.force) { const c = await cacheGet(k); if (c) return c; }
    if (pending.has(k)) return pending.get(k);
    const p = (async () => {
      const id = ids(entry);
      let rec = null, how = '', status = 'none';
      try {
        if (id.doi) { rec = await byDoi(id.doi); how = 'DOI in the reference'; status = 'verified'; }
      } catch (e) {}
      try {
        if (!rec && id.arxiv) { rec = await byArxiv(id.arxiv); if (rec) { how = 'arXiv id in the reference'; status = 'verified'; } }
      } catch (e) {}
      if (!rec) {
        let best = null;
        const consider = (list, src) => list.forEach(c => { const sc = score(entry, c); if (!best || sc.s > best.sc.s) best = { c, sc, src }; });
        try { consider(await searchCrossref(entry), 'Crossref'); } catch (e) {}
        if (!best || best.sc.s < 0.85) { try { consider(await searchArxiv(entry), 'arXiv'); } catch (e) {} }
        if (best) {
          const { titleScore, author, year } = best.sc;
          if (titleScore >= 0.8 && author && (year || !id.years.length)) status = 'verified';
          else if (titleScore >= 0.6 && (author || year)) status = 'likely';
          if (status !== 'none') { rec = best.c; how = best.src + ' match (title' + (author ? ', author' : '') + (year ? ', year' : '') + ')'; }
        }
      }
      if (rec) await enrich(rec);
      const out = Object.assign({ status, how, entry }, rec || {});
      if (status !== 'none' || !opts.noCacheMiss) cachePut(k, out);
      return out;
    })().finally(() => pending.delete(k));
    pending.set(k, p);
    return p;
  }

  async function bibtex(rec) {
    if (rec.doi) {
      try { const r = await fetch('https://api.crossref.org/works/' + encodeURIComponent(rec.doi) + '/transform/application/x-bibtex'); if (r.ok) return (await r.text()).trim(); } catch (e) {}
      try { const r = await fetch('https://doi.org/' + rec.doi, { headers: { Accept: 'application/x-bibtex' } }); if (r.ok) return (await r.text()).trim(); } catch (e) {}
    }
    const fam = norm((rec.authors && rec.authors[0] && rec.authors[0].family) || 'anon').split(' ').pop();
    const key = fam + (rec.year || '') + (words(rec.title)[0] || '');
    const f = [
      ['title', '{' + rec.title + '}'], ['author', (rec.authors || []).map(a => (a.family + (a.given ? ', ' + a.given : ''))).join(' and ')],
      ['journal', rec.venue && rec.venue !== 'arXiv preprint' ? rec.venue : ''], ['year', rec.year || ''], ['volume', rec.volume || ''], ['pages', rec.pages || ''],
      ['doi', rec.doi || ''], ['eprint', rec.arxiv || ''], ['archivePrefix', rec.arxiv ? 'arXiv' : ''], ['url', rec.url || '']
    ].filter(x => x[1]);
    return `@${rec.venue && rec.venue !== 'arXiv preprint' ? 'article' : 'misc'}{${key},\n` + f.map(([a, b]) => `  ${a} = {${String(b).replace(/^\{|\}$/g, '')}}`).join(',\n') + '\n}';
  }

  const authorsShort = a => !a || !a.length ? '' : a.length <= 3 ? a.map(x => x.family).join(', ') : a[0].family + ' et al.';
  const cached = entry => cacheGet(hash(entry));
  return { resolve, cached, ids, score, bibtex, authorsShort, norm, words, hash, _fromCrossref: fromCrossref, _fromArxiv: fromArxiv };
})();
