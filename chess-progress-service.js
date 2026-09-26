/* ============================================================
   SERVICE — PROGRESSION
   Point unique où l'état de progression en mémoire (leçons,
   puzzles, solitaire complétés, Elo, mode IA, stats de parties,
   pays, badge affiché) rencontre le service Supabase exposé par
   auth.js (window.ChessProgress, table "profiles").

   Avant cette étape, ces deux fonctions vivaient dans app.js sans
   être identifiées comme un point de passage unique. Voir
   CHESSQUEST_STORAGE.md pour la cartographie complète des
   stockages de ChestQuest et le contexte de ce choix.

   Ne modifie pas les règles de calcul de l'Elo (ajustement après
   victoire/défaite) : ce fichier ne fait que transporter la
   valeur courante, jamais la recalculer.

   Format de données préservé à l'identique (mêmes noms de champs
   envoyés/reçus que l'ancien code) : aucune migration nécessaire.

   Validations explicites ajoutées par cette étape :
   - sanitizeProgressRow(data) : vérifie les types et les plages
     des champs d'une ligne de progression chargée (Elo fini et
     positif, compteurs entiers non négatifs, tableaux bien
     formés) avant de les appliquer à l'état en mémoire, au lieu
     de faire confiance aveuglément à ce que renvoie Supabase.

   Limite assumée : ne valide pas le contenu détaillé des listes
   de leçons/puzzles complétés (quels ids existent réellement) —
   cette validation-là relève de chess-lessons.js/chess-puzzles.js
   quand ce fichier existe, pas de ce service générique.
   ============================================================ */

function isFiniteNonNegativeNumber(v){
  return typeof v==='number' && Number.isFinite(v) && v>=0;
}
function toStringArray(v){
  return Array.isArray(v) ? v.filter(x => typeof x==='string') : [];
}
function toIndexArray(v){
  return Array.isArray(v) ? v.filter(x => Number.isInteger(x) && x>=0) : [];
}

/* Vérifie les types/plages d'une ligne de progression chargée
   depuis Supabase et retourne une version sûre à appliquer, sans
   changer les noms de champs ni leur signification. Une ligne
   absente ou totalement invalide donne un objet aux valeurs par
   défaut plutôt qu'une exception. */
function sanitizeProgressRow(data){
  const safe = {
    completed_lessons: [],
    solved_puzzles: [],
    solved_solitaire: [],
    progressive_elo: null,
    fixed_elo: null,
    ai_mode: null,
    wins_count: 0,
    losses_count: 0,
    draws_count: 0,
    country: null,
    featured_badge: null,
  };
  if(!data || typeof data !== 'object') return safe;
  safe.completed_lessons = toStringArray(data.completed_lessons);
  safe.solved_puzzles = toIndexArray(data.solved_puzzles);
  safe.solved_solitaire = toIndexArray(data.solved_solitaire);
  if(isFiniteNonNegativeNumber(data.progressive_elo)) safe.progressive_elo = data.progressive_elo;
  if(isFiniteNonNegativeNumber(data.fixed_elo)) safe.fixed_elo = data.fixed_elo;
  if(data.ai_mode==='progressive' || data.ai_mode==='fixed') safe.ai_mode = data.ai_mode;
  if(isFiniteNonNegativeNumber(data.wins_count)) safe.wins_count = Math.floor(data.wins_count);
  if(isFiniteNonNegativeNumber(data.losses_count)) safe.losses_count = Math.floor(data.losses_count);
  if(isFiniteNonNegativeNumber(data.draws_count)) safe.draws_count = Math.floor(data.draws_count);
  if(typeof data.country==='string' && data.country) safe.country = data.country;
  if(typeof data.featured_badge==='string' && data.featured_badge) safe.featured_badge = data.featured_badge;
  return safe;
}

/* Applique une ligne de progression chargée (déjà validée) à
   l'état en mémoire de l'application, puis rafraîchit l'affichage
   concerné — comportement identique à l'ancien applyLoadedProgress
   d'app.js. */
function applyLoadedProgress(data){
  if(!data) return;
  const safe = sanitizeProgressRow(data);
  completedLessons = new Set(safe.completed_lessons);
  solvedPuzzles = new Set(safe.solved_puzzles);
  solvedSolitaire = new Set(safe.solved_solitaire);
  if(safe.progressive_elo!==null) progressiveElo = safe.progressive_elo;
  if(safe.fixed_elo!==null) fixedElo = safe.fixed_elo;
  if(safe.ai_mode) aiMode = safe.ai_mode;
  winsCount = safe.wins_count;
  lossesCount = safe.losses_count;
  drawsCount = safe.draws_count;
  myCountry = safe.country;
  myFeaturedBadge = safe.featured_badge;
  showHome();
  renderList();
}

/* Construit le paquet envoyé à window.ChessProgress.save, avec
   exactement les mêmes champs que l'ancien code (aucun format
   changé) et le sauvegarde après un court délai anti-rafale,
   comme avant cette étape. */
let saveProgressTimer = null;
function queueSaveProgress(){
  if(!window.ChessAuth || !window.ChessAuth.getUser()) return;
  clearTimeout(saveProgressTimer);
  saveProgressTimer = setTimeout(()=>{
    window.ChessProgress.save({
      username: window.ChessAuth.displayName(),
      completed_lessons: Array.from(completedLessons),
      solved_puzzles: Array.from(solvedPuzzles),
      solved_solitaire: Array.from(solvedSolitaire),
      progressive_elo: progressiveElo,
      fixed_elo: fixedElo,
      ai_mode: aiMode,
      wins_count: winsCount,
      losses_count: lossesCount,
      draws_count: drawsCount,
      badges: earnedBadgeIds()
    });
  }, 600);
}
