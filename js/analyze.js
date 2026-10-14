// Computes every stat from a normalized chat (see parser.js). Pure function, runs in a worker.
import { STOPWORDS, LAUGH_RE, COUNTERS, SENTIMENT, SENTIMENT_EMOJI, NEGATORS, TOPICS, FINGLISH } from "./lexicons.js";

const HOUR = 3600e3;
const DAY = 24 * HOUR;
export const SESSION_GAP = 6 * HOUR; // silence that starts a new conversation
const DOUBLE_TEXT_GAP = 10 * 60e3; // following up your own message after this long
const UNANSWERED_GAP = 12 * HOUR;
const MAX_PEOPLE = 8;
const LAUGH_TOKEN_RE = new RegExp(`^(?:${LAUGH_RE.source})$`, "u");

// ---------- text helpers ----------

const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;
const DIACRITICS_RE = /[ً-ٰٟـ]/g; // Arabic harakat + tatweel
const TOKEN_RE = /[\p{L}\p{N}‌'’]+/gu;
const PICTO_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const segmenter = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

export function normalizeText(s) {
  return s.toLowerCase().replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/ة/g, "ه").replace(DIACRITICS_RE, "");
}

export function tokenize(norm) {
  const out = [];
  for (const m of norm.replace(URL_RE, " ").matchAll(TOKEN_RE)) {
    let w = m[0].replace(/^[‌'’]+|[‌'’]+$/g, "").replace(/’/g, "'");
    if (w.length < 2 || /^\d+$/.test(w)) continue;
    out.push(w);
  }
  return out;
}

// Single emojis get a consistent variation selector so ❤ and ❤️ count as one (and render in color).
export function normEmoji(e) {
  const bare = e.replace(/\uFE0F/g, "");
  if ([...bare].length !== 1) return e;
  return /\p{Emoji_Presentation}/u.test(bare) ? bare : bare + "\uFE0F";
}

export function emojisOf(text) {
  if (!PICTO_RE.test(text)) return [];
  const out = [];
  if (segmenter) {
    for (const { segment } of segmenter.segment(text)) {
      if (PICTO_RE.test(segment)) out.push(normEmoji(segment));
    }
  } else {
    for (const ch of text) if (PICTO_RE.test(ch)) out.push(normEmoji(ch));
  }
  return out;
}

const PERSIAN_ONLY = /[پچژگیک]/;
function languageOf(raw, tokens) {
  let arabic = 0, latin = 0, cyrillic = 0, other = 0;
  for (const ch of raw) {
    const c = ch.codePointAt(0);
    if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || (c >= 0xc0 && c <= 0x24f)) latin++;
    else if ((c >= 0x600 && c <= 0x6ff) || (c >= 0xfb50 && c <= 0xfeff) || (c >= 0x750 && c <= 0x77f)) arabic++;
    else if (c >= 0x400 && c <= 0x4ff) cyrillic++;
    else if (/\p{L}/u.test(ch)) other++;
  }
  const max = Math.max(arabic, latin, cyrillic, other);
  if (max === 0) return null;
  if (max === arabic) return PERSIAN_ONLY.test(raw) || !/[يكة]/.test(raw) ? "Persian" : "Arabic";
  if (max === cyrillic) return "Russian";
  if (max === other) return "Other";
  let fin = 0;
  for (const t of tokens) if (FINGLISH.has(t)) fin++;
  if (fin >= 2 || (fin === 1 && tokens.length <= 3)) return "Finglish";
  return "English";
}

// Group laughs into families so "hahaha" and "hahahahaha" count as one style.
function laughStyle(l) {
  if (/\p{Extended_Pictographic}/u.test(l)) return l;
  if (/^a?h[ha]*$/.test(l)) return "haha";
  if (/^h[he]+$/.test(l)) return "hehe";
  if (/^l+o+l+$/.test(l)) return "lol";
  if (/^lmf?a+o+$/.test(l)) return l.includes("f") ? "lmfao" : "lmao";
  if (/^x+d+$/.test(l)) return "xd";
  if (/^kh/.test(l)) return "khkh";
  if (/^خ+$/.test(l)) return "خخخ";
  if (/^[ها]+$/.test(l)) return l.includes("ا") ? "هاها" : "ههه";
  return l.length > 8 ? l.slice(0, 8) + "…" : l;
}

const dayIndex = (day) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / DAY;
const dayFromIndex = (i) => new Date(i * DAY).toISOString().slice(0, 10);
const median = (arr) => {
  if (!arr.length) return null;
  const s = Float64Array.from(arr).sort();
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const zeros = (n) => new Array(n).fill(0);
const ref = (m, idx) => m && { t: m.t, day: m.day, from: idx(m), text: (m.text || "").slice(0, 400), kind: m.kind };

function topN(map, n, filter) {
  const arr = [];
  for (const [k, v] of map) if (!filter || filter(k, v)) arr.push([k, v]);
  return arr.sort((a, b) => sumOf(b[1]) - sumOf(a[1])).slice(0, n);
}
const sumOf = (v) => (Array.isArray(v) ? v.reduce((a, b) => a + b, 0) : v);

// Words/emojis much more typical of one person than of everyone else.
function signature(map, totals, person, n, minCount) {
  const N = totals[person];
  const rest = totals.reduce((a, b) => a + b, 0) - N;
  if (!N || !rest) return [];
  const out = [];
  for (const [k, counts] of map) {
    const c = counts[person];
    if (c < minCount) continue;
    const o = sumOf(counts) - c;
    const ratio = (c / N) / ((o + 0.5) / rest);
    if (ratio < 1.6) continue;
    out.push({ key: k, count: c, other: o, score: Math.log(ratio) * Math.log(1 + c) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, n);
}

// ---------- main ----------

export function analyze(chat, { today = new Date() } = {}) {
  const msgs = chat.messages;
  if (!msgs.length) throw new Error("This chat has no messages.");

  // People: cap at MAX_PEOPLE, folding the rest into "Others".
  let people = chat.people.map((p) => ({ ...p }));
  const indexOf = new Map();
  if (people.length > MAX_PEOPLE) {
    const kept = people.slice(0, MAX_PEOPLE - 1);
    const others = people.slice(MAX_PEOPLE - 1);
    people = [...kept, { id: "__others", name: `${others.length} others`, isYou: false, count: others.reduce((a, p) => a + p.count, 0) }];
    others.forEach((p) => indexOf.set(p.id, MAX_PEOPLE - 1));
  }
  people.forEach((p, i) => indexOf.has(p.id) || indexOf.set(p.id, i));
  // Put "you" first so colors stay stable (you = slot 1).
  const youIdx = people.findIndex((p) => p.isYou);
  if (youIdx > 0) {
    const order = [youIdx, ...people.map((_, i) => i).filter((i) => i !== youIdx)];
    const remap = new Map(order.map((old, neu) => [old, neu]));
    people = order.map((i) => people[i]);
    for (const [k, v] of indexOf) indexOf.set(k, remap.get(v));
  }
  const P = people.length;
  const idx = (m) => indexOf.get(m.from) ?? 0;

  // ---------- accumulators ----------
  const per = () => zeros(P);
  const counts = per(), words = per(), chars = per(), textMsgs = per(), emojiTotal = per(), questions = per();
  const laughMsgs = per(), laughUnits = per(), madeLaugh = per();
  const night = per(), early = per();
  const hourly = Array.from({ length: P }, () => zeros(24));
  const weekday = Array.from({ length: P }, () => zeros(7));
  const heat = Array.from({ length: 7 }, () => zeros(24));
  const monthly = new Map(); // ym -> per person
  const daily = new Map(); // day -> per person
  const yearly = new Map();
  const longest = Array(P).fill(null);
  const firstBy = Array(P).fill(null);
  const wordMap = new Map(), bigramMap = new Map(), emojiMap = new Map(), laughStyles = new Map();
  let longestLaugh = null;
  const counterHits = COUNTERS.map(() => per());
  const counterFirst = COUNTERS.map(() => null);
  const media = {};
  const mediaKinds = ["photo", "video", "videoNote", "voice", "audio", "sticker", "gif", "file", "poll", "location", "liveLocation", "contact", "link", "forwarded", "edited", "reply"];
  for (const k of mediaKinds) media[k] = per();
  const voiceSeconds = per(), videoNoteSeconds = per();
  const stickerEmoji = new Map(), domains = new Map();
  const reactionsGiven = per(), reactionsReceived = per(), reactionEmoji = new Map();
  const sentPos = per(), sentNeg = per();
  const sentMonthly = new Map(); // ym -> [pos..., neg...]
  const topicCounts = TOPICS.map(() => per());
  const topicSets = TOPICS.map((t) => new Set(t.words.flatMap((w) => (PICTO_RE.test(w) ? emojisOf(w) : [w]))));
  const langCounts = new Map(); // lang -> per person
  const sentByDay = new Map();

  // conversation dynamics
  const starters = per(), enders = per(), doubleTexts = per();
  const replyTimes = Array.from({ length: P }, () => []);
  const replyBuckets = Array.from({ length: P }, () => zeros(6));
  const BUCKETS = [60e3, 5 * 60e3, 30 * 60e3, 2 * HOUR, 12 * HOUR, Infinity];
  let slowest = Array(P).fill(null);
  const maxBurst = Array(P).fill(null);
  let burstLen = 0, burstStart = null;
  const burstsCount = per(), burstsMsgs = per();
  const unanswered = per();
  let longestWaitQ = Array(P).fill(null);
  let pendingQ = [];
  const sessions = [];
  let session = null;
  let longestSilence = null;

  const flushBurst = (prevMsg) => {
    if (!burstStart) return;
    const s = idx(burstStart);
    burstsCount[s]++;
    burstsMsgs[s] += burstLen;
    if (!maxBurst[s] || burstLen > maxBurst[s].count) maxBurst[s] = { count: burstLen, start: ref(burstStart, idx), end: prevMsg.t };
  };

  let prev = null;
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    const s = idx(m);
    counts[s]++;
    if (!firstBy[s]) firstBy[s] = ref(m, idx);

    // time
    hourly[s][m.hour]++;
    weekday[s][m.wd]++;
    heat[m.wd][m.hour]++;
    if (m.hour < 5) night[s]++;
    else if (m.hour < 9) early[s]++;
    (monthly.get(m.ym) || monthly.set(m.ym, per()).get(m.ym))[s]++;
    (daily.get(m.day) || daily.set(m.day, per()).get(m.day))[s]++;
    const y = m.day.slice(0, 4);
    (yearly.get(y) || yearly.set(y, per()).get(y))[s]++;

    // media
    if (m.kind !== "text" && media[m.kind]) media[m.kind][s]++;
    if (m.kind === "voice") voiceSeconds[s] += m.duration;
    if (m.kind === "videoNote") videoNoteSeconds[s] += m.duration;
    if (m.kind === "sticker" && m.stickerEmoji) {
      const e = normEmoji(m.stickerEmoji);
      stickerEmoji.set(e, (stickerEmoji.get(e) || 0) + 1);
    }
    if (m.links.length) {
      media.link[s] += m.links.length;
      for (const l of m.links) {
        const d = (l.match(/^(?:https?:\/\/)?(?:www\.)?([^/?#\s]+)/i) || [])[1];
        if (d) domains.set(d.toLowerCase(), (domains.get(d.toLowerCase()) || 0) + 1);
      }
    }
    if (m.forwarded) media.forwarded[s]++;
    if (m.edited) media.edited[s]++;
    if (m.replyTo != null) media.reply[s]++;
    if (m.reactions.length) {
      reactionsReceived[s] += m.reactions.length;
      for (const r of m.reactions) {
        if (r.emoji) {
          const e = normEmoji(r.emoji);
          reactionEmoji.set(e, (reactionEmoji.get(e) || 0) + 1);
        }
        const by = r.by != null ? indexOf.get(r.by) : P === 2 ? 1 - s : undefined;
        if (by != null) reactionsGiven[by]++;
      }
    }

    // text
    const raw = m.text || "";
    let isQuestion = false, laughed = false, emo = [], toks = [];
    if (raw && !m.forwarded) {
      const norm = normalizeText(raw);
      toks = tokenize(norm);
      emo = emojisOf(raw);
      textMsgs[s]++;
      words[s] += toks.length;
      chars[s] += [...raw].length;
      if (!longest[s] || raw.length > longest[s].length) longest[s] = { length: raw.length, words: toks.length, msg: ref(m, idx) };

      for (let j = 0; j < toks.length; j++) {
        const w = toks[j];
        if (!STOPWORDS.has(w) && !LAUGH_TOKEN_RE.test(w)) {
          let a = wordMap.get(w);
          if (!a) wordMap.set(w, (a = per()));
          a[s]++;
        }
        if (j > 0) {
          const w0 = toks[j - 1];
          if (!(STOPWORDS.has(w0) && STOPWORDS.has(w)) && w0 !== w) {
            const k = w0 + " " + w;
            let a = bigramMap.get(k);
            if (!a) bigramMap.set(k, (a = per()));
            a[s]++;
          }
        }
      }
      if (bigramMap.size > 400000) for (const [k, v] of bigramMap) if (sumOf(v) < 2) bigramMap.delete(k);

      for (const e of emo) {
        let a = emojiMap.get(e);
        if (!a) emojiMap.set(e, (a = per()));
        a[s]++;
      }
      emojiTotal[s] += emo.length;

      isQuestion = /[?؟]/.test(raw);
      if (isQuestion) questions[s]++;

      LAUGH_RE.lastIndex = 0;
      const laughs = norm.match(LAUGH_RE);
      if (laughs) {
        laughed = true;
        laughMsgs[s]++;
        laughUnits[s] += laughs.length;
        for (const l of laughs) {
          const style = laughStyle(l);
          laughStyles.set(style, (laughStyles.get(style) || 0) + 1);
          if (!/\p{Extended_Pictographic}/u.test(l) && (!longestLaugh || l.length > longestLaugh.text.length)) {
            longestLaugh = { text: l, from: s, day: m.day };
          }
        }
        if (prev && idx(prev) !== s && m.t - prev.t < 30 * 60e3) madeLaugh[idx(prev)]++;
      }

      COUNTERS.forEach((c, ci) => {
        if (c.re.test(raw)) {
          counterHits[ci][s]++;
          if (!counterFirst[ci]) counterFirst[ci] = ref(m, idx);
        }
      });

      // sentiment
      let pos = 0, neg = 0;
      for (let j = 0; j < toks.length; j++) {
        const v = SENTIMENT.get(toks[j]);
        if (!v) continue;
        const flipped = j > 0 && NEGATORS.has(toks[j - 1]) ? -v : v;
        flipped > 0 ? pos++ : neg++;
      }
      for (const e of emo) {
        const v = SENTIMENT_EMOJI.get(e.replace(/\uFE0F/g, ""));
        if (v > 0) pos++;
        else if (v < 0) neg++;
      }
      if (pos || neg) {
        sentPos[s] += pos;
        sentNeg[s] += neg;
        let sm = sentMonthly.get(m.ym);
        if (!sm) sentMonthly.set(m.ym, (sm = zeros(P * 2)));
        sm[s] += pos;
        sm[P + s] += neg;
        let sd = sentByDay.get(m.day);
        if (!sd) sentByDay.set(m.day, (sd = [0, 0]));
        sd[0] += pos;
        sd[1] += neg;
      }

      // topics
      if (toks.length || emo.length) {
        TOPICS.forEach((_, ti) => {
          const set = topicSets[ti];
          if (toks.some((t) => set.has(t) || (t.length > 3 && t.endsWith("s") && set.has(t.slice(0, -1)))) || emo.some((e) => set.has(e))) {
            topicCounts[ti][s]++;
          }
        });
      }

      // language
      const lang = languageOf(raw, toks);
      if (lang) (langCounts.get(lang) || langCounts.set(lang, per()).get(lang))[s]++;
    }

    // ---------- dynamics ----------
    const gap = prev ? m.t - prev.t : Infinity;
    if (gap >= SESSION_GAP) {
      if (session) sessions.push(session);
      starters[s]++;
      if (prev) enders[idx(prev)]++;
      session = { start: m.t, end: m.t, count: 0, first: ref(m, idx), per: per() };
      if (prev && (!longestSilence || gap > longestSilence.gap)) {
        longestSilence = { gap, before: ref(prev, idx), after: ref(m, idx) };
      }
    }
    session.count++;
    session.end = m.t;
    session.per[s]++;

    if (prev && idx(prev) === s) {
      burstLen++;
      if (gap >= DOUBLE_TEXT_GAP) doubleTexts[s]++;
    } else {
      if (prev) flushBurst(prev);
      burstLen = 1;
      burstStart = m;
      if (prev) {
        replyTimes[s].push(gap);
        replyBuckets[s][BUCKETS.findIndex((b) => gap < b)]++;
        if (!slowest[s] || gap > slowest[s].gap) slowest[s] = { gap, prompt: ref(prev, idx), reply: ref(m, idx) };
      }
    }

    // questions left hanging
    if (pendingQ.length) {
      const keep = [];
      for (const q of pendingQ) {
        if (q.s === s) { keep.push(q); continue; }
        const wait = m.t - q.m.t;
        if (wait > UNANSWERED_GAP) unanswered[q.s]++;
        if (!longestWaitQ[q.s] || wait > longestWaitQ[q.s].wait) longestWaitQ[q.s] = { wait, q: ref(q.m, idx), a: ref(m, idx) };
      }
      pendingQ = keep;
    }
    if (isQuestion) pendingQ.push({ m, s });
    void laughed;
    prev = m;
  }
  if (prev) {
    flushBurst(prev);
    enders[idx(prev)]++;
  }
  if (session) sessions.push(session);
  for (const q of pendingQ) unanswered[q.s]++;

  const first = msgs[0], last = msgs[msgs.length - 1];
  const total = msgs.length;

  // ---------- calendar ----------
  const days = [...daily.keys()].sort();
  const firstDay = dayIndex(first.day), lastDay = dayIndex(last.day);
  const spanDays = lastDay - firstDay + 1;
  let streak = { length: 0 }, run = 0, runStart = null, prevIdx = null;
  for (const d of days) {
    const di = dayIndex(d);
    if (prevIdx != null && di === prevIdx + 1) run++;
    else { run = 1; runStart = d; }
    if (run > streak.length) streak = { length: run, start: runStart, end: d };
    prevIdx = di;
  }
  const todayKey = today.toISOString().slice(0, 10);
  let current = 0;
  if (days.length && dayIndex(todayKey) - dayIndex(days[days.length - 1]) <= 1) {
    for (let j = days.length - 1; j >= 0; j--) {
      if (j === days.length - 1 || dayIndex(days[j]) === dayIndex(days[j + 1]) - 1) current++;
      else break;
    }
  }

  // months, continuous
  const months = [];
  {
    let [yy, mm] = first.ym.split("-").map(Number);
    const [ly, lm] = last.ym.split("-").map(Number);
    while (yy < ly || (yy === ly && mm <= lm)) {
      const key = `${yy}-${String(mm).padStart(2, "0")}`;
      months.push({ ym: key, per: monthly.get(key) || per() });
      if (++mm > 12) { mm = 1; yy++; }
    }
  }
  const goldenMonth = months.reduce((a, b) => (sumOf(b.per) > sumOf(a.per) ? b : a));

  // busiest day
  let busiest = null;
  for (const [d, v] of daily) if (!busiest || sumOf(v) > busiest.count) busiest = { day: d, count: sumOf(v), per: v };
  {
    const dayMsgs = msgs.filter((m) => m.day === busiest.day);
    const hours = zeros(24);
    dayMsgs.forEach((m) => hours[m.hour]++);
    const peak = hours.indexOf(Math.max(...hours));
    const wc = new Map();
    for (const m of dayMsgs) for (const w of tokenize(normalizeText(m.text || ""))) if (!STOPWORDS.has(w)) wc.set(w, (wc.get(w) || 0) + 1);
    const texty = dayMsgs.filter((m) => m.hour === peak && m.text && m.text.length > 2);
    const startAt = Math.max(0, Math.floor(texty.length / 2) - 3);
    busiest.peakHour = peak;
    busiest.topWords = [...wc].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w, c]) => ({ word: w, count: c }));
    busiest.sample = texty.slice(startAt, startAt + 6).map((m) => ref(m, idx));
    busiest.hours = hours;
  }

  // ---------- derived ----------
  const sessionLengths = sessions.map((x) => x.count);
  const longestSession = sessions.reduce((a, b) => (b.count > a.count ? b : a), sessions[0]);
  const totalWords = words.reduce((a, b) => a + b, 0);

  const replyStats = people.map((_, s) => {
    const arr = replyTimes[s];
    const within = arr.filter((g) => g < SESSION_GAP);
    return {
      count: arr.length,
      median: median(within),
      mean: within.length ? within.reduce((a, b) => a + b, 0) / within.length : null,
      underMinute: arr.length ? arr.filter((g) => g < 60e3).length / arr.length : 0,
      buckets: replyBuckets[s],
      slowest: slowest[s],
    };
  });

  const tokensTotals = people.map((_, s) => {
    let n = 0;
    for (const v of wordMap.values()) n += v[s];
    return n;
  });
  const emojiTotals = emojiTotal;

  const topWords = topN(wordMap, 60).map(([w, v]) => ({ word: w, count: sumOf(v), per: v }));
  const topWordsBy = people.map((_, s) => [...wordMap].filter(([, v]) => v[s] > 0).sort((a, b) => b[1][s] - a[1][s]).slice(0, 15).map(([w, v]) => ({ word: w, count: v[s] })));
  const signatureWords = people.map((_, s) => signature(wordMap, tokensTotals, s, 10, Math.max(4, Math.round(total / 20000))));
  const bigramTotals = people.map((_, s) => {
    let n = 0;
    for (const v of bigramMap.values()) n += v[s];
    return n;
  });
  const signaturePhrases = people.map((_, s) => signature(bigramMap, bigramTotals, s, 8, Math.max(3, Math.round(total / 30000))));
  const topPhrases = topN(bigramMap, 15, (k) => !k.split(" ").every((w) => STOPWORDS.has(w))).map(([w, v]) => ({ phrase: w, count: sumOf(v), per: v }));

  const topEmojis = topN(emojiMap, 20).map(([e, v]) => ({ emoji: e, count: sumOf(v), per: v }));
  const topEmojisBy = people.map((_, s) => [...emojiMap].filter(([, v]) => v[s] > 0).sort((a, b) => b[1][s] - a[1][s]).slice(0, 10).map(([e, v]) => ({ emoji: e, count: v[s] })));
  const signatureEmoji = people.map((_, s) => signature(emojiMap, emojiTotals, s, 3, 3)[0]?.key || topEmojisBy[s][0]?.emoji || null);

  const sentiment = {
    overall: people.map((_, s) => (sentPos[s] + sentNeg[s] ? (sentPos[s] - sentNeg[s]) / (sentPos[s] + sentNeg[s]) : 0)),
    pos: sentPos,
    neg: sentNeg,
    monthly: months.map(({ ym }) => {
      const sm = sentMonthly.get(ym);
      return {
        ym,
        per: people.map((_, s) => {
          if (!sm) return null;
          const p = sm[s], n = sm[P + s];
          return p + n >= 5 ? (p - n) / (p + n) : null;
        }),
      };
    }),
  };
  {
    let best = null, worst = null;
    for (const [d, [p, n]] of sentByDay) {
      if (p + n < 8) continue;
      const v = (p - n) / (p + n);
      if (!best || v > best.v || (v === best.v && p + n > best.n)) best = { day: d, v, n: p + n };
      if (!worst || v < worst.v || (v === worst.v && p + n > worst.n)) worst = { day: d, v, n: p + n };
    }
    sentiment.happiestDay = best;
    sentiment.saddestDay = worst && worst.v < 0 ? worst : null;
  }

  const topics = TOPICS.map((t, ti) => ({ key: t.key, label: t.label, icon: t.icon, count: sumOf(topicCounts[ti]), per: topicCounts[ti] }))
    .sort((a, b) => b.count - a.count);
  const languages = [...langCounts].map(([lang, v]) => ({ lang, count: sumOf(v), per: v })).sort((a, b) => b.count - a.count);

  // calls
  const callStats = (() => {
    const calls = chat.calls;
    const byPerson = per(), missed = per(), seconds = per();
    let longestCall = null;
    for (const c of calls) {
      const s = indexOf.get(c.by);
      if (s == null) continue;
      byPerson[s]++;
      seconds[s] += c.duration;
      if (c.reason === "missed" || c.reason === "busy") missed[s]++;
      if (!longestCall || c.duration > longestCall.duration) longestCall = { duration: c.duration, day: c.day, from: s };
    }
    const answered = calls.filter((c) => c.duration > 0);
    return {
      total: calls.length,
      byPerson,
      missed,
      seconds: sumOf(seconds),
      avg: answered.length ? sumOf(seconds) / answered.length : 0,
      longest: longestCall,
    };
  })();

  // throwback: same calendar day in a previous year, else a random day
  const throwback = (() => {
    const md = todayKey.slice(5);
    const thisYear = +todayKey.slice(0, 4);
    const candidates = days.filter((d) => d.slice(5) === md && +d.slice(0, 4) < thisYear);
    const pick = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
    const dayKey = pick || days[Math.floor(Math.random() * days.length)];
    const dm = msgs.filter((m) => m.day === dayKey && m.text && !m.forwarded);
    if (!dm.length) return null;
    const anchor = Math.floor(Math.random() * Math.max(1, dm.length - 5));
    return { day: dayKey, onThisDay: !!pick, yearsAgo: pick ? thisYear - +pick.slice(0, 4) : null, messages: dm.slice(anchor, anchor + 5).map((m) => ref(m, idx)) };
  })();

  const personStats = people.map((p, s) => ({
    ...p,
    messages: counts[s],
    share: counts[s] / total,
    words: words[s],
    chars: chars[s],
    textMessages: textMsgs[s],
    avgWords: textMsgs[s] ? words[s] / textMsgs[s] : 0,
    avgChars: textMsgs[s] ? chars[s] / textMsgs[s] : 0,
    longest: longest[s],
    first: firstBy[s],
    nightShare: counts[s] ? night[s] / counts[s] : 0,
    earlyShare: counts[s] ? early[s] / counts[s] : 0,
    emojiPerMsg: textMsgs[s] ? emojiTotal[s] / textMsgs[s] : 0,
    emojis: emojiTotal[s],
    questions: questions[s],
    questionShare: textMsgs[s] ? questions[s] / textMsgs[s] : 0,
    laughMsgs: laughMsgs[s],
    laughUnits: laughUnits[s],
    madeLaugh: madeLaugh[s],
    starters: starters[s],
    enders: enders[s],
    doubleTexts: doubleTexts[s],
    avgBurst: burstsCount[s] ? burstsMsgs[s] / burstsCount[s] : 0,
    maxBurst: maxBurst[s],
    unanswered: unanswered[s],
    longestWait: longestWaitQ[s],
    reply: replyStats[s],
    signatureEmoji: signatureEmoji[s],
    hourly: hourly[s],
    weekday: weekday[s],
    peakHour: hourly[s].indexOf(Math.max(...hourly[s])),
    reactionsGiven: reactionsGiven[s],
    reactionsReceived: reactionsReceived[s],
    voiceSeconds: voiceSeconds[s],
    videoNoteSeconds: videoNoteSeconds[s],
  }));

  const result = {
    chat: { name: chat.name, type: chat.type },
    people: personStats,
    totals: {
      messages: total,
      words: totalWords,
      chars: chars.reduce((a, b) => a + b, 0),
      emojis: emojiTotal.reduce((a, b) => a + b, 0),
      start: first.t,
      end: last.t,
      firstDay: first.day,
      lastDay: last.day,
      spanDays,
      activeDays: days.length,
      activeShare: days.length / spanDays,
      perDay: total / spanDays,
      perActiveDay: total / days.length,
    },
    first: ref(first, idx),
    last: ref(last, idx),
    time: {
      heat,
      months,
      daily: days.map((d) => [d, sumOf(daily.get(d))]),
      yearly: [...yearly].map(([y, v]) => ({ year: y, per: v })).sort((a, b) => a.year.localeCompare(b.year)),
      busiest,
      goldenMonth: { ym: goldenMonth.ym, count: sumOf(goldenMonth.per), per: goldenMonth.per },
      streak,
      currentStreak: current,
      longestSilence,
      peakHour: heat.reduce((acc, row) => acc.map((v, h) => v + row[h]), zeros(24)).reduce((bi, v, h, arr) => (v > arr[bi] ? h : bi), 0),
      peakWeekday: heat.map((r) => sumOf(r)).reduce((bi, v, d, arr) => (v > arr[bi] ? d : bi), 0),
    },
    dynamics: {
      sessionGapHours: SESSION_GAP / HOUR,
      conversations: sessions.length,
      avgConversation: sessionLengths.length ? total / sessionLengths.length : 0,
      medianConversationMinutes: median(sessions.map((x) => (x.end - x.start) / 60e3)),
      longestConversation: longestSession && { count: longestSession.count, start: longestSession.start, end: longestSession.end, first: longestSession.first, per: longestSession.per },
      bucketsLabels: ["< 1 min", "1–5 min", "5–30 min", "30 min–2 h", "2–12 h", "12 h +"],
    },
    content: {
      topWords,
      topWordsBy,
      signatureWords,
      signaturePhrases,
      topPhrases,
      topEmojis,
      topEmojisBy,
      laughStyles: [...laughStyles].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([style, count]) => ({ style, count })),
      longestLaugh,
      counters: COUNTERS.map((c, ci) => ({ key: c.key, label: c.label, icon: c.icon, per: counterHits[ci], total: sumOf(counterHits[ci]), first: counterFirst[ci] })),
    },
    media: {
      kinds: Object.fromEntries(mediaKinds.map((k) => [k, media[k]])),
      voiceSeconds,
      videoNoteSeconds,
      stickerEmoji: [...stickerEmoji].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([emoji, count]) => ({ emoji, count })),
      domains: [...domains].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([domain, count]) => ({ domain, count })),
      reactionEmoji: [...reactionEmoji].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([emoji, count]) => ({ emoji, count })),
    },
    calls: callStats,
    advanced: { sentiment, topics, languages },
    throwback,
  };
  result.personalities = personalities(result);
  return result;
}

// ---------- personalities ----------

const TITLES = [
  { key: "yapper", title: "The Yapper", emoji: "🗣️", blurb: "sends the most messages", metric: (p) => p.messages },
  { key: "initiator", title: "The Initiator", emoji: "🚀", blurb: "starts most conversations", metric: (p) => p.starters },
  { key: "closer", title: "The Last Word", emoji: "🎤", blurb: "usually ends the conversation", metric: (p) => p.enders },
  { key: "speed", title: "The Speed Replier", emoji: "⚡", blurb: "replies the fastest", metric: (p) => (p.reply.median ? 1 / p.reply.median : 0) },
  { key: "slow", title: "The Slow Burner", emoji: "🐢", blurb: "takes their sweet time to reply", metric: (p) => p.reply.median || 0 },
  { key: "essayist", title: "The Essayist", emoji: "📜", blurb: "writes the longest messages", metric: (p) => p.avgWords },
  { key: "oneliner", title: "The One-Liner", emoji: "✂️", blurb: "keeps it short and sweet", metric: (p) => (p.avgWords ? 1 / p.avgWords : 0) },
  { key: "emoji", title: "The Emoji Maniac", emoji: "🤩", blurb: "uses the most emojis per message", metric: (p) => p.emojiPerMsg },
  { key: "owl", title: "The Night Owl", emoji: "🦉", blurb: "texts the most after midnight", metric: (p) => p.nightShare },
  { key: "bird", title: "The Early Bird", emoji: "🐦", blurb: "is up texting before 9am", metric: (p) => p.earlyShare },
  { key: "double", title: "The Double Texter", emoji: "📨", blurb: "follows up when left on read", metric: (p) => p.doubleTexts / Math.max(1, p.messages) },
  { key: "comedian", title: "The Comedian", emoji: "🤡", blurb: "makes the other person laugh the most", metric: (p) => p.madeLaugh },
  { key: "laugher", title: "The Giggler", emoji: "😂", blurb: "laughs at everything", metric: (p) => p.laughMsgs / Math.max(1, p.textMessages) },
  { key: "curious", title: "The Curious One", emoji: "🧐", blurb: "asks the most questions", metric: (p) => p.questionShare },
  { key: "sticker", title: "The Sticker Lord", emoji: "🦄", blurb: "replies in stickers", metric: (p, r, s) => r.media.kinds.sticker[s] + r.media.kinds.gif[s] },
  { key: "podcaster", title: "The Podcaster", emoji: "🎙️", blurb: "loves voice messages", metric: (p) => p.voiceSeconds + p.videoNoteSeconds },
  { key: "photographer", title: "The Photographer", emoji: "📸", blurb: "shares the most photos", metric: (p, r, s) => r.media.kinds.photo[s] + r.media.kinds.video[s] },
  { key: "sweet", title: "The Sweetheart", emoji: "💘", blurb: "says “love you” and “miss you” more", metric: (p, r, s) => r.content.counters[0].per[s] + r.content.counters[1].per[s] },
  { key: "sorry", title: "The Apologizer", emoji: "🙇", blurb: "says sorry the most", metric: (p, r, s) => r.content.counters[2].per[s] },
  { key: "polite", title: "The Polite One", emoji: "🎩", blurb: "never forgets to say thanks", metric: (p, r, s) => r.content.counters[3].per[s] },
  { key: "sunshine", title: "The Ray of Sunshine", emoji: "🌞", blurb: "is the most positive", metric: (p, r, s) => 1 + r.advanced.sentiment.overall[s] },
];

function personalities(r) {
  const people = r.people.filter((p) => p.id !== "__others");
  if (people.length < 2) return [];
  const awards = people.map(() => []);
  for (const t of TITLES) {
    const vals = people.map((p, s) => t.metric(p, r, s) || 0);
    const sorted = [...vals].sort((a, b) => b - a);
    const best = sorted[0], second = sorted[1];
    if (!best || best <= 0) continue;
    const margin = second > 0 ? best / second : 3;
    if (margin < 1.08) continue; // too close to call
    const winner = vals.indexOf(best);
    awards[winner].push({ key: t.key, title: t.title, emoji: t.emoji, blurb: t.blurb, margin: Math.min(margin, 10) });
  }
  return awards.map((a) => a.sort((x, y) => y.margin - x.margin).slice(0, 4));
}

export { dayFromIndex };
