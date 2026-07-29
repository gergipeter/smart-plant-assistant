import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Verdant" },
      { name: "description", content: "How Verdant collects, uses, and protects your data." },
    ],
  }),
  component: PrivacyPage,
});

const LAST_UPDATED = "July 27, 2026";

function PrivacyPage() {
  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="font-display text-2xl leading-tight">Privacy Policy</h1>
        <p className="text-xs text-muted-foreground mt-1">Last updated: {LAST_UPDATED}</p>
      </header>

      <div className="prose prose-sm max-w-none space-y-6 text-sm leading-relaxed text-foreground/90">
        <p>
          Verdant ("we," "us," "our") provides a plant-identification and plant-care app.
          This policy explains what data we collect, why, and how you can control or delete it.
          It applies to the Verdant website and mobile apps.
        </p>

        <Section title="1. Information we collect">
          <p>We collect the following categories of information:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Account information</strong> — email address and password (or sign-in
              credentials), and an optional display name, when you create an account.
            </li>
            <li>
              <strong>Photos you upload</strong> — plant photos you take or upload to identify a
              plant or diagnose a problem. Photos used for scanning are sent to our
              plant-identification providers (Pl@ntNet, Google Vision) to return a result, and
              are otherwise stored so they can be shown in your garden.
            </li>
            <li>
              <strong>Garden and plant data</strong> — the plants you add to your garden,
              watering schedules, care history, and streaks.
            </li>
            <li>
              <strong>Location</strong> — if you use nursery search, we request your device
              location (or a location you type in) to find nearby nurseries via Google Places,
              and your postal code/region to provide weather-aware care tips via OpenWeatherMap.
            </li>
            <li>
              <strong>AI Doctor / Ask an Expert conversations</strong> — questions and photos you
              submit for plant diagnosis, and the responses, so we can show you your question
              history. Diagnosis conversations are processed by Anthropic's Claude API.
            </li>
            <li>
              <strong>Payment information</strong> — if you subscribe to a paid tier, payments are
              handled entirely by Stripe. We do not receive or store your card number; we receive
              a subscription status and a Stripe customer/subscription ID.
            </li>
            <li>
              <strong>Push notification tokens</strong> — if you enable push notifications, we
              store a device token (via Firebase Cloud Messaging or OneSignal) so we can send
              watering reminders.
            </li>
          </ul>
        </Section>

        <Section title="2. How we use your information">
          <ul className="list-disc pl-5 space-y-1">
            <li>To identify plants and provide care recommendations.</li>
            <li>To send watering reminders and other notifications you opt into.</li>
            <li>To process payments and manage your subscription tier.</li>
            <li>To respond to support requests and improve the app.</li>
          </ul>
          <p>We do not sell your personal information.</p>
        </Section>

        <Section title="3. Third parties we share data with">
          <p>
            We use the following third-party services, each of which processes a limited slice of
            your data solely to perform its function:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Supabase</strong> — hosts our database, authentication, and file storage.</li>
            <li><strong>Pl@ntNet, Google Vision, Trefle</strong> — plant identification and species data (photos/images only, for scans).</li>
            <li><strong>Anthropic (Claude)</strong> — powers AI Doctor plant-diagnosis chat.</li>
            <li><strong>OpenWeatherMap</strong> — weather-based care tips (approximate location only).</li>
            <li><strong>Google Places</strong> — nearby nursery search (location only).</li>
            <li><strong>Stripe</strong> — payment processing for Premium subscriptions.</li>
            <li><strong>Firebase / OneSignal</strong> — push notification delivery.</li>
          </ul>
          <p>
            Each provider only receives the data needed for its feature (e.g. a scan photo is not
            sent to Stripe; a payment is not sent to Pl@ntNet).
          </p>
        </Section>

        <Section title="4. Your choices and rights">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Delete your account</strong> — you can permanently delete your account and
              associated data from Settings → Profile → Delete Account. This removes your profile,
              garden data, posts, questions, and subscription record.
            </li>
            <li>
              <strong>Notifications</strong> — push and email watering reminders can be turned off
              at any time in Settings.
            </li>
            <li>
              <strong>Location</strong> — nursery search and weather tips are optional; you can
              deny or revoke location permission in your device/browser settings at any time.
            </li>
            <li>
              <strong>Access or export</strong> — email us (below) to request a copy of your data.
            </li>
          </ul>
        </Section>

        <Section title="5. Data retention">
          <p>
            We retain your data for as long as your account is active. If you delete your
            account, your profile, garden data, photos, posts, and preferences are deleted from
            our systems, except where we're required to keep records (e.g. payment records for
            tax/accounting purposes, which Stripe retains per their own policy).
          </p>
        </Section>

        <Section title="6. Children's privacy">
          <p>
            Verdant is not directed at children under 13, and we do not knowingly collect
            information from children under 13. If you believe a child has provided us
            information, contact us and we will delete it.
          </p>
        </Section>

        <Section title="7. Security">
          <p>
            Data is stored in Supabase (Postgres) with row-level security policies restricting
            each user's data to that user. Photo storage buckets are private by default and served
            only via signed URLs, except public community-feed photos which are shown by design.
          </p>
        </Section>

        <Section title="8. Changes to this policy">
          <p>
            We may update this policy from time to time. We'll update the "Last updated" date
            above when we do, and post material changes in-app.
          </p>
        </Section>

        <Section title="9. Contact us">
          <p>
            Questions about this policy or your data? Email{" "}
            <a href="mailto:privacy@verdant.app" className="text-primary underline">
              privacy@verdant.app
            </a>
            .
          </p>
        </Section>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
