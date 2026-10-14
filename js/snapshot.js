// Renders every Wrapped story slide and lays them side by side on one JPG.
// Each slide is drawn through an SVG <foreignObject>, so it looks exactly like the on-screen story.
import { slides } from "./story.js";
import { dayLabel, firstName } from "./format.js";

const SLIDE_W = 540, SLIDE_H = 960; // CSS pixels of one slide
const SCALE = 4 / 3; // 720 x 1280 per slide in the image
const GAP = 40, PAD = 80, HEADER = 220, FOOTER = 90;
const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Vazirmatn, Tahoma, sans-serif`;

let cssText = null;
const stylesheet = async () => (cssText ??= await (await fetch(new URL("../css/style.css", import.meta.url))).text());

async function renderSlide(slide, css) {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = css;
  root.appendChild(style);
  root.insertAdjacentHTML(
    "beforeend",
    `<div class="story snapshot" data-theme="${slide.theme}"><div class="story-frame"><div class="story-slide"><div class="s-content">${slide.html}</div></div></div></div>`,
  );
  const xhtml = new XMLSerializer().serializeToString(root);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SLIDE_W}" height="${SLIDE_H}"><foreignObject x="0" y="0" width="100%" height="100%">${xhtml}</foreignObject></svg>`;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  return img;
}

export async function downloadStorySheet(r) {
  const list = slides(r);
  const css = await stylesheet();
  const images = [];
  for (const s of list) images.push(await renderSlide(s, css));

  const rows = Math.ceil(list.length / 6);
  const cols = Math.ceil(list.length / rows);
  const tw = SLIDE_W * SCALE, th = SLIDE_H * SCALE;
  const canvas = document.createElement("canvas");
  canvas.width = PAD * 2 + cols * tw + (cols - 1) * GAP;
  canvas.height = HEADER + rows * th + (rows - 1) * GAP + FOOTER + PAD;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, "#14102b");
  bg.addColorStop(1, "#2a0f24");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const P = r.people;
  const title = P.slice(0, 2).map((p) => firstName(p.name)).join(" & ") + (P.length > 2 ? " & co." : "");
  ctx.fillStyle = "#fff";
  ctx.font = `800 30px ${FONT}`;
  ctx.globalAlpha = 0.7;
  ctx.fillText("CHAT WRAPPED", PAD, PAD + 20);
  ctx.globalAlpha = 1;
  ctx.font = `900 84px ${FONT}`;
  ctx.fillText(title, PAD, PAD + 110);
  ctx.font = `500 34px ${FONT}`;
  ctx.globalAlpha = 0.75;
  ctx.textAlign = "right";
  ctx.fillText(`${dayLabel(r.totals.firstDay)} – ${dayLabel(r.totals.lastDay)}`, canvas.width - PAD, PAD + 110);
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;

  images.forEach((img, i) => {
    const x = PAD + (i % cols) * (tw + GAP);
    const y = HEADER + Math.floor(i / cols) * (th + GAP);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, tw, th, 32);
    ctx.clip();
    ctx.drawImage(img, x, y, tw, th);
    ctx.restore();
  });

  ctx.font = `500 28px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.textAlign = "center";
  ctx.fillText("Made with Chat Wrapped · runs 100% in your browser", canvas.width / 2, canvas.height - PAD / 2 - 10);

  let blob;
  try {
    blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("empty"))), "image/jpeg", 0.9));
  } catch {
    throw new Error("Your browser blocked the image export. Try Chrome, Edge or Firefox.");
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `chat-wrapped-${title.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.jpg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
