"use client";

import { useState } from "react";
import DateForm from "@/components/DateForm";
import ItineraryCard from "@/components/ItineraryCard";
import ItineraryDetail from "@/components/ItineraryDetail";
import ComparisonView from "@/components/ComparisonView";
import { FormInput, Itinerary } from "@/lib/types";

type ViewState =
  | { status: "form" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "results"; itineraries: Itinerary[]; source: "mock" | "live"; selectedId: string };

export default function Home() {
  const [state, setState] = useState<ViewState>({ status: "form" });
  const [showComparison, setShowComparison] = useState(false);

  async function handleSubmit(input: FormInput) {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setState({
        status: "results",
        itineraries: data.itineraries,
        source: data.source,
        selectedId: data.itineraries[0].id,
      });
      setShowComparison(false);
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  return (
    <main className="flex-1 bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <header className="mb-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Plan a great date in NYC 🗽
          </h1>
          <p className="mt-2 text-neutral-500 dark:text-neutral-400">
            Tell it the vibe, get a few complete, logistics-solved options side by side.
          </p>
        </header>

        {state.status !== "results" && (
          <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm p-6 sm:p-8">
            <DateForm onSubmit={handleSubmit} submitting={state.status === "loading"} />
          </div>
        )}

        {state.status === "error" && (
          <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400">{state.message}</p>
        )}

        {state.status === "results" && (
          <div className="space-y-6">
            {state.source === "mock" && (
              <p className="text-center text-xs text-neutral-400 bg-neutral-100 dark:bg-neutral-900 rounded-full px-3 py-1.5 inline-block mx-auto">
                Showing sample demo venues &mdash; add a Google Places API key for live results.{" "}
                <span className="block sm:inline">See the README for setup.</span>
              </p>
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={() => setState({ status: "form" })}
                className="text-sm font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                ← Start over
              </button>
              <button
                onClick={() => setShowComparison((v) => !v)}
                className="text-sm font-medium rounded-full border border-neutral-300 dark:border-neutral-700 px-4 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
              >
                {showComparison ? "Hide comparison" : "Compare all options"}
              </button>
            </div>

            {showComparison && <ComparisonView itineraries={state.itineraries} />}

            <div className="grid gap-4 sm:grid-cols-3">
              {state.itineraries.map((it) => (
                <ItineraryCard
                  key={it.id}
                  itinerary={it}
                  selected={it.id === state.selectedId}
                  onSelect={() => setState({ ...state, selectedId: it.id })}
                />
              ))}
            </div>

            <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm p-6 sm:p-8">
              <ItineraryDetail itinerary={state.itineraries.find((it) => it.id === state.selectedId)!} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
