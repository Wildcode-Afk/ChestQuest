/* ============================================================
   MOTEUR D'ÉCHECS — NOTATION, HISTORIQUE ET RÉSULTAT
   Fonctions pures : pas d'accès au DOM. Dépend de chess-core.js
   (sqName, fileOf), chargé avant ce fichier.

   Ce module formalise les formats déjà utilisés par app.js pour
   l'historique affiché à l'écran (variable `moveHistory`) et pour
   la sauvegarde d'une partie terminée (`ChessSocial.saveGameHistory`),
   afin qu'ils restent cohérents et testables à un seul endroit.

   Important — pourquoi ce n'est pas branché dans applyMove :
   construire une entrée d'historique complète nécessite de savoir
   si le coup met l'adversaire en échec/mat (suffixes "+"/"#" de la
   notation), ce qui suppose d'appeler gameStatus() — donc de
   regénérer tous les coups légaux — après chaque coup. applyMove
   est aussi utilisé des dizaines de milliers de fois par coup réel
   pendant la recherche de l'IA (minimax) : y ajouter cet appel
   ralentirait l'IA pour un historique qui n'est jamais lu pendant
   cette recherche. L'historique continue donc d'être construit là
   où il l'était déjà dans app.js (juste après le calcul du statut),
   mais en utilisant les fonctions ci-dessous plutôt que du code dupliqué.
   ============================================================ */

function moveNotation(preState, mv, capturedPiece, promo){
  if(mv.flags.castle==='K') return 'O-O';
  if(mv.flags.castle==='Q') return 'O-O-O';
  const mover = preState.board[mv.from];
  let str = mover.type==='P' ? '' : mover.type;
  const isCap = !!capturedPiece;
  if(mover.type==='P' && isCap) str += 'abcdefgh'[fileOf(mv.from)];
  if(isCap) str += 'x';
  str += sqName(mv.to);
  if(mv.flags.promotion) str += '='+(promo||'Q');
  return str;
}

// Forme canonique d'une entrée d'historique par demi-coup, telle
// qu'utilisée par la variable `moveHistory` de app.js et affichée
// dans le panneau des coups joués.
function createHistoryEntry(color, note){
  return {color, note};
}

// Forme canonique de l'enregistrement envoyé à
// window.ChessSocial.saveGameHistory à la fin d'une partie
// (mode practice/coach). `coachStats` est omis si non fourni, comme
// dans le code existant (seul le mode coach le renseignait).
function createGameSaveRecord({mode, result, aiElo, moves, playerColor, coachStats}){
  const record = { mode, result, ai_elo: aiElo, moves, player_color: playerColor };
  if(coachStats) record.coach_stats = coachStats;
  return record;
}
