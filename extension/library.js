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
document.getElementById('q').oninput = paint;
document.getElementById('open').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('viewer.html') });
chrome.storage.onChanged.addListener(ch => { if (ch.saved || ch.recent) paint(); });
paint();
