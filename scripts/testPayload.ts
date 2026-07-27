import { config } from "dotenv";
config({ path: ".env.local" });

import {
  get1mBars,
  get30mBars,
  get4hBars,
  getWeeklyBars,
  getDailyBars,
  getUpcomingMarketHolidays,
  mostRecentSessionBars,
  filterRegularSession,
} from "../src/lib/polygon";
import { buildVolumeProfile, LVN_BIN_SIZE, VolumeProfileResult } from "../src/lib/volumeProfile";
import { classifyWeeklyTrend, classifyDailyTrend, DowTheoryResult } from "../src/lib/dowTheory";
import { buildSrLadder } from "../src/lib/srLadder";
import { fetchVixQuote } from "../src/lib/fmp";
import { classifyVix } from "../src/lib/vix";

const SYMBOLS = ["SPY", "QQQ"];

function printProfile(label: string, vp: VolumeProfileResult, barCount: number) {
  console.log(`\n[${label}, ${barCount} bars]`);
  console.log(`  POC: ${vp.poc.toFixed(2)}  VAH: ${vp.vah.toFixed(2)}  VAL: ${vp.val.toFixed(2)}`);
  const zones = vp.lvns.map((z) => `${z.low.toFixed(2)}-${z.high.toFixed(2)}`).join(", ");
  console.log(`  LVN zones (${vp.lvns.length}): ${zones || "none"}`);
}

function printTrend(label: string, trend: DowTheoryResult) {
  console.log(`\n${label} trend: ${trend.trend}`);
  console.log(`  ${trend.rationale}`);
  console.log(`  Last 5 swing highs: ${trend.swingHighs.slice(-5).map((h) => h.price.toFixed(2)).join(", ")}`);
  console.log(`  Last 5 swing lows:  ${trend.swingLows.slice(-5).map((l) => l.price.toFixed(2)).join(", ")}`);
}

async function main() {
  console.log("=== VIX regime ===");
  try {
    const vix = await fetchVixQuote();
    console.log(`VIX: ${vix.price.toFixed(2)} (${vix.changePercent.toFixed(2)}%) -> regime: ${classifyVix(vix.price)}`);
  } catch (err) {
    console.error("FMP VIX fetch failed:", err);
  }

  console.log("\n=== Upcoming market holidays ===");
  try {
    const holidays = await getUpcomingMarketHolidays();
    holidays.slice(0, 5).forEach((h) => console.log(`  ${h.date}: ${h.name} (${h.status})`));
    if (holidays.length === 0) console.log("  (none returned)");
  } catch (err) {
    console.error("Polygon market holidays fetch failed:", err);
  }

  for (const symbol of SYMBOLS) {
    console.log(`\n=== ${symbol} ===`);
    try {
      const [oneMin, thirtyMin, fourHour, weekly, daily] = await Promise.all([
        get1mBars(symbol),
        get30mBars(symbol),
        get4hBars(symbol),
        getWeeklyBars(symbol),
        getDailyBars(symbol),
      ]);

      console.log(
        `Raw bars fetched — 1m: ${oneMin.length}, 30m: ${thirtyMin.length}, 4h: ${fourHour.length}, weekly: ${weekly.length}, daily: ${daily.length}`
      );

      const lastSession1m = filterRegularSession(mostRecentSessionBars(oneMin));
      const regular30m = filterRegularSession(thirtyMin);

      printProfile("1m / prior session", buildVolumeProfile(lastSession1m, LVN_BIN_SIZE["1m"]), lastSession1m.length);
      printProfile("30m / recent sessions", buildVolumeProfile(regular30m, LVN_BIN_SIZE["30m"]), regular30m.length);
      printProfile("4h / longer lookback", buildVolumeProfile(fourHour, LVN_BIN_SIZE["4h"]), fourHour.length);

      const primaryTrend = classifyWeeklyTrend(weekly);
      printTrend("Primary (weekly)", primaryTrend);

      const secondaryTrend = classifyDailyTrend(daily, 50);
      printTrend("Secondary (daily, ~50d)", secondaryTrend);

      const minorTrend = classifyDailyTrend(daily, 12);
      printTrend("Minor (daily, ~12d)", minorTrend);

      if (daily.length > 0) {
        const currentPrice = daily[daily.length - 1].c;
        const ladder = buildSrLadder(currentPrice, secondaryTrend.swingHighs, secondaryTrend.swingLows);
        console.log(`\nS/R ladder (current price ${currentPrice.toFixed(2)}):`);
        console.log(`  Resistance: ${ladder.resistance.map((r) => `${r.label}=${r.price.toFixed(2)}`).join(", ") || "none"}`);
        console.log(`  Support:    ${ladder.support.map((s) => `${s.label}=${s.price.toFixed(2)}`).join(", ") || "none"}`);
      }
    } catch (err) {
      console.error(`Failed for ${symbol}:`, err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
