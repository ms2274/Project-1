"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const TARGET_MULTIPLES = [2, 3, 4, 5];

export default function CalculatorPage() {
  const [riskAmount, setRiskAmount] = useState("35");
  const [entryPrice, setEntryPrice] = useState("1.20");
  const [stopPrice, setStopPrice] = useState("0.90");

  const result = useMemo(() => {
    const risk = parseFloat(riskAmount);
    const entry = parseFloat(entryPrice);
    const stop = parseFloat(stopPrice);

    if (!Number.isFinite(risk) || !Number.isFinite(entry) || !Number.isFinite(stop)) {
      return { error: "Enter valid numbers for all fields." };
    }
    if (stop >= entry) {
      return { error: "Stop price must be below entry price." };
    }

    const riskPerContract = (entry - stop) * 100;
    const contracts = Math.floor(risk / riskPerContract);
    const actualRisk = contracts * riskPerContract;

    const targets = TARGET_MULTIPLES.map((multiple) => {
      const targetPrice = entry + multiple * (entry - stop);
      const profit = contracts * (targetPrice - entry) * 100;
      return { multiple, targetPrice, profit };
    });

    return { contracts, riskPerContract, actualRisk, targets };
  }, [riskAmount, entryPrice, stopPrice]);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Position Size Calculator</h1>
        <Link href="/" className="text-sm text-neutral-400 underline hover:text-neutral-200">
          Back to prep
        </Link>
      </div>

      <div className="mt-6 grid gap-4">
        <Field label="Account risk ($)" value={riskAmount} onChange={setRiskAmount} />
        <Field label="Entry premium ($/share)" value={entryPrice} onChange={setEntryPrice} />
        <Field label="Stop premium ($/share)" value={stopPrice} onChange={setStopPrice} />
      </div>

      <div className="mt-8 rounded border border-neutral-800 p-4">
        {"error" in result ? (
          <p className="text-sm text-red-400">{result.error}</p>
        ) : (
          <>
            <p className="text-sm text-neutral-300">
              Risk per contract: <span className="font-mono">${result.riskPerContract!.toFixed(2)}</span>
            </p>
            <p className="mt-1 text-sm text-neutral-300">
              Contracts: <span className="font-mono">{result.contracts}</span>
            </p>
            <p className="mt-1 text-sm text-neutral-300">
              Actual risk: <span className="font-mono">${result.actualRisk!.toFixed(2)}</span>
            </p>

            {result.contracts === 0 && (
              <p className="mt-2 text-sm text-yellow-400">
                Risk amount is too small for 1 contract at this stop distance.
              </p>
            )}

            <h2 className="mt-4 text-sm font-medium text-neutral-400">Targets</h2>
            <table className="mt-1 w-full text-sm text-neutral-300">
              <thead className="text-neutral-500">
                <tr>
                  <th className="text-left font-normal">R</th>
                  <th className="text-left font-normal">Target price</th>
                  <th className="text-left font-normal">Profit</th>
                </tr>
              </thead>
              <tbody>
                {result.targets!.map((t) => (
                  <tr key={t.multiple}>
                    <td className="font-mono">{t.multiple}x</td>
                    <td className="font-mono">${t.targetPrice.toFixed(2)}</td>
                    <td className="font-mono">${t.profit.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-neutral-400">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100"
      />
    </label>
  );
}
