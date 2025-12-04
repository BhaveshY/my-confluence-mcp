# Confluence GPT

> Chat with your Confluence. Create, search, and manage pages with natural language.

![Demo](https://via.placeholder.com/800x400/1a1f35/70b8ff?text=Confluence+GPT)

## Features

- **Natural Language Commands** - Just describe what you want
- **Create Pages** - "Create meeting notes for today"
- **Search Pages** - "Find pages about authentication"
- **AI-Powered** - DeepSeek integration for smarter understanding
- **Zero Config Deployment** - Deploy to Vercel in one click

## Quick Start

### 1. Clone & Install

```bash
git clone <your-repo>
cd confluence-gpt/web
npm install
```

### 2. Run Locally

```bash
npm run dev
# Open http://localhost:3000
```

### 3. Configure

1. Click the ⚙️ Settings icon
2. Add your Confluence domain, email, and API token
3. (Optional) Add DeepSeek API key for AI features
4. Start chatting!

## Getting Your Credentials

### Confluence API Token
1. Go to [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Copy the token

### DeepSeek API Key (Optional)
1. Go to [platform.deepseek.com](https://platform.deepseek.com)
2. Create an account
3. Generate an API key

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-repo/confluence-gpt)

Or manually:

```bash
cd web
vercel --prod
```

## Tech Stack

- **Next.js 16** - React framework
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **DeepSeek** - AI (optional)
- **Vercel** - Hosting

## Project Structure

```
web/
├── src/
│   ├── app/
│   │   ├── page.tsx          # Main chat interface
│   │   ├── layout.tsx        # App layout
│   │   └── api/              # Confluence proxy routes
│   ├── components/           # React components
│   ├── contexts/             # Settings context
│   └── lib/                  # Utilities & AI
├── package.json
└── vercel.json
```

## Security

- Credentials stored in browser localStorage only
- API routes proxy requests to Confluence (CORS)
- AI calls made client-side (keys never touch server)

## License

MIT

