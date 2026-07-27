import { config } from "dotenv";
config({ path: ".env.local" });

import {
  get1mBars,
  get30mBars,
  get4hBars,
  getWeeklyBars,
  mostRecentSessionBars,
  filterRegularSession,
  easternDateString,
} from "../src/lib/polygon";
import { buildVolumeProfile, LVN_BIN_SIZE } from "../src/lib/volumeProfile";
import { classifyWeeklyTrend } from "../src/lib/dowTheory";
import { fetchVixQuote } from "../src/lib/fmp";
import { classifyVix } from "../src/lib/vix";
import { generatePrepSheet, PrepSheetInput, PrepSheetTimeframeLevels } from "../src/lib/claude";

const SYMBOL = "SPY";

async function main() {
  console.log(`Building prep sheet input for ${SYMBOL}...\n`);

  const [vix, oneMin, thirtyMin, fourHour, weekly] = await Promise.all([
    fetchVixQuote(),
    get1mBars(SYMBOL),
    get30mBars(SYMBOL),
    get4hBars(SYMBOL),
    getWeeklyBars(SYMBOL),
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
    symbol: SYMBOL,
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

  console.log("=== Input sent to Claude ===");
  console.log(JSON.stringify(input, null, 2));

  console.log("\n=== Calling Claude ===");
  try {
    const { output } = await generatePrepSheet(input);
    console.log("\n=== Parsed prep sheet ===");
    console.log(JSON.stringify(output, null, 2));
  } catch (err) {
    console.error("\nClaude prep sheet generation failed:");
    console.error(err);
  }
}

function toLevels(vp: ReturnType<typeof buildVolumeProfile>) {
  return {
    poc: vp.poc,
    vah: vp.vah,
    val: vp.val,
    lvnZones: vp.lvns.map((z) => ({ low: z.low, high: z.high })),
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
