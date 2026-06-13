/* ============================================================
   ChessMate landing — interactive demo (no engine, mock data)
   - SVG board renders from FEN strings (one per ply)
   - move list with real classification badges
   - eval bar + drag-to-jump eval graph
   ============================================================ */
(() => {
  'use strict';

  /* ---------- classification palette ---------- */
  const CLASS = {
    brilliant:{c:'#1baaa6',g:'!!',name:'Brilliant', desc:'A counter-threatful sacrifice only a tactical search would find.'},
    critical :{c:'#5b8baf',g:'!', name:'Critical',  desc:'The only winning move; every other loses ≥10% of your chances.'},
    best     :{c:'#98bc49',g:'✓', name:'Best',      desc:"Exactly what the engine wanted — its top choice."},
    excellent:{c:'#98bc49',g:'✓', name:'Excellent', desc:'Within 4.5% of best — statistically very strong.'},
    okay     :{c:'#97af8b',g:'·', name:'Okay',      desc:'Within 8% — a perfectly normal middlegame move.'},
    inaccuracy:{c:'#f4bf44',g:'?!',name:'Inaccuracy',desc:'Losing 8–12% of your expected score.'},
    mistake  :{c:'#e28c28',g:'?', name:'Mistake',   desc:'Losing 12–22% — the kind of move you start regretting.'},
    blunder  :{c:'#c93230',g:'??',name:'Blunder',   desc:'Losing more than 22% — the move that cost the game.'},
    theory   :{c:'#a88764',g:'📖',name:'Theory',    desc:'A known opening line from a 3,400-position book.'},
    forced   :{c:'#97af8b',g:'🔒',name:'Forced',    desc:'Only one legal move existed — the engine can’t judge it.'}
  };

  /* ---------- demo game: positions (FEN board field) + meta per ply ----------
     A clean illustrative line ending in a tactic. Eval in pawns (white pov). */
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  const PLIES = [
    // san, fenBoard, evalPawns, class, side
    {san:'e4',    fen:'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR',                 ev:0.2, cl:'theory', s:'w'},
    {san:'c5',    fen:'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR',               ev:0.2, cl:'theory', s:'b'},
    {san:'Nf3',   fen:'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R',            ev:0.3, cl:'theory', s:'w'},
    {san:'d6',    fen:'rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R',           ev:0.3, cl:'theory', s:'b'},
    {san:'d4',    fen:'rnbqkbnr/pp2pppp/3p4/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R',           ev:0.4, cl:'best',   s:'w'},
    {san:'cxd4',  fen:'rnbqkbnr/pp2pppp/3p4/8/3pP3/5N2/PPP2PPP/RNBQKB1R',             ev:0.3, cl:'okay',   s:'b'},
    {san:'Nxd4',  fen:'rnbqkbnr/pp2pppp/3p4/8/3NP3/8/PPP2PPP/RNBQKB1R',               ev:0.4, cl:'best',   s:'w'},
    {san:'Nf6',   fen:'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/8/PPP2PPP/RNBQKB1R',             ev:0.4, cl:'theory', s:'b'},
    {san:'Nc3',   fen:'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R',           ev:0.5, cl:'best',   s:'w'},
    {san:'a6',    fen:'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R',          ev:0.5, cl:'theory', s:'b'},
    {san:'Be2',   fen:'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP1BPPP/R1BQK2R',          ev:0.6, cl:'excellent',s:'w'},
    {san:'e5',    fen:'rnbqkb1r/1p3ppp/p2p1n2/4p3/3NP3/2N5/PPP1BPPP/R1BQK2R',         ev:0.9, cl:'inaccuracy',s:'b'},
    {san:'Nb3',   fen:'rnbqkb1r/1p3ppp/p2p1n2/4p3/4P3/1NN5/PPP1BPPP/R1BQK2R',         ev:0.8, cl:'best',   s:'w'},
    {san:'Be7',   fen:'rnbqk2r/1p2bppp/p2p1n2/4p3/4P3/1NN5/PPP1BPPP/R1BQK2R',         ev:0.8, cl:'okay',   s:'b'},
    {san:'O-O',   fen:'rnbqk2r/1p2bppp/p2p1n2/4p3/4P3/1NN5/PPP1BPPP/R1BQ1RK1',        ev:0.9, cl:'best',   s:'w'},
    {san:'O-O',   fen:'rnbq1rk1/1p2bppp/p2p1n2/4p3/4P3/1NN5/PPP1BPPP/R1BQ1RK1',       ev:0.9, cl:'best',   s:'b'},
    {san:'Be3',   fen:'rnbq1rk1/1p2bppp/p2p1n2/4p3/4P3/1NN1B3/PPP1BPPP/R2Q1RK1',      ev:1.0, cl:'best',   s:'w'},
    {san:'Bg4??', fen:'rn1q1rk1/1p2bppp/p2p1n2/4p3/4P1b1/1NN1B3/PPP1BPPP/R2Q1RK1',    ev:2.6, cl:'blunder',s:'b'},
    {san:'Bxg4',  fen:'rn1q1rk1/1p2bppp/p2p1n2/4p3/4P1B1/1NN1B3/PPP2PPP/R2Q1RK1',     ev:2.6, cl:'best',   s:'w'},
    {san:'Nxg4',  fen:'rn1q1rk1/1p2bppp/p2p4/4p3/4P1n1/1NN1B3/PPP2PPP/R2Q1RK1',       ev:2.4, cl:'forced', s:'b'},
    {san:'Qxg4',  fen:'rn1q1rk1/1p2bppp/p2p4/4p3/4P1Q1/1NN1B3/PPP2PPP/R4RK1',         ev:2.5, cl:'best',   s:'w'},
    {san:'Bg5',   fen:'rn1q1rk1/1p3ppp/p2p4/4p1b1/4P1Q1/1NN1B3/PPP2PPP/R4RK1',        ev:2.4, cl:'okay',   s:'b'},
    {san:'Rad1',  fen:'rn1q1rk1/1p3ppp/p2p4/4p1b1/4P1Q1/1NN1B3/PPP2PPP/3R1RK1',       ev:2.7, cl:'critical',s:'w'},
    {san:'Bxe3',  fen:'rn1q1rk1/1p3ppp/p2p4/4p3/4P1Q1/1NN1b3/PPP2PPP/3R1RK1',         ev:2.6, cl:'mistake',s:'b'},
    {san:'Qg3!!', fen:'rn1q1rk1/1p3ppp/p2p4/4p3/4P3/1NN1b1Q1/PPP2PPP/3R1RK1',         ev:4.1, cl:'brilliant',s:'w'},
  ];

  /* ---------- piece glyphs (unicode) ---------- */
  const GLYPH = {
    K:'\u2654',Q:'\u2655',R:'\u2656',B:'\u2657',N:'\u2658',P:'\u2659',
    k:'\u265A',q:'\u265B',r:'\u265C',b:'\u265D',n:'\u265E',p:'\u265F'
  };

  /* ---------- state ---------- */
  let idx = -1;          // -1 = start position
  let flipped = false;
  let playing = false;
  let timer = null;

  const $ = s => document.querySelector(s);
  const boardSvg = $('#boardSvg');
  const evalWhite = $('#evalWhite');
  const evalNum = $('#evalNum');
  const evalSide = $('#evalSide');
  const moveLabel = $('#moveLabel');
  const graphSvg = $('#graphSvg');
  const movelistEl = $('#movelist');

  /* ---------- decorative hero board grid ---------- */
  (() => {
    const g = $('#hbGrid'); if(!g) return;
    for(let r=0;r<8;r++) for(let c=0;c<8;c++){
      const i=document.createElement('i');
      i.className=(r+c)%2? 'd':'l'; g.appendChild(i);
    }
  })();

  /* ---------- render board from FEN board field ---------- */
  function fenToGrid(fen){
    const rows = fen.split('/');
    const grid = [];
    for(const row of rows){
      const line=[];
      for(const ch of row){
        if(/\d/.test(ch)){ for(let k=0;k<+ch;k++) line.push(null); }
        else line.push(ch);
      }
      grid.push(line);
    }
    return grid;
  }

  function drawBoard(fen, badge){
    const grid = fenToGrid(fen);
    const S = 100;
    let svg = '';
    // squares
    for(let r=0;r<8;r++){
      for(let c=0;c<8;c++){
        const rr = flipped? 7-r : r;
        const cc = flipped? 7-c : c;
        const dark = (rr+cc)%2===1;
        svg += `<rect x="${c*S}" y="${r*S}" width="${S}" height="${S}" fill="${dark?'#262017':'#3b3225'}"/>`;
      }
    }
    // coordinates
    for(let i=0;i<8;i++){
      const file = String.fromCharCode(97 + (flipped?7-i:i));
      const rank = (flipped? i+1 : 8-i);
      svg += `<text x="${i*S+8}" y="${790}" font-family="IBM Plex Mono,monospace" font-size="20" fill="${(i%2? '#3b3225':'#262017')}">${file}</text>`;
      svg += `<text x="${786}" y="${i*S+26}" text-anchor="end" font-family="IBM Plex Mono,monospace" font-size="20" fill="${(i%2? '#262017':'#3b3225')}">${rank}</text>`;
    }
    // pieces
    for(let r=0;r<8;r++){
      for(let c=0;c<8;c++){
        const rr = flipped? 7-r : r;
        const cc = flipped? 7-c : c;
        const p = grid[rr][cc];
        if(!p) continue;
        const isWhite = p===p.toUpperCase();
        const x=c*S+S/2, y=r*S+S/2;
        svg += `<text x="${x}" y="${y+30}" text-anchor="middle" font-size="84"
                 fill="${isWhite?'#f3ece0':'#0d0b07'}"
                 stroke="${isWhite?'#0d0b07':'#5a5040'}" stroke-width="${isWhite?1.2:1.4}"
                 style="paint-order:stroke">${GLYPH[p]}</text>`;
      }
    }
    boardSvg.innerHTML = svg;

    // floating classification badge over a representative square (top-right area)
    if(badge){
      const cl = CLASS[badge];
      const bx = 700, by = 60;
      const b = document.createElementNS('http://www.w3.org/2000/svg','g');
      b.innerHTML = `<circle cx="${bx}" cy="${by}" r="42" fill="${cl.c}"/>
        <text x="${bx}" y="${by+14}" text-anchor="middle" font-family="IBM Plex Mono,monospace"
        font-size="38" font-weight="700" fill="#0c0a06">${cl.g}</text>`;
      boardSvg.appendChild(b);
    }
  }

  /* ---------- eval bar + readout ---------- */
  function setEval(ev){
    // logistic-ish mapping pawns -> 0..100
    const pct = 50 + 50 * (2/(1+Math.exp(-0.5*ev)) - 1);
    evalWhite.style.width = Math.max(4,Math.min(96,pct)) + '%';
    const sign = ev>0? '+':'';
    evalNum.textContent = (ev===0?'0.0':sign+ev.toFixed(1));
    evalSide.textContent = Math.abs(ev)<0.3? 'equal' : (ev>0? 'White is better':'Black is better');
  }

  /* ---------- eval graph ---------- */
  function buildGraph(){
    const W=300,H=90, n=PLIES.length;
    const pts = PLIES.map((p,i)=>{
      const x = (i/(n-1))*W;
      const pct = 50 + 50*(2/(1+Math.exp(-0.5*p.ev))-1);
      const y = H - (pct/100)*H;
      return [x,y];
    });
    let area = `M0,${H} `;
    pts.forEach(([x,y])=> area += `L${x.toFixed(1)},${y.toFixed(1)} `);
    area += `L${W},${H} Z`;
    let line = pts.map(([x,y],i)=> (i?'L':'M')+x.toFixed(1)+','+y.toFixed(1)).join(' ');
    // dramatic dots
    let dots='';
    PLIES.forEach((p,i)=>{
      if(['brilliant','blunder','critical','mistake'].includes(p.cl)){
        dots += `<circle cx="${pts[i][0].toFixed(1)}" cy="${pts[i][1].toFixed(1)}" r="3.2" fill="${CLASS[p.cl].c}" stroke="#14110d" stroke-width="1"/>`;
      }
    });
    graphSvg.innerHTML =
      `<defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0" stop-color="#d8a629" stop-opacity=".28"/>
         <stop offset="1" stop-color="#d8a629" stop-opacity="0"/>
       </linearGradient></defs>
       <line x1="0" y1="${H/2}" x2="${W}" y2="${H/2}" stroke="#3a3127" stroke-dasharray="3 4"/>
       <path d="${area}" fill="url(#ga)"/>
       <path d="${line}" fill="none" stroke="#d8a629" stroke-width="1.6"/>
       ${dots}
       <g id="marker"></g>`;
  }
  function moveMarker(){
    const W=300,H=90, n=PLIES.length;
    const i = idx<0?0:idx;
    const x=(i/(n-1))*W;
    const pct = 50 + 50*(2/(1+Math.exp(-0.5*(idx<0?0:PLIES[idx].ev)))-1);
    const y=H-(pct/100)*H;
    const m=graphSvg.querySelector('#marker');
    if(m) m.innerHTML = `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${H}" stroke="#d8a629" stroke-width="1" opacity=".4"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="#d8a629" stroke="#14110d" stroke-width="1.5"/>`;
  }

  /* ---------- move list ---------- */
  function buildMovelist(){
    let html='';
    for(let i=0;i<PLIES.length;i+=2){
      const wm=PLIES[i], bm=PLIES[i+1];
      const cell = (m,j)=> m? `<div class="mv" data-i="${j}">
            <span class="bdg" style="background:${CLASS[m.cl].c}">${CLASS[m.cl].g}</span>${m.san}
          </div>` : '<div></div>';
      html += `<div class="mrow"><span class="no">${i/2+1}.</span>${cell(wm,i)}${cell(bm,i+1)}</div>`;
    }
    movelistEl.innerHTML = html;
    movelistEl.querySelectorAll('.mv').forEach(el=>{
      el.addEventListener('click',()=>{ stop(); goto(+el.dataset.i); });
    });
  }
  function highlightMove(){
    movelistEl.querySelectorAll('.mv').forEach(el=> el.classList.toggle('active', +el.dataset.i===idx));
    const a=movelistEl.querySelector('.mv.active');
    if(a) a.scrollIntoView({block:'nearest'});
  }

  /* ---------- legend ---------- */
  (() => {
    const order=['brilliant','critical','best','excellent','okay','inaccuracy','mistake','blunder','theory','forced'];
    const g=$('#legendGrid'); if(!g) return;
    g.innerHTML = order.map(k=>{
      const c=CLASS[k];
      return `<div class="leg" style="--cc:${c.c}">
        <span class="chip">${c.g}</span>
        <span class="txt"><b>${c.name}</b><span>${c.desc}</span></span>
      </div>`;
    }).join('');
  })();

  /* ---------- navigation ---------- */
  function render(){
    if(idx<0){ drawBoard(START); setEval(0); moveLabel.textContent='Start position'; }
    else{
      const p=PLIES[idx];
      drawBoard(p.fen, p.cl);
      setEval(p.ev);
      const num=Math.floor(idx/2)+1;
      moveLabel.textContent = `${num}${p.s==='w'?'.':'…'} ${p.san} · ${CLASS[p.cl].name}`;
    }
    highlightMove();
    moveMarker();
  }
  function goto(i){ idx=Math.max(-1,Math.min(PLIES.length-1,i)); render(); }
  function next(){ if(idx<PLIES.length-1){ goto(idx+1); return true;} return false; }
  function prev(){ goto(idx-1); }

  function play(){
    playing=true; $('#btnPlay').textContent='⏸ Stop'; $('#btnPlay').classList.add('on');
    timer=setInterval(()=>{ if(!next()) stop(); },1200);
  }
  function stop(){
    playing=false; clearInterval(timer);
    $('#btnPlay').textContent='▶ Autoplay'; $('#btnPlay').classList.remove('on');
  }

  $('#btnNext').onclick=()=>{stop();next();};
  $('#btnPrev').onclick=()=>{stop();prev();};
  $('#btnStart').onclick=()=>{stop();goto(-1);};
  $('#btnFlip').onclick=()=>{flipped=!flipped;render();};
  $('#btnPlay').onclick=()=> playing? stop():play();

  // graph drag-to-jump
  function graphJump(e){
    const r=graphSvg.getBoundingClientRect();
    const x=( (e.touches?e.touches[0].clientX:e.clientX) - r.left)/r.width;
    stop(); goto(Math.round(x*(PLIES.length-1)));
  }
  let dragging=false;
  graphSvg.addEventListener('pointerdown',e=>{dragging=true;graphJump(e);});
  window.addEventListener('pointermove',e=>{if(dragging)graphJump(e);});
  window.addEventListener('pointerup',()=>dragging=false);

  // keyboard
  window.addEventListener('keydown',e=>{
    if(e.key==='ArrowRight'){stop();next();}
    if(e.key==='ArrowLeft'){stop();prev();}
  });

  buildMovelist(); buildGraph(); render();

  /* ============================================================
     nav scroll state + reveal-on-scroll
     ============================================================ */
  const nav=$('#nav');
  window.addEventListener('scroll',()=> nav.classList.toggle('scrolled', window.scrollY>30), {passive:true});

  const io=new IntersectionObserver((entries)=>{
    entries.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target);} });
  },{threshold:.12});
  document.querySelectorAll('.reveal:not(.in)').forEach(el=>io.observe(el));
})();
