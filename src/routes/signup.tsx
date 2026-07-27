import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Sprout, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [{ title: "Create Account — Verdant" }],
  }),
  component: SignupPage,
});

function authErrorMessage(error: unknown): string {
  const message = (error as { message?: string })?.message || "";
  if (/already registered|already exists/i.test(message)) return "An account with this email already exists.";
  if (/password/i.test(message) && /(least|short|weak)/i.test(message)) return "Password should be at least 6 characters.";
  if (/email/i.test(message) && /invalid/i.test(message)) return "Enter a valid email address.";
  return message || "Something went wrong. Please try again.";
}

function SignupPage() {
  const { signUp, configured } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const goHome = async () => {
    await router.invalidate();
    navigate({ to: "/" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { confirmationRequired } = await signUp(email, password, name || undefined);
      if (confirmationRequired) {
        setConfirmationSent(true);
      } else {
        await goHome();
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (confirmationSent) {
    return (
      <div className="min-h-screen max-w-md mx-auto px-6 flex flex-col justify-center">
        <div className="mb-6 text-center">
          <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground grid place-items-center mx-auto mb-4">
            <Sprout className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <h1 className="font-display text-3xl mb-1">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>.
            Click it to activate your account, then sign in.
          </p>
        </div>

        <Link
          to="/login"
          className="ios-tap w-full h-12 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-md mx-auto px-6 flex flex-col justify-center">
      <div className="mb-8 text-center">
        <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground grid place-items-center mx-auto mb-4">
          <Sprout className="h-7 w-7" strokeWidth={1.75} />
        </div>
        <h1 className="font-display text-3xl mb-1">Create your account</h1>
        <p className="text-sm text-muted-foreground">Start tracking your plants with Verdant</p>
      </div>

      {!configured && (
        <div className="leaf-card p-4 mb-4 text-sm text-muted-foreground">
          Sign-up isn't configured yet. Add your Supabase project credentials to continue.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-sm font-medium block mb-2">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="ios-tap w-full p-3 rounded-lg border border-border bg-background text-foreground text-sm"
            placeholder="Alex Rivera"
            autoComplete="name"
          />
        </div>

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

        <div>
          <label className="text-sm font-medium block mb-2">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="ios-tap w-full p-3 pr-11 rounded-lg border border-border bg-background text-foreground text-sm"
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="ios-tap absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={busy || !configured}
          className="ios-tap w-full h-12 rounded-full bg-primary text-primary-foreground font-semibold disabled:opacity-50"
        >
          {busy ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <p className="text-sm text-center text-muted-foreground mt-6">
        Already have an account?{" "}
        <Link to="/login" className="text-primary font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
