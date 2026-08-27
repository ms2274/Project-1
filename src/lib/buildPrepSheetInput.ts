import {
  get1mBars,
  get30mBars,
  get4hBars,
  getWeeklyBars,
  getDailyBars,
  getMonthlyBars,
  getUpcomingMarketHolidays,
  computeSessionLevels,
  getRecentSessionDates,
  mostRecentSessionBars,
  filterRegularSession,
  easternDateString,
} from "./polygon";
import { buildVolumeProfile, LVN_BIN_SIZE, VolumeProfileResult } from "./volumeProfile";
import { classifyMonthlyTrend, classifyWeeklyTrend, classifyDailyTrend, DowTheoryResult } from "./dowTheory";
import { buildSrLadder } from "./srLadder";
import { fetchVixQuote } from "./fmp";
import { classifyVix } from "./vix";
import { PrepSheetInput, PrepSheetTimeframeLevels, TrendTierInput } from "./claude";

function toLevels(vp: VolumeProfileResult) {
  return {
    poc: vp.poc,
    vah: vp.vah,
    val: vp.val,
    lvnZones: vp.lvns.map((z) => ({ low: z.low, high: z.high })),
  };
}

function toTrendTier(trend: DowTheoryResult): TrendTierInput {
  return {
    classification: trend.trend,
    rationale: trend.rationale,
    recentSwingHighs: trend.swingHighs.slice(-5).map((h) => h.price),
    recentSwingLows: trend.swingLows.slice(-5).map((l) => l.price),
  };
}

const RELEVANT_HOLIDAY_WINDOW_MS = 7 * 86_400_000;

function filterRelevantHolidays(
  holidays: Awaited<ReturnType<typeof getUpcomingMarketHolidays>>
): Awaited<ReturnType<typeof getUpcomingMarketHolidays>> {
  const now = Date.now();
  return holidays.filter((h) => {
    const t = new Date(h.date).getTime();
    return t >= now - 86_400_000 && t <= now + RELEVANT_HOLIDAY_WINDOW_MS;
  });
}

export async function buildPrepSheetInput(
  symbol: string,
  vix: Awaited<ReturnType<typeof fetchVixQuote>> | null,
  holidays: Awaited<ReturnType<typeof getUpcomingMarketHolidays>>
): Promise<PrepSheetInput> {
  const [oneMin, thirtyMin, fourHour, weekly, daily, monthly] = await Promise.all([
    get1mBars(symbol),
    get30mBars(symbol),
    get4hBars(symbol),
    getWeeklyBars(symbol),
    getDailyBars(symbol),
    getMonthlyBars(symbol),
  ]);

  const lastSession1m = filterRegularSession(mostRecentSessionBars(oneMin));
  const regular30m = filterRegularSession(thirtyMin);

  const timeframes: PrepSheetTimeframeLevels[] = [
    { label: "1m", ...toLevels(buildVolumeProfile(lastSession1m, LVN_BIN_SIZE["1m"])) },
    { label: "30m", ...toLevels(buildVolumeProfile(regular30m, LVN_BIN_SIZE["30m"])) },
    { label: "4h", ...toLevels(buildVolumeProfile(fourHour, LVN_BIN_SIZE["4h"])) },
  ];

  const primaryTrend = classifyMonthlyTrend(monthly);
  const secondaryTrend = classifyWeeklyTrend(weekly);
  const minorTrend = classifyDailyTrend(daily);

  const currentPrice = daily.length > 0 ? daily[daily.length - 1].c : 0;
  const ladder = buildSrLadder(currentPrice, minorTrend.swingHighs, minorTrend.swingLows);

  const sessionDates = getRecentSessionDates(oneMin, 2);
  const todayDate = sessionDates[sessionDates.length - 1];
  const prevDayDate = sessionDates.length > 1 ? sessionDates[sessionDates.length - 2] : undefined;

  const sessionLevels: PrepSheetInput["sessionLevels"] = {};
  if (todayDate) {
    const levels = computeSessionLevels(oneMin, todayDate);
    if (levels) sessionLevels.today = levels;
  }
  if (prevDayDate) {
    const levels = computeSessionLevels(oneMin, prevDayDate);
    if (levels) sessionLevels.prevDay = levels;
  }

  const recentDailyBars = daily.slice(-40).map((bar) => ({
    date: easternDateString(bar.t),
    o: bar.o,
    h: bar.h,
    l: bar.l,
    c: bar.c,
    v: bar.v,
  }));

  return {
    symbol,
    date: easternDateString(Date.now()),
    currentPrice,
    vix: vix ? { price: vix.price, changePercent: vix.changePercent, regime: classifyVix(vix.price) } : null,
    trend: {
      primary: toTrendTier(primaryTrend),
      secondary: toTrendTier(secondaryTrend),
      minor: toTrendTier(minorTrend),
    },
    timeframes,
    srLadder: ladder,
    sessionLevels,
    recentDailyBars,
    upcomingHolidays: filterRelevantHolidays(holidays),
  };
}
