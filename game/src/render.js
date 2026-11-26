// Skyline Courier — rendering: sky, projected terrain, runway, town, rings, the
// chase-view aircraft, the lit cockpit gauges, the HUD and every screen.

import { COLOURS, SKY, VIEW, WORLD } from './config.js';
import { groundColour, heightAt, mountainRidge, onRunway, riverX } from './terrain.js';
import { altitudeFt, headingDeg, M_TO_FT } from './physics.js';

const W = VIEW.width;
const H = VIEW.height;
const FOCAL = (H / 2) / Math.tan(0.62);

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const ridges = [mountainRidge(0, 31), mountainRidge(1, 97)];

  // --- projection ---------------------------------------------------------
  function makeCamera(plane) {
    const h = plane.heading;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    return {
      x: plane.x - fx * 9,
      y: plane.y + 3.4,
      z: plane.z - fz * 9,
      heading: h,
      pitch: plane.pitch * 0.55,
      roll: -plane.roll,
    };
  }

  function project(cam, x, y, z) {
    const dx = x - cam.x;
    const dy = y - cam.y;
    const dz = z - cam.z;
    const ch = Math.cos(cam.heading);
    const sh = Math.sin(cam.heading);
    const xf = dx * sh + dz * ch;
    const xr = dx * ch - dz * sh;
    const cp = Math.cos(cam.pitch);
    const sp = Math.sin(cam.pitch);
    const y2 = dy * cp - xf * sp;
    const z2 = dy * sp + xf * cp;
    if (z2 < 2) return null;
    let sx = W / 2 + (xr / z2) * FOCAL;
    let sy = H / 2 - (y2 / z2) * FOCAL;
    if (cam.roll) {
      const dxs = sx - W / 2;
      const dys = sy - H / 2;
      const cr = Math.cos(cam.roll);
      const sr = Math.sin(cam.roll);
      sx = W / 2 + dxs * cr - dys * sr;
      sy = H / 2 + dxs * sr + dys * cr;
    }
    return { x: sx, y: sy, d: z2 };
  }

  function horizonY(cam) {
    return H / 2 + Math.tan(cam.pitch) * FOCAL;
  }

  // --- small helpers ------------------------------------------------------
  function hexLerp(a, b, t) {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
    const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
    const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
    return `rgb(${r},${g},${bl})`;
  }

  function poly(points, fill) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function fogMix(colour, d, palette) {
    const t = Math.min(0.72, Math.max(0, (d - 350) / 1500));
    return hexLerp(colour, palette.fog, t);
  }

  // --- sky ----------------------------------------------------------------
  function drawSky(cam, palette, time) {
    const hy = horizonY(cam);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, palette.top);
    grad.addColorStop(Math.max(0, Math.min(1, hy / H)), palette.mid);
    grad.addColorStop(1, palette.horizon);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Sun: fixed bearing, high up.
    const sunBearing = cam.heading - 0.55;
    const sx = cam.x + Math.sin(sunBearing) * 4200;
    const sz = cam.z + Math.cos(sunBearing) * 4200;
    const sun = project(cam, sx, 620, sz);
    if (sun && sun.y > -60 && sun.y < H) {
      const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 90);
      glow.addColorStop(0, palette.sun);
      glow.addColorStop(0.25, 'rgba(255,240,190,0.55)');
      glow.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sun.x - 95, sun.y - 95, 190, 190);
      ctx.fillStyle = palette.sun;
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    // Clouds.
    const clouds = [...renderState.clouds].sort((a, b) => b.z - a.z);
    for (const c of clouds) {
      const p = project(cam, c.x, c.y, c.z);
      if (!p || p.y < -80 || p.y > H + 40) continue;
      const s = (c.s * FOCAL) / p.d;
      if (s < 4) continue;
      ctx.fillStyle = palette.cloud;
      for (let i = 0; i < c.puffs; i++) {
        const ox = (i - (c.puffs - 1) / 2) * s * 0.75;
        const oy = Math.sin(i * 2.3) * s * 0.12;
        ctx.beginPath();
        ctx.ellipse(p.x + ox, p.y + oy, s * 0.62, s * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Far mountain walls, two ridges.
    for (let layer = 0; layer < 2; layer++) {
      const ridge = ridges[layer];
      const dist = WORLD.mountainsFar - layer * 900;
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const bearing = (ridge[i].t - 0.5) * 2.4;
        const wx = cam.x + Math.sin(cam.heading + bearing) * dist;
        const wz = cam.z + Math.cos(cam.heading + bearing) * dist;
        const wy = 30 + ridge[i].peak * (2.6 - layer * 0.7);
        const p = project(cam, wx, wy, wz);
        if (p) pts.push(p);
      }
      if (pts.length > 2) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (const p of pts) ctx.lineTo(p.x, p.y);
        ctx.lineTo(pts[pts.length - 1].x, H);
        ctx.lineTo(pts[0].x, H);
        ctx.closePath();
        ctx.fillStyle = layer === 0 ? hexLerp('#8fa8c0', palette.fog, 0.45) : hexLerp('#6f8aa5', palette.fog, 0.3);
        ctx.fill();
      }
    }
    void time;
  }

  // --- terrain ------------------------------------------------------------
  const DISTANCES = [18, 32, 50, 72, 98, 128, 162, 200, 244, 294, 350, 414, 486, 566, 654, 752, 860, 980, 1110, 1250, 1400, 1560];
  const LATERALS = [-900, -650, -450, -300, -200, -120, -60, -25, 0, 25, 60, 120, 200, 300, 450, 650, 900];

  function drawTerrain(cam, palette) {
    const ch = Math.cos(cam.heading);
    const sh = Math.sin(cam.heading);
    // Camera-aligned grid: rows far to near.
    for (let ri = DISTANCES.length - 2; ri >= 0; ri--) {
      const d0 = DISTANCES[ri];
      const d1 = DISTANCES[ri + 1];
      for (let ci = 0; ci < LATERALS.length - 1; ci++) {
        const l0 = LATERALS[ci];
        const l1 = LATERALS[ci + 1];
        const corners = [];
        let ok = true;
        for (const [lat, d] of [[l0, d0], [l1, d0], [l1, d1], [l0, d1]]) {
          const wx = cam.x + sh * d + ch * lat;
          const wz = cam.z + ch * d - sh * lat;
          const wy = heightAt(wx, wz);
          const p = project(cam, wx, wy, wz);
          if (!p) { ok = false; break; }
          corners.push(p);
        }
        if (!ok) continue;
        const mcx = cam.x + sh * ((d0 + d1) / 2) + ch * ((l0 + l1) / 2);
        const mcz = cam.z + ch * ((d0 + d1) / 2) - sh * ((l0 + l1) / 2);
        const mh = heightAt(mcx, mcz);
        const base = groundColour(mcx, mcz, mh);
        const mid = (d0 + d1) / 2;
        poly(corners, fogMix(base, mid, palette));
      }
    }
  }

  function drawRunwayMarkings(cam, palette) {
    const rw = WORLD.runway;
    const half = rw.width / 2;
    const z0 = rw.z - rw.length / 2;
    const z1 = rw.z + rw.length / 2;
    const y = 0.6;
    // Centreline dashes.
    for (let z = z0 + 20; z < z1 - 10; z += 40) {
      const a = project(cam, -1.2, y, z);
      const b = project(cam, 1.2, y, z);
      const c = project(cam, 1.2, y, z + 22);
      const d = project(cam, -1.2, y, z + 22);
      if (a && b && c && d) poly([a, b, c, d], COLOURS.runwayMark);
    }
    // Threshold bars at both ends.
    for (const zt of [z0 + 8, z1 - 8]) {
      for (let i = -3; i <= 3; i++) {
        if (i === 0) continue;
        const a = project(cam, i * 4 - 1.5, y, zt);
        const b = project(cam, i * 4 + 1.5, y, zt);
        const c = project(cam, i * 4 + 1.5, y, zt + 12);
        const d = project(cam, i * 4 - 1.5, y, zt + 12);
        if (a && b && c && d) poly([a, b, c, d], COLOURS.runwayMark);
      }
    }
    // Touchdown zone: two pairs of bars.
    for (const zt of [z0 + 90, z0 + 150]) {
      for (const side of [-9, 9]) {
        const a = project(cam, side - 4, y, zt);
        const b = project(cam, side + 4, y, zt);
        const c = project(cam, side + 4, y, zt + 24);
        const d = project(cam, side - 4, y, zt + 24);
        if (a && b && c && d) poly([a, b, c, d], COLOURS.runwayMark);
      }
    }
    void palette;
    void half;
  }

  function drawTown(cam, palette) {
    const list = [...renderState.town].sort((a, b) => {
      const da = Math.hypot(a.x - cam.x, a.z - cam.z);
      const db = Math.hypot(b.x - cam.x, b.z - cam.z);
      return db - da;
    });
    for (const b of list) {
      const d = Math.hypot(b.x - cam.x, b.z - cam.z);
      if (d > 1700) continue;
      const gy = heightAt(b.x, b.z);
      const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2;
      const z0 = b.z - b.d / 2, z1 = b.z + b.d / 2;
      const top = [
        project(cam, x0, gy + b.h, z0), project(cam, x1, gy + b.h, z0),
        project(cam, x1, gy + b.h, z1), project(cam, x0, gy + b.h, z1),
      ];
      const front = [
        project(cam, x0, gy, z1), project(cam, x1, gy, z1),
        project(cam, x1, gy + b.h, z1), project(cam, x0, gy + b.h, z1),
      ];
      const side = [
        project(cam, x1, gy, z0), project(cam, x1, gy, z1),
        project(cam, x1, gy + b.h, z1), project(cam, x1, gy + b.h, z0),
      ];
      const shade = ['#c9bda0', '#b3a888', '#9d926f'][b.shade];
      if (front.every(Boolean)) poly(front, fogMix(shade, d, palette));
      if (side.every(Boolean)) poly(side, fogMix('#8a7f63', d, palette));
      if (top.every(Boolean)) poly(top, fogMix(b.roof ? COLOURS.townRoof : '#7d7468', d, palette));
    }
  }

  // --- rings ---------------------------------------------------------------
  function drawRings(cam, game, palette) {
    const rings = game.rings;
    const next = rings.find((r) => !r.passed);
    for (let i = rings.length - 1; i >= 0; i--) {
      const ring = rings[i];
      if (ring.passed) continue;
      const isNext = ring === next;
      const pts = [];
      let visible = true;
      for (let k = 0; k <= 28; k++) {
        const a = (k / 28) * Math.PI * 2;
        const p = project(cam, ring.x + Math.cos(a) * ring.radius, ring.y + Math.sin(a) * ring.radius, ring.z);
        if (!p) { visible = false; break; }
        pts.push(p);
      }
      if (!visible) continue;
      const d = Math.hypot(ring.x - cam.x, ring.z - cam.z);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.fillStyle = isNext ? 'rgba(255,201,60,0.10)' : 'rgba(255,201,60,0.05)';
      ctx.fill();
      ctx.save();
      ctx.shadowColor = COLOURS.ringGlow;
      ctx.shadowBlur = isNext ? 22 : 10;
      ctx.strokeStyle = isNext ? COLOURS.ring : '#d8a92e';
      ctx.lineWidth = isNext ? 6 : 4;
      ctx.stroke();
      ctx.restore();
      if (isNext) {
        const top = project(cam, ring.x, ring.y + ring.radius + 14, ring.z);
        if (top) {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 15px Verdana, sans-serif';
          ctx.textAlign = 'center';
          const idx = rings.indexOf(ring) + 1;
          ctx.fillText(`RING ${idx}/${rings.length} — ${Math.round(d)} m`, top.x, top.y);
        }
      }
    }
    // Off-screen arrow toward the next ring.
    if (next) {
      const p = project(cam, next.x, next.y, next.z);
      if (!p || p.x < 40 || p.x > W - 40 || p.y < 40 || p.y > H - 160) {
        const px = p ? Math.max(60, Math.min(W - 60, p.x)) : W / 2;
        const py = p ? Math.max(70, Math.min(H - 180, p.y)) : 90;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(Math.atan2((p ? p.y : 0) - py, (p ? p.x : W / 2) - px));
        ctx.fillStyle = COLOURS.ring;
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-10, -11);
        ctx.lineTo(-10, 11);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#ffe9a8';
        ctx.font = 'bold 13px Verdana, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`NEXT RING ${Math.round(Math.hypot(next.x - game.plane.x, next.z - game.plane.z))} m`, px, py + 26);
      }
    }
    void palette;
  }

  // --- the aircraft ---------------------------------------------------------
  function drawPlane(plane, time) {
    const cx = W / 2;
    const cy = H * 0.68 + plane.pitch * 26;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(plane.roll * 0.9);
    const bob = Math.sin(time * 2.1) * 1.5;
    ctx.translate(0, bob);
    ctx.scale(1, 1);

    // Prop blur disc at the nose: a thin shimmer across the cowling, not a halo.
    ctx.save();
    ctx.globalAlpha = 0.12 + 0.04 * Math.sin(time * 31);
    ctx.fillStyle = '#dfe8ee';
    ctx.beginPath();
    ctx.ellipse(0, -100, 44, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Wings.
    ctx.fillStyle = COLOURS.planeTrim;
    ctx.beginPath();
    ctx.moveTo(-14, -58);
    ctx.lineTo(-172, -30);
    ctx.lineTo(-168, -8);
    ctx.lineTo(-12, -30);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -58);
    ctx.lineTo(172, -30);
    ctx.lineTo(168, -8);
    ctx.lineTo(12, -30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLOURS.planeBody;
    ctx.fillRect(-172, -32, 10, 22);
    ctx.fillRect(162, -32, 10, 22);

    // Fuselage: tail at the bottom, nose at the top.
    const body = ctx.createLinearGradient(-26, 0, 26, 0);
    body.addColorStop(0, '#a92c1b');
    body.addColorStop(0.5, COLOURS.planeBody);
    body.addColorStop(1, '#a92c1b');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-20, 66);
    ctx.quadraticCurveTo(-26, -10, -13, -96);
    ctx.quadraticCurveTo(0, -112, 13, -96);
    ctx.quadraticCurveTo(26, -10, 20, 66);
    ctx.quadraticCurveTo(0, 76, -20, 66);
    ctx.closePath();
    ctx.fill();

    // White cheatline.
    ctx.fillStyle = COLOURS.planeTrim;
    ctx.beginPath();
    ctx.moveTo(-22, 18);
    ctx.quadraticCurveTo(-24, -30, -14, -82);
    ctx.lineTo(-8, -82);
    ctx.quadraticCurveTo(-16, -30, -14, 18);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(22, 18);
    ctx.quadraticCurveTo(24, -30, 14, -82);
    ctx.lineTo(8, -82);
    ctx.quadraticCurveTo(16, -30, 14, 18);
    ctx.closePath();
    ctx.fill();

    // Cockpit glass.
    ctx.fillStyle = COLOURS.planeGlass;
    ctx.beginPath();
    ctx.ellipse(0, -72, 11, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-3, -78, 3.5, 7, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Tail fin and stabilizer.
    ctx.fillStyle = COLOURS.planeBody;
    ctx.beginPath();
    ctx.moveTo(-4, 62);
    ctx.lineTo(-6, 96);
    ctx.lineTo(6, 96);
    ctx.lineTo(4, 62);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLOURS.planeTrim;
    ctx.beginPath();
    ctx.moveTo(-52, 58);
    ctx.lineTo(52, 58);
    ctx.lineTo(46, 74);
    ctx.lineTo(-46, 74);
    ctx.closePath();
    ctx.fill();

    // Nav lights: red left, green right, white strobe blinking at the tail.
    ctx.fillStyle = '#ff2e2e';
    ctx.beginPath(); ctx.arc(-170, -20, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2eff5e';
    ctx.beginPath(); ctx.arc(170, -20, 5, 0, Math.PI * 2); ctx.fill();
    if (Math.sin(time * 5) > 0.2) {
      ctx.save();
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 98, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // --- cockpit panel and lit gauges ----------------------------------------
  function dial(cx, cy, r, label, value, min, max, unit) {
    ctx.save();
    ctx.shadowColor = 'rgba(120,220,255,0.8)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#101c26';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#3d5a6e';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    // Ticks.
    ctx.strokeStyle = '#9fc6dd';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4));
      ctx.lineTo(cx + Math.cos(a) * (r - 10), cy + Math.sin(a) * (r - 10));
      ctx.stroke();
    }
    const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
    const a = Math.PI * 0.75 + t * Math.PI * 1.5;
    ctx.save();
    ctx.shadowColor = '#7fe3ff';
    ctx.shadowBlur = 6;
    ctx.strokeStyle = '#7fe3ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * (r - 12), cy + Math.sin(a) * (r - 12));
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#cfe8f5';
    ctx.font = 'bold 11px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy + r * 0.45);
    ctx.font = 'bold 15px Verdana, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${Math.round(value)}${unit}`, cx, cy - r * 0.42);
  }

  function drawCockpit(game) {
    const plane = game.plane;
    const panelY = H - 118;
    const grad = ctx.createLinearGradient(0, panelY, 0, H);
    grad.addColorStop(0, '#1a2836');
    grad.addColorStop(0.12, '#0e1822');
    grad.addColorStop(1, '#05090d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, panelY, W, H - panelY);
    ctx.fillStyle = '#2c4256';
    ctx.fillRect(0, panelY, W, 3);

    // Airspeed, artificial horizon, altimeter.
    dial(150, H - 58, 46, 'AIRSPEED', plane.speed, 0, 240, ' kt');
    dial(330, H - 58, 46, 'ALTITUDE', altitudeFt(plane), 0, 4000, ' ft');

    // Artificial horizon.
    const hx = 240, hy = H - 58, hr = 46;
    ctx.save();
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.clip();
    ctx.translate(hx, hy);
    ctx.rotate(-plane.roll);
    ctx.translate(0, plane.pitch * 60);
    ctx.fillStyle = '#3f8fd2'; ctx.fillRect(-hr, -hr * 2, hr * 2, hr * 2);
    ctx.fillStyle = '#8a5a2e'; ctx.fillRect(-hr, 0, hr * 2, hr * 2);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-hr, 0); ctx.lineTo(hr, 0); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#3d5a6e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.moveTo(hx - 18, hy); ctx.lineTo(hx - 4, hy); ctx.lineTo(hx, hy - 6);
    ctx.lineTo(hx + 4, hy); ctx.lineTo(hx + 18, hy);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#cfe8f5';
    ctx.font = 'bold 11px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', hx, hy + hr * 0.45 + 14);

    // Heading compass strip.
    const hdg = headingDeg(plane);
    ctx.fillStyle = '#101c26';
    ctx.fillRect(430, H - 96, 300, 76);
    ctx.strokeStyle = '#3d5a6e';
    ctx.strokeRect(430, H - 96, 300, 76);
    ctx.save();
    ctx.beginPath(); ctx.rect(430, H - 96, 300, 76); ctx.clip();
    const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    // Anchor the tick grid to absolute degrees so the cardinal labels always land.
    const startDeg = Math.ceil((hdg - 60) / 15) * 15;
    for (let d = startDeg; d <= hdg + 60; d += 15) {
      const dd = ((d % 360) + 360) % 360;
      const x = 580 + (d - hdg) * 2.4;
      ctx.strokeStyle = '#9fc6dd';
      ctx.beginPath(); ctx.moveTo(x, H - 78); ctx.lineTo(x, H - 66); ctx.stroke();
      if (dd % 45 === 0) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px Verdana, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(names[Math.round(dd / 45) % 8], x, H - 52);
      }
    }
    ctx.restore();
    ctx.fillStyle = '#ffc93c';
    ctx.beginPath();
    ctx.moveTo(580, H - 96); ctx.lineTo(574, H - 108); ctx.lineTo(586, H - 108);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#cfe8f5';
    ctx.font = 'bold 12px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`HDG ${String(hdg).padStart(3, '0')}°`, 580, H - 30);

    // Fuel and throttle bars, stacked so neither covers the other.
    const bar = (y, label, frac, colour) => {
      ctx.fillStyle = '#0a121a';
      ctx.fillRect(790, y, 150, 14);
      ctx.fillStyle = frac < 0.2 ? '#ff5a3c' : colour;
      ctx.fillRect(790, y, 150 * Math.min(1, Math.max(0, frac)), 14);
      ctx.strokeStyle = '#3d5a6e';
      ctx.strokeRect(790, y, 150, 14);
      ctx.fillStyle = '#cfe8f5';
      ctx.font = 'bold 12px Verdana, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, 950, y + 12);
    };
    bar(H - 96, `FUEL ${Math.round(plane.fuel)}%`, plane.fuel / 100, '#4ecb71');
    bar(H - 66, `THR ${Math.round(plane.throttle * 100)}%`, plane.throttle, '#4ea8e8');
    ctx.fillStyle = '#cfe8f5';
    ctx.font = '12px Verdana, sans-serif';
    ctx.fillText(`V/S ${plane.verticalSpeed >= 0 ? '+' : ''}${Math.round(plane.verticalSpeed * 196)} ft/min`, 790, H - 30);

    // Stall warning light.
    if (plane.stalled && plane.airborne) {
      ctx.save();
      ctx.shadowColor = '#ff3b30';
      ctx.shadowBlur = 18;
      ctx.fillStyle = Math.sin(game.time * 8) > 0 ? '#ff3b30' : '#7a1d16';
      ctx.beginPath(); ctx.arc(1130, H - 58, 16, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffb3ad';
      ctx.font = 'bold 12px Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('STALL', 1130, H - 30);
    }
  }

  // --- HUD ------------------------------------------------------------------
  function drawHud(game) {
    const plane = game.plane;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(6,16,26,0.55)';
    ctx.fillRect(14, 12, 250, 108);
    ctx.strokeStyle = 'rgba(160,210,240,0.5)';
    ctx.strokeRect(14, 12, 250, 108);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px Verdana, sans-serif';
    ctx.fillText(`ALT ${altitudeFt(plane)} ft`, 26, 44);
    ctx.fillText(`SPD ${Math.round(plane.speed)} kt`, 26, 74);
    ctx.fillText(`HDG ${String(headingDeg(plane)).padStart(3, '0')}°`, 26, 104);

    // Right block: score, rings, mission.
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(6,16,26,0.55)';
    ctx.fillRect(W - 264, 12, 250, 108);
    ctx.strokeStyle = 'rgba(160,210,240,0.5)';
    ctx.strokeRect(W - 264, 12, 250, 108);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 22px Verdana, sans-serif';
    ctx.fillText(`SCORE ${game.score}`, W - 26, 44);
    const done = game.rings.filter((r) => r.passed).length;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Verdana, sans-serif';
    ctx.fillText(`RINGS ${done}/${game.rings.length}`, W - 26, 74);
    ctx.font = '13px Verdana, sans-serif';
    ctx.fillStyle = '#cfe8f5';
    ctx.fillText(game.mission.name, W - 26, 100);

    // Centre messages.
    if (game.message) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 30px Verdana, sans-serif';
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = game.messageColour || '#ffe9a8';
      ctx.fillText(game.message, W / 2, 168);
      ctx.restore();
      if (game.messageSub) {
        ctx.font = '16px Verdana, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(game.messageSub, W / 2, 196);
      }
    }

    // Flight-path marker, only while actually flying.
    if (game.state === 'flying' || game.state === 'paused') {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.42, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(W / 2 - 20, H * 0.42); ctx.lineTo(W / 2 - 8, H * 0.42);
      ctx.moveTo(W / 2 + 8, H * 0.42); ctx.lineTo(W / 2 + 20, H * 0.42);
      ctx.moveTo(W / 2, H * 0.42 - 20); ctx.lineTo(W / 2, H * 0.42 - 8);
      ctx.stroke();
    }
  }

  // --- screens --------------------------------------------------------------
  function overlay(title, lines, accent, alpha) {
    ctx.fillStyle = `rgba(4,12,20,${alpha === undefined ? 0.62 : alpha})`;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = accent || '#ffe9a8';
    ctx.font = 'bold 52px Verdana, sans-serif';
    ctx.fillText(title, W / 2, 210);
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = '18px Verdana, sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, W / 2, 268 + i * 30));
  }

  function drawTitle(game) {
    overlay('SKYLINE COURIER', [
      'A bush pilot’s day over the valley — rings, river, runway.',
      '',
      'Fly with the mouse or arrow keys · Shift / Ctrl or wheel: throttle',
      'Space: brake · P: pause · M: mute',
      '',
      `Best score: ${game.bestScore}`,
      '',
      'Press ENTER or click to fly',
    ], '#ffe9a8', 0.45);
  }

  function drawBriefing(game) {
    overlay(game.mission.name, [
      game.mission.brief,
      '',
      `Rings: ${game.mission.rings} · Fuel bonus per ring: +${6}%`,
      game.mission.wind ? `Crosswind: ${game.mission.wind} kt from the west` : 'Calm air over the valley.',
      '',
      'Take off from Runway 36, thread the rings, land back on the numbers.',
      '',
      'Press ENTER or click to take off',
    ], '#9fd4e8');
  }

  // --- main render ----------------------------------------------------------
  const renderState = { clouds: [], town: [] };

  function render(game) {
    const plane = game.plane;
    const palette = game.mission.dusk ? SKY.dusk : SKY.day;
    const cam = makeCamera(plane);
    renderState.clouds = game.clouds;
    renderState.town = game.town;

    drawSky(cam, palette, game.time);
    drawTerrain(cam, palette);
    drawRunwayMarkings(cam, palette);
    drawTown(cam, palette);
    if (game.state === 'flying' || game.state === 'paused') {
      drawRings(cam, game, palette);
    }
    drawPlane(plane, game.time);
    drawCockpit(game);
    drawHud(game);

    if (game.state === 'title') drawTitle(game);
    else if (game.state === 'briefing') drawBriefing(game);
    else if (game.state === 'paused') {
      overlay('PAUSED', ['Press P or click to keep flying'], '#cfe8f5');
    } else if (game.state === 'missionComplete') {
      overlay('MISSION COMPLETE', [
        game.missionCompleteText || '',
        `Mission score: ${game.missionScore} · Total: ${game.score}`,
        '',
        game.missionIndex + 1 < 3 ? 'Press ENTER for the next mission' : 'Press ENTER for the final tally',
      ], '#8fe388');
    } else if (game.state === 'crashed') {
      overlay('CRASHED', [
        plane.crashReason,
        `Score: ${game.score} · Best: ${game.bestScore}`,
        '',
        'Press R or click to fly again',
      ], '#ff8a7a');
    } else if (game.state === 'landedEarly') {
      overlay('WHEELS DOWN — TOO SOON', [
        'You landed before threading every ring.',
        `Rings flown: ${game.rings.filter((r) => r.passed).length}/${game.rings.length}`,
        '',
        'Press R or click to retry the mission',
      ], '#ffc93c');
    } else if (game.state === 'victory') {
      overlay('ALL MISSIONS COMPLETE', [
        'Three sorties, one valley, home safe every time.',
        `Final score: ${game.score} · Best: ${game.bestScore}`,
        '',
        'Press R or click to fly the valley again',
      ], '#8fe388');
    }
  }

  return { render };
}
