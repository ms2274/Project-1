import { TransportMode } from "./types";
import { haversineMiles } from "./geo";

export interface LegResult {
  distanceMiles: number;
  durationMinutes: number;
}

export interface DirectionsProvider {
  route(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    mode: TransportMode
  ): Promise<LegResult>;
}

// Average effective speeds in NYC, accounting for street grid detours,
// waiting for trains/lights, etc. Used both as the mock estimate and as a
// sanity fallback if a live directions call fails.
const MODE_SPEED_MPH: Record<TransportMode, number> = {
  walking: 2.8,
  transit: 9,
  driving: 12,
};

const MODE_STRAIGHT_LINE_FACTOR = 1.3; // streets aren't as-the-crow-flies

class MockDirectionsProvider implements DirectionsProvider {
  async route(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    mode: TransportMode
  ): Promise<LegResult> {
    const straightLine = haversineMiles(origin.lat, origin.lng, destination.lat, destination.lng);
    const distanceMiles = Math.round(straightLine * MODE_STRAIGHT_LINE_FACTOR * 100) / 100;
    const durationMinutes = Math.max(3, Math.round((distanceMiles / MODE_SPEED_MPH[mode]) * 60));
    return { distanceMiles, durationMinutes };
  }
}

class LiveDirectionsProvider implements DirectionsProvider {
  constructor(private apiKey: string) {}

  async route(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    mode: TransportMode
  ): Promise<LegResult> {
    const travelMode = { walking: "walking", transit: "transit", driving: "driving" }[mode];
    const params = new URLSearchParams({
      origins: `${origin.lat},${origin.lng}`,
      destinations: `${destination.lat},${destination.lng}`,
      mode: travelMode,
      units: "imperial",
      key: this.apiKey,
    });

    const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${params}`);
    if (!res.ok) {
      throw new Error(`Distance Matrix request failed: ${res.status}`);
    }
    const data = await res.json();
    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== "OK") {
      // Fall back to the haversine estimate rather than failing the whole plan.
      return new MockDirectionsProvider().route(origin, destination, mode);
    }

    return {
      distanceMiles: Math.round((element.distance.value / 1609.34) * 100) / 100,
      durationMinutes: Math.round(element.duration.value / 60),
    };
  }
}

let cachedProvider: DirectionsProvider | null = null;

export function getDirectionsProvider(): DirectionsProvider {
  if (cachedProvider) return cachedProvider;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  cachedProvider = apiKey ? new LiveDirectionsProvider(apiKey) : new MockDirectionsProvider();
  return cachedProvider;
}
