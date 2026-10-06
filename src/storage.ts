import {
  arrayUnion,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth, db } from "./firebase";
import type { Evaluation } from "./types";
import type { ProgressNote } from "./progressTypes";
import { createDemoEvaluation } from "./demoEvaluation";

const PREFIX = "snf-ot-eval:";
const IS_E2E_TEST = import.meta.env.VITE_E2E_TEST === "true";

export function generateResumeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = (length: number) =>
    Array.from(crypto.getRandomValues(new Uint8Array(length)))
      .map((n) => alphabet[n % alphabet.length])
      .join("");
  return `SNF-${part(4)}-${part(4)}`;
}

export async function ensureAnonymousAuth(): Promise<void> {
  if (IS_E2E_TEST) return;
  if (auth.currentUser) return;

  await new Promise<void>((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();

      if (user) {
        resolve();
        return;
      }

      try {
        await signInAnonymously(auth);
        resolve();
      } catch (error) {
        reject(error);
      }
    }, reject);
  });
}

export async function saveEvaluation(evaluation: Evaluation): Promise<void> {
  if (IS_E2E_TEST) {
    localStorage.setItem(PREFIX + evaluation.resumeCode, JSON.stringify(evaluation));
    localStorage.setItem(PREFIX + "last-code", evaluation.resumeCode);
    return;
  }

  await ensureAnonymousAuth();
  await setDoc(doc(db, "evaluations", evaluation.resumeCode), evaluation);
  localStorage.setItem(PREFIX + evaluation.resumeCode, JSON.stringify(evaluation));
  localStorage.setItem(PREFIX + "last-code", evaluation.resumeCode);
}

export async function loadEvaluation(code: string): Promise<Evaluation | null> {
  const normalizedCode = code.trim().toUpperCase();

  if (normalizedCode === "DEMO") {
    const evaluation = createDemoEvaluation();
    localStorage.setItem(PREFIX + "DEMO", JSON.stringify(evaluation));
    localStorage.setItem(PREFIX + "last-code", "DEMO");
    return evaluation;
  }

  if (IS_E2E_TEST) {
    const raw = localStorage.getItem(PREFIX + normalizedCode);
    if (!raw) return null;

    const evaluation = JSON.parse(raw) as Evaluation;
    localStorage.setItem(PREFIX + "last-code", normalizedCode);
    return evaluation;
  }

  await ensureAnonymousAuth();
  const snapshot = await getDoc(doc(db, "evaluations", normalizedCode));

  if (snapshot.exists()) {
    const evaluation = snapshot.data() as Evaluation;
    localStorage.setItem(PREFIX + normalizedCode, JSON.stringify(evaluation));
    localStorage.setItem(PREFIX + "last-code", normalizedCode);
    return evaluation;
  }

  return null;
}

export function getLastCode(): string | null {
  return localStorage.getItem(PREFIX + "last-code");
}

export async function saveProgressNote(note: ProgressNote): Promise<void> {
  const caseCode = note.sourceEvaluationCode.trim().toUpperCase();

  if (IS_E2E_TEST) {
    localStorage.setItem(PREFIX + "progress:" + note.resumeCode, JSON.stringify(note));
    const rawIndex = localStorage.getItem(PREFIX + "progress-index:" + caseCode);
    const existingCodes = rawIndex ? JSON.parse(rawIndex) as string[] : [];
    const noteCodes = existingCodes.includes(note.resumeCode) ? existingCodes : [...existingCodes, note.resumeCode];
    localStorage.setItem(PREFIX + "progress-index:" + caseCode, JSON.stringify(noteCodes));
    localStorage.setItem(PREFIX + "last-progress-code", caseCode);
    return;
  }

  await ensureAnonymousAuth();
  await setDoc(doc(db, "progressNotes", note.resumeCode), note);
  await setDoc(
    doc(db, "progressNoteIndexes", caseCode),
    {
      sourceEvaluationCode: caseCode,
      noteCodes: arrayUnion(note.resumeCode),
      latestNoteCode: note.resumeCode,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  localStorage.setItem(PREFIX + "progress:" + note.resumeCode, JSON.stringify(note));
  localStorage.setItem(PREFIX + "last-progress-code", caseCode);
}

export async function loadProgressNote(code: string): Promise<ProgressNote | null> {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) return null;

  if (IS_E2E_TEST) {
    const rawIndex = localStorage.getItem(PREFIX + "progress-index:" + normalizedCode);
    if (rawIndex) {
      const noteCodes = JSON.parse(rawIndex) as string[];
      const latestCode = noteCodes[noteCodes.length - 1];
      const raw = latestCode ? localStorage.getItem(PREFIX + "progress:" + latestCode) : null;
      if (raw) return JSON.parse(raw) as ProgressNote;
    }

    const legacyRaw = localStorage.getItem(PREFIX + "progress:" + normalizedCode);
    return legacyRaw ? JSON.parse(legacyRaw) as ProgressNote : null;
  }

  await ensureAnonymousAuth();

  const indexSnapshot = await getDoc(doc(db, "progressNoteIndexes", normalizedCode));
  if (indexSnapshot.exists()) {
    const index = indexSnapshot.data() as { latestNoteCode?: string; noteCodes?: string[] };
    const latestCode = index.latestNoteCode || index.noteCodes?.[index.noteCodes.length - 1];
    if (latestCode) {
      const noteSnapshot = await getDoc(doc(db, "progressNotes", latestCode));
      if (noteSnapshot.exists()) {
        const note = noteSnapshot.data() as ProgressNote;
        localStorage.setItem(PREFIX + "progress:" + note.resumeCode, JSON.stringify(note));
        localStorage.setItem(PREFIX + "last-progress-code", normalizedCode);
        return note;
      }
    }
  }

  // Backward-compatible fallback for the short-lived PN-code resume workflow.
  const legacySnapshot = await getDoc(doc(db, "progressNotes", normalizedCode));
  if (legacySnapshot.exists()) {
    const note = legacySnapshot.data() as ProgressNote;
    localStorage.setItem(PREFIX + "progress:" + normalizedCode, JSON.stringify(note));
    localStorage.setItem(PREFIX + "last-progress-code", note.sourceEvaluationCode);
    return note;
  }

  return null;
}

export function getLastProgressCode(): string | null {
  return localStorage.getItem(PREFIX + "last-progress-code");
}
