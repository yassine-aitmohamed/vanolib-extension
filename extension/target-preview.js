const TargetPreview = (() => {
  async function mount(card, { reader, dest, label, pin, isCurrent, go, close, place, target: given }) {
    let zoom = 1, expanded = false, target = null, renderId = 0, tasks = new Set();
    const pdf = reader.pdf;
    function updateTheme() {
      const theme = getComputedStyle(reader.rdr);
      for (const key of ['--rpop', '--rtx', '--rmu', '--rbd', '--rv']) card.style.setProperty(key, theme.getPropertyValue(key));
      card.classList.toggle('vc-target-night', reader.theme === 'night');
    }
    updateTheme(); reader.rdr.addEventListener('vl-themechange', updateTheme);
    const element = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text) node.textContent = text; return node; };
    const button = (text, title, action) => {
      const b = element('button', '', text); b.type = 'button'; b.title = title; b.onclick = action; return b;
    };
    const root = element('section', 'vc-target');
    root.setAttribute('aria-label', 'Linked passage');
    const head = element('header', 'vc-target-head');
    const titles = element('div', 'vc-target-titles');
    const title = element('h2', 'vc-target-title', label || 'Linked passage');
    title.id = 'vlTargetTitle';
    const subtitle = element('p', 'vc-target-subtitle', 'Loading the passage from the original PDF…');
    titles.append(title, subtitle); head.append(titles);
    const controls = element('div', 'vc-target-controls');
    const size = element('output', 'vc-target-zoom', '100%');
    const zoomOut = button('−', 'Reduce text size', () => changeZoom(zoom / 1.2));
    const zoomIn = button('+', 'Increase text size', () => changeZoom(zoom * 1.2));
    const reset = button('Reading size', 'Reset to a readable text size', () => changeZoom(1));
    const expand = button('Expand', 'Expand the passage', () => {
      expanded = !expanded; card.classList.toggle('vc-target-expanded', expanded);
      expand.textContent = expanded ? 'Reduce' : 'Expand';
      card.style.width = Math.min(expanded ? 1120 : pin ? 940 : 840, innerWidth - 24) + 'px';
      place(); draw();
    });
    const dismiss = button('✕', 'Close the passage (Escape)', close); dismiss.className = 'vc-target-close'; dismiss.setAttribute('aria-label', 'Close the passage');
    controls.append(zoomOut, size, zoomIn, reset, expand, dismiss); head.append(controls);
    const body = element('div', 'vc-target-body'); body.tabIndex = 0; body.setAttribute('aria-label', 'PDF passage; scroll to read more');
    const status = element('div', 'vc-target-status', 'Preparing a high-resolution view…'); status.setAttribute('role', 'status');
    const pages = element('div', 'vc-target-pages'); body.append(pages);
    const footer = element('footer', 'vc-target-footer');
    const open = button('Open at target ↗', 'Go to this passage and keep a return button', go);
    const copy = button('Copy text', 'Copy the extracted text; formulas may need checking', async () => {
      if (!target) return;
      try { await navigator.clipboard.writeText(target.text); copy.textContent = 'Copied ✓'; }
      catch { copy.textContent = 'Clipboard unavailable'; }
    }); copy.disabled = true;
    const hint = element('span', 'vc-target-hint', pin ? 'Click outside or press Escape to close' : 'Click the link to keep this passage open');
    footer.append(open, copy, hint); root.append(head, status, body, footer); card.replaceChildren(root);
    card.classList.add('vc-target-card'); card.classList.remove('vc-wide', 'vc-target-expanded');
    card.setAttribute('role', pin ? 'dialog' : 'region'); card.setAttribute('aria-labelledby', title.id);
    card.style.width = Math.min(pin ? 940 : 840, innerWidth - 24) + 'px'; card.style.display = 'block'; place();
    function cancel() { for (const task of tasks) task.cancel(); tasks.clear(); }
    const alive = () => isCurrent() && card.firstElementChild === root && reader.pdf === pdf;
    async function draw() {
      if (!target || !alive()) return;
      const id = ++renderId; cancel();
      const first = target.segs[0], width = Math.max(...target.segs.map(s => s.right - s.left + 16));
      const textSize = first.P.body || 10;
      const readingScale = Math.max(1.4, 17 / textSize);
      const renderWidth = Math.ceil(Math.max(body.clientWidth - 32, width * readingScale) * zoom);
      const oldWidth = pages.scrollWidth, oldLeft = body.scrollLeft, oldTop = body.scrollTop;
      status.hidden = false; status.textContent = 'Rendering sharp PDF text…';
      try {
        const canvases = await Loc.render(target, renderWidth, {
          isCurrent: () => alive() && id === renderId,
          onTask: task => { tasks.add(task); task.promise.then(() => tasks.delete(task), () => tasks.delete(task)); }
        });
        if (!alive() || id !== renderId) return;
        pages.replaceChildren();
        for (const canvas of canvases) {
          const part = element('figure', 'vc-target-part');
          const caption = element('figcaption', '', 'Page ' + canvas.dataset.page);
          canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', title.textContent + ', page ' + canvas.dataset.page);
          part.append(caption, canvas); pages.appendChild(part);
        }
        if (!canvases.length) throw new Error('This passage could not be rendered');
        body.scrollLeft = oldWidth ? oldLeft * pages.scrollWidth / oldWidth : 0;
        body.scrollTop = oldTop;
        size.value = Math.round(zoom * 100) + '%'; size.textContent = size.value;
        zoomOut.disabled = zoom <= .8; zoomIn.disabled = zoom >= 2.5;
        status.hidden = true; place();
      } catch (error) {
        if (!alive() || id !== renderId) return;
        status.hidden = false; status.textContent = 'Preview unavailable. Use “Open at target” to read the passage.';
      }
    }
    function changeZoom(next) { zoom = Math.max(.8, Math.min(2.5, next)); draw(); }
    let resizeTimer;
    const resize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => {
      if (!alive()) return;
      card.style.width = Math.min(expanded ? 1120 : pin ? 940 : 840, innerWidth - 24) + 'px'; place(); draw();
    }, 100); };
    window.addEventListener('resize', resize);
    const observer = new MutationObserver(() => { if (!alive()) { cancel(); clearTimeout(resizeTimer); window.removeEventListener('resize', resize); reader.rdr.removeEventListener('vl-themechange', updateTheme); observer.disconnect(); if (reader.pdf !== pdf) close(); } });
    observer.observe(card, { attributes: true, attributeFilter: ['style'], childList: true });
    if (reader.pages) observer.observe(reader.pages, { childList: true });
    try {
      if (given) target = given;
      else {
        let d = dest; if (typeof d === 'string') d = await pdf.getDestination(d);
        if (!alive()) return;
        if (!Array.isArray(d)) throw new Error('Destination not found');
        const idx = d[0] && typeof d[0] === 'object' ? await pdf.getPageIndex(d[0]) : d[0];
        const type = d[1]?.name;
        const top = type === 'XYZ' ? d[3] : /^(FitH|FitBH)$/.test(type || '') ? d[2] : type === 'FitR' ? d[5] : null;
        const kind = /(?:equation|(?:^|[.:])eq[.:])/i.test(String(dest)) || Loc.parse(label || '')?.kind === 'equation' ? 'equation' : undefined;
        const fig = (String(typeof dest === 'string' ? dest : '').match(/^(figure|table|subfigure|subtable)\b/i) || [])[1];
        if (fig && Loc.figure) {
          const num = ((label || '').match(/(?:[A-Z]\.)?\d+(?:\.\d+)?[a-z]?/) || [])[0] || null;
          target = await Loc.figure(pdf, fig, num, idx + 1, num ? null : top);
        }
        if (!target || !target.found) target = await Loc.at(pdf, idx + 1, top, kind);
      }
      if (!alive()) return;
      if (!target.found) throw new Error('Target not identified');
      title.textContent = target.as && target.as !== 'Target' ? target.as : label || 'Linked passage';
      subtitle.textContent = 'Original PDF · page ' + target.page + (target.segs.length > 1 ? '–' + target.segs.at(-1).page : '') + (target.as === 'Target' ? ' · excerpt around the destination' : /^(Figure|Table) /.test(target.as) ? ' · with its caption' : ' · passage at the link destination');
      open.textContent = 'Open at page ' + target.page + ' ↗'; copy.disabled = false;
      await draw();
    } catch (error) {
      if (alive()) { status.hidden = false; status.textContent = 'Preview unavailable. Use “Open at target” to read the passage.'; subtitle.textContent = 'The linked PDF remains available in the reader.'; place(); }
    }
  }
  return { mount };
})();
