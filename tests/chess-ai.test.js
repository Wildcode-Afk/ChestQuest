const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function makeElement() {
  return {
    style: {}, classList: { add(){}, remove(){}, contains(){return false;}, toggle(){} },
    dataset: {}, value: '', textContent: '', innerHTML: '', checked: false, disabled: false,
    children: [], appendChild(){return this;}, addEventListener(){}, removeEventListener(){},
    setAttribute(){}, getAttribute(){return null;}, closest(){return null;}, focus(){}, click(){},
    querySelector(){return null;}, querySelectorAll(){return [];}, className: '',
  };
}

// Le module IA (chess-ai.js) est chargé seul avec ses dépendances directes
// (chess-core.js, chess-rules.js) : il n'a besoin ni de chess-history.js ni
// de app.js pour fonctionner, ce qui reflète bien son indépendance vis-à-vis
// de l'interface.
function loadAIEngine() {
  const coreSource = fs.readFileSync(path.join(__dirname, '..', 'chess-core.js'), 'utf8');
  const rulesSource = fs.readFileSync(path.join(__dirname, '..', 'chess-rules.js'), 'utf8');
  const aiSource = fs.readFileSync(path.join(__dirname, '..', 'chess-ai.js'), 'utf8');
  const source = `${coreSource}\n${rulesSource}\n${aiSource}`;

  const document = {
    getElementById(){return makeElement();}, querySelector(){return null;}, querySelectorAll(){return [];},
    createElement(){return makeElement();}, body: makeElement(), addEventListener(){},
  };
  const windowObj = {
    addEventListener(){}, setTimeout, clearTimeout, setInterval, clearInterval,
    navigator: {userAgent:'node'}, location: {origin:'http://localhost',pathname:'/',search:''},
    localStorage: {getItem(){return null;},setItem(){},removeItem(){}},
    Audio: function Audio(){ return {play(){}}; },
  };
  const context = {
    console, window: windowObj, document, localStorage: windowObj.localStorage,
    navigator: windowObj.navigator, Audio: windowObj.Audio, URLSearchParams,
    location: windowObj.location, setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: async () => ({ok:true, json: async () => ({})}),
  };
  context.globalThis = context;
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.console = console;
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

const engine = loadAIEngine();
const {
  initialBoard, initState, parseRows, sq, legalMoves, applyMove,
  materialEval, orderMoves, negamax, chooseAIMoveMinimax,
  eloTierLabel, aiParamsForElo, chooseAIMoveForElo,
} = engine;

// Rend Math.random() déterministe pour le reste du fichier : les fonctions
// IA restent correctes quel que soit le tirage, mais fixer une graine rend
// les tests reproductibles au lieu de dépendre du hasard à chaque exécution.
vm.runInContext('Math.random = () => 0;', engine);

test('materialEval is balanced on the starting position and reflects a material edge', () => {
  assert.equal(materialEval(initialBoard()), 0);
  const upQueen = parseRows([
    '. . . . k . . .', '. . . . . . . .', '. . . . . . . .', '. . . . . . . .',
    '. . . . . . . .', '. . . . . . . .', '. . . . . . . .', '. . . . K . . Q'
  ]);
  assert.equal(materialEval(upQueen), 9);
});

test('orderMoves puts the highest-value capture first', () => {
  const board = parseRows([
    '. . . . q . . .', '. . . . . . . .', '. . . . . . . .', '. . . . . . . .',
    '. . . . R . . .', '. . . . . . . .', '. . . . . . . .', '. . . . K . . .'
  ]);
  const state = initState(board, 'w');
  const rookMoves = legalMoves(state, 'w').filter(m => m.from === sq(4, 3));
  const ordered = orderMoves(state, rookMoves);
  assert.equal(ordered[0].to, sq(4, 7));
  assert.equal(ordered[0].flags.capture, true);
});

test('negamax favors capturing a hanging queen over a quiet rook move', () => {
  const board = parseRows([
    '. . . . k . . .', '. . . . . . . .', '. . . . . . . .', '. . . q . . . .',
    '. . . . . . . .', '. . . . . . . .', '. . . . . . . .', '. . . R K . . .'
  ]);
  const state = initState(board, 'w');
  const rookMoves = legalMoves(state, 'w').filter(m => m.from === sq(3, 0));
  let best = null, bestVal = -Infinity;
  for (const m of orderMoves(state, rookMoves)) {
    const child = applyMove(state, m, 'Q');
    const val = -negamax(child, 1, -Infinity, Infinity);
    if (val > bestVal) { bestVal = val; best = m; }
  }
  assert.equal(best.to, sq(3, 4));
  assert.equal(best.flags.capture, true);
});

test('chooseAIMoveMinimax finds the same free-queen capture at a shallow depth', () => {
  const board = parseRows([
    '. . . . k . . .', '. . . . . . . .', '. . . . . . . .', '. . . q . . . .',
    '. . . . . . . .', '. . . . . . . .', '. . . . . . . .', '. . . R K . . .'
  ]);
  const state = initState(board, 'w');
  const move = chooseAIMoveMinimax(state, 2);
  assert.equal(move.to, sq(3, 4));
  assert.equal(move.flags.capture, true);
});

test('eloTierLabel maps Elo ranges to the expected French tier labels', () => {
  assert.equal(eloTierLabel(100), 'Débutant');
  assert.equal(eloTierLabel(499), 'Débutant');
  assert.equal(eloTierLabel(500), 'Amateur');
  assert.equal(eloTierLabel(949), 'Amateur');
  assert.equal(eloTierLabel(950), 'Intermédiaire');
  assert.equal(eloTierLabel(1349), 'Intermédiaire');
  assert.equal(eloTierLabel(1350), 'Avancé');
  assert.equal(eloTierLabel(1749), 'Avancé');
  assert.equal(eloTierLabel(1750), 'Expert');
});

test('aiParamsForElo maps Elo to search depth and clamps the blunder chance to [0, 0.55]', () => {
  assert.equal(aiParamsForElo(100).depth, 0);
  assert.equal(aiParamsForElo(100).blunder, 0.55); // clamped at the top of the range
  assert.equal(aiParamsForElo(499).depth, 0);
  assert.equal(aiParamsForElo(500).depth, 1);
  assert.equal(aiParamsForElo(949).depth, 1);
  assert.equal(aiParamsForElo(950).depth, 2);
  assert.equal(aiParamsForElo(1399).depth, 2);
  assert.equal(aiParamsForElo(1400).depth, 3);
  assert.equal(aiParamsForElo(2000).depth, 3);
  assert.equal(aiParamsForElo(2000).blunder, 0); // clamped at the bottom of the range
});

test('chooseAIMoveForElo plays the strong capture at a high Elo (deterministic, seeded)', () => {
  const board = parseRows([
    '. . . . q . . .', '. . . . . . . .', '. . . . . . . .', '. . . . . . . .',
    '. . . . R . . .', '. . . . . . . .', '. . . . . . . .', '. . . . K . . .'
  ]);
  const state = initState(board, 'w');
  const move = chooseAIMoveForElo(state, 2000);
  assert.equal(move.to, sq(4, 7));
  assert.equal(move.flags.capture, true);
});

test('chooseAIMoveForElo always returns a legal move, even at the lowest Elo (blunder path)', () => {
  const state = initState(initialBoard(), 'w');
  const move = chooseAIMoveForElo(state, 100);
  assert.ok(legalMoves(state, 'w').some(m => m.from === move.from && m.to === move.to));
});
