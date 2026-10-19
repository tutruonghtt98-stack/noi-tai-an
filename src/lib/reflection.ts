export const CAUSES = ["unclear", "too_big", "distraction", "fatigue", "fear", "perfectionism", "low_energy", "other"] as const;
export type Cause = (typeof CAUSES)[number];
