"use client";

import { GoogleMap, Marker, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { Itinerary } from "@/lib/types";
import { ITINERARY_COLORS } from "@/lib/theme";
import { useColorScheme } from "@/lib/useColorScheme";

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function RouteMap({ itinerary }: { itinerary: Itinerary }) {
  const scheme = useColorScheme();
  const color = ITINERARY_COLORS[itinerary.id]?.[scheme] ?? "#2a78d6";

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: MAPS_API_KEY ?? "",
    id: "date-planner-google-map-script",
  });

  if (!MAPS_API_KEY) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/40 p-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
        Add a <code className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
        to see this route on an interactive map.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 h-72 flex items-center justify-center text-sm text-neutral-400">
        Loading map…
      </div>
    );
  }

  const path = itinerary.stops.map((s) => ({ lat: s.venue.lat, lng: s.venue.lng }));
  const bounds = path.reduce(
    (b, p) => ({
      minLat: Math.min(b.minLat, p.lat),
      maxLat: Math.max(b.maxLat, p.lat),
      minLng: Math.min(b.minLng, p.lng),
      maxLng: Math.max(b.maxLng, p.lng),
    }),
    { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 }
  );
  const center = {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lng: (bounds.minLng + bounds.maxLng) / 2,
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800">
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "18rem" }}
        center={center}
        zoom={14}
        options={{ disableDefaultUI: true, zoomControl: true }}
      >
        <Polyline path={path} options={{ strokeColor: color, strokeWeight: 3 }} />
        {itinerary.stops.map((stop, i) => (
          <Marker
            key={stop.venue.id}
            position={{ lat: stop.venue.lat, lng: stop.venue.lng }}
            label={{ text: String(i + 1), color: "white" }}
          />
        ))}
      </GoogleMap>
    </div>
  );
}
