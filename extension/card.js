(async () => {
  const P = new URLSearchParams(location.search), project = P.get('project') || '', dest = P.get('dest') || '', printed = P.get('printed') || '', after = P.get('after') || '';
  const post = (t, extra) => parent.postMessage(Object.assign({ vlCard: t }, extra || {}), '*');
  const msg = document.getElementById('msg');
  const say = t => { msg.textContent = t; msg.classList.add('on'); post('size', { h: msg.offsetHeight + 2 }); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') post('close'); });

  const initialTheme = ReadingTheme.apply(await ReadingTheme.get());
  let activeReader = null;
  ReadingTheme.watch(theme => { ReadingTheme.apply(theme); if (activeReader) { activeReader.theme = theme; activeReader.rdr.className = 'rdr t-' + theme; activeReader.rdr.dispatchEvent(new CustomEvent('vl-themechange', { detail: theme })); } });
  say('Reading the reference…');
  const bytes = await VL.dbGet('ovl:' + project);
  if (!bytes) return say('Compile the project, then click the citation again.');
  const revision = P.get('revision');
  if (revision) {
    const actual = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
    if (actual !== revision) return say('The PDF was recompiled. Click the reference again to read the current version.');
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
  const tc = {};
  const R = {
    pdf, n: pdf.numPages, key: 'ovl:' + project, theme: initialTheme, po: [], pg: [],
    view: document.createElement('div'), rdr: document.createElement('div'),
    text: i => tc[i] || (tc[i] = pdf.getPage(i).then(p => p.getTextContent())),
    dest() {}, goto() {}
  };
  activeReader = R; R.rdr.className = 'rdr t-' + initialTheme;
  if (!/^cite\./.test(dest)) return peek(pdf);
  Cite.attach(R);

  let key = dest.replace(/^cite\./, ''), text = '';
  const hit = await R.refForDest(dest, { printed });
  if (hit) { key = hit.label; text = hit.text; }

  if (!text) return say('This citation has no entry in the bibliography of the compiled PDF.');

  msg.classList.remove('on');
  R.showRefCard(0, 0, [{ ...hit, label: key, text, loc: Loc.after(after) }], true);
  const card = document.getElementById('vlCite');
  const size = () => post('size', { h: Math.ceil(Math.max(card.getBoundingClientRect().bottom, document.documentElement.scrollHeight)) + 1 });
  new ResizeObserver(size).observe(card);
  new MutationObserver(() => { if (card.style.display === 'none') post('close'); }).observe(card, { attributes: true, attributeFilter: ['style'] });
  size();

  async function peek(pdf) {
    let d = null;
    try { d = await pdf.getDestination(dest); } catch (e) {}
    if (!Array.isArray(d)) return say('This link has no target in the compiled PDF.');
    const pageNo = (typeof d[0] === 'object' && d[0] ? await pdf.getPageIndex(d[0]) : d[0]) + 1;
    const top = d[1] && d[1].name === 'XYZ' ? d[3] : d[1] && /^FitB?H$/.test(d[1].name) ? d[2] : null;
    const kind = /^(equation|eq|align|gather|multline|flalign|subequation)/i.test(dest) ? 'equation' : 'statement';
    const fk = (dest.match(/^(figure|table|subfigure|subtable)\b/i) || [])[1];
    let res = fk && Loc.figure ? await Loc.figure(pdf, fk, null, pageNo, top) : { found: false };
    if (!res.found) res = await Loc.at(pdf, pageNo, top, kind);
    if (!res.found) return say('Nothing to show at the target of this link.');
    msg.classList.remove('on');
    const card = document.createElement('div');
    card.id = 'vlCite'; card.style.display = 'block';
    const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    card.innerHTML = `<div class="vc-stmt"><div class="vc-sh"><b>${esc(res.as)}</b> <span>in this paper</span><i class="vc-ok">page ${res.page}${res.segs.length > 1 ? '–' + res.segs[res.segs.length - 1].page : ''}</i></div><div class="vc-equation-tools"><button data-zoom="out" aria-label="Reduce preview size">−</button><span class="vc-zoom-value">100%</span><button data-zoom="in" aria-label="Enlarge preview">+</button><button data-zoom="reset">Fit width</button></div><div class="vc-img vc-local-preview"></div>
      <div class="vc-sa"><a href="#" data-go="1">Go there ↓</a><a href="#" data-c="1">Copy text</a></div></div>
      <div class="vc-bar"><span>Alt-click a link to jump directly</span><a href="#" class="vc-x">Close ✕</a></div>`;
    document.body.appendChild(card);
    const img = card.querySelector('.vc-img');
    let zoom = 1, renderGeneration = 0;
    const renderPreview = async () => {
      const generation = ++renderGeneration;
      const canvases = await Loc.render(res, Math.max(200, innerWidth - 50) * zoom, { isCurrent: () => generation === renderGeneration && card.isConnected });
      if (generation !== renderGeneration || !card.isConnected) return;
      img.replaceChildren();
      canvases.forEach(cv => { cv.title = 'Go to the equation in the PDF'; cv.onclick = () => post('go'); img.appendChild(cv); });
      card.querySelector('.vc-zoom-value').textContent = Math.round(zoom * 100) + '%';
      card.querySelector('[data-zoom=out]').disabled = zoom <= .75;
      card.querySelector('[data-zoom=in]').disabled = zoom >= 2.5;
      post('size', { h: Math.ceil(card.getBoundingClientRect().bottom) + 2 });
    };
    card.querySelectorAll('[data-zoom]').forEach(button => button.onclick = async () => {
      zoom = button.dataset.zoom === 'reset' ? 1 : Math.max(.75, Math.min(2.5, zoom * (button.dataset.zoom === 'in' ? 1.25 : .8)));
      await renderPreview();
    });
    await renderPreview();
    card.querySelector('[data-go]').onclick = e => { e.preventDefault(); post('go'); };
    card.querySelector('[data-c]').onclick = e => { e.preventDefault(); navigator.clipboard.writeText(res.text); e.target.textContent = 'Copied ✓'; };
    card.querySelector('.vc-x').onclick = e => { e.preventDefault(); post('close'); };
    const size = () => post('size', { h: Math.ceil(Math.max(card.getBoundingClientRect().bottom, document.documentElement.scrollHeight)) + 1 });
    new ResizeObserver(size).observe(card);
    size();
  }
})().catch(e => { const m = document.getElementById('msg'); m.textContent = 'VanoLib: ' + (e.message || e); m.classList.add('on'); parent.postMessage({ vlCard: 'size', h: m.offsetHeight + 2 }, '*'); });
