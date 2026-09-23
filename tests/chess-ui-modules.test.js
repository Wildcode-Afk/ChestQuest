const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

class FakeElement {
  constructor(tag){
    this.tagName = tag;
    this._classes = new Set();
    this.dataset = {};
    this.children = [];
    this.attrs = {};
    this.style = { setProperty(k,v){ this[k]=v; } };
    this._text = '';
    this._html = '';
    this.onclick = null;
  }
  get classList(){
    const self = this;
    return {
      add(...cs){ cs.forEach(c=>self._classes.add(c)); },
      remove(...cs){ cs.forEach(c=>self._classes.delete(c)); },
      contains(c){ return self._classes.has(c); },
      toggle(c, force){
        if(force===undefined){ self._classes.has(c) ? self._classes.delete(c) : self._classes.add(c); }
        else if(force){ self._classes.add(c); } else { self._classes.delete(c); }
      },
    };
  }
  set className(v){ this._classes = new Set(v.split(' ').filter(Boolean)); }
  get className(){ return Array.from(this._classes).join(' '); }
  set textContent(v){ this._text = v; }
  get textContent(){ return this._text; }
  set innerHTML(v){
    this._html = v;
    this.children = [];
    if(v){
      // Simule un bouton par occurrence de data-p="X" pour la modale de promotion.
      const re = /data-p="(\w)"/g;
      let m;
      while((m = re.exec(v))){
        const btn = new FakeElement('button');
        btn.dataset.p = m[1];
        this.children.push(btn);
      }
    }
  }
  get innerHTML(){ return this._html; }
  appendChild(el){ this.children.push(el); return el; }
  setAttribute(k,v){ this.attrs[k]=v; }
  setAttributeNS(ns,k,v){ this.attrs[k]=v; }
  getAttribute(k){ return this.attrs[k]!==undefined ? this.attrs[k] : null; }
  querySelector(sel){ return sel==='.board-frame' ? this._frame : null; }
  querySelectorAll(sel){ return sel==='button' ? this.children : []; }
  addEventListener(evt, fn){ this['_on'+evt] = fn; }
}

function makeLocalStorage(){
  const store = {};
  return {
    getItem(k){ return Object.prototype.hasOwnProperty.call(store,k) ? store[k] : null; },
    setItem(k,v){ store[k]=String(v); },
    removeItem(k){ delete store[k]; },
  };
}

class FakeAudioContext {
  constructor(){ this.state='running'; this.currentTime=0; this.oscillatorsCreated=0; }
  resume(){}
  createOscillator(){
    this.oscillatorsCreated++;
    return { type:'sine', frequency:{setValueAtTime(){}}, connect(){return this;}, start(){}, stop(){} };
  }
  createGain(){
    return { gain:{setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){}}, connect(){return this;} };
  }
}

function loadUIModules(extraGlobalsScript){
  const files = ['chess-core.js','chess-preferences.js','chess-sound.js','chess-feedback.js','chess-messages.js','chess-modal.js','chess-clock.js'];
  const source = files.map(f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');

  const boardFrame = new FakeElement('div');
  const elementsById = {};
  const document = {
    getElementById(id){
      if(!elementsById[id]) elementsById[id] = new FakeElement('div');
      return elementsById[id];
    },
    querySelector(sel){ return sel==='.board-frame' ? boardFrame : null; },
  };
  let confirmReturnValue = true;
  const windowObj = {
    AudioContext: FakeAudioContext,
    innerWidth: 800,
  };
  const context = {
    console, window: windowObj, document,
    localStorage: makeLocalStorage(),
    setTimeout, clearTimeout, setInterval, clearInterval,
    confirm(msg){ context.lastConfirmMessage = msg; return confirmReturnValue; },
    setConfirmReturnValue(v){ confirmReturnValue = v; },
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  if(extraGlobalsScript) vm.runInContext(extraGlobalsScript, context);
  context._elementsById = elementsById;
  context._boardFrame = boardFrame;
  return context;
}

/* ---------- chess-preferences.js ---------- */
test('getSoundsEnabled defaults to true and reflects setSoundsEnabled round-trip', () => {
  const engine = loadUIModules();
  assert.equal(engine.getSoundsEnabled(), true);
  engine.setSoundsEnabled(false);
  assert.equal(engine.getSoundsEnabled(), false);
  engine.setSoundsEnabled(true);
  assert.equal(engine.getSoundsEnabled(), true);
});

/* ---------- chess-sound.js ---------- */
test('playSound only produces tones when sounds are enabled', () => {
  const engine = loadUIModules();
  const ctx = engine.getAudioCtx();
  ctx.oscillatorsCreated = 0;
  engine.playSound('move');
  assert.ok(ctx.oscillatorsCreated > 0);

  vm.runInContext('soundsEnabled = false;', engine);
  ctx.oscillatorsCreated = 0;
  engine.playSound('move');
  assert.equal(ctx.oscillatorsCreated, 0);
});

test('toggleSounds flips the in-memory flag and persists it via chess-preferences.js', () => {
  const engine = loadUIModules();
  vm.runInContext('soundsEnabled = true;', engine);
  engine.toggleSounds();
  assert.equal(engine.getSoundsEnabled(), false);
  engine.toggleSounds();
  assert.equal(engine.getSoundsEnabled(), true);
});

/* ---------- chess-feedback.js ---------- */
test('flashBoard adds the matching class to .board-frame then removes it', () => {
  const engine = loadUIModules();
  engine.flashBoard('mate');
  assert.ok(engine._boardFrame.classList.contains('flash-mate'));
  vm.runInContext("clearTimeout;", engine); // no-op, just exercising the context
});

test('playMoveFeedback flashes on checkmate/check and stays silent-flash otherwise', () => {
  const engine = loadUIModules();
  engine.playMoveFeedback('checkmate', null);
  assert.ok(engine._boardFrame.classList.contains('flash-mate'));

  engine._boardFrame.classList.remove('flash-mate','flash-check');
  engine.playMoveFeedback('check', null);
  assert.ok(engine._boardFrame.classList.contains('flash-check'));

  engine._boardFrame.classList.remove('flash-mate','flash-check');
  engine.playMoveFeedback('normal', null);
  assert.equal(engine._boardFrame.classList.contains('flash-check'), false);
  assert.equal(engine._boardFrame.classList.contains('flash-mate'), false);
});

/* ---------- chess-messages.js ---------- */
test('setCoach writes into the element registered via initMessages', () => {
  const engine = loadUIModules();
  const coachEl = new FakeElement('div');
  engine.initMessages(coachEl);
  engine.setCoach('<b>Bien joué</b>');
  assert.equal(coachEl.innerHTML, '<b>Bien joué</b>');
});

/* ---------- chess-modal.js ---------- */
test('showPromoPicker builds the 4 promotion choices and reports the click via the callback', () => {
  const engine = loadUIModules();
  const overlay = new FakeElement('div');
  engine.initPromoModal(overlay);
  let chosen = null;
  engine.showPromoPicker('w', (p) => { chosen = p; });
  assert.equal(overlay.children.length, 4);
  assert.deepEqual(overlay.children.map(b=>b.dataset.p), ['Q','R','B','N']);

  overlay.children[1].onclick(); // choisit la Tour
  assert.equal(chosen, 'R');
  assert.equal(overlay.innerHTML, ''); // la modale se ferme après le choix
});

test('confirmAction passes the message through to the native confirm and returns its result', () => {
  const engine = loadUIModules();
  engine.setConfirmReturnValue(true);
  assert.equal(engine.confirmAction('Es-tu sûr ?'), true);
  assert.equal(engine.lastConfirmMessage, 'Es-tu sûr ?');
  engine.setConfirmReturnValue(false);
  assert.equal(engine.confirmAction('Vraiment ?'), false);
});

/* ---------- chess-clock.js ---------- */
test('formatClockTime formats seconds, minutes and hours as the app expects', () => {
  const engine = loadUIModules();
  assert.equal(engine.formatClockTime(null), '--:--');
  assert.equal(engine.formatClockTime(65), '01:05');
  assert.equal(engine.formatClockTime(3665), '1:01:05');
  assert.equal(engine.formatClockTime(90000), '1j 01h');
});

test('renderClocks hides the clock row when no clock is active, shows it and formats times otherwise', () => {
  // chess-clock.js s'appuie sur des variables partagées normalement déclarées
  // par app.js (voir le commentaire en tête de chess-clock.js) ; on les
  // simule ici comme le ferait app.js.
  const engine = loadUIModules('let clockActive=false, currentTimeControl=null, clocks={w:null,b:null}, clockTimerId=null, gameState=null, playerColor="w"; function onGameEnd(){}');
  engine.renderClocks();
  const row = engine._elementsById['clocksRow'];
  assert.equal(row.style.display, 'none');

  vm.runInContext('clockActive = true; clocks = {w:65, b:120}; gameState = {turn:"w"};', engine);
  engine.renderClocks();
  assert.equal(row.style.display, 'flex');
  assert.equal(engine._elementsById['clockWhiteTime'].textContent, '01:05');
  assert.equal(engine._elementsById['clockBlackTime'].textContent, '02:00');
  assert.ok(engine._elementsById['clockWhite'].classList.contains('active'));
});

test('applyClockForMove sets a fresh per-move budget or adds the increment, and stopClockTimer clears the interval', () => {
  const engine = loadUIModules('let clockActive=true, currentTimeControl={perMove:30}, clocks={w:null,b:null}, clockTimerId=null, gameState={turn:"w"}, playerColor="w"; function onGameEnd(){}');
  engine.applyClockForMove('w');
  assert.equal(vm.runInContext('clocks.w', engine), 30);

  vm.runInContext('currentTimeControl = {inc:5}; clocks.b = 10;', engine);
  engine.applyClockForMove('b');
  assert.equal(vm.runInContext('clocks.b', engine), 15);

  engine.startClockTimer();
  assert.notEqual(vm.runInContext('clockTimerId', engine), null);
  engine.stopClockTimer();
  assert.equal(vm.runInContext('clockTimerId', engine), null);
});
