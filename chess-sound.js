/* ============================================================
   INTERFACE — SONS
   Petite API de lecture/écriture des sons du jeu. Ne connaît
   ni les règles d'échecs ni le reste de l'interface : uniquement
   le son. Utilise chess-preferences.js pour se souvenir du choix
   du joueur (chargé avant ce fichier).
   ============================================================ */

let audioCtx = null;
let soundsEnabled = getSoundsEnabled();

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
  setSoundsEnabled(soundsEnabled);
  updateSoundToggleUI();
  if(soundsEnabled) playSound('move');
}
function updateSoundToggleUI(){
  const btn = document.getElementById('soundToggleBtn');
  if(btn) btn.textContent = soundsEnabled ? '🔊' : '🔇';
}
const soundToggleBtnEl = document.getElementById('soundToggleBtn');
if(soundToggleBtnEl){ soundToggleBtnEl.addEventListener('click', toggleSounds); updateSoundToggleUI(); }
