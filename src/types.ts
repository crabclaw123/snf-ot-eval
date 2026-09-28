export type EvaluationStatus = "draft" | "submitted";

export type AssistanceLevel =
  | ""
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

export type FindingStatus = "" | "WNL" | "WFL" | "Impaired" | "Not Assessed";
export type SectionGGCode = "" | "06" | "05" | "04" | "03" | "02" | "01" | "09" | "88";

export interface PatientInfo { patientName: string; medicalRecordNumber: string; dateOfBirth: string; evaluationDate: string; medicalDiagnosis: string; reasonForReferral: string; }
export interface OccupationalProfile { summary: string; }
export interface EnvironmentPLOF { priorLivingEnvironment: string; equipment: string; plofSummary: string; }
export interface MedicalStatus { precautions: string[]; weightBearing: string; painLocation: string; painRating: string; vitals: string; medicationsRelevant: string; linesTubesDrains: string; skinWounds: string; medicalStability: string; notes: string; }

export interface ADLStatus {
  plof: Record<string, AssistanceLevel>;
  current: Record<string, AssistanceLevel>;
  otherOccupations: string;
  activityTolerance: string;
  cueingNeeded: string;
  safetyAwareness: string;
  observations: string;
}
export interface ROMFinding { status: FindingStatus; arom: string; prom: string; notes: string; }
export interface ROMAssessment { right: Record<string, ROMFinding>; left: Record<string, ROMFinding>; notes: string; }
export interface StrengthFinding { status: FindingStatus; mmt: string; notes: string; }
export interface StrengthAssessment { right: Record<string, StrengthFinding>; left: Record<string, StrengthFinding>; notes: string; }
export interface ClientFactors { orientedPerson: boolean; orientedPlace: boolean; orientedTime: boolean; orientedSituation: boolean; cognition: string; communication: string; vision: string; hearing: string; sensation: string; pain: string; coordination: string; balance: string; endurance: string; motorPlanning: string; functionalMobility: string; standardizedAssessments: string; assessmentFindings: string; }
export interface ClinicalAssessment { assessmentSummary: string; prognosis: string; }
export type GoalType = "Short-term" | "Long-term";
export interface OTGoal {
  id: string;
  type: GoalType;
  occupation: string;
  plof: AssistanceLevel;
  current: AssistanceLevel;
  target: AssistanceLevel;
  performanceProblem: string;
  condition: string;
  measurableCriterion: string;
  timeframe: string;
  goalStatement: string;
}
export interface GoalsPlanOfCare {
  frequency: string;
  duration: string;
  treatmentInterventions: string[];
  shortTermGoals: string;
  longTermGoals: string;
  overallGoal: string;
  goals: OTGoal[];
  dischargePlan: string;
  patientCaregiverEducation: string;
}
export interface SectionGG { eating: SectionGGCode; oralHygiene: SectionGGCode; toiletingHygiene: SectionGGCode; showerBathing: SectionGGCode; upperBodyDressing: SectionGGCode; lowerBodyDressing: SectionGGCode; footwear: SectionGGCode; rolling: SectionGGCode; sitToLying: SectionGGCode; lyingToSitting: SectionGGCode; sitToStand: SectionGGCode; chairBedTransfer: SectionGGCode; toiletTransfer: SectionGGCode; walking10Feet: SectionGGCode; walking50FeetTurn: SectionGGCode; stairs: SectionGGCode; ggNotes: string; }
export interface SignatureAttestation { studentName: string; credentials: string; attestation: boolean; signatureDate: string; }

export interface EvaluationFormData {
  patientInfo: PatientInfo; occupationalProfile: OccupationalProfile; environmentPLOF: EnvironmentPLOF; medicalStatus: MedicalStatus;
  adlStatus: ADLStatus; rom: ROMAssessment; strength: StrengthAssessment; clientFactors: ClientFactors;
  clinicalAssessment: ClinicalAssessment; goalsPlanOfCare: GoalsPlanOfCare; sectionGG: SectionGG; signatureAttestation: SignatureAttestation;
}
export interface Evaluation { id: string; resumeCode: string; studentName: string; status: EvaluationStatus; createdAt: string; updatedAt: string; formData: EvaluationFormData; }

const blankROMFinding = (): ROMFinding => ({ status: "", arom: "", prom: "", notes: "" });
const blankStrengthFinding = (): StrengthFinding => ({ status: "", mmt: "", notes: "" });
export const MOVEMENTS = ["Shoulder flexion","Shoulder extension","Shoulder abduction","Shoulder external rotation","Shoulder internal rotation","Elbow flexion","Elbow extension","Forearm pronation","Forearm supination","Wrist flexion","Wrist extension","Wrist radial deviation","Wrist ulnar deviation"];

export const createEmptyFormData = (): EvaluationFormData => {
  const makeROM = () => Object.fromEntries(MOVEMENTS.map(m => [m, blankROMFinding()]));
  const makeStrength = () => Object.fromEntries(MOVEMENTS.map(m => [m, blankStrengthFinding()]));
  const makeADLs = (): Record<string, AssistanceLevel> => Object.fromEntries(["eating","grooming","bathing","upperBodyDressing","lowerBodyDressing","toileting","toiletTransfer","showerTransfer","bedMobility","transfers","functionalMobility"].map(m => [m, ""]));
  return {
    patientInfo:{patientName:"",medicalRecordNumber:"MRN-100001",dateOfBirth:"",evaluationDate:new Date().toISOString().slice(0,10),medicalDiagnosis:"",reasonForReferral:""},
    occupationalProfile:{summary:""}, environmentPLOF:{priorLivingEnvironment:"",equipment:"",plofSummary:""},
    medicalStatus:{precautions:[],weightBearing:"",painLocation:"",painRating:"",vitals:"",medicationsRelevant:"",linesTubesDrains:"",skinWounds:"",medicalStability:"",notes:""},
    adlStatus:{plof:makeADLs(),current:makeADLs(),otherOccupations:"",activityTolerance:"",cueingNeeded:"",safetyAwareness:"",observations:""},
    rom:{right:makeROM(),left:makeROM(),notes:""}, strength:{right:makeStrength(),left:makeStrength(),notes:""},
    clientFactors:{orientedPerson:false,orientedPlace:false,orientedTime:false,orientedSituation:false,cognition:"",communication:"",vision:"",hearing:"",sensation:"",pain:"",coordination:"",balance:"",endurance:"",motorPlanning:"",functionalMobility:"",standardizedAssessments:"",assessmentFindings:""},
    clinicalAssessment:{assessmentSummary:"",prognosis:""},
    goalsPlanOfCare:{frequency:"",duration:"",treatmentInterventions:[],shortTermGoals:"",longTermGoals:"",overallGoal:"",goals:[],dischargePlan:"",patientCaregiverEducation:""},
    sectionGG:{eating:"",oralHygiene:"",toiletingHygiene:"",showerBathing:"",upperBodyDressing:"",lowerBodyDressing:"",footwear:"",rolling:"",sitToLying:"",lyingToSitting:"",sitToStand:"",chairBedTransfer:"",toiletTransfer:"",walking10Feet:"",walking50FeetTurn:"",stairs:"",ggNotes:""},
    signatureAttestation:{studentName:"",credentials:"",attestation:false,signatureDate:new Date().toISOString().slice(0,10)}
  };
};

export function normalizeEvaluation(raw: Evaluation): Evaluation {
  const defaults = createEmptyFormData();
  const old = raw.formData as any;
  const oldADL = old?.adlStatus ?? {};
  const oldPLOF: Record<string, AssistanceLevel> = Object.fromEntries(Object.keys(defaults.adlStatus.plof).map(k => [k, (oldADL[k] ?? "") as AssistanceLevel]));
  const currentADL: Record<string, AssistanceLevel> = Object.fromEntries(Object.keys(defaults.adlStatus.current).map(k => [k, (oldADL?.current?.[k] ?? "") as AssistanceLevel]));
  return {
    ...raw,
    formData:{
      ...defaults, ...raw.formData,
      patientInfo:{...defaults.patientInfo,...old?.patientInfo},
      occupationalProfile:{...defaults.occupationalProfile,summary:old?.occupationalProfile?.summary ?? [old?.occupationalProfile?.roles,old?.occupationalProfile?.routines,old?.occupationalProfile?.interests,old?.occupationalProfile?.patientGoals,old?.occupationalProfile?.occupationalConcerns].filter(Boolean).join("\n")},
      environmentPLOF:{...defaults.environmentPLOF,...old?.environmentPLOF},
      medicalStatus:{...defaults.medicalStatus,...old?.medicalStatus,notes:old?.medicalStatus?.notes ?? old?.medicalStatus?.precautionsNotes ?? ""},
      adlStatus:{...defaults.adlStatus,plof:{...oldPLOF,...oldADL?.plof},current:{...currentADL,...oldADL?.current},otherOccupations:oldADL.otherOccupations??"",activityTolerance:oldADL.activityTolerance??"",cueingNeeded:oldADL.cueingNeeded??"",safetyAwareness:oldADL.safetyAwareness??"",observations:oldADL.observations??""},
      rom:{...defaults.rom,...old?.rom}, strength:{...defaults.strength,...old?.strength}, clientFactors:{...defaults.clientFactors,...old?.clientFactors},
      clinicalAssessment:{...defaults.clinicalAssessment,assessmentSummary:old?.clinicalAssessment?.assessmentSummary ?? [old?.clinicalAssessment?.strengths,old?.clinicalAssessment?.impairments,old?.clinicalAssessment?.activityLimitations,old?.clinicalAssessment?.participationRestrictions,old?.clinicalAssessment?.occupationalPerformanceProblem,old?.clinicalAssessment?.clinicalRationale,old?.clinicalAssessment?.skilledNeed].filter(Boolean).join("\n"),prognosis:old?.clinicalAssessment?.prognosis??""},
      goalsPlanOfCare:{...defaults.goalsPlanOfCare,...old?.goalsPlanOfCare,overallGoal:old?.goalsPlanOfCare?.overallGoal??"",goals:Array.isArray(old?.goalsPlanOfCare?.goals)?old.goalsPlanOfCare.goals:[]}, sectionGG:{...defaults.sectionGG,...old?.sectionGG}, signatureAttestation:{...defaults.signatureAttestation,...old?.signatureAttestation}
    }
  };
}
