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
-- Social features (posts, follows, likes, and the "post-photos" storage
-- bucket) have been removed along with the /feed and /profile pages. These
-- drops clean up a database that previously ran the create statements this
-- section used to have — safe to re-run, and a no-op on a fresh project.
-- ============================================================
drop table if exists public.post_likes;
drop table if exists public.follows;
drop table if exists public.posts;

delete from storage.objects where bucket_id = 'post-photos';
delete from storage.buckets where id = 'post-photos';

drop policy if exists "Post photos are viewable by everyone" on storage.objects;
drop policy if exists "Users manage their own post photos" on storage.objects;
drop policy if exists "Users delete their own post photos" on storage.objects;

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

-- ============================================================
-- push_subscriptions — FCM device tokens for web push. One row per
-- (user, device): a user can have multiple registered devices/browsers,
-- and a token is replaced (not duplicated) if the same device re-registers
-- (browsers rotate FCM tokens periodically). Read by any Edge Function that
-- sends push notifications (e.g. send-watering-reminders) to look up all of
-- a user's active tokens and send FCM v1 messages to them.
-- ============================================================
create table if not exists public.push_subscriptions (
  user_id uuid not null references auth.users (id) on delete cascade,
  fcm_token text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, fcm_token)
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users manage their own push subscriptions" on public.push_subscriptions;
create policy "Users manage their own push subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- sensor_devices / sensor_readings — physical soil-moisture sensors (e.g.
-- an ESP8266 + capacitive probe, see hardware/sensor-firmware/README.md). A device
-- can't authenticate as a Supabase user, so it isn't RLS'd against
-- auth.uid() like the tables above: instead each device carries its own
-- random secret token, and src/routes/api.sensor-ingest.ts (a raw HTTP
-- route, not a createServerFn) looks up the device by a SHA-256 hash of
-- the token — using the service-role client, which bypasses RLS — to
-- find which plant/user the reading belongs to before inserting. RLS
-- here only governs what the *app* (signed-in user, anon key) may
-- read/manage; the ingest route's writes go through the service-role key
-- and are unaffected by these policies.
--
-- The raw token is never stored: only its SHA-256 hash (secret_token_hash)
-- and last four characters (secret_token_last_four, for display in the
-- devices list) are persisted. The raw value is returned to the caller
-- exactly once, at registration/rotation time, by the server function that
-- generates it — a DB read can never recover it afterwards.
-- ============================================================
create table if not exists public.sensor_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plant_id text not null,
  name text not null,
  -- SHA-256 hash (hex) of the long random token the physical device sends
  -- as a bearer credential. Token generated with 192 bits of randomness
  -- client-side (see src/lib/sensorDevices.ts); only its hash is stored.
  secret_token_hash text not null unique,
  secret_token_last_four text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  -- Fixed-window rate-limit counter for api.sensor-ingest.ts: window_started_at
  -- resets (to now, count to 1) whenever a request arrives after the previous
  -- window has expired; otherwise the route increments window_hit_count and
  -- rejects once it exceeds the per-window cap. Avoids a separate table/job.
  window_started_at timestamptz not null default now(),
  window_hit_count int not null default 0
);

alter table public.sensor_devices enable row level security;

drop policy if exists "Users manage their own sensor devices" on public.sensor_devices;
create policy "Users manage their own sensor devices"
  on public.sensor_devices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.sensor_readings (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.sensor_devices (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  plant_id text not null,
  soil_moisture numeric not null check (soil_moisture >= 0 and soil_moisture <= 100),
  battery_percent numeric check (battery_percent >= 0 and battery_percent <= 100),
  created_at timestamptz not null default now()
);

create index if not exists sensor_readings_plant_id_created_at_idx
  on public.sensor_readings (plant_id, created_at desc);

alter table public.sensor_readings enable row level security;

drop policy if exists "Users view their own sensor readings" on public.sensor_readings;
create policy "Users view their own sensor readings"
  on public.sensor_readings for select
  using (auth.uid() = user_id);
