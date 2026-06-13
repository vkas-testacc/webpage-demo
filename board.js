/* ============================================================
   ChessMate — SVG board renderer
   draws from a chess.js board() array, supports flip,
   tap-to-move dots, last-move highlight, classification badge,
   and best-move arrows.
   ============================================================ */

const GLYPH = {
  wk:'\u2654',wq:'\u2655',wr:'\u2656',wb:'\u2657',wn:'\u2658',wp:'\u2659',
  bk:'\u265A',bq:'\u265B',br:'\u265C',bb:'\u265D',bn:'\u265E',bp:'\u265F'
};
const FILES = ['a','b','c','d','e','f','g','h'];
const S = 100; // unit square in viewBox

export class Board {
  constructor(svgEl){
    this.svg = svgEl;
    this.flipped = false;
    this.onSquare = null;       // callback(square) for tap-to-move
    this.legalDots = [];        // squares to show move dots
    this.selected = null;
    this.svg.addEventListener('click', e=> this._click(e));
    this.svg.addEventListener('touchend', e=>{ e.preventDefault(); this._click(e.changedTouches[0]); }, {passive:false});
  }

  _sqAt(clientX, clientY){
    const r = this.svg.getBoundingClientRect();
    let c = Math.floor((clientX - r.left)/r.width*8);
    let row = Math.floor((clientY - r.top)/r.height*8);
    c = Math.max(0,Math.min(7,c)); row = Math.max(0,Math.min(7,row));
    const file = this.flipped? 7-c : c;
    const rank = this.flipped? row+1 : 8-row;
    return FILES[file]+rank;
  }
  _click(e){ if(this.onSquare && e) this.onSquare(this._sqAt(e.clientX, e.clientY)); }

  _xy(square){
    const file = FILES.indexOf(square[0]);
    const rank = parseInt(square[1],10);
    const c = this.flipped? 7-file : file;
    const row = this.flipped? rank-1 : 8-rank;
    return {x:c*S, y:row*S, cx:c*S+S/2, cy:row*S+S/2};
  }

  render(boardArr, opts={}){
    const {lastMove, badge, arrows=[], check} = opts;
    let g = '';
    // squares
    for(let r=0;r<8;r++) for(let c=0;c<8;c++){
      const dark=(r+c)%2===1;
      g += `<rect x="${c*S}" y="${r*S}" width="${S}" height="${S}" fill="${dark?'#262017':'#3b3225'}"/>`;
    }
    // last move highlight
    if(lastMove){
      for(const sq of [lastMove.from, lastMove.to]){
        const {x,y}=this._xy(sq);
        g += `<rect x="${x}" y="${y}" width="${S}" height="${S}" fill="#d8a629" opacity="0.20"/>`;
      }
    }
    // check highlight
    if(check){
      const {cx,cy}=this._xy(check);
      g += `<circle cx="${cx}" cy="${cy}" r="58" fill="#c93230" opacity="0.30"/>`;
    }
    // coordinates
    for(let i=0;i<8;i++){
      const file = this.flipped? FILES[7-i] : FILES[i];
      const rank = this.flipped? i+1 : 8-i;
      g += `<text x="${i*S+7}" y="792" font-family="IBM Plex Mono,monospace" font-size="19" fill="${i%2?'#3b3225':'#262017'}">${file}</text>`;
      g += `<text x="789" y="${i*S+25}" text-anchor="end" font-family="IBM Plex Mono,monospace" font-size="19" fill="${i%2?'#262017':'#3b3225'}">${rank}</text>`;
    }
    // pieces
    if(boardArr){
      for(let row=0;row<8;row++) for(let col=0;col<8;col++){
        const pc = boardArr[row][col];
        if(!pc) continue;
        const square = FILES[col] + (8-row);
        const {cx,cy}=this._xy(square);
        const key = pc.color + pc.type;
        const isW = pc.color==='w';
        g += `<text x="${cx}" y="${cy+30}" text-anchor="middle" font-size="82"
               fill="${isW?'#f3ece0':'#0d0b07'}" stroke="${isW?'#0d0b07':'#5a5040'}"
               stroke-width="${isW?1.1:1.3}" style="paint-order:stroke">${GLYPH[key]}</text>`;
      }
    }
    // legal-move dots
    for(const sq of this.legalDots){
      const {cx,cy}=this._xy(sq);
      g += `<circle cx="${cx}" cy="${cy}" r="16" fill="#0c0a06" opacity="0.35"/>`;
    }
    if(this.selected){
      const {x,y}=this._xy(this.selected);
      g += `<rect x="${x}" y="${y}" width="${S}" height="${S}" fill="#d8a629" opacity="0.28"/>`;
    }
    // arrows
    g += `<defs><marker id="ah" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
            <path d="M0,0 L4,2 L0,4 Z" fill="#d8a629"/></marker></defs>`;
    for(const a of arrows){
      const f=this._xy(a.from), t=this._xy(a.to);
      g += `<line x1="${f.cx}" y1="${f.cy}" x2="${t.cx}" y2="${t.cy}" stroke="${a.color||'#d8a629'}"
             stroke-width="14" opacity="0.62" marker-end="url(#ah)" stroke-linecap="round"/>`;
    }
    // classification badge over destination square
    if(badge && lastMove){
      const {cx,cy}=this._xy(lastMove.to);
      g += `<circle cx="${cx+30}" cy="${cy-30}" r="26" fill="${badge.c}" stroke="#14110d" stroke-width="3"/>
            <text x="${cx+30}" y="${cy-30+9}" text-anchor="middle" font-family="IBM Plex Mono,monospace"
            font-size="24" font-weight="700" fill="#0c0a06">${badge.g}</text>`;
    }
    this.svg.innerHTML = g;
  }
}
