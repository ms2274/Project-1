import { getDirectionsProvider } from "./directions";
import { haversineMiles } from "./geo";
import { getPlacesProvider } from "./places";
import { FormInput, Itinerary, ItineraryStop, Leg, Venue } from "./types";
import { CATEGORY_LABELS, TIME_OF_DAY_SEQUENCES } from "./vibeMappings";

const CANDIDATES_PER_CATEGORY = 5;

const STOP_DURATION_MINUTES: Record<Venue["category"], number> = {
  coffee: 30,
  lunch: 45,
  dinner: 80,
  drinks: 50,
  activity: 65,
  dessert: 30,
};

// [low, high] per-person dollar estimate at each Google-style price level (1-4).
const PRICE_RANGES: Record<Venue["category"], [number, number][]> = {
  coffee: [
    [6, 10],
    [8, 14],
    [12, 18],
    [16, 25],
  ],
  lunch: [
    [12, 18],
    [18, 28],
    [28, 45],
    [45, 70],
  ],
  dinner: [
    [20, 30],
    [30, 55],
    [55, 90],
    [90, 150],
  ],
  drinks: [
    [10, 15],
    [15, 25],
    [25, 40],
    [40, 65],
  ],
  activity: [
    [0, 15],
    [15, 30],
    [30, 50],
    [50, 90],
  ],
  dessert: [
    [5, 9],
    [8, 14],
    [12, 20],
    [18, 30],
  ],
};

const TIME_OF_DAY_START_HOUR: Record<FormInput["timeOfDay"], number> = {
  morning: 10,
  afternoon: 13,
  evening: 18,
  night: 20,
};

function formatClock(totalMinutesFromMidnight: number): string {
  const hour24 = Math.floor(totalMinutesFromMidnight / 60) % 24;
  const minute = totalMinutesFromMidnight % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
}

function cartesianProduct<T>(lists: T[][]): T[][] {
  return lists.reduce<T[][]>(
    (acc, list) => acc.flatMap((combo) => list.map((item) => [...combo, item])),
    [[]]
  );
}

function comboStraightLineMiles(combo: Venue[]): number {
  let total = 0;
  for (let i = 0; i < combo.length - 1; i++) {
    total += haversineMiles(combo[i].lat, combo[i].lng, combo[i + 1].lat, combo[i + 1].lng);
  }
  return total;
}

function comboAvgRating(combo: Venue[]): number {
  return combo.reduce((sum, v) => sum + v.rating, 0) / combo.length;
}

function comboKey(combo: Venue[]): string {
  return combo.map((v) => v.id).join("|");
}

async function buildItinerary(
  id: string,
  title: string,
  tagline: string,
  combo: Venue[],
  input: FormInput
): Promise<Itinerary> {
  const directionsProvider = getDirectionsProvider();
  const legs: Leg[] = [];
  for (let i = 0; i < combo.length - 1; i++) {
    const { distanceMiles, durationMinutes } = await directionsProvider.route(
      combo[i],
      combo[i + 1],
      input.transportMode
    );
    legs.push({
      fromVenueId: combo[i].id,
      toVenueId: combo[i + 1].id,
      distanceMiles,
      durationMinutes,
      mode: input.transportMode,
    });
  }

  const stops: ItineraryStop[] = [];
  let clockMinutes = TIME_OF_DAY_START_HOUR[input.timeOfDay] * 60;
  for (let i = 0; i < combo.length; i++) {
    const venue = combo[i];
    stops.push({
      venue,
      startLabel: formatClock(clockMinutes),
      durationMinutes: STOP_DURATION_MINUTES[venue.category],
    });
    clockMinutes += STOP_DURATION_MINUTES[venue.category];
    if (i < legs.length) clockMinutes += legs[i].durationMinutes;
  }

  const estCostLow = combo.reduce((sum, v) => sum + PRICE_RANGES[v.category][v.priceLevel - 1][0], 0);
  const estCostHigh = combo.reduce((sum, v) => sum + PRICE_RANGES[v.category][v.priceLevel - 1][1], 0);
  const travelMinutes = legs.reduce((sum, l) => sum + l.durationMinutes, 0);
  const travelMiles = Math.round(legs.reduce((sum, l) => sum + l.distanceMiles, 0) * 100) / 100;
  const stopMinutes = combo.reduce((sum, v) => sum + STOP_DURATION_MINUTES[v.category], 0);

  return {
    id,
    title,
    tagline,
    stops,
    legs,
    totals: {
      estCostLow,
      estCostHigh,
      totalMinutes: stopMinutes + travelMinutes,
      travelMinutes,
      travelMiles,
      avgRating: Math.round(comboAvgRating(combo) * 10) / 10,
    },
  };
}

export async function generateItineraries(input: FormInput): Promise<Itinerary[]> {
  const categories = TIME_OF_DAY_SEQUENCES[input.timeOfDay].slice(0, input.stopCount);
  const placesProvider = getPlacesProvider();

  const candidateLists = await Promise.all(
    categories.map((category) =>
      placesProvider.search({
        category,
        neighborhood: input.neighborhood,
        vibe: input.vibe,
        budget: input.budget,
        limit: CANDIDATES_PER_CATEGORY,
      })
    )
  );

  // Guard against a category coming back empty (e.g. a very narrow neighborhood filter).
  candidateLists.forEach((list, i) => {
    if (list.length === 0) {
      throw new Error(`No ${categories[i]} options found for these filters. Try "Anywhere in NYC" or a different vibe.`);
    }
  });

  const allCombos = cartesianProduct(candidateLists);

  const topPicksCombo = candidateLists.map((list) => list[0]);
  const topPicksKey = comboKey(topPicksCombo);

  // Prefer a distinct combo for each slot when the candidate pool allows it,
  // so a narrow filter (e.g. one neighborhood) doesn't surface the same
  // itinerary twice under different titles.
  const distinctFromTopPicks = allCombos.filter((combo) => comboKey(combo) !== topPicksKey);

  const easiestLogisticsCombo =
    [...(distinctFromTopPicks.length > 0 ? distinctFromTopPicks : allCombos)].sort(
      (a, b) => comboStraightLineMiles(a) - comboStraightLineMiles(b)
    )[0] ?? topPicksCombo;

  const usedKeys = new Set([topPicksKey, comboKey(easiestLogisticsCombo)]);
  const distinctFromBoth = allCombos.filter((combo) => !usedKeys.has(comboKey(combo)));
  const hiddenGemCombo =
    [...(distinctFromBoth.length > 0 ? distinctFromBoth : distinctFromTopPicks)].sort(
      (a, b) => comboAvgRating(b) - comboAvgRating(a)
    )[0] ?? topPicksCombo;

  const categoryLabel = categories.map((c) => CATEGORY_LABELS[c]).join(" → ");

  const itineraries = await Promise.all([
    buildItinerary(
      "top-picks",
      "Top Picks",
      `The highest-rated ${input.vibe} spot in each stop: ${categoryLabel}.`,
      topPicksCombo,
      input
    ),
    buildItinerary(
      "easiest-logistics",
      "Easiest to Get Between",
      "Same vibe, minimal travel time — everything clusters close together.",
      easiestLogisticsCombo,
      input
    ),
    buildItinerary(
      "hidden-gems",
      "Something a Little Different",
      "A different combination worth considering — great ratings, fresh options.",
      hiddenGemCombo,
      input
    ),
  ]);

  return itineraries;
}
