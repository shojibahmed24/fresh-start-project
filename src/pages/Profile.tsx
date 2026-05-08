import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { m } from "framer-motion";
import {
  ArrowLeft, Bell, CreditCard, ImagePlus, KeyRound,
  Loader2, LogOut, Mail, Save, Shield, Trash2, Upload, User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { AvatarCropDialog } from "@/components/profile/AvatarCropDialog";
import { UserInvoices } from "@/components/UserInvoices";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const NOTIF_PREF_KEY = "oneclick-notif-prefs";

type NotifPrefs = { product: boolean; security: boolean; billing: boolean; marketing: boolean };
const DEFAULT_PREFS: NotifPrefs = { product: true, security: true, billing: true, marketing: false };

const Profile = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile, loading, update, uploadAvatar, removeAvatar } = useProfile();
  const { balance } = useCredits();

  // ─── form state ───
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  // ─── avatar state ───
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // ─── notification prefs (local-only UI) ───
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTIF_PREF_KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch { /* noop */ }
  }, []);
  const updatePref = (k: keyof NotifPrefs, v: boolean) => {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    localStorage.setItem(NOTIF_PREF_KEY, JSON.stringify(next));
    toast.success("Preference saved", { description: `${k[0].toUpperCase() + k.slice(1)} alerts ${v ? "on" : "off"}` });
  };

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  const initial = (profile?.display_name?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();
  const avatar = profile?.avatar_url;
  const dirty = useMemo(
    () => profile != null && (displayName.trim() !== (profile.display_name ?? "") || bio.trim() !== (profile.bio ?? "")),
    [displayName, bio, profile],
  );

  // ─── save handlers ───
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await update({ display_name: displayName.trim() || null, bio: bio.trim() || null });
      toast.success("Profile saved", { description: "Your changes are now visible across the app." });
    } catch (err: any) {
      toast.error("Couldn't save profile", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // ─── avatar pick / drop ───
  const validateAndPreview = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image file");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Image is too big — keep it under 5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) validateAndPreview(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) validateAndPreview(f);
  };

  const handleCropConfirm = async (blob: Blob) => {
    setUploading(true);
    try {
      const file = new File([blob], `avatar-${Date.now()}.jpg`, { type: "image/jpeg" });
      await uploadAvatar(file);
      toast.success("Avatar updated", { description: "Looking good." });
    } catch (err: any) {
      toast.error("Couldn't upload avatar", { description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try { await removeAvatar(); toast.success("Avatar removed"); }
    catch (err: any) { toast.error(err.message); }
  };

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  // ─── security: password reset ───
  const [resetSending, setResetSending] = useState(false);
  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setResetSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast.success("Reset email sent", { description: `Check ${user.email} for the link.` });
    } catch (err: any) {
      toast.error("Couldn't send reset email", { description: err.message });
    } finally {
      setResetSending(false);
    }
  };

  if (authLoading || loading || !profile) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-[hsl(var(--foreground-muted))] gap-2 font-mono text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading profile…
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 glass-strong border-b border-border pt-safe">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              to="/projects"
              className="p-1.5 rounded-md text-[hsl(var(--foreground-muted))] hover:text-foreground hover:bg-[hsl(var(--bg-muted))] transition-colors"
              aria-label="Back to projects"
            >
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-base font-semibold truncate">Settings</h1>
          </div>
          <ThemeSwitcher variant="compact" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        {/* Identity hero */}
        <m.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="relative overflow-hidden rounded-2xl border border-border bg-[hsl(var(--bg-muted))] p-5 sm:p-6"
        >
          <div className="absolute inset-0 bg-[var(--gradient-primary-soft)] opacity-60 pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row items-center gap-5">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                "relative shrink-0 rounded-full transition-all",
                dragOver && "ring-4 ring-primary/60 ring-offset-2 ring-offset-[hsl(var(--bg-muted))] scale-105",
              )}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className={cn(
                  "size-24 sm:size-28 rounded-full ring-2 ring-primary/30 flex items-center justify-center font-semibold text-primary-foreground overflow-hidden transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-4 group",
                  !avatar && "bg-gradient-to-br from-primary to-primary-glow",
                )}
                aria-label="Change avatar"
              >
                {avatar ? (
                  <img src={avatar} alt={displayName || "avatar"} className="size-full object-cover" />
                ) : (
                  <span className="text-3xl sm:text-4xl">{initial}</span>
                )}
                <span className={cn(
                  "absolute inset-0 rounded-full bg-black/55 backdrop-blur-[2px] flex flex-col items-center justify-center text-white text-[10px] font-medium gap-0.5 transition-opacity",
                  uploading ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}>
                  {uploading
                    ? <Loader2 className="size-5 animate-spin" />
                    : <><ImagePlus size={18} /> Drop / click</>}
                </span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileInput} className="hidden" />
            </div>

            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="text-lg font-semibold text-foreground truncate">
                {profile.display_name || "Unnamed"}
              </div>
              <div className="flex items-center gap-1.5 justify-center sm:justify-start text-[13px] text-[hsl(var(--foreground-muted))] mt-0.5 min-w-0">
                <Mail size={12} className="shrink-0" />
                <span className="truncate">{user?.email}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3 justify-center sm:justify-start">
                <Button type="button" size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload size={13} className="mr-1.5" />
                  {avatar ? "Replace" : "Upload"}
                </Button>
                {avatar && (
                  <Button type="button" size="sm" variant="ghost" onClick={handleRemoveAvatar}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 size={13} className="mr-1.5" />Remove
                  </Button>
                )}
                <span className="text-[11px] text-[hsl(var(--foreground-subtle))] sm:ml-1">
                  Drag & drop · JPG, PNG, GIF · max 5 MB
                </span>
              </div>
            </div>
          </div>
        </m.section>

        {/* Tabs */}
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid grid-cols-4 w-full h-11 bg-[hsl(var(--bg-muted))] border border-border p-1 rounded-xl">
            <TabsTrigger value="profile" className="text-[12.5px] gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <UserIcon size={13} /><span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="text-[12.5px] gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Shield size={13} /><span className="hidden sm:inline">Security</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="text-[12.5px] gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <CreditCard size={13} /><span className="hidden sm:inline">Billing</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-[12.5px] gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Bell size={13} /><span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
          </TabsList>

          {/* ─── PROFILE ─── */}
          <TabsContent value="profile" className="mt-5 space-y-5">
            <form onSubmit={handleSave}
              className="rounded-2xl border border-border bg-[hsl(var(--bg-muted))] p-5 sm:p-6 space-y-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <UserIcon size={14} className="text-primary" />Account details
              </div>
              <div className="space-y-2">
                <Label htmlFor="display_name" className="text-[12.5px]">Display name</Label>
                <Input id="display_name" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="How should we call you?" maxLength={48} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio" className="text-[12.5px]">Bio</Label>
                <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)}
                  placeholder="A short description about you (optional)" rows={4} maxLength={280} />
                <div className="text-[11px] text-[hsl(var(--foreground-subtle))] text-right tabular-nums">
                  {bio.length} / 280
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[12.5px]">Email</Label>
                <Input value={user?.email ?? ""} disabled className="h-11 opacity-70" />
                <p className="text-[11px] text-[hsl(var(--foreground-subtle))]">
                  Email is managed via your auth provider and can't be changed here.
                </p>
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={!dirty || saving} loading={saving} leftIcon={<Save size={14} />}>
                  Save changes
                </Button>
              </div>
            </form>

            {/* Appearance */}
            <section className="rounded-2xl border border-border bg-[hsl(var(--bg-muted))] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-sm font-semibold mb-1">Appearance</div>
                  <p className="text-[12.5px] text-[hsl(var(--foreground-muted))]">
                    Pick a theme — system follows your OS automatically.
                  </p>
                </div>
                <ThemeSwitcher />
              </div>
            </section>
          </TabsContent>

          {/* ─── SECURITY ─── */}
          <TabsContent value="security" className="mt-5 space-y-5">
            <section className="rounded-2xl border border-border bg-[hsl(var(--bg-muted))] p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <KeyRound size={14} className="text-primary" />Password
              </div>
              <p className="text-[12.5px] text-[hsl(var(--foreground-muted))]">
                We'll email you a secure link to set a new password. The link expires in 1 hour.
              </p>
              <Button type="button" variant="secondary" onClick={handlePasswordReset} disabled={resetSending} loading={resetSending}>
                Send password reset email
              </Button>
            </section>

            <section className="rounded-2xl border border-border bg-[hsl(var(--bg-muted))] p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Shield size={14} className="text-primary" />Active session
              </div>
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-[hsl(var(--foreground-muted))]">Signed in as</span>
                <span className="font-mono text-foreground truncate ml-2">{user?.email}</span>
              </div>
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-[hsl(var(--foreground-muted))]">User ID</span>
                <span className="font-mono text-[11px] text-[hsl(var(--foreground-subtle))] truncate ml-2">{user?.id}</span>
              </div>
            </section>

            <section className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 sm:p-6">
              <div className="text-sm font-semibold text-destructive mb-1">Sign out</div>
              <p className="text-[12.5px] text-[hsl(var(--foreground-muted))] mb-3">
                End your session on this device. You'll need to sign in again to access your projects.
              </p>
              <Button variant="destructive" size="sm" onClick={handleSignOut}>
                <LogOut size={14} className="mr-1.5" />Sign out
              </Button>
            </section>
          </TabsContent>

          {/* ─── BILLING ─── */}
          <TabsContent value="billing" className="mt-5 space-y-5">
            <section className="rounded-2xl border border-border bg-[hsl(var(--bg-muted))] p-5 sm:p-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-[12px] uppercase tracking-wider text-[hsl(var(--foreground-subtle))] mb-1">
                    Current balance
                  </div>
                  <div className="text-3xl font-bold tabular-nums bg-clip-text text-transparent bg-[var(--gradient-primary)]">
                    {balance.toLocaleString()} <span className="text-base font-medium text-foreground">credits</span>
                  </div>
                </div>
                <Button asChild>
                  <Link to="/shop">
                    <CreditCard size={14} className="mr-1.5" />Top up
                  </Link>
                </Button>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-[hsl(var(--bg-muted))] p-5 sm:p-6">
              <UserInvoices />
              <p className="text-[12px] text-[hsl(var(--foreground-subtle))] mt-2">
                Receipts also available on the Shop page after each purchase.
              </p>
            </section>
          </TabsContent>

          {/* ─── NOTIFICATIONS ─── */}
          <TabsContent value="notifications" className="mt-5 space-y-5">
            <section className="rounded-2xl border border-border bg-[hsl(var(--bg-muted))] p-5 sm:p-6 divide-y divide-border">
              {[
                { key: "product" as const, title: "Product updates", desc: "New features, improvements, build status changes." },
                { key: "security" as const, title: "Security alerts", desc: "Sign-ins from new devices and password changes.", locked: true },
                { key: "billing" as const, title: "Billing & receipts", desc: "Order approvals, refunds, low balance warnings." },
                { key: "marketing" as const, title: "Tips & promotions", desc: "Occasional emails with promo codes and tutorials." },
              ].map((row) => (
                <div key={row.key} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium">{row.title}</div>
                    <div className="text-[12px] text-[hsl(var(--foreground-muted))] mt-0.5">{row.desc}</div>
                  </div>
                  <Switch
                    checked={row.key === "security" ? true : prefs[row.key]}
                    disabled={row.key === "security"}
                    onCheckedChange={(v) => updatePref(row.key, v)}
                  />
                </div>
              ))}
            </section>
            <p className="text-[11px] text-[hsl(var(--foreground-subtle))]">
              Preferences sync to this device. Email-channel toggles will arrive in a future update.
            </p>
          </TabsContent>
        </Tabs>
      </main>

      <AvatarCropDialog
        open={!!cropSrc}
        src={cropSrc}
        onClose={() => setCropSrc(null)}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
};

export default Profile;
