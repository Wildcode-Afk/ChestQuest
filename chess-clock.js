/* ============================================================
   INTERFACE — HORLOGES
   Petite API d'affichage et de décompte des horloges de partie.
   Ne connaît pas les règles d'échecs (aucun appel à legalMoves,
   applyMove, gameStatus...).

   Limite assumée : clockActive, currentTimeControl, clocks et
   clockTimerId restent déclarées dans app.js plutôt qu'ici. Ces
   variables sont lues/écrites à une trentaine d'endroits dans
   app.js, dont tout le système d'horloge du mode en ligne
   (startOnlineClockLoop, currentOnlineClocks...) qui partage les
   mêmes variables que les parties locales. Les y rapatrier aurait
   demandé de réécrire ces ~30 points d'appel en une seule fois —
   exactement le genre de refactorisation globale à risque que
   cette étape doit éviter. Les fonctions ci-dessous continuent
   donc de lire/écrire ces variables partagées par leur nom, comme
   avant l'extraction (JavaScript partage le même espace global
   entre fichiers <script> classiques, donc ceci fonctionne
   normalement une fois app.js chargé) ; seul leur code a changé
   de fichier. Unifier proprement l'état des horloges locales et
   en ligne serait une étape à part, plus risquée, à traiter
   séparément.
   ============================================================ */

function stopClockTimer(){
  if(clockTimerId){ clearInterval(clockTimerId); clockTimerId = null; }
}
function startClockTimer(){
  stopClockTimer();
  clockTimerId = setInterval(()=>{
    if(!clockActive || !gameState) return;
    const side = gameState.turn;
    clocks[side] = Math.max(0, (clocks[side]||0) - 1);
    renderClocks();
    if(clocks[side]<=0){
      stopClockTimer();
      const winnerColor = side==='w' ? 'b' : 'w';
      onGameEnd(winnerColor===playerColor ? 'win' : 'loss', 'timeout');
    }
  }, 1000);
}
function applyClockForMove(moverColor){
  if(!clockActive || !currentTimeControl) return;
  if(currentTimeControl.perMove != null){
    clocks[moverColor] = currentTimeControl.perMove;
  } else if(currentTimeControl.inc){
    clocks[moverColor] = (clocks[moverColor]||0) + currentTimeControl.inc;
  }
  renderClocks();
}
function formatClockTime(sec){
  if(sec==null) return '--:--';
  if(sec>=86400){
    const d = Math.floor(sec/86400), h = Math.floor((sec%86400)/3600);
    return d+'j '+String(h).padStart(2,'0')+'h';
  }
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
  if(h>0) return h+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}
function renderClocks(){
  const row = document.getElementById('clocksRow');
  if(!row) return;
  if(!clockActive){ row.style.display = 'none'; return; }
  row.style.display = 'flex';
  const wt = document.getElementById('clockWhiteTime'), bt = document.getElementById('clockBlackTime');
  const wc = document.getElementById('clockWhite'), bc = document.getElementById('clockBlack');
  if(wt) wt.textContent = formatClockTime(clocks.w);
  if(bt) bt.textContent = formatClockTime(clocks.b);
  const turn = gameState ? gameState.turn : null;
  if(wc){ wc.classList.toggle('active', turn==='w'); wc.classList.toggle('low', clocks.w!=null && clocks.w>0 && clocks.w<=20 && (currentTimeControl && currentTimeControl.perMove==null)); }
  if(bc){ bc.classList.toggle('active', turn==='b'); bc.classList.toggle('low', clocks.b!=null && clocks.b>0 && clocks.b<=20 && (currentTimeControl && currentTimeControl.perMove==null)); }
}
