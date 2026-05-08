export interface PasswordCheck {
  id: string;
  label: string;
  pass: boolean;
}

export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const evaluatePassword = (pw: string): { score: number; checks: PasswordCheck[] } => {
  const checks: PasswordCheck[] = [
    { id: "len", label: "8+ characters", pass: pw.length >= 8 },
    { id: "case", label: "Upper & lowercase", pass: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
    { id: "num", label: "A number", pass: /\d/.test(pw) },
    { id: "sym", label: "A symbol", pass: /[^A-Za-z0-9]/.test(pw) },
  ];
  return { score: checks.filter((c) => c.pass).length, checks };
};

export const STRENGTH_META = [
  { label: "Too weak", color: "bg-destructive", text: "text-destructive" },
  { label: "Weak", color: "bg-destructive", text: "text-destructive" },
  { label: "Okay", color: "bg-[hsl(var(--warning,38_92%_55%))]", text: "text-[hsl(var(--warning,38_92%_55%))]" },
  { label: "Good", color: "bg-primary", text: "text-primary" },
  { label: "Strong", color: "bg-[hsl(var(--success,145_60%_50%))]", text: "text-[hsl(var(--success,145_60%_50%))]" },
];

import { Sparkles, Zap, ShieldCheck } from "lucide-react";

export const FEATURES = [
  { Icon: Sparkles, title: "AI builds with you", body: "Describe in plain English — get a live, working app in minutes." },
  { Icon: Zap, title: "Ship to native APK", body: "One-click Android builds, no Android Studio required." },
  { Icon: ShieldCheck, title: "Secure by default", body: "Row-level security and auth wired up from day one." },
];

export const TESTIMONIALS = [
  { name: "Rashed K.", role: "Indie founder", quote: "From idea to APK in one afternoon. This is the future of building." },
  { name: "Mehzabin A.", role: "Product designer", quote: "I don't write code. I shipped my first SaaS prototype this week." },
  { name: "Tanvir H.", role: "Backend engineer", quote: "The Supabase wiring saved me a full sprint. Genuinely magic." },
];
