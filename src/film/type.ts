import gsap from "gsap";

export function createTypeTimeline(): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });
  const hide = (sel: string) => tl.set(sel, { autoAlpha: 0 }, 0);

  hide("#k1");
  hide("#l1");
  hide("#k2");
  hide("#l2");
  hide("#k3");
  hide("#c1");
  hide("#c2");
  hide("#c3");
  hide("#rule");
  hide("#hero");
  hide("#hero-sub");
  hide("#end-mark");

  tl.fromTo(
    "#k1",
    { autoAlpha: 0, y: 10 },
    { autoAlpha: 1, y: 0, duration: 0.45, immediateRender: false },
    0.55,
  );
  tl.fromTo(
    "#l1",
    { autoAlpha: 0, yPercent: 110 },
    { autoAlpha: 1, yPercent: 0, duration: 0.7, ease: "power4.out", immediateRender: false },
    0.7,
  );
  tl.to("#k1", { autoAlpha: 0, y: -8, duration: 0.35, ease: "power2.in" }, 2.85);
  tl.to("#l1", { autoAlpha: 0, yPercent: -60, duration: 0.4, ease: "power2.in" }, 2.95);

  tl.fromTo(
    "#k2",
    { autoAlpha: 0, y: 10 },
    { autoAlpha: 1, y: 0, duration: 0.4, immediateRender: false },
    3.6,
  );
  tl.fromTo(
    "#l2",
    { autoAlpha: 0, yPercent: 110 },
    { autoAlpha: 1, yPercent: 0, duration: 0.7, ease: "power4.out", immediateRender: false },
    3.75,
  );
  tl.to("#k2", { autoAlpha: 0, duration: 0.35, ease: "power2.in" }, 7.25);
  tl.to("#l2", { autoAlpha: 0, yPercent: -50, duration: 0.4, ease: "power2.in" }, 7.3);

  const calls: Array<[string, number]> = [
    ["#c1", 7.15],
    ["#c2", 7.4],
    ["#c3", 7.65],
  ];
  for (const [sel, at] of calls) {
    tl.fromTo(
      sel,
      { autoAlpha: 0, x: 18 },
      { autoAlpha: 1, x: 0, duration: 0.5, immediateRender: false },
      at,
    );
    tl.to(sel, { autoAlpha: 0, x: -10, duration: 0.35, ease: "power2.in" }, 14.85);
  }

  tl.fromTo(
    "#k3",
    { autoAlpha: 0, y: 8 },
    { autoAlpha: 1, y: 0, duration: 0.4, immediateRender: false },
    9.15,
  );
  tl.to("#k3", { autoAlpha: 0, duration: 0.35, ease: "power2.in" }, 14.55);

  tl.fromTo(
    "#rule",
    { autoAlpha: 0, scaleX: 0 },
    { autoAlpha: 1, scaleX: 1, duration: 0.75, ease: "power3.inOut", immediateRender: false },
    15.75,
  );
  tl.fromTo(
    "#hero",
    { autoAlpha: 0, yPercent: 80, letterSpacing: "0.28em" },
    {
      autoAlpha: 1,
      yPercent: 0,
      letterSpacing: "0.14em",
      duration: 1.05,
      ease: "power4.out",
      immediateRender: false,
    },
    15.9,
  );
  tl.fromTo(
    "#hero-sub",
    { autoAlpha: 0, y: 12 },
    { autoAlpha: 1, y: 0, duration: 0.6, immediateRender: false },
    16.85,
  );

  const mark = document.querySelector("#end-mark");
  if (mark) {
    const strokes = mark.querySelectorAll("circle, path");
    strokes.forEach((node) => {
      if (!(node instanceof SVGGeometryElement)) return;
      const length = node.getTotalLength();
      gsap.set(node, { strokeDasharray: length, strokeDashoffset: length });
    });
    tl.fromTo(
      "#end-mark",
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.3, immediateRender: false },
      20.35,
    );
    tl.to(
      "#end-mark circle, #end-mark path",
      { strokeDashoffset: 0, duration: 0.9, ease: "power2.inOut", stagger: 0.08 },
      20.4,
    );
  }

  tl.to("#lockup", { autoAlpha: 0, duration: 0.55, ease: "power1.in" }, 22.85);
  tl.set({}, {}, 24);
  tl.seek(0, false);
  return tl;
}
