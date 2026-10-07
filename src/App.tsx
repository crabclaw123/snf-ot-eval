import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  FormControl, FormControlLabel, InputLabel, LinearProgress, MenuItem, Select,
  Stack, TextField, Typography,
} from "@mui/material";
import type { AssistanceLevel, Evaluation, EvaluationFormData, FindingStatus, OTGoal, SectionGGCode } from "./types";
import { createEmptyFormData, normalizeEvaluation, MOVEMENTS } from "./types";
import { ensureAnonymousAuth, generateResumeCode, getLastCode, loadEvaluation, saveEvaluation } from "./storage";
import ProgressNoteScreen from "./ProgressNote";
import GoalBuilderDialog from "./GoalBuilderDialog";
import { MMT_LEVELS, formatSourceFinding, parseFindingContext } from "./goalBuilderLogic";

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
const INTERVENTIONS = ["ADL retraining", "Functional mobility / transfer training", "Therapeutic exercise", "Therapeutic activity", "Balance training", "Cognitive / compensatory strategy training", "Neuromuscular re-education", "Energy conservation", "Adaptive equipment training", "Caregiver education", "Discharge planning"];
const GG_OPTIONS: { code: SectionGGCode; label: string }[] = [
  { code: "06", label: "06 — Independent" }, { code: "05", label: "05 — Setup or clean-up assistance" },
  { code: "04", label: "04 — Supervision or touching assistance" }, { code: "03", label: "03 — Partial/moderate assistance" },
  { code: "02", label: "02 — Substantial/maximal assistance" }, { code: "01", label: "01 — Dependent" },
  { code: "09", label: "09 — Not applicable / not attempted" }, { code: "88", label: "88 — Not attempted due to medical/safety concern" },
];

function blankGoal(): OTGoal {
  return { id: "", type: "Short-term", occupation: "", plof: "", current: "", target: "", performanceProblem: "", condition: "", measurableCriterion: "", timeframe: "", targetDate: "", goalStatement: "" };
}

const ADLS: [string, string][] = [
  ["eating", "Eating"], ["grooming", "Grooming"], ["bathing", "Bathing"], ["upperBodyDressing", "Upper-body dressing"],
  ["lowerBodyDressing", "Lower-body dressing"], ["toileting", "Toileting"], ["toiletTransfer", "Toilet transfer"],
  ["showerTransfer", "Shower transfer"], ["bedMobility", "Bed mobility"], ["transfers", "Transfers"], ["functionalMobility", "Functional mobility / ambulation"],
];
function Field({ label, value, onChange, disabled, multiline = false, minRows = 3, placeholder, type }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean; multiline?: boolean; minRows?: number; placeholder?: string; type?: string }) {
  return <TextField fullWidth label={label} type={type} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} multiline={multiline} minRows={multiline ? minRows : undefined} placeholder={placeholder} InputLabelProps={type === "date" ? { shrink: true } : undefined} />;
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
      if (goal.sourceType && goal.sourceType !== "Functional") addField("Source finding", formatSourceFinding(goal));
      addField("Baseline", goal.current);
      addField("Target", goal.target);
      addField("Condition", goal.condition);
      addField("Measurement", goal.measurableCriterion);
      addField("Timeframe", goal.timeframe);
      addField("Target date", goal.targetDate || "Not documented");
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
  const [screen, setScreen] = useState<"home" | "evaluation" | "progress" | "progressResume">("home");
  const [page, setPage] = useState<PageId>("patient");
  const [studentName, setStudentName] = useState("");
  const [resumeCode, setResumeCode] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [goalWizardOpen, setGoalWizardOpen] = useState(false);
  const [goalWizardStep, setGoalWizardStep] = useState(0);
  const [goalDraft, setGoalDraft] = useState<OTGoal>(blankGoal());
  const [goalContext, setGoalContext] = useState("");

  const progress = useMemo(() => evaluation ? Math.round(((PAGES.findIndex(p => p[0] === page) + 1) / PAGES.length) * 100) : 0, [evaluation, page]);
  const disabled = evaluation?.status === "submitted";

  useEffect(() => { ensureAnonymousAuth().catch(console.error); }, []);

  function startEvaluation() {
    if (!studentName.trim()) { setMessage("Please enter your name."); return; }
    const now = new Date().toISOString();
    setEvaluation({ id: crypto.randomUUID(), resumeCode: generateResumeCode(), studentName: studentName.trim(), status: "draft", createdAt: now, updatedAt: now, formData: createEmptyFormData(studentName.trim()) });
    setPage("patient"); setScreen("evaluation"); setMessage("");
  }
  async function resumeEvaluation() {
    if (!resumeCode.trim()) { setMessage("Please enter a resume code."); return; }
    setBusy(true);
    try { const found = await loadEvaluation(resumeCode); if (!found) setMessage("No evaluation found for that code."); else { setEvaluation(normalizeEvaluation(found)); setPage("patient"); setScreen("evaluation"); setMessage(""); } }
    catch { setMessage("Could not load evaluation."); }
    finally { setBusy(false); }
  }
  function startNewEvaluation() { setEvaluation(null); setStudentName(""); setResumeCode(""); setPage("patient"); setScreen("home"); setMessage(""); }

  function updateSection<K extends keyof EvaluationFormData>(section: K, key: keyof EvaluationFormData[K], value: unknown) {
    if (!evaluation || evaluation.status === "submitted") return;
    const current = evaluation.formData[section] as Record<string, unknown>;
    const next = { ...evaluation, updatedAt: new Date().toISOString(), formData: { ...evaluation.formData, [section]: { ...current, [key]: value } } } as Evaluation;
    setEvaluation(next); localStorage.setItem("snf-ot-eval:" + next.resumeCode, JSON.stringify(next));
  }
  function updateNestedADL(group: "plof" | "current", key: string, value: string) {
    if (!evaluation || evaluation.status === "submitted") return;
    const next = { ...evaluation, updatedAt: new Date().toISOString(), formData: { ...evaluation.formData, adlStatus: { ...evaluation.formData.adlStatus, [group]: { ...evaluation.formData.adlStatus[group], [key]: value } } } } as Evaluation;
    setEvaluation(next); localStorage.setItem("snf-ot-eval:" + next.resumeCode, JSON.stringify(next));
  }
  function updateFindingSection(section: "rom" | "strength", side: "right" | "left", movement: string, field: string, value: string) {
    if (!evaluation || evaluation.status === "submitted") return;
    const current = evaluation.formData[section];
    const next = {
      ...evaluation,
      updatedAt: new Date().toISOString(),
      formData: {
        ...evaluation.formData,
        [section]: {
          ...current,
          [side]: {
            ...current[side],
            [movement]: {
              ...current[side][movement],
              [field]: value,
            },
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
        },
      },
    } as Evaluation;
    setEvaluation(next);
    localStorage.setItem("snf-ot-eval:" + next.resumeCode, JSON.stringify(next));
  }
  function openGoalBuilder(seed?: Partial<OTGoal>, context = "") {
    if (!evaluation || evaluation.status === "submitted") return;
    setGoalDraft({ ...blankGoal(), ...(seed || {}) });
    setGoalContext(context);
    setGoalWizardStep(0);
    setGoalWizardOpen(true);
  }
  async function saveDraft() { if (!evaluation) return; setBusy(true); try { await saveEvaluation(evaluation); setMessage("Draft saved. Resume code: " + evaluation.resumeCode); } catch { setMessage("Could not save draft."); } finally { setBusy(false); } }
  async function submitEvaluation() { if (!evaluation) return; const next = { ...evaluation, status: "submitted" as const, updatedAt: new Date().toISOString() }; setBusy(true); try { await saveEvaluation(next); setEvaluation(next); setSubmitDialogOpen(false); setMessage("Evaluation submitted. Resume code: " + next.resumeCode); } catch { setMessage("Could not submit evaluation."); } finally { setBusy(false); } }

  function renderFindingPage(section: "rom" | "strength") {
    const f = evaluation!.formData; const values = f[section];
    return <PageCard title={section === "rom" ? "Range of Motion" : "Strength"} help={section === "rom" ? "Use a quick clinical classification for each movement. Enter degrees only when a finding is impaired and the exact measurement is relevant." : "Use a quick clinical classification for each movement. Enter MMT only when strength is impaired and the exact grade is relevant."}><Stack spacing={2}>{MOVEMENTS.map(movement => <Box key={movement}><Typography variant="h6" sx={{mb:1}}>{movement}</Typography><Stack direction={{xs:"column",lg:"row"}} spacing={1.5}>{(["right","left"] as const).map(side => { const item = values[side][movement]; const status = item.status; const context = `${side === "right" ? "Right" : "Left"} ${movement} — ${status || "Not assessed"}${section === "rom" ? `; AROM: ${"arom" in item && item.arom ? item.arom + "°" : "not documented"}, PROM: ${"prom" in item && item.prom ? item.prom + "°" : "not documented"}` : `; MMT: ${"mmt" in item && item.mmt ? item.mmt : "not documented"}`}`; return <Card key={side} variant="outlined" sx={{flex:1}}><CardContent><Stack spacing={1.5}><Typography fontWeight={700}>{side === "right" ? "Right" : "Left"}</Typography><SelectField label="Finding" value={status} options={FINDING_OPTIONS} disabled={!!disabled} onChange={v=>updateNested(section,side,movement,"status",v)} />{status === "Impaired" && <>{section === "rom" ? <><Stack direction={{xs:"column",sm:"row"}} spacing={1.5}><Field label="AROM (degrees)" value={"arom" in item ? item.arom : ""} disabled={!!disabled} onChange={v=>updateNested(section,side,movement,"arom",v)} /><Field label="PROM (degrees)" value={"prom" in item ? item.prom : ""} disabled={!!disabled} onChange={v=>updateNested(section,side,movement,"prom",v)} /></Stack><Field label="Notes / pain / end feel" value={item.notes} disabled={!!disabled} onChange={v=>updateNested(section,side,movement,"notes",v)} multiline /></> : <><Field label="MMT grade" value={"mmt" in item ? item.mmt : ""} disabled={!!disabled} onChange={v=>updateNested(section,side,movement,"mmt",v)} /><Field label="Notes" value={item.notes} disabled={!!disabled} onChange={v=>updateNested(section,side,movement,"notes",v)} multiline /></>}<Button variant="outlined" size="small" disabled={!!disabled} onClick={()=>openGoalBuilder(parseFindingContext(context), context)}>Build Goal From This Finding</Button></>}</Stack></CardContent></Card>; })}</Stack></Box>)}<Field label={`${section === "rom" ? "ROM" : "Strength"} summary / clinical notes`} value={values.notes} disabled={!!disabled} onChange={v=>updateSection(section,"notes",v)} multiline minRows={7} /></Stack></PageCard>;
  }

  function renderPage() {
    const f = evaluation!.formData;
    switch (page) {
      case "patient": return <PageCard title="Patient / Referral"><Stack spacing={1.5}><Field label="Patient name" value={f.patientInfo.patientName} disabled={!!disabled} onChange={v=>updateSection("patientInfo","patientName",v)} /><Stack direction={{xs:"column",sm:"row"}} spacing={1.5}><Field label="Medical record number" value={f.patientInfo.medicalRecordNumber} disabled={!!disabled} onChange={v=>updateSection("patientInfo","medicalRecordNumber",v)} /><Field label="Date of birth" type="date" value={f.patientInfo.dateOfBirth} disabled={!!disabled} onChange={v=>updateSection("patientInfo","dateOfBirth",v)} /></Stack><Field label="Evaluation date" type="date" value={f.patientInfo.evaluationDate} disabled={!!disabled} onChange={v=>updateSection("patientInfo","evaluationDate",v)} /><Field label="Medical diagnosis" value={f.patientInfo.medicalDiagnosis} disabled={!!disabled} onChange={v=>updateSection("patientInfo","medicalDiagnosis",v)} /><Field label="Reason for OT referral" value={f.patientInfo.reasonForReferral} disabled={!!disabled} onChange={v=>updateSection("patientInfo","reasonForReferral",v)} multiline /><Stack direction={{xs:"column",sm:"row"}} spacing={1.5}><Field label="Weight-bearing status" value={f.medicalStatus.weightBearing} disabled={!!disabled} onChange={v=>updateSection("medicalStatus","weightBearing",v)} /><Field label="Precautions (comma-separated)" value={f.medicalStatus.precautions.join(", ")} disabled={!!disabled} onChange={v=>updateSection("medicalStatus","precautions",v.split(",").map(x=>x.trim()).filter(Boolean))} /></Stack><SelectField label="Pain rating" value={f.medicalStatus.painRating} options={["0","1","2","3","4","5","6","7","8","9","10"]} disabled={!!disabled} onChange={v=>updateSection("medicalStatus","painRating",v)} /><SelectField label="Does pain interfere with occupational participation?" value={f.medicalStatus.painInterferesOccupationalParticipation} options={["Yes","No"]} disabled={!!disabled} onChange={v=>{updateSection("medicalStatus","painInterferesOccupationalParticipation",v); if(v==="No"){updateSection("medicalStatus","painTiming","");updateSection("medicalStatus","painLocation","");updateSection("medicalStatus","painDescription","");}}} />{f.medicalStatus.painInterferesOccupationalParticipation === "Yes" && <><Field label="Pain timing / aggravating activity" value={f.medicalStatus.painTiming} disabled={!!disabled} onChange={v=>updateSection("medicalStatus","painTiming",v)} /><Field label="Pain location" value={f.medicalStatus.painLocation} disabled={!!disabled} onChange={v=>updateSection("medicalStatus","painLocation",v)} /><Field label="Pain description" value={f.medicalStatus.painDescription} disabled={!!disabled} onChange={v=>updateSection("medicalStatus","painDescription",v)} multiline /></>}<Field label="Vitals" value={f.medicalStatus.vitals} disabled={!!disabled} onChange={v=>updateSection("medicalStatus","vitals",v)} multiline /><Field label="Relevant medications" value={f.medicalStatus.medicationsRelevant} disabled={!!disabled} onChange={v=>updateSection("medicalStatus","medicationsRelevant",v)} multiline /><Field label="Lines / tubes / drains" value={f.medicalStatus.linesTubesDrains} disabled={!!disabled} onChange={v=>updateSection("medicalStatus","linesTubesDrains",v)} multiline /><Field label="Skin / wounds" value={f.medicalStatus.skinWounds} disabled={!!disabled} onChange={v=>updateSection("medicalStatus","skinWounds",v)} multiline /><Field label="Medical stability" value={f.medicalStatus.medicalStability} disabled={!!disabled} onChange={v=>updateSection("medicalStatus","medicalStability",v)} multiline /><Field label="Medical notes" value={f.medicalStatus.notes} disabled={!!disabled} onChange={v=>updateSection("medicalStatus","notes",v)} multiline /></Stack></PageCard>;
      case "profile": return <PageCard title="Occupational Profile" help="Capture the patient's story, roles, routines, priorities, values, and what matters most for discharge."><Field label="Occupational profile" value={f.occupationalProfile.summary} disabled={!!disabled} onChange={v=>updateSection("occupationalProfile","summary",v)} multiline minRows={14} placeholder="Describe roles, routines, meaningful occupations, prior independence, patient/caregiver priorities, and relevant context." /></PageCard>;
      case "environment": return <PageCard title="Environment"><Stack spacing={2}><Field label="Prior living environment" value={f.environmentPLOF.priorLivingEnvironment} disabled={!!disabled} onChange={v=>updateSection("environmentPLOF","priorLivingEnvironment",v)} multiline minRows={8} /><Field label="Current equipment / DME / assistive devices" value={f.environmentPLOF.equipment} disabled={!!disabled} onChange={v=>updateSection("environmentPLOF","equipment",v)} multiline minRows={8} /></Stack></PageCard>;
      case "function": return <PageCard title="Performance" help="Document the patient's prior and current assistance levels for each occupation. PLOF is captured here functionally rather than as a separate narrative."><Stack spacing={1.5}>{ADLS.map(([key,label]) => { const assistanceOptions = key === "functionalMobility" ? [...ASSISTANCE_OPTIONS, "Non-ambulatory"] : ASSISTANCE_OPTIONS; return <Card variant="outlined" key={key}><CardContent><Stack spacing={1.5}><Typography variant="h6">{label}</Typography><Stack direction={{ xs:"column", sm:"row" }} spacing={1.5}><SelectField label="PLOF" value={f.adlStatus.plof[key]} options={assistanceOptions} disabled={!!disabled} onChange={v => updateNestedADL("plof",key,v)} /><SelectField label="Current level" value={f.adlStatus.current[key]} options={assistanceOptions} disabled={!!disabled} onChange={v => updateNestedADL("current",key,v)} /></Stack>{f.adlStatus.current[key] && f.adlStatus.current[key] !== "Not Assessed" && f.adlStatus.current[key] !== "Not Applicable" && <Button variant="outlined" size="small" onClick={() => openGoalBuilder({ occupation: key, plof: f.adlStatus.plof[key], current: f.adlStatus.current[key], sourceType:"Functional" }, `${label} — Current level: ${f.adlStatus.current[key]}`)} disabled={!!disabled} sx={{ alignSelf: "flex-start", textTransform: "none" }}>Build Goal</Button>}</Stack></CardContent></Card>})}</Stack><Field label="Current occupational performance / functional observations" value={f.adlStatus.observations} disabled={!!disabled} onChange={v=>updateSection("adlStatus","observations",v)} multiline minRows={8} /><Stack direction={{xs:"column",sm:"row"}} spacing={1.5}><Field label="Activity tolerance" value={f.adlStatus.activityTolerance} disabled={!!disabled} onChange={v=>updateSection("adlStatus","activityTolerance",v)} /><Field label="Cueing needed" value={f.adlStatus.cueingNeeded} disabled={!!disabled} onChange={v=>updateSection("adlStatus","cueingNeeded",v)} /></Stack><Field label="Safety awareness" value={f.adlStatus.safetyAwareness} disabled={!!disabled} onChange={v=>updateSection("adlStatus","safetyAwareness",v)} multiline /></PageCard>;
      case "rom": return renderFindingPage("rom");
      case "strength": return renderFindingPage("strength");
      case "client": return <PageCard title="Cognition, Communication & Sensory Skills" help="Use quick clinical selections for orientation, cognition, communication, sensory status, and related performance factors. Use the Clinical Assessment page for narrative synthesis."><Stack spacing={2}><Typography variant="h6">Orientation</Typography><Typography color="text.secondary">Select each domain the patient is oriented to. A&O ×4 is documented when all four are selected.</Typography><Stack direction={{xs:"column",sm:"row"}} spacing={1}><FormControlLabel control={<Checkbox checked={f.clientFactors.orientedPerson} disabled={!!disabled} onChange={e=>updateSection("clientFactors","orientedPerson",e.target.checked)} />} label="Person" /><FormControlLabel control={<Checkbox checked={f.clientFactors.orientedPlace} disabled={!!disabled} onChange={e=>updateSection("clientFactors","orientedPlace",e.target.checked)} />} label="Place" /><FormControlLabel control={<Checkbox checked={f.clientFactors.orientedTime} disabled={!!disabled} onChange={e=>updateSection("clientFactors","orientedTime",e.target.checked)} />} label="Time" /><FormControlLabel control={<Checkbox checked={f.clientFactors.orientedSituation} disabled={!!disabled} onChange={e=>updateSection("clientFactors","orientedSituation",e.target.checked)} />} label="Situation" /></Stack><SelectField label="Cognitive / command-following status" value={f.clientFactors.cognition} options={["Alert / appropriate","Follows simple commands","Follows multi-step commands","Requires intermittent cues","Requires frequent cues","Inconsistent command following","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","cognition",v)} /><SelectField label="Communication" value={f.clientFactors.communication} options={["Functional verbal communication","Verbal communication with extra time","Uses communication device / alternative communication","Limited by cognition","Limited by hearing","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","communication",v)} /><Stack direction={{xs:"column",sm:"row"}} spacing={1.5}><SelectField label="Vision" value={f.clientFactors.vision} options={["Functional for observed tasks","Uses corrective lenses","Mildly impaired","Moderately impaired","Severely impaired","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","vision",v)} /><SelectField label="Hearing" value={f.clientFactors.hearing} options={["Functional for conversation","Uses hearing aids","Mildly impaired","Moderately impaired","Severely impaired","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","hearing",v)} /></Stack><Stack direction={{xs:"column",sm:"row"}} spacing={1.5}><SelectField label="Sensation" value={f.clientFactors.sensation} options={["Intact for observed tasks","Mildly impaired","Moderately impaired","Severely impaired","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","sensation",v)} /><SelectField label="Coordination" value={f.clientFactors.coordination} options={["Functional","Mildly impaired","Moderately impaired","Severely impaired","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","coordination",v)} /></Stack><Stack direction={{xs:"column",sm:"row"}} spacing={1.5}><SelectField label="Balance" value={f.clientFactors.balance} options={["Functional / independent","Mildly impaired","Moderately impaired","Severely impaired","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","balance",v)} /><SelectField label="Endurance / activity tolerance" value={f.clientFactors.endurance} options={["Functional for task","Mildly limited","Moderately limited","Severely limited","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","endurance",v)} /></Stack><SelectField label="Motor planning / praxis" value={f.clientFactors.motorPlanning} options={["Functional","Mildly impaired","Moderately impaired","Severely impaired","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","motorPlanning",v)} /><SelectField label="Functional mobility" value={f.clientFactors.functionalMobility} options={["Functional","Requires supervision / cues","Requires physical assistance","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","functionalMobility",v)} /></Stack></PageCard>;
      case "assessment": return <PageCard title="Clinical Assessment / OT Analysis" help="Synthesize the evaluation findings into one clinical narrative. Include strengths, impairments, activity limitations, participation restrictions, occupational performance problems, and why skilled OT is indicated."><Field label="Assessment / Clinical Impression" value={f.clinicalAssessment.assessmentSummary} disabled={!!disabled} onChange={v=>updateSection("clinicalAssessment","assessmentSummary",v)} multiline minRows={16} placeholder="Synthesize the relevant findings and explain their impact on occupational performance and the need for skilled OT." /><SelectField label="Rehabilitation prognosis" value={f.clinicalAssessment.prognosis} options={["Good","Fair","Guarded","Unable to determine"]} disabled={!!disabled} onChange={v=>updateSection("clinicalAssessment","prognosis",v)} /></PageCard>;
      case "goals": {
        const goals = f.goalsPlanOfCare.goals;
        const isEditing = Boolean(goalDraft.id);

        function saveGoal(finalDraft: OTGoal) {
          const finalGoal: OTGoal = {
            ...finalDraft,
            id: goalDraft.id || finalDraft.id || crypto.randomUUID(),
            targetDate: finalDraft.targetDate || "",
          };
          if (!finalGoal.occupation.trim() || !finalGoal.target.trim() || !finalGoal.performanceProblem.trim() || !finalGoal.timeframe.trim() || !finalGoal.targetDate?.trim() || !finalGoal.goalStatement.trim()) {
            setMessage("Complete the occupation, functional purpose, target, timeframe, target date, and final goal statement before saving the goal.");
            return;
          }
          const nextGoals = goalDraft.id ? goals.map(goal => goal.id === goalDraft.id ? finalGoal : goal) : [...goals, finalGoal];
          updateGoals(nextGoals);
          setGoalDraft(blankGoal());
          setGoalWizardStep(0);
          setGoalWizardOpen(false);
          setMessage("");
        }

        function editGoal(goal: OTGoal) {
          openGoalBuilder({ ...goal, targetDate: goal.targetDate || "" }, "");
        }

        function removeGoal(id: string) {
          updateGoals(goals.filter(goal => goal.id !== id));
        }

        function closeGoalBuilder() {
          setGoalWizardOpen(false);
          setGoalDraft(blankGoal());
          setGoalWizardStep(0);
          setGoalContext("");
        }

        return <PageCard title="Goals" help="Build measurable, occupation-based goals from the patient's documented baseline. The guided builder organizes the clinical reasoning first, then produces clean wording that remains fully editable.">
          <Alert severity="info">The goal builder is optional support, not a restriction. Students can use suggested phrases, enter their own wording at every step, and freely edit the complete goal before saving. ROM and strength goals remain linked to their documented source finding for future progress-note comparison.</Alert>
          <Button variant="contained" size="large" onClick={()=>openGoalBuilder()} disabled={!!disabled}>Open Guided Goal Builder</Button>

          <GoalBuilderDialog
            open={goalWizardOpen}
            disabled={!!disabled}
            draft={goalDraft}
            step={goalWizardStep}
            context={goalContext}
            evaluationDate={f.patientInfo.evaluationDate}
            adlPlof={f.adlStatus.plof}
            adlCurrent={f.adlStatus.current}
            isEditing={isEditing}
            onDraftChange={setGoalDraft}
            onStepChange={setGoalWizardStep}
            onClose={closeGoalBuilder}
            onSave={saveGoal}
          />

          <Divider /><Typography variant="h6">Goals in this evaluation</Typography>
          {goals.length === 0 ? <Typography color="text.secondary">No goals added yet.</Typography> : <Stack spacing={1.5}>{goals.map((goal,index)=><Card variant="outlined" key={goal.id || index}><CardContent><Stack spacing={1}><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography fontWeight={700}>{goal.type} Goal {index+1}</Typography><Stack direction="row" spacing={1}><Button size="small" onClick={()=>editGoal(goal)} disabled={!!disabled}>Edit</Button><Button color="error" size="small" onClick={()=>removeGoal(goal.id)} disabled={!!disabled}>Remove</Button></Stack></Stack><Typography>{goal.goalStatement}</Typography>{goal.sourceType && goal.sourceType !== "Functional" && <Typography variant="body2" color="secondary.main">Source: {formatSourceFinding(goal)}</Typography>}<Typography variant="body2" color="text.secondary">{ADLS.find(([key])=>key===goal.occupation)?.[1] || goal.occupation} · Current function: {goal.current || "Not documented"} · Target: {goal.target || "Not documented"} · {goal.timeframe || "No timeframe"} · Target date: {goal.targetDate || "Not documented"}</Typography></Stack></CardContent></Card>)}</Stack>}
        </PageCard>;
      }
      case "plan": return <PageCard title="Plan of Care"><Stack spacing={2}><Stack direction={{xs:"column",sm:"row"}} spacing={1.5}><Field label="Frequency" value={f.goalsPlanOfCare.frequency} disabled={!!disabled} onChange={v=>updateSection("goalsPlanOfCare","frequency",v)} /><Field label="Duration" value={f.goalsPlanOfCare.duration} disabled={!!disabled} onChange={v=>updateSection("goalsPlanOfCare","duration",v)} /></Stack><Typography fontWeight={600}>Planned skilled interventions</Typography>{INTERVENTIONS.map(i=><FormControlLabel key={i} control={<Checkbox checked={f.goalsPlanOfCare.treatmentInterventions.includes(i)} disabled={!!disabled} onChange={e=>updateSection("goalsPlanOfCare","treatmentInterventions",e.target.checked?[...f.goalsPlanOfCare.treatmentInterventions,i]:f.goalsPlanOfCare.treatmentInterventions.filter(x=>x!==i))}/>} label={i}/>)}<Field label="Patient / caregiver education" value={f.goalsPlanOfCare.patientCaregiverEducation} disabled={!!disabled} onChange={v=>updateSection("goalsPlanOfCare","patientCaregiverEducation",v)} multiline minRows={6}/><Field label="Discharge planning / anticipated disposition" value={f.goalsPlanOfCare.dischargePlan} disabled={!!disabled} onChange={v=>updateSection("goalsPlanOfCare","dischargePlan",v)} multiline minRows={6}/></Stack></PageCard>;
      case "gg": return <PageCard title="Section GG" help="Educational reference only. This is not an official MDS or billing form."><Stack spacing={1.5}>{([["eating","Eating"],["oralHygiene","Oral hygiene"],["toiletingHygiene","Toileting hygiene"],["showerBathing","Shower / bathing"],["upperBodyDressing","Upper-body dressing"],["lowerBodyDressing","Lower-body dressing"],["footwear","Footwear"],["rolling","Rolling"],["sitToLying","Sit to lying"],["lyingToSitting","Lying to sitting"],["sitToStand","Sit to stand"],["chairBedTransfer","Chair / bed transfer"],["toiletTransfer","Toilet transfer"],["walking10Feet","Walking 10 feet"],["walking50FeetTurn","Walking 50 feet with turns"],["stairs","Stairs"]] as const).map(([key,label])=><SelectField key={key} label={label} value={f.sectionGG[key]} options={GG_OPTIONS.map(x=>x.label)} disabled={!!disabled} onChange={v=>updateSection("sectionGG",key,GG_OPTIONS.find(x=>x.label===v)?.code ?? "")}/>)}<Field label="Section GG notes / reasoning" value={f.sectionGG.ggNotes} disabled={!!disabled} onChange={v=>updateSection("sectionGG","ggNotes",v)} multiline minRows={6}/></Stack></PageCard>;
      case "review": return <PageCard title="Review / Attestation">{evaluation.status === "submitted" ? <Alert severity="success"><Typography fontWeight={700}>Evaluation submitted</Typography><Typography>This evaluation is now read-only. You can review the completed evaluation using the navigation.</Typography></Alert> : <Alert severity="info">Review your work before submitting. Once submitted, this evaluation becomes read-only.</Alert>}<Typography>Progress: {progress}%</Typography><LinearProgress variant="determinate" value={progress}/><Field label="Student name" value={f.signatureAttestation.studentName} disabled={!!disabled} onChange={v=>updateSection("signatureAttestation","studentName",v)}/><Field label="Credentials / role" value={f.signatureAttestation.credentials} disabled={!!disabled} onChange={v=>updateSection("signatureAttestation","credentials",v)}/><FormControlLabel control={<Checkbox checked={f.signatureAttestation.attestation} disabled={!!disabled} onChange={e=>updateSection("signatureAttestation","attestation",e.target.checked)} />} label="I attest that this is my educational evaluation work based on a fictional case and that I believe that the Detroit Lions will win the superbowl" />{evaluation.status === "submitted" ? <Stack spacing={1.5}><Typography variant="body2" color="text.secondary">Resume code: {evaluation.resumeCode}</Typography><Button variant="outlined" onClick={startNewEvaluation}>Start New Evaluation</Button></Stack> : <Button variant="contained" color="primary" size="large" onClick={()=>{if(!f.signatureAttestation.attestation){setMessage("Complete the attestation before submitting.");return;}setSubmitDialogOpen(true);}} disabled={!!disabled}>Submit Evaluation</Button>}</PageCard>;
    }
  }

  if (screen === "progress" || screen === "progressResume") return <ProgressNoteScreen mode={screen === "progressResume" ? "resume" : "new"} onExit={() => { setScreen("home"); setMessage(""); }} />;
  if (screen === "evaluation" && evaluation) return <Container maxWidth="xl" sx={{ py: 3 }}><Stack spacing={2}>
    <Stack direction={{xs:"column",lg:"row"}} spacing={2} alignItems={{xs:"flex-start",lg:"center"}} justifyContent="space-between"><Box><Typography variant="h4" fontWeight={800}>SNF OT Initial Evaluation</Typography><Typography color="text.secondary">Student: {evaluation.studentName} · Resume code: {evaluation.resumeCode}</Typography></Box><Chip label={evaluation.status === "submitted" ? "Submitted" : "Draft"}/></Stack>
    <LinearProgress variant="determinate" value={progress}/>
    <Stack direction={{xs:"column",md:"row"}} spacing={3} alignItems="flex-start"><Card sx={{ width:{xs:"100%",md:260}, position:{md:"sticky"}, top:{md:16} }}><CardContent><Typography fontWeight={700} sx={{mb:1}}>Evaluation sections</Typography><Stack spacing={0.5}>{PAGES.map(([id,title],i)=><Button key={id} fullWidth sx={{justifyContent:"flex-start",textAlign:"left"}} variant={page===id?"contained":"text"} onClick={()=>setPage(id as PageId)}>{i+1}. {title}</Button>)}</Stack></CardContent></Card><Box sx={{ flex:1, minWidth:0 }}>{renderPage()}<Stack direction="row" justifyContent="space-between" sx={{mt:2}}><Button disabled={PAGES.findIndex(p=>p[0]===page)===0} onClick={()=>setPage(PAGES[PAGES.findIndex(p=>p[0]===page)-1][0])}>Previous</Button><Button disabled={PAGES.findIndex(p=>p[0]===page)===PAGES.length-1} variant="contained" onClick={()=>setPage(PAGES[PAGES.findIndex(p=>p[0]===page)+1][0])}>Next</Button></Stack></Box></Stack>
    {message && <Alert severity={message.includes("saved") || message.includes("submitted") ? "success" : "error"}>{message}</Alert>}
    <Stack direction={{xs:"column-reverse",sm:"row"}} spacing={1.5} justifyContent="space-between"><Button variant="text" onClick={startNewEvaluation} disabled={busy}>Home / Exit</Button><Stack direction={{ xs: "column", sm: "row" }} spacing={1}><Button variant="outlined" onClick={() => evaluation && exportEvaluationPdf(evaluation)} disabled={!evaluation || busy}>Download PDF</Button><Button variant="outlined" onClick={saveDraft} disabled={!!disabled}>Save Draft</Button></Stack></Stack>
    <Dialog open={submitDialogOpen} onClose={() => !busy && setSubmitDialogOpen(false)} maxWidth="sm" fullWidth><DialogTitle>Submit Evaluation?</DialogTitle><DialogContent dividers><Stack spacing={2}><Typography>Once you submit this evaluation, it will be saved to Firebase and become read-only.</Typography><Typography color="text.secondary">You will still be able to review the completed evaluation, but you will not be able to edit it.</Typography><Alert severity="warning">Make sure you have reviewed your documentation before submitting.</Alert></Stack></DialogContent><DialogActions><Button onClick={() => setSubmitDialogOpen(false)} disabled={busy}>Cancel</Button><Button variant="contained" onClick={submitEvaluation} disabled={busy}>Submit Evaluation</Button></DialogActions></Dialog>
  </Stack></Container>;

  return <Container maxWidth="sm" sx={{py:8}}><Stack spacing={3}><Box><Typography variant="h3" fontWeight={800}>SNF OT Evaluation</Typography><Typography variant="h6" color="text.secondary">Interactive teaching and practice tool for SNF OT initial evaluations.</Typography></Box><Alert severity="info"><Typography fontWeight={700}>Educational Demonstration</Typography><Typography variant="body2" sx={{mt:0.5}}>This is an early prototype designed to demonstrate the workflow and documentation structure of a skilled nursing facility occupational therapy initial evaluation. All patient information is fictional.</Typography></Alert><Card><CardContent><Stack spacing={2}><Typography variant="h5">Start a blank evaluation</Typography><Field label="Student name" value={studentName} disabled={busy} onChange={setStudentName}/><Button variant="contained" size="large" onClick={startEvaluation} disabled={busy}>Start Evaluation</Button></Stack></CardContent></Card><Card><CardContent><Stack spacing={2}><Typography variant="h5">Progress note</Typography><Typography color="text.secondary">Create a progress note from a saved initial evaluation, or resume the latest saved progress note using the same case / evaluation code.</Typography><Stack direction={{xs:"column",sm:"row"}} spacing={1}><Button fullWidth variant="contained" color="secondary" size="large" onClick={()=>{setMessage("");setScreen("progress");}}>Start Progress Note</Button><Button fullWidth variant="outlined" color="secondary" size="large" onClick={()=>{setMessage("");setScreen("progressResume");}}>Resume Progress Note</Button></Stack></Stack></CardContent></Card><Divider>OR</Divider><Card><CardContent><Stack spacing={2}><Typography variant="h5">Resume an evaluation</Typography><Field label="Resume code" value={resumeCode} disabled={busy} onChange={v=>setResumeCode(v.toUpperCase())}/><Button variant="outlined" size="large" onClick={resumeEvaluation} disabled={busy}>Resume Evaluation</Button></Stack></CardContent></Card>{message&&<Alert severity="error">{message}</Alert>}</Stack></Container>;
}
