<p align="center">
  <img src="https://img.shields.io/badge/ClawDiscord-AI%20Powered-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="ClawDiscord" />
  <img src="https://img.shields.io/badge/Status-MVP-orange?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" />
</p>

<h1 align="center">ClawDiscord</h1>
<h3 align="center">Your Discord Server, Professionally Built in Seconds — Powered by AI</h3>

<p align="center">
  <strong>An AI agent that designs and deploys complete Discord servers.</strong><br/>
  Categories, channels, roles, permissions, embeds, emojis — all automated.
</p>

---

## What is ClawDiscord?

ClawDiscord is an **Agentic-as-a-Service (AAAS)** product that automates professional Discord server setup. Instead of spending hours manually creating channels, roles, and permissions, ClawDiscord does it in **seconds**.

**Two modes:**

- **Quick Setup** — Pick a curated template (Gaming, SaaS, Community) → one click → done
- **AI Setup** — Chat with our AI agent, describe your community, and get a **fully custom server** generated and deployed automatically

## How It Works

```
┌─────────────────────────────────────────────────────┐
│                  claw-discord.com                     │
│                                                       │
│  1. Login with Discord (OAuth2)                       │
│  2. Select your server                                │
│  3. Choose:                                           │
│     ├── Quick Setup → Pick template → Preview → Go    │
│     └── AI Setup → Chat with agent → Custom build     │
│  4. Watch real-time progress                          │
│  5. Server ready! Jump into Discord                   │
└─────────────────────────────────────────────────────┘
```

### AI Agent Flow

```
You: "I'm building a crypto trading community with 500 members.
      We need price alerts, trading signals, portfolio channels,
      and a tiered role system based on trading volume."

AI:  Generates a complete template with:
     → 8 categories (Welcome, Trading Floor, Signals, Education...)
     → 35+ channels (price-alerts, btc-analysis, portfolio-share...)
     → 15 roles (Diamond Hands, Whale, Day Trader, Analyst...)
     → Permission matrix, embeds, slowmode, forum channels
     → All customized to YOUR community

You: "Apply it" → Done in 12 seconds.
```

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│  Discord API │
│  Next.js 14  │     │  Supabase    │     │  via Bot     │
│  on Vercel   │     │  + Edge Fn   │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │
       │              ┌─────┴─────┐
       │              │ Claude AI │  ← Generates custom templates
       │              │ Sonnet 4.5│
       │              └───────────┘
       │
 ┌─────┴──────┐
 │   Stripe   │  ← Payments & subscriptions
 └────────────┘
```

| Layer | Tech | Purpose |
|-------|------|---------|
| Frontend | Next.js 14 + Tailwind | Landing page, dashboard, AI chat |
| Auth | Supabase Auth | Discord OAuth2 provider |
| Database | Supabase Postgres | Users, setups, templates, billing |
| AI Engine | Claude API (Sonnet 4.5) | Custom template generation |
| Bot Engine | Discord.js v14 | Server creation via Discord API |
| Payments | Stripe | Checkout sessions + webhooks |
| Realtime | Supabase Realtime | Live setup progress |
| Hosting | Vercel + Railway | Frontend + Bot process |

## Templates (Built-in)

| Template | Categories | Channels | Roles | Best For |
|----------|-----------|----------|-------|----------|
| Gaming | 7 | 36 | 20 | Gaming communities, esports, LFG |
| SaaS | 8 | 33 | 18 | Product communities, beta testers |
| General | 8 | 44 | 31 | Multi-purpose, social, interest-based |
| **AI Custom** | **∞** | **∞** | **∞** | **Anything you describe** |

## Project Structure

```
clawdiscord/
├── packages/
│   ├── cli/          # CLI tool (npm i -g clawdiscord)
│   │   └── src/
│   │       ├── commands/   # setup, preview, auth, reset
│   │       ├── core/       # builder, discord API, templates
│   │       └── utils/      # logger, prompts
│   ├── bot/          # Discord bot (Gateway + slash commands)
│   │   └── src/
│   │       ├── events/     # guildCreate, interactionCreate
│   │       └── services/   # setup service (the engine)
│   ├── templates/    # Curated JSON templates
│   │   ├── gaming.json
│   │   ├── saas.json
│   │   └── general.json
│   └── web/          # Next.js landing + dashboard
├── turbo.json        # Turborepo config
└── package.json      # Workspace root
```

## CLI (Power Users)

```bash
# Install
npm install -g clawdiscord

# Setup a server with a template
export DISCORD_TOKEN="your_bot_token"
clawdiscord setup --template gaming --guild 123456789

# Preview a template before applying
clawdiscord preview gaming

# List all templates
clawdiscord templates

# Get bot invite link
clawdiscord invite

# Reset a server (remove all channels/roles)
clawdiscord reset --guild 123456789

# Dry run (preview without applying)
clawdiscord setup --template saas --guild 123456789 --dry-run
```

## Bot Commands (Discord)

| Command | Description |
|---------|-------------|
| `/clawdiscord setup <template>` | Apply a template to the current server |
| `/clawdiscord preview <template>` | Preview template stats |
| `/clawdiscord templates` | List all available templates |
| `/clawdiscord status` | Server info + bot uptime |
| `/clawdiscord invite` | Get bot invite link |
| `/clawdiscord reset` | Remove all channels and roles |

## Pricing

| Plan | Price | Includes |
|------|-------|----------|
| Free | $0/mo | 1 setup/month, basic templates |
| Pro | $9.99/mo | Unlimited setups, AI agent, all templates |
| Pay-per-use | $4.99/setup | No subscription, pay as you go |

## Development

```bash
# Clone
git clone https://github.com/Vinizeira13/clawdiscord.git
cd clawdiscord

# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your Discord token

# Build all packages
npm run build

# Run bot
npm run bot

# Run CLI locally
npm run cli -- setup --template gaming
```

## Roadmap

- [x] Core builder engine (roles, channels, permissions, embeds)
- [x] 3 curated templates (Gaming, SaaS, General)
- [x] CLI with setup, preview, reset commands
- [x] Discord bot with slash commands
- [x] Rate limiting and error handling
- [ ] Web landing page + dashboard
- [ ] Discord OAuth2 login
- [ ] AI agent (Claude-powered custom templates)
- [ ] Stripe integration
- [ ] Real-time setup progress
- [ ] Template marketplace (community templates)
- [ ] Scheduled server updates
- [ ] Server analytics dashboard

## License

MIT — Built by [Bilionário Swag](https://github.com/Vinizeira13)

---

<p align="center">
  <strong>ClawDiscord</strong> — Stop building Discord servers manually.<br/>
  <a href="https://claw-discord.com">claw-discord.com</a>
</p>
