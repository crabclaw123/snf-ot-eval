import type { AssistanceLevel, GoalType, OTGoal } from "./types";

export const GOAL_TYPES: GoalType[] = ["Short-term", "Long-term"];
export const GOAL_TIMEFRAMES = ["1 week", "2 weeks", "3 weeks", "4 weeks", "6 weeks", "8 weeks", "By discharge"];
export const MMT_LEVELS = ["0", "1", "2-", "2", "2+", "3-", "3", "3+", "4-", "4", "4+", "5"];

export const GOAL_BUILDER_STEPS = [
  {
    key: "focus",
    title: "1. Goal focus & functional purpose",
    help: "Connect the goal to a meaningful occupation and identify why improvement matters for occupational performance.",
  },
  {
    key: "target",
    title: "2. Current status → target",
    help: "Choose a measurable target. Suggestions use the documented baseline, but the therapist can enter any clinically appropriate target.",
  },
  {
    key: "criteria",
    title: "3. Conditions & success criteria",
    help: "Add only the cueing, equipment, safety conditions, or consistency criteria that make the goal more precise. These are optional when the target is already measurable.",
  },
  {
    key: "timeframe",
    title: "4. Timeframe & final wording",
    help: "Set the expected timeframe and target date, then review and edit the complete goal before saving.",
  },
] as const;

export type GoalBuilderStepKey = typeof GOAL_BUILDER_STEPS[number]["key"];

const OCCUPATION_LABELS: Record<string, string> = {
  eating: "Eating",
  grooming: "Grooming",
  bathing: "Bathing",
  upperBodyDressing: "Upper-body dressing",
  lowerBodyDressing: "Lower-body dressing",
  toileting: "Toileting",
  toiletTransfer: "Toilet transfer",
  showerTransfer: "Shower transfer",
  bedMobility: "Bed mobility",
  transfers: "Transfers",
  functionalMobility: "Functional mobility / ambulation",
};

const FUNCTIONAL_LEVELS: AssistanceLevel[] = [
  "Dependent",
  "Maximal Assist",
  "Moderate Assist",
  "Minimal Assist",
  "Contact Guard Assist",
  "Supervision",
  "Modified Independent",
  "Independent",
];

function clean(value: string | undefined): string {
  return String(value || "").trim().replace(/[.,;:]+$/, "");
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function occupationLabel(occupation: string): string {
  return OCCUPATION_LABELS[occupation] || occupation || "the selected occupation";
}

export function calculateGoalTargetDate(baseDate: string, timeframe: string): string {
  const weeks = Number(timeframe.match(/^(\d+)\s+week/)?.[1] || 0);
  if (!baseDate || !weeks) return "";
  const date = new Date(`${baseDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

export function formatGoalDate(dateValue: string | undefined): string {
  if (!dateValue) return "";
  const [year, month, day] = dateValue.split("-");
  if (!year || !month || !day) return dateValue;
  return `${month}/${day}/${year}`;
}

export function formatSourceFinding(goal: OTGoal): string {
  if (!goal.sourceType || goal.sourceType === "Functional") return "";
  const side = goal.sourceSide === "right" ? "Right" : goal.sourceSide === "left" ? "Left" : "";
  const metric = goal.sourceMetric || (goal.sourceType === "Strength" ? "MMT" : "AROM");
  const baseline = clean(goal.sourceBaseline);
  const unit = goal.sourceType === "ROM" && baseline && !baseline.includes("°") ? "°" : goal.sourceType === "Strength" && baseline && !baseline.includes("/5") ? "/5" : "";
  return `${side} ${goal.sourceMovement || "finding"} ${metric}: ${baseline || "not documented"}${unit}`.trim();
}

export function parseFindingContext(context: string): Partial<OTGoal> {
  const match = context.match(/^(Right|Left) (.+?) — Impaired; (.+)$/);
  if (!match) return {};

  const side = match[1].toLowerCase() as "right" | "left";
  const movement = match[2];
  const details = match[3];

  if (details.includes("MMT:")) {
    const baseline = details.match(/MMT:\s*([^;]+)/)?.[1]?.trim();
    return {
      sourceType: "Strength",
      sourceSide: side,
      sourceMovement: movement,
      sourceMetric: "MMT",
      ...(baseline && baseline !== "not documented" ? { sourceBaseline: baseline } : {}),
      measurableCriterion: "as measured by manual muscle testing",
    };
  }

  const arom = details.match(/AROM:\s*([^°;]+)/)?.[1]?.trim();
  const prom = details.match(/PROM:\s*([^°;]+)/)?.[1]?.trim();
  const useArom = !!arom && arom !== "not documented";
  const baseline = useArom ? arom : prom && prom !== "not documented" ? prom : "";

  return {
    sourceType: "ROM",
    sourceSide: side,
    sourceMovement: movement,
    sourceMetric: useArom ? "AROM" : "PROM",
    ...(baseline ? { sourceBaseline: baseline } : {}),
    measurableCriterion: "as measured by goniometry",
  };
}

export function recommendedTarget(goal: OTGoal): string {
  if (goal.sourceType === "ROM") {
    const n = Number(String(goal.sourceBaseline || "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) && n >= 0 ? `${Math.round(n + 10)}°` : "";
  }

  if (goal.sourceType === "Strength") {
    const current = clean(goal.sourceBaseline).replace("/5", "");
    const index = MMT_LEVELS.indexOf(current);
    return index >= 0 && index < MMT_LEVELS.length - 1 ? `${MMT_LEVELS[index + 1]}/5` : "";
  }

  const current = goal.current as AssistanceLevel;
  const index = FUNCTIONAL_LEVELS.indexOf(current);
  return index >= 0 && index < FUNCTIONAL_LEVELS.length - 1 ? FUNCTIONAL_LEVELS[index + 1] : "";
}

export function smartTargetOptions(goal: OTGoal): string[] {
  const activity = occupationLabel(goal.occupation).toLowerCase();

  if (goal.sourceType === "ROM") {
    const n = Number(String(goal.sourceBaseline || "").replace(/[^0-9.-]/g, ""));
    const numeric = Number.isFinite(n) && n >= 0
      ? [10, 15, 20].map(delta => `${Math.round(n + delta)}°`)
      : [];
    return unique([...numeric, `functional ROM sufficient for ${activity}`]);
  }

  if (goal.sourceType === "Strength") {
    const current = clean(goal.sourceBaseline).replace("/5", "");
    const index = MMT_LEVELS.indexOf(current);
    const next = index >= 0
      ? MMT_LEVELS.slice(index + 1, Math.min(index + 5, MMT_LEVELS.length)).map(level => `${level}/5`)
      : [];
    return unique([...next, `functional strength sufficient for ${activity}`]);
  }

  const suggested = recommendedTarget(goal);
  return unique([suggested, ...FUNCTIONAL_LEVELS]);
}

export function smartPurposeOptions(goal: OTGoal): string[] {
  const activity = occupationLabel(goal.occupation).toLowerCase();
  const side = goal.sourceSide === "right" ? "right" : goal.sourceSide === "left" ? "left" : "involved";

  if (goal.sourceType === "ROM") {
    return [
      `improve ${side} upper-extremity reach required for ${activity}`,
      `improve functional range needed to complete ${activity}`,
      `reduce physical assistance required during ${activity}`,
      `improve access to body or environmental targets during ${activity}`,
      `increase independence with ${activity}`,
    ];
  }

  if (goal.sourceType === "Strength") {
    return [
      `improve ${side} upper-extremity strength required for ${activity}`,
      `improve ability to lift, support, or control the arm during ${activity}`,
      `reduce physical assistance required during ${activity}`,
      `improve sustained upper-extremity use during ${activity}`,
      `increase independence with ${activity}`,
    ];
  }

  return [
    `increase independence with ${activity}`,
    `reduce caregiver assistance during ${activity}`,
    `improve safety and consistency during ${activity}`,
    `support return toward prior level of ${activity} performance`,
    `improve participation in ${activity} as part of the daily routine`,
  ];
}

export function smartConditionOptions(goal: OTGoal): string[] {
  if (goal.sourceType === "ROM") {
    return [
      "without increased pain",
      "without compensatory trunk movement",
      "while maintaining prescribed precautions",
      "with movement quality appropriate for the task",
    ];
  }

  if (goal.sourceType === "Strength") {
    return [
      "without compensatory movement",
      "without increased pain",
      "while maintaining prescribed precautions",
      "with appropriate positioning and stabilization",
    ];
  }

  return [
    "with no more than 1 verbal cue",
    "with no more than 2 verbal cues",
    "using adaptive equipment as needed",
    "using the least restrictive assistive device",
    "with setup of required items or equipment",
    "while maintaining prescribed precautions",
    "without loss of balance",
  ];
}

export function smartCriterionOptions(goal: OTGoal): string[] {
  if (goal.sourceType === "ROM") {
    return [
      "as measured by goniometry",
      "across 2 consecutive treatment sessions",
      "across 2 treatment sessions with the target range demonstrated consistently",
    ];
  }

  if (goal.sourceType === "Strength") {
    return [
      "as measured by manual muscle testing",
      "across 2 consecutive treatment sessions",
      "across 2 treatment sessions with the target strength demonstrated consistently",
    ];
  }

  return [
    "in 4 out of 5 observed opportunities",
    "across 3 consecutive treatment sessions",
    "across 3 treatment sessions with consistent carryover",
    "during 2 consecutive treatment sessions",
  ];
}

function normalizePurpose(value: string): string {
  return clean(value).replace(/^(in order to|to)\s+/i, "");
}

function timeframePhrase(timeframe: string): string {
  const value = clean(timeframe);
  if (!value) return "";
  if (/^(within|by|over|during|after|before|for)\b/i.test(value)) return value;
  return `within ${value}`;
}

function assistancePhrase(target: string): string {
  const map: Record<string, string> = {
    Independent: "independently",
    "Modified Independent": "with modified independence",
    Supervision: "with supervision",
    "Contact Guard Assist": "with contact guard assistance",
    "Minimal Assist": "with minimal assistance",
    "Moderate Assist": "with moderate assistance",
    "Maximal Assist": "with maximal assistance",
    Dependent: "with dependent assistance",
  };
  if (map[target]) return map[target];

  const value = clean(target);
  if (!value) return "";
  if (/^independent\s+with\s+/i.test(value)) return value.replace(/^independent/i, "independently");
  if (/^(independently|with|using|without|while|at)\b/i.test(value)) return value;
  if (/assistance$/i.test(value)) return `with ${value.toLowerCase()}`;
  return `at the documented target of ${value}`;
}

function assistanceNoun(level: string | undefined): string {
  const map: Record<string, string> = {
    Independent: "independence",
    "Modified Independent": "modified independence",
    Supervision: "supervision",
    "Contact Guard Assist": "contact guard assistance",
    "Minimal Assist": "minimal assistance",
    "Moderate Assist": "moderate assistance",
    "Maximal Assist": "maximal assistance",
    Dependent: "dependent assistance",
  };
  return map[clean(level)] || "";
}

function normalizeRomValue(value: string | undefined): string {
  const text = clean(value);
  if (!text) return "current documented level";
  if (/^-?\d+(\.\d+)?$/.test(text)) return `${text}°`;
  return text;
}

function normalizeStrengthValue(value: string | undefined): string {
  const text = clean(value);
  if (!text) return "current documented level";
  if (MMT_LEVELS.includes(text)) return `${text}/5`;
  return text;
}

function finishStatement(body: string, goal: OTGoal, commaBeforePurpose = false): string {
  const purpose = normalizePurpose(goal.performanceProblem) || "improve occupational performance";
  const time = timeframePhrase(goal.timeframe);
  const targetDate = formatGoalDate(goal.targetDate);
  const purposeJoiner = commaBeforePurpose ? ", to " : " to ";
  const withPurpose = `${body}${purposeJoiner}${purpose}`;
  const withTime = time ? `${withPurpose} ${time}` : withPurpose;
  return `${withTime}${targetDate ? ` (target date: ${targetDate})` : ""}.`;
}

function splitMeasurementCriterion(criterion: string, expected: "goniometry" | "manual muscle testing"): { measurement: string; remainder: string } {
  const value = clean(criterion);
  const canonical = expected === "goniometry" ? "as measured by goniometry" : "as measured by manual muscle testing";
  if (value.toLowerCase() === canonical) {
    return { measurement: expected === "goniometry" ? "measured by goniometry" : "measured by manual muscle testing", remainder: "" };
  }
  return { measurement: "", remainder: value };
}

export function buildGoalStatement(goal: OTGoal): string {
  if (!clean(goal.occupation) || !clean(goal.target)) return "";

  const activity = occupationLabel(goal.occupation).toLowerCase();
  const condition = clean(goal.condition);
  const criterion = clean(goal.measurableCriterion);

  if (goal.sourceType === "ROM") {
    const side = goal.sourceSide === "right" ? "right" : goal.sourceSide === "left" ? "left" : "involved";
    const movement = clean(goal.sourceMovement) || "upper-extremity movement";
    const metric = goal.sourceMetric || "AROM";
    const baseline = normalizeRomValue(goal.sourceBaseline);
    const target = normalizeRomValue(goal.target);
    const { measurement, remainder } = splitMeasurementCriterion(criterion, "goniometry");
    const measurementPhrase = measurement ? `, ${measurement},` : "";

    let body = clean(goal.target).toLowerCase().startsWith("functional rom sufficient")
      ? `Patient will demonstrate functional ${side} ${movement.toLowerCase()} ${metric}${measurementPhrase} sufficient for ${activity}`
      : `Patient will increase ${side} ${movement.toLowerCase()} ${metric}${measurementPhrase} from ${baseline} to ${target}`;

    if (condition) body += ` ${condition}`;
    if (remainder) body += `, ${remainder}`;
    return finishStatement(body, goal, true);
  }

  if (goal.sourceType === "Strength") {
    const side = goal.sourceSide === "right" ? "right" : goal.sourceSide === "left" ? "left" : "involved";
    const movement = clean(goal.sourceMovement) || "upper-extremity movement";
    const baseline = normalizeStrengthValue(goal.sourceBaseline);
    const target = normalizeStrengthValue(goal.target);
    const { measurement, remainder } = splitMeasurementCriterion(criterion, "manual muscle testing");
    const measurementPhrase = measurement ? `, ${measurement},` : "";

    let body = clean(goal.target).toLowerCase().startsWith("functional strength sufficient")
      ? `Patient will demonstrate functional ${side} ${movement.toLowerCase()} strength${measurementPhrase} sufficient for ${activity}`
      : `Patient will improve ${side} ${movement.toLowerCase()} strength${measurementPhrase} from ${baseline} to ${target}`;

    if (condition) body += ` ${condition}`;
    if (remainder) body += `, ${remainder}`;
    return finishStatement(body, goal, true);
  }

  const currentNoun = assistanceNoun(goal.current);
  const targetNoun = assistanceNoun(goal.target);
  let performance = currentNoun && targetNoun
    ? `Patient will improve ${activity} from ${currentNoun} to ${targetNoun}`
    : `Patient will complete ${activity} ${assistancePhrase(goal.target)}`.trim();

  if (condition) performance += ` ${condition}`;
  if (criterion) performance += ` ${criterion}`;
  return finishStatement(performance, goal);
}

export function goalBuilderCanAdvance(step: GoalBuilderStepKey, goal: OTGoal): boolean {
  if (step === "focus") return !!clean(goal.occupation) && !!clean(goal.performanceProblem);
  if (step === "target") return !!clean(goal.target);
  if (step === "criteria") return true;
  return !!clean(goal.timeframe) && !!clean(goal.targetDate);
}
