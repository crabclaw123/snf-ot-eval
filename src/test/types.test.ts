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


describe("createEmptyFormData structure", () => {
  it("creates blank ROM and strength findings for every movement", () => {
    const formData = createEmptyFormData();

    expect(Object.keys(formData.rom.right)).toHaveLength(13);
    expect(Object.keys(formData.rom.left)).toHaveLength(13);
    expect(Object.keys(formData.strength.right)).toHaveLength(13);
    expect(Object.keys(formData.strength.left)).toHaveLength(13);

    expect(formData.rom.right["Shoulder flexion"]).toEqual({
      status: "",
      arom: "",
      prom: "",
      notes: "",
    });

    expect(formData.strength.left["Wrist extension"]).toEqual({
      status: "",
      mmt: "",
      notes: "",
    });
  });

  it("initializes client factors, Section GG, and attestation safely", () => {
    const formData = createEmptyFormData();

    expect(formData.clientFactors.orientedPerson).toBe(false);
    expect(formData.clientFactors.orientedPlace).toBe(false);
    expect(formData.sectionGG.eating).toBe("");
    expect(formData.sectionGG.toiletTransfer).toBe("");
    expect(formData.signatureAttestation.attestation).toBe(false);
  });

  it("initializes mutable arrays as independent empty arrays", () => {
    const first = createEmptyFormData();
    const second = createEmptyFormData();

    first.medicalStatus.precautions.push("Fall precautions");
    first.goalsPlanOfCare.treatmentInterventions.push("Therapeutic exercise");

    expect(second.medicalStatus.precautions).toEqual([]);
    expect(second.goalsPlanOfCare.treatmentInterventions).toEqual([]);
  });
});

describe("normalizeEvaluation legacy-data handling", () => {
  const makeEvaluation = (formData: Evaluation["formData"]): Evaluation => ({
    id: "legacy-test",
    resumeCode: "LEGACY01",
    studentName: "Test Student",
    status: "draft",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    formData,
  });

  it("converts legacy occupational profile fields into the current summary", () => {
    // Arrange
    const formData = createEmptyFormData() as Evaluation["formData"] & {
      occupationalProfile: Record<string, string>;
    };

    formData.occupationalProfile = {
      roles: "Retired teacher",
      routines: "Morning routine",
      interests: "Gardening",
      patientGoals: "Return to independent dressing",
      occupationalConcerns: "Difficulty managing buttons",
    } as typeof formData.occupationalProfile;

    // Act
    const normalized = normalizeEvaluation(makeEvaluation(formData));

    // Assert
    expect(normalized.formData.occupationalProfile.summary).toBe(
      "Retired teacher\nMorning routine\nGardening\nReturn to independent dressing\nDifficulty managing buttons"
    );
  });

  it("preserves the current occupational profile summary when it already exists", () => {
    // Arrange
    const formData = createEmptyFormData();
    formData.occupationalProfile.summary = "Current summary";

    // Act
    const normalized = normalizeEvaluation(makeEvaluation(formData));

    // Assert
    expect(normalized.formData.occupationalProfile.summary).toBe("Current summary");
  });

  it("migrates legacy precautions notes into medical status notes", () => {
    // Arrange
    const formData = createEmptyFormData() as Evaluation["formData"] & {
      medicalStatus: Evaluation["formData"]["medicalStatus"] & {
        precautionsNotes?: string;
      };
    };

    formData.medicalStatus.precautionsNotes = "Monitor for orthostatic symptoms";

    // Act
    const normalized = normalizeEvaluation(makeEvaluation(formData));

    // Assert
    expect(normalized.formData.medicalStatus.notes).toBe(
      "Monitor for orthostatic symptoms"
    );
  });

  it("preserves current medical notes instead of using legacy precautions notes", () => {
    // Arrange
    const formData = createEmptyFormData() as Evaluation["formData"] & {
      medicalStatus: Evaluation["formData"]["medicalStatus"] & {
        precautionsNotes?: string;
      };
    };

    formData.medicalStatus.notes = "Current clinical note";
    formData.medicalStatus.precautionsNotes = "Old note";

    // Act
    const normalized = normalizeEvaluation(makeEvaluation(formData));

    // Assert
    expect(normalized.formData.medicalStatus.notes).toBe("Current clinical note");
  });

  it("keeps all current ADL fields when normalizing", () => {
    // Arrange
    const formData = createEmptyFormData();
    formData.adlStatus.current.bathing = "Moderate Assist";
    formData.adlStatus.current.toiletTransfer = "Contact Guard Assist";

    // Act
    const normalized = normalizeEvaluation(makeEvaluation(formData));

    // Assert
    expect(normalized.formData.adlStatus.current.bathing).toBe("Moderate Assist");
    expect(normalized.formData.adlStatus.current.toiletTransfer).toBe(
      "Contact Guard Assist"
    );
  });

  it("falls back to an empty goals array when saved goals are malformed", () => {
    // Arrange
    const formData = createEmptyFormData() as Evaluation["formData"] & {
      goalsPlanOfCare: Evaluation["formData"]["goalsPlanOfCare"] & {
        goals: unknown;
      };
    };

    (formData.goalsPlanOfCare as unknown as { goals: unknown }).goals = "not-an-array";

    // Act
    const normalized = normalizeEvaluation(makeEvaluation(formData));

    // Assert
    expect(normalized.formData.goalsPlanOfCare.goals).toEqual([]);
  });

  it("preserves a saved goals array during normalization", () => {
    // Arrange
    const formData = createEmptyFormData();
    formData.goalsPlanOfCare.goals = [
      {
        id: "goal-1",
        type: "Short-term",
        occupation: "Dressing",
        plof: "Maximal Assist",
        current: "Maximal Assist",
        target: "Minimal Assist",
        performanceProblem: "Difficulty dressing",
        condition: "During morning dressing",
        measurableCriterion: "with 1 verbal cue",
        timeframe: "2 weeks",
        goalStatement: "Patient will complete dressing with Minimal Assist.",
      },
    ];

    // Act
    const normalized = normalizeEvaluation(makeEvaluation(formData));

    // Assert
    expect(normalized.formData.goalsPlanOfCare.goals).toHaveLength(1);
    expect(normalized.formData.goalsPlanOfCare.goals[0].id).toBe("goal-1");
    expect(normalized.formData.goalsPlanOfCare.goals[0].occupation).toBe(
      "Dressing"
    );
  });
});
