import { NextRequest, NextResponse } from "next/server";
import { generateItineraries } from "@/lib/itinerary";
import { isLiveMode } from "@/lib/places";
import { FormInput, PlanResponse } from "@/lib/types";

export async function POST(request: NextRequest) {
  const input = (await request.json()) as FormInput;

  try {
    const itineraries = await generateItineraries(input);
    const response: PlanResponse = {
      itineraries,
      source: isLiveMode() ? "live" : "mock",
    };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate itineraries.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
