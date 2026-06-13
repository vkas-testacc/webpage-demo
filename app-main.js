/* ============================================================
   ChessMate — application controller (the real tool)
   ============================================================ */
import { Chess } from './vendor/chess.js';
import { Engine, STRENGTH } from './engine.js';
import { Board } from './board.js';
import {
  CLASS, evalToWhiteWin, cpToWin, moveAccuracy, classifyPly,
  sideAccuracy, emptyBreakdown
} from './classify.js';

/* ---------- tiny helpers ---------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const el = (tag,cls,html)=>{ const e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e; };

/* ---------- a tiny opening book (representative “theory” detection) ---------- */
const BOOK = new Set([
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b',     // 1.e4
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b',     // 1.d4
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w',   // Sicilian
  'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w',   // Scandinavian
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w',   // open
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w', // 2..Nc6
]);
function isBookFen(fen){ const parts=fen.split(' '); return BOOK.has(parts[0]+' '+parts[1]); }

/* ============================================================
   STATE
   ============================================================ */
const state = {
  chess: new Chess(),
  history: [],         // [{san, from, to, fenAfter, color}]
  ply: 0,              // 0 = start, history index = ply-1 played
  flipped: false,
  analysis: null,      // per-ply: {cp, win, class, accLoss, bestUci}
  accuracy: null,      // {white, black, breakdownW, breakdownB}
  strength: 'balanced',
  arrowMode: 'off',    // off|continuation|alternative
  analysing: false,
  white:'White', black:'Black',
  playing:false, playTimer:null,
};
const engine = new Engine();
let board;

/* ============================================================
   PGN loading
   ============================================================ */
function loadPgn(pgn){
  const c = new Chess();
  try{ c.loadPgn(pgn, {sloppy:true}); }
  catch(e){ try{ c.loadPgn(pgn); }catch(e2){ return false; } }
  const verbose = c.history({verbose:true});
  if(!verbose.length) return false;

  state.chess = c;
  state.history = [];
  const replay = new Chess();
  for(const m of verbose){
    replay.move(m);
    state.history.push({ san:m.san, from:m.from, to:m.to, color:m.color, fenAfter:replay.fen() });
  }
  // headers for names
  const h = c.header();
  state.white = h.White || 'White';
  state.black = h.Black || 'Black';
  state.ply = 0;
  state.analysis = null;
  state.accuracy = null;
  return true;
}

function fenAtPly(ply){
  if(ply<=0) return new Chess().fen();
  return state.history[ply-1].fenAfter;
}
function chessAtPly(ply){
  const c=new Chess();
  for(let i=0;i<ply;i++) c.move(state.history[i].san);
  return c;
}

/* ============================================================
   RENDER board view
   ============================================================ */
function render(){
  const c = chessAtPly(state.ply);
  const last = state.ply>0 ? state.history[state.ply-1] : null;
  const an = state.analysis && state.ply>0 ? state.analysis[state.ply-1] : null;
  const badge = an ? CLASS[an.class] : null;

  // check highlight
  let check=null;
  if(c.inCheck()){
    const turn=c.turn();
    const bd=c.board();
    for(let r=0;r<8;r++)for(let col=0;col<8;col++){const p=bd[r][col];if(p&&p.type==='k'&&p.color===turn)check='abcdefgh'[col]+(8-r);}
  }

  // arrows
  let arrows=[];
  if(state.arrowMode!=='off' && state.analysis){
    const idx = state.ply; // best move FROM current position
    const a = state.ply>0 ? state.analysis[state.ply-1] : null;
    if(state.arrowMode==='continuation' && an && an.contUci) arrows=[uciToArrow(an.contUci,'#d8a629')];
    if(state.arrowMode==='alternative' && an && an.bestUci && !an.isBest) arrows=[uciToArrow(an.bestUci,'#98bc49')];
  }

  board.flipped = state.flipped;
  board.render(c.board(), {lastMove:last, badge, arrows, check});

  // eval bar + readout
  const ev = (an && an.win!=null) ? an.win : 50;
  $('#evalFill').style.height = Math.max(3,Math.min(97,ev))+'%';
  if(an){
    const cp = an.cp;
    const sign = cp>0?'+':'';
    $('#evalText').textContent = an.mate!=null ? ('M'+Math.abs(an.mate)) : (cp===0?'0.0':sign+(cp/100).toFixed(1));
  } else $('#evalText').textContent='–';

  // move label
  if(last){
    const n=Math.floor((state.ply-1)/2)+1;
    const dots = last.color==='w'?'.':'…';
    $('#turnLabel').textContent = `${n}${dots} ${last.san}` + (an? ' · '+CLASS[an.class].name : '');
  } else $('#turnLabel').textContent='Start position';

  // best-alternative banner
  const banner=$('#altBanner');
  if(an && an.bestUci && !an.isBest && an.class!=='theory' && an.class!=='forced'){
    banner.style.display='flex';
    banner.querySelector('.alt-txt').textContent = `Engine preferred ${uciToSan(state.ply-1, an.bestUci)} here`;
  } else banner.style.display='none';

  highlightMoveList();
  drawGraph();
  updatePlayers();
}

function uciToArrow(uci,color){ return {from:uci.slice(0,2),to:uci.slice(2,4),color}; }
function uciToSan(plyBefore, uci){
  try{ const c=chessAtPly(plyBefore); const m=c.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci.slice(4)||'q'}); return m? m.san : uci; }
  catch(e){ return uci; }
}

function updatePlayers(){
  $('#pBlack').textContent = state.flipped? state.white : state.black;
  $('#pWhite').textContent = state.flipped? state.black : state.white;
}

/* ============================================================
   MOVE LIST
   ============================================================ */
function buildMoveList(){
  const ml=$('#movelist'); ml.innerHTML='';
  for(let i=0;i<state.history.length;i+=2){
    const row=el('div','mrow');
    row.appendChild(el('span','no',(i/2+1)+'.'));
    row.appendChild(moveCell(i));
    row.appendChild(state.history[i+1]? moveCell(i+1): el('div'));
    ml.appendChild(row);
  }
}
function moveCell(i){
  const m=state.history[i];
  const an=state.analysis? state.analysis[i]:null;
  const cell=el('div','mv');
  cell.dataset.ply=i+1;
  if(an){
    const b=el('span','bdg',CLASS[an.class].g);
    b.style.background=CLASS[an.class].c;
    cell.appendChild(b);
  }
  cell.appendChild(document.createTextNode(m.san));
  cell.addEventListener('click',()=>{ stopPlay(); goto(i+1); });
  return cell;
}
function highlightMoveList(){
  $$('#movelist .mv').forEach(c=>c.classList.toggle('active', +c.dataset.ply===state.ply));
  const a=$('#movelist .mv.active'); if(a) a.scrollIntoView({block:'nearest'});
}

/* ============================================================
   EVAL GRAPH
   ============================================================ */
function drawGraph(){
  const svg=$('#graph'); const W=300,H=80;
  if(!state.analysis){ svg.innerHTML=`<line x1="0" y1="${H/2}" x2="${W}" y2="${H/2}" stroke="#3a3127" stroke-dasharray="3 4"/>`; return; }
  const n=state.analysis.length;
  // collect only analysed plies (skip trailing/holes), keep their ply index for x position
  const items=[];
  state.analysis.forEach((a,i)=>{ if(a && a.win!=null) items.push({a,i}); });
  if(!items.length){ svg.innerHTML=`<line x1="0" y1="${H/2}" x2="${W}" y2="${H/2}" stroke="#3a3127" stroke-dasharray="3 4"/>`; return; }
  const xOf = i => (i/(Math.max(1,n-1)))*W;
  const pts=items.map(({a,i})=>[xOf(i), H-(a.win/100)*H]);
  let area=`M${pts[0][0].toFixed(1)},${H} `+pts.map(p=>`L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')+` L${pts[pts.length-1][0].toFixed(1)},${H} Z`;
  let line=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
  let dots='';
  items.forEach(({a,i},k)=>{ if(['brilliant','blunder','critical','mistake'].includes(a.class))
    dots+=`<circle cx="${pts[k][0].toFixed(1)}" cy="${pts[k][1].toFixed(1)}" r="3" fill="${CLASS[a.class].c}" stroke="#14110d"/>`; });
  const mx=xOf(Math.max(0,state.ply-1));
  svg.innerHTML=`<defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d8a629" stop-opacity=".3"/><stop offset="1" stop-color="#d8a629" stop-opacity="0"/></linearGradient></defs>
    <line x1="0" y1="${H/2}" x2="${W}" y2="${H/2}" stroke="#3a3127" stroke-dasharray="3 4"/>
    <path d="${area}" fill="url(#gg)"/><path d="${line}" fill="none" stroke="#d8a629" stroke-width="1.5"/>
    ${dots}
    <line x1="${mx.toFixed(1)}" y1="0" x2="${mx.toFixed(1)}" y2="${H}" stroke="#d8a629" opacity=".4"/>`;
}
function graphJump(e){
  const svg=$('#graph'); if(!state.analysis) return;
  const r=svg.getBoundingClientRect();
  const x=((e.touches?e.touches[0].clientX:e.clientX)-r.left)/r.width;
  stopPlay(); goto(Math.round(x*(state.analysis.length-1))+1);
}

/* ============================================================
   NAVIGATION
   ============================================================ */
function goto(ply){ state.ply=Math.max(0,Math.min(state.history.length,ply)); render(); }
function next(){ if(state.ply<state.history.length){ goto(state.ply+1); return true;} return false; }
function prev(){ goto(state.ply-1); }
function play(){ state.playing=true; setPlayBtn(); state.playTimer=setInterval(()=>{ if(!next()) stopPlay(); },1200); }
function stopPlay(){ state.playing=false; clearInterval(state.playTimer); setPlayBtn(); }
function setPlayBtn(){ const b=$('#cPlay'); b.textContent=state.playing?'⏸':'▶'; b.classList.toggle('on',state.playing); }

/* ============================================================
   ANALYSE LOOP
   ============================================================ */
async function analyse(){
  if(state.analysing || !state.history.length) return;
  state.analysing=true; engine.resume();
  $('#analyseBtn').textContent='■ Stop';
  $('#analyseBtn').classList.add('analysing');
  $('#progress').style.display='block';
  const depth = STRENGTH[state.strength].depth;
  const total = state.history.length;
  const an = new Array(total).fill(null);

  await engine.init();   // ok if cloud-only

  // win% sequence (white POV) indexed by ply: winSeq[0]=start, winSeq[i+1]=after move i
  const winSeq=new Array(total+1).fill(null);
  winSeq[0]=50;

  try{
    for(let i=0;i<total;i++){
      if(state.analysing===false) break;
      const before = chessAtPly(i);
      const after  = chessAtPly(i+1);
      const mover  = state.history[i].color; // 'w'|'b'

      // multipv on the position BEFORE the move (to know best + 2nd best)
      let pvs;
      try{ pvs = await engine.multi(before.fen(), depth, 2); }
      catch(e){ if(e.message==='cancelled') break; pvs=[{type:'cp',value:0,pv:[]}]; }

      // eval AFTER the move (for the realised win%)
      let evAfter;
      try{ evAfter = await engine.evaluate(after.fen(), depth); }
      catch(e){ if(e.message==='cancelled') break; evAfter={type:'cp',value:0}; }

      // convert everything to WHITE win%
      const bestWhiteWin = sideEvalToWhiteWin(before.turn(), pvs[0]);
      const secondWhiteWin = pvs[1]? sideEvalToWhiteWin(before.turn(), pvs[1]) : null;
      const playedWhiteWin = evalAfterToWhiteWinReal(evAfter, after.turn());

      // mover-POV win%
      const toMoverPov = w => mover==='w'? w : 100-w;
      const bestMover = toMoverPov(bestWhiteWin);
      const playedMover = toMoverPov(playedWhiteWin);
      const secondMover = secondWhiteWin!=null? toMoverPov(secondWhiteWin):null;

      // played uci & best uci
      const playedUci = state.history[i].from + state.history[i].to;
      const bestUci = pvs[0].pv && pvs[0].pv[0] ? pvs[0].pv[0] : null;
      const isBest = bestUci && playedUci === bestUci.slice(0,4);

      // forced?
      const isOnly = before.moves().length===1;
      // theory?
      const isTheory = isBookFen(before.fen()) || (i<10 && isBookFen(after.fen()));
      // sacrifice heuristic: material dropped but eval stays good
      const isSac = detectSacrifice(before, after, mover, playedMover);

      const cls = classifyPly({
        isTheory, isOnlyMove:isOnly, isBest,
        bestWinForMover:bestMover, playedWinForMover:playedMover,
        secondBestWinForMover:secondMover, isSacrifice:isSac
      });

      an[i] = {
        cp: evalAfterToCp(evAfter),
        mate: evAfter.type==='mate'? evAfter.value:null,
        win: playedWhiteWin,
        class: cls,
        isBest,
        bestUci,
        contUci: (evAfter.pv&&evAfter.pv[0])? evAfter.pv[0]:null,
        accLoss: Math.max(0, bestMover-playedMover)
      };
      winSeq[i+1]=playedWhiteWin;

      // live update
      state.analysis = an.slice();
      buildMoveList();
      goto(i+1);
      $('#progFill').style.width = Math.round((i+1)/total*100)+'%';
      $('#progText').textContent = `Analysing… ${i+1}/${total}`;
      await new Promise(r=>setTimeout(r,0));
    }
  }finally{
    finishAnalysis(an, winSeq);
  }
}

function finishAnalysis(an, winSeq){
  state.analysing=false;
  $('#analyseBtn').textContent='✓ Re-analyse';
  $('#analyseBtn').classList.remove('analysing');
  $('#progress').style.display='none';
  state.analysis=an; // keep full-length array (may contain trailing nulls), index-aligned to history

  // accuracy — iterate by ply index, skip unanalysed plies, keep winSeq aligned
  const wAcc=[], bAcc=[], wWinPov=[], bWinPov=[];
  const bd={w:emptyBreakdown(), b:emptyBreakdown()};
  for(let i=0;i<an.length;i++){
    const a=an[i]; if(!a) continue;
    const mover=state.history[i].color;
    const before = (winSeq[i]!=null)? winSeq[i] : 50;
    const after  = (winSeq[i+1]!=null)? winSeq[i+1] : before;
    const beforePov = mover==='w'? before:100-before;
    const afterPov  = mover==='w'? after:100-after;
    const acc=moveAccuracy(beforePov, afterPov);
    if(mover==='w'){ wAcc.push(acc); wWinPov.push(afterPov); bd.w[a.class]++; }
    else { bAcc.push(acc); bWinPov.push(afterPov); bd.b[a.class]++; }
  }
  state.accuracy={
    white: sideAccuracy(winSeq, wAcc, wWinPov),
    black: sideAccuracy(winSeq, bAcc, bWinPov),
    bdW:bd.w, bdB:bd.b
  };
  renderReport();
  render();
}

function detectSacrifice(before, after, mover, playedMover){
  const val={p:1,n:3,b:3,r:5,q:9,k:0};
  const count=c=>{ let s=0; c.board().forEach(row=>row.forEach(p=>{ if(p&&p.color===mover) s+=val[p.type]; })); return s; };
  const mat = count(before)-count(after);
  return mat>=1 && playedMover>=48; // gave material but still fine/winning
}

/* eval converters */
function sideEvalToWhiteWin(turn, ev){
  // ev is from side-to-move POV (engine convention). convert to white.
  const w = cpFromEval(ev);
  const whiteCp = turn==='w'? w : -w;
  return cpToWin(whiteCp);
}
function cpFromEval(ev){
  if(ev.type==='mate') return ev.value>0? 10000 : -10000;
  return ev.value;
}
// wrap: compute white win% from an "after" eval using stored turn
function evalAfterToWhiteWinReal(ev, turnAfter){
  const cp=cpFromEval(ev);
  const whiteCp = turnAfter==='w'? cp : -cp;
  return cpToWin(whiteCp);
}
function evalAfterToCp(ev){ return cpFromEval(ev); }

/* ============================================================
   REPORT (accuracy card + breakdown)
   ============================================================ */
function renderReport(){
  if(!state.accuracy){ $('#report').style.display='none'; return; }
  $('#report').style.display='block';
  $('#accW').textContent=state.accuracy.white.toFixed(1);
  $('#accB').textContent=state.accuracy.black.toFixed(1);
  const order=['brilliant','critical','best','excellent','okay','inaccuracy','mistake','blunder','theory','forced'];
  const mk=(bd)=> order.map(k=> bd[k]? `<span class="bk"><i style="background:${CLASS[k].c}">${CLASS[k].g}</i>${bd[k]}</span>`:'').join('');
  $('#bdW').innerHTML=mk(state.accuracy.bdW);
  $('#bdB').innerHTML=mk(state.accuracy.bdB);
}

/* ============================================================
   tap-to-move (explore variations on the live board)
   ============================================================ */
function setupTapMove(){
  board.onSquare=(sq)=>{
    if(state.analysing) return;
    const c=chessAtPly(state.ply);
    if(board.selected){
      const moves=c.moves({square:board.selected,verbose:true});
      const mv=moves.find(m=>m.to===sq);
      if(mv){
        // play as a continuation from current ply (truncates forward history into a line)
        const newC=chessAtPly(state.ply); newC.move(mv);
        // append to history from this point (simple linear variation)
        state.history=state.history.slice(0,state.ply);
        state.history.push({san:mv.san,from:mv.from,to:mv.to,color:mv.color,fenAfter:newC.fen()});
        state.analysis=null; state.accuracy=null; renderReport();
        buildMoveList(); goto(state.ply+1);
        board.selected=null; board.legalDots=[]; return;
      }
    }
    // select own piece
    const pc=c.get(sq);
    if(pc && pc.color===c.turn()){
      board.selected=sq;
      board.legalDots=c.moves({square:sq,verbose:true}).map(m=>m.to);
    } else { board.selected=null; board.legalDots=[]; }
    render();
  };
}

/* ============================================================
   library (localStorage)
   ============================================================ */
const LIB_KEY='chessmate.library.v1';
function getLib(){ try{ return JSON.parse(localStorage.getItem(LIB_KEY)||'[]'); }catch(e){ return []; } }
function saveLib(l){ localStorage.setItem(LIB_KEY, JSON.stringify(l)); }
function saveCurrent(){
  if(!state.history.length) return;
  const lib=getLib();
  lib.unshift({
    id:Date.now(), white:state.white, black:state.black,
    date:new Date().toISOString().slice(0,10),
    pgn:exportPgn(), moves:state.history.length,
    accW: state.accuracy?state.accuracy.white:null,
    accB: state.accuracy?state.accuracy.black:null
  });
  saveLib(lib.slice(0,60)); renderLib();
  toast('Saved to your device');
}
function renderLib(){
  const lib=getLib();
  ['#library','#library2'].forEach(sel=>{
    const wrap=$(sel); if(!wrap) return;
    if(!lib.length){ wrap.innerHTML='<p class="muted" style="padding:14px">No saved games yet. Analyse one and tap Save.</p>'; return; }
    wrap.innerHTML='';
    lib.forEach(g=>{
      const row=el('div','lib-row');
      row.innerHTML=`<div class="lib-meta"><b>${esc(g.white)} – ${esc(g.black)}</b>
        <span>${g.date} · ${g.moves} plies${g.accW!=null?` · ${g.accW}/${g.accB}`:''}</span></div>
        <button class="lib-del" title="Delete">🗑</button>`;
      row.querySelector('.lib-meta').addEventListener('click',()=>{ if(loadPgn(g.pgn)){ openBoard(); } });
      row.querySelector('.lib-del').addEventListener('click',(e)=>{ e.stopPropagation(); saveLib(getLib().filter(x=>x.id!==g.id)); renderLib(); });
      wrap.appendChild(row);
    });
  });
}
function esc(s){ return (s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

/* ============================================================
   export PGN / FEN + share sheet
   ============================================================ */
function exportPgn(){
  const c=new Chess();
  c.header('White',state.white,'Black',state.black,'Event','ChessMate analysis');
  for(const m of state.history) c.move(m.san);
  return c.pgn();
}
function openShare(){
  $('#shareFen').value=chessAtPly(state.ply).fen();
  $('#sharePgn').value=exportPgn();
  $('#shareSheet').classList.add('open');
}

/* ============================================================
   fetch from chess.com / lichess
   ============================================================ */
async function fetchChessCom(user,ym){
  const [y,m]=ym.split('-');
  const url=`https://api.chess.com/pub/player/${user.toLowerCase()}/games/${y}/${m.padStart(2,'0')}`;
  const r=await fetch(url); if(!r.ok) throw new Error('not found');
  const j=await r.json();
  return (j.games||[]).filter(g=>g.pgn).map(g=>({pgn:g.pgn,white:g.white?.username,black:g.black?.username,url:g.url}));
}
async function fetchLichess(user,ym){
  const [y,m]=ym.split('-');
  const since=Date.UTC(+y,+m-1,1), until=Date.UTC(+y,+m,1);
  const url=`https://lichess.org/api/games/user/${user}?since=${since}&until=${until}&max=20&pgnInJson=false`;
  const r=await fetch(url,{headers:{Accept:'application/x-chess-pgn'}});
  if(!r.ok) throw new Error('not found');
  const text=await r.text();
  // split multi-game pgn
  return text.split(/\n\n(?=\[Event)/).filter(s=>s.trim()).map(pgn=>({pgn}));
}

/* ============================================================
   view switching
   ============================================================ */
function show(view){ $$('.view').forEach(v=>v.classList.toggle('active', v.id==='view-'+view));
  $$('.tab').forEach(t=>t.classList.toggle('active', t.dataset.view===view));
  document.body.classList.toggle('show-ctrl', view==='board');
  window.scrollTo(0,0);
}
function openBoard(){ buildMoveList(); renderReport(); state.ply=0; render(); show('board'); }

/* ============================================================
   toast
   ============================================================ */
let toastT;
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),1800); }

/* ============================================================
   BOOT
   ============================================================ */
function boot(){
  board=new Board($('#board'));
  setupTapMove();

  // strength selector
  $$('.str').forEach(b=> b.addEventListener('click',()=>{ state.strength=b.dataset.s; $$('.str').forEach(x=>x.classList.toggle('active',x===b)); }));
  $('.str[data-s="balanced"]')?.classList.add('active');

  // load pgn
  $('#loadBtn').addEventListener('click',()=>{
    const pgn=$('#pgnInput').value.trim();
    if(!pgn){ toast('Paste a PGN first'); return; }
    if(loadPgn(pgn)) openBoard(); else toast('Could not read that PGN');
  });
  $('#sampleBtn').addEventListener('click',()=>{ $('#pgnInput').value=SAMPLE_PGN; toast('Sample game loaded — tap Load'); });

  // fetch
  $('#fetchBtn').addEventListener('click', async ()=>{
    const src=$('#fetchSrc').value, user=$('#fetchUser').value.trim(), ym=$('#fetchMonth').value;
    if(!user||!ym){ toast('Enter a username and month'); return; }
    $('#fetchBtn').textContent='Fetching…';
    try{
      const games = src==='chesscom'? await fetchChessCom(user,ym) : await fetchLichess(user,ym);
      if(!games.length){ toast('No games found'); }
      else { showFetchResults(games); }
    }catch(e){ toast('Fetch failed: '+e.message); }
    $('#fetchBtn').textContent='Fetch games';
  });

  // controls
  $('#cStart').onclick=()=>{stopPlay();goto(0);};
  $('#cPrev').onclick=()=>{stopPlay();prev();};
  $('#cNext').onclick=()=>{stopPlay();next();};
  $('#cPlay').onclick=()=> state.playing?stopPlay():play();
  $('#cFlip').onclick=()=>{state.flipped=!state.flipped;render();};
  $('#analyseBtn').onclick=()=>{ if(state.analysing){ engine.stop(); state.analysing=false; } else { analyse(); } };
  $('#arrowBtn').onclick=()=>{ const modes=['off','continuation','alternative']; state.arrowMode=modes[(modes.indexOf(state.arrowMode)+1)%3]; $('#arrowBtn').textContent='⤳ '+state.arrowMode; render(); };
  $('#saveBtn').onclick=saveCurrent;
  $('#shareBtn').onclick=openShare;
  $('#altBanner').addEventListener('click',()=>{
    const an=state.analysis[state.ply-1];
    if(an&&an.bestUci){ const c=chessAtPly(state.ply-1); const m=c.move({from:an.bestUci.slice(0,2),to:an.bestUci.slice(2,4),promotion:'q'});
      if(m){ state.history=state.history.slice(0,state.ply-1); state.history.push({san:m.san,from:m.from,to:m.to,color:m.color,fenAfter:c.fen()}); state.analysis=null;state.accuracy=null;renderReport(); buildMoveList(); goto(state.ply); } }
  });

  // share sheet
  $('#shareClose').onclick=()=>$('#shareSheet').classList.remove('open');
  $$('.copy-btn').forEach(b=>b.addEventListener('click',()=>{ const t=$(b.dataset.target); t.select(); navigator.clipboard?.writeText(t.value); toast('Copied'); }));

  // graph drag
  let drag=false;
  $('#graph').addEventListener('pointerdown',e=>{drag=true;graphJump(e);});
  window.addEventListener('pointermove',e=>{if(drag)graphJump(e);});
  window.addEventListener('pointerup',()=>drag=false);

  // tabs
  $$('.tab').forEach(t=>t.addEventListener('click',()=>{ if(t.dataset.view==='board'&&!state.history.length){toast('Load a game first');return;} show(t.dataset.view); if(t.dataset.view==='library')renderLib(); }));

  // keyboard + swipe
  window.addEventListener('keydown',e=>{ if(e.key==='ArrowRight'){stopPlay();next();} if(e.key==='ArrowLeft'){stopPlay();prev();} });
  let tx=0;
  $('#board').addEventListener('touchstart',e=>tx=e.touches[0].clientX,{passive:true});
  $('#board').addEventListener('touchend',e=>{ const dx=e.changedTouches[0].clientX-tx; if(Math.abs(dx)>50){stopPlay(); dx<0?next():prev();} },{passive:true});

  // default month
  const now=new Date(); $('#fetchMonth').value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  renderLib();

  // register SW
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}); }
}

function showFetchResults(games){
  const wrap=$('#fetchResults'); wrap.innerHTML='';
  games.slice(0,25).forEach(g=>{
    let w='?',b='?'; const mw=g.pgn.match(/\[White "([^"]+)"/); const mb=g.pgn.match(/\[Black "([^"]+)"/);
    if(mw)w=mw[1]; if(mb)b=mb[1];
    const row=el('div','lib-row');
    row.innerHTML=`<div class="lib-meta"><b>${esc(w)} – ${esc(b)}</b><span>tap to load</span></div>`;
    row.addEventListener('click',()=>{ if(loadPgn(g.pgn)) openBoard(); else toast('Could not read game'); });
    wrap.appendChild(row);
  });
  wrap.style.display='block';
}

const SAMPLE_PGN = `[Event "ChessMate Sample"]
[White "Carlsen, Magnus"]
[Black "Nepomniachtchi, Ian"]
[Result "1-0"]

1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be2 e5 7. Nb3 Be7
8. O-O O-O 9. Be3 Be6 10. Nd5 Nbd7 11. Qd3 Bxd5 12. exd5 Rc8 13. c4 a5
14. Rfd1 a4 15. Nd2 a3 16. b3 Nc5 17. Bxc5 dxc5 18. Ne4 Nxe4 19. Qxe4 1-0`;

document.addEventListener('DOMContentLoaded', boot);
