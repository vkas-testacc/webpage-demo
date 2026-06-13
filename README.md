# ♞ ChessMate

**Chess analysis, the way it should be.** A landing page for ChessMate — a private,
on-device chess analysis tool powered by Stockfish 17. No accounts, no ads, no servers.

Crafted by **VKAS**.

## Live demo
This is a static site. Once GitHub Pages is enabled, it's served at:
`https://vkas-testacc.github.io/webpage-demo/`

## Stack
- Plain HTML / CSS / vanilla JS — no build step, no dependencies, no GPU load.
- Interactive board, move-list with 10 real move classifications, eval bar and
  drag-to-jump eval graph are all rendered with inline SVG + a small hardcoded demo game.
- Fonts: Fraunces (display serif), Newsreader (reading serif), IBM Plex Mono (instrument voice).

## Files
- `index.html` — page structure
- `styles.css` — design system (dark tournament-hall + gold)
- `app.js` — interactive demo logic

## Notes
The classification engine described is derived from the WintrChess project (GPL-3.0);
Stockfish 17 lite is bundled under its original licence. This page is a marketing/demo
front-end only — the live preview uses mock evaluations.
