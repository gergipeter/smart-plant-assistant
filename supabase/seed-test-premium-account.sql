-- Seed a test account with full Premium Pro access.
-- Run once in Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run: creates the user only if the email doesn't already exist,
-- and upserts the subscription either way.
--
-- Login: email + password below (change them before running, or after via
-- Supabase Dashboard → Authentication → Users → this user → Reset password).

do $$
declare
  test_email text := 'test-premium@verdant.test';
  test_password text := 'ChangeMe123!';
  test_user_id uuid;
begin
  select id into test_user_id from auth.users where email = test_email;

  if test_user_id is null then
    test_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      test_user_id, 'authenticated', 'authenticated', test_email,
      crypt(test_password, gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Test Premium"}',
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider, created_at, updated_at
    ) values (
      gen_random_uuid(), test_user_id::text, test_user_id,
      jsonb_build_object('sub', test_user_id::text, 'email', test_email),
      'email', now(), now()
    );
  end if;

  insert into public.profiles (id, username)
  values (test_user_id, 'Test Premium')
  on conflict (id) do nothing;

  insert into public.subscriptions (
    user_id, tier, start_date, end_date, auto_renew
  ) values (
    test_user_id, 'pro', now(), now() + interval '100 years', true
  )
  on conflict (user_id) do update set
    tier = 'pro',
    end_date = now() + interval '100 years',
    auto_renew = true,
    updated_at = now();

  insert into public.notification_preferences (user_id)
  values (test_user_id)
  on conflict (user_id) do nothing;

  raise notice 'Test premium account ready: % (user_id: %)', test_email, test_user_id;
end $$;
