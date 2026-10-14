// Renders the full stats dashboard from an analysis result.
import { esc, num, compact, pct, dec, duration, dayLabel, monthLabel, tsLabel, hourLabel, hourRange, WEEKDAYS, WEEKDAYS_LONG, messageText, firstName } from "./format.js";
import { color, legend, splitBar, heatmap, stackedBars, groupedBars, lineChart, calendar, hbars, wordCloud } from "./charts.js";

const sum = (a) => a.reduce((x, y) => x + y, 0);
// Chart viewBox widths: narrower boxes keep axis text readable on phones and in half-width cards.
let FULL = 800, HALF = 460;

const tiles = (...items) => {
  const list = items.filter(Boolean);
  return `<div class="stats n${list.length}">${list.join("")}</div>`;
};

const card = (title, body, { sub = "", cls = "" } = {}) =>
  `<article class="card ${cls}"><header><h3>${title}</h3>${sub ? `<p class="sub">${sub}</p>` : ""}</header>${body}</article>`;

const stat = (label, value, sub = "") =>
  `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value">${value}</div>${sub ? `<div class="stat-sub">${sub}</div>` : ""}</div>`;

const who = (people, s) => `<span class="who"><i class="swatch" style="background:${color(s)}"></i>${esc(people[s]?.name)}</span>`;

function bubble(m, people, { showName = true } = {}) {
  if (!m) return "";
  const p = people[m.from];
  const side = p?.isYou ? "right" : "left";
  return `<div class="bubble-row ${side}"><div class="bubble" style="--who:${color(m.from)}">
    ${showName ? `<div class="bubble-name">${esc(p?.name)}</div>` : ""}
    <div class="bubble-text" dir="auto">${esc(messageText(m))}</div>
    <div class="bubble-time">${tsLabel(m.t)}</div></div></div>`;
}
const thread = (msgs, people) => `<div class="thread">${msgs.filter(Boolean).map((m) => bubble(m, people)).join("")}</div>`;

// Per-person comparison table; the leader in each row gets a badge.
function versus(rows, people) {
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

function chips(items) {
  return `<div class="chips">${items.map((i) => `<span class="chip" dir="auto" ${i.tip ? `data-tip="${esc(i.tip)}"` : ""}>${i.html}</span>`).join("")}</div>`;
}

// ---------------------------------------------------------------------------

export function renderDashboard(r, { narrow = false } = {}) {
  FULL = narrow ? 420 : 800;
  HALF = narrow ? 420 : 460;
  const people = r.people;
  const two = people.length === 2;
  const sections = [
    ["overview", "Overview", overview(r)],
    ["time", "Time", time(r)],
    ["dynamics", "Conversations", dynamics(r)],
    ["words", "Words & emojis", words(r)],
    ["vibes", "Vibes", vibes(r)],
    ["media", "Media & calls", media(r)],
    ["deep", "Deep dive", deep(r)],
    ["wrapped", "Wrapped", wrapped(r)],
  ];
  return `
    <nav class="section-nav" aria-label="Sections">${sections.map(([id, label]) => `<a href="#${id}">${label}</a>`).join("")}</nav>
    ${legend(people)}
    ${sections.map(([id, label, body]) => `<section id="${id}" class="section"><h2>${label}</h2><div class="grid">${body}</div></section>`).join("")}
    <p class="footnote">A new conversation starts after ${r.dynamics.sessionGapHours} hours of silence. Sentiment, topics and language are rough keyword-based estimates (English, Persian and Finglish).
    Telegram exports don't include deleted messages, so they can't be counted.${two ? "" : " Group chats are capped at 8 people; the rest are grouped as “others”."}</p>`;
}

// ---------------------------------------------------------------------------

function overview(r) {
  const { totals: t, people } = r;
  const top = tiles(
    stat("Messages", compact(t.messages), `${dec(t.perDay)} per day on average`),
    stat("Words", compact(t.words), `${compact(t.chars)} characters`),
    stat("Days talked", num(t.activeDays), `${pct(t.activeShare)} of ${num(t.spanDays)} days`),
    stat("Together since", dayLabel(t.firstDay), `${duration(t.end - t.start, { parts: 2 })} of chatting`),
    stat("Emojis", compact(t.emojis), `${compact(sum(r.media.kinds.sticker))} stickers too`),
    stat("Calls", num(r.calls.total), r.calls.total ? `${duration(r.calls.seconds * 1000)} on the phone` : "no calls in the export"),
  );
  const split = `
    <div class="split-group"><h4>Messages</h4>${splitBar(people.map((p) => p.messages), people)}</div>
    <div class="split-group"><h4>Words</h4>${splitBar(people.map((p) => p.words), people)}</div>
    <div class="split-group"><h4>Characters</h4>${splitBar(people.map((p) => p.chars), people)}</div>`;
  const lengthRows = versus(
    [
      ["Avg words / message", people.map((p) => p.avgWords), (v) => dec(v)],
      ["Avg characters / message", people.map((p) => p.avgChars), (v) => dec(v, 0)],
      ["Text messages", people.map((p) => p.textMessages)],
      ["Longest message (chars)", people.map((p) => p.longest?.length ?? 0)],
    ],
    people,
  );
  const longest = people
    .filter((p) => p.longest)
    .map((p) => `<details class="longest"><summary>${who(people, people.indexOf(p))}’s longest message · ${num(p.longest.words)} words</summary>${thread([p.longest.msg], people)}</details>`)
    .join("");
  return [
    top,
    card("Who talks more?", split, { cls: "span-2" }),
    card("Where it all started", `${thread([r.first], people)}<p class="muted center">…and the most recent: </p>${thread([r.last], people)}`, {
      sub: `${dayLabel(r.totals.firstDay, { long: true })} · ${duration(Date.now() - r.totals.start, { parts: 2 })} ago`,
    }),
    card("Message length", lengthRows + longest, { sub: "Paragraph writer vs. one-word texter" }),
  ].join("");
}

function time(r) {
  const { time: t, people } = r;
  const months = t.months;
  const monthChart = stackedBars(
    months.map((m) => ({ label: monthLabel(m.ym, { short: true }), tip: monthLabel(m.ym), values: m.per })),
    people,
    { width: FULL },
  );
  const hourly = lineChart(
    Array.from({ length: 24 }, (_, h) => hourLabel(h)),
    people.map((p) => p.hourly),
    people,
    { labelEvery: 3, tipLabels: Array.from({ length: 24 }, (_, h) => hourRange(h)), width: HALF },
  );
  const weekday = groupedBars(WEEKDAYS.map((w) => w.slice(0, 2)), people.map((p) => p.weekday), people, { width: HALF });
  const b = t.busiest;
  const busiest = `<div class="stats compact">
      ${stat("Messages that day", num(b.count), people.map((p, s) => `${esc(firstName(p.name))} ${num(b.per[s])}`).join(" · "))}
      ${stat("Peak hour", hourRange(b.peakHour))}
    </div>
    ${b.topWords.length ? `<h4>What you were talking about</h4>${chips(b.topWords.map((w) => ({ html: `${esc(w.word)} <small>${w.count}</small>` })))}` : ""}
    ${b.sample.length ? `<h4>A peek at the peak</h4>${thread(b.sample, people)}` : ""}`;
  const s = t.longestSilence;
  const streaks = `<div class="stats compact">
    ${stat("Longest streak", `${num(t.streak.length)} days`, t.streak.length ? `${dayLabel(t.streak.start)} → ${dayLabel(t.streak.end)}` : "")}
    ${stat("Current streak", `${num(t.currentStreak)} days`, t.currentStreak ? "Keep it going! 🔥" : "Time to text them?")}
    ${s ? stat("Longest silence", duration(s.gap), `${dayLabel(s.before.day)} → ${dayLabel(s.after.day)}`) : ""}
  </div>
  ${s ? `<h4>How the silence broke</h4>${thread([s.before, s.after], people)}` : ""}`;
  const owls = versus(
    [
      ["Night owl (12am–5am)", people.map((p) => p.nightShare), (v) => pct(v, 1)],
      ["Early bird (5am–9am)", people.map((p) => p.earlyShare), (v) => pct(v, 1)],
      ["Favorite hour", people.map((p) => p.peakHour), hourRange, "none"],
    ],
    people,
  );
  const yearly = versus(
    t.yearly.map((y) => [y.year, y.per]),
    people,
  );
  const g = t.goldenMonth;
  return [
    tiles(
      stat("Golden era", monthLabel(g.ym), `${num(g.count)} messages that month`),
      stat("Busiest weekday", WEEKDAYS_LONG[t.peakWeekday]),
      stat("Busiest hour", hourRange(t.peakHour)),
      stat("Messages per active day", dec(r.totals.perActiveDay, 0)),
    ),
    card("When you talk", heatmap(t.heat, { weekdays: WEEKDAYS, hourLabel }), { sub: "Messages by weekday and hour", cls: "span-2" }),
    card("Messages over time", monthChart, { sub: "Per month — watch the chat heat up or drift apart", cls: "span-2" }),
    card("Every day you talked", calendar(t.daily, { dayLabel }), { cls: "span-2" }),
    card("Daily rhythm", hourly, { sub: "Messages by hour of day" }),
    card("Weekly rhythm", weekday, { sub: "Messages by weekday" }),
    card(`Busiest day ever · ${dayLabel(b.day, { long: true })}`, busiest),
    card("Streaks & silences", streaks),
    card("Night owl vs. early bird", owls),
    card("Year by year", yearly),
  ].join("");
}

function dynamics(r) {
  const { people, dynamics: d } = r;
  const starters = `<div class="split-group"><h4>Who starts conversations</h4>${splitBar(people.map((p) => p.starters), people)}</div>
    <div class="split-group"><h4>Who gets the last word</h4>${splitBar(people.map((p) => p.enders), people)}</div>`;
  const replyChart = groupedBars(d.bucketsLabels, people.map((p) => p.reply.buckets), people, { width: FULL });
  const replies = versus(
    [
      ["Typical reply time", people.map((p) => p.reply.median), (v) => duration(v), "min"],
      ["Average reply time", people.map((p) => p.reply.mean), (v) => duration(v), "min"],
      ["Replies within a minute", people.map((p) => p.reply.underMinute), (v) => pct(v), "max"],
      ["Double texts", people.map((p) => p.doubleTexts)],
      ["Avg messages in a row", people.map((p) => p.avgBurst), (v) => dec(v)],
      ["Longest monologue", people.map((p) => p.maxBurst?.count ?? 0), (v) => `${num(v)} msgs`],
      ["Questions left hanging", people.map((p) => p.unanswered)],
    ],
    people,
  );
  const slow = people
    .map((p, s) => {
      const x = p.reply.slowest;
      if (!x) return "";
      return `<h4>${who(people, s)} took ${duration(x.gap)} to reply to:</h4>${thread([x.prompt, x.reply], people)}`;
    })
    .join("");
  const hanging = people
    .map((p, s) => {
      const x = p.longestWait;
      if (!x || x.wait < 3600e3) return "";
      return `<h4>${who(people, s)} waited ${duration(x.wait)} for an answer:</h4>${thread([x.q, x.a], people)}`;
    })
    .join("");
  const lc = d.longestConversation;
  const mono = people
    .map((p, s) => (p.maxBurst ? `<li>${who(people, s)} sent <b>${num(p.maxBurst.count)}</b> messages in a row on ${dayLabel(p.maxBurst.start.day)}</li>` : ""))
    .join("");
  return [
    tiles(
      stat("Conversations", num(d.conversations), `${dec(d.avgConversation, 0)} messages each on average`),
      stat("Typical conversation", duration((d.medianConversationMinutes ?? 0) * 60e3)),
      lc && stat("Longest conversation", `${num(lc.count)} msgs`, `${duration(lc.end - lc.start)} on ${dayLabel(lc.first.day)}`),
    ),
    card("Initiator vs. closer", starters),
    card("Reply speed", replies, { sub: "Typical = median, ignoring gaps longer than a new conversation" }),
    card("How fast do replies come?", replyChart, { sub: "Number of replies by time taken", cls: "span-2" }),
    card("Slowest replies", slow || `<p class="muted">No replies yet.</p>`),
    card("Left on read", (hanging || `<p class="muted">Every question got a quick answer. Wholesome.</p>`) + (mono ? `<h4>Longest monologues</h4><ul class="plain">${mono}</ul>` : "")),
  ].join("");
}

function words(r) {
  const { people, content: c } = r;
  const sig = people
    .map(
      (p, s) => `<div class="sig"><h4>${who(people, s)}</h4>
        <div class="sig-label">Signature words</div>${c.signatureWords[s].length ? chips(c.signatureWords[s].map((w) => ({ html: `${esc(w.key)} <small>${num(w.count)}</small>`, tip: `${p.name} said it ${num(w.count)}×, everyone else ${num(w.other)}×` }))) : `<p class="muted">Nothing unique yet.</p>`}
        <div class="sig-label">Signature phrases</div>${c.signaturePhrases[s].length ? chips(c.signaturePhrases[s].map((w) => ({ html: `${esc(w.key)} <small>${num(w.count)}</small>`, tip: `${p.name}: ${num(w.count)}× · others: ${num(w.other)}×` }))) : `<p class="muted">Nothing unique yet.</p>`}
        <div class="sig-label">Most used words</div>${chips(c.topWordsBy[s].slice(0, 10).map((w) => ({ html: `${esc(w.word)} <small>${num(w.count)}</small>` })))}
      </div>`,
    )
    .join("");
  const emojis = people
    .map(
      (p, s) => `<div class="emoji-person"><h4>${who(people, s)} <span class="muted">· ${dec(p.emojiPerMsg, 2)} per message</span></h4>
        <div class="emoji-row">${c.topEmojisBy[s].map((e, i) => `<span class="emoji-big ${i === 0 ? "first" : ""}" data-tip="${esc(`${e.emoji} ${num(e.count)}×`)}">${e.emoji}<small>${compact(e.count)}</small></span>`).join("") || `<span class="muted">No emojis 😐</span>`}</div>
        ${p.signatureEmoji ? `<p class="muted">Signature emoji: <span class="sig-emoji">${p.signatureEmoji}</span></p>` : ""}</div>`,
    )
    .join("");
  return [
    card("Word cloud", wordCloud(c.topWords, people), { sub: people.length > 1 ? "Colored by whoever says it most (when one person says it 62%+ of the time)" : "", cls: "span-2" }),
    card("Signature words & phrases", `<div class="sig-grid">${sig}</div>`, { sub: "Things one person says way more than the other", cls: "span-2" }),
    card("Top emojis", emojis),
    card("Most used phrases", hbars(c.topPhrases.slice(0, 10).map((p) => ({ label: p.phrase, per: p.per })), people)),
  ].join("");
}

function vibes(r) {
  const { people, content: c } = r;
  const laughs = `${splitBar(people.map((p) => p.laughMsgs), people)}
    <div class="stats compact">
      ${c.longestLaugh ? stat("Longest laugh", `<span dir="auto" class="break">${esc(c.longestLaugh.text)}</span>`, `${esc(people[c.longestLaugh.from].name)} · ${dayLabel(c.longestLaugh.day)}`) : ""}
      ${two(people) ? stat("The comedian", esc(people[people[0].madeLaugh >= people[1].madeLaugh ? 0 : 1].name), "made the other laugh the most") : ""}
    </div>
    <h4>Favorite ways to laugh</h4>${chips(c.laughStyles.map((l) => ({ html: `${esc(l.style)} <small>${num(l.count)}</small>` })))}`;
  const counters = `<div class="counters">${c.counters
    .map(
      (k) => `<div class="counter"><div class="counter-icon">${k.icon}</div><div class="counter-label">“${esc(k.label)}”</div>
      <div class="counter-total">${num(k.total)}</div>
      <div class="counter-per">${people.map((p, s) => `<span>${who(people, s)} ${num(k.per[s])}</span>`).join("")}</div>
      ${k.first ? `<div class="counter-first">First: ${esc(people[k.first.from].name)}, ${dayLabel(k.first.day)}</div>` : ""}</div>`,
    )
    .join("")}</div>`;
  const love = c.counters.find((k) => k.key === "love");
  const firstLove = love.first ? card("The first “I love you”", thread([love.first], people), { sub: `${esc(people[love.first.from].name)} said it first` }) : "";
  const qs = versus(
    [
      ["Questions asked", people.map((p) => p.questions)],
      ["Share of messages that are questions", people.map((p) => p.questionShare), (v) => pct(v, 1)],
      ["Messages with a laugh", people.map((p) => p.laughMsgs)],
      ["Times they made the other laugh", people.map((p) => p.madeLaugh)],
    ],
    people,
  );
  return [
    card("Laugh counter", laughs, { sub: "haha, lol, 😂, خخخ, هههه and friends" }),
    card("Curiosity & laughs", qs),
    card("The sweet (and sorry) counters", counters, { cls: "span-2" }),
    firstLove,
  ].join("");
}
const two = (people) => people.length === 2;

function media(r) {
  const { people, media: m, calls } = r;
  const rows = [
    ["📷 Photos", "photo"], ["🎬 Videos", "video"], ["🎤 Voice messages", "voice"], ["⏺️ Video messages", "videoNote"],
    ["🦄 Stickers", "sticker"], ["🎞️ GIFs", "gif"], ["🎵 Audio", "audio"], ["📎 Files", "file"], ["🔗 Links", "link"],
    ["📊 Polls", "poll"], ["📍 Locations", "location"], ["👤 Contacts", "contact"], ["↪️ Forwarded", "forwarded"],
    ["✏️ Edited", "edited"], ["💬 Replies", "reply"],
  ].filter(([, k]) => sum(m.kinds[k]) > 0);
  const table = versus(
    [
      ...rows.map(([label, k]) => [label, m.kinds[k]]),
      ["🎤 Voice minutes", m.voiceSeconds.map((s) => s / 60), (v) => dec(v, 0)],
      ["❤️ Reactions given", people.map((p) => p.reactionsGiven)],
      ["⭐ Reactions received", people.map((p) => p.reactionsReceived)],
    ],
    people,
  );
  const callBody = calls.total
    ? `<div class="stats compact">
        ${stat("Calls", num(calls.total))}
        ${stat("Time on the phone", duration(calls.seconds * 1000))}
        ${stat("Average call", duration(calls.avg * 1000))}
        ${calls.longest ? stat("Longest call", duration(calls.longest.duration * 1000), `${dayLabel(calls.longest.day)} · ${esc(people[calls.longest.from]?.name)} called`) : ""}
      </div>
      <div class="split-group"><h4>Who calls more</h4>${splitBar(calls.byPerson, people)}</div>
      ${sum(calls.missed) ? `<div class="split-group"><h4>Unanswered calls, by caller</h4>${splitBar(calls.missed, people)}</div>` : ""}`
    : `<p class="muted">No calls in this export.</p>`;
  const extras = [
    m.stickerEmoji.length ? `<h4>Favorite stickers</h4>${chips(m.stickerEmoji.map((e) => ({ html: `${e.emoji} <small>${num(e.count)}</small>` })))}` : "",
    m.reactionEmoji.length ? `<h4>Favorite reactions</h4>${chips(m.reactionEmoji.map((e) => ({ html: `${e.emoji} <small>${num(e.count)}</small>` })))}` : "",
    m.domains.length ? `<h4>Most shared sites</h4>${chips(m.domains.map((d) => ({ html: `${esc(d.domain)} <small>${num(d.count)}</small>` })))}` : "",
  ].join("");
  return [
    card("Media breakdown", table, { sub: "Deleted messages aren't included in Telegram exports" }),
    card("Calls", callBody),
    extras ? card("Stickers, reactions & links", extras) : "",
  ].join("");
}

function deep(r) {
  const { people, advanced: a } = r;
  const months = a.sentiment.monthly;
  const sentChart = lineChart(
    months.map((m) => monthLabel(m.ym, { short: true })),
    people.map((_, s) => months.map((m) => m.per[s])),
    people,
    { yMin: -1, yMax: 1, zero: true, fmt: (v) => (v > 0 ? "+" : "") + v.toFixed(1), tipLabels: months.map((m) => monthLabel(m.ym)), width: FULL },
  );
  const sentStats = `<div class="stats compact">
    ${people.map((p, s) => stat(`${esc(p.name)}’s positivity`, `${a.sentiment.overall[s] >= 0 ? "+" : ""}${dec(a.sentiment.overall[s], 2)}`, `${num(a.sentiment.pos[s])} happy · ${num(a.sentiment.neg[s])} sad words`)).join("")}
    ${a.sentiment.happiestDay ? stat("Happiest day", dayLabel(a.sentiment.happiestDay.day)) : ""}
    ${a.sentiment.saddestDay ? stat("Toughest day", dayLabel(a.sentiment.saddestDay.day)) : ""}
  </div>`;
  const topics = a.topics.filter((t) => t.count > 0);
  return [
    card("Mood over time", sentStats + sentChart, { sub: "Positive minus negative words & emojis, per month (−1 to +1)", cls: "span-2" }),
    card("What you talk about", topics.length ? hbars(topics.map((t) => ({ label: t.label, icon: t.icon, per: t.per })), people) : `<p class="muted">No topics detected.</p>`, { sub: "Messages mentioning each topic" }),
    card("Languages", a.languages.length ? hbars(a.languages.map((l) => ({ label: l.lang, per: l.per })), people) : `<p class="muted">No text messages.</p>`, { sub: "Detected per message" }),
  ].join("");
}

function wrapped(r) {
  const { people, personalities: P, throwback: tb } = r;
  const cards = P.length
    ? `<div class="persona-grid">${P.map(
        (awards, s) => `<div class="persona" style="--who:${color(s)}"><div class="persona-name">${esc(people[s].name)}</div>
          ${awards.length ? awards.map((a, i) => `<div class="award ${i === 0 ? "main" : ""}"><span class="award-emoji">${a.emoji}</span><div><b>${a.title}</b><small>${esc(firstName(people[s].name))} ${a.blurb}</small></div></div>`).join("") : `<p class="muted">Perfectly balanced, as all things should be.</p>`}
        </div>`,
      ).join("")}</div>`
    : `<p class="muted">Personalities need at least two people.</p>`;
  const throwback = tb
    ? card(tb.onThisDay ? `On this day, ${tb.yearsAgo} year${tb.yearsAgo > 1 ? "s" : ""} ago` : "A random throwback", thread(tb.messages, people), { sub: dayLabel(tb.day, { long: true }) })
    : "";
  return [
    card("Your chat personalities", cards, { cls: "span-2" }),
    throwback,
    card("Share it", `<p>Get a story-sized image of your highlights to share.</p><div class="row"><button class="btn primary" data-action="card">Download share card</button><button class="btn" data-action="story">▶ Play Wrapped</button></div>`),
  ].join("");
}
