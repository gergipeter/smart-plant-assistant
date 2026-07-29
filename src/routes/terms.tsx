import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Verdant" },
      { name: "description", content: "The terms that govern your use of Verdant." },
    ],
  }),
  component: TermsPage,
});

const LAST_UPDATED = "July 27, 2026";

function TermsPage() {
  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="font-display text-2xl leading-tight">Terms of Service</h1>
        <p className="text-xs text-muted-foreground mt-1">Last updated: {LAST_UPDATED}</p>
      </header>

      <div className="prose prose-sm max-w-none space-y-6 text-sm leading-relaxed text-foreground/90">
        <p>
          These Terms of Service ("Terms") govern your use of Verdant (the "App"). By creating an
          account or using the App, you agree to these Terms.
        </p>

        <Section title="1. The service">
          <p>
            Verdant helps you identify plants, track watering and care, and get AI-assisted
            diagnosis for plant problems. Plant identification, diagnosis, and care suggestions are provided for informational
            purposes only and are not a substitute for professional horticultural, agricultural,
            or safety advice — including on whether a plant is edible or safe around children and
            pets. Always verify independently before acting on that basis.
          </p>
        </Section>

        <Section title="2. Accounts">
          <ul className="list-disc pl-5 space-y-1">
            <li>You must provide accurate information when creating an account.</li>
            <li>You're responsible for keeping your login credentials secure.</li>
            <li>You must be at least 13 years old to use Verdant.</li>
            <li>You can delete your account at any time from Settings.</li>
          </ul>
        </Section>

        <Section title="3. Subscriptions and payment">
          <ul className="list-disc pl-5 space-y-1">
            <li>Verdant offers optional paid tiers ("Plus" and "Pro") with additional features.</li>
            <li>Paid subscriptions are billed in advance on a recurring basis (monthly or yearly) via Stripe, or via the app store billing system if you subscribed through a mobile app store.</li>
            <li>You can cancel anytime; cancellation takes effect at the end of the current billing period, and you keep paid features until then.</li>
            <li>Fees are non-refundable except where required by law or by the app store's refund policy.</li>
            <li>We may change prices with advance notice; continuing to use a paid tier after a price change means you accept the new price.</li>
          </ul>
        </Section>

        <Section title="4. Content you submit">
          <ul className="list-disc pl-5 space-y-1">
            <li>You retain ownership of photos, captions, and questions you submit.</li>
            <li>You're responsible for content you post — don't post anything illegal, infringing, harassing, or that you don't have the right to share.</li>
            <li>We may remove content or suspend accounts that violate these Terms.</li>
          </ul>
        </Section>

        <Section title="5. Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Use the App for any unlawful purpose or to harass other users.</li>
            <li>Attempt to access another user's account or data.</li>
            <li>Reverse-engineer, scrape, or abuse the App's APIs beyond normal use.</li>
            <li>Upload content that infringes someone else's intellectual property or privacy.</li>
          </ul>
        </Section>

        <Section title="6. Third-party services">
          <p>
            The App relies on third-party services (plant identification, weather, mapping, AI,
            and payment providers) to work. We aren't responsible for outages, inaccuracies, or
            changes in those third-party services, though we'll do our best to keep the App
            functioning around them.
          </p>
        </Section>

        <Section title="7. Disclaimer of warranties">
          <p>
            The App is provided "as is" without warranties of any kind. Plant identification and
            AI-generated diagnosis can be inaccurate or incomplete — don't rely on them for
            decisions involving safety, health, or high-value plants without independent
            verification.
          </p>
        </Section>

        <Section title="8. Limitation of liability">
          <p>
            To the maximum extent permitted by law, Verdant and its operators aren't liable for
            indirect, incidental, or consequential damages arising from your use of the App,
            including loss of data or loss arising from reliance on plant identification or care
            advice.
          </p>
        </Section>

        <Section title="9. Termination">
          <p>
            You may stop using the App and delete your account at any time. We may suspend or
            terminate accounts that violate these Terms.
          </p>
        </Section>

        <Section title="10. Changes to these terms">
          <p>
            We may update these Terms from time to time. Continued use of the App after an update
            means you accept the revised Terms. We'll update the "Last updated" date above when we
            make changes.
          </p>
        </Section>

        <Section title="11. Contact us">
          <p>
            Questions about these Terms? Email{" "}
            <a href="mailto:support@verdant.app" className="text-primary underline">
              support@verdant.app
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
