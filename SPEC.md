# Confluence GPT - Technical Specification

> A chat-first interface to manage Confluence with natural language.

## Vision

**Instead of:** Click "Create" → Select Space → Enter Title → Type Content → Click Submit

**Users do:** "Create meeting notes for today's standup" → Done.

---

## Core Features (MVP - 2 Hours)

### 1. 💬 Chat Interface
Single-page app. Type what you want, get it done.

### 2. 📄 Page Operations
| Command | Example |
|---------|---------|
| **Create** | "Create a page called Project Roadmap" |
| **Search** | "Find pages about authentication" |
| **Update** | "Update the API docs page with new endpoints" |
| **List Spaces** | "Show me all spaces" |

### 3. 🤖 AI-Powered Understanding
- DeepSeek integration for natural language parsing
- Generates page content from descriptions
- Understands context and intent

### 4. ⚙️ Settings
- Confluence credentials (domain, email, API token)
- AI configuration (DeepSeek API key)
- Stored in browser localStorage (secure, no server storage)

---

## Architecture

```
┌─────────────────────────────────────────┐
│           FRONTEND (Next.js)            │
├─────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────────┐ │
│  │ Chat UI      │  │ Settings Modal   │ │
│  │ (Main View)  │  │ (Confluence/AI)  │ │
│  └──────────────┘  └──────────────────┘ │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│           API ROUTES (Next.js)          │
├─────────────────────────────────────────┤
│  /api/spaces     → List spaces          │
│  /api/pages      → CRUD operations      │
│  /api/pages/[id] → Single page ops      │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│          EXTERNAL SERVICES              │
├─────────────────────────────────────────┤
│  Confluence API  │  DeepSeek API        │
│  (via proxy)     │  (intent parsing)    │
└─────────────────────────────────────────┘
```

---

## Tech Stack

| Component | Technology | Why |
|-----------|------------|-----|
| Framework | Next.js 14+ | SSR, API routes, Vercel-ready |
| Styling | Tailwind CSS | Fast, utility-first |
| UI Components | shadcn/ui | Clean, accessible |
| AI | DeepSeek | Cost-effective, powerful |
| State | React Context | Simple, no extra deps |
| Deployment | Vercel (Free) | Zero config, fast |

---

## File Structure (Simplified)

```
web/
├── src/
│   ├── app/
│   │   ├── page.tsx          # Chat interface (main)
│   │   ├── layout.tsx        # App shell
│   │   ├── globals.css       # Styles
│   │   └── api/
│   │       ├── spaces/route.ts
│   │       └── pages/
│   │           ├── route.ts
│   │           └── [id]/route.ts
│   ├── components/
│   │   ├── chat/             # Chat components
│   │   ├── settings/         # Settings dialog
│   │   └── ui/               # shadcn components
│   ├── lib/
│   │   ├── confluence.ts     # Confluence API client
│   │   ├── ai.ts             # DeepSeek integration
│   │   └── utils.ts          # Helpers
│   └── hooks/
│       └── use-settings.ts   # Settings hook
├── package.json
└── vercel.json               # Deployment config
```

---

## API Design

### Confluence Proxy Endpoints

All endpoints receive credentials via headers:
- `x-confluence-domain`
- `x-confluence-email`  
- `x-confluence-token`

```
GET  /api/spaces              → List all spaces
GET  /api/pages?q=search      → Search pages
POST /api/pages               → Create page
GET  /api/pages/:id           → Get page details
PUT  /api/pages/:id           → Update page
```

### AI Integration

DeepSeek called directly from frontend (client-side):
- No server-side AI proxy needed
- User's API key never touches our servers
- Simple, secure

---

## Security

1. **No hardcoded credentials** - Everything user-provided
2. **localStorage only** - Credentials stay in browser
3. **Proxy pattern** - API routes proxy to Confluence (CORS)
4. **Client-side AI** - AI calls made directly from browser

---

## Deployment (Vercel)

```bash
# From web/ directory
vercel --prod
```

Environment variables: None required (all user-configured)

---

## Development

```bash
cd web
npm install
npm run dev
# → http://localhost:3000
```

---

## User Flow

```
1. First Visit
   └─→ Welcome message → "Configure settings to get started"
   
2. Settings Setup
   └─→ Enter Confluence domain, email, API token
   └─→ (Optional) Enter DeepSeek API key
   
3. Using Chat
   └─→ Type: "Create meeting notes for today"
   └─→ AI parses intent → Shows preview
   └─→ User confirms → Page created
   └─→ Success message with link to Confluence
```

---

## Future (Post-MVP)

- [ ] Batch operations ("Create 4 weekly status pages")
- [ ] File/content paste support
- [ ] Templates library
- [ ] History & undo
- [ ] Scheduled automations

---

## Success Criteria

- [ ] User can configure Confluence in < 1 minute
- [ ] User can create a page with one sentence
- [ ] User can search pages naturally
- [ ] Works on Vercel free tier
- [ ] Clean, maintainable codebase

