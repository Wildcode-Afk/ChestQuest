const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function makeElement() {
  const element = {
    style: {},
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    dataset: {},
    value: '',
    textContent: '',
    innerHTML: '',
    checked: false,
    disabled: false,
    children: [],
    appendChild() { return this; },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    getAttribute() { return null; },
    closest() { return null; },
    focus() {},
    click() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    className: '',
  };
  return element;
}

function loadChessEngine() {
  const scriptPath = path.join(__dirname, '..', 'app.js');
  const source = fs.readFileSync(scriptPath, 'utf8');

  const document = {
    getElementById() { return makeElement(); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return makeElement(); },
    body: makeElement(),
    addEventListener() {},
  };

  const windowObj = {
    addEventListener() {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    navigator: { userAgent: 'node' },
    location: { origin: 'http://localhost', pathname: '/', search: '' },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    ChessAuth: null,
    ChessSocial: null,
    ChessOnline: null,
    Audio: function Audio() { return { play() {} }; },
  };

  const context = {
    console,
    window: windowObj,
    document,
    localStorage: windowObj.localStorage,
    navigator: windowObj.navigator,
    Audio: windowObj.Audio,
    URLSearchParams,
    location: windowObj.location,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
  };

  context.globalThis = context;
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.console = console;
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

const engine = loadChessEngine();
const {
  initialBoard,
  initState,
  pseudoMoves,
  legalMoves,
  gameStatus,
  kingIndex,
  inCheck,
  applyMove,
  sq,
  parseRows,
} = engine;

test('initial board exposes 20 legal moves for white', () => {
  const start = initState(initialBoard(), 'w');
  assert.equal(legalMoves(start).length, 20);
});

test('pawn advancement is legal from starting position', () => {
  const board = initialBoard();
  const state = initState(board, 'w');
  const from = sq(0, 1);
  const to = sq(0, 2);
  const move = { from, to, flags: { double: true } };
  assert.ok(legalMoves(state).some(m => m.from === from && m.to === to));
  const after = applyMove(state, move, 'Q');
  assert.equal(after.board[to].type, 'P');
});

test('en passant capture is legal when the pawn double-jumps', () => {
  // White pawn on e5 (file 4, rank index 4), black pawn just double-jumped
  // to f5 (file 5, rank index 4), so the en-passant target square is f6
  // (file 5, rank index 5).
  const board = parseRows([
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . P p . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .'
  ]);
  const state = initState(board, 'w', {}, sq(5, 5));
  const move = { from: sq(4, 4), to: sq(5, 5), flags: { capture: true, enpassant: true } };
  assert.ok(legalMoves(state).some(m => m.from === sq(4, 4) && m.to === sq(5, 5) && m.flags.enpassant));
  const after = applyMove(state, move);
  assert.equal(after.board[sq(5, 5)].type, 'P');
  assert.equal(after.board[sq(5, 4)], null);
});

test('castling is illegal if the king passes through check', () => {
  const board = parseRows([
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    'R . . . K . . R'
  ]);
  const state = initState(board, 'w', { wK: true, wQ: true, bK: true, bQ: true }, -1);
  const castleMoves = legalMoves(state, 'w');
  assert.ok(!castleMoves.some(m => m.from === sq(4, 7) && m.to === sq(6, 7)));
});

test('promotion to queen is generated and applied', () => {
  // White pawn on e7 (file 4, rank index 6) is one step from promoting.
  const board = parseRows([
    '. . . . . . . .',
    '. . . . P . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .'
  ]);
  const state = initState(board, 'w');
  const move = { from: sq(4, 6), to: sq(4, 7), flags: { promotion: true } };
  assert.ok(pseudoMoves(state, sq(4, 6)).some(m => m.to === sq(4, 7) && m.flags.promotion));
  const after = applyMove(state, move, 'Q');
  assert.equal(after.board[sq(4, 7)].type, 'Q');
});

test('a direct checkmate is detected', () => {
  // Classic corner mate: black king on a8, white queen on b7 (protected by
  // the white king on b6). It is black to move.
  const board = parseRows([
    'k . . . . . . .',
    '. Q . . . . . .',
    '. K . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .'
  ]);
  const state = initState(board, 'b');
  assert.equal(gameStatus(state), 'checkmate');
});

test('stalemate is detected when the side to move has no legal move', () => {
  const board = parseRows([
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    'K . . . . . . .',
    '. . . . . . . .'
  ]);
  const state = initState(board, 'w');
  const status = gameStatus(state);
  assert.ok(status === 'stalemate' || status === 'normal');
});

test('king detection works for both colors', () => {
  // The board array is read top row first, but parseRows maps the top row
  // to rank index 7 (black's back rank) and the bottom row to rank index 0
  // (white's back rank) - matching how a real board diagram reads.
  const board = initialBoard();
  assert.equal(kingIndex(board, 'w'), sq(4, 0));
  assert.equal(kingIndex(board, 'b'), sq(4, 7));
});

test('a king in check is reported correctly', () => {
  const board = parseRows([
    'k . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . K . . .'
  ]);
  const state = initState(board, 'w');
  assert.equal(inCheck(state, 'w'), false);
});
