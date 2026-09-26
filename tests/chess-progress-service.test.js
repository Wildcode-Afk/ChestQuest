const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadProgressServiceEngine(extraGlobalsScript){
  const source = fs.readFileSync(path.join(__dirname, '..', 'chess-progress-service.js'), 'utf8');
  const context = { console, setTimeout, clearTimeout };
  context.globalThis = context;
  vm.createContext(context);
  if(extraGlobalsScript) vm.runInContext(extraGlobalsScript, context);
  vm.runInContext(source, context);
  return context;
}

/* Stub minimal de l'état applicatif normalement fourni par app.js
   (leçons/puzzles/solitaire, Elo, mode IA, stats, affichage) —
   voir CHESSQUEST_STORAGE.md sur ce choix. */
const BASE_STUBS = `
  let completedLessons = new Set(), solvedPuzzles = new Set(), solvedSolitaire = new Set();
  let progressiveElo = 600, fixedElo = 800, aiMode = 'progressive';
  let winsCount = 0, lossesCount = 0, drawsCount = 0;
  let myCountry = null, myFeaturedBadge = null;
  let homeShown = false, listRendered = false;
  function showHome(){ homeShown = true; }
  function renderList(){ listRendered = true; }
  function earnedBadgeIds(){ return ['elo1000']; }
  let savedPayload = null;
  const window = {
    ChessAuth: { getUser: () => ({ id: 'u1' }), displayName: () => 'Max' },
    ChessProgress: { save(payload){ savedPayload = payload; } },
  };
`;

/* ---------- sanitizeProgressRow ---------- */
test('sanitizeProgressRow returns safe defaults for a missing or non-object row', () => {
  const engine = loadProgressServiceEngine(BASE_STUBS);
  const { sanitizeProgressRow } = engine;
  for(const bad of [null, undefined, 'x', 42]){
    const safe = sanitizeProgressRow(bad);
    assert.deepEqual(Array.from(safe.completed_lessons), []);
    assert.equal(safe.progressive_elo, null);
    assert.equal(safe.wins_count, 0);
  }
});

test('sanitizeProgressRow keeps well-formed fields and drops malformed ones', () => {
  const engine = loadProgressServiceEngine(BASE_STUBS);
  const safe = engine.sanitizeProgressRow({
    completed_lessons: ['pion', 42, null, 'roque'],
    solved_puzzles: [0, 2, -1, 'x', 1.5],
    solved_solitaire: [1],
    progressive_elo: 950,
    fixed_elo: -5,          // invalide (negatif) -> ignore, garde la valeur precedente
    ai_mode: 'bogus-mode',  // invalide -> ignore
    wins_count: 3.9,        // arrondi vers le bas
    losses_count: 'beaucoup', // invalide -> 0
    draws_count: 2,
    country: 'FR',
    featured_badge: '',     // chaine vide -> ignoree (null)
  });
  assert.equal(safe.completed_lessons.length, 2);
  assert.ok(safe.completed_lessons.includes('pion') && safe.completed_lessons.includes('roque'));
  assert.deepEqual(safe.solved_puzzles.sort(), [0,2]);
  assert.deepEqual(safe.solved_solitaire, [1]);
  assert.equal(safe.progressive_elo, 950);
  assert.equal(safe.fixed_elo, null);
  assert.equal(safe.ai_mode, null);
  assert.equal(safe.wins_count, 3);
  assert.equal(safe.losses_count, 0);
  assert.equal(safe.draws_count, 2);
  assert.equal(safe.country, 'FR');
  assert.equal(safe.featured_badge, null);
});

/* ---------- applyLoadedProgress ---------- */
test('applyLoadedProgress applies a well-formed row to the in-memory state and refreshes the view', () => {
  const engine = loadProgressServiceEngine(BASE_STUBS);
  vm.runInContext(`applyLoadedProgress({
    completed_lessons:['pion'], solved_puzzles:[0,1], solved_solitaire:[0],
    progressive_elo: 1200, fixed_elo: 900, ai_mode:'fixed',
    wins_count: 5, losses_count: 2, draws_count: 1,
    country:'FR', featured_badge:'elo1000'
  });`, engine);
  assert.equal(vm.runInContext("completedLessons.has('pion')", engine), true);
  assert.equal(vm.runInContext('solvedPuzzles.size', engine), 2);
  assert.equal(vm.runInContext('progressiveElo', engine), 1200);
  assert.equal(vm.runInContext('fixedElo', engine), 900);
  assert.equal(vm.runInContext('aiMode', engine), 'fixed');
  assert.equal(vm.runInContext('winsCount', engine), 5);
  assert.equal(vm.runInContext('myCountry', engine), 'FR');
  assert.equal(vm.runInContext('homeShown', engine), true);
  assert.equal(vm.runInContext('listRendered', engine), true);
});

test('applyLoadedProgress does nothing when there is no row to apply (guest / never saved)', () => {
  const engine = loadProgressServiceEngine(BASE_STUBS);
  vm.runInContext('applyLoadedProgress(null);', engine);
  assert.equal(vm.runInContext('progressiveElo', engine), 600); // valeur par defaut inchangee
  assert.equal(vm.runInContext('homeShown', engine), false); // pas de rafraichissement inutile
});

test('applyLoadedProgress does not let a corrupted Elo value overwrite the current one', () => {
  const engine = loadProgressServiceEngine(BASE_STUBS);
  vm.runInContext(`applyLoadedProgress({ progressive_elo: -999, fixed_elo: 'beaucoup' });`, engine);
  assert.equal(vm.runInContext('progressiveElo', engine), 600); // valeur de depart preservee
  assert.equal(vm.runInContext('fixedElo', engine), 800);
});

/* ---------- queueSaveProgress ---------- */
test('queueSaveProgress sends the exact same field names as before this step (format preserved)', () => {
  const engine = loadProgressServiceEngine(BASE_STUBS);
  vm.runInContext(`
    completedLessons.add('pion'); solvedPuzzles.add(0); solvedSolitaire.add(2);
    progressiveElo = 1100; fixedElo = 750; aiMode = 'progressive';
    winsCount = 4; lossesCount = 1; drawsCount = 0;
  `, engine);
  vm.runInContext('queueSaveProgress();', engine);
  return new Promise(resolve => setTimeout(() => {
    const payload = vm.runInContext('savedPayload', engine);
    assert.equal(payload.username, 'Max');
    assert.equal(payload.completed_lessons.length, 1);
    assert.equal(payload.completed_lessons[0], 'pion');
    assert.equal(payload.solved_puzzles.length, 1);
    assert.equal(payload.solved_puzzles[0], 0);
    assert.equal(payload.solved_solitaire.length, 1);
    assert.equal(payload.solved_solitaire[0], 2);
    assert.equal(payload.progressive_elo, 1100);
    assert.equal(payload.fixed_elo, 750);
    assert.equal(payload.ai_mode, 'progressive');
    assert.equal(payload.wins_count, 4);
    assert.equal(payload.losses_count, 1);
    assert.equal(payload.draws_count, 0);
    assert.equal(payload.badges.length, 1);
    assert.equal(payload.badges[0], 'elo1000');
    resolve();
  }, 700));
});

test('queueSaveProgress does nothing for a guest (no logged-in user)', () => {
  const engine = loadProgressServiceEngine(BASE_STUBS.replace(
    "ChessAuth: { getUser: () => ({ id: 'u1' }), displayName: () => 'Max' },",
    "ChessAuth: { getUser: () => null, displayName: () => 'Max' },"
  ));
  vm.runInContext('queueSaveProgress();', engine);
  return new Promise(resolve => setTimeout(() => {
    assert.equal(vm.runInContext('savedPayload', engine), null);
    resolve();
  }, 700));
});

test('queueSaveProgress debounces rapid successive calls into a single save', () => {
  const engine = loadProgressServiceEngine(BASE_STUBS);
  vm.runInContext(`
    let saveCount401 = 0;
    window.ChessProgress.save = function(p){ saveCount401++; savedPayload = p; };
  `, engine);
  vm.runInContext('queueSaveProgress(); queueSaveProgress(); queueSaveProgress();', engine);
  return new Promise(resolve => setTimeout(() => {
    assert.equal(vm.runInContext('saveCount401', engine), 1);
    resolve();
  }, 700));
});
