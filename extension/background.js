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

chrome.runtime.onInstalled.addListener(() => chrome.storage.local.set({ nativeHosts: [] }));
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
