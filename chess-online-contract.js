/* ============================================================
   SERVICE — CONTRAT DES PARTIES EN LIGNE
   Formalise et valide la forme des lignes échangées avec la
   table Supabase "online_games" via window.ChessOnline
   (auth.js). Ne change AUCUN champ envoyé ni reçu : ce module
   ajoute uniquement une vérification de forme avant d'appliquer
   une ligne reçue, il ne modifie jamais ce qui est transmis au
   serveur.

   Voir CHESSQUEST_ONLINE.md pour la cartographie complète du
   flux en ligne (live, matchmaking, invitations) et le contrat
   détaillé entre le client et le service.

   Contrat (voir CHESSQUEST_ONLINE.md, section 4) :
   - identité de partie      : id (uuid)
   - joueur autorisé         : white_id, black_id, created_by (uuid|null)
   - numéro de coup          : move_count (entier >= 0)
   - horloge                 : white_time_ms, black_time_ms (nombre|null), last_move_at (texte ISO)
   - résultat                : status ('waiting'|'active'|'finished'),
                               result ('white'|'black'|'draw'|null), result_reason (texte|null)
   - plateau / trait         : board (64 cases), turn ('w'|'b'),
                               last_from/last_to (index 0-63|null), last_promo (texte|null)

   Ne connaît pas les règles d'échecs (aucun appel à legalMoves/
   applyMove/gameStatus) : valide uniquement la forme des données,
   jamais leur légalité.
   ============================================================ */

const ONLINE_GAME_STATUSES = new Set(['waiting', 'active', 'finished']);
const ONLINE_GAME_RESULTS = new Set(['white', 'black', 'draw']);

function isUuidLike(v){
  return typeof v==='string' && v.length>0;
}
function isNullableUuidLike(v){
  return v===null || v===undefined || isUuidLike(v);
}
function isSquareIndex(v){
  return Number.isInteger(v) && v>=0 && v<64;
}
function isNullableSquareIndex(v){
  return v===null || v===undefined || isSquareIndex(v);
}
function isNullableNonNegativeNumber(v){
  return v===null || v===undefined || (typeof v==='number' && Number.isFinite(v) && v>=0);
}

/* Vérifie qu'un plateau reçu du réseau a bien la forme attendue
   par le moteur (64 cases, chaque case null ou {color,type}
   plausible) avant de l'utiliser tel quel — notamment pour le cas
   de désynchronisation où le plateau transmis est appliqué sans
   passer par le moteur de règles local. */
function isValidBoardArray(board){
  if(!Array.isArray(board) || board.length!==64) return false;
  const validColors = new Set(['w','b']);
  const validTypes = new Set(['P','N','B','R','Q','K']);
  return board.every(cell =>
    cell===null ||
    (cell && typeof cell==='object' && validColors.has(cell.color) && validTypes.has(cell.type))
  );
}

/* Valide la forme d'une ligne "online_games" reçue (chargement
   initial ou mise à jour temps réel). Retourne la liste des
   problèmes trouvés (vide si la ligne est bien formée). Une ligne
   avec des problèmes n'est pas forcément inutilisable : c'est à
   l'appelant de décider, selon le champ en cause, s'il continue
   prudemment ou ignore la mise à jour. */
function validateOnlineGameRow(row){
  const errors = [];
  if(!row || typeof row !== 'object') return ['ligne absente ou invalide'];
  if(!isUuidLike(row.id)) errors.push('id manquant ou invalide');
  if(!isNullableUuidLike(row.white_id)) errors.push('white_id invalide');
  if(!isNullableUuidLike(row.black_id)) errors.push('black_id invalide');
  if(!isNullableUuidLike(row.created_by)) errors.push('created_by invalide');
  if(row.status!==undefined && !ONLINE_GAME_STATUSES.has(row.status)) errors.push('status inconnu : '+row.status);
  if(row.result!=null && !ONLINE_GAME_RESULTS.has(row.result)) errors.push('result inconnu : '+row.result);
  if(row.turn!==undefined && row.turn!=='w' && row.turn!=='b') errors.push("turn doit être 'w' ou 'b'");
  if(row.move_count!==undefined && !(Number.isInteger(row.move_count) && row.move_count>=0)){
    errors.push('move_count doit être un entier >= 0');
  }
  if(!isNullableSquareIndex(row.last_from)) errors.push('last_from doit être un index de case (0-63) ou null');
  if(!isNullableSquareIndex(row.last_to)) errors.push('last_to doit être un index de case (0-63) ou null');
  if(!isNullableNonNegativeNumber(row.white_time_ms)) errors.push('white_time_ms doit être un nombre positif ou null');
  if(!isNullableNonNegativeNumber(row.black_time_ms)) errors.push('black_time_ms doit être un nombre positif ou null');
  if(row.board!==undefined && row.board!==null && !isValidBoardArray(row.board)) errors.push('board mal formé');
  return errors;
}

/* Un nouveau coup est-il réellement arrivé ? Centralise la
   comparaison déjà utilisée par onOnlineGameUpdate, pour qu'elle
   soit nommée et testable plutôt qu'une comparaison en ligne. */
function hasNewMove(newRow, previousMoveCount){
  return typeof newRow.move_count==='number' && newRow.move_count > previousMoveCount;
}
