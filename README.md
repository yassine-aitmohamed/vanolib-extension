<p align="center"><img src="docs/citation-card.jpg" alt="VanoLib Reader showing a citation card" width="900"></p>

<h1 align="center">VanoLib Reader</h1>
<p align="center"><b>A better PDF reader for papers, right in your browser.</b><br>
Click a citation and see the reference instantly. Highlight, annotate, save for later, read at night.</p>
<p align="center"><a href="README.fr.md">Version française</a></p>

---

## Why VanoLib Reader

Reading a paper in the browser's built-in PDF viewer means scrolling back and forth to the reference list, losing your place, and starting from zero every time you reopen the file. VanoLib Reader fixes that.

- **Citation cards.** Click or hover a citation such as `[5]` and the full reference appears in a card, with one-click links to the paper, Google Scholar and arXiv, plus Copy and BibTeX. "Go to the reference list" jumps there with a Back button.
- **Annotate like on paper.** Pen, highlighter in four colours, underline, notes on the page and comments on a passage, with undo and redo. Every annotation is saved per PDF and listed in the sidebar.
- **Reading list, offline.** Save a PDF with ⌘D / Ctrl+D: it stays readable offline, and reopens at the page where you stopped, with your highlights.
- **Comfortable reading.** Sharp text at every zoom, day, sepia and night modes, search, outline and page thumbnails.
- **One-click download** to a dedicated folder, and **send to VanoAtlas** if you use [VanoAtlas](https://github.com/yassine-aitmohamed/vanoatlas).
- **Private.** Everything stays in your browser. No account, no tracking, no server.
- **Free and open source** (MIT).

## Screenshots

| | |
|---|---|
| <img src="docs/reader.jpg" alt="Reader"> **Reader**: sharp text, toolbar with annotation tools. | <img src="docs/citation-card.jpg" alt="Citation card"> **Citation card**: the reference, without leaving the page. |
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

## License

MIT. See [LICENSE](LICENSE).
