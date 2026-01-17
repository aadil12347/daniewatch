// Small helper to reproduce the “cursor ripple fill” hover effect across buttons/links.

export const applyHoverSwipe = (el: HTMLElement, clientX: number, clientY: number) => {
  const rect = el.getBoundingClientRect();
  el.style.setProperty("--hs-x", `${clientX - rect.left}px`);
  el.style.setProperty("--hs-y", `${clientY - rect.top}px`);

  // Match the Codepen behavior: circle grows to ~2.25x of element's larger side
  const size = Math.max(rect.width, rect.height) * 2.25;
  el.style.setProperty("--hs-size", `${size}px`);
};
