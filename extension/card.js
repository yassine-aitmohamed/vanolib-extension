(async () => {
  const P = new URLSearchParams(location.search), project = P.get('project') || '', dest = P.get('dest') || '', after = P.get('after') || '';
  const post = (t, extra) => parent.postMessage(Object.assign({ vlCard: t }, extra || {}), '*');
  const msg = document.getElementById('msg');
  const say = t => { msg.textContent = t; msg.classList.add('on'); post('size', { h: msg.offsetHeight + 2 }); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') post('close'); });

  say('Reading the reference…');
  const bytes = await VL.dbGet('ovl:' + project);
  if (!bytes) return say('Compile the project, then click the citation again.');
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
  const tc = {};
  const R = {
    pdf, n: pdf.numPages, key: 'ovl:' + project, theme: 'day', po: [], pg: [],
    view: document.createElement('div'), rdr: document.createElement('div'),
    text: i => tc[i] || (tc[i] = pdf.getPage(i).then(p => p.getTextContent())),
    dest() {}, goto() {}
  };
  if (!/^cite\./.test(dest)) return peek(pdf);
  Cite.attach(R);

  const key = dest.replace(/^cite\./, '');
  const map = await R.bibliography();
  let text = map[key] || '';
  if (!text) { try { text = await R.refAtDest(dest); } catch (e) {} }
  if (!text) return say('This citation has no entry in the bibliography of the compiled PDF.');

  msg.classList.remove('on');
  R.showRefCard(0, 0, [{ label: key, text, loc: Loc.after(after) }], true);
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
    const res = await Loc.at(pdf, pageNo, top, kind);
    if (!res.found) return say('Nothing to show at the target of this link.');
    msg.classList.remove('on');
    const card = document.createElement('div');
    card.id = 'vlCite'; card.style.display = 'block';
    const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    card.innerHTML = `<div class="vc-stmt"><div class="vc-sh"><b>${esc(res.as)}</b> <span>in this paper</span><i class="vc-ok">page ${res.page}${res.segs.length > 1 ? '–' + res.segs[res.segs.length - 1].page : ''}</i></div><div class="vc-img"></div>
      <div class="vc-sa"><a href="#" data-go="1">Go there ↓</a><a href="#" data-c="1">Copy text</a></div></div>
      <div class="vc-bar"><span>Alt-click a link to jump directly</span><a href="#" class="vc-x">Close ✕</a></div>`;
    document.body.appendChild(card);
    const img = card.querySelector('.vc-img');
    (await Loc.render(res, Math.max(200, innerWidth - 50))).forEach(cv => { cv.title = 'Go there'; cv.onclick = () => post('go'); img.appendChild(cv); });
    card.querySelector('[data-go]').onclick = e => { e.preventDefault(); post('go'); };
    card.querySelector('[data-c]').onclick = e => { e.preventDefault(); navigator.clipboard.writeText(res.text); e.target.textContent = 'Copied ✓'; };
    card.querySelector('.vc-x').onclick = e => { e.preventDefault(); post('close'); };
    const size = () => post('size', { h: Math.ceil(Math.max(card.getBoundingClientRect().bottom, document.documentElement.scrollHeight)) + 1 });
    new ResizeObserver(size).observe(card);
    size();
  }
})().catch(e => { const m = document.getElementById('msg'); m.textContent = 'VanoLib: ' + (e.message || e); m.classList.add('on'); parent.postMessage({ vlCard: 'size', h: m.offsetHeight + 2 }, '*'); });
