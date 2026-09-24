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

export function saveLocalEvaluation(evaluation: Evaluation): void {
  localStorage.setItem(PREFIX + evaluation.resumeCode, JSON.stringify(evaluation));
  localStorage.setItem(PREFIX + "last-code", evaluation.resumeCode);
}

export function loadLocalEvaluation(code: string): Evaluation | null {
  const raw = localStorage.getItem(PREFIX + code.trim().toUpperCase());
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Evaluation;
  } catch {
    return null;
  }
}

export function getLastCode(): string | null {
  return localStorage.getItem(PREFIX + "last-code");
}