let TAB = 'saved';
const host = u => { try { return u.startsWith('file:') ? 'On this computer' : new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
async function paint() {
  const [saved, recent] = [await VL.saved(), (await VL.get('recent')) || []];
  document.getElementById('nS').textContent = saved.length ? '· ' + saved.length : '';
  document.getElementById('nR').textContent = recent.length ? '· ' + recent.length : '';
  const savedKeys = new Set(saved.map(x => VL.keyOf(x.url)));
  const recMap = new Map(recent.map(x => [VL.keyOf(x.url), x]));
  const q = document.getElementById('q').value.trim().toLowerCase();
  let items = TAB === 'saved' ? saved.map(x => ({ ...x, ...(recMap.get(VL.keyOf(x.url)) || {}), savedAt: x.savedAt })) : recent;
  if (q) items = items.filter(x => ((x.title || '') + ' ' + x.url).toLowerCase().includes(q));
  const L = document.getElementById('list');
  if (!items.length) {
    L.innerHTML = '<div class="empty">' + (q ? 'No match.' : TAB === 'saved'
      ? 'Nothing saved yet.<br>Open a PDF and click <b>☆ Save</b> (or press ⌘D) to keep it here — it stays readable offline.'
      : 'No PDF opened yet.') + '</div>';
    return;
  }
  L.innerHTML = items.map((x, i) => {
    const pct = x.pages ? Math.round(100 * Math.min(1, (x.page || 1) / x.pages)) : 0;
    const isS = savedKeys.has(VL.keyOf(x.url));
    const when = TAB === 'saved' ? 'saved ' + VL.ago(x.savedAt) + (x.openedAt ? ' · read ' + VL.ago(x.openedAt) : '') : 'opened ' + VL.ago(x.openedAt);
    return `<div class="it" data-i="${i}"><div class="ic">PDF</div><div class="bd"><div class="t">${ESCV(x.title || VL.nameOf(x.url))}</div>
      <div class="m">${ESCV(host(x.url))} · ${x.pages ? 'page ' + (x.page || 1) + ' / ' + x.pages + ' · ' : ''}${when}</div>
      <div class="bar"><i style="width:${pct}%"></i></div></div>
      <div class="acts">${TAB === 'recent' ? `<button data-a="save">${isS ? '★ Saved' : '☆ Save'}</button>` : ''}<button data-a="src" title="Open the original address">↗</button>
      <button data-a="rm" title="${TAB === 'saved' ? 'Remove from the reading list' : 'Remove from history'}">✕</button></div></div>`;
  }).join('');
  L.querySelectorAll('.it').forEach(el => {
    const x = items[+el.dataset.i];
    el.onclick = async e => {
      const a = e.target.closest('button') && e.target.closest('button').dataset.a;
      if (!a) return chrome.tabs.create({ url: VL.viewer(x.url) });
      e.stopPropagation();
      if (a === 'src') chrome.tabs.create({ url: x.url + (x.url.includes('#') ? '&' : '#') + 'novanolib' });
      else if (a === 'rm') {
        if (TAB === 'saved') await VL.unsave(x.url);
        else await VL.set('recent', ((await VL.get('recent')) || []).filter(y => VL.keyOf(y.url) !== VL.keyOf(x.url)));
        paint();
      } else if (a === 'save') {
        if (savedKeys.has(VL.keyOf(x.url))) await VL.unsave(x.url);
        else {
          await VL.save({ url: x.url, title: x.title, pages: x.pages, page: x.page });
          try { const r = await fetch(x.url, { credentials: 'include' }); if (r.ok) await VL.dbPut(VL.keyOf(x.url), await r.arrayBuffer()); } catch (e2) {}
        }
        paint();
      }
    };
  });
}
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  TAB = b.dataset.t; document.querySelectorAll('.tabs button').forEach(c => c.classList.toggle('on', c === b)); paint();
});
document.getElementById('q').oninput = () => { paint(); clearTimeout(window.__ft); window.__ft = setTimeout(fullText, 250); };

const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
async function fullText() {
  const box = document.getElementById('ft'), q = document.getElementById('q').value.trim();
  if (q.length < 3) { box.innerHTML = ''; return; }
  const saved = await VL.saved(), words = q.toLowerCase().split(/\s+/).filter(Boolean), out = [];
  for (const x of saved) {
    const tx = await VL.textGet(VL.keyOf(x.url)); if (!tx) continue;
    const hits = [];
    tx.pages.forEach((p, i) => {
      const low = p.toLowerCase(); if (!words.every(w => low.includes(w))) return;
      const at = low.indexOf(words[0]), a = Math.max(0, at - 70), b = Math.min(p.length, at + words[0].length + 110);
      hits.push({ page: i + 1, snip: (a ? '…' : '') + p.slice(a, b).replace(/\s+/g, ' ') + (b < p.length ? '…' : '') });
    });
    if (hits.length) out.push({ x, hits });
  }
  const re = new RegExp('(' + words.map(escRe).join('|') + ')', 'gi');
  box.className = 'ft';
  box.innerHTML = out.length ? '<h2>In the text of your saved PDFs</h2>' + out.map((o, k) => `<div class="fd"><div class="t" data-k="${k}">${ESCV(o.x.title || VL.nameOf(o.x.url))} <span style="color:var(--mu);font-weight:400">· ${o.hits.length} page${o.hits.length > 1 ? 's' : ''}</span></div>
    ${o.hits.slice(0, 4).map(h => `<div class="hit" data-k="${k}" data-p="${h.page}"><b class="p">p. ${h.page}</b><span>${ESCV(h.snip).replace(re, '<mark>$1</mark>')}</span></div>`).join('')}</div>`).join('')
    : '<h2>In the text of your saved PDFs</h2><div class="idx">No page contains “' + ESCV(q) + '”.</div>';
  box.querySelectorAll('[data-k]').forEach(el => el.onclick = () => {
    const o = out[+el.dataset.k]; const p = el.dataset.p || o.hits[0].page;
    chrome.tabs.create({ url: VL.viewer(o.x.url) + '&page=' + p + '&q=' + encodeURIComponent(q) });
  });
}
(async () => {
  if (!window.pdfjsLib) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');
  for (const x of await VL.saved()) {
    const k = VL.keyOf(x.url);
    if (await VL.textGet(k)) continue;
    const buf = await VL.dbGet(k); if (!buf) continue;
    try { const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)), isEvalSupported: false }).promise; await VL.index(k, pdf, { url: x.url, title: x.title }); pdf.destroy(); } catch (e) {}
  }
})();
const say = t => { const n = document.getElementById('note'); n.textContent = t; clearTimeout(say.t); say.t = setTimeout(() => n.textContent = '', 8000); };
document.getElementById('exp').onclick = async () => {
  const all = await chrome.storage.local.get(null), titles = {};
  [...(all.saved || []), ...(all.recent || [])].forEach(x => { if (x && x.url) titles[VL.keyOf(x.url)] = { title: x.title || '', url: x.url }; });
  const items = {};
  for (const [k, v] of Object.entries(all)) {
    if (!/^(hl|ink):/.test(k)) continue;
    const empty = k.startsWith('hl:') ? !(v || []).length : !(Object.values((v && v.strokes) || {}).some(a => a.length) || ((v && v.notes) || []).length || ((v && v.texts) || []).length);
    if (!empty) items[k] = v;
  }
  const n = Object.keys(items).length;
  if (!n) return say('No annotation to export yet.');
  const docs = {}; Object.keys(items).forEach(k => { const d = k.replace(/^(hl|ink):/, ''); if (titles[d]) docs[d] = titles[d]; });
  const blob = new Blob([JSON.stringify({ app: 'VanoLib Reader', kind: 'annotations', version: 1, exported: new Date().toISOString(), documents: docs, items }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'vanolib-annotations-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  say('Exported the annotations of ' + new Set(Object.keys(items).map(k => k.replace(/^(hl|ink):/, ''))).size + ' PDF(s).');
};
document.getElementById('imp').onclick = () => document.getElementById('impf').click();
document.getElementById('impf').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  let o; try { o = JSON.parse(await f.text()); } catch (err) { return say('This file is not a VanoLib annotations file.'); }
  if (!o || o.kind !== 'annotations' || typeof o.items !== 'object') return say('This file is not a VanoLib annotations file.');
  const keys = Object.keys(o.items).filter(k => /^(hl|ink):/.test(k));
  const cur = await chrome.storage.local.get(keys), out = {};
  let added = 0;
  const byId = (a, b) => { const ids = new Set(a.map(x => x && x.id)); const nw = b.filter(x => x && !ids.has(x.id)); added += nw.length; return a.concat(nw); };
  for (const k of keys) {
    const inc = o.items[k], old = cur[k];
    if (k.startsWith('hl:')) { if (Array.isArray(inc)) out[k] = byId(Array.isArray(old) ? old : [], inc); continue; }
    if (!inc || typeof inc !== 'object') continue;
    const d = old && typeof old === 'object' ? JSON.parse(JSON.stringify(old)) : { strokes: {}, notes: [], texts: [] };
    d.strokes = d.strokes || {}; d.notes = d.notes || []; d.texts = d.texts || [];
    for (const [pg, list] of Object.entries(inc.strokes || {})) {
      const have = new Set((d.strokes[pg] = d.strokes[pg] || []).map(s => JSON.stringify(s)));
      (list || []).forEach(s => { if (!have.has(JSON.stringify(s))) { d.strokes[pg].push(s); added++; } });
    }
    d.notes = byId(d.notes, inc.notes || []); d.texts = byId(d.texts, inc.texts || []);
    out[k] = d;
  }
  await chrome.storage.local.set(out);
  say(added ? 'Imported ' + added + ' annotation(s). Reopen a PDF to see them.' : 'Nothing new: these annotations are already here.');
};
document.getElementById('open').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('viewer.html') });
chrome.storage.onChanged.addListener(ch => { if (ch.saved || ch.recent) paint(); });
paint();
