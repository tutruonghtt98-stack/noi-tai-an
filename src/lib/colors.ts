export const COLORS = ["ochre", "jade", "mist", "rose"] as const;
export type ColorName = (typeof COLORS)[number];

export const colorVar = (c: string) => (COLORS.includes(c as ColorName) ? `var(--${c})` : "var(--accent)");
export const softVar = (c: string) => (COLORS.includes(c as ColorName) ? `var(--${c}-soft)` : "var(--accent-soft)");
export const inkVar = (c: string) => (COLORS.includes(c as ColorName) ? `var(--${c}-ink)` : "var(--accent-ink)");
