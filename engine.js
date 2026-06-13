/* ============================================================
   ChessMate — engine wrapper
   - Lichess cloud-eval tried first (fast, deep, free)
   - Stockfish Web Worker fallback at chosen depth
   - cancellable, single in-flight analysis
   ============================================================ */

export const STRENGTH = {
  quick:    { depth: 12, label: 'Quick',    sub: 'depth 12 · ~2s' },
  balanced: { depth: 16, label: 'Balanced', sub: 'depth 16 · ~5s' },
  deep:     { depth: 20, label: 'Deep',     sub: 'depth 20 · ~12s' }
};

export class Engine {
  constructor(){
    this.worker = null;
    this.ready = false;
    this._readyP = null;
    this._pending = null;     // {resolve, reject}
    this._best = null;        // {cp/mate, pv, depth}
    this._cancelled = false;
    this.useCloud = true;
  }

  init(){
    if(this._readyP) return this._readyP;
    this._readyP = new Promise((resolve)=>{
      try{
        this.worker = new Worker('./vendor/stockfish.js');
      }catch(e){
        // worker failed (e.g. file://) — engine still works via cloud only
        this.ready = false; resolve(false); return;
      }
      this.worker.onmessage = (e)=> this._onLine(typeof e.data==='string'? e.data : '');
      this.worker.onerror   = ()=>{ /* keep going; cloud may cover */ };
      this.worker.postMessage('uci');
      this.worker.postMessage('setoption name Hash value 32');
      const t = setTimeout(()=>{ this.ready=false; resolve(false); }, 8000);
      this._uciResolve = ()=>{ clearTimeout(t); this.ready=true; resolve(true); };
    });
    return this._readyP;
  }

  _onLine(line){
    if(line.includes('uciok')){ this._uciResolve && this._uciResolve(); return; }
    if(line.startsWith('info') && line.includes(' pv ') && line.includes('score')){
      const m = line.match(/score (cp|mate) (-?\d+)/);
      const d = line.match(/ depth (\d+)/);
      const pv = line.split(' pv ')[1];
      if(m){
        this._best = {
          type: m[1], value: parseInt(m[2],10),
          depth: d? parseInt(d[1],10):0,
          pv: pv? pv.trim().split(' ') : []
        };
      }
    }
    if(line.startsWith('bestmove')){
      const bm = line.split(' ')[1];
      if(this._pending){
        const res = this._best ? {...this._best, bestmove: bm} : {type:'cp',value:0,depth:0,pv:[],bestmove:bm};
        const cb = this._pending; this._pending = null; this._best = null;
        if(!this._cancelled) cb.resolve(res); else cb.reject(new Error('cancelled'));
      }
    }
  }

  /* analyse one FEN. tries cloud first (if allowed), then local worker. */
  async evaluate(fen, depth, {multiPv=1, allowCloud=true} = {}){
    if(this._cancelled) throw new Error('cancelled');

    if(this.useCloud && allowCloud){
      const cloud = await this._cloud(fen, multiPv).catch(()=>null);
      if(cloud) return cloud;
    }
    return this._local(fen, depth, multiPv);
  }

  async _cloud(fen, multiPv){
    const url = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=${multiPv}`;
    const r = await fetch(url);
    if(!r.ok) return null;
    let j;
    try{ j = await r.json(); }catch(e){ return null; }   // 404 returns HTML, not JSON
    if(!j || !j.pvs || !j.pvs.length) return null;
    // Lichess cp/mate are from WHITE's POV. Stockfish (our convention) is side-to-move POV.
    // Flip when it's Black to move so the whole app speaks one language.
    const blackToMove = (fen.split(' ')[1] === 'b');
    const flip = v => blackToMove ? -v : v;
    const pvs = j.pvs.map(p=>({
      type: p.mate!=null? 'mate':'cp',
      value: p.mate!=null? flip(p.mate) : flip(p.cp),
      pv: (p.moves||'').split(' ').filter(Boolean)
    }));
    return {
      type: pvs[0].type, value: pvs[0].value,
      depth: j.depth || 30, pv: pvs[0].pv,
      bestmove: pvs[0].pv[0], multipv: pvs, source:'cloud'
    };
  }

  _local(fen, depth, multiPv){
    return new Promise((resolve, reject)=>{
      if(!this.worker || !this.ready){ reject(new Error('engine unavailable')); return; }
      this._pending = {resolve, reject};
      this._best = null;
      this.worker.postMessage('setoption name MultiPV value '+multiPv);
      this.worker.postMessage('position fen '+fen);
      this.worker.postMessage('go depth '+depth);
    });
  }

  /* fetch the top-N moves for a position (for Critical / alternatives) */
  async multi(fen, depth, n=2){
    const r = await this.evaluate(fen, depth, {multiPv:n});
    if(r.multipv) return r.multipv;
    return [{type:r.type, value:r.value, pv:r.pv}];
  }

  stop(){
    this._cancelled = true;
    if(this.worker) this.worker.postMessage('stop');
    if(this._pending){ this._pending.reject(new Error('cancelled')); this._pending=null; }
  }
  resume(){ this._cancelled = false; }
}
