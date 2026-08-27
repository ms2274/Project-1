import { createClient } from "@supabase/supabase-js";

export const SCHEMA_SQL = `
create extension if not exists "pgcrypto";

create table if not exists prep_sheets (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  trade_date date not null,
  generated_at timestamptz not null default now(),
  levels jsonb not null,
  analysis jsonb not null,
  raw_claude_response text,
  unique (symbol, trade_date)
);

create index if not exists prep_sheets_symbol_date_idx
  on prep_sheets (symbol, trade_date desc);
`.trim();

export type PrepSheetRow = {
  id: string;
  symbol: string;
  trade_date: string;
  generated_at: string;
  levels: unknown;
  analysis: unknown;
  raw_claude_response: string | null;
};

type PrepSheetInsert = {
  id?: string;
  symbol: string;
  trade_date: string;
  generated_at?: string;
  levels: unknown;
  analysis: unknown;
  raw_claude_response?: string | null;
};

type Database = {
  public: {
    Tables: {
      prep_sheets: {
        Row: PrepSheetRow;
        Insert: PrepSheetInsert;
        Update: Partial<PrepSheetInsert>;
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};

let cachedClient: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseClient() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  }

  cachedClient = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
  return cachedClient;
}

export async function upsertPrepSheet(row: {
  symbol: string;
  trade_date: string;
  levels: unknown;
  analysis: unknown;
  raw_claude_response?: string;
}) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("prep_sheets")
    .upsert(
      {
        symbol: row.symbol,
        trade_date: row.trade_date,
        levels: row.levels,
        analysis: row.analysis,
        raw_claude_response: row.raw_claude_response ?? null,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "symbol,trade_date" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}
