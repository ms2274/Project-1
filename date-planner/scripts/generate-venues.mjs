// One-off deterministic generator for the sample/demo venue dataset used
// as a fallback data source when no Google Places API key is configured.
// Run with: node scripts/generate-venues.mjs > src/data/venues.json
// Coordinates are the real approximate center of each neighborhood, jittered
// slightly; venue names/ratings/prices are fictional demo content.

const NEIGHBORHOODS = [
  { name: "East Village", lat: 40.7265, lng: -73.9815 },
  { name: "West Village", lat: 40.7336, lng: -74.0027 },
  { name: "SoHo", lat: 40.7233, lng: -74.003 },
  { name: "Lower East Side", lat: 40.715, lng: -73.9843 },
  { name: "Chelsea", lat: 40.7465, lng: -74.0014 },
  { name: "Williamsburg", lat: 40.7081, lng: -73.9571 },
  { name: "DUMBO", lat: 40.7033, lng: -73.9881 },
  { name: "Upper West Side", lat: 40.787, lng: -73.9754 },
  { name: "Upper East Side", lat: 40.7736, lng: -73.9566 },
  { name: "Midtown", lat: 40.7549, lng: -73.984 },
  { name: "Astoria", lat: 40.7643, lng: -73.9235 },
];

const CATEGORY_NAME_PARTS = {
  coffee: {
    prefixes: ["Daily", "Corner", "Third Wave", "Sunday", "Velvet", "Roast &"],
    nouns: ["Coffee Co.", "Espresso Bar", "Coffee Room", "Brew House", "Cafe"],
  },
  lunch: {
    prefixes: ["The", "Little", "Corner", "Golden", "Green"],
    nouns: ["Kitchen", "Deli", "Bistro", "Noodle Bar", "Sandwich Shop"],
  },
  dinner: {
    prefixes: ["Lantern &", "The Rustic", "Casa", "Bar", "Osteria", "The Copper"],
    nouns: ["Vine", "Table", "Fico", "Otto", "Fern", "Pot"],
  },
  drinks: {
    prefixes: ["The Hidden", "Low", "Night", "The Velvet", "Amber"],
    nouns: ["Flask", "Key Lounge", "Owl", "Room", "Room & Co."],
  },
  activity: {
    prefixes: ["The", "Neighborhood", "Riverside", "Downtown", "Uptown"],
    nouns: ["Arcade", "Art Studio", "Bowling Lounge", "Rooftop Garden", "Gallery", "Escape Room"],
  },
  dessert: {
    prefixes: ["Sweet", "The Little", "Moonlight", "Sugar &", "Cloud Nine"],
    nouns: ["Creamery", "Bakeshop", "Gelato Bar", "Bake Shop", "Patisserie"],
  },
};

const VIBE_AFFINITY = {
  coffee: ["chill", "casual", "artsy"],
  lunch: ["casual", "foodie", "chill"],
  dinner: ["romantic", "foodie", "adventurous"],
  drinks: ["romantic", "adventurous", "casual"],
  activity: ["adventurous", "artsy", "casual", "chill"],
  dessert: ["romantic", "chill", "casual"],
};

const DESCRIPTIONS = {
  coffee: "A cozy spot to ease into the day with a great espresso and quiet corners to talk.",
  lunch: "Relaxed daytime spot, easy to linger over a shared plate.",
  dinner: "A warmly lit dining room built for a leisurely, conversation-friendly meal.",
  drinks: "Low lights, good cocktails, and enough noise to feel lively without shouting.",
  activity: "A hands-on, memorable way to spend an hour together that isn't just sitting at a table.",
  dessert: "The kind of last stop that turns a good night into a great one.",
};

// deterministic seeded PRNG (mulberry32)
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260722);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

let idCounter = 1;
const venues = [];

for (const hood of NEIGHBORHOODS) {
  for (const category of Object.keys(CATEGORY_NAME_PARTS)) {
    // 1-2 venues per neighborhood/category for variety
    const count = rand() > 0.6 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const parts = CATEGORY_NAME_PARTS[category];
      const name = `${pick(parts.prefixes)} ${pick(parts.nouns)}`;
      const affinity = VIBE_AFFINITY[category];
      const extraVibe = pick(["romantic", "casual", "adventurous", "foodie", "artsy", "chill"]);
      const vibeTags = Array.from(new Set([pick(affinity), pick(affinity), extraVibe]));
      const priceLevel = Math.min(4, Math.max(1, Math.round(1 + rand() * 3)));
      const rating = Math.round((3.7 + rand() * 1.1) * 10) / 10;

      venues.push({
        id: `v${idCounter++}`,
        name,
        category,
        neighborhood: hood.name,
        lat: Math.round((hood.lat + (rand() - 0.5) * 0.012) * 1e6) / 1e6,
        lng: Math.round((hood.lng + (rand() - 0.5) * 0.012) * 1e6) / 1e6,
        priceLevel,
        rating,
        vibeTags,
        description: DESCRIPTIONS[category],
        address: `${100 + Math.floor(rand() * 400)} ${pick(["Bedford Ave", "1st Ave", "Mulberry St", "Bleecker St", "Grand St", "5th Ave", "Court St"])}, ${hood.name}, NY`,
      });
    }
  }
}

process.stdout.write(JSON.stringify(venues, null, 2) + "\n");
