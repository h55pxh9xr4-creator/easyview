"use client";
import { useEffect, useRef } from "react";

export default function CursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const onResize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    // 마우스 위치
    const mouse = { x: -500, y: -500 };
    const onMove = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    window.addEventListener("mousemove", onMove);

    // 스프링 follower 단 하나
    const f = { x: -500, y: -500, vx: 0, vy: 0 };

    // trail 히스토리 (최근 60개 좌표)
    const trail: { x: number; y: number }[] = [];
    const MAX = 20;

    let raf: number;

    const draw = () => {
      // 매 프레임 전체 지우기
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 스프링 물리
      f.vx += (mouse.x - f.x) * 0.05;
      f.vy += (mouse.y - f.y) * 0.05;
      f.vx *= 0.84;
      f.vy *= 0.84;
      f.x  += f.vx;
      f.y  += f.vy;

      trail.push({ x: f.x, y: f.y });
      if (trail.length > MAX) trail.shift();

      // 선 그리기 — 빨강(꼬리) → 주황(머리), 점점 연하게
      for (let i = 1; i < trail.length; i++) {
        const t     = i / trail.length;          // 0(꼬리) → 1(머리)
        const hue   = t * 300;                   // 빨(꼬리) → 보라(머리)
        const alpha = Math.pow(t, 1.2) * 0.75;

        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.strokeStyle = `hsla(${hue}, 100%, 60%, ${alpha})`;
        ctx.lineWidth   = t * 1.8;
        ctx.lineCap     = "round";
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}
