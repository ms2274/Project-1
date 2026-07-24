# Trading Prep Agent

A local, manual-trigger prep tool for SPY/QQQ options trading. Every morning
you open the dashboard and click **Refresh Prep**. It fetches recent price
data, computes objective levels (volume profile POC/VAH/VAL, low volume nodes,
weekly Dow Theory trend, VIX regime), and asks Claude to synthesize those
levels into a written prep sheet using a Carmine Rosato supply/demand
framework.

**This tool does not generate trade signals.** It prepares context for
discretionary execution in Bookmap. There is no automation, no cron, no
email/alerting — everything runs on-demand, locally, when you click the
button.

## Stack

- Next.js 14 (App Router, TypeScript, Tailwind)
- [Polygon.io](https://polygon.io) — OHLCV bars (Stocks Starter plan)
- [Financial Modeling Prep](https://site.financialmodelingprep.com/developer/docs) — VIX quote (free tier)
- [Supabase](https://supabase.com) — stores generated prep sheets (free tier)
- Anthropic Claude — synthesizes the prep sheet narrative

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in API keys (see
   CLAUDE_CODE_INSTRUCTIONS.md for where to get each one).
3. Run the SQL in `src/lib/supabase.ts` (`SCHEMA_SQL`) in your Supabase SQL
   editor to create the `prep_sheets` table.
4. `npm run test:payload` — validates the Polygon/FMP data layer and prints
   computed levels for SPY/QQQ.
5. `npm run test:claude` — validates Claude prep-sheet generation end to end.
6. `npm run dev` — starts the dashboard at http://localhost:3000.

## Scripts

- `npm run dev` / `build` / `start` — standard Next.js
- `npm run test:payload` — fetch bars, compute volume profile/LVNs/trend/VIX
  regime, print to console (no Claude call, no Supabase write)
- `npm run test:claude` — run one full prep-sheet generation through Claude
  and print the parsed JSON

## Strategy context (for tuning, not enforced by the code)

- Instruments: SPY/QQQ options, 1 strike OTM, 7-10 DTE
- Framework: Carmine Rosato supply/demand zones + LVNs + weekly-only Dow
  Theory trend + VIX regime filter
- Risk: $20-50/trade, target 2-5x
- Execution: discretionary, using Bookmap for live order flow — this tool is
  prep only
