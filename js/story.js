// Spotify-Wrapped-style story: full-screen slides that auto-advance.
import { esc, num, compact, pct, dec, duration, dayLabel, monthLabel, hourRange, WEEKDAYS_LONG, messageText, firstName } from "./format.js";
import { color } from "./charts.js";

const SLIDE_MS = 7000;
const sum = (a) => a.reduce((x, y) => x + y, 0);
const name = (p) => esc(firstName(p?.name));
const big = (value, opts = "") => `<div class="s-big" data-count="${value}" ${opts}>${num(value)}</div>`;
const line = (html, d = 0) => `<div class="s-line" style="--d:${d}">${html}</div>`;
const bubble = (m, people) =>
  m ? `<div class="s-bubble ${people[m.from]?.isYou ? "right" : ""}" style="--who:${color(m.from)}"><small>${esc(people[m.from]?.name)}</small><span dir="auto">${esc(messageText(m).slice(0, 220))}</span></div>` : "";

function slides(r) {
  const P = r.people;
  const t = r.totals;
  const two = P.length === 2;
  const lead = (vals) => vals.indexOf(Math.max(...vals));
  const out = [];
  const add = (theme, html) => out.push({ theme, html });

  add("violet", `
    ${line(`<div class="s-kicker">Chat Wrapped</div>`)}
    ${line(`<h1 class="s-title">${P.slice(0, 2).map(name).join(" <span class='amp'>&</span> ")}${P.length > 2 ? " & co." : ""}</h1>`, 1)}
    ${line(`<p>${dayLabel(t.firstDay, { long: true })} → ${dayLabel(t.lastDay, { long: true })}</p>`, 2)}
    ${line(`<p class="s-hint">Tap to continue →</p>`, 4)}`);

  add("blue", `
    ${line(`<p>Together you sent</p>`)}
    ${line(big(t.messages), 1)}
    ${line(`<p>messages. That's <b>${dec(t.perDay, 0)}</b> a day, every day, for <b>${num(t.spanDays)}</b> days.</p>`, 2)}
    ${line(`<p class="s-small">You talked on ${num(t.activeDays)} of those days (${pct(t.activeShare)}) and wrote ${compact(t.words)} words.</p>`, 3)}`);

  if (P.length > 1) {
    const i = lead(P.map((p) => p.messages));
    add("orange", `
      ${line(`<p>Who talks more?</p>`)}
      ${line(`<div class="s-split">${P.map((p, s) => `<div style="flex:${p.messages};background:${color(s)}"></div>`).join("")}</div>`, 1)}
      ${line(`<div class="s-split-labels">${P.slice(0, 4).map((p, s) => `<span><i style="background:${color(s)}"></i>${name(p)} <b>${pct(p.share)}</b></span>`).join("")}</div>`, 2)}
      ${line(`<h2>${name(P[i])} is the yapper.</h2>`, 3)}
      ${line(`<p class="s-small">${name(P[i])} averages ${dec(P[i].avgWords)} words per message${two ? `, ${name(P[1 - i])} ${dec(P[1 - i].avgWords)}` : ""}.</p>`, 4)}`);
  }

  add("pink", `
    ${line(`<p>It all started on</p>`)}
    ${line(`<h2>${dayLabel(t.firstDay, { long: true })}</h2>`, 1)}
    ${line(`<p>with these words:</p>`, 2)}
    ${line(bubble(r.first, P), 3)}`);

  const g = r.time.goldenMonth;
  add("gold", `
    ${line(`<p>Your golden era was</p>`)}
    ${line(`<h1 class="s-title">${monthLabel(g.ym)}</h1>`, 1)}
    ${line(`<p><b>${num(g.count)}</b> messages in a single month.</p>`, 2)}`);

  const b = r.time.busiest;
  add("red", `
    ${line(`<p>Your busiest day ever</p>`)}
    ${line(`<h2>${dayLabel(b.day, { long: true })}</h2>`, 1)}
    ${line(big(b.count), 2)}
    ${line(`<p>messages, peaking ${hourRange(b.peakHour)}.</p>`, 3)}
    ${b.topWords.length ? line(`<div class="s-chips">${b.topWords.slice(0, 5).map((w) => `<span dir="auto">${esc(w.word)}</span>`).join("")}</div>`, 4) : ""}`);

  {
    const owl = lead(P.map((p) => p.nightShare));
    add("night", `
      ${line(`<p>Your favorite time to talk</p>`)}
      ${line(`<h1 class="s-title">${hourRange(r.time.peakHour)}</h1>`, 1)}
      ${line(`<p>especially on ${WEEKDAYS_LONG[r.time.peakWeekday]}s.</p>`, 2)}
      ${P[owl].nightShare > 0.01 ? line(`<h2>🦉 ${name(P[owl])} is the night owl</h2><p class="s-small">${pct(P[owl].nightShare)} of their messages were sent between midnight and 5am.</p>`, 3) : ""}`);
  }

  add("green", `
    ${line(`<p>Your longest streak</p>`)}
    ${line(big(r.time.streak.length), 1)}
    ${line(`<p>days in a row 🔥<br><span class="s-small">${dayLabel(r.time.streak.start)} → ${dayLabel(r.time.streak.end)}</span></p>`, 2)}
    ${r.time.longestSilence ? line(`<p class="s-small">…and the longest silence: <b>${duration(r.time.longestSilence.gap)}</b>, broken by ${name(P[r.time.longestSilence.after.from])}.</p>`, 3) : ""}`);

  if (P.length > 1) {
    const speeds = P.map((p) => p.reply.median ?? Infinity);
    const fast = speeds.indexOf(Math.min(...speeds));
    const slow = speeds.indexOf(Math.max(...speeds.filter(Number.isFinite)));
    const ratio = speeds[slow] / speeds[fast];
    add("blue", `
      ${line(`<p>Typical reply time</p>`)}
      ${line(`<div class="s-vs">${P.slice(0, 4).map((p, s) => `<div><b style="color:${color(s)}">${duration(p.reply.median)}</b><span>${name(p)}</span></div>`).join("")}</div>`, 1)}
      ${line(`<h2>⚡ ${name(P[fast])} replies ${ratio > 1.15 ? `${dec(ratio)}× faster` : "just as fast"}</h2>`, 2)}
      ${P[slow].reply.slowest ? line(`<p class="s-small">${name(P[slow])} once took ${duration(P[slow].reply.slowest.gap)} to reply 🐢</p>`, 3) : ""}`);

    const init = lead(P.map((p) => p.starters));
    add("violet", `
      ${line(`<p>Who texts first?</p>`)}
      ${line(`<h1 class="s-title">${name(P[init])}</h1>`, 1)}
      ${line(`<p>started <b>${pct(P[init].starters / Math.max(1, sum(P.map((p) => p.starters))))}</b> of your ${num(r.dynamics.conversations)} conversations.</p>`, 2)}
      ${line(`<p class="s-small">${name(P[lead(P.map((p) => p.doubleTexts))])} is the double texter (${num(Math.max(...P.map((p) => p.doubleTexts)))} follow-ups).</p>`, 3)}`);
  }

  const em = r.content.topEmojis;
  if (em.length) {
    add("pink", `
      ${line(`<p>Your top emojis</p>`)}
      ${line(`<div class="s-emojis">${em.slice(0, 5).map((e, i) => `<span style="--i:${i}">${e.emoji}<small>${compact(e.count)}</small></span>`).join("")}</div>`, 1)}
      ${line(`<p class="s-small">${P.slice(0, 4).filter((p) => p.signatureEmoji).map((p) => `${name(p)}’s signature: <span class="s-emoji">${p.signatureEmoji}</span>`).join(" · ")}</p>`, 2)}`);
  }

  const tw = r.content.topWords;
  if (tw.length) {
    add("orange", `
      ${line(`<p>Your most used words</p>`)}
      ${line(`<ol class="s-list">${tw.slice(0, 5).map((w) => `<li><span dir="auto">${esc(w.word)}</span><small>${num(w.count)}</small></li>`).join("")}</ol>`, 1)}
      ${line(`<p class="s-small">${P.slice(0, 2).map((p, s) => (r.content.signatureWords[s][0] ? `Only ${name(p)} says “<span dir="auto">${esc(r.content.signatureWords[s][0].key)}</span>” this much` : "")).filter(Boolean).join(" · ")}</p>`, 2)}`);
  }

  const laughs = sum(P.map((p) => p.laughMsgs));
  if (laughs) {
    const comedian = lead(P.map((p) => p.madeLaugh));
    add("gold", `
      ${line(`<p>You laughed in</p>`)}
      ${line(big(laughs), 1)}
      ${line(`<p>messages 😂</p>`, 2)}
      ${r.content.longestLaugh ? line(`<p class="s-small">Longest laugh, by ${name(P[r.content.longestLaugh.from])}:</p><div class="s-laugh" dir="auto">${esc(r.content.longestLaugh.text)}</div>`, 3) : ""}
      ${P.length > 1 ? line(`<h2>🤡 ${name(P[comedian])} is the comedian</h2>`, 4) : ""}`);
  }

  const c = Object.fromEntries(r.content.counters.map((k) => [k.key, k]));
  if (c.love.total + c.miss.total + c.sorry.total + c.thanks.total > 0) {
    add("red", `
      ${line(`<p>The sweet stuff</p>`)}
      ${line(`<div class="s-counters">${["love", "miss", "sorry", "thanks"].map((k) => `<div><span>${c[k].icon}</span><b>${num(c[k].total)}</b><small>“${c[k].label}”</small></div>`).join("")}</div>`, 1)}
      ${c.love.first ? line(`<p class="s-small">The first “I love you” came from <b>${name(P[c.love.first.from])}</b> on ${dayLabel(c.love.first.day)} 💘</p>`, 2) : ""}`);
  }

  if (r.calls.total) {
    add("green", `
      ${line(`<p>You also called each other</p>`)}
      ${line(big(r.calls.total), 1)}
      ${line(`<p>times, talking for <b>${duration(r.calls.seconds * 1000)}</b> 📞</p>`, 2)}
      ${r.calls.longest ? line(`<p class="s-small">Longest call: ${duration(r.calls.longest.duration * 1000)} on ${dayLabel(r.calls.longest.day)}</p>`, 3) : ""}`);
  }

  const topics = r.advanced.topics.filter((x) => x.count);
  if (topics.length) {
    add("night", `
      ${line(`<p>You mostly talk about</p>`)}
      ${line(`<ol class="s-list">${topics.slice(0, 3).map((x) => `<li><span>${x.icon} ${x.label}</span><small>${compact(x.count)}</small></li>`).join("")}</ol>`, 1)}
      ${line(`<p class="s-small">Mood score: ${P.slice(0, 2).map((p, s) => `${name(p)} ${r.advanced.sentiment.overall[s] >= 0 ? "+" : ""}${dec(r.advanced.sentiment.overall[s], 2)}`).join(" · ")}</p>`, 2)}`);
  }

  if (r.personalities.length) {
    add("violet", `
      ${line(`<p>And your chat personalities…</p>`)}
      ${r.personalities.slice(0, 4).map((aw, s) => line(`<div class="s-persona" style="--who:${color(s)}"><small>${name(P[s])}</small>${aw[0] ? `<b>${aw[0].emoji} ${aw[0].title}</b><span>${aw.slice(1, 3).map((a) => a.title).join(" · ")}</span>` : "<b>⚖️ The Balanced One</b>"}</div>`, s + 1)).join("")}`);
  }

  if (r.throwback) {
    const tb = r.throwback;
    add("blue", `
      ${line(`<p>${tb.onThisDay ? `On this day, ${tb.yearsAgo} year${tb.yearsAgo > 1 ? "s" : ""} ago` : "A random throwback"}</p>`)}
      ${line(`<h2>${dayLabel(tb.day, { long: true })}</h2>`, 1)}
      ${line(`<div class="s-thread">${tb.messages.slice(0, 4).map((m) => bubble(m, P)).join("")}</div>`, 2)}`);
  }

  add("outro", `
    ${line(`<div class="s-kicker">That's a wrap</div>`)}
    ${line(`<h1 class="s-title">${compact(t.messages)} messages,<br>${num(t.activeDays)} days.</h1>`, 1)}
    ${line(`<p>Here's to many more 💬</p>`, 2)}
    ${line(`<div class="s-actions"><button class="btn primary" data-action="card">Download share card</button><button class="btn ghost" data-action="close">See all stats</button><button class="btn ghost" data-action="replay">Replay</button></div>`, 3)}`);
  return out;
}

export function playStory(r, { onAction } = {}) {
  const list = slides(r);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.createElement("div");
  root.className = "story";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Chat Wrapped story");
  root.innerHTML = `<div class="story-frame">
      <div class="story-progress">${list.map(() => `<div><i></i></div>`).join("")}</div>
      <button class="story-close" aria-label="Close">✕</button>
      <button class="story-pause" aria-label="Pause">❚❚</button>
      <div class="story-slide" aria-live="polite"></div>
      <button class="story-nav prev" aria-label="Previous"></button>
      <button class="story-nav next" aria-label="Next"></button>
    </div>`;
  document.body.appendChild(root);
  document.body.classList.add("no-scroll");
  const slideEl = root.querySelector(".story-slide");
  const bars = [...root.querySelectorAll(".story-progress i")];
  let i = 0, elapsed = 0, last = performance.now(), paused = false, raf = 0;

  const countUp = () => {
    for (const el of slideEl.querySelectorAll("[data-count]")) {
      const target = +el.dataset.count;
      if (reduced) continue;
      const start = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - start) / 1200);
        el.textContent = num(target * (1 - (1 - k) ** 3));
        if (k < 1 && el.isConnected) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  };
  const show = (n) => {
    i = Math.max(0, Math.min(list.length - 1, n));
    elapsed = 0;
    root.dataset.theme = list[i].theme;
    slideEl.innerHTML = `<div class="s-content">${list[i].html}</div>`;
    bars.forEach((b, k) => (b.style.width = k < i ? "100%" : "0%"));
    countUp();
  };
  const tick = (now) => {
    const dt = now - last;
    last = now;
    if (!paused && i < list.length - 1) {
      elapsed += dt;
      bars[i].style.width = `${Math.min(100, (elapsed / SLIDE_MS) * 100)}%`;
      if (elapsed >= SLIDE_MS) show(i + 1);
    } else if (i === list.length - 1) bars[i].style.width = "100%";
    raf = requestAnimationFrame(tick);
  };
  const setPaused = (v) => {
    paused = v;
    root.querySelector(".story-pause").textContent = v ? "▶" : "❚❚";
    root.querySelector(".story-pause").setAttribute("aria-label", v ? "Play" : "Pause");
  };
  const close = () => {
    cancelAnimationFrame(raf);
    root.remove();
    document.body.classList.remove("no-scroll");
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("visibilitychange", onVis);
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowRight") show(i + 1);
    else if (e.key === "ArrowLeft") show(i - 1);
    else if (e.key === " ") { e.preventDefault(); setPaused(!paused); }
  };
  const onVis = () => document.hidden && setPaused(true);

  root.querySelector(".story-close").onclick = close;
  root.querySelector(".story-pause").onclick = () => setPaused(!paused);
  root.querySelector(".prev").onclick = () => show(i - 1);
  root.querySelector(".next").onclick = () => show(i + 1);
  // Press and hold to pause, like Instagram stories.
  let holdTimer = 0, held = false;
  for (const nav of root.querySelectorAll(".story-nav")) {
    nav.addEventListener("pointerdown", () => { held = false; holdTimer = setTimeout(() => { held = true; setPaused(true); }, 250); });
    nav.addEventListener("pointerup", (e) => { clearTimeout(holdTimer); if (held) { e.preventDefault(); setPaused(false); } });
    nav.addEventListener("click", (e) => { if (held) { e.stopImmediatePropagation(); held = false; } }, true);
  }
  slideEl.addEventListener("click", (e) => {
    const a = e.target.closest("[data-action]")?.dataset.action;
    if (!a) return;
    if (a === "close") close();
    else if (a === "replay") show(0);
    else onAction?.(a);
  });
  document.addEventListener("keydown", onKey);
  document.addEventListener("visibilitychange", onVis);
  show(0);
  raf = requestAnimationFrame(tick);
  root.querySelector(".story-close").focus();
  return close;
}
