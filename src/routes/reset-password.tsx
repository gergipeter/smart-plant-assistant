import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Sprout } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Reset Password — Verdant" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { resetPassword, configured } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch {
      setError("Could not send reset email. Check the address and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen max-w-md mx-auto px-6 flex flex-col justify-center">
      <div className="mb-8 text-center">
        <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground grid place-items-center mx-auto mb-4">
          <Sprout className="h-7 w-7" strokeWidth={1.75} />
        </div>
        <h1 className="font-display text-3xl mb-1">Reset password</h1>
        <p className="text-sm text-muted-foreground">
          We'll email you a link to reset your password
        </p>
      </div>

      {sent ? (
        <div className="leaf-card p-4 text-sm text-center">
          Check your inbox for a link to reset your password.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-2">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="ios-tap w-full p-3 rounded-lg border border-border bg-background text-foreground text-sm"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={busy || !configured}
            className="ios-tap w-full h-12 rounded-full bg-primary text-primary-foreground font-semibold disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send Reset Link"}
          </button>
        </form>
      )}

      <p className="text-sm text-center text-muted-foreground mt-6">
        <Link to="/login" className="text-primary font-medium hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
