/* ============================================================
   COMPTES UTILISATEURS (Supabase Auth + table "profiles")
   ============================================================
   Ce fichier gère : l'inscription, la connexion, la déconnexion,
   la barre de compte dans le header, et le pont de sauvegarde/
   chargement de la progression utilisée par app.js.
   Ne nécessite aucune modification si Supabase est bien configuré
   dans supabase-config.js.
   ============================================================ */
(function(){
  const cfg = window.SUPABASE_CONFIG || {};

  function isConfigured(){
    return !!(cfg.url && cfg.anonKey && !cfg.url.includes('TON-PROJET') && !cfg.anonKey.includes('TON-ANON-KEY'));
  }

  let sb = null;
  if(isConfigured() && window.supabase && window.supabase.createClient){
    sb = window.supabase.createClient(cfg.url, cfg.anonKey);
  }

  let currentUser = null;
  const changeListeners = [];

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  /* ---------- Barre de compte (header) ---------- */
  const authBar = document.getElementById('authBar');

  function renderAuthBar(){
    if(!authBar) return;
    if(!sb){
      authBar.innerHTML = '<span class="auth-note">Comptes non configurés</span>';
      return;
    }
    if(currentUser){
      authBar.innerHTML =
        '<span class="auth-email" id="authProfileBtn" title="Voir mon profil">👤 ' + escapeHtml(displayName(currentUser)) + '</span>' +
        '<button class="btn" id="signOutBtn">Déconnexion</button>';
      document.getElementById('signOutBtn').onclick = signOut;
      const profileBtn = document.getElementById('authProfileBtn');
      if(profileBtn){
        profileBtn.style.cursor = 'pointer';
        profileBtn.onclick = () => { if(window.goToMode) window.goToMode('profile'); };
      }
    } else {
      authBar.innerHTML = '<button class="btn primary" id="authOpenBtn">Connexion</button>';
      document.getElementById('authOpenBtn').onclick = () => openModal('signin');
    }
  }

  /* ---------- Traduction des messages d'erreur Supabase ---------- */
  function translateAuthError(message){
    if(!message) return "Une erreur est survenue.";
    const m = message.toLowerCase();
    if(m.includes('invalid login credentials')) return "Email ou mot de passe incorrect.";
    if(m.includes('user already registered') || m.includes('already registered')) return "Un compte existe déjà avec cet email.";
    if(m.includes('password should be at least')) return "Le mot de passe doit contenir au moins 6 caractères.";
    if(m.includes('email not confirmed')) return "Adresse email non confirmée. Vérifie ta boîte mail.";
    if(m.includes('invalid format') || m.includes('invalid email')) return "Adresse email invalide.";
    if(m.includes('rate limit')) return "Trop de tentatives. Réessaie dans quelques minutes.";
    if(m.includes('for security purposes')) return "Pour des raisons de sécurité, réessaie dans quelques instants.";
    if(m.includes('new password should be different')) return "Le nouveau mot de passe doit être différent de l'ancien.";
    if(m.includes('token has expired') || m.includes('invalid token') || m.includes('otp_expired')) return "Ce lien a expiré ou n'est plus valide. Redemande un email.";
    if(m.includes('same_password')) return "Le nouveau mot de passe doit être différent de l'ancien.";
    if(m.includes('user not found')) return "Aucun compte trouvé avec cet email.";
    if(m.includes('network')) return "Problème de connexion. Vérifie ta connexion internet.";
    return message;
  }

  /* ---------- Modale connexion / inscription / mot de passe oublié ---------- */
  const overlay = document.getElementById('authModalOverlay');
  const modalTitle = document.getElementById('authModalTitle');
  const emailInput = document.getElementById('authEmail');
  const usernameInput = document.getElementById('authUsername');
  const passwordInput = document.getElementById('authPassword');
  const passwordConfirmInput = document.getElementById('authPasswordConfirm');
  const passwordConfirmRow = document.getElementById('authPasswordConfirmRow');
  const forgotRow = document.getElementById('authForgotRow');
  const forgotLink = document.getElementById('authForgotLink');
  const backToSigninRow = document.getElementById('authBackToSigninRow');
  const backToSigninLink = document.getElementById('authBackToSigninLink');
  const errorEl = document.getElementById('authError');
  const submitBtn = document.getElementById('authSubmitBtn');
  const switchText = document.getElementById('authSwitchText');
  const switchLink = document.getElementById('authSwitchLink');
  const closeBtn = document.getElementById('authModalClose');
  const authSwitchRow = switchLink ? switchLink.closest('.auth-switch') : null;

  let authMode = 'signin'; // 'signin' | 'signup' | 'reset' | 'newpassword'

  function openModal(startMode){
    authMode = startMode || 'signin';
    errorEl.textContent = '';
    errorEl.style.color = '';
    emailInput.value = '';
    usernameInput.value = '';
    passwordInput.value = '';
    if(passwordConfirmInput) passwordConfirmInput.value = '';
    updateModalTexts();
    overlay.style.display = 'flex';
    setTimeout(()=>emailInput.focus(), 30);
  }
  function closeModal(){
    overlay.style.display = 'none';
  }
  function updateModalTexts(){
    const passwordRow = document.getElementById('authPasswordRow');
    if(authMode==='signin'){
      modalTitle.textContent = 'Connexion';
      submitBtn.textContent = 'Se connecter';
      switchText.textContent = "Pas encore de compte ?";
      switchLink.textContent = 'Créer un compte';
      usernameInput.style.display = 'none';
      emailInput.style.display = 'block';
      passwordRow.style.display = 'flex';
      if(passwordConfirmRow) passwordConfirmRow.style.display = 'none';
      if(forgotRow) forgotRow.style.display = 'block';
      if(authSwitchRow) authSwitchRow.style.display = 'block';
      if(backToSigninRow) backToSigninRow.style.display = 'none';
    } else if(authMode==='signup'){
      modalTitle.textContent = 'Créer un compte';
      submitBtn.textContent = "S'inscrire";
      switchText.textContent = 'Déjà un compte ?';
      switchLink.textContent = 'Se connecter';
      usernameInput.style.display = 'block';
      emailInput.style.display = 'block';
      passwordRow.style.display = 'flex';
      if(passwordConfirmRow) passwordConfirmRow.style.display = 'none';
      if(forgotRow) forgotRow.style.display = 'none';
      if(authSwitchRow) authSwitchRow.style.display = 'block';
      if(backToSigninRow) backToSigninRow.style.display = 'none';
    } else if(authMode==='reset'){
      modalTitle.textContent = 'Mot de passe oublié';
      submitBtn.textContent = 'Envoyer le lien';
      usernameInput.style.display = 'none';
      emailInput.style.display = 'block';
      passwordRow.style.display = 'none';
      if(passwordConfirmRow) passwordConfirmRow.style.display = 'none';
      if(forgotRow) forgotRow.style.display = 'none';
      if(authSwitchRow) authSwitchRow.style.display = 'none';
      if(backToSigninRow) backToSigninRow.style.display = 'block';
    } else if(authMode==='newpassword'){
      modalTitle.textContent = 'Nouveau mot de passe';
      submitBtn.textContent = 'Enregistrer';
      usernameInput.style.display = 'none';
      emailInput.style.display = 'none';
      passwordInput.placeholder = 'Nouveau mot de passe';
      passwordInput.autocomplete = 'new-password';
      passwordRow.style.display = 'flex';
      if(passwordConfirmRow) passwordConfirmRow.style.display = 'flex';
      if(forgotRow) forgotRow.style.display = 'none';
      if(authSwitchRow) authSwitchRow.style.display = 'none';
      if(backToSigninRow) backToSigninRow.style.display = 'none';
    }
  }

  if(closeBtn) closeBtn.onclick = closeModal;
  if(overlay) overlay.addEventListener('click', (e)=>{ if(e.target===overlay) closeModal(); });
  if(switchLink) switchLink.addEventListener('click', (e)=>{
    e.preventDefault();
    authMode = authMode==='signin' ? 'signup' : 'signin';
    errorEl.textContent = '';
    updateModalTexts();
  });
  if(forgotLink) forgotLink.addEventListener('click', (e)=>{
    e.preventDefault();
    authMode = 'reset';
    errorEl.textContent = '';
    updateModalTexts();
  });
  if(backToSigninLink) backToSigninLink.addEventListener('click', (e)=>{
    e.preventDefault();
    authMode = 'signin';
    errorEl.textContent = '';
    passwordInput.placeholder = 'Mot de passe';
    passwordInput.autocomplete = 'current-password';
    updateModalTexts();
  });

  function wirePasswordToggle(toggleId, inputId){
    const btn = document.getElementById(toggleId);
    const inp = document.getElementById(inputId);
    if(!btn || !inp) return;
    btn.addEventListener('click', ()=>{
      const showing = inp.type === 'text';
      inp.type = showing ? 'password' : 'text';
      btn.textContent = showing ? '👁️' : '🙈';
      btn.setAttribute('aria-label', showing ? 'Afficher le mot de passe' : 'Masquer le mot de passe');
    });
  }
  wirePasswordToggle('authPasswordToggle', 'authPassword');
  wirePasswordToggle('authPasswordConfirmToggle', 'authPasswordConfirm');

  async function handleSubmit(){
    if(!sb) return;

    if(authMode==='reset'){
      const email = emailInput.value.trim();
      if(!email){ errorEl.textContent = 'Renseigne ton email.'; return; }
      submitBtn.disabled = true;
      errorEl.textContent = '';
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
      submitBtn.disabled = false;
      if(error){ errorEl.style.color = ''; errorEl.textContent = translateAuthError(error.message); return; }
      errorEl.style.color = 'var(--green)';
      errorEl.textContent = 'Email envoyé ! Clique sur le lien qu\'il contient pour choisir un nouveau mot de passe.';
      return;
    }

    if(authMode==='newpassword'){
      const pw = passwordInput.value;
      const pw2 = passwordConfirmInput ? passwordConfirmInput.value : pw;
      if(pw.length < 6){ errorEl.textContent = 'Le mot de passe doit contenir au moins 6 caractères.'; return; }
      if(pw !== pw2){ errorEl.textContent = 'Les deux mots de passe ne correspondent pas.'; return; }
      submitBtn.disabled = true;
      errorEl.textContent = '';
      const { error } = await sb.auth.updateUser({ password: pw });
      submitBtn.disabled = false;
      if(error){ errorEl.textContent = translateAuthError(error.message); return; }
      closeModal();
      authMode = 'signin';
      passwordInput.placeholder = 'Mot de passe';
      passwordInput.autocomplete = 'current-password';
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const username = usernameInput.value.trim();
    if(!email || !password){
      errorEl.textContent = 'Renseigne un email et un mot de passe.';
      return;
    }
    if(authMode==='signup' && !username){
      errorEl.textContent = 'Choisis un pseudo.';
      return;
    }
    submitBtn.disabled = true;
    errorEl.textContent = '';
    let res;
    if(authMode==='signup'){
      res = await sb.auth.signUp({ email, password, options: { data: { username } } });
    } else {
      res = await sb.auth.signInWithPassword({ email, password });
    }
    submitBtn.disabled = false;
    if(res.error){
      errorEl.textContent = translateAuthError(res.error.message);
      return;
    }
    if(authMode==='signup' && res.data && res.data.user && !res.data.session){
      errorEl.style.color = 'var(--green)';
      errorEl.textContent = 'Compte créé ! Vérifie ta boîte mail pour confirmer, puis connecte-toi.';
      return;
    }
    closeModal();
  }
  if(submitBtn) submitBtn.addEventListener('click', handleSubmit);
  [emailInput, usernameInput, passwordInput, passwordConfirmInput].forEach(inp=>{
    if(inp) inp.addEventListener('keydown', (e)=>{ if(e.key==='Enter') handleSubmit(); });
  });

  async function signOut(){
    if(!sb) return;
    await sb.auth.signOut();
  }

  /* ---------- Session ---------- */
  if(sb){
    sb.auth.onAuthStateChange((_event, session)=>{
      currentUser = session ? session.user : null;
      renderAuthBar();
      changeListeners.forEach(cb => cb(currentUser));
      if(_event==='PASSWORD_RECOVERY'){
        openModal('newpassword');
      }
    });
  } else {
    renderAuthBar();
  }

  /* ---------- Progression (table "profiles") ---------- */
  async function loadProgress(){
    if(!sb || !currentUser) return null;
    const { data, error } = await sb.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
    if(error){ console.error('Erreur de chargement de la progression :', error); return null; }
    return data;
  }
  async function saveProgress(payload){
    if(!sb || !currentUser) return;
    const row = Object.assign({ id: currentUser.id, updated_at: new Date().toISOString() }, payload);
    const { error } = await sb.from('profiles').upsert(row);
    if(error) console.error('Erreur de sauvegarde de la progression :', error);
  }

  /* ---------- Ping (latence) ---------- */
  async function ping(){
    if(!cfg.url) return null;
    const t0 = performance.now();
    try{
      await fetch(cfg.url + '/auth/v1/health', { cache: 'no-store' });
    }catch(e){ return null; }
    return Math.round(performance.now() - t0);
  }

  /* ---------- Chat & présence ---------- */
  let chatChannel = null;
  let presenceChannel = null;

  function displayName(user){
    if(!user) return 'Invité';
    return (user.user_metadata && user.user_metadata.username) || (user.email ? user.email.split('@')[0] : 'Joueur');
  }

  async function loadRecentMessages(limit){
    if(!sb) return [];
    const { data, error } = await sb.from('chat_messages').select('*').order('created_at', { ascending:false }).limit(limit||30);
    if(error){ console.error('Erreur de chargement du chat :', error); return []; }
    return data.reverse();
  }
  async function sendMessage(content, badges, country, elo){
    if(!sb || !currentUser) return;
    const username = displayName(currentUser);
    const { error } = await sb.from('chat_messages').insert({ user_id: currentUser.id, username, content, badges: badges||[], country: country||null, elo: (typeof elo==='number' ? elo : null) });
    if(error) console.error('Erreur d\'envoi du message :', error);
  }
  function subscribeChat(onInsert){
    if(!sb) return;
    if(chatChannel) sb.removeChannel(chatChannel);
    chatChannel = sb.channel('public:chat_messages')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'chat_messages' }, payload => onInsert(payload.new))
      .subscribe();
  }
  function joinPresence(onSync){
    if(!sb) return;
    if(presenceChannel) sb.removeChannel(presenceChannel);
    const key = currentUser ? currentUser.id : ('invite-' + Math.random().toString(36).slice(2));
    presenceChannel = sb.channel('online-players', { config: { presence: { key } } });
    presenceChannel.on('presence', { event:'sync' }, () => {
      const state = presenceChannel.presenceState();
      onSync(Object.keys(state).length);
    });
    presenceChannel.subscribe(async (status) => {
      if(status==='SUBSCRIBED'){
        await presenceChannel.track({ username: displayName(currentUser), online_at: new Date().toISOString() });
      }
    });
  }

  /* ---------- API exposée à app.js ---------- */
  /* ---------- Modifier le pseudo / supprimer le compte ---------- */
  async function updateProfile(fields){
    if(!sb || !currentUser) return false;
    const username = fields.username;
    if(username !== undefined){
      const { error: err1 } = await sb.auth.updateUser({ data: { username } });
      if(err1){ console.error('Erreur de mise à jour du pseudo (auth) :', err1); return false; }
    }
    const patch = {};
    if(fields.username !== undefined) patch.username = fields.username;
    if(fields.country !== undefined) patch.country = fields.country;
    if(fields.featuredBadge !== undefined) patch.featured_badge = fields.featuredBadge;
    const { error: err2 } = await sb.from('profiles').update(patch).eq('id', currentUser.id);
    if(err2){ console.error('Erreur de mise à jour du profil :', err2); return false; }
    if(username !== undefined){
      currentUser = Object.assign({}, currentUser, { user_metadata: Object.assign({}, currentUser.user_metadata, { username }) });
    }
    renderAuthBar();
    changeListeners.forEach(cb => cb(currentUser));
    return true;
  }
  async function updateEmail(newEmail){
    if(!sb || !currentUser) return { ok:false, error:'Non connecté.' };
    const { error } = await sb.auth.updateUser({ email: newEmail });
    if(error){ console.error('Erreur de mise à jour de l\'email :', error); return { ok:false, error: error.message }; }
    return { ok:true };
  }
  async function updatePassword(newPassword){
    if(!sb || !currentUser) return { ok:false, error:'Non connecté.' };
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if(error){ console.error('Erreur de mise à jour du mot de passe :', error); return { ok:false, error: error.message }; }
    return { ok:true };
  }
  async function deleteAccount(){
    if(!sb || !currentUser) return false;
    const { error } = await sb.rpc('delete_own_account');
    if(error){ console.error('Erreur de suppression du compte :', error); return false; }
    await sb.auth.signOut();
    return true;
  }

  window.ChessAuth = {
    isConfigured,
    getUser: () => currentUser,
    displayName: () => displayName(currentUser),
    ping,
    updateProfile,
    updateEmail,
    updatePassword,
    translateError: translateAuthError,
    deleteAccount,
    onChange: (cb) => {
      changeListeners.push(cb);
      if(sb) cb(currentUser); // envoie l'état courant immédiatement
    }
  };
  window.ChessProgress = {
    load: loadProgress,
    save: saveProgress
  };
  window.ChessChat = {
    loadRecent: loadRecentMessages,
    send: sendMessage,
    subscribe: subscribeChat,
    joinPresence
  };

  /* ---------- Classement & historique des parties ---------- */
  async function loadLeaderboard(limit){
    if(!sb) return [];
    const { data, error } = await sb.from('profiles')
      .select('username, progressive_elo, wins_count, losses_count, draws_count, badges, country, featured_badge')
      .not('username', 'is', null)
      .order('progressive_elo', { ascending:false })
      .limit(limit||10);
    if(error){ console.error('Erreur de chargement du classement :', error); return []; }
    return data;
  }
  async function saveGameHistory(entry){
    if(!sb || !currentUser) return;
    const row = Object.assign({ user_id: currentUser.id }, entry);
    const { error } = await sb.from('game_history').insert(row);
    if(error) console.error('Erreur d\'enregistrement de la partie :', error);
  }
  async function loadHistory(limit){
    if(!sb || !currentUser) return [];
    const { data, error } = await sb.from('game_history').select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending:false })
      .limit(limit||10);
    if(error){ console.error('Erreur de chargement de l\'historique :', error); return []; }
    return data;
  }
  async function loadHistoryById(id){
    if(!sb || !currentUser) return null;
    const { data, error } = await sb.from('game_history').select('*')
      .eq('id', id).eq('user_id', currentUser.id).maybeSingle();
    if(error){ console.error('Erreur de chargement de la partie :', error); return null; }
    return data;
  }
  window.ChessSocial = {
    loadLeaderboard,
    saveGameHistory,
    loadHistory,
    loadHistoryById
  };

  /* ---------- Parties en direct (onglet Live) ---------- */
  let liveGamesChannel = null;
  async function upsertLiveGame(payload){
    if(!sb || !currentUser) return;
    const row = Object.assign({ user_id: currentUser.id }, payload, { updated_at: new Date().toISOString() });
    const { error } = await sb.from('live_games').upsert(row, { onConflict:'user_id' });
    if(error) console.error('Erreur de mise à jour de la partie en direct :', error);
  }
  async function removeLiveGame(){
    if(!sb || !currentUser) return;
    const { error } = await sb.from('live_games').delete().eq('user_id', currentUser.id);
    if(error) console.error('Erreur de suppression de la partie en direct :', error);
  }
  async function loadLiveGames(limit){
    if(!sb) return [];
    const freshSince = new Date(Date.now() - 5*60000).toISOString(); // ignore les parties abandonnées (onglet fermé sans nettoyage)
    const { data, error } = await sb.from('live_games').select('*')
      .gte('updated_at', freshSince)
      .order('updated_at', { ascending:false })
      .limit(limit||10);
    if(error){ console.error('Erreur de chargement des parties en direct :', error); return []; }
    return data;
  }
  function subscribeLiveGames(onChange){
    if(!sb) return;
    if(liveGamesChannel) sb.removeChannel(liveGamesChannel);
    liveGamesChannel = sb.channel('public:live_games')
      .on('postgres_changes', { event:'*', schema:'public', table:'live_games' }, payload => onChange(payload))
      .subscribe();
  }
  async function loadLiveGameById(id){
    if(!sb) return null;
    const { data, error } = await sb.from('live_games').select('*').eq('id', id).maybeSingle();
    if(error){ console.error('Erreur de chargement de la partie en direct :', error); return null; }
    return data;
  }
  window.ChessLive = {
    upsert: upsertLiveGame,
    remove: removeLiveGame,
    loadRecent: loadLiveGames,
    getById: loadLiveGameById,
    subscribe: subscribeLiveGames
  };

  /* ---------- Parties en ligne (Ami via lien + Matchmaking) ---------- */
  let onlineGameChannel = null;

  async function createFriendGame(opts){
    if(!sb || !currentUser) return null;
    const username = displayName(currentUser);
    const row = {
      created_by: currentUser.id,
      is_friend_game: true,
      status: 'waiting',
      time_control_base: opts.base,
      time_control_inc: opts.inc || 0
    };
    if(opts.color==='b'){ row.black_id = currentUser.id; row.black_username = username; }
    else { row.white_id = currentUser.id; row.white_username = username; }
    const { data, error } = await sb.from('online_games').insert(row).select().maybeSingle();
    if(error){ console.error('Erreur de création de la partie :', error); return null; }
    return data;
  }
  async function cancelFriendGame(gameId){
    if(!sb || !currentUser) return false;
    const { error } = await sb.from('online_games').delete().eq('id', gameId).eq('created_by', currentUser.id);
    if(error){ console.error('Erreur d\'annulation de la partie :', error); return false; }
    return true;
  }
  async function joinFriendGame(gameId){
    if(!sb || !currentUser) return false;
    const { data, error } = await sb.rpc('join_friend_game', { game_id: gameId });
    if(error){ console.error('Erreur pour rejoindre la partie :', error); return false; }
    return !!data;
  }
  async function getOnlineGame(gameId){
    if(!sb) return null;
    const { data, error } = await sb.from('online_games').select('*').eq('id', gameId).maybeSingle();
    if(error){ console.error('Erreur de chargement de la partie en ligne :', error); return null; }
    return data;
  }
  async function updateOnlineGame(gameId, patch){
    if(!sb || !currentUser) return false;
    const { error } = await sb.from('online_games').update(patch).eq('id', gameId);
    if(error){ console.error('Erreur de mise à jour de la partie en ligne :', error); return false; }
    return true;
  }
  function subscribeOnlineGame(gameId, onChange){
    if(!sb) return;
    if(onlineGameChannel) sb.removeChannel(onlineGameChannel);
    onlineGameChannel = sb.channel('online-game-'+gameId)
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'online_games', filter:'id=eq.'+gameId }, payload => onChange(payload.new))
      .subscribe();
  }
  function unsubscribeOnlineGame(){
    if(onlineGameChannel){ sb.removeChannel(onlineGameChannel); onlineGameChannel = null; }
  }
  async function findMyActiveOnlineGame(){
    if(!sb || !currentUser) return null;
    const { data, error } = await sb.from('online_games').select('*')
      .or('white_id.eq.'+currentUser.id+',black_id.eq.'+currentUser.id)
      .eq('status','active')
      .order('created_at', { ascending:false })
      .limit(1)
      .maybeSingle();
    if(error){ console.error('Erreur de recherche de partie en cours :', error); return null; }
    return data;
  }
  async function enterQueue(opts){
    if(!sb || !currentUser) return false;
    const username = displayName(currentUser);
    const row = {
      user_id: currentUser.id, username,
      elo: opts.elo || null,
      time_control_base: opts.base,
      time_control_inc: opts.inc || 0
    };
    const { error } = await sb.from('matchmaking_queue').upsert(row);
    if(error){ console.error('Erreur pour rejoindre le salon :', error); return false; }
    return true;
  }
  async function leaveQueue(){
    if(!sb || !currentUser) return;
    await sb.from('matchmaking_queue').delete().eq('user_id', currentUser.id);
  }
  async function tryMatch(){
    if(!sb || !currentUser) return null;
    const { data, error } = await sb.rpc('try_matchmake');
    if(error){ console.error('Erreur d\'appariement :', error); return null; }
    return data;
  }

  window.ChessOnline = {
    createFriendGame,
    cancelFriendGame,
    joinFriendGame,
    getGame: getOnlineGame,
    updateGame: updateOnlineGame,
    subscribe: subscribeOnlineGame,
    unsubscribe: unsubscribeOnlineGame,
    findMyActiveGame: findMyActiveOnlineGame,
    enterQueue,
    leaveQueue,
    tryMatch
  };
})();
