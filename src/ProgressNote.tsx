import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { AssistanceLevel, Evaluation, FindingStatus, OTGoal } from "./types";
import { MOVEMENTS } from "./types";
import type { GoalPlan, GoalProgressStatus, ProgressGoal, ProgressNote } from "./progressTypes";
import { createProgressNote } from "./progressTypes";
import { generateResumeCode, loadEvaluation, loadProgressNote, saveProgressNote } from "./storage";

const ADLS: [string, string][] = [
  ["eating", "Eating"],
  ["grooming", "Grooming"],
  ["bathing", "Bathing"],
  ["upperBodyDressing", "Upper-body dressing"],
  ["lowerBodyDressing", "Lower-body dressing"],
  ["toileting", "Toileting"],
  ["toiletTransfer", "Toilet transfer"],
  ["showerTransfer", "Shower transfer"],
  ["bedMobility", "Bed mobility"],
  ["transfers", "Transfers"],
  ["functionalMobility", "Functional mobility"],
];

const LEVELS: string[] = [
  "Independent",
  "Modified Independent",
  "Supervision",
  "Contact Guard Assist",
  "Minimal Assist",
  "Moderate Assist",
  "Maximal Assist",
  "Dependent",
  "Not Assessed",
  "Not Applicable",
  "Non-ambulatory",
];

const FUNCTIONAL_TARGET_LEVELS: AssistanceLevel[] = [
  "Dependent",
  "Maximal Assist",
  "Moderate Assist",
  "Minimal Assist",
  "Contact Guard Assist",
  "Supervision",
  "Modified Independent",
  "Independent",
];

const FINDING_OPTIONS: FindingStatus[] = ["WNL", "WFL", "Impaired", "Not Assessed"];
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

const CLIENT_FIELDS: [keyof ProgressNote["currentClientFactors"], string][] = [
  ["cognition", "Cognition / command following"],
  ["communication", "Communication"],
  ["vision", "Vision"],
  ["hearing", "Hearing"],
  ["sensation", "Sensation"],
  ["coordination", "Coordination"],
  ["balance", "Balance"],
  ["endurance", "Endurance / activity tolerance"],
  ["motorPlanning", "Motor planning / praxis"],
  ["functionalMobility", "Functional mobility"],
  ["standardizedAssessments", "Standardized assessments"],
  ["assessmentFindings", "Assessment findings"],
];

const PAGES = [
  ["period", "Progress Period / Medical Update"],
  ["function", "Functional Progress"],
  ["cognition", "Cognition / Sensory"],
  ["rom", "ROM"],
  ["strength", "Strength"],
  ["goals", "Goal Progress"],
  ["intervention", "Skilled OT / Response"],
  ["assessment", "Assessment & Plan"],
] as const;

type PageId = typeof PAGES[number][0];
type PeriodConfirmKey = "reportingPeriodStart" | "reportingPeriodEnd" | "visitsSinceEvaluation" | "medicalUpdates" | "fallsHospitalizations" | "precautionsChanges";

type ProgressGoalDraft = {
  occupation: string;
  condition: string;
  target: string;
  targetDate: string;
  goalStatement: string;
  statementCustomized: boolean;
};

function Field({ label, value, onChange, multiline = false, type }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; type?: string }) {
  return (
    <TextField
      fullWidth
      label={label}
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      multiline={multiline}
      minRows={multiline ? 3 : undefined}
      InputLabelProps={type === "date" ? { shrink: true } : undefined}
    />
  );
}

function ConfirmButton({ confirmed, onConfirm }: { confirmed: boolean; onConfirm: () => void }) {
  return (
    <Button variant={confirmed ? "contained" : "outlined"} color={confirmed ? "success" : "primary"} onClick={onConfirm}>
      {confirmed ? "Confirmed" : "Confirm current status"}
    </Button>
  );
}

function orientationText(factors: ProgressNote["currentClientFactors"]) {
  const selected = [
    factors.orientedPerson && "Person",
    factors.orientedPlace && "Place",
    factors.orientedTime && "Time",
    factors.orientedSituation && "Situation",
  ].filter(Boolean);
  return selected.length ? selected.join(", ") : "Not oriented domains documented";
}

function goalSourceLabel(goal: OTGoal) {
  if (!goal.sourceType || goal.sourceType === "Functional") return "";
  const side = goal.sourceSide === "right" ? "Right" : goal.sourceSide === "left" ? "Left" : "";
  const metric = goal.sourceMetric || (goal.sourceType === "Strength" ? "MMT" : "AROM");
  const baselineUnit = goal.sourceType === "ROM" && goal.sourceBaseline && !goal.sourceBaseline.includes("°")
    ? "°"
    : goal.sourceType === "Strength" && goal.sourceBaseline && !goal.sourceBaseline.includes("/5")
      ? "/5"
      : "";
  return `${side} ${goal.sourceMovement || "finding"} ${metric}: ${goal.sourceBaseline || "not documented"}${baselineUnit}`.trim();
}

function isFunctionalGoal(goal: OTGoal) {
  return !goal.sourceType || goal.sourceType === "Functional";
}

function suggestedNextTarget(goal: OTGoal): string {
  if (isFunctionalGoal(goal)) {
    const targetIndex = FUNCTIONAL_TARGET_LEVELS.indexOf(goal.target as AssistanceLevel);
    if (targetIndex >= 0) return FUNCTIONAL_TARGET_LEVELS[Math.min(targetIndex + 1, FUNCTIONAL_TARGET_LEVELS.length - 1)];
    const currentIndex = FUNCTIONAL_TARGET_LEVELS.indexOf(goal.current);
    if (currentIndex >= 0) return FUNCTIONAL_TARGET_LEVELS[Math.min(currentIndex + 1, FUNCTIONAL_TARGET_LEVELS.length - 1)];
    return goal.target || "";
  }

  if (goal.sourceType === "ROM") {
    const numericTarget = Number.parseFloat(goal.target || "");
    return Number.isFinite(numericTarget) ? `${numericTarget + 10}°` : goal.target || "";
  }

  const mmtSteps = ["1/5", "1+/5", "2-/5", "2/5", "2+/5", "3-/5", "3/5", "3+/5", "4-/5", "4/5", "4+/5", "5/5"];
  const normalized = goal.target.includes("/5") ? goal.target : `${goal.target}/5`;
  const index = mmtSteps.indexOf(normalized);
  return index >= 0 ? mmtSteps[Math.min(index + 1, mmtSteps.length - 1)] : goal.target || "";
}

function buildProgressedGoalStatement(goal: OTGoal, draft: Pick<ProgressGoalDraft, "occupation" | "condition" | "target" | "targetDate">) {
  const occupation = draft.occupation.trim() || goal.occupation || "target occupation";
  const condition = draft.condition.trim() ? ` ${draft.condition.trim()}` : "";
  const target = draft.target.trim() || "target performance";
  const targetDate = draft.targetDate || "target date";

  if (goal.sourceType === "ROM") {
    const metric = goal.sourceMetric || "AROM";
    return `Patient will demonstrate ${metric} of ${target} to support ${occupation}${condition} by ${targetDate}.`;
  }

  if (goal.sourceType === "Strength") {
    return `Patient will demonstrate strength of ${target} to support ${occupation}${condition} by ${targetDate}.`;
  }

  return `Patient will complete ${occupation} with ${target}${condition} by ${targetDate}.`;
}

function goalDisplayLabel(goals: ProgressGoal[], index: number) {
  const goal = goals[index];
  const rootId = goal.rootGoalId || goal.goalId;
  const roots = goals.filter(item => !item.parentGoalId);
  const rootIndex = roots.findIndex(item => item.goalId === rootId);
  const baseNumber = rootIndex >= 0 ? rootIndex + 1 : index + 1;
  const depth = goal.lineageDepth ?? (goal.parentGoalId ? 1 : 0);
  const suffix = depth > 0 ? String.fromCharCode(64 + Math.min(depth, 26)) : "";
  return `${goal.originalGoal.type} Goal ${baseNumber}${suffix}`;
}

function exportProgressNotePdf(note: ProgressNote, evaluation: Evaluation) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const usableWidth = pageWidth - margin * 2;
  let y = 48;

  const safe = (value: unknown) => String(value ?? "")
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
  const ensureSpace = (height: number) => {
    if (y + height > pageHeight - margin) {
      doc.addPage();
      y = 48;
    }
  };
  const addText = (text: string, size = 10, bold = false, indent = 0) => {
    const clean = safe(text).trim();
    if (!clean) return;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(clean, usableWidth - indent);
    const lineHeight = size + 4;
    ensureSpace(lines.length * lineHeight + 4);
    doc.text(lines, margin + indent, y);
    y += lines.length * lineHeight + 4;
  };
  const addSection = (title: string) => {
    ensureSpace(34);
    y += 8;
    doc.setDrawColor(210, 210, 210);
    doc.line(margin, y, pageWidth - margin, y);
    y += 18;
    addText(title, 13, true);
  };
  const addField = (label: string, value: unknown) => {
    const text = safe(value).trim();
    if (!text) return;
    addText(label, 9, true);
    addText(text, 10, false, 8);
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("OT Progress Note", margin, y);
  y += 22;
  addText(`${evaluation.formData.patientInfo.patientName || "Patient"}    Case code: ${note.sourceEvaluationCode}`, 10, true);
  addText(`Reporting period: ${note.reportingPeriodStart || "Not documented"} to ${note.reportingPeriodEnd || "Not documented"}`, 9);
  addText(`Initial evaluation: ${evaluation.formData.patientInfo.evaluationDate || "Not documented"}`, 9);
  addText(`Generated: ${new Date().toLocaleString()}`, 9);

  addSection("1. Progress Period / Medical Update");
  addField("Reporting period start", `${note.reportingPeriodStart || "Not documented"} | Confirmed: ${note.periodConfirmed?.reportingPeriodStart ? "Yes" : "No"}`);
  addField("Reporting period end", `${note.reportingPeriodEnd || "Not documented"} | Confirmed: ${note.periodConfirmed?.reportingPeriodEnd ? "Yes" : "No"}`);
  addField("Visits since evaluation / last progress note", `${note.visitsSinceEvaluation || "Not documented"} | Confirmed: ${note.periodConfirmed?.visitsSinceEvaluation ? "Yes" : "No"}`);
  addField("Current medical status / relevant events", `${note.medicalUpdates || "Not documented"} | Confirmed: ${note.periodConfirmed?.medicalUpdates ? "Yes" : "No"}`);
  addField("Pain update", note.pain);
  addField("Falls / hospitalizations / acute events", `${note.fallsHospitalizations || "Not documented"} | Confirmed: ${note.periodConfirmed?.fallsHospitalizations ? "Yes" : "No"}`);
  addField("Current precautions / weight-bearing status", `${note.precautionsChanges || "Not documented"} | Confirmed: ${note.periodConfirmed?.precautionsChanges ? "Yes" : "No"}`);

  addSection("2. Functional Progress");
  for (const [key, label] of ADLS) {
    const baseline = evaluation.formData.adlStatus.current[key] || "Not documented";
    const current = note.currentADL[key] || "Not documented";
    addField(label, `Initial eval: ${baseline} -> Current: ${current} | Confirmed: ${note.functionalADLConfirmed?.[key] ? "Yes" : "No"}`);
  }
  addField("Functional progress / observations", note.functionalNotes);

  addSection("3. Cognition / Communication / Sensory");
  addField("Orientation", `${orientationText(note.currentClientFactors)} | Confirmed: ${note.cognitionConfirmed?.orientation ? "Yes" : "No"}`);
  for (const [key, label] of CLIENT_FIELDS) {
    addField(label, `${String(note.currentClientFactors[key] ?? "") || "Not documented"} | Confirmed: ${note.cognitionConfirmed?.[String(key)] ? "Yes" : "No"}`);
  }

  addSection("4. Range of Motion");
  for (const movement of MOVEMENTS) {
    for (const side of ["right", "left"] as const) {
      const finding = note.currentROM[side][movement];
      addField(
        `${side === "right" ? "Right" : "Left"} ${movement}`,
        `${finding.status || "Not documented"}${finding.arom ? ` | AROM: ${finding.arom} deg` : ""}${finding.prom ? ` | PROM: ${finding.prom} deg` : ""}${finding.notes ? ` | ${finding.notes}` : ""} | Confirmed: ${note.romConfirmed?.[`${side}:${movement}`] ? "Yes" : "No"}`,
      );
    }
  }
  addField("ROM summary / notes", note.currentROM.notes);

  addSection("5. Strength");
  for (const movement of MOVEMENTS) {
    for (const side of ["right", "left"] as const) {
      const finding = note.currentStrength[side][movement];
      addField(
        `${side === "right" ? "Right" : "Left"} ${movement}`,
        `${finding.status || "Not documented"}${finding.mmt ? ` | MMT: ${finding.mmt}` : ""}${finding.notes ? ` | ${finding.notes}` : ""} | Confirmed: ${note.strengthConfirmed?.[`${side}:${movement}`] ? "Yes" : "No"}`,
      );
    }
  }
  addField("Strength summary / notes", note.currentStrength.notes);

  addSection("6. Goal Progress");
  if (!note.goals.length) addText("No structured goals were carried forward.", 10);
  note.goals.forEach((goal, index) => {
    addText(goalDisplayLabel(note.goals, index), 10, true);
    addText(goal.originalGoal.goalStatement || "Goal statement not documented", 10, false, 8);
    const source = goalSourceLabel(goal.originalGoal);
    if (source) addField("Source finding", source);
    addField("Functional baseline / target", `${goal.originalGoal.current || "Not documented"} -> ${goal.originalGoal.target || "Not documented"}`);
    addField("Target date", goal.originalGoal.targetDate || "Not documented");
    addField("Current performance", goal.currentPerformance);
    addField("Status", goal.status);
    addField("Goal plan", goal.plan);
    addField("Lifecycle", goal.goalState || (goal.status === "Met" ? "completed" : "active"));
    if (goal.parentGoalId) addField("Progressed from goal ID", goal.parentGoalId);
    if (goal.progressedToGoalId) addField("Progressed to goal ID", goal.progressedToGoalId);
    if (goal.modifiedGoal) addField("Progressed / updated goal", goal.modifiedGoal);
    addField("Goal progress notes", goal.notes);
  });

  addSection("7. Skilled OT / Response");
  addField("Interventions addressed", note.skilledInterventions.join(", "));
  addField("Patient response / skilled clinical observations", note.responseToIntervention);
  addField("Barriers affecting progress", note.barriers);
  addField("Facilitators / supports", note.facilitators);

  addSection("8. Assessment & Plan");
  addField("Clinical assessment / progress summary", note.assessment);
  addField("Why continued skilled OT is required", note.continuedSkilledNeed);
  addField("Plan decision", note.planDecision);
  addField("Frequency", note.frequency);
  addField("Duration", note.duration);
  addField("Caregiver training / equipment / DME needs", note.caregiverEquipmentNeeds);
  doc.save(`OT-Progress-Note-${note.sourceEvaluationCode}.pdf`);
}

export default function ProgressNoteScreen({ onExit, mode = "new" }: { onExit: () => void; mode?: "new" | "resume" }) {
  const [evalCode, setEvalCode] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [note, setNote] = useState<ProgressNote | null>(null);
  const [page, setPage] = useState<PageId>("period");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [goalWorkflowIndex, setGoalWorkflowIndex] = useState<number | null>(null);
  const [goalWorkflowStep, setGoalWorkflowStep] = useState<"decision" | "progress">("decision");
  const [progressDraft, setProgressDraft] = useState<ProgressGoalDraft | null>(null);

  async function loadSource() {
    setBusy(true);
    setMessage("");
    try {
      const found = await loadEvaluation(evalCode);
      if (!found) {
        setMessage("No saved initial evaluation was found for that case code.");
        return;
      }
      const next = createProgressNote(found, generateResumeCode().replace("SNF-", "PN-"));
      setEvaluation(found);
      setNote(next);
      setPage("period");
    } catch (error) {
      console.error(error);
      setMessage("Could not load the initial evaluation.");
    } finally {
      setBusy(false);
    }
  }

  async function resumeNote() {
    setBusy(true);
    setMessage("");
    try {
      const saved = await loadProgressNote(evalCode);
      if (!saved) {
        setMessage("No saved progress note was found for that case code.");
        return;
      }
      const source = await loadEvaluation(saved.sourceEvaluationCode);
      if (!source) {
        setMessage("The source evaluation for this progress note could not be loaded.");
        return;
      }
      setEvaluation(source);
      setNote(saved);
      setPage("period");
    } catch (error) {
      console.error(error);
      setMessage("Could not load the progress note.");
    } finally {
      setBusy(false);
    }
  }

  function patch<K extends keyof ProgressNote>(key: K, value: ProgressNote[K]) {
    setNote(current => current ? { ...current, [key]: value, updatedAt: new Date().toISOString() } : current);
  }

  function patchGoal(index: number, changes: Partial<ProgressNote["goals"][number]>) {
    if (!note) return;
    const goals = note.goals.map((goal, goalIndex) => goalIndex === index ? { ...goal, ...changes } : goal);
    patch("goals", goals);
  }

  function patchPeriodField(key: PeriodConfirmKey, value: string) {
    if (!note) return;
    patch(key, value as never);
    patch("periodConfirmed", { ...(note.periodConfirmed || {}), [key]: false });
  }

  function confirmPeriod(key: PeriodConfirmKey) {
    if (!note) return;
    patch("periodConfirmed", { ...(note.periodConfirmed || {}), [key]: true });
  }

  function confirmFunctional(key: string) {
    patch("functionalADLConfirmed", { ...note!.functionalADLConfirmed, [key]: true });
  }

  function updateClientFactor(key: keyof ProgressNote["currentClientFactors"], value: string | boolean) {
    patch("currentClientFactors", { ...note!.currentClientFactors, [key]: value });
    patch("cognitionConfirmed", { ...note!.cognitionConfirmed, [String(key)]: false });
  }

  function updateROM(side: "right" | "left", movement: string, field: "status" | "arom" | "prom" | "notes", value: string) {
    const current = note!.currentROM;
    patch("currentROM", {
      ...current,
      [side]: {
        ...current[side],
        [movement]: { ...current[side][movement], [field]: value },
      },
    });
    patch("romConfirmed", { ...note!.romConfirmed, [`${side}:${movement}`]: false });
  }

  function updateStrength(side: "right" | "left", movement: string, field: "status" | "mmt" | "notes", value: string) {
    const current = note!.currentStrength;
    patch("currentStrength", {
      ...current,
      [side]: {
        ...current[side],
        [movement]: { ...current[side][movement], [field]: value },
      },
    });
    patch("strengthConfirmed", { ...note!.strengthConfirmed, [`${side}:${movement}`]: false });
  }

  function beginMetGoalWorkflow(index: number) {
    if (!note) return;
    const goal = note.goals[index];
    const target = suggestedNextTarget(goal.originalGoal);
    const draft: ProgressGoalDraft = {
      occupation: goal.originalGoal.occupation,
      condition: goal.originalGoal.condition,
      target,
      targetDate: "",
      goalStatement: "",
      statementCustomized: false,
    };
    draft.goalStatement = buildProgressedGoalStatement(goal.originalGoal, draft);

    patchGoal(index, {
      status: "Met",
      goalState: "completed",
      completedAt: goal.completedAt || new Date().toISOString(),
    });
    setGoalWorkflowIndex(index);
    setGoalWorkflowStep("decision");
    setProgressDraft(draft);
  }

  function handleGoalStatusChange(index: number, status: GoalProgressStatus) {
    const goal = note!.goals[index];
    if (status === "Met") {
      beginMetGoalWorkflow(index);
      return;
    }

    patchGoal(index, {
      status,
      goalState: "active",
      completedAt: undefined,
      plan: goal.plan === "Upgrade" ? "Continue" : goal.plan,
    });
  }

  function updateProgressDraft(changes: Partial<ProgressGoalDraft>) {
    if (goalWorkflowIndex === null || !note) return;
    const parent = note.goals[goalWorkflowIndex];
    setProgressDraft(current => {
      if (!current) return current;
      const next = { ...current, ...changes };
      if (!next.statementCustomized && changes.goalStatement === undefined) {
        next.goalStatement = buildProgressedGoalStatement(parent.originalGoal, next);
      }
      return next;
    });
  }

  function finishGoalWorkflow() {
    setGoalWorkflowIndex(null);
    setGoalWorkflowStep("decision");
    setProgressDraft(null);
  }

  function closeMetGoal() {
    if (goalWorkflowIndex === null || !note) return;
    const goal = note.goals[goalWorkflowIndex];
    patchGoal(goalWorkflowIndex, {
      status: "Met",
      plan: "Discontinue",
      goalState: "completed",
      completedAt: goal.completedAt || new Date().toISOString(),
    });
    finishGoalWorkflow();
  }

  function createProgressedGoal() {
    if (goalWorkflowIndex === null || !note || !progressDraft) return;
    const parent = note.goals[goalWorkflowIndex];
    const childId = crypto.randomUUID();
    const functional = isFunctionalGoal(parent.originalGoal);
    const achievedFunctionalTarget = FUNCTIONAL_TARGET_LEVELS.includes(parent.originalGoal.target as AssistanceLevel)
      ? parent.originalGoal.target as AssistanceLevel
      : parent.originalGoal.current;

    const childOriginalGoal: OTGoal = {
      ...parent.originalGoal,
      id: childId,
      occupation: progressDraft.occupation,
      condition: progressDraft.condition,
      current: functional ? achievedFunctionalTarget : parent.originalGoal.current,
      target: progressDraft.target,
      timeframe: progressDraft.targetDate ? `By ${progressDraft.targetDate}` : parent.originalGoal.timeframe,
      targetDate: progressDraft.targetDate,
      goalStatement: progressDraft.goalStatement,
      sourceBaseline: !functional
        ? (parent.currentPerformance || parent.originalGoal.target || parent.originalGoal.sourceBaseline)
        : parent.originalGoal.sourceBaseline,
    };

    const childGoal: ProgressGoal = {
      goalId: childId,
      rootGoalId: parent.rootGoalId || parent.goalId,
      parentGoalId: parent.goalId,
      lineageDepth: (parent.lineageDepth ?? 0) + 1,
      goalState: "active",
      createdFromProgressNoteCode: note.resumeCode,
      originalGoal: childOriginalGoal,
      currentPerformance: parent.currentPerformance || parent.originalGoal.target || "",
      status: "",
      plan: "Continue",
      modifiedGoal: "",
      notes: "",
    };

    const goals = note.goals.map((goal, index) => index === goalWorkflowIndex
      ? {
          ...goal,
          status: "Met" as GoalProgressStatus,
          plan: "Upgrade" as GoalPlan,
          goalState: "completed" as const,
          completedAt: goal.completedAt || new Date().toISOString(),
          progressedToGoalId: childId,
          modifiedGoal: progressDraft.goalStatement,
        }
      : goal,
    );

    patch("goals", [...goals, childGoal]);
    finishGoalWorkflow();
  }

  const improved = useMemo(() => {
    if (!note || !evaluation) return {} as Record<string, string>;
    const rank = ["Dependent", "Maximal Assist", "Moderate Assist", "Minimal Assist", "Contact Guard Assist", "Supervision", "Modified Independent", "Independent"];
    return Object.fromEntries(ADLS.map(([key]) => {
      const baseline = evaluation.formData.adlStatus.current[key];
      const current = note.currentADL[key];
      const baselineIndex = rank.indexOf(baseline);
      const currentIndex = rank.indexOf(current);
      return [
        key,
        baselineIndex >= 0 && currentIndex > baselineIndex
          ? "Improved"
          : baselineIndex >= 0 && currentIndex < baselineIndex
            ? "Declined"
            : baseline && current && baseline === current
              ? "Unchanged"
              : "",
      ];
    }));
  }, [note, evaluation]);

  async function save() {
    if (!note) return;
    setBusy(true);
    try {
      await saveProgressNote(note);
      setMessage("Progress note saved.");
    } catch (error) {
      console.error(error);
      setMessage("Could not save progress note.");
    } finally {
      setBusy(false);
    }
  }

  if (!note || !evaluation) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h3" fontWeight={800}>{mode === "resume" ? "Resume OT Progress Note" : "OT Progress Note"}</Typography>
            <Typography color="text.secondary">
              {mode === "resume"
                ? "Enter the same case/resume code used for the patient's evaluation."
                : "Start from a saved initial evaluation so baseline function, cognition, ROM, strength, and goals carry forward automatically."}
            </Typography>
          </Box>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h5">{mode === "resume" ? "Load saved progress note" : "Load initial evaluation"}</Typography>
                <Field label="Case / evaluation code" value={evalCode} onChange={value => setEvalCode(value.toUpperCase())} />
                <Button variant="contained" onClick={mode === "resume" ? resumeNote : loadSource} disabled={busy || !evalCode.trim()}>
                  {mode === "resume" ? "Resume Progress Note" : "Create Progress Note"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
          {message && <Alert severity="error">{message}</Alert>}
          <Button onClick={onExit}>Back to Home</Button>
        </Stack>
      </Container>
    );
  }

  const pageIndex = PAGES.findIndex(item => item[0] === page);
  const progress = Math.round(((pageIndex + 1) / PAGES.length) * 100);
  const workflowGoal = goalWorkflowIndex !== null ? note.goals[goalWorkflowIndex] : null;

  const renderPage = () => {
    switch (page) {
      case "period":
        return (
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h5" fontWeight={700}>1. Progress Period / Medical Update</Typography>
                <Alert severity="info">Information available from the initial evaluation is carried forward below. Review each item, update it if needed, and confirm it. Pain is intentionally left blank for the current progress note.</Alert>

                <Card variant="outlined">
                  <CardContent><Stack spacing={1.5}>
                    <Typography fontWeight={700}>Reporting period start</Typography>
                    <Typography variant="body2" color="text.secondary">Initial evaluation date: {evaluation.formData.patientInfo.evaluationDate || "Not documented"}</Typography>
                    <Field type="date" label="Current reporting period start" value={note.reportingPeriodStart} onChange={value => patchPeriodField("reportingPeriodStart", value)} />
                    <ConfirmButton confirmed={!!note.periodConfirmed?.reportingPeriodStart} onConfirm={() => confirmPeriod("reportingPeriodStart")} />
                  </Stack></CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent><Stack spacing={1.5}>
                    <Typography fontWeight={700}>Reporting period end</Typography>
                    <Typography variant="body2" color="text.secondary">Defaults to today's date; adjust if the reporting period ends on a different date.</Typography>
                    <Field type="date" label="Current reporting period end" value={note.reportingPeriodEnd} onChange={value => patchPeriodField("reportingPeriodEnd", value)} />
                    <ConfirmButton confirmed={!!note.periodConfirmed?.reportingPeriodEnd} onConfirm={() => confirmPeriod("reportingPeriodEnd")} />
                  </Stack></CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent><Stack spacing={1.5}>
                    <Typography fontWeight={700}>Visits since evaluation / last progress note</Typography>
                    <Typography variant="body2" color="text.secondary">Visit count is not available from the initial evaluation; replace the carried-forward prompt with the current count.</Typography>
                    <Field label="Current visit count" value={note.visitsSinceEvaluation} onChange={value => patchPeriodField("visitsSinceEvaluation", value)} />
                    <ConfirmButton confirmed={!!note.periodConfirmed?.visitsSinceEvaluation} onConfirm={() => confirmPeriod("visitsSinceEvaluation")} />
                  </Stack></CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent><Stack spacing={1.5}>
                    <Typography fontWeight={700}>Medical status / diagnoses / relevant events</Typography>
                    <Typography variant="body2" color="text.secondary">Initial evaluation information is pre-populated below. Edit it to reflect the current reporting period, or confirm it if still accurate.</Typography>
                    <Field label="Current medical status / relevant events" value={note.medicalUpdates} onChange={value => patchPeriodField("medicalUpdates", value)} multiline />
                    <ConfirmButton confirmed={!!note.periodConfirmed?.medicalUpdates} onConfirm={() => confirmPeriod("medicalUpdates")} />
                  </Stack></CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent><Stack spacing={1.5}>
                    <Typography fontWeight={700}>Pain update</Typography>
                    <Typography variant="body2" color="text.secondary">Enter the patient's current pain status for this reporting period. This field is not carried forward from the evaluation.</Typography>
                    <Field label="Current pain update" value={note.pain} onChange={value => patch("pain", value)} multiline />
                  </Stack></CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent><Stack spacing={1.5}>
                    <Typography fontWeight={700}>Falls / hospitalizations / acute events</Typography>
                    <Typography variant="body2" color="text.secondary">The initial evaluation does not contain a dedicated post-evaluation event history. Update this field for the current reporting period, then confirm it.</Typography>
                    <Field label="Current falls / hospitalizations / acute events" value={note.fallsHospitalizations} onChange={value => patchPeriodField("fallsHospitalizations", value)} multiline />
                    <ConfirmButton confirmed={!!note.periodConfirmed?.fallsHospitalizations} onConfirm={() => confirmPeriod("fallsHospitalizations")} />
                  </Stack></CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent><Stack spacing={1.5}>
                    <Typography fontWeight={700}>Precautions / weight-bearing status</Typography>
                    <Typography variant="body2" color="text.secondary">Initial evaluation precautions and weight-bearing status are pre-populated below. Update if changed, or confirm if still accurate.</Typography>
                    <Field label="Current precautions / weight-bearing status" value={note.precautionsChanges} onChange={value => patchPeriodField("precautionsChanges", value)} multiline />
                    <ConfirmButton confirmed={!!note.periodConfirmed?.precautionsChanges} onConfirm={() => confirmPeriod("precautionsChanges")} />
                  </Stack></CardContent>
                </Card>
              </Stack>
            </CardContent>
          </Card>
        );

      case "function":
        return (
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h5" fontWeight={700}>2. Functional Progress</Typography>
                <Alert severity="info">Initial evaluation status is carried forward. Review every item and click Confirm even if performance is unchanged. Changing a level after confirming resets that confirmation.</Alert>
                {ADLS.map(([key, label]) => {
                  const baseline = evaluation.formData.adlStatus.current[key] || "Not documented";
                  return (
                    <Card variant="outlined" key={key}>
                      <CardContent><Stack spacing={1.5}>
                        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between">
                          <Typography fontWeight={700}>{label}</Typography>
                          {improved[key] && <Chip size="small" label={improved[key]} color={improved[key] === "Improved" ? "success" : improved[key] === "Declined" ? "warning" : "default"} />}
                        </Stack>
                        <Typography variant="body2" color="text.secondary">Initial eval: <b>{baseline}</b> → Current</Typography>
                        <FormControl fullWidth>
                          <InputLabel>Current level</InputLabel>
                          <Select
                            label="Current level"
                            value={note.currentADL[key] || ""}
                            onChange={event => {
                              patch("currentADL", { ...note.currentADL, [key]: event.target.value as AssistanceLevel });
                              patch("functionalADLConfirmed", { ...note.functionalADLConfirmed, [key]: false });
                            }}
                          >
                            {LEVELS.filter(level => key === "functionalMobility" || level !== "Non-ambulatory").map(level => <MenuItem key={level} value={level}>{level}</MenuItem>)}
                          </Select>
                        </FormControl>
                        <ConfirmButton confirmed={!!note.functionalADLConfirmed[key]} onConfirm={() => confirmFunctional(key)} />
                      </Stack></CardContent>
                    </Card>
                  );
                })}
                <Field label="Functional progress / observations" value={note.functionalNotes} onChange={value => patch("functionalNotes", value)} multiline />
              </Stack>
            </CardContent>
          </Card>
        );

      case "cognition":
        return (
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h5" fontWeight={700}>3. Cognition / Communication / Sensory</Typography>
                <Alert severity="info">Evaluation findings are carried forward. Confirm each item if unchanged, or update it and then confirm the new status.</Alert>
                <Card variant="outlined">
                  <CardContent><Stack spacing={1.5}>
                    <Typography fontWeight={700}>Orientation</Typography>
                    <Typography variant="body2" color="text.secondary">Initial eval: {orientationText(evaluation.formData.clientFactors)}</Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <FormControlLabel control={<Checkbox checked={note.currentClientFactors.orientedPerson} onChange={event => { updateClientFactor("orientedPerson", event.target.checked); patch("cognitionConfirmed", { ...note.cognitionConfirmed, orientation: false }); }} />} label="Person" />
                      <FormControlLabel control={<Checkbox checked={note.currentClientFactors.orientedPlace} onChange={event => { updateClientFactor("orientedPlace", event.target.checked); patch("cognitionConfirmed", { ...note.cognitionConfirmed, orientation: false }); }} />} label="Place" />
                      <FormControlLabel control={<Checkbox checked={note.currentClientFactors.orientedTime} onChange={event => { updateClientFactor("orientedTime", event.target.checked); patch("cognitionConfirmed", { ...note.cognitionConfirmed, orientation: false }); }} />} label="Time" />
                      <FormControlLabel control={<Checkbox checked={note.currentClientFactors.orientedSituation} onChange={event => { updateClientFactor("orientedSituation", event.target.checked); patch("cognitionConfirmed", { ...note.cognitionConfirmed, orientation: false }); }} />} label="Situation" />
                    </Stack>
                    <ConfirmButton confirmed={!!note.cognitionConfirmed.orientation} onConfirm={() => patch("cognitionConfirmed", { ...note.cognitionConfirmed, orientation: true })} />
                  </Stack></CardContent>
                </Card>

                {CLIENT_FIELDS.map(([key, label]) => (
                  <Card variant="outlined" key={String(key)}>
                    <CardContent><Stack spacing={1.5}>
                      <Typography fontWeight={700}>{label}</Typography>
                      <Typography variant="body2" color="text.secondary">Initial eval: {String(evaluation.formData.clientFactors[key] ?? "") || "Not documented"}</Typography>
                      <Field
                        label="Current status"
                        value={String(note.currentClientFactors[key] ?? "")}
                        onChange={value => updateClientFactor(key, value)}
                        multiline={key === "standardizedAssessments" || key === "assessmentFindings"}
                      />
                      <ConfirmButton confirmed={!!note.cognitionConfirmed[String(key)]} onConfirm={() => patch("cognitionConfirmed", { ...note.cognitionConfirmed, [String(key)]: true })} />
                    </Stack></CardContent>
                  </Card>
                ))}
              </Stack>
            </CardContent>
          </Card>
        );

      case "rom":
        return (
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h5" fontWeight={700}>4. Range of Motion</Typography>
                <Alert severity="info">ROM findings from the evaluation are pre-populated. Confirm each side/movement if unchanged, or update the finding before confirming.</Alert>
                {MOVEMENTS.map(movement => (
                  <Box key={movement}>
                    <Typography variant="h6" sx={{ mb: 1 }}>{movement}</Typography>
                    <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5}>
                      {(["right", "left"] as const).map(side => {
                        const finding = note.currentROM[side][movement];
                        const baseline = evaluation.formData.rom[side][movement];
                        const confirmKey = `${side}:${movement}`;
                        return (
                          <Card variant="outlined" key={confirmKey} sx={{ flex: 1 }}>
                            <CardContent><Stack spacing={1.5}>
                              <Typography fontWeight={700}>{side === "right" ? "Right" : "Left"}</Typography>
                              <Typography variant="body2" color="text.secondary">Eval: {baseline.status || "Not documented"}{baseline.arom ? ` · AROM ${baseline.arom}°` : ""}{baseline.prom ? ` · PROM ${baseline.prom}°` : ""}</Typography>
                              <FormControl fullWidth>
                                <InputLabel>Finding</InputLabel>
                                <Select label="Finding" value={finding.status} onChange={event => updateROM(side, movement, "status", event.target.value)}>
                                  <MenuItem value=""><em>Not documented</em></MenuItem>
                                  {FINDING_OPTIONS.map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                                </Select>
                              </FormControl>
                              {finding.status === "Impaired" && <>
                                <Field label="AROM (degrees)" value={finding.arom} onChange={value => updateROM(side, movement, "arom", value)} />
                                <Field label="PROM (degrees)" value={finding.prom} onChange={value => updateROM(side, movement, "prom", value)} />
                                <Field label="Notes" value={finding.notes} onChange={value => updateROM(side, movement, "notes", value)} />
                              </>}
                              <ConfirmButton confirmed={!!note.romConfirmed[confirmKey]} onConfirm={() => patch("romConfirmed", { ...note.romConfirmed, [confirmKey]: true })} />
                            </Stack></CardContent>
                          </Card>
                        );
                      })}
                    </Stack>
                  </Box>
                ))}
                <Field label="ROM summary / clinical notes" value={note.currentROM.notes} onChange={value => patch("currentROM", { ...note.currentROM, notes: value })} multiline />
              </Stack>
            </CardContent>
          </Card>
        );

      case "strength":
        return (
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h5" fontWeight={700}>5. Strength</Typography>
                <Alert severity="info">Strength findings from the evaluation are pre-populated. Confirm each side/movement if unchanged, or update the finding before confirming.</Alert>
                {MOVEMENTS.map(movement => (
                  <Box key={movement}>
                    <Typography variant="h6" sx={{ mb: 1 }}>{movement}</Typography>
                    <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5}>
                      {(["right", "left"] as const).map(side => {
                        const finding = note.currentStrength[side][movement];
                        const baseline = evaluation.formData.strength[side][movement];
                        const confirmKey = `${side}:${movement}`;
                        return (
                          <Card variant="outlined" key={confirmKey} sx={{ flex: 1 }}>
                            <CardContent><Stack spacing={1.5}>
                              <Typography fontWeight={700}>{side === "right" ? "Right" : "Left"}</Typography>
                              <Typography variant="body2" color="text.secondary">Eval: {baseline.status || "Not documented"}{baseline.mmt ? ` · MMT ${baseline.mmt}` : ""}</Typography>
                              <FormControl fullWidth>
                                <InputLabel>Finding</InputLabel>
                                <Select label="Finding" value={finding.status} onChange={event => updateStrength(side, movement, "status", event.target.value)}>
                                  <MenuItem value=""><em>Not documented</em></MenuItem>
                                  {FINDING_OPTIONS.map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                                </Select>
                              </FormControl>
                              {finding.status === "Impaired" && <>
                                <Field label="MMT" value={finding.mmt} onChange={value => updateStrength(side, movement, "mmt", value)} />
                                <Field label="Notes" value={finding.notes} onChange={value => updateStrength(side, movement, "notes", value)} />
                              </>}
                              <ConfirmButton confirmed={!!note.strengthConfirmed[confirmKey]} onConfirm={() => patch("strengthConfirmed", { ...note.strengthConfirmed, [confirmKey]: true })} />
                            </Stack></CardContent>
                          </Card>
                        );
                      })}
                    </Stack>
                  </Box>
                ))}
                <Field label="Strength summary / clinical notes" value={note.currentStrength.notes} onChange={value => patch("currentStrength", { ...note.currentStrength, notes: value })} multiline />
              </Stack>
            </CardContent>
          </Card>
        );

      case "goals":
        return (
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h5" fontWeight={700}>6. Goal Progress</Typography>
                <Alert severity="info">Mark the goal's clinical status first. Selecting Met will ask whether the goal should be closed or progressed. Progressing a goal preserves the completed goal and creates a new linked goal.</Alert>
                {note.goals.length === 0
                  ? <Alert severity="warning">No structured goals were found in the initial evaluation.</Alert>
                  : note.goals.map((goal, index) => {
                    const source = goalSourceLabel(goal.originalGoal);
                    const performanceLabel = goal.originalGoal.sourceType === "ROM"
                      ? `Current ${goal.originalGoal.sourceMetric || "ROM"} performance`
                      : goal.originalGoal.sourceType === "Strength"
                        ? "Current strength performance"
                        : "Current performance";
                    const progressed = !!goal.progressedToGoalId;
                    const child = !!goal.parentGoalId;
                    return (
                      <Card variant="outlined" key={goal.goalId || index}>
                        <CardContent><Stack spacing={2}>
                          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                            <Typography fontWeight={700}>{goalDisplayLabel(note.goals, index)}</Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              {child && <Chip size="small" color="info" label="Progressed goal" />}
                              {progressed && <Chip size="small" color="success" label="Met · progressed" />}
                              {goal.status === "Met" && !progressed && <Chip size="small" color="success" label="Met" />}
                            </Stack>
                          </Stack>

                          <Typography>{goal.originalGoal.goalStatement}</Typography>
                          {child && <Alert severity="info">This goal was created from a completed parent goal. The prior goal remains preserved above for documentation history.</Alert>}
                          {source && <Alert severity="info">Source finding from evaluation: <strong>{source}</strong></Alert>}
                          <Typography variant="body2" color="text.secondary">
                            Functional baseline: {goal.originalGoal.current || "Not documented"} · Target: {goal.originalGoal.target || "Not documented"} · Target date: {goal.originalGoal.targetDate || "Not documented"}
                          </Typography>

                          <Field label={performanceLabel} value={goal.currentPerformance} onChange={value => patchGoal(index, { currentPerformance: value })} />

                          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                            <FormControl fullWidth>
                              <InputLabel>Status</InputLabel>
                              <Select
                                label="Status"
                                value={goal.status}
                                disabled={progressed}
                                onChange={event => handleGoalStatusChange(index, event.target.value as GoalProgressStatus)}
                              >
                                <MenuItem value=""><em>Select status</em></MenuItem>
                                {(["Met", "Partially Met", "Unmet"] as GoalProgressStatus[]).map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                              </Select>
                            </FormControl>

                            <FormControl fullWidth>
                              <InputLabel>Goal plan</InputLabel>
                              <Select
                                label="Goal plan"
                                value={goal.plan}
                                disabled={goal.status === "Met" || progressed}
                                onChange={event => patchGoal(index, { plan: event.target.value as GoalPlan })}
                              >
                                <MenuItem value="Continue">Continue</MenuItem>
                                <MenuItem value="Discontinue">Discontinue</MenuItem>
                                {goal.plan === "Upgrade" && <MenuItem value="Upgrade">Upgrade</MenuItem>}
                              </Select>
                            </FormControl>
                          </Stack>

                          {goal.plan === "Upgrade" && goal.modifiedGoal && <Alert severity="success">Progressed to: {goal.modifiedGoal}</Alert>}
                          <Field label="Goal progress notes" value={goal.notes} onChange={value => patchGoal(index, { notes: value })} multiline />
                        </Stack></CardContent>
                      </Card>
                    );
                  })}
              </Stack>
            </CardContent>
          </Card>
        );

      case "intervention":
        return (
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h5" fontWeight={700}>7. Skilled OT / Response</Typography>
                <Typography fontWeight={600}>Interventions addressed during reporting period</Typography>
                {INTERVENTIONS.map(intervention => (
                  <FormControlLabel
                    key={intervention}
                    control={<Checkbox checked={note.skilledInterventions.includes(intervention)} onChange={event => patch("skilledInterventions", event.target.checked ? [...note.skilledInterventions, intervention] : note.skilledInterventions.filter(value => value !== intervention))} />}
                    label={intervention}
                  />
                ))}
                <Field label="Patient response / skilled clinical observations" value={note.responseToIntervention} onChange={value => patch("responseToIntervention", value)} multiline />
                <Field label="Barriers affecting progress" value={note.barriers} onChange={value => patch("barriers", value)} multiline />
                <Field label="Facilitators / supports" value={note.facilitators} onChange={value => patch("facilitators", value)} multiline />
              </Stack>
            </CardContent>
          </Card>
        );

      case "assessment":
        return (
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h5" fontWeight={700}>8. Assessment & Plan</Typography>
                <Field label="Clinical assessment / progress summary" value={note.assessment} onChange={value => patch("assessment", value)} multiline />
                <Field label="Why continued skilled OT is required" value={note.continuedSkilledNeed} onChange={value => patch("continuedSkilledNeed", value)} multiline />
                <FormControl fullWidth>
                  <InputLabel>Plan decision</InputLabel>
                  <Select label="Plan decision" value={note.planDecision} onChange={event => patch("planDecision", event.target.value as ProgressNote["planDecision"])}>
                    {(["Continue POC", "Modify POC", "Discharge OT"] as ProgressNote["planDecision"][]).map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                  </Select>
                </FormControl>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <Field label="Frequency" value={note.frequency} onChange={value => patch("frequency", value)} />
                  <Field label="Duration" value={note.duration} onChange={value => patch("duration", value)} />
                </Stack>
                <Field label="Caregiver training / equipment / DME needs" value={note.caregiverEquipmentNeeds} onChange={value => patch("caregiverEquipmentNeeds", value)} multiline />
              </Stack>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" spacing={1}>
            <Box>
              <Typography variant="h3" fontWeight={800}>OT Progress Note</Typography>
              <Typography color="text.secondary">{evaluation.formData.patientInfo.patientName || "Patient"} · Initial eval {evaluation.formData.patientInfo.evaluationDate || "date not documented"} · Case code {note.sourceEvaluationCode}</Typography>
            </Box>
            <Chip label="Draft" />
          </Stack>

          <LinearProgress variant="determinate" value={progress} />

          <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="flex-start">
            <Card sx={{ width: { xs: "100%", md: 280 }, position: { md: "sticky" }, top: { md: 16 } }}>
              <CardContent>
                <Typography fontWeight={700} sx={{ mb: 1 }}>Progress note sections</Typography>
                <Stack spacing={0.5}>
                  {PAGES.map(([id, title], index) => (
                    <Button key={id} fullWidth sx={{ justifyContent: "flex-start", textAlign: "left" }} variant={page === id ? "contained" : "text"} onClick={() => setPage(id)}>
                      {index + 1}. {title}
                    </Button>
                  ))}
                </Stack>
              </CardContent>
            </Card>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              {renderPage()}
              <Stack direction="row" justifyContent="space-between" sx={{ mt: 2 }}>
                <Button disabled={pageIndex === 0} onClick={() => setPage(PAGES[pageIndex - 1][0])}>Previous</Button>
                <Button disabled={pageIndex === PAGES.length - 1} variant="contained" onClick={() => setPage(PAGES[pageIndex + 1][0])}>Next</Button>
              </Stack>
            </Box>
          </Stack>

          {message && <Alert severity={message.includes("saved") ? "success" : "error"}>{message}</Alert>}

          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
            <Button onClick={onExit}>Home / Exit</Button>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button variant="outlined" onClick={() => exportProgressNotePdf(note, evaluation)}>Download PDF</Button>
              <Button variant="contained" onClick={save} disabled={busy}>Save Progress Note Draft</Button>
            </Stack>
          </Stack>
        </Stack>
      </Container>

      <Dialog open={goalWorkflowIndex !== null} maxWidth="sm" fullWidth disableEscapeKeyDown>
        <DialogTitle>Goal Met</DialogTitle>
        <DialogContent>
          {workflowGoal && goalWorkflowStep === "decision" && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography>This goal has been achieved. What would you like to do next?</Typography>
              <Card variant="outlined">
                <CardContent>
                  <Typography fontWeight={700}>{goalWorkflowIndex !== null ? goalDisplayLabel(note.goals, goalWorkflowIndex) : "Goal"}</Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>{workflowGoal.originalGoal.goalStatement}</Typography>
                </CardContent>
              </Card>
              <Alert severity="info">Closing preserves the completed goal. Progressing also preserves it, then creates a new linked goal with a new target.</Alert>
            </Stack>
          )}

          {workflowGoal && goalWorkflowStep === "progress" && progressDraft && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Alert severity="info">The completed goal will stay in the note. The new goal will carry forward its occupation and context and will be linked back to this parent goal.</Alert>

              <Field label="Occupation / activity" value={progressDraft.occupation} onChange={value => updateProgressDraft({ occupation: value })} />
              <Field label="Conditions / cueing / context" value={progressDraft.condition} onChange={value => updateProgressDraft({ condition: value })} multiline />

              {isFunctionalGoal(workflowGoal.originalGoal) ? (
                <FormControl fullWidth>
                  <InputLabel>New target level</InputLabel>
                  <Select label="New target level" value={progressDraft.target} onChange={event => updateProgressDraft({ target: event.target.value })}>
                    {FUNCTIONAL_TARGET_LEVELS.map(level => <MenuItem key={level} value={level}>{level}</MenuItem>)}
                  </Select>
                </FormControl>
              ) : (
                <Field label={workflowGoal.originalGoal.sourceType === "ROM" ? "New ROM target" : "New strength target"} value={progressDraft.target} onChange={value => updateProgressDraft({ target: value })} />
              )}

              <Typography variant="body2" color="text.secondary">Suggested next target: <strong>{suggestedNextTarget(workflowGoal.originalGoal) || "No automatic suggestion"}</strong>. The therapist can choose a different target.</Typography>
              <Field type="date" label="New target date" value={progressDraft.targetDate} onChange={value => updateProgressDraft({ targetDate: value })} />
              <Field
                label="Progressed goal statement"
                value={progressDraft.goalStatement}
                onChange={value => setProgressDraft(current => current ? { ...current, goalStatement: value, statementCustomized: true } : current)}
                multiline
              />
            </Stack>
          )}
        </DialogContent>

        {goalWorkflowStep === "decision" ? (
          <DialogActions>
            <Button onClick={closeMetGoal}>Close Goal</Button>
            <Button variant="contained" onClick={() => setGoalWorkflowStep("progress")}>Progress Goal</Button>
          </DialogActions>
        ) : (
          <DialogActions>
            <Button onClick={() => setGoalWorkflowStep("decision")}>Back</Button>
            <Button
              variant="contained"
              onClick={createProgressedGoal}
              disabled={!progressDraft?.target.trim() || !progressDraft?.targetDate || !progressDraft?.goalStatement.trim()}
            >
              Create Progressed Goal
            </Button>
          </DialogActions>
        )}
      </Dialog>
    </>
  );
}
