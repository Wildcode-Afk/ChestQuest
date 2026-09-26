const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function makeStubElement(){
  return { _text:'', set textContent(v){this._text=v;}, get textContent(){return this._text;},
    set innerHTML(v){}, get innerHTML(){return '';} };
}

function loadLessonsPuzzlesEngine(extraGlobalsScript){
  const files = ['chess-core.js','chess-rules.js','chess-lessons.js','chess-puzzles.js'];
  const source = files.map(f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');
  const context = { console };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  if(extraGlobalsScript) vm.runInContext(extraGlobalsScript, context);
  return context;
}

/* Jeu de données minimal mais réaliste, calqué sur la vraie forme de LESSONS/PUZZLES. */
const BASE_STUBS = `
  const LESSONS = [
    { id:'pion', category:'decouvertes', title:'Le Pion', focusSquare:'e2',
      rows:["k . . . . . . .","p . . p . p . .",". . . . . . . .",". . . . . . . .",
            ". . . . . . . .",". . . . . . . .","P . . . P . . .","K . . . . . . ."],
      desc:"Le pion avance.", hint:"Clique sur le pion.", goal:{type:'any-move'},
      success:"Bien joué !" },
    { id:'roque', category:'decouvertes', title:'Le Roque', focusSquare:'e1',
      rows:[". . . . k . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",
            ". . . . . . . .",". . . . . . . .",". . . . . . . .","R . . . K . . R"],
      desc:"Le roque.", hint:"Roque.", goal:{type:'castle'},
      success:"Bravo, tu as roqué !" }
  ];
  const PUZZLES = [
    { title:"Puzzle 1", turn:'w', category:'facile',
      rows:["k . . . . . . .","p p . . . . . .",". . . . . . . .",". . . . . . . .",
            ". . . . . . . .",". . . . . . . .",". . . . . . . .",". . . Q . . K ."],
      hint:"La dame.", desc:"Trouve le mat en un coup." },
    { title:"Puzzle 2", turn:'w', category:'facile',
      rows:[". . . . . . . .",". . . . . . p .",". . . . . . p k",". . . . . . p .",
            ". . . . . . . .",". . . . K . R .",". . . . . . . .",". . . . . . . ."],
      hint:"La tour.", desc:"Trouve le mat en un coup." }
  ];
  let completedLessons = new Set();
  let solvedPuzzles = new Set();
  let lessonIdx = 0, puzzleIdx = 0;
  let gameState = null, selected = null, legalTargets = [], lastMove = null, lessonGoalMet = false;
  let capturedByWhite = [], capturedByBlack = [], awaitingPromotion = null, moveHistory = [];
  const promoOverlay = { innerHTML: '' };
  const lessonTitle = ${'{}'}; const lessonDesc = ${'{}'};
  let coachMsg = '';
  function setCoach(msg){ coachMsg = msg; }
  function renderMoves(){}
  function renderControls(){}
  function renderList(){}
  function render(){}
  let progressSaved = false;
  function queueSaveProgress(){ progressSaved = true; }
  let soundsPlayed = [];
  function playSound(kind){ soundsPlayed.push(kind); }
`;

function withStubProps(extra){
  // lessonTitle/lessonDesc ont besoin de vrais setters/getters textContent ;
  // on les redéfinit après coup pour éviter d'alourdir le template ci-dessus.
  return BASE_STUBS.replace(
    'const lessonTitle = {}; const lessonDesc = {};',
    `const lessonTitle = { _t:'', set textContent(v){this._t=v;}, get textContent(){return this._t;} };
     const lessonDesc = { _t:'', set textContent(v){this._t=v;}, get textContent(){return this._t;} };`
  ) + (extra||'');
}

/* ---------- chess-lessons.js ---------- */
test('loadLesson initializes the board, resets selection state and shows the hint', () => {
  const engine = loadLessonsPuzzlesEngine(withStubProps());
  vm.runInContext('loadLesson(0);', engine);
  assert.equal(vm.runInContext('lessonIdx', engine), 0);
  assert.equal(vm.runInContext('gameState.turn', engine), 'w');
  assert.equal(vm.runInContext('lessonTitle.textContent', engine), 'Le Pion');
  assert.equal(vm.runInContext('coachMsg', engine), 'Clique sur le pion.');
});

test('handleLessonMove marks the goal met for an any-move lesson and saves progress', () => {
  const engine = loadLessonsPuzzlesEngine(withStubProps());
  vm.runInContext('loadLesson(0);', engine);
  vm.runInContext("handleLessonMove({from:8,to:16,flags:{}}, 'w', false, null);", engine);
  assert.equal(vm.runInContext('lessonGoalMet', engine), true);
  assert.equal(vm.runInContext("completedLessons.has('pion')", engine), true);
  assert.equal(vm.runInContext('progressSaved', engine), true);
});

test('handleLessonMove requires the castle flag for a castle-goal lesson', () => {
  const engine = loadLessonsPuzzlesEngine(withStubProps());
  vm.runInContext("completedLessons.add('pion');", engine); // deverrouille la lecon 'roque'
  vm.runInContext('loadLesson(1);', engine); // leçon "Le Roque"
  assert.equal(vm.runInContext('lessonIdx', engine), 1);
  vm.runInContext("handleLessonMove({from:4,to:20,flags:{}}, 'w', false, null);", engine);
  assert.equal(vm.runInContext('lessonGoalMet', engine), false);
  vm.runInContext("handleLessonMove({from:4,to:6,flags:{castle:'K'}}, 'w', true, null);", engine);
  assert.equal(vm.runInContext('lessonGoalMet', engine), true);
});

test('validateLessonEntry reports each missing or malformed field of an incomplete lesson', () => {
  const engine = loadLessonsPuzzlesEngine();
  const errors = engine.validateLessonEntry({ id:'x', category:'c', title:'t', rows:['only','two'] });
  assert.ok(errors.includes('rows doit contenir exactement 8 rangées'));
  assert.ok(errors.includes('desc manquant'));
  assert.ok(errors.includes('hint manquant'));
  assert.ok(errors.includes('success manquant'));
  assert.ok(errors.includes('goal.type manquant ou inconnu'));
  assert.equal(engine.validateLessonEntry(null)[0], 'leçon absente');
});

test('loadLesson falls back to the first valid lesson instead of crashing on incomplete data', () => {
  const brokenLessons = `
    const LESSONS = [ { id:'broken', category:'x', title:'Cassée' /* rows manquant, goal manquant */ },
      { id:'ok', category:'x', title:'Leçon valide',
        rows:["k . . . . . . .",". . . . . . . .",". . . . . . . .",". . . . . . . .",
              ". . . . . . . .",". . . . . . . .",". . . . . . . .","K . . . . . . ."],
        desc:"d", hint:"h", goal:{type:'any-move'}, success:"s" } ];
  `;
  const engine = loadLessonsPuzzlesEngine(brokenLessons + withStubProps().replace(/const LESSONS[\s\S]*?\];\n/, ''));
  vm.runInContext('loadLesson(0);', engine);
  assert.equal(vm.runInContext('lessonTitle.textContent', engine), 'Leçon valide');
});

test('handleLessonMove ignores a malformed move object instead of throwing', () => {
  const engine = loadLessonsPuzzlesEngine(withStubProps());
  vm.runInContext('loadLesson(0);', engine);
  assert.doesNotThrow(() => vm.runInContext("handleLessonMove({from:'x'}, 'w', false, null);", engine));
  assert.doesNotThrow(() => vm.runInContext("handleLessonMove(null, 'w', false, null);", engine));
  assert.equal(vm.runInContext('lessonGoalMet', engine), false);
});

test('sanitizeCompletedLessons keeps only known lesson ids and drops junk entries', () => {
  const engine = loadLessonsPuzzlesEngine(withStubProps());
  const result = vm.runInContext("sanitizeCompletedLessons(['pion', 'inconnue', 42, null, 'roque'])", engine);
  assert.equal(result.has('pion'), true);
  assert.equal(result.has('roque'), true);
  assert.equal(result.has('inconnue'), false);
  assert.equal(result.size, 2);
  assert.equal(vm.runInContext('sanitizeCompletedLessons(null).size', engine), 0);
  assert.equal(vm.runInContext('sanitizeCompletedLessons(undefined).size', engine), 0);
});

/* ---------- chess-puzzles.js ---------- */
test('loadPuzzle initializes the board without castling rights and shows the default hint', () => {
  const engine = loadLessonsPuzzlesEngine(withStubProps());
  vm.runInContext('loadPuzzle(0);', engine);
  assert.equal(vm.runInContext('puzzleIdx', engine), 0);
  assert.equal(vm.runInContext('gameState.castling.wK', engine), false);
  assert.equal(vm.runInContext('lessonTitle.textContent', engine), 'Puzzle 1');
  assert.match(vm.runInContext('coachMsg', engine), /Indice/);
});

test('handlePuzzleMove marks the puzzle solved on checkmate and plays the win sound', () => {
  const engine = loadLessonsPuzzlesEngine(withStubProps());
  vm.runInContext('loadPuzzle(0);', engine);
  // Joue la vraie solution du "Puzzle 1" tel que défini plus haut : Qd1-d8#.
  const mv = { from: 3, to: 59, flags: {} }; // d1 -> d8
  vm.runInContext(`gameState = applyMove(gameState, ${JSON.stringify(mv)}, 'Q');`, engine);
  vm.runInContext(`handlePuzzleMove(${JSON.stringify(mv)}, 'w');`, engine);
  assert.equal(vm.runInContext('gameStatus(gameState)', engine), 'checkmate'); // verifie l'hypothese du test
  assert.equal(vm.runInContext('solvedPuzzles.has(0)', engine), true);
  assert.equal(vm.runInContext('progressSaved', engine), true);
  assert.ok(vm.runInContext('soundsPlayed', engine).includes('win'));
});

test('handlePuzzleMove gives the hint and does not mark solved when it is not checkmate', () => {
  const engine = loadLessonsPuzzlesEngine(withStubProps());
  vm.runInContext('loadPuzzle(0);', engine);
  vm.runInContext("handlePuzzleMove({from:8,to:16,flags:{}}, 'w');", engine);
  assert.equal(vm.runInContext('solvedPuzzles.has(0)', engine), false);
  assert.match(vm.runInContext('coachMsg', engine), /La dame\./);
});

test('validatePuzzleEntry reports each missing or malformed field of an incomplete puzzle', () => {
  const engine = loadLessonsPuzzlesEngine();
  const errors = engine.validatePuzzleEntry({ title:'t', turn:'z', rows:['a'] });
  assert.ok(errors.includes("turn doit être 'w' ou 'b'"));
  assert.ok(errors.includes('rows doit contenir exactement 8 rangées'));
  assert.ok(errors.includes('category manquante'));
  assert.ok(errors.includes('hint manquant'));
  assert.ok(errors.includes('desc manquant'));
  assert.equal(engine.validatePuzzleEntry(null)[0], 'puzzle absent');
});

test('handlePuzzleMove ignores a malformed move object instead of throwing', () => {
  const engine = loadLessonsPuzzlesEngine(withStubProps());
  vm.runInContext('loadPuzzle(0);', engine);
  assert.doesNotThrow(() => vm.runInContext("handlePuzzleMove(undefined, 'w');", engine));
  assert.doesNotThrow(() => vm.runInContext("handlePuzzleMove({from:-1,to:99}, 'w');", engine));
  assert.equal(vm.runInContext('solvedPuzzles.size', engine), 0);
});

test('sanitizeSolvedPuzzles keeps only in-range integer indices and drops junk entries', () => {
  const engine = loadLessonsPuzzlesEngine(withStubProps());
  const result = vm.runInContext("sanitizeSolvedPuzzles([0, 1, 2, -1, 'x', 1.5, null])", engine);
  assert.equal(result.has(0), true);
  assert.equal(result.has(1), true);
  assert.equal(result.size, 2); // l'indice 2 est hors bornes (2 puzzles seulement : 0 et 1)
  assert.equal(vm.runInContext('sanitizeSolvedPuzzles(null).size', engine), 0);
});

/* ---------- Isolation vis-à-vis du moteur de règles ---------- */
test('isPuzzleUnlocked and isLessonUnlocked stay defensive on out-of-range indices', () => {
  const engine = loadLessonsPuzzlesEngine(withStubProps());
  assert.equal(vm.runInContext('isLessonUnlocked(-1)', engine), false);
  assert.equal(vm.runInContext('isLessonUnlocked(999)', engine), false);
  assert.equal(vm.runInContext('isPuzzleUnlocked(-1)', engine), false);
  assert.equal(vm.runInContext('isPuzzleUnlocked(999)', engine), false);
});
