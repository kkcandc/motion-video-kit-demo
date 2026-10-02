import { kineticAt } from "./frame";
import { clamp, lerp } from "./math";

export type TextMode = "none" | "lower" | "title";

export type Critique = {
  total: number;
  contrast: number;
  motion: number;
  highlights: number;
  hierarchy: number;
  std: number;
  clip: number;
  regionLuma: number;
  kinetic: number;
  verdict: string;
};

function lumaOf(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function contrastScore(std: number): number {
  if (std < 0.02) return (std / 0.02) * 46;
  if (std < 0.13) return lerp(64, 96, (std - 0.02) / 0.11);
  return lerp(96, 76, clamp((std - 0.13) / 0.14, 0, 1));
}

function highlightScore(clipRatio: number): number {
  if (clipRatio < 0.015) return 95;
  if (clipRatio < 0.05) return lerp(95, 72, (clipRatio - 0.015) / 0.035);
  return lerp(72, 28, clamp((clipRatio - 0.05) / 0.12, 0, 1));
}

function motionScore(kinetic: number, t: number): number {
  if (t >= 21.15 && kinetic < 0.55) return 90;
  const shaped = 100 * (1 - Math.exp(-kinetic * 1.55));
  return clamp(shaped, 8, 100);
}

function hierarchyScore(regionLuma: number, mode: TextMode): number {
  if (mode === "none") return 90;
  if (regionLuma > 0.58) return lerp(48, 18, clamp((regionLuma - 0.58) / 0.3, 0, 1));
  if (regionLuma > 0.42) return lerp(88, 60, (regionLuma - 0.42) / 0.16);
  return 94;
}

function verdictFor(
  score: { highlights: number; hierarchy: number; contrast: number; motion: number; kinetic: number; total: number },
  mode: TextMode,
  hold: boolean,
): string {
  if (score.highlights < 68) return "Highlights are clipping. Ease the flare or the exposure.";
  if (score.hierarchy < 70 && mode !== "none") return "Type is sitting on a bright field. Drop the word into quieter black.";
  if (score.contrast < 62) return "The frame is flat. Separate the instrument from the field.";
  if (score.motion < 58 && !hold) return "This beat has stalled. Give it a turn, a push, or an exit.";
  if (hold) return "End hold is still breathing. The silence can ship.";
  if (score.total >= 86) return "This frame can ship.";
  return "One more pass on the weakest meter.";
}

export function scoreFrame(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  t: number,
  mode: TextMode,
): Critique {
  const n = width * height;
  let sum = 0;
  let clip = 0;
  for (let i = 0; i < data.length; i += 4) {
    const y = lumaOf(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0);
    sum += y;
    if (y > 0.975) clip += 1;
  }
  const mean = sum / Math.max(1, n);
  let variance = 0;
  for (let i = 0; i < data.length; i += 4) {
    const y = lumaOf(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0);
    variance += (y - mean) ** 2;
  }
  const std = Math.sqrt(variance / Math.max(1, n));

  const x0 = Math.floor(width * 0.18);
  const x1 = Math.floor(width * 0.82);
  const y0 = Math.floor(height * (mode === "title" ? 0.58 : 0.62));
  const y1 = Math.floor(height * 0.9);
  let regionSum = 0;
  let regionCount = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      regionSum += lumaOf(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0);
      regionCount += 1;
    }
  }
  const regionLuma = regionSum / Math.max(1, regionCount);
  const kinetic = kineticAt(t);
  const contrast = contrastScore(std);
  const highlights = highlightScore(clip / Math.max(1, n));
  const motion = motionScore(kinetic, t);
  const hierarchy = hierarchyScore(regionLuma, mode);
  const total = clamp(contrast * 0.34 + motion * 0.28 + highlights * 0.2 + hierarchy * 0.18, 0, 100);
  const hold = t >= 21.15;
  return {
    total,
    contrast,
    motion,
    highlights,
    hierarchy,
    std,
    clip: clip / Math.max(1, n),
    regionLuma,
    kinetic,
    verdict: verdictFor({ highlights, hierarchy, contrast, motion, kinetic, total }, mode, hold),
  };
}

export function textModeAt(t: number): TextMode {
  if (t >= 15.85 && t < 23.15) return "title";
  if ((t >= 0.7 && t < 3.2) || (t >= 3.75 && t < 7.7)) return "lower";
  return "none";
}
