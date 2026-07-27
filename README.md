# Smart Plant Assistant

A plant-care companion app: identify plants from a photo, track watering schedules, get AI-powered diagnosis for sick plants, and browse a social feed of other growers.

## Features

- **Plant ID & scanning** — photo-based identification (Pl@ntNet, Google Vision, TensorFlow/MobileNet) and a plant database lookup (Trefle).
- **AI Doctor** — chat-based plant diagnosis powered by Anthropic's Claude.
- **Garden tracking** — watering calendar/streaks, hardiness-zone and weather-aware care tips (OpenWeatherMap).
- **Notifications** — watering reminders via a scheduled Supabase Edge Function (email send step is currently stubbed — see below) and push notifications (Firebase / OneSignal).
- **Social feed & nurseries** — activity feed and nearby-nursery lookup (Google Places).
- **Auth & accounts** — Supabase Auth (email/password, password reset).
- **Premium tiers** — Stripe Checkout + webhook-driven subscription upgrades.

## Tech stack

- [TanStack Start](https://tanstack.com/start) (React 19, file-based routing via TanStack Router)
- TypeScript, Tailwind CSS v4, shadcn/ui (Radix primitives)
- Supabase (Postgres, Auth, Row Level Security, Edge Functions)
- Stripe for billing
- Firebase Admin for push notifications

## Development

Requires Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd smart-plant-assistant
npm i
cp .env.example .env
npm run dev
```

### Environment variables

Copy `.env.example` to `.env` and fill in the keys you need. Each variable is documented inline with where to get it and why it's needed (Supabase, Stripe, Firebase, Pl@ntNet, OpenWeatherMap, Trefle, Google Vision/Places, Anthropic, OneSignal). Not every integration is required to run the app locally — features degrade gracefully if a given key is missing.

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL Editor to create the required tables (`profiles`, `garden_plants`, `subscriptions`, `notification_preferences`, etc.) with RLS policies.
3. Deploy the Edge Function in [`supabase/functions/send-watering-reminders`](supabase/functions/send-watering-reminders) and schedule it via `cron.schedule` (see [`supabase/schedule-reminders.sql`](supabase/schedule-reminders.sql)). Note: the actual email send is stubbed — it logs instead of sending until an email provider (Resend, SendGrid, etc.) is wired up.

### Stripe setup

Create one recurring Price per tier/cycle in the Stripe Dashboard and set the corresponding price IDs in `.env`. For local webhook testing, run `stripe listen` and use its signing secret for `STRIPE_WEBHOOK_SECRET`.

## Scripts

```sh
npm run dev        # start the dev server
npm run build       # production build
npm run preview     # preview a production build
npm run lint        # eslint
npm run format       # prettier --write
```

## Project structure

- [src/routes/](src/routes/) — file-based routes (pages + API routes like `api.stripe-webhook.ts`)
- [src/lib/](src/lib/) — server-side integrations (`*.server.ts`) for each third-party API
- [src/components/](src/components/) — UI components
- [supabase/](supabase/) — schema, cron scheduling SQL, and Edge Functions
