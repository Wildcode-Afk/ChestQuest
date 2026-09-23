/* ============================================================
   INTERFACE — PRÉFÉRENCES UTILISATEUR
   Petite API de lecture/écriture des préférences persistées en
   local (localStorage). Ne connaît ni les règles d'échecs ni le
   reste de l'interface : uniquement le stockage.
   ============================================================ */

function getSoundsEnabled(){
  return localStorage.getItem('chessSoundsEnabled') !== '0';
}
function setSoundsEnabled(enabled){
  localStorage.setItem('chessSoundsEnabled', enabled ? '1' : '0');
}
