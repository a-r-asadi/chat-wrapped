// Small formatting helpers shared by the dashboard, story and share card.

const nf = new Intl.NumberFormat("en-US");
const cf = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export const num = (n) => nf.format(Math.round(n ?? 0));
export const compact = (n) => (n < 10000 ? num(n) : cf.format(n));
export const pct = (x, digits = 0) => `${((x ?? 0) * 100).toFixed(digits)}%`;
export const dec = (x, digits = 1) => (x ?? 0).toFixed(digits);

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const hourLabel = (h) => (h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`);
export const hourRange = (h) => `${hourLabel(h)}–${hourLabel((h + 1) % 24)}`;

// "2024-03-05" -> "Mar 5, 2024"
export const dayLabel = (day, { long = false } = {}) => {
  if (!day) return "";
  const [y, m, d] = day.split("-").map(Number);
  return `${(long ? MONTHS_LONG : MONTHS)[m - 1]} ${d}, ${y}`;
};
// "2024-03" -> "March 2024"
export const monthLabel = (ym, { short = false } = {}) => {
  const [y, m] = ym.split("-").map(Number);
  return short ? `${MONTHS[m - 1]} ’${String(y).slice(2)}` : `${MONTHS_LONG[m - 1]} ${y}`;
};
export const tsLabel = (t) =>
  new Date(t).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

// Milliseconds -> "3 days 4 h", "12 min", "45 sec"
export function duration(ms, { parts = 2 } = {}) {
  if (ms == null) return "–";
  let s = Math.round(ms / 1000);
  if (s < 60) return `${s} sec`;
  const units = [
    ["year", 365 * 86400], ["day", 86400], ["h", 3600], ["min", 60],
  ];
  const out = [];
  for (const [name, size] of units) {
    if (s >= size && out.length < parts) {
      const n = Math.floor(s / size);
      s -= n * size;
      out.push(name === "h" || name === "min" ? `${n} ${name}` : `${n} ${name}${n === 1 ? "" : "s"}`);
    } else if (out.length) break;
  }
  return out.join(" ");
}

export const KIND_LABELS = {
  photo: "📷 a photo", video: "🎬 a video", videoNote: "⏺️ a video message", voice: "🎤 a voice message",
  audio: "🎵 an audio file", sticker: "a sticker", gif: "🎞️ a GIF", file: "📎 a file", poll: "📊 a poll",
  location: "📍 a location", liveLocation: "📍 a live location", contact: "👤 a contact",
};
export const messageText = (m) => (m?.text ? m.text : m?.kind && KIND_LABELS[m.kind] ? `[${KIND_LABELS[m.kind]}]` : "[message]");

export const firstName = (name) => String(name || "").split(/\s+/)[0] || name;
