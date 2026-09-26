# ChestQuest — Flux en ligne : cartographie et contrat client/service

Établie par inspection du code (`auth.js`, `app.js`, `setup.sql`). Décrit ce
qui existe **réellement**, pas une architecture cible.

## 1. Parties Live (aperçu, lecture seule pour les autres joueurs)

Table `live_games` (une ligne par joueur, `user_id` unique). Chaque joueur en
partie IA/Coach met à jour **sa propre ligne** (`window.ChessLive.upsert`),
visible par tous en lecture (`for select using (true)`), mais seul le
propriétaire peut l'écrire (`using (auth.uid() = user_id)`). Onglet "Live" et
le mode Spectateur ne font que lire. Risque faible : chaque joueur ne peut
altérer que sa propre partie, jamais celle d'un autre.

## 2. Invitations (partie contre un ami)

1. Le créateur appelle `ChessOnline.createFriendGame` → insertion dans
   `online_games` avec `status:'waiting'`, lui-même comme `white_id` ou
   `black_id` selon la couleur choisie.
2. Le lien partagé contient `?join=<id de la partie>` (`copyFriendLink`).
3. Au chargement, `checkPendingJoinParam` lit ce paramètre ; une fois
   connecté, `maybeShowJoinPrompt` affiche l'invitation.
4. Accepter appelle la fonction serveur **`join_friend_game(game_id)`** :
   vérifie que la partie existe, est `'waiting'`, que le joueur n'est pas déjà
   l'un des deux camps, puis assigne la couleur restante et passe la partie à
   `'active'` — **row locking (`for update`) côté serveur**, donc deux
   joueurs ne peuvent pas rejoindre la même place simultanément.

## 3. Matchmaking aléatoire

1. `ChessOnline.enterQueue` insère/actualise une ligne dans
   `matchmaking_queue`.
2. Le client sonde (`pollMatchmaking`, toutes les 2s) la fonction serveur
   **`try_matchmake()`** : cherche un adversaire compatible (même cadence),
   verrouille sa ligne (`for update skip locked`), crée la partie
   `online_games` et vide la file — également atomique côté serveur.
3. Si un autre joueur nous apparie avant que notre propre sondage réussisse,
   `findMyActiveGame` le détecte au sondage suivant.

**Constat** : la création de partie, la jonction et l'appariement sont
**déjà validés côté serveur** (fonctions Postgres avec verrouillage de
lignes). Aucune action nécessaire sur ces trois points.

## 4. Échanges réseau pendant une partie — le contrat, et sa vraie limite

### Contrat actuel entre le client et la table `online_games`

| Concept demandé | Champ(s) réels | Type / valeurs |
|---|---|---|
| Identité de partie | `id` | uuid |
| Joueur autorisé | `white_id`, `black_id`, `created_by` | uuid ou null |
| Version / numéro de coup | `move_count` | entier, incrémenté de 1 à chaque coup |
| Horloge | `white_time_ms`, `black_time_ms`, `last_move_at` | ms restants, horodatage ISO |
| Résultat | `status` (`waiting`/`active`/`finished`), `result` (`white`/`black`/`draw`/null), `result_reason` | texte |
| Plateau / trait | `board` (jsonb), `turn`, `last_from`, `last_to`, `last_promo` | tableau de 64 cases, `'w'`/`'b'`, index 0-63 |

### Ce qui est déjà validé côté client à la réception (avant cette étape)

`applyRemoteOnlineMove` ne fait **pas** confiance aveuglément au plateau
transmis : il cherche, parmi les coups légaux calculés localement
(`legalMoves(gameState)`), celui qui correspond à `last_from`/`last_to`, et
c'est le moteur local qui recalcule le plateau résultant. Ce n'est que si
aucun coup légal ne correspond (désynchronisation) que le plateau transmis
est appliqué tel quel.

### La vraie limite (pas de validation serveur des coups)

La policy `update` de `online_games` vérifie **qui** peut écrire (l'un des
deux joueurs ou le créateur), mais **jamais quoi** : rien côté serveur
n'empêche un client de pousser un `move_count` qui saute des valeurs, un
`turn` incohérent avec le nombre de coups, un plateau invalide, ou un
`result` fantaisiste. Un client buggé ou modifié pourrait donc, en théorie,
falsifier l'état d'une partie en cours. C'est une limite réelle et assumée du
projet tel qu'il existe, pas quelque chose que cette étape a introduit.

## 5. Ce que cette étape fait

**Ne redessine pas l'expérience multijoueur, ne change pas le protocole** :
aucun champ ajouté/retiré/renommé dans `online_games`/`live_games`/
`matchmaking_queue`, aucun paquet envoyé au serveur modifié.

**Côté client** (`chess-online-contract.js`, nouveau module) : formalise le
contrat ci-dessus en code (`validateOnlineGameRow`, `isValidBoardArray`,
`hasNewMove`) et l'utilise pour **renforcer la réception** — une ligne
malformée est désormais détectée et journalisée au lieu d'être appliquée
telle quelle, en particulier pour le cas de désynchronisation qui faisait
déjà confiance au plateau transmis sans vérifier sa forme.

**Côté serveur** : le projet **possède** déjà de la validation serveur pour
la création/jonction/appariement (voir sections 2-3), mais aucune pour les
mises à jour de coup. Un déclencheur (`trigger`) Postgres candidat est fourni
séparément (`setup-online-move-validation.sql`, non appliqué automatiquement)
pour renforcer ce point précis — voir ce fichier pour le détail et
l'avertissement sur les risques de le déployer sans test préalable sur une
vraie instance Supabase.

## 6. Limites restantes (assumées)

- Le déclencheur SQL candidat n'a **pas pu être testé** contre une instance
  Supabase réelle depuis cet environnement — à valider par le joueur/mainteneur
  avant toute mise en production.
- Le cas de désynchronisation continue, après validation de forme, à faire
  confiance au plateau transmis si aucun coup légal ne correspond
  (comportement préexistant, conservé pour ne pas changer le protocole ni
  l'expérience — une vraie reconstruction de ce cas serait une refonte du
  protocole, hors périmètre).
- Aucune validation de la légalité du coup n'est ajoutée côté serveur pour le
  cas où le trigger candidat n'est pas déployé.
