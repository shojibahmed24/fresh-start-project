import { Info, AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  variant: "info" | "success" | "warning" | "promo" | "danger";
  link_url: string;
  link_label: string;
  is_active: boolean;
  starts_at: string;
  expires_at: string | null;
  sort_order: number;
};

export type Faq = {
  id: string;
  question: string;
  answer: string;
  category: string;
  is_active: boolean;
  sort_order: number;
};

export type EditAnn = Partial<Announcement> & { _new?: boolean };
export type EditFaq = Partial<Faq> & { _new?: boolean };

export const VARIANT_OPTIONS = [
  { value: "info", label: "Info", icon: <Info size={12} className="text-sky-300" /> },
  { value: "success", label: "Success", icon: <CheckCircle2 size={12} className="text-emerald-300" /> },
  { value: "warning", label: "Warning", icon: <AlertTriangle size={12} className="text-amber-300" /> },
  { value: "danger", label: "Danger", icon: <AlertTriangle size={12} className="text-red-300" /> },
  { value: "promo", label: "Promo", icon: <Sparkles size={12} className="text-fuchsia-300" /> },
];

export const VARIANT_BADGE: Record<string, string> = {
  info: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  danger: "bg-red-500/15 text-red-300 border-red-500/30",
  promo: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
};

export const toLocalInput = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
};

export const fromLocalInput = (val: string): string | null => {
  if (!val) return null;
  return new Date(val).toISOString();
};
