import { StopCategory, TimeOfDay, Vibe } from "./types";

// Category sequences offered for each time of day, in stop order.
// A plan with N stops takes the first N categories from the matching sequence.
export const TIME_OF_DAY_SEQUENCES: Record<TimeOfDay, StopCategory[]> = {
  morning: ["coffee", "activity", "lunch", "dessert"],
  afternoon: ["lunch", "activity", "coffee", "dessert"],
  evening: ["drinks", "dinner", "activity", "dessert"],
  night: ["dinner", "drinks", "activity", "dessert"],
};

// Search keywords used to build a live Google Places text query for a
// given category + vibe combination.
export const LIVE_SEARCH_KEYWORDS: Record<StopCategory, Record<Vibe, string>> = {
  coffee: {
    romantic: "cozy coffee shop",
    casual: "coffee shop",
    adventurous: "specialty coffee roaster",
    foodie: "third wave coffee shop",
    artsy: "coffee shop with art",
    chill: "quiet coffee shop",
  },
  lunch: {
    romantic: "charming lunch spot",
    casual: "casual lunch restaurant",
    adventurous: "unique lunch spot",
    foodie: "acclaimed lunch restaurant",
    artsy: "lunch spot near galleries",
    chill: "relaxed lunch cafe",
  },
  dinner: {
    romantic: "romantic restaurant",
    casual: "casual dinner restaurant",
    adventurous: "adventurous tasting menu restaurant",
    foodie: "highly rated restaurant",
    artsy: "restaurant with unique decor",
    chill: "low key dinner restaurant",
  },
  drinks: {
    romantic: "romantic cocktail bar",
    casual: "casual bar",
    adventurous: "speakeasy cocktail bar",
    foodie: "wine bar",
    artsy: "bar with live music",
    chill: "quiet wine bar",
  },
  activity: {
    romantic: "rooftop garden",
    casual: "bowling alley",
    adventurous: "escape room",
    foodie: "food hall",
    artsy: "art gallery",
    chill: "botanical garden",
  },
  dessert: {
    romantic: "dessert bar",
    casual: "ice cream shop",
    adventurous: "unique dessert shop",
    foodie: "acclaimed bakery",
    artsy: "dessert cafe",
    chill: "gelato shop",
  },
};

export const CATEGORY_LABELS: Record<StopCategory, string> = {
  coffee: "Coffee",
  lunch: "Lunch",
  dinner: "Dinner",
  drinks: "Drinks",
  activity: "Activity",
  dessert: "Dessert",
};
