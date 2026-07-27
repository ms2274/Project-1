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

export type RelativePosition = "above_value_area" | "below_value_area" | "inside_value_area";

export interface LvnInflectionZone {
  low: number;
  high: number;
  timeframe: string;
  relativePosition: RelativePosition;
  rationale: string;
}

interface LvnZoneDraft {
  low: number;
  high: number;
  timeframe: string;
  rationale: string;
}

interface PrepSheetAnalysisDraft {
  trendSummary: string;
  vixSummary: string;
  lvnZones: LvnZoneDraft[];
  narrative: string;
  watchouts: string[];
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
          "One entry per LVN zone given in the input (same count, same low/high values, unchanged, same order) — not supply/demand zones, and not the value area itself. Do not classify position relative to the value area yourself — that is computed separately from the numbers; just describe each zone.",
        items: {
          type: "object",
          properties: {
            low: { type: "number" },
            high: { type: "number" },
            timeframe: { type: "string" },
            rationale: { type: "string" },
          },
          required: ["low", "high", "timeframe", "rationale"],
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

  const draft = toolUse.input as PrepSheetAnalysisDraft;
  const valueAreaByTimeframe = new Map(input.timeframes.map((tf) => [tf.label, tf]));

  const lvnZones: LvnInflectionZone[] = draft.lvnZones.map((zone) => {
    const tf = valueAreaByTimeframe.get(zone.timeframe);
    return {
      ...zone,
      relativePosition: tf
        ? computeRelativePosition(zone.low, zone.high, tf.val, tf.vah)
        : "inside_value_area",
    };
  });

  const output: PrepSheetOutput = {
    symbol: input.symbol,
    date: input.date,
    trendSummary: draft.trendSummary,
    vixSummary: draft.vixSummary,
    lvnZones,
    narrative: draft.narrative,
    watchouts: draft.watchouts,
  };

  return { output, raw };
}

function computeRelativePosition(
  zoneLow: number,
  zoneHigh: number,
  val: number,
  vah: number
): RelativePosition {
  if (zoneHigh <= val) return "below_value_area";
  if (zoneLow >= vah) return "above_value_area";
  return "inside_value_area";
}
