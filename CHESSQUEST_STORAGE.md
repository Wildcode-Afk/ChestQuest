# ChestQuest — Cartographie des stockages

Établie par inspection du code (`auth.js`, `app.js`, `chess-preferences.js`,
`setup.sql`). Liste ce qui existe **réellement**, pas une architecture cible.

## 1. Authentification — Supabase Auth, via `window.ChessAuth`

Déjà isolée derrière une seule API (`auth.js`) : `isConfigured`, `getUser`,
`displayName`, `ping`, `updateProfile`, `updateEmail`, `updatePassword`,
`translateError`, `deleteAccount`, `onChange`. `app.js` n'appelle jamais
`sb.auth.*` directement — toujours via `window.ChessAuth`.

## 2. Base de données — Supabase, 6 tables, 6 façades distinctes dans `auth.js`

| Table | Façade exposée | Contenu |
|---|---|---|
| `profiles` | `window.ChessProgress` (load/save) + `window.ChessAuth.updateProfile` (pseudo/pays/badge affiché) | Une ligne par joueur : pseudo, Elo, progression, stats, pays, badge affiché |
| `game_history` | `window.ChessSocial` (saveGameHistory/loadHistory/loadHistoryById) | Parties terminées (mode practice/coach), pour la page "Historique" et la revue de partie |
| `live_games` | `window.ChessLive` | Aperçu des parties IA/Coach en cours (onglet "Live") |
| `online_games` | `window.ChessOnline` | Parties en ligne (ami ou aléatoire) |
| `matchmaking_queue` | `window.ChessOnline` (enterQueue/leaveQueue/tryMatch) | File d'attente du matchmaking aléatoire |
| `chat_messages` | `window.ChessChat` | Messages du chat des joueurs connectés |

Chaque table a déjà sa propre façade nommée — `app.js` ne lit jamais une table
Supabase directement, toujours via l'une de ces six façades. Le problème que
cette étape corrige n'est donc pas "app.js lit du SQL brut", mais : la
**progression** (profils) est reconstruite/reconstruite par deux fonctions
d'`app.js` (`applyLoadedProgress`/`queueSaveProgress`) qui mélangent lecture
d'état en mémoire (Elo, badges, stats) et appel direct au service Supabase, à
un seul endroit non nommé comme tel — voir section 6.

## 3. Stockage local — `localStorage`, un seul réglage

Déjà isolé dans `chess-preferences.js` (`getSoundsEnabled`/`setSoundsEnabled`),
seule clé utilisée : `chessSoundsEnabled`. `app.js` ne touche jamais
`localStorage` directement (vérifié : aucune occurrence dans `app.js`).

## 4. Elo — état en mémoire dans `app.js`, persisté via `profiles`

Deux valeurs : `progressiveElo` (mode "IA progressive") et `fixedElo` (mode
"Elo fixe"), déclarées dans `app.js`. Chargées par `applyLoadedProgress`
(champs `progressive_elo`/`fixed_elo` de `profiles`), sauvegardées par
`queueSaveProgress`. Le **calcul** de l'Elo (ajustement après victoire/défaite)
vit ailleurs dans `app.js` et n'a pas été touché par cette étape (demande
explicite : ne pas modifier les règles de calcul Elo).

## 5. Historique — deux notions distinctes, à ne pas confondre

- **Historique des coups d'une partie en cours** (notation affichée à
  l'écran) : `chess-history.js` (`moveNotation`, `createHistoryEntry`),
  entièrement en mémoire, sans lien avec Supabase. Non concerné par cette
  étape.
- **Historique des parties terminées** (page "Historique", revue de partie) :
  table Supabase `game_history`, via `window.ChessSocial`. C'est celui visé
  par cette étape.

## 6. Progression — le point de mélange identifié, maintenant isolé

Avant cette étape, `app.js` avait deux fonctions qui mélangeaient : lecture/
écriture de 10 variables d'état en mémoire (leçons/puzzles/solitaire
complétés, Elo, mode IA, stats de victoires, pays, badge affiché) **et**
appel direct à `window.ChessProgress` (le service Supabase) — sans que cet
endroit soit identifié comme un point de passage unique.

**Ce que cette étape fait** : `applyLoadedProgress` et `queueSaveProgress`
déplacées telles quelles dans un nouveau fichier `chess-progress-service.js`,
qui devient le seul endroit où l'état de progression en mémoire et le service
Supabase `ChessProgress` se rencontrent. Validations défensives ajoutées
(types/plages), sans changer le format des données envoyées/reçues (mêmes
noms de colonnes, même structure).

**Ce que cette étape ne fait pas** (limites assumées, voir le rapport de
l'étape) : les ~30 endroits d'`app.js` qui *lisent* `progressiveElo`/
`fixedElo`/`completedLessons`/etc. pour l'affichage (badges, profil, écran
d'accueil) n'ont pas été rewiring vers un accesseur — ce sont des lectures
d'état applicatif en mémoire, pas des lectures de stockage, et les toucher
tous aurait été une refactorisation globale hors périmètre.
