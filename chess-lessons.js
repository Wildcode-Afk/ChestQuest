/* ============================================================
   MODE — LEÇONS
   Lecture des données de leçons (LESSONS, définies dans app.js)
   et suivi de la progression associée (completedLessons, aussi
   dans app.js — voir la limite assumée ci-dessous). Isolé de la
   logique générale des parties (finalizeMove, doMove...), qui
   reste dans app.js et appelle simplement loadLesson/handleLessonMove
   comme avant.

   Ne touche pas au moteur des règles déjà stabilisé (chess-core.js,
   chess-rules.js) : ce fichier ne fait qu'y lire des positions et
   comparer des cases, jamais générer ou valider des coups.

   Validations explicites ajoutées par cette étape :
   - validateLessonEntry(L) : signale une leçon aux données
     incomplètes (champs manquants, mauvais nombre de rangées,
     objectif de type inconnu) au lieu de laisser l'app planter
     plus loin avec une erreur peu claire.
   - isValidMoveShape(mv) : rejette un coup malformé transmis à
     handleLessonMove (défense en profondeur ; le moteur ne
     produit normalement que des coups valides).
   - sanitizeCompletedLessons(raw) : filtre les identifiants de
     leçons invalides ou inconnus dans une progression chargée
     (ex. depuis un compte, après une éventuelle donnée corrompue),
     sans changer le format de stockage existant.

   Limite assumée : completedLessons (le Set de progression),
   lessonIdx, lessonGoalMet et lessonTitle/lessonDesc restent
   déclarés dans app.js, car lus/écrits aussi par renderList(),
   les badges, la page de profil et l'écran d'accueil. Les migrer
   aurait demandé de toucher ces affichages aussi — hors périmètre
   de cette étape (même choix que pour les horloges à l'étape
   précédente).
   ============================================================ */

function isLessonUnlocked(i){
  if(i<0 || i>=LESSONS.length) return false;
  if(i===0) return true;
  const L = LESSONS[i], prev = LESSONS[i-1];
  if(!L || !prev) return false;
  if(prev.category !== L.category) return true; // première leçon d'une nouvelle rubrique
  return completedLessons.has(prev.id);
}

function lessonsCompletedInCategory(cat){
  return LESSONS.filter(l=>l.category===cat && completedLessons.has(l.id)).length;
}
function lessonsTotalInCategory(cat){
  return LESSONS.filter(l=>l.category===cat).length;
}

const LESSON_GOAL_TYPES = new Set(['any-move','castle','escape-check','checkmate','move-to']);

/* Signale une leçon aux données incomplètes plutôt que de laisser
   l'app planter plus loin avec une erreur peu claire. Retourne la
   liste des problèmes trouvés (vide si la leçon est valide). */
function validateLessonEntry(L){
  const errors = [];
  if(!L) return ['leçon absente'];
  if(typeof L.id !== 'string' || !L.id) errors.push('id manquant');
  if(typeof L.category !== 'string' || !L.category) errors.push('category manquante');
  if(typeof L.title !== 'string' || !L.title) errors.push('title manquant');
  if(typeof L.desc !== 'string' || !L.desc) errors.push('desc manquant');
  if(typeof L.hint !== 'string' || !L.hint) errors.push('hint manquant');
  if(typeof L.success !== 'string' || !L.success) errors.push('success manquant');
  if(!Array.isArray(L.rows) || L.rows.length!==8) errors.push('rows doit contenir exactement 8 rangées');
  if(!L.goal || typeof L.goal.type !== 'string' || !LESSON_GOAL_TYPES.has(L.goal.type)){
    errors.push('goal.type manquant ou inconnu');
  }
  return errors;
}

function isValidLessonMoveShape(mv){
  return !!mv && Number.isInteger(mv.from) && mv.from>=0 && mv.from<64
    && Number.isInteger(mv.to) && mv.to>=0 && mv.to<64;
}

/* Filtre une liste d'identifiants de leçons complétées (ex. reçue
   depuis la sauvegarde de progression) pour ne garder que des
   chaînes correspondant à une leçon existante. Le format de
   stockage (un tableau d'ids) n'est pas modifié. */
function sanitizeCompletedLessons(raw){
  if(!Array.isArray(raw)) return new Set();
  const validIds = new Set(LESSONS.map(l=>l.id));
  return new Set(raw.filter(id => typeof id==='string' && validIds.has(id)));
}

function loadLesson(i){
  if(!isLessonUnlocked(i)){
    i = 0;
    for(let k=LESSONS.length-1;k>=0;k--){ if(isLessonUnlocked(k)){ i=k; break; } }
    lessonIdx = i;
  }
  let L = LESSONS[i];
  const errors = validateLessonEntry(L);
  if(errors.length){
    console.warn('[leçons] Donnée incomplète pour la leçon', i, ':', errors.join(', '));
    // Se rabat sur la première leçon valide plutôt que de planter.
    const fallback = LESSONS.findIndex(entry => validateLessonEntry(entry).length===0);
    if(fallback===-1) return; // aucune leçon valide en mémoire : rien à afficher
    i = fallback;
    L = LESSONS[i];
  }
  lessonIdx = i;
  gameState = initState(parseRows(L.rows), L.turn||'w', {wK:true,wQ:true,bK:true,bQ:true});
  selected=null; legalTargets=[]; lastMove=null; lessonGoalMet=false;
  capturedByWhite=[]; capturedByBlack=[]; awaitingPromotion=null; moveHistory=[];
  promoOverlay.innerHTML='';
  renderMoves();
  lessonTitle.textContent = L.title;
  lessonDesc.textContent = L.desc;
  setCoach(L.hint);
  renderControls();
  renderList();
  render();
}

function handleLessonMove(mv, moverColor, isCastle, capturedPiece){
  if(!isValidLessonMoveShape(mv)){
    console.warn('[leçons] Coup invalide reçu par handleLessonMove :', mv);
    return;
  }
  const L = LESSONS[lessonIdx];
  const errors = validateLessonEntry(L);
  if(errors.length){
    console.warn('[leçons] Donnée incomplète pour la leçon en cours', lessonIdx, ':', errors.join(', '));
    return;
  }
  let met = false;
  if(L.goal.type==='any-move') met = true;
  else if(L.goal.type==='castle') met = !!isCastle;
  else if(L.goal.type==='escape-check') met = !inCheck(gameState, moverColor);
  else if(L.goal.type==='checkmate') met = gameStatus(gameState)==='checkmate';
  else if(L.goal.type==='move-to'){
    const targets = Array.isArray(L.goal.square) ? L.goal.square : [L.goal.square];
    const targetIdxs = targets.map(algToIdx);
    met = targetIdxs.includes(mv.to) && (!L.goal.requireCapture || !!capturedPiece);
  }

  if(met){
    lessonGoalMet = true;
    completedLessons.add(L.id);
    queueSaveProgress();
    setCoach("✅ "+L.success);
    renderControls();
    renderList();
  } else {
    setCoach("Pas encore ! "+L.hint);
  }
}
