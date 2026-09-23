/* ============================================================
   MODES DE JEU — INTERFACE COMMUNE
   Registre minimal où chaque mode de jeu (leçons, puzzles,
   entraînement, en ligne...) peut s'enregistrer avec au plus 4
   méthodes :
     start(...args)   — démarre ou charge le mode (ex: un puzzle précis)
     stop()           — arrête proprement le mode (minuteries, abonnements…)
     restore()        — recharge l'état courant du mode sans le
                        redémarrer à zéro
     receiveMove(...) — traite un coup/interaction reçu(e) pendant que
                        ce mode est actif
   Aucune méthode n'est obligatoire ; celles non fournies ont un
   défaut vide. Ce fichier ne connaît pas les règles d'échecs.

   Voir CHESSQUEST_MODES.md pour la cartographie complète des
   modes et l'état de cette migration.
   ============================================================ */

const ChessModes = {};

function registerMode(name, impl){
  ChessModes[name] = Object.assign({ start(){}, stop(){}, restore(){}, receiveMove(){} }, impl || {});
}
