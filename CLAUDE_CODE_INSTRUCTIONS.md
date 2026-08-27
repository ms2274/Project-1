# Build & Maintenance Notes

This file documents scope and constraints for anyone (human or agent) working
on this codebase after the initial build.

## Scope boundaries

- **Prep only, no signals.** Nothing in this app should output a buy/sell
  recommendation or auto-execute anything. Claude's output is a written
  synthesis of objective levels for the trader to weigh against their own
  chart read.
- **No automation.** No Trigger.dev, no cron, no email/Resend, no
  websockets/live-streaming. Everything is triggered by a manual button click
  on the dashboard.
- **Not yet in scope** (revisit after ~2 weeks of live validation of the
  current build): options whale flow, news/headline monitors, a heatmap
  component, a trade journal. Do not add these speculatively.

## Where things live

- `src/lib/polygon.ts` — Polygon.io bar fetching (1m/30m/4h/daily/weekly)
- `src/lib/fmp.ts` — Financial Modeling Prep client (VIX quote)
- `src/lib/vix.ts` — VIX regime classification
- `src/lib/volumeProfile.ts` — POC/VAH/VAL/LVN computation; bin size is
  configurable per timeframe and is the first thing to tune if levels look
  wrong (too sparse/dense LVNs, POC not matching a manual chart read)
- `src/lib/dowTheory.ts` — weekly-only swing high/low trend classification
- `src/lib/claude.ts` — Anthropic client wrapper; model name lives here,
  double-check it against current Anthropic model names if upgrading
- `src/prompts/prepSheet.ts` — system prompt for the prep-sheet synthesis
- `src/lib/supabase.ts` — Supabase client + `SCHEMA_SQL` (paste into the
  Supabase SQL editor to create the `prep_sheets` table)
- `src/app/api/refresh-prep/route.ts` — orchestrates the full refresh flow
- `src/app/page.tsx` — dashboard (Refresh Prep button, SPY/QQQ rendering)
- `src/app/calculator/page.tsx` — standalone risk/position-size calculator,
  no API calls
- `scripts/testPayload.ts` — `npm run test:payload`, validates the data layer
  in isolation (no Claude call, no Supabase write)
- `scripts/testClaude.ts` — `npm run test:claude`, validates one full
  prep-sheet generation

## Env vars

See `.env.example`: `POLYGON_API_KEY`, `FMP_API_KEY`, `ANTHROPIC_API_KEY`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. All API calls are server-side
only (Route Handlers) — none of these keys should ever reach client code.
