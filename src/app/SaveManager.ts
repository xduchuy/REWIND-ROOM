export interface Save {
  version: 1;
  unlocked: number;
  completed: number[];
  best: Record<string, number>;
  master: number;
  effects: number;
  quality: "low" | "medium" | "high";
  reduced: boolean;
}
export const defaults = (): Save => ({
  version: 1,
  unlocked: 0,
  completed: [],
  best: {},
  master: 0.5,
  effects: 0.5,
  quality: "medium",
  reduced: false,
});
export function loadSave(): Save {
  try {
    const v: unknown = JSON.parse(
      localStorage.getItem("rewind-room-v1") || "null",
    );
    if (!v || typeof v !== "object") return defaults();
    const s = v as Partial<Save>;
    if (s.version !== 1) return defaults();
    const d = defaults();
    d.unlocked = Number.isInteger(s.unlocked)
      ? Math.max(0, Math.min(4, s.unlocked!))
      : 0;
    d.completed = Array.isArray(s.completed)
      ? s.completed.filter((n) => Number.isInteger(n) && n >= 0 && n < 5)
      : [];
    for (const k of ["master", "effects"] as const)
      if (typeof s[k] === "number" && Number.isFinite(s[k]))
        d[k] = Math.max(0, Math.min(1, s[k]!));
    if (["low", "medium", "high"].includes(s.quality || ""))
      d.quality = s.quality!;
    d.reduced = s.reduced === true;
    if (s.best && typeof s.best === "object")
      for (const [k, n] of Object.entries(s.best))
        if (/^[0-4]$/.test(k) && typeof n === "number" && n > 0 && n <= 60)
          d.best[k] = n;
    return d;
  } catch {
    return defaults();
  }
}
export function saveData(s: Save) {
  try {
    localStorage.setItem("rewind-room-v1", JSON.stringify(s));
  } catch {
    /* Private storage mode: the current session remains playable. */
  }
}
