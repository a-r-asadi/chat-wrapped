import { test } from "node:test";
import assert from "node:assert/strict";
import { listChats, normalizeChat } from "../js/parser.js";
import { analyze, tokenize, normalizeText, emojisOf } from "../js/analyze.js";
import { makeDemoExport } from "../js/demo.js";

const msg = (id, date, from, text, extra = {}) => ({
  id, type: "message", date, date_unixtime: String(Date.parse(date + "Z") / 1000), from, from_id: from === "Ali" ? "user1" : "user2",
  text, text_entities: [{ type: "plain", text }], ...extra,
});

const tiny = {
  name: "Sara", type: "personal_chat", id: 2,
  messages: [
    msg(1, "2024-01-01T10:00:00", "Ali", "hey how are you?"),
    msg(2, "2024-01-01T10:05:00", "Sara", "hahaha good, I love you ❤️"),
    msg(3, "2024-01-01T10:06:00", "Sara", "سلام خوبی؟ دلم برات تنگ شده"),
    msg(4, "2024-01-02T23:30:00", "Ali", "good night 🌙"),
    msg(5, "2024-01-03T01:00:00", "Ali", "salam chetori merci"),
    { id: 6, type: "service", date: "2024-01-03T02:00:00", date_unixtime: "1704247200", actor: "Sara", actor_id: "user2", action: "phone_call", duration_seconds: 120, text: "" },
    msg(7, "2024-01-03T09:00:00", "Sara", "", { media_type: "sticker", sticker_emoji: "😂", file: "x" }),
  ],
};

test("tokenizer handles English, Persian and emojis", () => {
  assert.deepEqual(tokenize(normalizeText("Hello, WORLD! https://x.com 42")), ["hello", "world"]);
  assert.deepEqual(tokenize(normalizeText("دلم برات تنگ شده")), ["دلم", "برات", "تنگ", "شده"]);
  assert.deepEqual(emojisOf("hi ❤️👍🏽 👨‍👩‍👧"), ["❤\uFE0F", "👍🏽", "👨‍👩‍👧"]);
});

test("tiny chat stats", () => {
  const chat = normalizeChat(listChats(tiny)[0]);
  assert.equal(chat.people.find((p) => p.isYou).name, "Ali");
  const r = analyze(chat, { today: new Date("2024-06-01") });
  assert.equal(r.totals.messages, 6);
  assert.equal(r.people[0].name, "Ali"); // you first
  assert.equal(r.people[0].messages, 3);
  assert.equal(r.time.streak.length, 3);
  assert.equal(r.calls.total, 1);
  assert.equal(r.calls.seconds, 120);
  const c = Object.fromEntries(r.content.counters.map((x) => [x.key, x.per]));
  assert.deepEqual(c.love, [0, 1]);
  assert.deepEqual(c.miss, [0, 1]);
  assert.deepEqual(c.night, [1, 0]);
  assert.deepEqual(c.thanks, [1, 0]);
  assert.equal(r.people[1].laughMsgs, 1);
  assert.equal(r.people[0].madeLaugh, 1);
  assert.equal(r.media.kinds.sticker[1], 1);
  const langs = Object.fromEntries(r.advanced.languages.map((l) => [l.lang, l.count]));
  assert.equal(langs.Persian, 1);
  assert.equal(langs.Finglish, 1);
  assert.equal(r.dynamics.conversations, 3);
  assert.deepEqual(r.people.map((p) => p.starters), [2, 1]);
});

test("demo export runs end to end", () => {
  const t0 = Date.now();
  const r = analyze(normalizeChat(makeDemoExport()));
  assert.ok(r.totals.messages > 5000, `messages: ${r.totals.messages}`);
  assert.ok(r.time.longestSilence.gap > 8 * 864e5);
  assert.ok(r.personalities[0].length && r.personalities[1].length);
  assert.ok(r.calls.total > 10);
  JSON.stringify(r); // must be serializable
  console.log(`demo: ${r.totals.messages} messages analyzed in ${Date.now() - t0} ms`);
});

test("fight detection flags arguments but not excitement or make-ups", () => {
  const lines = (start, rows) => rows.map(([from, text], i) => msg(100 + i + start, `2024-02-0${start}T21:${String(10 + i).padStart(2, "0")}:00`, from, text));
  const chat = {
    name: "Sara", type: "personal_chat", id: 2,
    messages: [
      ...lines(1, [["Ali", "you said you'd call"], ["Sara", "I was tired"], ["Ali", "you always say that"], ["Sara", "seriously?!"], ["Ali", "whatever"], ["Sara", "ok."]]),
      ...lines(3, [["Ali", "we got the tickets!!"], ["Sara", "yesss!!"], ["Ali", "can't wait!!!"], ["Sara", "omg!!"]]),
      ...lines(5, [["Ali", "sorry about yesterday"], ["Sara", "me too, I'm sorry ❤️"], ["Ali", "love you"]]),
    ],
  };
  const r = analyze(normalizeChat(listChats(chat)[0]), { today: new Date("2024-03-01") });
  const days = r.relationship.candidates.map((c) => c.day);
  assert.deepEqual(days, ["2024-02-01"]);
  assert.ok(r.relationship.weeks.length >= 1);
});
