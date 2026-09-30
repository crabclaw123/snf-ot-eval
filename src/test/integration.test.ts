import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyFormData, type Evaluation } from "../types";

const firestoreMocks = vi.hoisted(() => ({
  doc: vi.fn(() => ({ path: "evaluations/test" })),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  currentUser: { uid: "integration-test-user" },
}));

vi.mock("firebase/firestore", () => firestoreMocks);
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn(),
  signInAnonymously: vi.fn(),
}));
vi.mock("../firebase", () => ({
  auth: authMocks,
  db: { name: "integration-test-db" },
}));

import { loadEvaluation, saveEvaluation } from "../storage";

function makeEvaluation(resumeCode: string, patientName: string): Evaluation {
  const formData = createEmptyFormData();

  formData.patientInfo.patientName = patientName;
  formData.patientInfo.medicalDiagnosis = "Left hip fracture";
  formData.medicalStatus.painRating = "7";
  formData.medicalStatus.painInterferesOccupationalParticipation = "Yes";
  formData.medicalStatus.painTiming = "With transfers";
  formData.medicalStatus.painLocation = "Left hip";
  formData.medicalStatus.painDescription = "Sharp pain with movement";
  formData.adlStatus.current.toileting = "Moderate Assist";
  formData.sectionGG.toiletTransfer = "03";
  formData.goalsPlanOfCare.goals = [{
    id: "goal-1",
    type: "Short-term",
    occupation: "Toileting",
    plof: "Moderate Assist",
    current: "Moderate Assist",
    target: "Minimal Assist",
    performanceProblem: "Difficulty completing toileting safely",
    condition: "Using grab bar and RW",
    measurableCriterion: "2 consecutive sessions",
    timeframe: "2 weeks",
    goalStatement: "Patient will complete toileting with Minimal Assist."
  }];

  return {
    id: `evaluation-${resumeCode}`,
    resumeCode,
    studentName: "Integration Test Student",
    status: "draft",
    createdAt: "2026-09-29T00:00:00.000Z",
    updatedAt: "2026-09-29T00:00:00.000Z",
    formData,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  firestoreMocks.setDoc.mockResolvedValue(undefined);
});

describe("Evaluation save and resume integration", () => {
  it("preserves populated evaluation data across save and resume", async () => {
    const evaluation = makeEvaluation("SNF-INTG-1234", "Test Patient McTesterson");

    await saveEvaluation(evaluation);

    const savedJson = localStorage.getItem("snf-ot-eval:" + evaluation.resumeCode);
    expect(savedJson).not.toBeNull();

    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => JSON.parse(savedJson!),
    });

    const resumed = await loadEvaluation(" snf-intg-1234 ");

    expect(resumed?.formData.patientInfo.patientName).toBe("Test Patient McTesterson");
    expect(resumed?.formData.medicalStatus.painRating).toBe("7");
    expect(resumed?.formData.medicalStatus.painInterferesOccupationalParticipation).toBe("Yes");
    expect(resumed?.formData.medicalStatus.painTiming).toBe("With transfers");
    expect(resumed?.formData.medicalStatus.painLocation).toBe("Left hip");
    expect(resumed?.formData.adlStatus.current.toileting).toBe("Moderate Assist");
    expect(resumed?.formData.sectionGG.toiletTransfer).toBe("03");
    expect(resumed?.formData.goalsPlanOfCare.goals[0]?.goalStatement).toBe(
      "Patient will complete toileting with Minimal Assist."
    );
  });

  it("keeps two evaluations isolated from each other", async () => {
    const patientA = makeEvaluation("SNF-AAAA-1111", "Patient A");
    const patientB = makeEvaluation("SNF-BBBB-2222", "Patient B");

    patientA.formData.medicalStatus.painRating = "2";
    patientA.formData.adlStatus.current.toileting = "Independent";

    patientB.formData.medicalStatus.painRating = "9";
    patientB.formData.adlStatus.current.toileting = "Maximal Assist";

    await saveEvaluation(patientA);
    await saveEvaluation(patientB);

    expect(localStorage.getItem("snf-ot-eval:SNF-AAAA-1111")).toBe(JSON.stringify(patientA));
    expect(localStorage.getItem("snf-ot-eval:SNF-BBBB-2222")).toBe(JSON.stringify(patientB));

    firestoreMocks.getDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => patientA })
      .mockResolvedValueOnce({ exists: () => true, data: () => patientB });

    const resumedA = await loadEvaluation("SNF-AAAA-1111");
    const resumedB = await loadEvaluation("SNF-BBBB-2222");

    expect(resumedA?.formData.patientInfo.patientName).toBe("Patient A");
    expect(resumedA?.formData.medicalStatus.painRating).toBe("2");
    expect(resumedA?.formData.adlStatus.current.toileting).toBe("Independent");

    expect(resumedB?.formData.patientInfo.patientName).toBe("Patient B");
    expect(resumedB?.formData.medicalStatus.painRating).toBe("9");
    expect(resumedB?.formData.adlStatus.current.toileting).toBe("Maximal Assist");
  });

  it("persists edited values when an existing evaluation is saved again", async () => {
    const evaluation = makeEvaluation("SNF-EDIT-1234", "Test Patient");

    await saveEvaluation(evaluation);

    evaluation.formData.medicalStatus.painRating = "4";
    evaluation.formData.adlStatus.current.toileting = "Minimal Assist";
    evaluation.formData.goalsPlanOfCare.goals[0].goalStatement =
      "Patient will complete toileting with Minimal Assist using appropriate safety strategies.";

    await saveEvaluation(evaluation);

    expect(firestoreMocks.setDoc).toHaveBeenLastCalledWith(
      expect.anything(),
      evaluation
    );
    expect(localStorage.getItem("snf-ot-eval:SNF-EDIT-1234")).toBe(JSON.stringify(evaluation));
  });
});
