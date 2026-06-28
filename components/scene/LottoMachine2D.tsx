"use client";
// 2D HTML5 Canvas physics drum.
// - 100 numbered balls bounce inside a circular chamber, constantly stirred.
// - When the round flips to "completed" (winning_numbers is set), the 9
//   winning balls fly out of the bottom of the drum into pedestal slots
//   underneath for a dramatic reveal.
import { useEffect, useRef } from "react";
import { useRealtime, type NumberStatus } from "../providers/RealtimeProvider";

type FlightState = {
  t: number;            // elapsed seconds since draw start
  delay: number;        // when this ball begins flying (sec)
  fromX: number;
  fromY: number;
  targetX: number;
  targetY: number;
  duration: number;     // travel duration (sec)
  landed: boolean;
};

type Ball = {
  n: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rotation: number;
  rotationSpeed: number;
  flying: FlightState | null;
};

type Live = {
  numbers: Map<number, NumberStatus>;
  myNumbers: Set<number>;
  winners: number[];
  drawing: boolean;
};

// Each ball shows the Ansem bull portrait, with a status tint painted over it
// and a colored rim. `tint` is a translucent wash so the picture stays visible.
function ballColors(n: number, status: NumberStatus, mine: boolean, isWinner: boolean) {
  if (isWinner) return { rim: "#f5b13d", tint: "rgba(245,177,61,0.42)", fill: "#3a2c10" };
  if (mine && status === "reserved")
    return { rim: "#a3e635", tint: "rgba(163,230,53,0.40)", fill: "#27330e" };
  if (status === "reserved")
    return { rim: "#8a6334", tint: "rgba(20,16,8,0.55)", fill: "#1a1206" };
  // Available — alternating bronze / bull-green rims with a light dark wash so
  // the number stays readable against the busy portrait.
  const cycle = n % 4;
  if (cycle === 0) return { rim: "#7a6033", tint: "rgba(8,8,10,0.34)", fill: "#16160f" };
  if (cycle === 1) return { rim: "#2f7d49", tint: "rgba(6,14,8,0.34)", fill: "#101410" };
  if (cycle === 2) return { rim: "#c08b4f", tint: "rgba(12,9,4,0.34)", fill: "#1a160f" };
  return { rim: "#2fd576", tint: "rgba(6,12,8,0.34)", fill: "#0f130f" };
}

export function LottoMachine2D() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { numbers, myNumbers, round } = useRealtime();

  // Live data the rAF loop reads each frame.
  const liveRef = useRef<Live>({
    numbers: new Map(),
    myNumbers: new Set(),
    winners: [],
    drawing: false,
  });
  useEffect(() => {
    const m = new Map<number, NumberStatus>();
    for (const num of numbers) m.set(num.n, num.status);
    liveRef.current.numbers = m;
    liveRef.current.myNumbers = myNumbers;
    liveRef.current.winners = round?.winning_numbers ?? [];
    // Trigger the fly-out reveal as soon as winners exist on the round, which
    // happens the moment status flips to 'completed' in the simplified state
    // machine. We also accept legacy 'drawing'/'settling' rows for backward
    // compat with historical data.
    liveRef.current.drawing =
      !!round?.winning_numbers?.length ||
      round?.status === "drawing" ||
      round?.status === "settling" ||
      round?.status === "completed";
  }, [numbers, myNumbers, round]);

  // Track when a draw begins so we can sequence the fly-out animation.
  const drawStartRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Ansem portrait painted inside every ball.
    const bullImg = new window.Image();
    bullImg.src = "/ansem-coin.png";
    let bullReady = false;
    bullImg.onload = () => {
      bullReady = true;
    };

    let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    let cw = 800;
    let ch = 560;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      cw = Math.max(320, rect.width);
      ch = Math.max(320, rect.height);
      canvas.width = Math.floor(cw * dpr);
      canvas.height = Math.floor(ch * dpr);
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // Initial ball layout — random positions inside the drum.
    const balls: Ball[] = [];
    for (let i = 0; i < 100; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.random() * 100;
      balls.push({
        n: i + 1,
        x: cw / 2 + Math.cos(ang) * rad,
        y: ch / 2 + Math.sin(ang) * rad,
        vx: (Math.random() - 0.5) * 300,
        vy: (Math.random() - 0.5) * 300,
        r: 16,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 6,
        flying: null,
      });
    }

    let raf = 0;
    let last = performance.now();
    let stirAngle = 0;
    // Drum rotates continuously so the chamber visibly spins.
    let drumAngle = 0;
    const drumSpin = 0.45; // radians per second (slow tumble)

    const step = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      stirAngle += dt * 1.6;
      drumAngle += dt * drumSpin;

      const live = liveRef.current;

      // Drum geometry — slightly squashed circle, centered upper-mid.
      const drumCx = cw / 2;
      const drumCy = ch * 0.42;
      const drumR = Math.min(cw * 0.42, ch * 0.42);
      const ballR = Math.max(14, Math.min(18, drumR / 11));

      // Pedestal positions at the bottom of the canvas (for fly-out).
      const pedY = ch - 56;
      const pedCount = 5;
      const pedSpacing = Math.min(90, (cw - 60) / pedCount);
      const pedStartX = drumCx - (pedSpacing * (pedCount - 1)) / 2;
      const pedestals: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < pedCount; i++) {
        pedestals.push({ x: pedStartX + i * pedSpacing, y: pedY });
      }

      // Sync flight state to winners when drawing starts.
      if (live.drawing && live.winners.length === pedCount) {
        if (drawStartRef.current === null) drawStartRef.current = now;
        for (let i = 0; i < live.winners.length; i++) {
          const wn = live.winners[i];
          const b = balls.find((bb) => bb.n === wn);
          if (b && !b.flying) {
            const ped = pedestals[i];
            b.flying = {
              t: 0,
              delay: i * 0.85,
              fromX: b.x,
              fromY: b.y,
              targetX: ped.x,
              targetY: ped.y,
              duration: 0.9,
              landed: false,
            };
          }
        }
      } else if (!live.drawing && drawStartRef.current !== null) {
        // Round reset — return any landed/flying balls to the drum.
        drawStartRef.current = null;
        for (const b of balls) {
          if (b.flying) {
            b.flying = null;
            const ang = Math.random() * Math.PI * 2;
            const rad = Math.random() * (drumR - ballR - 4);
            b.x = drumCx + Math.cos(ang) * rad;
            b.y = drumCy + Math.sin(ang) * rad;
            b.vx = (Math.random() - 0.5) * 300;
            b.vy = (Math.random() - 0.5) * 300;
          }
        }
      }

      // ── Physics ────────────────────────────────────────────────────────
      for (const b of balls) {
        if (b.flying) {
          b.flying.t += dt;
          const localT = b.flying.t - b.flying.delay;
          if (localT < 0) continue;
          const p = Math.min(1, localT / b.flying.duration);
          // Ease: gravity-ish drop with a slight arc.
          const ease = p * p;
          b.x = b.flying.fromX + (b.flying.targetX - b.flying.fromX) * p;
          b.y = b.flying.fromY + (b.flying.targetY - b.flying.fromY) * ease;
          b.rotation += b.rotationSpeed * dt * 0.4;
          if (p >= 1) {
            b.flying.landed = true;
            // Settle to pedestal position.
            b.x = b.flying.targetX;
            b.y = b.flying.targetY;
            // Little bounce wobble
            b.rotation += dt;
          }
          continue;
        }

        // Gentle stirring — tangential nudge that follows the drum spin so
        // balls drift around but still fall through the middle.
        const dx = b.x - drumCx;
        const dy = b.y - drumCy;
        const d = Math.hypot(dx, dy) || 1;
        const tx = -dy / d;
        const ty = dx / d;
        const stir = 90 + 40 * Math.sin(stirAngle * 1.1 + b.n);
        b.vx += tx * stir * dt;
        b.vy += ty * stir * dt;
        // Gravity dominates — balls fall from the top of the drum, get
        // carried up the spinning side, then tumble back down through middle.
        b.vy += 320 * dt;
        b.vx *= 0.992;
        b.vy *= 0.992;
        // Keep some minimum tumble rotation so numbers wobble visibly.
        if (Math.abs(b.rotationSpeed) < 1.2) {
          b.rotationSpeed += (Math.random() - 0.5) * 0.5;
        }

        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.rotation += b.rotationSpeed * dt;

        // Drum wall collision — bounce inward and pick up the rotating
        // wall's tangential velocity so the ball is carried with the spin.
        const ndx = b.x - drumCx;
        const ndy = b.y - drumCy;
        const nd = Math.hypot(ndx, ndy);
        if (nd + ballR > drumR) {
          const nx = ndx / nd;
          const ny = ndy / nd;
          b.x = drumCx + nx * (drumR - ballR);
          b.y = drumCy + ny * (drumR - ballR);
          const vn = b.vx * nx + b.vy * ny;
          b.vx -= 1.7 * vn * nx;
          b.vy -= 1.7 * vn * ny;
          b.vx *= 0.7;
          b.vy *= 0.7;
          // Wall is moving tangentially at drumSpin * drumR — light friction
          // drags the ball along with it, but not enough to pin it there.
          const wallTx = -ny;
          const wallTy = nx;
          const wallSpeed = drumSpin * drumR;
          b.vx += wallTx * wallSpeed * 0.15;
          b.vy += wallTy * wallSpeed * 0.15;
          b.rotationSpeed += (Math.random() - 0.5) * 2 + drumSpin * 0.3;
        }
      }

      // Ball-ball collisions — O(n²) with spatial early-out.
      for (let i = 0; i < balls.length; i++) {
        const a = balls[i];
        if (a.flying) continue;
        for (let j = i + 1; j < balls.length; j++) {
          const b = balls[j];
          if (b.flying) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const min = a.r + b.r;
          if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
          const d2 = dx * dx + dy * dy;
          if (d2 > min * min || d2 === 0) continue;
          const d = Math.sqrt(d2);
          const nx = dx / d;
          const ny = dy / d;
          const overlap = (min - d) / 2;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
          const dvx = b.vx - a.vx;
          const dvy = b.vy - a.vy;
          const dv = dvx * nx + dvy * ny;
          if (dv < 0) {
            a.vx += dv * nx;
            a.vy += dv * ny;
            b.vx -= dv * nx;
            b.vy -= dv * ny;
          }
        }
      }

      // ── Render ─────────────────────────────────────────────────────────
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      // Background flair: soft ambient glow behind the drum.
      ctx.save();
      const ambient = ctx.createRadialGradient(drumCx, drumCy, drumR * 0.2, drumCx, drumCy, drumR * 1.7);
      ambient.addColorStop(0, "rgba(245, 177, 61, 0.14)");
      ambient.addColorStop(0.55, "rgba(47, 213, 118, 0.06)");
      ambient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = ambient;
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();

      // Drum body — glass chamber with gradient ring.
      ctx.save();
      ctx.translate(drumCx, drumCy);

      // outer soft shadow
      ctx.beginPath();
      ctx.arc(0, 0, drumR + 16, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fill();

      // gradient ring (aqua → violet)
      ctx.beginPath();
      ctx.arc(0, 0, drumR + 10, 0, Math.PI * 2);
      const ringGrad = ctx.createLinearGradient(-drumR, -drumR, drumR, drumR);
      ringGrad.addColorStop(0, "#2fd576");
      ringGrad.addColorStop(1, "#f5b13d");
      ctx.strokeStyle = ringGrad;
      ctx.lineWidth = 3;
      ctx.stroke();

      // faint secondary ring
      ctx.beginPath();
      ctx.arc(0, 0, drumR + 5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // glass chamber bg
      ctx.beginPath();
      ctx.arc(0, 0, drumR, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(0, -drumR * 0.4, 0, 0, 0, drumR);
      grad.addColorStop(0, "rgba(255, 255, 255, 0.07)");
      grad.addColorStop(1, "rgba(7, 10, 20, 0.55)");
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.stroke();

      // orbit dots around the rim — rotate with the drum.
      const boltCount = 16;
      for (let i = 0; i < boltCount; i++) {
        const a = (i / boltCount) * Math.PI * 2 + drumAngle;
        const bx = Math.cos(a) * (drumR + 10);
        const by = Math.sin(a) * (drumR + 10);
        ctx.beginPath();
        ctx.arc(bx, by, 2, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 === 0 ? "rgba(47,213,118,0.7)" : "rgba(245,177,61,0.7)";
        ctx.fill();
      }

      // Internal spokes/paddles inside the chamber to sell the spin —
      // drawn under the balls (clipped to chamber circle).
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, drumR - 1, 0, Math.PI * 2);
      ctx.clip();
      ctx.rotate(drumAngle);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
      ctx.lineWidth = 2;
      const spokeCount = 6;
      for (let i = 0; i < spokeCount; i++) {
        ctx.rotate((Math.PI * 2) / spokeCount);
        ctx.beginPath();
        ctx.moveTo(drumR * 0.15, 0);
        ctx.lineTo(drumR * 0.95, 0);
        ctx.stroke();
      }
      ctx.restore();

      // glass top highlight
      ctx.beginPath();
      ctx.ellipse(-drumR * 0.3, -drumR * 0.45, drumR * 0.4, drumR * 0.16, -0.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fill();

      ctx.restore();

      // Pedestals at the bottom — minimal glass slots.
      const baseHalf = Math.max(14, Math.min(24, pedSpacing / 2 - 4));
      for (let i = 0; i < pedCount; i++) {
        const ped = pedestals[i];
        ctx.save();
        ctx.translate(ped.x, ped.y + 22);
        // glow base
        const slotGlow = ctx.createRadialGradient(0, 4, 0, 0, 4, baseHalf + 8);
        slotGlow.addColorStop(0, "rgba(245,177,61,0.22)");
        slotGlow.addColorStop(1, "rgba(245,177,61,0)");
        ctx.fillStyle = slotGlow;
        ctx.beginPath();
        ctx.ellipse(0, 4, baseHalf + 8, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        // glass platform
        ctx.beginPath();
        ctx.ellipse(0, 2, baseHalf, 5.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      // ── Balls ──────────────────────────────────────────────────────────
      for (const b of balls) {
        const status = live.numbers.get(b.n) ?? "available";
        const mine = live.myNumbers.has(b.n);
        const isWinner = live.winners.includes(b.n);
        const colors = ballColors(b.n, status, mine, isWinner);

        // Drop shadow
        ctx.beginPath();
        ctx.arc(b.x + 1.5, b.y + 2.5, b.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fill();

        // Body — Ansem portrait clipped into the ball, with a status tint.
        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = colors.fill;
        ctx.fill();
        if (bullReady) {
          ctx.clip();
          const d = b.r * 2;
          // Crop a centered square from the source so the wide coin art maps
          // into the round ball without stretching.
          const iw = bullImg.naturalWidth || d;
          const ih = bullImg.naturalHeight || d;
          const s = Math.min(iw, ih);
          const sx = (iw - s) / 2;
          const sy = (ih - s) / 2;
          ctx.drawImage(bullImg, sx, sy, s, s, b.x - b.r, b.y - b.r, d, d);
          ctx.fillStyle = colors.tint;
          ctx.fillRect(b.x - b.r, b.y - b.r, d, d);
        }
        ctx.restore();

        // Rim
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = colors.rim;
        ctx.stroke();

        // Highlight shine
        ctx.beginPath();
        ctx.ellipse(b.x - b.r * 0.35, b.y - b.r * 0.42, b.r * 0.3, b.r * 0.16, -0.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.fill();

        // Number — white with a dark stroke so it reads over the portrait.
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.flying ? b.rotation * 0.15 : Math.sin(b.rotation) * 0.08);
        ctx.font = `800 ${Math.floor(b.r * 1.2)}px var(--font-display), ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(2.5, b.r * 0.22);
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.lineJoin = "round";
        ctx.strokeText(String(b.n), 0, 1);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(String(b.n), 0, 1);
        ctx.restore();

        // Winner glow
        if (isWinner) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r + 4 + Math.sin(now * 0.01) * 2, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(245, 177, 61, 0.85)";
          ctx.lineWidth = 2.5;
          ctx.shadowColor = "rgba(245, 177, 61, 0.6)";
          ctx.shadowBlur = 12;
          ctx.stroke();
          ctx.restore();
        }
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
