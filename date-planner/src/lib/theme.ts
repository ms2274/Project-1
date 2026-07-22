import { StopCategory, Vibe } from "./types";

// Fixed per-itinerary identity color (categorical slots 1-3 from the
// validated palette). Same itinerary always gets the same color everywhere
// it appears (cards, comparison charts) — color follows the entity, not rank.
export const ITINERARY_COLORS: Record<string, { light: string; dark: string }> = {
  "top-picks": { light: "#2a78d6", dark: "#3987e5" },
  "easiest-logistics": { light: "#eb6834", dark: "#d95926" },
  "hidden-gems": { light: "#1baf7a", dark: "#199e70" },
};

export const VIBE_ACCENT: Record<Vibe, string> = {
  romantic: "#e87ba4",
  casual: "#2a78d6",
  adventurous: "#eb6834",
  foodie: "#eda100",
  artsy: "#4a3aa7",
  chill: "#1baf7a",
};

export const CATEGORY_EMOJI: Record<StopCategory, string> = {
  coffee: "☕",
  lunch: "🥗",
  dinner: "🍽️",
  drinks: "🍸",
  activity: "🎯",
  dessert: "🍰",
};

export const TRANSPORT_EMOJI: Record<string, string> = {
  walking: "🚶",
  transit: "🚇",
  driving: "🚗",
};
