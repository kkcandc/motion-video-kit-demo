export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smooth01(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** 0 before `a`, 1 after `b`, smooth in between. */
export function seg(t: number, a: number, b: number): number {
  if (b === a) return t >= b ? 1 : 0;
  return smooth01((t - a) / (b - a));
}

/** Ease that overshoots, then settles. 0 at the start of the window, 1 after it. */
export function backOut(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

export function impact(t: number, a: number, b: number): number {
  if (t <= a) return 0;
  if (t >= b) return 1;
  return backOut((t - a) / (b - a));
}

export function pulse(t: number, at: number, dur: number): number {
  const u = (t - at) / dur;
  if (u < 0 || u > 1) return 0;
  return Math.sin(u * Math.PI);
}

export function sample(t: number, keys: ReadonlyArray<readonly [number, number]>): number {
  const first = keys[0];
  if (!first) return 0;
  if (t <= first[0]) return first[1];
  const last = keys[keys.length - 1];
  if (!last || t >= last[0]) return last ? last[1] : 0;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (!a || !b) continue;
    if (t <= b[0]) {
      const span = b[0] - a[0];
      const u = span === 0 ? 1 : smooth01((t - a[0]) / span);
      return lerp(a[1], b[1], u);
    }
  }
  return last[1];
}

export function shockwave(t: number, at: number): { o: number; s: number } {
  const u = (t - at) / 0.62;
  if (u < 0 || u > 1) return { o: 0, s: 1 };
  return { o: (1 - u) * (1 - u), s: 1 + u * 1.7 };
}

export function formatTimecode(t: number, fps = 24): string {
  const frames = Math.max(0, Math.round(t * fps));
  const ff = frames % fps;
  const totalSeconds = Math.floor(frames / fps);
  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60) % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(mm)}:${pad(ss)}:${pad(ff)}`;
}

export function formatSeconds(t: number): string {
  return `${t.toFixed(2)}s`;
}
