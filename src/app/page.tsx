"use client";

import { useState } from "react";
import Link from "next/link";
import type { PrepSheetOutput } from "@/lib/claude";

export default function Home() {
  const [sheets, setSheets] = useState<PrepSheetOutput[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshPrep() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/refresh-prep", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
      setSheets(json.sheets);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Trading Prep</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Prep only — not signals. Confirm everything against your own chart read and live order flow.
          </p>
        </div>
        <Link href="/calculator" className="text-sm text-neutral-400 underline hover:text-neutral-200">
          Calculator
        </Link>
      </div>

      <button
        onClick={refreshPrep}
        disabled={loading}
        className="mt-6 rounded bg-neutral-100 px-4 py-2 font-medium text-neutral-900 disabled:opacity-50"
      >
        {loading ? "Refreshing..." : "Refresh Prep"}
      </button>

      {error && (
        <p className="mt-4 rounded border border-red-800 bg-red-950 p-3 text-sm text-red-300">{error}</p>
      )}

      {sheets && (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {sheets.map((sheet) => (
            <PrepSheetCard key={sheet.symbol} sheet={sheet} />
          ))}
        </div>
      )}
    </main>
  );
}

function PrepSheetCard({ sheet }: { sheet: PrepSheetOutput }) {
  return (
    <div className="rounded border border-neutral-800 p-4">
      <h2 className="text-lg font-semibold">
        {sheet.symbol} <span className="text-sm font-normal text-neutral-500">{sheet.date}</span>
      </h2>

      <p className="mt-3 text-sm text-neutral-300">{sheet.trendSummary}</p>
      <p className="mt-2 text-sm text-neutral-300">{sheet.vixSummary}</p>

      <h3 className="mt-4 text-sm font-medium text-red-400">Red flags</h3>
      <ul className="mt-1 list-disc pl-4 text-sm text-neutral-300">
        {sheet.redFlags.map((f, i) => (
          <li key={i}>{f}</li>
        ))}
      </ul>

      <h3 className="mt-4 text-sm font-medium text-green-400">Game plan</h3>
      <p className="mt-1 text-sm text-neutral-300">{sheet.gamePlan.primaryBias}</p>
      <ul className="mt-1 space-y-1 text-sm text-neutral-300">
        {sheet.gamePlan.scenarios.map((s, i) => (
          <li key={i}>
            <span className="font-medium">{s.title}:</span> {s.description}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-sm text-neutral-400">Avoid: {sheet.gamePlan.avoid}</p>

      <h3 className="mt-4 text-sm font-medium text-neutral-400">Options plays</h3>
      {sheet.optionsPlays.length === 0 && (
        <p className="mt-1 text-sm text-neutral-500">No plays met the 3:1 reward-to-risk minimum.</p>
      )}
      <ul className="mt-1 space-y-2 text-sm">
        {sheet.optionsPlays.map((p, i) => (
          <li key={i} className="rounded border border-neutral-800 p-2">
            <div className="flex justify-between">
              <span className="font-medium">{p.title}</span>
              <span className="text-neutral-500">
                Grade {p.grade} · {p.riskRewardRatio.toFixed(1)}:1
              </span>
            </div>
            <div className="text-neutral-400">
              {p.direction} · {p.strikeGuidance} · {p.dteRange}
            </div>
            <div className="font-mono text-neutral-300">
              Entry {p.entryTrigger.toFixed(2)} / Stop {p.stopPrice.toFixed(2)} / Target {p.targetPrice.toFixed(2)}
            </div>
            <div className="mt-1 text-xs text-neutral-500">{p.rationale}</div>
          </li>
        ))}
      </ul>

      <h3 className="mt-4 text-sm font-medium text-red-400">Supply zones</h3>
      <ul className="mt-1 space-y-1 text-sm text-neutral-300">
        {sheet.supplyZones.map((z, i) => (
          <li key={i}>
            <span className="font-mono">
              {z.low.toFixed(2)}-{z.high.toFixed(2)}
            </span>{" "}
            <span className="text-neutral-500">({z.strength})</span>
            <div className="text-xs text-neutral-500">{z.rationale}</div>
          </li>
        ))}
      </ul>

      <h3 className="mt-4 text-sm font-medium text-green-400">Demand zones</h3>
      <ul className="mt-1 space-y-1 text-sm text-neutral-300">
        {sheet.demandZones.map((z, i) => (
          <li key={i}>
            <span className="font-mono">
              {z.low.toFixed(2)}-{z.high.toFixed(2)}
            </span>{" "}
            <span className="text-neutral-500">({z.strength})</span>
            <div className="text-xs text-neutral-500">{z.rationale}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
