# ChessQuest — Cartographie des modes de jeu

Établie par inspection du code de `app.js` (recherche de `mode===`, des
assignations à `mode`, et des fonctions d'entrée par mode). Liste les modes
**réellement observés**, pas une liste théorique.

## Modes de navigation (pas des modes de jeu à proprement parler)
| Mode (`mode===`) | Rôle | Entrée |
|---|---|---|
| `home` | Écran d'accueil | `showHome()` |
| `playmenu` | Menu de choix du type de partie | `goToMode('playmenu')` |
| `profile` | Page de profil joueur | `goToMode('profile')` |
| `live` | Liste des parties en cours (aperçu) | `goToMode('live')`, `refreshLiveGames()` |

## Modes de jeu contre le moteur d'échecs (passent par `finalizeMove`/`doMove`)
| Mode | Rôle | Démarrage | Réception d'un coup |
|---|---|---|---|
| `lessons` | Leçons guidées | `loadLesson(i)` | `handleLessonMove(mv, moverColor, isCastle, capturedPiece)` |
| `puzzles` (sous-mode `mate`) | Puzzles mat-en-1/2/3 | `loadPuzzle(i)` | `handlePuzzleMove(mv, moverColor)` |
| `practice` | Partie libre contre l'IA | `startPractice()` | `handlePracticeMove(moveQuality)` |
| `coach` | Partie contre l'IA avec analyse du Coach | `startPractice()` (variante) | `handlePracticeMove(moveQuality)` |
| `online` | Partie en ligne (ami ou aléatoire) en cours | `startOnlineGame(game)` | `handleOnlineMove(moveStatus)` |

Ces 5 modes partagent aujourd'hui un même pipeline commun dans `finalizeMove()`
(historique, horloge, notation, rendu, retour son/visuel) avant un aiguillage
final vers leur gestionnaire propre. Ce pipeline partagé n'a **pas** été touché
par cette étape (voir "Risque et périmètre" plus bas).

## Modes de configuration/attente pour le jeu en ligne
| Mode | Rôle | Entrée |
|---|---|---|
| `friend-setup` | Configuration d'une partie contre un ami (lien) | `renderFriendSetup()` |
| `random-setup` | Configuration d'une partie contre un adversaire aléatoire | `renderRandomSetup()` |
| `random-searching` | Recherche d'un adversaire (polling de matchmaking) | déclenché depuis `renderRandomSetup()` |

## Modes de visionnage (pas d'interaction de jeu)
| Mode | Rôle | Entrée |
|---|---|---|
| `spectate` | Suivre une partie en direct (lecture seule) | `openSpectate(id)` |
| `review` | Revoir une partie terminée, coup par coup | `openReview(id)` |

## Sous-mode indépendant du moteur d'échecs
| Sous-mode | Rôle | Démarrage | Réception d'un clic |
|---|---|---|---|
| `puzzles` + `puzzleSubMode==='solitaire'` (Échecs en solo) | Puzzle d'auto-capture (règles Solitaire Chess/ThinkFun) | `loadSolitaire(i)` | `solitaireOnSquareClick(idx)` |

Ce sous-mode n'appelle jamais `legalMoves`/`applyMove`/`gameStatus` du moteur :
il a ses propres règles (chaque coup doit être une capture) et son propre
plateau (`solitaireBoard`), déjà indépendants avant cette étape.

## Interface commune introduite par cette étape

```js
ChessModes['<nom>'] = {
  start(...args)   // démarre/charge le mode (ex: un puzzle précis)
  stop()           // arrête proprement le mode (minuteries, abonnements…)
  restore()        // recharge l'état courant sans redémarrer à zéro
  receiveMove(...) // traite un coup/interaction reçu(e) pendant que ce mode est actif
}
```
Définie dans `chess-modes.js`. Un mode s'enregistre via `registerMode(nom, impl)` ;
les méthodes non fournies ont un défaut vide (aucune méthode n'est obligatoire).

## État de la migration

| Mode | Migré vers un module dédié ? |
|---|---|
| Échecs en solo (solitaire) | ✅ `chess-mode-solitaire.js` |
| Leçons, Puzzles (mat), Partie libre/Coach, En ligne, Spectateur, Revue, Live | ❌ pas encore — voir "Risque et périmètre" |

## Risque et périmètre de cette étape

Une migration complète de **tous** les modes list ci-dessus, avec la même
interface, a été écartée pour cette étape après inspection : deux points de
couplage rendent l'opération risquée si elle est faite d'un coup plutôt que
mode par mode :

1. **`goToMode(targetMode)`** est un routeur unique qui gère l'arrêt de
   *tous* les modes sortants (minuterie, diffusion Live, polling de
   matchmaking, abonnements en ligne) avant de démarrer le mode entrant.
   Cette logique d'arrêt est entrelacée par mode dans une seule fonction.
2. **`finalizeMove()`** est un pipeline unique partagé par 5 modes
   (historique, horloge, notation, sauvegarde, rendu, retour son/visuel),
   avec des branches `mode===...` intercalées, avant l'aiguillage final vers
   le gestionnaire du mode.

Réécrire ces deux fonctions pour qu'elles délèguent proprement à
`ChessModes[mode].stop()`/`receiveMove()` pour les 5 modes restants est
possible, mais représente une refactorisation plus large qu'un "petit
déplacement de code" — exactement ce que cette étape doit éviter de faire en
un seul passage. C'est pourquoi seul le mode le plus indépendant
(Échecs en solo, qui ne touche déjà ni `gameState` ni `finalizeMove`) a été
migré cette fois, comme démonstration concrète et sûre de l'interface.

**Suite recommandée**, dans l'ordre de risque croissant : Leçons et Puzzles
(mat) ensuite (gestionnaires déjà isolés, mais partagent `finalizeMove`) ;
Partie libre/Coach ; puis En ligne/Spectateur/Revue en dernier (le plus
couplé : Supabase, minuteries, abonnements temps réel).
