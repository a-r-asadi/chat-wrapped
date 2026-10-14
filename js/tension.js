// Worker-side tracking for the "Fights & what changed" section.
// Splits the chat into exchanges (no gap over 45 min), scores each for tension, and keeps weekly signals.
import { FIGHT_RE, CURT_RE, STOPWORDS, TOPICS } from "./lexicons.js";

const SEGMENT_GAP = 45 * 60e3;
const LONG_SILENCE = 2 * 864e5;
const WEEK_DAYS = 7;

const zeros = (n) => new Array(n).fill(0);
const dayIndex = (day) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / 864e5;
const dayKey = (i) => new Date(i * 864e5).toISOString().slice(0, 10);
// Index of the first item whose time is >= t (items sorted by time).
function firstAtOrAfter(arr, t, time = (x) => x) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (time(arr[mid]) < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function createTensionTracker(P, idx, ref) {
  const weeks = new Map();
  const candidates = [];
  const silences = [];
  const warmTimes = [];
  const sorryEvents = [];
  let seg = null;
  let lastSegMsgs = [];

  const week = (m) => {
    const k = dayIndex(m.day) - m.wd;
    let w = weeks.get(k);
    if (!w) {
      w = { k, msgs: zeros(P), starters: zeros(P), aff: zeros(P), laughs: zeros(P), pos: zeros(P), neg: zeros(P), replyLog: zeros(P), replyN: zeros(P), double: zeros(P), words: zeros(P), text: zeros(P) };
      weeks.set(k, w);
    }
    return w;
  };

  const newSegment = (m) => ({
    start: m.t, end: m.t, day: m.day, hour: m.hour, wd: m.wd, n: 0, per: zeros(P),
    a: 0, b: 0, neg: 0, pos: 0, d: 0, e: 0, f: 0, w: 0, firstSorry: null,
    msgs: [], tokens: new Map(), tokenTotal: 0, topics: zeros(TOPICS.length), starter: idx(m),
  });

  function closeSegment(next) {
    if (!seg) return;
    const s = seg;
    seg = null;
    lastSegMsgs = s.msgs;
    const c = Math.max(0, s.neg - 0.5 * s.pos);
    const raw = 2 * s.a + 1.5 * s.b + c + 1.2 * s.d + 0.8 * s.e + 0.6 * s.f - 0.8 * s.w;
    const types = [s.a > 0, s.b > 0, c >= 2, s.d > 0, s.e > 0].filter(Boolean).length;
    const hostile = s.a + s.b + s.e; // apologies and sad words alone aren't a fight
    const silenceAfter = next ? next.t - s.end : null;
    let score = raw / Math.sqrt(Math.max(s.n, 4));
    if (silenceAfter != null && silenceAfter > 12 * 3600e3) score += 0.4;
    if (types < 2 || hostile < 2 || raw < 3 || score < 0.8) return;
    // Peek: how it started, then the most heated lines.
    const hot = s.msgs.filter((x, i) => x.hot && i > 0);
    const peek = [s.msgs[0], ...(hot.length >= 2 ? hot : s.msgs.slice(1))].slice(0, 7).map((x) => x.ref);
    candidates.push({
      id: s.start, start: s.start, end: s.end, day: s.day, hour: s.hour, wd: s.wd, count: s.n, per: s.per,
      score: +score.toFixed(3), signals: { fight: s.a, heated: s.b, negative: +c.toFixed(1), sorry: s.d, curt: s.e, long: s.f, warm: s.w },
      starter: s.starter, silenceAfter, reachedOut: next ? idx(next) : null, peek,
      tokens: [...s.tokens].sort((x, y) => y[1] - x[1]).slice(0, 15), tokenTotal: s.tokenTotal, topics: s.topics,
    });
  }

  return {
    // Called for every message, after the analyzer has derived text facts.
    message(m, s, f) {
      const gapPrev = seg ? m.t - seg.end : Infinity;
      if (gapPrev >= SEGMENT_GAP) {
        closeSegment(m);
        seg = newSegment(m);
      }
      const w = week(m);
      w.msgs[s]++;
      seg.n++;
      seg.end = m.t;
      seg.per[s]++;
      let hot = false;
      if (f.text) {
        w.text[s]++;
        w.words[s] += f.toks.length;
        if (f.laughed) w.laughs[s]++;
        if (f.affection) w.aff[s]++;
        w.pos[s] += f.pos;
        w.neg[s] += f.neg;
        const fight = FIGHT_RE.test(f.raw);
        // "?!", "??", "؟؟" or SHOUTING. Plain "!!" is usually excitement, so it doesn't count.
        const heated = /[?؟][!?؟]|![?؟]/.test(f.raw) || /^[^a-z]*[A-Z]{4,}[^a-z]*$/.test(f.raw);
        const curt = CURT_RE.test(f.raw.trim());
        if (fight) seg.a++;
        if (heated) seg.b++;
        if (curt) seg.e++;
        if (f.sorry) {
          seg.d++;
          sorryEvents.push([m.t, s]);
        }
        if (f.toks.length >= 35) seg.f++;
        seg.neg += f.neg;
        seg.pos += f.pos;
        const warm = f.laughed || f.affection || f.posEmoji;
        if (warm) {
          seg.w++;
          warmTimes.push(m.t);
        }
        hot = fight || heated || curt || f.sorry || f.neg > 0;
        for (const t of f.toks) {
          if (STOPWORDS.has(t)) continue;
          seg.tokens.set(t, (seg.tokens.get(t) || 0) + 1);
          seg.tokenTotal++;
        }
        f.topics.forEach((ti) => seg.topics[ti]++);
      }
      if (seg.msgs.length < 400) seg.msgs.push({ hot, ref: ref(m, idx) });
    },
    sessionStart(m, s, gap, prev) {
      week(m).starters[s]++;
      if (prev && gap >= LONG_SILENCE) silences.push({ gap, before: ref(prev, idx), after: ref(m, idx) });
    },
    reply(m, s, gap) {
      const w = week(m);
      w.replyLog[s] += Math.log(gap / 1000 + 1);
      w.replyN[s]++;
    },
    doubleText(m, s) {
      week(m).double[s]++;
    },
    finish() {
      closeSegment(null);
      // Who apologized first (within two days of the start), and how long until things felt warm again.
      for (const c of candidates) {
        const sorry = sorryEvents[firstAtOrAfter(sorryEvents, c.start, (x) => x[0])];
        c.apologizer = sorry && sorry[0] <= c.end + 2 * 864e5 ? sorry[1] : null;
        const warm = warmTimes[firstAtOrAfter(warmTimes, c.end + 1)];
        c.makeUp = warm != null ? warm - c.end : null;
      }
      const keys = [...weeks.keys()];
      const lo = Math.min(...keys), hi = Math.max(...keys);
      const empty = (k) => ({ k, msgs: zeros(P), starters: zeros(P), aff: zeros(P), laughs: zeros(P), pos: zeros(P), neg: zeros(P), replyLog: zeros(P), replyN: zeros(P), double: zeros(P), words: zeros(P), text: zeros(P) });
      const list = [];
      for (let k = lo; k <= hi; k += WEEK_DAYS) list.push({ ...(weeks.get(k) || empty(k)), week: dayKey(k) });
      list.forEach((w) => delete w.k);
      const text = lastSegMsgs.filter((x) => x.ref.text).slice(-8).map((x) => x.ref);
      return { candidates, weeks: list, silences: silences.sort((a, b) => b.gap - a.gap).slice(0, 300), lastConversation: text };
    },
  };
}
