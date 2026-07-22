export type Vibe = "romantic" | "casual" | "adventurous" | "foodie" | "artsy" | "chill";

export type StopCategory = "coffee" | "lunch" | "dinner" | "drinks" | "activity" | "dessert";

export type TransportMode = "walking" | "transit" | "driving";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

export const VIBES: { value: Vibe; label: string; emoji: string }[] = [
  { value: "romantic", label: "Romantic", emoji: "🕯️" },
  { value: "casual", label: "Casual", emoji: "👟" },
  { value: "adventurous", label: "Adventurous", emoji: "🧗" },
  { value: "foodie", label: "Foodie", emoji: "🍽️" },
  { value: "artsy", label: "Artsy", emoji: "🎨" },
  { value: "chill", label: "Chill", emoji: "🌿" },
];

export const NEIGHBORHOODS = [
  "Anywhere in NYC",
  "East Village",
  "West Village",
  "SoHo",
  "Lower East Side",
  "Chelsea",
  "Williamsburg",
  "DUMBO",
  "Upper West Side",
  "Upper East Side",
  "Midtown",
  "Astoria",
] as const;

export type Neighborhood = (typeof NEIGHBORHOODS)[number];

export interface Venue {
  id: string;
  name: string;
  category: StopCategory;
  neighborhood: Exclude<Neighborhood, "Anywhere in NYC">;
  lat: number;
  lng: number;
  priceLevel: 1 | 2 | 3 | 4;
  rating: number;
  vibeTags: Vibe[];
  description: string;
  address: string;
}

export interface FormInput {
  neighborhood: Neighborhood;
  vibe: Vibe;
  budget: 1 | 2 | 3 | 4;
  stopCount: 2 | 3 | 4;
  timeOfDay: TimeOfDay;
  transportMode: TransportMode;
}

export interface Leg {
  fromVenueId: string;
  toVenueId: string;
  distanceMiles: number;
  durationMinutes: number;
  mode: TransportMode;
}

export interface ItineraryStop {
  venue: Venue;
  startLabel: string;
  durationMinutes: number;
}

export interface Itinerary {
  id: string;
  title: string;
  tagline: string;
  stops: ItineraryStop[];
  legs: Leg[];
  totals: {
    estCostLow: number;
    estCostHigh: number;
    totalMinutes: number;
    travelMinutes: number;
    travelMiles: number;
    avgRating: number;
  };
}

export interface PlanResponse {
  itineraries: Itinerary[];
  source: "mock" | "live";
}
