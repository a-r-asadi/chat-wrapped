// "Fights & what changed": an opt-in section about arguments and how the chat shifted over time.
// The worker scores every exchange; everything here (thresholds, dismissals, end date) is applied in the browser.
import { esc, num, pct, dec, duration, dayLabel, monthLabel, hourLabel, WEEKDAYS, firstName } from "./format.js";
import { splitBar, stackedBars, groupedBars, lineChart } from "./charts.js";
import { tiles, card, stat, who, thread, chips } from "./ui.js";
import { TOPICS } from "./lexicons.js";

export const SENSITIVITY = { low: 2.6, normal: 1.8, high: 1.2 };
const SENSITIVITY_LABELS = { low: "Strict (fewer)", normal: "Normal", high: "Sensitive (more)" };
const WINDOW_WEEKS = 13; // ~3 months for "best stretch" vs "final stretch"
const TURN_WINDOW = 8; // weeks compared on each side of a turning point
const NEUTRAL = ["var(--text-2)"];
const FIGHTS_SERIES = [{ name: "Fights" }];

const sum = (a) => a.reduce((x, y) => x + y, 0);
const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const weekOf = (day, wd) => new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) - wd)).toISOString().slice(0, 10);

export const defaultRelState = () => ({ revealed: false, sensitivity: "normal", end: null, dismissed: new Set() });

export function activeFights(r, st) {
  const min = SENSITIVITY[st.sensitivity] ?? SENSITIVITY.normal;
  return r.relationship.candidates.filter((c) => c.score >= min && !st.dismissed.has(c.id));
}

export function renderRelationship(r, st, { narrow = false } = {}) {
  if (!r.relationship) return "";
  if (!st?.revealed) {
    return card(
      "Fights & what changed",
      `<p>This looks for arguments in your chat and at how things shifted over time: who started reaching out, how replies slowed down or sped up, and the moments when the mood changed.</p>
      <p class="muted">It's an estimate from text alone. It can't see calls, time together or anything that happened outside this chat, and it can't tell <i>why</i> things changed or whose fault anything was. It may also bring up painful moments.</p>
      <button class="btn primary" data-rel="reveal">Show this analysis</button>`,
      { cls: "span-2 no-print" },
    );
  }
  const widths = { W: narrow ? 420 : 800, HALF: narrow ? 420 : 460 };
  const fights = activeFights(r, st);
  return [controls(r, st), fightSection(r, fights, widths), changedSection(r, st, fights, widths)].join("");
}

function controls(r, st) {
  const n = st.dismissed.size;
  return `<div class="rel-controls span-2 no-print">
      <label>Fight detection
        <select id="rel-sens">${Object.keys(SENSITIVITY).map((k) => `<option value="${k}" ${st.sensitivity === k ? "selected" : ""}>${SENSITIVITY_LABELS[k]}</option>`).join("")}</select>
      </label>
      <label>Look until
        <input type="date" id="rel-end" min="${r.totals.firstDay}" max="${r.totals.lastDay}" value="${st.end || r.totals.lastDay}">
      </label>
      ${st.end && st.end !== r.totals.lastDay ? `<button class="btn small ghost" data-rel="end-reset">Use the last message</button>` : ""}
      ${n ? `<button class="btn small ghost" data-rel="restore">Restore ${n} hidden fight${n > 1 ? "s" : ""}</button>` : ""}
      <button class="btn small ghost" data-rel="hide">Hide this section</button>
    </div>
    <p class="rel-note span-2">Set <b>Look until</b> to when things ended if the chat didn't simply stop. Tap <b>Not a fight</b> on anything that was misread and it drops out of every number.</p>`;
}

// ---------------------------------------------------------------------------
// Fights

function fightSection(r, fights, { W, HALF }) {
  const P = r.people;
  if (!fights.length) return card("Fights", `<p class="muted">No fights detected at this sensitivity 🕊️</p>`, { cls: "span-2" });

  const months = r.time.months;
  const byMonth = new Map();
  for (const f of fights) byMonth.set(f.day.slice(0, 7), (byMonth.get(f.day.slice(0, 7)) || 0) + 1);
  const stormiest = [...byMonth].sort((a, b) => b[1] - a[1])[0];
  const rate = fights.length / (r.totals.spanDays / 30.44);

  const times = fights.map((f) => f.start).sort((a, b) => a - b);
  let calm = { gap: 0 };
  [r.totals.start, ...times, r.totals.end].reduce((a, b) => {
    if (b - a > calm.gap) calm = { gap: b - a, from: a, to: b };
    return b;
  });

  const apologized = P.map(() => 0), reachedOut = P.map(() => 0);
  let noApology = 0;
  for (const f of fights) {
    if (f.apologizer != null) apologized[f.apologizer]++;
    else noApology++;
    if (f.reachedOut != null) reachedOut[f.reachedOut]++;
  }
  const makeUps = fights.map((f) => f.makeUp).filter((x) => x != null);
  const coldest = fights.reduce((a, f) => ((f.makeUp ?? 0) > (a?.makeUp ?? 0) ? f : a), null);

  const blocks = ["12–3am", "3–6am", "6–9am", "9am–12", "12–3pm", "3–6pm", "6–9pm", "9pm–12"];
  const byBlock = blocks.map(() => 0), byWeekday = WEEKDAYS.map(() => 0);
  for (const f of fights) {
    byBlock[Math.floor(f.hour / 3)]++;
    byWeekday[f.wd]++;
  }

  const monthChart = stackedBars(
    months.map((m) => ({ label: monthLabel(m.ym, { short: true }), tip: monthLabel(m.ym), values: [byMonth.get(m.ym) || 0] })),
    FIGHTS_SERIES,
    { width: W, height: 180, colors: NEUTRAL },
  );

  const biggest = [...fights].sort((a, b) => b.score - a.score).slice(0, 5);
  const all = [...fights].sort((a, b) => b.start - a.start);

  return [
    tiles(
      stat("Fights detected", num(fights.length), `about ${dec(rate, rate < 1 ? 2 : 1)} a month`),
      stormiest && stat("Stormiest month", monthLabel(stormiest[0]), `${num(stormiest[1])} fight${stormiest[1] > 1 ? "s" : ""}`),
      stat("Longest calm stretch", duration(calm.gap, { parts: 1 }), `${dayLabel(new Date(calm.from).toISOString().slice(0, 10))} → ${dayLabel(new Date(calm.to).toISOString().slice(0, 10))}`),
      makeUps.length && stat("Typical make-up time", duration(median(makeUps)), "until laughs or ❤️ came back"),
    ),
    card("Fights over time", monthChart, { sub: "Likely arguments per month", cls: "span-2" }),
    card(
      "After a fight",
      `<div class="split-group"><h4>Who apologized first</h4>${sum(apologized) ? splitBar(apologized, P) : `<p class="muted">No apologies found in the chat.</p>`}
        ${noApology ? `<p class="muted small">${num(noApology)} fight${noApology > 1 ? "s" : ""} had no apology in the chat.</p>` : ""}</div>
      <div class="split-group"><h4>Who texted first afterwards</h4>${splitBar(reachedOut, P)}</div>
      ${coldest?.makeUp ? `<h4>Longest cold war</h4><p>${duration(coldest.makeUp)} after the fight on ${dayLabel(coldest.day)}.</p>` : ""}`,
    ),
    card(
      "When fights happen",
      `${groupedBars(blocks, [byBlock], FIGHTS_SERIES, { width: HALF, height: 170, colors: NEUTRAL })}
      <h4>By weekday</h4>${groupedBars(WEEKDAYS.map((w) => w.slice(0, 2)), [byWeekday], FIGHTS_SERIES, { width: HALF, height: 150, colors: NEUTRAL })}`,
    ),
    card("What tends to come up", fightTopics(r, fights), { sub: "Words and topics that show up more during fights than usual" }),
    card("The biggest fights", `<div class="fights">${biggest.map((f, i) => fightItem(f, P, i === 0)).join("")}</div>`),
    card(`All detected fights (${num(fights.length)})`, `<details class="all-fights"><summary>Show the list</summary><div class="fights">${all.slice(0, 150).map((f) => fightItem(f, P)).join("")}</div></details>`, { cls: "span-2 no-print" }),
  ].join("");
}

function fightItem(f, P, open = false) {
  return `<details class="fight" ${open ? "open" : ""}>
    <summary><span class="fight-when">${dayLabel(f.day)} · ${hourLabel(f.hour)}</span><span class="fight-meta">${num(f.count)} messages · ${duration(Math.max(f.end - f.start, 60e3))}</span><span class="fight-heat" style="--heat:${Math.min(1, f.score / 5).toFixed(2)}" aria-hidden="true"></span></summary>
    ${thread(f.peek, P)}
    <div class="fight-foot">
      <span>${f.apologizer != null ? `${esc(firstName(P[f.apologizer]?.name))} apologized first` : "No apology in the chat"}</span>
      ${f.makeUp != null ? `<span>Warm again after ${duration(f.makeUp)}</span>` : ""}
      <button class="btn small ghost no-print" data-rel-dismiss="${f.id}">Not a fight</button>
    </div>
  </details>`;
}

function fightTopics(r, fights) {
  const rel = r.relationship;
  const counts = new Map();
  let total = 0;
  for (const f of fights) {
    total += f.tokenTotal;
    for (const [t, c] of f.tokens) counts.set(t, (counts.get(t) || 0) + c);
  }
  const minCount = Math.max(2, Math.ceil(fights.length * 0.15));
  const lifted = [...counts]
    .filter(([, c]) => c >= minCount)
    .map(([t, c]) => ({ t, c, lift: total ? c / total / ((rel.globalTokens[t] || c) / rel.totalTokens) : 0 }))
    .filter((x) => x.lift >= 1.5)
    .sort((a, b) => b.lift * Math.log(1 + b.c) - a.lift * Math.log(1 + a.c))
    .slice(0, 12);
  const fightMsgs = sum(fights.map((f) => f.count));
  const topics = TOPICS.map((t, ti) => {
    const c = sum(fights.map((f) => f.topics[ti]));
    const lift = rel.topicTotals[ti] ? c / fightMsgs / (rel.topicTotals[ti] / rel.textTotal) : 0;
    return { ...t, c, lift };
  })
    .filter((t) => t.c >= 2 && t.lift >= 1.2)
    .sort((a, b) => b.lift - a.lift);
  return `${topics.length ? `<h4>Topics</h4>${chips(topics.map((t) => ({ html: `${t.icon} ${t.label} <small>${dec(t.lift)}× usual</small>` })))}` : ""}
    ${lifted.length ? `<h4>Words</h4>${chips(lifted.map((w) => ({ html: `${esc(w.t)} <small>${num(w.c)}</small>`, tip: `${dec(w.lift)}× more common in fights` })))}` : ""}
    ${!topics.length && !lifted.length ? `<p class="muted">Nothing stands out — fights don't seem to circle one subject.</p>` : ""}`;
}

// ---------------------------------------------------------------------------
// What changed

function metrics(ws, fightCount, P) {
  const L = ws.length, days = L * 7;
  const tot = (k) => P.map((_, s) => sum(ws.map((w) => w[k][s])));
  const msgs = tot("msgs"), starters = tot("starters"), aff = tot("aff"), laughs = tot("laughs");
  const pos = tot("pos"), neg = tot("neg"), rl = tot("replyLog"), rn = tot("replyN"), dbl = tot("double"), words = tot("words"), text = tot("text");
  return {
    perDay: sum(msgs) / days,
    share: msgs.map((v) => v / (sum(msgs) || 1)),
    reply: P.map((_, s) => (rn[s] >= 3 ? (Math.exp(rl[s] / rn[s]) - 1) * 1000 : null)),
    starts: starters.map((v) => (sum(starters) ? v / sum(starters) : null)),
    affPerWeek: sum(aff) / L,
    laughsPerDay: sum(laughs) / days,
    mood: P.map((_, s) => (pos[s] + neg[s] >= 5 ? (pos[s] - neg[s]) / (pos[s] + neg[s]) : null)),
    fightsPerMonth: fightCount / (days / 30.44),
    doublePerWeek: dbl.map((v) => v / L),
    wordsPerMsg: P.map((_, s) => (text[s] ? words[s] / text[s] : null)),
  };
}

const signed = (n, unit) => (n === 0 ? "same" : `${n > 0 ? "+" : "−"}${Math.abs(n)}${unit}`);
const change = {
  ratio: (a, b) => (a == null || b == null || a === 0 ? "–" : signed(Math.round((b / a - 1) * 100), "%")),
  times: (a, b) => {
    if (a == null || b == null || !a) return "–";
    const k = b / a;
    return k >= 1.15 ? `${dec(k)}× slower` : k <= 1 / 1.15 ? `${dec(1 / k)}× faster` : "about the same";
  },
  points: (a, b) => (a == null || b == null ? "–" : signed(Math.round((b - a) * 100), " pts")),
  diff: (a, b) => (a == null || b == null ? "–" : Math.abs(b - a) < 0.005 ? "same" : `${b > a ? "+" : "−"}${Math.abs(b - a).toFixed(2)}`),
};
// Bold the changes worth noticing: ±30%, 1.5× or 10 percentage points.
function big(txt) {
  const p = txt.match(/(\d+)%/), k = txt.match(/([\d.]+)×/), pts = txt.match(/(\d+) pts/);
  return (p && +p[1] >= 30) || (k && +k[1] >= 1.5) || (pts && +pts[1] >= 10) || txt === "new";
}

function changedSection(r, st, fights, { W }) {
  const P = r.people.filter((p) => p.id !== "__others");
  const rel = r.relationship;
  const end = st.end || r.totals.lastDay;
  const weeks = rel.weeks.filter((w) => w.week <= end);
  if (weeks.length < 8) return card("What changed", `<p class="muted">There isn't enough history before this date yet (at least 8 weeks are needed).</p>`, { cls: "span-2" });

  const index = new Map(weeks.map((w, i) => [w.week, i]));
  const perWeek = weeks.map(() => 0);
  for (const f of fights) {
    const i = index.get(weekOf(f.day, f.wd));
    if (i != null) perWeek[i]++;
  }

  // Final stretch = the last ~3 months; best stretch = the busiest ~3 months before it.
  let finalStart, baseStart, baseLen;
  if (weeks.length >= WINDOW_WEEKS * 2) {
    finalStart = weeks.length - WINDOW_WEEKS;
    baseLen = WINDOW_WEEKS;
    let best = -1;
    for (let i = 0; i + WINDOW_WEEKS <= finalStart; i++) {
      const v = sum(weeks.slice(i, i + WINDOW_WEEKS).map((w) => sum(w.msgs)));
      if (v > best) {
        best = v;
        baseStart = i;
      }
    }
  } else {
    baseLen = Math.floor(weeks.length / 2);
    baseStart = 0;
    finalStart = weeks.length - baseLen;
  }
  const baseW = weeks.slice(baseStart, baseStart + baseLen), finalW = weeks.slice(finalStart);
  const a = metrics(baseW, sum(perWeek.slice(baseStart, baseStart + baseLen)), P);
  const b = metrics(finalW, sum(perWeek.slice(finalStart)), P);
  const range = (ws) => `${dayLabel(ws[0].week)} – ${dayLabel(ws[ws.length - 1].week)}`;
  const nm = (s) => esc(firstName(P[s].name));

  const rows = [
    ["Messages per day", a.perDay, b.perDay, (v) => dec(v, 0), change.ratio],
    ...P.slice(0, 4).flatMap((_, s) => [
      [`${nm(s)}’s typical reply`, a.reply[s], b.reply[s], (v) => duration(v), change.times],
      [`${nm(s)} starts conversations`, a.starts[s], b.starts[s], (v) => pct(v), change.points],
      [`${nm(s)}’s share of messages`, a.share[s], b.share[s], (v) => pct(v), change.points],
      [`${nm(s)}’s words per message`, a.wordsPerMsg[s], b.wordsPerMsg[s], (v) => dec(v), change.ratio],
      [`${nm(s)}’s double texts / week`, a.doublePerWeek[s], b.doublePerWeek[s], (v) => dec(v), change.ratio],
      [`${nm(s)}’s mood`, a.mood[s], b.mood[s], (v) => `${v >= 0 ? "+" : ""}${dec(v, 2)}`, change.diff],
    ]),
    ["“Love you / miss you” per week", a.affPerWeek, b.affPerWeek, (v) => dec(v), change.ratio],
    ["Laughs per day", a.laughsPerDay, b.laughsPerDay, (v) => dec(v), change.ratio],
    ["Fights per month", a.fightsPerMonth, b.fightsPerMonth, (v) => dec(v), (x, y) => (x === 0 && y > 0 ? "new" : change.ratio(x, y))],
  ];
  const table = `<div class="table-wrap"><table class="versus changes"><thead><tr><th></th><th>Best stretch<small>${range(baseW)}</small></th><th>Final stretch<small>${range(finalW)}</small></th><th>Change</th></tr></thead><tbody>${rows
    .map(([label, x, y, fmt, ch]) => {
      const c = ch(x, y);
      return `<tr><th scope="row">${label}</th><td>${x == null ? "–" : fmt(x)}</td><td>${y == null ? "–" : fmt(y)}</td><td class="${big(c) ? "lead-change" : ""}">${c}</td></tr>`;
    })
    .join("")}</tbody></table></div>`;

  const turns = turningPoints(weeks, perWeek, P);
  const turnList = turns.length
    ? `<ol class="turns">${turns
        .map((t) => `<li><b>${t.kind === "cool" ? "🧊 Things cooled down" : "🔥 Things warmed up"}</b> around ${dayLabel(weeks[t.i].week, { long: true })}<span>${t.notes.join(" · ") || "Several small shifts at once"}</span></li>`)
        .join("")}</ol>`
    : `<p class="muted">No sharp turning points — changes were gradual.</p>`;

  const charts = weekCharts(weeks, P, turns.map((t) => t.i), W);

  const finalFrom = new Date(finalW[0].week).getTime(), endT = new Date(end).getTime() + 864e5;
  const silences = rel.silences.filter((x) => x.after.t >= finalFrom && x.after.t <= endT).sort((x, y) => x.after.t - y.after.t).slice(0, 8);
  const silenceList = silences.length
    ? `<div class="fights">${silences
        .map(
          (x) => `<details class="fight"><summary><span class="fight-when">${dayLabel(x.before.day)} → ${dayLabel(x.after.day)}</span><span class="fight-meta">${duration(x.gap, { parts: 1 })} · ${esc(firstName(P[x.after.from]?.name))} reached out</span></summary>${thread([x.before, x.after], P)}</details>`,
        )
        .join("")}</div>`
    : `<p class="muted">No silences longer than 2 days in the final stretch.</p>`;
  const ended = end >= r.totals.lastDay && rel.lastConversation.length;

  return [
    card("What changed", `<p class="muted">Your busiest 3 months compared with the last 3 months${st.end && st.end !== r.totals.lastDay ? " before the date you picked" : ""}. Big changes are in bold.</p>${table}`, { cls: "span-2" }),
    card("Turning points", turnList, { sub: "Weeks where several signals shifted at once (dashed lines below)" }),
    card("Silences in the final stretch", silenceList, { sub: "Gaps of 2+ days and who broke them" }),
    card("Week by week", charts, { sub: "4-week rolling averages", cls: "span-2" }),
    ended ? card("The last conversation", thread(rel.lastConversation, P), { sub: dayLabel(r.totals.lastDay, { long: true }) }) : "",
  ].join("");
}

function turningPoints(weeks, fightsPerWeek, P) {
  const K = TURN_WINDOW, n = weeks.length;
  const series = (f) => weeks.map(f);
  const vol = series((w) => sum(w.msgs)), aff = series((w) => sum(w.aff)), laugh = series((w) => sum(w.laughs));
  const rl = series((w) => sum(w.replyLog)), rn = series((w) => sum(w.replyN));
  const st0 = series((w) => w.starters[0]), stAll = series((w) => sum(w.starters));
  const S = (arr, i, j) => sum(arr.slice(i, j));
  const lr = (x, y) => Math.log((y + 2) / (x + 2));
  const points = [];
  for (let i = K; i <= n - K; i++) {
    const A = [i - K, i], B = [i, i + K];
    if (S(vol, ...A) + S(vol, ...B) < 80) continue;
    const dVol = lr(S(vol, ...A), S(vol, ...B)), dAff = lr(S(aff, ...A), S(aff, ...B)), dLaugh = lr(S(laugh, ...A), S(laugh, ...B));
    const g = (x, y) => (S(rn, x, y) >= 5 ? S(rl, x, y) / S(rn, x, y) : null);
    const r1 = g(...A), r2 = g(...B);
    const dReply = r1 != null && r2 != null ? r2 - r1 : 0;
    const dFights = (S(fightsPerWeek, ...B) - S(fightsPerWeek, ...A)) / 2;
    const share = (x, y) => (S(stAll, x, y) ? S(st0, x, y) / S(stAll, x, y) : 0.5);
    const before = share(...A), after = share(...B);
    const dImb = P.length === 2 ? Math.abs(after - 0.5) - Math.abs(before - 0.5) : 0;
    const cool = Math.max(0, -dVol) + Math.max(0, -dAff) + Math.max(0, -dLaugh) + 0.7 * Math.max(0, dReply) + Math.max(0, dFights) + 3 * Math.max(0, dImb);
    const warm = Math.max(0, dVol) + Math.max(0, dAff) + Math.max(0, dLaugh) + 0.7 * Math.max(0, -dReply) + Math.max(0, -dFights);
    points.push({ i, cool, warm, dVol, dAff, dLaugh, dReply, dFights, before, after, dImb });
  }
  const picked = [];
  for (const p of points.sort((x, y) => Math.max(y.cool, y.warm) - Math.max(x.cool, x.warm))) {
    if (Math.max(p.cool, p.warm) < 0.9 || picked.length >= 3) break;
    if (picked.some((q) => Math.abs(q.i - p.i) < 10)) continue;
    picked.push(p);
  }
  const pctOf = (d) => `${d >= 0 ? "+" : "−"}${Math.abs(Math.round((Math.exp(d) - 1) * 100))}%`;
  return picked
    .sort((x, y) => x.i - y.i)
    .map((p) => {
      const notes = [];
      if (Math.abs(Math.exp(p.dVol) - 1) >= 0.3) notes.push(`Messages ${pctOf(p.dVol)}`);
      if (Math.abs(p.dReply) >= Math.log(1.5)) notes.push(`Replies ${dec(Math.exp(Math.abs(p.dReply)))}× ${p.dReply > 0 ? "slower" : "faster"}`);
      if (Math.abs(Math.exp(p.dAff) - 1) >= 0.3) notes.push(`“Love you / miss you” ${pctOf(p.dAff)}`);
      if (Math.abs(Math.exp(p.dLaugh) - 1) >= 0.3) notes.push(`Laughs ${pctOf(p.dLaugh)}`);
      if (Math.abs(p.dFights) >= 0.5) notes.push(p.dFights > 0 ? "More fights" : "Fewer fights");
      if (p.dImb >= 0.1) {
        const s = p.after >= 0.5 ? 0 : 1;
        const share = (v) => (s === 0 ? v : 1 - v);
        notes.push(`${esc(firstName(P[s].name))} started ${pct(share(p.after))} of conversations (was ${pct(share(p.before))})`);
      }
      return { i: p.i, kind: p.cool >= p.warm ? "cool" : "warm", notes };
    });
}

function weekCharts(weeks, P, marks, W) {
  const labels = weeks.map((w) => monthLabel(w.week.slice(0, 7), { short: true }));
  const tips = weeks.map((w) => `Week of ${dayLabel(w.week)}`);
  const roll = (get) => weeks.map((_, i) => {
    const ws = weeks.slice(Math.max(0, i - 3), i + 1);
    return get(ws);
  });
  const opts = (extra) => ({ width: W, height: 150, marks, tipLabels: tips, labelEvery: Math.max(1, Math.ceil(weeks.length / 8)), ...extra });
  const perPerson = (get) => P.map((_, s) => roll((ws) => get(ws, s)));
  const charts = [
    ["Messages per week", perPerson((ws, s) => sum(ws.map((w) => w.msgs[s])) / ws.length), { fmt: (v) => dec(v, 0) }],
    [
      "Typical reply time",
      perPerson((ws, s) => {
        const n = sum(ws.map((w) => w.replyN[s]));
        return n >= 3 ? Math.exp(sum(ws.map((w) => w.replyLog[s])) / n) - 1 : null;
      }),
      { fmt: (v) => duration(v * 1000, { parts: 1 }) },
    ],
    [
      "Share of conversations started",
      perPerson((ws, s) => {
        const t = sum(ws.map((w) => sum(w.starters)));
        return t ? sum(ws.map((w) => w.starters[s])) / t : null;
      }),
      { yMin: 0, yMax: 1, fmt: (v) => pct(v) },
    ],
    ["“Love you / miss you” per week", perPerson((ws, s) => sum(ws.map((w) => w.aff[s])) / ws.length), { fmt: (v) => dec(v, 1) }],
    ["Laughs per week", perPerson((ws, s) => sum(ws.map((w) => w.laughs[s])) / ws.length), { fmt: (v) => dec(v, 0) }],
    [
      "Mood",
      perPerson((ws, s) => {
        const p = sum(ws.map((w) => w.pos[s])), n = sum(ws.map((w) => w.neg[s]));
        return p + n >= 5 ? (p - n) / (p + n) : null;
      }),
      { yMin: -1, yMax: 1, zero: true, fmt: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}` },
    ],
  ];
  return charts.map(([title, series, extra]) => `<h4>${title}</h4>${lineChart(labels, series, P, opts(extra))}`).join("");
}
