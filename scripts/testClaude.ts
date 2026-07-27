import { config } from "dotenv";
config({ path: ".env.local" });

import { fetchVixQuote } from "../src/lib/fmp";
import { getUpcomingMarketHolidays } from "../src/lib/polygon";
import { buildPrepSheetInput } from "../src/lib/buildPrepSheetInput";
import { generatePrepSheet } from "../src/lib/claude";

const SYMBOL = "SPY";

async function main() {
  console.log(`Building prep sheet input for ${SYMBOL}...\n`);

  const vix = await fetchVixQuote().catch((err) => {
    console.error("VIX fetch failed, continuing without it:", err.message);
    return null;
  });

  const holidays = await getUpcomingMarketHolidays().catch((err) => {
    console.error("Holidays fetch failed, continuing without them:", err.message);
    return [];
  });

  const input = await buildPrepSheetInput(SYMBOL, vix, holidays);

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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
