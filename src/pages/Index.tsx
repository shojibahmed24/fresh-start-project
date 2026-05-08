import { lazy } from "react";
import { m } from "framer-motion";
import { ArrowRight, Bot, Code2, Eye, MessageSquare, Sparkles, Zap, Layers, Rocket } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { AuroraBackground } from "@/components/landing/AuroraBackground";
import { HeroReveal } from "@/components/landing/HeroReveal";
import { LazyInView } from "@/components/landing/LazyInView";
import heroLockup from "@/assets/oneclick-hero-lockup.webp";

// Below-the-fold landing sections — split into separate chunks and only
// fetched/rendered when their slot is about to enter the viewport.
const MiniBuilderDemo = lazy(() =>
  import("@/components/landing/MiniBuilderDemo").then((m) => ({ default: m.MiniBuilderDemo })),
);
const ShowcaseGallery = lazy(() =>
  import("@/components/landing/ShowcaseGallery").then((m) => ({ default: m.ShowcaseGallery })),
);
const SocialProof = lazy(() =>
  import("@/components/landing/SocialProof").then((m) => ({ default: m.SocialProof })),
);
const PricingSection = lazy(() =>
  import("@/components/landing/PricingSection").then((m) => ({ default: m.PricingSection })),
);
const FaqSection = lazy(() =>
  import("@/components/landing/FaqSection").then((m) => ({ default: m.FaqSection })),
);

const features = [
  { icon: Bot, title: "Plan Mode", desc: "AI architects your app with screens, features and data models before writing a single line.", color: "from-cyan-400 to-blue-500" },
  { icon: Code2, title: "Generate Mode", desc: "Approved plans turn into clean, structured production-ready code instantly.", color: "from-purple-400 to-fuchsia-500" },
  { icon: Sparkles, title: "Edit Mode", desc: "Surgical edits via diffs — change one component without breaking the rest.", color: "from-fuchsia-400 to-pink-500" },
  { icon: MessageSquare, title: "Chat Mode", desc: "Ask, debug, refactor — your AI engineer is always one message away.", color: "from-pink-400 to-rose-500" },
];

const steps = [
  { n: "01", icon: MessageSquare, title: "Describe your idea", desc: "One sentence is enough. AI handles the rest." },
  { n: "02", icon: Layers, title: "Review the plan", desc: "Tweak features, screens and data models before generation." },
  { n: "03", icon: Code2, title: "Generate code", desc: "Full project scaffolded with components, routes and state." },
  { n: "04", icon: Rocket, title: "Edit & ship", desc: "Iterate visually or via chat. Live preview updates instantly." },
];

const Index = () => {
  const reduce = useReducedMotion();
  const { user, loading } = useAuth();

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-[100dvh] bg-background overflow-x-hidden">
      <Navbar />

      {/* ─── Hero ─── */}
      <section className="relative pt-28 sm:pt-36 pb-20 sm:pb-28 px-4 sm:px-6">
        <AuroraBackground />

        <div className="relative max-w-5xl mx-auto text-center">
          <m.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="relative mx-auto mb-6 sm:mb-8 w-full max-w-[520px] sm:max-w-[640px]"
          >
            <div className="absolute inset-0 bg-gradient-primary opacity-30 blur-3xl rounded-full pointer-events-none" />
            <img
              src={heroLockup}
              alt="OneClick Studio — No-code mobile app builder"
              className="relative w-full h-auto select-none drop-shadow-[0_8px_40px_hsl(var(--primary)/0.35)] mix-blend-screen"
              loading="eager"
            />
          </m.div>

          <m.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass border-primary/30 text-xs sm:text-sm mb-6 sm:mb-8 shadow-glow"
          >
            <Zap size={14} className="text-primary" />
            <span className="text-foreground/80">AI-powered app engineering</span>
          </m.div>

          <HeroReveal
            text="Build apps with"
            accent="AI"
            className="text-[40px] leading-[1.05] sm:text-5xl md:text-7xl font-bold tracking-tight mb-5 sm:mb-6 sm:leading-[1.05]"
          />

          <m.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 sm:mb-10 px-2"
          >
            <span className="sm:hidden">Your AI software engineer — ship in minutes.</span>
            <span className="hidden sm:inline">
              Plan, generate and edit production-grade applications through conversation.
              Visual editing, live preview, and surgical AI-powered diffs.
            </span>
          </m.p>

          <m.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75 }}
            className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4 sm:justify-center px-4 sm:px-0"
          >
            <Link to="/dashboard" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto h-12 bg-gradient-primary hover:opacity-90 text-primary-foreground font-semibold shadow-glow group">
                Start building free
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={18} />
              </Button>
            </Link>
            {/* Mobile: secondary action as plain link, not a heavy button */}
            <Link
              to="/auth"
              className="sm:hidden text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              Already have an account? <span className="text-primary font-medium">Sign in</span>
            </Link>
            {/* Desktop keeps the dual-button layout */}
            <Link to="/auth" className="hidden sm:block">
              <Button size="lg" variant="outline" className="h-12 border-border bg-card/50 backdrop-blur">
                Sign in
              </Button>
            </Link>
          </m.div>

          {/* Live mini-builder demo */}
          <m.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.7 }}
            className="hidden sm:block mt-16 sm:mt-20 relative text-left"
          >
            <div className="absolute inset-x-0 -top-10 h-40 bg-gradient-hero opacity-20 blur-3xl pointer-events-none" />
            <LazyInView minHeight={420} rootMargin="400px">
              <MiniBuilderDemo />
            </LazyInView>
          </m.div>
        </div>
      </section>

      {/* ─── Social proof ─── */}
      <LazyInView minHeight={120}>
        <SocialProof />
      </LazyInView>

      {/* ─── Features ─── */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">Four modes. <span className="text-gradient">One engineer.</span></h2>
            <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">Not a chatbot. A complete AI workflow that thinks, plans, builds and refines.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {features.map((f, i) => (
              <m.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass rounded-2xl p-5 sm:p-6 hover:border-primary/40 transition-all hover:-translate-y-1 group"
              >
                <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${f.color} p-2.5 mb-3 sm:mb-4 group-hover:scale-110 transition-transform`}>
                  <f.icon className="w-full h-full text-background" />
                </div>
                <h3 className="font-semibold text-base sm:text-lg mb-1.5 sm:mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </m.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Showcase gallery ─── */}
      <LazyInView minHeight={300}>
        <ShowcaseGallery />
      </LazyInView>

      {/* ─── How it works ─── */}
      <section id="how" className="py-16 sm:py-24 px-4 sm:px-6 relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">From idea to <span className="text-gradient">shipped app</span></h2>
            <p className="text-muted-foreground text-base sm:text-lg">Four steps. Minutes, not months.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {steps.map((s, i) => (
              <m.div
                key={s.n}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative"
              >
                <div className="glass rounded-2xl p-5 sm:p-6 h-full">
                  <div className="text-4xl sm:text-5xl font-bold text-gradient opacity-50 mb-2 sm:mb-3">{s.n}</div>
                  <s.icon size={22} className="text-primary mb-3" />
                  <h3 className="font-semibold mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </m.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <LazyInView minHeight={400}>
        <PricingSection />
      </LazyInView>

      {/* ─── FAQ ─── */}
      <LazyInView minHeight={300}>
        <FaqSection />
      </LazyInView>

      {/* ─── Final CTA ─── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative glass-strong rounded-2xl sm:rounded-3xl p-6 sm:p-12 text-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-hero opacity-10" />
            <div className={`absolute -top-20 -right-20 w-60 h-60 bg-primary/30 rounded-full blur-3xl ${reduce ? "" : "animate-pulse-glow"}`} />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-accent/30 rounded-full blur-3xl" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">Ready to ship faster?</h2>
              <p className="text-muted-foreground text-base sm:text-lg mb-6 sm:mb-8 max-w-xl mx-auto">
                Stop wiring boilerplate. Start solving real problems with an AI engineer at your side.
              </p>
              <Link to="/dashboard">
                <Button size="lg" className="w-full sm:w-auto h-12 bg-gradient-primary hover:opacity-90 text-primary-foreground font-semibold shadow-glow">
                  Open dashboard
                  <ArrowRight className="ml-2" size={18} />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/50 py-6 sm:py-8 px-4 sm:px-6 text-center text-xs sm:text-sm text-muted-foreground">
        Built with <Eye size={14} className="inline mx-1" /> by OneClick Studio
      </footer>
    </div>
  );
};

export default Index;
