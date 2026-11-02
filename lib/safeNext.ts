/** Only same-site paths, so a crafted link can't send people to another site after sign-in. */
export function safeNext(value: unknown, fallback = "/"): string {
  const next = typeof value === "string" ? value : "";
  // Browsers read "/\evil.com" as "//evil.com", so backslashes and control characters are refused too.
  if (!next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
