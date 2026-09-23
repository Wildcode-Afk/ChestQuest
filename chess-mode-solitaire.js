/* ============================================================
   MODE — ÉCHECS EN SOLO (SOLITAIRE)
   Orchestration du sous-mode "Échecs en solo" des puzzles :
   chargement d'un puzzle, réception des clics, résolution.
   Règles Solitaire Chess/ThinkFun : pièces d'une seule couleur,
   chaque coup doit être une capture, victoire quand il ne reste
   qu'une seule pièce.

   Ne connaît pas les règles d'échecs du jeu normal : aucun appel
   à legalMoves/applyMove/gameStatus. Ce sous-mode a ses propres
   règles (auto-capture), déjà indépendantes du moteur avant
   cette extraction — seul le code a changé de fichier.

   Limite assumée : solitaireBoard, solitaireSelected,
   solitaireLegalTargets, solitaireIdx, solitaireMoveCount et
   solitaireSolved restent déclarées dans app.js, car lues/écrites
   aussi par renderSolitaire(), renderList() et renderControls()
   (restées dans app.js). Les migrer aurait demandé de toucher ces
   fonctions de rendu aussi — hors périmètre de cette étape (voir
   CHESSQUEST_MODES.md, section "Risque et périmètre").
   ============================================================ */

/* ---------- Génération de coups (capture uniquement, toute pièce est cible valide) ---------- */
function solitaireMovesFrom(board, idx){
  const p = board[idx];
  if(!p) return [];
  const f = fileOf(idx), r = rankOf(idx);
  const moves = [];
  if(p.type==='P'){
    for(const df of [-1,1]){
      const nf=f+df, nr=r+1;
      if(!inBoard(nf,nr)) continue;
      const t = sq(nf,nr);
      if(board[t]) moves.push({from:idx, to:t, flags:{}});
    }
  } else if(p.type==='N' || p.type==='K'){
    const offs = p.type==='N' ? KNIGHT_D : KING_D;
    for(const [df,dr] of offs){
      const nf=f+df, nr=r+dr;
      if(!inBoard(nf,nr)) continue;
      const t = sq(nf,nr);
      if(board[t]) moves.push({from:idx, to:t, flags:{}});
    }
  } else {
    for(const [df,dr] of DIRS[p.type]){
      let nf=f+df, nr=r+dr;
      while(inBoard(nf,nr)){
        const t = sq(nf,nr);
        if(board[t]){ moves.push({from:idx, to:t, flags:{}}); break; }
        nf+=df; nr+=dr;
      }
    }
  }
  return moves;
}
function solitaireAllMoves(board){
  const moves = [];
  for(let i=0;i<64;i++){ if(board[i]) moves.push(...solitaireMovesFrom(board,i)); }
  return moves;
}
function solitairePieceCount(board){ return board.filter(Boolean).length; }

function isSolitaireUnlocked(i){
  if(i===0) return true;
  const P = SOLITAIRE_PUZZLES[i], prev = SOLITAIRE_PUZZLES[i-1];
  if(prev.category !== P.category) return true;
  return solvedSolitaire.has(i-1);
}

function loadSolitaire(i){
  if(!isSolitaireUnlocked(i)){
    i = 0;
    for(let k=SOLITAIRE_PUZZLES.length-1;k>=0;k--){ if(isSolitaireUnlocked(k)){ i=k; break; } }
  }
  solitaireIdx = i;
  const P = SOLITAIRE_PUZZLES[i];
  solitaireBoard = parseRows(P.rows);
  solitaireSelected = null;
  solitaireLegalTargets = [];
  solitaireMoveCount = 0;
  solitaireSolved = false;
  lessonTitle.textContent = P.title;
  lessonDesc.textContent = P.desc;
  setCoach("Choisis la pièce qui doit capturer en premier. Réfléchis bien avant de jouer. Besoin d'un coup de pouce ? Clique sur « Indice ».");
  renderControls();
  renderList();
  render();
}

function solitaireOnSquareClick(idx){
  const piece = solitaireBoard[idx];
  // clic sur une case cible en surbrillance : jouer le coup
  const mv = solitaireLegalTargets.find(m=>m.to===idx);
  if(mv){
    solitaireBoard[mv.to] = solitaireBoard[mv.from];
    solitaireBoard[mv.from] = null;
    solitaireMoveCount++;
    solitaireSelected = null;
    solitaireLegalTargets = [];
    const remaining = solitairePieceCount(solitaireBoard);
    render();
    if(remaining===1){
      solitaireSolved = true;
      solvedSolitaire.add(solitaireIdx);
      queueSaveProgress();
      setCoach("🏆 Bravo ! Il ne reste qu'une seule pièce — puzzle résolu !");
      playSound('win');
      renderControls();
      renderList();
    } else {
      const nextMoves = solitaireAllMoves(solitaireBoard);
      if(nextMoves.length===0){
        setCoach("😕 Plus aucune capture possible et il reste "+remaining+" pièces sur l'échiquier. Clique sur « Recommencer » pour réessayer.");
        renderControls();
      } else {
        setCoach("Coup joué ! Encore "+(remaining-1)+" capture(s) à trouver.");
      }
    }
    return;
  }
  // sélection d'une nouvelle pièce
  if(piece){
    solitaireSelected = idx;
    solitaireLegalTargets = solitaireMovesFrom(solitaireBoard, idx);
    if(solitaireLegalTargets.length===0){
      setCoach("Cette pièce ne peut capturer aucune autre pièce depuis sa position actuelle.");
    }
  } else {
    solitaireSelected = null;
    solitaireLegalTargets = [];
  }
  render();
}

registerMode('solitaire', {
  start: loadSolitaire,
  restore(){ loadSolitaire(solitaireIdx); },
  receiveMove: solitaireOnSquareClick,
});
