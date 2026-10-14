// Draws a 1080x1920 story-sized summary image and downloads or shares it.
import { num, compact, pct, duration, dayLabel, monthLabel, hourRange, firstName } from "./format.js";

const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Vazirmatn, Tahoma, sans-serif`;
const SERIES = ["#3987e5", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#9085e9", "#e34948"];

function fit(ctx, text, maxWidth, size, weight = 800) {
  let s = size;
  do ctx.font = `${weight} ${s}px ${FONT}`;
  while (ctx.measureText(text).width > maxWidth && (s -= 2) > 18);
  return s;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawCard(r) {
  const W = 1080, H = 1920, M = 80;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const P = r.people;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#2a1b6b");
  bg.addColorStop(0.55, "#8a1f6f");
  bg.addColorStop(1, "#e2583e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // soft blobs
  for (const [x, y, rad, c] of [[900, 260, 360, "rgba(255,200,80,.18)"], [120, 1500, 420, "rgba(80,160,255,.18)"]]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, c);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 34px ${FONT}`;
  ctx.globalAlpha = 0.8;
  ctx.fillText("CHAT WRAPPED", M, 150);
  ctx.globalAlpha = 1;

  const title = P.slice(0, 2).map((p) => firstName(p.name)).join(" & ") + (P.length > 2 ? " & co." : "");
  fit(ctx, title, W - 2 * M, 104);
  ctx.fillText(title, M, 270);
  ctx.font = `500 36px ${FONT}`;
  ctx.globalAlpha = 0.85;
  ctx.fillText(`${dayLabel(r.totals.firstDay)} – ${dayLabel(r.totals.lastDay)}`, M, 330);
  ctx.globalAlpha = 1;

  // who talks more bar
  const total = P.reduce((a, p) => a + p.messages, 0);
  let x = M;
  const barW = W - 2 * M;
  P.forEach((p, s) => {
    const w = (p.messages / total) * barW;
    ctx.fillStyle = SERIES[s];
    roundRect(ctx, x, 380, Math.max(0, w - 4), 28, 14);
    ctx.fill();
    x += w;
  });
  ctx.font = `600 30px ${FONT}`;
  ctx.fillStyle = "#fff";
  let lx = M;
  P.slice(0, 3).forEach((p, s) => {
    const label = `${firstName(p.name)} ${pct(p.share)}`;
    ctx.fillStyle = SERIES[s];
    ctx.beginPath();
    ctx.arc(lx + 10, 452, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(label, lx + 30, 462);
    lx += ctx.measureText(label).width + 70;
  });

  // stat tiles
  const topEmoji = r.content.topEmojis[0]?.emoji || "💬";
  const tiles = [
    ["Messages", compact(r.totals.messages)],
    ["Days talked", num(r.totals.activeDays)],
    ["Longest streak", `${num(r.time.streak.length)} days`],
    ["Top emoji", topEmoji],
    ["Favorite hour", hourRange(r.time.peakHour)],
    r.calls.total ? ["On the phone", duration(r.calls.seconds * 1000, { parts: 1 })] : ["Words", compact(r.totals.words)],
  ];
  const tw = (W - 2 * M - 30) / 2, th = 190;
  tiles.forEach(([label, value], k) => {
    const tx = M + (k % 2) * (tw + 30), ty = 530 + Math.floor(k / 2) * (th + 30);
    ctx.fillStyle = "rgba(255,255,255,.12)";
    roundRect(ctx, tx, ty, tw, th, 28);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.font = `600 30px ${FONT}`;
    ctx.fillText(label, tx + 34, ty + 60);
    ctx.fillStyle = "#fff";
    fit(ctx, value, tw - 68, 72);
    ctx.fillText(value, tx + 34, ty + 150);
  });

  // top words + golden era
  let y = 530 + 3 * (th + 30) + 40;
  ctx.fillStyle = "rgba(255,255,255,.75)";
  ctx.font = `600 30px ${FONT}`;
  ctx.fillText("Top words", M, y);
  ctx.fillText("Golden era", M + tw + 30, y);
  ctx.fillStyle = "#fff";
  ctx.font = `700 44px ${FONT}`;
  r.content.topWords.slice(0, 5).forEach((w, k) => {
    const t = `${k + 1}  ${w.word}`;
    fit(ctx, t, tw - 10, 44, 700);
    ctx.fillText(t, M, y + 66 + k * 62);
  });
  fit(ctx, monthLabel(r.time.goldenMonth.ym), tw, 48);
  ctx.fillText(monthLabel(r.time.goldenMonth.ym), M + tw + 30, y + 66);
  ctx.font = `500 32px ${FONT}`;
  ctx.globalAlpha = 0.85;
  ctx.fillText(`${num(r.time.goldenMonth.count)} messages`, M + tw + 30, y + 114);
  ctx.globalAlpha = 1;

  // personalities
  y += 66 + 5 * 62 + 50;
  P.slice(0, 2).forEach((p, s) => {
    const aw = r.personalities[s]?.[0];
    if (!aw) return;
    const tx = M + s * (tw + 30);
    ctx.fillStyle = "rgba(255,255,255,.12)";
    roundRect(ctx, tx, y, tw, 170, 28);
    ctx.fill();
    ctx.fillStyle = SERIES[s];
    ctx.fillRect(tx + 34, y + 34, 40, 8);
    ctx.fillStyle = "rgba(255,255,255,.8)";
    ctx.font = `600 30px ${FONT}`;
    ctx.fillText(firstName(p.name), tx + 86, y + 46);
    ctx.fillStyle = "#fff";
    const t = `${aw.emoji} ${aw.title.replace(/^The /, "")}`;
    fit(ctx, t, tw - 68, 46);
    ctx.fillText(t, tx + 34, y + 120);
  });

  ctx.font = `500 28px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,.7)";
  ctx.textAlign = "center";
  ctx.fillText("Made with Chat Wrapped · runs 100% in your browser", W / 2, H - 70);
  return canvas;
}

export async function downloadCard(r) {
  const canvas = drawCard(r);
  const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
  const file = new File([blob], "chat-wrapped.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] }) && matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ files: [file], title: "Chat Wrapped" });
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "chat-wrapped.png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
