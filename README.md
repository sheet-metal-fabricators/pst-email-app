# PST Email Intelligence

AI-powered search across Microsoft Outlook PST email archives. Upload your extracted email data, ask natural language questions, and get instant structured answers powered by Claude AI.

## How It Works

```
┌─────────────────────────────────────────────────┐
│            Vercel (single deployment)            │
│                                                  │
│   Next.js Frontend  ←→  API Routes (serverless)  │
│   React + Tailwind       Claude AI search        │
└─────────────────────────────────────────────────┘
         ▲                        ▲
         │  upload .json          │  user's own API key
         │                        │  (stored in browser)
   pst_extractor.py          Anthropic API
         ▲
         │
   your_mailbox.pst
```

**No server-side API key needed.** Users enter their own Anthropic API key in the app settings — it's saved in their browser's localStorage and sent with each request. Nothing is stored on the server.

## Quick Start (Local Development)

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/pst-email-intelligence.git
cd pst-email-intelligence

# Install dependencies
npm install

# Run
npm run dev
# → http://localhost:3000
```

No `.env` file needed — API keys are entered by each user in the browser.

## Deploy to Vercel (Free)

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/pst-email-intelligence.git
git push -u origin main
```

### Step 2: Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repository
3. Framework preset: **Next.js** (auto-detected)
4. Click **Deploy** — that's it!

No environment variables needed. Every push to `main` auto-deploys.

## Getting an API Key

The app includes a built-in guide, but here's the summary:

1. **Create an account** at [console.anthropic.com](https://console.anthropic.com)
2. **Add billing** — go to Settings → Billing and add credits (minimum $5; each search costs ~$0.01–0.03)
3. **Generate a key** — go to Settings → API Keys → Create Key
4. **Paste it** into the app's settings panel (⚙ icon in the top bar)

Your key is stored only in your browser. It's never logged or saved on the server.

## Extracting Emails from PST Files

The web app accepts `.json` files. Use the included Python script to extract emails from your Outlook `.pst` archives:

```bash
# Install the PST parser
pip install pypff

# Extract emails
python3 pst_extractor.py your_mailbox.pst

# Output: your_mailbox.json (upload this to the app)
```

The script extracts subject, sender, recipients, date, body text, folder path, and attachment metadata.

## Project Structure

```
pst-email-intelligence/
├── app/
│   ├── api/
│   │   └── search/
│   │       └── route.ts      ← Serverless API: Claude AI search
│   ├── globals.css            ← Tailwind + custom styles
│   ├── layout.tsx             ← Root layout
│   └── page.tsx               ← Main app UI + API key settings
├── lib/
│   └── types.ts               ← Shared TypeScript types
├── pst_extractor.py           ← Local PST → JSON converter
├── next.config.js
├── tailwind.config.js
├── package.json
└── README.md
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide icons
- **AI**: Claude Sonnet via Anthropic SDK (serverless API route)
- **Hosting**: Vercel (frontend + API, single deployment, free tier)
- **PST Parsing**: pypff (Python, runs locally)

## License

MIT
