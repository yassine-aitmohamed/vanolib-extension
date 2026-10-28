(async () => {
  document.getElementById('vl-popup-theme').appendChild(ReadingTheme.controls());
  ReadingTheme.apply(await ReadingTheme.get());
  ReadingTheme.watch(ReadingTheme.apply);
  const { auto = true, port = 8770 } = await chrome.storage.local.get(['auto', 'port']);
  const a = document.getElementById('auto'), p = document.getElementById('port');
  a.checked = auto; p.value = port;
  a.onchange = () => chrome.storage.local.set({ auto: a.checked });
  p.onchange = () => chrome.storage.local.set({ port: parseInt(p.value, 10) || 8770 });
  document.getElementById('current').onclick = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && /^https?:/.test(tab.url || '')) chrome.tabs.create({ url: VL.viewer(tab.url) });
    else document.getElementById('current').textContent = 'Open an article page first';
  };
  document.getElementById('open').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('viewer.html') });
  document.getElementById('list').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('library.html') });
  const { nativeHosts = [] } = await chrome.storage.local.get('nativeHosts');
  if (nativeHosts.length) {
    const nh = document.getElementById('nh');
    nh.innerHTML = nativeHosts.length + ' journal site(s) open in Chrome’s viewer (their PDFs need your login). <a href="#" id="nhr">Try VanoLib again</a>';
    document.getElementById('nhr').onclick = e => { e.preventDefault(); chrome.storage.local.set({ nativeHosts: [] }); nh.textContent = 'Done — VanoLib will try these sites again.'; };
  }
  const saved = await VL.saved(), recent = (await VL.get('recent')) || [];
  const rm = new Map(recent.map(x => [VL.keyOf(x.url), x]));
  document.getElementById('n').textContent = saved.length ? '(' + saved.length + ')' : '';
  if (saved.length) {
    document.getElementById('h2').hidden = false;
    document.getElementById('rl').innerHTML = saved.slice(0, 5).map((x, i) => {
      const r = { ...x, ...(rm.get(VL.keyOf(x.url)) || {}) };
      return `<li data-i="${i}" title="${ESCV(r.title || x.url)}">${ESCV(r.title || VL.nameOf(x.url))} <span>${r.pages ? '· p. ' + (r.page || 1) + '/' + r.pages : ''}</span></li>`;
    }).join('');
    document.querySelectorAll('#rl li').forEach(li => li.onclick = () => chrome.tabs.create({ url: VL.viewer(saved[+li.dataset.i].url) }));
  }
})();
