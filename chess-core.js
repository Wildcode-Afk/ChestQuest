/* ============================================================
   MOTEUR D'ÉCHECS — DONNÉES DE BASE
   Coordonnées, plateau, constantes de déplacement des pièces,
   état de partie. Aucune logique de règles ici (voir app.js).
   ============================================================ */
function sq(file,rank){return rank*8+file;}
function fileOf(i){return i&7;}
function rankOf(i){return i>>3;}
function sqName(i){return "abcdefgh"[fileOf(i)]+(rankOf(i)+1);}
function algToIdx(name){ return sq("abcdefgh".indexOf(name[0]), parseInt(name.slice(1),10)-1); }
function inBoard(f,r){return f>=0&&f<8&&r>=0&&r<8;}

function emptyBoard(){return new Array(64).fill(null);}

function parseRows(rows){
  const board = emptyBoard();
  for(let r=0;r<8;r++){
    const rowStr = rows[r];
    const rank = 7-r;
    let file=0;
    for(const ch of rowStr.split(' ')){
      if(ch==='') continue;
      if(!isNaN(parseInt(ch))){ file+=parseInt(ch); continue; }
      if(ch==='.'){file+=1;continue;}
      const color = ch===ch.toUpperCase()?'w':'b';
      const type = ch.toUpperCase();
      board[sq(file,rank)] = {color,type};
      file+=1;
    }
  }
  return board;
}

function initialBoard(){
  return parseRows([
    "r n b q k b n r","p p p p p p p p",". . . . . . . .",". . . . . . . .",
    ". . . . . . . .",". . . . . . . .","P P P P P P P P","R N B Q K B N R"
  ]);
}

const DIRS = { B:[[1,1],[1,-1],[-1,1],[-1,-1]], R:[[1,0],[-1,0],[0,1],[0,-1]],
  Q:[[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]] };
const KNIGHT_D = [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];
const KING_D = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];

/* ============================================================
   ÉTAT DE PARTIE — forme canonique
   {
     board,          // Array(64) des cases (voir emptyBoard/parseRows)
     turn,           // 'w' | 'b' — joueur actif
     castling,       // {wK,wQ,bK,bQ} — droits de roque restants
     ep,             // case cible de prise en passant, ou -1
     halfmoveClock,  // demi-coups depuis le dernier coup de pion ou la
                      // dernière capture (règle des 50 coups)
     fullmoveNumber, // numéro du coup complet, incrémenté après le trait des Noirs
     history,        // liste d'entrées de coups ; voir chess-history.js pour le
                      // format des entrées (compatible avec moveHistory/rawMoveLog
                      // dans app.js). Non peuplé automatiquement par applyMove —
                      // voir le commentaire en tête de chess-history.js.
     result          // résultat une fois la partie terminée, sinon null ;
                      // voir chess-history.js:createGameSaveRecord pour le format
                      // de sauvegarde utilisé par l'application aujourd'hui.
   }
   Certains états sont encore construits à la main ailleurs dans
   l'application (ex. reconstruction d'une partie en ligne depuis le
   serveur) sans ces quatre derniers champs : initState/cloneState leur
   donnent toujours une valeur par défaut sûre plutôt que de planter.
   ============================================================ */
function initState(board, turn, castling, ep, halfmoveClock, fullmoveNumber, history, result){
  return {
    board: board.slice(),
    turn,
    castling: Object.assign({wK:true,wQ:true,bK:true,bQ:true},castling||{}),
    ep: ep===undefined?-1:ep,
    halfmoveClock: halfmoveClock===undefined?0:halfmoveClock,
    fullmoveNumber: fullmoveNumber===undefined?1:fullmoveNumber,
    history: history===undefined?[]:history,
    result: result===undefined?null:result
  };
}
function cloneState(state){
  return {
    board: state.board.slice(),
    turn: state.turn,
    castling: Object.assign({},state.castling),
    ep: state.ep,
    halfmoveClock: state.halfmoveClock===undefined?0:state.halfmoveClock,
    fullmoveNumber: state.fullmoveNumber===undefined?1:state.fullmoveNumber,
    history: state.history?state.history.slice():[],
    result: state.result===undefined?null:state.result
  };
}
