import type { AssistanceLevel, Evaluation, OTGoal } from "./types";

export type GoalProgressStatus = "" | "Met" | "Partially Met" | "Unmet";
export type GoalPlan = "Continue" | "Upgrade" | "Discontinue";

export interface ProgressGoal {
  goalId: string;
  originalGoal: OTGoal;
  currentPerformance: string;
  status: GoalProgressStatus;
  plan: GoalPlan;
  modifiedGoal: string;
  notes: string;
}

export interface ProgressNote {
  id: string;
  resumeCode: string;
  sourceEvaluationCode: string;
  studentName: string;
  status: "draft" | "submitted";
  createdAt: string;
  updatedAt: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  visitsSinceEvaluation: string;
  medicalUpdates: string;
  pain: string;
  fallsHospitalizations: string;
  precautionsChanges: string;
  currentADL: Record<string, AssistanceLevel>;
  functionalADLConfirmed: Record<string, boolean>;
  functionalNotes: string;
  romUpdate: string;
  strengthUpdate: string;
  balanceUpdate: string;
  enduranceUpdate: string;
  cognitionSafetyUpdate: string;
  otherPerformanceUpdate: string;
  skilledInterventions: string[];
  responseToIntervention: string;
  barriers: string;
  facilitators: string;
  goals: ProgressGoal[];
  assessment: string;
  continuedSkilledNeed: string;
  planDecision: "Continue POC" | "Modify POC" | "Discharge OT";
  frequency: string;
  duration: string;
  caregiverEquipmentNeeds: string;
}

export function createProgressNote(evaluation: Evaluation, resumeCode: string): ProgressNote {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), resumeCode, sourceEvaluationCode: evaluation.resumeCode,
    studentName: evaluation.studentName, status: "draft", createdAt: now, updatedAt: now,
    reportingPeriodStart: evaluation.formData.patientInfo.evaluationDate || "",
    reportingPeriodEnd: new Date().toISOString().slice(0,10), visitsSinceEvaluation: "",
    medicalUpdates: "", pain: "", fallsHospitalizations: "", precautionsChanges: "",
    currentADL: { ...evaluation.formData.adlStatus.current },
    functionalADLConfirmed: Object.fromEntries(Object.keys(evaluation.formData.adlStatus.current).map(key => [key, false])), functionalNotes: "",
    romUpdate: "", strengthUpdate: "", balanceUpdate: "", enduranceUpdate: "",
    cognitionSafetyUpdate: "", otherPerformanceUpdate: "", skilledInterventions: [],
    responseToIntervention: "", barriers: "", facilitators: "",
    goals: evaluation.formData.goalsPlanOfCare.goals.map(g => ({
      goalId: g.id, originalGoal: g, currentPerformance: g.current || "", status: "",
      plan: "Continue", modifiedGoal: "", notes: ""
    })),
    assessment: "", continuedSkilledNeed: "", planDecision: "Continue POC",
    frequency: evaluation.formData.goalsPlanOfCare.frequency,
    duration: evaluation.formData.goalsPlanOfCare.duration,
    caregiverEquipmentNeeds: ""
  };
}

export function buildSuggestedAssessment(note: ProgressNote, evaluation: Evaluation): string {
  const levels = ["Dependent","Maximal Assist","Moderate Assist","Minimal Assist","Contact Guard Assist","Supervision","Modified Independent","Independent"];
  const changes: string[] = [];
  const labels: Record<string,string> = {eating:"eating",grooming:"grooming",bathing:"bathing",upperBodyDressing:"upper-body dressing",lowerBodyDressing:"lower-body dressing",toileting:"toileting",toiletTransfer:"toilet transfer",showerTransfer:"shower transfer",bedMobility:"bed mobility",transfers:"transfers",functionalMobility:"functional mobility"};
  for (const [key,current] of Object.entries(note.currentADL)) {
    const baseline = evaluation.formData.adlStatus.current[key];
    if (!baseline || !current || baseline === current) continue;
    const b = levels.indexOf(baseline); const c = levels.indexOf(current);
    if (b >= 0 && c > b) changes.push(`${labels[key] || key} from ${baseline} to ${current}`);
  }
  const progress = changes.length ? `Patient demonstrates measurable functional progress since the initial evaluation, including ${changes.slice(0,3).join(", ")}.` : "Patient's current occupational performance was reviewed relative to the initial evaluation.";
  const remaining = note.barriers.trim() ? ` Remaining barriers include ${note.barriers.trim()}.` : "";
  return `${progress}${remaining} Continued skilled OT is indicated to address remaining occupational performance limitations and maximize safety and independence with daily activities.`;
}
