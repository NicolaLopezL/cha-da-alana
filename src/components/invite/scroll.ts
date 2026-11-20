import { prefersReducedMotion } from "./gsap";

/** Rola suavemente até uma seção do convite e leva o foco (leitores de tela) junto. */
export function scrollToSection(id: string): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  const top = el.getBoundingClientRect().top + window.scrollY - 8;
  window.scrollTo({ top, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
  return true;
}
