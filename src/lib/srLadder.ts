import type { SwingPoint } from "./dowTheory";

export interface SrLevel {
  label: string;
  price: number;
}

export interface SrLadder {
  resistance: SrLevel[];
  support: SrLevel[];
}

function dedupe(sortedPrices: number[], tolerance: number): number[] {
  const result: number[] = [];
  for (const price of sortedPrices) {
    if (result.length === 0 || Math.abs(price - result[result.length - 1]) > tolerance) {
      result.push(price);
    }
  }
  return result;
}

export function buildSrLadder(
  currentPrice: number,
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[],
  options: { maxLevels?: number; dedupeTolerance?: number } = {}
): SrLadder {
  const maxLevels = options.maxLevels ?? 8;
  const tolerance = options.dedupeTolerance ?? 0.5;

  const above = dedupe(
    swingHighs
      .map((h) => h.price)
      .filter((p) => p > currentPrice)
      .sort((a, b) => a - b),
    tolerance
  ).slice(0, maxLevels);

  const below = dedupe(
    swingLows
      .map((l) => l.price)
      .filter((p) => p < currentPrice)
      .sort((a, b) => b - a),
    tolerance
  ).slice(0, maxLevels);

  return {
    resistance: above.map((price, i) => ({ label: `R${i + 1}`, price })),
    support: below.map((price, i) => ({ label: `S${i + 1}`, price })),
  };
}
