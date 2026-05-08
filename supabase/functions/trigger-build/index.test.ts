import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { normalizeGitHubRepo } from "./index.ts";

Deno.test("normalizeGitHubRepo accepts owner/repo slugs", () => {
  assertEquals(normalizeGitHubRepo("shojbahmed330/-buildapk"), "shojbahmed330/-buildapk");
});

Deno.test("normalizeGitHubRepo accepts full GitHub URLs", () => {
  assertEquals(
    normalizeGitHubRepo("https://github.com/shojbahmed330/-buildapk"),
    "shojbahmed330/-buildapk",
  );
});

Deno.test("normalizeGitHubRepo strips .git suffix", () => {
  assertEquals(
    normalizeGitHubRepo("https://github.com/shojbahmed330/-buildapk.git"),
    "shojbahmed330/-buildapk",
  );
});

Deno.test("normalizeGitHubRepo rejects non-GitHub URLs", () => {
  assertEquals(normalizeGitHubRepo("https://example.com/shojbahmed330/-buildapk"), null);
});