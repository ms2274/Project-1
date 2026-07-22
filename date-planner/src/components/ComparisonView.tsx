"use client";

import { useState } from "react";
import { Itinerary } from "@/lib/types";
import { ITINERARY_COLORS } from "@/lib/theme";
import { useColorScheme } from "@/lib/useColorScheme";

interface Metric {
  key: string;
  label: string;
  unit: string;
  value: (it: Itinerary) => number;
  format: (v: number) => string;
  lowerIsBetter: boolean;
}

const METRICS: Metric[] = [
  {
    key: "cost",
    label: "Estimated cost",
    unit: "$",
    value: (it) => (it.totals.estCostLow + it.totals.estCostHigh) / 2,
    format: (v) => `$${Math.round(v)}`,
    lowerIsBetter: true,
  },
  {
    key: "time",
    label: "Total time",
    unit: "hrs",
    value: (it) => it.totals.totalMinutes / 60,
    format: (v) => `${v.toFixed(1)}h`,
    lowerIsBetter: true,
  },
  {
    key: "travel",
    label: "Travel distance",
    unit: "mi",
    value: (it) => it.totals.travelMiles,
    format: (v) => `${v.toFixed(1)} mi`,
    lowerIsBetter: true,
  },
  {
    key: "rating",
    label: "Average rating",
    unit: "★",
    value: (it) => it.totals.avgRating,
    format: (v) => `${v.toFixed(1)}★`,
    lowerIsBetter: false,
  },
];

function MiniBarChart({ metric, itineraries, colors }: { metric: Metric; itineraries: Itinerary[]; colors: string[] }) {
  const values = itineraries.map(metric.value);
  const max = Math.max(...values, 0.001);
  const best = metric.lowerIsBetter ? Math.min(...values) : Math.max(...values);

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">{metric.label}</div>
      <div className="space-y-2.5">
        {itineraries.map((it, i) => {
          const v = metric.value(it);
          const pct = Math.max(4, (v / max) * 100);
          const isBest = v === best;
          return (
            <div key={it.id} className="flex items-center gap-2">
              <div className="w-28 shrink-0 text-xs text-neutral-500 dark:text-neutral-400 truncate">{it.title}</div>
              <div className="flex-1 h-5 rounded bg-neutral-100 dark:bg-neutral-800 relative overflow-hidden">
                <div
                  className="h-full rounded flex items-center justify-end pr-1.5"
                  style={{ width: `${pct}%`, backgroundColor: colors[i] }}
                >
                  <span className="text-[10px] font-medium text-white whitespace-nowrap">{metric.format(v)}</span>
                </div>
              </div>
              {isBest && <span className="text-[10px] text-neutral-400 shrink-0">best</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ComparisonView({ itineraries }: { itineraries: Itinerary[] }) {
  const [tableView, setTableView] = useState(false);
  const scheme = useColorScheme();
  const colors = itineraries.map((it) => ITINERARY_COLORS[it.id]?.[scheme] ?? "#2a78d6");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {itineraries.map((it, i) => (
            <div key={it.id} className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[i] }} />
              {it.title}
            </div>
          ))}
        </div>
        <button
          onClick={() => setTableView((v) => !v)}
          className="text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 underline underline-offset-2"
        >
          {tableView ? "Show chart view" : "Show table view"}
        </button>
      </div>

      {tableView ? (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-900 text-left">
                <th className="p-3 font-medium text-neutral-500">Metric</th>
                {itineraries.map((it) => (
                  <th key={it.id} className="p-3 font-medium text-neutral-700 dark:text-neutral-300">
                    {it.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => (
                <tr key={m.key} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="p-3 text-neutral-500">{m.label}</td>
                  {itineraries.map((it) => (
                    <td key={it.id} className="p-3 text-neutral-900 dark:text-neutral-100">
                      {m.format(m.value(it))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {METRICS.map((m) => (
            <MiniBarChart key={m.key} metric={m} itineraries={itineraries} colors={colors} />
          ))}
        </div>
      )}
    </div>
  );
}
