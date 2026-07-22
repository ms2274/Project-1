"use client";

import { Itinerary } from "@/lib/types";
import { CATEGORY_EMOJI, ITINERARY_COLORS, TRANSPORT_EMOJI } from "@/lib/theme";
import { useColorScheme } from "@/lib/useColorScheme";

export default function ItineraryCard({
  itinerary,
  selected,
  onSelect,
}: {
  itinerary: Itinerary;
  selected: boolean;
  onSelect: () => void;
}) {
  const scheme = useColorScheme();
  const color = ITINERARY_COLORS[itinerary.id]?.[scheme] ?? "#2a78d6";
  const { totals } = itinerary;

  return (
    <button
      onClick={onSelect}
      className={`text-left rounded-2xl border-2 bg-white dark:bg-neutral-900 p-5 transition shadow-sm hover:shadow-md w-full ${
        selected ? "" : "border-neutral-200 dark:border-neutral-800"
      }`}
      style={selected ? { borderColor: color } : undefined}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{itinerary.title}</h3>
      </div>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">{itinerary.tagline}</p>

      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {itinerary.stops.map((stop, i) => (
          <span key={stop.venue.id} className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 text-xs text-neutral-700 dark:text-neutral-300">
              {CATEGORY_EMOJI[stop.venue.category]} {stop.venue.name}
            </span>
            {i < itinerary.stops.length - 1 && (
              <span className="text-neutral-300 dark:text-neutral-600 text-xs">
                {TRANSPORT_EMOJI[itinerary.legs[i]?.mode ?? "walking"]}
              </span>
            )}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2 text-center border-t border-neutral-100 dark:border-neutral-800 pt-3">
        <div>
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            ${totals.estCostLow}&ndash;{totals.estCostHigh}
          </div>
          <div className="text-[11px] text-neutral-400">est. cost</div>
        </div>
        <div>
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {(totals.totalMinutes / 60).toFixed(1)}h
          </div>
          <div className="text-[11px] text-neutral-400">total time</div>
        </div>
        <div>
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{totals.travelMiles}mi</div>
          <div className="text-[11px] text-neutral-400">travel</div>
        </div>
        <div>
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {totals.avgRating.toFixed(1)}★
          </div>
          <div className="text-[11px] text-neutral-400">avg rating</div>
        </div>
      </div>
    </button>
  );
}
