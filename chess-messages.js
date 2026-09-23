/* ============================================================
   INTERFACE — MESSAGES
   Petite API d'affichage d'un message dans le panneau du Coach.
   Ne connaît ni les règles d'échecs ni le reste de l'interface :
   uniquement l'affichage du texte. Le HTML affiché reste choisi
   par l'appelant (app.js) ; ce module se contente de l'injecter.
   initMessages(el) doit être appelé une fois avec l'élément du
   panneau Coach avant tout appel à setCoach.
   ============================================================ */

let coachTextEl = null;
function initMessages(el){ coachTextEl = el; }
function setCoach(msg){ coachTextEl.innerHTML = msg; }
