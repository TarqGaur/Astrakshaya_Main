# Comment Fetcher AI — Complete Technical Documentation

---

## 1. Project Overview

**Comment Fetcher AI** is a zero-backend, single-HTML-file social media analytics suite.
It takes a YouTube or Instagram post URL, scrapes all comments via third-party APIs, 
runs multi-dimensional AI analysis in ONE API call, and renders 10+ visual sections
— all from the user's browser.

No server. No framework. No build step. Pure HTML + CSS + Vanilla JS.

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| UI/Layout | Vanilla HTML5 + CSS3 | All 10+ sections, animations, responsive grid |
| Logic | Vanilla JavaScript (ES2022) | Async/await, fetch API, DOM manipulation |
| Comment Scraping (Instagram) | Apify `apify~instagram-scraper` | Pull post data + comments via actor |
| Comment Scraping (YouTube) | YouTube Data API v3 | Pull comment threads via REST |
| Post Metadata (YouTube) | Apify `streamers~youtube-scraper` | Thumbnail, description, stats |
| Post Metadata (Instagram) | Apify `apify~instagram-scraper` | Profile pic, caption, media URL |
| AI Analysis | OpenRouter `openrouter/auto` (hunter-alpha) | ALL analysis in 1 unified call |
| AI Chat | OpenRouter `openrouter/auto` (hunter-alpha) | Conversational QnA on loaded data |
| Data Export | Browser Blob API | Download JSON locally |
| Charts/Visuals | Custom SVG (hand-drawn via JS) | Pie charts, bar charts, donut rings |

---

## 3. API Keys Used

```
APIFYTOKEN       (Apify platform auth)
YOUTUBEKEY            (Google Cloud Console — YouTube Data API v3)
CEREBRASKEY        (Legacy key, now unused — kept for reference)
OPENROUTERKEY     (All AI calls routed through here)
APIFYACTOR      (Instagram comments scraper actor ID)
```

---

## 4. Data Flow — End to End

```
User pastes URL
      │
      ▼
detectPlatform()
  ├── instagram.com → currentPlatform = 'insta'
  └── youtube.com   → currentPlatform = 'yt'
      │
      ▼
fetchComments() → routes to:
  ├── fetchInstagram()
  └── fetchYouTube()
      │
      ▼
[PARALLEL] Post Details + Comments Fetch
      │
      ▼
renderYTHero() / renderInstaHero()
  → Shows thumbnail, stats, title, description
      │
      ▼
saveJSON() → Auto-downloads JSON file
      │
      ▼
runAITasks(jsonPayload, platform)
  → 1 OpenRouter API call (megaPrompt)
  → Returns ALL 9 analyses in one JSON
      │
      ├── renderSentimentChart()
      ├── renderAudienceSummary()
      ├── renderTopicSection()
      ├── renderProfileInsights()
      ├── buildCountryMap()  → renderHatePie()
      ├── renderSpamPie()
      ├── renderSummaryCards()
      ├── renderPersonas()
      └── renderPrediction()
      │
      ▼
initChat() → OpenRouter multi-turn QnA enabled
```

---

## 5. Comment Fetching — Instagram Flow

```
fetchInstagram()
│
├── STEP 1: apify/instagram-scraper (post details)
│     POST https://api.apify.com/v2/acts/apify~instagram-scraper/runs
│     Input: { directUrls: [url], resultsType: 'posts', resultsLimit: 1 }
│     Poll: waitApifyRun(runId) → every 5s × 20 attempts
│     Result: thumbnail, caption, likes, comments count, profile pic
│     → renderInstaHero(postItems[0])
│
└── STEP 2: APIFYACTOR (SbK00X0JYCPblD2wp) — comments
      POST https://api.apify.com/v2/acts/SbK00X0JYCPblD2wp/runs
      Input: { directUrls: [url], resultsLimit: N, includeNestedComments: bool }
      Poll: every 4s × 60 attempts
      Dataset: GET /datasets/{dsId}/items?limit=N
      Result: Array of comment objects → normalized → saved as JSON
```

**Instagram Comment Object Shape:**
```json
{
  "id": "...",
  "text": "Nice video!",
  "timestamp": "2024-01-01T00:00:00Z",
  "ownerUsername": "user123",
  "ownerFullName": "John Doe",
  "ownerProfilePicUrl": "https://...",
  "ownerIsVerified": false,
  "likesCount": 12,
  "repliesCount": 3,
  "replies": [...]
}
```

---

## 6. Comment Fetching — YouTube Flow

```
fetchYouTube()
│
├── STEP 1: streamers/youtube-scraper (post details) [PARALLEL]
│     POST https://api.apify.com/v2/acts/streamers~youtube-scraper/runs
│     Input: { startUrls: [{url: videoUrl}], maxVideos: 1 }
│     Poll: waitApifyRun(runId) → every 5s × 20 attempts
│     Result: title, description, thumbnailUrl, viewCount, likes, channelName
│     Also: YouTube Data API v3 /videos endpoint used as fallback
│     → renderYTHero(mergedMeta, videoId)
│
└── STEP 2: YouTube Data API v3 — comments
      GET /commentThreads?part=snippet,replies&videoId=X&maxResults=100
      Paginated via nextPageToken until maxResults reached
      Supports: sort by relevance/time, language filter
```

**YouTube Comment Thread Shape:**
```json
{
  "threadId": "...",
  "canReply": true,
  "totalReplyCount": 5,
  "topLevelComment": {
    "commentId": "...",
    "text": "...",
    "authorDisplayName": "...",
    "authorProfileImageUrl": "...",
    "likeCount": 42,
    "publishedAt": "2024-01-01T00:00:00Z"
  },
  "replies": [...]
}
```

---

## 7. Apify Actor Polling Pattern

```javascript
async function waitApifyRun(runId) {
  for (let i = 0; i < 20; i++) {
    await sleep(5000);
    const s = await fetch(`/v2/actor-runs/${runId}?token=...`).json();
    const st = s.data.status;
    if (st === 'SUCCEEDED') return s.data.defaultDatasetId;
    if (['FAILED','ABORTED','TIMED-OUT'].includes(st)) throw Error(st);
  }
  throw Error('Timeout');
}
// Polls every 5s, max 100 seconds total wait
// Returns datasetId → then GET /datasets/{id}/items
```

---

## 8. Unified AI Analysis — The Mega Prompt

This is the core architectural decision. Instead of 9 separate API calls,
ALL analysis happens in ONE call.

```
runAITasks(jsonPayload, platform)
│
├── Extract up to 200 comment texts (getCommentTexts)
├── Extract up to 200 username+text hints for country detection
│
├── Build MEGA PROMPT with:
│     - 200 comments (truncated to 150 chars each)
│     - Country hints (username + 200 chars)
│     - Full JSON schema for 9 output sections
│
└── callAI(megaPrompt, temperature=0.2)
      │
      └── OpenRouter: model='openrouter/auto'
            max_tokens: 6000
            reasoning: { enabled: true }
            temperature: 0.2
```

**Response Schema (single JSON object):**
```json
{
  "sentiment": { "counts": {}, "overallMood": "", "insight": "" },
  "audience":  { "items": [{rank, icon, category, title, description, commentCount}] },
  "topic":     { "headline": "", "description": "", "tags": [{label, count}] },
  "profiles":  { "profiles": [{name, emoji, description, opinions, sharePercent, commentCount}] },
  "country":   { "countries": { "India": {pos, neg, neu, examples} }, "unknownCount": 0 },
  "spam":      { "spam":{}, "bots":{}, "suspicious":{}, "legit":{}, "riskLevel": "" },
  "summary":   { "sentiment": "", "topComplaint": "", "topPraise": "", "emotion": "", "action": "" },
  "personas":  { "personas": [{name, emoji, share, age, interests, mood, engagement}] },
  "prediction":{ "like": 78, "dislike": 22, "net": 56, "confidence": "HIGH" }
}
```

**Why this approach:**
- OLD: 9 API calls × avg 8s = ~72 seconds + 9× the comment tokens sent
- NEW: 1 API call × ~15s = done. Comments sent only once.
- Token savings: ~9× reduction in input tokens

---

## 9. AI Response Parsing — parseJSON()

```javascript
function parseJSON(raw) {
  raw = raw.replace(/```json/gi, '').replace(/```/gi, '').trim();
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('No JSON found in AI response');
  return JSON.parse(m[0]);
}
```
- Strips markdown code blocks
- Extracts first {...} block with regex
- Handles models that add extra prose before/after JSON

---

## 10. All 10 Visual Sections

| # | Section | Data Source | Render Method |
|---|---|---|---|
| 0 | Post Hero | Apify scraper | DOM manipulation, img src |
| 1 | Fetcher + Chat | User input | Form + fetch |
| 2 | Sentiment Pulse | AI: sentiment | CSS bar chart animation |
| 3 | Audience Summary | AI: audience | Grid cards |
| 4 | Topic Identification | AI: topic | Tags + headline |
| 5 | Profile Insights | AI: profiles | Profile cards + share bars |
| 6 | Country Opinion Map | AI: country | Flag grid + sentiment bars |
| 7 | Hate Source Pie | Derived from Country | Custom SVG donut pie |
| 8 | Top Discussion Thread | Algorithmic (no AI) | Thread + replies render |
| 8b | Spam/Bot Composition | AI: spam | Custom SVG donut pie |
| 9 | One-Word Summary | AI: summary | Glassmorphism cards |
| 10 | Audience Personas | AI: personas | Persona profile cards |
| 11 | Future Prediction | AI: prediction | Animated horizontal bars |

---

## 11. SVG Charts — Hand-Drawn (No Libraries)

Both pie charts (Hate Source + Spam) are drawn using raw SVG paths in JS.

```javascript
// Donut slice formula:
const angle = (count / total) * 2 * Math.PI;
// Outer arc (r=130), Inner arc (r=68) = donut hole
// SVG Path: M innerStart → L outerStart → A outer → L innerEnd → A inner → Z
// Labels: text element at (cx + r*0.68*cos(midAngle), ...)
```

Bar charts (Sentiment, Prediction) use CSS height animation:
```css
.bar { height: 0; transition: height 1.2s cubic-bezier(0.16, 1, 0.3, 1); }
// JS sets: el.style.height = el.dataset.target + '%'
// triggered by requestAnimationFrame
```

---

## 12. Country Detection Algorithm

Country is NOT detected by IP (no server) — AI infers from:
1. **Language** of comment text (Hindi → India, Arabic → Saudi/UAE/Egypt)
2. **Slang/cultural references** (bhai, yaar → India/Pakistan)
3. **Username patterns** (numbers, scripts, emoji flags)
4. **Mention of places, celebrities, events**

Input sent to AI:
```
user:username123 comment text here...
user:another_user another comment...
```

AI returns `{ "India": { pos: 40, neg: 10, neu: 20 }, ... }`

Hate Pie is then derived **without any AI call**:
```javascript
const hateData = sorted
  .filter(([, d]) => d.neg > 0)
  .sort((a, b) => b[1].neg - a[1].neg)
  .slice(0, 8);
// Pure JS — zero extra API tokens used
```

---

## 13. Top Discussion Thread — Pure Algorithm (No AI)

```javascript
threads.sort((a, b) => {
  if (b.replies.length !== a.replies.length)
    return b.replies.length - a.replies.length;  // most replies first
  return b.likes - a.likes;                       // tiebreak: most liked
});
const best = threads[0];
```
- Picks comment thread with most replies (deepest conversation)
- Tiebreaker: likes
- Renders full thread with reply chain
- Also saved in exported JSON

---

## 14. AI Chat System

```
initChat(jsonPayload, platform)
│
├── System prompt includes:
│     - Full JSON payload (comments stripped of raw fields)
│     - Platform context (YouTube/Instagram)
│     - Instruction: answer concisely with bullets
│
├── chatHistory[] maintains full conversation context
│
├── Each sendMessage():
│     POST openrouter.ai/api/v1/chat/completions
│     { model, messages: [system, ...chatHistory], reasoning: {enabled:true} }
│
└── Reasoning tokens shown in collapsible <details> block
```

---

## 15. Data Export — JSON Structure

### Instagram export: `instagram-comments-{postId}-{timestamp}.json`
```json
{
  "meta": { "platform", "source", "actorId", "runId", "postUrl", "fetchedAt" },
  "postDetails": { ...apify post object },
  "summary": { "totalComments", "totalLikes", "totalReplies", "uniqueUsers" },
  "comments": [ ...normalized comment objects ]
}
```

### YouTube export: `youtube-comments-{title}-{timestamp}.json`
```json
{
  "meta": { "platform", "videoId", "videoUrl", "fetchedAt", "apiCallsMade" },
  "postDetails": { ...apify scraper object },
  "videoInfo": { "title", "description", "channelTitle", "viewCount", "likeCount" },
  "summary": { "totalThreadsFetched", "totalTopLevelLikes", "totalReplies" },
  "commentThreads": [ ...normalized thread objects with replies ]
}
```

### Country+Hate export: `countryhatediscussion-{timestamp}.json`
```json
{
  "countryOpinionMap": { ...per-country sentiment breakdown },
  "hateSourceByCountry": { ...negative comment shares },
  "topDiscussionThread": { ...best thread with replies }
}
```

---

## 17. Error Handling Strategy

| Layer | Strategy |
|---|---|
| Apify polling | Max 20 attempts × 5s = 100s timeout, throws on FAILED/ABORTED |
| YT API pagination | Stops at nextPageToken exhaustion or maxResults reached |
| AI parseJSON | Regex extracts JSON block, throws if none found |
| AI response error | Error shown in each section's loading div (red text) |
| Prediction fallback | Hardcoded fallback {like:78, dislike:22} if AI fails |
| Image load errors | onerror → swap to placeholder/gradient div |
| Apify hero failure | Graceful: hides loading div, shows nothing (comments still work) |

---

## 18. Performance Optimizations

- **One AI call** instead of 9 — biggest win (~80% cost + time reduction)
- **Parallel fetching**: post details scraper + comments fetch run simultaneously (Promise + concurrent awaits)
- **Comment sampling**: AI only sees first 200 comments (truncated to 150 chars) — avoids context limit
- **Country hints**: username prepended to comment = better accuracy without extra call
- **No frameworks**: zero bundle size, instant load, no React/Vue overhead
- **Lazy section display**: sections hidden by default (`display:none`), revealed only after data arrives
- **requestAnimationFrame**: bar chart animations only trigger after DOM paint



## 19. Sequence Diagram — Full Run

```
Browser          Apify               YouTube API        OpenRouter
  │                │                      │                  │
  │──POST scraper──►│                      │                  │
  │──POST comments─────────────────────►  │                  │
  │                │ polling 5s×20        │                  │
  │◄─────scraper result (post details)    │                  │
  │──renderHero()  │                      │                  │
  │                │              ◄─GET commentThreads──     │
  │                │              ◄─paginate until done──     │
  │◄─────all comments collected────────────                  │
  │──saveJSON() auto-download             │                  │
  │──runAITasks()─────────────────────────────────POST──────►│
  │                │                      │   (1 megaprompt) │
  │                │                      │◄──────────────── │
  │  render all 9 sections simultaneously │                  │
  │──initChat() ready                     │                  │
  │──[User asks question]─────────────────────────POST──────►│
  │◄──────────────────────────────────────────────answer──── │
```

---

