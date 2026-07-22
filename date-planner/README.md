# Date Planner (NYC)

Input a few factors about the date you want (vibe, neighborhood, budget, number
of stops, time of day, transportation) and get back three complete, ready-to-go
itineraries — each with real logistics (travel time/distance between stops)
already worked out — plus a side-by-side comparison so picking one is fast.

## Running it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Demo mode vs. live mode

By default the app runs in **demo mode**: it generates itineraries from a
bundled sample dataset of ~90 fictional NYC venues (`src/data/venues.json`),
using straight-line-distance estimates for travel time. This is enough to use
and test the whole app with no setup.

To switch to **live mode** — real, current NYC venues from Google Places, and
real travel times/distances from Google's Distance Matrix API — copy
`.env.local.example` to `.env.local` and fill in:

```bash
GOOGLE_PLACES_API_KEY=...           # enables live venue search + directions
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=... # enables the interactive map in itinerary detail
```

Both keys come from the [Google Cloud Console](https://console.cloud.google.com/).
`GOOGLE_PLACES_API_KEY` needs the "Places API (New)" and "Distance Matrix API"
enabled and is used server-side only. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` needs
the "Maps JavaScript API" enabled, is exposed to the browser, and should be
restricted to your domain. The app falls back gracefully if either key is
missing — you just lose live venue data or the interactive map, respectively.

## How it works

1. `src/lib/places.ts` — venue search. Swaps between the mock dataset and a
   live Google Places (New) Text Search call based on whether
   `GOOGLE_PLACES_API_KEY` is set.
2. `src/lib/directions.ts` — travel time/distance between two points. Swaps
   between a haversine-distance estimate and a live Google Distance Matrix
   call the same way.
3. `src/lib/itinerary.ts` — given the form input, fetches candidate venues per
   stop category, then builds three distinct itineraries: **Top Picks**
   (highest-rated match per stop), **Easiest to Get Between** (the combination
   of candidates with the least total travel distance), and **Something a
   Little Different** (a distinct, high-rated alternative combination).
4. The UI (`src/app/page.tsx` + `src/components/*`) renders the three options
   as cards, a detail view per itinerary (map + stop-by-stop timeline with
   travel legs), and a comparison view (cost, total time, travel distance,
   average rating) across all three.
