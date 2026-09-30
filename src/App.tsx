import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  FormControl, FormControlLabel, InputLabel, LinearProgress, MenuItem, Select,
  Stack, TextField, Typography,
} from "@mui/material";
import type { AssistanceLevel, Evaluation, EvaluationFormData, FindingStatus, GoalType, OTGoal, SectionGGCode } from "./types";
import { createEmptyFormData, normalizeEvaluation, MOVEMENTS } from "./types";
import { ensureAnonymousAuth, generateResumeCode, getLastCode, loadEvaluation, saveEvaluation } from "./storage";

const PAGES = [
  ["patient", "Patient / Referral"],
  ["profile", "Occupational Profile"],
  ["environment", "Environment"],
  ["function", "Performance"],
  ["rom", "ROM"],
  ["strength", "Strength"],
  ["client", "Cognition, Communication & Sensory Skills"],
  ["assessment", "Clinical Assessment"],
  ["goals", "Goals"],
  ["plan", "Plan of Care"],
  ["gg", "Section GG"],
  ["review", "Review / Attestation"],
] as const;
type PageId = typeof PAGES[number][0];

const ASSISTANCE_OPTIONS: AssistanceLevel[] = [
  "Independent", "Modified Independent", "Supervision", "Contact Guard Assist",
  "Minimal Assist", "Moderate Assist", "Maximal Assist", "Dependent",
  "Not Assessed", "Not Applicable",
];
const FINDING_OPTIONS: FindingStatus[] = ["WNL", "WFL", "Impaired", "Not Assessed"];
const PRECAUTIONS = ["Fall risk", "Hip precautions", "Spinal precautions", "Aspiration precautions", "Contact precautions", "Seizure precautions", "Skin / wound precautions", "Other"];
const INTERVENTIONS = ["ADL retraining", "Functional mobility / transfer training", "Therapeutic exercise", "Therapeutic activity", "Balance training", "Cognitive / compensatory strategy training", "Neuromuscular re-education", "Energy conservation", "Adaptive equipment training", "Caregiver education", "Discharge planning"];
const GG_OPTIONS: { code: SectionGGCode; label: string }[] = [
  { code: "06", label: "06 — Independent" }, { code: "05", label: "05 — Setup or clean-up assistance" },
  { code: "04", label: "04 — Supervision or touching assistance" }, { code: "03", label: "03 — Partial/moderate assistance" },
  { code: "02", label: "02 — Substantial/maximal assistance" }, { code: "01", label: "01 — Dependent" },
  { code: "09", label: "09 — Not applicable / not attempted" }, { code: "88", label: "88 — Not attempted due to medical/safety concern" },
];
const GOAL_TYPES: GoalType[] = ["Short-term", "Long-term"];
const GOAL_TIMEFRAMES = ["1 week", "2 weeks", "3 weeks", "4 weeks", "6 weeks", "8 weeks", "By discharge"];
const GOAL_WIZARD_STEPS = [
  { key: "occupation", title: "1. Occupation / activity", help: "Choose the meaningful occupation you are addressing." },
  { key: "target", title: "2. Target performance level", help: "Choose the functional level you want the patient to achieve." },
  { key: "performanceProblem", title: "3. Functional performance problem", help: "Choose the occupational reason the goal is needed." },
  { key: "condition", title: "4. Condition / context", help: "Choose the conditions under which the patient will perform." },
  { key: "measurableCriterion", title: "5. Measurable criterion", help: "Choose how successful performance will be measured." },
  { key: "timeframe", title: "6. Timeframe", help: "Choose when the patient is expected to meet the goal." },
] as const;

const GOAL_PHRASES: Record<string, string[]> = {
  performanceProblem: [
    "improve independence with daily self-care",
    "increase safety during functional mobility",
    "improve independence with toileting",
    "improve independence with dressing",
    "improve independence with bathing",
    "support safe discharge to the prior living environment",
    "reduce caregiver burden during daily routines",
    "improve participation in a meaningful daily routine",
  ],
  condition: [
    "with no more than 1 verbal cue",
    "with no more than 2 verbal cues",
    "using the least restrictive assistive device",
    "using adaptive equipment as needed",
    "with appropriate safety awareness",
    "with setup assistance only",
    "without loss of balance",
    "while maintaining prescribed precautions",
    "with supervision for safety",
  ],
  measurableCriterion: [
    "in 4 out of 5 observed opportunities",
    "in 3 consecutive treatment sessions",
    "with 90% task completion",
    "with no more than minimal cueing",
    "with no more than supervision",
    "without physical assistance",
    "with consistent carryover across sessions",
  ],
};

function blankGoal(): OTGoal {
  return { id: "", type: "Short-term", occupation: "", plof: "", current: "", target: "", performanceProblem: "", condition: "", measurableCriterion: "", timeframe: "", goalStatement: "" };
}
function buildGoalStatement(goal: OTGoal): string {
  if (!goal.occupation || !goal.target) return "";
  const problem = goal.performanceProblem.trim() || "improve occupational performance";
  const condition = goal.condition.trim() ? ` while ${goal.condition.trim()}` : "";
  const measure = goal.measurableCriterion.trim() ? ` as demonstrated by ${goal.measurableCriterion.trim()}` : "";
  const timeframe = goal.timeframe ? ` within ${goal.timeframe}` : "";
  return `Patient will improve ${goal.occupation.toLowerCase()} from ${goal.current || "current documented level"} to ${goal.target.toLowerCase()}${condition} in order to ${problem}${measure}${timeframe}.`;
}
const ADLS: [string, string][] = [
  ["eating", "Eating"], ["grooming", "Grooming"], ["bathing", "Bathing"], ["upperBodyDressing", "Upper-body dressing"],
  ["lowerBodyDressing", "Lower-body dressing"], ["toileting", "Toileting"], ["toiletTransfer", "Toilet transfer"],
  ["showerTransfer", "Shower transfer"], ["bedMobility", "Bed mobility"], ["transfers", "Transfers"], ["functionalMobility", "Functional mobility / ambulation"],
];
function Field({ label, value, onChange, disabled, multiline = false, minRows = 3, placeholder }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean; multiline?: boolean; minRows?: number; placeholder?: string }) {
  return <TextField fullWidth label={label} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} multiline={multiline} minRows={multiline ? minRows : undefined} placeholder={placeholder} />;
}
function SelectField({ label, value, options, onChange, disabled }: { label: string; value: string; options: string[]; onChange: (v: string) => void; disabled: boolean }) {
  return <FormControl fullWidth disabled={disabled}><InputLabel shrink>{label}</InputLabel><Select displayEmpty value={value} label={label} renderValue={selected => selected || <span style={{ color: "#777" }}>Select...</span>} onChange={e => onChange(e.target.value)}><MenuItem value=""><em>Not assessed</em></MenuItem>{options.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}</Select></FormControl>;
}
function PageCard({ title, children, help }: { title: string; children: React.ReactNode; help?: string }) {
  return <Card><CardContent><Stack spacing={2}><Typography variant="h5" fontWeight={700}>{title}</Typography>{help && <Typography color="text.secondary">{help}</Typography>}{children}</Stack></CardContent></Card>;
}

function exportEvaluationPdf(evaluation: Evaluation) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const usableWidth = pageWidth - margin * 2;
  let y = 48;

  const safe = (value: unknown): string => String(value ?? "")
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
    y += 2;
  };

  const addField = (label: string, value: unknown) => {
    const text = safe(value).trim();
    if (!text || text === "false" || text === "0") return;
    addText(label, 9, true);
    addText(text, 10, false, 8);
  };

  const labelize = (key: string) => key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, c => c.toUpperCase());

  const f = evaluation.formData;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("SNF OT Initial Evaluation", margin, y);
  y += 22;
  addText(`Status: ${evaluation.status === "submitted" ? "SUBMITTED" : "DRAFT"}`, 10, true);
  addText(`Student: ${evaluation.studentName}    Resume code: ${evaluation.resumeCode}`, 9);
  addText(`Generated: ${new Date().toLocaleString()}`, 9);
  y += 4;

  addSection("1. Patient / Referral");
  addField("Patient name", f.patientInfo.patientName);
  addField("Medical record number", f.patientInfo.medicalRecordNumber);
  addField("Date of birth", f.patientInfo.dateOfBirth);
  addField("Evaluation date", f.patientInfo.evaluationDate);
  addField("Medical diagnosis", f.patientInfo.medicalDiagnosis);
  addField("Reason for OT referral", f.patientInfo.reasonForReferral);
  addField("Weight-bearing status", f.medicalStatus.weightBearing);
  addField("Precautions", f.medicalStatus.precautions.join(", "));

  addSection("2. Occupational Profile");
  addField("Occupational profile", f.occupationalProfile.summary);

  addSection("3. Environment");
  addField("Prior living environment", f.environmentPLOF.priorLivingEnvironment);
  addField("Current equipment / DME / assistive devices", f.environmentPLOF.equipment);

  addSection("4. Medical / Clinical Status");
  if (f.medicalStatus.painRating !== "") {
    addText("Pain rating", 9, true);
    addText(f.medicalStatus.painRating + "/10", 10, false, 8);
  }
  addField("Pain interferes with occupational participation", f.medicalStatus.painInterferesOccupationalParticipation);
  if (f.medicalStatus.painInterferesOccupationalParticipation === "Yes") {
    addField("Pain timing", f.medicalStatus.painTiming);
    addField("Pain location", f.medicalStatus.painLocation);
    addField("Pain description", f.medicalStatus.painDescription);
  }
  addField("Vitals", f.medicalStatus.vitals);
  addField("Relevant medications", f.medicalStatus.medicationsRelevant);
  addField("Lines / tubes / drains", f.medicalStatus.linesTubesDrains);
  addField("Skin / wounds", f.medicalStatus.skinWounds);
  addField("Medical stability", f.medicalStatus.medicalStability);
  addField("Notes", f.medicalStatus.notes);

  addSection("5. Performance / ADL Status");
  addText("Prior level of function", 10, true);
  for (const [key, label] of ADLS) addField(label, f.adlStatus.plof[key]);
  addText("Current performance", 10, true);
  for (const [key, label] of ADLS) addField(label, f.adlStatus.current[key]);
  addField("Other occupations", f.adlStatus.otherOccupations);
  addField("Activity tolerance", f.adlStatus.activityTolerance);
  addField("Cueing needed", f.adlStatus.cueingNeeded);
  addField("Safety awareness", f.adlStatus.safetyAwareness);
  addField("Observations", f.adlStatus.observations);

  addSection("6. Range of Motion");
  for (const side of ["right", "left"] as const) {
    addText(side === "right" ? "Right upper extremity" : "Left upper extremity", 10, true);
    for (const movement of MOVEMENTS) {
      const finding = f.rom[side][movement];
      if (finding.status || finding.arom || finding.prom || finding.notes) {
        addField(movement, `${finding.status || "Not documented"}${finding.arom ? ` | AROM: ${finding.arom} deg` : ""}${finding.prom ? ` | PROM: ${finding.prom} deg` : ""}${finding.notes ? ` | ${finding.notes}` : ""}`);
      }
    }
  }
  addField("ROM summary / clinical notes", f.rom.notes);

  addSection("7. Strength");
  for (const side of ["right", "left"] as const) {
    addText(side === "right" ? "Right upper extremity" : "Left upper extremity", 10, true);
    for (const movement of MOVEMENTS) {
      const finding = f.strength[side][movement];
      if (finding.status || finding.mmt || finding.notes) {
        addField(movement, `${finding.status || "Not documented"}${finding.mmt ? ` | MMT: ${finding.mmt}` : ""}${finding.notes ? ` | ${finding.notes}` : ""}`);
      }
    }
  }
  addField("Strength summary / clinical notes", f.strength.notes);

  addSection("8. Cognition, Communication & Sensory Skills");
  addField("Orientation", [
    f.clientFactors.orientedPerson ? "Person" : "",
    f.clientFactors.orientedPlace ? "Place" : "",
    f.clientFactors.orientedTime ? "Time" : "",
    f.clientFactors.orientedSituation ? "Situation" : "",
  ].filter(Boolean).join(", ") || "Not documented");
  for (const [key, value] of Object.entries(f.clientFactors)) {
    if (typeof value === "string" && value.trim()) addField(labelize(key), value);
  }

  addSection("9. Clinical Assessment / OT Analysis");
  addField("Assessment / clinical impression", f.clinicalAssessment.assessmentSummary);
  addField("Rehabilitation prognosis", f.clinicalAssessment.prognosis);

  addSection("10. Goals");
  if (f.goalsPlanOfCare.goals.length) {
    f.goalsPlanOfCare.goals.forEach((goal, index) => {
      addText(`${goal.type} Goal ${index + 1}`, 10, true);
      addText(goal.goalStatement);
      addField("Occupation", goal.occupation);
      addField("Baseline", goal.current);
      addField("Target", goal.target);
      addField("Condition", goal.condition);
      addField("Measurement", goal.measurableCriterion);
      addField("Timeframe", goal.timeframe);
    });
  } else {
    addText("No guided goals have been added.");
  }

  addSection("11. Plan of Care");
  addField("Frequency", f.goalsPlanOfCare.frequency);
  addField("Duration", f.goalsPlanOfCare.duration);
  addField("Skilled interventions", f.goalsPlanOfCare.treatmentInterventions.join(", "));
  addField("Patient / caregiver education", f.goalsPlanOfCare.patientCaregiverEducation);
  addField("Discharge planning / anticipated disposition", f.goalsPlanOfCare.dischargePlan);

  addSection("12. Section GG");
  for (const [key, value] of Object.entries(f.sectionGG)) {
    if (key !== "ggNotes" && value) addField(labelize(key), value);
  }
  addField("Section GG notes / reasoning", f.sectionGG.ggNotes);

  addSection("13. Review / Attestation");
  addField("Student name", f.signatureAttestation.studentName);
  addField("Credentials / role", f.signatureAttestation.credentials);
  addField("Attestation completed", f.signatureAttestation.attestation ? "Yes" : "No");
  addField("Attestation date", f.signatureAttestation.signatureDate);
  addText("Educational demonstration. All patient information is fictional.", 8, false);

  const patient = safe(f.patientInfo.patientName).replace(/[^a-zA-Z0-9_-]+/g, "_") || "Evaluation";
  doc.save(`SNF_OT_Evaluation_${patient}_${evaluation.status === "submitted" ? "Final" : "Draft"}.pdf`);
}

export default function App() {
  const [screen, setScreen] = useState<"home" | "evaluation">("home");
  const [page, setPage] = useState<PageId>("patient");
  const [studentName, setStudentName] = useState("");
  const [resumeCode, setResumeCode] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [goalDraft, setGoalDraft] = useState<OTGoal>(blankGoal());
  const [goalWizardOpen, setGoalWizardOpen] = useState(false);
  const [goalWizardStep, setGoalWizardStep] = useState(0);
  const [goalContext, setGoalContext] = useState("");
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const disabled = evaluation?.status === "submitted" || busy;

  useEffect(() => { const last = getLastCode(); if (last) setResumeCode(last); }, []);

  const progress = useMemo(() => {
    if (!evaluation) return 0;
    const f = evaluation.formData;
    const sections = [
      f.patientInfo.patientName || f.patientInfo.reasonForReferral, f.occupationalProfile.summary,
      f.environmentPLOF.priorLivingEnvironment || f.environmentPLOF.equipment, Object.values(f.adlStatus.current).some(v => v !== "" && v !== "Not Assessed"),
      Object.values(f.rom.right).some(v => v.status !== "" && v.status !== "Not Assessed") || Object.values(f.rom.left).some(v => v.status !== "" && v.status !== "Not Assessed"),
      Object.values(f.strength.right).some(v => v.status !== "" && v.status !== "Not Assessed") || Object.values(f.strength.left).some(v => v.status !== "" && v.status !== "Not Assessed"),
      Object.values(f.clientFactors).some(v => Array.isArray(v) ? v.length : v), f.clinicalAssessment.assessmentSummary,
      f.goalsPlanOfCare.shortTermGoals || f.goalsPlanOfCare.longTermGoals, f.goalsPlanOfCare.frequency || f.goalsPlanOfCare.treatmentInterventions.length,
      Object.values(f.sectionGG).some(v => v !== ""), f.signatureAttestation.attestation,
    ];
    return Math.round(sections.filter(Boolean).length / sections.length * 100);
  }, [evaluation]);

  async function startEvaluation() {
    const name = studentName.trim();
    if (!name) { setMessage("Enter your name before starting."); return; }
    setBusy(true); setMessage("");
    try {
      await ensureAnonymousAuth();
      const now = new Date().toISOString();
      const next: Evaluation = { id: crypto.randomUUID(), resumeCode: generateResumeCode(), studentName: name, status: "draft", createdAt: now, updatedAt: now, formData: createEmptyFormData() };
      next.formData.signatureAttestation.studentName = name;
      await saveEvaluation(next);
      setEvaluation(next); setResumeCode(next.resumeCode); setPage("patient"); setScreen("evaluation");
    } catch (e) { console.error(e); setMessage("Could not connect to Firebase. Check your Firebase setup and try again."); }
    finally { setBusy(false); }
  }
  async function resumeEvaluation() {
    if (!resumeCode.trim()) { setMessage("Enter a resume code."); return; }
    setBusy(true); setMessage("");
    try {
      const found = await loadEvaluation(resumeCode);
      if (!found) { setMessage("No saved evaluation was found for that resume code."); return; }
      const normalized = normalizeEvaluation(found);
      setEvaluation(normalized); setStudentName(normalized.studentName); setScreen("evaluation");
    } catch (e) { console.error(e); setMessage("Could not load that evaluation."); }
    finally { setBusy(false); }
  }
  function updateSection<K extends keyof EvaluationFormData>(section: K, field: keyof EvaluationFormData[K], value: unknown) {
    if (!evaluation || evaluation.status === "submitted") return;
    const next = { ...evaluation, updatedAt: new Date().toISOString(), formData: { ...evaluation.formData, [section]: { ...evaluation.formData[section], [field]: value } } };
    setEvaluation(next); localStorage.setItem("snf-ot-eval:" + next.resumeCode, JSON.stringify(next));
  }
  function updateNestedADL(side: "plof" | "current", key: string, value: string) {
    if (!evaluation || evaluation.status === "submitted") return;
    const next = {
      ...evaluation,
      updatedAt: new Date().toISOString(),
      formData: {
        ...evaluation.formData,
        adlStatus: {
          ...evaluation.formData.adlStatus,
          [side]: {
            ...evaluation.formData.adlStatus[side],
            [key]: value,
          },
        },
      },
    } as Evaluation;
    setEvaluation(next);
    localStorage.setItem("snf-ot-eval:" + next.resumeCode, JSON.stringify(next));
  }
  function updateNested(section: "rom" | "strength", side: "right" | "left", movement: string, field: string, value: string) {
    if (!evaluation || evaluation.status === "submitted") return;
    const current = evaluation.formData[section];
    const next = { ...evaluation, updatedAt: new Date().toISOString(), formData: { ...evaluation.formData, [section]: { ...current, [side]: { ...current[side], [movement]: { ...current[side][movement], [field]: value } } } } } as Evaluation;
    setEvaluation(next); localStorage.setItem("snf-ot-eval:" + next.resumeCode, JSON.stringify(next));
  }
  function updateGoals(goals: OTGoal[]) {
    if (!evaluation || evaluation.status === "submitted") return;
    const next = {
      ...evaluation,
      updatedAt: new Date().toISOString(),
      formData: {
        ...evaluation.formData,
        goalsPlanOfCare: {
          ...evaluation.formData.goalsPlanOfCare,
          goals,
          shortTermGoals: goals.filter(g => g.type === "Short-term").map(g => g.goalStatement).join("\n"),
          longTermGoals: goals.filter(g => g.type === "Long-term").map(g => g.goalStatement).join("\n"),
        },
      },
    } as Evaluation;
    setEvaluation(next);
    localStorage.setItem("snf-ot-eval:" + next.resumeCode, JSON.stringify(next));
  }

  function openGoalBuilder(prefill: Partial<OTGoal> = {}, context = "") {
    setGoalDraft({ ...blankGoal(), ...prefill });
    setGoalContext(context);
    setGoalWizardStep(0);
    setGoalWizardOpen(true);
    setPage("goals");
  }

  async function saveDraft() {
    if (!evaluation || evaluation.status === "submitted") return;
    setBusy(true); setMessage("");
    try {
      const next = { ...evaluation, updatedAt: new Date().toISOString() };
      setEvaluation(next);
      await saveEvaluation(next);
      setMessage("Draft saved to Firebase.");
    } catch (e) {
      console.error(e);
      setMessage("Draft could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function submitEvaluation() {
    if (!evaluation || evaluation.status === "submitted") return;
    if (!evaluation.formData.signatureAttestation.attestation) {
      setMessage("Complete the attestation before submitting.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const next: Evaluation = {
        ...evaluation,
        status: "submitted",
        updatedAt: new Date().toISOString(),
      };
      await saveEvaluation(next);
      setEvaluation(next);
      setSubmitDialogOpen(false);
      setPage("review");
      setMessage("Evaluation submitted. It is now read-only.");
    } catch (e) {
      console.error(e);
      setMessage("Evaluation could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  function startNewEvaluation() {
    setEvaluation(null);
    setPage("patient");
    setStudentName("");
    setResumeCode("");
    setMessage("");
    setSubmitDialogOpen(false);
    setScreen("home");
  }

  function renderFindingPage(section: "rom" | "strength") {
    const data = evaluation!.formData[section];
    const isROM = section === "rom";
    const renderFinding = (side: "right" | "left", movement: string) => {
      const finding = data[side][movement];
      return <Card variant="outlined"><CardContent><Stack spacing={1.5}>
        <Typography fontWeight={700}>{side === "right" ? "Right side" : "Left side"}</Typography>
        <SelectField label="Finding" value={finding.status} options={FINDING_OPTIONS} disabled={!!disabled} onChange={v => updateNested(section, side, movement, "status", v)} />
        {finding.status === "Impaired" && (isROM ? (() => {
          const romFinding = finding as import("./types").ROMFinding;
          return <Stack spacing={1.5}><Field label="AROM (degrees)" value={romFinding.arom} disabled={!!disabled} onChange={v => updateNested(section, side, movement, "arom", v)} /><Field label="PROM (degrees)" value={romFinding.prom} disabled={!!disabled} onChange={v => updateNested(section, side, movement, "prom", v)} /></Stack>;
        })() : (() => {
          const strengthFinding = finding as import("./types").StrengthFinding;
          return <SelectField label="MMT" value={strengthFinding.mmt} options={["0", "1", "2-", "2", "2+", "3-", "3", "3+", "4-", "4", "4+", "5"]} disabled={!!disabled} onChange={v => updateNested(section, side, movement, "mmt", v)} />;
        })())}
        {finding.status === "Impaired" && <Field label="Notes" value={finding.notes} disabled={!!disabled} onChange={v => updateNested(section, side, movement, "notes", v)} />}
        {finding.status === "Impaired" && <Button
          variant="outlined"
          size="small"
          onClick={() => {
            const detail = isROM
              ? (() => {
                  const r = finding as import("./types").ROMFinding;
                  return `${side === "right" ? "Right" : "Left"} ${movement} — Impaired; AROM: ${r.arom || "not documented"}°, PROM: ${r.prom || "not documented"}°`;
                })()
              : (() => {
                  const s = finding as import("./types").StrengthFinding;
                  return `${side === "right" ? "Right" : "Left"} ${movement} — Impaired; MMT: ${s.mmt || "not documented"}`;
                })();
            openGoalBuilder({}, detail);
          }}
          disabled={!!disabled}
          sx={{ alignSelf: "flex-start", textTransform: "none" }}
        >
          Build Goal
        </Button>}
      </Stack></CardContent></Card>;
    };
    return <PageCard title={isROM ? "Range of Motion" : "Strength"} help="Each movement is documented separately for the right and left upper extremities.">
      {MOVEMENTS.map(m => <Box key={m}><Typography variant="h6" sx={{ mb: 1 }}>{m}</Typography><Stack direction={{ xs: "column", md: "row" }} spacing={1.5}><Box sx={{ flex: 1 }}>{renderFinding("right", m)}</Box><Box sx={{ flex: 1 }}>{renderFinding("left", m)}</Box></Stack></Box>)}
      <Field label={isROM ? "ROM summary / clinical notes" : "Strength summary / clinical notes"} value={data.notes} disabled={!!disabled} onChange={v => updateSection(section, "notes", v)} multiline />
    </PageCard>;
  }

  function renderPage() {
    if (!evaluation) return null;
    const f = evaluation.formData;
    switch (page) {
      case "patient": return <PageCard title="Patient / Referral" help="Enter the basic clinical context for the evaluation."><Stack spacing={2}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}><Field label="Patient name" value={f.patientInfo.patientName} disabled={!!disabled} onChange={v => updateSection("patientInfo", "patientName", v)} /><Field label="Medical record number" value={f.patientInfo.medicalRecordNumber} disabled={!!disabled} onChange={v => updateSection("patientInfo", "medicalRecordNumber", v)} /></Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}><Field label="Date of birth" value={f.patientInfo.dateOfBirth} disabled={!!disabled} onChange={v => updateSection("patientInfo", "dateOfBirth", v)} /><Field label="Evaluation date" value={f.patientInfo.evaluationDate} disabled={!!disabled} onChange={v => updateSection("patientInfo", "evaluationDate", v)} /></Stack>
        <Field label="Medical diagnosis" value={f.patientInfo.medicalDiagnosis} disabled={!!disabled} onChange={v => updateSection("patientInfo", "medicalDiagnosis", v)} />
        <Field label="Reason for OT referral" value={f.patientInfo.reasonForReferral} disabled={!!disabled} onChange={v => updateSection("patientInfo", "reasonForReferral", v)} multiline minRows={4} />
        <Divider /><Typography variant="h6">Medical / Clinical Considerations</Typography>
        <FormControl fullWidth disabled={!!disabled}><InputLabel>Weight-bearing status</InputLabel><Select value={f.medicalStatus.weightBearing} label="Weight-bearing status" onChange={e => updateSection("medicalStatus", "weightBearing", e.target.value)}>{["WBAT","NWB","TTWB","PWB","No restriction","Unknown / verify order"].map(x => <MenuItem key={x} value={x}>{x}</MenuItem>)}</Select></FormControl>
        <Field label="Precautions / relevant medical considerations" value={f.medicalStatus.notes} disabled={!!disabled} onChange={v => updateSection("medicalStatus","notes",v)} multiline />
        <Divider /><Typography variant="h6">Pain</Typography>
        <Field label="Pain rating (0–10)" value={f.medicalStatus.painRating} disabled={!!disabled} onChange={v => {
          if (v === "" || (/^\d+$/.test(v) && Number(v) >= 0 && Number(v) <= 10)) {
            updateSection("medicalStatus", "painRating", v);
          }
        }} placeholder="0–10" />
        <FormControl fullWidth disabled={!!disabled}>
          <InputLabel>Does pain interfere with occupational participation?</InputLabel>
          <Select value={f.medicalStatus.painInterferesOccupationalParticipation} label="Does pain interfere with occupational participation?" onChange={e => {
            const value = e.target.value;
            if (!evaluation || evaluation.status === "submitted") return;
            const next = {
              ...evaluation,
              updatedAt: new Date().toISOString(),
              formData: {
                ...evaluation.formData,
                medicalStatus: {
                  ...evaluation.formData.medicalStatus,
                  painInterferesOccupationalParticipation: value,
                  ...(value === "No"
                    ? { painTiming: "", painLocation: "", painDescription: "" }
                    : {}),
                },
              },
            } as Evaluation;
            setEvaluation(next);
            localStorage.setItem("snf-ot-eval:" + next.resumeCode, JSON.stringify(next));
          }}>
            <MenuItem value=""><em>Select...</em></MenuItem>
            <MenuItem value="Yes">Yes</MenuItem>
            <MenuItem value="No">No</MenuItem>
          </Select>
        </FormControl>
        {f.medicalStatus.painInterferesOccupationalParticipation === "Yes" && (
          <Stack spacing={2}>
            <FormControl fullWidth disabled={!!disabled}>
              <InputLabel>Pain timing</InputLabel>
              <Select value={f.medicalStatus.painTiming} label="Pain timing" onChange={e => updateSection("medicalStatus", "painTiming", e.target.value)}>
                <MenuItem value=""><em>Select...</em></MenuItem>
                <MenuItem value="At rest">At rest</MenuItem>
                <MenuItem value="With activity">With activity</MenuItem>
                <MenuItem value="At rest and with activity">At rest and with activity</MenuItem>
              </Select>
            </FormControl>
            <Field label="Pain location" value={f.medicalStatus.painLocation} disabled={!!disabled} onChange={v => updateSection("medicalStatus","painLocation",v)} />
            <Field label="Pain description" value={f.medicalStatus.painDescription} disabled={!!disabled} onChange={v => updateSection("medicalStatus","painDescription",v)} multiline minRows={3} />
          </Stack>
        )}
      </Stack></PageCard>;
      case "profile": return <PageCard title="Occupational Profile" help="Write a concise occupational profile rather than completing separate prompts for roles, routines, interests, and concerns."><Field label="Occupational Profile / Patient Summary" value={f.occupationalProfile.summary} disabled={!!disabled} onChange={v => updateSection("occupationalProfile","summary",v)} multiline minRows={14} placeholder="Describe the patient's roles, routines, interests, meaningful occupations, occupational concerns, relevant history, and patient priorities." /></PageCard>;
      case "environment": return <PageCard title="Environment" help="Describe the physical and social environment that may support or limit occupational performance. Keep the main documentation here as one concise environmental narrative.">
        <Field label="Environment / Home Setup" value={f.environmentPLOF.priorLivingEnvironment} disabled={!!disabled} onChange={v => updateSection("environmentPLOF","priorLivingEnvironment",v)} multiline minRows={12} placeholder="Describe the prior living setting, layout, stairs, bathroom setup, accessibility, caregiver/support availability, routines or environmental demands, and other contextual factors relevant to occupational performance." />
        <Field label="Current equipment / DME / assistive devices (list)" value={f.environmentPLOF.equipment} disabled={!!disabled} onChange={v => updateSection("environmentPLOF","equipment",v)} placeholder="Example: rolling walker, shower chair, grab bars, wheelchair." />
      </PageCard>;
      case "function": return <PageCard title="Performance" help="Document the patient's prior and current assistance levels for each occupation. PLOF is captured here functionally rather than as a separate narrative."><Stack spacing={1.5}>{ADLS.map(([key,label]) => { const assistanceOptions = key === "functionalMobility" ? [...ASSISTANCE_OPTIONS, "Non-ambulatory"] : ASSISTANCE_OPTIONS; return <Card variant="outlined" key={key}><CardContent><Stack spacing={1.5}><Typography variant="h6">{label}</Typography><Stack direction={{ xs:"column", sm:"row" }} spacing={1.5}><SelectField label="PLOF" value={f.adlStatus.plof[key]} options={assistanceOptions} disabled={!!disabled} onChange={v => updateNestedADL("plof",key,v)} /><SelectField label="Current level" value={f.adlStatus.current[key]} options={assistanceOptions} disabled={!!disabled} onChange={v => updateNestedADL("current",key,v)} /></Stack>{f.adlStatus.current[key] && f.adlStatus.current[key] !== "Not Assessed" && f.adlStatus.current[key] !== "Not Applicable" && <Button variant="outlined" size="small" onClick={() => openGoalBuilder({ occupation: key, plof: f.adlStatus.plof[key], current: f.adlStatus.current[key] }, `${label} — Current level: ${f.adlStatus.current[key]}`)} disabled={!!disabled} sx={{ alignSelf: "flex-start", textTransform: "none" }}>Build Goal</Button>}</Stack></CardContent></Card>})}</Stack><Field label="Current occupational performance / functional observations" value={f.adlStatus.observations} disabled={!!disabled} onChange={v => updateSection("adlStatus","observations",v)} multiline minRows={8} /><Stack direction={{ xs:"column", sm:"row" }} spacing={1.5}><Field label="Activity tolerance" value={f.adlStatus.activityTolerance} disabled={!!disabled} onChange={v => updateSection("adlStatus","activityTolerance",v)} /><Field label="Cueing needed" value={f.adlStatus.cueingNeeded} disabled={!!disabled} onChange={v => updateSection("adlStatus","cueingNeeded",v)} /></Stack><Field label="Safety awareness" value={f.adlStatus.safetyAwareness} disabled={!!disabled} onChange={v => updateSection("adlStatus","safetyAwareness",v)} multiline /></PageCard>;
      case "rom": return renderFindingPage("rom");
      case "strength": return renderFindingPage("strength");
      case "client": return <PageCard title="Cognition, Communication & Sensory Skills" help="Use quick clinical selections for orientation, cognition, communication, sensory status, and related performance factors. Use the Clinical Assessment page for narrative synthesis."><Stack spacing={2}>
        <Typography variant="h6">Orientation</Typography>
        <Typography color="text.secondary">Select each domain the patient is oriented to. A&O ×4 is documented when all four are selected.</Typography>
        <Stack direction={{xs:"column",sm:"row"}} spacing={1}><FormControlLabel control={<Checkbox checked={f.clientFactors.orientedPerson} disabled={!!disabled} onChange={e=>updateSection("clientFactors","orientedPerson",e.target.checked)} />} label="Person" /><FormControlLabel control={<Checkbox checked={f.clientFactors.orientedPlace} disabled={!!disabled} onChange={e=>updateSection("clientFactors","orientedPlace",e.target.checked)} />} label="Place" /><FormControlLabel control={<Checkbox checked={f.clientFactors.orientedTime} disabled={!!disabled} onChange={e=>updateSection("clientFactors","orientedTime",e.target.checked)} />} label="Time" /><FormControlLabel control={<Checkbox checked={f.clientFactors.orientedSituation} disabled={!!disabled} onChange={e=>updateSection("clientFactors","orientedSituation",e.target.checked)} />} label="Situation" /></Stack>
        <SelectField label="Cognitive / command-following status" value={f.clientFactors.cognition} options={["Alert / appropriate","Follows simple commands","Follows multi-step commands","Requires intermittent cues","Requires frequent cues","Inconsistent command following","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","cognition",v)} />
        <SelectField label="Communication" value={f.clientFactors.communication} options={["Functional verbal communication","Verbal communication with extra time","Uses communication device / alternative communication","Limited by cognition","Limited by hearing","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","communication",v)} />
        <Stack direction={{xs:"column",sm:"row"}} spacing={1.5}><SelectField label="Vision" value={f.clientFactors.vision} options={["Functional for observed tasks","Uses corrective lenses","Mildly impaired","Moderately impaired","Severely impaired","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","vision",v)} /><SelectField label="Hearing" value={f.clientFactors.hearing} options={["Functional for conversation","Uses hearing aids","Mildly impaired","Moderately impaired","Severely impaired","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","hearing",v)} /></Stack>
        <Stack direction={{xs:"column",sm:"row"}} spacing={1.5}><SelectField label="Sensation" value={f.clientFactors.sensation} options={["Intact for observed tasks","Mildly impaired","Moderately impaired","Severely impaired","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","sensation",v)} /><SelectField label="Coordination" value={f.clientFactors.coordination} options={["Functional","Mildly impaired","Moderately impaired","Severely impaired","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","coordination",v)} /></Stack>
        <Stack direction={{xs:"column",sm:"row"}} spacing={1.5}><SelectField label="Balance" value={f.clientFactors.balance} options={["Functional / independent","Mildly impaired","Moderately impaired","Severely impaired","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","balance",v)} /><SelectField label="Endurance / activity tolerance" value={f.clientFactors.endurance} options={["Functional for task","Mildly limited","Moderately limited","Severely limited","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","endurance",v)} /></Stack>
        <SelectField label="Motor planning / praxis" value={f.clientFactors.motorPlanning} options={["Functional","Mildly impaired","Moderately impaired","Severely impaired","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","motorPlanning",v)} />
        <SelectField label="Functional mobility" value={f.clientFactors.functionalMobility} options={["Functional","Requires supervision / cues","Requires physical assistance","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","functionalMobility",v)} />
        </Stack></PageCard>;
      case "assessment": return <PageCard title="Clinical Assessment / OT Analysis" help="Synthesize the evaluation findings into one clinical narrative. Include strengths, impairments, activity limitations, participation restrictions, occupational performance problems, and why skilled OT is indicated."><Field label="Assessment / Clinical Impression" value={f.clinicalAssessment.assessmentSummary} disabled={!!disabled} onChange={v=>updateSection("clinicalAssessment","assessmentSummary",v)} multiline minRows={16} placeholder="Synthesize the relevant findings and explain their impact on occupational performance and the need for skilled OT." /><SelectField label="Rehabilitation prognosis" value={f.clinicalAssessment.prognosis} options={["Good","Fair","Guarded","Unable to determine"]} disabled={!!disabled} onChange={v=>updateSection("clinicalAssessment","prognosis",v)} /></PageCard>;
      case "goals": {
        const goals = f.goalsPlanOfCare.goals;
        const baseline: { plof: AssistanceLevel; current: AssistanceLevel } = goalDraft.occupation
          ? { plof: f.adlStatus.plof[goalDraft.occupation] ?? "", current: f.adlStatus.current[goalDraft.occupation] ?? "" }
          : { plof: "", current: "" };
        const draftWithBaseline: OTGoal = {
          ...goalDraft,
          plof: goalDraft.plof || baseline.plof,
          current: goalDraft.current || baseline.current,
        };
        const preview = buildGoalStatement(draftWithBaseline);
        const wizardStep = GOAL_WIZARD_STEPS[goalWizardStep];
        const wizardOptions =
          wizardStep.key === "occupation" ? ADLS.map(([key,label]) => ({ value: key, label })) :
          wizardStep.key === "target" ? ASSISTANCE_OPTIONS.filter(x => x !== "" && x !== "Not Assessed" && x !== "Not Applicable").map(x => ({ value: x, label: x })) :
          wizardStep.key === "timeframe" ? GOAL_TIMEFRAMES.map(x => ({ value: x, label: x })) :
          GOAL_PHRASES[wizardStep.key].map(x => ({ value: x, label: x }));

        function chooseWizardValue(value: string) {
          setGoalDraft(g => ({ ...g, [wizardStep.key]: value }));
        }

        function saveGoal() {
          const finalGoal: OTGoal = {
            ...draftWithBaseline,
            id: goalDraft.id || crypto.randomUUID(),
            goalStatement: goalDraft.goalStatement.trim() || preview,
          };
          if (!finalGoal.occupation.trim() || !finalGoal.target.trim() || !finalGoal.timeframe.trim() || !finalGoal.performanceProblem.trim()) {
            setMessage("Complete the occupation, target, functional problem, and timeframe before saving the goal.");
            return;
          }
          const nextGoals = goalDraft.id
            ? goals.map(g => g.id === goalDraft.id ? finalGoal : g)
            : [...goals, finalGoal];
          updateGoals(nextGoals);
          setGoalDraft(blankGoal());
          setGoalWizardStep(0);
          setGoalWizardOpen(false);
          setMessage("");
        }

        function editGoal(goal: OTGoal) {
          // Generated goals should regenerate when their component fields are edited.
          // A genuinely custom goal statement should remain intact until the student changes it.
          const generatedStatement = buildGoalStatement(goal);
          openGoalBuilder(
            {
              ...goal,
              goalStatement: goal.goalStatement.trim() === generatedStatement.trim() ? "" : goal.goalStatement,
            },
            "",
          );
        }

        function removeGoal(id: string) {
          const nextGoals = goals.filter(g => g.id !== id);
          updateGoals(nextGoals);
        }

        const isEditing = Boolean(goalDraft.id);

        return <PageCard title="Goals" help="Build measurable, occupation-based goals from the patient's documented baseline. Presets are suggestions—you can customize individual steps or write the complete goal yourself.">
          <Alert severity="info">Use the guided steps to build a goal, mix presets with your own wording, or write the complete goal yourself. If performance documentation changes later, edit the goal and update its PLOF/current level before saving.</Alert>
          <Button variant="contained" size="large" onClick={()=>openGoalBuilder()} disabled={!!disabled}>Open Guided Goal Builder</Button>

          <Dialog open={goalWizardOpen} onClose={()=>{setGoalWizardOpen(false);setGoalDraft(blankGoal());setGoalWizardStep(0);}} fullWidth maxWidth="md">
            <DialogTitle>{isEditing ? "Edit an OT Goal" : "Build an OT Goal"}</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                <Typography color="text.secondary">Step {goalWizardStep + 1} of {GOAL_WIZARD_STEPS.length}</Typography>
                <Typography variant="h6">{wizardStep.title}</Typography>
                <Typography color="text.secondary">{wizardStep.help}</Typography>
                {goalContext && <Alert severity="info">Started from: <strong>{goalContext}</strong>{!goalDraft.occupation && " — now connect this finding to an occupation."}</Alert>}

                {wizardStep.key === "occupation" && (
                  <Stack spacing={2}>
                    <Stack spacing={1}>
                      {wizardOptions.map(option => <Button key={option.value} variant={goalDraft.occupation === option.value ? "contained" : "outlined"} onClick={()=>chooseWizardValue(option.value)} sx={{justifyContent:"flex-start",textTransform:"none",py:1.2}}>{option.label}</Button>)}
                    </Stack>
                    <Field label="Or enter your own occupation / activity" value={goalDraft.occupation} disabled={!!disabled} onChange={v=>setGoalDraft(g=>({...g,occupation:v}))} placeholder="Example: Meal preparation, medication management, or returning to a hobby" />
                    {goalDraft.occupation && <Stack spacing={1.5}>
                      <Typography fontWeight={700}>Baseline for this occupation</Typography>
                      <SelectField label="Prior level of function (PLOF)" value={goalDraft.plof} options={ASSISTANCE_OPTIONS.filter(x=>x!=="" && x!=="Not Assessed" && x!=="Not Applicable")} disabled={!!disabled} onChange={v=>setGoalDraft(g=>({...g,plof:v as AssistanceLevel}))} />
                      <SelectField label="Current level of function" value={goalDraft.current} options={ASSISTANCE_OPTIONS.filter(x=>x!=="" && x!=="Not Assessed" && x!=="Not Applicable")} disabled={!!disabled} onChange={v=>setGoalDraft(g=>({...g,current:v as AssistanceLevel}))} />
                      <Typography variant="body2" color="text.secondary">These values start from the Performance page when documented, but you can correct them here if you created the goal before documenting the ADL.</Typography>
                    </Stack>}
                  </Stack>
                )}

                {wizardStep.key !== "occupation" && (
                  <Stack spacing={1}>
                    {wizardOptions.map(option => <Button key={option.value} variant={goalDraft[wizardStep.key] === option.value ? "contained" : "outlined"} onClick={()=>chooseWizardValue(option.value)} sx={{justifyContent:"flex-start",textTransform:"none",py:1.4}}>{option.label}</Button>)}
                  </Stack>
                )}

                {(wizardStep.key === "performanceProblem" || wizardStep.key === "condition" || wizardStep.key === "measurableCriterion") && <Field label="Or enter your own phrase" value={String(goalDraft[wizardStep.key])} disabled={!!disabled} onChange={v=>setGoalDraft(g=>({...g,[wizardStep.key]:v}))} multiline minRows={2} />}
                {wizardStep.key === "target" && <Field label="Or enter your own target performance level" value={goalDraft.target} disabled={!!disabled} onChange={v=>setGoalDraft(g=>({...g,target:v}))} placeholder="Example: setup assistance, independent with adaptive equipment, or completes task safely" />}
                {wizardStep.key === "timeframe" && <Field label="Or enter your own timeframe" value={goalDraft.timeframe} disabled={!!disabled} onChange={v=>setGoalDraft(g=>({...g,timeframe:v}))} placeholder="Example: within 10 treatment sessions" />}

                {wizardStep.key === "occupation" && goalDraft.occupation && <Typography color="text.secondary">Selected occupation: {ADLS.find(([key])=>key===goalDraft.occupation)?.[1] || goalDraft.occupation}</Typography>}
                {wizardStep.key === "target" && goalDraft.target && <Typography color="text.secondary">Target: {goalDraft.target}</Typography>}
                {wizardStep.key === "condition" && goalDraft.condition && <Typography color="text.secondary">Condition: {goalDraft.condition}</Typography>}
                {wizardStep.key === "measurableCriterion" && goalDraft.measurableCriterion && <Typography color="text.secondary">Measurement: {goalDraft.measurableCriterion}</Typography>}
                {wizardStep.key === "timeframe" && goalDraft.timeframe && <Typography color="text.secondary">Timeframe: {goalDraft.timeframe}</Typography>}

                {goalWizardStep === GOAL_WIZARD_STEPS.length - 1 && (
                  <Stack spacing={2}>
                    {preview && <Card variant="outlined"><CardContent><Typography fontWeight={700}>Generated goal preview</Typography><Typography sx={{mt:1}}>{preview}</Typography></CardContent></Card>}
                    <Field
                      label="Or write your complete goal statement"
                      value={goalDraft.goalStatement}
                      disabled={!!disabled}
                      onChange={v=>setGoalDraft(g=>({...g,goalStatement:v}))}
                      multiline
                      minRows={5}
                      placeholder="Write the full goal in your own clinical wording. If you leave this blank, the generated goal above will be used."
                    />
                  </Stack>
                )}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={()=>setGoalWizardStep(Math.max(0,goalWizardStep-1))} disabled={goalWizardStep===0}>Back</Button>
              {goalWizardStep < GOAL_WIZARD_STEPS.length - 1 ? <Button variant="contained" onClick={()=>setGoalWizardStep(goalWizardStep+1)} disabled={!goalDraft[wizardStep.key]}>Next</Button> :
                <Button variant="contained" onClick={saveGoal} disabled={!goalDraft.occupation || !goalDraft.target || !goalDraft.performanceProblem.trim() || !goalDraft.timeframe}> {isEditing ? "Save Changes" : "Add Goal"} </Button>}
            </DialogActions>
          </Dialog>

          <Divider />
          <Typography variant="h6">Goals in this evaluation</Typography>
          {goals.length === 0 ? <Typography color="text.secondary">No goals added yet.</Typography> : <Stack spacing={1.5}>{goals.map((goal,index)=><Card variant="outlined" key={goal.id || index}><CardContent><Stack spacing={1}><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography fontWeight={700}>{goal.type} Goal {index+1}</Typography><Stack direction="row" spacing={1}><Button size="small" onClick={()=>editGoal(goal)} disabled={!!disabled}>Edit</Button><Button color="error" size="small" onClick={()=>removeGoal(goal.id)} disabled={!!disabled}>Remove</Button></Stack></Stack><Typography>{goal.goalStatement}</Typography><Typography variant="body2" color="text.secondary">{ADLS.find(([key])=>key===goal.occupation)?.[1] || goal.occupation} · PLOF: {goal.plof || "Not documented"} · Current: {goal.current || "Not documented"} · Target: {goal.target || "Not documented"} · {goal.timeframe || "No timeframe"}</Typography></Stack></CardContent></Card>)}</Stack>}
        </PageCard>;
      }
      case "plan": return <PageCard title="Plan of Care"><Stack spacing={2}><Stack direction={{xs:"column",sm:"row"}} spacing={1.5}><Field label="Frequency" value={f.goalsPlanOfCare.frequency} disabled={!!disabled} onChange={v=>updateSection("goalsPlanOfCare","frequency",v)} /><Field label="Duration" value={f.goalsPlanOfCare.duration} disabled={!!disabled} onChange={v=>updateSection("goalsPlanOfCare","duration",v)} /></Stack><Typography fontWeight={600}>Planned skilled interventions</Typography>{INTERVENTIONS.map(i=><FormControlLabel key={i} control={<Checkbox checked={f.goalsPlanOfCare.treatmentInterventions.includes(i)} disabled={!!disabled} onChange={e=>updateSection("goalsPlanOfCare","treatmentInterventions",e.target.checked?[...f.goalsPlanOfCare.treatmentInterventions,i]:f.goalsPlanOfCare.treatmentInterventions.filter(x=>x!==i))}/>} label={i}/>)}<Field label="Patient / caregiver education" value={f.goalsPlanOfCare.patientCaregiverEducation} disabled={!!disabled} onChange={v=>updateSection("goalsPlanOfCare","patientCaregiverEducation",v)} multiline minRows={6}/><Field label="Discharge planning / anticipated disposition" value={f.goalsPlanOfCare.dischargePlan} disabled={!!disabled} onChange={v=>updateSection("goalsPlanOfCare","dischargePlan",v)} multiline minRows={6}/></Stack></PageCard>;
      case "gg": return <PageCard title="Section GG" help="Educational reference only. This is not an official MDS or billing form."><Stack spacing={1.5}>{([["eating","Eating"],["oralHygiene","Oral hygiene"],["toiletingHygiene","Toileting hygiene"],["showerBathing","Shower / bathing"],["upperBodyDressing","Upper-body dressing"],["lowerBodyDressing","Lower-body dressing"],["footwear","Footwear"],["rolling","Rolling"],["sitToLying","Sit to lying"],["lyingToSitting","Lying to sitting"],["sitToStand","Sit to stand"],["chairBedTransfer","Chair / bed transfer"],["toiletTransfer","Toilet transfer"],["walking10Feet","Walking 10 feet"],["walking50FeetTurn","Walking 50 feet with turns"],["stairs","Stairs"]] as const).map(([key,label])=><SelectField key={key} label={label} value={f.sectionGG[key]} options={GG_OPTIONS.map(x=>x.label)} disabled={!!disabled} onChange={v=>updateSection("sectionGG",key,GG_OPTIONS.find(x=>x.label===v)?.code ?? "")}/>)}<Field label="Section GG notes / reasoning" value={f.sectionGG.ggNotes} disabled={!!disabled} onChange={v=>updateSection("sectionGG","ggNotes",v)} multiline minRows={6}/></Stack></PageCard>;
      case "review": return <PageCard title="Review / Attestation">
        {evaluation.status === "submitted" ? (
          <Alert severity="success">
            <Typography fontWeight={700}>Evaluation submitted</Typography>
            <Typography>This evaluation is now read-only. You can review the completed evaluation using the navigation.</Typography>
          </Alert>
        ) : (
          <Alert severity="info">Review your work before submitting. Once submitted, this evaluation becomes read-only.</Alert>
        )}
        <Typography>Progress: {progress}%</Typography>
        <LinearProgress variant="determinate" value={progress}/>
        <Field label="Student name" value={f.signatureAttestation.studentName} disabled={!!disabled} onChange={v=>updateSection("signatureAttestation","studentName",v)}/>
        <Field label="Credentials / role" value={f.signatureAttestation.credentials} disabled={!!disabled} onChange={v=>updateSection("signatureAttestation","credentials",v)}/>
        <FormControlLabel
          control={<Checkbox checked={f.signatureAttestation.attestation} disabled={!!disabled} onChange={e=>updateSection("signatureAttestation","attestation",e.target.checked)}/>}
          label="I attest that this is my educational evaluation work based on a fictional case and that I believe that the Detroit Lions will win the superbowl"
        />
        {evaluation.status === "submitted" ? (
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">Resume code: {evaluation.resumeCode}</Typography>
            <Button variant="outlined" onClick={startNewEvaluation}>Start New Evaluation</Button>
          </Stack>
        ) : (
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={() => {
              if (!f.signatureAttestation.attestation) {
                setMessage("Complete the attestation before submitting.");
                return;
              }
              setSubmitDialogOpen(true);
            }}
            disabled={!!disabled}
          >
            Submit Evaluation
          </Button>
        )}
      </PageCard>;
    }
  }

  if (screen === "evaluation" && evaluation) return <Container maxWidth="xl" sx={{ py: 3 }}><Stack spacing={2}>
    <Stack direction={{xs:"column",lg:"row"}} spacing={2} alignItems={{xs:"flex-start",lg:"center"}} justifyContent="space-between"><Box><Typography variant="h4" fontWeight={800}>SNF OT Initial Evaluation</Typography><Typography color="text.secondary">Student: {evaluation.studentName} · Resume code: {evaluation.resumeCode}</Typography></Box><Chip label={evaluation.status === "submitted" ? "Submitted" : "Draft"}/></Stack>
    <LinearProgress variant="determinate" value={progress}/>
    <Stack direction={{xs:"column",md:"row"}} spacing={3} alignItems="flex-start">
      <Card sx={{ width:{xs:"100%",md:260}, position:{md:"sticky"}, top:{md:16} }}><CardContent><Typography fontWeight={700} sx={{mb:1}}>Evaluation sections</Typography><Stack spacing={0.5}>{PAGES.map(([id,title],i)=><Button key={id} fullWidth sx={{justifyContent:"flex-start",textAlign:"left"}} variant={page===id?"contained":"text"} onClick={()=>setPage(id as PageId)}>{i+1}. {title}</Button>)}</Stack></CardContent></Card>
      <Box sx={{ flex:1, minWidth:0 }}>{renderPage()}<Stack direction="row" justifyContent="space-between" sx={{mt:2}}><Button disabled={PAGES.findIndex(p=>p[0]===page)===0} onClick={()=>setPage(PAGES[PAGES.findIndex(p=>p[0]===page)-1][0])}>Previous</Button><Button disabled={PAGES.findIndex(p=>p[0]===page)===PAGES.length-1} variant="contained" onClick={()=>setPage(PAGES[PAGES.findIndex(p=>p[0]===page)+1][0])}>Next</Button></Stack></Box>
    </Stack>
    {message && <Alert severity={message.includes("saved") || message.includes("submitted") ? "success" : "error"}>{message}</Alert>}
    <Stack direction={{xs:"column-reverse",sm:"row"}} spacing={1.5} justifyContent="space-between">
      <Button variant="text" onClick={startNewEvaluation} disabled={busy}>Home / Exit</Button>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button variant="outlined" onClick={() => evaluation && exportEvaluationPdf(evaluation)} disabled={!evaluation || busy}>
          Download PDF
        </Button>
        <Button variant="outlined" onClick={saveDraft} disabled={!!disabled}>Save Draft</Button>
      </Stack>
    </Stack>

    <Dialog open={submitDialogOpen} onClose={() => !busy && setSubmitDialogOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Submit Evaluation?</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography>
            Once you submit this evaluation, it will be saved to Firebase and become read-only.
          </Typography>
          <Typography color="text.secondary">
            You will still be able to review the completed evaluation, but you will not be able to edit it.
          </Typography>
          <Alert severity="warning">
            Make sure you have reviewed your documentation before submitting.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setSubmitDialogOpen(false)} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={submitEvaluation} disabled={busy}>Submit Evaluation</Button>
      </DialogActions>
    </Dialog>
  </Stack></Container>;

  return <Container maxWidth="sm" sx={{py:8}}><Stack spacing={3}><Box><Typography variant="h3" fontWeight={800}>SNF OT Evaluation</Typography><Typography variant="h6" color="text.secondary">Interactive teaching and practice tool for SNF OT initial evaluations.</Typography></Box><Alert severity="info"><Typography fontWeight={700}>Educational Demonstration</Typography><Typography variant="body2" sx={{mt:0.5}}>This is an early prototype designed to demonstrate the workflow and documentation structure of a skilled nursing facility occupational therapy initial evaluation. All patient information is fictional. Some features, including save/resume functionality, are still undergoing testing and refinement.</Typography></Alert><Card><CardContent><Stack spacing={2}><Typography variant="h5">Start a blank evaluation</Typography><Field label="Student name" value={studentName} disabled={busy} onChange={setStudentName}/><Button variant="contained" size="large" onClick={startEvaluation} disabled={busy}>Start Evaluation</Button></Stack></CardContent></Card><Divider>OR</Divider><Card><CardContent><Stack spacing={2}><Typography variant="h5">Resume an evaluation</Typography><Field label="Resume code" value={resumeCode} disabled={busy} onChange={v=>setResumeCode(v.toUpperCase())}/><Button variant="outlined" size="large" onClick={resumeEvaluation} disabled={busy}>Resume Evaluation</Button></Stack></CardContent></Card>{message&&<Alert severity="error">{message}</Alert>}</Stack></Container>;
}