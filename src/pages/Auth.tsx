import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AuthBrandShowcase } from "./auth/AuthBrandShowcase";
import { AuthForm } from "./auth/AuthForm";

const Auth = () => {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground relative overflow-hidden">
      {/* ambient backdrop (visible on small screens too) */}
      <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" aria-hidden />
      <div className="absolute -top-32 -left-32 w-[40rem] h-[40rem] bg-primary/20 rounded-full blur-3xl pointer-events-none" aria-hidden />
      <div className="absolute -bottom-32 -right-32 w-[40rem] h-[40rem] bg-accent/15 rounded-full blur-3xl pointer-events-none" aria-hidden />

      <Link
        to="/"
        className="absolute top-4 sm:top-6 left-4 sm:left-6 z-20 inline-flex items-center gap-1.5 text-[13px] text-[hsl(var(--foreground-muted))] hover:text-foreground transition-colors"
      >
        <ArrowLeft size={15} /> Back
      </Link>

      <div className="relative z-10 grid lg:grid-cols-2 min-h-[100dvh]">
        <AuthBrandShowcase />
        <AuthForm />
      </div>
    </div>
  );
};

export default Auth;
