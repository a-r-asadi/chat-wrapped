// Turns a Telegram Desktop JSON export into a list of chats and normalized messages.
// Supports both a single-chat export (result.json of one chat) and a full-account export.

export function listChats(data) {
  if (Array.isArray(data?.messages)) return [data];
  const list = data?.chats?.list;
  if (Array.isArray(list)) return list.filter((c) => Array.isArray(c.messages) && c.messages.length);
  throw new Error("This doesn't look like a Telegram JSON export (no messages found). Make sure you chose the “Machine-readable JSON” format.");
}

export function chatSummary(chat, i) {
  return {
    index: i,
    name: chat.name || "Deleted account",
    type: chat.type || "unknown",
    count: chat.messages.length,
  };
}

const textOf = (msg) => {
  const parts = Array.isArray(msg.text_entities) ? msg.text_entities : Array.isArray(msg.text) ? msg.text : [msg.text];
  let out = "";
  for (const p of parts) out += typeof p === "string" ? p : p?.text ?? "";
  return out;
};

const linksOf = (msg) => {
  const ents = Array.isArray(msg.text_entities) ? msg.text_entities : Array.isArray(msg.text) ? msg.text : [];
  const links = [];
  for (const e of ents) {
    if (!e || typeof e !== "object") continue;
    if (e.type === "link") links.push(e.text);
    else if (e.type === "text_link" && e.href) links.push(e.href);
  }
  return links;
};

const KIND_BY_MEDIA = {
  sticker: "sticker",
  animation: "gif",
  video_file: "video",
  video_message: "videoNote",
  voice_message: "voice",
  audio_file: "audio",
};

function kindOf(msg) {
  if (msg.photo) return "photo";
  if (msg.media_type && KIND_BY_MEDIA[msg.media_type]) return KIND_BY_MEDIA[msg.media_type];
  if (msg.poll) return "poll";
  if (msg.location_information) return msg.live_location_period_seconds ? "liveLocation" : "location";
  if (msg.contact_information) return "contact";
  if (msg.file) return "file";
  return "text";
}

// The exporter's wall-clock time comes as "YYYY-MM-DDTHH:MM:SS" without a zone; keep it as-is.
function localParts(dateStr) {
  const y = +dateStr.slice(0, 4), mo = +dateStr.slice(5, 7), d = +dateStr.slice(8, 10);
  const h = +dateStr.slice(11, 13);
  const wd = (new Date(Date.UTC(y, mo - 1, d)).getUTCDay() + 6) % 7; // 0 = Monday
  return { day: dateStr.slice(0, 10), ym: dateStr.slice(0, 7), hour: h, wd };
}

/**
 * Normalize one chat. `selfId` is the exporter's own user id when known (full export).
 * Returns { name, type, people: [{id, name, isYou}], messages: [...], calls: [...] }.
 */
export function normalizeChat(chat, selfId) {
  const people = new Map(); // from_id -> {id, name, count}
  const person = (id, name) => {
    const key = id || `name:${name}`;
    let p = people.get(key);
    if (!p) people.set(key, (p = { key, name: name || "Deleted account", count: 0 }));
    else if (name) p.name = name;
    return p;
  };

  const messages = [];
  const calls = [];
  const byId = new Map();

  for (const m of chat.messages) {
    if (!m || !m.date) continue;
    const t = m.date_unixtime ? +m.date_unixtime * 1000 : Date.parse(m.date);
    const parts = localParts(m.date);

    if (m.type === "service") {
      if (m.action === "phone_call" || m.action === "group_call") {
        const p = person(m.actor_id, m.actor);
        calls.push({ t, ...parts, by: p.key, duration: m.duration_seconds || 0, reason: m.discard_reason || "" });
      }
      continue;
    }
    if (m.type !== "message") continue;

    const p = person(m.from_id, m.from);
    p.count++;
    const text = textOf(m);
    const kind = kindOf(m);
    const msg = {
      id: m.id,
      t,
      ...parts,
      from: p.key,
      text,
      kind,
      duration: m.duration_seconds || 0,
      stickerEmoji: m.sticker_emoji || "",
      links: linksOf(m),
      forwarded: !!m.forwarded_from,
      edited: !!(m.edited || m.edited_unixtime),
      replyTo: m.reply_to_message_id ?? null,
      reactions: [],
    };
    if (Array.isArray(m.reactions)) {
      for (const r of m.reactions) {
        const emoji = r.emoji || (r.type === "custom_emoji" ? "⭐" : r.type === "paid" ? "⭐" : "");
        if (Array.isArray(r.recent) && r.recent.length) {
          for (const who of r.recent) msg.reactions.push({ emoji, by: who.from_id || `name:${who.from}` });
        } else {
          for (let i = 0; i < (r.count || 1); i++) msg.reactions.push({ emoji, by: null });
        }
      }
    }
    messages.push(msg);
    byId.set(m.id, msg);
  }

  messages.sort((a, b) => a.t - b.t);
  calls.sort((a, b) => a.t - b.t);

  // Work out who "you" is: in a personal chat the chat id is the other person's id.
  let selfKey = selfId ? `user${selfId}` : null;
  if (!selfKey && chat.type === "personal_chat" && chat.id != null) {
    const other = `user${chat.id}`;
    const mine = [...people.keys()].find((k) => k !== other && people.get(k).count > 0);
    if (people.has(other) && mine) selfKey = mine;
  }

  const list = [...people.values()].filter((p) => p.count > 0).sort((a, b) => b.count - a.count);
  return {
    name: chat.name || "Deleted account",
    type: chat.type || "unknown",
    people: list.map((p) => ({ id: p.key, name: p.name, isYou: p.key === selfKey, count: p.count })),
    messages,
    calls,
  };
}
