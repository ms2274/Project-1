export type VixRegime = "low" | "normal" | "elevated" | "high";

const VIX_BANDS: { max: number; regime: VixRegime }[] = [
  { max: 15, regime: "low" },
  { max: 20, regime: "normal" },
  { max: 25, regime: "elevated" },
  { max: Infinity, regime: "high" },
];

export function classifyVix(price: number): VixRegime {
  for (const band of VIX_BANDS) {
    if (price <= band.max) return band.regime;
  }
  return "high";
}
