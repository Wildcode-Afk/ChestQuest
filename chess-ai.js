/* ============================================================
   INTELLIGENCE ARTIFICIELLE — ÉVALUATION, RECHERCHE, NIVEAUX
   Fonctions pures : aucun accès au DOM, aucune lecture de variable
   d'état de l'interface (mode de jeu choisi, Elo courant, etc.).
   Dépend de chess-core.js (fileOf, rankOf, cloneState) et
   chess-rules.js (legalMoves, applyMove, isAttacked, kingIndex,
   inCheck), tous deux chargés avant ce fichier.

   Ce module ne connaît pas `aiMode`/`progressiveElo`/`fixedElo` :
   c'est `currentAIElo()`, resté dans app.js, qui lit ces variables
   d'interface et transmet un Elo simple à chooseAIMoveForElo.
   ============================================================ */

const VALUE = {P:1,N:3,B:3,R:5,Q:9,K:0};

/* ---- Sélection heuristique 1 coup (niveau Débutant) ---- */
function evalMove(state, move){
  const board = state.board;
  const mover = board[move.from];
  const captured = board[move.to] || (move.flags.enpassant?{type:'P'}:null);
  let score = 0;
  if(captured) score += VALUE[captured.type]*10;
  const after = applyMove(state, move, 'Q');
  const myColor = state.turn, oppColor = myColor==='w'?'b':'w';
  const oppAttacksSquare = isAttacked(after.board, move.to, oppColor);
  const selfDefends = isAttacked(after.board, move.to, myColor);
  if(oppAttacksSquare && !selfDefends) score -= VALUE[mover.type]*10;
  else if(oppAttacksSquare && selfDefends) score -= VALUE[mover.type]*1.5;
  const oppKing = kingIndex(after.board, oppColor);
  if(oppKing!==-1 && isAttacked(after.board, oppKing, myColor)){
    const afterOpp = cloneState(after);
    if(legalMoves(afterOpp).length===0) score += 1000;
    else score += 4;
  }
  const cf = fileOf(move.to), cr = rankOf(move.to);
  const centerDist = Math.abs(3.5-cf)+Math.abs(3.5-cr);
  score += (7-centerDist)*0.3;
  score += Math.random()*2.2;
  return score;
}

function chooseAIMove(state){
  const moves = legalMoves(state);
  if(moves.length===0) return null;
  let best=null, bestScore=-Infinity;
  for(const m of moves){
    const s = evalMove(state,m);
    if(s>bestScore){ bestScore=s; best=m; }
  }
  return best;
}

/* ---- Recherche minimax (niveaux Moyen / Fort) ---- */
function orderMoves(state, moves){
  return moves.slice().sort((a,b)=>{
    const ca = state.board[a.to] ? VALUE[state.board[a.to].type] : 0;
    const cb = state.board[b.to] ? VALUE[state.board[b.to].type] : 0;
    return cb-ca;
  });
}
function materialEval(board){
  let score=0;
  for(const p of board){ if(!p) continue; score += (p.color==='w'?1:-1)*VALUE[p.type]; }
  return score;
}
function negamax(state, depth, alpha, beta){
  const moves = legalMoves(state);
  if(moves.length===0){
    if(inCheck(state,state.turn)) return -100000 - depth*10;
    return 0;
  }
  if(depth===0) return (state.turn==='w'?1:-1)*materialEval(state.board);
  let best=-Infinity;
  for(const m of orderMoves(state,moves)){
    const child = applyMove(state,m,'Q');
    const val = -negamax(child, depth-1, -beta, -alpha);
    if(val>best) best=val;
    if(best>alpha) alpha=best;
    if(alpha>=beta) break;
  }
  return best;
}
function chooseAIMoveMinimax(state, depth){
  const moves = legalMoves(state);
  if(moves.length===0) return null;
  let best=null, bestScore=-Infinity;
  for(const m of orderMoves(state,moves)){
    const child = applyMove(state,m,'Q');
    const val = -negamax(child, depth-1, -Infinity, Infinity) + Math.random()*0.3;
    if(val>bestScore){ bestScore=val; best=m; }
  }
  return best;
}

/* ---- Niveaux de difficulté (mappage Elo -> profondeur/hasard) ---- */
function eloTierLabel(elo){
  if(elo<500) return 'Débutant';
  if(elo<950) return 'Amateur';
  if(elo<1350) return 'Intermédiaire';
  if(elo<1750) return 'Avancé';
  return 'Expert';
}
function aiParamsForElo(elo){
  let depth;
  if(elo<500) depth=0;
  else if(elo<950) depth=1;
  else if(elo<1400) depth=2;
  else depth=3;
  const blunder = Math.max(0, Math.min(0.55, (900-elo)/1400));
  return {depth, blunder};
}
function chooseAIMoveForElo(state, elo){
  const moves = legalMoves(state);
  if(moves.length===0) return null;
  const {depth, blunder} = aiParamsForElo(elo);
  if(Math.random() < blunder){
    return moves[Math.floor(Math.random()*moves.length)];
  }
  return depth===0 ? chooseAIMove(state) : chooseAIMoveMinimax(state, depth);
}
