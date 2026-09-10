-- À exécuter dans Supabase : SQL Editor > New query > Run
-- Ce script est idempotent et peut être relancé sans risque.
-- Il crée les tables, les politiques RLS, les fonctions utilitaires et
-- les éléments nécessaires au bon fonctionnement de ChestQuest.

-- 1) Extension nécessaire pour gen_random_uuid()
create extension if not exists pgcrypto;

-- ============================================================
-- Profils (progression, Elo, classement)
-- ============================================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text,
  country text,
  featured_badge text,
  completed_lessons text[] default '{}'::text[],
  solved_puzzles int[] default '{}'::int[],
  solved_solitaire int[] default '{}'::int[],
  progressive_elo int default 600,
  fixed_elo int default 800,
  ai_mode text default 'progressive',
  wins_count int default 0,
  losses_count int default 0,
  draws_count int default 0,
  badges text[] default '{}'::text[],
  updated_at timestamptz default now()
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists wins_count int default 0;
alter table public.profiles add column if not exists losses_count int default 0;
alter table public.profiles add column if not exists draws_count int default 0;
alter table public.profiles add column if not exists badges text[] default '{}'::text[];
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists featured_badge text;
alter table public.profiles add column if not exists solved_solitaire int[] default '{}'::int[];

alter table public.profiles enable row level security;

drop policy if exists "Lecture publique des profils (classement)" on public.profiles;
create policy "Lecture publique des profils (classement)"
  on public.profiles for select
  using (true);

drop policy if exists "Création de son propre profil" on public.profiles;
create policy "Création de son propre profil"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Mise à jour de son propre profil" on public.profiles;
create policy "Mise à jour de son propre profil"
  on public.profiles for update
  using (auth.uid() = id);

-- ============================================================
-- Historique des parties (accueil)
-- ============================================================
create table if not exists public.game_history (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  mode text not null,
  result text not null,
  ai_elo int,
  coach_stats jsonb,
  moves jsonb,
  player_color text,
  created_at timestamptz default now()
);

alter table public.game_history add column if not exists moves jsonb;
alter table public.game_history add column if not exists player_color text;

alter table public.game_history enable row level security;

drop policy if exists "Lecture de son propre historique" on public.game_history;
create policy "Lecture de son propre historique"
  on public.game_history for select
  using (auth.uid() = user_id);

drop policy if exists "Ajout de son propre historique" on public.game_history;
create policy "Ajout de son propre historique"
  on public.game_history for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- Chat des joueurs connectés
-- ============================================================
create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  username text not null,
  content text not null,
  badges text[] default '{}'::text[],
  country text,
  elo int,
  created_at timestamptz default now()
);

alter table public.chat_messages add column if not exists badges text[] default '{}'::text[];
alter table public.chat_messages add column if not exists country text;
alter table public.chat_messages add column if not exists elo int;

alter table public.chat_messages enable row level security;

drop policy if exists "Tout le monde peut lire le chat" on public.chat_messages;
create policy "Tout le monde peut lire le chat"
  on public.chat_messages for select
  using (true);

drop policy if exists "Seuls les utilisateurs connectés peuvent écrire" on public.chat_messages;
create policy "Seuls les utilisateurs connectés peuvent écrire"
  on public.chat_messages for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- Parties en direct (Live)
-- ============================================================
create table if not exists public.live_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade unique,
  username text not null,
  country text,
  elo int,
  featured_badge text,
  mode text not null,
  board jsonb not null,
  turn text not null,
  move_count int default 0,
  last_from int,
  last_to int,
  updated_at timestamptz default now()
);

alter table public.live_games enable row level security;

drop policy if exists "Tout le monde peut voir les parties en direct" on public.live_games;
create policy "Tout le monde peut voir les parties en direct"
  on public.live_games for select
  using (true);

drop policy if exists "Créer sa propre partie en direct" on public.live_games;
create policy "Créer sa propre partie en direct"
  on public.live_games for insert
  with check (auth.uid() = user_id);

drop policy if exists "Mettre à jour sa propre partie en direct" on public.live_games;
create policy "Mettre à jour sa propre partie en direct"
  on public.live_games for update
  using (auth.uid() = user_id);

drop policy if exists "Supprimer sa propre partie en direct" on public.live_games;
create policy "Supprimer sa propre partie en direct"
  on public.live_games for delete
  using (auth.uid() = user_id);

-- ============================================================
-- Suppression de compte (compte personnel)
-- ============================================================
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;

-- ============================================================
-- Parties en ligne (ami + matchmaking)
-- ============================================================
create table if not exists public.online_games (
  id uuid primary key default gen_random_uuid(),
  white_id uuid references auth.users on delete set null,
  black_id uuid references auth.users on delete set null,
  white_username text,
  black_username text,
  status text not null default 'waiting',
  board jsonb,
  turn text default 'w',
  last_from int,
  last_to int,
  last_promo text,
  move_count int default 0,
  time_control_base int,
  time_control_inc int default 0,
  white_time_ms bigint,
  black_time_ms bigint,
  last_move_at timestamptz default now(),
  result text,
  result_reason text,
  created_by uuid references auth.users on delete set null,
  is_friend_game boolean default false,
  created_at timestamptz default now()
);

alter table public.online_games enable row level security;

drop policy if exists "Lecture des parties en ligne" on public.online_games;
create policy "Lecture des parties en ligne"
  on public.online_games for select
  using (true);

drop policy if exists "Création d'une partie en ligne" on public.online_games;
create policy "Création d'une partie en ligne"
  on public.online_games for insert
  with check (
    auth.uid() = created_by
    and (
      white_id is null
      or black_id is null
      or auth.uid() = white_id
      or auth.uid() = black_id
    )
  );

drop policy if exists "Mise à jour d'une partie en ligne" on public.online_games;
create policy "Mise à jour d'une partie en ligne"
  on public.online_games for update
  using (auth.uid() = white_id or auth.uid() = black_id or auth.uid() = created_by)
  with check (auth.uid() = white_id or auth.uid() = black_id or auth.uid() = created_by);

drop policy if exists "Suppression de sa propre partie en attente" on public.online_games;
create policy "Suppression de sa propre partie en attente"
  on public.online_games for delete
  using (auth.uid() = created_by and status = 'waiting');

create table if not exists public.matchmaking_queue (
  user_id uuid primary key references auth.users on delete cascade,
  username text not null,
  elo int,
  time_control_base int,
  time_control_inc int default 0,
  created_at timestamptz default now()
);

alter table public.matchmaking_queue enable row level security;

drop policy if exists "Lecture de la file d'attente" on public.matchmaking_queue;
create policy "Lecture de la file d'attente"
  on public.matchmaking_queue for select
  using (true);

drop policy if exists "Rejoindre la file d'attente" on public.matchmaking_queue;
create policy "Rejoindre la file d'attente"
  on public.matchmaking_queue for insert
  with check (auth.uid() = user_id);

drop policy if exists "Quitter la file d'attente" on public.matchmaking_queue;
create policy "Quitter la file d'attente"
  on public.matchmaking_queue for delete
  using (auth.uid() = user_id);

create or replace function public.join_friend_game(game_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  g record;
  my_name text;
begin
  if auth.uid() is null then
    return false;
  end if;

  select * into g from public.online_games where id = game_id for update;
  if not found then
    return false;
  end if;

  if g.status <> 'waiting' then
    return false;
  end if;

  if g.white_id = auth.uid() or g.black_id = auth.uid() then
    return false;
  end if;

  select coalesce(p.username, split_part(u.email, '@', 1)) into my_name
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = auth.uid();

  if g.white_id is null then
    update public.online_games
    set white_id = auth.uid(),
        white_username = coalesce(my_name, 'Joueur'),
        status = 'active'
    where id = game_id;
  elsif g.black_id is null then
    update public.online_games
    set black_id = auth.uid(),
        black_username = coalesce(my_name, 'Joueur'),
        status = 'active'
    where id = game_id;
  else
    return false;
  end if;

  return true;
end;
$$;

grant execute on function public.join_friend_game(uuid) to authenticated;

create or replace function public.try_matchmake()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me record;
  opponent record;
  new_game_id uuid;
  white_uid uuid;
  black_uid uuid;
  white_name text;
  black_name text;
begin
  select * into me from public.matchmaking_queue where user_id = auth.uid();
  if not found then
    return null;
  end if;

  select * into opponent
  from public.matchmaking_queue
  where user_id <> auth.uid()
    and coalesce(time_control_base, -1) = coalesce(me.time_control_base, -1)
    and coalesce(time_control_inc, -1) = coalesce(me.time_control_inc, -1)
  order by created_at asc
  limit 1
  for update skip locked;

  if not found then
    return null;
  end if;

  if random() < 0.5 then
    white_uid := me.user_id;
    black_uid := opponent.user_id;
    white_name := me.username;
    black_name := opponent.username;
  else
    white_uid := opponent.user_id;
    black_uid := me.user_id;
    white_name := opponent.username;
    black_name := me.username;
  end if;

  insert into public.online_games (
    white_id,
    black_id,
    white_username,
    black_username,
    status,
    turn,
    time_control_base,
    time_control_inc,
    white_time_ms,
    black_time_ms,
    created_by,
    is_friend_game
  ) values (
    white_uid,
    black_uid,
    white_name,
    black_name,
    'active',
    'w',
    me.time_control_base,
    me.time_control_inc,
    case when me.time_control_base is not null then me.time_control_base * 1000 else null end,
    case when me.time_control_base is not null then me.time_control_base * 1000 else null end,
    auth.uid(),
    false
  ) returning id into new_game_id;

  delete from public.matchmaking_queue where user_id in (me.user_id, opponent.user_id);

  return new_game_id;
end;
$$;

grant execute on function public.try_matchmake() to authenticated;

-- IMPORTANT : dans Supabase > Database > Replication, activez le temps réel
-- pour chat_messages, live_games et online_games.

-- Optionnel mais recommandé : dans Supabase > Authentication > Providers,
-- tu peux désactiver la confirmation d'email pour tester plus vite en dev.
