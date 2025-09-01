export const EXPERT_COLORS = [
  'var(--accent)',
  'var(--accent-2)',
  'rgb(var(--success))',
  'rgb(var(--warn))',
  'rgb(var(--danger))'
] as const;

/**
 * Returns a CSS color value for a given expert index (1-based).
 * Colors cycle through the EXPERT_COLORS array when index exceeds its length.
 */
export function getExpertColor(index: number): string {
  if (index <= 0) return EXPERT_COLORS[0];
  return EXPERT_COLORS[(index - 1) % EXPERT_COLORS.length];
}
