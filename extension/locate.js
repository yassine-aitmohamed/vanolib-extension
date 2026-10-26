const Loc = (() => {
  const WORD = String.raw`Theorems?|Thms?\.?|Th\.|Th[ée]or[èe]mes?|Satz|Teorema|Lemmas?|Lemmata|Lemmes?|Lem\.?|Propositions?|Props?\.?|Corollar(?:y|ies)|Corollaires?|Korollar|Cors?\.?|Definitions?|D[ée]finitions?|Defns?\.?|Defs?\.?|Remarks?|Remarques?|Bemerkung|Rems?\.?|Rmks?\.?|Examples?|Exemples?|Beispiel|Exa?\.?|Exs\.?|Conjectures?|Conj\.?|Claims?|Notations?|Constructions?|Assumptions?|Hypothes[ie]s|Facts?|Questions?|Problems?|Exercises?|Conventions?|Observations?|Algorithms?|Sections?|Sect?\.?|Subsections?|Chapters?|Chap\.?|Ch\.|Appendix|App\.|§+|Equations?|Eqs?\.?|Formula|p\.|pp\.|pages?|Figures?|Figs?\.?|Tables?`;
  const NUM = String.raw`\(?\s*([A-Z]?\d+(?:\.\d+)*[a-z]?|[A-Z](?:\.\d+)+|[A-Z](?![A-Za-z]))\s*\)?`;
  const LOCATOR = new RegExp(String.raw`(?:(${WORD})\s*${NUM}|\(\s*(\d+(?:\.\d+)*[a-z]?)\s*\))`, 'i');

  function kindOf(w) {
    const s = String(w || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/^§/.test(s) || /^(sect|subsect|sec\.?$|chap|ch\.|appendix|app\.)/.test(s)) return 'section';
    if (/^(eq|formula)/.test(s)) return 'equation';
    if (/^(p\.|pp\.|page)/.test(s)) return 'page';
    if (/^(fig|table)/.test(s)) return 'figure';
    if (/^prob/.test(s)) return 'problem';
    if (/^(th|satz|teorema)/.test(s)) return 'theorem';
    if (/^lem/.test(s)) return 'lemma';
    if (/^prop/.test(s)) return 'proposition';
    if (/^(cor|korollar)/.test(s)) return 'corollary';
    if (/^def/.test(s)) return 'definition';
    if (/^(rem|rmk|bemerkung)/.test(s)) return 'remark';
    if (/^(ex|beispiel)/.test(s)) return /^exer/.test(s) ? 'exercise' : 'example';
    if (/^conj/.test(s)) return 'conjecture';
    for (const k of ['claim', 'notation', 'construction', 'assumption', 'hypothes', 'fact', 'question', 'convention', 'observation', 'algorithm'])
      if (s.startsWith(k)) return k === 'hypothes' ? 'hypothesis' : k;
    return 'statement';
  }
  const NAME = { theorem: 'Theorem', lemma: 'Lemma', proposition: 'Proposition', corollary: 'Corollary', definition: 'Definition', remark: 'Remark',
    example: 'Example', conjecture: 'Conjecture', claim: 'Claim', notation: 'Notation', construction: 'Construction', assumption: 'Assumption',
    hypothesis: 'Hypothesis', fact: 'Fact', question: 'Question', problem: 'Problem', exercise: 'Exercise', convention: 'Convention',
    observation: 'Observation', algorithm: 'Algorithm', section: '§', equation: 'Equation', page: 'Page', figure: 'Figure', statement: 'Statement' };
  const label = loc => !loc ? '' : loc.kind === 'equation' ? '(' + loc.num + ')' : loc.kind === 'section' ? '§' + loc.num : NAME[loc.kind] + ' ' + loc.num;

  function parse(s) {
    const m = String(s || '').replace(/[~\u00a0\s]+/g, ' ').match(new RegExp('^\\s*' + LOCATOR.source, 'i'));
    if (!m) return null;
    if (m[3]) return { kind: 'equation', num: m[3] };
    const kind = kindOf(m[1]);
    if (kind === 'figure') return null;
    return { kind, num: m[2] };
  }
  function after(s) {
    const t = String(s || '').replace(/[~\u00a0\s]+/g, ' ');
    const m = t.match(/^[^\]\)\[(,;:]{0,6}?[,;:]?\s*(.{0,60})/);
    return m ? parse(m[1]) : null;
  }

  const docs = new Map();
  function isPdf(buf) { const u = new Uint8Array(buf.slice(0, 1024)); for (let i = 0; i < u.length - 3; i++) if (u[i] === 37 && u[i + 1] === 80 && u[i + 2] === 68 && u[i + 3] === 70) return true; return false; }
  async function bytesOf(url) {
    if (typeof fetchPdf === 'function') { const b = await fetchPdf(url); if (b) return b; throw new Error('not a PDF'); }
    const r = await fetch(url, { redirect: 'follow' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const b = await r.arrayBuffer(); if (!isPdf(b)) throw new Error('not a PDF'); return b;
  }
  function open(url) {
    if (!docs.has(url)) {
      const p = (async () => {
        const L = window.pdfjsLib;
        if (L && !L.GlobalWorkerOptions.workerSrc && typeof chrome !== 'undefined' && chrome.runtime) L.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');
        const data = new Uint8Array(await bytesOf(url));
        const pdf = await L.getDocument({ data, isEvalSupported: false }).promise;
        return { pdf, url, pages: {} };
      })();
      p.catch(() => docs.delete(url));
      docs.set(url, p);
      if (docs.size > 8) docs.delete(docs.keys().next().value);
    }
    return docs.get(url);
  }

  const MATHF = /cmmi|cmsy|cmex|msam|msbm|eufm|eusm|rsfs|mathitalic|mathsymbol|math|symbol|stmary|wasy|lasy|mnsymbol|txsy|pxsy|txex|pxex|newtxmi|standardsym|cmbsy|esint|bbm|dsrom|^mi\d|-mi\b/i;
  const ITALF = /cmti|cmsl|cmbxti|cmbxsl|ital|oblique|slant|-it\b|\bit\d|ti\d{1,2}$|sl\d{1,2}$|-ita/i;
  const HEADF = /cmbx|cmb\d|bold|black|heavy|semibold|demi|medi\b|-medi|cmcsc|csc|smallcaps|caps|\bsc\d|-sc\b|medium/i;
  const fontKind = n => !n ? '' : MATHF.test(n) ? 'math' : HEADF.test(n) ? (ITALF.test(n) ? 'headit' : 'head') : ITALF.test(n) ? 'it' : 'rm';

  async function page(D, i, fonts) {
    let P = D.pages[i];
    if (!P) {
      const pg = await D.pdf.getPage(i), tc = await pg.getTextContent(), vp = pg.getViewport({ scale: 1 });
      const items = tc.items.filter(it => it.str && it.str.trim()).map(it => ({ s: it.str, x: it.transform[4], y: it.transform[5], h: Math.abs(it.transform[3]) || Math.abs(it.transform[0]) || 10, w: it.width, f: it.fontName }));
      const rows = [];
      for (const it of items) {
        let r = rows.find(r => Math.abs(r.y - it.y) < Math.max(1.6, it.h * 0.2));
        if (!r) { r = { y: it.y, items: [] }; rows.push(r); }
        r.items.push(it);
      }
      rows.sort((a, b) => b.y - a.y);
      for (const r of rows) {
        r.items.sort((a, b) => a.x - b.x);
        let t = '', prev = null;
        for (const it of r.items) { if (prev && it.x - (prev.x + prev.w) > Math.min(prev.h, it.h) * 0.12 && !/\s$/.test(t)) t += ' '; t += it.s; prev = it; }
        r.text = t.replace(/\s+/g, ' ').trim();
        r.x = r.items[0].x; r.x2 = Math.max(...r.items.map(it => it.x + it.w));
        r.h = Math.max(...r.items.map(it => it.h)); r.lo = Math.min(...r.items.map(it => it.y)) - r.h * 0.3; r.hi = Math.max(...r.items.map(it => it.y + it.h));
      }
      const hs = items.map(it => Math.round(it.h)).sort((a, b) => a - b), body = hs[Math.floor(hs.length / 2)] || 10;
      const main = rows.filter(r => r.h >= body * 0.8);
      const xs = main.map(r => Math.round(r.x)), cnt = {}; xs.forEach(x => cnt[x] = (cnt[x] || 0) + 1);
      const left = +Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || 0;
      const right = Math.max(...main.map(r => r.x2), left + 100);
      P = D.pages[i] = { i, pg, vp, rows, body, left, right, fonts: false };
    }
    if (fonts && !P.fonts) {
      try { await P.pg.getOperatorList(); } catch (e) {}
      for (const r of P.rows) for (const it of r.items) { let n = ''; try { const f = P.pg.commonObjs.get(it.f); n = (f && f.name) || ''; } catch (e) {} it.k = fontKind(n.replace(/^[A-Z]{6}\+/, '')); }
      P.fonts = true;
    }
    return P;
  }

  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const HEADS = {
    theorem: ['Theorem', 'Théorème', 'Theoreme', 'Satz', 'Teorema'], lemma: ['Lemma', 'Lemme', 'Lema'], proposition: ['Proposition', 'Proposizione', 'Proposición'],
    corollary: ['Corollary', 'Corollaire', 'Korollar', 'Corolario'], definition: ['Definition', 'Définition', 'Definición'], remark: ['Remark', 'Remarque', 'Bemerkung', 'Remarks'],
    example: ['Example', 'Exemple', 'Beispiel', 'Examples'], conjecture: ['Conjecture', 'Vermutung'], claim: ['Claim'], notation: ['Notation'], construction: ['Construction'],
    assumption: ['Assumption'], hypothesis: ['Hypothesis'], fact: ['Fact'], question: ['Question'], problem: ['Problem'], exercise: ['Exercise'], convention: ['Convention'],
    observation: ['Observation'], algorithm: ['Algorithm'], statement: []
  };
  const spaced = w => w.split('').map(c => /[a-zé]/i.test(c) ? `[${c.toLowerCase()}${c.toUpperCase()}]` : esc(c)).join('\\s?');
  const ALLW = Object.values(HEADS).flat();
  const anyHead = new RegExp(String.raw`^(?:(?:${ALLW.map(spaced).join('|')})s?\s*(?:[A-Z]?\d+(?:\.\d+)*[a-z]?|[A-Z](?:\.\d+)+)?\s*[.:(—–]|[A-Z]?\d+(?:\.\d+)+\.?\s*(?:${ALLW.map(spaced).join('|')})\b)`);
  const PROOF = /^(proof|d[ée]monstration|preuve|beweis|sketch of (the )?proof|outline of (the )?proof)\b/i;
  const ENDS = /^(references|bibliography|bibliographie|literatur|acknowledg(e)?ments?|remerciements)\s*$/i;

  function headRe(words, num) {
    const W = words.map(spaced).join('|'), N = esc(num).replace(/\\\./g, '\\s?\\.\\s?');
    return [new RegExp(String.raw`^(${W})\s*${N}(?![\d.]\d)`), new RegExp(String.raw`^${N}\.?\s*(${W})\b`)];
  }
  const isHeadFont = r => r.items.length && /head/.test(r.items[0].k || '');

  async function findHeading(D, loc) {
    const sets = loc.kind in HEADS && HEADS[loc.kind].length ? [HEADS[loc.kind], ALLW] : [ALLW];
    for (const words of sets) {
      const [re1, re2] = headRe(words, loc.num), cands = [];
      for (let i = 1; i <= D.pdf.numPages; i++) {
        const P = await page(D, i);
        P.rows.forEach((r, k) => {
          const m = r.text.match(re1) || r.text.match(re2);
          if (!m) return;
          const rest = r.text.slice(m[0].length);
          let s = /^\s*([.:]|\(|\[|—|–|$)/.test(rest) ? 3 : /^\s+[A-Z]/.test(rest) ? 1 : 0;
          if (Math.abs(r.x - P.left) < 4) s += 1;
          cands.push({ P, k, s, as: (m[1] && isNaN(m[1][0]) ? m[1] : (m[2] || m[1])).replace(/\s/g, '') });
        });
      }
      if (!cands.length) continue;
      for (const c of cands.slice(0, 12)) { await page(D, c.P.i, true); if (isHeadFont(c.P.rows[c.k])) c.s += 3; }
      cands.sort((a, b) => b.s - a.s || a.P.i - b.P.i || a.k - b.k);
      if (cands[0].s < 2) continue;
      const c = cands[0], word = c.as.replace(/s$/, '');
      return { P: c.P, k: c.k, as: word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() + ' ' + loc.num };
    }
    return null;
  }

  async function findSection(D, num) {
    const N = esc(num).replace(/\\\./g, '\\.\\s?');
    const re = new RegExp(String.raw`^(?:§\s*)?${N}\.?\s+\S`), cands = [];
    for (let i = 1; i <= D.pdf.numPages; i++) {
      const P = await page(D, i);
      P.rows.forEach((r, k) => { if (re.test(r.text) && r.text.length < 120 && !/(\.\s?){3,}|\s\d{1,3}$/.test(r.text)) cands.push({ P, k }); });
    }
    for (const c of cands.slice(0, 20)) { await page(D, c.P.i, true); c.s = (isHeadFont(c.P.rows[c.k]) || c.P.rows[c.k].items.some(it => /head/.test(it.k || '')) ? 3 : 0) + (c.P.rows[c.k].h > c.P.body + 0.5 ? 2 : 0); }
    cands.sort((a, b) => b.s - a.s || a.P.i - b.P.i);
    return cands.length && cands[0].s > 0 ? { P: cands[0].P, k: cands[0].k, as: '§' + num } : null;
  }

  async function findEquation(D, num) {
    const tag = '(' + num + ')';
    for (let i = 1; i <= D.pdf.numPages; i++) {
      const P = await page(D, i);
      for (let k = 0; k < P.rows.length; k++) {
        const r = P.rows[k];
        for (const it of r.items) {
          if (it.s.replace(/\s/g, '') !== tag) continue;
          if (it.x <= P.left + 4 || it.x + it.w >= P.right - 4) return { P, k, eq: it, as: tag };
        }
      }
    }
    return null;
  }

  async function findPage(D, num) {
    const n = +num; if (!n) return null;
    for (let i = 1; i <= D.pdf.numPages; i++) {
      const P = await page(D, i), ends = [P.rows[0], P.rows[P.rows.length - 1]].filter(Boolean);
      if (ends.some(r => new RegExp(String.raw`^${n}\b|\b${n}$`).test(r.text))) return { P, k: 0, as: 'page ' + n, printed: true };
    }
    return null;
  }

  const isFurniture = (r, P, k) => /^\d{1,4}$/.test(r.text) || ((k <= 1 || k >= P.rows.length - 2) && (r.h < P.body * 0.9 || /^\d{1,4}\s|\s\d{1,4}$/.test(r.text) && r.text === r.text.toUpperCase()));
  const prose = (r, kind) => r.items.some(it => it.k === kind && /[A-Za-z]{2,}\s+[a-z]{2,}\s+[a-z]{2,}/.test(it.s));
  function sectionHead(r, P) {
    if (ENDS.test(r.text)) return 1;
    const m = r.text.match(/^(?:§\s*)?((?:[A-Z]|\d+)(?:\.\d+)*)\.?\s+\S/);
    return m && r.text.length < 90 && (r.items.some(it => /head/.test(it.k || '')) || r.h > P.body + 0.6) ? m[1].split('.').length : 0;
  }

  async function walk(D, hit, kind, num) {
    const segs = [], text = [], depth = String(num || '').split('.').length;
    const stop = r => {
      while (seg.rows.length > (segs.length === 1 ? 1 : 0)) { const l = seg.rows[seg.rows.length - 1]; if (l.y < r.y + r.h * 0.75 && l.h < P.body * 0.9) { seg.rows.pop(); text.pop(); } else break; }
      return { segs, text, italic };
    };
    let P = hit.P, k = hit.k, seg = { P, rows: [P.rows[k]] }, n = 1, prev = P.rows[k];
    segs.push(seg); text.push(prev.text);
    await page(D, P.i, true);
    const after = prev.items.slice(1).concat((P.rows[k + 1] || { items: [] }).items, (P.rows[k + 2] || { items: [] }).items);
    const letters = kd => after.filter(it => it.k === kd).reduce((s, it) => s + (it.s.match(/[A-Za-z]/g) || []).length, 0);
    const italic = letters('it') > 2 * letters('rm') && letters('it') > 8;
    const max = kind === 'section' || kind === 'page' ? 16 : 48, line = P.body * 1.25;
    for (let pi = P.i, first = true; pi <= Math.min(D.pdf.numPages, P.i + 2); pi++, first = false) {
      const Q = await page(D, pi, true);
      if (!first) { seg = { P: Q, rows: [] }; segs.push(seg); prev = null; }
      for (let j = first ? k + 1 : 0; j < Q.rows.length; j++) {
        const r = Q.rows[j];
        if (isFurniture(r, Q, j)) continue;
        if (PROOF.test(r.text) || ENDS.test(r.text)) return stop(r);
        const sh = sectionHead(r, Q);
        if (kind === 'section' ? sh && sh <= depth : kind !== 'page' && (sh || anyHead.test(r.text) && (isHeadFont(r) || /^\S+\s*[\d.A-Z]*\s*[.:]/.test(r.text)))) return stop(r);
        if (italic && kind !== 'section' && kind !== 'page' && prose(r, 'rm')) return stop(r);
        if (prev && (kind === 'section' || kind === 'page') && prev.lo - r.hi > line * 3) return stop(r);
        if (!italic && prev && kind !== 'section' && kind !== 'page') {
          const gap = prev.lo - r.hi, ended = /[.!?]\s*$/.test(prev.text);
          const indented = r.x > Q.left + 5 && r.x < Q.left + 32 && /^[A-Z]/.test(r.text) && r.items[0].k !== 'math';
          if (ended && (indented && prev.x2 < Q.right - 12 || gap > line * 1.6)) return stop(r);
        }
        seg.rows.push(r); text.push(r.text); if (r.h >= Q.body * 0.9) prev = r;
        if (++n >= max) return { segs, text, italic };
      }
    }
    return { segs, text, italic };
  }

  function clampTop(s) {
    const t = Math.max(...s.rows.map(r => r.hi)) + 1.5, i = s.P.rows.indexOf(s.rows[0]);
    const above = s.P.rows.slice(0, Math.max(0, i)).filter(r => r.y > t - 30 && r.h >= s.P.body * 0.9 && !s.rows.includes(r));
    return above.length ? Math.min(t, Math.min(...above.map(r => r.y - r.h * 0.3)) - 0.5) : t;
  }
  function clampBottom(s) {
    const b = Math.min(...s.rows.map(r => r.lo)) - 2, i = s.P.rows.indexOf(s.rows[s.rows.length - 1]);
    const below = s.P.rows.slice(i + 1).filter(r => r.y < b + 30 && r.h >= s.P.body * 0.9 && !s.rows.includes(r));
    return below.length ? Math.max(b, Math.max(...below.map(r => r.y + r.h * 0.75)) + 0.5) : b;
  }

  const results = new Map();
  async function statement(url, loc) {
    const key = url + '|' + loc.kind + '|' + loc.num;
    if (!results.has(key)) {
      const p = (async () => {
        const D = await open(url);
        let hit = null, w = null;
        if (loc.kind === 'equation') hit = await findEquation(D, loc.num);
        else if (loc.kind === 'section') hit = await findSection(D, loc.num);
        else if (loc.kind === 'page') hit = await findPage(D, loc.num);
        else hit = await findHeading(D, loc);
        if (!hit) return { found: false, pages: D.pdf.numPages };
        if (hit.eq) {
          const P = hit.P, y = hit.eq.y, h = P.body;
          const rows = P.rows.filter(r => r.y <= y + h * 2.6 && r.y >= y - h * 1.6);
          while (rows.length > 1 && rows[0].h < h * 0.9) rows.shift();
          while (rows.length > 1 && rows[rows.length - 1].h < h * 0.9) rows.pop();
          w = { segs: [{ P, rows }], text: rows.map(r => r.text) };
        } else w = await walk(D, hit, loc.kind, loc.num);
        const segs = w.segs.filter(s => s.rows.length).map(s => ({
          page: s.P.i, left: s.P.left, right: s.P.right, P: s.P,
          top: clampTop(s), bottom: clampBottom(s)
        }));
        const as = hit.as || label(loc);
        return { found: true, page: hit.P.i, top: segs[0].top, as, mismatch: loc.kind !== 'equation' && loc.kind !== 'section' && loc.kind !== 'page' && loc.kind !== 'statement' && !new RegExp('^' + NAME[loc.kind], 'i').test(as) && !(HEADS[loc.kind] || []).some(x => as.toLowerCase().startsWith(x.toLowerCase())), segs, text: w.text.join('\n'), pages: D.pdf.numPages };
      })();
      p.catch(() => results.delete(key));
      results.set(key, p);
    }
    return results.get(key);
  }

  async function render(res, width) {
    const dpr = Math.min(devicePixelRatio || 1, 2.5), out = [];
    for (const s of res.segs) {
      const x0 = Math.max(0, s.left - 8), x1 = Math.min(s.P.vp.width, s.right + 8);
      const scale = width / (x1 - x0), vp = s.P.pg.getViewport({ scale: scale * dpr });
      const full = document.createElement('canvas'); full.width = Math.ceil(vp.width); full.height = Math.ceil(vp.height);
      await s.P.pg.render({ canvasContext: full.getContext('2d'), viewport: vp }).promise;
      const [ax, ay] = vp.convertToViewportPoint(x0, s.top), [bx, by] = vp.convertToViewportPoint(x1, s.bottom);
      const sx = Math.max(0, Math.floor(Math.min(ax, bx))), sy = Math.max(0, Math.floor(Math.min(ay, by)));
      const w = Math.min(full.width - sx, Math.ceil(Math.abs(bx - ax))), h = Math.min(full.height - sy, Math.ceil(Math.abs(by - ay)));
      if (w < 4 || h < 4) continue;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(full, sx, sy, w, h, 0, 0, w, h);
      cv.style.width = (w / dpr) + 'px'; cv.style.height = (h / dpr) + 'px';
      cv.dataset.page = s.page;
      out.push(cv);
    }
    return out;
  }

  return { parse, after, label, statement, render, open, _page: page };
})();
