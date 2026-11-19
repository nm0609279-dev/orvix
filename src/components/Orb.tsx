"use client";

import { useEffect, useRef } from "react";

export type OrbState = "idle" | "thinking" | "speaking";

interface Props {
  state?: OrbState;
  dark?: boolean;
  points?: number;
  interactive?: boolean;
  className?: string;
}

/**
 * Interactive particle orb. Follows the pointer, repels particles near the cursor,
 * pulses on click and gets energetic while the AI is thinking / speaking.
 */
export default function Orb({ state = "idle", dark = false, points = 1100, interactive = true, className = "" }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<OrbState>(state);
  const darkRef = useRef(dark);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    darkRef.current = dark;
  }, [dark]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const N = points;
    const pts = new Float32Array(N * 3);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      pts[i * 3] = Math.cos(th) * r;
      pts[i * 3 + 1] = y;
      pts[i * 3 + 2] = Math.sin(th) * r;
    }

    let w = 0;
    let h = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // pointer
    let tx = 0;
    let ty = 0;
    let mx = -9999;
    let my = -9999;
    let pointerNear = false;
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      tx = Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth / 2)));
      ty = Math.max(-1, Math.min(1, (e.clientY - cy) / (window.innerHeight / 2)));
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
      pointerNear = true;
    };
    const onLeave = () => {
      pointerNear = false;
      tx = 0;
      ty = 0;
    };
    let pulse = 0;
    const onDown = () => {
      pulse = 1;
    };
    if (interactive) {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("pointerleave", onLeave);
      canvas.addEventListener("pointerdown", onDown);
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let rotY = Math.random() * 6;
    let tiltX = 0;
    let tiltY = 0;
    let speed = 0.2;
    let energy = 0.04;
    let last = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const time = now / 1000;
      const st = stateRef.current;
      const isDark = darkRef.current;

      const targetSpeed = st === "idle" ? 0.2 : st === "thinking" ? 1.0 : 0.55;
      const targetEnergy = st === "idle" ? 0.05 : st === "thinking" ? 0.2 : 0.12;
      speed += (targetSpeed - speed) * 0.05;
      energy += (targetEnergy - energy) * 0.05;
      rotY += speed * dt * (reduce ? 0.3 : 1);
      tiltX += (ty * 0.55 - tiltX) * 0.06;
      tiltY += (tx * 0.7 - tiltY) * 0.06;
      pulse *= 0.95;

      const cx = w / 2;
      const cy = h / 2;
      const base = Math.min(w, h);
      const R = base * 0.33 * (1 + 0.025 * Math.sin(time * 1.6) + pulse * 0.14 + (st !== "idle" ? 0.03 * Math.sin(time * 7) : 0));

      ctx.clearRect(0, 0, w, h);

      // soft glow
      const g = ctx.createRadialGradient(cx, cy, R * 0.15, cx, cy, R * 1.55);
      if (isDark) {
        g.addColorStop(0, "rgba(90,140,255,0.34)");
        g.addColorStop(0.45, "rgba(130,90,255,0.14)");
        g.addColorStop(1, "rgba(120,80,255,0)");
      } else {
        g.addColorStop(0, "rgba(60,130,255,0.22)");
        g.addColorStop(0.5, "rgba(140,100,255,0.1)");
        g.addColorStop(1, "rgba(140,100,255,0)");
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // inner core
      const core = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.3, R * 0.05, cx, cy, R * 0.98);
      if (isDark) {
        core.addColorStop(0, "rgba(120,170,255,0.28)");
        core.addColorStop(0.7, "rgba(80,60,200,0.1)");
        core.addColorStop(1, "rgba(60,40,160,0.02)");
      } else {
        core.addColorStop(0, "rgba(255,255,255,0.95)");
        core.addColorStop(0.6, "rgba(150,170,255,0.16)");
        core.addColorStop(1, "rgba(120,100,255,0.08)");
      }
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.98, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = isDark ? "lighter" : "source-over";
      const cosY = Math.cos(rotY + tiltY);
      const sinY = Math.sin(rotY + tiltY);
      const cosX = Math.cos(tiltX);
      const sinX = Math.sin(tiltX);
      const repelR = base * 0.2;
      const unit = Math.max(0.55, base / 340);
      const lightness = isDark ? 68 : 52;

      for (let i = 0; i < N; i++) {
        const x = pts[i * 3];
        const y = pts[i * 3 + 1];
        const z = pts[i * 3 + 2];
        const n = Math.sin(x * 3.1 + time * 2.2) * Math.cos(y * 3.3 + time * 1.7) * Math.sin(z * 3.0 + time * 2.7);
        const s = 1 + energy * n + pulse * 0.1 * Math.sin(y * 6 - time * 9);
        const x1 = (x * cosY + z * sinY) * s;
        const z1 = (-x * sinY + z * cosY) * s;
        const y2 = (y * cosX - z1 * sinX) * s;
        const z2 = y * sinX + z1 * cosX;
        const persp = 1.7 / (1.7 - z2 * 0.5);
        let sx = cx + x1 * R * persp;
        let sy = cy + y2 * R * persp;
        const depth = (z2 + 1) / 2;
        let boost = 0;
        if (pointerNear) {
          const dx = sx - mx;
          const dy = sy - my;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < repelR) {
            const f = 1 - d / repelR;
            const k = (f * f * R * 0.22) / (d + 0.001);
            sx += dx * k;
            sy += dy * k;
            boost = f;
          }
        }
        const size = (0.55 + depth * 1.35 + boost * 1.4) * unit;
        const alpha = Math.min(1, (0.12 + depth * 0.8 + boost * 0.5) * (isDark ? 1 : 0.9));
        const hue = 205 + 85 * (0.5 + 0.5 * Math.sin(y * 2.3 + time * 0.45 + x * 1.3)) + boost * 60;
        ctx.fillStyle = `hsla(${hue % 360},95%,${lightness + boost * 14}%,${alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // orbit rings
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = Math.max(1, unit * 0.9);
      for (let k = 0; k < 2; k++) {
        const ang = time * (0.25 + k * 0.17) * (k ? -1 : 1) + k * 1.6 + tiltY;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        ctx.strokeStyle = isDark ? `rgba(160,190,255,${0.14 + k * 0.05})` : `rgba(90,110,230,${0.16 + k * 0.05})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, R * (1.22 + k * 0.1), R * (0.34 + k * 0.12 + Math.abs(tiltX) * 0.25), 0, 0, Math.PI * 2);
        ctx.stroke();
        const a2 = time * (1.1 + k * 0.5) + k * 2;
        const ox = Math.cos(a2) * R * (1.22 + k * 0.1);
        const oy = Math.sin(a2) * R * (0.34 + k * 0.12 + Math.abs(tiltX) * 0.25);
        ctx.fillStyle = k ? "#ff6fb1" : isDark ? "#8fc2ff" : "#1783ff";
        ctx.beginPath();
        ctx.arc(ox, oy, Math.max(1.6, unit * 2.2), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
    };
  }, [points, interactive]);

  return <canvas ref={ref} className={`block touch-manipulation ${className}`} style={{ width: "100%", height: "100%" }} />;
}
