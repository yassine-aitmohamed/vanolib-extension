const Research = (() => {
  const E = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const S2 = 'https://api.semanticscholar.org/graph/v1/paper/';
  const FIELDS = 'title,authors,year,venue,externalIds,url,citationCount,openAccessPdf';
  const readUrl = u => (typeof VL !== 'undefined' ? VL.viewer(u) : u);
  const J = async u => { const r = await fetch(u); if (!r.ok) throw new Error(r.status === 429 ? 'Semantic Scholar is busy — try again in a minute' : 'HTTP ' + r.status); return r.json(); };
  const SEARCH = [
    ['arXiv', q => 'https://arxiv.org/search/?searchtype=all&query=' + q],
    ['Scholar', q => 'https://scholar.google.com/scholar?q=' + q],
    ['zbMATH', q => 'https://zbmath.org/?q=' + q],
    ['Semantic Scholar', q => 'https://www.semanticscholar.org/search?q=' + q],
    ['MathOverflow', q => 'https://mathoverflow.net/search?q=' + q],
    ['nLab', q => 'https://ncatlab.org/nlab/search?query=' + q]
  ];
  const state = new WeakMap();
  const st = R => { if (!state.has(R) || state.get(R).pdf !== R.pdf || state.get(R).generation !== R.gen) state.set(R, { key: R.key, pdf: R.pdf, generation: R.gen, paper: undefined, recs: {}, open: {} }); return state.get(R); };

  async function ids(R) {
    const u = decodeURIComponent((typeof FILE !== 'undefined' && FILE) || R.key || '');
    let arxiv = (u.match(/arxiv\.org\/(?:pdf|abs)\/([0-9]{4}\.[0-9]{4,5}|[a-z\-]+\/[0-9]{7})/i) || [])[1] || '';
    let doi = (u.match(/\b(10\.\d{4,9}\/[^\s?#&]+)/) || [])[1] || '';
    try {
      const md = await R.pdf.getMetadata();
      const sub = ((md.info && (md.info.doi || md.info.Subject)) || '') + ' ' + ((md.metadata && md.metadata.get && md.metadata.get('prism:doi')) || '');
      doi = doi || (sub.match(/\b(10\.\d{4,9}\/[^\s,;]+[^\s,;.])/) || [])[1] || '';
      for (let i = 1; !doi && !arxiv && i <= Math.min(2, R.n); i++) {
        const tx = (await R.text(i)).items.map(x => x.str).join(' ');
        doi = (tx.match(/\b(10\.\d{4,9}\/[^\s,;]+[^\s,;.])/) || [])[1] || '';
        arxiv = arxiv || (tx.match(/arXiv[:\s]*([0-9]{4}\.[0-9]{4,5}(?:v\d+)?)/i) || [])[1] || '';
      }
    } catch (e) {}
    return { doi, arxiv: arxiv.replace(/v\d+$/, '') };
  }
  async function findPaper(R) {
    const { doi, arxiv } = await ids(R);
    if (doi) try { return await J(S2 + 'DOI:' + encodeURIComponent(doi) + '?fields=' + FIELDS + ',paperId'); } catch (e) {}
    if (arxiv) try { return await J(S2 + 'arXiv:' + arxiv + '?fields=' + FIELDS + ',paperId'); } catch (e) {}
    const t = (R.title || '').trim();
    if (t.length > 12 && !/\.pdf$/i.test(t)) {
      const j = await J(S2 + 'search/match?query=' + encodeURIComponent(t) + '&fields=' + FIELDS + ',paperId');
      if (j && j.data && j.data[0]) return j.data[0];
    }
    return null;
  }
  function paperRow(p) {
    const ex = p.externalIds || {}, ax = ex.ArXiv, doi = ex.DOI;
    const link = ax ? 'https://arxiv.org/abs/' + ax : doi ? 'https://doi.org/' + doi : p.url;
    const pdf = ax ? 'https://arxiv.org/pdf/' + ax : (p.openAccessPdf && p.openAccessPdf.url) || '';
    const au = (p.authors || []).map(a => a.name.split(' ').pop()).slice(0, 3).join(', ') + ((p.authors || []).length > 3 ? ' et al.' : '');
    return `<div class="rr-p"><a class="t" target="_blank" href="${E(link)}">${E(p.title)}</a><div class="m">${E(au)}${p.year ? ' · ' + p.year : ''}${p.citationCount != null ? ' · ' + p.citationCount + ' cit.' : ''}</div>
      ${pdf ? `<a class="rd" href="#" data-read="${E(pdf)}">Read in VanoLib</a>` : ''}</div>`;
  }

  async function render(R) {
    const P = R.pane, s = st(R), gen = R.gen;
    if (!R.pdf) { P.innerHTML = ''; return; }
    P.innerHTML = `<div class="rres">
      <section class="rr-me"><h4>This paper</h4><div class="rr-body"><div class="rmsg">Looking it up…</div></div></section>
      <section class="rr-refs"><h4>References <span class="n"></span></h4>
        <div class="rr-tools"><button data-r="verify">✓ Verify all</button><button data-r="bib">⤓ Export .bib</button></div>
        <div class="rr-prog"></div><div class="rr-list"><div class="rmsg">Reading the bibliography…</div></div></section>
      <section class="rr-q"><h4>Search the literature</h4><input placeholder="A title, an author, a notion…">
        <div class="rr-eng">${SEARCH.map(([n], i) => `<button data-e="${i}">${n}</button>`).join('')}</div></section></div>`;
    const q = P.querySelector('.rr-q input');
    q.value = (getSelection().toString() || '').trim().slice(0, 200);
    q.onkeydown = e => { if (e.key === 'Enter') window.open(SEARCH[0][1](encodeURIComponent(q.value)), '_blank'); };
    P.querySelectorAll('[data-e]').forEach(b => b.onclick = () => q.value.trim() && window.open(SEARCH[+b.dataset.e][1](encodeURIComponent(q.value.trim())), '_blank'));
    P.querySelector('[data-r=verify]').onclick = () => verifyAll(R);
    P.querySelector('[data-r=bib]').onclick = e => exportBib(R, e.target);
    P.addEventListener('click', e => { const a = e.target.closest('[data-read]'); if (a) { e.preventDefault(); window.open(readUrl(a.dataset.read), '_blank'); } });
    renderMe(R, gen);
    renderRefs(R, gen);
  }

  async function renderMe(R, gen) {
    const s = st(R), box = () => R.pane.querySelector('.rr-me .rr-body');
    if (s.paper === undefined) { try { s.paper = await findPaper(R); } catch (e) { s.paper = { error: e.message }; } }
    if (gen !== R.gen || R.tab !== 'rs' || !box()) return;
    const p = s.paper;
    if (!p || p.error) { box().innerHTML = `<div class="rmsg">${p && p.error ? E(p.error) : 'This paper was not found in Semantic Scholar (no DOI or arXiv id in it).'}</div>`; return; }
    const ex = p.externalIds || {};
    box().innerHTML = `<div class="rr-ti">${E(p.title)}</div><div class="m">${E((p.authors || []).map(a => a.name).join(', '))}</div>
      <div class="m">${E([p.venue, p.year].filter(Boolean).join(' · '))}</div>
      <div class="rr-ids">${ex.DOI ? `<a target="_blank" href="https://doi.org/${E(ex.DOI)}">DOI</a>` : ''}${ex.ArXiv ? `<a target="_blank" href="https://arxiv.org/abs/${E(ex.ArXiv)}">arXiv:${E(ex.ArXiv)}</a>` : ''}<a target="_blank" href="${E(p.url)}">Semantic Scholar</a><a href="#" data-cite>❝ BibTeX</a></div>
      <div class="rr-tools"><button data-x="cit">Cited by · ${p.citationCount || 0}</button><button data-x="rel">Related papers</button></div><div class="rr-more"></div>`;
    box().querySelector('[data-cite]').onclick = e => { e.preventDefault(); Cite.bib({ doi: ex.DOI || '', arxiv: ex.ArXiv || '', text: p.title }, e.target); };
    box().querySelectorAll('[data-x]').forEach(b => b.onclick = async () => {
      const more = box().querySelector('.rr-more'); more.innerHTML = '<div class="rmsg">…</div>';
      box().querySelectorAll('[data-x]').forEach(c => c.classList.toggle('on', c === b));
      try {
        let list;
        if (b.dataset.x === 'cit') list = ((await J(S2 + p.paperId + '/citations?limit=40&fields=' + FIELDS)).data || []).map(d => d.citingPaper).sort((a, b2) => (b2.year || 0) - (a.year || 0));
        else list = (await J('https://api.semanticscholar.org/recommendations/v1/papers/forpaper/' + p.paperId + '?limit=12&fields=' + FIELDS)).recommendedPapers || [];
        more.innerHTML = list.length ? list.map(paperRow).join('') : '<div class="rmsg">Nothing yet.</div>';
      } catch (e) { more.innerHTML = `<div class="rmsg">${E(e.message)}</div>`; }
    });
  }

  async function entries(R) { const m = R.bibliography ? await R.bibliography() : {}; return Object.entries(m || {}).map(([label, text]) => ({ label, text: text.replace(/\s+/g, ' ').trim() })); }
  const badge = r => !r ? '<i class="b">·</i>' : r.status === 'verified' ? '<i class="b ok" title="Verified">✓</i>' : r.status === 'likely' ? '<i class="b mb" title="Probable match">≈</i>' : '<i class="b no" title="Not found">?</i>';
  async function renderRefs(R, gen) {
    const s = st(R), list = await entries(R);
    const box = R.pane.querySelector('.rr-list'); if (!box || gen !== R.gen) return;
    R.pane.querySelector('.rr-refs .n').textContent = list.length ? '· ' + list.length : '';
    if (!list.length) { box.innerHTML = '<div class="rmsg">No bibliography found at the end of this PDF.</div>'; return; }
    for (const it of list) if (s.recs[it.label]?.entry !== it.text) delete s.recs[it.label];
    box.innerHTML = list.map(it => { const r = s.recs[it.label];
      return `<div class="rr-r" data-l="${E(it.label)}">${badge(r)}<b>[${E(it.label)}]</b> <span>${E(it.text.slice(0, 180))}</span></div>`; }).join('');
    box.querySelectorAll('.rr-r').forEach(row => row.onclick = e => {
      const it = list.find(x => x.label === row.dataset.l); if (!it || !R.showRefCard) return;
      const b = row.getBoundingClientRect(); R.showRefCard(b.right + 8 + 240, b.top - 6, [it], true);
    });
  }
  async function verifyAll(R) {
    const s = st(R), list = await entries(R), prog = R.pane.querySelector('.rr-prog'), gen = R.gen;
    let n = 0, ok = 0, mb = 0;
    for (const it of list) {
      if (gen !== R.gen) return;
      if (true) {
        try { s.recs[it.label] = await Ref.resolve(it.text); } catch (e) {}
        await new Promise(r => setTimeout(r, 150));
      }
      n++; const r = s.recs[it.label]; if (r && r.status === 'verified') ok++; else if (r && r.status === 'likely') mb++;
      if (prog) prog.textContent = `${n} / ${list.length} · ${ok} verified · ${mb} probable · ${n - ok - mb} not found`;
      const row = R.pane.querySelector(`.rr-r[data-l="${CSS.escape(it.label)}"]`);
      if (row && r) row.innerHTML = `${badge(r)}<b>[${E(it.label)}]</b> <span>${E(it.text.slice(0, 180))}</span>`;
    }
  }
  async function exportBib(R, btn) {
    const s = st(R), list = await entries(R); if (!list.length) return R.toast('No bibliography in this PDF');
    const old = btn.textContent; let out = [], k = 0;
    for (const it of list) {
      btn.textContent = `⤓ ${++k} / ${list.length}`;
      let r; try { r = await Ref.resolve(it.text); } catch (e) {}
      if (r && r.status === 'verified') { try { out.push(`% [${it.label}]${r.status === 'likely' ? ' (probable match — check)' : ''}\n` + await Ref.bibtex(r)); continue; } catch (e) {} }
      out.push(`% [${it.label}] not found — raw entry\n@misc{ref${it.label.replace(/\W/g, '')},\n  note = {${it.text.replace(/[{}]/g, '')}}\n}`);
    }
    btn.textContent = old;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([out.join('\n\n') + '\n'], { type: 'application/x-bibtex' }));
    a.download = ((R.title || 'references').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'references') + '.bib';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    R.toast('references.bib downloaded ⤓');
  }

  function attach(R) {
    if (R.__research) return; R.__research = true;
    const tabs = R.rdr.querySelector('.rstabs');
    const b = document.createElement('button'); b.dataset.s = 'rs'; b.textContent = 'Research';
    b.onclick = () => { R.tab = 'rs'; R.renderSide(); }; tabs.appendChild(b);
    const sel = R.rdr.querySelector('.rsel');
    [['Scholar', 1], ['arXiv', 0], ['zbMATH', 2]].forEach(([n, i]) => {
      const x = document.createElement('button'); x.className = 't'; x.textContent = n; x.title = 'Search the selection on ' + n;
      x.onmousedown = e => { e.preventDefault(); const t = getSelection().toString().replace(/\s+/g, ' ').trim(); if (t) window.open(SEARCH[i][1](encodeURIComponent(t.slice(0, 300))), '_blank'); R.hideSel(); };
      sel.appendChild(x);
    });
  }
  function openPanel(R) { R.rdr.classList.add('side'); R.tab = 'rs'; R.renderSide(); }
  return { attach, render, openPanel, ids };
})();

(() => {
  const _rs = Reader.prototype.renderSide;
  Reader.prototype.renderSide = async function () {
    this.rdr.classList.toggle('wide', this.tab === 'rs');
    if (this.tab === 'rs') { this.rdr.querySelectorAll('.rstabs button').forEach(b => b.classList.toggle('on', b.dataset.s === 'rs')); return Research.render(this); }
    return _rs.call(this);
  };
})();
