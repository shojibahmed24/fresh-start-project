import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppSettings = {
  site_name: string;
  site_logo_url: string;
  contact_email: string;
  contact_phone: string;
  vat_percent: number;
  invoice_prefix: string;
  order_auto_reject_days: number;
  maintenance_mode: boolean;
  maintenance_message: string;
};

const DEFAULTS: AppSettings = {
  site_name: "SmartApp",
  site_logo_url: "",
  contact_email: "",
  contact_phone: "",
  vat_percent: 0,
  invoice_prefix: "INV",
  order_auto_reject_days: 7,
  maintenance_mode: false,
  maintenance_message: "",
};

// Single-row settings table. Used for site branding, VAT, maintenance flag, etc.
export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase.from("app_settings").select("*").eq("id", true).maybeSingle();
    if (data) setSettings({ ...DEFAULTS, ...(data as any) });
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const update = async (patch: Partial<AppSettings>) => {
    const { error } = await supabase.from("app_settings").update(patch).eq("id", true);
    if (error) throw error;
    setSettings((s) => ({ ...s, ...patch }));
  };

  return { settings, loading, refresh, update };
};
