import { beats } from "./film/beats";
import { scoreFrame, textModeAt, type Critique } from "./film/critic";
import { DURATION, frameAt } from "./film/frame";
import { formatSeconds, formatTimecode } from "./film/math";
import { createScene, type FilmScene } from "./film/scene";
import { createTypeTimeline } from "./film/type";

function required<T>(value: T | null | undefined, name: string): T {
  if (value == null) throw new Error(`Missing ${name}`);
  return value;
}

const stage = required(document.querySelector<HTMLElement>("#stage"), "stage");
const frameEl = required(document.querySelector<HTMLElement>("#frame"), "frame");
const canvas = required(document.querySelector<HTMLCanvasElement>("#gl"), "canvas");
const grain = required(document.querySelector<HTMLCanvasElement>("#grain"), "grain");
const flash = required(document.querySelector<HTMLElement>("#flash"), "flash");
const veil = required(document.querySelector<HTMLElement>("#veil"), "veil");
const gate = required(document.querySelector<HTMLElement>("#gate"), "gate");
const burn = required(document.querySelector<HTMLElement>("#burn"), "burn");
const tc = required(document.querySelector<HTMLElement>("#tc"), "timecode");
const clock = required(document.querySelector<HTMLElement>("#clock"), "clock");
const scrub = required(document.querySelector<HTMLInputElement>("#scrub"), "scrubber");
const playButton = required(document.querySelector<HTMLButtonElement>("#play"), "play");
const loopInput = required(document.querySelector<HTMLInputElement>("#loop"), "loop");
const pictureButton = required(document.querySelector<HTMLButtonElement>("#picture"), "picture");
const rescoreButton = required(document.querySelector<HTMLButtonElement>("#rescore"), "rescore");
const sheet = required(document.querySelector<HTMLElement>("#sheet"), "sheet");
const verdict = required(document.querySelector<HTMLElement>("#verdict"), "verdict");
const intent = required(document.querySelector<HTMLElement>("#intent"), "intent");
const intro = required(document.querySelector<HTMLElement>("#intro"), "intro");
const introStatus = required(document.querySelector<HTMLElement>("#intro-status"), "intro status");
const introFill = required(document.querySelector<HTMLElement>("#intro-fill"), "intro fill");
const az = required(document.querySelector<HTMLElement>("#az"), "azimuth");
const lat = required(document.querySelector<HTMLElement>("#lat"), "latitude");
const needle = required(document.querySelector<HTMLElement>("#needle"), "needle");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const params = new URLSearchParams(location.search);
const timeParam = params.get("t");
const requestedTime = timeParam === null ? Number.NaN : Number(timeParam);

let playing = false;
let playhead = 0;
let scrubbing = false;
let pinned = "";
let lastSample = -1;
let booting = true;
let lastNow = 0;

const critiques: Array<Critique | null> = beats.map(() => null);
const chapterButtons = [...document.querySelectorAll<HTMLButtonElement>(".chapters button")];

paintGrain(grain);

const cells = beats.map((beat) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cell";
  button.title = beat.intent;
  button.innerHTML = `
    <span class="thumb">
      <img alt="${beat.label} at ${beat.t.toFixed(2)} seconds" />
      <span class="cap"></span>
      <span class="badge">—</span>
    </span>
    <span class="meta"><b></b><i></i></span>
  `;
  const cap = button.querySelector<HTMLElement>(".cap");
  const label = button.querySelector<HTMLElement>(".meta b");
  const time = button.querySelector<HTMLElement>(".meta i");
  if (cap) cap.textContent = beat.caption;
  if (label) label.textContent = beat.label;
  if (time) time.textContent = formatSeconds(beat.t);
  button.addEventListener("click", () => {
    pinned = beat.id;
    playing = false;
    playhead = beat.t;
    renderAt(playhead);
    const critique = critiques[beats.findIndex((item) => item.id === beat.id)] ?? null;
    if (critique) showCritique(critique, beat.intent);
    updatePlay();
  });
  sheet.append(button);
  return button;
});

const typeTimeline = createTypeTimeline();
const starCount = Math.min(window.innerWidth, window.innerHeight) < 760 ? 900 : 1600;
const scene: FilmScene = createScene(canvas, starCount);

const thumb = document.createElement("canvas");
const thumbContext = thumb.getContext("2d", { willReadFrequently: true });
if (!thumbContext) throw new Error("Thumbnail canvas unavailable");
const thumbCtx: CanvasRenderingContext2D = thumbContext;

function paintGrain(target: HTMLCanvasElement) {
  target.width = 160;
  target.height = 160;
  const context = target.getContext("2d");
  if (!context) return;
  const image = context.createImageData(160, 160);
  let seed = 17;
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const n = 80 + (seed % 110);
    image.data[i] = n;
    image.data[i + 1] = n;
    image.data[i + 2] = n;
    image.data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}

function resize() {
  const rect = stage.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return;
  scene.resize(rect.width, rect.height);
  const aspect = rect.width / rect.height;
  thumb.width = 420;
  thumb.height = Math.max(1, Math.round(420 / aspect));
}

function band(score: number): string {
  if (score >= 85) return "high";
  if (score >= 70) return "mid";
  return "low";
}

function showCritique(critique: Critique, note: string) {
  verdict.textContent = critique.verdict;
  intent.textContent = note;
  const meters: Array<[string, number, string]> = [
    ["meter-contrast", critique.contrast, `Luma std ${critique.std.toFixed(3)}`],
    ["meter-motion", critique.motion, `Kinetic ${critique.kinetic.toFixed(3)}`],
    ["meter-highlights", critique.highlights, `Clip ${(critique.clip * 100).toFixed(2)}%`],
    ["meter-hierarchy", critique.hierarchy, `Lower field luma ${critique.regionLuma.toFixed(3)}`],
  ];
  for (const [id, value, title] of meters) {
    const node = document.getElementById(id);
    if (!node) continue;
    const bar = node.querySelector("i");
    const figure = node.querySelector("b");
    if (bar) bar.style.setProperty("--v", value.toFixed(1));
    if (figure) figure.textContent = String(Math.round(value));
    node.title = title;
  }
}

function activeBeat(t: number) {
  let current = beats[0];
  for (const beat of beats) {
    if (t + 0.04 >= beat.t) current = beat;
  }
  return current ?? beats[0];
}

function updateChrome(t: number) {
  chapterButtons.forEach((button) => {
    const at = Number(button.dataset.t ?? 0);
    const next = chapterButtons
      .map((item) => Number(item.dataset.t ?? 0))
      .filter((value) => value > at)
      .sort((a, b) => a - b)[0];
    const end = next ?? DURATION + 0.01;
    button.classList.toggle("active", t >= at && t < end);
  });
  const beat = activeBeat(t);
  cells.forEach((cell, index) => {
    cell.classList.toggle("active", beats[index]?.id === beat?.id && t < (beats[index + 1]?.t ?? DURATION + 1));
  });
}

function renderAt(t: number) {
  const state = frameAt(t);
  scene.apply(state);
  typeTimeline.seek(state.t, false);
  az.textContent = state.readouts.az;
  lat.textContent = state.readouts.lat;
  needle.textContent = state.readouts.needle;
  flash.style.opacity = state.flash.toFixed(3);
  veil.style.opacity = state.veil.toFixed(3);
  frameEl.style.clipPath = `circle(${(state.iris * 150).toFixed(2)}% at 50% 42%)`;
  gate.style.opacity = state.gate.toFixed(3);
  burn.style.opacity = state.gate.toFixed(3);
  grain.style.transform = `translate(${((state.t * 17) % 36).toFixed(2)}px, ${((state.t * 11) % 28).toFixed(2)}px)`;
  const code = formatTimecode(state.t);
  tc.textContent = code;
  clock.textContent = code;
  if (!scrubbing) scrub.value = state.t.toFixed(3);
  updateChrome(state.t);
  scene.render();
}

function captureIndex(index: number) {
  const beat = beats[index];
  if (!beat) return;
  thumbCtx.drawImage(canvas, 0, 0, thumb.width, thumb.height);
  const pixels = thumbCtx.getImageData(0, 0, thumb.width, thumb.height);
  const critique = scoreFrame(pixels.data, thumb.width, thumb.height, beat.t, textModeAt(beat.t));
  critiques[index] = critique;
  const cell = cells[index];
  const image = cell?.querySelector("img");
  const badge = cell?.querySelector<HTMLElement>(".badge");
  if (image) image.src = thumb.toDataURL("image/jpeg", 0.84);
  if (badge) {
    badge.textContent = String(Math.round(critique.total));
    badge.dataset.band = band(critique.total);
  }
}

async function scoreSheet(label: string) {
  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    if (!beat) continue;
    introStatus.textContent = `${label} ${i + 1} / ${beats.length}`;
    introFill.style.width = `${((i + 1) / beats.length) * 100}%`;
    verdict.textContent = `Scoring ${beat.label}.`;
    renderAt(beat.t);
    captureIndex(i);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

function updatePlay() {
  playButton.textContent = playing ? "Pause" : "Play";
  playButton.setAttribute("aria-pressed", playing ? "true" : "false");
}

function toggle() {
  playing = !playing;
  pinned = "";
  if (playhead >= DURATION - 0.02) playhead = 0;
  updatePlay();
}

function seekBy(delta: number) {
  pinned = "";
  playhead = Math.min(DURATION, Math.max(0, playhead + delta));
  renderAt(playhead);
}

function sampleLive() {
  if (!thumb.width) return;
  thumbCtx.drawImage(canvas, 0, 0, thumb.width, thumb.height);
  const pixels = thumbCtx.getImageData(0, 0, thumb.width, thumb.height);
  const critique = scoreFrame(pixels.data, thumb.width, thumb.height, playhead, textModeAt(playhead));
  const beat = activeBeat(playhead);
  showCritique(critique, beat?.intent ?? "");
}

function tick(now: number) {
  if (!lastNow) lastNow = now;
  const dt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  if (playing) {
    playhead += dt;
    if (playhead >= DURATION) {
      if (loopInput.checked) playhead = 0;
      else {
        playhead = DURATION;
        playing = false;
        updatePlay();
      }
    }
    renderAt(playhead);
    if (!pinned && now - lastSample > 500) {
      lastSample = now;
      sampleLive();
    }
  }
  requestAnimationFrame(tick);
}

playButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggle();
});

pictureButton.addEventListener("click", () => {
  const on = document.body.classList.toggle("picture");
  pictureButton.setAttribute("aria-pressed", on ? "true" : "false");
  pictureButton.textContent = on ? "Suite" : "Picture";
  requestAnimationFrame(() => {
    resize();
    renderAt(playhead);
  });
});

rescoreButton.addEventListener("click", async () => {
  const was = playing;
  playing = false;
  updatePlay();
  const back = playhead;
  rescoreButton.disabled = true;
  await scoreSheet("Re-score");
  playhead = back;
  renderAt(playhead);
  const beat = activeBeat(playhead);
  const critique = critiques[beats.indexOf(beat!)] ?? null;
  if (critique && beat) showCritique(critique, beat.intent);
  playing = was;
  updatePlay();
  rescoreButton.disabled = false;
});

scrub.addEventListener("pointerdown", () => {
  scrubbing = true;
});
scrub.addEventListener("pointerup", () => {
  scrubbing = false;
});
scrub.addEventListener("input", () => {
  pinned = "";
  playhead = Number(scrub.value);
  renderAt(playhead);
});

loopInput.addEventListener("click", (event) => event.stopPropagation());

for (const button of chapterButtons) {
  button.addEventListener("click", () => {
    pinned = "";
    playing = false;
    playhead = Number(button.dataset.t ?? 0);
    renderAt(playhead);
    updatePlay();
  });
}

stage.addEventListener("click", () => toggle());

window.addEventListener("keydown", (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
  if (event.code === "Space" && target instanceof HTMLButtonElement) return;
  if (event.code === "Space") {
    event.preventDefault();
    toggle();
  } else if (event.code === "ArrowRight") {
    seekBy(event.shiftKey ? 0.5 : 1 / 24);
  } else if (event.code === "ArrowLeft") {
    seekBy(event.shiftKey ? -0.5 : -1 / 24);
  } else if (event.code === "Home") {
    pinned = "";
    playhead = 0;
    renderAt(playhead);
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    playing = false;
    updatePlay();
  }
});

const observer = new ResizeObserver(() => {
  resize();
  if (!booting) renderAt(playhead);
});
observer.observe(stage);

async function boot() {
  const fontsReady = "fonts" in document ? document.fonts.ready : Promise.resolve();
  await Promise.race([fontsReady, new Promise((resolve) => setTimeout(resolve, 1200))]);
  resize();
  await scoreSheet("Scoring");
  const start = Number.isFinite(requestedTime) ? Math.min(DURATION, Math.max(0, requestedTime)) : reduceMotion ? 17.2 : 0;
  playhead = start;
  playing = !reduceMotion && !Number.isFinite(requestedTime);
  if (Number.isFinite(requestedTime)) playing = false;
  renderAt(playhead);
  const beat = activeBeat(playhead);
  const critique = critiques[beats.findIndex((item) => item.id === beat?.id)] ?? critiques[0];
  if (critique && beat) showCritique(critique, beat.intent);
  updatePlay();
  booting = false;
  intro.classList.add("hide");
  intro.setAttribute("aria-hidden", "true");
  requestAnimationFrame(tick);
}

void boot().catch((error: unknown) => {
  introStatus.textContent = error instanceof Error ? error.message : "The film failed to start";
  console.error(error);
});
