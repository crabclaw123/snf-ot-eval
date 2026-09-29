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

  it("allows a pain rating of 0", () => {
    // Arrange
    const formData = createEmptyFormData();
    formData.medicalStatus.painRating = "0";

    // Act
    const result = formData.medicalStatus.painRating;

    // Assert
    expect(result).toBe("0");
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

  it("preserves ADL data when normalizing an evaluation", () => {
    // Arrange
    const formData = createEmptyFormData();
    formData.adlStatus.plof.eating = "Independent";

    const evaluation: Evaluation = {
      id: "adl-test",
      resumeCode: "ADL01",
      studentName: "Test Student",
      status: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      formData,
    };

    // Act
    const normalized = normalizeEvaluation(evaluation);

    // Assert
    expect(normalized.formData.adlStatus.plof.eating).toBe("Independent");
  });

  it("adds a missing ADL key when normalizing older data", () => {
    // Arrange
    const oldFormData = createEmptyFormData();
    delete oldFormData.adlStatus.plof.grooming;

    const evaluation: Evaluation = {
      id: "old-adl-evaluation",
      resumeCode: "OLDADL01",
      studentName: "Test Student",
      status: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      formData: oldFormData,
    };

    // Act
    const normalized = normalizeEvaluation(evaluation);

    // Assert
    expect(normalized.formData.adlStatus.plof.grooming).toBe("");
  });

  it("preserves evaluation metadata when normalizing", () => {
    // Arrange
    const formData = createEmptyFormData();

    const evaluation: Evaluation = {
      id: "abc123",
      resumeCode: "META01",
      studentName: "Test Student",
      status: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      formData,
    };

    // Act
    const normalized = normalizeEvaluation(evaluation);

    // Assert
    expect(normalized.id).toBe("abc123");
    expect(normalized.status).toBe("draft");
  });
});
