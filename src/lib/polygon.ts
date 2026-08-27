const POLYGON_BASE_URL = "https://api.polygon.io";

export interface PolygonBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

type BarTimespan = "minute" | "hour" | "day" | "week" | "month";

function requireApiKey(): string {
  const key = process.env.POLYGON_API_KEY;
  if (!key) throw new Error("Missing POLYGON_API_KEY env var");
  return key;
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const ET_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const ET_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function easternDateString(epochMs: number): string {
  return ET_DATE_FORMATTER.format(new Date(epochMs));
}

function easternMinutesSinceMidnight(epochMs: number): number {
  const parts = ET_TIME_FORMATTER.formatToParts(new Date(epochMs));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function isRegularSessionBar(bar: { t: number }): boolean {
  const mins = easternMinutesSinceMidnight(bar.t);
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

export function filterRegularSession<T extends { t: number }>(bars: T[]): T[] {
  return bars.filter(isRegularSessionBar);
}

export function mostRecentSessionBars(bars: PolygonBar[]): PolygonBar[] {
  if (bars.length === 0) return [];
  const lastDateStr = easternDateString(bars[bars.length - 1].t);
  return bars.filter((b) => easternDateString(b.t) === lastDateStr);
}

// Polygon's aggs endpoint paginates past 50000 results (via next_url); our lookback
// windows below are sized to stay under that in a single page, so pagination is
// intentionally not implemented yet.
export async function fetchAggregateBars(
  ticker: string,
  multiplier: number,
  timespan: BarTimespan,
  from: Date,
  to: Date
): Promise<PolygonBar[]> {
  const apiKey = requireApiKey();
  const url =
    `${POLYGON_BASE_URL}/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/` +
    `${multiplier}/${timespan}/${toDateString(from)}/${toDateString(to)}` +
    `?adjusted=true&sort=asc&limit=50000&apiKey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Polygon request failed (${res.status} ${ticker} ${multiplier}${timespan}): ${body.slice(0, 500)}`);
  }

  const json = await res.json();
  if (json.status === "ERROR" || json.status === "NOT_AUTHORIZED") {
    throw new Error(`Polygon returned ${json.status}: ${json.error ?? json.message ?? JSON.stringify(json).slice(0, 300)}`);
  }

  return Array.isArray(json.results) ? (json.results as PolygonBar[]) : [];
}

const LOOKBACK_DAYS = {
  "1m": 6,
  "30m": 16,
  "4h": 30,
} as const;

export async function get1mBars(ticker: string): Promise<PolygonBar[]> {
  const to = new Date();
  const from = new Date(to.getTime() - LOOKBACK_DAYS["1m"] * 86_400_000);
  return fetchAggregateBars(ticker, 1, "minute", from, to);
}

export async function get30mBars(ticker: string): Promise<PolygonBar[]> {
  const to = new Date();
  const from = new Date(to.getTime() - LOOKBACK_DAYS["30m"] * 86_400_000);
  return fetchAggregateBars(ticker, 30, "minute", from, to);
}

export async function get4hBars(ticker: string): Promise<PolygonBar[]> {
  const to = new Date();
  const from = new Date(to.getTime() - LOOKBACK_DAYS["4h"] * 86_400_000);
  return fetchAggregateBars(ticker, 4, "hour", from, to);
}

export async function getWeeklyBars(ticker: string, years = 2): Promise<PolygonBar[]> {
  const to = new Date();
  const from = new Date(to.getTime() - years * 365 * 86_400_000);
  return fetchAggregateBars(ticker, 1, "week", from, to);
}

export async function getDailyBars(ticker: string, days = 90): Promise<PolygonBar[]> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  return fetchAggregateBars(ticker, 1, "day", from, to);
}

export async function getMonthlyBars(ticker: string, years = 8): Promise<PolygonBar[]> {
  const to = new Date();
  const from = new Date(to.getTime() - years * 365 * 86_400_000);
  return fetchAggregateBars(ticker, 1, "month", from, to);
}

export interface SessionLevels {
  date: string;
  open: number;
  hod: number;
  lod: number;
  close: number;
}

export function computeSessionLevels(bars: PolygonBar[], date: string): SessionLevels | null {
  const sessionBars = bars.filter((b) => easternDateString(b.t) === date);
  if (sessionBars.length === 0) return null;

  return {
    date,
    open: sessionBars[0].o,
    hod: Math.max(...sessionBars.map((b) => b.h)),
    lod: Math.min(...sessionBars.map((b) => b.l)),
    close: sessionBars[sessionBars.length - 1].c,
  };
}

export function getRecentSessionDates(bars: PolygonBar[], count: number): string[] {
  const dates = Array.from(new Set(bars.map((b) => easternDateString(b.t))));
  dates.sort();
  return dates.slice(-count);
}

export interface MarketHoliday {
  date: string;
  name: string;
  status: string;
}

export async function getUpcomingMarketHolidays(): Promise<MarketHoliday[]> {
  const apiKey = requireApiKey();
  const url = `${POLYGON_BASE_URL}/v1/marketstatus/upcoming?apiKey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Polygon market holidays request failed (${res.status}): ${body.slice(0, 500)}`);
  }

  const json = await res.json();
  if (!Array.isArray(json)) return [];

  return json
    .filter((entry) => entry.exchange === "NYSE" || entry.exchange === undefined)
    .map((entry) => ({
      date: entry.date,
      name: entry.name,
      status: entry.status,
    }));
}
