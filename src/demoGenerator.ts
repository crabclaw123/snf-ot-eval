import type { AssistanceLevel, Evaluation, OTGoal, SectionGGCode } from "./types";
import { createEmptyFormData, MOVEMENTS } from "./types";
import { generateResumeCode } from "./storage";

const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];
const today = () => new Date().toISOString().slice(0, 10);
const addWeeks = (weeks: number) => {
  const d = new Date(`${today()}T12:00:00`);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
};

const names = ["Evelyn Brooks", "Harold Greene", "Martha Reed", "Walter Price", "Dorothy Lane", "Samuel Carter", "Joan Miller", "Franklin Boyd"];

function functionalGoal(occupation: string, current: AssistanceLevel, target: string, problem: string, weeks: number): OTGoal {
  return {
    id: crypto.randomUUID(),
    type: weeks <= 3 ? "Short-term" : "Long-term",
    occupation,
    plof: "Independent",
    current,
    target,
    performanceProblem: problem,
    condition: "with appropriate safety awareness",
    measurableCriterion: "with consistent carryover across 2 consecutive sessions",
    timeframe: `${weeks} weeks`,
    targetDate: addWeeks(weeks),
    goalStatement: `Patient will improve ${occupation.toLowerCase()} from ${current || "current documented level"} to ${target.toLowerCase()} with appropriate safety awareness in order to ${problem}, with consistent carryover across 2 consecutive sessions within ${weeks} weeks (target date: ${addWeeks(weeks)}).`,
    sourceType: "Functional",
  };
}

function romGoal(side: "right" | "left", movement: string, baseline: string, target: string, occupation: string, weeks: number): OTGoal {
  const sideLabel = side === "right" ? "right" : "left";
  return {
    id: crypto.randomUUID(), type: weeks <= 3 ? "Short-term" : "Long-term", occupation,
    plof: "Independent", current: "Minimal Assist", target,
    performanceProblem: `improve ${sideLabel} upper-extremity reach required for ${occupation.toLowerCase()}`,
    condition: "without increased pain", measurableCriterion: "as measured by goniometry", timeframe: `${weeks} weeks`, targetDate: addWeeks(weeks),
    goalStatement: `Patient will increase ${sideLabel} ${movement.toLowerCase()} AROM from ${baseline}° to ${target} without increased pain in order to improve ${sideLabel} upper-extremity reach required for ${occupation.toLowerCase()}, as measured by goniometry within ${weeks} weeks (target date: ${addWeeks(weeks)}).`,
    sourceType: "ROM", sourceSide: side, sourceMovement: movement, sourceMetric: "AROM", sourceBaseline: baseline,
  };
}

function strengthGoal(side: "right" | "left", movement: string, baseline: string, target: string, occupation: string, weeks: number): OTGoal {
  const sideLabel = side === "right" ? "right" : "left";
  return {
    id: crypto.randomUUID(), type: weeks <= 3 ? "Short-term" : "Long-term", occupation,
    plof: "Independent", current: "Minimal Assist", target,
    performanceProblem: `improve ${sideLabel} upper-extremity strength required for ${occupation.toLowerCase()}`,
    condition: "without compensatory movement", measurableCriterion: "as measured by manual muscle testing", timeframe: `${weeks} weeks`, targetDate: addWeeks(weeks),
    goalStatement: `Patient will improve ${sideLabel} ${movement.toLowerCase()} MMT from ${baseline}/5 to ${target} without compensatory movement in order to improve ${sideLabel} upper-extremity strength required for ${occupation.toLowerCase()}, as measured by manual muscle testing within ${weeks} weeks (target date: ${addWeeks(weeks)}).`,
    sourceType: "Strength", sourceSide: side, sourceMovement: movement, sourceMetric: "MMT", sourceBaseline: baseline,
  };
}

type Scenario = {
  label: string;
  apply: (e: Evaluation) => void;
};

const scenarios: Scenario[] = [
  {
    label: "General debility after hospitalization",
    apply: e => {
      const f = e.formData;
      f.patientInfo.medicalDiagnosis = "Generalized weakness / debility following acute hospitalization";
      f.patientInfo.reasonForReferral = "OT evaluation for decline in ADL independence, endurance, and transfer safety following hospitalization.";
      f.occupationalProfile.summary = "Prior to hospitalization, patient lived at home and completed basic self-care independently. Patient values returning home and resuming morning self-care and household routines.";
      f.environmentPLOF.priorLivingEnvironment = "Single-level home with 2 steps to enter. Bathroom has tub/shower combination. Daughter lives nearby and assists with transportation and heavier household tasks.";
      f.environmentPLOF.equipment = "Rolling walker, shower chair";
      f.medicalStatus.weightBearing = "WBAT";
      f.medicalStatus.medicalStability = "Medically stable for skilled therapy participation";
      f.medicalStatus.medicationsRelevant = "Antihypertensive and pain medication as ordered";
      f.medicalStatus.notes = "Fall risk; monitor fatigue and orthostatic symptoms.";
      Object.assign(f.adlStatus.plof, { eating:"Independent", grooming:"Independent", bathing:"Independent", upperBodyDressing:"Independent", lowerBodyDressing:"Independent", toileting:"Independent", toiletTransfer:"Independent", showerTransfer:"Independent", bedMobility:"Independent", transfers:"Independent", functionalMobility:"Independent" });
      Object.assign(f.adlStatus.current, { eating:"Independent", grooming:"Supervision", bathing:"Moderate Assist", upperBodyDressing:"Supervision", lowerBodyDressing:"Moderate Assist", toileting:"Minimal Assist", toiletTransfer:"Contact Guard Assist", showerTransfer:"Moderate Assist", bedMobility:"Supervision", transfers:"Contact Guard Assist", functionalMobility:"Contact Guard Assist" });
      f.adlStatus.activityTolerance = "Tolerates 8–10 minutes of standing activity before seated rest break.";
      f.adlStatus.cueingNeeded = "Intermittent cues for pacing and hand placement.";
      f.adlStatus.safetyAwareness = "Mildly reduced with fatigue.";
      f.adlStatus.observations = "Requires increased time for self-care and demonstrates reduced endurance during standing ADLs.";
      f.clientFactors.orientedPerson = f.clientFactors.orientedPlace = f.clientFactors.orientedTime = f.clientFactors.orientedSituation = true;
      f.clientFactors.cognition = "Alert / appropriate"; f.clientFactors.communication = "Functional verbal communication";
      f.clientFactors.balance = "Moderately impaired"; f.clientFactors.endurance = "Moderately limited"; f.clientFactors.functionalMobility = "Requires physical assistance";
      f.strength.right["Shoulder flexion"] = { status:"Impaired", mmt:"3+", notes:"Generalized weakness" };
      f.strength.left["Shoulder flexion"] = { status:"Impaired", mmt:"3+", notes:"Generalized weakness" };
      f.goalsPlanOfCare.goals = [functionalGoal("lowerBodyDressing", "Moderate Assist", "Supervision", "improve independence with dressing", 4), functionalGoal("toileting", "Minimal Assist", "Supervision", "improve independence with toileting", 3), strengthGoal("right", "Shoulder flexion", "3+", "4-/5", "upperBodyDressing", 4)];
    }
  },
  {
    label: "Left CVA with right hemiparesis",
    apply: e => {
      const f=e.formData;
      f.patientInfo.medicalDiagnosis="Left CVA with right hemiparesis";
      f.patientInfo.reasonForReferral="OT evaluation for decline in self-care, right UE use, transfers, and safety following CVA.";
      f.occupationalProfile.summary="Patient previously lived with spouse, completed ADLs independently, and enjoyed cooking and gardening. Primary goal is to use the right arm more effectively during dressing and grooming.";
      f.environmentPLOF.priorLivingEnvironment="Two-story home; bedroom and full bathroom upstairs. Spouse available for intermittent assistance.";
      f.environmentPLOF.equipment="Rolling walker, grab bars";
      f.medicalStatus.weightBearing="WBAT"; f.medicalStatus.medicalStability="Medically stable"; f.medicalStatus.notes="Fall risk; right-sided weakness.";
      Object.assign(f.adlStatus.plof,{ eating:"Independent",grooming:"Independent",bathing:"Independent",upperBodyDressing:"Independent",lowerBodyDressing:"Independent",toileting:"Independent",toiletTransfer:"Independent",showerTransfer:"Independent",bedMobility:"Independent",transfers:"Independent",functionalMobility:"Independent" });
      Object.assign(f.adlStatus.current,{ eating:"Supervision",grooming:"Minimal Assist",bathing:"Moderate Assist",upperBodyDressing:"Moderate Assist",lowerBodyDressing:"Maximal Assist",toileting:"Moderate Assist",toiletTransfer:"Minimal Assist",showerTransfer:"Moderate Assist",bedMobility:"Contact Guard Assist",transfers:"Minimal Assist",functionalMobility:"Minimal Assist" });
      f.rom.right["Shoulder flexion"]={status:"Impaired",arom:"75",prom:"120",notes:"Limited active elevation with weakness"};
      f.strength.right["Shoulder flexion"]={status:"Impaired",mmt:"2+",notes:"Hemiparetic weakness"};
      f.strength.right["Elbow flexion"]={status:"Impaired",mmt:"3-",notes:"Hemiparetic weakness"};
      f.clientFactors.orientedPerson=f.clientFactors.orientedPlace=f.clientFactors.orientedSituation=true; f.clientFactors.orientedTime=false;
      f.clientFactors.cognition="Requires intermittent cues"; f.clientFactors.communication="Functional verbal communication"; f.clientFactors.coordination="Moderately impaired"; f.clientFactors.balance="Moderately impaired"; f.clientFactors.functionalMobility="Requires physical assistance";
      f.goalsPlanOfCare.goals=[romGoal("right","Shoulder flexion","75","95°","upperBodyDressing",4),strengthGoal("right","Shoulder flexion","2+","3+/5","grooming",4),functionalGoal("toileting","Moderate Assist","Contact Guard Assist","improve independence with toileting",3)];
    }
  },
  {
    label: "Right hip fracture status post ORIF",
    apply: e => {
      const f=e.formData;
      f.patientInfo.medicalDiagnosis="Right hip fracture status post ORIF";
      f.patientInfo.reasonForReferral="OT evaluation for decline in LB ADLs, toileting, transfers, and discharge safety after hip fracture repair.";
      f.occupationalProfile.summary="Patient lived alone and was independent with ADLs and light meal preparation prior to fall. Wants to return home and manage toileting and dressing without hands-on help.";
      f.environmentPLOF.priorLivingEnvironment="Single-level apartment with elevator access. Tub/shower with one grab bar. Son can check in daily.";
      f.environmentPLOF.equipment="Rolling walker, raised toilet seat";
      f.medicalStatus.weightBearing="WBAT"; f.medicalStatus.medicalStability="Stable post-operative course"; f.medicalStatus.notes="Fall risk; follow orthopedic precautions per surgeon.";
      Object.assign(f.adlStatus.plof,{ eating:"Independent",grooming:"Independent",bathing:"Independent",upperBodyDressing:"Independent",lowerBodyDressing:"Independent",toileting:"Independent",toiletTransfer:"Independent",showerTransfer:"Independent",bedMobility:"Independent",transfers:"Independent",functionalMobility:"Independent" });
      Object.assign(f.adlStatus.current,{ eating:"Independent",grooming:"Supervision",bathing:"Moderate Assist",upperBodyDressing:"Independent",lowerBodyDressing:"Maximal Assist",toileting:"Minimal Assist",toiletTransfer:"Contact Guard Assist",showerTransfer:"Moderate Assist",bedMobility:"Minimal Assist",transfers:"Contact Guard Assist",functionalMobility:"Contact Guard Assist" });
      f.clientFactors.orientedPerson=f.clientFactors.orientedPlace=f.clientFactors.orientedTime=f.clientFactors.orientedSituation=true;
      f.clientFactors.cognition="Alert / appropriate"; f.clientFactors.balance="Mildly impaired"; f.clientFactors.endurance="Mildly limited"; f.clientFactors.functionalMobility="Requires physical assistance";
      f.goalsPlanOfCare.goals=[functionalGoal("lowerBodyDressing","Maximal Assist","Minimal Assist","improve independence with dressing",4),functionalGoal("toiletTransfer","Contact Guard Assist","Supervision","increase safety during functional mobility",3),functionalGoal("toileting","Minimal Assist","Supervision","improve independence with toileting",3)];
    }
  },
  {
    label: "Dementia with functional decline",
    apply: e => {
      const f=e.formData;
      f.patientInfo.medicalDiagnosis="Major neurocognitive disorder with recent functional decline";
      f.patientInfo.reasonForReferral="OT evaluation for increased cueing and assistance needs with self-care and mobility.";
      f.occupationalProfile.summary="Patient resides with daughter, who reports increased cueing needs for dressing, grooming, and safe bathroom routines. Patient enjoys music and familiar household routines.";
      f.environmentPLOF.priorLivingEnvironment="Lives with daughter in single-level home. Family provides daily supervision and medication management.";
      f.environmentPLOF.equipment="Grab bars, shower chair";
      f.medicalStatus.weightBearing="No restriction"; f.medicalStatus.medicalStability="Medically stable"; f.medicalStatus.notes="High fall risk related to cognition and poor safety awareness.";
      Object.assign(f.adlStatus.plof,{ eating:"Independent",grooming:"Supervision",bathing:"Supervision",upperBodyDressing:"Supervision",lowerBodyDressing:"Supervision",toileting:"Supervision",toiletTransfer:"Supervision",showerTransfer:"Supervision",bedMobility:"Independent",transfers:"Supervision",functionalMobility:"Supervision" });
      Object.assign(f.adlStatus.current,{ eating:"Supervision",grooming:"Minimal Assist",bathing:"Moderate Assist",upperBodyDressing:"Minimal Assist",lowerBodyDressing:"Moderate Assist",toileting:"Minimal Assist",toiletTransfer:"Contact Guard Assist",showerTransfer:"Moderate Assist",bedMobility:"Supervision",transfers:"Contact Guard Assist",functionalMobility:"Contact Guard Assist" });
      f.clientFactors.orientedPerson=true; f.clientFactors.orientedPlace=false; f.clientFactors.orientedTime=false; f.clientFactors.orientedSituation=false;
      f.clientFactors.cognition="Requires frequent cues"; f.clientFactors.communication="Limited by cognition"; f.clientFactors.balance="Mildly impaired"; f.clientFactors.motorPlanning="Mildly impaired"; f.clientFactors.functionalMobility="Requires supervision / cues";
      f.adlStatus.cueingNeeded="Frequent verbal and visual cues for sequencing and safety."; f.adlStatus.safetyAwareness="Poor; attempts transfers before setup is complete.";
      f.goalsPlanOfCare.goals=[functionalGoal("grooming","Minimal Assist","Supervision","reduce caregiver burden during daily routines",3),functionalGoal("toileting","Minimal Assist","Supervision","improve independence with toileting",4),functionalGoal("toiletTransfer","Contact Guard Assist","Supervision","increase safety during functional mobility",3)];
    }
  },
  {
    label: "Right shoulder orthopedic impairment",
    apply: e => {
      const f=e.formData;
      f.patientInfo.medicalDiagnosis="Right proximal humerus fracture, healing";
      f.patientInfo.reasonForReferral="OT evaluation for impaired right shoulder ROM/strength limiting grooming, bathing, and dressing.";
      f.occupationalProfile.summary="Patient was independent at home prior to injury and wants to resume dressing, hair care, and meal preparation without relying on spouse.";
      f.environmentPLOF.priorLivingEnvironment="Single-level home with spouse. Walk-in shower with grab bar."; f.environmentPLOF.equipment="Shower chair";
      f.medicalStatus.weightBearing="Unknown / verify order"; f.medicalStatus.medicalStability="Medically stable"; f.medicalStatus.notes="Right UE orthopedic precautions per current orders.";
      Object.assign(f.adlStatus.plof,{ eating:"Independent",grooming:"Independent",bathing:"Independent",upperBodyDressing:"Independent",lowerBodyDressing:"Independent",toileting:"Independent",toiletTransfer:"Independent",showerTransfer:"Independent",bedMobility:"Independent",transfers:"Independent",functionalMobility:"Independent" });
      Object.assign(f.adlStatus.current,{ eating:"Independent",grooming:"Minimal Assist",bathing:"Minimal Assist",upperBodyDressing:"Moderate Assist",lowerBodyDressing:"Independent",toileting:"Independent",toiletTransfer:"Independent",showerTransfer:"Supervision",bedMobility:"Independent",transfers:"Independent",functionalMobility:"Independent" });
      f.rom.right["Shoulder flexion"]={status:"Impaired",arom:"80",prom:"125",notes:"Pain-limited active motion"};
      f.rom.right["Shoulder abduction"]={status:"Impaired",arom:"70",prom:"115",notes:"Pain-limited active motion"};
      f.strength.right["Shoulder flexion"]={status:"Impaired",mmt:"3-",notes:"Limited by pain and healing fracture"};
      f.clientFactors.orientedPerson=f.clientFactors.orientedPlace=f.clientFactors.orientedTime=f.clientFactors.orientedSituation=true; f.clientFactors.cognition="Alert / appropriate"; f.clientFactors.balance="Functional / independent";
      f.goalsPlanOfCare.goals=[romGoal("right","Shoulder flexion","80","100°","upperBodyDressing",4),strengthGoal("right","Shoulder flexion","3-","4-/5","grooming",6),functionalGoal("upperBodyDressing","Moderate Assist","Supervision","improve independence with dressing",4)];
    }
  }
];

function fillUnspecifiedROMAndStrength(evaluation: Evaluation) {
  for (const side of ["right", "left"] as const) {
    for (const movement of MOVEMENTS) {
      const rom = evaluation.formData.rom[side][movement];
      if (!rom.status) evaluation.formData.rom[side][movement] = { ...rom, status: "WFL" };

      const strength = evaluation.formData.strength[side][movement];
      if (!strength.status) evaluation.formData.strength[side][movement] = { ...strength, status: "WFL" };
    }
  }
  if (!evaluation.formData.rom.notes) evaluation.formData.rom.notes = "All upper-extremity ROM not otherwise noted as impaired is within functional limits for observed tasks.";
  if (!evaluation.formData.strength.notes) evaluation.formData.strength.notes = "All upper-extremity strength not otherwise noted as impaired is within functional limits for observed tasks.";
}

export function generateDemoEvaluation(studentName = "Demo Tester"): { evaluation: Evaluation; scenario: string } {
  const formData = createEmptyFormData();
  const now = new Date().toISOString();
  const code = generateResumeCode().replace("SNF-", "DEMO-");
  const evaluation: Evaluation = {
    id: crypto.randomUUID(), resumeCode: code, studentName, status: "draft", createdAt: now, updatedAt: now, formData,
  };
  formData.patientInfo.patientName = pick(names);
  formData.patientInfo.medicalRecordNumber = `MRN-${Math.floor(100000 + Math.random() * 900000)}`;
  formData.patientInfo.dateOfBirth = `${pick([1938,1941,1945,1948,1950,1953])}-${String(Math.floor(1+Math.random()*12)).padStart(2,"0")}-${String(Math.floor(1+Math.random()*27)).padStart(2,"0")}`;
  formData.patientInfo.evaluationDate = today();
  formData.medicalStatus.painRating = String(Math.floor(Math.random()*6));
  formData.medicalStatus.painInterferesOccupationalParticipation = formData.medicalStatus.painRating === "0" ? "No" : pick(["Yes","No"]);
  if (formData.medicalStatus.painInterferesOccupationalParticipation === "Yes") {
    formData.medicalStatus.painTiming = pick(["With activity","At rest and with activity"]);
    formData.medicalStatus.painLocation = pick(["Right shoulder","Right hip","Low back","Generalized soreness"]);
    formData.medicalStatus.painDescription = pick(["Aching","Sore","Sharp with movement","Intermittent discomfort"]);
  }
  formData.medicalStatus.vitals = "Vitals stable during evaluation";
  formData.goalsPlanOfCare.frequency = pick(["5x/week","4–5x/week","3–5x/week"]);
  formData.goalsPlanOfCare.duration = pick(["4 weeks","6 weeks","4–6 weeks"]);
  formData.goalsPlanOfCare.treatmentInterventions = ["ADL retraining","Functional mobility / transfer training","Therapeutic activity","Therapeutic exercise","Patient / caregiver education"].slice(0, Math.floor(3+Math.random()*3));
  formData.goalsPlanOfCare.patientCaregiverEducation = "Education regarding safety, compensatory strategies, and recommended equipment as indicated.";
  formData.goalsPlanOfCare.dischargePlan = "Anticipate discharge to prior living environment with support level based on progress.";
  const scenario = pick(scenarios);
  scenario.apply(evaluation);
  fillUnspecifiedROMAndStrength(evaluation);
  formData.goalsPlanOfCare.shortTermGoals = formData.goalsPlanOfCare.goals.filter(g=>g.type==="Short-term").map(g=>g.goalStatement).join("\n");
  formData.goalsPlanOfCare.longTermGoals = formData.goalsPlanOfCare.goals.filter(g=>g.type==="Long-term").map(g=>g.goalStatement).join("\n");
  formData.clinicalAssessment.assessmentSummary = `Demo scenario: ${scenario.label}. Patient demonstrates decline in occupational performance requiring skilled OT to address documented functional limitations and support safe discharge planning.`;
  formData.clinicalAssessment.prognosis = pick(["Good","Fair"]);
  formData.sectionGG.eating = "05" as SectionGGCode;
  formData.sectionGG.toiletingHygiene = "03" as SectionGGCode;
  formData.sectionGG.upperBodyDressing = "03" as SectionGGCode;
  formData.sectionGG.lowerBodyDressing = "02" as SectionGGCode;
  formData.sectionGG.toiletTransfer = "03" as SectionGGCode;
  formData.sectionGG.walking10Feet = "03" as SectionGGCode;
  formData.signatureAttestation.studentName = studentName;
  formData.signatureAttestation.credentials = "OT Student";
  return { evaluation, scenario: scenario.label };
}
