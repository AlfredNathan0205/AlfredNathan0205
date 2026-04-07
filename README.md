# ScentShield AI

**Autonomous Fragrance Regulatory Intelligence Platform**

> Real-time compliance checking for fragrance formulas across global markets. Built to run autonomously via AI agents — marketing, sales, support, billing, and monitoring all operate without human intervention.

## Architecture

```
scentshield/
├── packages/
│   ├── core/                    # Domain types + compliance engine
│   │   └── src/
│   │       ├── types.ts         # Full type system
│   │       ├── compliance-engine.ts  # 9-checkpoint pipeline
│   │       └── index.ts
│   ├── api/                     # REST API (Supabase Edge Functions or Express)
│   │   └── src/
│   │       ├── routes/
│   │       │   ├── formulas.ts
│   │       │   ├── ingredients.ts
│   │       │   ├── compliance.ts
│   │       │   ├── documents.ts
│   │       │   └── webhooks.ts
│   │       └── index.ts
│   └── agents/
│       ├── shared/              # Claude, Supabase, Stripe, Resend, Event bus
│       ├── orchestrator/        # Central event router + scheduler
│       ├── monitoring/          # Regulatory change detection
│       ├── content/             # Marketing & content generation
│       ├── sales/               # Lead gen & outreach
│       ├── onboarding/          # Customer onboarding
│       ├── support/             # Customer support
│       ├── billing/             # Billing & retention
│       └── complaints/          # Complaint handling
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Full database schema
├── scripts/
│   └── seed-ingredients.ts      # Seed regulatory data
├── config/
└── .env.example
```

## Quick Start

### Prerequisites
- Node.js 20+
- Supabase account (free tier works for MVP)
- Anthropic API key
- Stripe account (test mode)
- Resend account

### Setup

```bash
# Clone and install
git clone <repo>
cd scentshield
npm install

# Configure environment
cp .env.example .env
# Fill in your API keys

# Setup Supabase
npx supabase init
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push  # Run migrations

# Seed ingredient database
npm run db:seed

# Start development
npm run dev
```

## Claude Code Build Guide

Open this project in Claude Code and work through these phases in order. Each phase is designed to be completed in a single Claude Code session.

### Session 1: Database & Seed Data
```
Prompt: "Set up the Supabase project. Run the migration in 
supabase/migrations/001_initial_schema.sql. Then run the seed 
script to populate the ingredient database. Verify the data 
is correct by querying for Linalool and checking its IFRA limits."
```

### Session 2: API Layer
```
Prompt: "Build the REST API for ScentShield using Supabase Edge 
Functions (or Express if you prefer). Implement these endpoints:
- POST /formulas (create formula with ingredients)
- GET /formulas/:id (with compliance results)
- POST /formulas/:id/check (run compliance pipeline)
- GET /ingredients/search?q= (fuzzy search)
- GET /alerts (tenant alerts)
Use the compliance engine from packages/core/src/compliance-engine.ts.
Add JWT auth using Supabase Auth."
```

### Session 3: Compliance Engine Enhancement
```
Prompt: "Enhance the compliance engine to handle the full IFRA 
standards library. Scrape the IFRA website to get all current 
restrictions and import them into the database. Make sure NCS 
constituent allergen tracking works end-to-end. Add the CLP 
mixture classification rules from Annex I."
```

### Session 4: Document Generation
```
Prompt: "Build the document generation service. Start with SDS 
(Safety Data Sheet) generation — create a 16-section PDF using 
pdf-lib. The SDS should be auto-populated from the compliance 
engine results. Then add label data generation (INCI list, allergen 
declarations, UFI code). Then add IUCLID XML export for PCN."
```

### Session 5: Frontend Connection
```
Prompt: "Connect the React frontend (ScentShield_MVP.jsx) to the 
real API. Replace the mock data with actual API calls. Add 
authentication (Supabase Auth), real formula CRUD, and live 
compliance checking. Deploy to Vercel."
```

### Session 6: Monitoring Agent
```
Prompt: "Build the regulatory monitoring agent. It should scrape 
IFRA's website for new amendments, ECHA for CLP/REACH updates, 
and the EU Official Journal for cosmetic regulation changes. 
When a change is detected, run impact analysis against all 
customer formulas and generate alerts. Use the monitoring agent 
stub in packages/agents/monitoring/."
```

### Session 7: Content & Sales Agents
```
Prompt: "Build the content marketing agent and sales agent. The 
content agent should generate blog articles from regulatory changes 
and publish them. The sales agent should identify leads from 
Companies House new registrations and trade publications, score 
them, and send personalised outreach via Resend."
```

### Session 8: Billing & Support Agents
```
Prompt: "Build the billing agent (Stripe integration, payment 
failure handling, usage tracking, churn prevention) and support 
agent (chat widget, knowledge base queries, ticket management). 
Wire up the Stripe webhooks."
```

### Session 9: Embed SDK
```
Prompt: "Build the React embed SDK (@scentshield/react-sdk) that 
allows customers to embed compliance checking into their existing 
React apps. Create components: ScentShieldProvider, FormulaChecker, 
ComplianceStatus, IngredientSearch. Also build the .NET 8 SDK for 
backend integration."
```

## Regulatory Data Sources (All Free)

| Source | Data | Access |
|--------|------|--------|
| IFRA Standards | Substance restrictions per category | ifrafragrance.org (public) |
| ECHA C&L Inventory | Hazard classifications | echa.europa.eu (bulk CSV) |
| ECHA Candidate List | SVHC substances | echa.europa.eu (public) |
| PubChem | CAS/molecular data | pubchem.ncbi.nlm.nih.gov (API) |
| EU Cosmetic Reg Annexes | Prohibited/restricted lists | EUR-Lex (public) |
| EU Allergen List | 80+ declarable allergens | Published in regulation |
| OpenFDA | US cosmetic restrictions | open.fda.gov (API) |

## Revenue Model

| Tier | Price/month | Formulas | Markets |
|------|-------------|----------|---------|
| Indie | £199 | 20 | 3 |
| Professional | £499 | 100 | 10 |
| Enterprise | £1,499 | Unlimited | Unlimited + API |

**Target: 50 Indie + 20 Pro + 5 Enterprise = £25,845/month**

## Tech Stack

- **Frontend**: React/Next.js
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions + Storage + Realtime)
- **AI**: Anthropic Claude (Sonnet for bulk, Opus for complex regulatory interpretation)
- **Cache**: Upstash Redis
- **Billing**: Stripe
- **Email**: Resend
- **Deployment**: Replit (MVP) → Vercel + Railway (scale)
- **Monitoring**: Agent observability via agent_runs table

## License

Proprietary — ScentShield AI © 2026
