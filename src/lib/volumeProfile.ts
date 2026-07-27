export const LVN_BIN_SIZE: Record<"1m" | "30m" | "4h", number> = {
  "1m": 0.1,
  "30m": 0.1,
  "4h": 0.25,
};

export interface PriceBin {
  price: number;
  low: number;
  high: number;
  volume: number;
}

export interface VolumeProfileResult {
  bins: PriceBin[];
  poc: number;
  vah: number;
  val: number;
  lvns: number[];
  totalVolume: number;
}

interface VolumeProfileOptions {
  valueAreaPct?: number;
  lvnThresholdPct?: number;
}

export function buildVolumeProfile(
  bars: { h: number; l: number; v: number }[],
  binSize: number,
  options: VolumeProfileOptions = {}
): VolumeProfileResult {
  const valueAreaPct = options.valueAreaPct ?? 0.7;
  const lvnThresholdPct = options.lvnThresholdPct ?? 0.2;

  if (bars.length === 0) {
    return { bins: [], poc: 0, vah: 0, val: 0, lvns: [], totalVolume: 0 };
  }

  const minPrice = Math.min(...bars.map((b) => b.l));
  const maxPrice = Math.max(...bars.map((b) => b.h));
  const binCount = Math.max(1, Math.ceil((maxPrice - minPrice) / binSize));

  const bins: PriceBin[] = Array.from({ length: binCount }, (_, i) => {
    const low = minPrice + i * binSize;
    const high = low + binSize;
    return { price: (low + high) / 2, low, high, volume: 0 };
  });

  for (const bar of bars) {
    const barRange = bar.h - bar.l;

    if (barRange <= 0) {
      const idx = clamp(Math.floor((bar.l - minPrice) / binSize), 0, binCount - 1);
      bins[idx].volume += bar.v;
      continue;
    }

    const startIdx = clamp(Math.floor((bar.l - minPrice) / binSize), 0, binCount - 1);
    const endIdx = clamp(Math.floor((bar.h - minPrice) / binSize), 0, binCount - 1);

    for (let idx = startIdx; idx <= endIdx; idx++) {
      const bin = bins[idx];
      const overlap = Math.max(0, Math.min(bin.high, bar.h) - Math.max(bin.low, bar.l));
      bin.volume += bar.v * (overlap / barRange);
    }
  }

  const totalVolume = bins.reduce((sum, b) => sum + b.volume, 0);

  let pocIdx = 0;
  for (let i = 1; i < bins.length; i++) {
    if (bins[i].volume > bins[pocIdx].volume) pocIdx = i;
  }
  const poc = bins[pocIdx]?.price ?? 0;

  let loIdx = pocIdx;
  let hiIdx = pocIdx;
  let accumulated = bins[pocIdx]?.volume ?? 0;
  const target = totalVolume * valueAreaPct;

  while (accumulated < target && (loIdx > 0 || hiIdx < bins.length - 1)) {
    const belowVol = loIdx > 0 ? bins[loIdx - 1].volume : -1;
    const aboveVol = hiIdx < bins.length - 1 ? bins[hiIdx + 1].volume : -1;

    if (aboveVol >= belowVol) {
      hiIdx++;
      accumulated += bins[hiIdx].volume;
    } else {
      loIdx--;
      accumulated += bins[loIdx].volume;
    }
  }

  const val = bins[loIdx]?.low ?? 0;
  const vah = bins[hiIdx]?.high ?? 0;

  const lvns: number[] = [];
  for (let i = 1; i < bins.length - 1; i++) {
    const bin = bins[i];
    const isLocalMin = bin.volume <= bins[i - 1].volume && bin.volume <= bins[i + 1].volume;
    if (!isLocalMin || bin.volume === 0) continue;

    const referencePeak = Math.max(nearestPeak(bins, i, -1), nearestPeak(bins, i, 1));
    if (referencePeak > 0 && bin.volume < referencePeak * lvnThresholdPct) {
      lvns.push(bin.price);
    }
  }

  return { bins, poc, vah, val, lvns, totalVolume };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function nearestPeak(bins: PriceBin[], fromIdx: number, direction: 1 | -1): number {
  let idx = fromIdx + direction;
  let maxSoFar = 0;
  while (idx >= 0 && idx < bins.length) {
    const vol = bins[idx].volume;
    if (vol >= maxSoFar) {
      maxSoFar = vol;
    } else {
      break;
    }
    idx += direction;
  }
  return maxSoFar;
}
