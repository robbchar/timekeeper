/** CSS color for a project's palette key; unknown, malformed or missing keys fall back to muted. */
export function projectColor(key: string | null): string {
  // Anything but a plain word (a hex color, say) would make the whole var() invalid, not muted.
  return key && /^[a-z]+$/.test(key) ? `var(--project-${key}, var(--muted))` : "var(--muted)";
}
