import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth, db } from "./firebase";
import type { Evaluation } from "./types";

const PREFIX = "snf-ot-eval:";

export function generateResumeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = (length: number) =>
    Array.from(crypto.getRandomValues(new Uint8Array(length)))
      .map((n) => alphabet[n % alphabet.length])
      .join("");
  return `SNF-${part(4)}-${part(4)}`;
}

export async function ensureAnonymousAuth(): Promise<void> {
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
  await ensureAnonymousAuth();
  await setDoc(doc(db, "evaluations", evaluation.resumeCode), evaluation);
  localStorage.setItem(PREFIX + evaluation.resumeCode, JSON.stringify(evaluation));
  localStorage.setItem(PREFIX + "last-code", evaluation.resumeCode);
}

export async function loadEvaluation(code: string): Promise<Evaluation | null> {
  const normalizedCode = code.trim().toUpperCase();

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
