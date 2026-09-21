/* ============================================================
   INTERFACE — CRÉATION ET RAFRAÎCHISSEMENT VISUEL DU PLATEAU
   Ce module ne contient aucune règle d'échecs : il reçoit un
   état déjà calculé (plateau, case sélectionnée, dernier coup,
   coups légaux, échec par couleur, etc.) et un gestionnaire de
   clic fourni par l'appelant, et se charge uniquement de
   créer/mettre à jour le DOM des 64 cases et de leurs pièces.

   Dépend uniquement du DOM et des coordonnées pures de
   chess-core.js (sq, fileOf, rankOf, sqName), chargé avant ce
   fichier. Ne dépend pas de chess-rules.js : la détection
   d'échec, les coups légaux, etc. sont calculés par l'appelant
   (app.js) et transmis en tant que simples données.

   initBoardView(el) doit être appelé une fois avec l'élément
   conteneur du plateau avant tout appel à renderBoardSquares ou
   animatePieceMove (comme boardEl l'était déjà en portée globale
   dans app.js avant cette extraction).
   ============================================================ */

const SVGNS = 'http://www.w3.org/2000/svg';

let boardViewEl = null;
function initBoardView(el){ boardViewEl = el; }

function pieceGlyph(p){ return '#pc-'+p.type; }

function createPieceEl(piece){
  const svg = document.createElementNS(SVGNS,'svg');
  svg.setAttribute('viewBox','0 0 100 100');
  svg.setAttribute('class', 'piece ' + (piece.color==='w'?'white':'black'));
  const use = document.createElementNS(SVGNS,'use');
  use.setAttributeNS('http://www.w3.org/1999/xlink','href','#pc-'+piece.type);
  use.setAttribute('href','#pc-'+piece.type);
  svg.appendChild(use);
  return svg;
}

function computeSquareSize(){
  const chrome = 76;
  const avail = Math.min(window.innerWidth - chrome, 520);
  return Math.max(30, Math.min(46, Math.floor(avail/8)));
}

function squareColorClass(idx){
  const f=fileOf(idx), r=rankOf(idx);
  return ((f+r)%2===0) ? 'dark' : 'light';
}

function animatePieceMove(fromIdx, toIdx, piece, onDone){
  const boardEl = boardViewEl;
  const fromCell = boardEl.querySelector('[data-idx="'+fromIdx+'"]');
  const toCell = boardEl.querySelector('[data-idx="'+toIdx+'"]');
  if(!fromCell || !toCell){ onDone(); return; }
  const boardRect = boardEl.getBoundingClientRect();
  const fromRect = fromCell.getBoundingClientRect();
  const toRect = toCell.getBoundingClientRect();

  const originalPieceEl = fromCell.querySelector('.piece');
  if(originalPieceEl) originalPieceEl.style.visibility='hidden';
  const destPieceEl = toCell.querySelector('.piece');
  if(destPieceEl) destPieceEl.style.visibility='hidden';

  const ghost = createPieceEl(piece);
  ghost.classList.add('ghost');
  ghost.style.position = 'absolute';
  ghost.style.left = (fromRect.left - boardRect.left) + 'px';
  ghost.style.top = (fromRect.top - boardRect.top) + 'px';
  ghost.style.width = fromRect.width+'px';
  ghost.style.height = fromRect.height+'px';
  boardEl.appendChild(ghost);

  requestAnimationFrame(()=>{
    ghost.style.transition = 'left .28s cubic-bezier(.4,0,.2,1), top .28s cubic-bezier(.4,0,.2,1)';
    ghost.style.left = (toRect.left - boardRect.left) + 'px';
    ghost.style.top = (toRect.top - boardRect.top) + 'px';
  });
  setTimeout(()=>{
    ghost.remove();
    onDone();
  }, 290);
}

/* Construit/rafraîchit les 64 cases du plateau principal.
   opts = {
     board,          // Array(64) des cases (voir chess-core.js)
     selected,       // index de la case sélectionnée, ou null
     lastMove,        // {from,to} ou null
     legalTargets,   // coups légaux depuis la case sélectionnée (déjà calculés par l'appelant)
     boardFlipped,   // true si le plateau est affiché retourné
     teachSquare,    // nom de case ("e4") à surligner en leçon, ou null
     lessonGoalMet,  // true si l'objectif de la leçon en cours est déjà atteint
     kingInCheck,    // {w:boolean, b:boolean} — échec par couleur, calculé par l'appelant
     onSquareClick,  // (idx) => void — gestionnaire de clic fourni par l'appelant
   } */
function renderBoardSquares(opts){
  const boardEl = boardViewEl;
  const { board, selected, lastMove, legalTargets, boardFlipped, teachSquare, lessonGoalMet, kingInCheck, onSquareClick } = opts;
  boardEl.innerHTML='';
  boardEl.style.setProperty('--sq', computeSquareSize()+'px');
  const ranks = boardFlipped ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];
  const files = boardFlipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  for(const rank of ranks){
    for(const file of files){
      const idx = sq(file,rank);
      const cell = document.createElement('div');
      cell.className = 'sq ' + squareColorClass(idx);
      cell.dataset.idx = idx;
      if(lastMove && (idx===lastMove.from || idx===lastMove.to)) cell.classList.add('lastmove');
      if(selected===idx) cell.classList.add('origin');

      if(file===files[0]){
        const c = document.createElement('span'); c.className='coord'; c.textContent = rank+1; cell.appendChild(c);
      }

      if(teachSquare && sqName(idx)===teachSquare && !lessonGoalMet){
        cell.classList.add('teach');
      }

      const piece = board[idx];
      if(piece){
        const span = createPieceEl(piece);
        if(selected===idx) span.classList.add('selected');
        cell.appendChild(span);
      }

      if(piece && piece.type==='K' && kingInCheck && kingInCheck[piece.color]){
        cell.classList.add('kingdanger');
      }

      const mv = legalTargets.find(m=>m.to===idx);
      if(mv){
        if(board[idx] || mv.flags.enpassant){
          const ring = document.createElement('div'); ring.className='ring'; cell.appendChild(ring);
        } else {
          const dot = document.createElement('div'); dot.className='dot'; cell.appendChild(dot);
        }
      }

      cell.onclick = ()=>onSquareClick(idx);
      boardEl.appendChild(cell);
    }
  }
}
