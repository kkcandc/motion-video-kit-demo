import { impact, lerp, pulse, sample, seg, shockwave } from "./math";

/** Authored length. Display refresh is independent; the picture is `frameAt(t)`. */
export const DURATION = 24;
export const FPS = 24;
export const CUT = 15.6;

export type Xform = {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  s: number;
};

export type FrameState = {
  t: number;
  camera: {
    x: number;
    y: number;
    z: number;
    lookX: number;
    lookY: number;
    lookZ: number;
    fov: number;
    roll: number;
  };
  outer: Xform;
  mid: Xform;
  inner: Xform;
  needle: number;
  needleGlow: number;
  coreScale: number;
  ignite: number;
  bead: number;
  beadAngle: number;
  halo: number;
  shock: [{ o: number; s: number }, { o: number; s: number }, { o: number; s: number }];
  flare: number;
  bloom: number;
  exposure: number;
  ca: number;
  flash: number;
  veil: number;
  iris: number;
  gate: number;
  shadow: number;
  readouts: { az: string; lat: string; needle: string };
};

type Vec3 = { x: number; y: number; z: number };

function assemble(
  t: number,
  start: number,
  end: number,
  from: Vec3,
  extra: Vec3,
  base: Vec3,
  spin: Vec3,
): Xform {
  const raw = t <= start ? 0 : t >= end ? 1 : impact(t, start, end);
  const settled = t <= start ? 0 : Math.min(Math.max(raw, 0), 1);
  const scale =
    t <= start ? 0 : 0.12 + 0.88 * settled + Math.max(0, raw - 1) * 0.045;
  return {
    x: from.x * (1 - raw),
    y: from.y * (1 - raw),
    z: from.z * (1 - raw),
    rx: base.x + t * spin.x + extra.x * (1 - settled),
    ry: base.y + t * spin.y + extra.y * (1 - settled),
    rz: base.z + t * spin.z + extra.z * (1 - settled),
    s: scale,
  };
}

function shake(t: number): number {
  const hits = [5.05, 6.35, 7.45, 8.35, CUT];
  let amp = 0;
  for (const hit of hits) {
    const u = t - hit;
    if (u >= 0 && u < 0.42) {
      amp += Math.sin(u * 68) * Math.exp(-u * 11) * 0.028;
    }
  }
  return amp;
}

function cameraAt(t: number): FrameState["camera"] {
  const breathe = Math.sin(t * 0.42) * 0.016;
  const kick = shake(t);
  if (t < CUT) {
    return {
      x: sample(t, [
        [0, 0.28],
        [3.4, -0.35],
        [7.1, 0.55],
        [11.2, 1.35],
        [15.45, 0.72],
      ]) + kick,
      y: sample(t, [
        [0, 0.28],
        [3.4, 0.22],
        [7.1, 0.72],
        [11.2, 0.86],
        [15.45, 0.4],
      ]) + breathe,
      z: sample(t, [
        [0, 9.6],
        [3.4, 7.5],
        [7.1, 5.45],
        [11.2, 4.85],
        [15.45, 5.15],
      ]),
      lookX: sample(t, [
        [0, 0],
        [11.2, 0.02],
        [15.45, 0],
      ]),
      lookY: sample(t, [
        [0, 0.02],
        [7.1, 0.18],
        [15.45, 0.12],
      ]),
      lookZ: 0,
      fov: sample(t, [
        [0, 30],
        [7.1, 27.5],
        [15.45, 29],
      ]),
      roll: sample(t, [
        [0, 0],
        [10, 0.04],
        [15.45, 0.015],
      ]),
    };
  }
  return {
    x: sample(t, [
      [15.6, 0.04],
      [18.4, 0.12],
      [21.2, -0.04],
      [24, -0.16],
    ]) + kick,
    y: sample(t, [
      [15.6, 0.72],
      [18.4, 0.64],
      [21.2, 0.58],
      [24, 0.7],
    ]) + breathe,
    z: sample(t, [
      [15.6, 5.15],
      [18.4, 5.35],
      [21.2, 6.05],
      [24, 7.4],
    ]),
    lookX: 0,
    lookY: sample(t, [
      [15.6, -0.22],
      [24, -0.05],
    ]),
    lookZ: 0,
    fov: sample(t, [
      [15.6, 28],
      [20.4, 29],
      [24, 32],
    ]),
    roll: sample(t, [
      [15.6, -0.012],
      [17.4, 0],
      [24, 0],
    ]),
  };
}

function needleAngle(t: number): number {
  if (t <= 6.55) return 2.15;
  const u = impact(t, 6.55, 8.35);
  return 2.15 * (1 - u);
}

function igniteAt(t: number): number {
  const idle = 0.16 + Math.sin(t * 0.85) * 0.035;
  if (t < CUT) return idle;
  const up = seg(t, CUT, 16.55);
  const down = seg(t, 16.7, 18.6);
  return lerp(lerp(idle, 0.72, up), 0.42, down);
}

function flareAt(t: number): number {
  if (t < CUT || t > 19.6) return 0;
  const u = (t - CUT) / 0.42;
  if (u < 1) return seg(t, CUT, CUT + 0.5);
  return lerp(0.85, 0.12, seg(t, 16.15, 17.6));
}

function readouts(t: number, needle: number): FrameState["readouts"] {
  const az = 318.24 + Math.sin(t * 0.52) * 6.2 + Math.sin(t * 1.65) * 0.28;
  const lat = 41.88 + Math.sin(t * 0.29 + 0.4) * 0.18;
  const deg = Math.abs(needle) * (180 / Math.PI);
  const needleText = deg < 0.4 && t > 8.25 ? "LOCKED" : `${deg.toFixed(1)}°`;
  return {
    az: `${az.toFixed(2)}°`,
    lat: `${lat.toFixed(2)}°`,
    needle: needleText,
  };
}

/**
 * Entire picture state for time `t`. No randomness, no accumulated velocity.
 * Calling this twice with the same `t` returns the same numbers.
 */
export function frameAt(time: number): FrameState {
  const t = Math.min(DURATION, Math.max(0, time));
  const needle = needleAngle(t);
  const ignite = igniteAt(t);
  const flare = flareAt(t);
  const outer = assemble(
    t,
    3.42,
    5.05,
    { x: 0, y: 2.7, z: 0.2 },
    { x: 1.15, y: 0, z: 0 },
    { x: 0.42, y: 0, z: 0 },
    { x: 0, y: 0.16, z: 0 },
  );
  const mid = assemble(
    t,
    4.48,
    6.35,
    { x: -2.65, y: 0.25, z: 0 },
    { x: 0, y: 0, z: 0.95 },
    { x: Math.PI / 2, y: 0, z: 0.08 },
    { x: 0, y: 0.11, z: 0 },
  );
  const inner = assemble(
    t,
    5.62,
    7.45,
    { x: 0.15, y: -0.15, z: 2.35 },
    { x: 0, y: 1.15, z: 0 },
    { x: 0.22, y: Math.PI / 2, z: 0 },
    { x: 0, y: 0.34, z: 0 },
  );

  const coreBase = t < 3.25 ? lerp(0.07, 0.15, seg(t, 0, 3.25)) : lerp(0.15, 1, seg(t, 3.25, 5.5));
  const veil = seg(t, 23.05, 23.94);

  return {
    t,
    camera: cameraAt(t),
    outer,
    mid,
    inner,
    needle,
    needleGlow: Math.exp(-(((t - 8.35) * 3.1) ** 2)),
    coreScale: coreBase * (1 + Math.sin(t * 1.35) * 0.012),
    ignite,
    bead: seg(t, 7.25, 8.15) * (1 - seg(t, 22.7, 23.7)),
    beadAngle: t * 0.52,
    halo: seg(t, 8.7, 9.55) * (1 - seg(t, 15.05, 15.55)),
    shock: [shockwave(t, 5.05), shockwave(t, 6.35), shockwave(t, 7.45)],
    flare,
    bloom: 0.16 + ignite * 0.28 + flare * 0.2,
    exposure: sample(t, [
      [0, 0.82],
      [3.4, 0.9],
      [9, 0.96],
      [15.5, 0.98],
      [16.5, 1.02],
      [18.6, 0.96],
      [24, 0.88],
    ]),
    ca: 0.4 + flare * 1.25,
    flash: Math.max(
      pulse(t, 5.05, 0.12) * 0.16,
      pulse(t, 6.35, 0.12) * 0.16,
      pulse(t, 7.45, 0.14) * 0.22,
      pulse(t, 15.58, 0.16) * 0.42,
    ),
    veil,
    iris: seg(t, 0.05, 1.25),
    gate: seg(t, 1.05, 1.65) * (1 - veil),
    shadow: seg(t, 4.6, 6.1) * (1 - seg(t, 22.5, 23.6)),
    readouts: readouts(t, needle),
  };
}

/** How much the picture is designed to move at this instant, in authored units. */
export function kineticAt(t: number): number {
  const a = frameAt(t);
  const b = frameAt(Math.min(DURATION, t + 1 / FPS));
  const cam = Math.hypot(a.camera.x - b.camera.x, a.camera.y - b.camera.y, a.camera.z - b.camera.z);
  const spin =
    Math.abs(a.outer.ry - b.outer.ry) +
    Math.abs(a.mid.ry - b.mid.ry) +
    Math.abs(a.inner.ry - b.inner.ry);
  const rig = Math.abs(a.outer.s - b.outer.s) + Math.abs(a.mid.s - b.mid.s) + Math.abs(a.inner.s - b.inner.s);
  const needle = Math.abs(a.needle - b.needle);
  return cam * 90 + spin * 40 + rig * 50 + needle * 30;
}
