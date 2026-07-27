-- Verdant — initial Supabase schema.
-- Run this once in Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run: every statement is idempotent (create-if-not-exists / drop-then-create).

-- ============================================================
-- profiles — one row per authenticated user, auto-created on signup
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- garden_plants — each row is one plant a user has added, stored as the
-- app's existing Plant JSON shape (src/lib/plants.ts) so the client can
-- migrate off localStorage with minimal reshaping.
-- ============================================================
create table if not exists public.garden_plants (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.garden_plants enable row level security;

drop policy if exists "Users manage their own garden plants" on public.garden_plants;
create policy "Users manage their own garden plants"
  on public.garden_plants for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- subscriptions — premium tier per user (see src/lib/premium.ts)
-- ============================================================
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'plus', 'pro')),
  start_date timestamptz not null default now(),
  end_date timestamptz,
  auto_renew boolean not null default false,
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "Users view their own subscription" on public.subscriptions;
create policy "Users view their own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "Users update their own subscription" on public.subscriptions;
create policy "Users update their own subscription"
  on public.subscriptions for update
  using (auth.uid() = user_id);

drop policy if exists "Users insert their own subscription" on public.subscriptions;
create policy "Users insert their own subscription"
  on public.subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users delete their own subscription" on public.subscriptions;
create policy "Users delete their own subscription"
  on public.subscriptions for delete
  using (auth.uid() = user_id);

-- ============================================================
-- expert_questions — "Ask an Expert" history. Answers come from the free
-- automated knowledge base (src/lib/plantKnowledge.ts) + Trefle lookup, not
-- real human experts — see ask-expert.tsx.
-- ============================================================
create table if not exists public.expert_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plant_name text,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);

alter table public.expert_questions enable row level security;

drop policy if exists "Users manage their own questions" on public.expert_questions;
create policy "Users manage their own questions"
  on public.expert_questions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- Storage — "plant-photos" bucket for timeline/scan photos (see
-- src/lib/photoStore.ts). Private bucket: files are only readable via a
-- signed URL the client requests for its own uploads, not by public URL.
-- Objects are stored at "<user_id>/<entryId>" so RLS can key off the first
-- path segment matching the requesting user's id.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('plant-photos', 'plant-photos', false)
on conflict (id) do nothing;

drop policy if exists "Users manage their own photos" on storage.objects;
create policy "Users manage their own photos"
  on storage.objects for all
  using (bucket_id = 'plant-photos' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'plant-photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- Social features — posts (photo + caption about a garden plant), follows,
-- and likes. Posts are public (readable by anyone, including signed-out
-- visitors) since the feed is meant for discovery; writes are restricted
-- to the post's own author.
-- ============================================================
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plant_id text not null,
  plant_name text not null,
  caption text not null,
  photo_path text,
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;

drop policy if exists "Posts are viewable by everyone" on public.posts;
create policy "Posts are viewable by everyone"
  on public.posts for select
  using (true);

drop policy if exists "Users manage their own posts" on public.posts;
create policy "Users manage their own posts"
  on public.posts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update their own posts" on public.posts;
create policy "Users update their own posts"
  on public.posts for update
  using (auth.uid() = user_id);

drop policy if exists "Users delete their own posts" on public.posts;
create policy "Users delete their own posts"
  on public.posts for delete
  using (auth.uid() = user_id);

create table if not exists public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);

alter table public.follows enable row level security;

drop policy if exists "Follows are viewable by everyone" on public.follows;
create policy "Follows are viewable by everyone"
  on public.follows for select
  using (true);

drop policy if exists "Users manage their own follows" on public.follows;
create policy "Users manage their own follows"
  on public.follows for insert
  with check (auth.uid() = follower_id);

drop policy if exists "Users remove their own follows" on public.follows;
create policy "Users remove their own follows"
  on public.follows for delete
  using (auth.uid() = follower_id);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_likes enable row level security;

drop policy if exists "Likes are viewable by everyone" on public.post_likes;
create policy "Likes are viewable by everyone"
  on public.post_likes for select
  using (true);

drop policy if exists "Users manage their own likes" on public.post_likes;
create policy "Users manage their own likes"
  on public.post_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users remove their own likes" on public.post_likes;
create policy "Users remove their own likes"
  on public.post_likes for delete
  using (auth.uid() = user_id);

-- ============================================================
-- Storage — "post-photos" bucket. Public bucket (unlike plant-photos):
-- feed posts are meant to be visible to everyone, including signed-out
-- visitors browsing the public feed. Writes still restricted per-user.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('post-photos', 'post-photos', true)
on conflict (id) do nothing;

drop policy if exists "Post photos are viewable by everyone" on storage.objects;
create policy "Post photos are viewable by everyone"
  on storage.objects for select
  using (bucket_id = 'post-photos');

drop policy if exists "Users manage their own post photos" on storage.objects;
create policy "Users manage their own post photos"
  on storage.objects for insert
  with check (bucket_id = 'post-photos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users delete their own post photos" on storage.objects;
create policy "Users delete their own post photos"
  on storage.objects for delete
  using (bucket_id = 'post-photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- notification_preferences — replaces the old localStorage-in-a-server-fn
-- code in notifications.server.ts, which never actually worked (localStorage
-- doesn't exist server-side). Read by the watering-reminder Edge Function
-- (supabase/functions/send-watering-reminders) to decide who opted in.
-- ============================================================
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  watering_reminders boolean not null default true,
  daily_digest_time text not null default '08:00',
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "Users manage their own notification preferences" on public.notification_preferences;
create policy "Users manage their own notification preferences"
  on public.notification_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
