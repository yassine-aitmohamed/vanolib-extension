const VL = {
  get: k => chrome.storage.local.get(k).then(o => o[k]),
  set: (k, v) => chrome.storage.local.set({ [k]: v }),
  keyOf: url => 'url:' + String(url || '').split('#')[0],
  nameOf: url => { try { return decodeURIComponent((String(url).split('#')[0].split('?')[0].split('/').pop() || 'document.pdf')); } catch (e) { return 'document.pdf'; } },
  async saved() { return (await VL.get('saved')) || []; },
  async isSaved(url) { const k = VL.keyOf(url); return (await VL.saved()).some(x => VL.keyOf(x.url) === k); },
  async save(item) {
    const list = (await VL.saved()).filter(x => VL.keyOf(x.url) !== VL.keyOf(item.url));
    list.unshift({ ...item, savedAt: Date.now() });
    await VL.set('saved', list);
  },
  async unsave(url) {
    const k = VL.keyOf(url);
    await VL.set('saved', (await VL.saved()).filter(x => VL.keyOf(x.url) !== k));
    await VL.dbDel(k);
    await VL.textDel(k);
  },
  async touch(url, patch) {
    const k = VL.keyOf(url), list = await VL.saved(); let ch = false;
    for (const x of list) if (VL.keyOf(x.url) === k) { Object.assign(x, patch); ch = true; }
    if (ch) await VL.set('saved', list);
    const rec = ((await VL.get('recent')) || []).filter(x => VL.keyOf(x.url) !== k);
    const old = ((await VL.get('recent')) || []).find(x => VL.keyOf(x.url) === k) || {};
    rec.unshift({ ...old, url, ...patch, openedAt: Date.now() });
    await VL.set('recent', rec.slice(0, 60));
  },
  _db: null,
  db() {
    if (VL._db) return VL._db;
    VL._db = new Promise((res, rej) => {
      const r = indexedDB.open('vanolib-reader', 2);
      r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('pdfs')) d.createObjectStore('pdfs'); if (!d.objectStoreNames.contains('texts')) d.createObjectStore('texts'); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return VL._db;
  },
  async dbPut(k, buf) { const d = await VL.db(); return new Promise((res, rej) => { const t = d.transaction('pdfs', 'readwrite'); t.objectStore('pdfs').put(buf, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); },
  async dbGet(k) { const d = await VL.db(); return new Promise(res => { const q = d.transaction('pdfs').objectStore('pdfs').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); },
  async textPut(k, v) { const d = await VL.db(); return new Promise((res, rej) => { const t = d.transaction('texts', 'readwrite'); t.objectStore('texts').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); },
  async textGet(k) { const d = await VL.db(); return new Promise(res => { const q = d.transaction('texts').objectStore('texts').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); },
  async textDel(k) { const d = await VL.db(); return new Promise(res => { const t = d.transaction('texts', 'readwrite'); t.objectStore('texts').delete(k); t.oncomplete = res; t.onerror = res; }); },
  async index(k, pdf, meta) {
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      try { const tc = await (await pdf.getPage(i)).getTextContent(); pages.push(tc.items.map(x => x.str + (x.hasEOL ? '\n' : '')).join('').replace(/[ \t]+/g, ' ')); } catch (e) { pages.push(''); }
    }
    await VL.textPut(k, Object.assign({ pages, at: Date.now() }, meta || {}));
    return pages;
  },
  async dbDel(k) { const d = await VL.db(); return new Promise(res => { const t = d.transaction('pdfs', 'readwrite'); t.objectStore('pdfs').delete(k); t.oncomplete = res; t.onerror = res; }); },
  viewer: url => chrome.runtime.getURL('viewer.html') + '?file=' + encodeURIComponent(url),
  ago(ts) { if (!ts) return ''; const s = (Date.now() - ts) / 1000; if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago'; if (s < 86400 * 30) return Math.round(s / 86400) + ' d ago'; return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
};
const ESCV = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
