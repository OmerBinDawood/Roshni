"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** Fades and lifts its children in when they scroll into view. */
export function Reveal({ children, delay = 0, className = "", as: Tag = "div" }: {
  children: ReactNode; delay?: number; className?: string; as?: "div" | "section" | "li" | "p";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const T = Tag as "div";
  return <T ref={ref as React.RefObject<HTMLDivElement>} style={{ "--d": `${delay}ms` } as CSSProperties} className={`reveal ${on ? "in" : ""} ${className}`}>{children}</T>;
}

/** True once the element has entered the viewport (stays true). */
export function useInView<T extends HTMLElement>(threshold = 0.3) {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen] as const;
}

/** Counts from 0 to `to` once `start` is true. */
export function CountUp({ to, start, duration = 1400, decimals = 0, prefix = "", suffix = "" }: {
  to: number; start: boolean; duration?: number; decimals?: number; prefix?: string; suffix?: string;
}) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, to, duration]);
  return <>{prefix}{v.toFixed(decimals)}{suffix}</>;
}

/** 0..1 progress of a tall section as the user scrolls through it (for sticky storytelling). */
export function useSectionProgress<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const calc = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      setP(total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(calc); };
    calc();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return [ref, p] as const;
}
