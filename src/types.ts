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
  | "Not Tested"
  | "Not Applicable";

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
  priorSetting: string;
  livingSituation: string;
  roles: string;
  routines: string;
  interests: string;
  patientGoals: string;
  occupationalConcerns: string;
}

export interface PLOF {
  priorSelfCare: string;
  priorMobility: string;
  priorIADL: string;
  priorWorkLeisure: string;
  priorEquipment: string;
  priorAssistance: string;
  baselineCognition: string;
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
  precautionsNotes: string;
}

export interface Examination {
  arousalOrientation: string;
  cognition: string[];
  communication: string;
  vision: string;
  hearing: string;
  sensation: string;
  edema: string;
  ROM: string;
  strength: string;
  coordination: string;
  balance: string;
  endurance: string;
  motorPlanning: string;
  functionalMobility: string;
  standardizedAssessments: string;
  assessmentFindings: string;
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

export interface CognitivePsychosocialEnvironmental {
  cognitionImpact: string;
  psychosocialFactors: string[];
  moodAffect: string;
  motivation: string;
  safetyAwareness: string;
  environmentalBarriers: string;
  environmentalSupports: string;
  caregiverSupport: string;
  dischargeSetting: string;
  equipmentNeeds: string;
}

export interface ClinicalAssessment {
  strengths: string;
  impairments: string;
  activityLimitations: string;
  participationRestrictions: string;
  occupationalPerformanceProblem: string;
  clinicalRationale: string;
  skilledNeed: string;
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
  plof: PLOF;
  medicalStatus: MedicalStatus;
  examination: Examination;
  adlStatus: ADLStatus;
  cognitivePsychosocialEnvironmental: CognitivePsychosocialEnvironmental;
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

export const createEmptyFormData = (): EvaluationFormData => ({
  patientInfo: {
    patientName: "",
    medicalRecordNumber: "",
    dateOfBirth: "",
    evaluationDate: new Date().toISOString().slice(0, 10),
    medicalDiagnosis: "",
    reasonForReferral: "",
  },
  occupationalProfile: {
    priorSetting: "",
    livingSituation: "",
    roles: "",
    routines: "",
    interests: "",
    patientGoals: "",
    occupationalConcerns: "",
  },
  plof: {
    priorSelfCare: "",
    priorMobility: "",
    priorIADL: "",
    priorWorkLeisure: "",
    priorEquipment: "",
    priorAssistance: "",
    baselineCognition: "",
  },
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
    precautionsNotes: "",
  },
  examination: {
    arousalOrientation: "",
    cognition: [],
    communication: "",
    vision: "",
    hearing: "",
    sensation: "",
    edema: "",
    ROM: "",
    strength: "",
    coordination: "",
    balance: "",
    endurance: "",
    motorPlanning: "",
    functionalMobility: "",
    standardizedAssessments: "",
    assessmentFindings: "",
  },
  adlStatus: {
    eating: "Not Tested",
    grooming: "Not Tested",
    bathing: "Not Tested",
    upperBodyDressing: "Not Tested",
    lowerBodyDressing: "Not Tested",
    toileting: "Not Tested",
    toiletTransfer: "Not Tested",
    showerTransfer: "Not Tested",
    bedMobility: "Not Tested",
    transfers: "Not Tested",
    functionalMobility: "Not Tested",
    otherOccupations: "",
    activityTolerance: "",
    cueingNeeded: "",
    safetyAwareness: "",
    observations: "",
  },
  cognitivePsychosocialEnvironmental: {
    cognitionImpact: "",
    psychosocialFactors: [],
    moodAffect: "",
    motivation: "",
    safetyAwareness: "",
    environmentalBarriers: "",
    environmentalSupports: "",
    caregiverSupport: "",
    dischargeSetting: "",
    equipmentNeeds: "",
  },
  clinicalAssessment: {
    strengths: "",
    impairments: "",
    activityLimitations: "",
    participationRestrictions: "",
    occupationalPerformanceProblem: "",
    clinicalRationale: "",
    skilledNeed: "",
    prognosis: "",
  },
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
    eating: "09",
    oralHygiene: "09",
    toiletingHygiene: "09",
    showerBathing: "09",
    upperBodyDressing: "09",
    lowerBodyDressing: "09",
    footwear: "09",
    rolling: "09",
    sitToLying: "09",
    lyingToSitting: "09",
    sitToStand: "09",
    chairBedTransfer: "09",
    toiletTransfer: "09",
    walking10Feet: "09",
    walking50FeetTurn: "09",
    stairs: "09",
    ggNotes: "",
  },
  signatureAttestation: {
    studentName: "",
    credentials: "",
    attestation: false,
    signatureDate: new Date().toISOString().slice(0, 10),
  },
});

export function normalizeEvaluation(raw: Evaluation): Evaluation {
  const defaults = createEmptyFormData();
  return {
    ...raw,
    formData: {
      ...defaults,
      ...raw.formData,
      patientInfo: { ...defaults.patientInfo, ...raw.formData?.patientInfo },
      occupationalProfile: { ...defaults.occupationalProfile, ...raw.formData?.occupationalProfile },
      plof: { ...defaults.plof, ...raw.formData?.plof },
      medicalStatus: { ...defaults.medicalStatus, ...raw.formData?.medicalStatus },
      examination: { ...defaults.examination, ...raw.formData?.examination },
      adlStatus: { ...defaults.adlStatus, ...raw.formData?.adlStatus },
      cognitivePsychosocialEnvironmental: {
        ...defaults.cognitivePsychosocialEnvironmental,
        ...raw.formData?.cognitivePsychosocialEnvironmental,
      },
      clinicalAssessment: { ...defaults.clinicalAssessment, ...raw.formData?.clinicalAssessment },
      goalsPlanOfCare: { ...defaults.goalsPlanOfCare, ...raw.formData?.goalsPlanOfCare },
      sectionGG: { ...defaults.sectionGG, ...raw.formData?.sectionGG },
      signatureAttestation: { ...defaults.signatureAttestation, ...raw.formData?.signatureAttestation },
    },
  };
}
