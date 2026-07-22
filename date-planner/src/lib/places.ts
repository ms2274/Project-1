import venuesData from "@/data/venues.json";
import { Neighborhood, StopCategory, Venue, Vibe } from "./types";
import { LIVE_SEARCH_KEYWORDS } from "./vibeMappings";

const ALL_VENUES = venuesData as Venue[];

export interface SearchParams {
  category: StopCategory;
  neighborhood: Neighborhood;
  vibe: Vibe;
  budget: 1 | 2 | 3 | 4;
  limit: number;
}

export interface PlacesProvider {
  search(params: SearchParams): Promise<Venue[]>;
}

class MockPlacesProvider implements PlacesProvider {
  async search({ category, neighborhood, vibe, budget, limit }: SearchParams): Promise<Venue[]> {
    let candidates = ALL_VENUES.filter((v) => v.category === category);

    if (neighborhood !== "Anywhere in NYC") {
      candidates = candidates.filter((v) => v.neighborhood === neighborhood);
    }

    // Prefer venues at or below budget, but don't leave a category empty.
    const withinBudget = candidates.filter((v) => v.priceLevel <= budget);
    if (withinBudget.length > 0) candidates = withinBudget;

    const score = (v: Venue) => {
      let s = v.rating;
      if (v.vibeTags.includes(vibe)) s += 1;
      return s;
    };

    return candidates.sort((a, b) => score(b) - score(a)).slice(0, limit);
  }
}

class LivePlacesProvider implements PlacesProvider {
  constructor(private apiKey: string) {}

  async search({ category, neighborhood, vibe, budget, limit }: SearchParams): Promise<Venue[]> {
    const keyword = LIVE_SEARCH_KEYWORDS[category][vibe];
    const locationText = neighborhood === "Anywhere in NYC" ? "New York City" : `${neighborhood}, New York City`;
    const textQuery = `${keyword} in ${locationText}`;

    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.location,places.priceLevel,places.rating,places.formattedAddress,places.editorialSummary",
      },
      body: JSON.stringify({
        textQuery,
        maxResultCount: Math.min(limit, 20),
      }),
    });

    if (!res.ok) {
      throw new Error(`Google Places search failed: ${res.status} ${await res.text()}`);
    }

    interface GooglePlaceResult {
      id: string;
      displayName?: { text: string };
      location?: { latitude: number; longitude: number };
      priceLevel?: string;
      rating?: number;
      formattedAddress?: string;
      editorialSummary?: { text: string };
    }

    const data: { places?: GooglePlaceResult[] } = await res.json();
    const places = data.places ?? [];

    const priceLevelMap: Record<string, number> = {
      PRICE_LEVEL_FREE: 1,
      PRICE_LEVEL_INEXPENSIVE: 1,
      PRICE_LEVEL_MODERATE: 2,
      PRICE_LEVEL_EXPENSIVE: 3,
      PRICE_LEVEL_VERY_EXPENSIVE: 4,
    };

    return places
      .filter((p): p is GooglePlaceResult & { location: { latitude: number; longitude: number } } =>
        Boolean(p.location)
      )
      .map(
        (p): Venue => ({
          id: p.id,
          name: p.displayName?.text ?? "Unknown venue",
          category,
          neighborhood: (neighborhood === "Anywhere in NYC" ? "East Village" : neighborhood) as Venue["neighborhood"],
          lat: p.location.latitude,
          lng: p.location.longitude,
          priceLevel: (priceLevelMap[p.priceLevel ?? ""] ?? budget) as Venue["priceLevel"],
          rating: p.rating ?? 4.0,
          vibeTags: [vibe],
          description: p.editorialSummary?.text ?? "",
          address: p.formattedAddress ?? "",
        })
      )
      .slice(0, limit);
  }
}

let cachedProvider: PlacesProvider | null = null;

export function getPlacesProvider(): PlacesProvider {
  if (cachedProvider) return cachedProvider;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  cachedProvider = apiKey ? new LivePlacesProvider(apiKey) : new MockPlacesProvider();
  return cachedProvider;
}

export function isLiveMode(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}
