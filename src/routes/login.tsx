import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Sprout, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Sign In — Verdant" }],
  }),
  component: LoginPage,
});

function authErrorMessage(error: unknown): string {
  const message = (error as { message?: string })?.message || "";
  if (/invalid login credentials/i.test(message)) return "Incorrect email or password.";
  if (/email not confirmed/i.test(message)) return "Confirm your email first — check the link we sent you.";
  if (/rate limit/i.test(message)) return "Too many attempts. Try again later.";
  if (/email/i.test(message) && /invalid/i.test(message)) return "Enter a valid email address.";
  return message || "Something went wrong. Please try again.";
}

function LoginPage() {
  const { signIn, configured } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const goHome = async () => {
    await router.invalidate();
    navigate({ to: "/" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      await goHome();
    } catch (err) {
      setError(authErrorMessage(err));
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
        <h1 className="font-display text-3xl mb-1">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to your Verdant account</p>
      </div>

      {!configured && (
        <div className="leaf-card p-4 mb-4 text-sm text-muted-foreground">
          Sign-in isn't configured yet. Add your Supabase project credentials to continue.
        </div>
      )}

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

        <div>
          <label className="text-sm font-medium block mb-2">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="ios-tap w-full p-3 pr-11 rounded-lg border border-border bg-background text-foreground text-sm"
              placeholder="••••••••"
              autoComplete="current-password"
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

        <div className="text-right">
          <Link to="/reset-password" className="text-xs text-primary font-medium hover:underline">
            Forgot password?
          </Link>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={busy || !configured}
          className="ios-tap w-full h-12 rounded-full bg-primary text-primary-foreground font-semibold disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <p className="text-sm text-center text-muted-foreground mt-6">
        Don't have an account?{" "}
        <Link to="/signup" className="text-primary font-medium hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
