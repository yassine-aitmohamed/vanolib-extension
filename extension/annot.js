const Annot = (() => {
  const COLORS = ['#e5484d', '#2f6fed', '#1f9d55', '#111111', '#f2c94c', '#ff69a5'];
  const NS = 'http://www.w3.org/2000/svg';
  let R, KEY, data = { strokes: {}, notes: [] }, tool = '', color = COLORS[0], width = 2, saveT = null, drawing = null, bar = null;

  const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => chrome.storage.local.set({ ['ink:' + KEY]: data }), 400); };
  let undoS = [], redoS = [], last = '', restoring = false, baseChanged = null;
  const snapshot = () => JSON.stringify({ d: data, h: (R && R.hls[R.key]) || [] });
  function commit() {
    if (restoring) return;
    const cur = snapshot();
    if (cur === last) return;
    if (last) { undoS.push(last); if (undoS.length > 200) undoS.shift(); }
    redoS = []; last = cur; paintUR();
  }
  const save = () => { persist(); commit(); };
  function restore(state) {
    restoring = true;
    const o = JSON.parse(state);
    data = o.d; R.hls[R.key] = o.h;
    drawAll(); R.drawAllHL(); baseChanged && baseChanged(); persist();
    last = state; restoring = false; paintUR();
  }
  function undo() { if (!undoS.length) return R.toast('Nothing to undo'); redoS.push(last); restore(undoS.pop()); R.toast('Undone'); }
  function redo() { if (!redoS.length) return R.toast('Nothing to redo'); undoS.push(last); restore(redoS.pop()); R.toast('Redone'); }
  function paintUR() { if (!bar) return; bar.querySelector('.vl-undo').disabled = !undoS.length; bar.querySelector('.vl-redo').disabled = !redoS.length; }
  const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function layers(i) {
    const d = R.pg[i]; if (!d) return null;
    let svg = d.querySelector('svg.inkL');
    if (!svg) {
      svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'inkL'); svg.setAttribute('viewBox', '0 0 1 1'); svg.setAttribute('preserveAspectRatio', 'none');
      d.appendChild(svg);
      const nl = document.createElement('div'); nl.className = 'noteL'; d.appendChild(nl);
      svg.addEventListener('pointerdown', e => down(e, i));
      nl.addEventListener('click', e => { if (tool === 'note' && e.target === nl) placeNote(e, i); });
    }
    return { svg, nl: d.querySelector('.noteL') };
  }
  function pathD(pts) {
    if (!pts.length) return '';
    let s = `M${pts[0][0]} ${pts[0][1]}`;
    for (let k = 1; k < pts.length; k++) {
      const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
      s += ` Q${x0} ${y0} ${(x0 + x1) / 2} ${(y0 + y1) / 2}`;
    }
    const L = pts[pts.length - 1]; return s + ` L${L[0]} ${L[1]}`;
  }
  function drawPage(i) {
    const l = layers(i); if (!l) return;
    l.svg.innerHTML = '';
    (data.strokes[i] || []).forEach((st, idx) => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', pathD(st.pts));
      p.setAttribute('fill', 'none'); p.setAttribute('stroke', st.c); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
      p.setAttribute('vector-effect', 'non-scaling-stroke');
      p.setAttribute('stroke-width', String((st.t === 'hl' ? 14 : st.w) * (R.scale || 1)));
      if (st.t === 'hl') { p.setAttribute('stroke-opacity', '0.35'); p.style.mixBlendMode = 'multiply'; }
      p.dataset.idx = idx; l.svg.appendChild(p);
    });
    l.nl.innerHTML = data.notes.filter(n => n.page === i).map(n =>
      `<div class="vlnote" data-id="${n.id}" style="left:${n.x * 100}%;top:${n.y * 100}%"><span class="pin">💬</span><div class="bub">${esc(n.text) || '<i>Empty note</i>'}</div></div>`).join('');
    l.nl.querySelectorAll('.vlnote').forEach(el => el.onclick = e => { e.stopPropagation(); editNote(el.dataset.id); });
  }
  function drawAll() { for (let i = 1; i <= R.n; i++) drawPage(i); }

  function pos(e, svg) { const r = svg.getBoundingClientRect(); return [+((e.clientX - r.left) / r.width).toFixed(4), +((e.clientY - r.top) / r.height).toFixed(4)]; }
  function down(e, i) {
    if (!tool) return;
    const svg = e.currentTarget;
    if (tool === 'erase') { const p = e.target.closest('path'); if (p) { data.strokes[i].splice(+p.dataset.idx, 1); drawPage(i); save(); } return; }
    if (tool !== 'pen' && tool !== 'hl') return;
    e.preventDefault(); svg.setPointerCapture(e.pointerId);
    drawing = { i, svg, st: { t: tool, c: tool === 'hl' ? (color === '#111111' ? '#f2c94c' : color) : color, w: width, pts: [pos(e, svg)] } };
    (data.strokes[i] = data.strokes[i] || []).push(drawing.st);
    svg.onpointermove = ev => { if (!drawing) return; const q = pos(ev, svg), L = drawing.st.pts[drawing.st.pts.length - 1];
      if (Math.hypot(q[0] - L[0], q[1] - L[1]) > 0.002) { drawing.st.pts.push(q); drawPage(i); } };
    svg.onpointerup = () => { if (drawing && drawing.st.pts.length < 2) data.strokes[i].pop(); drawing = null; svg.onpointermove = null; drawPage(i); save(); };
  }

  function placeNote(e, i) {
    const r = e.currentTarget.getBoundingClientRect();
    const n = { id: 'n' + Date.now(), page: i, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, text: '' };
    data.notes.push(n); drawPage(i); save(); editNote(n.id);
  }
  function editNote(id) {
    const n = data.notes.find(x => x.id === id); if (!n) return;
    popup(`<textarea placeholder="Write your comment…">${esc(n.text)}</textarea>`, v => { n.text = v; drawPage(n.page); save(); },
      () => { data.notes = data.notes.filter(x => x.id !== id); drawPage(n.page); save(); });
  }
  function popup(html, onSave, onDelete) {
    document.querySelectorAll('.vlpop').forEach(x => x.remove());
    const p = document.createElement('div'); p.className = 'vlpop';
    p.innerHTML = `<b>Comment</b>${html}<div class="row">${onDelete ? '<button class="del">Delete</button>' : ''}<span></span><button class="cancel">Cancel</button><button class="ok">Save</button></div>`;
    (document.fullscreenElement || document.body).appendChild(p);
    const ta = p.querySelector('textarea'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    const close = () => p.remove();
    p.querySelector('.ok').onclick = () => { onSave(ta.value.trim()); close(); };
    p.querySelector('.cancel').onclick = close;
    if (onDelete) p.querySelector('.del').onclick = () => { onDelete(); close(); };
    ta.onkeydown = e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) p.querySelector('.ok').click(); if (e.key === 'Escape') close(); e.stopPropagation(); };
  }

  function hookHighlights() {
    const sel = R.$('.rsel');
    const mk = (txt, title, fn) => { const b = document.createElement('button'); b.className = 't'; b.innerHTML = txt; b.title = title;
      b.onmousedown = e => { e.preventDefault(); fn(); }; sel.insertBefore(b, sel.querySelector('[data-a=copy]')); };
    const lastHL = () => (R.hls[R.key] || [])[(R.hls[R.key] || []).length - 1];
    mk('<u>U</u>', 'Underline the selection', () => { const n0 = (R.hls[R.key] || []).length; R.addHL('blue');
      const h = lastHL(); if (h && (R.hls[R.key] || []).length > n0) { h.style = 'u'; h.uc = color === '#f2c94c' ? '#2f6fed' : color; Object.keys(h.parts).forEach(i => R.drawHL(+i)); R.changedHL(); } });
    mk('💬', 'Comment on the selection', () => { const n0 = (R.hls[R.key] || []).length; R.addHL('yellow');
      const h = lastHL(); if (h && (R.hls[R.key] || []).length > n0) editHLNote(h.id); });
    const base = R.drawHL.bind(R);
    R.drawHL = function (i) {
      base(i);
      const L = this.pg[i] && this.pg[i].querySelector('.hlL'); if (!L) return;
      (this.hls[this.key] || []).forEach(h => {
        const parts = h.parts[i] || [];
        if (h.style === 'u') L.querySelectorAll(`i[data-id="${h.id}"]`).forEach(e => { e.style.background = 'transparent'; e.style.borderBottom = `2px solid ${h.uc || '#2f6fed'}`; e.style.mixBlendMode = 'normal'; });
        if (h.note && parts.length && h.page === i) {
          const q = parts[0], pin = document.createElement('b'); pin.className = 'hlpin'; pin.textContent = '💬'; pin.title = h.note;
          Object.assign(pin.style, { left: (q[0] * 100) + '%', top: (q[1] * 100) + '%' });
          pin.onclick = e => { e.stopPropagation(); editHLNote(h.id); }; L.appendChild(pin);
        }
      });
    };
    const baseList = R.renderHLList.bind(R);
    R.renderHLList = function () {
      baseList();
      if (this.tab !== 'hl') return;
      (this.hls[this.key] || []).forEach(h => {
        const row = this.pane.querySelector(`.rhl[data-id="${h.id}"]`); if (!row) return;
        if (h.note) { const n = document.createElement('div'); n.className = 'rhlnote'; n.textContent = '💬 ' + h.note; row.insertBefore(n, row.querySelector('small')); }
        const b = document.createElement('button'); b.className = 'x'; b.style.right = '26px'; b.textContent = '💬'; b.title = 'Comment';
        b.onclick = e => { e.stopPropagation(); editHLNote(h.id); }; row.appendChild(b);
      });
      const notes = data.notes.filter(n => n.text);
      if (notes.length) this.pane.insertAdjacentHTML('beforeend', '<div class="rmsg" style="margin-top:10px"><b>Notes on pages</b></div>' +
        notes.map(n => `<div class="rhl vlnrow" data-nid="${n.id}">💬 ${esc(n.text.slice(0, 160))}<small>p. ${n.page}</small></div>`).join(''));
      this.pane.querySelectorAll('.vlnrow').forEach(r => r.onclick = () => { const n = data.notes.find(x => x.id === r.dataset.nid); if (n) R.goto && R.goto(n.page); });
    };
  }
  function editHLNote(id) {
    const h = (R.hls[R.key] || []).find(x => x.id == id); if (!h) return;
    popup(`<blockquote>${esc(h.text.slice(0, 220))}</blockquote><textarea placeholder="Your comment on this passage…">${esc(h.note)}</textarea>`,
      v => { h.note = v; Object.keys(h.parts).forEach(i => R.drawHL(+i)); R.changedHL(); },
      h.note ? () => { h.note = ''; Object.keys(h.parts).forEach(i => R.drawHL(+i)); R.changedHL(); } : null);
  }

  function setTool(t) {
    tool = tool === t ? '' : t;
    R.rdr.classList.toggle('vl-inking', !!tool);
    R.rdr.dataset.tool = tool;
    bar.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('vl-on', b.dataset.tool === tool));
    if (tool) R.toast({ pen: 'Pen: draw on the page', hl: 'Highlighter: paint over lines', note: 'Comment: click where to add a note', erase: 'Eraser: click a stroke to remove it' }[tool]);
  }
  function buildBar() {
    const rtb = R.rdr.querySelector('.rtb');
    bar = document.createElement('span'); bar.className = 'vl-annbar';
    bar.innerHTML = `<span class="sep"></span>
      <button class="vl-undo" title="Undo (⌘Z)" disabled>↶</button>
      <button class="vl-redo" title="Redo (⌘⇧Z)" disabled>↷</button>
      <button data-tool="pen" title="Pen (P)">✎</button>
      <button data-tool="hl" title="Highlighter (H)">🖍</button>
      <button data-tool="note" title="Add a comment on the page (N)">💬</button>
      <button data-tool="erase" title="Eraser (E)">⌫</button>
      <span class="vl-sw">${COLORS.map(c => `<i data-c="${c}" style="background:${c}"></i>`).join('')}</span>
      <select class="vl-w" title="Pen width"><option value="1.5">thin</option><option value="2.5" selected>medium</option><option value="4">thick</option></select>`;
    const anchor = rtb.querySelector('.title');
    rtb.insertBefore(bar, anchor);
    bar.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
    bar.querySelector('.vl-undo').onclick = undo;
    bar.querySelector('.vl-redo').onclick = redo;
    bar.querySelectorAll('.vl-sw i').forEach(s => s.onclick = () => { color = s.dataset.c; bar.querySelectorAll('.vl-sw i').forEach(x => x.classList.toggle('on', x === s)); chrome.storage.local.set({ inkColor: color }); });
    bar.querySelector('.vl-w').onchange = e => { width = +e.target.value; chrome.storage.local.set({ inkWidth: width }); };
    document.addEventListener('keydown', e => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = { p: 'pen', h: 'hl', n: 'note', e: 'erase' }[e.key.toLowerCase()];
      if (t) { e.preventDefault(); setTool(t); } else if (e.key === 'Escape' && tool) setTool(tool);
    });
  }

  async function attach(reader, key) {
    R = reader; KEY = key;
    const st = await chrome.storage.local.get(['ink:' + key, 'inkColor', 'inkWidth']);
    data = st['ink:' + key] || { strokes: {}, notes: [] };
    data.strokes = data.strokes || {}; data.notes = data.notes || [];
    color = st.inkColor || color; width = st.inkWidth || width;
    buildBar();
    bar.querySelectorAll('.vl-sw i').forEach(x => x.classList.toggle('on', x.dataset.c === color));
    bar.querySelector('.vl-w').value = String(width);
    hookHighlights();
    baseChanged = R.changedHL.bind(R);
    R.changedHL = function () { baseChanged(); commit(); };
    const baseLayout = R.layout.bind(R);
    R.layout = function () { baseLayout(); drawAll(); };
    drawAll(); R.drawAllHL();
    last = snapshot(); paintUR();
  }
  return { attach, hasData: () => Object.values(data.strokes).some(a => a.length) || data.notes.length };
})();
