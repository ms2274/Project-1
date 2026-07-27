import Anthropic from "@anthropic-ai/sdk";
import { PREP_SHEET_SYSTEM_PROMPT } from "../prompts/prepSheet";

const MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY env var");
  client = new Anthropic({ apiKey });
  return client;
}

export interface PrepSheetTimeframeLevels {
  label: string;
  poc: number;
  vah: number;
  val: number;
  lvnZones: { low: number; high: number }[];
}

export interface PrepSheetInput {
  symbol: string;
  date: string;
  vix: { price: number; changePercent: number; regime: string };
  trend: {
    classification: string;
    rationale: string;
    recentSwingHighs: number[];
    recentSwingLows: number[];
  };
  timeframes: PrepSheetTimeframeLevels[];
}

export interface LvnInflectionZone {
  low: number;
  high: number;
  timeframe: string;
  relativePosition: "above_value_area" | "below_value_area" | "inside_value_area";
  rationale: string;
}

export interface PrepSheetAnalysis {
  trendSummary: string;
  vixSummary: string;
  lvnZones: LvnInflectionZone[];
  narrative: string;
  watchouts: string[];
}

export interface PrepSheetOutput extends PrepSheetAnalysis {
  symbol: string;
  date: string;
}

const PREP_SHEET_TOOL: Anthropic.Tool = {
  name: "generate_prep_sheet",
  description:
    "Record a structured, prep-only trading context sheet. Never include buy/sell/entry/exit signals, and never label LVN zones as supply/demand zones.",
  input_schema: {
    type: "object",
    properties: {
      trendSummary: {
        type: "string",
        description: "1-2 sentence read on the weekly Dow Theory trend and how confidently it's confirmed.",
      },
      vixSummary: {
        type: "string",
        description: "1-2 sentence read on the VIX regime and what it implies for option pricing/behavior today.",
      },
      lvnZones: {
        type: "array",
        description:
          "One entry per LVN zone given in the input (same count, same low/high values, unchanged) — not supply/demand zones, and not the value area itself.",
        items: {
          type: "object",
          properties: {
            low: { type: "number" },
            high: { type: "number" },
            timeframe: { type: "string" },
            relativePosition: {
              type: "string",
              enum: ["above_value_area", "below_value_area", "inside_value_area"],
            },
            rationale: { type: "string" },
          },
          required: ["low", "high", "timeframe", "relativePosition", "rationale"],
        },
      },
      narrative: {
        type: "string",
        description: "A few sentences synthesizing trend + VIX regime + LVN zones into prep context. No trade signals.",
      },
      watchouts: {
        type: "array",
        items: { type: "string" },
        description: "Things that would invalidate or complicate today's read.",
      },
    },
    required: ["trendSummary", "vixSummary", "lvnZones", "narrative", "watchouts"],
  },
};

export async function generatePrepSheet(
  input: PrepSheetInput
): Promise<{ output: PrepSheetOutput; raw: string }> {
  const anthropic = getClient();

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: PREP_SHEET_SYSTEM_PROMPT,
    tools: [PREP_SHEET_TOOL],
    tool_choice: { type: "tool", name: "generate_prep_sheet" },
    messages: [
      {
        role: "user",
        content: JSON.stringify(
          {
            symbol: input.symbol,
            date: input.date,
            vix: input.vix,
            trend: input.trend,
            timeframes: input.timeframes,
          },
          null,
          2
        ),
      },
    ],
  });

  const raw = JSON.stringify(message.content);
  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (!toolUse) {
    throw new Error(`No tool_use block in Claude response: ${raw.slice(0, 1000)}`);
  }

  const analysis = toolUse.input as PrepSheetAnalysis;

  return {
    output: { symbol: input.symbol, date: input.date, ...analysis },
    raw,
  };
}
