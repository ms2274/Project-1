import { config } from "dotenv";
config({ path: ".env.local" });

import {
  get1mBars,
  get30mBars,
  get4hBars,
  getWeeklyBars,
  mostRecentSessionBars,
  filterRegularSession,
} from "../src/lib/polygon";
import { buildVolumeProfile, LVN_BIN_SIZE, VolumeProfileResult } from "../src/lib/volumeProfile";
import { classifyWeeklyTrend } from "../src/lib/dowTheory";
import { fetchVixQuote } from "../src/lib/fmp";
import { classifyVix } from "../src/lib/vix";

const SYMBOLS = ["SPY", "QQQ"];

function printProfile(label: string, vp: VolumeProfileResult, barCount: number) {
  console.log(`\n[${label}, ${barCount} bars]`);
  console.log(`  POC: ${vp.poc.toFixed(2)}  VAH: ${vp.vah.toFixed(2)}  VAL: ${vp.val.toFixed(2)}`);
  const zones = vp.lvns.map((z) => `${z.low.toFixed(2)}-${z.high.toFixed(2)}`).join(", ");
  console.log(`  LVN zones (${vp.lvns.length}): ${zones || "none"}`);
}

async function main() {
  console.log("=== VIX regime ===");
  try {
    const vix = await fetchVixQuote();
    console.log(`VIX: ${vix.price.toFixed(2)} (${vix.changePercent.toFixed(2)}%) -> regime: ${classifyVix(vix.price)}`);
  } catch (err) {
    console.error("FMP VIX fetch failed:", err);
  }

  for (const symbol of SYMBOLS) {
    console.log(`\n=== ${symbol} ===`);
    try {
      const [oneMin, thirtyMin, fourHour, weekly] = await Promise.all([
        get1mBars(symbol),
        get30mBars(symbol),
        get4hBars(symbol),
        getWeeklyBars(symbol),
      ]);

      console.log(`Raw bars fetched — 1m: ${oneMin.length}, 30m: ${thirtyMin.length}, 4h: ${fourHour.length}, weekly: ${weekly.length}`);

      const lastSession1m = filterRegularSession(mostRecentSessionBars(oneMin));
      const regular30m = filterRegularSession(thirtyMin);

      printProfile("1m / prior session", buildVolumeProfile(lastSession1m, LVN_BIN_SIZE["1m"]), lastSession1m.length);
      printProfile("30m / recent sessions", buildVolumeProfile(regular30m, LVN_BIN_SIZE["30m"]), regular30m.length);
      printProfile("4h / longer lookback", buildVolumeProfile(fourHour, LVN_BIN_SIZE["4h"]), fourHour.length);

      const trend = classifyWeeklyTrend(weekly);
      console.log(`\nWeekly Dow Theory trend: ${trend.trend}`);
      console.log(`  ${trend.rationale}`);
      console.log(`  Last 5 swing highs: ${trend.swingHighs.slice(-5).map((h) => h.price.toFixed(2)).join(", ")}`);
      console.log(`  Last 5 swing lows:  ${trend.swingLows.slice(-5).map((l) => l.price.toFixed(2)).join(", ")}`);
    } catch (err) {
      console.error(`Failed for ${symbol}:`, err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
