import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyFormData, type Evaluation } from "../types";

const firestoreMocks = vi.hoisted(() => ({
  doc: vi.fn(() => ({ path: "evaluations/test" })),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  currentUser: { uid: "test-user" },
}));

vi.mock("firebase/firestore", () => firestoreMocks);
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn(),
  signInAnonymously: vi.fn(),
}));
vi.mock("../firebase", () => ({
  auth: authMocks,
  db: { name: "test-db" },
}));

import {
  getLastCode,
  loadEvaluation,
  saveEvaluation,
} from "../storage";

function makeEvaluation(): Evaluation {
  return {
    id: "evaluation-1",
    resumeCode: "SNF-TEST-1234",
    studentName: "Test Student",
    status: "draft",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    formData: createEmptyFormData(),
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  firestoreMocks.setDoc.mockResolvedValue(undefined);
});

describe("saveEvaluation", () => {
  it("writes the evaluation to Firestore and localStorage", async () => {
    const evaluation = makeEvaluation();

    await saveEvaluation(evaluation);

    expect(firestoreMocks.setDoc).toHaveBeenCalledTimes(1);
    expect(firestoreMocks.setDoc).toHaveBeenCalledWith(
      expect.anything(),
      evaluation,
    );
    expect(localStorage.getItem("snf-ot-eval:" + evaluation.resumeCode)).toBe(
      JSON.stringify(evaluation),
    );
    expect(getLastCode()).toBe(evaluation.resumeCode);
  });

  it("does not save to localStorage when the Firestore save fails", async () => {
    const evaluation = makeEvaluation();
    firestoreMocks.setDoc.mockRejectedValueOnce(new Error("Firestore unavailable"));

    await expect(saveEvaluation(evaluation)).rejects.toThrow(
      "Firestore unavailable",
    );

    expect(localStorage.getItem("snf-ot-eval:" + evaluation.resumeCode)).toBeNull();
    expect(getLastCode()).toBeNull();
  });
});

describe("loadEvaluation", () => {
  it("normalizes the resume code before loading from Firestore", async () => {
    const evaluation = makeEvaluation();
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => evaluation,
    });

    const result = await loadEvaluation("  snf-test-1234  ");

    expect(firestoreMocks.doc).toHaveBeenCalledWith(
      expect.anything(),
      "evaluations",
      "SNF-TEST-1234",
    );
    expect(result).toEqual(evaluation);
    expect(getLastCode()).toBe("SNF-TEST-1234");
  });

  it("caches a successfully loaded evaluation in localStorage", async () => {
    const evaluation = makeEvaluation();
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => evaluation,
    });

    await loadEvaluation(evaluation.resumeCode);

    expect(
      localStorage.getItem("snf-ot-eval:" + evaluation.resumeCode),
    ).toBe(JSON.stringify(evaluation));
  });

  it("returns null when the requested evaluation does not exist", async () => {
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => false,
    });

    const result = await loadEvaluation("SNF-MISSING");

    expect(result).toBeNull();
  });

  it("propagates Firestore load errors", async () => {
    firestoreMocks.getDoc.mockRejectedValueOnce(new Error("Network error"));

    await expect(loadEvaluation("SNF-ERROR")).rejects.toThrow("Network error");
  });
});

describe("getLastCode", () => {
  it("returns null when no evaluation has been saved or loaded", () => {
    expect(getLastCode()).toBeNull();
  });

  it("returns the most recently stored resume code", () => {
    localStorage.setItem("snf-ot-eval:last-code", "SNF-ABCD-2345");

    expect(getLastCode()).toBe("SNF-ABCD-2345");
  });
});
