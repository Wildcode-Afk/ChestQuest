/* ============================================================
   INTERFACE — ANIMATIONS DE FIN DE COUP
   Petite API de retour visuel après un coup (flash échec/mat).
   Ne connaît pas les règles d'échecs : reçoit un statut déjà
   calculé ('checkmate'/'check'/autre) sous forme de simple
   donnée. Utilise chess-sound.js pour le retour sonore associé
   (chargé avant ce fichier).
   ============================================================ */

function flashBoard(kind){
  const frame = document.querySelector('.board-frame');
  if(!frame) return;
  frame.classList.remove('flash-check','flash-mate');
  void frame.offsetWidth; // relance l'animation même si la classe était déjà présente
  frame.classList.add(kind==='mate' ? 'flash-mate' : 'flash-check');
  setTimeout(()=>frame.classList.remove('flash-check','flash-mate'), 650);
}
function playMoveFeedback(status, capturedPiece){
  if(status==='checkmate'){ flashBoard('mate'); return; }
  if(status==='check'){ flashBoard('check'); playSound('check'); return; }
  playSound(capturedPiece ? 'capture' : 'move');
}
