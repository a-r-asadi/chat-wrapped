# 💬 Chat Wrapped

Spotify-Wrapped-style stats for your Telegram chats. Drop in a chat export and get a story-style recap plus a full dashboard.

**Everything runs in your browser.** The export is parsed locally in a Web Worker: no uploads, no server, no analytics, no external requests.

## Use it

1. In **Telegram Desktop**, open a chat → **⋮** → **Export chat history**.
2. Untick media (not needed), set **Format** to **Machine-readable JSON**, export.
3. Open the site and drop `result.json` on it.

A full-account export (*Settings → Advanced → Export Telegram data*, JSON) also works. You pick the chat from a list, and "you" are detected automatically.

No export handy? Click **Try it with a demo chat**.

## What you get

| Area | Stats |
|---|---|
| **Basics** | Total messages / words / characters and who sends more, first & latest message, days talked vs. span, average and longest message per person |
| **Time** | Weekday × hour heatmap, messages per month, GitHub-style calendar, hourly and weekday rhythm, busiest day (with a peek at the chat and its top words), golden-era month, longest & current streak, longest silence and who broke it, night-owl / early-bird scores, year-by-year |
| **Conversations** | Who starts and who ends conversations, typical/average reply time, reply-time distribution, slowest reply ever (with the messages), double texts, longest monologue, questions left hanging, longest conversation |
| **Words & emojis** | Word cloud (colored by who says it more), top words, signature words and phrases per person, most-used phrases, top & signature emojis |
| **Vibes** | Laugh counter (haha, lol, 😂, خخخ, هههه…), longest laugh, favorite laugh styles, the comedian (who makes the other laugh), questions asked, counters for “I love you”, “miss you”, “sorry”, “thank you”, “good night” and “good morning”, plus who said each first |
| **Media & calls** | Photos, videos, voice/video messages (+ minutes), stickers, GIFs, files, links, polls, locations, forwards, edits, replies, reactions given/received; favorite stickers, reactions and sites; calls, total talk time, longest call, unanswered calls |
| **Deep dive** | Mood over time (lexicon-based sentiment), happiest & toughest day, topics (food, work, plans, feelings, travel…), language mix (English / Persian / Finglish / …) |
| **Wrapped** | Personality awards per person (The Initiator, Speed Replier, Night Owl, Essayist, Emoji Maniac…), an on-this-day throwback, an auto-playing story, and a 1080×1920 share image |
| **Export** | Share card (PNG), every Wrapped slide side by side in one JPG, and the whole dashboard as a PDF (print layout → “Save as PDF”) |

Word lists cover **English, Persian and Finglish**. Telegram exports don't include deleted messages, so those can't be counted.

## Run locally

It's a static site with no build step, but ES-module workers need to be served over HTTP:

```bash
npm start            # = python3 -m http.server 8000
open http://localhost:8000
```

Tests (Node 20+):

```bash
npm test
```

## Deploy

Enable **GitHub Pages** for the `main` branch (root folder) and the site is live as-is.

## Project layout

```
index.html          page shell
css/style.css       styles (light/dark tokens, story mode)
js/main.js          UI wiring: upload, worker, views, tooltip, theme
js/worker.js        parses + analyzes off the main thread
js/parser.js        Telegram JSON → normalized messages (single chat or full export)
js/analyze.js       every stat
js/lexicons.js      stopwords, laughs, counters, sentiment, topics (EN/FA/Finglish)
js/dashboard.js     dashboard sections
js/charts.js        SVG charts (heatmap, bars, lines, calendar, word cloud)
js/story.js         Wrapped story slides
js/card.js          share image (canvas)
js/snapshot.js      all story slides → one JPG
js/demo.js          fake chat generator
test/               node:test suite
```
