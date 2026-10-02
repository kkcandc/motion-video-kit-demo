# Northline

A 24-second instrument film and the review suite around it. The picture is code: Three.js for the instrument, GSAP for the type, and a clock. There is no soundtrack. The cuts, the needle, and the word are the rhythm.

This is an original piece. The working method — storyboard, then a seekable scene, then a critic that looks at frames — is the same family of idea as the [Roundtable note on a motion-design pipeline](https://x.com/RoundtableSpace/status/2105209785335373948) and the public [motion-video-kit](https://github.com/echris6/motion-video-kit). The film, the shaders, and the review UI are written for this repo. Nothing is copied from that kit.

## Run it

```sh
npm install
npm run dev
```

Open the local URL. The slate scores eight storyboard frames, then the film plays. `npm run build` writes a static site to `dist/`. `npm run check` confirms the frame function is deterministic.

## Deploy

The project is a Vite static build. [Vercel](https://vercel.com) picks that up from `vercel.json`.

1. Import `kkcandc/motion-video-kit-demo`.
2. Framework preset: Vite.
3. Build command: `npm run build`. Output: `dist`.

No environment variables and no paid generation APIs.

## What a frame is

`frameAt(t)` in `src/film/frame.ts` returns the whole picture for a time in seconds: camera, rings, needle, flare, grade. It does not remember the previous frame. Scrubbing, looping, and the contact sheet all call that function and draw.

The GSAP timeline is built once, paused, and moved with `seek(t)` on the same clock, so the type is a function of time as well.

Authored rate is 24fps. The screen refreshes at the display rate. The burn-in timecode counts authored frames (`00:16:12` means 16 seconds and 12 frames).

## The 24 seconds

| Time | Chapter | What you should see |
| --- | --- | --- |
| 0.0–3.4 | Cold | Black, a horizon, one glint. “Scope is empty.” |
| 3.4–9.0 | Assembly | Three rings lock with a short overshoot. The needle finds north. |
| 9.0–15.6 | Heading | A three-quarter orbit and the azimuth, latitude, and needle readouts. |
| 15.6 | Cut | A hard camera cut and a flare. |
| 15.6–20.4 | Title | NORTHLINE sits in the lower third. The instrument stays above it. |
| 20.4–24.0 | Hold | Pull back, still turning slowly, then a fade to black so the loop is seamless. |

Click a chapter or a contact-sheet frame to hold that moment. Picture hides the suite. Space plays and pauses. Arrow keys step one frame, Shift plus an arrow steps half a second. Add `?t=16.5` to open on a specific second.

## Critic

Before the first picture, the suite seeks each storyboard time, draws it, and measures the pixels:

- **Contrast** — spread of luminance. A flat frame fails.
- **Motion** — how far the camera, rings, and needle move over one authored frame. The end hold is allowed to be quiet.
- **Highlights** — share of pixels that are clipped white.
- **Type field** — luminance where the words sit. Ivory type needs a dark field.

The number on each frame is that mix. The sentence is the rule that fired. Re-score runs the same pass again. It is a measurement of this render, not a grade invented in advance.

## Stack

Vite, TypeScript, Three.js, GSAP. Post: bloom, a little chromatic fringe, film grain, vignette. Metals use a generated studio environment. No remote assets except the typefaces.
