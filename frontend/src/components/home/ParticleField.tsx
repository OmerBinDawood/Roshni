"use client";
import { useEffect, useRef } from "react";

/**
 * Interactive "energy field": drifting points joined by hairlines, pulled toward the pointer and, as you scroll,
 * toward the sun. Amber streaks travel from the sun like a unit of generated energy. Pauses off-screen; static when
 * the user prefers reduced motion.
 */
export default function ParticleField({ sun = { x: 0.74, y: 0.36 } }: { sun?: { x: number; y: number } }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    type P = { x: number; y: number; vx: number; vy: number; r: number; hot: boolean };
    type S = { t: number; life: number; cx: number; cy: number; tx: number; ty: number };
    let w = 0, h = 0, dpr = 1, raf = 0, visible = true, last = 0, spawn = 0;
    let pts: P[] = [];
    const streaks: S[] = [];
    const ptr = { x: -9999, y: -9999, on: false };
    let scroll = 0;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(110, Math.max(34, (w * h) / 15000)));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
        r: 1 + Math.random() * 1.8, hot: Math.random() < 0.16,
      }));
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible && !reduce) return;
      const dt = Math.min(48, now - (last || now)); last = now;
      ctx.clearRect(0, 0, w, h);
      const sx = sun.x * w, sy = sun.y * h;
      const k = Math.min(1, scroll / Math.max(1, h)); // 0..1 as the hero scrolls away

      for (const p of pts) {
        p.x += p.vx * dt * 0.06 * 16; p.y += p.vy * dt * 0.06 * 16;
        if (ptr.on) {
          const dx = ptr.x - p.x, dy = ptr.y - p.y, d = Math.hypot(dx, dy);
          if (d < 190 && d > 1) { p.x += (dx / d) * 0.35; p.y += (dy / d) * 0.35; }
        }
        if (k > 0) { p.x += (sx - p.x) * 0.012 * k; p.y += (sy - p.y) * 0.012 * k; }
        if (p.x < -10) p.x = w + 10; if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10; if (p.y > h + 10) p.y = -10;
      }

      // hairlines
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i], b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 125) {
            ctx.strokeStyle = a.hot || b.hot ? `rgba(245,138,7,${(1 - d / 125) * 0.32})` : `rgba(15,27,45,${(1 - d / 125) * 0.13})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        if (ptr.on) {
          const a = pts[i], d = Math.hypot(a.x - ptr.x, a.y - ptr.y);
          if (d < 170) { ctx.strokeStyle = `rgba(245,138,7,${(1 - d / 170) * 0.5})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(ptr.x, ptr.y); ctx.stroke(); }
        }
      }
      // squares (like the reference's pixel dust)
      for (const p of pts) {
        ctx.fillStyle = p.hot ? "#f58a07" : "rgba(15,27,45,0.55)";
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }

      // energy streaks leaving the sun
      spawn += dt;
      if (!reduce && spawn > 1100 && streaks.length < 5) {
        spawn = 0;
        const tx = Math.random() * w * 0.55, ty = h * (0.55 + Math.random() * 0.45);
        streaks.push({ t: 0, life: 1900 + Math.random() * 900, cx: (sx + tx) / 2 - 40, cy: Math.min(sy, ty) - 80 * Math.random(), tx, ty });
      }
      for (let i = streaks.length - 1; i >= 0; i--) {
        const s = streaks[i]; s.t += dt;
        const u = s.t / s.life;
        if (u >= 1) { streaks.splice(i, 1); continue; }
        const pt = (q: number) => {
          const m = 1 - q;
          return { x: m * m * sx + 2 * m * q * s.cx + q * q * s.tx, y: m * m * sy + 2 * m * q * s.cy + q * q * s.ty };
        };
        const tail = Math.max(0, u - 0.22);
        ctx.beginPath();
        for (let q = tail; q <= u; q += 0.02) { const c = pt(q); if (q === tail) ctx.moveTo(c.x, c.y); else ctx.lineTo(c.x, c.y); }
        ctx.strokeStyle = `rgba(245,138,7,${0.75 * (1 - u)})`; ctx.lineWidth = 1.8; ctx.stroke();
        const head = pt(u);
        ctx.fillStyle = `rgba(255,176,32,${1 - u})`; ctx.fillRect(head.x - 3, head.y - 3, 6, 6);
      }
      if (!reduce) raf = requestAnimationFrame(frame);
    };

    const start = () => { if (!raf) raf = requestAnimationFrame(frame); };
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top;
      ptr.on = ptr.x >= 0 && ptr.y >= 0 && ptr.x <= w && ptr.y <= h;
    };
    const onScroll = () => { scroll = window.scrollY; };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); });
    io.observe(canvas);
    const ro = new ResizeObserver(() => { resize(); if (reduce) frame(performance.now()); });
    ro.observe(canvas);
    resize();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    start();
    return () => { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); window.removeEventListener("pointermove", onMove); window.removeEventListener("scroll", onScroll); };
  }, [sun.x, sun.y]);

  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden />;
}
