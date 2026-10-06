import { describe, expect, it } from "vitest";
import type { OTGoal } from "../types";
import {
  buildGoalStatement,
  calculateGoalTargetDate,
  recommendedTarget,
} from "../goalBuilderLogic";

function baseGoal(overrides: Partial<OTGoal> = {}): OTGoal {
  return {
    id: "goal-1",
    type: "Short-term",
    occupation: "eating",
    plof: "Independent",
    current: "Minimal Assist",
    target: "Supervision",
    performanceProblem: "reduce caregiver assistance during eating",
    condition: "with no more than 2 verbal cues",
    measurableCriterion: "in 4 out of 5 observed opportunities",
    timeframe: "4 weeks",
    targetDate: "2026-11-03",
    goalStatement: "",
    sourceType: "Functional",
    ...overrides,
  };
}

describe("goal builder logic", () => {
  it("builds a fluent functional goal without duplicate connector wording", () => {
    const statement = buildGoalStatement(baseGoal());

    expect(statement).toBe(
      "Patient will improve eating from minimal assistance to supervision with no more than 2 verbal cues in 4 out of 5 observed opportunities to reduce caregiver assistance during eating within 4 weeks (target date: 11/03/2026).",
    );
    expect(statement).not.toContain("while with");
    expect(statement).not.toContain("as demonstrated by without");
  });

  it("builds a clean ROM goal tied to occupational purpose", () => {
    const statement = buildGoalStatement(baseGoal({
      occupation: "upperBodyDressing",
      current: "Minimal Assist",
      target: "65°",
      sourceType: "ROM",
      sourceSide: "right",
      sourceMovement: "Shoulder extension",
      sourceMetric: "AROM",
      sourceBaseline: "45",
      performanceProblem: "improve right upper-extremity reach required for upper-body dressing",
      condition: "without increased pain",
      measurableCriterion: "as measured by goniometry",
      timeframe: "6 weeks",
      targetDate: "2026-11-17",
    }));

    expect(statement).toBe(
      "Patient will increase right shoulder extension AROM from 45° to 65° without increased pain, as measured by goniometry, to improve right upper-extremity reach required for upper-body dressing within 6 weeks (target date: 11/17/2026).",
    );
  });

  it("builds a clean strength goal", () => {
    const statement = buildGoalStatement(baseGoal({
      occupation: "upperBodyDressing",
      target: "4-/5",
      sourceType: "Strength",
      sourceSide: "right",
      sourceMovement: "Shoulder flexion",
      sourceMetric: "MMT",
      sourceBaseline: "3",
      performanceProblem: "improve right upper-extremity strength required for upper-body dressing",
      condition: "without compensatory movement",
      measurableCriterion: "as measured by manual muscle testing",
      timeframe: "6 weeks",
      targetDate: "2026-11-17",
    }));

    expect(statement).toBe(
      "Patient will improve right shoulder flexion strength from 3/5 to 4-/5 without compensatory movement, as measured by manual muscle testing, to improve right upper-extremity strength required for upper-body dressing within 6 weeks (target date: 11/17/2026).",
    );
  });

  it("does not duplicate within for a custom timeframe", () => {
    const statement = buildGoalStatement(baseGoal({ timeframe: "within 10 treatment sessions" }));
    expect(statement).toContain("within 10 treatment sessions");
    expect(statement).not.toContain("within within");
  });

  it("calculates preset target dates from the evaluation date", () => {
    expect(calculateGoalTargetDate("2026-10-06", "4 weeks")).toBe("2026-11-03");
    expect(calculateGoalTargetDate("2026-10-06", "6 weeks")).toBe("2026-11-17");
  });

  it("suggests the next functional assistance level", () => {
    expect(recommendedTarget(baseGoal({ current: "Minimal Assist" }))).toBe("Contact Guard Assist");
    expect(recommendedTarget(baseGoal({ current: "Contact Guard Assist" }))).toBe("Supervision");
  });
});
