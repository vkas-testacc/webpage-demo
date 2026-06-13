# ♞ ChessMate

**Chess analysis, the way it should be.** A private, on-device chess analysis tool
powered by Stockfish 17 + Lichess cloud evaluation. No accounts, no ads, no servers.

Crafted by **VKAS**.

## Live
- **Landing page:** `https://vkas-testacc.github.io/webpage-demo/`
- **The app:** `https://vkas-testacc.github.io/webpage-demo/app.html`

## What it does (and it really does it)
- **Paste a PGN** (or fetch a real game from Chess.com / Lichess public archives) and analyse it.
- **Real engine:** Lichess cloud-eval is tried first per position (fast, deep); the bundled
  **Stockfish** Web Worker takes over otherwise. Analysis is cancellable mid-run.
- **10 move classifications** — Brilliant, Critical, Best, Excellent, Okay, Inaccuracy,
  Mistake, Blunder, Theory, Forced — shown on the move list, on the board, and on the graph.
- **Real accuracy** using the Lichess win%/expected-points model with volatility-weighted
  blend of weighted-mean + harmonic-mean (blunders hurt the score more).
- **Replay tools:** prev/next, autoplay, flip, eval bar, **drag-to-scrub eval graph**,
  tap-to-move to explore lines, best-alternative banner, arrow modes.
- **Library** saved in your browser (localStorage) — nothing leaves the device except the
  engine calls you explicitly trigger.
- **PWA** — installable, offline app shell via service worker.

## Stack (no build step, deploys straight to GitHub Pages)
- Vanilla ES modules: `app-main.js`, `engine.js`, `board.js`, `classify.js`
- `vendor/chess.js` (MIT) — move generation, PGN/FEN/SAN
- `vendor/stockfish.js` — single-file engine, runs in a Web Worker (no SharedArrayBuffer
  / COOP-COEP needed, so it works on plain GitHub Pages)
- Fonts: Fraunces, Newsreader, IBM Plex Mono
- Aesthetic: dark “tournament hall” + tournament gold

## Files
| File | Purpose |
|------|---------|
| `index.html` | Landing page |
| `app.html` / `app.css` | The analysis tool UI |
| `app-main.js` | App controller (state, nav, analyse loop, library, share) |
| `engine.js` | Stockfish worker + Lichess cloud-eval wrapper |
| `classify.js` | Win%, accuracy formula, 10-badge classification |
| `board.js` | SVG board renderer, tap-to-move, badges, arrows |
| `sw.js`, `manifest.json`, `icons/` | PWA |
| `styles.css` | Shared design system |

## Licences
- Stockfish — GPL-3.0 (bundled under its original licence).
- Classification model inspired by the WintrChess project (GPL-3.0) and the Lichess
  accuracy/win% formulas.
- `chess.js` — MIT.

> The first commit was a marketing landing page (`app.js` powers its interactive demo).
> This version adds the real working application.
