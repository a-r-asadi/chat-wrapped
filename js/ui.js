// Small HTML building blocks shared by the dashboard sections.
import { esc, num, tsLabel, messageText } from "./format.js";
import { color } from "./charts.js";

export const tiles = (...items) => {
  const list = items.filter(Boolean);
  return `<div class="stats n${list.length}">${list.join("")}</div>`;
};

export const card = (title, body, { sub = "", cls = "" } = {}) =>
  `<article class="card ${cls}"><header><h3>${title}</h3>${sub ? `<p class="sub">${sub}</p>` : ""}</header>${body}</article>`;

export const stat = (label, value, sub = "") =>
  `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value">${value}</div>${sub ? `<div class="stat-sub">${sub}</div>` : ""}</div>`;

export const who = (people, s) => `<span class="who"><i class="swatch" style="background:${color(s)}"></i>${esc(people[s]?.name)}</span>`;

export function bubble(m, people, { showName = true } = {}) {
  if (!m) return "";
  const p = people[m.from];
  const side = p?.isYou ? "right" : "left";
  return `<div class="bubble-row ${side}"><div class="bubble" style="--who:${color(m.from)}">
    ${showName ? `<div class="bubble-name">${esc(p?.name)}</div>` : ""}
    <div class="bubble-text" dir="auto">${esc(messageText(m))}</div>
    <div class="bubble-time">${tsLabel(m.t)}</div></div></div>`;
}
export const thread = (msgs, people) => `<div class="thread">${msgs.filter(Boolean).map((m) => bubble(m, people)).join("")}</div>`;

// Per-person comparison table; the leader in each row gets a badge.
export function versus(rows, people) {
  return `<div class="table-wrap"><table class="versus"><thead><tr><th></th>${people
    .map((p, s) => `<th>${who(people, s)}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map(([label, values, fmt = num, best = "max"]) => {
      const valid = values.filter((v) => v != null && !Number.isNaN(v));
      const target = valid.length > 1 && best !== "none" ? (best === "min" ? Math.min(...valid) : Math.max(...valid)) : null;
      return `<tr><th scope="row">${label}</th>${values
        .map((v) => `<td class="${target != null && v === target && valid.some((x) => x !== target) ? "lead" : ""}">${v == null ? "–" : fmt(v)}</td>`)
        .join("")}</tr>`;
    })
    .join("")}</tbody></table></div>`;
}

export function chips(items) {
  return `<div class="chips">${items.map((i) => `<span class="chip" dir="auto" ${i.tip ? `data-tip="${esc(i.tip)}"` : ""}>${i.html}</span>`).join("")}</div>`;
}
