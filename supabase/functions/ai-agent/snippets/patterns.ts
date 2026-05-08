// ═══════════════════════════════════════════════════════════════════════════
// PATTERNS — production edge-case primitives
// ───────────────────────────────────────────────────────────────────────────
// Three patterns the agent forgets the most often when shipping "real" UX:
//   1. Form validation with zod + inline error UI + submit-disable
//   2. Optimistic update with rollback on error
//   3. Race-condition guard for async fetches (cancel stale responses)
// Surfaced via get_snippet so the agent fetches the canonical version
// instead of reinventing each one (badly) in every component.
// ═══════════════════════════════════════════════════════════════════════════

import type { Snippet } from "./types.ts";

export const FORM_VALIDATION: Snippet = {
  name: "FormValidationPattern",
  why:
    "Every form must validate BOTH on change (inline errors) AND on submit (block + focus first error), disable submit while pending, and surface server errors via toast. Half-validated forms are the #1 production complaint.",
  uses: ["zod", "sonner", "react"],
  code: `// Pattern: validated form with inline + submit errors and pending state
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  name: z.string().trim().min(2, "At least 2 characters").max(80),
});
type FormValues = z.infer<typeof schema>;
type FieldErrors = Partial<Record<keyof FormValues, string>>;

export function ContactForm({ onSubmit }: { onSubmit: (v: FormValues) => Promise<void> }) {
  const [values, setValues] = useState<FormValues>({ email: "", name: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  const update = <K extends keyof FormValues>(key: K, val: FormValues[K]) => {
    setValues((v) => ({ ...v, [key]: val }));
    // Re-validate just this field on change for instant feedback
    const single = schema.shape[key].safeParse(val);
    setErrors((e) => ({ ...e, [key]: single.success ? undefined : single.error.issues[0].message }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return; // double-submit guard
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const fe: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof FormValues;
        if (!fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      // Focus the first invalid field for a11y
      const firstKey = Object.keys(fe)[0];
      if (firstKey) document.getElementById(\`field-\${firstKey}\`)?.focus();
      return;
    }
    setPending(true);
    try {
      await onSubmit(parsed.data);
      toast.success("Saved");
      setValues({ email: "", name: "" });
      setErrors({});
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <input
          id="field-name"
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "err-name" : undefined}
          className="w-full rounded-xl border px-4 py-3"
          placeholder="Your name"
        />
        {errors.name && <p id="err-name" className="mt-1 text-sm text-red-500">{errors.name}</p>}
      </div>
      <div>
        <input
          id="field-email"
          type="email"
          value={values.email}
          onChange={(e) => update("email", e.target.value)}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "err-email" : undefined}
          className="w-full rounded-xl border px-4 py-3"
          placeholder="you@example.com"
        />
        {errors.email && <p id="err-email" className="mt-1 text-sm text-red-500">{errors.email}</p>}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Saving…" : "Submit"}
      </button>
    </form>
  );
}
`,
};

export const OPTIMISTIC_UPDATE: Snippet = {
  name: "OptimisticUpdatePattern",
  why:
    "Mutations (like, add-to-cart, toggle-complete, delete) MUST update UI instantly and rollback on server error — never spinner-wait. This pattern captures the rollback + toast contract correctly.",
  uses: ["sonner", "react"],
  code: `// Pattern: optimistic mutation with rollback
import { useState } from "react";
import { toast } from "sonner";

type Item = { id: string; liked: boolean; likes: number };

export function useToggleLike(initial: Item[], persist: (id: string, liked: boolean) => Promise<void>) {
  const [items, setItems] = useState<Item[]>(initial);

  const toggle = async (id: string) => {
    let prev: Item[] = [];
    setItems((curr) => {
      prev = curr; // capture pre-mutation snapshot for rollback
      return curr.map((it) =>
        it.id === id ? { ...it, liked: !it.liked, likes: it.likes + (it.liked ? -1 : 1) } : it,
      );
    });
    const target = prev.find((i) => i.id === id);
    if (!target) return;
    try {
      await persist(id, !target.liked);
    } catch (err: any) {
      setItems(prev); // rollback
      toast.error(err?.message ?? "Couldn't save. Reverted.");
    }
  };

  return { items, toggle };
}
`,
};

export const RACE_CONDITION_GUARD: Snippet = {
  name: "RaceConditionGuardPattern",
  why:
    "Search/filter inputs that fetch on every keystroke MUST cancel stale responses, otherwise a slow earlier request overwrites the latest results. This pattern uses AbortController + a request-id ref so only the freshest response wins.",
  uses: ["react"],
  code: `// Pattern: race-safe async fetch with abort + request-id
import { useEffect, useRef, useState } from "react";

export function useDebouncedSearch<T>(query: string, fetcher: (q: string, signal: AbortSignal) => Promise<T[]>, delayMs = 250) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const myId = ++reqId.current;
    if (!query.trim()) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetcher(query, ctrl.signal);
        // Drop stale responses — only the most recent request may write.
        if (myId !== reqId.current) return;
        setData(res);
      } catch (e: any) {
        if (e?.name === "AbortError" || myId !== reqId.current) return;
        setError(e?.message ?? "Search failed");
      } finally {
        if (myId === reqId.current) setLoading(false);
      }
    }, delayMs);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, fetcher, delayMs]);

  return { data, loading, error };
}
`,
};

export const EDGE_CASE_SNIPPETS: Snippet[] = [
  FORM_VALIDATION,
  OPTIMISTIC_UPDATE,
  RACE_CONDITION_GUARD,
];
