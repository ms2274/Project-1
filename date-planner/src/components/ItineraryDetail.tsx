"use client";

import { Itinerary } from "@/lib/types";
import { CATEGORY_EMOJI, ITINERARY_COLORS, TRANSPORT_EMOJI } from "@/lib/theme";
import { useColorScheme } from "@/lib/useColorScheme";
import RouteMap from "./RouteMap";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500 text-sm" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(Math.round(rating))}
      <span className="text-neutral-300 dark:text-neutral-700">{"★".repeat(5 - Math.round(rating))}</span>
    </span>
  );
}

export default function ItineraryDetail({ itinerary }: { itinerary: Itinerary }) {
  const scheme = useColorScheme();
  const color = ITINERARY_COLORS[itinerary.id]?.[scheme] ?? "#2a78d6";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{itinerary.title}</h2>
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{itinerary.tagline}</p>
      </div>

      <RouteMap itinerary={itinerary} />

      <ol className="relative">
        {itinerary.stops.map((stop, i) => (
          <li key={stop.venue.id} className="relative pb-8 last:pb-0">
            {i < itinerary.stops.length - 1 && (
              <span
                className="absolute left-[15px] top-9 bottom-0 w-0.5 bg-neutral-200 dark:bg-neutral-800"
                aria-hidden
              />
            )}
            <div className="flex gap-4">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-sm font-semibold"
                style={{ backgroundColor: color }}
              >
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {CATEGORY_EMOJI[stop.venue.category]} {stop.venue.name}
                  </div>
                  <div className="text-xs font-medium text-neutral-400 whitespace-nowrap">{stop.startLabel}</div>
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {stop.venue.neighborhood} &middot; {stop.venue.address}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Stars rating={stop.venue.rating} />
                  <span className="text-xs text-neutral-400">{"$".repeat(stop.venue.priceLevel)}</span>
                  <span className="text-xs text-neutral-400">&middot; ~{stop.durationMinutes} min</span>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1.5">{stop.venue.description}</p>
              </div>
            </div>

            {i < itinerary.legs.length && (
              <div className="ml-4 mt-2 flex items-center gap-2 pl-8 text-xs text-neutral-400">
                <span>{TRANSPORT_EMOJI[itinerary.legs[i].mode]}</span>
                <span>
                  {itinerary.legs[i].durationMinutes} min &middot; {itinerary.legs[i].distanceMiles} mi
                </span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
