(() => {
  const _links = Reader.prototype.links;
  Reader.prototype.links = async function (i, page, vp) {
    await _links.call(this, i, page, vp);
    let an = []; try { an = await page.getAnnotations({ intent: 'display' }); } catch (e) {}
    const els = [...this.pg[i].querySelectorAll('.lnk a')];
    an.filter(a => a.subtype === 'Link' && a.rect && (a.url || a.dest)).forEach((a, k) => { if (els[k]) { els[k].__dest = a.dest; els[k].__page = i; } });
  };

})();

function makeCite(reader) {
  let R = null, refs = null, building = null, refStart = 0, builtKey = null, card = null, hideT = null, showT = null, pinned = false, curDest = null, backBtn = null;

  const DIA = { '˘': '̆', '¸': '̧', '´': '́', '`': '̀', 'ˆ': '̂', '˜': '̃', '¨': '̈', '˚': '̊', 'ˇ': '̌', '˝': '̋', '˛': '̨' };
  function fixAccents(t) {
    return t.replace(/([˘´`ˆ˜¨˚ˇ˝])\s?([A-Za-z])/g, (m, d, c) => c + DIA[d])
            .replace(/([A-Za-z])\s?([¸˛])/g, (m, c, d) => c + DIA[d]).normalize('NFC');
  }
  async function lines(i) {
    const tc = await R.text(i), rows = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const y = it.transform[5], x = it.transform[4];
      let row = rows.find(r => Math.abs(r.y - y) < 2.2);
      if (!row) { row = { y, parts: [] }; rows.push(row); }
      row.parts.push({ x, s: it.str });
    }
    rows.sort((a, b) => b.y - a.y);
    return rows.map(r => ({ y: r.y, x: Math.min(...r.parts.map(p => p.x)), text: fixAccents(r.parts.sort((a, b) => a.x - b.x).map(p => p.s).join(' ').replace(/\s+/g, ' ').trim()) }));
  }

  const LABEL = /^\s*\[([^\]]{1,14})\]\s*(.*)$/, NUM = /^\s*(\d{1,3})\.\s+(.*)$/;
  async function build() {
    if (!R.pdf) return {};
    if (builtKey !== R.key) { refs = null; building = null; refStart = 0; builtKey = R.key; }
    if (refs) return refs;
    if (building) return building;
    building = (async () => {
      const map = {}, n = R.n;
      let start = null;
      for (let i = n; i >= Math.max(1, n - 12) && !start; i--) {
        const L = await lines(i);
        const k = L.findIndex(l => /^\s*(\d+\.?\s*)?(references|bibliography|références|bibliographie|literatur|literature cited)\s*$/i.test(l.text));
        if (k >= 0) { start = { page: i, idx: k + 1 }; refStart = i; }
      }
      const all = [];
      if (start) for (let i = start.page; i <= n; i++) { const L = await lines(i); all.push(...(i === start.page ? L.slice(start.idx) : L)); }
      const lab = all.filter(l => LABEL.test(l.text)).length, num = all.filter(l => NUM.test(l.text)).length;
      const re = lab >= num ? LABEL : NUM;
      let cur = null;
      const RUNHEAD = /^(\d{1,4}\s+)?[A-Z][A-Z\s.,'’&–—-]{7,}(\s+\d{1,4})?$/;
      for (const l of all) {
        if (RUNHEAD.test(l.text) && !/\d{4}/.test(l.text) || /^\d{1,4}$/.test(l.text)) continue;
        const m = l.text.match(re);
        if (m) { cur = m[1].trim(); map[cur] = m[2]; }
        else if (cur && map[cur].length < 900) map[cur] += ' ' + l.text;
      }
      refs = map; return map;
    })();
    return building;
  }

  async function destPage(dest) {
    try { let d = dest; if (typeof d === 'string') d = await R.pdf.getDestination(d); if (!Array.isArray(d)) return 0;
      return ((typeof d[0] === 'object' && d[0]) ? await R.pdf.getPageIndex(d[0]) : d[0]) + 1; } catch (e) { return 0; }
  }
  async function fromDest(dest) {
    try {
      let d = dest; if (typeof d === 'string') d = await R.pdf.getDestination(d);
      if (!Array.isArray(d)) return '';
      const idx = (typeof d[0] === 'object' && d[0]) ? await R.pdf.getPageIndex(d[0]) : d[0];
      const top = d[1] && d[1].name === 'XYZ' ? d[3] : null;
      const L = await lines(idx + 1);
      let k = top == null ? 0 : L.findIndex(l => l.y <= top + 3);
      if (k < 0) k = 0;
      const out = [L[k] && L[k].text];
      for (let j = k + 1; j < L.length && out.length < 7; j++) {
        if (LABEL.test(L[j].text) || NUM.test(L[j].text)) break;
        out.push(L[j].text);
      }
      return out.filter(Boolean).join(' ');
    } catch (e) { return ''; }
  }

  const ESCH = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const readUrl = u => (typeof VL !== 'undefined' ? VL.viewer(u) : u);
  function refHTML(label, text, rec) {
    const t = text.replace(/\s+/g, ' ').trim();
    const id = (typeof Ref !== 'undefined') ? Ref.ids(t) : { doi: '', arxiv: '' };
    const doi = (rec && rec.doi) || id.doi, ax = (rec && rec.arxiv) || id.arxiv, pdf = rec && rec.pdf;
    const q = encodeURIComponent(((rec && rec.status !== 'none' && rec.title) || t.replace(/^[^A-Za-zÀ-ÿ]*/, '')).slice(0, 220));
    const open = doi ? 'https://doi.org/' + doi : ax ? 'https://arxiv.org/abs/' + ax : 'https://scholar.google.com/scholar?q=' + q;
    let head = '';
    if (rec === null) head = '<div class="vc-st vc-wait">Checking the reference…</div>';
    else if (rec && rec.status !== 'none') {
      const au = (rec.authors || []).map(a => ((a.given ? a.given.replace(/(\p{L})\p{L}*\.?/gu, '$1.').replace(/\s+/g, ' ') + ' ' : '') + a.family)).slice(0, 6).join(', ') + ((rec.authors || []).length > 6 ? ', …' : '');
      const venue = [rec.venue, rec.volume && 'vol. ' + rec.volume, rec.pages && 'pp. ' + rec.pages, rec.year].filter(Boolean).join(' · ');
      head = `<div class="vc-st ${rec.status === 'verified' ? 'vc-ok' : 'vc-maybe'}" title="${ESCH(rec.how || '')}">${rec.status === 'verified' ? '✓ Verified' : '≈ Probable match — check'}<span>${ESCH(rec.how || '')}</span>${rec.citations != null ? `<em>${rec.citations} citations</em>` : ''}</div>
        <div class="vc-ti">${ESCH(rec.title)}</div><div class="vc-au">${ESCH(au)}</div>${venue ? `<div class="vc-ve">${ESCH(venue)}</div>` : ''}`;
    } else if (rec) head = '<div class="vc-st vc-no">Not found in Crossref / arXiv — search links below</div>';
    return `<div class="vc-ref" data-key="${ESCH(t.slice(0, 80))}"><div class="vc-l">${label ? '[' + ESCH(label) + ']' : '↳'}</div>${head}
      <div class="vc-t${rec && rec.status !== 'none' ? ' vc-raw' : ''}">${ESCH(t)}</div>
      <div class="vc-a"><a class="vc-open" target="_blank" href="${ESCH(open)}">Open the paper ↗</a>
      ${pdf ? `<a target="_blank" href="${ESCH(pdf)}">PDF</a><a href="#" data-read="${ESCH(pdf)}">Read in VanoLib</a>` : ax ? `<a href="#" data-read="https://arxiv.org/pdf/${ESCH(ax)}">Read in VanoLib</a>` : ''}
      ${ax ? `<a target="_blank" href="https://arxiv.org/abs/${ESCH(ax)}">arXiv:${ESCH(ax)}</a>` : `<a target="_blank" href="https://arxiv.org/search/?searchtype=all&query=${q}">arXiv</a>`}
      ${doi ? `<a target="_blank" href="https://doi.org/${ESCH(doi)}">DOI</a>` : ''}
      <a target="_blank" href="https://zbmath.org/?q=${q}">zbMATH</a>
      <a target="_blank" href="https://scholar.google.com/scholar?q=${q}">Scholar</a>
      <a href="#" data-copy="1">Copy</a><a href="#" data-bib="1">BibTeX</a></div></div>`;
  }
  function wire(block, label, text, rec) {
    const t = text.replace(/\s+/g, ' ').trim();
    block.querySelectorAll('[data-copy]').forEach(a => a.onclick = e => { e.preventDefault(); navigator.clipboard.writeText(rec && rec.status !== 'none' ? `${Ref.authorsShort(rec.authors)}, ${rec.title}, ${[rec.venue, rec.year].filter(Boolean).join(' ')}${rec.doi ? ', doi:' + rec.doi : rec.arxiv ? ', arXiv:' + rec.arxiv : ''}` : t); a.textContent = 'Copied ✓'; });
    block.querySelectorAll('[data-bib]').forEach(a => a.onclick = e => { e.preventDefault(); Cite.bib(rec && rec.status !== 'none' ? { rec } : { text: t, doi: (Ref.ids(t).doi), arxiv: Ref.ids(t).arxiv }, a); });
    block.querySelectorAll('[data-read]').forEach(a => a.onclick = e => { e.preventDefault(); window.open(readUrl(a.dataset.read), '_blank'); });
  }
  let showGen = 0;
  function show(x, y, items, pin) {
    if (!items.length) return;
    pinned = !!pin;
    const gen = ++showGen;
    card = document.getElementById('vlCite');
    if (!card) { card = document.createElement('div'); card.id = 'vlCite'; }
    const host = document.fullscreenElement || document.body;
    if (card.parentNode !== host) host.appendChild(card);
    card.onmouseenter = () => clearTimeout(hideT); card.onmouseleave = () => { if (!pinned) hide(250); };
    const canResolve = typeof Ref !== 'undefined';
    card.innerHTML = items.map(({ label, text }) => refHTML(label, text, canResolve ? null : undefined)).join('');
    [...card.querySelectorAll('.vc-ref')].forEach((b, k) => wire(b, items[k].label, items[k].text, null));
    const stmts = items.map(it => it.loc && canResolve ? stmtBlock(it, pin) : null);
    stmts.filter(Boolean).reverse().forEach(b => card.insertBefore(b, card.firstChild));
    if (pin) {
      const bar = document.createElement('div'); bar.className = 'vc-bar';
      bar.innerHTML = (curDest ? '<a href="#" class="vc-go">Go to the reference list ↓</a>' : '<span></span>') + '<a href="#" class="vc-x">Close ✕</a>';
      card.appendChild(bar);
      const go = bar.querySelector('.vc-go');
      if (go) go.onclick = e => { e.preventDefault(); const d = curDest; hide(0); jumpWithBack(d); };
      bar.querySelector('.vc-x').onclick = e => { e.preventDefault(); hide(0); };
    }
    card.style.display = 'block';
    const w = Math.min(stmts.some(Boolean) ? 620 : 480, innerWidth - 20); card.style.width = w + 'px';
    card.classList.toggle('vc-wide', stmts.some(Boolean));
    const place = () => { const h = card.offsetHeight;
      card.style.left = Math.max(10, Math.min(x - w / 2, innerWidth - w - 10)) + 'px';
      card.style.top = (y + 18 + h < innerHeight ? y + 18 : Math.max(10, y - h - 12)) + 'px'; };
    place();
    if (canResolve) items.forEach(({ label, text }, k) => Ref.resolve(text).then(rec => {
      if (gen !== showGen || card.style.display !== 'block') return;
      const old = card.querySelectorAll('.vc-ref')[k]; if (!old) return;
      const tmp = document.createElement('div'); tmp.innerHTML = refHTML(label, text, rec);
      const nb = tmp.firstElementChild; old.replaceWith(nb); wire(nb, label, text, rec); place();
      if (stmts[k] && pin) fillStmt(stmts[k], items[k].loc, rec, w - 26, gen).then(place);
    }).catch(() => { if (stmts[k] && pin) fillStmt(stmts[k], items[k].loc, null, w - 26, gen).then(place); }));
  }
  function stmtBlock(it, pin) {
    const b = document.createElement('div'); b.className = 'vc-stmt';
    b.innerHTML = `<div class="vc-sh"><b>${ESCH(Loc.label(it.loc))}</b> <span>in [${ESCH(it.label)}]</span><i>${pin ? 'Finding the statement in the paper…' : 'Click the citation to see the statement'}</i></div><div class="vc-img"></div><div class="vc-sa"></div>`;
    return b;
  }
  async function fillStmt(b, loc, rec, width, gen) {
    const say = (msg, cls) => { const i = b.querySelector('.vc-sh i'); i.textContent = msg; i.className = cls || ''; };
    const name = Loc.label(loc);
    const pdf = rec && rec.status !== 'none' && rec.pdf || (rec && rec.arxiv ? 'https://arxiv.org/pdf/' + rec.arxiv : '');
    if (!pdf) { say('No open-access PDF of this paper was found (arXiv, open access). Open the paper to read ' + name + '.', 'vc-no'); return; }
    let res;
    try { res = await Loc.statement(pdf, loc); } catch (e) { if (gen === showGen) say('Could not open the PDF of the cited paper (' + (e.message || e) + ').', 'vc-no'); return; }
    if (gen !== showGen) return;
    const open = (page, top) => {
      const u = typeof VL !== 'undefined' ? VL.viewer(pdf) + '&page=' + page + (top ? '&top=' + Math.round(top) : '') : pdf + '#page=' + page;
      window.open(u, '_blank');
    };
    const sa = b.querySelector('.vc-sa');
    if (!res.found) {
      say(name + ' was not found in the ' + (/arxiv\.org/.test(pdf) ? 'arXiv version' : 'PDF') + ' of this paper (' + res.pages + ' pages). The numbering may differ from the cited version.', 'vc-no');
      sa.innerHTML = `<a href="#" data-o="1">Open the paper in VanoLib ↗</a>`;
      sa.querySelector('[data-o]').onclick = e => { e.preventDefault(); open(1); };
      return;
    }
    const arxivPdf = /arxiv\.org/.test(pdf), published = rec && rec.venue && !/arxiv/i.test(rec.venue);
    say('page ' + res.page + (res.segs.length > 1 ? '–' + res.segs[res.segs.length - 1].page : '') + (arxivPdf ? ' · arXiv version' : ''), 'vc-ok');
    const notes = [];
    if (res.mismatch) notes.push(`The paper calls it <b>${ESCH(res.as)}</b>, not ${ESCH(name)}.`);
    if (arxivPdf && published) notes.push('Read from the arXiv version: the published version may number it differently.');
    const img = b.querySelector('.vc-img');
    try {
      const cvs = await Loc.render(res, width);
      if (gen !== showGen) return;
      cvs.forEach(cv => { if (R.theme === 'night') cv.style.filter = 'invert(.92) hue-rotate(180deg)'; cv.title = 'Open the paper at page ' + cv.dataset.page; cv.onclick = () => open(+cv.dataset.page, res.top); img.appendChild(cv); });
    } catch (e) { img.textContent = res.text; }
    sa.innerHTML = (notes.length ? `<div class="vc-note">${notes.join(' ')}</div>` : '') +
      `<a href="#" data-o="1">Open at page ${res.page} ↗</a><a href="#" data-c="1">Copy text</a>`;
    sa.querySelector('[data-o]').onclick = e => { e.preventDefault(); open(res.page, res.top); };
    sa.querySelector('[data-c]').onclick = e => { e.preventDefault(); navigator.clipboard.writeText(res.text); e.target.textContent = 'Copied ✓'; };
  }

  async function peek(a, x, y) {
    try {
      let d = a.__dest; if (typeof d === 'string') d = await R.pdf.getDestination(d);
      if (!Array.isArray(d)) return;
      const idx = (typeof d[0] === 'object' && d[0]) ? await R.pdf.getPageIndex(d[0]) : d[0];
      const page = R.po[idx + 1]; if (!page) return;
      const top = d[1] && d[1].name === 'XYZ' ? d[3] : d[1] && (d[1].name === 'FitH' || d[1].name === 'FitBH') ? d[2] : null;
      const w = Math.min(520, innerWidth - 20), s = (w - 24) / page.getViewport({ scale: 1 }).width, dpr = Math.min(devicePixelRatio || 1, 2);
      const vp = page.getViewport({ scale: s * dpr }), full = document.createElement('canvas'); full.width = vp.width; full.height = vp.height;
      await page.render({ canvasContext: full.getContext('2d'), viewport: vp }).promise;
      const y0 = top == null ? 0 : Math.max(0, vp.convertToViewportPoint(0, top)[1] - 14 * dpr), h = Math.min(220 * dpr, full.height - y0);
      const cv = document.createElement('canvas'); cv.width = full.width; cv.height = h; cv.getContext('2d').drawImage(full, 0, y0, full.width, h, 0, 0, full.width, h);
      cv.style.width = (w - 24) + 'px'; cv.style.height = (h / dpr) + 'px';
      if (R.theme === 'night') cv.style.filter = 'invert(.92) hue-rotate(180deg)';
      card = document.getElementById('vlCite');
      if (!card) { card = document.createElement('div'); card.id = 'vlCite'; }
      const host = document.fullscreenElement || document.body; if (card.parentNode !== host) host.appendChild(card);
      card.onmouseenter = () => clearTimeout(hideT); card.onmouseleave = () => { if (!pinned) hide(250); };
      card.innerHTML = `<div class="vc-peek"><div class="vc-l">Preview · page ${idx + 1} <span>click the link to go there</span></div></div>`;
      card.firstElementChild.appendChild(cv);
      card.style.display = 'block'; card.style.width = w + 'px';
      const hh = card.offsetHeight;
      card.style.left = Math.max(10, Math.min(x - w / 2, innerWidth - w - 10)) + 'px';
      card.style.top = (y + 18 + hh < innerHeight ? y + 18 : Math.max(10, y - hh - 12)) + 'px';
    } catch (e) {}
  }
  function hide(ms) { clearTimeout(hideT); hideT = setTimeout(() => { if (card) card.style.display = 'none'; pinned = false; }, ms || 0); }

  function jumpWithBack(dest) {
    const v = R.view, top = v.scrollTop, left = v.scrollLeft;
    R.dest(dest);
    backBtn = document.getElementById('vlBack');
    if (!backBtn) { backBtn = document.createElement('button'); backBtn.id = 'vlBack'; }
    const host = document.fullscreenElement || document.body;
    if (backBtn.parentNode !== host) host.appendChild(backBtn);
    backBtn.textContent = '↩ Back to where I was reading';
    backBtn.style.display = 'block';
    backBtn.onclick = () => { v.scrollTo({ top, left, behavior: 'smooth' }); backBtn.style.display = 'none'; };
    clearTimeout(backBtn._t); backBtn._t = setTimeout(() => { backBtn.style.display = 'none'; }, 60000);
  }

  function textAfter(a) {
    const pg = a.closest('.pg'), rr = a.getBoundingClientRect(), mid = (rr.top + rr.bottom) / 2, h = rr.height || 12;
    const spans = [...pg.querySelectorAll('.textLayer span')].map(s => ({ s, b: s.getBoundingClientRect(), t: s.textContent })).filter(o => o.t && o.b.width > 0);
    const cut = o => {
      const node = o.s.firstChild; if (!node || node.nodeType !== 3) return o.t.slice(Math.round((rr.right - o.b.left) / o.b.width * o.t.length));
      const rg = document.createRange();
      for (let i = 0; i < node.length; i++) { rg.setStart(node, i); rg.setEnd(node, i + 1); const r = rg.getBoundingClientRect(); if (r.width && (r.left + r.right) / 2 > rr.right) return node.data.slice(i); }
      return '';
    };
    const join = list => { let out = '', end = null; for (const o of list) { if (end != null && o.b.left - end > 2 && !/\s$/.test(out)) out += ' '; out += o.t; end = o.b.right; } return out; };
    const same = spans.filter(o => o.b.top < mid && o.b.bottom > mid && o.b.right > rr.right + 0.5).sort((x, y) => x.b.left - y.b.left)
      .map(o => o.b.left >= rr.right - 1 ? o : { b: o.b, t: cut(o) });
    let out = join(same);
    if (!/[\])]/.test(out) && out.length < 40) {
      const below = spans.filter(o => o.b.top > rr.bottom - 2 && o.b.top < rr.bottom + h * 1.9);
      if (below.length) { const t0 = Math.min(...below.map(o => o.b.top)); out += ' ' + join(below.filter(o => o.b.top < t0 + h * 0.5).sort((x, y) => x.b.left - y.b.left)); }
    }
    return out.slice(0, 90);
  }
  const locOf = (inside, a) => typeof Loc === 'undefined' ? null : (Loc.after(inside.replace(/^[^,;:]*/, '')) || (a ? Loc.after(textAfter(a)) : null));

  async function itemsForLink(a) {
    const map = await build();
    const dp = await destPage(a.__dest);
    if (refStart && dp && dp < refStart) return [];
    const pg = a.closest('.pg'), rr = a.getBoundingClientRect();
    let txt = '';
    pg.querySelectorAll('.textLayer span').forEach(s => {
      const b = s.getBoundingClientRect(), t = s.textContent;
      if (!(b.right > rr.left && b.left < rr.right && b.bottom > rr.top && b.top < rr.bottom) || !t) return;
      const i0 = Math.max(0, Math.floor((rr.left - b.left) / b.width * t.length) - 1);
      const i1 = Math.min(t.length, Math.ceil((rr.right - b.left) / b.width * t.length) + 1);
      txt += t.slice(i0, i1);
    });
    const labs = (txt.match(/[A-Za-z]*\d+[a-z]?/g) || []).filter(l => map[l]);
    if (labs.length) return [{ label: labs[0], text: map[labs[0]], loc: locOf(txt, a) }];
    const lab = (txt.match(/[A-Za-z]*\d+[a-z]?/) || [])[0];
    const t = await fromDest(a.__dest);
    if (t && !/^(\d+(\.\d+)*\s+)?[A-Z][a-z]+ \d/.test(t) && looksLikeRef(t)) return [{ label: lab || '', text: t, loc: locOf(txt, a) }];
    return [];
  }
  function looksLikeRef(t) {
    return /(19|20)\d\d/.test(t) && (/[A-Z][a-z]+,?\s+[A-Z]\./.test(t) || /arXiv|doi|Journal|J\.|Ann\.|Math|Press|Proc|vol\.|pp\./i.test(t)) && !/^(Theorem|Lemma|Proposition|Definition|Corollary|Remark|Example|Section|Figure|Table)\b/i.test(t);
  }

  async function onClick(e) {
    const a = e.target.closest && e.target.closest('.lnk a');
    if (a && a.__dest) {
      e.preventDefault(); e.stopPropagation();
      const x = e.clientX, y = e.clientY;
      clearTimeout(showT);
      const items = await itemsForLink(a);
      if (items.length) { curDest = a.__dest; show(x, y, items, true); }
      else R.dest(a.__dest);
      return;
    }
    const span = e.target.closest && e.target.closest('.textLayer span');
    if (span && getSelection().isCollapsed && !(R.rdr.dataset.tool)) {
      const map = await build();
      const cs = citesIn(span.textContent, map).slice(0, 4);
      if (cs.length) { curDest = null; show(e.clientX, e.clientY, cs.map(c => ({ label: c.label, text: map[c.label], loc: c.loc })), true); }
    }
  }

  function labelsIn(text) {
    const out = [];
    for (const m of text.matchAll(/\[([^\]]{1,40})\]/g)) {
      for (const part of m[1].split(/[,;]/)) {
        const p = part.trim(), r = p.match(/^(\d+)\s*[–-]\s*(\d+)$/);
        if (r) { for (let k = +r[1]; k <= +r[2] && k - r[1] < 12; k++) out.push(String(k)); } else if (p) out.push(p);
      }
    }
    return out;
  }

  function citesIn(text, map) {
    const out = [];
    for (const m of text.matchAll(/\[([^\]]{1,60})\]/g)) {
      let last = null;
      for (const part of m[1].split(/[,;]/)) {
        const p = part.trim(), r = p.match(/^(\d+)\s*[–-]\s*(\d+)$/);
        if (r) { for (let k = +r[1]; k <= +r[2] && k - r[1] < 12; k++) if (map[k]) out.push(last = { label: String(k), loc: null }); continue; }
        if (map[p]) { out.push(last = { label: p, loc: null }); continue; }
        const loc = typeof Loc !== 'undefined' && Loc.parse(p);
        if (loc && last && !last.loc) last.loc = loc;
      }
    }
    return out;
  }

  async function onOver(e) {
    const a = e.target.closest && e.target.closest('.lnk a');
    const span = !a && e.target.closest && e.target.closest('.textLayer span');
    if (!a && !span) return;
    clearTimeout(showT); clearTimeout(hideT);
    const x = e.clientX, y = e.clientY;
    showT = setTimeout(async () => {
      const map = await build();
      if (pinned) return;
      if (a && a.__dest) { curDest = null; const it = await itemsForLink(a); if (pinned) return; if (it.length) show(x, y, it); else peek(a, x, y); return; }
      if (span) {
        if (pinned) return;
        const cs = citesIn(span.textContent, map).slice(0, 4);
        if (cs.length) show(x, y, cs.map(c => ({ label: c.label, text: map[c.label], loc: c.loc })));
      }
    }, 280);
  }
  function onOut(e) {
    if (pinned) return;
    if (e.target.closest && (e.target.closest('.lnk a') || e.target.closest('.textLayer span'))) { clearTimeout(showT); hide(350); }
  }

  (function init() {
      R = reader; refs = null; building = null; refStart = 0;
      reader.bibliography = build;
      reader.showRefCard = (x, y, items, pin) => { curDest = null; show(x, y, items, pin); };
      reader.view.addEventListener('mouseover', onOver);
      reader.view.addEventListener('mouseout', onOut);
      reader.view.addEventListener('click', onClick, true);
      document.addEventListener('mousedown', e => { if (pinned && card && !card.contains(e.target) && !(e.target.closest && e.target.closest('.lnk a'))) hide(0); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && card && card.style.display === 'block') hide(0); });
      reader.view.addEventListener('scroll', () => { if (!pinned) hide(0); }, { passive: true });
      document.addEventListener('fullscreenchange', () => hide(0));
      setTimeout(build, 1500);
  })();
}
const Cite = { attach: reader => { if (reader.__cite) return; reader.__cite = true; makeCite(reader); } };
if (typeof READERS !== 'undefined') READERS.forEach(r => Cite.attach(r));


Cite.bibFetch = async function ({ text, doi, arxiv, rec }) {
  if (rec && typeof Ref !== 'undefined') return Ref.bibtex(rec);
  const T = (u, o) => fetch(u, o).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); });
  const clean = x => x.trim().replace(/^\s+@/m, '@');
  const byDoi = async d => {
    try { return clean(await T('https://api.crossref.org/works/' + encodeURIComponent(d) + '/transform/application/x-bibtex')); } catch (e) {}
    return clean(await T('https://doi.org/' + d, { headers: { Accept: 'application/x-bibtex' } }));
  };
  if (doi) { try { return await byDoi(doi); } catch (e) {} }
  if (arxiv) {
    try { return await byDoi('10.48550/arXiv.' + arxiv); } catch (e) {}
    const x = await T('https://export.arxiv.org/api/query?id_list=' + encodeURIComponent(arxiv));
    const d = new DOMParser().parseFromString(x, 'text/xml'), en = d.querySelector('entry');
    if (en) {
      const g = k => (en.querySelector(k) || {}).textContent || '';
      const au = [...en.querySelectorAll('author > name')].map(n => n.textContent.trim());
      const yr = g('published').slice(0, 4), ln = (au[0] || 'anon').split(' ').pop().toLowerCase().replace(/[^a-z]/g, '');
      return `@misc{${ln}${yr},\n  title = {${g('title').replace(/\s+/g, ' ').trim()}},\n  author = {${au.join(' and ')}},\n  year = {${yr}},\n  eprint = {${arxiv}},\n  archivePrefix = {arXiv},\n  url = {https://arxiv.org/abs/${arxiv}}\n}`;
    }
  }
  const q = (text || '').replace(/\s+/g, ' ').replace(/^[^A-Za-zÀ-ÿ]*/, '').slice(0, 300);
  if (!q) throw new Error('nothing to search');
  const j = JSON.parse(await T('https://api.crossref.org/works?rows=1&select=DOI,title&query.bibliographic=' + encodeURIComponent(q)));
  const it = j.message && j.message.items && j.message.items[0];
  if (!it) throw new Error('no match found');
  return await byDoi(it.DOI);
};
Cite.bib = async function (src, btn) {
  const old = btn && btn.textContent; if (btn) btn.textContent = 'BibTeX…';
  let out, err;
  try { out = await Cite.bibFetch(src); } catch (e) { err = e; }
  if (btn) btn.textContent = old;
  let box = document.getElementById('vlBib');
  if (!box) { box = document.createElement('div'); box.id = 'vlBib'; }
  const host = document.fullscreenElement || document.body;
  if (box.parentNode !== host) host.appendChild(box);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  box.innerHTML = out
    ? `<b>BibTeX</b><textarea readonly>${esc(out)}</textarea><div><button class="ok">Copy</button><button class="x">Close</button></div>`
    : `<b>BibTeX</b><p>No BibTeX found (${esc(err && err.message || 'offline?')}). Try Google Scholar → Cite → BibTeX.</p><div><button class="x">Close</button></div>`;
  box.style.display = 'block';
  const ta = box.querySelector('textarea'), ok = box.querySelector('.ok');
  if (ta) { ta.select(); try { await navigator.clipboard.writeText(out); ok.textContent = 'Copied ✓'; } catch (e) {} ok.onclick = () => { navigator.clipboard.writeText(out); ok.textContent = 'Copied ✓'; }; }
  box.querySelector('.x').onclick = () => { box.style.display = 'none'; };
};
Cite.paper = async function (R, fileUrl, btn) {
  let doi = '', arxiv = '', text = R.title || '';
  const u = decodeURIComponent(fileUrl || '');
  arxiv = (u.match(/arxiv\.org\/(?:pdf|abs)\/([0-9]{4}\.[0-9]{4,5}|[a-z\-]+\/[0-9]{7})/i) || [])[1] || '';
  doi = (u.match(/\b(10\.\d{4,9}\/[^\s?#&]+)/) || [])[1] || '';
  try {
    const md = await R.pdf.getMetadata();
    const sub = ((md.info && (md.info.doi || md.info.Subject)) || '') + ' ' + ((md.metadata && md.metadata.get && md.metadata.get('prism:doi')) || '');
    doi = doi || (sub.match(/\b(10\.\d{4,9}\/[^\s,;]+[^\s,;.])/) || [])[1] || '';
    for (let i = 1; !doi && !arxiv && i <= Math.min(2, R.pdf.numPages); i++) {
      const tx = (await (await R.pdf.getPage(i)).getTextContent()).items.map(x => x.str).join(' ');
      doi = (tx.match(/\b(10\.\d{4,9}\/[^\s,;]+[^\s,;.])/) || [])[1] || '';
      arxiv = arxiv || (tx.match(/arXiv[:\s]*([0-9]{4}\.[0-9]{4,5}(?:v\d+)?)/i) || [])[1] || '';
    }
    if (arxiv) arxiv = arxiv.replace(/v\d+$/, '');
  } catch (e) {}
  return Cite.bib({ text, doi, arxiv }, btn);
};
