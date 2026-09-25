import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Container,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { Evaluation, EvaluationFormData, AssistanceLevel, SectionGGCode } from "./types";
import {
  createEmptyFormData,
  normalizeEvaluation,
} from "./types";
import {
  ensureAnonymousAuth,
  generateResumeCode,
  getLastCode,
  loadEvaluation,
  saveEvaluation,
} from "./storage";

const GG_OPTIONS: { code: SectionGGCode; label: string }[] = [
  { code: "06", label: "06 — Independent" },
  { code: "05", label: "05 — Setup or clean-up assistance" },
  { code: "04", label: "04 — Supervision or touching assistance" },
  { code: "03", label: "03 — Partial/moderate assistance" },
  { code: "02", label: "02 — Substantial/maximal assistance" },
  { code: "01", label: "01 — Dependent" },
  { code: "09", label: "09 — Not applicable / not attempted for educational exercise" },
  { code: "88", label: "88 — Not attempted due to medical/safety concern" },
];

const ASSISTANCE_OPTIONS: AssistanceLevel[] = [
  "Independent",
  "Modified Independent",
  "Supervision",
  "Contact Guard Assist",
  "Minimal Assist",
  "Moderate Assist",
  "Maximal Assist",
  "Dependent",
  "Not Tested",
  "Not Applicable",
];

const PRECAUTIONS = [
  "Fall risk",
  "Hip precautions",
  "Spinal precautions",
  "Aspiration precautions",
  "Contact precautions",
  "Seizure precautions",
  "Skin / wound precautions",
  "Other",
];

const COGNITION = [
  "Intact",
  "Impaired attention",
  "Impaired memory",
  "Impaired executive function",
  "Impaired problem solving",
  "Impaired safety awareness",
  "Disorientation",
  "Delirium / fluctuating status",
];

const PSYCHOSOCIAL = [
  "Anxiety",
  "Depression",
  "Fear of falling",
  "Low motivation",
  "Frustration",
  "Social isolation",
  "Adjustment to illness",
  "Behavioral concerns",
];

const INTERVENTIONS = [
  "ADL retraining",
  "Functional mobility / transfer training",
  "Therapeutic exercise",
  "Therapeutic activity",
  "Balance training",
  "Cognitive / compensatory strategy training",
  "Neuromuscular re-education",
  "Energy conservation",
  "Adaptive equipment training",
  "Caregiver education",
  "Discharge planning",
];

type Screen = "home" | "evaluation";

function SelectField({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <FormControl fullWidth disabled={disabled}>
      <InputLabel>{label}</InputLabel>
      <Select value={value} label={label} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
      </Select>
    </FormControl>
  );
}

function CheckboxGroup({
  label,
  options,
  values,
  disabled,
  onChange,
}: {
  label: string;
  options: string[];
  values: string[];
  disabled: boolean;
  onChange: (values: string[]) => void;
}) {
  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={600}>{label}</Typography>
      <FormGroup row>
        {options.map((option) => (
          <FormControlLabel
            key={option}
            control={
              <Checkbox
                checked={values.includes(option)}
                disabled={disabled}
                onChange={(e) => {
                  onChange(e.target.checked
                    ? [...values, option]
                    : values.filter((item) => item !== option));
                }}
              />
            }
            label={option}
          />
        ))}
      </FormGroup>
    </Box>
  );
}

function EvaluationSection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>{number}. {title}</Typography>
        {children}
      </CardContent>
    </Card>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [studentName, setStudentName] = useState("");
  const [resumeCode, setResumeCode] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const progress = useMemo(() => {
    if (!evaluation) return 0;
    const values: unknown[] = Object.values(evaluation.formData).flatMap((section) =>
      Object.values(section as Record<string, unknown>),
    );
    const completed = values.filter((value) =>
      Array.isArray(value) ? value.length > 0 : value !== "" && value !== false && value !== "09" && value !== "Not Tested",
    ).length;
    return Math.round((completed / values.length) * 100);
  }, [evaluation]);

  useEffect(() => {
    const last = getLastCode();
    if (last) setResumeCode(last);
  }, []);

  async function startEvaluation() {
    const name = studentName.trim();
    if (!name) {
      setMessage("Enter your name before starting.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await ensureAnonymousAuth();
      const now = new Date().toISOString();
      const next: Evaluation = {
        id: crypto.randomUUID(),
        resumeCode: generateResumeCode(),
        studentName: name,
        status: "draft",
        createdAt: now,
        updatedAt: now,
        formData: createEmptyFormData(),
      };
      next.formData.signatureAttestation.studentName = name;
      await saveEvaluation(next);
      setEvaluation(next);
      setResumeCode(next.resumeCode);
      setScreen("evaluation");
    } catch (error) {
      console.error(error);
      setMessage("Could not connect to Firebase. Check your Firebase setup and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resumeEvaluation() {
    const code = resumeCode.trim().toUpperCase();
    if (!code) {
      setMessage("Enter a resume code.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const found = await loadEvaluation(code);
      if (!found) {
        setMessage("No saved evaluation was found for that resume code.");
        return;
      }
      const normalized = normalizeEvaluation(found);
      setEvaluation(normalized);
      setStudentName(normalized.studentName);
      setScreen("evaluation");
    } catch (error) {
      console.error(error);
      setMessage("Could not load that evaluation. Check your Firebase setup and try again.");
    } finally {
      setBusy(false);
    }
  }

  function updateSection<K extends keyof EvaluationFormData>(
    section: K,
    field: keyof EvaluationFormData[K],
    value: EvaluationFormData[K][keyof EvaluationFormData[K]],
  ) {
    if (!evaluation || evaluation.status === "submitted") return;
    const next: Evaluation = {
      ...evaluation,
      updatedAt: new Date().toISOString(),
      formData: {
        ...evaluation.formData,
        [section]: {
          ...evaluation.formData[section],
          [field]: value,
        },
      },
    };
    setEvaluation(next);
    localStorage.setItem("snf-ot-eval:" + next.resumeCode, JSON.stringify(next));
  }

  async function saveDraft() {
    if (!evaluation) return;
    setBusy(true);
    setMessage("");
    const next = { ...evaluation, updatedAt: new Date().toISOString() };
    setEvaluation(next);
    try {
      await saveEvaluation(next);
      setMessage("Draft saved to Firebase.");
    } catch (error) {
      console.error(error);
      setMessage("Draft could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitEvaluation() {
    if (!evaluation) return;
    const required = [
      evaluation.formData.patientInfo.patientName,
      evaluation.formData.patientInfo.reasonForReferral,
      evaluation.formData.occupationalProfile.patientGoals,
      evaluation.formData.clinicalAssessment.occupationalPerformanceProblem,
      evaluation.formData.goalsPlanOfCare.longTermGoals,
    ];
    if (required.some((value) => !value.trim())) {
      setMessage("Before submitting, complete the patient name, referral reason, patient goals, occupational performance problem, and at least one long-term goal.");
      return;
    }

    setBusy(true);
    setMessage("");
    const next: Evaluation = {
      ...evaluation,
      status: "submitted",
      updatedAt: new Date().toISOString(),
    };
    try {
      await saveEvaluation(next);
      setEvaluation(next);
      setMessage("Evaluation submitted. This evaluation is now read-only.");
    } catch (error) {
      console.error(error);
      setMessage("Evaluation could not be submitted. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const disabled = evaluation?.status === "submitted" || busy;

  if (screen === "evaluation" && evaluation) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} gap={2}>
            <Box>
              <Typography variant="h4" fontWeight={700}>SNF OT Initial Evaluation</Typography>
              <Typography color="text.secondary">Student: {evaluation.studentName}</Typography>
            </Box>
            <Chip label={evaluation.status === "submitted" ? "Submitted" : "Draft"} />
          </Stack>

          <Alert severity="info">
            Resume code: <strong>{evaluation.resumeCode}</strong>
          </Alert>

          <Box>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="body2">Evaluation progress</Typography>
              <Typography variant="body2">{progress}%</Typography>
            </Stack>
            <LinearProgress variant="determinate" value={progress} />
          </Box>

          <EvaluationSection number={1} title="Patient / Referral Information">
            <Stack spacing={2}>
              <Typography color="text.secondary">Fictional patient information for educational practice.</Typography>
              <TextField label="Patient name" value={evaluation.formData.patientInfo.patientName}
                onChange={(e) => updateSection("patientInfo", "patientName", e.target.value)} disabled={disabled} />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField fullWidth label="Medical record number" value={evaluation.formData.patientInfo.medicalRecordNumber}
                  onChange={(e) => updateSection("patientInfo", "medicalRecordNumber", e.target.value)} disabled={disabled} />
                <TextField fullWidth label="Date of birth" type="date" slotProps={{ inputLabel: { shrink: true } }}
                  value={evaluation.formData.patientInfo.dateOfBirth} onChange={(e) => updateSection("patientInfo", "dateOfBirth", e.target.value)} disabled={disabled} />
              </Stack>
              <TextField label="Evaluation date" type="date" slotProps={{ inputLabel: { shrink: true } }}
                value={evaluation.formData.patientInfo.evaluationDate} onChange={(e) => updateSection("patientInfo", "evaluationDate", e.target.value)} disabled={disabled} />
              <TextField label="Medical diagnosis" value={evaluation.formData.patientInfo.medicalDiagnosis}
                onChange={(e) => updateSection("patientInfo", "medicalDiagnosis", e.target.value)} disabled={disabled} />
              <TextField label="Reason for OT referral" multiline minRows={3} value={evaluation.formData.patientInfo.reasonForReferral}
                onChange={(e) => updateSection("patientInfo", "reasonForReferral", e.target.value)} disabled={disabled} />
            </Stack>
          </EvaluationSection>

          <EvaluationSection number={2} title="Occupational Profile">
            <Stack spacing={2}>
              <TextField label="Prior setting / living environment" multiline minRows={2} value={evaluation.formData.occupationalProfile.priorSetting}
                onChange={(e) => updateSection("occupationalProfile", "priorSetting", e.target.value)} disabled={disabled} />
              <TextField label="Prior living situation" multiline minRows={2} value={evaluation.formData.occupationalProfile.livingSituation}
                onChange={(e) => updateSection("occupationalProfile", "livingSituation", e.target.value)} disabled={disabled} />
              <TextField label="Important roles" value={evaluation.formData.occupationalProfile.roles}
                onChange={(e) => updateSection("occupationalProfile", "roles", e.target.value)} disabled={disabled} />
              <TextField label="Typical routines" multiline minRows={2} value={evaluation.formData.occupationalProfile.routines}
                onChange={(e) => updateSection("occupationalProfile", "routines", e.target.value)} disabled={disabled} />
              <TextField label="Interests / meaningful occupations" multiline minRows={2} value={evaluation.formData.occupationalProfile.interests}
                onChange={(e) => updateSection("occupationalProfile", "interests", e.target.value)} disabled={disabled} />
              <TextField label="Patient-stated goals" multiline minRows={2} value={evaluation.formData.occupationalProfile.patientGoals}
                onChange={(e) => updateSection("occupationalProfile", "patientGoals", e.target.value)} disabled={disabled} />
              <TextField label="Occupational concerns identified during interview" multiline minRows={3} value={evaluation.formData.occupationalProfile.occupationalConcerns}
                onChange={(e) => updateSection("occupationalProfile", "occupationalConcerns", e.target.value)} disabled={disabled} />
            </Stack>
          </EvaluationSection>

          <EvaluationSection number={3} title="Prior Level of Function (PLOF)">
            <Stack spacing={2}>
              <TextField label="Prior self-care / ADL performance" multiline minRows={2} value={evaluation.formData.plof.priorSelfCare}
                onChange={(e) => updateSection("plof", "priorSelfCare", e.target.value)} disabled={disabled} />
              <TextField label="Prior mobility / transfers" multiline minRows={2} value={evaluation.formData.plof.priorMobility}
                onChange={(e) => updateSection("plof", "priorMobility", e.target.value)} disabled={disabled} />
              <TextField label="Prior IADL performance" multiline minRows={2} value={evaluation.formData.plof.priorIADL}
                onChange={(e) => updateSection("plof", "priorIADL", e.target.value)} disabled={disabled} />
              <TextField label="Prior work / leisure / social participation" multiline minRows={2} value={evaluation.formData.plof.priorWorkLeisure}
                onChange={(e) => updateSection("plof", "priorWorkLeisure", e.target.value)} disabled={disabled} />
              <TextField label="Prior equipment / assistive devices" value={evaluation.formData.plof.priorEquipment}
                onChange={(e) => updateSection("plof", "priorEquipment", e.target.value)} disabled={disabled} />
              <TextField label="Prior level of assistance / caregiver support" multiline minRows={2} value={evaluation.formData.plof.priorAssistance}
                onChange={(e) => updateSection("plof", "priorAssistance", e.target.value)} disabled={disabled} />
              <TextField label="Baseline cognition / safety awareness" multiline minRows={2} value={evaluation.formData.plof.baselineCognition}
                onChange={(e) => updateSection("plof", "baselineCognition", e.target.value)} disabled={disabled} />
            </Stack>
          </EvaluationSection>

          <EvaluationSection number={4} title="Current Medical / Clinical Status">
            <Stack spacing={2}>
              <CheckboxGroup label="Precautions" options={PRECAUTIONS} values={evaluation.formData.medicalStatus.precautions} disabled={!!disabled}
                onChange={(v) => updateSection("medicalStatus", "precautions", v)} />
              <SelectField label="Weight-bearing status" value={evaluation.formData.medicalStatus.weightBearing}
                options={["WBAT", "NWB", "TTWB", "PWB", "No restriction", "Unknown / verify order"]} disabled={!!disabled}
                onChange={(v) => updateSection("medicalStatus", "weightBearing", v)} />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField fullWidth label="Pain location / description" value={evaluation.formData.medicalStatus.painLocation}
                  onChange={(e) => updateSection("medicalStatus", "painLocation", e.target.value)} disabled={disabled} />
                <TextField fullWidth label="Pain rating (0–10)" type="number" value={evaluation.formData.medicalStatus.painRating}
                  onChange={(e) => updateSection("medicalStatus", "painRating", e.target.value)} disabled={disabled} />
              </Stack>
              <TextField label="Relevant vitals / response to activity" multiline minRows={2} value={evaluation.formData.medicalStatus.vitals}
                onChange={(e) => updateSection("medicalStatus", "vitals", e.target.value)} disabled={disabled} />
              <TextField label="Medications relevant to OT performance" multiline minRows={2} value={evaluation.formData.medicalStatus.medicationsRelevant}
                onChange={(e) => updateSection("medicalStatus", "medicationsRelevant", e.target.value)} disabled={disabled} />
              <TextField label="Lines / tubes / drains" value={evaluation.formData.medicalStatus.linesTubesDrains}
                onChange={(e) => updateSection("medicalStatus", "linesTubesDrains", e.target.value)} disabled={disabled} />
              <TextField label="Skin / wounds relevant to OT" multiline minRows={2} value={evaluation.formData.medicalStatus.skinWounds}
                onChange={(e) => updateSection("medicalStatus", "skinWounds", e.target.value)} disabled={disabled} />
              <SelectField label="Medical stability for skilled activity" value={evaluation.formData.medicalStatus.medicalStability}
                options={["Stable", "Stable with monitoring", "Fluctuating — coordinate with team", "Unable to determine / verify"]} disabled={!!disabled}
                onChange={(v) => updateSection("medicalStatus", "medicalStability", v)} />
              <TextField label="Additional precautions / clinical notes" multiline minRows={3} value={evaluation.formData.medicalStatus.precautionsNotes}
                onChange={(e) => updateSection("medicalStatus", "precautionsNotes", e.target.value)} disabled={disabled} />
            </Stack>
          </EvaluationSection>

          <EvaluationSection number={5} title="Examination & Performance Skills">
            <Stack spacing={2}>
              <SelectField label="Arousal / orientation" value={evaluation.formData.examination.arousalOrientation}
                options={["Alert and oriented", "Alert with intermittent confusion", "Drowsy but arousable", "Fluctuating", "Unable to assess"]} disabled={!!disabled}
                onChange={(v) => updateSection("examination", "arousalOrientation", v)} />
              <CheckboxGroup label="Cognitive findings" options={COGNITION} values={evaluation.formData.examination.cognition} disabled={!!disabled}
                onChange={(v) => updateSection("examination", "cognition", v)} />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField fullWidth label="Communication" multiline minRows={2} value={evaluation.formData.examination.communication}
                  onChange={(e) => updateSection("examination", "communication", e.target.value)} disabled={disabled} />
                <TextField fullWidth label="Vision" multiline minRows={2} value={evaluation.formData.examination.vision}
                  onChange={(e) => updateSection("examination", "vision", e.target.value)} disabled={disabled} />
                <TextField fullWidth label="Hearing" multiline minRows={2} value={evaluation.formData.examination.hearing}
                  onChange={(e) => updateSection("examination", "hearing", e.target.value)} disabled={disabled} />
              </Stack>
              <TextField label="Sensation" multiline minRows={2} value={evaluation.formData.examination.sensation}
                onChange={(e) => updateSection("examination", "sensation", e.target.value)} disabled={disabled} />
              <TextField label="Edema" multiline minRows={2} value={evaluation.formData.examination.edema}
                onChange={(e) => updateSection("examination", "edema", e.target.value)} disabled={disabled} />
              <TextField label="ROM / flexibility findings" multiline minRows={3} value={evaluation.formData.examination.ROM}
                onChange={(e) => updateSection("examination", "ROM", e.target.value)} disabled={disabled} />
              <TextField label="Strength / MMT findings" multiline minRows={3} value={evaluation.formData.examination.strength}
                onChange={(e) => updateSection("examination", "strength", e.target.value)} disabled={disabled} />
              <TextField label="Coordination / fine motor findings" multiline minRows={2} value={evaluation.formData.examination.coordination}
                onChange={(e) => updateSection("examination", "coordination", e.target.value)} disabled={disabled} />
              <TextField label="Balance" multiline minRows={2} value={evaluation.formData.examination.balance}
                onChange={(e) => updateSection("examination", "balance", e.target.value)} disabled={disabled} />
              <TextField label="Endurance / activity tolerance" multiline minRows={2} value={evaluation.formData.examination.endurance}
                onChange={(e) => updateSection("examination", "endurance", e.target.value)} disabled={disabled} />
              <TextField label="Motor planning / praxis" multiline minRows={2} value={evaluation.formData.examination.motorPlanning}
                onChange={(e) => updateSection("examination", "motorPlanning", e.target.value)} disabled={disabled} />
              <TextField label="Functional mobility observations" multiline minRows={3} value={evaluation.formData.examination.functionalMobility}
                onChange={(e) => updateSection("examination", "functionalMobility", e.target.value)} disabled={disabled} />
              <TextField label="Standardized assessments administered" multiline minRows={2} value={evaluation.formData.examination.standardizedAssessments}
                onChange={(e) => updateSection("examination", "standardizedAssessments", e.target.value)} disabled={disabled} />
              <TextField label="Assessment findings / interpretation" multiline minRows={3} value={evaluation.formData.examination.assessmentFindings}
                onChange={(e) => updateSection("examination", "assessmentFindings", e.target.value)} disabled={disabled} />
            </Stack>
          </EvaluationSection>

          <EvaluationSection number={6} title="Current Occupational Performance / ADL Status">
            <Stack spacing={2}>
              <Typography color="text.secondary">Rate observed or reasonably assessed assistance level for this educational case.</Typography>
              <Stack spacing={1}>
                {([
                  ["eating", "Eating"],
                  ["grooming", "Grooming"],
                  ["bathing", "Bathing"],
                  ["upperBodyDressing", "Upper-body dressing"],
                  ["lowerBodyDressing", "Lower-body dressing"],
                  ["toileting", "Toileting"],
                  ["toiletTransfer", "Toilet transfer"],
                  ["showerTransfer", "Shower / tub transfer"],
                  ["bedMobility", "Bed mobility"],
                  ["transfers", "Functional transfers"],
                  ["functionalMobility", "Functional mobility"],
                ] as const).map(([field, label]) => (
                  <SelectField key={field} label={label} value={evaluation.formData.adlStatus[field]} options={ASSISTANCE_OPTIONS}
                    disabled={!!disabled} onChange={(v) => updateSection("adlStatus", field, v)} />
                ))}
              </Stack>
              <TextField label="Other occupations / IADLs relevant to case" multiline minRows={2} value={evaluation.formData.adlStatus.otherOccupations}
                onChange={(e) => updateSection("adlStatus", "otherOccupations", e.target.value)} disabled={disabled} />
              <TextField label="Activity tolerance during occupations" multiline minRows={2} value={evaluation.formData.adlStatus.activityTolerance}
                onChange={(e) => updateSection("adlStatus", "activityTolerance", e.target.value)} disabled={disabled} />
              <TextField label="Cueing needed" multiline minRows={2} value={evaluation.formData.adlStatus.cueingNeeded}
                onChange={(e) => updateSection("adlStatus", "cueingNeeded", e.target.value)} disabled={disabled} />
              <TextField label="Safety awareness during tasks" multiline minRows={2} value={evaluation.formData.adlStatus.safetyAwareness}
                onChange={(e) => updateSection("adlStatus", "safetyAwareness", e.target.value)} disabled={disabled} />
              <TextField label="Observed performance notes" multiline minRows={4} value={evaluation.formData.adlStatus.observations}
                onChange={(e) => updateSection("adlStatus", "observations", e.target.value)} disabled={disabled} />
            </Stack>
          </EvaluationSection>

          <EvaluationSection number={7} title="Cognitive / Psychosocial / Environmental Factors">
            <Stack spacing={2}>
              <TextField label="How cognition affects occupational performance" multiline minRows={3} value={evaluation.formData.cognitivePsychosocialEnvironmental.cognitionImpact}
                onChange={(e) => updateSection("cognitivePsychosocialEnvironmental", "cognitionImpact", e.target.value)} disabled={disabled} />
              <CheckboxGroup label="Psychosocial factors" options={PSYCHOSOCIAL} values={evaluation.formData.cognitivePsychosocialEnvironmental.psychosocialFactors} disabled={!!disabled}
                onChange={(v) => updateSection("cognitivePsychosocialEnvironmental", "psychosocialFactors", v)} />
              <TextField label="Mood / affect" value={evaluation.formData.cognitivePsychosocialEnvironmental.moodAffect}
                onChange={(e) => updateSection("cognitivePsychosocialEnvironmental", "moodAffect", e.target.value)} disabled={disabled} />
              <SelectField label="Motivation / engagement" value={evaluation.formData.cognitivePsychosocialEnvironmental.motivation}
                options={["High", "Moderate", "Variable", "Low", "Unable to assess"]} disabled={!!disabled}
                onChange={(v) => updateSection("cognitivePsychosocialEnvironmental", "motivation", v)} />
              <TextField label="Safety awareness" multiline minRows={2} value={evaluation.formData.cognitivePsychosocialEnvironmental.safetyAwareness}
                onChange={(e) => updateSection("cognitivePsychosocialEnvironmental", "safetyAwareness", e.target.value)} disabled={disabled} />
              <TextField label="Environmental barriers" multiline minRows={2} value={evaluation.formData.cognitivePsychosocialEnvironmental.environmentalBarriers}
                onChange={(e) => updateSection("cognitivePsychosocialEnvironmental", "environmentalBarriers", e.target.value)} disabled={disabled} />
              <TextField label="Environmental supports" multiline minRows={2} value={evaluation.formData.cognitivePsychosocialEnvironmental.environmentalSupports}
                onChange={(e) => updateSection("cognitivePsychosocialEnvironmental", "environmentalSupports", e.target.value)} disabled={disabled} />
              <TextField label="Caregiver / social support" multiline minRows={2} value={evaluation.formData.cognitivePsychosocialEnvironmental.caregiverSupport}
                onChange={(e) => updateSection("cognitivePsychosocialEnvironmental", "caregiverSupport", e.target.value)} disabled={disabled} />
              <TextField label="Anticipated discharge setting" value={evaluation.formData.cognitivePsychosocialEnvironmental.dischargeSetting}
                onChange={(e) => updateSection("cognitivePsychosocialEnvironmental", "dischargeSetting", e.target.value)} disabled={disabled} />
              <TextField label="Equipment / DME considerations" multiline minRows={2} value={evaluation.formData.cognitivePsychosocialEnvironmental.equipmentNeeds}
                onChange={(e) => updateSection("cognitivePsychosocialEnvironmental", "equipmentNeeds", e.target.value)} disabled={disabled} />
            </Stack>
          </EvaluationSection>

          <EvaluationSection number={8} title="Clinical Assessment / OT Analysis">
            <Stack spacing={2}>
              <TextField label="Patient strengths" multiline minRows={3} value={evaluation.formData.clinicalAssessment.strengths}
                onChange={(e) => updateSection("clinicalAssessment", "strengths", e.target.value)} disabled={disabled} />
              <TextField label="Performance skills / client factor impairments" multiline minRows={3} value={evaluation.formData.clinicalAssessment.impairments}
                onChange={(e) => updateSection("clinicalAssessment", "impairments", e.target.value)} disabled={disabled} />
              <TextField label="Activity limitations" multiline minRows={3} value={evaluation.formData.clinicalAssessment.activityLimitations}
                onChange={(e) => updateSection("clinicalAssessment", "activityLimitations", e.target.value)} disabled={disabled} />
              <TextField label="Participation restrictions" multiline minRows={3} value={evaluation.formData.clinicalAssessment.participationRestrictions}
                onChange={(e) => updateSection("clinicalAssessment", "participationRestrictions", e.target.value)} disabled={disabled} />
              <TextField label="Primary occupational performance problem" multiline minRows={3} value={evaluation.formData.clinicalAssessment.occupationalPerformanceProblem}
                onChange={(e) => updateSection("clinicalAssessment", "occupationalPerformanceProblem", e.target.value)} disabled={disabled} />
              <TextField label="Clinical reasoning: why OT?" multiline minRows={4} value={evaluation.formData.clinicalAssessment.clinicalRationale}
                onChange={(e) => updateSection("clinicalAssessment", "clinicalRationale", e.target.value)} disabled={disabled} />
              <TextField label="Skilled OT need / medical necessity rationale" multiline minRows={4} value={evaluation.formData.clinicalAssessment.skilledNeed}
                onChange={(e) => updateSection("clinicalAssessment", "skilledNeed", e.target.value)} disabled={disabled} />
              <SelectField label="Rehabilitation prognosis" value={evaluation.formData.clinicalAssessment.prognosis}
                options={["Good", "Fair", "Guarded", "Unable to determine"]} disabled={!!disabled}
                onChange={(v) => updateSection("clinicalAssessment", "prognosis", v)} />
            </Stack>
          </EvaluationSection>

          <EvaluationSection number={9} title="Goals & Plan of Care">
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField fullWidth label="Frequency (e.g., 5x/week)" value={evaluation.formData.goalsPlanOfCare.frequency}
                  onChange={(e) => updateSection("goalsPlanOfCare", "frequency", e.target.value)} disabled={disabled} />
                <TextField fullWidth label="Duration (e.g., 4 weeks)" value={evaluation.formData.goalsPlanOfCare.duration}
                  onChange={(e) => updateSection("goalsPlanOfCare", "duration", e.target.value)} disabled={disabled} />
              </Stack>
              <CheckboxGroup label="Planned skilled interventions" options={INTERVENTIONS} values={evaluation.formData.goalsPlanOfCare.treatmentInterventions} disabled={!!disabled}
                onChange={(v) => updateSection("goalsPlanOfCare", "treatmentInterventions", v)} />
              <TextField label="Short-term goals" multiline minRows={5} placeholder="Write measurable, occupation-based goals." value={evaluation.formData.goalsPlanOfCare.shortTermGoals}
                onChange={(e) => updateSection("goalsPlanOfCare", "shortTermGoals", e.target.value)} disabled={disabled} />
              <TextField label="Long-term goals" multiline minRows={5} placeholder="Write measurable discharge-oriented goals." value={evaluation.formData.goalsPlanOfCare.longTermGoals}
                onChange={(e) => updateSection("goalsPlanOfCare", "longTermGoals", e.target.value)} disabled={disabled} />
              <TextField label="Discharge plan / anticipated disposition" multiline minRows={3} value={evaluation.formData.goalsPlanOfCare.dischargePlan}
                onChange={(e) => updateSection("goalsPlanOfCare", "dischargePlan", e.target.value)} disabled={disabled} />
              <TextField label="Patient / caregiver education" multiline minRows={3} value={evaluation.formData.goalsPlanOfCare.patientCaregiverEducation}
                onChange={(e) => updateSection("goalsPlanOfCare", "patientCaregiverEducation", e.target.value)} disabled={disabled} />
            </Stack>
          </EvaluationSection>

          <EvaluationSection number={10} title="SNF Section GG-Style Functional Coding Reference">
            <Stack spacing={2}>
              <Alert severity="warning">
                Educational reference only — this is not an official MDS or billing form. Select the code that best represents the fictional case for practice.
              </Alert>
              <Typography color="text.secondary">
                Common activity-performance scale: 06 independent; 05 setup/cleanup; 04 supervision/touching; 03 partial/moderate; 02 substantial/maximal; 01 dependent. 09 and 88 are included for practice when an activity is not applicable/not attempted.
              </Typography>
              <Stack spacing={1}>
                {([
                  ["eating", "Eating"],
                  ["oralHygiene", "Oral hygiene"],
                  ["toiletingHygiene", "Toileting hygiene"],
                  ["showerBathing", "Shower / bathing"],
                  ["upperBodyDressing", "Upper-body dressing"],
                  ["lowerBodyDressing", "Lower-body dressing"],
                  ["footwear", "Putting on / taking off footwear"],
                  ["rolling", "Rolling"],
                  ["sitToLying", "Sit to lying"],
                  ["lyingToSitting", "Lying to sitting"],
                  ["sitToStand", "Sit to stand"],
                  ["chairBedTransfer", "Chair / bed transfer"],
                  ["toiletTransfer", "Toilet transfer"],
                  ["walking10Feet", "Walking 10 feet"],
                  ["walking50FeetTurn", "Walking 50 feet with turns"],
                  ["stairs", "Stairs"],
                ] as const).map(([field, label]) => (
                  <SelectField key={field} label={label} value={evaluation.formData.sectionGG[field]} options={GG_OPTIONS.map((o) => o.label)}
                    disabled={!!disabled} onChange={(v) => {
                      const option = GG_OPTIONS.find((o) => o.label === v);
                      updateSection("sectionGG", field, option?.code ?? "09");
                    }} />
                ))}
              </Stack>
              <TextField label="Section GG reasoning / notes" multiline minRows={4} value={evaluation.formData.sectionGG.ggNotes}
                onChange={(e) => updateSection("sectionGG", "ggNotes", e.target.value)} disabled={disabled} />
            </Stack>
          </EvaluationSection>

          <EvaluationSection number={11} title="Signature / Attestation">
            <Stack spacing={2}>
              <TextField label="Student name" value={evaluation.formData.signatureAttestation.studentName}
                onChange={(e) => updateSection("signatureAttestation", "studentName", e.target.value)} disabled={disabled} />
              <TextField label="Credentials / role" placeholder="OT student" value={evaluation.formData.signatureAttestation.credentials}
                onChange={(e) => updateSection("signatureAttestation", "credentials", e.target.value)} disabled={disabled} />
              <TextField label="Date" type="date" slotProps={{ inputLabel: { shrink: true } }} value={evaluation.formData.signatureAttestation.signatureDate}
                onChange={(e) => updateSection("signatureAttestation", "signatureDate", e.target.value)} disabled={disabled} />
              <FormControlLabel
                control={<Checkbox checked={evaluation.formData.signatureAttestation.attestation} disabled={!!disabled}
                  onChange={(e) => updateSection("signatureAttestation", "attestation", e.target.checked)} />}
                label="I attest that this is my educational evaluation work based on the fictional case presented."
              />
            </Stack>
          </EvaluationSection>

          {message && <Alert severity={message.includes("saved") || message.includes("submitted") ? "success" : "error"}>{message}</Alert>}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="flex-end">
            <Button variant="outlined" onClick={saveDraft} disabled={!!disabled}>Save Draft</Button>
            <Button variant="contained" onClick={submitEvaluation} disabled={!!disabled}>Submit Evaluation</Button>
          </Stack>
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Stack spacing={4}>
        <Box>
          <Typography variant="h3" fontWeight={800}>SNF OT Evaluation</Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mt: 1 }}>
            Student teaching tool for skilled nursing facility initial evaluations.
          </Typography>
        </Box>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h5">Start a new evaluation</Typography>
              <TextField label="Student name" value={studentName} onChange={(e) => setStudentName(e.target.value)} />
              <Button variant="contained" size="large" onClick={startEvaluation} disabled={busy}>Start Evaluation</Button>
            </Stack>
          </CardContent>
        </Card>

        <Divider>OR</Divider>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h5">Resume an evaluation</Typography>
              <TextField label="Resume code" placeholder="SNF-8K4X-27QP" value={resumeCode} onChange={(e) => setResumeCode(e.target.value.toUpperCase())} />
              <Button variant="outlined" size="large" onClick={resumeEvaluation} disabled={busy}>Resume Evaluation</Button>
            </Stack>
          </CardContent>
        </Card>

        <Alert severity="info">
          Evaluations are stored in Firebase. Resume codes can be used to continue a draft.
        </Alert>

        {message && <Alert severity="error">{message}</Alert>}
      </Stack>
    </Container>
  );
}
