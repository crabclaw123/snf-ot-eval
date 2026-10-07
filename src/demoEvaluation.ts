import type { AssistanceLevel, Evaluation, OTGoal } from "./types";
import { createEmptyFormData, MOVEMENTS } from "./types";

const isoOffset = (days: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export function createDemoEvaluation(): Evaluation {
  const formData = createEmptyFormData();
  const evalDate = isoOffset(-21);

  formData.patientInfo = {
    patientName: "Demo Patient",
    medicalRecordNumber: "DEMO-001",
    dateOfBirth: "1947-04-12",
    evaluationDate: evalDate,
    medicalDiagnosis: "Generalized weakness following hospitalization for pneumonia",
    reasonForReferral: "OT evaluation and treatment for decline in ADL independence, functional mobility, endurance, and safety following acute hospitalization.",
  };

  formData.occupationalProfile.summary = "78-year-old previously independent adult who lived alone in a one-story home. Patient values returning home, completing morning self-care independently, preparing simple meals, and resuming weekly church attendance. Daughter lives nearby and can assist intermittently.";
  formData.environmentPLOF.priorLivingEnvironment = "One-story home with 2 steps to enter and one handrail. Tub/shower combination with grab bar. Bedroom and bathroom on main level. Daughter available evenings and weekends.";
  formData.environmentPLOF.equipment = "Rolling walker, shower chair, grab bar, reacher";

  formData.medicalStatus = {
    ...formData.medicalStatus,
    precautions: ["Fall risk"],
    weightBearing: "WBAT",
    painLocation: "Right shoulder",
    painRating: "3",
    painInterferesOccupationalParticipation: "Yes",
    painTiming: "With activity",
    painDescription: "Aching with overhead reach",
    vitals: "BP 128/74, HR 82, SpO2 95% on room air",
    medicalStability: "Stable for therapy",
    notes: "Fall risk; monitor activity tolerance and oxygen saturation with exertion.",
  };

  const plof: Record<string, AssistanceLevel> = {
    eating: "Independent", grooming: "Independent", bathing: "Independent", upperBodyDressing: "Independent",
    lowerBodyDressing: "Independent", toileting: "Independent", toiletTransfer: "Independent", showerTransfer: "Independent",
    bedMobility: "Independent", transfers: "Independent", functionalMobility: "Independent",
  };
  const current: Record<string, AssistanceLevel> = {
    eating: "Independent", grooming: "Supervision", bathing: "Moderate Assist", upperBodyDressing: "Minimal Assist",
    lowerBodyDressing: "Moderate Assist", toileting: "Minimal Assist", toiletTransfer: "Contact Guard Assist", showerTransfer: "Minimal Assist",
    bedMobility: "Supervision", transfers: "Contact Guard Assist", functionalMobility: "Contact Guard Assist",
  };
  formData.adlStatus = {
    ...formData.adlStatus,
    plof,
    current,
    activityTolerance: "Tolerates 8-10 minutes of standing activity before seated rest break.",
    cueingNeeded: "Intermittent verbal cues for pacing and walker positioning.",
    safetyAwareness: "Mildly reduced; requires cues to lock wheelchair brakes and keep walker within base of support.",
    observations: "Patient demonstrates reduced endurance, standing balance, and lower-body reach affecting dressing, bathing, toileting, and mobility. Motivated and receptive to instruction.",
  };

  for (const movement of MOVEMENTS) {
    formData.rom.right[movement] = { status: "WFL", arom: "", prom: "", notes: "" };
    formData.rom.left[movement] = { status: "WFL", arom: "", prom: "", notes: "" };
    formData.strength.right[movement] = { status: "WFL", mmt: "4", notes: "" };
    formData.strength.left[movement] = { status: "WFL", mmt: "4", notes: "" };
  }
  formData.rom.right["Shoulder flexion"] = { status: "Impaired", arom: "125", prom: "145", notes: "Mild pain at end range" };
  formData.rom.right["Shoulder abduction"] = { status: "Impaired", arom: "110", prom: "135", notes: "Pain-limited" };
  formData.strength.right["Shoulder flexion"] = { status: "Impaired", mmt: "3+", notes: "Limited by pain" };
  formData.strength.left["Shoulder flexion"] = { status: "Impaired", mmt: "4-", notes: "Generalized weakness" };
  formData.rom.notes = "BUE ROM grossly WFL except pain-limited right shoulder flexion/abduction.";
  formData.strength.notes = "Generalized BUE weakness with greater deficit at right shoulder.";

  formData.clientFactors = {
    ...formData.clientFactors,
    orientedPerson: true,
    orientedPlace: true,
    orientedTime: true,
    orientedSituation: true,
    cognition: "Requires intermittent cues",
    communication: "Functional verbal communication",
    vision: "Uses corrective lenses",
    hearing: "Functional for conversation",
    sensation: "Intact for observed tasks",
    coordination: "Functional",
    balance: "Moderately impaired",
    endurance: "Moderately limited",
    motorPlanning: "Functional",
    functionalMobility: "Requires physical assistance",
    standardizedAssessments: "Trail Making Test A: 46 sec; B: 132 sec with 2 sequencing errors.",
    assessmentFindings: "Mild executive-function inefficiency noted with divided attention and sequencing; benefits from intermittent cueing for safety and task organization.",
  };

  formData.clinicalAssessment = {
    assessmentSummary: "Patient presents below prior independent baseline with deficits in endurance, standing balance, right shoulder function, generalized strength, and safety awareness that limit bathing, dressing, toileting, transfers, and functional mobility. Patient demonstrates good participation and rehabilitation potential. Skilled OT is indicated to improve ADL independence, safety, activity tolerance, and compensatory strategy use to support return home.",
    prognosis: "Good",
  };

  const goals: OTGoal[] = [
    {
      id: "demo-goal-1", type: "Short-term", occupation: "toileting", plof: "Independent", current: "Minimal Assist",
      target: "Contact Guard Assist", performanceProblem: "improve independence with toileting", condition: "with appropriate safety awareness",
      measurableCriterion: "in 3 consecutive treatment sessions", timeframe: "2 weeks", targetDate: isoOffset(-7),
      goalStatement: `Patient will improve toileting from Minimal Assist to Contact Guard Assist with appropriate safety awareness in 3 consecutive treatment sessions within 2 weeks (target date: ${isoOffset(-7)}).`,
    },
    {
      id: "demo-goal-2", type: "Short-term", occupation: "lowerBodyDressing", plof: "Independent", current: "Moderate Assist",
      target: "Minimal Assist", performanceProblem: "improve independence with dressing", condition: "using adaptive equipment as needed",
      measurableCriterion: "in 4 out of 5 observed opportunities", timeframe: "4 weeks", targetDate: isoOffset(7),
      goalStatement: `Patient will improve lower body dressing from Moderate Assist to Minimal Assist using adaptive equipment as needed in 4 out of 5 observed opportunities within 4 weeks (target date: ${isoOffset(7)}).`,
    },
    {
      id: "demo-goal-3", type: "Long-term", occupation: "bathing", plof: "Independent", current: "Moderate Assist",
      target: "Supervision", performanceProblem: "improve independence with bathing", condition: "using adaptive equipment as needed",
      measurableCriterion: "with consistent carryover across sessions", timeframe: "6 weeks", targetDate: isoOffset(21),
      goalStatement: `Patient will improve bathing from Moderate Assist to Supervision using adaptive equipment as needed with consistent carryover across sessions within 6 weeks (target date: ${isoOffset(21)}).`,
    },
  ];

  formData.goalsPlanOfCare = {
    ...formData.goalsPlanOfCare,
    frequency: "5x/week",
    duration: "6 weeks",
    treatmentInterventions: ["ADL retraining", "Functional mobility / transfer training", "Therapeutic exercise", "Therapeutic activity", "Balance training", "Energy conservation", "Adaptive equipment training", "Caregiver education"],
    goals,
    shortTermGoals: goals.filter(g => g.type === "Short-term").map(g => g.goalStatement).join("\n"),
    longTermGoals: goals.filter(g => g.type === "Long-term").map(g => g.goalStatement).join("\n"),
    overallGoal: "Maximize independence and safety with daily occupations to support return to prior living environment.",
    dischargePlan: "Anticipate discharge home with intermittent daughter support and home health services as indicated.",
    patientCaregiverEducation: "Education on energy conservation, fall prevention, walker safety, adaptive equipment, and home setup.",
  };

  formData.sectionGG = {
    ...formData.sectionGG,
    eating: "06", oralHygiene: "04", toiletingHygiene: "03", showerBathing: "03", upperBodyDressing: "03",
    lowerBodyDressing: "03", footwear: "03", rolling: "05", sitToLying: "05", lyingToSitting: "05", sitToStand: "04",
    chairBedTransfer: "04", toiletTransfer: "04", walking10Feet: "04", walking50FeetTurn: "04", stairs: "03",
    ggNotes: "Performance reflects usual ability observed during evaluation; safety cueing and rest breaks required.",
  };

  formData.signatureAttestation = {
    studentName: "Demo Student",
    credentials: "OT Student",
    attestation: false,
    signatureDate: isoOffset(0),
  };

  const now = new Date().toISOString();
  return {
    id: "demo-evaluation",
    resumeCode: "DEMO",
    studentName: "Demo Student",
    status: "draft",
    createdAt: now,
    updatedAt: now,
    formData,
  };
}
