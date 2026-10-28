function makeCite(reader) {
  const R = reader, index = new Bibliography.Index(reader);
  let card = null, hideT = null, showT = null, pinned = false, curDest = null, backBtn = null;
  async function build() {
    const entries = await index.build({ fresh: true });
    const refs = Object.fromEntries([...entries].map(([key, entry]) => [key, entry.text]));
    R.__refs = refs;
    return refs;
  }
  async function fromDest(dest) { return (await index.resolve(dest, { fresh: true }))[0]?.text || ''; }
  const ESCH = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const readUrl = u => (typeof VL !== 'undefined' ? VL.viewer(u) : u);
  function refHTML(label, text, rec, origin = {}) {
    const t = text.replace(/\s+/g, ' ').trim();
    const id = (typeof Ref !== 'undefined') ? Ref.ids(t) : { doi: '', arxiv: '' };
    const matched = rec?.status === 'verified';
    const doi = (matched && rec.doi) || id.doi, ax = (matched && rec.arxiv) || id.arxiv, pdf = matched && rec.pdf;
    const q = encodeURIComponent(((rec && rec.status === 'verified' && rec.title) || t.replace(/^[^A-Za-zÀ-ÿ]*/, '')).slice(0, 220));
    const open = doi ? 'https://doi.org/' + doi : ax ? 'https://arxiv.org/abs/' + ax : 'https://scholar.google.com/scholar?q=' + q;
    const readerLink = matched ? readUrl(open) + (doi ? '&doi=' + encodeURIComponent(doi) : '') : open;
    let head = '';
    if (rec === null) head = '<div class="vc-st vc-wait">Checking the reference…</div>';
    else if (rec && rec.status === 'verified') {
      const au = (rec.authors || []).map(a => ((a.given ? a.given.replace(/(\p{L})\p{L}*\.?/gu, '$1.').replace(/\s+/g, ' ') + ' ' : '') + a.family)).slice(0, 6).join(', ') + ((rec.authors || []).length > 6 ? ', …' : '');
      const venue = [rec.venue, rec.volume && 'vol. ' + rec.volume, rec.pages && 'pp. ' + rec.pages, rec.year].filter(Boolean).join(' · ');
      head = `<div class="vc-st ${rec.status === 'verified' ? 'vc-ok' : 'vc-maybe'}" title="${ESCH(rec.how || '')}">${rec.status === 'verified' ? '✓ Matched online' : '≈ Probable match — check'}<span>${ESCH(rec.how || '')}</span>${rec.citations != null ? `<em>${rec.citations} citations</em>` : ''}</div>
        <div class="vc-ti">${ESCH(rec.title)}</div><div class="vc-au">${ESCH(au)}</div>${venue ? `<div class="vc-ve">${ESCH(venue)}</div>` : ''}`;
    } else if (rec) head = '<div class="vc-st vc-no">Online identity not confirmed. The original reference is retained.</div><div class="vc-reason">' + ESCH(rec.how || '') + '</div>';
    return `<div class="vc-ref" data-key="${ESCH(t.slice(0, 80))}"><div class="vc-l">${label ? '[' + ESCH(label) + ']' : '↳'}</div><div class="vc-source">Current PDF${origin.page ? ' · bibliography page ' + ESCH(origin.page) : ''}${origin.selection ? ' · ' + ESCH(origin.selection) : ''}</div><div class="vc-original">${ESCH(t)}</div>${origin.warning ? '<div class="vc-reason">' + ESCH(origin.warning) + '</div>' : ''}${head}
      <div class="vc-a"><a class="vc-open" target="_blank" href="${ESCH(readerLink)}">${matched ? 'Open matched paper ↗' : doi || ax ? 'Identifier printed in PDF ↗' : 'Search this reference ↗'}</a>
      ${pdf ? `<a target="_blank" href="${ESCH(pdf)}">PDF</a><a href="#" data-read="${ESCH(pdf)}">Read in VanoLib</a>` : ax ? `<a href="#" data-read="https://arxiv.org/pdf/${ESCH(ax)}">Read in VanoLib</a>` : ''}
      ${ax ? `<a target="_blank" href="https://arxiv.org/abs/${ESCH(ax)}">arXiv:${ESCH(ax)}</a>` : `<a target="_blank" href="https://arxiv.org/search/?searchtype=all&query=${q}">arXiv</a>`}
      ${doi ? `<a target="_blank" href="https://doi.org/${ESCH(doi)}">DOI</a>` : ''}
      <a target="_blank" href="https://zbmath.org/?q=${q}">zbMATH</a>
      <a target="_blank" href="https://scholar.google.com/scholar?q=${q}">Scholar</a>
      <a href="#" data-copy="1">Copy</a><a href="#" data-bib="1" title="BibTeX, AMS, APA, MLA, Chicago">Cite</a></div></div>`;
  }
  function wire(block, label, text, rec) {
    const t = text.replace(/\s+/g, ' ').trim();
    block.querySelectorAll('[data-copy]').forEach(a => a.onclick = async e => { e.preventDefault(); try { await navigator.clipboard.writeText(t); a.textContent = 'Copied ✓'; } catch { a.textContent = 'Clipboard unavailable'; } });
    block.querySelectorAll('[data-bib]').forEach(a => a.onclick = e => { e.preventDefault(); Cite.bib(rec && rec.status === 'verified' ? { rec } : { text: t, doi: (Ref.ids(t).doi), arxiv: Ref.ids(t).arxiv }, a); });
    block.querySelectorAll('[data-read]').forEach(a => a.onclick = e => { e.preventDefault(); window.open(readUrl(a.dataset.read), '_blank'); });
  }
  let showGen = 0;
  function show(x, y, items, pin) {
    if (!items.length) return;
    pinned = !!pin;
    const gen = ++showGen, sourcePDF = R.pdf, sourceGeneration = R.gen;
    card = document.getElementById('vlCite');
    if (!card) { card = document.createElement('div'); card.id = 'vlCite'; }
    const host = document.fullscreenElement || document.body;
    if (card.parentNode !== host) host.appendChild(card);
    card.classList.remove('vc-target-card', 'vc-target-expanded'); card.removeAttribute('role'); card.removeAttribute('aria-labelledby');
    card.onmouseenter = () => clearTimeout(hideT); card.onmouseleave = () => { if (!pinned) hide(250); };
    const canResolve = pin && typeof Ref !== 'undefined';
    card.innerHTML = items.map(item => refHTML(item.label, item.text, canResolve ? null : undefined, item)).join('');
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
      if (gen !== showGen || card.style.display !== 'block' || R.pdf !== sourcePDF || R.gen !== sourceGeneration || rec.entry !== text.replace(/\s+/g, ' ').trim()) return;
      const old = card.querySelectorAll('.vc-ref')[k]; if (!old) return;
      const tmp = document.createElement('div'); tmp.innerHTML = refHTML(label, text, rec, items[k]);
      const nb = tmp.firstElementChild; old.replaceWith(nb); wire(nb, label, text, rec); place();
      if (stmts[k] && pin) fillStmt(stmts[k], items[k].loc, rec, w - 26, gen).then(() => { if (gen === showGen) place(); });
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
    say('Looking for an open version (journal, arXiv)…');
    let srcs = [];
    if (rec && rec.status === 'verified') { try { srcs = await Ref.sources(rec); } catch (e) {} }
    else if (rec && rec.arxiv) srcs = [{ url: 'https://arxiv.org/pdf/' + rec.arxiv, kind: 'arxiv', id: rec.arxiv }];
    if (gen !== showGen) return;
    if (!srcs.length) { say('No free version of this paper was found (journal open access, arXiv). Open the paper to read ' + name + '.', 'vc-no'); return; }
    let res = null, src = null, err = null, wrongDoc = false;
    for (const s of srcs) {
      say(s.kind === 'arxiv' ? 'Reading the arXiv version…' : 'Reading the journal version…');
      try {
        if (rec && rec.status === 'verified' && !(await Loc.isPaper(s.url, rec))) { wrongDoc = true; continue; }
        const r = await Loc.statement(s.url, loc);
        if (!res || (r.found && !res.found)) { res = r; src = s; }
        if (r.found) break;
      } catch (e) { err = e; }
      if (gen !== showGen) return;
    }
    if (gen !== showGen) return;
    if (!res) { say(wrongDoc ? 'The PDF found for this reference is another paper, so no statement is shown. Open the paper to read ' + name + '.' : 'Could not open the PDF of the cited paper (' + ((err && err.message) || err) + ').', 'vc-no'); return; }
    const pdf = src.url;
    const open = (page, top) => {
      const u = typeof VL !== 'undefined' ? VL.viewer(pdf) + '&page=' + page + (top ? '&top=' + Math.round(top) : '') : pdf + '#page=' + page;
      window.open(u, '_blank');
    };
    const sa = b.querySelector('.vc-sa');
    if (!res.found) {
      say(name + ' was not found in the ' + (srcs.length > 1 ? 'journal or arXiv versions' : src.kind === 'arxiv' ? 'arXiv version' : 'PDF') + ' of this paper. The numbering may differ from the cited version.', 'vc-no');
      sa.innerHTML = `<a href="#" data-o="1">Open the paper in VanoLib ↗</a>`;
      sa.querySelector('[data-o]').onclick = e => { e.preventDefault(); open(1); };
      return;
    }
    const arxivPdf = src.kind === 'arxiv', published = rec && rec.venue && !/arxiv/i.test(rec.venue);
    say('page ' + res.page + (res.segs.length > 1 ? '–' + res.segs[res.segs.length - 1].page : '') + (arxivPdf ? ' · arXiv version' : ''), 'vc-ok');
    const notes = [];
    if (res.mismatch) notes.push(`The paper calls it <b>${ESCH(res.as)}</b>, not ${ESCH(name)}.`);
    if (arxivPdf && published) notes.push(`Read from the arXiv version${src.id ? ' (arXiv:' + ESCH(src.id) + ')' : ''}${srcs.some(x => x.kind === 'journal') ? ', since the journal PDF could not be read' : ', since the journal version is not free'}: the published version may number it differently.`);
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

  async function peek(a, x, y, pin = false) {
    const generation = ++showGen, pdf = R.pdf, readerGeneration = R.gen;
    clearTimeout(hideT); pinned = pin;
    card = document.getElementById('vlCite');
    if (!card) { card = document.createElement('div'); card.id = 'vlCite'; }
    const host = document.fullscreenElement || document.body;
    if (card.parentNode !== host) host.appendChild(card);
    card.onmouseenter = () => clearTimeout(hideT);
    card.onmouseleave = () => { if (!pinned) hide(250); };
    const isCurrent = () => generation === showGen && R.pdf === pdf && R.gen === readerGeneration && card.style.display !== 'none';
    const place = () => {
      const w = card.offsetWidth, h = card.offsetHeight;
      card.style.left = Math.max(12, Math.min(x - w / 2, innerWidth - w - 12)) + 'px';
      card.style.top = (pin ? Math.max(12, (innerHeight - h) / 2) : y + 18 + h < innerHeight - 12 ? y + 18 : Math.max(12, y - h - 12)) + 'px';
    };
    await TargetPreview.mount(card, {
      reader: R, dest: a.__dest, label: textUnder(a).trim(), pin, isCurrent, place,
      go: () => { hide(0); jumpWithBack(a.__dest); }, close: () => hide(0)
    });
  }
  function hide(ms) { clearTimeout(hideT); hideT = setTimeout(() => { ++showGen; if (card) card.style.display = 'none'; pinned = false; }, ms || 0); }

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

  function textUnder(a) {
    const pg = a.closest('.pg'), rr = a.getBoundingClientRect(), rg = document.createRange();
    let txt = '';
    pg.querySelectorAll('.textLayer span').forEach(s => {
      const b = s.getBoundingClientRect();
      if (!(b.right > rr.left && b.left < rr.right && b.bottom > rr.top && b.top < rr.bottom)) return;
      const walker = document.createTreeWalker(s, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        let first = -1, last = -1;
        for (let i = 0; i < node.length; i++) {
          rg.setStart(node, i); rg.setEnd(node, i + 1);
          const r = rg.getBoundingClientRect(), cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
          if (r.width && cx > rr.left && cx < rr.right && cy > rr.top - 1 && cy < rr.bottom + 1) { if (first < 0) first = i; last = i; }
        }
        if (first < 0) continue;
        const word = c => /[\p{L}\p{N}+]/u.test(c || '');
        if (word(node.data[first])) while (first > 0 && word(node.data[first - 1])) first--;
        if (word(node.data[last])) while (last < node.length - 1 && word(node.data[last + 1])) last++;
        txt += node.data.slice(first, last + 1);
      }
    });
    return txt;
  }
  async function itemsForLink(a) {
    if (a.__pdf && a.__pdf !== R.pdf) return [];
    const printed = textUnder(a);
    const found = await index.resolve(a.__dest, { printed, fresh: true });
    R.__refs = Object.fromEntries([...index.entries].map(([key, entry]) => [key, entry.text]));
    return found.map(entry => ({ ...entry, loc: locOf(printed, a) }));
  }
  function showMissing(a, x, y) {
    ++showGen; pinned = true;
    card = document.getElementById('vlCite') || document.createElement('div'); card.id = 'vlCite';
    (document.fullscreenElement || document.body).appendChild(card);
    card.classList.remove('vc-target-card', 'vc-target-expanded');
    card.innerHTML = '<div class="vc-l">Reference not identified</div><p>The citation could not be linked unambiguously to one entry in the current PDF. No other reference has been substituted.</p><div class="vc-bar"><a href="#" class="vc-go">Inspect the PDF link destination ↓</a><a href="#" class="vc-x">Close ✕</a></div>';
    card.querySelector('.vc-go').onclick = e => { e.preventDefault(); hide(0); jumpWithBack(a.__dest); };
    card.querySelector('.vc-x').onclick = e => { e.preventDefault(); hide(0); };
    card.style.width = Math.min(480, innerWidth-24)+'px';card.style.display='block';
    card.style.left = Math.max(12,Math.min(x-240,innerWidth-card.offsetWidth-12))+'px';
    card.style.top = Math.max(12,Math.min(y+16,innerHeight-card.offsetHeight-12))+'px';
  }
  function referenceDestination(items, fallback) {
    const entry = items[0], row = entry?.rows?.[0];
    return row ? [entry.page - 1, { name: 'XYZ' }, row.x, row.top, null] : fallback;
  }
  function looksLikeRef(t) {
    return /(19|20)\d\d/.test(t) && (/[A-Z][a-z]+,?\s+[A-Z]\./.test(t) || /arXiv|doi|Journal|J\.|Ann\.|Math|Press|Proc|vol\.|pp\./i.test(t)) && !/^(Theorem|Lemma|Proposition|Definition|Corollary|Remark|Example|Section|Figure|Table)\b/i.test(t);
  }

  async function onClick(e) {
    const a = e.target.closest && e.target.closest('.lnk a');
    if (a && a.__dest) {
      e.preventDefault(); e.stopPropagation();
      const x = e.clientX, y = e.clientY, action = ++showGen, pdf = R.pdf;
      clearTimeout(showT); clearTimeout(hideT); pinned = true;
      const items = await itemsForLink(a);
      if (action !== showGen || pdf !== R.pdf) return;
      if (items.length) { curDest = referenceDestination(items, a.__dest); show(x, y, items, true); }
      else if (/^cite[.:]/i.test(String(a.__dest))) showMissing(a, x, y);
      else await peek(a, x, y, true);
      return;
    }
    const span = e.target.closest && e.target.closest('.textLayer span');
    if (span && span.textContent.includes('[') && getSelection().isCollapsed && !(R.rdr.dataset.tool)) {
      const map = await build();
      const cs = citesIn(groupAt(span, e.clientX), map).slice(0, 4);
      if (cs.length) { curDest = null; show(e.clientX, e.clientY, cs.map(c => ({ label: c.label, text: map[c.label], loc: c.loc })), true); return; }
    }
    if (span && getSelection().isCollapsed && !(R.rdr.dataset.tool) && typeof Loc !== 'undefined' && Loc.figure) {
      const f = figAt(span, e.clientX);
      if (f) await figure(f, e.clientX, e.clientY);
    }
  }

  const FIGRE = /\b(Fig(?:ure)?s?\.?|Tab(?:le)?s?\.?)\s?~?\s?((?:[A-Z]\.)?\d+(?:\.\d+)?[a-z]?)\b/g;
  function figAt(span, x) {
    const node = span.firstChild; if (!node || node.nodeType !== 3) return null;
    const rg = document.createRange();
    let at = -1;
    for (let i = 0; i < node.length; i++) { rg.setStart(node, i); rg.setEnd(node, i + 1); const r = rg.getBoundingClientRect(); if (r.width && x >= r.left - 1 && x <= r.right + 1) { at = i; break; } }
    if (at < 0) return null;
    const prev = span.previousElementSibling && span.previousElementSibling.matches('span') ? span.previousElementSibling.textContent : '';
    const next = span.nextElementSibling && span.nextElementSibling.matches('span') ? span.nextElementSibling.textContent : '';
    const p0 = prev.slice(-12), t = p0 + (p0 && !/\s$/.test(p0) ? ' ' : '') + span.textContent + ' ' + next.slice(0, 10), off = t.indexOf(span.textContent) + at;
    for (const m of t.matchAll(FIGRE)) if (off >= m.index && off < m.index + m[0].length) return { kind: /^tab/i.test(m[1]) ? 'table' : 'figure', num: m[2], label: m[0].replace(/\s+/g, ' ') };
    return null;
  }
  async function figure(f, x, y) {
    const action = ++showGen, pdf = R.pdf;
    const res = await Loc.figure(pdf, f.kind, f.num, R.cur || null).catch(() => ({ found: false }));
    if (action !== showGen || pdf !== R.pdf || !res.found) return;
    clearTimeout(hideT); pinned = true;
    const generation = ++showGen, readerGeneration = R.gen;
    card = document.getElementById('vlCite');
    if (!card) { card = document.createElement('div'); card.id = 'vlCite'; }
    const host = document.fullscreenElement || document.body;
    if (card.parentNode !== host) host.appendChild(card);
    card.onmouseenter = () => clearTimeout(hideT); card.onmouseleave = null;
    const isCurrent = () => generation === showGen && R.pdf === pdf && R.gen === readerGeneration && card.style.display !== 'none';
    const place = () => { const w = card.offsetWidth, h = card.offsetHeight; card.style.left = Math.max(12, Math.min(x - w / 2, innerWidth - w - 12)) + 'px'; card.style.top = Math.max(12, (innerHeight - h) / 2) + 'px'; };
    await TargetPreview.mount(card, { reader: R, target: res, label: res.as, pin: true, isCurrent, place,
      go: () => { hide(0); R.goto(res.page, res.top); }, close: () => hide(0) });
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

  function groupAt(span, x) {
    const node = span.firstChild, t = span.textContent;
    if (!node || node.nodeType !== 3) return t;
    const rg = document.createRange();
    let at = -1;
    for (let i = 0; i < node.length; i++) { rg.setStart(node, i); rg.setEnd(node, i + 1); const r = rg.getBoundingClientRect(); if (r.width && x >= r.left && x <= r.right) { at = i; break; } }
    if (at < 0) return '';
    const open = t.lastIndexOf('[', at), close = t.indexOf(']', at);
    if (open < 0 || t.lastIndexOf(']', at - 1) > open) return '';
    const group = close < 0 ? t.slice(open) + ']' : t.slice(open, close + 1);
    let a0 = at, a1 = at;
    while (a0 > open + 1 && /[\w+.-]/.test(t[a0 - 1])) a0--;
    while (a1 < (close < 0 ? t.length : close) && /[\w+.-]/.test(t[a1])) a1++;
    const one = t.slice(a0, a1).replace(/[.]+$/, '');
    if (/\d/.test(one) && /^[A-Za-z+]*\d+[a-z]?$/.test(one) && R.__refs && R.__refs[one]) {
      const rest = group.slice(a1 - open);
      return '[' + one + (/^\s*,\s*[A-Za-z§(]/.test(rest) && !/^\s*,\s*[A-Za-z+]*\d+[a-z]?\s*[,;\]]/.test(rest) ? rest : ']');
    }
    return group;
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
    if (!a && (!span || !span.textContent.includes('['))) return;
    clearTimeout(showT); clearTimeout(hideT);
    const x = e.clientX, y = e.clientY, hoverGeneration = showGen;
    showT = setTimeout(async () => {
      if (pinned) return;
      if (a && a.__dest) { curDest = null; const it = await itemsForLink(a); if (pinned || hoverGeneration !== showGen) return; if (!a.matches(':hover')) return; if (it.length) show(x, y, it); else if (!/^cite[.:]/i.test(String(a.__dest))) peek(a, x, y); return; }
      if (span) {
        if (pinned) return;
        const map = await build();
        const cs = citesIn(groupAt(span, x), map).slice(0, 4);
        if (cs.length) show(x, y, cs.map(c => ({ label: c.label, text: map[c.label], loc: c.loc })));
      }
    }, 280);
  }
  function onOut(e) {
    if (pinned) return;
    if (e.target.closest && (e.target.closest('.lnk a') || e.target.closest('.textLayer span'))) { clearTimeout(showT); hide(350); }
  }

  (function init() {
      if (reader.pages) new MutationObserver(() => { if (card && reader.pdf !== index.pdf) hide(0); }).observe(reader.pages, { childList: true });
      reader.bibliography = build;
      reader.refAtDest = fromDest;
      reader.citeItems = itemsForLink;
      reader.refForDest = async (dest, options = {}) => { const found = await index.resolve(dest, { ...options, fresh: true }); return found.length === 1 ? found[0] : null; };
      reader.showRefCard = (x, y, items, pin) => { curDest = null; show(x, y, items, pin); };
      reader.view.addEventListener('mouseover', onOver);
      reader.view.addEventListener('mouseout', onOut);
      reader.view.addEventListener('click', e => onClick(e).catch(err => { pinned = false; R.toast?.(err.message); }), true);
      document.addEventListener('mousedown', e => { if (pinned && card && !card.contains(e.target) && !(e.target.closest && e.target.closest('.lnk a'))) hide(0); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && card && card.style.display === 'block') hide(0); });
      reader.view.addEventListener('scroll', () => { if (!pinned) hide(0); }, { passive: true });
      document.addEventListener('fullscreenchange', () => hide(0));
      setTimeout(() => build().catch(() => {}), 1500);
  })();
}
const Cite = { attach: reader => { if (reader.__cite) return; reader.__cite = true; makeCite(reader); } };
if (typeof READERS !== 'undefined') READERS.forEach(r => Cite.attach(r));


Cite.bibFetch = async function ({ text, doi, arxiv, rec }) {
  const source = text || rec?.entry || (rec?.title ? Ref.authorsShort(rec.authors) + '. ' + rec.title + '. ' + (rec.year || '') + (rec.doi ? '. https://doi.org/' + rec.doi : '') : '') || (doi ? 'https://doi.org/' + doi : arxiv ? 'arXiv:' + arxiv : '');
  const checked = await Ref.resolve(source);
  if (checked.status !== 'verified') throw new Error(checked.how || 'Reference not confirmed');
  return Ref.bibtex(checked);
};
Cite.formats = function (rec) {
  const A = (rec.authors || []).filter(a => a && a.family);
  const ini = g => (g || '').split(/\s+/).filter(Boolean).map(w => w.split('-').map(p => p.replace(/^(\p{L}).*$/u, '$1.')).join('-')).join(' ');
  const full = a => (a.given ? a.given + ' ' : '') + a.family, inv = a => a.family + (a.given ? ', ' + a.given : '');
  const list = (xs, and) => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + (xs.length > 2 ? ',' : '') + ' ' + and + ' ' + xs[xs.length - 1];
  const pre = !rec.venue || /^arxiv/i.test(rec.venue), V = pre ? '' : rec.venue, vol = rec.volume || '', no = rec.issue || '', yr = rec.year || 'n.d.';
  const pp = (rec.pages || '').replace(/\s*-+\s*/g, '–'), t = (rec.title || '').replace(/\s+/g, ' ').trim(), tt = t.replace(/\.$/, ''), dot = /[?!]$/.test(tt) ? '' : '.';
  const link = rec.doi ? 'https://doi.org/' + rec.doi : rec.arxiv ? 'https://arxiv.org/abs/' + rec.arxiv : (rec.url || '');
  const ax = rec.arxiv ? 'arXiv:' + rec.arxiv : '';
  const out = {};
  out.AMS = list(A.map(a => (a.given ? ini(a.given) + ' ' : '') + a.family), 'and') + ', ' + tt + ', ' +
    (V ? V + (vol ? ' ' + vol : '') + ' (' + yr + ')' + (no ? ', no. ' + no : '') + (pp ? ', ' + pp : '') : 'preprint (' + yr + ')' + (ax ? ', available at ' + ax : '')) + '.' + (rec.doi ? ' doi:' + rec.doi : '');
  const apaA = A.length > 20 ? A.slice(0, 19).map(a => a.family + (a.given ? ', ' + ini(a.given) : '')).join(', ') + ', … ' + (a => a.family + (a.given ? ', ' + ini(a.given) : ''))(A[A.length - 1])
    : A.length > 1 ? A.slice(0, -1).map(a => a.family + (a.given ? ', ' + ini(a.given) : '')).join(', ') + ', & ' + (a => a.family + (a.given ? ', ' + ini(a.given) : ''))(A[A.length - 1])
    : A.map(a => a.family + (a.given ? ', ' + ini(a.given) : '')).join('');
  out.APA = apaA + ' (' + yr + '). ' + tt + dot + ' ' + (V ? V + (vol ? ', ' + vol : '') + (no ? '(' + no + ')' : '') + (pp ? ', ' + pp : '') + '.' : (ax ? ax + '.' : 'Preprint.')) + (link ? ' ' + link : '');
  const mlaA = A.length > 2 ? inv(A[0]) + ', et al' : A.length === 2 ? inv(A[0]) + ', and ' + full(A[1]) : A.map(inv).join('');
  out.MLA = (mlaA ? mlaA.replace(/\.$/, '') + '. ' : '') + '“' + tt + dot + '” ' + (V ? V + (vol ? ', vol. ' + vol : '') + (no ? ', no. ' + no : '') + ', ' + yr + (pp ? ', pp. ' + pp : '') : (ax ? ax + ', ' : '') + yr) + '.' + (link ? ' ' + link.replace(/^https?:\/\//, '') + '.' : '');
  const chiA = A.length > 10 ? A.slice(0, 7).map((a, k) => k ? full(a) : inv(a)).join(', ') + ', et al' : A.length === 2 ? inv(A[0]) + ', and ' + full(A[1]) : list(A.map((a, k) => k ? full(a) : inv(a)), 'and');
  out.Chicago = (chiA ? chiA.replace(/\.$/, '') + '. ' : '') + '“' + tt + dot + '” ' + (V ? V + (vol ? ' ' + vol : '') + (no ? ', no. ' + no : '') + ' (' + yr + ')' + (pp ? ': ' + pp : '') : (ax ? ax + ' ' : 'Preprint, ') + '(' + yr + ')') + '.' + (link ? ' ' + link + '.' : '');
  return out;
};
Cite.bib = async function (src, btn) {
  let box = document.getElementById('vlBib');
  if (!box) { box = document.createElement('div'); box.id = 'vlBib'; }
  const host = document.fullscreenElement || document.body;
  if (box.parentNode !== host) host.appendChild(box);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fm = src.rec ? Cite.formats(src.rec) : null, names = ['BibTeX', 'AMS', 'APA', 'MLA', 'Chicago'];
  let cur = 'BibTeX'; try { cur = localStorage.getItem('vlCiteFmt') || cur; } catch (e) {}
  if (!fm || !names.includes(cur)) cur = 'BibTeX';
  box.innerHTML = `<b>Cite</b><div class="vb-tabs">${names.map(n => `<button data-f="${n}"${!fm && n !== 'BibTeX' ? ' disabled title="Only for a reference checked in Crossref / arXiv"' : ''}>${n}</button>`).join('')}</div>
    <textarea readonly></textarea><p class="vb-msg"></p><div><button class="ok">Copy</button><button class="x">Close</button></div>`;
  box.style.display = 'block';
  const ta = box.querySelector('textarea'), ok = box.querySelector('.ok'), msg = box.querySelector('.vb-msg');
  let bib = null, bibErr = null, bibJob = null, gen = 0;
  async function pick(n) {
    const my = ++gen; cur = n; try { localStorage.setItem('vlCiteFmt', n); } catch (e) {}
    box.querySelectorAll('.vb-tabs button').forEach(b => b.classList.toggle('on', b.dataset.f === n));
    ok.textContent = 'Copy'; msg.textContent = '';
    let out = '';
    if (n === 'BibTeX') {
      if (bib == null && !bibErr) { ta.value = 'Fetching the BibTeX…'; bibJob = bibJob || Cite.bibFetch(src).then(x => { bib = x; }, e => { bibErr = e; }); await bibJob; }
      if (my !== gen) return;
      if (bibErr) { ta.value = ''; ta.style.display = 'none'; ok.style.display = 'none'; msg.textContent = 'No BibTeX found (' + ((bibErr && bibErr.message) || 'offline?') + '). Try Google Scholar → Cite → BibTeX.'; return; }
      out = bib;
    } else out = fm[n];
    ta.style.display = ''; ok.style.display = ''; ta.value = out; ta.select();
    try { await navigator.clipboard.writeText(out); if (my === gen) ok.textContent = 'Copied ✓'; } catch (e) {}
  }
  box.querySelectorAll('.vb-tabs button').forEach(b => b.onclick = () => pick(b.dataset.f));
  ok.onclick = () => { navigator.clipboard.writeText(ta.value); ok.textContent = 'Copied ✓'; };
  box.querySelector('.x').onclick = () => { box.style.display = 'none'; };
  if (btn) { const old = btn.textContent; btn.textContent = 'Cite…'; await pick(cur); btn.textContent = old; } else await pick(cur);
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
    if (arxiv) arxiv = arxiv.replace(/v\d+$/, '');
  } catch (e) {}
  return Cite.bib({ text, doi, arxiv }, btn);
};
