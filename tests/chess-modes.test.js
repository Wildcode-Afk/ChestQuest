const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadModesEngine(extraGlobalsScript){
  const files = ['chess-core.js','chess-modes.js','chess-mode-solitaire.js'];
  const source = files.map(f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');
  const context = { console };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  if(extraGlobalsScript) vm.runInContext(extraGlobalsScript, context);
  return context;
}

/* ---------- chess-modes.js : interface commune ---------- */
test('registerMode fills in no-op defaults for methods that are not provided', () => {
  const engine = loadModesEngine();
  vm.runInContext("registerMode('empty', {});", engine);
  const mode = vm.runInContext("ChessModes.empty", engine);
  assert.equal(typeof mode.start, 'function');
  assert.equal(typeof mode.stop, 'function');
  assert.equal(typeof mode.restore, 'function');
  assert.equal(typeof mode.receiveMove, 'function');
  assert.doesNotThrow(() => vm.runInContext("ChessModes.empty.start(); ChessModes.empty.stop(); ChessModes.empty.restore(); ChessModes.empty.receiveMove();", engine));
});

test('the solitaire mode is registered with all 4 methods of the common interface', () => {
  const engine = loadModesEngine();
  const mode = vm.runInContext("ChessModes.solitaire", engine);
  assert.equal(typeof mode.start, 'function');
  assert.equal(typeof mode.stop, 'function');
  assert.equal(typeof mode.restore, 'function');
  assert.equal(typeof mode.receiveMove, 'function');
});

/* ---------- chess-mode-solitaire.js : génération de coups (pure) ---------- */
test('solitaireMovesFrom only finds capture moves, never moves onto empty squares', () => {
  const engine = loadModesEngine();
  const { sq, parseRows, solitaireMovesFrom } = engine;
  const board = parseRows([
    '. . . . . . . .', '. . . . . R . R', '. . . . . . . .', '. . . . . R . .',
    '. . . . . . . .', '. . . . . . . .', '. . . . . . . .', '. . . . . . . .'
  ]);
  const fromA = solitaireMovesFrom(board, sq(5,6));
  assert.equal(fromA.length, 2); // capture B (same rank) et C (same file)
  assert.ok(fromA.every(m => board[m.to] !== null));
});

test('solitaireMovesFrom respects each piece\'s normal movement pattern (knight, king, pawn)', () => {
  const engine = loadModesEngine();
  const { sq, parseRows, solitaireMovesFrom } = engine;
  const board = parseRows([
    '. . . . . . . .', '. . . . . . . .', '. . . N . . . .', '. . . . . . . .',
    '. . . . P . . .', '. . . . . . . .', '. . . . . . . .', '. . . . . . . .'
  ]);
  // Le cavalier en d6 (sq(3,5)) peut capturer le pion en e4 (sq(4,3)) : deplacement en L valide.
  const knightMoves = solitaireMovesFrom(board, sq(3,5));
  assert.equal(knightMoves.length, 1);
  assert.equal(knightMoves[0].to, sq(4,3));
});

test('solitaireAllMoves aggregates capture moves across every piece on the board', () => {
  const engine = loadModesEngine();
  const { sq, parseRows, solitaireAllMoves } = engine;
  const board = parseRows([
    '. . . . . . . .', '. . . . . R . R', '. . . . . . . .', '. . . . . R . .',
    '. . . . . . . .', '. . . . . . . .', '. . . . . . . .', '. . . . . . . .'
  ]);
  const all = solitaireAllMoves(board);
  assert.equal(all.length, 4); // A->B, A->C, B->A, C->A
});

test('solitairePieceCount counts the remaining pieces on the board', () => {
  const engine = loadModesEngine();
  const { parseRows, solitairePieceCount } = engine;
  const board = parseRows([
    '. . . . . . . .', '. . . . . R . R', '. . . . . . . .', '. . . . . R . .',
    '. . . . . . . .', '. . . . . . . .', '. . . . . . . .', '. . . . . . . .'
  ]);
  assert.equal(solitairePieceCount(board), 3);
});

/* ---------- Intégration : résoudre un puzzle solitaire de bout en bout via l'interface commune ---------- */
test('ChessModes.solitaire.start then two receiveMove calls solve the puzzle end to end', () => {
  // Stub minimal des dépendances normalement fournies par app.js (contenu,
  // progression, affichage) — voir CHESSQUEST_MODES.md sur ce choix.
  const stubScript = `
    const SOLITAIRE_PUZZLES = [{
      id:"solo-test", category:"facile", title:"Test",
      rows:[". . . . . . . .",". . . . . R . R",". . . . . . . .",". . . . . R . .",
            ". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . ."],
      pieceCount:3, hint:"h", desc:"d"
    }];
    let solvedSolitaire = new Set();
    let solitaireIdx = 0, solitaireBoard = null, solitaireSelected = null,
        solitaireLegalTargets = [], solitaireMoveCount = 0, solitaireSolved = false;
    let coachMsg = '';
    const lessonTitle = { set textContent(v){}, get textContent(){return '';} };
    const lessonDesc = { set textContent(v){}, get textContent(){return '';} };
    function setCoach(msg){ coachMsg = msg; }
    function renderControls(){}
    function renderList(){}
    function render(){}
    let progressSaved = false;
    function queueSaveProgress(){ progressSaved = true; }
    let soundsPlayed = [];
    function playSound(kind){ soundsPlayed.push(kind); }
  `;
  const engine = loadModesEngine(stubScript);
  const { sq } = engine;

  vm.runInContext('ChessModes.solitaire.start(0);', engine);
  assert.equal(vm.runInContext('solitaireBoard', engine).filter(Boolean).length, 3);

  // Coup 1 : selectionner la tour en h6 (sq(7,6)) puis capturer f6 (sq(5,6))
  vm.runInContext(`ChessModes.solitaire.receiveMove(${sq(7,6)});`, engine);
  assert.equal(vm.runInContext('solitaireSelected', engine), sq(7,6));
  vm.runInContext(`ChessModes.solitaire.receiveMove(${sq(5,6)});`, engine);
  assert.equal(vm.runInContext('solitaireBoard', engine).filter(Boolean).length, 2);
  assert.equal(vm.runInContext('solitaireSolved', engine), false);

  // Coup 2 : selectionner la tour desormais en f6 puis capturer f4 (sq(5,4)) -> il ne reste qu'une piece
  vm.runInContext(`ChessModes.solitaire.receiveMove(${sq(5,6)});`, engine);
  vm.runInContext(`ChessModes.solitaire.receiveMove(${sq(5,4)});`, engine);

  assert.equal(vm.runInContext('solitaireBoard', engine).filter(Boolean).length, 1);
  assert.equal(vm.runInContext('solitaireSolved', engine), true);
  assert.equal(vm.runInContext('solvedSolitaire.has(0)', engine), true);
  assert.equal(vm.runInContext('progressSaved', engine), true);
  assert.ok(vm.runInContext('soundsPlayed', engine).includes('win'));
});

test('restore() reloads the puzzle at the current index without advancing it', () => {
  const stubScript = `
    const SOLITAIRE_PUZZLES = [
      {id:"p0", category:"facile", title:"P0", rows:[". . . . . . . .",". . . . . R . R",". . . . . . . .",". . . . . R . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . ."], pieceCount:3, hint:"h", desc:"d"},
      {id:"p1", category:"facile", title:"P1", rows:[". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . B . . .",". . . Q . P . .",". . . . . . . .",". . . . . . . ."], pieceCount:3, hint:"h", desc:"d"}
    ];
    let solvedSolitaire = new Set();
    let solitaireIdx = 0, solitaireBoard = null, solitaireSelected = null,
        solitaireLegalTargets = [], solitaireMoveCount = 0, solitaireSolved = false;
    const lessonTitle = { set textContent(v){}, get textContent(){return '';} };
    const lessonDesc = { set textContent(v){}, get textContent(){return '';} };
    function setCoach(){}
    function renderControls(){}
    function renderList(){}
    function render(){}
    function queueSaveProgress(){}
    function playSound(){}
  `;
  const engine = loadModesEngine(stubScript);
  vm.runInContext('solvedSolitaire.add(0); ChessModes.solitaire.start(1);', engine);
  assert.equal(vm.runInContext('solitaireIdx', engine), 1);
  vm.runInContext('ChessModes.solitaire.restore();', engine);
  assert.equal(vm.runInContext('solitaireIdx', engine), 1); // toujours le puzzle 1, pas redemarre a 0
});
