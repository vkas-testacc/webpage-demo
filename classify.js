/* ============================================================
   ChessMate — classification + accuracy engine
   Ports the win%/expected-points model used by Lichess + the
   chess.com-style Brilliant→Blunder badge thresholds.
   Pure functions, no DOM. ESM module.
   ============================================================ */

export const CLASS = {
  brilliant:{key:'brilliant', c:'#1baaa6', g:'!!', name:'Brilliant'},
  critical :{key:'critical',  c:'#5b8baf', g:'!',  name:'Critical'},
  best     :{key:'best',      c:'#98bc49', g:'✓',  name:'Best'},
  excellent:{key:'excellent', c:'#98bc49', g:'✓',  name:'Excellent'},
  okay     :{key:'okay',      c:'#97af8b', g:'·',  name:'Okay'},
  inaccuracy:{key:'inaccuracy',c:'#f4bf44',g:'?!', name:'Inaccuracy'},
  mistake  :{key:'mistake',   c:'#e28c28', g:'?',  name:'Mistake'},
  blunder  :{key:'blunder',   c:'#c93230', g:'??', name:'Blunder'},
  theory   :{key:'theory',    c:'#a88764', g:'📖', name:'Theory'},
  forced   :{key:'forced',    c:'#97af8b', g:'🔒', name:'Forced'}
};

/* ---- centipawn / mate eval -> win% for the side to move (Lichess model) ---- */
// Lichess: Win% = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)
export function cpToWin(cp){
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}
// eval object {type:'cp'|'mate', value:n} (from white's POV) -> white win%
export function evalToWhiteWin(ev){
  if(!ev) return 50;
  if(ev.type === 'mate'){
    return ev.value > 0 ? 100 : 0;
  }
  return cpToWin(ev.value);
}

/* normalise an eval to centipawns from white POV (mate -> big number) */
export function evalToCp(ev){
  if(!ev) return 0;
  if(ev.type === 'mate') return ev.value > 0 ? 100000 - ev.value*100 : -100000 - ev.value*100;
  return ev.value;
}

/* ---- per-move accuracy from win% drop (Lichess formula) ---- */
// accuracy% = 103.1668 * exp(-0.04354 * (winBefore - winAfter)) - 3.1669  (clamped 0..100)
export function moveAccuracy(winBefore, winAfter){
  const drop = Math.max(0, winBefore - winAfter);
  const acc = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669;
  return Math.max(0, Math.min(100, acc));
}

/* ---- standard deviation helper ---- */
function stdev(arr){
  if(arr.length < 2) return 0;
  const m = arr.reduce((a,b)=>a+b,0)/arr.length;
  const v = arr.reduce((a,b)=>a+(b-m)*(b-m),0)/arr.length;
  return Math.sqrt(v);
}
function mean(a){ return a.length? a.reduce((x,y)=>x+y,0)/a.length : 0; }
function harmonic(a){
  const f = a.filter(x=>x>0);
  if(!f.length) return 0;
  return f.length / f.reduce((s,x)=>s+1/x,0);
}

/* ============================================================
   classifyGame
   Input: array of plies, each:
     { sideToMove:'w'|'b', winBeforeWhite, winAfterWhite,
       bestWinForMover, playedWinForMover,  // win% from the mover's POV
       isOnlyMove, isBest, isTheory, isSacrifice, secondBestWinForMover }
   Output: per-ply classification key + per-side accuracy + breakdown.
   ============================================================ */

export function classifyPly(p){
  if(p.isTheory) return 'theory';
  if(p.isOnlyMove) return 'forced';

  // expected-points loss in win%, from the mover's perspective
  const loss = Math.max(0, p.bestWinForMover - p.playedWinForMover);

  // Best / Excellent first (small loss)
  if(p.isBest || loss <= 0.5){
    // Brilliant: a sacrifice that is still best/near-best AND creates a real threat
    if(p.isSacrifice && p.playedWinForMover >= 50 && loss <= 2) return 'brilliant';
    return 'best';
  }
  // Critical: only winning move — every alternative loses >=10% of winning chances
  if(p.isBest === false && p.secondBestWinForMover != null &&
     (p.bestWinForMover - p.secondBestWinForMover) >= 10 &&
     loss <= 2){
    return 'critical';
  }

  if(loss <= 4.5) return 'excellent';
  if(loss <= 8)   return 'okay';
  if(loss <= 12)  return 'inaccuracy';
  if(loss <= 22)  return 'mistake';
  return 'blunder';
}

/* sliding-window volatility weights + weighted/harmonic blend (Lichess strict) */
export function sideAccuracy(winPercents /* white POV sequence incl. start */, movesAccuracy /* per move for this side, in order */, moverWinSeq /* win% from this side's POV at each of its moves */){
  if(!movesAccuracy.length) return 100;

  // window size: clamp(len/10, 2, 8)
  const win = Math.max(2, Math.min(8, Math.round(moverWinSeq.length / 10) || 2));
  const weights = moverWinSeq.map((_,i)=>{
    const start = Math.max(0, i - Math.floor(win/2));
    const end   = Math.min(moverWinSeq.length, start + win);
    const sub = moverWinSeq.slice(start, end);
    return Math.max(0.5, Math.min(12, stdev(sub))); // volatility
  });

  // weighted mean
  let wSum=0, aSum=0;
  movesAccuracy.forEach((a,i)=>{ wSum += weights[i]; aSum += a*weights[i]; });
  const weightedMean = wSum? aSum/wSum : mean(movesAccuracy);
  const harm = harmonic(movesAccuracy);

  // blend — harmonic punishes the worst moves harder
  return Math.round(((weightedMean + harm) / 2) * 10) / 10;
}

export function emptyBreakdown(){
  const b = {};
  Object.keys(CLASS).forEach(k=> b[k]=0);
  return b;
}
