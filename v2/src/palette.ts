/** CSS color for a project's palette key; unknown or missing keys fall back to muted. */
export function projectColor(key: string | null): string {
  return key ? `var(--project-${key}, var(--muted))` : "var(--muted)";
}
