-- ============================================================
-- CHESTQUEST — Validation serveur candidate pour les coups en ligne
-- ============================================================
-- NON APPLIQUÉ AUTOMATIQUEMENT. Ce fichier est séparé de setup.sql
-- volontairement : il n'a PAS pu être testé contre une instance
-- Supabase réelle depuis cet environnement de développement (aucun
-- accès à une base Postgres/Supabase en direct ici). Avant de
-- l'exécuter sur un projet en production :
--   1. Teste-le d'abord sur un projet Supabase de test (staging),
--      pas directement en production.
--   2. Joue une partie complète (amie et aléatoire) après l'avoir
--      appliqué pour confirmer qu'aucun coup légitime n'est rejeté.
--   3. Vérifie en particulier l'abandon, la fin de partie par le
--      temps, et le message de chat/accept d'invitation, qui
--      passent aussi par une mise à jour de la même table.
--
-- Portée : comble UNE limite précise documentée dans
-- CHESSQUEST_ONLINE.md, section 4 — la policy "update" existante
-- de online_games vérifie QUI peut écrire, jamais QUOI. Ce
-- déclencheur ajoute une vérification minimale de QUOI, sans
-- toucher à la policy existante ni aux colonnes de la table
-- (aucune migration de schéma).
--
-- Ce qu'il vérifie (au moment d'une mise à jour, avant qu'elle
-- soit appliquée) :
--   - move_count ne peut qu'augmenter, et seulement de 1 à la fois
--     (empêche de sauter des coups ou de revenir en arrière) ;
--   - une partie déjà 'finished' ne peut plus voir son board/turn/
--     move_count modifiés (empêche de rejouer une partie terminée) ;
--   - turn ne peut être que 'w' ou 'b'.
-- Ce qu'il NE vérifie PAS (hors périmètre de ce déclencheur) :
--   - la légalité du coup lui-même (nécessiterait de réimplémenter
--     les règles d'échecs en SQL/PL-pgSQL) ;
--   - que c'est bien le tour du joueur qui pousse la mise à jour
--     (nécessiterait de faire confiance à auth.uid() côté colonne
--     "turn", ce qui suppose une convention supplémentaire non
--     présente aujourd'hui dans le schéma).
-- ============================================================

create or replace function chessquest_validate_online_game_update()
returns trigger
language plpgsql
as $$
begin
  -- Une partie terminée ne doit plus voir son déroulé modifié.
  if OLD.status = 'finished' and NEW.status = 'finished' then
    if NEW.board is distinct from OLD.board
       or NEW.turn is distinct from OLD.turn
       or NEW.move_count is distinct from OLD.move_count then
      raise exception 'chessquest: impossible de modifier le déroulé d''une partie terminée';
    end if;
  end if;

  -- Le numéro de coup ne peut qu'avancer, d'un coup à la fois.
  if NEW.move_count is distinct from OLD.move_count then
    if NEW.move_count <> OLD.move_count + 1 then
      raise exception 'chessquest: move_count doit augmenter de 1 exactement (reçu % après %)', NEW.move_count, OLD.move_count;
    end if;
  end if;

  -- Le trait ne peut être que blanc ou noir.
  if NEW.turn is not null and NEW.turn not in ('w', 'b') then
    raise exception 'chessquest: turn doit être ''w'' ou ''b'' (reçu %)', NEW.turn;
  end if;

  return NEW;
end;
$$;

drop trigger if exists chessquest_online_game_update_guard on online_games;
create trigger chessquest_online_game_update_guard
  before update on online_games
  for each row
  execute function chessquest_validate_online_game_update();
