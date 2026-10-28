const ReadingTheme = (() => {
  const names = ['day', 'sepia', 'night'];
  const labels = { day: 'Day', sepia: 'Sepia', night: 'Night' };
  const normalize = value => names.includes(value) ? value : 'sepia';
  const apply = (theme, root = document.documentElement) => {
    theme = normalize(theme); root.dataset.vlTheme = theme;
    document.querySelectorAll('[data-vl-theme-choice]').forEach(button => {
      const active = button.dataset.vlThemeChoice === theme;
      button.setAttribute('aria-pressed', String(active));
    });
    return theme;
  };
  async function get() { const data = await chrome.storage.local.get('theme'); return normalize(data.theme); }
  async function set(theme) { theme = normalize(theme); await chrome.storage.local.set({ theme }); return theme; }
  function watch(callback) {
    const listener = (changes, area) => { if (area === 'local' && changes.theme) callback(normalize(changes.theme.newValue)); };
    chrome.storage.onChanged?.addListener(listener);
    return () => { try { chrome.storage.onChanged?.removeListener(listener); } catch {} };
  }
  function controls() {
    const group = document.createElement('span'); group.className = 'vl-theme-controls';
    group.setAttribute('role', 'group'); group.setAttribute('aria-label', 'VanoLib reading colours');
    for (const theme of names) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.vlThemeChoice = theme;
      button.className = 'vl-theme-choice'; button.title = 'VanoLib · ' + labels[theme];
      button.setAttribute('aria-label', labels[theme]); button.setAttribute('aria-pressed', 'false');
      button.onclick = async event => {
        event.preventDefault(); event.stopPropagation();
        try { apply(await set(theme)); }
        catch { button.title = 'Reload the page to reconnect VanoLib'; }
      };
      const dot = document.createElement('span'); dot.className = 'vl-theme-dot'; dot.setAttribute('aria-hidden', 'true'); button.appendChild(dot); group.appendChild(button);
    }
    return group;
  }
  return { names, labels, normalize, apply, get, set, watch, controls };
})();
