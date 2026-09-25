export type EvaluationStatus = "draft" | "submitted";

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
  roles: string;
  routines: string;
  interests: string;
  patientGoals: string;
  occupationalConcerns: string;
}

export interface EvaluationFormData {
  patientInfo: PatientInfo;
  occupationalProfile: OccupationalProfile;
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