import { NextResponse } from "next/server";
import {
  get1mBars,
  get30mBars,
  get4hBars,
  getWeeklyBars,
  mostRecentSessionBars,
  filterRegularSession,
  easternDateString,
} from "@/lib/polygon";
import { buildVolumeProfile, LVN_BIN_SIZE } from "@/lib/volumeProfile";
import { classifyWeeklyTrend } from "@/lib/dowTheory";
import { fetchVixQuote } from "@/lib/fmp";
import { classifyVix } from "@/lib/vix";
import { generatePrepSheet, PrepSheetInput, PrepSheetTimeframeLevels } from "@/lib/claude";
import { upsertPrepSheet } from "@/lib/supabase";

const SYMBOLS = ["SPY", "QQQ"];

function toLevels(vp: ReturnType<typeof buildVolumeProfile>) {
  return {
    poc: vp.poc,
    vah: vp.vah,
    val: vp.val,
    lvnZones: vp.lvns.map((z) => ({ low: z.low, high: z.high })),
  };
}

async function buildInputForSymbol(symbol: string, vix: { price: number; changePercent: number }) {
  const [oneMin, thirtyMin, fourHour, weekly] = await Promise.all([
    get1mBars(symbol),
    get30mBars(symbol),
    get4hBars(symbol),
    getWeeklyBars(symbol),
  ]);

  const lastSession1m = filterRegularSession(mostRecentSessionBars(oneMin));
  const regular30m = filterRegularSession(thirtyMin);

  const timeframes: PrepSheetTimeframeLevels[] = [
    { label: "1m", ...toLevels(buildVolumeProfile(lastSession1m, LVN_BIN_SIZE["1m"])) },
    { label: "30m", ...toLevels(buildVolumeProfile(regular30m, LVN_BIN_SIZE["30m"])) },
    { label: "4h", ...toLevels(buildVolumeProfile(fourHour, LVN_BIN_SIZE["4h"])) },
  ];

  const trend = classifyWeeklyTrend(weekly);

  const input: PrepSheetInput = {
    symbol,
    date: easternDateString(Date.now()),
    vix: { price: vix.price, changePercent: vix.changePercent, regime: classifyVix(vix.price) },
    trend: {
      classification: trend.trend,
      rationale: trend.rationale,
      recentSwingHighs: trend.swingHighs.slice(-5).map((h) => h.price),
      recentSwingLows: trend.swingLows.slice(-5).map((l) => l.price),
    },
    timeframes,
  };

  return input;
}

export async function POST() {
  try {
    const vix = await fetchVixQuote();

    const results = await Promise.all(
      SYMBOLS.map(async (symbol) => {
        const input = await buildInputForSymbol(symbol, vix);
        const { output, raw } = await generatePrepSheet(input);

        await upsertPrepSheet({
          symbol,
          trade_date: input.date,
          levels: input,
          analysis: output,
          raw_claude_response: raw,
        });

        return output;
      })
    );

    return NextResponse.json({ sheets: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
