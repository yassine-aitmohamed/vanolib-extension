<p align="center"><img src="docs/citation-card.jpg" alt="VanoLib Reader showing a citation card" width="900"></p>

<h1 align="center">VanoLib Reader</h1>
<p align="center"><b>A better PDF reader for papers, right in your browser.</b><br>
Click a citation and see the reference instantly, and even the exact lemma it points to. Highlight, annotate, save for later, read at night.</p>
<p align="center"><a href="https://github.com/yassine-aitmohamed/vanolib-extension/actions/workflows/checks.yml"><img src="https://github.com/yassine-aitmohamed/vanolib-extension/actions/workflows/checks.yml/badge.svg" alt="Checks"></a> <a href="https://github.com/yassine-aitmohamed/vanolib-extension/releases/latest"><img src="https://img.shields.io/github/v/release/yassine-aitmohamed/vanolib-extension?color=4c6ef5" alt="Release"></a> <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License: MIT"></a> <img src="https://img.shields.io/badge/Chrome%20%7C%20Edge%20%7C%20Brave-supported-555" alt="Platforms"></p>
<p align="center"><a href="README.fr.md">Version française</a></p>

---

## What's new in 1.9

- **Figures and tables on demand.** Click "Figure 3", "Fig. 3" or "Table 2" in the text, even without a link, or hover a link to a figure: the figure or table appears with its caption, without leaving your place. It works on one and two columns, and in Overleaf's preview.
- **More ways to annotate.** Write text directly on the page (T), strike through a selection, cycle colours with C or pick your own, and clear all annotations of a PDF in one click (undo brings them back).
- **Export and import annotations.** One file holds the highlights, drawings, texts and comments of all your PDFs. Importing adds them back, on another computer too, without overwriting anything.
- **Cite in five styles.** In a verified reference card, **Cite** gives BibTeX, AMS, APA, MLA or Chicago, copied in one click.
- **More reliable references.** Two-column articles with LaTeX's narrow column gap are read correctly again, and a label cut at the edge of its link (`Se1` for `Se19`) is completed to the whole word, in the reader and in Overleaf. Citations are always matched to the entry printed in the current PDF.

## What's new in 1.8

- **Overleaf.** A **VanoLib** button appears next to "Download PDF" in Overleaf. It opens the compiled PDF in VanoLib Reader, and that tab reloads at the same place after each compile.
- **Cards inside Overleaf's preview.** Click a citation such as `[May25, Lemma 2.1]` and the reference card opens right there, with the exact statement. Click a link to a theorem, lemma, proposition or equation of your own paper and you see its statement without leaving the place you are reading, with **Go there** to jump. Sections and pages still jump as usual, and Alt-click keeps Overleaf's own behaviour. The project needs `hyperref`.
- **The arXiv version when the journal is not free.** When a cited paper is behind a paywall, its statement is read from its arXiv version, found through OpenAlex, Semantic Scholar or the arXiv search and checked against the title and the first author. When the journal PDF is free, it is read first, since it is the version you cite. The card says which version it used.

## What's new in 1.7

- **The exact statement behind a citation.** Click `[May25, Lemma 2.1]` and the card shows Lemma 2.1 itself, cut from the cited paper's own PDF (arXiv or open access), with its page number. Formulas look exactly as in the paper. It works for theorems, lemmas, propositions, corollaries, definitions, remarks and examples, abbreviations such as `Thm. 3.4`, lettered results such as `Theorem A`, equations `(2.4)` and sections `§3.1`, and also when the citation wraps to the next line. Click the statement, or **Open at page …**, to read the cited paper at that very place.
- **Honest when it cannot.** If the paper has no open-access PDF, if the paper numbers the result differently (it calls it "Lemma 2.1" when you cited "Theorem 2.1"), or if the statement is read from the arXiv version of a published paper, the card says so.

<p align="center"><img src="docs/statement-card.jpg" alt="A citation card showing the statement of Theorem 3.1 from the cited paper" width="720"></p>

Also since 1.0: **verified references** (each entry is checked against Crossref and arXiv, marked ✓ Verified or ≈ Probable match), a **Research panel** (the paper, papers citing it, related papers, verified references, one-click .bib export), **previews** of theorem and equation links on hover, and **full-text search** across the PDFs of your reading list.

Earlier versions are still available on the [releases page](https://github.com/yassine-aitmohamed/vanolib-extension/releases).

## Why VanoLib Reader

Reading a paper in the browser's built-in PDF viewer means scrolling back and forth to the reference list, losing your place, and starting from zero every time you reopen the file. VanoLib Reader fixes that.

- **Citation cards.** Click or hover a citation such as `[5]` and the full reference appears in a card, checked against Crossref and arXiv, with one-click links to the paper, Google Scholar and arXiv, plus Copy and BibTeX. "Go to the reference list" jumps there with a Back button.
- **Exact statements.** For a citation such as `[May25, Lemma 2.1]`, the card also shows the statement of Lemma 2.1, taken from the cited paper itself.
- **Research panel.** The open paper, the papers that cite it, related papers and its verified references, with .bib export.
- **Annotate like on paper.** Pen, highlighter in four colours, underline, notes on the page and comments on a passage, with undo and redo. Every annotation is saved per PDF and listed in the sidebar.
- **Reading list, offline.** Save a PDF with ⌘D / Ctrl+D: it stays readable offline, and reopens at the page where you stopped, with your highlights. Search the full text of all your saved PDFs.
- **Comfortable reading.** Sharp text at every zoom, day, sepia and night modes, search, outline and page thumbnails.
- **One-click download** to a dedicated folder, and **send to VanoAtlas** if you use [VanoAtlas](https://github.com/yassine-aitmohamed/vanoatlas).
- **Private.** Your PDFs, notes and reading list stay in your browser. No account, no tracking, no server of ours. To check references and show statements, the reader asks public scholarly services (Crossref, arXiv, OpenAlex, Semantic Scholar) about the papers you cite. In Overleaf, the compiled PDF goes from Overleaf to the extension in your own browser and nowhere else.
- **Free and open source** (MIT).

## Screenshots

| | |
|---|---|
| <img src="docs/reader.jpg" alt="Reader"> **Reader**: sharp text, toolbar with annotation tools. | <img src="docs/citation-card.jpg" alt="Citation card"> **Citation card**: the reference, without leaving the page. |
| <img src="docs/statement-card.jpg" alt="Exact statement"> **Exact statement**: `[Doe25, Theorem 3.1]` shows Theorem 3.1 itself. | |
| <img src="docs/sepia-sidebar.jpg" alt="Sepia mode"> **Sepia mode** with pages, outline and highlights in the sidebar. | <img src="docs/night.jpg" alt="Night mode"> **Night mode** for late reading. |

## Install

VanoLib Reader works in **Google Chrome, Microsoft Edge, Brave, Arc, Vivaldi and Opera**, on **macOS and Windows** (and Linux). The steps are the same on every system.

1. **Download** `vanolib-extension.zip` from the [latest release](https://github.com/yassine-aitmohamed/vanolib-extension/releases/latest) and unzip it.
   - macOS: double-click the zip in Finder.
   - Windows: right-click the zip → **Extract All…**
2. **Open the extensions page** of your browser:
   - Chrome, Brave, Arc, Vivaldi: type `chrome://extensions` in the address bar
   - Edge: type `edge://extensions`
3. Turn on **Developer mode** (top right in Chrome, left side in Edge).
4. Click **Load unpacked** and choose the unzipped **`extension`** folder (the one that contains `manifest.json`).
5. Pin VanoLib Reader to the toolbar (puzzle icon → pin).

Open any PDF link: it opens in VanoLib Reader. To read PDFs from your own disk, open the extension's **Details** and turn on **Allow access to file URLs**.

To update, download the new version, replace the folder, and click ↻ **Reload** on the VanoLib Reader card.

## Keyboard shortcuts

| Action | macOS | Windows |
|---|---|---|
| Save to reading list | ⌘D | Ctrl+D |
| Download | ⌘S | Ctrl+S |
| Undo / Redo | ⌘Z / ⌘⇧Z | Ctrl+Z / Ctrl+Shift+Z |
| Pen / Highlighter / Note / Eraser | P / H / N / E | P / H / N / E |

## Tips

- If Google Scholar PDF Reader is also installed, turn one of them off so that both do not open the same PDF.
- Turn automatic opening on or off from the toolbar icon.
- The VanoAtlas port (default 8770) can be changed from the toolbar icon.

## Author

VanoLib Reader is written and maintained by **Yassine Ait Mohamed**, PhD student in mathematics at the Université de Sherbrooke. It started as a tool for my own research and is shared in the hope that it is useful to others.

- Website: [yassine-aitmohamed.github.io](https://yassine-aitmohamed.github.io)
- Bug reports and ideas: [open an issue](https://github.com/yassine-aitmohamed/vanolib-extension/issues)

## License

MIT. See [LICENSE](LICENSE).
