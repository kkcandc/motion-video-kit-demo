import assert from "node:assert/strict";
import { CUT, DURATION, frameAt, kineticAt } from "../src/film/frame.ts";
import { scoreFrame } from "../src/film/critic.ts";

const a = frameAt(8.25);
const b = frameAt(8.25);
assert.deepEqual(a, b, "frameAt is deterministic");

assert.equal(frameAt(-2).t, 0);
assert.equal(frameAt(40).t, DURATION);
assert.equal(frameAt(1).outer.s, 0, "rings stay hidden in the cold open");
assert.ok(frameAt(8.2).outer.s > 0.9, "outer ring is seated after the lock");
assert.ok(frameAt(8.2).mid.s > 0.9);
assert.ok(frameAt(8.2).inner.s > 0.9);
assert.ok(Math.abs(frameAt(10).needle) < Math.abs(frameAt(6.7).needle));

const before = frameAt(CUT - 0.08).camera;
const after = frameAt(CUT + 0.05).camera;
assert.ok(
  Math.abs(before.lookY - after.lookY) > 0.2,
  `camera should reframe across the cut, lookY ${before.lookY} -> ${after.lookY}`,
);
assert.ok(frameAt(12).ignite < frameAt(16.7).ignite);

const cold = kineticAt(1.2);
const hit = kineticAt(4.6);
assert.ok(hit > cold, "assembly carries more kinetic energy than the cold open");

const dark = new Uint8ClampedArray(16 * 16 * 4);
const flat = scoreFrame(dark, 16, 16, 2, "lower");
assert.ok(flat.contrast < 55, "a black frame should fail contrast");

const varied = new Uint8ClampedArray(16 * 16 * 4);
for (let i = 0; i < varied.length; i += 4) {
  const on = i / 4 < 40;
  const v = on ? 240 : 8;
  varied[i] = v;
  varied[i + 1] = v;
  varied[i + 2] = v;
  varied[i + 3] = 255;
}
const lively = scoreFrame(varied, 16, 16, 12, "none");
assert.ok(lively.contrast > flat.contrast);

console.log("frame checks ok");
