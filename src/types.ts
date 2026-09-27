export type EvaluationStatus = "draft" | "submitted";

export type AssistanceLevel =
  | "Independent"
  | "Modified Independent"
  | "Supervision"
  | "Contact Guard Assist"
  | "Minimal Assist"
  | "Moderate Assist"
  | "Maximal Assist"
  | "Dependent"
  | "Not Assessed"
  | "Not Applicable";

export type FindingStatus = "WNL" | "WFL" | "Impaired" | "Not Assessed";
export type SectionGGCode = "06" | "05" | "04" | "03" | "02" | "01" | "09" | "88";

export interface PatientInfo {
  patientName: string;
  medicalRecordNumber: string;
  dateOfBirth: string;
  evaluationDate: string;
  medicalDiagnosis: string;
  reasonForReferral: string;
}

export interface OccupationalProfile {
  summary: string;
}

export interface EnvironmentPLOF {
  priorLivingEnvironment: string;
  equipment: string;
  plofSummary: string;
}

export interface MedicalStatus {
  precautions: string[];
  weightBearing: string;
  painLocation: string;
  painRating: string;
  vitals: string;
  medicationsRelevant: string;
  linesTubesDrains: string;
  skinWounds: string;
  medicalStability: string;
  notes: string;
}

export interface ADLStatus {
  eating: AssistanceLevel;
  grooming: AssistanceLevel;
  bathing: AssistanceLevel;
  upperBodyDressing: AssistanceLevel;
  lowerBodyDressing: AssistanceLevel;
  toileting: AssistanceLevel;
  toiletTransfer: AssistanceLevel;
  showerTransfer: AssistanceLevel;
  bedMobility: AssistanceLevel;
  transfers: AssistanceLevel;
  functionalMobility: AssistanceLevel;
  otherOccupations: string;
  activityTolerance: string;
  cueingNeeded: string;
  safetyAwareness: string;
  observations: string;
}

export interface ROMFinding {
  status: FindingStatus;
  arom: string;
  prom: string;
  notes: string;
}

export interface ROMAssessment {
  right: Record<string, ROMFinding>;
  left: Record<string, ROMFinding>;
  notes: string;
}

export interface StrengthFinding {
  status: FindingStatus;
  mmt: string;
  notes: string;
}

export interface StrengthAssessment {
  right: Record<string, StrengthFinding>;
  left: Record<string, StrengthFinding>;
  notes: string;
}

export interface ClientFactors {
  cognition: string;
  communication: string;
  vision: string;
  hearing: string;
  sensation: string;
  pain: string;
  coordination: string;
  balance: string;
  endurance: string;
  motorPlanning: string;
  functionalMobility: string;
  standardizedAssessments: string;
  assessmentFindings: string;
}

export interface ClinicalAssessment {
  assessmentSummary: string;
  prognosis: string;
}

export interface GoalsPlanOfCare {
  frequency: string;
  duration: string;
  treatmentInterventions: string[];
  shortTermGoals: string;
  longTermGoals: string;
  dischargePlan: string;
  patientCaregiverEducation: string;
}

export interface SectionGG {
  eating: SectionGGCode;
  oralHygiene: SectionGGCode;
  toiletingHygiene: SectionGGCode;
  showerBathing: SectionGGCode;
  upperBodyDressing: SectionGGCode;
  lowerBodyDressing: SectionGGCode;
  footwear: SectionGGCode;
  rolling: SectionGGCode;
  sitToLying: SectionGGCode;
  lyingToSitting: SectionGGCode;
  sitToStand: SectionGGCode;
  chairBedTransfer: SectionGGCode;
  toiletTransfer: SectionGGCode;
  walking10Feet: SectionGGCode;
  walking50FeetTurn: SectionGGCode;
  stairs: SectionGGCode;
  ggNotes: string;
}

export interface SignatureAttestation {
  studentName: string;
  credentials: string;
  attestation: boolean;
  signatureDate: string;
}

export interface EvaluationFormData {
  patientInfo: PatientInfo;
  occupationalProfile: OccupationalProfile;
  environmentPLOF: EnvironmentPLOF;
  medicalStatus: MedicalStatus;
  adlStatus: ADLStatus;
  rom: ROMAssessment;
  strength: StrengthAssessment;
  clientFactors: ClientFactors;
  clinicalAssessment: ClinicalAssessment;
  goalsPlanOfCare: GoalsPlanOfCare;
  sectionGG: SectionGG;
  signatureAttestation: SignatureAttestation;
}

export interface Evaluation {
  id: string;
  resumeCode: string;
  studentName: string;
  status: EvaluationStatus;
  createdAt: string;
  updatedAt: string;
  formData: EvaluationFormData;
}

const blankROMFinding = (): ROMFinding => ({ status: "Not Assessed", arom: "", prom: "", notes: "" });
const blankStrengthFinding = (): StrengthFinding => ({ status: "Not Assessed", mmt: "", notes: "" });

const ROM_MOVEMENTS = [
  "Shoulder flexion",
  "Shoulder extension",
  "Shoulder abduction",
  "Shoulder external rotation",
  "Shoulder internal rotation",
  "Elbow flexion",
  "Elbow extension",
  "Forearm pronation",
  "Forearm supination",
  "Wrist flexion",
  "Wrist extension",
  "Wrist radial deviation",
  "Wrist ulnar deviation",
] as const;

export const createEmptyFormData = (): EvaluationFormData => {
  const rightROM = Object.fromEntries(ROM_MOVEMENTS.map((m) => [m, blankROMFinding()]));
  const leftROM = Object.fromEntries(ROM_MOVEMENTS.map((m) => [m, blankROMFinding()]));
  const rightStrength = Object.fromEntries(ROM_MOVEMENTS.map((m) => [m, blankStrengthFinding()]));
  const leftStrength = Object.fromEntries(ROM_MOVEMENTS.map((m) => [m, blankStrengthFinding()]));

  return {
    patientInfo: {
      patientName: "",
      medicalRecordNumber: "",
      dateOfBirth: "",
      evaluationDate: new Date().toISOString().slice(0, 10),
      medicalDiagnosis: "",
      reasonForReferral: "",
    },
    occupationalProfile: { summary: "" },
    environmentPLOF: { priorLivingEnvironment: "", equipment: "", plofSummary: "" },
    medicalStatus: {
      precautions: [],
      weightBearing: "",
      painLocation: "",
      painRating: "",
      vitals: "",
      medicationsRelevant: "",
      linesTubesDrains: "",
      skinWounds: "",
      medicalStability: "",
      notes: "",
    },
    adlStatus: {
      eating: "Not Assessed",
      grooming: "Not Assessed",
      bathing: "Not Assessed",
      upperBodyDressing: "Not Assessed",
      lowerBodyDressing: "Not Assessed",
      toileting: "Not Assessed",
      toiletTransfer: "Not Assessed",
      showerTransfer: "Not Assessed",
      bedMobility: "Not Assessed",
      transfers: "Not Assessed",
      functionalMobility: "Not Assessed",
      otherOccupations: "",
      activityTolerance: "",
      cueingNeeded: "",
      safetyAwareness: "",
      observations: "",
    },
    rom: { right: rightROM, left: leftROM, notes: "" },
    strength: { right: rightStrength, left: leftStrength, notes: "" },
    clientFactors: {
      cognition: "",
      communication: "",
      vision: "",
      hearing: "",
      sensation: "",
      pain: "",
      coordination: "",
      balance: "",
      endurance: "",
      motorPlanning: "",
      functionalMobility: "",
      standardizedAssessments: "",
      assessmentFindings: "",
    },
    clinicalAssessment: { assessmentSummary: "", prognosis: "" },
    goalsPlanOfCare: {
      frequency: "",
      duration: "",
      treatmentInterventions: [],
      shortTermGoals: "",
      longTermGoals: "",
      dischargePlan: "",
      patientCaregiverEducation: "",
    },
    sectionGG: {
      eating: "09", oralHygiene: "09", toiletingHygiene: "09", showerBathing: "09",
      upperBodyDressing: "09", lowerBodyDressing: "09", footwear: "09", rolling: "09",
      sitToLying: "09", lyingToSitting: "09", sitToStand: "09", chairBedTransfer: "09",
      toiletTransfer: "09", walking10Feet: "09", walking50FeetTurn: "09", stairs: "09", ggNotes: "",
    },
    signatureAttestation: {
      studentName: "",
      credentials: "",
      attestation: false,
      signatureDate: new Date().toISOString().slice(0, 10),
    },
  };
};

export function normalizeEvaluation(raw: Evaluation): Evaluation {
  const defaults = createEmptyFormData();
  const legacy = raw.formData as Partial<EvaluationFormData> & Record<string, unknown>;
  return {
    ...raw,
    formData: {
      ...defaults,
      ...raw.formData,
      patientInfo: { ...defaults.patientInfo, ...raw.formData?.patientInfo },
      occupationalProfile: {
        ...defaults.occupationalProfile,
        ...(raw.formData?.occupationalProfile as Partial<OccupationalProfile>),
        summary: (raw.formData?.occupationalProfile as Partial<OccupationalProfile>)?.summary
          ?? [
            (raw.formData?.occupationalProfile as any)?.roles,
            (raw.formData?.occupationalProfile as any)?.routines,
            (raw.formData?.occupationalProfile as any)?.interests,
            (raw.formData?.occupationalProfile as any)?.patientGoals,
            (raw.formData?.occupationalProfile as any)?.occupationalConcerns,
          ].filter(Boolean).join("\n"),
      },
      environmentPLOF: { ...defaults.environmentPLOF, ...(raw.formData?.environmentPLOF as Partial<EnvironmentPLOF>) },
      medicalStatus: {
        ...defaults.medicalStatus,
        ...(raw.formData?.medicalStatus as Partial<MedicalStatus>),
        notes: (raw.formData?.medicalStatus as any)?.notes ?? (raw.formData?.medicalStatus as any)?.precautionsNotes ?? "",
      },
      adlStatus: { ...defaults.adlStatus, ...raw.formData?.adlStatus },
      rom: { ...defaults.rom, ...(raw.formData?.rom as Partial<ROMAssessment>) },
      strength: { ...defaults.strength, ...(raw.formData?.strength as Partial<StrengthAssessment>) },
      clientFactors: { ...defaults.clientFactors, ...(raw.formData?.clientFactors as Partial<ClientFactors>) },
      clinicalAssessment: {
        ...defaults.clinicalAssessment,
        ...(raw.formData?.clinicalAssessment as Partial<ClinicalAssessment>),
        assessmentSummary: (raw.formData?.clinicalAssessment as any)?.assessmentSummary
          ?? [
            (raw.formData?.clinicalAssessment as any)?.strengths,
            (raw.formData?.clinicalAssessment as any)?.impairments,
            (raw.formData?.clinicalAssessment as any)?.activityLimitations,
            (raw.formData?.clinicalAssessment as any)?.participationRestrictions,
            (raw.formData?.clinicalAssessment as any)?.occupationalPerformanceProblem,
            (raw.formData?.clinicalAssessment as any)?.clinicalRationale,
            (raw.formData?.clinicalAssessment as any)?.skilledNeed,
          ].filter(Boolean).join("\n"),
      },
      goalsPlanOfCare: { ...defaults.goalsPlanOfCare, ...raw.formData?.goalsPlanOfCare },
      sectionGG: { ...defaults.sectionGG, ...raw.formData?.sectionGG },
      signatureAttestation: { ...defaults.signatureAttestation, ...raw.formData?.signatureAttestation },
    },
  };
}
