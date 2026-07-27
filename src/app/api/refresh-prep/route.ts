import { NextResponse } from "next/server";
import { fetchVixQuote } from "@/lib/fmp";
import { getUpcomingMarketHolidays } from "@/lib/polygon";
import { buildPrepSheetInput } from "@/lib/buildPrepSheetInput";
import { generatePrepSheet } from "@/lib/claude";
import { upsertPrepSheet } from "@/lib/supabase";

const SYMBOLS = ["SPY", "QQQ"];

export async function POST() {
  try {
    const vix = await fetchVixQuote().catch(() => null);
    const holidays = await getUpcomingMarketHolidays().catch(() => []);

    const results = await Promise.all(
      SYMBOLS.map(async (symbol) => {
        const input = await buildPrepSheetInput(symbol, vix, holidays);
        const { output, raw } = await generatePrepSheet(input);

        await upsertPrepSheet({
          symbol,
          trade_date: input.date,
          levels: input,
          analysis: output,
          raw_claude_response: raw,
        });

        return { input, output };
      })
    );

    return NextResponse.json({ sheets: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
