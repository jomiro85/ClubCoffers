/**
 * Validates an app-internal redirect path (pathname only) to reduce open-redirect risk.
 * For v1, invite return URLs use `/join/<token>`.
 */
export function getSafeRedirectPath(
  raw: string | null | undefined
): string | null {
  if (raw == null || raw === "") {
    return null;
  }

  let t = raw.trim();
  try {
    t = decodeURIComponent(t);
  } catch {
    return null;
  }

  if (!t.startsWith("/") || t.startsWith("//")) {
    return null;
  }
  if (t.includes("://") || t.includes("\\")) {
    return null;
  }
  if (t.length > 512) {
    return null;
  }

  // /join/<token> — token is a single path segment (e.g. UUID)
  if (/^\/join\/[^/]+$/.test(t)) {
    return t;
  }

  return null;
}
