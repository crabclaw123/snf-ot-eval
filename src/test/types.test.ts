import { describe, it, expect } from "vitest";
import {
  createEmptyFormData,
  normalizeEvaluation,
  type Evaluation,
} from "../types";

describe("createEmptyFormData", () => {
  it("creates an empty patient information section", () => {
    // Arrange
    // There is nothing special to arrange for this test.

    // Act
    const formData = createEmptyFormData();

    // Assert
    expect(formData.patientInfo.patientName).toBe("");
    expect(formData.patientInfo.medicalDiagnosis).toBe("");
    expect(formData.patientInfo.reasonForReferral).toBe("");
  });

  it("initializes the pain assessment fields as empty", () => {
    const formData = createEmptyFormData();

    expect(formData.medicalStatus.painRating).toBe("");
    expect(formData.medicalStatus.painInterferesOccupationalParticipation).toBe("");
    expect(formData.medicalStatus.painTiming).toBe("");
    expect(formData.medicalStatus.painLocation).toBe("");
    expect(formData.medicalStatus.painDescription).toBe("");
  });

  it("creates all expected ADL assistance fields", () => {
    const formData = createEmptyFormData();

    expect(formData.adlStatus.plof).toHaveProperty("eating", "");
    expect(formData.adlStatus.plof).toHaveProperty("grooming", "");
    expect(formData.adlStatus.plof).toHaveProperty("toileting");
    expect(formData.adlStatus.current).toHaveProperty("functionalMobility", "");
  });
});

describe("normalizeEvaluation", () => {
  it("preserves existing patient and pain information", () => {
    // Arrange
    const formData = createEmptyFormData();
    formData.patientInfo.patientName = "Test Patient";
    formData.medicalStatus.painRating = "7";
    formData.medicalStatus.painInterferesOccupationalParticipation = "Yes";
    formData.medicalStatus.painTiming = "With activity";
    formData.medicalStatus.painLocation = "Right shoulder";
    formData.medicalStatus.painDescription = "Sharp pain with reaching";

    const evaluation: Evaluation = {
      id: "test-id",
      resumeCode: "TEST01",
      studentName: "Test Student",
      status: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      formData,
    };

    // Act
    const normalized = normalizeEvaluation(evaluation);

    // Assert
    expect(normalized.formData.patientInfo.patientName).toBe("Test Patient");
    expect(normalized.formData.medicalStatus.painRating).toBe("7");
    expect(normalized.formData.medicalStatus.painInterferesOccupationalParticipation).toBe("Yes");
    expect(normalized.formData.medicalStatus.painTiming).toBe("With activity");
    expect(normalized.formData.medicalStatus.painLocation).toBe("Right shoulder");
    expect(normalized.formData.medicalStatus.painDescription).toBe("Sharp pain with reaching");
  });

  it("adds defaults for newly introduced fields when normalizing older data", () => {
    // Arrange
    // Pretend this evaluation came from an older version of the app that did
    // not have the newer pain fields.
    const oldFormData = createEmptyFormData();
    delete (oldFormData.medicalStatus as Partial<typeof oldFormData.medicalStatus>).painInterferesOccupationalParticipation;
    delete (oldFormData.medicalStatus as Partial<typeof oldFormData.medicalStatus>).painTiming;
    delete (oldFormData.medicalStatus as Partial<typeof oldFormData.medicalStatus>).painDescription;

    const evaluation: Evaluation = {
      id: "old-evaluation",
      resumeCode: "OLD01",
      studentName: "Test Student",
      status: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      formData: oldFormData,
    };

    // Act
    const normalized = normalizeEvaluation(evaluation);

    // Assert
    expect(normalized.formData.medicalStatus.painInterferesOccupationalParticipation).toBe("");
    expect(normalized.formData.medicalStatus.painTiming).toBe("");
    expect(normalized.formData.medicalStatus.painDescription).toBe("");
  });
});

/*
 * ============================================================
 * YOUR TURN — BUILD THESE TESTS
 * ============================================================
 *
 * These are intentionally NOT completed for you.
 * The goal is for you to practice the exact same pattern you
 * just learned with the 2 + 2 example.
 *
 * TEST #1 — Pain rating should accept "0"
 * ------------------------------------------------------------
 * Why:
 * Zero is a valid pain rating, so we want to make sure our
 * data model can represent "no pain" without treating it as
 * missing.
 *
 * What to do:
 * 1. Add another it(...) inside the createEmptyFormData
 *    describe block.
 * 2. Call createEmptyFormData().
 * 3. Change formData.medicalStatus.painRating to "0".
 * 4. Use expect(...) to verify that the value is "0".
 *
 * Hint:
 * Your Assert line should look conceptually like:
 *
 *   expect(SOMETHING).toBe("0");
 *
 * Replace SOMETHING with the property you are testing.
 *
 * TEST #2 — A normalized evaluation should preserve ADL data
 * ------------------------------------------------------------
 * Why:
 * normalizeEvaluation() is used when loading evaluations.
 * We do NOT want normalization to accidentally wipe out ADL
 * information that a therapist already entered.
 *
 * What to do:
 * 1. Create an evaluation using createEmptyFormData().
 * 2. Set the PLOF eating level to something like "Independent".
 * 3. Pass that evaluation into normalizeEvaluation().
 * 4. Assert that the normalized evaluation still says
 *    "Independent" for eating PLOF.
 *
 * Think in AAA:
 *   Arrange → create the evaluation and put data into it.
 *   Act     → call normalizeEvaluation().
 *   Assert  → check that the ADL value survived.
 *
 * TEST #3 — An older evaluation should receive missing ADL keys
 * ------------------------------------------------------------
 * Why:
 * Older saved evaluations may not contain every ADL key that
 * the current app expects.
 *
 * What to do:
 * 1. Start with createEmptyFormData().
 * 2. Remove ONE ADL key from the old PLOF object.
 * 3. Normalize the evaluation.
 * 4. Assert that the missing key now exists and has the default
 *    empty value.
 *
 * Hint:
 * Look at the existing "newer pain fields" test above. You are
 * doing basically the same migration test, but with an ADL field.
 *
 * TEST #4 — Normalization should preserve evaluation metadata
 * ------------------------------------------------------------
 * Why:
 * normalizeEvaluation() should modify/complete formData,
 * but it should not accidentally replace things like the
 * evaluation ID or status.
 *
 * What to do:
 * 1. Create an Evaluation with an ID such as "abc123".
 * 2. Give it a status of "draft".
 * 3. Call normalizeEvaluation().
 * 4. Assert that the normalized evaluation still has:
 *      id === "abc123"
 *      status === "draft"
 *
 * Hint:
 * You can make TWO expect(...) assertions in the same test.
 *
 * BONUS CHALLENGE
 * ------------------------------------------------------------
 * Pick one test above and intentionally make the expected value
 * WRONG.
 *
 * Example:
 *   expect(result).toBe("Moderate Assist");
 *
 * when the actual value is "Independent".
 *
 * Run the tests and read the failure message.
 *
 * This is one of the most important parts of learning testing:
 * a test is not useful because it passes — it is useful because
 * it FAILS when the code behaves incorrectly.
 */
