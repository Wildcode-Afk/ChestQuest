/* ============================================================
   MODE — PUZZLES (mat en 1/2/3)
   Lecture des données de puzzles (PUZZLES, définies dans app.js)
   et suivi de la progression associée (solvedPuzzles, aussi dans
   app.js — voir la limite assumée ci-dessous). Isolé de la
   logique générale des parties (finalizeMove, doMove...), qui
   reste dans app.js et appelle simplement loadPuzzle/handlePuzzleMove
   comme avant.

   Ne concerne pas le sous-mode "Échecs en solo" (voir
   chess-mode-solitaire.js, déjà séparé à l'étape précédente) ni le
   moteur des règles déjà stabilisé (chess-core.js, chess-rules.js) :
   ce fichier ne fait qu'y lire des positions, jamais générer ou
   valider des coups.

   Validations explicites ajoutées par cette étape :
   - validatePuzzleEntry(P) : signale un puzzle aux données
     incomplètes (champs manquants, mauvais nombre de rangées,
     couleur au trait invalide) au lieu de laisser l'app planter
     plus loin avec une erreur peu claire.
   - isValidMoveShape(mv) : rejette un coup malformé transmis à
     handlePuzzleMove (défense en profondeur ; le moteur ne
     produit normalement que des coups valides).
   - sanitizeSolvedPuzzles(raw) : filtre les indices de puzzles
     invalides ou hors bornes dans une progression chargée (ex.
     depuis un compte, après une éventuelle donnée corrompue),
     sans changer le format de stockage existant (un tableau
     d'indices).

   Limite assumée : solvedPuzzles (le Set de progression),
   puzzleIdx et lessonTitle/lessonDesc restent déclarés dans
   app.js, car lus/écrits aussi par renderList(), les badges, la
   page de profil et l'écran d'accueil. Les migrer aurait demandé
   de toucher ces affichages aussi — hors périmètre de cette étape
   (même choix que pour les horloges à l'étape précédente).
   ============================================================ */

function isPuzzleUnlocked(i){
  if(i<0 || i>=PUZZLES.length) return false;
  if(i===0) return true;
  const P = PUZZLES[i], prev = PUZZLES[i-1];
  if(!P || !prev) return false;
  if(prev.category !== P.category) return true; // premier puzzle d'une nouvelle rubrique
  return solvedPuzzles.has(i-1);
}

/* Signale un puzzle aux données incomplètes plutôt que de laisser
   l'app planter plus loin avec une erreur peu claire. Retourne la
   liste des problèmes trouvés (vide si le puzzle est valide). */
function validatePuzzleEntry(P){
  const errors = [];
  if(!P) return ['puzzle absent'];
  if(typeof P.title !== 'string' || !P.title) errors.push('title manquant');
  if(typeof P.category !== 'string' || !P.category) errors.push('category manquante');
  if(P.turn !== 'w' && P.turn !== 'b') errors.push("turn doit être 'w' ou 'b'");
  if(typeof P.hint !== 'string' || !P.hint) errors.push('hint manquant');
  if(typeof P.desc !== 'string' || !P.desc) errors.push('desc manquant');
  if(!Array.isArray(P.rows) || P.rows.length!==8) errors.push('rows doit contenir exactement 8 rangées');
  return errors;
}

function isValidPuzzleMoveShape(mv){
  return !!mv && Number.isInteger(mv.from) && mv.from>=0 && mv.from<64
    && Number.isInteger(mv.to) && mv.to>=0 && mv.to<64;
}

/* Filtre une liste d'indices de puzzles résolus (ex. reçue depuis
   la sauvegarde de progression) pour ne garder que des entiers
   correspondant à un puzzle existant. Le format de stockage (un
   tableau d'indices) n'est pas modifié. */
function sanitizeSolvedPuzzles(raw){
  if(!Array.isArray(raw)) return new Set();
  return new Set(raw.filter(i => Number.isInteger(i) && i>=0 && i<PUZZLES.length));
}

function loadPuzzle(i){
  if(!isPuzzleUnlocked(i)){
    i = 0;
    for(let k=PUZZLES.length-1;k>=0;k--){ if(isPuzzleUnlocked(k)){ i=k; break; } }
    puzzleIdx = i;
  }
  let P = PUZZLES[i];
  const errors = validatePuzzleEntry(P);
  if(errors.length){
    console.warn('[puzzles] Donnée incomplète pour le puzzle', i, ':', errors.join(', '));
    const fallback = PUZZLES.findIndex(entry => validatePuzzleEntry(entry).length===0);
    if(fallback===-1) return; // aucun puzzle valide en mémoire : rien à afficher
    i = fallback;
    P = PUZZLES[i];
  }
  puzzleIdx = i;
  gameState = initState(parseRows(P.rows), P.turn, {wK:false,wQ:false,bK:false,bQ:false});
  selected=null; legalTargets=[]; lastMove=null;
  capturedByWhite=[]; capturedByBlack=[]; awaitingPromotion=null; moveHistory=[];
  promoOverlay.innerHTML='';
  renderMoves();
  lessonTitle.textContent = P.title;
  lessonDesc.textContent = P.desc;
  setCoach("Réfléchis bien avant de jouer. Besoin d'un coup de pouce ? Clique sur « Indice ».");
  renderControls();
  renderList();
  render();
}

function handlePuzzleMove(mv, moverColor){
  if(!isValidPuzzleMoveShape(mv)){
    console.warn('[puzzles] Coup invalide reçu par handlePuzzleMove :', mv);
    return;
  }
  const P = PUZZLES[puzzleIdx];
  const errors = validatePuzzleEntry(P);
  if(errors.length){
    console.warn('[puzzles] Donnée incomplète pour le puzzle en cours', puzzleIdx, ':', errors.join(', '));
    return;
  }
  const status = gameStatus(gameState);
  if(status==='checkmate'){
    solvedPuzzles.add(puzzleIdx);
    queueSaveProgress();
    setCoach("🏆 Échec et mat ! Puzzle résolu — bravo, ta lecture tactique est excellente.");
    playSound('win');
    renderList();
  } else {
    setCoach("Ce n'était pas la solution. " + P.hint + " Clique sur « Réessayer » pour reprendre depuis le début.");
  }
  renderControls();
}
