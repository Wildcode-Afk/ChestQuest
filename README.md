# ChessQuest

ChessQuest est un projet statique en HTML/CSS/JavaScript qui propose des leçons d'échecs, des puzzles, un mode IA et des fonctionnalités de chat / classement via Supabase.

## Prérequis

- Python 3.10+ recommandé
- Un navigateur moderne
- Un projet Supabase actif avec les variables dans `supabase-config.js`
- La base SQL exécutée depuis `setup.sql`

## Installation locale

1. Ouvrir le dossier du projet.
2. Vérifier que les fichiers suivants sont présents :
   - `index.html`
   - `style.css`
   - `app.js`
   - `auth.js`
   - `supabase-config.js`
   - `setup.sql`
3. Vérifier la configuration Supabase dans `supabase-config.js`.
4. Exécuter le SQL de `setup.sql` dans le SQL Editor de Supabase.

## Lancer le projet

Depuis le dossier du projet :

```bash
python -m http.server 8000
```

Puis ouvrir :

```text
http://localhost:8000/
```

## Vérification locale

### Vérification simple de démarrage

```bash
python smoke_test.py
```

Cette commande vérifie que :
- les fichiers principaux existent,
- la page HTML référence bien les assets attendus,
- un serveur local démarre correctement,
- la page `http://127.0.0.1:8000/` répond avec un code HTTP 200,
- le titre de la page contient `ChessQuest`.

### Vérification PowerShell

Sous Windows :

```powershell
./verify.ps1
```

## Vérifications manuelles recommandées

- Confirmer que la page s'affiche sans erreur de chargement.
- Vérifier que l'interface d'accueil charge correctement.
- Vérifier que le bouton de connexion ouvre la modale d'authentification.
- Vérifier que les données Supabase répondent (profil, chat, live games).
- Vérifier qu'aucune erreur JavaScript bloquante n'apparaît dans la console du navigateur.

## Points de vigilance

- Le projet dépend d'un projet Supabase valide et de son schéma SQL.
- Si la base est inactive ou si `setup.sql` n'a pas été exécuté dans le bon projet, le jeu peut afficher des erreurs liées aux tables ou au Realtime.
- Le warning `Multiple GoTrueClient instances detected` est un avertissement navigateur, pas un blocage fonctionnel immédiat, mais il est préférable de ne pas créer plusieurs clients Supabase dans la même page.

## Point de reprise sûr

Si une vérification échoue, reprendre depuis :

1. vérifier `supabase-config.js`,
2. vérifier que le projet Supabase est bien celui cible,
3. relancer le script SQL dans `setup.sql`,
4. relancer le serveur local avec `python -m http.server 8000`,
5. relancer `python smoke_test.py`.

Cette étape ne modifie pas le comportement du jeu : elle vise uniquement à sécuriser le lancement et la vérification locale.
