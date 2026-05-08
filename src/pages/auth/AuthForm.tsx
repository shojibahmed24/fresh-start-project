import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { m } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { OAuthButtons } from "./OAuthButtons";
import { EmailField, PasswordField } from "./AuthFormFields";
import { emailRegex, evaluatePassword } from "./constants";

export const AuthForm = () => {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // Touched + submission tracking for validation UX
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({ email: false, password: false });
  const [shake, setShake] = useState<{ email: boolean; password: boolean }>({ email: false, password: false });

  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<"google" | "github" | null>(null);

  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;
    navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  /* ─── Validation ─── */
  const emailError = useMemo(() => {
    if (!email) return "Email is required";
    if (!emailRegex.test(email)) return "Enter a valid email address";
    return null;
  }, [email]);

  const pwInfo = useMemo(() => evaluatePassword(password), [password]);

  const passwordError = useMemo(() => {
    if (!password) return "Password is required";
    if (mode === "signup" && pwInfo.score < 2) return "Please pick a stronger password";
    if (mode === "signin" && password.length < 6) return "Password is too short";
    return null;
  }, [password, mode, pwInfo.score]);

  const triggerShake = (field: "email" | "password") => {
    setShake((s) => ({ ...s, [field]: true }));
    setTimeout(() => setShake((s) => ({ ...s, [field]: false })), 450);
  };

  /* ─── Logging ─── */
  const logAuth = async (action: string, success: boolean, extra?: Record<string, unknown>) => {
    try {
      await supabase.rpc("log_auth_event", {
        _action: action,
        _email: email,
        _success: success,
        _metadata: extra ? (extra as any) : null,
      });
    } catch { /* ignore */ }
  };

  /* ─── Submit ─── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });

    if (emailError || passwordError) {
      if (emailError) triggerShake("email");
      if (passwordError) triggerShake("password");
      toast.error("Please fix the highlighted fields");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        await logAuth("signup", true);
        toast.success("Account created!", { description: "Check your email if confirmation is required." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await logAuth("login", true);
        toast.success("Welcome back!");
      }
    } catch (err: any) {
      await logAuth(mode === "signup" ? "signup_failed" : "login_failed", false, { error: err?.message });
      toast.error("Authentication failed", { description: err.message });
      triggerShake("password");
    } finally {
      setBusy(false);
    }
  };

  /* ─── OAuth ─── */
  const oauth = async (provider: "google" | "github") => {
    setOauthBusy(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      toast.error(error.message);
      setOauthBusy(null);
    }
  };

  const onForgot = async () => {
    if (!email || emailError) {
      toast.error("Enter your email first");
      triggerShake("email");
      setTouched((t) => ({ ...t, email: true }));
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) toast.error(error.message);
    else toast.success("Reset email sent", { description: `Check ${email} for the link.` });
  };

  const showEmailErr = touched.email && emailError;
  const showPwErr = touched.password && passwordError;

  return (
    <main className="flex items-center justify-center px-4 sm:px-6 py-16 lg:py-12">
      <m.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="lg:hidden flex justify-center mb-6">
          <Logo size="lg" />
        </div>

        <div className="glass-strong rounded-2xl sm:rounded-3xl border border-border p-6 sm:p-8 shadow-elegant">
          {/* Mode toggle */}
          <div className="relative inline-flex w-full items-center bg-[hsl(var(--bg-muted))] border border-border rounded-xl p-1 mb-6">
            {(["signin", "signup"] as const).map((modeKey) => (
              <button
                key={modeKey}
                type="button"
                onClick={() => { setMode(modeKey); setTouched({ email: false, password: false }); }}
                className={cn(
                  "relative flex-1 text-[12.5px] font-semibold py-2 rounded-lg transition-colors",
                  mode === modeKey ? "text-primary-foreground" : "text-[hsl(var(--foreground-muted))] hover:text-foreground",
                )}
              >
                {mode === modeKey && (
                  <m.span
                    layoutId="auth-mode-pill"
                    className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary to-primary-glow shadow-[0_4px_14px_-4px_hsl(var(--primary)/0.55)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{modeKey === "signin" ? "Sign in" : "Sign up"}</span>
              </button>
            ))}
          </div>

          <div className="text-center mb-5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-[13px] text-[hsl(var(--foreground-muted))] mt-1">
              {mode === "signin" ? "Sign in to continue building" : "Start shipping with AI today"}
            </p>
          </div>

          <OAuthButtons busy={busy} oauthBusy={oauthBusy} onClick={oauth} />

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-[10px] tracking-[0.2em]">
              <span className="bg-card px-2 text-[hsl(var(--foreground-subtle))]">OR CONTINUE WITH EMAIL</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <EmailField
              email={email}
              setEmail={setEmail}
              setTouched={setTouched}
              touched={touched}
              emailError={emailError}
              showEmailErr={showEmailErr}
              shake={shake.email}
            />

            <PasswordField
              mode={mode}
              password={password}
              setPassword={setPassword}
              setTouched={setTouched}
              showPw={showPw}
              setShowPw={setShowPw}
              passwordError={passwordError}
              showPwErr={showPwErr}
              shake={shake.password}
              pwInfo={pwInfo}
              onForgot={onForgot}
            />

            <Button
              type="submit"
              disabled={busy || oauthBusy !== null}
              className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground font-semibold h-11 shadow-glow"
            >
              {busy ? (
                <><Loader2 className="size-4 mr-2 animate-spin" /> Please wait…</>
              ) : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-5 text-center text-[11.5px] text-[hsl(var(--foreground-subtle))] leading-relaxed">
            By continuing you agree to our{" "}
            <Link to="/" className="underline hover:text-foreground">Terms</Link> and{" "}
            <Link to="/" className="underline hover:text-foreground">Privacy Policy</Link>.
          </p>
        </div>
      </m.div>
    </main>
  );
};
