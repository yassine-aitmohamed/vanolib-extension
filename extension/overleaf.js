(() => {
  if (window.__vlOverleaf) return;
  window.__vlOverleaf = true;

  const alive = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; } };
  let retired = false, unwatchTheme = () => {};
  function themePages() {
    document.querySelectorAll('.pdfViewer, .pdfjs-viewer, .pdfjs-viewer-container, .pdf-viewer-container, [data-testid=pdf-viewer]').forEach(root => {
      if (!root.querySelector('.cm-editor, .ace_editor')) root.classList.add('vl-ovl-surface');
    });
    document.querySelectorAll('.page, [data-page-number]').forEach(page => {
      if (!page.querySelector('canvas')) return;
      page.classList.add('vl-ovl-paper');
      const parent = page.closest('.pdfViewer, .pdfjs-viewer, .pdfjs-viewer-container, .pdf-viewer-container') || page.parentElement;
      if (parent && parent !== document.body && parent !== document.documentElement && !parent.querySelector('.cm-editor, .ace_editor')) parent.classList.add('vl-ovl-surface');
    });
  }
  function themeControls() {
    const button = document.getElementById('vl-ovl-btn'); if (!button) return;
    if (!document.getElementById('vl-ovl-theme')) {
      const controls = ReadingTheme.controls(); controls.id = 'vl-ovl-theme'; button.insertAdjacentElement('afterend', controls);
    }
    ReadingTheme.apply(document.documentElement.dataset.vlTheme);
  }
  ReadingTheme.get().then(theme => { if (!retired) { ReadingTheme.apply(theme); themePages(); themeControls(); } }).catch(() => { if (!alive()) retire(); });
  unwatchTheme = ReadingTheme.watch(theme => { if (!retired) { ReadingTheme.apply(theme); themePages(); } });
  function retire() {
    if (retired) return; retired = true;
    unwatchTheme();
    document.getElementById('vl-ovl-theme')?.remove();
    delete document.documentElement.dataset.vlTheme;
    document.querySelectorAll('.vl-ovl-paper, .vl-ovl-surface').forEach(node => node.classList.remove('vl-ovl-paper', 'vl-ovl-surface'));
    try { obs.disconnect(); } catch (e) {}
    const b = document.getElementById('vl-ovl-btn'); if (b) b.remove();
    if (frame) { frame.remove(); frame = null; }
    const n = document.createElement('div');
    n.textContent = 'VanoLib was updated: reload this page to use it again.';
    n.style.cssText = 'all:initial;position:fixed;z-index:2147483000;right:16px;bottom:16px;padding:10px 14px;border-radius:10px;background:#1f2328;color:#fff;font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);cursor:pointer';
    n.onclick = () => location.reload();
    document.documentElement.appendChild(n);
    setTimeout(() => n.remove(), 12000);
  }
  const project = () => (location.pathname.match(/\/project\/([0-9a-f]{24})/i) || [])[1] || '';
  const pdfLinks = () => [...document.querySelectorAll('a[href*="/output/"][href*="output.pdf"]')];
  const pdfUrl = () => { const a = pdfLinks().find(a => a.getAttribute('href') && a.getAttribute('href') !== '#'); return a ? a.href : ''; };
  const title = () => (document.title || '').replace(/\s*[-–|]\s*(Online LaTeX Editor\s*)?Overleaf.*$/i, '').trim() || 'Overleaf project';

  function isPdf(buf) { const u = new Uint8Array(buf.slice(0, 1024)); for (let i = 0; i < u.length - 3; i++) if (u[i] === 37 && u[i + 1] === 80 && u[i + 2] === 68 && u[i + 3] === 70) return true; return false; }
  function b64(buf) { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }

  let sentUrl = '', sentRevision = '', sendQueue = Promise.resolve();
  function send({ fresh = false } = {}) {
    const task = sendQueue.catch(() => {}).then(async () => {
      const url = pdfUrl(), p = project();
      if (!url || !p) throw new Error('Compile the project first');
      if (!fresh && url === sentUrl) return sentRevision;
      const r = await fetch(url, { credentials: 'include', cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = await r.arrayBuffer();
      if (!isPdf(buf)) throw new Error('The compiled file is not a PDF');
      if (url !== pdfUrl()) throw new Error('The PDF changed during reading; click the reference again');
      const revision = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map(x => x.toString(16).padStart(2, '0')).join('');
      const res = await chrome.runtime.sendMessage({ type: 'ovl-pdf', project: p, data: b64(buf), revision });
      if (!res || !res.ok) throw new Error((res && res.error) || 'VanoLib did not answer');
      sentUrl = url; sentRevision = revision;
      return revision;
    });
    sendQueue = task;
    return task;
  }

  function button() {
    if (document.getElementById('vl-ovl-btn')) { themeControls(); return; }
    const a = pdfLinks().find(a => a.classList.contains('pdf-toolbar-btn')) || pdfLinks()[0];
    if (!a || !a.parentElement) return;
    const b = document.createElement('button');
    b.id = 'vl-ovl-btn'; b.type = 'button'; b.textContent = 'VanoLib';
    b.title = 'Open this PDF in VanoLib Reader: citation cards, exact statements, research panel';
    b.style.cssText = 'all:initial;display:inline-flex;align-items:center;height:26px;margin:0 6px;padding:0 10px;border-radius:6px;background:#2563eb;color:#fff;font:600 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer;white-space:nowrap;align-self:center';
    b.onclick = async e => {
      e.preventDefault(); e.stopPropagation();
      if (!alive()) return retire();
      b.textContent = 'VanoLib…';
      try { await send({ fresh: true }); await chrome.runtime.sendMessage({ type: 'ovl-open', project: project(), title: title() }); b.textContent = 'VanoLib'; }
      catch (err) { b.textContent = 'VanoLib ⚠'; b.title = String(err.message || err); setTimeout(() => { b.textContent = 'VanoLib'; }, 4000); }
    };
    a.insertAdjacentElement('afterend', b); themeControls();
  }

  let t = null, last = '';
  const obs = new MutationObserver(() => {
    if (!alive()) return retire();
    themePages();
    clearTimeout(t);
    t = setTimeout(() => {
      if (!alive()) return retire();
      button();
      const u = pdfUrl();
      if (u && u !== last) { last = u; if (sentUrl) send().catch(() => {}); }
    }, 700);
  });
  obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['href'] });

  function textAfter(a) {
    const pg = a.closest('.page') || a.closest('[data-page-number]') || document;
    const rr = a.getBoundingClientRect(), mid = (rr.top + rr.bottom) / 2, h = rr.height || 12;
    const spans = [...pg.querySelectorAll('.textLayer span')].map(s => ({ s, b: s.getBoundingClientRect(), t: s.textContent })).filter(o => o.t && o.b.width > 0);
    const cut = o => {
      const node = o.s.firstChild;
      if (!node || node.nodeType !== 3) return o.t.slice(Math.round((rr.right - o.b.left) / o.b.width * o.t.length));
      const rg = document.createRange();
      for (let i = 0; i < node.length; i++) { rg.setStart(node, i); rg.setEnd(node, i + 1); const r = rg.getBoundingClientRect(); if (r.width && (r.left + r.right) / 2 > rr.right) return node.data.slice(i); }
      return '';
    };
    const join = list => { let out = '', end = null; for (const o of list) { if (end != null && o.b.left - end > 2 && !/\s$/.test(out)) out += ' '; out += o.t; end = o.b.right; } return out; };
    let out = join(spans.filter(o => o.b.top < mid && o.b.bottom > mid && o.b.right > rr.right + 0.5).sort((x, y) => x.b.left - y.b.left)
      .map(o => o.b.left >= rr.right - 1 ? o : { b: o.b, t: cut(o) }));
    if (!/[\])]/.test(out) && out.length < 40) {
      const below = spans.filter(o => o.b.top > rr.bottom - 2 && o.b.top < rr.bottom + h * 1.9);
      if (below.length) { const t0 = Math.min(...below.map(o => o.b.top)); out += ' ' + join(below.filter(o => o.b.top < t0 + h * 0.5).sort((x, y) => x.b.left - y.b.left)); }
    }
    return out.slice(0, 90);
  }

  function textUnder(a) {
    const pg = a.closest('.page') || a.closest('[data-page-number]');
    if (!pg) return '';
    const box = a.getBoundingClientRect(), range = document.createRange(); let text = '';
    pg.querySelectorAll('.textLayer span').forEach(span => {
      const b = span.getBoundingClientRect();
      if (b.right <= box.left || b.left >= box.right || b.bottom <= box.top || b.top >= box.bottom) return;
      const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        let first = -1, last = -1;
        for (let i=0; i<node.length; i++) {
          range.setStart(node,i); range.setEnd(node,i+1); const r=range.getBoundingClientRect();
          const x=(r.left+r.right)/2,y=(r.top+r.bottom)/2;
          if (r.width && x>box.left && x<box.right && y>box.top-1 && y<box.bottom+1) { if (first < 0) first = i; last = i; }
        }
        if (first < 0) continue;
        const word = c => /[\p{L}\p{N}+]/u.test(c || '');
        if (word(node.data[first])) while (first > 0 && word(node.data[first-1])) first--;
        if (word(node.data[last])) while (last < node.length-1 && word(node.data[last+1])) last++;
        text += node.data.slice(first, last+1);
      }
    });
    return text;
  }

  let frame = null, cardGeneration = 0;
  function closeCard() { ++cardGeneration; if (frame) { frame.remove(); frame = null; } }
  async function openCard(x, y, dest, after, printed) {
    closeCard(); const generation = cardGeneration;
    let revision;
    try { revision = await send({ fresh: true }); } catch (err) { if (!alive()) retire(); return; }
    if (generation !== cardGeneration) return;
    if (!alive()) return retire();
    const w = Math.min(640, innerWidth - 20);
    const f = frame = document.createElement('iframe');
    f.id = 'vl-ovl-card'; f.allow = 'clipboard-write';
    f.src = chrome.runtime.getURL('card.html') + '?' + new URLSearchParams({ project: project(), dest, after, printed, revision });
    f.style.cssText = `all:initial;position:fixed;z-index:2147483000;width:${w}px;height:90px;border:0;border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.22);background:transparent;color-scheme:normal;left:${Math.max(10, Math.min(x - w / 2, innerWidth - w - 10))}px;` +
      (y < innerHeight * 0.55 ? `top:${y + 14}px` : `bottom:${innerHeight - y + 14}px`);
    document.documentElement.appendChild(f);
  }
  window.addEventListener('message', e => {
    if (!frame || e.source !== frame.contentWindow || !e.data || !e.data.vlCard) return;
    if (e.data.vlCard === 'size') {
      const h = Math.min(e.data.h, innerHeight - 20);
      frame.style.height = h + 'px';
      if (frame.style.top) { const top = parseFloat(frame.style.top); if (top + h > innerHeight - 10) frame.style.top = Math.max(10, innerHeight - h - 10) + 'px'; }
      else { const bottom = parseFloat(frame.style.bottom); if (bottom + h > innerHeight - 10) frame.style.bottom = Math.max(10, innerHeight - h - 10) + 'px'; }
    }
    if (e.data.vlCard === 'close') closeCard();
    if (e.data.vlCard === 'go') goThere();
  });
  document.addEventListener('mousedown', e => { if (frame && e.target !== frame) closeCard(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCard(); }, true);

  const JUMP = /^(section|subsection|subsubsection|paragraph|chapter|part|appendix|page|Hfootnote|footnote|Doc-Start|toc|Item)\b/i;
  let lastLink = null, bypass = false;
  document.addEventListener('click', e => {
    if (bypass) return;
    const a = e.target.closest && e.target.closest('.annotationLayer a[href*="#"]');
    if (!a || e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (!alive()) return retire();
    const href = a.getAttribute('href') || '';
    if (!href.startsWith('#') && !href.startsWith(location.href.split('#')[0] + '#')) return;
    const dest = decodeURIComponent(href.split('#').pop());
    if (!dest || (!/^cite\./.test(dest) && JUMP.test(dest.replace(/\*/g, '')))) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    lastLink = a;
    openCard(e.clientX, e.clientY, dest, /^cite\./.test(dest) ? textAfter(a) : '', textUnder(a));
  }, true);
  function goThere() {
    const a = lastLink; closeCard();
    if (!a || !a.isConnected) return;
    bypass = true; try { a.click(); } finally { bypass = false; }
  }

  button(); themePages();
})();
