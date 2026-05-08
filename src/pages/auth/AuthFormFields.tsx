import { AnimatePresence, m } from "framer-motion";
import { Check, Eye, EyeOff, Lock, Mail, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { type PasswordCheck, STRENGTH_META } from "./constants";

export const EmailField = ({
  email,
  setEmail,
  setTouched,
  touched,
  emailError,
  showEmailErr,
  shake,
}: {
  email: string;
  setEmail: (v: string) => void;
  setTouched: React.Dispatch<React.SetStateAction<{ email: boolean; password: boolean }>>;
  touched: { email: boolean; password: boolean };
  emailError: string | null;
  showEmailErr: string | null | false;
  shake: boolean;
}) => (
  <m.div animate={shake ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : { x: 0 }} transition={{ duration: 0.4 }}>
    <Label htmlFor="email" className="text-[11px] uppercase tracking-wider text-[hsl(var(--foreground-subtle))] mb-1.5 block">
      Email
    </Label>
    <div className="relative">
      <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--foreground-subtle))] pointer-events-none" />
      <Input
        id="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => setTouched((t) => ({ ...t, email: true }))}
        placeholder="you@example.com"
        aria-invalid={!!showEmailErr}
        aria-describedby={showEmailErr ? "email-err" : undefined}
        className={cn(
          "bg-input/50 border-border h-11 pl-9 pr-9 transition-colors",
          showEmailErr && "border-destructive focus-visible:ring-destructive/40",
          touched.email && !emailError && "border-[hsl(var(--success,145_60%_50%))]/60",
        )}
      />
      {touched.email && !emailError && (
        <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--success,145_60%_50%))]" />
      )}
      {showEmailErr && (
        <X size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-destructive" />
      )}
    </div>
    <AnimatePresence>
      {showEmailErr && (
        <m.p
          id="email-err"
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          className="text-[11.5px] text-destructive mt-1.5 ml-0.5"
        >
          {emailError}
        </m.p>
      )}
    </AnimatePresence>
  </m.div>
);

export const PasswordField = ({
  mode,
  password,
  setPassword,
  setTouched,
  showPw,
  setShowPw,
  passwordError,
  showPwErr,
  shake,
  pwInfo,
  onForgot,
}: {
  mode: "signin" | "signup";
  password: string;
  setPassword: (v: string) => void;
  setTouched: React.Dispatch<React.SetStateAction<{ email: boolean; password: boolean }>>;
  showPw: boolean;
  setShowPw: React.Dispatch<React.SetStateAction<boolean>>;
  passwordError: string | null;
  showPwErr: string | null | false;
  shake: boolean;
  pwInfo: { score: number; checks: PasswordCheck[] };
  onForgot: () => void;
}) => {
  const strength = STRENGTH_META[pwInfo.score];
  return (
    <m.div animate={shake ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : { x: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex items-center justify-between mb-1.5">
        <Label htmlFor="password" className="text-[11px] uppercase tracking-wider text-[hsl(var(--foreground-subtle))]">
          Password
        </Label>
        {mode === "signin" && (
          <button type="button" onClick={onForgot} className="text-[11px] text-primary hover:underline">
            Forgot?
          </button>
        )}
      </div>
      <div className="relative">
        <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--foreground-subtle))] pointer-events-none" />
        <Input
          id="password"
          type={showPw ? "text" : "password"}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          placeholder="••••••••"
          aria-invalid={!!showPwErr}
          aria-describedby={showPwErr ? "pw-err" : undefined}
          className={cn(
            "bg-input/50 border-border h-11 pl-9 pr-10 transition-colors",
            showPwErr && "border-destructive focus-visible:ring-destructive/40",
          )}
        />
        <button
          type="button"
          onClick={() => setShowPw((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-[hsl(var(--foreground-subtle))] hover:text-foreground hover:bg-[hsl(var(--bg-muted))] transition-colors"
          aria-label={showPw ? "Hide password" : "Show password"}
        >
          {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      {/* Strength meter (signup only) */}
      <AnimatePresence>
        {mode === "signup" && password.length > 0 && (
          <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2">
              <div className="flex gap-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-1.5 flex-1 rounded-full bg-border overflow-hidden">
                    <m.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: i < pwInfo.score ? 1 : 0 }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                      style={{ originX: 0 }}
                      className={cn("h-full rounded-full", strength.color)}
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className={cn("font-medium", strength.text)}>{strength.label}</span>
                <span className="text-[hsl(var(--foreground-subtle))]">{pwInfo.score}/4</span>
              </div>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1">
                {pwInfo.checks.map((c) => (
                  <li
                    key={c.id}
                    className={cn(
                      "flex items-center gap-1.5 text-[11px] transition-colors",
                      c.pass ? "text-[hsl(var(--success,145_60%_50%))]" : "text-[hsl(var(--foreground-subtle))]",
                    )}
                  >
                    {c.pass ? <Check size={11} /> : <span className="size-[11px] rounded-full border border-current opacity-60" />}
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPwErr && mode === "signin" && (
          <m.p
            id="pw-err"
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            className="text-[11.5px] text-destructive mt-1.5 ml-0.5"
          >
            {passwordError}
          </m.p>
        )}
      </AnimatePresence>
    </m.div>
  );
};
