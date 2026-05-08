// Client for the `estimate-build` edge function.
// Returns a quick effort/cost estimate for a user message so the UI can show
// "this is a ~32-file, ~4-min job using Sonnet" before the run starts.

import { supabase } from "@/integrations/supabase/client";

export type BuildEstimate = {
  files: number;
  minutes: number;
  model: "gemini-flash" | "gemini-pro" | "sonnet" | "opus";
  migrations: number;
  complexity: "trivial" | "small" | "medium" | "large" | "epic";
  summary: string;
};

export async function estimateBuild(input: {
  message: string;
  isEmpty: boolean;
  fileCount: number;
  signal?: AbortSignal;
}): Promise<BuildEstimate | null> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return null;

  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/estimate-build`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: input.message,
        isEmpty: input.isEmpty,
        fileCount: input.fileCount,
      }),
      signal: input.signal,
    });
    if (!resp.ok) return null;
    return (await resp.json()) as BuildEstimate;
  } catch {
    return null;
  }
}

// Pretty model labels for the UI.
export function formatModelLabel(model: BuildEstimate["model"]): string {
  switch (model) {
    case "gemini-flash":
      return "Gemini Flash";
    case "gemini-pro":
      return "Gemini Pro";
    case "sonnet":
      return "Claude Sonnet";
    case "opus":
      return "Claude Opus";
  }
}
