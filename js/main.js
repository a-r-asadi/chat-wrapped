import { renderDashboard } from "./dashboard.js";
import { playStory } from "./story.js";
import { downloadCard } from "./card.js";
import { downloadStorySheet } from "./snapshot.js";
import { esc, num, dayLabel } from "./format.js";
import { renderRelationship, defaultRelState } from "./relationship.js";

const $ = (s) => document.querySelector(s);
const views = ["landing", "loading", "picker", "results"];
let result = null;
let relState = defaultRelState();
const narrowMQ = matchMedia("(max-width: 759px)");
narrowMQ.addEventListener("change", () => {
  if (result) $("#dashboard").innerHTML = renderDashboard(result, { narrow: narrowMQ.matches, rel: relState });
});
let worker = null;

function show(view) {
  for (const v of views) $(`#${v}`).hidden = v !== view;
  window.scrollTo(0, 0);
}

function setError(message) {
  show("landing");
  const el = $("#error");
  el.textContent = message;
  el.hidden = !message;
}

// ---------- engine: a module worker, with an inline fallback ----------

function handle(msg) {
  if (msg.type === "progress") $("#loading-text").textContent = msg.text;
  else if (msg.type === "error") setError(msg.message);
  else if (msg.type === "chats") showPicker(msg.chats);
  else if (msg.type === "result") showResult(msg.result);
}

async function inlineEngine() {
  const [{ listChats, chatSummary, normalizeChat }, { analyze }] = await Promise.all([import("./parser.js"), import("./analyze.js")]);
  let chats = null, selfId = null;
  const run = (i) => handle({ type: "result", result: analyze(normalizeChat(chats[i], selfId)) });
  return {
    async postMessage(msg) {
      try {
        let data = msg.data;
        if (msg.type === "file") data = JSON.parse(await msg.file.text());
        if (msg.type === "pick") return run(msg.index);
        chats = listChats(data);
        selfId = data?.personal_information?.user_id ?? null;
        chats.length === 1 ? run(0) : handle({ type: "chats", chats: chats.map(chatSummary) });
      } catch (e) {
        handle({ type: "error", message: e.message });
      }
    },
  };
}

async function engine() {
  if (worker) return worker;
  try {
    const w = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    w.onmessage = (e) => handle(e.data);
    w.onerror = async (e) => {
      e.preventDefault?.();
      worker = await inlineEngine();
      setError("Something went wrong in the background worker. Please try again.");
    };
    worker = w;
  } catch {
    worker = await inlineEngine();
  }
  return worker;
}

async function send(msg) {
  $("#error").hidden = true;
  show("loading");
  $("#loading-text").textContent = "Getting started…";
  (await engine()).postMessage(msg);
}

// ---------- views ----------

function showPicker(chats) {
  const sorted = [...chats].sort((a, b) => (b.type === "personal_chat") - (a.type === "personal_chat") || b.count - a.count);
  const label = { personal_chat: "Personal", private_group: "Group", private_supergroup: "Group", public_supergroup: "Group", saved_messages: "Saved", bot_chat: "Bot", private_channel: "Channel", public_channel: "Channel" };
  $("#chat-filter").value = "";
  $("#chat-list").innerHTML = sorted
    .map((c) => `<li><button class="chat-item" data-index="${c.index}" data-name="${esc(c.name.toLowerCase())}"><span class="chat-avatar">${esc([...c.name][0] || "?")}</span><span class="chat-name" dir="auto">${esc(c.name)}</span><span class="chat-meta">${label[c.type] || c.type} · ${num(c.count)} msgs</span></button></li>`)
    .join("");
  show("picker");
}

function showResult(r) {
  result = r;
  const P = r.people;
  const you = P.find((p) => p.isYou);
  $("#result-title").textContent = P.length !== 2 ? r.chat.name : you ? `You & ${P.find((p) => p !== you).name}` : `${P[0].name} & ${P[1].name}`;
  $("#result-sub").textContent = `${dayLabel(r.totals.firstDay)} – ${dayLabel(r.totals.lastDay)} · ${num(r.totals.messages)} messages`;
  relState = loadRelState(r);
  $("#dashboard").innerHTML = renderDashboard(r, { narrow: narrowMQ.matches, rel: relState });
  show("results");
  playStory(r, { onAction });
}

function onAction(action) {
  if (action === "card") downloadCard(result);
  else if (action === "jpg") busy("jpg", "Rendering…", () => downloadStorySheet(result));
  else if (action === "pdf") savePdf();
  else if (action === "story") playStory(result, { onAction });
}

// Disables every button for `action` while `fn` runs.
async function busy(action, label, fn) {
  const buttons = [...document.querySelectorAll(`[data-action="${action}"]`)];
  if (buttons.some((b) => b.disabled)) return;
  const labels = buttons.map((b) => b.textContent);
  buttons.forEach((b) => ((b.disabled = true), (b.textContent = label)));
  try {
    await fn();
  } catch (e) {
    alert(e.message || "Something went wrong while creating the image.");
  } finally {
    buttons.forEach((b, i) => ((b.disabled = false), (b.textContent = labels[i])));
  }
}

// Opens the browser's print dialog, where "Save as PDF" downloads the page (see @media print).
function savePdf() {
  const closed = [...document.querySelectorAll("#dashboard details:not([open])")];
  closed.forEach((d) => (d.open = true));
  const title = document.title;
  document.title = `Chat Wrapped – ${$("#result-title").textContent}`;
  addEventListener("afterprint", () => {
    closed.forEach((d) => (d.open = false));
    document.title = title;
  }, { once: true });
  print();
}

// ---------- events ----------

const input = $("#file-input");
input.addEventListener("change", () => input.files[0] && send({ type: "file", file: input.files[0] }));

const drop = $("#drop");
for (const ev of ["dragenter", "dragover"]) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); });
for (const ev of ["dragleave", "drop"]) drop.addEventListener(ev, () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) send({ type: "file", file });
});

$("#demo").addEventListener("click", async () => {
  show("loading");
  $("#loading-text").textContent = "Inventing a friendship…";
  const { makeDemoExport } = await import("./demo.js");
  send({ type: "json", data: makeDemoExport({ seed: Math.floor(Math.random() * 1e6) }) });
});

$("#chat-list").addEventListener("click", (e) => {
  const b = e.target.closest(".chat-item");
  if (b) send({ type: "pick", index: +b.dataset.index });
});
$("#chat-filter").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  for (const b of document.querySelectorAll(".chat-item")) b.parentElement.hidden = q && !b.dataset.name.includes(q);
});
$("#picker-back").addEventListener("click", () => show("landing"));

document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-action]");
  if (!a || a.closest(".story")) return;
  if (a.dataset.action === "reset") {
    input.value = "";
    result = null;
    show("landing");
  } else onAction(a.dataset.action);
});

// ---------- "Fights & what changed" controls ----------

// Sensitivity and "not a fight" choices are remembered per chat in this browser only.
const relKey = (r) => `cw-rel:${r.chat.name}:${r.totals.start}`;
function loadRelState(r) {
  const st = defaultRelState();
  try {
    const saved = JSON.parse(localStorage.getItem(relKey(r)) || "null");
    if (saved) {
      st.sensitivity = saved.sensitivity || st.sensitivity;
      st.dismissed = new Set(saved.dismissed || []);
    }
  } catch {}
  return st;
}
function saveRelState() {
  try {
    localStorage.setItem(relKey(result), JSON.stringify({ sensitivity: relState.sensitivity, dismissed: [...relState.dismissed] }));
  } catch {}
}
function renderRel() {
  const grid = $("#relationship .grid");
  if (grid) grid.innerHTML = renderRelationship(result, relState, { narrow: narrowMQ.matches });
}

$("#dashboard").addEventListener("click", (e) => {
  const dismiss = e.target.closest("[data-rel-dismiss]");
  const action = e.target.closest("[data-rel]")?.dataset.rel;
  if (dismiss) {
    relState.dismissed.add(+dismiss.dataset.relDismiss);
    saveRelState();
  } else if (action === "reveal" || action === "hide") {
    relState.revealed = action === "reveal";
    if (!relState.revealed) $("#relationship").scrollIntoView();
  } else if (action === "restore") {
    relState.dismissed.clear();
    saveRelState();
  } else if (action === "end-reset") {
    relState.end = null;
  } else return;
  renderRel();
});
$("#dashboard").addEventListener("change", (e) => {
  if (e.target.id === "rel-sens") {
    relState.sensitivity = e.target.value;
    saveRelState();
  } else if (e.target.id === "rel-end") {
    relState.end = e.target.value || null;
  } else return;
  renderRel();
});

// Shared tooltip for every [data-tip] element.
const tipEl = $("#tip");
let tipTarget = null;
document.addEventListener("pointerover", (e) => {
  const t = e.target.closest?.("[data-tip]");
  tipTarget = t;
  if (!t) return (tipEl.hidden = true);
  tipEl.textContent = t.dataset.tip;
  tipEl.hidden = false;
});
document.addEventListener("pointermove", (e) => {
  if (!tipTarget || tipEl.hidden) return;
  const pad = 14, w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  let x = e.clientX + pad, y = e.clientY + pad;
  if (x + w > innerWidth - 8) x = e.clientX - w - pad;
  if (y + h > innerHeight - 8) y = e.clientY - h - pad;
  tipEl.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
});
document.addEventListener("scroll", () => (tipEl.hidden = true), { passive: true });

// Theme toggle (remembered per browser).
const themeBtn = $("#theme");
const applyTheme = (t) => {
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  const dark = t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  themeBtn.textContent = dark ? "☀️" : "🌙";
  themeBtn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
};
let saved = null;
try { saved = localStorage.getItem("theme"); } catch {}
applyTheme(saved);
themeBtn.addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  const next = dark ? "light" : "dark";
  applyTheme(next);
  try { localStorage.setItem("theme", next); } catch {}
});
