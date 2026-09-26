const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadOnlineContractEngine(){
  const source = fs.readFileSync(path.join(__dirname, '..', 'chess-online-contract.js'), 'utf8');
  const context = { console };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

function validBoard(){
  const board = new Array(64).fill(null);
  board[0] = { color:'w', type:'K' };
  board[63] = { color:'b', type:'K' };
  return board;
}

function validRow(overrides){
  return Object.assign({
    id: 'game-123',
    white_id: 'u1',
    black_id: 'u2',
    created_by: 'u1',
    status: 'active',
    result: null,
    result_reason: null,
    turn: 'w',
    move_count: 4,
    last_from: 8,
    last_to: 16,
    last_promo: null,
    white_time_ms: 60000,
    black_time_ms: 55000,
    last_move_at: new Date().toISOString(),
    board: validBoard(),
  }, overrides || {});
}

/* ---------- isValidBoardArray ---------- */
test('isValidBoardArray accepts a well-formed 64-cell board with null or valid pieces', () => {
  const engine = loadOnlineContractEngine();
  assert.equal(engine.isValidBoardArray(validBoard()), true);
});

test('isValidBoardArray rejects a board of the wrong length', () => {
  const engine = loadOnlineContractEngine();
  assert.equal(engine.isValidBoardArray(new Array(63).fill(null)), false);
  assert.equal(engine.isValidBoardArray(new Array(65).fill(null)), false);
});

test('isValidBoardArray rejects a board with an unknown piece color or type', () => {
  const engine = loadOnlineContractEngine();
  const bad1 = validBoard(); bad1[5] = { color:'z', type:'K' };
  const bad2 = validBoard(); bad2[5] = { color:'w', type:'X' };
  assert.equal(engine.isValidBoardArray(bad1), false);
  assert.equal(engine.isValidBoardArray(bad2), false);
});

test('isValidBoardArray rejects non-array input', () => {
  const engine = loadOnlineContractEngine();
  assert.equal(engine.isValidBoardArray(null), false);
  assert.equal(engine.isValidBoardArray(undefined), false);
  assert.equal(engine.isValidBoardArray('not a board'), false);
});

/* ---------- validateOnlineGameRow ---------- */
test('validateOnlineGameRow accepts a fully well-formed row', () => {
  const engine = loadOnlineContractEngine();
  const errors = engine.validateOnlineGameRow(validRow());
  assert.deepEqual(Array.from(errors), []);
});

test('validateOnlineGameRow reports a missing or invalid id', () => {
  const engine = loadOnlineContractEngine();
  assert.ok(engine.validateOnlineGameRow(validRow({ id: null })).includes('id manquant ou invalide'));
  assert.ok(engine.validateOnlineGameRow(validRow({ id: '' })).includes('id manquant ou invalide'));
});

test('validateOnlineGameRow reports an unknown status or result', () => {
  const engine = loadOnlineContractEngine();
  assert.ok(engine.validateOnlineGameRow(validRow({ status: 'bogus' })).some(e => e.includes('status inconnu')));
  assert.ok(engine.validateOnlineGameRow(validRow({ result: 'bogus' })).some(e => e.includes('result inconnu')));
});

test('validateOnlineGameRow reports an invalid turn', () => {
  const engine = loadOnlineContractEngine();
  assert.ok(engine.validateOnlineGameRow(validRow({ turn: 'x' })).includes("turn doit être 'w' ou 'b'"));
});

test('validateOnlineGameRow reports a negative or non-integer move_count', () => {
  const engine = loadOnlineContractEngine();
  assert.ok(engine.validateOnlineGameRow(validRow({ move_count: -1 })).some(e => e.includes('move_count')));
  assert.ok(engine.validateOnlineGameRow(validRow({ move_count: 1.5 })).some(e => e.includes('move_count')));
  assert.ok(engine.validateOnlineGameRow(validRow({ move_count: 'quatre' })).some(e => e.includes('move_count')));
});

test('validateOnlineGameRow reports out-of-range last_from/last_to', () => {
  const engine = loadOnlineContractEngine();
  assert.ok(engine.validateOnlineGameRow(validRow({ last_from: 64 })).some(e => e.includes('last_from')));
  assert.ok(engine.validateOnlineGameRow(validRow({ last_to: -1 })).some(e => e.includes('last_to')));
  // null est une valeur legitime (partie qui vient de commencer)
  assert.deepEqual(Array.from(engine.validateOnlineGameRow(validRow({ last_from: null, last_to: null }))), []);
});

test('validateOnlineGameRow reports negative clock values but accepts null clocks', () => {
  const engine = loadOnlineContractEngine();
  assert.ok(engine.validateOnlineGameRow(validRow({ white_time_ms: -5 })).some(e => e.includes('white_time_ms')));
  assert.deepEqual(Array.from(engine.validateOnlineGameRow(validRow({ white_time_ms: null, black_time_ms: null }))), []);
});

test('validateOnlineGameRow reports a malformed board without requiring one to be present', () => {
  const engine = loadOnlineContractEngine();
  assert.ok(engine.validateOnlineGameRow(validRow({ board: ['not', 'a', 'board'] })).some(e => e.includes('board')));
  assert.deepEqual(Array.from(engine.validateOnlineGameRow(validRow({ board: undefined }))), []);
  assert.deepEqual(Array.from(engine.validateOnlineGameRow(validRow({ board: null }))), []);
});

test('validateOnlineGameRow reports every problem at once for a badly formed row, without crashing', () => {
  const engine = loadOnlineContractEngine();
  const errors = engine.validateOnlineGameRow({ id: 42, status: 'bogus', turn: 'x', move_count: -1 });
  assert.ok(errors.length >= 4);
});

test('validateOnlineGameRow handles an absent or non-object row gracefully', () => {
  const engine = loadOnlineContractEngine();
  assert.deepEqual(Array.from(engine.validateOnlineGameRow(null)), ['ligne absente ou invalide']);
  assert.deepEqual(Array.from(engine.validateOnlineGameRow(undefined)), ['ligne absente ou invalide']);
  assert.deepEqual(Array.from(engine.validateOnlineGameRow('oops')), ['ligne absente ou invalide']);
});

/* ---------- hasNewMove ---------- */
test('hasNewMove is true only when move_count strictly increased', () => {
  const engine = loadOnlineContractEngine();
  assert.equal(engine.hasNewMove({ move_count: 5 }, 4), true);
  assert.equal(engine.hasNewMove({ move_count: 4 }, 4), false);
  assert.equal(engine.hasNewMove({ move_count: 3 }, 4), false);
  assert.equal(engine.hasNewMove({ move_count: 'x' }, 4), false);
});
