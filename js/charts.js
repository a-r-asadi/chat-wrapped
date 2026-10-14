// Hand-rolled SVG/HTML charts. Each function returns an HTML string; hover tooltips use data-tip.
import { esc, num, compact, pct } from "./format.js";

export const color = (i) => `var(--s${i + 1})`;
const tip = (text) => `data-tip="${esc(text)}"`;
const sum = (a) => a.reduce((x, y) => x + y, 0);

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

const roundedTop = (x, y, w, h, r) => {
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
};

export function legend(people) {
  if (people.length < 2) return "";
  return `<div class="legend">${people
    .map((p, i) => `<span class="legend-item"><i class="swatch" style="background:${color(i)}"></i>${esc(p.name)}</span>`)
    .join("")}</div>`;
}

// One horizontal bar split between people, with labels underneath.
export function splitBar(values, people, fmt = num) {
  const total = sum(values) || 1;
  const segs = values
    .map((v, i) => (v > 0 ? `<div class="seg" style="flex:${v};background:${color(i)}" ${tip(`${people[i].name}: ${fmt(v)} (${pct(v / total)})`)}></div>` : ""))
    .join("");
  const labels = values
    .map((v, i) => `<div class="split-label"><i class="swatch" style="background:${color(i)}"></i><span>${esc(people[i].name)}</span><b>${fmt(v)}</b><small>${pct(v / total)}</small></div>`)
    .join("");
  return `<div class="split"><div class="split-bar">${segs}</div><div class="split-labels">${labels}</div></div>`;
}

// Hour x weekday grid.
export function heatmap(heat, { weekdays, hourLabel, unit = "messages" }) {
  const cell = 22, gap = 3, left = 36, bottom = 20;
  const W = left + 24 * (cell + gap), H = 7 * (cell + gap) + bottom;
  const max = Math.max(1, ...heat.flat());
  let out = "";
  heat.forEach((row, d) => {
    out += `<text x="${left - 8}" y="${d * (cell + gap) + cell / 2 + 4}" text-anchor="end" class="axis">${weekdays[d]}</text>`;
    row.forEach((v, h) => {
      const q = v ? Math.min(6, 1 + Math.floor(Math.sqrt(v / max) * 6)) : 0;
      out += `<rect x="${left + h * (cell + gap)}" y="${d * (cell + gap)}" width="${cell}" height="${cell}" rx="4" fill="var(--q${q})" ${tip(`${weekdays[d]} ${hourLabel(h)}: ${num(v)} ${unit}`)}/>`;
    });
  });
  for (let h = 0; h < 24; h += 3) {
    out += `<text x="${left + h * (cell + gap) + cell / 2}" y="${H - 4}" text-anchor="middle" class="axis">${hourLabel(h)}</text>`;
  }
  return `<div class="scroll-x"><svg class="chart heat" viewBox="0 0 ${W} ${H}" role="img" aria-label="Activity by weekday and hour">${out}</svg></div>${scaleKey()}`;
}

const scaleKey = (lo = "Less", hi = "More") =>
  `<div class="scale-key"><span>${lo}</span>${[0, 1, 2, 3, 4, 5, 6].map((q) => `<i style="background:var(--q${q})"></i>`).join("")}<span>${hi}</span></div>`;

// Stacked columns, one segment per person.
export function stackedBars(columns, people, { height = 240, labelEvery, width = 800, colors } = {}) {
  const col = (s) => colors?.[s] ?? color(s);
  const W = width, H = height, left = 44, right = 8, top = 10, bottom = 26;
  const pw = W - left - right, ph = H - top - bottom;
  const n = columns.length;
  const max = niceMax(Math.max(1, ...columns.map((c) => sum(c.values))));
  const slot = pw / n;
  const bw = Math.max(1, slot - Math.min(6, slot * 0.25));
  let grid = "", bars = "", labels = "", hits = "";
  for (let g = 0; g <= 4; g++) {
    const y = top + ph - (g / 4) * ph;
    grid += `<line x1="${left}" x2="${W - right}" y1="${y}" y2="${y}" class="grid${g === 0 ? " base" : ""}"/><text x="${left - 6}" y="${y + 4}" text-anchor="end" class="axis">${compact((g / 4) * max)}</text>`;
  }
  const every = labelEvery || Math.max(1, Math.ceil(n / 8));
  columns.forEach((c, i) => {
    const x = left + i * slot + (slot - bw) / 2;
    let y = top + ph;
    const stackTop = c.values.reduce((acc, v, s) => (v > 0 ? s : acc), -1);
    c.values.forEach((v, s) => {
      if (!v) return;
      const h = (v / max) * ph;
      const gapPx = s === stackTop ? 0 : Math.min(2, h / 3);
      y -= h;
      bars += s === stackTop
        ? `<path d="${roundedTop(x, y, bw, h, 3)}" fill="${col(s)}"/>`
        : `<rect x="${x}" y="${y + gapPx}" width="${bw}" height="${Math.max(0, h - gapPx)}" fill="${col(s)}"/>`;
    });
    if (i % every === 0) labels += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle" class="axis">${esc(c.label)}</text>`;
    const tipText = [c.tip || c.label, ...c.values.map((v, s) => `${people[s].name}: ${num(v)}`), people.length > 1 ? `Total: ${num(sum(c.values))}` : ""].filter(Boolean).join("\n");
    hits += `<rect x="${left + i * slot}" y="${top}" width="${slot}" height="${ph}" class="hit" ${tip(tipText)}/>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${grid}${bars}${labels}${hits}</svg>`;
}

// Columns grouped by category, one bar per person.
export function groupedBars(categories, series, people, { height = 220, fmt = num, width = 800, colors } = {}) {
  const col = (s) => colors?.[s] ?? color(s);
  const W = width, H = height, left = 44, right = 8, top = 10, bottom = 26;
  const pw = W - left - right, ph = H - top - bottom;
  const max = niceMax(Math.max(1, ...series.flat()));
  const slot = pw / categories.length;
  const groupW = slot * 0.72;
  const bw = groupW / series.length;
  let grid = "", bars = "", labels = "", hits = "";
  for (let g = 0; g <= 4; g++) {
    const y = top + ph - (g / 4) * ph;
    grid += `<line x1="${left}" x2="${W - right}" y1="${y}" y2="${y}" class="grid${g === 0 ? " base" : ""}"/><text x="${left - 6}" y="${y + 4}" text-anchor="end" class="axis">${fmt === num ? compact((g / 4) * max) : fmt((g / 4) * max)}</text>`;
  }
  categories.forEach((cat, ci) => {
    const gx = left + ci * slot + (slot - groupW) / 2;
    series.forEach((vals, s) => {
      const v = vals[ci];
      if (!v) return;
      const h = (v / max) * ph;
      bars += `<path d="${roundedTop(gx + s * bw + 1, top + ph - h, bw - 2, h, 3)}" fill="${col(s)}"/>`;
    });
    labels += `<text x="${left + ci * slot + slot / 2}" y="${H - 6}" text-anchor="middle" class="axis">${esc(cat)}</text>`;
    hits += `<rect x="${left + ci * slot}" y="${top}" width="${slot}" height="${ph}" class="hit" ${tip([cat, ...series.map((v, s) => `${people[s].name}: ${fmt(v[ci])}`)].join("\n"))}/>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${grid}${bars}${labels}${hits}</svg>`;
}

// Lines, one per person; null values break the line.
export function lineChart(xLabels, series, people, { height = 220, yMin = 0, yMax, fmt = num, labelEvery, zero = false, tipLabels, width = 800, colors, marks = [] } = {}) {
  const col = (s) => colors?.[s] ?? color(s);
  const W = width, H = height, left = 44, right = 10, top = 12, bottom = 26;
  const pw = W - left - right, ph = H - top - bottom;
  const n = xLabels.length;
  const flat = series.flat().filter((v) => v != null);
  const hi = yMax ?? niceMax(Math.max(1, ...flat));
  const x = (i) => left + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
  const y = (v) => top + ph - ((v - yMin) / (hi - yMin)) * ph;
  let grid = "", lines = "", labels = "", hits = "";
  for (let g = 0; g <= 4; g++) {
    const v = yMin + (g / 4) * (hi - yMin);
    grid += `<line x1="${left}" x2="${W - right}" y1="${y(v)}" y2="${y(v)}" class="grid${(zero ? Math.abs(v) < 1e-9 : g === 0) ? " base" : ""}"/><text x="${left - 6}" y="${y(v) + 4}" text-anchor="end" class="axis">${fmt === num ? compact(v) : fmt(v)}</text>`;
  }
  for (const i of marks) {
    lines += `<line x1="${x(i)}" x2="${x(i)}" y1="${top}" y2="${top + ph}" class="mark"/>`;
  }
  series.forEach((vals, s) => {
    let d = "", pen = false;
    vals.forEach((v, i) => {
      if (v == null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    lines += `<path d="${d}" fill="none" stroke="${col(s)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  });
  const every = labelEvery || Math.max(1, Math.ceil(n / 8));
  xLabels.forEach((l, i) => {
    if (i % every === 0) labels += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" class="axis">${esc(l)}</text>`;
    const w = n === 1 ? pw : pw / (n - 1);
    hits += `<g class="hover-col"><line x1="${x(i)}" x2="${x(i)}" y1="${top}" y2="${top + ph}" class="crosshair"/>${series
      .map((vals, s) => (vals[i] == null ? "" : `<circle cx="${x(i)}" cy="${y(vals[i])}" r="4" fill="${col(s)}" class="dot"/>`))
      .join("")}<rect x="${x(i) - w / 2}" y="${top}" width="${w}" height="${ph}" class="hit" ${tip(
      [(tipLabels || xLabels)[i], ...series.map((vals, s) => `${people[s].name}: ${vals[i] == null ? "–" : fmt(vals[i])}`)].join("\n"),
    )}/></g>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${grid}${lines}${labels}${hits}</svg>`;
}

// GitHub-style calendar, one block per year.
export function calendar(daily, { dayLabel }) {
  const counts = new Map(daily);
  const nonzero = daily.map(([, c]) => c).sort((a, b) => a - b);
  const qs = [0.2, 0.4, 0.6, 0.8, 0.95].map((p) => nonzero[Math.floor(p * (nonzero.length - 1))] ?? 1);
  const level = (c) => (c ? 1 + qs.filter((t) => c > t).length : 0);
  const years = [...new Set(daily.map(([d]) => d.slice(0, 4)))];
  const cell = 11, gap = 2, left = 28, top = 16;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const blocks = years.map((y) => {
    const jan1 = new Date(Date.UTC(+y, 0, 1));
    const offset = (jan1.getUTCDay() + 6) % 7;
    let rects = "", months = "";
    for (let d = new Date(jan1); d.getUTCFullYear() === +y; d.setUTCDate(d.getUTCDate() + 1)) {
      const doy = Math.round((d - jan1) / 864e5);
      const col = Math.floor((doy + offset) / 7), row = (doy + offset) % 7;
      const key = d.toISOString().slice(0, 10);
      const c = counts.get(key) || 0;
      rects += `<rect x="${left + col * (cell + gap)}" y="${top + row * (cell + gap)}" width="${cell}" height="${cell}" rx="2.5" fill="var(--q${level(c)})" ${tip(`${dayLabel(key)}: ${num(c)} messages`)}/>`;
      if (d.getUTCDate() === 1) months += `<text x="${left + col * (cell + gap)}" y="${top - 5}" class="axis">${MONTHS[d.getUTCMonth()]}</text>`;
    }
    const days = ["Mon", "", "Wed", "", "Fri", "", ""].map((l, r) => (l ? `<text x="${left - 6}" y="${top + r * (cell + gap) + 9}" text-anchor="end" class="axis">${l}</text>` : "")).join("");
    const W = left + 54 * (cell + gap), H = top + 7 * (cell + gap);
    return `<div class="cal-year"><div class="cal-title">${y}</div><div class="scroll-x"><svg class="chart cal" viewBox="0 0 ${W} ${H}" style="min-width:${W}px">${months}${days}${rects}</svg></div></div>`;
  });
  return blocks.reverse().join("") + scaleKey();
}

// Ranked horizontal bars, each bar split by person.
export function hbars(rows, people, { fmt = num } = {}) {
  const max = Math.max(1, ...rows.map((r) => sum(r.per)));
  return `<div class="hbars">${rows
    .map(
      (r) => `<div class="hbar-row" ${tip([r.label, ...r.per.map((v, s) => `${people[s].name}: ${fmt(v)}`)].join("\n"))}>
        <div class="hbar-label">${r.icon ? `<span class="hbar-icon">${r.icon}</span>` : ""}<span dir="auto">${esc(r.label)}</span></div>
        <div class="hbar-track"><div class="hbar-fill" style="width:${(sum(r.per) / max) * 100}%">${r.per
          .map((v, s) => (v ? `<div style="flex:${v};background:${color(s)}"></div>` : ""))
          .join("")}</div></div>
        <div class="hbar-value">${fmt(sum(r.per))}</div>
      </div>`,
    )
    .join("")}</div>`;
}

// Word cloud: size by count, colored by whoever says it most.
export function wordCloud(words, people) {
  if (!words.length) return `<p class="muted">Not enough words yet.</p>`;
  const max = words[0].count, min = words[words.length - 1].count;
  let seed = 3;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const shuffled = words.map((w) => [rnd(), w]).sort((a, b) => a[0] - b[0]).map(([, w]) => w);
  return `<div class="cloud">${shuffled
    .map((w) => {
      const t = max === min ? 1 : (Math.sqrt(w.count) - Math.sqrt(min)) / (Math.sqrt(max) - Math.sqrt(min));
      const size = 0.85 + t * 2.1;
      const tot = sum(w.per);
      const lead = w.per.indexOf(Math.max(...w.per));
      const c = people.length > 1 && w.per[lead] / tot >= 0.62 ? color(lead) : "var(--text)";
      return `<span dir="auto" style="font-size:${size.toFixed(2)}rem;color:${c};font-weight:${t > 0.5 ? 800 : 600}" ${tip(
        [`“${w.word}” · ${num(tot)}×`, ...w.per.map((v, s) => `${people[s].name}: ${num(v)}`)].join("\n"),
      )}>${esc(w.word)}</span>`;
    })
    .join("")}</div>`;
}
