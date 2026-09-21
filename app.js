/* ============================================================
   MOTEUR D'ÉCHECS
   Coordonnées, plateau, constantes de déplacement et état de
   partie : chess-core.js.
   Génération et validation des coups (pseudoMoves, isAttacked,
   kingIndex, applyMove, legalMoves, inCheck, gameStatus) :
   chess-rules.js (les deux chargés avant ce fichier).
   Ce fichier contient l'IA, le contenu (leçons/puzzles) et
   l'interface.
   ============================================================ */

const VALUE = {P:1,N:3,B:3,R:5,Q:9,K:0};

function evalMove(state, move){
  const board = state.board;
  const mover = board[move.from];
  const captured = board[move.to] || (move.flags.enpassant?{type:'P'}:null);
  let score = 0;
  if(captured) score += VALUE[captured.type]*10;
  const after = applyMove(state, move, 'Q');
  const myColor = state.turn, oppColor = myColor==='w'?'b':'w';
  const oppAttacksSquare = isAttacked(after.board, move.to, oppColor);
  const selfDefends = isAttacked(after.board, move.to, myColor);
  if(oppAttacksSquare && !selfDefends) score -= VALUE[mover.type]*10;
  else if(oppAttacksSquare && selfDefends) score -= VALUE[mover.type]*1.5;
  const oppKing = kingIndex(after.board, oppColor);
  if(oppKing!==-1 && isAttacked(after.board, oppKing, myColor)){
    const afterOpp = cloneState(after);
    if(legalMoves(afterOpp).length===0) score += 1000;
    else score += 4;
  }
  const cf = fileOf(move.to), cr = rankOf(move.to);
  const centerDist = Math.abs(3.5-cf)+Math.abs(3.5-cr);
  score += (7-centerDist)*0.3;
  score += Math.random()*2.2;
  return score;
}

function chooseAIMove(state){
  const moves = legalMoves(state);
  if(moves.length===0) return null;
  let best=null, bestScore=-Infinity;
  for(const m of moves){
    const s = evalMove(state,m);
    if(s>bestScore){ bestScore=s; best=m; }
  }
  return best;
}

/* ---- Recherche minimax (niveaux Moyen / Fort) ---- */
function orderMoves(state, moves){
  return moves.slice().sort((a,b)=>{
    const ca = state.board[a.to] ? VALUE[state.board[a.to].type] : 0;
    const cb = state.board[b.to] ? VALUE[state.board[b.to].type] : 0;
    return cb-ca;
  });
}
function materialEval(board){
  let score=0;
  for(const p of board){ if(!p) continue; score += (p.color==='w'?1:-1)*VALUE[p.type]; }
  return score;
}
function negamax(state, depth, alpha, beta){
  const moves = legalMoves(state);
  if(moves.length===0){
    if(inCheck(state,state.turn)) return -100000 - depth*10;
    return 0;
  }
  if(depth===0) return (state.turn==='w'?1:-1)*materialEval(state.board);
  let best=-Infinity;
  for(const m of orderMoves(state,moves)){
    const child = applyMove(state,m,'Q');
    const val = -negamax(child, depth-1, -beta, -alpha);
    if(val>best) best=val;
    if(best>alpha) alpha=best;
    if(alpha>=beta) break;
  }
  return best;
}
function chooseAIMoveMinimax(state, depth){
  const moves = legalMoves(state);
  if(moves.length===0) return null;
  let best=null, bestScore=-Infinity;
  for(const m of orderMoves(state,moves)){
    const child = applyMove(state,m,'Q');
    const val = -negamax(child, depth-1, -Infinity, Infinity) + Math.random()*0.3;
    if(val>bestScore){ bestScore=val; best=m; }
  }
  return best;
}
// moveNotation, createHistoryEntry, createGameSaveRecord : voir chess-history.js


/* ============================================================
   DONNÉES : LEÇONS
   ============================================================ */
const PIECE_NAMES = {P:'pion', N:'cavalier', B:'fou', R:'tour', Q:'dame', K:'roi'};

const LESSON_CATEGORY_LABELS = {
  decouvertes: '🔎 Découvertes',
  ouvertures: '♟️ Ouvertures',
  tactiques: '⚔️ Tactiques avancées',
  finales: '🏁 Finales'
};
const PUZZLE_CATEGORY_LABELS = {
  facile: '🟢 Facile',
  moyen: '🟡 Moyen',
  difficile: '🟠 Difficile',
  expert: '🔴 Expert'
};
const LESSONS = [
  {
    id:'pion', category:'decouvertes', title:'Le Pion', focus:'P', focusSquare: 'e2',
    rows:["k . . . . . . .","p . . p . p . .",". . . . . . . .",". . . . . . . .",
          ". . . . . . . .",". . . . . . . .","P . . . P . . .","K . . . . . . ."],
    desc:"Le pion avance d'une case (deux cases s'il n'a pas encore bougé) et capture uniquement en diagonale. Il ne recule jamais.",
    hint:"Clique sur le pion en e2 (entouré en or), puis sur une case en surbrillance pour le déplacer.",
    goal:{type:'any-move'},
    success:"Bien joué ! Remarque : ton pion peut avancer de deux cases depuis sa case de départ, mais il capture toujours en diagonale, jamais tout droit."
  },
  {
    id:'cavalier', category:'decouvertes', title:'Le Cavalier', focus:'N', focusSquare:'d4',
    rows:["k . . . . . . .",". . . . . . . .",". . . . . . . .",". . . p . p . .",
          ". . . N . . . .",". . . p . p . .",". . . . . . . .","K . . . . . . ."],
    desc:"Le cavalier se déplace en « L » : deux cases dans une direction, puis une case perpendiculaire. C'est la seule pièce qui saute par-dessus les autres.",
    hint:"Clique sur le cavalier en d4, puis observe les 8 cases qu'il peut atteindre — même à travers les pions !",
    goal:{type:'any-move'},
    success:"Exactement ! Le cavalier ignore tout ce qui se trouve sur son chemin : il atterrit directement sur sa case en L. C'est ce qui le rend redoutable dans les positions fermées."
  },
  {
    id:'fou', category:'decouvertes', title:'Le Fou', focus:'B', focusSquare:'c1',
    rows:["k . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",
          ". . . . . . . .",". . . . . . . .","p . p . . . . .",". . B . K . . ."],
    desc:"Le fou se déplace en diagonale, aussi loin qu'il le souhaite. Il reste toute la partie sur les cases de sa couleur de départ.",
    hint:"Déplace le fou en diagonale. Remarque qu'il ne pourra jamais atteindre une case claire s'il a commencé sur une case sombre.",
    goal:{type:'any-move'},
    success:"Voilà ! Un fou reste prisonnier de sa couleur toute la partie — c'est pourquoi on parle de « fou de cases claires » ou « fou de cases sombres »."
  },
  {
    id:'tour', category:'decouvertes', title:'La Tour', focus:'R', focusSquare:'a1',
    rows:["k . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",
          ". . . . . . . .","p . . . . . . .",". . . . . . . .","R . . . K . . ."],
    desc:"La tour se déplace en ligne droite : le long des colonnes ou des rangées, aussi loin qu'elle le veut, tant que rien ne lui bloque le chemin.",
    hint:"Déplace la tour verticalement ou horizontalement. Elle est très puissante sur les colonnes ouvertes.",
    goal:{type:'any-move'},
    success:"Parfait. Deux tours coordonnées sur la même colonne forment une des attaques les plus puissantes de fin de partie."
  },
  {
    id:'dame', category:'decouvertes', title:'La Dame', focus:'Q', focusSquare:'d1',
    rows:["k . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",
          ". . . p . . . .","p . . . . . . .",". . . . . . . .","Q . . K . . . ."],
    desc:"La dame combine les pouvoirs de la tour et du fou : lignes, colonnes et diagonales, sans limite de distance. C'est la pièce la plus puissante de l'échiquier.",
    hint:"Essaie plusieurs directions pour sentir la portée de la dame — elle domine littéralement le plateau.",
    goal:{type:'any-move'},
    success:"Magnifique. Garde toujours ta dame en sécurité : la perdre équivaut presque toujours à perdre la partie."
  },
  {
    id:'roi', category:'decouvertes', title:"Le Roi et l'échec", focus:'K', focusSquare:'e1',
    rows:["r . . . . . . k",". . . . . . . .",". . . . . . . .",". . . . . . . .",
          ". . . . . . . .",". . . . . . . .",". . . . . . . .","r . . . K . . ."],
    desc:"Le roi se déplace d'une seule case dans n'importe quelle direction — mais jamais sur une case attaquée. Ici, ton roi est en échec par la tour noire sur la colonne e ! Tu dois t'en sortir.",
    hint:"Ton roi est attaqué (échec). Trouve une case sûre pour t'échapper — évite la colonne e et la rangée 1.",
    goal:{type:'escape-check'},
    success:"Bien vu ! Face à un échec, tu as trois options : déplacer le roi, bloquer l'attaque avec une autre pièce, ou capturer la pièce qui attaque. Ici, fuir était la solution la plus simple."
  },
  {
    id:'roque', category:'decouvertes', title:'Le Roque', focus:'K', focusSquare:'e1',
    rows:["r n b q k b n r","p p p p p p p p",". . . . . . . .",". . . . . . . .",
          ". . . . . . . .",". . . . . . . .","P P P P P P P P","R . . . K . . R"],
    desc:"Le roque est le seul coup qui déplace deux pièces à la fois : le roi et une tour. Conditions : ni le roi ni la tour n'ont bougé, aucune case entre eux n'est occupée, et le roi ne traverse pas une case attaquée.",
    hint:"Clique sur le roi en e1 : tu verras deux cases spéciales pour roquer, g1 (petit roque) et c1 (grand roque).",
    goal:{type:'castle'},
    success:"Superbe ! Le roque met ton roi en sécurité derrière ses pions tout en activant une tour. C'est presque toujours un bon réflexe en début de partie."
  },
  {
    id:'valeur', category:'decouvertes', title:'La valeur des pièces', focus:null, focusSquare:null,
    rows:["r n b q k b . r","p p p . . p p p",". . . . . . . .",". . . p . . . .",
          ". . . P . . . .",". . . . . . . .","P P P . . P P P","R N B Q K B N R"],
    desc:"Pion = 1 point, Cavalier = 3, Fou = 3, Tour = 5, Dame = 9. Le Roi n'a pas de valeur numérique : il est inestimable, sa perte termine la partie. Utilise ces valeurs pour juger si un échange en vaut la peine.",
    hint:"Cette position est équilibrée en matériel. Déplace n'importe quelle pièce pour continuer — observe comment chaque échange affecte l'équilibre.",
    goal:{type:'any-move'},
    success:"Exactement le bon réflexe : avant chaque échange, compte ce que tu donnes et ce que tu reçois. Un cavalier contre un pion est une mauvaise affaire ; un cavalier contre une tour est excellent."
  },
  {
    id:'mat', category:'decouvertes', title:'Échec et mat', focus:'R', focusSquare:'a5',
    rows:[". . . . . . k .",". . . . . p p p",". . . . . . . .","R . . . . . . .",
          ". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . K . . ."],
    desc:"L'échec et mat survient quand le roi est en échec et qu'il n'existe aucun coup légal pour s'en sortir. Ici, mate le roi noir en un seul coup avec ta tour.",
    hint:"Le roi noir est bloqué par ses propres pions sur la 7e rangée. Amène ta tour sur la 8e rangée (colonne a) pour un mat du couloir.",
    goal:{type:'checkmate'},
    success:"ÉCHEC ET MAT ! C'est le classique « mat du couloir » : le roi adverse est bloqué par ses propres pions, et ta tour contrôle toute la 8e rangée — impossible de fuir d'un côté ou de l'autre."
  },
{
    id:"ouv-centre", category:"ouvertures", title:"Contrôler le centre", focus:null, focusSquare:null,
    rows:["r n b q k b n r","p p p p p p p p",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .","P P P P P P P P","R N B Q K B N R"],
    desc:"Les cases centrales (d4, d5, e4, e5) offrent le plus de mobilité à tes pièces. La toute première priorité d'une ouverture est d'y placer un pion.",
    hint:"Avance ton pion e ou ton pion d de deux cases pour occuper le centre.",
    goal:{"type":"move-to","square":["e4","d4"]},
    success:"Exactement ! En jouant 1.e4 ou 1.d4, tu ouvres des diagonales pour ta dame et ton fou, tout en revendiquant le centre. C'est le début le plus joué au monde."
  },
  {
    id:"ouv-developpement", category:"ouvertures", title:"Développer ses pièces mineures", focus:null, focusSquare:null,
    rows:["r n b q k b n r","p p p p . p p p",". . . . . . . .",". . . . p . . .",". . . . P . . .",". . . . . . . .","P P P P . P P P","R N B Q K B N R"],
    desc:"Une fois le centre occupé, sors tes cavaliers et tes fous vers des cases actives avant de bouger deux fois la même pièce. Le cavalier va naturellement vers f3 ou c3.",
    hint:"Développe ton cavalier en f3 ou c3.",
    goal:{"type":"move-to","square":["f3","c3"]},
    success:"Bien joué ! Un cavalier en f3 contrôle e5 et d4, deux cases centrales clés, tout en préparant le petit roque."
  },
  {
    id:"ouv-roque", category:"ouvertures", title:"Roquer rapidement", focus:null, focusSquare:null,
    rows:["r n b q k b n r","p p p p . p p p",". . . . . . . .",". . . . p . . .",". . B . P . . .",". . . . . N . .","P P P P . P P P","R N B Q K . . R"],
    desc:"Une fois ton fou et ton cavalier sortis, mets ton roi à l'abri au plus vite. Un roi resté au centre est une cible facile pour l'adversaire.",
    hint:"Clique sur ton roi en e1 et roque du côté roi (petit roque).",
    goal:{"type":"castle"},
    success:"Parfait timing ! Ton roi est en sécurité derrière ses pions et ta tour h1 rejoint le jeu — deux objectifs en un seul coup."
  },
  {
    id:"ouv-italienne", category:"ouvertures", title:"L'ouverture Italienne", focus:null, focusSquare:null,
    rows:["r . b q k b n r","p p p p . p p p",". . n . . . . .",". . . . p . . .",". . . . P . . .",". . . . . N . .","P P P P . P P P","R N B Q K B . R"],
    desc:"Après 1.e4 e5 2.Cf3 Cc6, l'ouverture Italienne développe le fou vers c4, où il vise directement la case f7 — le point faible traditionnel de l'adversaire.",
    hint:"Amène ton fou f1 en c4.",
    goal:{"type":"move-to","square":"c4"},
    success:"Voilà l'Italienne ! Ce fou pointé vers f7 est un classique depuis des siècles — simple, logique, et redoutable si Noir ne réagit pas vite."
  },
  {
    id:"ouv-sicilienne", category:"ouvertures", title:"La défense Sicilienne", focus:null, focusSquare:null,
    rows:["r n b q k b n r","p p . p p p p p",". . . . . . . .",". . p . . . . .",". . . . P . . .",". . . . . . . .","P P P P . P P P","R N B Q K B N R"],
    desc:"Face à 1.e4, Noir répond souvent 1...c5 : la défense Sicilienne. Plutôt que d'occuper le centre symétriquement, Noir déséquilibre la partie dès le premier coup pour se donner des chances de gagner.",
    hint:"C'est à toi de continuer le développement — n'importe quel coup logique convient.",
    goal:{"type":"any-move"},
    success:"Bien joué. La Sicilienne mène à des parties riches et tranchantes : c'est l'ouverture la plus populaire au niveau des maîtres."
  },
  {
    id:"ouv-gambit-dame", category:"ouvertures", title:"Le Gambit Dame", focus:null, focusSquare:null,
    rows:["r n b q k b n r","p p p . p p p p",". . . . . . . .",". . . p . . . .",". . P P . . . .",". . . . . . . .","P P . . P P P P","R N B Q K B N R"],
    turn:"b",
    desc:"Après 1.d4 d5 2.c4, Blanc propose un pion en échange d'un temps d'avance et d'un centre plus fort — un vrai gambit. Noir peut l'accepter (2...dxc4) ou le refuser en renforçant son centre.",
    hint:"À toi de choisir comment répondre — n'importe quel coup te fera découvrir la position.",
    goal:{"type":"any-move"},
    success:"Bien vu. Que Noir prenne le pion ou non, Blanc obtient généralement un centre plus mobile et une meilleure activité des pièces — c'est le prix du gambit."
  },
  {
    id:"tac-fourchette", category:"tactiques", title:"La fourchette de cavalier", focus:null, focusSquare:null,
    rows:[". . . . k . . .",". q . . . . . .",". . . . . . . .",". . . . . N . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . K ."],
    desc:"Le cavalier est le champion de la fourchette : il peut attaquer deux pièces à la fois, sans qu'aucune ne puisse le capturer en retour ni bloquer l'attaque. Ici, une case donne échec au roi tout en attaquant la dame.",
    hint:"Cherche la case où ton cavalier attaque à la fois le roi et la dame noirs.",
    goal:{"type":"move-to","square":"d6","expectCheck":true},
    success:"Fourchette royale ! Ton cavalier attaque le roi ET la dame en même temps. Noir doit d'abord parer l'échec — tu captureras la dame juste après."
  },
  {
    id:"tac-clouage", category:"tactiques", title:"Le clouage", focus:null, focusSquare:null,
    rows:[". . . . k . . .",". . . . . . . .",". . n . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . B . . .",". . . . . . K ."],
    desc:"Un clouage immobilise une pièce adverse en la plaçant devant une pièce plus précieuse sur la même ligne. Le cavalier noir ne pourra plus bouger sans exposer son roi à un échec.",
    hint:"Place ton fou sur la diagonale qui relie ton fou, le cavalier noir et le roi noir.",
    goal:{"type":"move-to","square":"b5"},
    success:"Cloué ! Le cavalier noir est désormais paralysé : s'il bouge, il expose son roi à un échec. Tu peux maintenant augmenter la pression dessus tranquillement."
  },
  {
    id:"tac-enfilade", category:"tactiques", title:"L'enfilade", focus:null, focusSquare:null,
    rows:[". . . . r . . .",". . . . . . . .",". . . . . . . .",". . . . k . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .","R . . . . . K ."],
    desc:"L'enfilade est l'inverse du clouage : tu attaques une pièce de grande valeur qui, en s'écartant, expose une pièce de moindre valeur juste derrière elle sur la même ligne.",
    hint:"Amène ta tour sur la colonne e pour mettre le roi en échec — la tour noire est juste derrière lui.",
    goal:{"type":"move-to","square":"e1","expectCheck":true},
    success:"Enfilade réussie ! Le roi noir doit bouger pour parer l'échec, et ta tour capturera la tour noire juste derrière au coup suivant."
  },
  {
    id:"tac-decouverte", category:"tactiques", title:"L'attaque à la découverte", focus:null, focusSquare:null,
    rows:[". . . . . . . k",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . N . . . .",". . . . . . . .",". . . . . . . .","B . . . . . K ."],
    desc:"Ton fou en a1 vise déjà la case h8 en diagonale, mais ton propre cavalier lui bloque la route. En déplaçant le cavalier ailleurs, tu révèles soudainement l'échec du fou — sans même que le cavalier ait besoin d'attaquer quoi que ce soit lui-même.",
    hint:"Déplace ton cavalier hors de la diagonale a1-h8 pour découvrir l'échec de ton fou.",
    goal:{"type":"move-to","square":"b5","expectCheck":true},
    success:"Échec à la découverte ! Ton cavalier s'est déplacé librement pendant que ton fou, resté immobile, délivrait l'échec — une des tactiques les plus sournoises aux échecs."
  },
  {
    id:"tac-mat-couloir-dame", category:"tactiques", title:"Le mat du couloir (dame)", focus:null, focusSquare:null,
    rows:[". k . . . . . .","p p p . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . K . . Q"],
    desc:"Le roi noir est bloqué sur la 8e rangée par ses propres pions — un classique « mat du couloir ». Cette fois, c'est ta dame qui va porter le coup fatal.",
    hint:"Amène ta dame sur la 8e rangée pour un mat immédiat.",
    goal:{"type":"checkmate"},
    success:"Échec et mat ! Ta dame contrôle toute la 8e rangée pendant que les propres pions du roi noir lui bloquent la fuite. Reconnaître cette faiblesse de la dernière rangée est essentiel."
  },
  {
    id:"tac-mat-etouffe", category:"tactiques", title:"Le mat étouffé", focus:null, focusSquare:null,
    rows:[". . . . . . . .",". . . . . . . .",". . . . . K . .",". . . . . . . .",". . . . . . . .","N . . . . . . .","p p . . . . . .","k p . . . . . ."],
    desc:"Le roi noir est totalement emprisonné par ses propres pions — il ne peut faire aucun mouvement. C'est le terrain de chasse idéal du cavalier : un « mat étouffé ». Aucune autre pièce ne pourrait faire mieux ici, puisque le cavalier est le seul à pouvoir donner échec sans être bloqué.",
    hint:"Trouve la case où ton cavalier donne échec au roi noir, totalement bloqué par ses pions.",
    goal:{"type":"checkmate"},
    success:"Mat étouffé ! Le roi, prisonnier de ses propres pièces, n'avait aucune chance face à ton cavalier. C'est l'un des motifs les plus élégants aux échecs."
  },
  {
    id:"fin-roi-actif", category:"finales", title:"Le roi actif", focus:null, focusSquare:null,
    rows:[". . . . . . . .",". . . . . . k .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . K . . . . .",". . . . . . . .",". . . . . . . ."],
    desc:"En finale, une fois les dames échangées, le roi n'a plus besoin de se cacher : il devient une pièce d'attaque à part entière. Centralise-le pour qu'il pèse sur le plus grand nombre de cases possible.",
    hint:"Avance ton roi vers le centre de l'échiquier, en d4.",
    goal:{"type":"move-to","square":"d4"},
    success:"C'est le réflexe numéro un des finales : un roi centralisé vaut presque une pièce de plus. Ne le laisse jamais inactif dans un coin une fois le milieu de partie terminé."
  },
  {
    id:"fin-roi-escorte", category:"finales", title:"Le roi escorte le pion", focus:null, focusSquare:null,
    rows:["k . . . . . . .",". . . . . . . .",". . . . . . . .",". . . P . . . .",". . . . . . . .",". . K . . . . .",". . . . . . . .",". . . . . . . ."],
    desc:"Un pion isolé a besoin d'un garde du corps pour aller au bout de sa course. Rapproche ton roi de ton pion pour le protéger et l'aider à avancer vers la promotion.",
    hint:"Rapproche ton roi de ton pion d5, en c4 ou d4.",
    goal:{"type":"move-to","square":["c4","d4"]},
    success:"Bien joué ! Un roi et un pion qui avancent ensemble sont très difficiles à arrêter — le roi déblaie la route et protège son protégé à chaque étape."
  },
  {
    id:"fin-promotion", category:"finales", title:"La promotion", focus:null, focusSquare:null,
    rows:["k . . . . . . .",". . . . . . P .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . K . . ."],
    desc:"Un pion qui atteint la dernière rangée se transforme immédiatement — le plus souvent en dame, la pièce la plus puissante. C'est l'objectif ultime de toute course de pion en finale.",
    hint:"Avance ton pion jusqu'en g8 pour le promouvoir.",
    goal:{"type":"move-to","square":"g8","requireCapture":false},
    success:"Promotion réussie ! Un simple pion vient de devenir une dame. Cette transformation est souvent ce qui décide des finales — chaque case gagnée par un pion passé compte énormément."
  },
  {
    id:"fin-mat-tour", category:"finales", title:"Mat du roi et de la tour", focus:null, focusSquare:null,
    rows:[". . . . . . . k",". . . . . . . .",". . . . . . K .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .","R . . . . . . ."],
    desc:"Roi et tour contre roi seul est la finale la plus fondamentale à maîtriser : ton roi coupe la retraite pendant que ta tour pousse le roi adverse vers le bord, puis délivre le mat.",
    hint:"Ton roi contrôle déjà la fuite — amène ta tour sur la 8e rangée pour le mat.",
    goal:{"type":"checkmate"},
    success:"Exactement la technique à retenir : le roi contrôle les cases d'évasion pendant que la tour porte le coup final sur la rangée ou la colonne du bord. À automatiser complètement !"
  },
  {
    id:"fin-mat-dame", category:"finales", title:"Mat du roi et de la dame", focus:null, focusSquare:null,
    rows:[". . . . . . . k",". . . . . . . .",". . . . . . K .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". Q . . . . . ."],
    desc:"Roi et dame contre roi seul est la finale la plus rapide à conclure : la dame, bien plus mobile que la tour, met souvent fin à la partie en un temps record — à condition de ne pas provoquer un pat accidentel.",
    hint:"Ton roi couvre déjà les cases d'évasion — amène ta dame sur la 8e rangée pour le mat.",
    goal:{"type":"checkmate"},
    success:"Mat ! Attention avec la dame : elle est si puissante qu'il est facile de bloquer le roi adverse par erreur sans lui donner échec — on appelle ça un pat, et c'est nul plutôt que gagné. Ici, tu as évité le piège."
  },
];

const SOLITAIRE_PUZZLES = [
  {
    id:"solo-facile-1", category:"facile", title:"Le premier pas",
    rows:[". . . . . . . .",". . . . . R . R",". . . . . . . .",". . . . . R . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . ."],
    pieceCount:3,
    hint:"Avec seulement 3 pièces, il n'y a presque toujours qu'un seul ordre de captures possible. Regarde qui peut capturer qui.",
    desc:"Capture tes propres pièces les unes après les autres — chaque coup DOIT être une capture — jusqu'à ce qu'il n'en reste plus qu'une seule."
  },
  {
    id:"solo-facile-2", category:"facile", title:"Deux pions et une dame",
    rows:[". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . B . . .",". . . Q . P . .",". . . . . . . .",". . . . . . . ."],
    pieceCount:3,
    hint:"Avec seulement 3 pièces, il n'y a presque toujours qu'un seul ordre de captures possible. Regarde qui peut capturer qui.",
    desc:"Capture tes propres pièces les unes après les autres — chaque coup DOIT être une capture — jusqu'à ce qu'il n'en reste plus qu'une seule."
  },
  {
    id:"solo-facile-3", category:"facile", title:"Trio compact",
    rows:[". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . B . . . . .",". . . . . . . .","N Q . . . . . .",". . . . . . . ."],
    pieceCount:3,
    hint:"Avec seulement 3 pièces, il n'y a presque toujours qu'un seul ordre de captures possible. Regarde qui peut capturer qui.",
    desc:"Capture tes propres pièces les unes après les autres — chaque coup DOIT être une capture — jusqu'à ce qu'il n'en reste plus qu'une seule."
  },
  {
    id:"solo-facile-4", category:"facile", title:"Chaîne de dames",
    rows:[". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . Q .",". . . . . N B .",". . . . . . . .",". . . . . . . .",". . . . . . . ."],
    pieceCount:3,
    hint:"Avec seulement 3 pièces, il n'y a presque toujours qu'un seul ordre de captures possible. Regarde qui peut capturer qui.",
    desc:"Capture tes propres pièces les unes après les autres — chaque coup DOIT être une capture — jusqu'à ce qu'il n'en reste plus qu'une seule."
  },
  {
    id:"solo-facile-5", category:"facile", title:"Tours et dame",
    rows:[". Q Q . . . . .",". . B . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . ."],
    pieceCount:3,
    hint:"Avec seulement 3 pièces, il n'y a presque toujours qu'un seul ordre de captures possible. Regarde qui peut capturer qui.",
    desc:"Capture tes propres pièces les unes après les autres — chaque coup DOIT être une capture — jusqu'à ce qu'il n'en reste plus qu'une seule."
  },
  {
    id:"solo-moyen-1", category:"moyen", title:"Cinq pièces à réduire",
    rows:[". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . R . . . .",". R . N . . . .",". R . . R . . ."],
    pieceCount:5,
    hint:"Repère la pièce qui n'a qu'une seule capture possible : c'est souvent par elle qu'il faut commencer.",
    desc:"Capture tes propres pièces les unes après les autres — chaque coup DOIT être une capture — jusqu'à ce qu'il n'en reste plus qu'une seule."
  },
  {
    id:"solo-moyen-2", category:"moyen", title:"Cavaliers en cascade",
    rows:[". . . . . . . .",". . . . . R P .",". . . . . . . .",". . . . P . . .",". . . . Q . B .",". . . . . . . .",". . . . . . . .",". . . . . . . ."],
    pieceCount:5,
    hint:"Repère la pièce qui n'a qu'une seule capture possible : c'est souvent par elle qu'il faut commencer.",
    desc:"Capture tes propres pièces les unes après les autres — chaque coup DOIT être une capture — jusqu'à ce qu'il n'en reste plus qu'une seule."
  },
  {
    id:"solo-moyen-3", category:"moyen", title:"Fous et pièces lourdes",
    rows:[". . . . . . . .",". . . . . . . .",". . . . P Q . .",". . . . . . N .",". . . Q . . R .",". . . . . . . .",". . . . . . . .",". . . . . . . ."],
    pieceCount:5,
    hint:"Repère la pièce qui n'a qu'une seule capture possible : c'est souvent par elle qu'il faut commencer.",
    desc:"Capture tes propres pièces les unes après les autres — chaque coup DOIT être une capture — jusqu'à ce qu'il n'en reste plus qu'une seule."
  },
  {
    id:"solo-moyen-4", category:"moyen", title:"Formation mixte",
    rows:[". . . . . . . .",". . . . . . . .",". Q . . . . . .",". . Q . . . . .",". . . Q . . . .",". R B . . . . .",". . . . . . . .",". . . . . . . ."],
    pieceCount:5,
    hint:"Repère la pièce qui n'a qu'une seule capture possible : c'est souvent par elle qu'il faut commencer.",
    desc:"Capture tes propres pièces les unes après les autres — chaque coup DOIT être une capture — jusqu'à ce qu'il n'en reste plus qu'une seule."
  },
  {
    id:"solo-moyen-5", category:"moyen", title:"Cinq pièces éparses",
    rows:[". . . . . . . .",". . . . . . . .",". . B . . . . .",". B . P . . . .",". B . . . . . .","Q . . . . . . .",". . . . . . . .",". . . . . . . ."],
    pieceCount:5,
    hint:"Repère la pièce qui n'a qu'une seule capture possible : c'est souvent par elle qu'il faut commencer.",
    desc:"Capture tes propres pièces les unes après les autres — chaque coup DOIT être une capture — jusqu'à ce qu'il n'en reste plus qu'une seule."
  },
  {
    id:"solo-difficile-1", category:"difficile", title:"Sept pièces à dompter",
    rows:[". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .","P B R . . . . .",". . N . . . . .",". N P . . . . .",". . . R . . . ."],
    pieceCount:7,
    hint:"Anticipe : une capture peut t'enfermer et rendre les suivantes impossibles. Réfléchis à l'ordre.",
    desc:"Capture tes propres pièces les unes après les autres — chaque coup DOIT être une capture — jusqu'à ce qu'il n'en reste plus qu'une seule."
  },
  {
    id:"solo-difficile-2", category:"difficile", title:"Le nid de cavaliers",
    rows:[". . . . . . . .",". . . . . . . .",". . . P . . . .","R P R . . . . .",". N . P . . . .","B . . . . . . .",". . . . . . . .",". . . . . . . ."],
    pieceCount:7,
    hint:"Anticipe : une capture peut t'enfermer et rendre les suivantes impossibles. Réfléchis à l'ordre.",
    desc:"Capture tes propres pièces les unes après les autres — chaque coup DOIT être une capture — jusqu'à ce qu'il n'en reste plus qu'une seule."
  },
  {
    id:"solo-difficile-3", category:"difficile", title:"Duel de fous et dames",
    rows:[". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". N . P . . . .","P P B Q . . . .","N . . . . . . .",". . . . . . . ."],
    pieceCount:7,
    hint:"Anticipe : une capture peut t'enfermer et rendre les suivantes impossibles. Réfléchis à l'ordre.",
    desc:"Capture tes propres pièces les unes après les autres — chaque coup DOIT être une capture — jusqu'à ce qu'il n'en reste plus qu'une seule."
  },
  {
    id:"solo-difficile-4", category:"difficile", title:"Ligne complexe",
    rows:[". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . R . .",". . . . P . N .",". . . . . N Q .",". . . P N . . ."],
    pieceCount:7,
    hint:"Anticipe : une capture peut t'enfermer et rendre les suivantes impossibles. Réfléchis à l'ordre.",
    desc:"Capture tes propres pièces les unes après les autres — chaque coup DOIT être une capture — jusqu'à ce qu'il n'en reste plus qu'une seule."
  },
  {
    id:"solo-difficile-5", category:"difficile", title:"La double colonne",
    rows:[". . . . . . . .",". . . . N N . .",". . . . Q . . .",". . . . . . R .",". . . . P . R B",". . . . . . . .",". . . . . . . .",". . . . . . . ."],
    pieceCount:7,
    hint:"Anticipe : une capture peut t'enfermer et rendre les suivantes impossibles. Réfléchis à l'ordre.",
    desc:"Capture tes propres pièces les unes après les autres — chaque coup DOIT être une capture — jusqu'à ce qu'il n'en reste plus qu'une seule."
  },
  {
    id:"solo-expert-1", category:"expert", title:"Neuf pièces, un seul survivant",
    rows:[". . . . . . . .",". . . . . . . .",". . . . . . . .",". Q Q . . . . .","P . . . Q . . .","N P . . . . . .","Q . R . . . . .",". B . . . . . ."],
    pieceCount:9,
    hint:"Neuf pièces, un seul chemin (ou presque) mène à la victoire. Prends ton temps et vérifie chaque option avant de jouer.",
    desc:"Capture tes propres pièces les unes après les autres — chaque coup DOIT être une capture — jusqu'à ce qu'il n'en reste plus qu'une seule."
  },
  {
    id:"solo-expert-2", category:"expert", title:"Grand plateau",
    rows:[". . . Q . . B .",". . Q N . . . .",". . N . Q . . .",". . . . . N . .",". . . B . . R .",". . . . . . . .",". . . . . . . .",". . . . . . . ."],
    pieceCount:9,
    hint:"Neuf pièces, un seul chemin (ou presque) mène à la victoire. Prends ton temps et vérifie chaque option avant de jouer.",
    desc:"Capture tes propres pièces les unes après les autres — chaque coup DOIT être une capture — jusqu'à ce qu'il n'en reste plus qu'une seule."
  },
  {
    id:"solo-expert-3", category:"expert", title:"Enchevêtrement",
    rows:[". . . . . . . .",". . . . . . . .",". . . P P . . .",". . . R Q . . .",". . . . . . . .",". . . . R . . .",". B R B . P . .",". . . . . . . ."],
    pieceCount:9,
    hint:"Neuf pièces, un seul chemin (ou presque) mène à la victoire. Prends ton temps et vérifie chaque option avant de jouer.",
    desc:"Capture tes propres pièces les unes après les autres — chaque coup DOIT être une capture — jusqu'à ce qu'il n'en reste plus qu'une seule."
  },
  {
    id:"solo-expert-4", category:"expert", title:"Diagonales croisées",
    rows:[". . . . . . . .",". . . . . . . .",". . P Q . . . .",". . Q . . . . .","R . . . B . . .","N . . . R . . .",". B . . Q . . .",". . . . . . . ."],
    pieceCount:9,
    hint:"Neuf pièces, un seul chemin (ou presque) mène à la victoire. Prends ton temps et vérifie chaque option avant de jouer.",
    desc:"Capture tes propres pièces les unes après les autres — chaque coup DOIT être une capture — jusqu'à ce qu'il n'en reste plus qu'une seule."
  },
  {
    id:"solo-expert-5", category:"expert", title:"Le grand puzzle",
    rows:[". . . . . . . .",". . . . . . . .",". R Q . . . . .",". . . . . . . .",". . . B . R . .",". N N R . P . .",". . P . . . . .",". . . . . . . ."],
    pieceCount:9,
    hint:"Neuf pièces, un seul chemin (ou presque) mène à la victoire. Prends ton temps et vérifie chaque option avant de jouer.",
    desc:"Capture tes propres pièces les unes après les autres — chaque coup DOIT être une capture — jusqu'à ce qu'il n'en reste plus qu'une seule."
  },
];

const PUZZLES = [
  {
    title:"Puzzle 1 — Mat en 1", turn:'w', category:'facile',
    rows:["k . . . . . . .","p p . . . . . .",". . . . . . . .",". . . . . . . .",
          ". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . Q . . K ."],
    hint:"La dame peut se poser directement à côté du roi tout en restant protégée.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Puzzle 2 — Mat de la tour (colonne h)", turn:'w', category:'facile',
    rows:[". . . . . . . .",". . . . . . p .",". . . . . . p k",". . . . . . p .",
          ". . . . . . . .",". . . . K . R .",". . . . . . . .",". . . . . . . ."],
    hint:"Amène la tour sur la colonne où se trouve le roi : ses propres pions lui bloquent toute fuite.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Puzzle 3 — Mat de la dame (colonne a)", turn:'w', category:'facile',
    rows:[". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . K . .",
          ". . . . . . . Q",". p . . . . . .","k p . . . . . .",". p . . . . . ."],
    hint:"Amène la dame sur la colonne où se trouve le roi : ses propres pions lui bloquent toute fuite.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Puzzle 4 — Mat de la dame (colonne a)", turn:'w', category:'facile',
    rows:[". p . . . . . .","k p . . . . . .",". p . . . . . .",". . . . . . . .",
          ". . . . . . . .",". . . . . K . .",". . . . . . Q .",". . . . . . . ."],
    hint:"Amène la dame sur la colonne où se trouve le roi : ses propres pions lui bloquent toute fuite.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Puzzle 5 — Mat de la tour (8e rangée)", turn:'w', category:'facile',
    rows:[". . . . . k . .",". . . . p p p .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .","R . K . . . . ."],
    hint:"Amène la tour sur la rangée où se trouve le roi : ses propres pions lui bloquent toute fuite.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Puzzle 6 — Mat de la tour (8e rangée)", turn:'w', category:'facile',
    rows:[". . . k . . . .",". . p p p . . .",". . . . . . . .",". . . . . . . .",". . . . . . K .",". . . . . . . .",". . . . . . . .",". R . . . . . ."],
    hint:"Amène la tour sur la rangée où se trouve le roi : ses propres pions lui bloquent toute fuite.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Puzzle 7 — Mat de la tour (8e rangée)", turn:'w', category:'facile',
    rows:[". k . . . . . .","p p p . . . R .",". . . . . . . .",". . . . . K . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . ."],
    hint:"Amène la tour sur la rangée où se trouve le roi : ses propres pions lui bloquent toute fuite.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Puzzle 8 — Mat de la dame (8e rangée)", turn:'w', category:'facile',
    rows:[". k . . . . . .","p p p . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . Q . . .",". . . . . . . .",". . . . . . K ."],
    hint:"Amène la dame sur la rangée où se trouve le roi : ses propres pions lui bloquent toute fuite.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Puzzle 9 — Mat de la dame (8e rangée)", turn:'w', category:'facile',
    rows:[". . k . . . . .",". p p p . . . .",". . . . . . . .",". . . . . . Q K",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . ."],
    hint:"Amène la dame sur la rangée où se trouve le roi : ses propres pions lui bloquent toute fuite.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Puzzle 10 — Mat de la dame (8e rangée)", turn:'w', category:'facile',
    rows:[". . . . . k . .",". . . . p p p .",". . . . . . . .",". . . . . . . .",". . Q . . . . .",". . . . . . . .","K . . . . . . .",". . . . . . . ."],
    hint:"Amène la dame sur la rangée où se trouve le roi : ses propres pions lui bloquent toute fuite.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Puzzle 11 — Mat de la tour (colonne h)", turn:'w', category:'moyen',
    rows:[". . . . . . . .",". K . . . . . .",". . . . . . . .",". . . . . . . .",". . . . R . . .",". . . . . . p .",". . . . . . p k",". . . . . . p ."],
    hint:"Amène la tour sur la colonne où se trouve le roi : ses propres pions lui bloquent toute fuite.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Puzzle 12 — Mat de la tour (colonne h)", turn:'w', category:'moyen',
    rows:[". . . . . . . .",". . . . . . p .",". . . . . . p k",". . . . . . p .",". . . . . . . .",". . . . . . . .",". . . . . R . .",". . . K . . . ."],
    hint:"Amène la tour sur la colonne où se trouve le roi : ses propres pions lui bloquent toute fuite.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Puzzle 13 — Mat de la tour (colonne h)", turn:'w', category:'moyen',
    rows:[". . . . . . . .",". . . . . . . .",". . . . . . p .",". . . . . . p k",". . . . . . p .",". . . . . . . .",". . K R . . . .",". . . . . . . ."],
    hint:"Amène la tour sur la colonne où se trouve le roi : ses propres pions lui bloquent toute fuite.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Puzzle 14 — Mat de la dame (colonne h)", turn:'w', category:'moyen',
    rows:[". . . . . . . .",". K . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . p .",". . . . . . p k",". Q . . . . p ."],
    hint:"Amène la dame sur la colonne où se trouve le roi : ses propres pions lui bloquent toute fuite.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Puzzle 15 — Mat de la dame (colonne h)", turn:'w', category:'moyen',
    rows:[". . . . . . . .",". . . . . . . .",". K . . . . . .",". . . . . . . .",". . . . . . Q .",". . . . . . p .",". . . . . . p k",". . . . . . p ."],
    hint:"Amène la dame sur la colonne où se trouve le roi : ses propres pions lui bloquent toute fuite.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Puzzle 16 — Mat de la dame (colonne h)", turn:'w', category:'moyen',
    rows:[". . . . . . . .",". . . . . . Q .",". . . . . . p .",". . . . . . p k",". . . . . . p .",". . . . . . . .",". . . . . . . .",". . . . K . . ."],
    hint:"Amène la dame sur la colonne où se trouve le roi : ses propres pions lui bloquent toute fuite.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Puzzle 17 — Mat de la tour (colonne a)", turn:'w', category:'moyen',
    rows:[". p . . . . . .","k p . . . . . .",". p . . . . . .",". . . . . . . .",". . . . . K . .",". . R . . . . .",". . . . . . . .",". . . . . . . ."],
    hint:"Amène la tour sur la colonne où se trouve le roi : ses propres pions lui bloquent toute fuite.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Puzzle 18 — Mat de la tour (colonne a)", turn:'w', category:'moyen',
    rows:[". . . . . . . .",". . . . . . . .",". p . . . . . .","k p . . . . . .",". p . . . . . .",". . . . . . . .",". . . . . . . R",". . . . . . K ."],
    hint:"Amène la tour sur la colonne où se trouve le roi : ses propres pions lui bloquent toute fuite.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Puzzle 19 — Mat de la tour (colonne a)", turn:'w', category:'moyen',
    rows:[". . . . . . . .",". p . . . . . .","k p . . . . . .",". p . . . . . .",". . . . . . . .",". . . . . . . .",". . R . . . K .",". . . . . . . ."],
    hint:"Amène la tour sur la colonne où se trouve le roi : ses propres pions lui bloquent toute fuite.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Puzzle 20 — Mat de la dame (colonne a)", turn:'w', category:'moyen',
    rows:[". . . . . . . .",". p . . . . Q .","k p . . . . . .",". p . . . . . .",". . . . . . . .",". . . . . K . .",". . . . . . . .",". . . . . . . ."],
    hint:"Amène la dame sur la colonne où se trouve le roi : ses propres pions lui bloquent toute fuite.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Difficile 1 — Ne te laisse pas distraire", turn:"w", category:"difficile",
    rows:[". . N . . . . p",". p . . . . . .","k p . . . . . .",". p . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . K . .",". . . R . . . ."],
    hint:"Ignore les pièces qui ne défendent rien : trouve la vraie colonne ou rangée ouverte vers le roi.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Difficile 2 — Filtre le bruit", turn:"w", category:"difficile",
    rows:[". . . . K . . .",". B . . . N . .",". . . . . . P .",". . . . . . . .",". . . R . . . .",". p . . . . . .","k p . . . . . .",". p . . . . . ."],
    hint:"Les pièces supplémentaires ne changent rien : le mat reste sur la ligne ouverte.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Difficile 3 — Cavaliers en embuscade", turn:"w", category:"difficile",
    rows:[". . . . . . . .",". . . . . . p .",". . . . . . p k",". . . . . . p .","b . . . . . . .",". . . . . . . .",". . R . . . . .","K p . . . . . ."],
    hint:"Les cavaliers noirs ne protègent aucune case clé. Cherche la ligne ouverte vers le roi.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Difficile 4 — Repère la vraie menace", turn:"w", category:"difficile",
    rows:[". . . . N . p .",". . . . . . p k",". . . . . . p .",". . . . . . . .",". . . . p . . .",". . . . . . . .",". . . . . . . .",". n . . K . Q ."],
    hint:"Les pions isolés ne servent à rien ici : trouve la bonne rangée ou colonne.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Difficile 5 — Plusieurs solutions possibles", turn:"w", category:"difficile",
    rows:[". . . k . . . .",". . p p p . . .",". . . . . . . .",". . . . . . . .",". . . b . . . .",". . . . N . K .",". . . . . . . .","Q . . . P . . ."],
    hint:"Les pièces noires supplémentaires sont impuissantes : le mat est direct, par plusieurs chemins parfois.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Difficile 6 — Pièce isolée", turn:"w", category:"difficile",
    rows:[". . . Q . . . .",". p . . . . . .","k p . . . . . .",". p . . . . . .",". . . . . . . .",". . . b . . . .",". . . . . . . K",". B P . . . . ."],
    hint:"La pièce noire est bien trop loin pour intervenir : le mat est direct.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Expert 1 — Le mat étouffé", turn:"w", category:"expert",
    rows:[". . . . . . . .",". . . . . p . .",". . . . . . . .",". . . K . . . .",". . . N . . . .",". . . . . . . .","p p . . . . . .","k p . . . . . ."],
    hint:"Le roi noir est totalement bloqué par ses propres pièces. Cherche la case où ton cavalier donne échec sans être capturable.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Expert 2 — Vision du cavalier", turn:"w", category:"expert",
    rows:[". . . . . . . .",". . . . . . . .",". . . . K . . .",". . . . . . . .",". . . . . . . .","N . . . . . . .","p p . . . . b .","k p . . . . . ."],
    hint:"Visualise bien les cases atteignables par ton cavalier : une seule donne échec et mat.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Expert 3 — Pièce noire spectatrice", turn:"w", category:"expert",
    rows:[". . . . . . . .",". . . . . . . .",". . . . K . . .",". . . . . . . .",". . . . . . . .",". . . . . b . .","p p . . . . . .","k p . . N . . ."],
    hint:"La pièce noire supplémentaire ne peut rien empêcher. Trouve la case où ton cavalier met fin à la partie.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Expert 4 — Mat étouffé dans le coin", turn:"w", category:"expert",
    rows:[". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . K . . . .",". . . . . p . .",". . . . N . . .","p p . . . . . .","k p . . . . . ."],
    hint:"Le roi noir est prisonnier dans le coin. Ton cavalier a une seule case pour faire mat.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Expert 5 — Calcul à distance", turn:"w", category:"expert",
    rows:[". . . . . . . .",". . . . . . . .",". . . . . . . b",". . . . . . . .",". . . K . . . .",". . . . . . . .","p p . N . . . .","k p . . . . . ."],
    hint:"Ton cavalier est loin du roi noir : calcule bien le saut qui donne échec et mat.",
    desc:"Trouve le mat en un coup."
  },
  {
    title:"Expert 6 — Densité maximale", turn:"w", category:"expert",
    rows:[". . . . . . . .",". . . . . . . .","K . . . . . . .",". . . . . . . .",". . . . . . . .",". . . N . . . .",". . . p . . p p",". . . . . . p k"],
    hint:"Beaucoup de pièces sur l'échiquier : ne te laisse pas déconcentrer, une seule case fait mat.",
    desc:"Trouve le mat en un coup."
  }
];

/* ============================================================
   ÉTAT DE L'APPLICATION
   ============================================================ */
/* ---------- Sons ---------- */
let audioCtx = null;
let soundsEnabled = (localStorage.getItem('chessSoundsEnabled') !== '0');
function getAudioCtx(){
  if(!audioCtx){
    try{ audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e){ return null; }
  }
  if(audioCtx.state==='suspended') audioCtx.resume();
  return audioCtx;
}
function playTone(freq, duration, type, startOffset, gainPeak){
  const ctx = getAudioCtx();
  if(!ctx) return;
  const t0 = ctx.currentTime + (startOffset||0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(gainPeak!=null?gainPeak:0.15, t0+0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0+duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0+duration+0.03);
}
function playSound(kind){
  if(!soundsEnabled) return;
  switch(kind){
    case 'move': playTone(520, 0.09, 'sine'); break;
    case 'capture': playTone(210, 0.13, 'square', 0, 0.1); break;
    case 'check': playTone(740, 0.09, 'triangle'); playTone(880, 0.12, 'triangle', 0.09); break;
    case 'win': playTone(523, 0.12, 'sine'); playTone(659, 0.12, 'sine', 0.12); playTone(784, 0.2, 'sine', 0.24); break;
    case 'loss': playTone(392, 0.16, 'sine', 0, 0.12); playTone(311, 0.24, 'sine', 0.15, 0.12); break;
    case 'draw': playTone(440, 0.13, 'sine', 0, 0.1); playTone(440, 0.13, 'sine', 0.16, 0.1); break;
    case 'click': playTone(660, 0.05, 'sine', 0, 0.08); break;
  }
}
function toggleSounds(){
  soundsEnabled = !soundsEnabled;
  localStorage.setItem('chessSoundsEnabled', soundsEnabled ? '1' : '0');
  updateSoundToggleUI();
  if(soundsEnabled) playSound('move');
}
function updateSoundToggleUI(){
  const btn = document.getElementById('soundToggleBtn');
  if(btn) btn.textContent = soundsEnabled ? '🔊' : '🔇';
}
const soundToggleBtnEl = document.getElementById('soundToggleBtn');
if(soundToggleBtnEl){ soundToggleBtnEl.addEventListener('click', toggleSounds); updateSoundToggleUI(); }

/* ---------- Animations de fin de coup ---------- */
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

let mode = 'home';
let lessonIdx = 0;
let puzzleIdx = 0;
function isPuzzleUnlocked(i){
  if(i===0) return true;
  const P = PUZZLES[i], prev = PUZZLES[i-1];
  if(prev.category !== P.category) return true; // premier puzzle d'une nouvelle rubrique
  return solvedPuzzles.has(i-1);
}
function isLessonUnlocked(i){
  if(i===0) return true;
  const L = LESSONS[i], prev = LESSONS[i-1];
  if(prev.category !== L.category) return true; // première leçon d'une nouvelle rubrique
  return completedLessons.has(prev.id);
}
let completedLessons = new Set();
let solvedPuzzles = new Set();
let solvedSolitaire = new Set();

/* ============================================================
   ÉCHECS EN SOLO (Solitaire Chess — règles officielles ThinkFun)
   Toutes les pièces sont de la même couleur, chaque coup DOIT être
   une capture, pas de notion d'échec/mat, victoire quand il ne
   reste qu'une seule pièce sur l'échiquier.
   ============================================================ */
const SOLITAIRE_CATEGORY_LABELS = {
  facile: '🟢 Facile',
  moyen: '🟡 Moyen',
  difficile: '🟠 Difficile',
  expert: '🔴 Expert'
};
let puzzleSubMode = 'mate'; // 'mate' | 'solitaire'
let solitaireIdx = 0;
let solitaireBoard = null;
let solitaireSelected = null;
let solitaireLegalTargets = [];
let solitaireMoveCount = 0;
let solitaireSolved = false;

function isSolitaireUnlocked(i){
  if(i===0) return true;
  const P = SOLITAIRE_PUZZLES[i], prev = SOLITAIRE_PUZZLES[i-1];
  if(prev.category !== P.category) return true;
  return solvedSolitaire.has(i-1);
}

/* ---------- Génération de coups (capture uniquement, toute pièce est cible valide) ---------- */
function solitaireMovesFrom(board, idx){
  const p = board[idx];
  if(!p) return [];
  const f = fileOf(idx), r = rankOf(idx);
  const moves = [];
  if(p.type==='P'){
    for(const df of [-1,1]){
      const nf=f+df, nr=r+1;
      if(!inBoard(nf,nr)) continue;
      const t = sq(nf,nr);
      if(board[t]) moves.push({from:idx, to:t, flags:{}});
    }
  } else if(p.type==='N' || p.type==='K'){
    const offs = p.type==='N' ? KNIGHT_D : KING_D;
    for(const [df,dr] of offs){
      const nf=f+df, nr=r+dr;
      if(!inBoard(nf,nr)) continue;
      const t = sq(nf,nr);
      if(board[t]) moves.push({from:idx, to:t, flags:{}});
    }
  } else {
    for(const [df,dr] of DIRS[p.type]){
      let nf=f+df, nr=r+dr;
      while(inBoard(nf,nr)){
        const t = sq(nf,nr);
        if(board[t]){ moves.push({from:idx, to:t, flags:{}}); break; }
        nf+=df; nr+=dr;
      }
    }
  }
  return moves;
}
function solitaireAllMoves(board){
  const moves = [];
  for(let i=0;i<64;i++){ if(board[i]) moves.push(...solitaireMovesFrom(board,i)); }
  return moves;
}
function solitairePieceCount(board){ return board.filter(Boolean).length; }

function updateSubmodeButtons(){
  const mateBtn = document.getElementById('submodeMateBtn');
  const soloBtn = document.getElementById('submodeSolitaireBtn');
  if(mateBtn) mateBtn.classList.toggle('active', puzzleSubMode==='mate');
  if(soloBtn) soloBtn.classList.toggle('active', puzzleSubMode==='solitaire');
}
const puzzleSubmodeRowEl = document.getElementById('puzzleSubmodeRow');
if(puzzleSubmodeRowEl){
  puzzleSubmodeRowEl.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-submode]');
    if(!btn) return;
    const target = btn.dataset.submode;
    if(target===puzzleSubMode) return;
    puzzleSubMode = target;
    updateSubmodeButtons();
    if(puzzleSubMode==='solitaire'){ loadSolitaire(solitaireIdx); } else { loadPuzzle(puzzleIdx); }
  });
}

function loadSolitaire(i){
  if(!isSolitaireUnlocked(i)){
    i = 0;
    for(let k=SOLITAIRE_PUZZLES.length-1;k>=0;k--){ if(isSolitaireUnlocked(k)){ i=k; break; } }
  }
  solitaireIdx = i;
  const P = SOLITAIRE_PUZZLES[i];
  solitaireBoard = parseRows(P.rows);
  solitaireSelected = null;
  solitaireLegalTargets = [];
  solitaireMoveCount = 0;
  solitaireSolved = false;
  lessonTitle.textContent = P.title;
  lessonDesc.textContent = P.desc;
  setCoach("Choisis la pièce qui doit capturer en premier. Réfléchis bien avant de jouer. Besoin d'un coup de pouce ? Clique sur « Indice ».");
  renderControls();
  renderList();
  render();
}

function solitaireOnSquareClick(idx){
  const piece = solitaireBoard[idx];
  // clic sur une case cible en surbrillance : jouer le coup
  const mv = solitaireLegalTargets.find(m=>m.to===idx);
  if(mv){
    solitaireBoard[mv.to] = solitaireBoard[mv.from];
    solitaireBoard[mv.from] = null;
    solitaireMoveCount++;
    solitaireSelected = null;
    solitaireLegalTargets = [];
    const remaining = solitairePieceCount(solitaireBoard);
    render();
    if(remaining===1){
      solitaireSolved = true;
      solvedSolitaire.add(solitaireIdx);
      queueSaveProgress();
      setCoach("🏆 Bravo ! Il ne reste qu'une seule pièce — puzzle résolu !");
      playSound('win');
      renderControls();
      renderList();
    } else {
      const nextMoves = solitaireAllMoves(solitaireBoard);
      if(nextMoves.length===0){
        setCoach("😕 Plus aucune capture possible et il reste "+remaining+" pièces sur l'échiquier. Clique sur « Recommencer » pour réessayer.");
        renderControls();
      } else {
        setCoach("Coup joué ! Encore "+(remaining-1)+" capture(s) à trouver.");
      }
    }
    return;
  }
  // sélection d'une nouvelle pièce
  if(piece){
    solitaireSelected = idx;
    solitaireLegalTargets = solitaireMovesFrom(solitaireBoard, idx);
    if(solitaireLegalTargets.length===0){
      setCoach("Cette pièce ne peut capturer aucune autre pièce depuis sa position actuelle.");
    }
  } else {
    solitaireSelected = null;
    solitaireLegalTargets = [];
  }
  render();
}

let gameState = null;   // {board, turn, castling, ep}
let selected = null;    // index of selected square
let legalTargets = [];  // legal moves from selected
let lastMove = null;    // {from,to}
let lessonGoalMet = false;
let capturedByWhite = []; // black pieces white has captured
let capturedByBlack = [];
let awaitingPromotion = null; // {move}
let vsAI = false;
let aiThinking = false;
let moveHistory = [];
let rawMoveLog = [];
let boardFlipped = false;
let historyStack = [];
let playerColor = 'w';
let chosenColor = 'w';
let aiMode = 'progressive';
let fixedElo = 800;
let progressiveElo = 600;

/* ---------- Contrôle du temps ---------- */
const TIME_CONTROLS = [
  { cat:'unlimited', icon:'♾️', label:'Illimité', options:[
    { id:'unlimited', label:'Sans limite', base:null, inc:0 }
  ]},
  { cat:'bullet', icon:'🚀', label:'Bullet', options:[
    { id:'1min', label:'1 min', base:60, inc:0 },
    { id:'1+1', label:'1 + 1', base:60, inc:1 },
    { id:'2+1', label:'2 + 1', base:120, inc:1 }
  ]},
  { cat:'blitz', icon:'⚡', label:'Blitz', options:[
    { id:'3min', label:'3 min', base:180, inc:0 },
    { id:'3+2', label:'3 + 2', base:180, inc:2 },
    { id:'5min', label:'5 min', base:300, inc:0 }
  ]},
  { cat:'rapid', icon:'⏱️', label:'Rapide', options:[
    { id:'10min', label:'10 min', base:600, inc:0 },
    { id:'15+10', label:'15 + 10', base:900, inc:10 },
    { id:'30min', label:'30 min', base:1800, inc:0 }
  ]},
  { cat:'daily', icon:'☀️', label:'Quotidien', sub:'(Temps max. par coup)', options:[
    { id:'1day', label:'1 jour', perMove:86400 },
    { id:'3days', label:'3 jours', perMove:259200 },
    { id:'7days', label:'7 jours', perMove:604800 }
  ]}
];
let selectedTimeControlId = 'unlimited';
function findTimeControlOption(id){
  for(const cat of TIME_CONTROLS){
    for(const opt of cat.options){ if(opt.id===id) return opt; }
  }
  return TIME_CONTROLS[0].options[0];
}
function renderTimeControlPicker(){
  const container = document.getElementById('timeControlPicker');
  if(!container) return;
  container.innerHTML = TIME_CONTROLS.map(cat=>{
    const sub = cat.sub ? ' <span class="tc-sub">'+cat.sub+'</span>' : '';
    const buttons = cat.options.map(opt=>
      '<div class="choice-btn tc-btn'+(opt.id===selectedTimeControlId?' active':'')+'" data-tc="'+opt.id+'">'+opt.label+'</div>'
    ).join('');
    return '<div class="tc-category"><span class="tc-icon">'+cat.icon+'</span><span class="tc-cat-label">'+cat.label+'</span>'+sub+'</div>'+
      '<div class="choice-row tc-row">'+buttons+'</div>';
  }).join('');
}

let clockActive = false;
let currentTimeControl = null;
let clocks = { w:null, b:null };
let clockTimerId = null;

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

/* ---------- Mode Entraîneur (analyse de coups) ---------- */
let coachStats = {excellent:0, good:0, inaccuracy:0, mistake:0, blunder:0};
const MOVE_QUALITY_TAG = {excellent:'⭐', good:'👍', inaccuracy:'😐', mistake:'😬', blunder:'💥'};
const MOVE_QUALITY_MSG = {
  excellent:'⭐ Excellent coup !',
  good:'👍 Bon coup.',
  inaccuracy:'😐 Imprécision : il y avait mieux.',
  mistake:'😬 Erreur : ce coup relâche ton avantage.',
  blunder:'💥 Gaffe : ce coup coûte cher, sois plus prudent.'
};
const MOVE_QUALITY_ORDER = ['excellent','good','inaccuracy','mistake','blunder'];
const MOVE_QUALITY_LABEL = {excellent:'Excellent', good:'Bon', inaccuracy:'Imprécision', mistake:'Erreur', blunder:'Gaffe'};
function updateQualityLegend(){
  const el = document.getElementById('qualityLegend');
  if(!el) return;
  if(mode!=='coach'){ el.style.display = 'none'; return; }
  const s = coachStats;
  const total = s.excellent+s.good+s.inaccuracy+s.mistake+s.blunder;
  if(total===0){ el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = MOVE_QUALITY_ORDER.map(k=>
    '<span>'+MOVE_QUALITY_TAG[k]+' '+MOVE_QUALITY_LABEL[k]+' : '+s[k]+'</span>'
  ).join('');
}
function classifyMove(preState, playedMove){
  const moves = legalMoves(preState);
  if(moves.length<=1) return 'excellent';
  const depth = 2;
  let bestVal = -Infinity, playedVal = null;
  for(const m of moves){
    const child = applyMove(preState, m, 'Q');
    const val = -negamax(child, depth-1, -Infinity, Infinity);
    if(val>bestVal) bestVal = val;
    if(m.from===playedMove.from && m.to===playedMove.to) playedVal = val;
  }
  if(playedVal===null) playedVal = bestVal;
  const diff = bestVal - playedVal;
  if(diff<=0.05) return 'excellent';
  if(diff<=0.3) return 'good';
  if(diff<=0.8) return 'inaccuracy';
  if(diff<=2.0) return 'mistake';
  return 'blunder';
}

/* ---------- Comptes utilisateurs : pont avec auth.js ---------- */
let winsCount = 0, lossesCount = 0, drawsCount = 0;
let myCountry = null, myFeaturedBadge = null;

const COUNTRIES = [
  ['FR','France'],['BE','Belgique'],['CH','Suisse'],['CA','Canada'],['LU','Luxembourg'],
  ['MC','Monaco'],['DZ','Algérie'],['MA','Maroc'],['TN','Tunisie'],['SN','Sénégal'],
  ['CI',"Côte d'Ivoire"],['CM','Cameroun'],['CD','Congo (RDC)'],['CG','Congo'],['ML','Mali'],
  ['BF','Burkina Faso'],['NE','Niger'],['TG','Togo'],['BJ','Bénin'],['GA','Gabon'],
  ['MG','Madagascar'],['HT','Haïti'],['DE','Allemagne'],['AT','Autriche'],['GB','Royaume-Uni'],
  ['IE','Irlande'],['ES','Espagne'],['PT','Portugal'],['IT','Italie'],['NL','Pays-Bas'],
  ['PL','Pologne'],['RO','Roumanie'],['GR','Grèce'],['SE','Suède'],['NO','Norvège'],
  ['DK','Danemark'],['FI','Finlande'],['IS','Islande'],['CZ','Tchéquie'],['SK','Slovaquie'],
  ['HU','Hongrie'],['UA','Ukraine'],['RU','Russie'],['TR','Turquie'],['US','États-Unis'],
  ['MX','Mexique'],['BR','Brésil'],['AR','Argentine'],['CL','Chili'],['CO','Colombie'],
  ['PE','Pérou'],['CN','Chine'],['JP','Japon'],['KR','Corée du Sud'],['IN','Inde'],
  ['ID','Indonésie'],['VN','Vietnam'],['TH','Thaïlande'],['PH','Philippines'],['SG','Singapour'],
  ['AU','Australie'],['NZ','Nouvelle-Zélande'],['ZA','Afrique du Sud'],['EG','Égypte'],
  ['NG','Nigéria'],['KE','Kenya'],['SA','Arabie saoudite'],['AE','Émirats arabes unis'],
  ['IL','Israël'],['LB','Liban'],['QA','Qatar']
];
function countryFlagEmoji(code){
  if(!code || code.length!==2) return '';
  const A = 0x1F1E6, base = 'A'.charCodeAt(0);
  const c = code.toUpperCase();
  return String.fromCodePoint(A+(c.charCodeAt(0)-base)) + String.fromCodePoint(A+(c.charCodeAt(1)-base));
}
function countryNameFor(code){
  const found = COUNTRIES.find(c=>c[0]===code);
  return found ? found[1] : '';
}

function applyLoadedProgress(data){
  if(!data) return;
  completedLessons = new Set(data.completed_lessons || []);
  solvedPuzzles = new Set(data.solved_puzzles || []);
  solvedSolitaire = new Set(data.solved_solitaire || []);
  if(typeof data.progressive_elo === 'number') progressiveElo = data.progressive_elo;
  if(typeof data.fixed_elo === 'number') fixedElo = data.fixed_elo;
  if(data.ai_mode) aiMode = data.ai_mode;
  winsCount = data.wins_count || 0;
  lossesCount = data.losses_count || 0;
  drawsCount = data.draws_count || 0;
  myCountry = data.country || null;
  myFeaturedBadge = data.featured_badge || null;
  showHome();
  renderList();
}

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

if(window.ChessAuth){
  window.ChessAuth.onChange(async (user)=>{
    if(user){
      const data = await window.ChessProgress.load();
      applyLoadedProgress(data);
      queueSaveProgress(); // garantit qu'une ligne de profil (avec pseudo) existe pour le classement
    }
    updateHomeGreeting();
    updateChatAccess();
    initChatIfNeeded();
    refreshLeaderboard();
    refreshHistory();
    refreshBadges();
    maybeShowJoinPrompt();
  });
}

/* ---------- Accueil : salutation + ping ---------- */
function updateHomeGreeting(){
  const greetingEl = document.getElementById('homeGreeting');
  const pingRow = document.getElementById('homePingRow');
  if(!greetingEl) return;
  const user = window.ChessAuth && window.ChessAuth.getUser();
  if(user){
    greetingEl.textContent = 'Bonjour, ' + window.ChessAuth.displayName() + ' !';
    pingRow.style.display = 'inline-flex';
    measurePing();
  } else {
    greetingEl.textContent = 'Bonjour !';
    pingRow.style.display = 'none';
  }
}
async function measurePing(){
  const label = document.getElementById('homePingLabel');
  const dot = document.getElementById('pingDot');
  if(!label || !dot || !window.ChessAuth || !window.ChessAuth.ping) return;
  label.textContent = 'Ping : mesure…';
  dot.className = 'ping-dot';
  const ms = await window.ChessAuth.ping();
  if(ms===null){ label.textContent = 'Ping : indisponible'; return; }
  label.textContent = 'Ping : ' + ms + ' ms';
  dot.className = 'ping-dot ' + (ms<80 ? 'good' : ms<200 ? 'ok' : 'bad');
}

/* ---------- Accueil : chat des joueurs connectés ---------- */
let chatInitialized = false;
function escapeHtmlLocal(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function renderChatMessage(msg){
  const container = document.getElementById('chatMessages');
  if(!container) return;
  const empty = document.getElementById('chatEmpty');
  if(empty) empty.remove();
  const div = document.createElement('div');
  div.className = 'chat-msg';
  const time = new Date(msg.created_at).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
  const eloPart = typeof msg.elo === 'number' ? ' <span class="chat-elo">('+msg.elo+')</span>' : '';
  const flag = msg.country ? ' <span class="flag-chip" title="'+escapeHtmlLocal(countryNameFor(msg.country))+'">'+countryFlagEmoji(msg.country)+'</span>' : '';
  const badges = badgeIconsHtml(msg.badges, 3);
  const badgesPart = badges ? ' '+badges : '';
  div.innerHTML = '<span class="chat-author">'+escapeHtmlLocal(msg.username)+eloPart+flag+badgesPart+'</span> '+escapeHtmlLocal(msg.content)+'<span class="chat-time">'+time+'</span>';
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}
function updateChatAccess(){
  const user = window.ChessAuth && window.ChessAuth.getUser();
  const inputRow = document.getElementById('chatInputRow');
  const lockedNote = document.getElementById('chatLockedNote');
  if(!inputRow || !lockedNote) return;
  if(user){ inputRow.style.display='flex'; lockedNote.style.display='none'; }
  else { inputRow.style.display='none'; lockedNote.style.display='block'; }
}
async function initChatIfNeeded(){
  if(chatInitialized) return;
  if(!window.ChessChat || !window.ChessAuth || !window.ChessAuth.isConfigured()) return;
  chatInitialized = true;
  const messages = await window.ChessChat.loadRecent(30);
  messages.forEach(renderChatMessage);
  window.ChessChat.subscribe(renderChatMessage);
  window.ChessChat.joinPresence((count)=>{
    const el = document.getElementById('chatOnlineCount');
    if(el) el.textContent = count + (count===1 ? ' en ligne' : ' en ligne');
  });
}
function sendChatMessage(){
  const input = document.getElementById('chatInput');
  if(!input) return;
  const val = input.value.trim();
  if(!val || !window.ChessChat) return;
  window.ChessChat.send(val, myFeaturedBadge ? [myFeaturedBadge] : [], myCountry, progressiveElo);
  input.value = '';
}
const chatSendBtn = document.getElementById('chatSendBtn');
const chatInputEl = document.getElementById('chatInput');
if(chatSendBtn) chatSendBtn.addEventListener('click', sendChatMessage);
if(chatInputEl) chatInputEl.addEventListener('keydown', (e)=>{ if(e.key==='Enter') sendChatMessage(); });
updateChatAccess();
initChatIfNeeded();

/* ---------- Accueil : classement ---------- */
async function refreshLeaderboard(){
  const list = document.getElementById('leaderboardList');
  if(!list || !window.ChessSocial) return;
  const rows = await window.ChessSocial.loadLeaderboard(10);
  if(!rows.length){
    list.innerHTML = '<div class="stat-empty">Personne au classement pour l\'instant.</div>';
    return;
  }
  const myName = window.ChessAuth && window.ChessAuth.getUser() ? window.ChessAuth.displayName() : null;
  list.innerHTML = rows.map((r,i)=>{
    const mine = myName && r.username===myName;
    const flag = r.country ? '<span class="flag-chip" title="'+escapeHtmlLocal(countryNameFor(r.country))+'">'+countryFlagEmoji(r.country)+'</span>' : '';
    const badges = badgeIconsHtml(r.featured_badge ? [r.featured_badge] : [], 1);
    return '<div class="stat-row'+(mine?' mine':'')+'">'+
      '<span class="stat-rank">#'+(i+1)+'</span>'+
      '<span class="stat-name">'+flag+escapeHtmlLocal(r.username)+badges+'</span>'+
      '<span class="stat-value">'+(r.progressive_elo!=null?r.progressive_elo:600)+' Elo</span>'+
    '</div>';
  }).join('');
}

/* ---------- Accueil : historique des parties ---------- */
async function refreshHistory(){
  const list = document.getElementById('historyList');
  if(!list || !window.ChessSocial) return;
  const user = window.ChessAuth && window.ChessAuth.getUser();
  if(!user){
    list.innerHTML = '<div class="stat-empty">🔒 Connecte-toi pour voir ton historique.</div>';
    return;
  }
  const rows = await window.ChessSocial.loadHistory(10);
  if(!rows.length){
    list.innerHTML = '<div class="stat-empty">Aucune partie jouée pour l\'instant.</div>';
    return;
  }
  const resultLabel = {win:'✅ Victoire', loss:'❌ Défaite', draw:'➖ Nulle'};
  list.innerHTML = rows.map(r=>{
    const date = new Date(r.created_at).toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit'});
    const modeLabel = r.mode==='coach' ? 'Entraîneur' : (r.mode==='online' ? 'En ligne' : 'IA');
    const reviewable = r.moves && r.moves.length>0;
    return '<div class="stat-row'+(reviewable?' clickable':'')+'"'+(reviewable?' data-history-id="'+r.id+'"':'')+'>'+
      '<span class="stat-name">'+(resultLabel[r.result]||r.result)+'</span>'+
      '<span class="stat-sub">'+modeLabel+' · '+(r.ai_elo!=null?r.ai_elo+' Elo · ':'')+date+'</span>'+
      (reviewable?'<span class="stat-chevron">›</span>':'')+
    '</div>';
  }).join('');
}
if(!document.getElementById('historyList').dataset.clickBound){
  document.getElementById('historyList').dataset.clickBound = '1';
  document.getElementById('historyList').addEventListener('click', (e)=>{
    const row = e.target.closest('[data-history-id]');
    if(row) openReview(row.dataset.historyId);
  });
}

/* ---------- Accueil : badges ---------- */
function lessonsCompletedInCategory(cat){
  return LESSONS.filter(l=>l.category===cat && completedLessons.has(l.id)).length;
}
function lessonsTotalInCategory(cat){
  return LESSONS.filter(l=>l.category===cat).length;
}
const BADGES = [
  {id:'elo1500', icon:'🚀', title:'Elo 1500', desc:'Atteins 1500 Elo en mode progressif.', earned:()=>progressiveElo>=1500},
  {id:'elo1000', icon:'📈', title:'Elo 1000', desc:'Atteins 1000 Elo en mode progressif.', earned:()=>progressiveElo>=1000},
  {id:'veteran', icon:'🎖️', title:'Vétéran', desc:'Joue 20 parties.', earned:()=>(winsCount+lossesCount+drawsCount)>=20},
  {id:'win5', icon:'⚔️', title:'Sur la bonne voie', desc:'Remporte 5 victoires.', earned:()=>winsCount>=5},
  {id:'puzzleAll', icon:'👑', title:'Maître tacticien', desc:'Résous les '+PUZZLES.length+' puzzles.', earned:()=>solvedPuzzles.size>=PUZZLES.length},
  {id:'win1', icon:'🏆', title:'Première victoire', desc:'Bats le Coach pour la première fois.', earned:()=>winsCount>=1},
  {id:'puzzle5', icon:'🧩', title:'Œil de tacticien', desc:'Résous 5 puzzles.', earned:()=>solvedPuzzles.size>=5},
  {id:'lessonsAll', icon:'📚', title:'Étudiant assidu', desc:'Termine les '+LESSONS.length+' leçons.', earned:()=>completedLessons.size>=LESSONS.length},
  {id:'cat-decouvertes', icon:'🔎', title:'Explorateur des bases', desc:'Termine toute la rubrique Découvertes.', earned:()=>lessonsCompletedInCategory('decouvertes')>=lessonsTotalInCategory('decouvertes')},
  {id:'cat-ouvertures', icon:'♟️', title:'Théoricien des ouvertures', desc:'Termine toute la rubrique Ouvertures.', earned:()=>lessonsCompletedInCategory('ouvertures')>=lessonsTotalInCategory('ouvertures')},
  {id:'cat-tactiques', icon:'🗡️', title:'Tacticien redoutable', desc:'Termine toute la rubrique Tactiques avancées.', earned:()=>lessonsCompletedInCategory('tactiques')>=lessonsTotalInCategory('tactiques')},
  {id:'cat-finales', icon:'🏁', title:'Expert des finales', desc:'Termine toute la rubrique Finales.', earned:()=>lessonsCompletedInCategory('finales')>=lessonsTotalInCategory('finales')},
  {id:'solitaireAll', icon:'🃏', title:'Maître du solo', desc:'Résous les '+SOLITAIRE_PUZZLES.length+' puzzles en solo.', earned:()=>solvedSolitaire.size>=SOLITAIRE_PUZZLES.length},
  {id:'lesson1', icon:'🎓', title:'Premiers pas', desc:'Termine ta première leçon.', earned:()=>completedLessons.size>=1}
];
function earnedBadgeIds(){
  return BADGES.filter(b=>b.earned()).map(b=>b.id);
}
function badgeIconsHtml(ids, max){
  if(!ids || !ids.length) return '';
  const byId = {};
  BADGES.forEach(b=>{ byId[b.id]=b; });
  const shown = ids.map(id=>byId[id]).filter(Boolean).slice(0, max||3);
  if(!shown.length) return '';
  return shown.map(b=>'<span class="badge-chip" title="'+escapeHtmlLocal(b.title)+'">'+b.icon+'</span>').join('');
}
/* ---------- Live : diffusion de sa propre partie ---------- */
let liveGameSubscribed = false;
function pushLiveGameUpdate(){
  if(!window.ChessLive || !window.ChessAuth || !window.ChessAuth.getUser()) return;
  if(!gameState || (mode!=='practice' && mode!=='coach')) return;
  liveGameSubscribed = true;
  window.ChessLive.upsert({
    username: window.ChessAuth.displayName(),
    country: myCountry,
    elo: progressiveElo,
    featured_badge: myFeaturedBadge,
    mode: mode,
    board: gameState.board,
    turn: gameState.turn,
    move_count: moveHistory.length,
    last_from: lastMove ? lastMove.from : null,
    last_to: lastMove ? lastMove.to : null
  });
}
function stopBroadcastingLiveGame(){
  if(liveGameSubscribed && window.ChessLive){
    window.ChessLive.remove();
  }
  liveGameSubscribed = false;
}

/* ---------- Live : liste des parties suivies ---------- */
let liveGamesRefreshTimer = null;
function stopLiveSubscription(){
  clearTimeout(liveGamesRefreshTimer);
}
function renderMiniBoard(board, lastFrom, lastTo, big){
  let html = '<div class="mini-board'+(big?' big':'')+'">';
  for(let r=7;r>=0;r--){
    for(let f=0; f<8; f++){
      const idx = r*8+f;
      const piece = board ? board[idx] : null;
      const dark = (r+f)%2===0;
      const hl = (idx===lastFrom || idx===lastTo) ? ' hl' : '';
      html += '<div class="mini-sq '+(dark?'dark':'light')+hl+'">';
      if(piece){
        html += '<svg class="piece '+(piece.color==='w'?'white':'black')+'" viewBox="0 0 100 100"><use href="#pc-'+piece.type+'"/></svg>';
      }
      html += '</div>';
    }
  }
  html += '</div>';
  return html;
}
function liveCardHtml(r){
  const flag = r.country ? '<span class="flag-chip" title="'+escapeHtmlLocal(countryNameFor(r.country))+'">'+countryFlagEmoji(r.country)+'</span>' : '';
  const eloPart = typeof r.elo === 'number' ? ' <span class="live-card-elo">('+r.elo+')</span>' : '';
  const badge = badgeIconsHtml(r.featured_badge ? [r.featured_badge] : [], 1);
  const modeLabel = r.mode==='coach' ? 'Entraîneur' : (r.mode==='online' ? 'En ligne' : 'IA');
  return '<div class="live-card" data-live-id="'+escapeHtmlLocal(r.id)+'">'+
    renderMiniBoard(r.board, r.last_from, r.last_to)+
    '<div class="live-card-info">'+
      '<div class="live-card-name">'+escapeHtmlLocal(r.username)+eloPart+flag+badge+'</div>'+
      '<div class="live-card-meta"><span class="live-dot"></span>Contre '+modeLabel+' · '+(r.move_count||0)+' coups</div>'+
    '</div>'+
  '</div>';
}
function renderLiveListInto(listId, rows){
  const list = document.getElementById(listId);
  if(!list) return;
  if(!rows.length){
    list.innerHTML = '<div class="stat-empty">Aucune partie en direct pour l\'instant.</div>';
  } else {
    list.innerHTML = rows.map(liveCardHtml).join('');
  }
}
function attachLiveListClickHandler(listId){
  const list = document.getElementById(listId);
  if(!list || list.dataset.liveClickBound) return;
  list.dataset.liveClickBound = '1';
  list.addEventListener('click', (e)=>{
    const card = e.target.closest('[data-live-id]');
    if(card) openSpectate(card.dataset.liveId);
  });
}
attachLiveListClickHandler('liveList');
attachLiveListClickHandler('homeLiveList');
async function refreshLiveGames(){
  const rows = window.ChessLive ? await window.ChessLive.loadRecent(10) : [];
  renderLiveListInto('liveList', rows);
  renderLiveListInto('homeLiveList', rows.slice(0,4));
  clearTimeout(liveGamesRefreshTimer);
  if(mode==='live' || mode==='home'){
    liveGamesRefreshTimer = setTimeout(refreshLiveGames, 15000); // filet de sécurité si le temps réel est indisponible
  }
}
const homeLiveSeeAllBtn = document.getElementById('homeLiveSeeAll');
if(homeLiveSeeAllBtn) homeLiveSeeAllBtn.addEventListener('click', ()=>goToMode('live'));

/* ---------- Mode spectateur ---------- */
let spectateGameId = null;
let spectateRefreshTimer = null;
function stopSpectating(){
  spectateGameId = null;
  clearTimeout(spectateRefreshTimer);
}
async function refreshSpectate(){
  if(!spectateGameId || !window.ChessLive) return;
  const g = await window.ChessLive.getById(spectateGameId);
  if(!g){
    const meta = document.getElementById('spectateMeta');
    if(meta) meta.innerHTML = 'Cette partie est terminée.';
    clearTimeout(spectateRefreshTimer);
    return;
  }
  const row = document.getElementById('spectatePlayerRow');
  if(row){
    const flag = g.country ? '<span class="flag-chip" title="'+escapeHtmlLocal(countryNameFor(g.country))+'">'+countryFlagEmoji(g.country)+'</span>' : '';
    const eloPart = typeof g.elo === 'number' ? ' <span class="live-card-elo">('+g.elo+')</span>' : '';
    const badge = badgeIconsHtml(g.featured_badge ? [g.featured_badge] : [], 1);
    row.innerHTML = escapeHtmlLocal(g.username)+eloPart+flag+badge;
  }
  const wrap = document.getElementById('spectateBoardWrap');
  if(wrap) wrap.innerHTML = renderMiniBoard(g.board, g.last_from, g.last_to, true);
  const meta = document.getElementById('spectateMeta');
  if(meta){
    const modeLabel = g.mode==='coach' ? 'Entraîneur' : (g.mode==='online' ? 'En ligne' : 'IA');
    const turnLabel = g.turn==='w' ? 'Trait aux Blancs' : 'Trait aux Noirs';
    meta.innerHTML = '<span class="live-dot"></span>Contre '+modeLabel+' · '+(g.move_count||0)+' coups · '+turnLabel;
  }
  clearTimeout(spectateRefreshTimer);
  if(mode==='spectate'){
    spectateRefreshTimer = setTimeout(refreshSpectate, 10000); // filet de sécurité si le temps réel est indisponible
  }
}
function openSpectate(id){
  stopSpectating();
  spectateGameId = id;
  mode = 'spectate';
  hideAllViews();
  document.getElementById('spectateView').style.display = 'block';
  setFooterActive('');
  document.getElementById('spectatePlayerRow').innerHTML = '';
  document.getElementById('spectateBoardWrap').innerHTML = '';
  document.getElementById('spectateMeta').textContent = 'Chargement…';
  refreshSpectate();
  if(window.ChessLive) window.ChessLive.subscribe(()=>{ if(mode==='spectate') refreshSpectate(); });
}
const spectateBackBtn = document.getElementById('spectateBackBtn');
if(spectateBackBtn) spectateBackBtn.addEventListener('click', ()=>{ stopSpectating(); goToMode('live'); });

/* ---------- Revue de partie ---------- */
let reviewGameRow = null;
let reviewPositions = [];   // reviewPositions[i] = {board, turn} après i demi-coups (0 = position initiale)
let reviewLastMoveAt = [];  // reviewLastMoveAt[i] = {from,to} du coup ayant mené à la position i
let reviewMoves = [];       // liste brute des coups {from,to,promo,color}
let reviewQuality = [];     // reviewQuality[i] = qualité du coup i (1-indexé), uniquement pour les coups du joueur
let reviewPlyIndex = 0;

function findMatchingLegalMove(state, mv){
  const moves = legalMoves(state);
  return moves.find(m => m.from===mv.from && m.to===mv.to) || null;
}

async function openReview(id){
  mode = 'review';
  hideAllViews();
  document.getElementById('reviewView').style.display = 'block';
  setFooterActive('');
  document.getElementById('reviewMeta').textContent = 'Chargement…';
  document.getElementById('reviewBoardWrap').innerHTML = '';
  document.getElementById('reviewMoveList').innerHTML = '';
  document.getElementById('reviewAnalysisSummary').innerHTML = '';

  const g = window.ChessSocial ? await window.ChessSocial.loadHistoryById(id) : null;
  if(!g || !g.moves || !g.moves.length){
    document.getElementById('reviewMeta').textContent = "Cette partie n'a pas de détails enregistrés pour être rejouée.";
    return;
  }
  reviewGameRow = g;
  reviewMoves = g.moves;
  reviewQuality = new Array(reviewMoves.length+1).fill(null);

  let state = initState(initialBoard(), 'w', {});
  reviewPositions = [{ board: state.board.slice(), turn: state.turn, castling: Object.assign({}, state.castling), ep: state.ep }];
  reviewLastMoveAt = [null];
  for(const mv of reviewMoves){
    const legal = findMatchingLegalMove(state, mv);
    if(!legal) break; // sécurité si la partie stockée est incohérente
    state = applyMove(state, legal, mv.promo||'Q');
    reviewPositions.push({ board: state.board.slice(), turn: state.turn, castling: Object.assign({}, state.castling), ep: state.ep });
    reviewLastMoveAt.push({ from: mv.from, to: mv.to });
  }
  reviewPlyIndex = reviewPositions.length-1;
  renderReviewMeta();
  renderReviewMoveList();
  renderReviewBoard();
}

function renderReviewMeta(){
  const el = document.getElementById('reviewMeta');
  if(!el || !reviewGameRow) return;
  const g = reviewGameRow;
  const resultLabel = {win:'✅ Victoire', loss:'❌ Défaite', draw:'➖ Nulle'}[g.result] || g.result;
  const modeLabel = g.mode==='coach' ? 'Entraîneur' : (g.mode==='online' ? 'En ligne' : 'IA');
  const date = new Date(g.created_at).toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit', year:'numeric'});
  const opponentLabel = g.mode==='online' ? 'Partie en ligne' : ('Contre '+modeLabel);
  el.textContent = resultLabel+' · '+opponentLabel+(g.ai_elo!=null?' ('+g.ai_elo+' Elo)':'')+' · '+date;
}
function renderReviewBoard(){
  const wrap = document.getElementById('reviewBoardWrap');
  const label = document.getElementById('reviewPlyLabel');
  if(!wrap) return;
  const pos = reviewPositions[reviewPlyIndex];
  const lm = reviewLastMoveAt[reviewPlyIndex];
  wrap.innerHTML = renderMiniBoard(pos.board, lm?lm.from:null, lm?lm.to:null, true);
  if(label) label.textContent = reviewPlyIndex+' / '+(reviewPositions.length-1);
  document.querySelectorAll('.review-move-chip').forEach(c=>{
    c.classList.toggle('active', Number(c.dataset.ply)===reviewPlyIndex);
  });
  const firstBtn = document.getElementById('reviewFirstBtn'), prevBtn = document.getElementById('reviewPrevBtn');
  const nextBtn = document.getElementById('reviewNextBtn'), lastBtn = document.getElementById('reviewLastBtn');
  if(firstBtn) firstBtn.disabled = reviewPlyIndex===0;
  if(prevBtn) prevBtn.disabled = reviewPlyIndex===0;
  if(nextBtn) nextBtn.disabled = reviewPlyIndex===reviewPositions.length-1;
  if(lastBtn) lastBtn.disabled = reviewPlyIndex===reviewPositions.length-1;
}
function reviewGoTo(idx){
  reviewPlyIndex = Math.max(0, Math.min(reviewPositions.length-1, idx));
  renderReviewBoard();
}
function renderReviewMoveList(){
  const list = document.getElementById('reviewMoveList');
  if(!list) return;
  list.innerHTML = reviewMoves.map((mv,i)=>{
    const ply = i+1;
    const q = reviewQuality[ply];
    const qClass = q ? ' q-'+q : '';
    const tag = q ? ' '+MOVE_QUALITY_TAG[q] : '';
    const moveNo = Math.floor(i/2)+1;
    const label = (mv.color==='w' ? moveNo+'.' : '') + sqName(mv.from)+'→'+sqName(mv.to)+tag;
    return '<span class="review-move-chip'+qClass+'" data-ply="'+ply+'">'+label+'</span>';
  }).join('');
}
document.getElementById('reviewFirstBtn').addEventListener('click', ()=>reviewGoTo(0));
document.getElementById('reviewPrevBtn').addEventListener('click', ()=>reviewGoTo(reviewPlyIndex-1));
document.getElementById('reviewNextBtn').addEventListener('click', ()=>reviewGoTo(reviewPlyIndex+1));
document.getElementById('reviewLastBtn').addEventListener('click', ()=>reviewGoTo(reviewPositions.length-1));
document.getElementById('reviewMoveList').addEventListener('click', (e)=>{
  const chip = e.target.closest('[data-ply]');
  if(chip) reviewGoTo(Number(chip.dataset.ply));
});
document.getElementById('reviewAnalyzeBtn').addEventListener('click', ()=>{
  const btn = document.getElementById('reviewAnalyzeBtn');
  const summary = document.getElementById('reviewAnalysisSummary');
  if(!reviewGameRow || !reviewMoves.length) return;
  btn.disabled = true;
  btn.textContent = 'Analyse en cours…';
  setTimeout(()=>{
    const playerColorForGame = reviewGameRow.player_color || 'w';
    const tally = {excellent:0, good:0, inaccuracy:0, mistake:0, blunder:0};
    for(let i=0; i<reviewMoves.length; i++){
      const mv = reviewMoves[i];
      if(mv.color!==playerColorForGame) continue;
      const preState = reviewPositions[i];
      const q = classifyMove(preState, mv);
      reviewQuality[i+1] = q;
      tally[q]++;
    }
    renderReviewMoveList();
    renderReviewBoard();
    const total = tally.excellent+tally.good+tally.inaccuracy+tally.mistake+tally.blunder;
    summary.innerHTML = total>0
      ? '<div class="review-analysis-line"><span>⭐ Excellents</span><span>'+tally.excellent+'</span></div>'+
        '<div class="review-analysis-line"><span>✓ Bons</span><span>'+tally.good+'</span></div>'+
        '<div class="review-analysis-line"><span>?! Imprécisions</span><span>'+tally.inaccuracy+'</span></div>'+
        '<div class="review-analysis-line"><span>? Erreurs</span><span>'+tally.mistake+'</span></div>'+
        '<div class="review-analysis-line"><span>?? Gaffes</span><span>'+tally.blunder+'</span></div>'
      : '<div class="stat-empty">Aucun coup du joueur à analyser.</div>';
    btn.disabled = false;
    btn.textContent = '🔎 Ré-analyser cette partie';
  }, 30);
});

function refreshBadges(gridId){
  const grid = document.getElementById(gridId || 'badgesGrid');
  if(!grid) return;
  grid.innerHTML = BADGES.map(b=>{
    const earned = b.earned();
    return '<div class="badge-item'+(earned?'':' locked')+'" title="'+escapeHtmlLocal(b.desc)+'">'+
      '<div class="badge-icon">'+b.icon+'</div>'+
      '<div class="badge-title">'+b.title+'</div>'+
    '</div>';
  }).join('');
}

/* ---------- Profil ---------- */
function loadProfileView(){
  const user = window.ChessAuth && window.ChessAuth.getUser();
  const input = document.getElementById('profileUsernameInput');
  const status = document.getElementById('profileUsernameStatus');
  if(status){ status.textContent = ''; status.className = 'profile-status'; }
  if(input) input.value = user ? window.ChessAuth.displayName() : '';

  const emailInput = document.getElementById('profileEmailInput');
  const emailStatus = document.getElementById('profileEmailStatus');
  if(emailStatus){ emailStatus.textContent = ''; emailStatus.className = 'profile-status'; }
  if(emailInput) emailInput.value = user ? (user.email || '') : '';

  const newPwInput = document.getElementById('profileNewPasswordInput');
  const confirmPwInput = document.getElementById('profileConfirmPasswordInput');
  const pwStatus = document.getElementById('profilePasswordStatus');
  if(newPwInput){ newPwInput.value = ''; newPwInput.type = 'password'; }
  if(confirmPwInput){ confirmPwInput.value = ''; confirmPwInput.type = 'password'; }
  const newPwToggle = document.getElementById('profileNewPasswordToggle');
  const confirmPwToggle = document.getElementById('profileConfirmPasswordToggle');
  if(newPwToggle) newPwToggle.textContent = '👁️';
  if(confirmPwToggle) confirmPwToggle.textContent = '👁️';
  if(pwStatus){ pwStatus.textContent = ''; pwStatus.className = 'profile-status'; }

  const countrySelect = document.getElementById('profileCountrySelect');
  if(countrySelect){
    const sorted = COUNTRIES.slice().sort((a,b)=>a[1].localeCompare(b[1], 'fr'));
    countrySelect.innerHTML = '<option value="">— Aucun —</option>' +
      sorted.map(c=>'<option value="'+c[0]+'">'+countryFlagEmoji(c[0])+' '+escapeHtmlLocal(c[1])+'</option>').join('');
    countrySelect.value = myCountry || '';
  }

  const badgeSelect = document.getElementById('profileBadgeSelect');
  if(badgeSelect){
    const earned = BADGES.filter(b=>b.earned());
    if(earned.length===0){
      badgeSelect.innerHTML = '<option value="">Aucun badge débloqué pour l\'instant</option>';
    } else {
      badgeSelect.innerHTML = '<option value="">— Aucun —</option>' +
        earned.map(b=>'<option value="'+b.id+'">'+b.icon+' '+escapeHtmlLocal(b.title)+'</option>').join('');
    }
    badgeSelect.value = myFeaturedBadge || '';
  }

  const grid = document.getElementById('profileStatsGrid');
  if(grid){
    const totalGames = winsCount+lossesCount+drawsCount;
    const winRate = totalGames>0 ? Math.round((winsCount/totalGames)*100) : null;
    const stats = [
      ['Leçons terminées', completedLessons.size+' / '+LESSONS.length],
      ['Puzzles résolus', solvedPuzzles.size+' / '+PUZZLES.length],
      ['Elo progressif', progressiveElo+' ('+eloTierLabel(progressiveElo)+')'],
      ['Elo IA fixe', fixedElo+' ('+eloTierLabel(fixedElo)+')'],
      ['Victoires', String(winsCount)],
      ['Défaites', String(lossesCount)],
      ['Nulles', String(drawsCount)],
      ['Taux de victoire', winRate!==null ? (winRate+'% sur '+totalGames+' parties') : 'Aucune partie jouée']
    ];
    grid.innerHTML = stats.map(function(pair){
      return '<div class="profile-stat"><div class="profile-stat-label">'+pair[0]+'</div><div class="profile-stat-value">'+pair[1]+'</div></div>';
    }).join('');
  }
  refreshBadges('profileBadgesGrid');

  const deleteConfirm = document.getElementById('profileDeleteConfirm');
  const deleteBtn = document.getElementById('profileDeleteBtn');
  if(deleteConfirm) deleteConfirm.checked = false;
  if(deleteBtn) deleteBtn.disabled = true;
}

async function saveProfileUsername(){
  const input = document.getElementById('profileUsernameInput');
  const status = document.getElementById('profileUsernameStatus');
  const countrySelect = document.getElementById('profileCountrySelect');
  const badgeSelect = document.getElementById('profileBadgeSelect');
  if(!input || !status || !window.ChessAuth) return;
  const val = input.value.trim();
  if(!val){
    status.textContent = 'Le pseudo ne peut pas être vide.';
    status.className = 'profile-status error';
    return;
  }
  const country = countrySelect ? countrySelect.value : '';
  const featuredBadge = badgeSelect ? badgeSelect.value : '';
  status.textContent = 'Enregistrement…';
  status.className = 'profile-status';
  const ok = await window.ChessAuth.updateProfile({
    username: val,
    country: country || null,
    featuredBadge: featuredBadge || null
  });
  if(ok){
    myCountry = country || null;
    myFeaturedBadge = featuredBadge || null;
    status.textContent = 'Profil mis à jour !';
    status.className = 'profile-status success';
    queueSaveProgress();
    refreshLeaderboard();
  } else {
    status.textContent = "Erreur lors de la mise à jour du profil.";
    status.className = 'profile-status error';
  }
}

async function handleDeleteAccount(){
  const confirmBox = document.getElementById('profileDeleteConfirm');
  if(!confirmBox || !confirmBox.checked) return;
  if(!confirm("Cette action est définitive : ton compte et toutes tes données (progression, historique, messages du chat) seront supprimés. Continuer ?")) return;
  const btn = document.getElementById('profileDeleteBtn');
  if(btn) btn.disabled = true;
  const ok = window.ChessAuth ? await window.ChessAuth.deleteAccount() : false;
  if(ok){
    alert("Ton compte a été supprimé.");
    goToMode('home');
  } else {
    alert("Une erreur est survenue lors de la suppression. Réessaie plus tard.");
    if(btn) btn.disabled = false;
  }
}

async function saveProfileEmail(){
  const input = document.getElementById('profileEmailInput');
  const status = document.getElementById('profileEmailStatus');
  if(!input || !status || !window.ChessAuth) return;
  const val = input.value.trim();
  if(!val || !val.includes('@')){
    status.textContent = 'Adresse email invalide.';
    status.className = 'profile-status error';
    return;
  }
  status.textContent = 'Enregistrement…';
  status.className = 'profile-status';
  const res = await window.ChessAuth.updateEmail(val);
  if(res.ok){
    status.textContent = 'Vérifie ta boîte mail pour confirmer ce changement d\'adresse.';
    status.className = 'profile-status success';
  } else {
    status.textContent = (window.ChessAuth.translateError ? window.ChessAuth.translateError(res.error) : res.error) || "Erreur lors de la mise à jour de l'email.";
    status.className = 'profile-status error';
  }
}

async function saveProfilePassword(){
  const newPw = document.getElementById('profileNewPasswordInput');
  const confirmPw = document.getElementById('profileConfirmPasswordInput');
  const status = document.getElementById('profilePasswordStatus');
  if(!newPw || !confirmPw || !status || !window.ChessAuth) return;
  if(newPw.value.length < 6){
    status.textContent = 'Le mot de passe doit contenir au moins 6 caractères.';
    status.className = 'profile-status error';
    return;
  }
  if(newPw.value !== confirmPw.value){
    status.textContent = 'Les deux mots de passe ne correspondent pas.';
    status.className = 'profile-status error';
    return;
  }
  status.textContent = 'Enregistrement…';
  status.className = 'profile-status';
  const res = await window.ChessAuth.updatePassword(newPw.value);
  if(res.ok){
    status.textContent = 'Mot de passe mis à jour !';
    status.className = 'profile-status success';
    newPw.value = ''; confirmPw.value = '';
  } else {
    status.textContent = (window.ChessAuth.translateError ? window.ChessAuth.translateError(res.error) : res.error) || "Erreur lors de la mise à jour du mot de passe.";
    status.className = 'profile-status error';
  }
}

const profileUsernameSaveBtn = document.getElementById('profileUsernameSaveBtn');
if(profileUsernameSaveBtn) profileUsernameSaveBtn.addEventListener('click', saveProfileUsername);
const profileUsernameInputEl = document.getElementById('profileUsernameInput');
if(profileUsernameInputEl) profileUsernameInputEl.addEventListener('keydown', (e)=>{ if(e.key==='Enter') saveProfileUsername(); });
const profileEmailSaveBtn = document.getElementById('profileEmailSaveBtn');
if(profileEmailSaveBtn) profileEmailSaveBtn.addEventListener('click', saveProfileEmail);
const profilePasswordSaveBtn = document.getElementById('profilePasswordSaveBtn');
if(profilePasswordSaveBtn) profilePasswordSaveBtn.addEventListener('click', saveProfilePassword);
function wireProfilePasswordToggle(toggleId, inputId){
  const btn = document.getElementById(toggleId);
  const inp = document.getElementById(inputId);
  if(!btn || !inp) return;
  btn.addEventListener('click', ()=>{
    const showing = inp.type === 'text';
    inp.type = showing ? 'password' : 'text';
    btn.textContent = showing ? '👁️' : '🙈';
    btn.setAttribute('aria-label', showing ? 'Afficher le mot de passe' : 'Masquer le mot de passe');
  });
}
wireProfilePasswordToggle('profileNewPasswordToggle', 'profileNewPasswordInput');
wireProfilePasswordToggle('profileConfirmPasswordToggle', 'profileConfirmPasswordInput');
const profileDeleteConfirmEl = document.getElementById('profileDeleteConfirm');
if(profileDeleteConfirmEl) profileDeleteConfirmEl.addEventListener('change', ()=>{
  const btn = document.getElementById('profileDeleteBtn');
  if(btn) btn.disabled = !profileDeleteConfirmEl.checked;
});
const profileDeleteBtnEl = document.getElementById('profileDeleteBtn');
if(profileDeleteBtnEl) profileDeleteBtnEl.addEventListener('click', handleDeleteAccount);

function eloTierLabel(elo){
  if(elo<500) return 'Débutant';
  if(elo<950) return 'Amateur';
  if(elo<1350) return 'Intermédiaire';
  if(elo<1750) return 'Avancé';
  return 'Expert';
}
function aiParamsForElo(elo){
  let depth;
  if(elo<500) depth=0;
  else if(elo<950) depth=1;
  else if(elo<1400) depth=2;
  else depth=3;
  const blunder = Math.max(0, Math.min(0.55, (900-elo)/1400));
  return {depth, blunder};
}
function currentAIElo(){ return aiMode==='progressive' ? progressiveElo : fixedElo; }
function chooseAIMoveForElo(state, elo){
  const moves = legalMoves(state);
  if(moves.length===0) return null;
  const {depth, blunder} = aiParamsForElo(elo);
  if(Math.random() < blunder){
    return moves[Math.floor(Math.random()*moves.length)];
  }
  return depth===0 ? chooseAIMove(state) : chooseAIMoveMinimax(state, depth);
}

const boardEl = document.getElementById('board');
const listInner = document.getElementById('listInner');
const listHead = document.getElementById('listHead');
const lessonTitle = document.getElementById('lessonTitle');
const lessonDesc = document.getElementById('lessonDesc');
const coachText = document.getElementById('coachText');
const controlsEl = document.getElementById('controls');
const turnLabel = document.getElementById('turnLabel');
const statusBadge = document.getElementById('statusBadge');
const capWEl = document.getElementById('capturedByWhite');
const capBEl = document.getElementById('capturedByBlack');
const promoOverlay = document.getElementById('promoOverlay');

/* Rendu des pièces : voir le sprite SVG <symbol id="pc-X"> défini en haut du <body>. */

function setCoach(msg){ coachText.innerHTML = msg; }

/* ---------- Mode switching ---------- */
function hideAllViews(){
  document.getElementById('homeView').style.display = 'none';
  document.getElementById('playMenuView').style.display = 'none';
  document.getElementById('profileView').style.display = 'none';
  document.getElementById('liveView').style.display = 'none';
  document.getElementById('spectateView').style.display = 'none';
  document.getElementById('reviewView').style.display = 'none';
  document.getElementById('onlineView').style.display = 'none';
  document.getElementById('practiceSetup').style.display = 'none';
  document.getElementById('mainLayout').style.display = 'none';
}
function setFooterActive(navKey){
  document.querySelectorAll('.footer-nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.nav===navKey));
}

function showHome(){
  hideAllViews();
  document.getElementById('homeView').style.display = 'block';
  setFooterActive('home');
  updateHomeGreeting();
  refreshLeaderboard();
  refreshHistory();
  refreshBadges();
  refreshLiveGames();
  if(window.ChessLive) window.ChessLive.subscribe(()=>refreshLiveGames());
}
function hideHome(){
  document.getElementById('homeView').style.display = 'none';
  document.getElementById('mainLayout').style.display = 'flex';
}

function goToMode(targetMode){
  if(targetMode!=='practice' && targetMode!=='coach'){
    stopClockTimer();
    clockActive = false;
    stopBroadcastingLiveGame();
  }
  if(targetMode!=='live' && targetMode!=='home') stopLiveSubscription();
  if(targetMode!=='spectate') stopSpectating();
  if(targetMode!=='random-searching') stopMatchmakingPolling();
  if(targetMode!=='online'){
    stopOnlineClockLoop();
    if(window.ChessOnline) window.ChessOnline.unsubscribe();
  }
  mode = targetMode;
  awaitingPromotion = null;
  if(mode==='home'){ showHome(); return; }
  if(mode==='playmenu'){
    hideAllViews();
    document.getElementById('playMenuView').style.display = 'block';
    setFooterActive('playmenu');
    return;
  }
  if(mode==='profile'){
    const user = window.ChessAuth && window.ChessAuth.getUser();
    if(!user){ showHome(); return; }
    hideAllViews();
    document.getElementById('profileView').style.display = 'block';
    setFooterActive('');
    loadProfileView();
    return;
  }
  if(mode==='live'){
    hideAllViews();
    document.getElementById('liveView').style.display = 'block';
    setFooterActive('live');
    refreshLiveGames();
    if(window.ChessLive) window.ChessLive.subscribe(()=>refreshLiveGames());
    return;
  }
  if(mode==='friend-setup' || mode==='random-setup'){
    const user = window.ChessAuth && window.ChessAuth.getUser();
    if(!user){
      showHome();
      alert("Connecte-toi d'abord pour jouer en ligne.");
      return;
    }
    hideAllViews();
    document.getElementById('onlineView').style.display = 'block';
    setFooterActive('');
    if(mode==='friend-setup') renderFriendSetup();
    else renderRandomSetup();
    return;
  }
  hideAllViews();
  document.getElementById('mainLayout').style.display = 'flex';
  if(mode==='puzzles') setFooterActive('puzzles');
  else if(mode==='lessons') setFooterActive('lessons');
  else setFooterActive('playmenu');
  const submodeRow = document.getElementById('puzzleSubmodeRow');
  if(submodeRow) submodeRow.style.display = (mode==='puzzles') ? 'flex' : 'none';
  if(mode==='lessons'){ loadLesson(lessonIdx); }
  else if(mode==='puzzles'){
    updateSubmodeButtons();
    if(puzzleSubMode==='solitaire'){ loadSolitaire(solitaireIdx); } else { loadPuzzle(puzzleIdx); }
  }
  else if(mode==='practice'||mode==='coach'){ showPracticeSetup(); }
}
window.goToMode = goToMode;

document.getElementById('footerNav').addEventListener('click', (e)=>{
  const b = e.target.closest('.footer-nav-btn');
  if(!b) return;
  goToMode(b.dataset.nav);
});

document.getElementById('playMenuCards').addEventListener('click', (e)=>{
  const card = e.target.closest('.home-card');
  if(!card) return;
  const play = card.dataset.play;
  if(play==='ai'){ goToMode('practice'); }
  else if(play==='coach'){ goToMode('coach'); }
  else if(play==='friend'){ goToMode('friend-setup'); }
  else if(play==='random'){ goToMode('random-setup'); }
});

/* ---------- Build sidebar list ---------- */
function renderList(){
  listInner.innerHTML='';
  if(mode==='lessons'){
    listHead.textContent = 'Programme';
    let lastCategory = null;
    LESSONS.forEach((l,i)=>{
      if(l.category !== lastCategory){
        lastCategory = l.category;
        const catDiv = document.createElement('div');
        catDiv.className = 'list-category';
        catDiv.textContent = LESSON_CATEGORY_LABELS[l.category] || l.category;
        listInner.appendChild(catDiv);
      }
      const unlocked = isLessonUnlocked(i);
      const done = completedLessons.has(l.id);
      const div = document.createElement('div');
      div.className = 'list-item' + (i===lessonIdx?' active':'') + (done?' done':'') + (unlocked?'':' locked');
      const suffix = done ? ' ✓' : (unlocked ? '' : ' 🔒');
      div.innerHTML = `<span class="num">${(i+1).toString().padStart(2,'0')}</span><span class="lbl">${l.title}${suffix}</span>`;
      if(unlocked){
        div.onclick = ()=>{ lessonIdx=i; loadLesson(i); };
      } else {
        div.onclick = ()=>{ setCoach("🔒 Réussis d'abord la leçon précédente de cette rubrique pour débloquer celle-ci."); };
      }
      listInner.appendChild(div);
    });
  } else if(mode==='puzzles'){
    if(puzzleSubMode==='solitaire'){
      listHead.textContent = 'Échecs en solo';
      let lastCat = null;
      SOLITAIRE_PUZZLES.forEach((p,i)=>{
        if(p.category !== lastCat){
          lastCat = p.category;
          const catDiv = document.createElement('div');
          catDiv.className = 'list-category';
          catDiv.textContent = SOLITAIRE_CATEGORY_LABELS[p.category] || p.category;
          listInner.appendChild(catDiv);
        }
        const unlocked = isSolitaireUnlocked(i);
        const div = document.createElement('div');
        div.className = 'list-item' + (i===solitaireIdx?' active':'') + (solvedSolitaire.has(i)?' done':'') + (unlocked?'':' locked');
        const suffix = solvedSolitaire.has(i) ? ' ✓' : (unlocked ? '' : ' 🔒');
        div.innerHTML = `<span class="num">${(i+1).toString().padStart(2,'0')}</span><span class="lbl">${p.title}${suffix}</span>`;
        if(unlocked){
          div.onclick = ()=>{ loadSolitaire(i); };
        } else {
          div.onclick = ()=>{ setCoach("🔒 Résous d'abord le puzzle précédent de cette rubrique pour débloquer celui-ci."); };
        }
        listInner.appendChild(div);
      });
      return;
    }
    listHead.textContent = 'Puzzles';
    let lastPuzzleCategory = null;
    PUZZLES.forEach((p,i)=>{
      if(p.category !== lastPuzzleCategory){
        lastPuzzleCategory = p.category;
        const catDiv = document.createElement('div');
        catDiv.className = 'list-category';
        catDiv.textContent = PUZZLE_CATEGORY_LABELS[p.category] || p.category;
        listInner.appendChild(catDiv);
      }
      const unlocked = isPuzzleUnlocked(i);
      const div = document.createElement('div');
      div.className = 'list-item' + (i===puzzleIdx?' active':'') + (solvedPuzzles.has(i)?' done':'') + (unlocked?'':' locked');
      const suffix = solvedPuzzles.has(i) ? ' ✓' : (unlocked ? '' : ' 🔒');
      div.innerHTML = `<span class="num">${(i+1).toString().padStart(2,'0')}</span><span class="lbl">${p.title.replace(/^\S+ \d+ — /,'')}${suffix}</span>`;
      if(unlocked){
        div.onclick = ()=>{ puzzleIdx=i; loadPuzzle(i); };
      } else {
        div.onclick = ()=>{ setCoach("🔒 Résous d'abord le puzzle précédent de cette rubrique pour débloquer celui-ci."); };
      }
      listInner.appendChild(div);
    });
  } else if(mode==='online'){
    listHead.textContent = 'Partie en ligne';
    const cl = playerColor==='w' ? 'les Blancs' : 'les Noirs';
    listInner.innerHTML = `<div class="list-item active"><span class="lbl">Tu joues ${cl} contre ${escapeHtmlLocal(onlineOpponentName||'ton adversaire')}</span></div>`;
  } else {
    listHead.textContent = 'Partie';
    const cl = playerColor==='w' ? 'les Blancs' : 'les Noirs';
    const el = aiMode==='progressive' ? ('IA progressive, ~'+progressiveElo+' Elo') : (fixedElo+' Elo · '+eloTierLabel(fixedElo));
    listInner.innerHTML = `<div class="list-item active"><span class="lbl">Tu joues ${cl} · ${el}</span></div>`;
  }
}

/* ---------- Board rendering ---------- */
const SVGNS = 'http://www.w3.org/2000/svg';
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

function animatePieceMove(fromIdx, toIdx, piece, onDone){
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

let thinkingInterval = null;
function startThinkingIndicator(){
  const av = document.querySelector('.coach-avatar');
  if(av) av.classList.add('thinking');
  let dots=0;
  clearInterval(thinkingInterval);
  thinkingInterval = setInterval(()=>{
    dots = (dots+1)%4;
    setCoach("Le Coach réfléchit"+'.'.repeat(dots));
  }, 320);
}
function stopThinkingIndicator(){
  clearInterval(thinkingInterval); thinkingInterval=null;
  const av = document.querySelector('.coach-avatar');
  if(av) av.classList.remove('thinking');
}

function squareColorClass(idx){
  const f=fileOf(idx), r=rankOf(idx);
  return ((f+r)%2===0) ? 'dark' : 'light';
}

function render(){
  if(mode==='puzzles' && puzzleSubMode==='solitaire'){ renderSolitaire(); return; }
  if(!gameState) return;
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

      const teachSquare = (mode==='lessons') ? LESSONS[lessonIdx].focusSquare : null;
      if(teachSquare && sqName(idx)===teachSquare && !lessonGoalMet){
        cell.classList.add('teach');
      }

      const piece = gameState.board[idx];
      if(piece){
        const span = createPieceEl(piece);
        if(selected===idx) span.classList.add('selected');
        cell.appendChild(span);
      }

      // king in check highlight
      if(piece && piece.type==='K'){
        const st = inCheck(gameState, piece.color);
        if(st) cell.classList.add('kingdanger');
      }

      const mv = legalTargets.find(m=>m.to===idx);
      if(mv){
        if(gameState.board[idx] || mv.flags.enpassant){
          const ring = document.createElement('div'); ring.className='ring'; cell.appendChild(ring);
        } else {
          const dot = document.createElement('div'); dot.className='dot'; cell.appendChild(dot);
        }
      }

      cell.onclick = ()=>onSquareClick(idx);
      boardEl.appendChild(cell);
    }
  }

  // captured strip
  const capIcon = (type,colorClass)=>`<svg class="piece ${colorClass} cap-icon" viewBox="0 0 100 100"><use href="#pc-${type}"/></svg>`;
  capWEl.innerHTML = capturedByWhite.map(t=>capIcon(t,'black')).join('');
  capBEl.innerHTML = capturedByBlack.map(t=>capIcon(t,'white')).join('');

  // status
  const status = gameState.board.some(Boolean) ? gameStatus(gameState) : 'normal';
  turnLabel.textContent = gameState.turn==='w' ? 'Trait aux Blancs' : 'Trait aux Noirs';
  renderClocks();
  statusBadge.className = 'badge';
  if(status==='checkmate'){ statusBadge.textContent='échec et mat'; statusBadge.classList.add('mate'); }
  else if(status==='stalemate'){ statusBadge.textContent='pat'; }
  else if(status==='check'){ statusBadge.textContent='échec'; statusBadge.classList.add('check'); }
  else { statusBadge.textContent='en cours'; }
}

function renderSolitaire(){
  if(!solitaireBoard) return;
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
      if(solitaireSelected===idx) cell.classList.add('origin');

      if(file===files[0]){
        const c = document.createElement('span'); c.className='coord'; c.textContent = rank+1; cell.appendChild(c);
      }

      const piece = solitaireBoard[idx];
      if(piece){
        const span = createPieceEl(piece);
        if(solitaireSelected===idx) span.classList.add('selected');
        cell.appendChild(span);
      }

      const mv = solitaireLegalTargets.find(m=>m.to===idx);
      if(mv){
        const ring = document.createElement('div'); ring.className='ring'; cell.appendChild(ring);
      }

      cell.onclick = ()=>onSquareClick(idx);
      boardEl.appendChild(cell);
    }
  }

  capWEl.innerHTML = '';
  capBEl.innerHTML = '';

  const clocksRow = document.getElementById('clocksRow');
  if(clocksRow) clocksRow.style.display = 'none';

  const remaining = solitairePieceCount(solitaireBoard);
  turnLabel.textContent = 'Échecs en solo';
  statusBadge.className = 'badge';
  if(remaining===1){
    statusBadge.textContent = 'résolu';
    statusBadge.classList.add('mate');
  } else if(solitaireAllMoves(solitaireBoard).length===0){
    statusBadge.textContent = 'bloqué';
    statusBadge.classList.add('check');
  } else {
    statusBadge.textContent = remaining+' pièces restantes';
  }
}

/* ---------- Interaction ---------- */
function onSquareClick(idx){
  if(mode==='puzzles' && puzzleSubMode==='solitaire'){ solitaireOnSquareClick(idx); return; }
  if(awaitingPromotion) return;
  if((mode==='practice'||mode==='coach') && (gameState.turn!==playerColor || aiThinking)) return;
  if(mode==='online' && (gameState.turn!==playerColor || onlineFinished)) return;

  const piece = gameState.board[idx];

  // clicking a legal target
  const mv = legalTargets.find(m=>m.to===idx);
  if(selected!==null && mv){
    if(mode==='lessons'){
      const focus = LESSONS[lessonIdx].focus;
      const movingPiece = gameState.board[selected];
      if(focus && movingPiece.type!==focus){
        setCoach("Pour cette leçon, essaie de bouger le "+PIECE_NAMES[focus]+" en surbrillance dorée plutôt qu'une autre pièce.");
        return;
      }
    }
    doMove(mv);
    return;
  }

  // selecting own piece
  if(mode==='lessons'){
    const focus = LESSONS[lessonIdx].focus;
    if(piece){
      if(focus && piece.type!==focus){
        setCoach("Clique plutôt sur le "+PIECE_NAMES[focus]+" (case entourée en or) pour suivre la leçon.");
        selected=null; legalTargets=[]; render(); return;
      }
      selected = idx;
      legalTargets = legalMoves(gameState).filter(m=>m.from===idx);
      render();
      return;
    }
  } else {
    if(piece && piece.color===gameState.turn){
      selected = idx;
      legalTargets = legalMoves(gameState).filter(m=>m.from===idx);
      render();
      return;
    }
  }
  selected=null; legalTargets=[]; render();
}

function doMove(mv){
  if(mv.flags.promotion){
    awaitingPromotion = mv;
    showPromoPicker(gameState.board[mv.from].color);
    return;
  }
  finalizeMove(mv, 'Q');
}

function showPromoPicker(color){
  const opts = ['Q','R','B','N'];
  const colorClass = color==='w'?'white':'black';
  promoOverlay.innerHTML = `<div class="promo-overlay"><div class="promo-box">` +
    opts.map(o=>`<button data-p="${o}"><svg class="piece ${colorClass}" viewBox="0 0 100 100"><use href="#pc-${o}"/></svg></button>`).join('') +
    `</div></div>`;
  promoOverlay.querySelectorAll('button').forEach(b=>{
    b.onclick = ()=>{
      const mv = awaitingPromotion;
      awaitingPromotion = null;
      promoOverlay.innerHTML='';
      finalizeMove(mv, b.dataset.p);
    };
  });
}

function finalizeMove(mv, promo){
  if(mode==='practice'||mode==='coach'){
    historyStack.push({state:cloneState(gameState), capW:capturedByWhite.slice(), capB:capturedByBlack.slice(), last:lastMove, moveHistLen:moveHistory.length});
  }
  const capturedPiece = gameState.board[mv.to] || (mv.flags.enpassant ? {color: gameState.turn==='w'?'b':'w', type:'P'} : null);
  const moverColor = gameState.turn;
  const isCastle = mv.flags.castle;
  const preState = gameState;
  const moving = preState.board[mv.from];

  let moveQuality = null;
  if(mode==='coach' && moverColor===playerColor){
    moveQuality = classifyMove(preState, mv);
    coachStats[moveQuality] = (coachStats[moveQuality]||0)+1;
    updateQualityLegend();
  }

  selected=null; legalTargets=[];
  render(); // clear selection highlight/dots before the piece slides

  animatePieceMove(mv.from, mv.to, moving, ()=>{
    if(capturedPiece){
      if(capturedPiece.color==='b') capturedByWhite.push(capturedPiece.type);
      else capturedByBlack.push(capturedPiece.type);
    }
    gameState = applyMove(preState, mv, promo);
    lastMove = {from:mv.from, to:mv.to};
    applyClockForMove(moverColor);
    const moveStatus = gameStatus(gameState);
    if(mode==='practice'||mode==='coach'||mode==='online'){
      const st = moveStatus;
      let note = moveNotation(preState, mv, capturedPiece, promo);
      if(st==='checkmate') note+='#'; else if(st==='check') note+='+';
      if(moveQuality) note += ' ' + MOVE_QUALITY_TAG[moveQuality];
      moveHistory.push(createHistoryEntry(moverColor, note));
      rawMoveLog.push({from:mv.from, to:mv.to, promo:promo||'Q', color:moverColor});
      if(mode==='practice'||mode==='coach') pushLiveGameUpdate();
      renderMoves();
    }
    render();
    playMoveFeedback(moveStatus, capturedPiece);

    if(mode==='lessons'){ handleLessonMove(mv, moverColor, isCastle, capturedPiece); return; }
    if(mode==='puzzles'){ handlePuzzleMove(mv, moverColor); return; }
    if(mode==='practice'||mode==='coach'){ handlePracticeMove(moveQuality); return; }
    if(mode==='online'){ handleOnlineMove(moveStatus); return; }
  });
}

/* ---------- Lessons logic ---------- */
function loadLesson(i){
  if(!isLessonUnlocked(i)){
    i = 0;
    for(let k=LESSONS.length-1;k>=0;k--){ if(isLessonUnlocked(k)){ i=k; break; } }
    lessonIdx = i;
  }
  const L = LESSONS[i];
  gameState = initState(parseRows(L.rows), L.turn||'w', {wK:true,wQ:true,bK:true,bQ:true});
  selected=null; legalTargets=[]; lastMove=null; lessonGoalMet=false;
  capturedByWhite=[]; capturedByBlack=[]; awaitingPromotion=null; moveHistory=[];
  promoOverlay.innerHTML='';
  renderMoves();
  lessonTitle.textContent = L.title;
  lessonDesc.textContent = L.desc;
  setCoach(L.hint);
  renderControls();
  renderList();
  render();
}

function handleLessonMove(mv, moverColor, isCastle, capturedPiece){
  const L = LESSONS[lessonIdx];
  let met = false;
  if(L.goal.type==='any-move') met = true;
  else if(L.goal.type==='castle') met = !!isCastle;
  else if(L.goal.type==='escape-check') met = !inCheck(gameState, moverColor);
  else if(L.goal.type==='checkmate') met = gameStatus(gameState)==='checkmate';
  else if(L.goal.type==='move-to'){
    const targets = Array.isArray(L.goal.square) ? L.goal.square : [L.goal.square];
    const targetIdxs = targets.map(algToIdx);
    met = targetIdxs.includes(mv.to) && (!L.goal.requireCapture || !!capturedPiece);
  }

  if(met){
    lessonGoalMet = true;
    completedLessons.add(L.id);
    queueSaveProgress();
    setCoach("✅ "+L.success);
    renderControls();
    renderList();
  } else {
    setCoach("Pas encore ! "+L.hint);
  }
}

/* ---------- Puzzles logic ---------- */
function loadPuzzle(i){
  if(!isPuzzleUnlocked(i)){
    i = 0;
    for(let k=PUZZLES.length-1;k>=0;k--){ if(isPuzzleUnlocked(k)){ i=k; break; } }
    puzzleIdx = i;
  }
  const P = PUZZLES[i];
  gameState = initState(parseRows(P.rows), P.turn, {wK:false,wQ:false,bK:false,bQ:false});
  selected=null; legalTargets=[]; lastMove=null;
  capturedByWhite=[]; capturedByBlack=[]; awaitingPromotion=null; moveHistory=[];
  promoOverlay.innerHTML='';
  renderMoves();
  lessonTitle.textContent = P.title;
  lessonDesc.textContent = P.desc;
  setCoach("Réfléchis bien avant de jouer. Besoin d'un coup de pouce ? Clique sur « Indice ».");
  renderControls();
  renderList();
  render();
}

function handlePuzzleMove(mv, moverColor){
  const status = gameStatus(gameState);
  if(status==='checkmate'){
    solvedPuzzles.add(puzzleIdx);
    queueSaveProgress();
    setCoach("🏆 Échec et mat ! Puzzle résolu — bravo, ta lecture tactique est excellente.");
    playSound('win');
    renderList();
  } else {
    setCoach("Ce n'était pas la solution. " + PUZZLES[puzzleIdx].hint + " Clique sur « Réessayer » pour reprendre depuis le début.");
  }
  renderControls();
}

/* ---------- Practice vs AI ---------- */
function startPractice(){
  hidePracticeSetup();
  gameState = initState(initialBoard(),'w',{});
  selected=null; legalTargets=[]; lastMove=null;
  capturedByWhite=[]; capturedByBlack=[]; awaitingPromotion=null;
  aiThinking=false; moveHistory=[]; historyStack=[]; rawMoveLog=[];
  boardFlipped = (playerColor==='b');
  promoOverlay.innerHTML='';
  renderMoves();

  stopClockTimer();
  currentTimeControl = findTimeControlOption(selectedTimeControlId);
  if(currentTimeControl.perMove != null){
    clockActive = true;
    clocks = { w:currentTimeControl.perMove, b:currentTimeControl.perMove };
  } else if(currentTimeControl.base != null){
    clockActive = true;
    clocks = { w:currentTimeControl.base, b:currentTimeControl.base };
  } else {
    clockActive = false;
    clocks = { w:null, b:null };
  }
  renderClocks();

  const colorLabel = playerColor==='w' ? 'les Blancs' : 'les Noirs';
  const eloLabel = aiMode==='progressive'
    ? ('IA progressive (actuellement environ '+progressiveElo+' Elo).')
    : ('IA fixée à '+fixedElo+' Elo ('+eloTierLabel(fixedElo)+').');
  if(mode==='coach'){
    coachStats = {excellent:0, good:0, inaccuracy:0, mistake:0, blunder:0};
    lessonTitle.textContent = 'Mode Entraîneur';
    lessonDesc.textContent = 'Tu joues '+colorLabel+' — chaque coup est analysé. '+eloLabel;
    setCoach("À toi de jouer. J'analyse chacun de tes coups au fil de la partie.");
  } else {
    lessonTitle.textContent = 'Partie libre';
    lessonDesc.textContent = 'Tu joues '+colorLabel+' contre le Coach — '+eloLabel;
    setCoach("À toi de jouer. Déplace une pièce pour commencer.");
  }
  renderControls();
  renderList();
  render();
  updateQualityLegend();
  if(clockActive) startClockTimer();
  pushLiveGameUpdate();
  if(gameState.turn !== playerColor){
    setCoach("Tu joues les Noirs : le Coach ouvre la partie.");
    triggerAIMove();
  }
}

function showPracticeSetup(){
  stopClockTimer();
  clockActive = false;
  stopBroadcastingLiveGame();
  const legendEl = document.getElementById('qualityLegend');
  if(legendEl) legendEl.style.display = 'none';
  document.getElementById('practiceSetup').style.display = 'block';
  document.getElementById('mainLayout').style.display = 'none';
  const setupTitle = document.getElementById('setupTitle');
  const setupSub = document.getElementById('setupSub');
  if(mode==='coach'){
    setupTitle.textContent = "Configurer l'entraîneur";
    setupSub.textContent = "Chaque coup que tu joues sera évalué : meilleur, bon, imprécis, erreur ou gaffe.";
  } else {
    setupTitle.textContent = 'Configurer la partie';
    setupSub.textContent = 'Choisis le niveau du Coach et ta couleur avant de commencer.';
  }
  updateSetupUI();
}
function hidePracticeSetup(){
  document.getElementById('practiceSetup').style.display = 'none';
  document.getElementById('mainLayout').style.display = 'flex';
}
function updateSetupUI(){
  document.querySelectorAll('[data-aimode]').forEach(b=>b.classList.toggle('active', b.dataset.aimode===aiMode));
  document.querySelectorAll('[data-color]').forEach(b=>b.classList.toggle('active', b.dataset.color===chosenColor));
  document.getElementById('eloSliderWrap').style.display = aiMode==='fixed' ? '' : 'none';
  document.getElementById('progressiveHint').style.display = aiMode==='progressive' ? '' : 'none';
  document.getElementById('eloValue').textContent = fixedElo;
  document.getElementById('eloTier').textContent = eloTierLabel(fixedElo);
  document.getElementById('eloSlider').value = fixedElo;
  renderTimeControlPicker();
}

document.getElementById('practiceSetup').addEventListener('click', (e)=>{
  const modeBtn = e.target.closest('[data-aimode]');
  if(modeBtn){ aiMode = modeBtn.dataset.aimode; updateSetupUI(); return; }
  const colorBtn = e.target.closest('[data-color]');
  if(colorBtn){ chosenColor = colorBtn.dataset.color; updateSetupUI(); return; }
  const tcBtn = e.target.closest('[data-tc]');
  if(tcBtn){ selectedTimeControlId = tcBtn.dataset.tc; renderTimeControlPicker(); return; }
  if(e.target.id==='startPracticeBtn'){
    playerColor = chosenColor==='random' ? (Math.random()<0.5?'w':'b') : chosenColor;
    startPractice();
  }
});
document.getElementById('eloSlider').addEventListener('input', (e)=>{
  fixedElo = parseInt(e.target.value,10);
  document.getElementById('eloValue').textContent = fixedElo;
  document.getElementById('eloTier').textContent = eloTierLabel(fixedElo);
});

function handlePracticeMove(moveQuality){
  const status = gameStatus(gameState);
  if(status==='checkmate'){ onGameEnd(gameState.turn!==playerColor ? 'win' : 'loss'); return; }
  if(status==='stalemate'){ onGameEnd('draw'); return; }
  const qualityPrefix = moveQuality ? (MOVE_QUALITY_MSG[moveQuality]+' ') : '';
  if(status==='check'){ setCoach(qualityPrefix+"Échec !"); } else { setCoach(qualityPrefix+"Coup joué."); }
  triggerAIMove();
}

function aiThinkDelayMs(){
  if(!clockActive || !currentTimeControl){
    return 2500; // partie sans limite : délai fixe habituel
  }
  let base;
  if(currentTimeControl.perMove != null){
    base = 1200; // Quotidien : la vraie contrainte est le nombre de jours, pas la latence simulée
  } else {
    const b = currentTimeControl.base;
    if(b <= 120) base = 300;        // Bullet
    else if(b <= 300) base = 700;   // Blitz
    else if(b <= 900) base = 1400;  // Rapide courte (10-15 min)
    else base = 2200;               // Rapide longue (30 min)
  }
  const jittered = base * (0.65 + Math.random()*0.7); // variation pour un rendu plus humain
  const aiColor = playerColor==='w' ? 'b' : 'w';
  const remainingMs = clocks[aiColor]!=null ? clocks[aiColor]*1000 : null;
  if(remainingMs!=null){
    const cap = Math.max(120, remainingMs*0.25); // ne jamais consommer plus du quart du temps restant
    return Math.min(jittered, cap);
  }
  return jittered;
}

function triggerAIMove(){
  aiThinking = true;
  renderControls();
  startThinkingIndicator();
  const thinkDelay = aiThinkDelayMs();
  setTimeout(()=>{
    stopThinkingIndicator();
    historyStack.push({state:cloneState(gameState), capW:capturedByWhite.slice(), capB:capturedByBlack.slice(), last:lastMove, moveHistLen:moveHistory.length});
    const elo = currentAIElo();
    const mv = chooseAIMoveForElo(gameState, elo);
    if(!mv){ aiThinking=false; render(); renderControls(); return; }
    const capturedPiece = gameState.board[mv.to] || (mv.flags.enpassant ? {color: gameState.turn==='w'?'b':'w', type:'P'} : null);
    const preState = gameState;
    const moving = preState.board[mv.from];

    animatePieceMove(mv.from, mv.to, moving, ()=>{
      if(capturedPiece){
        if(capturedPiece.color==='b') capturedByWhite.push(capturedPiece.type);
        else capturedByBlack.push(capturedPiece.type);
      }
      gameState = applyMove(preState, mv, 'Q');
      lastMove = {from:mv.from, to:mv.to};
      applyClockForMove(preState.turn);
      aiThinking = false;
      const st2 = gameStatus(gameState);
      let note = moveNotation(preState, mv, capturedPiece, 'Q');
      if(st2==='checkmate') note+='#'; else if(st2==='check') note+='+';
      moveHistory.push(createHistoryEntry(preState.turn, note));
      rawMoveLog.push({from:mv.from, to:mv.to, promo:'Q', color:preState.turn});
      pushLiveGameUpdate();
      renderMoves();
      render();
      playMoveFeedback(st2, capturedPiece);
      if(st2==='checkmate'){ onGameEnd(gameState.turn!==playerColor ? 'win' : 'loss'); return; }
      else if(st2==='stalemate'){ onGameEnd('draw'); return; }
      else if(st2==='check'){ setCoach("Le Coach te met en échec ! Trouve comment protéger ton roi : le déplacer, bloquer, ou capturer l'attaquant."); }
      else { setCoach("Le Coach a joué "+note+". À toi !"); }
      renderControls();
    });
  }, thinkDelay);
}

function onGameEnd(result, reason){
  stopClockTimer();
  clockActive = false;
  stopBroadcastingLiveGame();
  playSound(result==='win' ? 'win' : result==='loss' ? 'loss' : 'draw');
  const aiEloAtGameTime = aiMode==='progressive' ? progressiveElo : fixedElo;
  const endLabel = reason==='timeout' ? 'Temps écoulé' : 'Échec et mat';
  if(result==='win'){
    if(aiMode==='progressive'){
      progressiveElo = Math.min(2000, progressiveElo+100);
      setCoach("🏆 "+endLabel+" — tu as gagné ! Le Coach passe à environ "+progressiveElo+" Elo pour la prochaine partie.");
    } else {
      setCoach("🏆 "+endLabel+" — tu as gagné ! Bravo, superbe partie.");
    }
  } else if(result==='loss'){
    if(aiMode==='progressive'){
      progressiveElo = Math.max(100, progressiveElo-100);
      setCoach("😅 "+endLabel+" — le Coach l'emporte. Il redescend à environ "+progressiveElo+" Elo pour la prochaine partie.");
    } else {
      setCoach("😅 "+endLabel+" — le Coach l'emporte cette fois. Relance une partie pour retenter ta chance !");
    }
  } else {
    setCoach("Pat : la partie est nulle, personne n'a de coup légal mais le roi n'est pas en échec.");
  }
  if(mode==='coach'){
    const s = coachStats;
    const total = s.excellent+s.good+s.inaccuracy+s.mistake+s.blunder;
    if(total>0){
      const summary = `<br><br><strong>📊 Bilan de la partie (${total} coups analysés) :</strong><br>`+
        `⭐ Excellents : ${s.excellent} &nbsp; 👍 Bons : ${s.good} &nbsp; 😐 Imprécisions : ${s.inaccuracy} &nbsp; 😬 Erreurs : ${s.mistake} &nbsp; 💥 Gaffes : ${s.blunder}`;
      coachText.innerHTML += summary;
    }
  }
  if(result==='win') winsCount++;
  else if(result==='loss') lossesCount++;
  else drawsCount++;
  if(window.ChessSocial && window.ChessAuth && window.ChessAuth.getUser() && (mode==='practice'||mode==='coach')){
    const historyEntry = createGameSaveRecord({
      mode, result, aiElo: aiEloAtGameTime, moves: rawMoveLog.slice(), playerColor,
      coachStats: mode==='coach' ? coachStats : undefined
    });
    window.ChessSocial.saveGameHistory(historyEntry);
  }
  queueSaveProgress();
  renderControls();
}

function renderMoves(){
  const panel = document.getElementById('movesPanel');
  if(!panel) return;
  let html='';
  for(let i=0;i<moveHistory.length;i+=2){
    const num = i/2+1;
    const w = moveHistory[i] ? moveHistory[i].note : '';
    const b = moveHistory[i+1] ? moveHistory[i+1].note : '';
    html += `<span class="mv-pair"><b>${num}.</b> ${w} ${b}</span>`;
  }
  panel.innerHTML = html;
  panel.scrollTop = panel.scrollHeight;
}

function restoreSnap(snap){
  gameState = snap.state;
  capturedByWhite = snap.capW;
  capturedByBlack = snap.capB;
  lastMove = snap.last;
  moveHistory = moveHistory.slice(0, snap.moveHistLen);
  selected=null; legalTargets=[]; awaitingPromotion=null; aiThinking=false;
  promoOverlay.innerHTML='';
  renderMoves();
  render();
}

function undoMove(){
  if(historyStack.length===0) return;
  let snap = historyStack.pop();
  if(historyStack.length>0){ snap = historyStack.pop(); }
  restoreSnap(snap);
  setCoach("Coup annulé. À toi de rejouer.");
  renderControls();
}

/* ---------- Controls ---------- */
function renderControls(){
  controlsEl.innerHTML='';
  if(mode==='lessons'){
    const L = LESSONS[lessonIdx];
    const prev = document.createElement('button'); prev.className='btn'; prev.textContent='← Précédent';
    prev.disabled = lessonIdx===0;
    prev.onclick=()=>{ lessonIdx--; loadLesson(lessonIdx); };
    const reset = document.createElement('button'); reset.className='btn'; reset.textContent='Recommencer';
    reset.onclick=()=>loadLesson(lessonIdx);
    const next = document.createElement('button'); next.className='btn primary'; next.textContent = lessonIdx===LESSONS.length-1 ? 'Terminer' : 'Leçon suivante →';
    next.disabled = !lessonGoalMet;
    next.onclick=()=>{ if(lessonIdx<LESSONS.length-1){ lessonIdx++; loadLesson(lessonIdx);} else { setCoach("🎉 Tu as terminé toutes les leçons ! File en Partie libre pour mettre tout ça en pratique."); } };
    controlsEl.append(prev, reset, next);
  } else if(mode==='puzzles'){
    if(puzzleSubMode==='solitaire'){
      const hint = document.createElement('button'); hint.className='btn'; hint.textContent='💡 Indice';
      hint.onclick=()=>setCoach("Indice : "+SOLITAIRE_PUZZLES[solitaireIdx].hint);
      const retry = document.createElement('button'); retry.className='btn'; retry.textContent='Recommencer';
      retry.onclick=()=>loadSolitaire(solitaireIdx);
      const next = document.createElement('button'); next.className='btn primary'; next.textContent='Puzzle suivant →';
      next.disabled = solitaireIdx===SOLITAIRE_PUZZLES.length-1 || !isSolitaireUnlocked(solitaireIdx+1);
      next.onclick=()=>{ loadSolitaire(solitaireIdx+1); };
      controlsEl.append(hint, retry, next);
      return;
    }
    const hint = document.createElement('button'); hint.className='btn'; hint.textContent='💡 Indice';
    hint.onclick=()=>setCoach("Indice : "+PUZZLES[puzzleIdx].hint);
    const retry = document.createElement('button'); retry.className='btn'; retry.textContent='Réessayer';
    retry.onclick=()=>loadPuzzle(puzzleIdx);
    const next = document.createElement('button'); next.className='btn primary'; next.textContent='Puzzle suivant →';
    next.disabled = puzzleIdx===PUZZLES.length-1 || !isPuzzleUnlocked(puzzleIdx+1);
    next.onclick=()=>{ puzzleIdx++; loadPuzzle(puzzleIdx); };
    controlsEl.append(hint, retry, next);
  } else if(mode==='online'){
    const flipBtn = document.createElement('button'); flipBtn.className='btn'; flipBtn.textContent='🔄 Retourner';
    flipBtn.onclick=()=>{ boardFlipped=!boardFlipped; render(); };
    const resignBtn = document.createElement('button'); resignBtn.className='btn danger'; resignBtn.textContent='🏳️ Abandonner';
    resignBtn.disabled = onlineFinished;
    resignBtn.onclick=()=>{
      if(confirm("Abandonner la partie ? Ton adversaire sera déclaré vainqueur.")) resignOnlineGame();
    };
    const leaveBtn = document.createElement('button'); leaveBtn.className='btn'; leaveBtn.textContent='← Quitter';
    leaveBtn.onclick=()=>goToMode('playmenu');
    controlsEl.append(flipBtn, resignBtn, leaveBtn);
  } else {
    const restart = document.createElement('button'); restart.className='btn primary'; restart.textContent='Nouvelle partie';
    restart.onclick=()=>showPracticeSetup();
    const hint = document.createElement('button'); hint.className='btn'; hint.textContent='💡 Indice';
    hint.disabled = gameState.turn!==playerColor || aiThinking;
    hint.onclick=()=>{
      const moves = legalMoves(gameState, playerColor);
      if(moves.length===0){ setCoach("Aucun coup légal disponible."); return; }
      let best=null,bs=-Infinity;
      for(const m of moves){ const s=evalMove(gameState,m); if(s>bs){bs=s;best=m;} }
      setCoach("Coup suggéré : " + sqName(best.from) + " → " + sqName(best.to) + ".");
    };
    const undoBtn = document.createElement('button'); undoBtn.className='btn'; undoBtn.textContent='↩ Annuler';
    undoBtn.disabled = historyStack.length===0 || aiThinking;
    undoBtn.onclick=()=>undoMove();
    const flipBtn = document.createElement('button'); flipBtn.className='btn'; flipBtn.textContent='🔄 Retourner';
    flipBtn.onclick=()=>{ boardFlipped=!boardFlipped; render(); };
    controlsEl.append(restart, hint, undoBtn, flipBtn);
  }
}

/* ============================================================
   JOUER EN LIGNE (Ami via lien + Matchmaking aléatoire)
   ============================================================ */
let onlineGameId = null;
let onlineRole = null;
let onlineOpponentName = null;
let onlineFinished = false;
let onlineHistorySaved = false;
let onlineBoardInitialized = false;
let onlineMoveCount = 0;
let onlineClockBase = { w:null, b:null, at:null };
let onlineTimeControl = null;
let onlineClockTimerId = null;
let onlinePollTimer = null;
let onlineSelectedTC = '5min';
let onlineSelectedColor = 'w';
let pendingJoinGameId = null;
let resumableOnlineGame = null;

function checkPendingJoinParam(){
  const params = new URLSearchParams(location.search);
  const joinId = params.get('join');
  if(joinId) pendingJoinGameId = joinId;
}

async function maybeShowJoinPrompt(){
  if(!pendingJoinGameId) return;
  const user = window.ChessAuth && window.ChessAuth.getUser();
  if(!user){
    const btn = document.getElementById('authOpenBtn');
    if(btn) btn.click();
    return;
  }
  if(!window.ChessOnline) return;
  const game = await window.ChessOnline.getGame(pendingJoinGameId);
  if(!game){
    alert("Ce lien de partie n'est plus valide.");
    pendingJoinGameId = null;
    return;
  }
  if(game.white_id===user.id || game.black_id===user.id){
    pendingJoinGameId = null;
    if(game.status==='active'){ startOnlineGame(game); return; }
    goToMode('friend-setup');
    renderFriendWaiting(game);
    return;
  }
  if(game.status!=='waiting'){
    alert("Cette partie a déjà commencé ou est terminée.");
    pendingJoinGameId = null;
    return;
  }
  renderJoinPrompt(game);
}

function renderJoinPrompt(game){
  hideAllViews();
  document.getElementById('onlineView').style.display = 'block';
  setFooterActive('');
  document.getElementById('onlineViewTitle').textContent = 'Invitation à jouer';
  const hostName = game.white_username || game.black_username || 'Un joueur';
  const tcLabel = game.time_control_base ? (formatClockTime(game.time_control_base) + (game.time_control_inc ? ' + '+game.time_control_inc : '')) : 'Illimité';
  document.getElementById('onlineViewContent').innerHTML =
    '<div class="stat-card">'+
      '<p style="text-align:center; font-size:0.95rem;"><strong>'+escapeHtmlLocal(hostName)+'</strong> t\'invite à jouer aux échecs !</p>'+
      '<p style="text-align:center; color:var(--text-muted); font-size:0.84rem;">Cadence : '+tcLabel+'</p>'+
      '<button class="btn primary" id="onlineJoinAcceptBtn" style="width:100%; margin-top:14px;">Rejoindre la partie</button>'+
      '<button class="btn subtle" id="onlineJoinDeclineBtn" style="width:100%; margin-top:8px;">Non merci</button>'+
    '</div>';
  window._pendingJoinGame = game;
}
async function acceptJoinFlow(){
  const game = window._pendingJoinGame;
  if(!game) return;
  const btn = document.getElementById('onlineJoinAcceptBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'Connexion…'; }
  const ok = await window.ChessOnline.joinFriendGame(game.id);
  if(!ok){
    alert("Impossible de rejoindre cette partie (elle a peut-être déjà commencé).");
    goToMode('playmenu');
    return;
  }
  const fresh = await window.ChessOnline.getGame(game.id);
  if(!fresh){ goToMode('playmenu'); return; }
  startOnlineGame(fresh);
}

/* ---------- Sélecteur de cadence (réutilisé pour Ami + Aléatoire) ---------- */
function onlineTimeControlButtonsHtml(selectedId){
  return TIME_CONTROLS.filter(cat=>cat.cat!=='daily').map(cat=>{
    const buttons = cat.options.map(opt=>
      '<div class="choice-btn tc-btn'+(opt.id===selectedId?' active':'')+'" data-online-tc="'+opt.id+'">'+opt.label+'</div>'
    ).join('');
    return '<div class="tc-category"><span class="tc-icon">'+cat.icon+'</span><span class="tc-cat-label">'+cat.label+'</span></div><div class="choice-row tc-row">'+buttons+'</div>';
  }).join('');
}

/* ---------- Contre un ami ---------- */
function renderFriendSetup(){
  document.getElementById('onlineViewTitle').textContent = 'Contre un ami';
  document.getElementById('onlineViewContent').innerHTML =
    '<div class="stat-card">'+
      '<div class="stat-head">Ta couleur</div>'+
      '<div class="choice-row">'+
        '<div class="choice-btn'+(onlineSelectedColor==='w'?' active':'')+'" data-online-color="w">Blancs</div>'+
        '<div class="choice-btn'+(onlineSelectedColor==='b'?' active':'')+'" data-online-color="b">Noirs</div>'+
      '</div>'+
      '<div class="stat-head" style="margin-top:16px;">Contrôle du temps</div>'+
      onlineTimeControlButtonsHtml(onlineSelectedTC)+
      '<button class="btn primary" id="onlineFriendCreateBtn" style="width:100%; margin-top:14px;">Créer le lien</button>'+
    '</div>';
  checkResumableGame();
}
async function createFriendGameFlow(){
  if(!window.ChessOnline) return;
  const opt = findTimeControlOption(onlineSelectedTC);
  const btn = document.getElementById('onlineFriendCreateBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'Création…'; }
  const game = await window.ChessOnline.createFriendGame({ color:onlineSelectedColor, base:opt.base, inc:opt.inc });
  if(!game){
    alert("Erreur lors de la création de la partie. Réessaie.");
    if(btn){ btn.disabled=false; btn.textContent='Créer le lien'; }
    return;
  }
  renderFriendWaiting(game);
}
function renderFriendWaiting(game){
  document.getElementById('onlineViewTitle').textContent = 'En attente de ton ami';
  const url = location.origin + location.pathname + '?join=' + game.id;
  document.getElementById('onlineViewContent').innerHTML =
    '<div class="stat-card">'+
      '<p style="text-align:center; color:var(--text-muted); font-size:0.88rem;">Envoie ce lien à la personne avec qui tu veux jouer :</p>'+
      '<div class="online-share-row"><input type="text" readonly id="onlineFriendLinkInput" value="'+url.replace(/"/g,'&quot;')+'"><button class="btn" id="onlineFriendCopyBtn">Copier</button></div>'+
      '<div class="online-status-row"><span class="online-spinner"></span> En attente qu\'il ou elle rejoigne…</div>'+
      '<button class="btn subtle" id="onlineFriendCancelBtn" style="width:100%;">Annuler</button>'+
    '</div>';
  window._onlineWaitingGameId = game.id;
  window.ChessOnline.subscribe(game.id, (newRow)=>{
    if(newRow.status==='active' && newRow.white_id && newRow.black_id){
      window.ChessOnline.unsubscribe();
      startOnlineGame(newRow);
    }
  });
}
function copyFriendLink(){
  const input = document.getElementById('onlineFriendLinkInput');
  if(!input) return;
  input.select();
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(input.value).catch(()=>{ try{ document.execCommand('copy'); }catch(e){} });
  } else {
    try{ document.execCommand('copy'); }catch(e){}
  }
  const btn = document.getElementById('onlineFriendCopyBtn');
  if(btn){ const old = btn.textContent; btn.textContent = 'Copié !'; setTimeout(()=>{ btn.textContent = old; }, 1500); }
}
async function cancelFriendGameFlow(){
  if(window._onlineWaitingGameId && window.ChessOnline){
    await window.ChessOnline.cancelFriendGame(window._onlineWaitingGameId);
    window._onlineWaitingGameId = null;
  }
  if(window.ChessOnline) window.ChessOnline.unsubscribe();
  goToMode('playmenu');
}

/* ---------- Contre un joueur (matchmaking aléatoire) ---------- */
function renderRandomSetup(){
  document.getElementById('onlineViewTitle').textContent = 'Contre un joueur';
  document.getElementById('onlineViewContent').innerHTML =
    '<div class="stat-card">'+
      '<div class="stat-head">Contrôle du temps</div>'+
      onlineTimeControlButtonsHtml(onlineSelectedTC)+
      '<button class="btn primary" id="onlineRandomStartBtn" style="width:100%; margin-top:14px;">Chercher un adversaire</button>'+
      '<div class="online-note">Tu seras apparié avec un autre joueur qui cherche la même cadence.</div>'+
    '</div>';
  checkResumableGame();
}
async function startMatchmakingFlow(){
  if(!window.ChessOnline) return;
  const opt = findTimeControlOption(onlineSelectedTC);
  const btn = document.getElementById('onlineRandomStartBtn');
  if(btn) btn.disabled = true;
  const ok = await window.ChessOnline.enterQueue({ elo: progressiveElo, base:opt.base, inc:opt.inc });
  if(!ok){
    alert("Erreur pour rejoindre le salon. Réessaie.");
    if(btn) btn.disabled = false;
    return;
  }
  mode = 'random-searching';
  renderRandomSearching();
  pollMatchmaking();
}
function renderRandomSearching(){
  document.getElementById('onlineViewTitle').textContent = 'Recherche en cours…';
  document.getElementById('onlineViewContent').innerHTML =
    '<div class="stat-card">'+
      '<div class="online-status-row"><span class="online-spinner"></span> Recherche d\'un adversaire…</div>'+
      '<button class="btn subtle" id="onlineRandomCancelBtn" style="width:100%;">Annuler</button>'+
    '</div>';
}
function stopMatchmakingPolling(){
  clearTimeout(onlinePollTimer);
  onlinePollTimer = null;
  if(window.ChessOnline) window.ChessOnline.leaveQueue();
}
function cancelMatchmakingFlow(){
  stopMatchmakingPolling();
  goToMode('random-setup');
}
async function pollMatchmaking(){
  if(mode!=='random-searching' || !window.ChessOnline) return;
  const gameId = await window.ChessOnline.tryMatch();
  if(gameId){
    clearTimeout(onlinePollTimer);
    const game = await window.ChessOnline.getGame(gameId);
    if(game) startOnlineGame(game);
    return;
  }
  // Si un autre joueur nous a apparié entre-temps (c'est lui qui a réussi l'appariement,
  // pas nous), on le découvre ici plutôt que via la valeur de retour de tryMatch().
  const existing = await window.ChessOnline.findMyActiveGame();
  if(existing){
    clearTimeout(onlinePollTimer);
    startOnlineGame(existing);
    return;
  }
  onlinePollTimer = setTimeout(pollMatchmaking, 2000);
}

/* ---------- Reprendre une partie en cours ---------- */
function checkResumableGame(){
  resumableOnlineGame = null;
  if(!window.ChessOnline) return;
  window.ChessOnline.findMyActiveGame().then(g=>{
    if(g && (mode==='friend-setup'||mode==='random-setup')){
      resumableOnlineGame = g;
      const user = window.ChessAuth.getUser();
      const oppName = (g.white_id===user.id ? g.black_username : g.white_username) || 'ton adversaire';
      const banner = document.createElement('div');
      banner.className = 'stat-card';
      banner.innerHTML = '<p style="text-align:center;">Tu as déjà une partie en cours contre <strong>'+escapeHtmlLocal(oppName)+'</strong>.</p>'+
        '<button class="btn primary" id="onlineResumeBtn" style="width:100%; margin-top:10px;">Reprendre la partie</button>';
      document.getElementById('onlineViewContent').prepend(banner);
    }
  });
}

/* ---------- Déroulement de la partie en ligne ---------- */
async function startOnlineGame(game){
  if(window.ChessOnline) window.ChessOnline.unsubscribe();
  stopMatchmakingPolling();
  hideAllViews();
  document.getElementById('mainLayout').style.display = 'flex';
  setFooterActive('playmenu');
  mode = 'online';
  const user = window.ChessAuth.getUser();
  onlineGameId = game.id;
  onlineRole = (game.white_id===user.id) ? 'w' : 'b';
  playerColor = onlineRole;
  onlineOpponentName = onlineRole==='w' ? game.black_username : game.white_username;
  onlineFinished = false;
  onlineHistorySaved = false;
  onlineTimeControl = { base: game.time_control_base, inc: game.time_control_inc||0 };
  boardFlipped = (playerColor==='b');
  selected=null; legalTargets=[]; lastMove=null;
  capturedByWhite=[]; capturedByBlack=[]; awaitingPromotion=null;
  moveHistory=[]; historyStack=[]; rawMoveLog=[];
  promoOverlay.innerHTML = '';
  renderMoves();

  clockActive = (onlineTimeControl.base!=null);
  onlineBoardInitialized = !!game.board;

  if(game.board){
    gameState = { board: game.board, turn: game.turn, castling:{wK:true,wQ:true,bK:true,bQ:true}, ep:-1 };
    onlineMoveCount = game.move_count || 0;
    lastMove = (game.last_from!=null && game.last_to!=null) ? { from:game.last_from, to:game.last_to } : null;
    if(clockActive){
      onlineClockBase = { w:game.white_time_ms, b:game.black_time_ms, at: game.last_move_at ? new Date(game.last_move_at).getTime() : Date.now() };
    }
  } else if(onlineRole==='w'){
    gameState = initState(initialBoard(), 'w', {});
    onlineMoveCount = 0;
    onlineBoardInitialized = true;
    if(clockActive){
      onlineClockBase = { w:onlineTimeControl.base*1000, b:onlineTimeControl.base*1000, at:Date.now() };
    }
    pushOnlineInitialBoard();
  } else {
    gameState = initState(initialBoard(), 'w', {}); // provisoire, en attente du plateau initial des Blancs
    onlineMoveCount = 0;
  }

  if(clockActive){
    const cur = currentOnlineClocks();
    clocks = { w:cur.w, b:cur.b };
  } else {
    clocks = { w:null, b:null };
  }
  renderClocks();

  const colorLabel = playerColor==='w' ? 'les Blancs' : 'les Noirs';
  lessonTitle.textContent = 'Partie en ligne';
  lessonDesc.textContent = 'Tu joues '+colorLabel+' contre '+escapeHtmlLocal(onlineOpponentName||'ton adversaire')+'.';
  setCoach(onlineBoardInitialized ? (gameState.turn===playerColor ? "À toi de jouer !" : "En attente du coup adverse…") : "Initialisation de la partie…");
  renderControls();
  renderList();
  render();
  if(clockActive && onlineBoardInitialized) startOnlineClockLoop();

  window.ChessOnline.subscribe(onlineGameId, onOnlineGameUpdate);
}

async function pushOnlineInitialBoard(){
  if(!window.ChessOnline || !onlineGameId) return;
  const patch = { board: gameState.board, turn: gameState.turn, move_count: 0, last_move_at: new Date().toISOString() };
  await window.ChessOnline.updateGame(onlineGameId, patch);
}

function currentOnlineClocks(){
  if(!clockActive || !onlineClockBase.at) return { w:null, b:null };
  const turn = gameState ? gameState.turn : 'w';
  const elapsed = Date.now() - onlineClockBase.at;
  const w = turn==='w' ? Math.max(0, onlineClockBase.w - elapsed) : onlineClockBase.w;
  const b = turn==='b' ? Math.max(0, onlineClockBase.b - elapsed) : onlineClockBase.b;
  return { w:w/1000, b:b/1000 };
}
function startOnlineClockLoop(){
  stopOnlineClockLoop();
  onlineClockTimerId = setInterval(()=>{
    if(!clockActive || onlineFinished || !gameState) return;
    const cur = currentOnlineClocks();
    clocks.w = cur.w; clocks.b = cur.b;
    renderClocks();
    const turn = gameState.turn;
    if(clocks[turn]!=null && clocks[turn]<=0){
      onlineFinished = true;
      stopOnlineClockLoop();
      const result = turn==='w' ? 'black' : 'white';
      window.ChessOnline.updateGame(onlineGameId, { status:'finished', result, result_reason:'timeout' });
      finishOnlineUI(result, 'timeout');
    }
  }, 250);
}
function stopOnlineClockLoop(){
  if(onlineClockTimerId){ clearInterval(onlineClockTimerId); onlineClockTimerId = null; }
}

function handleOnlineMove(moveStatus){
  if(!onlineGameId || !window.ChessOnline) return;
  onlineMoveCount++;
  const moverColor = onlineRole;
  const lastRaw = rawMoveLog[rawMoveLog.length-1];
  const patch = {
    board: gameState.board,
    turn: gameState.turn,
    last_from: lastRaw.from,
    last_to: lastRaw.to,
    last_promo: lastRaw.promo,
    move_count: onlineMoveCount,
    last_move_at: new Date().toISOString()
  };
  if(clockActive){
    const cur = currentOnlineClocks();
    const mine = cur[moverColor]*1000 + (onlineTimeControl.inc||0)*1000;
    onlineClockBase.w = moverColor==='w' ? mine : cur.w*1000;
    onlineClockBase.b = moverColor==='b' ? mine : cur.b*1000;
    onlineClockBase.at = Date.now();
    clocks.w = onlineClockBase.w/1000; clocks.b = onlineClockBase.b/1000;
    patch.white_time_ms = Math.round(onlineClockBase.w);
    patch.black_time_ms = Math.round(onlineClockBase.b);
  }
  let result = null, reason = null;
  if(moveStatus==='checkmate'){ result = moverColor==='w' ? 'white' : 'black'; reason = 'checkmate'; }
  else if(moveStatus==='stalemate'){ result = 'draw'; reason = 'stalemate'; }
  if(result){ patch.status = 'finished'; patch.result = result; patch.result_reason = reason; }

  window.ChessOnline.updateGame(onlineGameId, patch);

  if(result){
    onlineFinished = true;
    stopOnlineClockLoop();
    finishOnlineUI(result, reason);
  }
}

function applyRemoteOnlineMove(newRow){
  const moves = legalMoves(gameState);
  const mv = moves.find(m=>m.from===newRow.last_from && m.to===newRow.last_to);
  const preState = gameState;
  let capturedPiece = null;
  if(mv){
    capturedPiece = preState.board[mv.to] || (mv.flags.enpassant ? {color: preState.turn==='w'?'b':'w', type:'P'} : null);
    gameState = applyMove(preState, mv, newRow.last_promo||'Q');
  } else {
    // désynchronisation : on fait confiance au plateau transmis par le serveur
    gameState = { board:newRow.board, turn:newRow.turn, castling:{wK:true,wQ:true,bK:true,bQ:true}, ep:-1 };
  }
  lastMove = { from:newRow.last_from, to:newRow.last_to };
  const status = gameStatus(gameState);
  let note = mv ? moveNotation(preState, mv, capturedPiece, newRow.last_promo||'Q') : (sqName(newRow.last_from)+'-'+sqName(newRow.last_to));
  if(status==='checkmate') note+='#'; else if(status==='check') note+='+';
  moveHistory.push(createHistoryEntry(onlineRole==='w'?'b':'w', note));
  rawMoveLog.push({ from:newRow.last_from, to:newRow.last_to, promo:newRow.last_promo||'Q', color:onlineRole==='w'?'b':'w' });
  renderMoves();

  if(clockActive && newRow.white_time_ms!=null){
    onlineClockBase = { w:newRow.white_time_ms, b:newRow.black_time_ms, at:new Date(newRow.last_move_at).getTime() };
    const cur = currentOnlineClocks();
    clocks.w = cur.w; clocks.b = cur.b;
  }

  render();
  playMoveFeedback(status, capturedPiece);
  if(!onlineFinished){
    setCoach(gameState.turn===playerColor ? "À toi de jouer !" : "En attente du coup adverse…");
  }
  renderControls();
}

function onOnlineGameUpdate(newRow){
  if(!onlineBoardInitialized){
    if(newRow.board){
      onlineBoardInitialized = true;
      gameState = { board:newRow.board, turn:newRow.turn, castling:{wK:true,wQ:true,bK:true,bQ:true}, ep:-1 };
      onlineMoveCount = newRow.move_count || 0;
      lastMove = (newRow.last_from!=null) ? { from:newRow.last_from, to:newRow.last_to } : null;
      if(clockActive && newRow.white_time_ms!=null){
        onlineClockBase = { w:newRow.white_time_ms, b:newRow.black_time_ms, at:new Date(newRow.last_move_at).getTime() };
        const cur = currentOnlineClocks();
        clocks.w = cur.w; clocks.b = cur.b;
      }
      setCoach(gameState.turn===playerColor ? "À toi de jouer !" : "En attente du coup adverse…");
      renderControls(); renderList(); render();
      if(clockActive) startOnlineClockLoop();
    }
    return;
  }
  if(newRow.move_count > onlineMoveCount){
    onlineMoveCount = newRow.move_count;
    applyRemoteOnlineMove(newRow);
  }
  if(newRow.status==='finished' && !onlineFinished){
    onlineFinished = true;
    stopOnlineClockLoop();
    finishOnlineUI(newRow.result, newRow.result_reason);
  }
}

async function resignOnlineGame(){
  if(!onlineGameId || onlineFinished || !window.ChessOnline) return;
  const result = onlineRole==='w' ? 'black' : 'white';
  onlineFinished = true;
  stopOnlineClockLoop();
  await window.ChessOnline.updateGame(onlineGameId, { status:'finished', result, result_reason:'resign' });
  finishOnlineUI(result, 'resign');
}

function finishOnlineUI(result, reason){
  if(onlineHistorySaved) return;
  onlineHistorySaved = true;
  const draw = result==='draw';
  const iWon = !draw && ((result==='white' && onlineRole==='w') || (result==='black' && onlineRole==='b'));
  const reasonLabel = {checkmate:'échec et mat', timeout:'temps écoulé', resign:'abandon', stalemate:'pat'}[reason] || reason;
  if(draw) setCoach("🤝 Partie nulle ("+reasonLabel+").");
  else if(iWon) setCoach("🏆 Tu as gagné ! ("+reasonLabel+")");
  else setCoach("😔 Tu as perdu. ("+reasonLabel+")");
  playSound(draw ? 'draw' : (iWon ? 'win' : 'loss'));
  if(draw) drawsCount++; else if(iWon) winsCount++; else lossesCount++;
  queueSaveProgress();
  if(window.ChessSocial && window.ChessAuth && window.ChessAuth.getUser()){
    window.ChessSocial.saveGameHistory({
      mode:'online',
      result: draw ? 'draw' : (iWon ? 'win' : 'loss'),
      ai_elo: null,
      moves: rawMoveLog.slice(),
      player_color: playerColor
    });
  }
  renderControls();
}

/* ---------- Délégation de clics pour l'écran "Jouer en ligne" ---------- */
document.getElementById('onlineViewContent').addEventListener('click', (e)=>{
  const tcBtn = e.target.closest('[data-online-tc]');
  if(tcBtn){
    onlineSelectedTC = tcBtn.dataset.onlineTc;
    if(mode==='friend-setup') renderFriendSetup(); else if(mode==='random-setup') renderRandomSetup();
    return;
  }
  const colorBtn = e.target.closest('[data-online-color]');
  if(colorBtn){ onlineSelectedColor = colorBtn.dataset.onlineColor; renderFriendSetup(); return; }

  if(e.target.id==='onlineFriendCreateBtn'){ createFriendGameFlow(); return; }
  if(e.target.id==='onlineFriendCancelBtn'){ cancelFriendGameFlow(); return; }
  if(e.target.id==='onlineFriendCopyBtn'){ copyFriendLink(); return; }
  if(e.target.id==='onlineJoinAcceptBtn'){ acceptJoinFlow(); return; }
  if(e.target.id==='onlineJoinDeclineBtn'){ window._pendingJoinGame=null; goToMode('playmenu'); return; }
  if(e.target.id==='onlineRandomStartBtn'){ startMatchmakingFlow(); return; }
  if(e.target.id==='onlineRandomCancelBtn'){ cancelMatchmakingFlow(); return; }
  if(e.target.id==='onlineResumeBtn'){ if(resumableOnlineGame) startOnlineGame(resumableOnlineGame); return; }
});

/* ---------- Init ---------- */
window.addEventListener('resize', ()=>render());
window.addEventListener('pagehide', ()=>{ stopBroadcastingLiveGame(); });
const homeCrestBtn = document.getElementById('homeCrestBtn');
if(homeCrestBtn) homeCrestBtn.addEventListener('click', ()=>goToMode('home'));
checkPendingJoinParam();
showHome();
