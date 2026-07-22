"use client";

import { useState } from "react";
import { FormInput, NEIGHBORHOODS, VIBES } from "@/lib/types";

const BUDGET_OPTIONS: { value: 1 | 2 | 3 | 4; label: string }[] = [
  { value: 1, label: "$" },
  { value: 2, label: "$$" },
  { value: 3, label: "$$$" },
  { value: 4, label: "$$$$" },
];

const STOP_COUNT_OPTIONS: { value: 2 | 3 | 4; label: string }[] = [
  { value: 2, label: "2 stops" },
  { value: 3, label: "3 stops" },
  { value: 4, label: "4 stops" },
];

const TIME_OF_DAY_OPTIONS: { value: FormInput["timeOfDay"]; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
];

const TRANSPORT_OPTIONS: { value: FormInput["transportMode"]; label: string; emoji: string }[] = [
  { value: "walking", label: "Walking", emoji: "🚶" },
  { value: "transit", label: "Transit", emoji: "🚇" },
  { value: "driving", label: "Driving", emoji: "🚗" },
];

const DEFAULT_INPUT: FormInput = {
  neighborhood: "Anywhere in NYC",
  vibe: "romantic",
  budget: 2,
  stopCount: 3,
  timeOfDay: "evening",
  transportMode: "walking",
};

export default function DateForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (input: FormInput) => void;
  submitting: boolean;
}) {
  const [input, setInput] = useState<FormInput>(DEFAULT_INPUT);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(input);
      }}
      className="space-y-8"
    >
      <div>
        <label className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
          What&apos;s the vibe?
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {VIBES.map((v) => (
            <button
              type="button"
              key={v.value}
              onClick={() => setInput({ ...input, vibe: v.value })}
              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-sm transition ${
                input.vibe === v.value
                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                  : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500 text-neutral-700 dark:text-neutral-300"
              }`}
            >
              <span className="text-xl">{v.emoji}</span>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
          Where in the city?
        </label>
        <select
          value={input.neighborhood}
          onChange={(e) => setInput({ ...input, neighborhood: e.target.value as FormInput["neighborhood"] })}
          className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100"
        >
          {NEIGHBORHOODS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="grid sm:grid-cols-2 gap-8">
        <div>
          <label className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Budget</label>
          <div className="flex gap-2">
            {BUDGET_OPTIONS.map((b) => (
              <button
                type="button"
                key={b.value}
                onClick={() => setInput({ ...input, budget: b.value })}
                className={`flex-1 rounded-xl border px-3 py-3 text-sm font-medium transition ${
                  input.budget === b.value
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                    : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500 text-neutral-700 dark:text-neutral-300"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
            How many stops?
          </label>
          <div className="flex gap-2">
            {STOP_COUNT_OPTIONS.map((s) => (
              <button
                type="button"
                key={s.value}
                onClick={() => setInput({ ...input, stopCount: s.value })}
                className={`flex-1 rounded-xl border px-3 py-3 text-sm font-medium transition ${
                  input.stopCount === s.value
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                    : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500 text-neutral-700 dark:text-neutral-300"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-8">
        <div>
          <label className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
            Time of day
          </label>
          <div className="flex gap-2">
            {TIME_OF_DAY_OPTIONS.map((t) => (
              <button
                type="button"
                key={t.value}
                onClick={() => setInput({ ...input, timeOfDay: t.value })}
                className={`flex-1 rounded-xl border px-3 py-3 text-sm font-medium transition ${
                  input.timeOfDay === t.value
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                    : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500 text-neutral-700 dark:text-neutral-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
            Getting around
          </label>
          <div className="flex gap-2">
            {TRANSPORT_OPTIONS.map((t) => (
              <button
                type="button"
                key={t.value}
                onClick={() => setInput({ ...input, transportMode: t.value })}
                className={`flex-1 rounded-xl border px-3 py-3 text-sm font-medium transition ${
                  input.transportMode === t.value
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                    : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500 text-neutral-700 dark:text-neutral-300"
                }`}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-4 text-base transition"
      >
        {submitting ? "Planning your date…" : "Generate date options"}
      </button>
    </form>
  );
}
