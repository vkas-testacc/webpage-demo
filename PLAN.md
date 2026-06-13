# ChessMate — Build Plan

Goal: turn the landing page into a **real, working, on-device chess analysis PWA**
that matches the brief. No backend. Everything in the browser.

## Architecture decisions
- **Pure static site** (HTML/CSS/JS, no build step) so it deploys straight to GitHub Pages.
- **chess.js** (vendored, MIT) — legal move generation, PGN parse/load, FEN, SAN.
- **Stockfish (WASM/asm.js single-file)** via a Web Worker for real engine eval.
- **Lichess cloud-eval API** tried first per position (fast, depth 30+), Stockfish fallback.
- **Classification engine** — port the win%-loss thresholds from the brief
  (Brilliant→Blunder + Theory + Forced + Critical).
- **Accuracy** — Lichess-style: win% → per-move accuracy, volatility-weighted,
  blend of weighted mean + harmonic mean.
- **Storage** — localStorage/IndexedDB for the saved-games library.
- **PWA** — manifest.json + service worker for installability + offline shell.

## Pages / views (SPA, hash-routed, single index)
1. **Home** — paste PGN textarea, "Fetch from Chess.com / Lichess", recent library.
2. **Board view** — SVG board, move list w/ badges, eval bar, eval graph,
   controls (prev/next/flip/autoplay), analyse button + depth selector, progress bar.
3. **Share sheet** — copy FEN / copy PGN.

## Implementation steps
1. [x] Research + verify: chess.js works, Stockfish wasm loads in worker, Lichess API reachable.
2. [ ] Vendor chess.js + stockfish into /vendor (so it's offline & on GH Pages).
3. [ ] Build classify.js (win%, expected-points loss, thresholds, accuracy formula).
4. [ ] Build engine.js (worker wrapper: cloud-eval first, stockfish fallback, cancellable).
5. [ ] Build board.js (SVG board render, tap-to-move dots, badges, arrows).
6. [ ] Build app.js (state tree, move nav, analyse loop, progress, library).
7. [ ] Build app.html + app.css (the actual tool UI, mobile-first, bottom nav, glass bar).
8. [ ] manifest.json + sw.js + icons → PWA.
9. [ ] Wire landing "Open the app" → app.html.
10. [ ] Test end-to-end in headless browser with a real PGN; screenshot.
11. [ ] Push to GitHub.

## Risks / fallbacks
- Stockfish wasm may need COOP/COEP headers (threads). GH Pages can't set headers →
  use the **single-threaded** stockfish build (no SharedArrayBuffer needed).
- If wasm too heavy, asm.js fallback. Cloud-eval covers most positions instantly anyway.
- CORS: Lichess cloud-eval + Chess.com archive both allow browser CORS. Verify.
