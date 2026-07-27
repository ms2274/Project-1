"use client";

import { useState } from "react";
import Link from "next/link";
import type { PrepSheetOutput, PrepSheetInput, TrendTierInput } from "@/lib/claude";

interface Sheet {
  input: PrepSheetInput;
  output: PrepSheetOutput;
}

export default function Home() {
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
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
    <main className="mx-auto max-w-6xl p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Trading Prep</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Discretionary prep aid — confirm everything against live order flow before acting.
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
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {sheets.map((sheet) => (
            <PrepSheetCard key={sheet.output.symbol} sheet={sheet} />
          ))}
        </div>
      )}
    </main>
  );
}

function fmt(n: number): string {
  return n.toFixed(2);
}

function TrendTag({ classification }: { classification: string }) {
  const styles: Record<string, string> = {
    uptrend: "bg-green-950 text-green-400 border-green-800",
    downtrend: "bg-red-950 text-red-400 border-red-800",
    sideways: "bg-neutral-800 text-neutral-300 border-neutral-700",
  };
  const label: Record<string, string> = {
    uptrend: "Bullish",
    downtrend: "Bearish",
    sideways: "Sideways",
  };
  return (
    <span className={`rounded border px-2 py-0.5 text-xs font-medium ${styles[classification] ?? styles.sideways}`}>
      {label[classification] ?? classification}
    </span>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  const styles: Record<string, string> = {
    A: "bg-green-950 text-green-400 border-green-800",
    B: "bg-yellow-950 text-yellow-400 border-yellow-800",
    C: "bg-neutral-800 text-neutral-300 border-neutral-700",
  };
  return (
    <span className={`rounded border px-2 py-0.5 text-xs font-medium ${styles[grade] ?? styles.C}`}>
      Grade {grade}
    </span>
  );
}

function TrendTier({ label, tier }: { label: string; tier: TrendTierInput }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1">
      <div>
        <span className="text-sm font-medium">{label}</span>
        <p className="text-xs text-neutral-500">{tier.rationale}</p>
      </div>
      <TrendTag classification={tier.classification} />
    </div>
  );
}

function PrepSheetCard({ sheet }: { sheet: Sheet }) {
  const { input, output } = sheet;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        {output.symbol} <span className="text-sm font-normal text-neutral-500">{output.date}</span>{" "}
        <span className="font-mono text-sm text-neutral-400">${fmt(input.currentPrice)}</span>
      </h2>

      <div className="rounded border border-red-900 bg-red-950/40 p-3">
        <h3 className="text-sm font-semibold text-red-400">Red Flags</h3>
        <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-red-200">
          {output.redFlags.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </div>

      <div className="rounded border border-green-900 bg-green-950/40 p-3">
        <h3 className="text-sm font-semibold text-green-400">Game Plan</h3>
        <p className="mt-1 text-sm text-green-100">{output.gamePlan.primaryBias}</p>
        <ul className="mt-2 space-y-1 text-sm text-green-100">
          {output.gamePlan.scenarios.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-green-300/80">
          <span className="font-medium">Avoid:</span> {output.gamePlan.avoid}
        </p>
      </div>

      <div className="rounded border border-neutral-800 p-3">
        <h3 className="text-sm font-semibold">Trend</h3>
        <p className="mt-1 text-sm text-neutral-300">{output.trendSummary}</p>
        <div className="mt-2 divide-y divide-neutral-800">
          <TrendTier label="Primary (monthly)" tier={input.trend.primary} />
          <TrendTier label="Secondary (weekly)" tier={input.trend.secondary} />
          <TrendTier label="Minor (daily)" tier={input.trend.minor} />
        </div>
      </div>

      <div className="rounded border border-neutral-800 p-3">
        <h3 className="text-sm font-semibold">Options Plays</h3>
        {output.optionsPlays.length === 0 && (
          <p className="mt-1 text-sm text-neutral-500">No plays met the 3:1 reward-to-risk minimum.</p>
        )}
        <div className="mt-2 space-y-2">
          {output.optionsPlays.map((p, i) => (
            <div key={i} className="rounded border border-neutral-800 p-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{p.title}</span>
                <div className="flex gap-1">
                  <GradeBadge grade={p.grade} />
                  <span className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs font-medium text-neutral-300">
                    {p.riskRewardRatio.toFixed(1)}:1
                  </span>
                </div>
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                {p.direction === "long" ? "Long" : "Short"} · {p.strikeGuidance} · {p.dteRange}
              </div>
              <div className="mt-1 font-mono text-sm text-neutral-300">
                Entry {fmt(p.entryTrigger)} / Stop {fmt(p.stopPrice)} / Target {fmt(p.targetPrice)}
              </div>
              <p className="mt-1 text-xs text-neutral-500">{p.rationale}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded border border-red-900 p-3">
          <h3 className="text-sm font-semibold text-red-400">Supply Zones</h3>
          <ul className="mt-1 space-y-2 text-sm">
            {output.supplyZones.map((z, i) => (
              <li key={i}>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-red-300">
                    {fmt(z.low)}-{fmt(z.high)}
                  </span>
                  <span className="text-xs text-neutral-500">({z.strength})</span>
                </div>
                <p className="text-xs text-neutral-500">{z.rationale}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded border border-green-900 p-3">
          <h3 className="text-sm font-semibold text-green-400">Demand Zones</h3>
          <ul className="mt-1 space-y-2 text-sm">
            {output.demandZones.map((z, i) => (
              <li key={i}>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-green-300">
                    {fmt(z.low)}-{fmt(z.high)}
                  </span>
                  <span className="text-xs text-neutral-500">({z.strength})</span>
                </div>
                <p className="text-xs text-neutral-500">{z.rationale}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded border border-neutral-800 p-3">
        <h3 className="text-sm font-semibold">S/R Ladder &amp; Volume Profile</h3>
        <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-neutral-500">Resistance</div>
            {input.srLadder.resistance.map((r) => (
              <div key={r.label} className="flex justify-between font-mono text-red-300">
                <span>{r.label}</span>
                <span>{fmt(r.price)}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="text-xs text-neutral-500">Support</div>
            {input.srLadder.support.map((s) => (
              <div key={s.label} className="flex justify-between font-mono text-green-300">
                <span>{s.label}</span>
                <span>{fmt(s.price)}</span>
              </div>
            ))}
            {input.srLadder.support.length === 0 && <div className="text-xs text-neutral-600">none</div>}
          </div>
        </div>

        <table className="mt-3 w-full text-sm">
          <thead className="text-xs text-neutral-500">
            <tr>
              <th className="text-left font-normal">Timeframe</th>
              <th className="text-left font-normal">POC</th>
              <th className="text-left font-normal">VAH</th>
              <th className="text-left font-normal">VAL</th>
            </tr>
          </thead>
          <tbody className="font-mono text-neutral-300">
            {input.timeframes.map((tf) => (
              <tr key={tf.label}>
                <td>{tf.label}</td>
                <td>{fmt(tf.poc)}</td>
                <td>{fmt(tf.vah)}</td>
                <td>{fmt(tf.val)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(input.sessionLevels.today || input.sessionLevels.prevDay) && (
        <div className="rounded border border-neutral-800 p-3">
          <h3 className="text-sm font-semibold">Session Levels</h3>
          <table className="mt-2 w-full text-sm">
            <thead className="text-xs text-neutral-500">
              <tr>
                <th className="text-left font-normal">Date</th>
                <th className="text-left font-normal">Open</th>
                <th className="text-left font-normal">HOD</th>
                <th className="text-left font-normal">LOD</th>
                <th className="text-left font-normal">Close</th>
              </tr>
            </thead>
            <tbody className="font-mono text-neutral-300">
              {input.sessionLevels.today && (
                <tr>
                  <td>{input.sessionLevels.today.date} (today)</td>
                  <td>{fmt(input.sessionLevels.today.open)}</td>
                  <td>{fmt(input.sessionLevels.today.hod)}</td>
                  <td>{fmt(input.sessionLevels.today.lod)}</td>
                  <td>{fmt(input.sessionLevels.today.close)}</td>
                </tr>
              )}
              {input.sessionLevels.prevDay && (
                <tr>
                  <td>{input.sessionLevels.prevDay.date}</td>
                  <td>{fmt(input.sessionLevels.prevDay.open)}</td>
                  <td>{fmt(input.sessionLevels.prevDay.hod)}</td>
                  <td>{fmt(input.sessionLevels.prevDay.lod)}</td>
                  <td>{fmt(input.sessionLevels.prevDay.close)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded border border-neutral-800 p-3">
        <h3 className="text-sm font-semibold">VIX</h3>
        <p className="mt-1 text-sm text-neutral-300">{output.vixSummary}</p>
      </div>
    </div>
  );
}
