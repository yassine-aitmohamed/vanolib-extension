const VIEWER = chrome.runtime.getURL('viewer.html');
const viewerFor = url => VIEWER + '?file=' + encodeURIComponent(url);

async function auto() {
  const { auto = true } = await chrome.storage.local.get('auto');
  return auto;
}
function skip(url) {
  return !url || url.startsWith(VIEWER) || url.includes('novanolib') || url.startsWith('chrome') || url.startsWith('blob:');
}
function looksPdf(url) {
  try {
    const u = new URL(url);
    return /\.pdf$/i.test(u.pathname) || (/(^|\.)arxiv\.org$/.test(u.hostname) && u.pathname.startsWith('/pdf/'));
  } catch (e) { return false; }
}

chrome.webRequest.onHeadersReceived.addListener(async d => {
  if (d.tabId < 0 || d.type !== 'main_frame' || skip(d.url)) return;
  if (!(await auto())) return;
  try { const { nativeHosts = [] } = await chrome.storage.local.get('nativeHosts');
    if (nativeHosts.includes(new URL(d.url).hostname)) return; } catch (e) {}
  const h = n => ((d.responseHeaders || []).find(x => x.name.toLowerCase() === n) || {}).value || '';
  const ct = h('content-type').toLowerCase(), cd = h('content-disposition').toLowerCase();
  if (cd.startsWith('attachment')) return;
  if (ct.includes('application/pdf') || (ct.includes('octet-stream') && looksPdf(d.url))) {
    chrome.tabs.update(d.tabId, { url: viewerFor(d.url) });
  }
}, { urls: ['<all_urls>'], types: ['main_frame'] }, ['responseHeaders']);

chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  const url = info.url;
  if (!url || !url.startsWith('file:') || !/\.pdf($|[?#])/i.test(url) || skip(url)) return;
  if (await auto()) chrome.tabs.update(tabId, { url: viewerFor(url) });
});

async function removeOldReferenceCache() {
  const data = await chrome.storage.local.get(null);
  const keys = Object.keys(data).filter(key => /^ref[23]?:/.test(key));
  if (keys.length) await chrome.storage.local.remove(keys);
}
removeOldReferenceCache().catch(() => {});
chrome.runtime.onInstalled.addListener(async () => {
  const { nativeHosts } = await chrome.storage.local.get('nativeHosts');
  if (!nativeHosts) await chrome.storage.local.set({ nativeHosts: [] });
  await removeOldReferenceCache();
});
chrome.runtime.onInstalled.addListener(() => chrome.contextMenus.removeAll(() => {
  chrome.contextMenus.create({ id: 'vl-list', title: 'Reading list', contexts: ['action'] });
  chrome.contextMenus.create({ id: 'vl-link', title: 'Open in VanoLib Reader', contexts: ['link'] });
  chrome.contextMenus.create({ id: 'vl-page', title: 'Open this PDF in VanoLib Reader', contexts: ['page'] });
}));
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'vl-list') return;
  const url = info.menuItemId === 'vl-link' ? info.linkUrl : (info.pageUrl || (tab && tab.url));
  if (url) chrome.tabs.create({ url: viewerFor(url.replace(/[#&]?novanolib/, '')) });
});

chrome.contextMenus.onClicked.addListener(info => {
  if (info.menuItemId === 'vl-list') chrome.tabs.create({ url: chrome.runtime.getURL('library.html') });
});

function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('vanolib-reader', 2);
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('pdfs')) d.createObjectStore('pdfs'); if (!d.objectStoreNames.contains('texts')) d.createObjectStore('texts'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function putPdf(k, buf) {
  const d = await idb();
  await new Promise((res, rej) => { const t = d.transaction('pdfs', 'readwrite'); t.objectStore('pdfs').put(buf, k); t.oncomplete = res; t.onerror = () => rej(t.error); });
  d.close();
}
const pdfRevisions = new Map();
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (!m || !m.type) return;
  if (m.type === 'ovl-pdf') {
    if (m.revision && pdfRevisions.get(m.project) === m.revision) { reply({ ok: true, revision: m.revision }); return; }
    const bin = atob(m.data), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    putPdf('ovl:' + m.project, u.buffer).then(() => {
      if (m.revision) pdfRevisions.set(m.project, m.revision); else pdfRevisions.delete(m.project);
      chrome.runtime.sendMessage({ type: 'ovl-updated', project: m.project }).catch(() => {});
      reply({ ok: true, revision: m.revision || '' });
    }).catch(e => reply({ ok: false, error: String(e && e.message || e) }));
    return true;
  }
  if (m.type === 'ovl-open') {
    const url = VIEWER + '?ovl=' + encodeURIComponent(m.project) + '&title=' + encodeURIComponent(m.title || '');
    chrome.tabs.query({}, tabs => {
      const t = tabs.find(t => t.url && t.url.startsWith(VIEWER + '?ovl=' + encodeURIComponent(m.project)));
      if (t) { chrome.tabs.update(t.id, { active: true }); chrome.windows.update(t.windowId, { focused: true }); }
      else chrome.tabs.create({ url, index: sender.tab ? sender.tab.index + 1 : undefined });
      reply({ ok: true });
    });
    return true;
  }
});
