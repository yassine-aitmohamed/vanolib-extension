const P = new URLSearchParams(location.search);
const FILE = P.get('file') || '';
const KEY = VL.keyOf(FILE);
let BYTES = null, R = null, SAVE_BTN = null, TITLE = '';

(async () => {
  const theme = (await VL.get('theme')) || 'day';
  R = new Reader(document.getElementById('host'), {
    side: false, hlTab: true, theme,
    onTheme: t => VL.set('theme', t),
    loadDoc: async k => ({ state: await VL.get('st:' + k), highlights: await VL.get('hl:' + k) }),
    persist: (k, snap) => { VL.set('st:' + k, snap); if (FILE && k === KEY) VL.touch(FILE, { page: snap.page, pages: snap.pages }); },
    saveHL: (k, h) => VL.set('hl:' + k, h),
    openUrl: u => window.open(u, '_blank', 'noopener'),
    onFile: d => R.open(d)
  });
  const rtb = R.rdr.querySelector('.rtb');
  const add = (html, title, fn) => { const b = document.createElement('button'); b.className = 'vl-x'; b.innerHTML = html; b.title = title; b.onclick = fn; rtb.appendChild(b); return b; };
  SAVE_BTN = add('☆ <span class="lb">Save</span>', 'Save to your reading list (kept offline, ⌘D)', toggleSave);
  add('⤓ <span class="lb">Download</span>', 'Download this PDF to your computer (⌘S)', download);
  add('＋ <span class="lb">VanoLib</span>', 'Add this PDF to your VanoAtlas library (My papers)', sendToVanoLib);
  add('❝ <span class="lb">Cite</span>', 'Copy the BibTeX of this paper', function () { Cite.paper(R, FILE, this); });
  add('🔎 <span class="lb">Research</span>', 'Research panel: this paper, cited by, related papers, verified references, .bib export', () => Research.openPanel(R));
  add('☰ <span class="lb">Reading list</span>', 'Open your saved and recent PDFs', () => openTab(chrome.runtime.getURL('library.html')));
  add('↗', 'Open in Chrome’s built-in PDF viewer', () => { location.href = FILE + (FILE.includes('#') ? '&' : '#') + 'novanolib'; });
  document.addEventListener('keydown', e => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); download(); } else if (k === 'd') { e.preventDefault(); toggleSave(); }
  }, true);
  if (!FILE) { R.empty('<b>VanoLib Reader</b>Open a PDF in Chrome, or drop a file here.'); return; }
  const name = VL.nameOf(FILE);
  TITLE = name;
  document.title = name + ' — VanoLib Reader';
  R.empty('Loading…');
  const saved = await VL.isSaved(FILE);
  paintSave(saved);
  const cached = saved ? await VL.dbGet(KEY) : null;
  try {
    if (cached) BYTES = cached;
    else BYTES = await fetchPdf(FILE);
    if (!BYTES && /^https?:/.test(FILE)) { R.empty('Getting the PDF with your journal login…'); BYTES = await viaDownload(FILE); }
    if (!BYTES) {
      await rememberNative(FILE);
      location.replace(FILE + (FILE.includes('#') ? '&' : '#') + 'novanolib');
      return;
    }
  } catch (e) {
    const err = document.getElementById('vlErr');
    err.style.display = 'grid';
    err.innerHTML = '<div><b>Could not load this PDF</b><br>' + ESCV(String(e.message || e)) +
      (FILE.startsWith('file:') ? '<br><br>For files on your Mac: chrome://extensions → VanoLib Reader → Details → turn on “Allow access to file URLs”.' : '') +
      '<br><br><a href="' + ESCV(FILE) + '#novanolib">Open with Chrome’s PDF viewer</a></div>';
    return;
  }
  const buf = BYTES;
  await R.open({ key: KEY, title: name, bytes: () => new Uint8Array(buf.slice(0)) });
  Cite.attach(R);
  Research.attach(R);
  try { await Annot.attach(R, KEY); } catch (e) { console.warn('annotations', e); }
  try {
    const md = await R.pdf.getMetadata();
    const t = md && md.info && md.info.Title;
    if (t && t.trim().length > 3 && !/^untitled|^microsoft word/i.test(t.trim())) {
      TITLE = t.trim(); document.title = TITLE + ' — VanoLib Reader'; R.title = TITLE; R.$('.title').textContent = TITLE;
    }
  } catch (e) {}
  VL.touch(FILE, { title: TITLE, pages: R.pdf ? R.pdf.numPages : undefined });
  if (saved && !cached) VL.dbPut(KEY, BYTES).catch(() => {});
  if (saved && !(await VL.textGet(KEY))) VL.index(KEY, R.pdf, { url: FILE, title: TITLE }).catch(() => {});
  const goPage = +P.get('page'), goQ = (P.get('q') || '').trim();
  const goTop = P.get('top') ? +P.get('top') + 14 : null;
  if (goPage) { R.goto(goPage, goTop); await new Promise(r => setTimeout(r, 120)); R.onScroll(true); }
  if (goQ) { const s = R.$('.rsearch'); s.classList.add('on'); s.querySelector('input').value = goQ; await R.search(goQ); }
})();

function openTab(url) { chrome.tabs.create({ url }); }

function isPdf(buf) {
  const u = new Uint8Array(buf.slice(0, 1024));
  for (let i = 0; i < u.length - 3; i++) if (u[i] === 37 && u[i + 1] === 80 && u[i + 2] === 68 && u[i + 3] === 70) return true;
  return false;
}
async function fetchPdf(url, depth = 0) {
  let r = await fetch(url, { credentials: 'include', redirect: 'follow' });
  if (!r.ok && depth === 0) r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = await r.arrayBuffer();
  if (isPdf(buf)) return buf;
  if (depth < 1) {
    const html = new TextDecoder().decode(buf.slice(0, 400000));
    const m = html.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]+url=([^"'>\s]+)/i)
      || html.match(/<(?:iframe|embed)[^>]+src=["']([^"']+)["']/i)
      || html.match(/href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/i)
      || html.match(/["'](https?:\/\/[^"'\s]+\/pdf[^"'\s]*)["']/i);
    if (m) { try { return await fetchPdf(new URL(m[1].replace(/&amp;/g, '&'), r.url || url).href, depth + 1); } catch (e) {} }
  }
  return null;
}
async function viaDownload(url) {
  try {
    const allowed = await new Promise(res => chrome.extension.isAllowedFileSchemeAccess(res));
    if (!allowed) return null;
    const id = await chrome.downloads.download({ url, filename: 'VanoLib/.cache/' + Date.now() + '.pdf', conflictAction: 'uniquify', saveAs: false });
    const item = await new Promise((res, rej) => {
      const t = setTimeout(() => { chrome.downloads.onChanged.removeListener(on); rej(new Error('timeout')); }, 120000);
      function on(d) {
        if (d.id !== id || !d.state) return;
        if (d.state.current === 'complete') { clearTimeout(t); chrome.downloads.onChanged.removeListener(on); chrome.downloads.search({ id }, r => res(r[0])); }
        if (d.state.current === 'interrupted') { clearTimeout(t); chrome.downloads.onChanged.removeListener(on); rej(new Error('interrupted')); }
      }
      chrome.downloads.onChanged.addListener(on);
    });
    const buf = await (await fetch('file://' + item.filename.split('/').map(encodeURIComponent).join('/'))).arrayBuffer();
    chrome.downloads.removeFile(id, () => chrome.downloads.erase({ id }));
    return isPdf(buf) ? buf : null;
  } catch (e) { return null; }
}
async function rememberNative(url) {
  try { const h = new URL(url).hostname; const L = (await VL.get('nativeHosts')) || [];
    if (!L.includes(h)) { L.push(h); await VL.set('nativeHosts', L.slice(-100)); } } catch (e) {}
}
function paintSave(on) { if (SAVE_BTN) { SAVE_BTN.innerHTML = on ? '★ <span class="lb">Saved</span>' : '☆ <span class="lb">Save</span>'; SAVE_BTN.classList.toggle('vl-on', on); } }

async function toggleSave() {
  if (!FILE || !BYTES) return R.toast('Nothing to save yet');
  if (await VL.isSaved(FILE)) { await VL.unsave(FILE); paintSave(false); return R.toast('Removed from your reading list'); }
  const st = (await VL.get('st:' + KEY)) || {};
  await VL.save({ url: FILE, title: TITLE, pages: R.pdf ? R.pdf.numPages : st.pages, page: st.page || 1, size: BYTES.byteLength });
  try { await VL.dbPut(KEY, BYTES.slice(0)); } catch (e) {}
  try { if (R.pdf) VL.index(KEY, R.pdf, { url: FILE, title: TITLE }).then(async () => { if (!(await VL.isSaved(FILE))) VL.textDel(KEY); }); } catch (e) {}
  paintSave(true);
  R.toast('Saved to your reading list ★');
}

function fileName() {
  const base = (TITLE && TITLE !== VL.nameOf(FILE) ? TITLE : VL.nameOf(FILE).replace(/\.pdf$/i, ''))
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140) || 'document';
  return base + '.pdf';
}
async function download() {
  if (!BYTES) return R.toast('Nothing to download yet');
  const url = URL.createObjectURL(new Blob([BYTES], { type: 'application/pdf' }));
  try {
    await chrome.downloads.download({ url, filename: 'VanoLib/' + fileName(), saveAs: false, conflictAction: 'uniquify' });
    R.toast('Downloaded to Downloads/VanoLib ⤓');
  } catch (e) {
    const a = document.createElement('a'); a.href = url; a.download = fileName(); document.body.appendChild(a); a.click(); a.remove();
    R.toast('Downloaded ⤓');
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function sendToVanoLib() {
  if (!BYTES) return R.toast('Nothing to send yet');
  const port = (await VL.get('port')) || 8770;
  let bin = ''; const u = new Uint8Array(BYTES);
  for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  const name = VL.nameOf(FILE);
  R.toast('Sending to VanoLib…');
  try {
    const r = await fetch(`http://localhost:${port}/vanolib/api/import_pdf`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: /\.pdf$/i.test(name) ? name : name + '.pdf', data: btoa(bin), title: TITLE && TITLE !== name ? TITLE : '' })
    });
    const j = await r.json();
    R.toast(j && j.ok ? (j.existing ? 'Already in VanoLib ✓' : 'Added to VanoLib · My papers ✓') : ('Error: ' + ((j && (j.error || j.message)) || r.status)));
  } catch (e) {
    R.toast('VanoAtlas is not responding (port ' + port + ')');
  }
}
