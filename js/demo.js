// Generates a fake Telegram personal-chat export, so the page can be tried without real data.

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POOL = {
  you: [
    "hey", "heyy", "what are you up to?", "omg", "I'm so tired today", "did you eat?", "wanna grab coffee tomorrow?",
    "lol", "hahaha", "that's hilarious 😂", "wait what", "no wayyy", "I miss you", "love you ❤️", "good night 🌙",
    "good morning ☀️", "sorry I was in a meeting", "the project deadline is killing me", "thanks!!", "can you call me?",
    "send me the pic", "I'm on my way", "where are you?", "let's watch a movie tonight", "this song is so good 🎶",
    "I just finished work", "pizza tonight? 🍕", "you're the best", "ugh my boss again", "i can't sleep",
    "did you see the new episode?", "brb", "on the train now 🚆", "haha exactly", "same", "omg yes",
    "the coffee here is amazing ☕", "check this out", "happy birthday!!! 🎉🎂", "I'm so proud of you",
    "what do you want for dinner?", "salam chetori?", "merci azizam", "kheili khoobe", "دلم برات تنگ شده",
    "شب بخیر 🌙", "خخخخخ", "مرسی عزیزم", "فردا میای؟", "ببخشید دیر جواب دادم",
  ],
  them: [
    "hii", "not much, you?", "hahahahaha", "lmao", "😂😂😂", "yes!!", "nah", "maybe later", "I'm at the gym",
    "just woke up", "sure, what time?", "I'm hungry", "miss you too 🥺", "love you more ❤️", "good night ✨",
    "sorry sorry", "thank you ❤️", "can't talk now, call you later", "here's the pic", "omw", "at home",
    "the movie was so good 🎬", "you have to listen to this", "work was exhausting", "lol same", "that's so cute 🥰",
    "wait really?", "what happened?", "tell me everything", "hmm", "okkk", "I'll be there in 10", "deal",
    "I can't believe it", "so proud of you 🥹", "we should go on a trip ✈️", "the beach!!", "stop 😂",
    "you're crazy", "khkhkh", "are", "na baba", "kojai?", "عاشقتم", "منم دلم برات تنگ شده", "هههههه",
    "قربونت برم", "باشه فردا میبینمت",
  ],
  long: [
    "okay so you won't believe what happened today. I was walking to the station and my old teacher just walked past me, we ended up talking for like an hour about everything",
    "honestly I've been thinking a lot about what you said yesterday and I think you're right, I need to take a break from work and actually go on that trip we keep talking about",
    "so the plan is: we meet at the cafe at 6, grab something to eat, then the movie starts at 8:30 and after that we can walk by the river if it's not too cold",
  ],
  sticker: ["😂", "❤️", "😘", "🥺", "👍", "🙈", "😴", "🤔"],
  links: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://open.spotify.com/track/abc", "https://www.instagram.com/p/xyz", "https://maps.google.com/?q=cafe"],
};

const pad = (n) => String(n).padStart(2, "0");
const localStamp = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

export function makeDemoExport({ seed = 7, days = 820 } = {}) {
  const rnd = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const people = [
    { id: "user1000", name: "Alex", pool: POOL.you, replyMin: 0.6 },
    { id: "user2000", name: "Sam", pool: POOL.them, replyMin: 2.4 },
  ];
  const messages = [];
  let id = 1;
  const push = (m) => messages.push({ id: id++, ...m });

  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end.getTime() - days * 864e5);

  // A 9-day fight/silence a third of the way in, and a "golden era" later on.
  const silenceStart = Math.floor(days * 0.33);
  for (let d = 0; d < days; d++) {
    if (d >= silenceStart && d < silenceStart + 9) continue;
    const era = 0.6 + 0.9 * Math.exp(-(((d - days * 0.62) / (days * 0.12)) ** 2)) + (d < 40 ? -0.3 : 0);
    if (rnd() > 0.55 + 0.35 * Math.min(1, era)) continue;
    const sessionsToday = 1 + Math.floor(rnd() * 3 * era);
    for (let s = 0; s < sessionsToday; s++) {
      const hourWeights = [3, 2, 1.5, 0.6, 0.2, 0.1, 0.3, 1, 1.6, 1.8, 2, 2.2, 2.6, 2.4, 2, 2, 2.3, 2.6, 3, 3.4, 3.8, 4.4, 4.6, 4];
      let r = rnd() * hourWeights.reduce((a, b) => a + b, 0), hour = 0;
      while ((r -= hourWeights[hour]) > 0) hour++;
      let t = new Date(start.getTime() + d * 864e5 + hour * 36e5 + rnd() * 36e5);
      let who = rnd() < 0.58 ? 0 : 1;
      const len = Math.floor(4 + rnd() * 40 * era);
      for (let k = 0; k < len; k++) {
        const p = people[who];
        const burst = 1 + Math.floor(rnd() * rnd() * 4);
        for (let b = 0; b < burst; b++) {
          const roll = rnd();
          const base = { type: "message", date: localStamp(t), date_unixtime: String(Math.floor(t / 1000)), from: p.name, from_id: p.id };
          let text = pick(p.pool);
          let extra = {};
          if (roll < 0.035) { text = ""; extra = { photo: "photos/photo.jpg", width: 1280, height: 960 }; }
          else if (roll < 0.075) { text = ""; extra = { file: "stickers/sticker.webp", media_type: "sticker", sticker_emoji: pick(POOL.sticker) }; }
          else if (roll < 0.095) { text = ""; extra = { file: "voice_messages/audio.ogg", media_type: "voice_message", duration_seconds: Math.floor(4 + rnd() * rnd() * 180) }; }
          else if (roll < 0.1) { text = ""; extra = { file: "round_video_messages/video.mp4", media_type: "video_message", duration_seconds: Math.floor(5 + rnd() * 50) }; }
          else if (roll < 0.11) { text = ""; extra = { file: "video_files/gif.mp4", media_type: "animation" }; }
          else if (roll < 0.12) { const l = pick(POOL.links); text = [{ type: "link", text: l }]; }
          else if (roll < 0.126) { extra = { forwarded_from: "Funny Memes" }; text = "when you open the fridge for the 5th time 😂"; }
          else if (roll < 0.132) { text = pick(POOL.long); }
          const msg = { ...base, ...extra, text };
          msg.text_entities = Array.isArray(text) ? text : text ? [{ type: "plain", text }] : [];
          if (rnd() < 0.02) msg.edited = msg.date;
          if (rnd() < 0.05 && messages.length) msg.reply_to_message_id = messages[messages.length - 1].id;
          if (rnd() < 0.04) {
            const other = people[1 - who];
            msg.reactions = [{ type: "emoji", count: 1, emoji: pick(["❤", "😂", "👍", "🔥", "🥰"]), recent: [{ from: other.name, from_id: other.id, date: msg.date }] }];
          }
          push(msg);
          t = new Date(t.getTime() + (5 + rnd() * 50) * 1000);
        }
        who = 1 - who;
        const q = people[who];
        const delay = Math.exp(Math.log(q.replyMin * 60) + rnd() * 2.4 - 0.4 + (rnd() < 0.05 ? 3.5 : 0));
        t = new Date(t.getTime() + delay * 1000);
      }
    }
    if (rnd() < 0.18 * era) {
      const caller = people[rnd() < 0.55 ? 0 : 1];
      const t = new Date(start.getTime() + d * 864e5 + (19 + rnd() * 4) * 36e5);
      const missed = rnd() < 0.15;
      push({
        type: "service", date: localStamp(t), date_unixtime: String(Math.floor(t / 1000)), actor: caller.name, actor_id: caller.id,
        action: "phone_call", ...(missed ? { discard_reason: "missed" } : { duration_seconds: Math.floor(30 + rnd() * rnd() * 5400), discard_reason: "hangup" }),
        text: "", text_entities: [],
      });
    }
  }
  messages.sort((a, b) => a.date_unixtime - b.date_unixtime);
  return { name: "Sam", type: "personal_chat", id: 2000, messages };
}
