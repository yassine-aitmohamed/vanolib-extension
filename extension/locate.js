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
  const timeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(what + ' did not answer')), ms))]);
  async function bytesOf(url) { return timeout(bytesOf0(url), 25000, new URL(url).hostname); }
  async function bytesOf0(url) {
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

  function equationBlock(P, index) {
    const tag = row => row.items.some(it => /^\(\s*[\w.\-′']+\s*\)$/.test(it.s.trim()) && (it.x <= P.left + 4 || it.x + it.w >= P.right - 4));
    const proseLine = row => prose(row, 'rm') || prose(row, 'head') || PROOF.test(row.text) || ENDS.test(row.text);
    let first = index, last = index;
    for (let j=index-1; j>=0 && index-j<16; j--) {
      const row=P.rows[j], next=P.rows[j+1];
      if (tag(row) || proseLine(row) || row.y-next.y>P.body*2.6 || P.rows[index].y-row.y < -P.body*9) break;
      first=j;
    }
    for (let j=index+1; j<P.rows.length && j-index<20; j++) {
      const row=P.rows[j], previous=P.rows[j-1];
      if (tag(row) || proseLine(row) || previous.y-row.y>P.body*2.6 || P.rows[index].y-row.y>P.body*10) break;
      last=j;
    }
    const rows=P.rows.slice(first,last+1);
    return { segs: [{ P, rows, equation: true }], text: rows.map(row=>row.text) };
  }
  function segmentBounds(segment) {
    if (!segment.equation) return { top: clampTop(segment), bottom: clampBottom(segment) };
    const padding=Math.max(6,segment.P.body*.8);
    let top=Math.max(...segment.rows.map(row=>row.hi))+padding;
    let bottom=Math.min(...segment.rows.map(row=>row.lo))-padding;
    const minimum=segment.P.body*3.4;
    if(top-bottom<minimum){const extra=(minimum-(top-bottom))/2;top+=extra;bottom-=extra;}
    return { top, bottom };
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
          w = equationBlock(hit.P, hit.k);
        } else w = await walk(D, hit, loc.kind, loc.num);
        const segs = w.segs.filter(s => s.rows.length).map(s => ({
          page: s.P.i, left: s.P.left, right: s.P.right, P: s.P,
          ...segmentBounds(s)
        }));
        const as = hit.as || label(loc);
        return { found: true, page: hit.P.i, top: segs[0].top, as, mismatch: loc.kind !== 'equation' && loc.kind !== 'section' && loc.kind !== 'page' && loc.kind !== 'statement' && !new RegExp('^' + NAME[loc.kind], 'i').test(as) && !(HEADS[loc.kind] || []).some(x => as.toLowerCase().startsWith(x.toLowerCase())), segs, text: w.text.join('\n'), pages: D.pdf.numPages };
      })();
      p.catch(() => results.delete(key));
      results.set(key, p);
    }
    return results.get(key);
  }

  const local = new WeakMap();
  async function at(pdf, pageNo, top, kind) {
    let D = local.get(pdf);
    if (!D) { D = { pdf, url: '', pages: {} }; local.set(pdf, D); }
    const P = await page(D, pageNo, true);
    if (top == null) top = P.vp.height;
    const k = P.rows.findIndex(r => r.y <= top + 2);
    if (k < 0) return { found: false };
    const done = (w, as) => {
      const segs = w.segs.filter(s => s.rows.length).map(s => ({ page: s.P.i, left: s.P.left, right: s.P.right, P: s.P, ...segmentBounds(s) }));
      return segs.length ? { found: true, page: segs[0].page, top: segs[0].top, as, segs, text: w.text.join('\n') } : { found: false };
    };
    const h = P.body;
    if (kind === 'equation') {
      const tagged = r => r.items.some(it => /^\(\s*[\w.\-′']+\s*\)$/.test(it.s.trim()) && (it.x <= P.left + 4 || it.x + it.w >= P.right - 4));
      let end = -1;
      for (let j = k; j < Math.min(P.rows.length, k + 10); j++) if (tagged(P.rows[j])) { end = j; break; }
      if (end < 0) end = Math.min(P.rows.length - 1, k + 2);
      const tag = (P.rows[end].items.find(it => /^\(.*\)$/.test(it.s.trim())) || {}).s;
      return done(equationBlock(P,end), tag ? tag.trim() : 'Equation');
    }
    for (let j = k; j < Math.min(P.rows.length, k + 4); j++) {
      if (!anyHead.test(P.rows[j].text)) continue;
      const w = await walk(D, { P, k: j }, 'statement', '');
      const m = P.rows[j].text.match(/^(\S+(?:\s?\S)*?)\s*([A-Z]?\d+(?:\.\d+)*[a-z]?|[A-Z](?:\.\d+)*)?\s*[.:(]/);
      return done(w, m ? (m[1] + (m[2] ? ' ' + m[2] : '')).replace(/\s+/g, ' ') : 'Statement');
    }
    const rows = [];
    for (let j = k; j < P.rows.length && rows.length < 12 && P.rows[j].y >= top - 230; j++) rows.push(P.rows[j]);
    return done({ segs: [{ P, rows }], text: rows.map(r => r.text) }, 'Target');
  }

  const CAP = { figure: String.raw`Fig(?:ure|\.)?s?|Abb(?:ildung|\.)|Fig\s?ure`, table: String.raw`Tab(?:le|\.)?s?|Tableau|Tabelle` };
  function crows(P) {
    if (P.crows) return P.crows;
    const mid = (P.left + P.right) / 2;
    const split = r => { for (let q = 1; q < r.items.length; q++) { const a = r.items[q - 1], b = r.items[q]; if (a.x + a.w < mid + 2 && b.x > mid - 2 && b.x - (a.x + a.w) > r.h * 0.6) return q; } return -1; };
    const main = P.rows.filter(r => r.h >= P.body * 0.8 && r.text.length > 20);
    const two = main.length > 8 && main.filter(r => split(r) > 0 || r.x2 < mid + 4 || r.x > mid - 4).length > main.length * 0.6;
    const piece = (r, items, col) => {
      let t = '', prev = null;
      for (const it of items) { if (prev && it.x - (prev.x + prev.w) > Math.min(prev.h, it.h) * 0.12 && !/\s$/.test(t)) t += ' '; t += it.s; prev = it; }
      const h = Math.max(...items.map(it => it.h));
      return { src: r, col, items, y: r.y, h, text: t.replace(/\s+/g, ' ').trim(), x: items[0].x, x2: Math.max(...items.map(it => it.x + it.w)), lo: Math.min(...items.map(it => it.y)) - h * 0.3, hi: Math.max(...items.map(it => it.y + it.h)) };
    };
    const out = [];
    for (const r of P.rows) {
      if (!two) { out.push(piece(r, r.items, 'F')); continue; }
      const q = split(r);
      if (q > 0) { out.push(piece(r, r.items.slice(0, q), 'L'), piece(r, r.items.slice(q), 'R')); continue; }
      out.push(piece(r, r.items, r.x2 < mid + 4 ? 'L' : r.x > mid - 4 ? 'R' : 'F'));
    }
    P.mid = mid; P.two = two;
    return (P.crows = out);
  }

  async function figure(pdf, kind, num, pageHint, top) {
    let D = local.get(pdf);
    if (!D) { D = { pdf, url: '', pages: {} }; local.set(pdf, D); }
    kind = /^tab/i.test(kind) ? 'table' : 'figure';
    const N = num ? esc(String(num)).replace(/\\\./g, '\\s?\\.\\s?') : String.raw`(?:[A-Z]\.)?\d+(?:\.\d+)?[a-z]?`;
    const re = new RegExp(String.raw`^(?:${CAP[kind]})\s?~?\s?(${N})(?![\d.]\d)\s*([.:|—–-]|$|\s+[A-Z(])`, 'i');
    const order = []; for (let i = 1; i <= pdf.numPages; i++) order.push(i);
    if (pageHint) order.sort((a, b) => Math.abs(a - pageHint) - Math.abs(b - pageHint) || a - b);
    const cands = [];
    for (const i of order.slice(0, num ? order.length : 1)) {
      const P = await page(D, i);
      crows(P).forEach(r => {
        const m = r.text.match(re); if (!m) return;
        if (top != null && i === pageHint && r.y > top + 4) return;
        let sc = /[.:|—–-]/.test(m[2]) ? 3 : /^\s+[A-Z(]$/.test(m[2]) || !m[2] ? 1 : -9;
        if (r.h < P.body - 0.3) sc += 1;
        if (pageHint === i) sc += 1;
        cands.push({ P, r, sc, as: (kind === 'table' ? 'Table ' : 'Figure ') + m[1].replace(/\s/g, '') });
      });
      if (!num && cands.length) break;
    }
    if (!cands.length) return { found: false };
    for (const c of cands.slice(0, 10)) { await page(D, c.P.i, true); if ((c.r.items[0].k || '').includes('head')) c.sc += 2; }
    if (top != null && !num) cands.sort((a, b) => b.r.y - a.r.y);
    else cands.sort((a, b) => b.sc - a.sc || a.P.i - b.P.i);
    const c = cands[0], P = c.P;
    if (c.sc < 2 && !(top != null && !num)) return { found: false };
    const col = c.r.col, mid = P.mid;
    const span = col === 'F' && P.two;
    const rows = crows(P).filter(r => col === 'F' ? true : r.col === col || r.col === 'F').filter(r => !isFurniture(r.src, P, P.rows.indexOf(r.src))).sort((a, b) => b.y - a.y);
    const k = rows.indexOf(c.r);
    const cw = col === 'L' ? mid - P.left : col === 'R' ? P.right - mid : P.right - P.left;
    const cap = [c.r], ch = c.r.h;
    for (let j = k + 1; j < rows.length && cap.length < 12; j++) {
      const r = rows[j], prev = cap[cap.length - 1];
      if (prev.y - r.y > ch * 1.6 || Math.abs(r.h - ch) > 1.2) break;
      if (Math.abs(r.x - cap[0].x) > 3 || prev.x2 - prev.x < cw * 0.6) break;
      cap.push(r);
    }
    const prose = r => r.h >= P.body * 0.9 && r.text.length > (P.two ? 30 : 45) && (r.x2 - r.x) > (span ? (P.right - P.left) * 0.4 : cw * 0.6) &&
      !r.items.some((it, q) => q && it.x - (r.items[q - 1].x + r.items[q - 1].w) > r.h * 2.5);
    const capTop = Math.max(...cap.map(r => r.hi)) + 2, capBot = Math.min(...cap.map(r => r.lo)) - 2;
    const above = rows.slice(0, k), below = rows.slice(k + cap.length);
    const lastProseAbove = [...above].reverse().find(r => prose(r) && (!span || r.col === 'F' || true)), firstProseBelow = below.find(prose);
    const tableBelow = kind === 'table' && below.length && !prose(below[0]);
    let t, b;
    if (tableBelow) {
      t = capTop;
      const end = firstProseBelow ? firstProseBelow.hi + 3 : Math.min(...below.map(r => r.lo));
      b = Math.max(end, capBot - P.vp.height * 0.55);
    } else {
      const pageTop = above.length ? Math.max(...above.map(r => r.hi)) + 4 : P.vp.height - 36;
      t = Math.min(lastProseAbove ? lastProseAbove.lo - 1 : pageTop, capTop + P.vp.height * 0.6);
      b = capBot;
    }
    if (t - b < 20) return { found: false };
    let left = col === 'R' ? mid : P.left, right = col === 'L' ? mid : P.right;
    if (col !== 'F') { const inCol = rows.filter(r => r.y <= t + 2 && r.y >= b - 2 && r.col === col); if (inCol.length) { left = Math.min(...inCol.map(r => r.x)); right = Math.max(...inCol.map(r => r.x2)); } }
    left = Math.min(left, ...cap.map(r => r.x)); right = Math.max(right, ...cap.map(r => r.x2));
    if (col === 'F') { left = Math.min(left, P.left); right = Math.max(right, P.right); }
    return { found: true, page: P.i, top: t, as: c.as, segs: [{ page: P.i, left, right, P, top: t, bottom: b }], text: cap.map(r => r.text).join('\n') };
  }

  async function isPaper(url, rec) {
    if (!rec || !rec.title || typeof Ref === 'undefined') return true;
    const D = await open(url), P = await page(D, 1);
    const head = P.rows.slice(0, 45).map(r => r.text).join(' . ');
    const t = Ref.titleIn(head, rec.title);
    const fam = rec.authors && rec.authors[0] && Ref.norm(rec.authors[0].family || '').split(' ').pop();
    const au = !fam || Ref.norm(head).split(' ').includes(fam) || (D.pdf.numPages > 1 && Ref.norm((await page(D, 2)).rows.map(r => r.text).join(' ')).split(' ').includes(fam));
    return t.ratio >= 0.8 && au;
  }

  async function render(res, width, { isCurrent = () => true, onTask = () => {} } = {}) {
    const out = [];
    for (const s of res.segs) {
      if (!isCurrent()) return [];
      const pg = s.P.pg, bounds = pg.view || [0, 0, s.P.vp.width, s.P.vp.height];
      const x0 = Math.max(bounds[0], s.left - 8), x1 = Math.min(bounds[2], s.right + 8);
      const top = Math.min(bounds[3], s.top), bottom = Math.max(bounds[1], s.bottom);
      if (x1 <= x0 || top <= bottom) continue;
      const scale = width / (x1 - x0);
      const area = (x1 - x0) * (top - bottom) * scale * scale;
      const dpr = Math.min(Math.max(devicePixelRatio || 1, 2), 3, Math.sqrt(20e6 / Math.max(1, area)));
      const vp = pg.getViewport({ scale: scale * dpr });
      const rect = vp.convertToViewportRectangle([x0, bottom, x1, top]);
      const sx = Math.floor(Math.min(rect[0], rect[2])), sy = Math.floor(Math.min(rect[1], rect[3]));
      const w = Math.ceil(Math.max(rect[0], rect[2])) - sx, h = Math.ceil(Math.max(rect[1], rect[3])) - sy;
      if (w < 4 || h < 4) continue;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const task = pg.render({ canvasContext: cv.getContext('2d'), viewport: vp, transform: [1, 0, 0, 1, -sx, -sy] });
      onTask(task);
      try { await task.promise; } catch (e) { if (!isCurrent()) return []; throw e; }
      if (!isCurrent()) return [];
      cv.style.width = (w / dpr) + 'px'; cv.style.height = (h / dpr) + 'px';
      cv.dataset.page = s.page;
      out.push(cv);
    }
    return out;
  }

  return { parse, after, label, statement, at, figure, isPaper, render, open, _page: page };
})();
