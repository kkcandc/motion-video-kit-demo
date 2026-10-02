export type Beat = {
  id: string;
  t: number;
  label: string;
  caption: string;
  intent: string;
};

export const beats: Beat[] = [
  {
    id: "cold",
    t: 1.45,
    label: "01 Cold",
    caption: "Scope is empty.",
    intent: "Wide black, one glint, the line landing in the lower third.",
  },
  {
    id: "flight",
    t: 4.35,
    label: "02 Flight",
    caption: "Lock the rings.",
    intent: "The outer ring is still in the air. Travel should read in a single frame.",
  },
  {
    id: "impact",
    t: 6.2,
    label: "03 Impact",
    caption: "Lock the rings.",
    intent: "Two rings seated, the third arriving, a shock still fading.",
  },
  {
    id: "needle",
    t: 8.05,
    label: "04 Needle",
    caption: "Needle settling",
    intent: "The needle passes through north. The instrument is whole.",
  },
  {
    id: "heading",
    t: 12.15,
    label: "05 Heading",
    caption: "Azimuth held",
    intent: "Three-quarter view. The readouts sit in open black, off the metal.",
  },
  {
    id: "hit",
    t: 16.45,
    label: "06 Hit",
    caption: "NORTHLINE",
    intent: "Hard cut, flare, and the word. The lower field has to stay dark enough to read.",
  },
  {
    id: "title",
    t: 18.6,
    label: "07 Title",
    caption: "North, held.",
    intent: "Hero hold. Instrument above the word, both sharp, flare already decaying.",
  },
  {
    id: "hold",
    t: 21.8,
    label: "08 Hold",
    caption: "North, held.",
    intent: "Pull back with a slow breath, then fade to black so the loop is invisible.",
  },
];

export const chapters: { id: string; name: string; t: number; end: number }[] = [
  { id: "cold", name: "Cold", t: 0.15, end: 3.4 },
  { id: "assembly", name: "Assembly", t: 3.55, end: 9 },
  { id: "heading", name: "Heading", t: 9.15, end: 15.6 },
  { id: "title", name: "Title", t: 16.1, end: 20.4 },
  { id: "hold", name: "Hold", t: 20.6, end: 24 },
];
