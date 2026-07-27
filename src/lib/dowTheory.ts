export type TrendClassification = "uptrend" | "downtrend" | "sideways";

export interface SwingPoint {
  index: number;
  price: number;
  timestamp: number;
}

export interface DowTheoryResult {
  trend: TrendClassification;
  swingHighs: SwingPoint[];
  swingLows: SwingPoint[];
  rationale: string;
}

function findSwingPoints(
  bars: { t: number; h: number; l: number }[],
  lookback = 2
): { highs: SwingPoint[]; lows: SwingPoint[] } {
  const highs: SwingPoint[] = [];
  const lows: SwingPoint[] = [];

  for (let i = lookback; i < bars.length - lookback; i++) {
    const window = bars.slice(i - lookback, i + lookback + 1);
    const bar = bars[i];

    if (window.every((b) => b.h <= bar.h)) {
      highs.push({ index: i, price: bar.h, timestamp: bar.t });
    }
    if (window.every((b) => b.l >= bar.l)) {
      lows.push({ index: i, price: bar.l, timestamp: bar.t });
    }
  }

  return { highs, lows };
}

function isMonotonic(values: number[], direction: "up" | "down"): boolean {
  if (values.length < 2) return false;
  for (let i = 1; i < values.length; i++) {
    if (direction === "up" && values[i] <= values[i - 1]) return false;
    if (direction === "down" && values[i] >= values[i - 1]) return false;
  }
  return true;
}

function fmt(points: SwingPoint[]): string {
  return points.map((p) => p.price.toFixed(2)).join(" -> ");
}

export function classifyWeeklyTrend(
  weeklyBars: { t: number; h: number; l: number }[]
): DowTheoryResult {
  const { highs, lows } = findSwingPoints(weeklyBars, 2);
  const recentHighs = highs.slice(-4);
  const recentLows = lows.slice(-4);

  const higherHighs = isMonotonic(
    recentHighs.map((h) => h.price),
    "up"
  );
  const higherLows = isMonotonic(
    recentLows.map((l) => l.price),
    "up"
  );
  const lowerHighs = isMonotonic(
    recentHighs.map((h) => h.price),
    "down"
  );
  const lowerLows = isMonotonic(
    recentLows.map((l) => l.price),
    "down"
  );

  let trend: TrendClassification = "sideways";
  let rationale = "No clear sequence of higher/lower highs and lows in recent weekly swings.";

  if (higherHighs && higherLows) {
    trend = "uptrend";
    rationale = `Higher highs (${fmt(recentHighs)}) and higher lows (${fmt(recentLows)}).`;
  } else if (lowerHighs && lowerLows) {
    trend = "downtrend";
    rationale = `Lower highs (${fmt(recentHighs)}) and lower lows (${fmt(recentLows)}).`;
  }

  return { trend, swingHighs: highs, swingLows: lows, rationale };
}
