// Parses and analyzes off the main thread so the page stays responsive on huge exports.
import { listChats, chatSummary, normalizeChat } from "./parser.js";
import { analyze } from "./analyze.js";

let chats = null;
let selfId = null;

function run(index) {
  postMessage({ type: "progress", text: "Crunching the numbers…" });
  const chat = normalizeChat(chats[index], selfId);
  const result = analyze(chat);
  postMessage({ type: "result", result });
}

self.onmessage = async ({ data: msg }) => {
  try {
    if (msg.type === "file" || msg.type === "json") {
      let data = msg.data;
      if (msg.type === "file") {
        postMessage({ type: "progress", text: `Reading ${msg.file.name}…` });
        const text = await msg.file.text();
        postMessage({ type: "progress", text: "Parsing the export…" });
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("That file isn't valid JSON. In Telegram Desktop, export with the “Machine-readable JSON” format and upload result.json.");
        }
      }
      chats = listChats(data);
      selfId = data?.personal_information?.user_id ?? null;
      if (chats.length === 1) run(0);
      else postMessage({ type: "chats", chats: chats.map(chatSummary) });
    } else if (msg.type === "pick") {
      run(msg.index);
    }
  } catch (e) {
    postMessage({ type: "error", message: e.message || String(e) });
  }
};
