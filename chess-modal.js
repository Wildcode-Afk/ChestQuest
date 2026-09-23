/* ============================================================
   INTERFACE — MODALES ET CONFIRMATIONS
   Petite API pour la modale de choix de promotion et pour les
   confirmations de l'utilisateur. Ne connaît pas les règles
   d'échecs : le choix de la pièce promue est transmis à
   l'appelant via un callback, sans logique de jeu ici.
   initPromoModal(el) doit être appelé une fois avec l'élément
   conteneur de la modale de promotion avant tout appel à
   showPromoPicker.
   ============================================================ */

let promoOverlayEl = null;
function initPromoModal(el){ promoOverlayEl = el; }

/* color: 'w'|'b' — couleur du camp qui promeut.
   onChoose(pieceType): appelé avec 'Q'|'R'|'B'|'N' une fois le
   joueur ayant cliqué son choix ; la modale se ferme avant l'appel. */
function showPromoPicker(color, onChoose){
  const opts = ['Q','R','B','N'];
  const colorClass = color==='w'?'white':'black';
  promoOverlayEl.innerHTML = `<div class="promo-overlay"><div class="promo-box">` +
    opts.map(o=>`<button data-p="${o}"><svg class="piece ${colorClass}" viewBox="0 0 100 100"><use href="#pc-${o}"/></svg></button>`).join('') +
    `</div></div>`;
  promoOverlayEl.querySelectorAll('button').forEach(b=>{
    b.onclick = ()=>{
      promoOverlayEl.innerHTML='';
      onChoose(b.dataset.p);
    };
  });
}

/* Confirmation native du navigateur, isolée ici pour que le reste
   de l'interface n'appelle jamais window.confirm directement. */
function confirmAction(message){
  return confirm(message);
}
