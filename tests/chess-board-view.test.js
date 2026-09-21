const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

/* ----------------------------------------------------------------
   DOM minimal simulé, suffisant pour vérifier la construction du
   plateau (classes CSS, sélection, clic) sans dépendance externe.
   ---------------------------------------------------------------- */
class FakeElement {
  constructor(tag){
    this.tagName = tag;
    this._classes = new Set();
    this.dataset = {};
    this.children = [];
    this.attrs = {};
    this.style = { setProperty(k,v){ this[k]=v; } };
    this._text = '';
    this.onclick = null;
  }
  get classList(){
    const self = this;
    return {
      add(...cs){ cs.forEach(c=>self._classes.add(c)); },
      remove(...cs){ cs.forEach(c=>self._classes.delete(c)); },
      contains(c){ return self._classes.has(c); },
      toggle(c){ self._classes.has(c) ? self._classes.delete(c) : self._classes.add(c); },
    };
  }
  set className(v){ this._classes = new Set(v.split(' ').filter(Boolean)); }
  get className(){ return Array.from(this._classes).join(' '); }
  set textContent(v){ this._text = v; }
  get textContent(){ return this._text; }
  set innerHTML(v){ if(v===''){ this.children = []; } }
  appendChild(el){ this.children.push(el); el.parentNode = this; return el; }
  setAttribute(k,v){ this.attrs[k]=v; if(k==='class'){ this._classes = new Set(v.split(' ').filter(Boolean)); } }
  setAttributeNS(ns,k,v){ this.attrs[k]=v; }
  getAttribute(k){ return this.attrs[k]!==undefined ? this.attrs[k] : null; }
  querySelector(selector){
    const m = /\[data-idx="(\d+)"\]/.exec(selector);
    if(m){
      const want = m[1];
      const walk = (el) => {
        if(el.dataset && String(el.dataset.idx)===want) return el;
        for(const c of el.children){ const r = walk(c); if(r) return r; }
        return null;
      };
      return walk(this);
    }
    if(selector==='.piece'){
      return this.children.find(c=>c._classes && c._classes.has('piece')) || null;
    }
    return null;
  }
  getBoundingClientRect(){ return {left:0, top:0, width:40, height:40}; }
}

function makeElement() { return new FakeElement('div'); }

function loadBoardView() {
  const coreSource = fs.readFileSync(path.join(__dirname, '..', 'chess-core.js'), 'utf8');
  const viewSource = fs.readFileSync(path.join(__dirname, '..', 'chess-board-view.js'), 'utf8');
  const source = `${coreSource}\n${viewSource}`;

  const document = {
    getElementById(){ return makeElement(); },
    createElement(tag){ return new FakeElement(tag); },
    createElementNS(ns, tag){ return new FakeElement(tag); },
  };
  const windowObj = { innerWidth: 800 };
  const context = {
    console, window: windowObj, document,
    requestAnimationFrame: (fn)=>fn(),
    setTimeout, clearTimeout,
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

const engine = loadBoardView();
const { sq, initBoardView, renderBoardSquares, squareColorClass, computeSquareSize, createPieceEl } = engine;

function emptyBoard(){ return new Array(64).fill(null); }

test('squareColorClass alternates correctly (a1 dark, b1 light, matching real board colors)', () => {
  assert.equal(squareColorClass(sq(0,0)), 'dark');  // a1
  assert.equal(squareColorClass(sq(1,0)), 'light'); // b1
  assert.equal(squareColorClass(sq(0,1)), 'light'); // a2
  assert.equal(squareColorClass(sq(7,7)), 'dark');  // h8
});

test('computeSquareSize stays within the [30,46] px bounds used by the CSS', () => {
  engine.window.innerWidth = 300;
  assert.ok(computeSquareSize() >= 30);
  engine.window.innerWidth = 2000;
  assert.ok(computeSquareSize() <= 46);
});

test('createPieceEl sets the piece color class and the correct sprite reference', () => {
  const whiteQueen = createPieceEl({color:'w', type:'Q'});
  assert.ok(whiteQueen.className.includes('white'));
  assert.equal(whiteQueen.children[0].getAttribute('href'), '#pc-Q');

  const blackKnight = createPieceEl({color:'b', type:'N'});
  assert.ok(blackKnight.className.includes('black'));
  assert.equal(blackKnight.children[0].getAttribute('href'), '#pc-N');
});

test('renderBoardSquares builds all 64 squares and marks selection, last move and check', () => {
  const boardEl = makeElement();
  initBoardView(boardEl);
  const board = emptyBoard();
  board[sq(4,0)] = {color:'w', type:'K'};
  board[sq(0,7)] = {color:'b', type:'K'};

  renderBoardSquares({
    board, selected: sq(4,0), lastMove: {from: sq(4,1), to: sq(4,0)},
    legalTargets: [], boardFlipped: false, teachSquare: null, lessonGoalMet: false,
    kingInCheck: {w:true, b:false}, onSquareClick: () => {},
  });

  assert.equal(boardEl.children.length, 64);
  const e1 = boardEl.querySelector('[data-idx="'+sq(4,0)+'"]');
  assert.ok(e1.classList.contains('origin'));
  assert.ok(e1.classList.contains('kingdanger'));
  const e2 = boardEl.querySelector('[data-idx="'+sq(4,1)+'"]');
  assert.ok(e2.classList.contains('lastmove'));
  const a8 = boardEl.querySelector('[data-idx="'+sq(0,7)+'"]');
  assert.equal(a8.classList.contains('kingdanger'), false);
});

test('renderBoardSquares shows legal-move dots on empty squares and rings on capturable squares', () => {
  const boardEl = makeElement();
  initBoardView(boardEl);
  const board = emptyBoard();
  board[sq(4,4)] = {color:'w', type:'Q'};
  board[sq(4,6)] = {color:'b', type:'P'};

  renderBoardSquares({
    board, selected: sq(4,4), lastMove: null,
    legalTargets: [
      {to: sq(4,5), flags: {}},
      {to: sq(4,6), flags: {capture:true}},
    ],
    boardFlipped: false, teachSquare: null, lessonGoalMet: false,
    kingInCheck: {w:false,b:false}, onSquareClick: () => {},
  });

  const quiet = boardEl.querySelector('[data-idx="'+sq(4,5)+'"]');
  assert.ok(quiet.children.some(c=>c.className==='dot'));
  const capture = boardEl.querySelector('[data-idx="'+sq(4,6)+'"]');
  assert.ok(capture.children.some(c=>c.className==='ring'));
});

test('renderBoardSquares wires each square\'s click to the provided handler with the right index (mouse and touch both fire a click)', () => {
  const boardEl = makeElement();
  initBoardView(boardEl);
  const clicked = [];
  renderBoardSquares({
    board: emptyBoard(), selected: null, lastMove: null, legalTargets: [],
    boardFlipped: false, teachSquare: null, lessonGoalMet: false,
    kingInCheck: {w:false,b:false}, onSquareClick: (idx) => clicked.push(idx),
  });
  const target = boardEl.querySelector('[data-idx="'+sq(3,3)+'"]');
  target.onclick();
  assert.deepEqual(clicked, [sq(3,3)]);
});

test('renderBoardSquares flips rank order (and coordinate labels) when boardFlipped is true', () => {
  const boardEl = makeElement();
  initBoardView(boardEl);
  renderBoardSquares({
    board: emptyBoard(), selected: null, lastMove: null, legalTargets: [],
    boardFlipped: false, teachSquare: null, lessonGoalMet: false,
    kingInCheck: {w:false,b:false}, onSquareClick: () => {},
  });
  const firstCellNormal = boardEl.children[0];
  assert.equal(firstCellNormal.dataset.idx, sq(0,7)); // a8 first when not flipped

  renderBoardSquares({
    board: emptyBoard(), selected: null, lastMove: null, legalTargets: [],
    boardFlipped: true, teachSquare: null, lessonGoalMet: false,
    kingInCheck: {w:false,b:false}, onSquareClick: () => {},
  });
  const firstCellFlipped = boardEl.children[0];
  assert.equal(firstCellFlipped.dataset.idx, sq(7,0)); // h1 first when flipped
});

test('renderBoardSquares highlights the lesson focus square only while the lesson goal is not yet met', () => {
  const boardEl = makeElement();
  initBoardView(boardEl);
  renderBoardSquares({
    board: emptyBoard(), selected: null, lastMove: null, legalTargets: [],
    boardFlipped: false, teachSquare: 'e4', lessonGoalMet: false,
    kingInCheck: {w:false,b:false}, onSquareClick: () => {},
  });
  assert.ok(boardEl.querySelector('[data-idx="'+sq(4,3)+'"]').classList.contains('teach'));

  renderBoardSquares({
    board: emptyBoard(), selected: null, lastMove: null, legalTargets: [],
    boardFlipped: false, teachSquare: 'e4', lessonGoalMet: true,
    kingInCheck: {w:false,b:false}, onSquareClick: () => {},
  });
  assert.equal(boardEl.querySelector('[data-idx="'+sq(4,3)+'"]').classList.contains('teach'), false);
});
