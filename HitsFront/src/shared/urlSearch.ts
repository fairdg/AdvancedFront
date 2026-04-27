export function parseIntOr(value: string | null, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function firstParam(current: URLSearchParams, keys: string[]) {
  for (const k of keys) {
    const v = current.get(k);
    if (v != null) return v;
  }
  return null;
}

export function buildSearch(current: URLSearchParams, next: Record<string, string | null | undefined>) {
  const sp = new URLSearchParams(current);
  for (const [k, v] of Object.entries(next)) {
    if (v == null || v === "") sp.delete(k);
    else sp.set(k, v);
  }
  return sp;
}
