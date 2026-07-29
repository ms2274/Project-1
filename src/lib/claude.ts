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

export interface TrendTierInput {
  classification: string;
  rationale: string;
  recentSwingHighs: number[];
  recentSwingLows: number[];
}

export interface SrLevelInput {
  label: string;
  price: number;
}

export interface SessionLevelsInput {
  date: string;
  open: number;
  hod: number;
  lod: number;
  close: number;
}

export interface DailyBarInput {
  date: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface HolidayInput {
  date: string;
  name: string;
  status: string;
}

export interface PrepSheetInput {
  symbol: string;
  date: string;
  currentPrice: number;
  vix: { price: number; changePercent: number; regime: string } | null;
  trend: {
    primary: TrendTierInput;
    secondary: TrendTierInput;
    minor: TrendTierInput;
  };
  timeframes: PrepSheetTimeframeLevels[];
  srLadder: { resistance: SrLevelInput[]; support: SrLevelInput[] };
  sessionLevels: { today?: SessionLevelsInput; prevDay?: SessionLevelsInput };
  recentDailyBars: DailyBarInput[];
  upcomingHolidays: HolidayInput[];
}

export interface GamePlan {
  primaryBias: string;
  scenarios: string[];
  avoid: string;
}

export type ZoneStrength = "strong" | "moderate";

export interface SupplyDemandZoneDetail {
  low: number;
  high: number;
  strength: ZoneStrength;
  rationale: string;
}

export type PlayDirection = "long" | "short";
export type PlayGrade = "A" | "B" | "C";

interface OptionsPlayDraft {
  title: string;
  direction: PlayDirection;
  strikeGuidance: string;
  dteRange: string;
  entryTrigger: number;
  stopPrice: number;
  targetPrice: number;
  grade: PlayGrade;
  rationale: string;
}

export interface OptionsPlay extends OptionsPlayDraft {
  riskRewardRatio: number;
}

interface PrepSheetAnalysisDraft {
  trendSummary: string;
  vixSummary: string;
  redFlags: string[];
  gamePlan: GamePlan;
  supplyZones: SupplyDemandZoneDetail[];
  demandZones: SupplyDemandZoneDetail[];
  optionsPlays: OptionsPlayDraft[];
}

export interface PrepSheetAnalysis {
  trendSummary: string;
  vixSummary: string;
  redFlags: string[];
  gamePlan: GamePlan;
  supplyZones: SupplyDemandZoneDetail[];
  demandZones: SupplyDemandZoneDetail[];
  optionsPlays: OptionsPlay[];
}

export interface PrepSheetOutput extends PrepSheetAnalysis {
  symbol: string;
  date: string;
}

const ZONE_ITEM_SCHEMA = {
  type: "object",
  properties: {
    low: { type: "number" },
    high: { type: "number" },
    strength: { type: "string", enum: ["strong", "moderate"] },
    rationale: { type: "string" },
  },
  required: ["low", "high", "strength", "rationale"],
};

const PREP_SHEET_TOOL: Anthropic.Tool = {
  name: "generate_prep_sheet",
  description: "Record a structured morning prep sheet: trend read, red flags, game plan, graded supply/demand zones, and options play ideas.",
  input_schema: {
    type: "object",
    properties: {
      trendSummary: {
        type: "string",
        description: "1-3 sentences reconciling Primary/Secondary/Minor trend into one coherent read.",
      },
      vixSummary: {
        type: "string",
        description: "1-2 sentences on VIX regime and its implication for option pricing today.",
      },
      redFlags: {
        type: "array",
        items: { type: "string" },
        description: "Session-specific caveats (holiday/early-close within ~1 week, data gaps, VIX unavailable, choppy sandwiched price action, stalling trend tier).",
      },
      gamePlan: {
        type: "object",
        properties: {
          primaryBias: { type: "string" },
          scenarios: {
            type: "array",
            items: {
              type: "string",
              description: "A short label followed by a colon and the scenario description in one string, e.g. 'Breakout continuation: ...'",
            },
          },
          avoid: { type: "string" },
        },
        required: ["primaryBias", "scenarios", "avoid"],
      },
      supplyZones: { type: "array", items: ZONE_ITEM_SCHEMA },
      demandZones: { type: "array", items: ZONE_ITEM_SCHEMA },
      optionsPlays: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            direction: { type: "string", enum: ["long", "short"] },
            strikeGuidance: { type: "string" },
            dteRange: { type: "string" },
            entryTrigger: { type: "number" },
            stopPrice: { type: "number" },
            targetPrice: { type: "number" },
            grade: { type: "string", enum: ["A", "B", "C"] },
            rationale: { type: "string" },
          },
          required: [
            "title",
            "direction",
            "strikeGuidance",
            "dteRange",
            "entryTrigger",
            "stopPrice",
            "targetPrice",
            "grade",
            "rationale",
          ],
        },
      },
    },
    required: ["trendSummary", "vixSummary", "redFlags", "gamePlan", "supplyZones", "demandZones", "optionsPlays"],
  },
};

// Direction-aware reward:risk. Returns null if the stop/target ordering is
// inconsistent with the stated direction (invalid play, dropped by the caller).
function computeRiskReward(play: OptionsPlayDraft): number | null {
  let risk: number;
  let reward: number;

  if (play.direction === "long") {
    risk = play.entryTrigger - play.stopPrice;
    reward = play.targetPrice - play.entryTrigger;
  } else {
    risk = play.stopPrice - play.entryTrigger;
    reward = play.entryTrigger - play.targetPrice;
  }

  if (risk <= 0 || reward <= 0) return null;
  return reward / risk;
}

const MIN_RISK_REWARD = 3;
const RISK_REWARD_EPSILON = 0.001;
const MAX_ATTEMPTS = 5;

// Claude's tool-use output is usually schema-valid, but a nested field can
// occasionally come back malformed (seen once in testing: gamePlan came back
// as a bare string containing leaked tool-call-tag text instead of the
// object). Validate defensively and retry rather than silently shipping
// broken data to a tool meant to run unattended every trading morning.
function validateDraft(draft: unknown): draft is PrepSheetAnalysisDraft {
  if (typeof draft !== "object" || draft === null) return false;
  const d = draft as Record<string, unknown>;

  if (typeof d.trendSummary !== "string" || typeof d.vixSummary !== "string") return false;
  if (!Array.isArray(d.redFlags) || !d.redFlags.every((f) => typeof f === "string")) return false;

  const gamePlan = d.gamePlan as Record<string, unknown> | undefined;
  if (
    typeof gamePlan !== "object" ||
    gamePlan === null ||
    typeof gamePlan.primaryBias !== "string" ||
    typeof gamePlan.avoid !== "string" ||
    !Array.isArray(gamePlan.scenarios) ||
    !gamePlan.scenarios.every((s) => typeof s === "string")
  ) {
    return false;
  }

  if (!Array.isArray(d.supplyZones) || !Array.isArray(d.demandZones)) return false;
  if (!Array.isArray(d.optionsPlays)) return false;

  return true;
}

export async function generatePrepSheet(
  input: PrepSheetInput
): Promise<{ output: PrepSheetOutput; raw: string }> {
  const anthropic = getClient();

  let draft: PrepSheetAnalysisDraft | null = null;
  let raw = "";
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && draft === null; attempt++) {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: PREP_SHEET_SYSTEM_PROMPT,
      tools: [PREP_SHEET_TOOL],
      tool_choice: { type: "tool", name: "generate_prep_sheet" },
      messages: [
        {
          role: "user",
          content: JSON.stringify(input, null, 2),
        },
      ],
    });

    raw = JSON.stringify(message.content);
    const toolUse = message.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (!toolUse) {
      lastError = `No tool_use block in Claude response: ${raw.slice(0, 1000)}`;
      continue;
    }

    if (validateDraft(toolUse.input)) {
      draft = toolUse.input;
    } else {
      lastError = `Malformed tool_use input on attempt ${attempt}: ${JSON.stringify(toolUse.input).slice(0, 1000)}`;
    }
  }

  if (draft === null) {
    throw new Error(`Claude returned malformed output after ${MAX_ATTEMPTS} attempts. Last error: ${lastError}`);
  }

  const optionsPlays: OptionsPlay[] = draft.optionsPlays
    .map((play) => {
      const riskRewardRatio = computeRiskReward(play);
      return riskRewardRatio !== null ? { ...play, riskRewardRatio } : null;
    })
    .filter((play): play is OptionsPlay => play !== null && play.riskRewardRatio >= MIN_RISK_REWARD - RISK_REWARD_EPSILON);

  const output: PrepSheetOutput = {
    symbol: input.symbol,
    date: input.date,
    trendSummary: draft.trendSummary,
    vixSummary: draft.vixSummary,
    redFlags: draft.redFlags,
    gamePlan: draft.gamePlan,
    supplyZones: draft.supplyZones,
    demandZones: draft.demandZones,
    optionsPlays,
  };

  return { output, raw };
}
