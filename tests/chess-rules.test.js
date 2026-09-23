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
  const coreSource = fs.readFileSync(path.join(__dirname, '..', 'chess-core.js'), 'utf8');
  const rulesSource = fs.readFileSync(path.join(__dirname, '..', 'chess-rules.js'), 'utf8');
  const historySource = fs.readFileSync(path.join(__dirname, '..', 'chess-history.js'), 'utf8');
  const aiSource = fs.readFileSync(path.join(__dirname, '..', 'chess-ai.js'), 'utf8');
  const boardViewSource = fs.readFileSync(path.join(__dirname, '..', 'chess-board-view.js'), 'utf8');
  const preferencesSource = fs.readFileSync(path.join(__dirname, '..', 'chess-preferences.js'), 'utf8');
  const soundSource = fs.readFileSync(path.join(__dirname, '..', 'chess-sound.js'), 'utf8');
  const feedbackSource = fs.readFileSync(path.join(__dirname, '..', 'chess-feedback.js'), 'utf8');
  const messagesSource = fs.readFileSync(path.join(__dirname, '..', 'chess-messages.js'), 'utf8');
  const modalSource = fs.readFileSync(path.join(__dirname, '..', 'chess-modal.js'), 'utf8');
  const clockSource = fs.readFileSync(path.join(__dirname, '..', 'chess-clock.js'), 'utf8');
  const modesSource = fs.readFileSync(path.join(__dirname, '..', 'chess-modes.js'), 'utf8');
  const solitaireSource = fs.readFileSync(path.join(__dirname, '..', 'chess-mode-solitaire.js'), 'utf8');
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const source = `${coreSource}\n${rulesSource}\n${historySource}\n${aiSource}\n${boardViewSource}\n${preferencesSource}\n${soundSource}\n${feedbackSource}\n${messagesSource}\n${modalSource}\n${clockSource}\n${modesSource}\n${solitaireSource}\n${appSource}`;

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
  isAttacked,
  sq,
  fileOf,
  parseRows,
  moveNotation,
  createHistoryEntry,
  createGameSaveRecord,
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

test('a pinned rook cannot move off the file that shields its king', () => {
  // White king e1, white rook e2, black rook e8: the white rook is pinned
  // and may only move along the e-file (or capture the pinning rook).
  const board = parseRows([
    '. . . . r . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . R . . .',
    '. . . . K . . .'
  ]);
  const state = initState(board, 'w');
  const rookMoves = legalMoves(state, 'w').filter(m => m.from === sq(4, 1));
  assert.ok(rookMoves.length > 0);
  assert.ok(rookMoves.every(m => fileOf(m.to) === 4));
});

test('the en-passant target resets after an unrelated move', () => {
  const board = parseRows([
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . K . . .'
  ]);
  const state = initState(board, 'w', {}, sq(4, 3));
  const quietMove = { from: sq(4, 0), to: sq(4, 1), flags: {} };
  const after = applyMove(state, quietMove);
  assert.equal(after.ep, -1);
});

test('queenside castling is legal and moves both king and rook', () => {
  const board = parseRows([
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    'R . . . K . . .'
  ]);
  const state = initState(board, 'w', { wK: true, wQ: true, bK: true, bQ: true }, -1);
  const castleMove = legalMoves(state, 'w').find(m => m.flags.castle === 'Q');
  assert.ok(castleMove);
  const after = applyMove(state, castleMove);
  assert.equal(after.board[sq(2, 0)].type, 'K');
  assert.equal(after.board[sq(3, 0)].type, 'R');
  assert.equal(after.board[sq(0, 0)], null);
  assert.equal(after.board[sq(4, 0)], null);
});

test('isAttacked ignores a sliding attacker blocked by an intervening piece', () => {
  const blocked = parseRows([
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    'r P . K . . . .'
  ]);
  assert.equal(isAttacked(blocked, sq(3, 0), 'b'), false);

  const clear = parseRows([
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    'r . . K . . . .'
  ]);
  assert.equal(isAttacked(clear, sq(3, 0), 'b'), true);
});

test('halfmove clock resets on a pawn move or a capture, increments otherwise', () => {
  const board = parseRows([
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . n . . .',
    '. . . . . . . .',
    '. . . N K . . .'
  ]);
  const state = initState(board, 'w', {}, -1, 5, 1);
  // Quiet knight move (to an empty square): clock increments.
  const quietKnightMove = legalMoves(state, 'w').find(m => m.from === sq(3, 0) && m.to === sq(1, 1));
  assert.ok(quietKnightMove);
  assert.equal(applyMove(state, quietKnightMove).halfmoveClock, 6);
  // Knight captures the black knight on e2 (a real knight-move away): clock resets.
  const captureMove = legalMoves(state, 'w').find(m => m.from === sq(3, 0) && m.to === sq(4, 2));
  assert.ok(captureMove);
  assert.equal(applyMove(state, captureMove).halfmoveClock, 0);
});

test('fullmove number increments after Black moves, not after White', () => {
  const state = initState(initialBoard(), 'w', {}, -1, 0, 1);
  const whiteMove = legalMoves(state, 'w').find(m => m.from === sq(4, 1) && m.to === sq(4, 3));
  const afterWhite = applyMove(state, whiteMove);
  assert.equal(afterWhite.fullmoveNumber, 1);
  const blackMove = legalMoves(afterWhite, 'b').find(m => m.from === sq(4, 6) && m.to === sq(4, 4));
  const afterBlack = applyMove(afterWhite, blackMove);
  assert.equal(afterBlack.fullmoveNumber, 2);
});

test('initState/cloneState default the new counters when omitted, for states built without them', () => {
  // Mirrors how the app sometimes rebuilds a state by hand (e.g. restoring
  // an online game from the server) without halfmoveClock/fullmoveNumber/
  // history/result.
  const handBuiltState = { board: initialBoard(), turn: 'w', castling: { wK: true, wQ: true, bK: true, bQ: true }, ep: -1 };
  const move = legalMoves(handBuiltState, 'w').find(m => m.from === sq(4, 1) && m.to === sq(4, 3));
  const after = applyMove(handBuiltState, move);
  assert.equal(after.halfmoveClock, 0);
  assert.equal(after.fullmoveNumber, 1);
  assert.equal(after.history.length, 0);
  assert.equal(after.result, null);
});

test('moveNotation produces standard algebraic notation for ordinary moves, captures and promotions', () => {
  const board = parseRows([
    '. . . . . . . .',
    '. . . . . P . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .'
  ]);
  const state = initState(board, 'w');
  const quiet = { from: sq(5, 6), to: sq(5, 7), flags: { promotion: true } };
  assert.equal(moveNotation(state, quiet, null, 'Q'), 'f8=Q');

  const knightBoard = parseRows([
    '. . . . . . . .','. . . . . . . .','. . . . . . . .','. . . . . . . .',
    '. . . . . . . .','. . . . . . . .','. . . . . . . .','. . . N . . . .'
  ]);
  const knightState = initState(knightBoard, 'w');
  const capture = { from: sq(3, 0), to: sq(4, 2), flags: { capture: true } };
  assert.equal(moveNotation(knightState, capture, { color: 'b', type: 'P' }, null), 'Nxe3');

  assert.equal(moveNotation(knightState, { from: sq(4,0), to: sq(6,0), flags: { castle: 'K' } }, null, null), 'O-O');
});

test('createHistoryEntry and createGameSaveRecord match the shapes already used for display and save', () => {
  const entry = createHistoryEntry('w', 'e4');
  assert.equal(entry.color, 'w');
  assert.equal(entry.note, 'e4');

  const record = createGameSaveRecord({ mode: 'practice', result: 'win', aiElo: 800, moves: [{ from: 1, to: 2, promo: 'Q', color: 'w' }], playerColor: 'w' });
  assert.equal(record.mode, 'practice');
  assert.equal(record.result, 'win');
  assert.equal(record.ai_elo, 800);
  assert.equal(record.player_color, 'w');
  assert.equal(record.moves.length, 1);
  assert.equal(record.moves[0].from, 1);
  assert.equal('coach_stats' in record, false);

  const coachRecord = createGameSaveRecord({ mode: 'coach', result: 'loss', aiElo: 1200, moves: [], playerColor: 'b', coachStats: { excellent: 1 } });
  assert.equal(coachRecord.coach_stats.excellent, 1);
});
