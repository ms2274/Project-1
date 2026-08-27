const FMP_BASE_URL = "https://financialmodelingprep.com/stable";

function requireApiKey(): string {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new Error("Missing FMP_API_KEY env var");
  return key;
}

export interface VixQuote {
  price: number;
  changePercent: number;
}

export async function fetchVixQuote(): Promise<VixQuote> {
  const apiKey = requireApiKey();
  const url = `${FMP_BASE_URL}/quote?symbol=${encodeURIComponent("^VIX")}&apikey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`FMP request failed (${res.status}): ${body.slice(0, 500)}`);
  }

  const json = await res.json();
  const quote = Array.isArray(json) ? json[0] : undefined;
  if (!quote || typeof quote.price !== "number") {
    throw new Error(`Unexpected FMP response shape: ${JSON.stringify(json).slice(0, 500)}`);
  }

  return { price: quote.price, changePercent: quote.changePercentage ?? 0 };
}
