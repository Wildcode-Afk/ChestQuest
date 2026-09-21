/* ============================================================
   MOTEUR D'ÉCHECS — GÉNÉRATION ET VALIDATION DES COUPS
   Fonctions pures : pas d'accès au DOM. Dépend de chess-core.js
   (coordonnées, plateau, constantes de déplacement, état de
   partie), chargé avant ce fichier.
   ============================================================ */

function pseudoMoves(state, idx){
  const p = state.board[idx];
  if(!p) return [];
  const moves = [];
  const f = fileOf(idx), r = rankOf(idx);
  const board = state.board;
  const push=(to,flags)=>moves.push({from:idx,to,flags:flags||{}});
  if(p.type==='P'){
    const dir = p.color==='w'?1:-1;
    const startRank = p.color==='w'?1:6;
    const promRank = p.color==='w'?7:0;
    const oneR = r+dir;
    if(inBoard(f,oneR) && !board[sq(f,oneR)]){
      push(sq(f,oneR), {promotion: oneR===promRank});
      const twoR = r+2*dir;
      if(r===startRank && !board[sq(f,twoR)]) push(sq(f,twoR),{double:true});
    }
    for(const df of [-1,1]){
      const nf=f+df, nr=r+dir;
      if(!inBoard(nf,nr)) continue;
      const t = sq(nf,nr);
      if(board[t] && board[t].color!==p.color) push(t,{capture:true, promotion:nr===promRank});
      else if(t===state.ep) push(t,{capture:true, enpassant:true});
    }
  } else if(p.type==='N'){
    for(const [df,dr] of KNIGHT_D){
      const nf=f+df,nr=r+dr;
      if(!inBoard(nf,nr)) continue;
      const t=sq(nf,nr);
      if(!board[t]||board[t].color!==p.color) push(t,{capture:!!board[t]});
    }
  } else if(p.type==='K'){
    for(const [df,dr] of KING_D){
      const nf=f+df,nr=r+dr;
      if(!inBoard(nf,nr)) continue;
      const t=sq(nf,nr);
      if(!board[t]||board[t].color!==p.color) push(t,{capture:!!board[t]});
    }
    const rank0 = p.color==='w'?0:7;
    if(r===rank0 && f===4){
      const kSide = p.color==='w'?'wK':'bK';
      const qSide = p.color==='w'?'wQ':'bQ';
      if(state.castling[kSide] && !board[sq(5,rank0)] && !board[sq(6,rank0)] && board[sq(7,rank0)] && board[sq(7,rank0)].type==='R'){
        push(sq(6,rank0),{castle:'K'});
      }
      if(state.castling[qSide] && !board[sq(3,rank0)] && !board[sq(2,rank0)] && !board[sq(1,rank0)] && board[sq(0,rank0)] && board[sq(0,rank0)].type==='R'){
        push(sq(2,rank0),{castle:'Q'});
      }
    }
  } else {
    const dirs = DIRS[p.type];
    for(const [df,dr] of dirs){
      let nf=f+df, nr=r+dr;
      while(inBoard(nf,nr)){
        const t=sq(nf,nr);
        if(!board[t]){ push(t,{}); }
        else { if(board[t].color!==p.color) push(t,{capture:true}); break; }
        nf+=df; nr+=dr;
      }
    }
  }
  return moves;
}

function isAttacked(board, idx, byColor){
  const f=fileOf(idx), r=rankOf(idx);
  const pdir = byColor==='w'?-1:1;
  for(const df of [-1,1]){
    const nf=f+df, nr=r+pdir;
    if(inBoard(nf,nr)){
      const t=board[sq(nf,nr)];
      if(t && t.color===byColor && t.type==='P') return true;
    }
  }
  for(const [df,dr] of KNIGHT_D){
    const nf=f+df,nr=r+dr;
    if(inBoard(nf,nr)){
      const t=board[sq(nf,nr)];
      if(t && t.color===byColor && t.type==='N') return true;
    }
  }
  for(const [df,dr] of KING_D){
    const nf=f+df,nr=r+dr;
    if(inBoard(nf,nr)){
      const t=board[sq(nf,nr)];
      if(t && t.color===byColor && t.type==='K') return true;
    }
  }
  for(const [df,dr] of DIRS.B){
    let nf=f+df,nr=r+dr;
    while(inBoard(nf,nr)){
      const t=board[sq(nf,nr)];
      if(t){ if(t.color===byColor && (t.type==='B'||t.type==='Q')) return true; break; }
      nf+=df;nr+=dr;
    }
  }
  for(const [df,dr] of DIRS.R){
    let nf=f+df,nr=r+dr;
    while(inBoard(nf,nr)){
      const t=board[sq(nf,nr)];
      if(t){ if(t.color===byColor && (t.type==='R'||t.type==='Q')) return true; break; }
      nf+=df;nr+=dr;
    }
  }
  return false;
}

function kingIndex(board,color){
  for(let i=0;i<64;i++) if(board[i] && board[i].type==='K' && board[i].color===color) return i;
  return -1;
}

function applyMove(state, move, promoType){
  const s = cloneState(state);
  const p = s.board[move.from];
  const moving = Object.assign({}, p);
  s.ep = -1;
  if(move.flags.double){ s.ep = (move.from+move.to)/2; }
  if(move.flags.enpassant){
    const capR = rankOf(move.from);
    const capIdx = sq(fileOf(move.to), capR);
    s.board[capIdx]=null;
  }
  s.board[move.to] = moving;
  s.board[move.from] = null;
  if(move.flags.promotion){ s.board[move.to] = {color:moving.color, type: promoType||'Q'}; }
  if(move.flags.castle==='K'){
    const rank0 = rankOf(move.from);
    s.board[sq(5,rank0)] = s.board[sq(7,rank0)];
    s.board[sq(7,rank0)] = null;
  }
  if(move.flags.castle==='Q'){
    const rank0 = rankOf(move.from);
    s.board[sq(3,rank0)] = s.board[sq(0,rank0)];
    s.board[sq(0,rank0)] = null;
  }
  if(moving.type==='K'){
    if(moving.color==='w'){ s.castling.wK=false; s.castling.wQ=false; }
    else { s.castling.bK=false; s.castling.bQ=false; }
  }
  const clearRook=(idx)=>{
    if(idx===sq(0,0)) s.castling.wQ=false;
    if(idx===sq(7,0)) s.castling.wK=false;
    if(idx===sq(0,7)) s.castling.bQ=false;
    if(idx===sq(7,7)) s.castling.bK=false;
  };
  clearRook(move.from); clearRook(move.to);
  // Demi-coups : remis à 0 sur coup de pion ou capture (règle des 50 coups),
  // sinon incrémenté. Numéro de coup complet : incrémenté après le trait des Noirs.
  const resetHalfmove = moving.type==='P' || !!move.flags.capture;
  s.halfmoveClock = resetHalfmove ? 0 : (state.halfmoveClock||0)+1;
  s.fullmoveNumber = state.turn==='b' ? (state.fullmoveNumber||1)+1 : (state.fullmoveNumber||1);
  s.turn = state.turn==='w'?'b':'w';
  return s;
}

function legalMoves(state, colorOverride){
  const color = colorOverride||state.turn;
  const result = [];
  for(let i=0;i<64;i++){
    const p = state.board[i];
    if(!p || p.color!==color) continue;
    for(const m of pseudoMoves(state,i)){
      if(m.flags.castle){
        const rank0 = rankOf(m.from);
        if(isAttacked(state.board, m.from, color==='w'?'b':'w')) continue;
        const mid = m.flags.castle==='K'? sq(5,rank0): sq(3,rank0);
        if(isAttacked(state.board, mid, color==='w'?'b':'w')) continue;
        if(isAttacked(state.board, m.to, color==='w'?'b':'w')) continue;
      }
      const after = applyMove(state, m, 'Q');
      const ki = kingIndex(after.board, color);
      if(ki===-1 || !isAttacked(after.board, ki, color==='w'?'b':'w')){
        result.push(m);
      }
    }
  }
  return result;
}

function inCheck(state, color){
  const c = color||state.turn;
  const ki = kingIndex(state.board,c);
  if(ki===-1) return false;
  return isAttacked(state.board, ki, c==='w'?'b':'w');
}

function gameStatus(state){
  const moves = legalMoves(state);
  const check = inCheck(state, state.turn);
  if(moves.length===0){ return check?'checkmate':'stalemate'; }
  return check?'check':'normal';
}
