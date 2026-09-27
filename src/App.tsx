import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, Container, Divider,
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

export default function App() {
  const [screen, setScreen] = useState<"home" | "evaluation">("home");
  const [page, setPage] = useState<PageId>("patient");
  const [studentName, setStudentName] = useState("");
  const [resumeCode, setResumeCode] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [goalDraft, setGoalDraft] = useState<OTGoal>(blankGoal());
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

  async function saveDraft() {
    if (!evaluation) return;
    setBusy(true); setMessage("");
    try { const next = { ...evaluation, updatedAt: new Date().toISOString() }; setEvaluation(next); await saveEvaluation(next); setMessage("Draft saved to Firebase."); }
    catch (e) { console.error(e); setMessage("Draft could not be saved."); } finally { setBusy(false); }
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
      </Stack></PageCard>;
      case "profile": return <PageCard title="Occupational Profile" help="Write a concise occupational profile rather than completing separate prompts for roles, routines, interests, and concerns."><Field label="Occupational Profile / Patient Summary" value={f.occupationalProfile.summary} disabled={!!disabled} onChange={v => updateSection("occupationalProfile","summary",v)} multiline minRows={14} placeholder="Describe the patient's roles, routines, interests, meaningful occupations, occupational concerns, relevant history, and patient priorities." /></PageCard>;
      case "environment": return <PageCard title="Environment" help="Describe the physical and social environment that may support or limit occupational performance. Keep the main documentation here as one concise environmental narrative.">
        <Field label="Environment / Home Setup" value={f.environmentPLOF.priorLivingEnvironment} disabled={!!disabled} onChange={v => updateSection("environmentPLOF","priorLivingEnvironment",v)} multiline minRows={12} placeholder="Describe the prior living setting, layout, stairs, bathroom setup, accessibility, caregiver/support availability, routines or environmental demands, and other contextual factors relevant to occupational performance." />
        <Field label="Current equipment / DME / assistive devices (list)" value={f.environmentPLOF.equipment} disabled={!!disabled} onChange={v => updateSection("environmentPLOF","equipment",v)} placeholder="Example: rolling walker, shower chair, grab bars, wheelchair." />
      </PageCard>;
      case "function": return <PageCard title="Performance" help="Document the patient's prior and current assistance levels for each occupation. PLOF is captured here functionally rather than as a separate narrative."><Stack spacing={1.5}>{ADLS.map(([key,label]) => <Card variant="outlined" key={key}><CardContent><Stack spacing={1.5}><Typography variant="h6">{label}</Typography><Stack direction={{ xs:"column", sm:"row" }} spacing={1.5}><SelectField label="PLOF" value={f.adlStatus.plof[key]} options={ASSISTANCE_OPTIONS} disabled={!!disabled} onChange={v => updateNestedADL("plof",key,v)} /><SelectField label="Current level" value={f.adlStatus.current[key]} options={ASSISTANCE_OPTIONS} disabled={!!disabled} onChange={v => updateNestedADL("current",key,v)} /></Stack></Stack></CardContent></Card>)}</Stack><Field label="Current occupational performance / functional observations" value={f.adlStatus.observations} disabled={!!disabled} onChange={v => updateSection("adlStatus","observations",v)} multiline minRows={8} /><Stack direction={{ xs:"column", sm:"row" }} spacing={1.5}><Field label="Activity tolerance" value={f.adlStatus.activityTolerance} disabled={!!disabled} onChange={v => updateSection("adlStatus","activityTolerance",v)} /><Field label="Cueing needed" value={f.adlStatus.cueingNeeded} disabled={!!disabled} onChange={v => updateSection("adlStatus","cueingNeeded",v)} /></Stack><Field label="Safety awareness" value={f.adlStatus.safetyAwareness} disabled={!!disabled} onChange={v => updateSection("adlStatus","safetyAwareness",v)} multiline /></PageCard>;
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
        const updateGoalDraft = (field: keyof OTGoal, value: string) => setGoalDraft(g => ({ ...g, [field]: value }));
        const baseline = goalDraft.occupation ? { plof: f.adlStatus.plof[goalDraft.occupation], current: f.adlStatus.current[goalDraft.occupation] } : { plof: "", current: "" };
        const draftWithBaseline = { ...goalDraft, plof: baseline.plof || goalDraft.plof, current: baseline.current || goalDraft.current };
        const preview = buildGoalStatement(draftWithBaseline);
        function addGoal() {
          if (!goalDraft.occupation || !goalDraft.target || !goalDraft.timeframe || !goalDraft.performanceProblem.trim()) {
            setMessage("Complete occupation, target level, functional problem, and timeframe before adding the goal.");
            return;
          }
          const finalGoal: OTGoal = { ...draftWithBaseline, id: crypto.randomUUID(), goalStatement: goalDraft.goalStatement.trim() || preview };
          const nextGoals = [...goals, finalGoal];
          updateGoals(nextGoals);
          setGoalDraft(blankGoal());
          setMessage("");
        }
        function removeGoal(id: string) {
          const nextGoals = goals.filter(g => g.id !== id);
          updateGoals(nextGoals);
        }
        return <PageCard title="Goals" help="Build measurable, occupation-based goals from the patient's documented baseline. AOTA guidance emphasizes client-centered, measurable goals and linking functional findings to occupational performance.">
          <Alert severity="info">Start with the occupation, review the patient's PLOF and current level, then choose a realistic target and define how progress will be measured.</Alert>
          <Typography variant="h6">Overall occupational goal</Typography>
          <Field label="What meaningful outcome is the patient working toward?" value={f.goalsPlanOfCare.overallGoal} disabled={!!disabled} onChange={v=>updateSection("goalsPlanOfCare","overallGoal",v)} multiline minRows={3} placeholder="Example: Return to completing morning self-care with the least amount of assistance needed for a safe discharge home." />
          <Divider />
          <Typography variant="h6">Guided SMART goal builder</Typography>
          <Stack direction={{xs:"column",sm:"row"}} spacing={1.5}>
            <SelectField label="Goal type" value={goalDraft.type} options={GOAL_TYPES} disabled={!!disabled} onChange={v=>updateGoalDraft("type",v)} />
            <SelectField label="Occupation / activity" value={goalDraft.occupation} options={ADLS.map(([key,label])=>key + " — " + label)} disabled={!!disabled} onChange={v=>updateGoalDraft("occupation",v.split(" — ")[0])} />
          </Stack>
          {goalDraft.occupation && <Card variant="outlined"><CardContent><Stack spacing={1}><Typography fontWeight={700}>{ADLS.find(([key])=>key===goalDraft.occupation)?.[1]} baseline</Typography><Typography>PLOF: <strong>{baseline.plof || "Not documented"}</strong></Typography><Typography>Current: <strong>{baseline.current || "Not documented"}</strong></Typography><Typography color="text.secondary">Use the current level as the baseline for the goal; PLOF provides context for the patient's prior function.</Typography></Stack></CardContent></Card>}
          <SelectField label="Target assistance / performance level" value={goalDraft.target} options={ASSISTANCE_OPTIONS.filter(x=>x !== "" && x !== "Not Assessed" && x !== "Not Applicable")} disabled={!!disabled} onChange={v=>updateGoalDraft("target",v)} />
          <Field label="Functional performance problem / why this goal matters" value={goalDraft.performanceProblem} disabled={!!disabled} onChange={v=>updateGoalDraft("performanceProblem",v)} multiline minRows={3} placeholder="Example: improve independence with morning self-care for safe discharge home." />
          <Field label="Condition / context / cueing" value={goalDraft.condition} disabled={!!disabled} onChange={v=>updateGoalDraft("condition",v)} placeholder="Example: using adaptive equipment and no more than 1 verbal cue." />
          <Field label="Measurable criterion" value={goalDraft.measurableCriterion} disabled={!!disabled} onChange={v=>updateGoalDraft("measurableCriterion",v)} placeholder="Example: in 4 out of 5 observed opportunities." />
          <SelectField label="Timeframe" value={goalDraft.timeframe} options={GOAL_TIMEFRAMES} disabled={!!disabled} onChange={v=>updateGoalDraft("timeframe",v)} />
          <Card variant="outlined"><CardContent><Stack spacing={1.5}><Typography fontWeight={700}>Goal preview</Typography><Typography>{preview || "Complete the occupation and target fields to preview the goal."}</Typography><Field label="Final goal statement" value={goalDraft.goalStatement || preview} disabled={!!disabled} onChange={v=>updateGoalDraft("goalStatement",v)} multiline minRows={4} /><Button variant="contained" onClick={addGoal} disabled={!!disabled}>Add Goal</Button></Stack></CardContent></Card>
          <Divider />
          <Typography variant="h6">Goals in this evaluation</Typography>
          {goals.length === 0 ? <Typography color="text.secondary">No goals added yet.</Typography> : <Stack spacing={1.5}>{goals.map((goal,index)=><Card variant="outlined" key={goal.id || index}><CardContent><Stack spacing={1}><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography fontWeight={700}>{goal.type} Goal {index+1}</Typography><Button color="error" size="small" onClick={()=>removeGoal(goal.id)}>Remove</Button></Stack><Typography>{goal.goalStatement}</Typography><Typography variant="body2" color="text.secondary">{goal.occupation} · Baseline: {goal.current || "Not documented"} · Target: {goal.target || "Not documented"} · {goal.timeframe || "No timeframe"}</Typography></Stack></CardContent></Card>)}</Stack>}
        </PageCard>;
      }
      case "plan": return <PageCard title="Plan of Care"><Stack spacing={2}><Stack direction={{xs:"column",sm:"row"}} spacing={1.5}><Field label="Frequency" value={f.goalsPlanOfCare.frequency} disabled={!!disabled} onChange={v=>updateSection("goalsPlanOfCare","frequency",v)} /><Field label="Duration" value={f.goalsPlanOfCare.duration} disabled={!!disabled} onChange={v=>updateSection("goalsPlanOfCare","duration",v)} /></Stack><Typography fontWeight={600}>Planned skilled interventions</Typography>{INTERVENTIONS.map(i=><FormControlLabel key={i} control={<Checkbox checked={f.goalsPlanOfCare.treatmentInterventions.includes(i)} disabled={!!disabled} onChange={e=>updateSection("goalsPlanOfCare","treatmentInterventions",e.target.checked?[...f.goalsPlanOfCare.treatmentInterventions,i]:f.goalsPlanOfCare.treatmentInterventions.filter(x=>x!==i))}/>} label={i}/>)}<Field label="Patient / caregiver education" value={f.goalsPlanOfCare.patientCaregiverEducation} disabled={!!disabled} onChange={v=>updateSection("goalsPlanOfCare","patientCaregiverEducation",v)} multiline minRows={6}/><Field label="Discharge planning / anticipated disposition" value={f.goalsPlanOfCare.dischargePlan} disabled={!!disabled} onChange={v=>updateSection("goalsPlanOfCare","dischargePlan",v)} multiline minRows={6}/></Stack></PageCard>;
      case "gg": return <PageCard title="Section GG" help="Educational reference only. This is not an official MDS or billing form."><Stack spacing={1.5}>{([["eating","Eating"],["oralHygiene","Oral hygiene"],["toiletingHygiene","Toileting hygiene"],["showerBathing","Shower / bathing"],["upperBodyDressing","Upper-body dressing"],["lowerBodyDressing","Lower-body dressing"],["footwear","Footwear"],["rolling","Rolling"],["sitToLying","Sit to lying"],["lyingToSitting","Lying to sitting"],["sitToStand","Sit to stand"],["chairBedTransfer","Chair / bed transfer"],["toiletTransfer","Toilet transfer"],["walking10Feet","Walking 10 feet"],["walking50FeetTurn","Walking 50 feet with turns"],["stairs","Stairs"]] as const).map(([key,label])=><SelectField key={key} label={label} value={f.sectionGG[key]} options={GG_OPTIONS.map(x=>x.label)} disabled={!!disabled} onChange={v=>updateSection("sectionGG",key,GG_OPTIONS.find(x=>x.label===v)?.code ?? "")}/>)}<Field label="Section GG notes / reasoning" value={f.sectionGG.ggNotes} disabled={!!disabled} onChange={v=>updateSection("sectionGG","ggNotes",v)} multiline minRows={6}/></Stack></PageCard>;
      case "review": return <PageCard title="Review / Attestation"><Alert severity="info">This blank evaluation is intentionally open-ended. Use the navigation to move between sections before saving or submitting.</Alert><Typography>Progress: {progress}%</Typography><LinearProgress variant="determinate" value={progress}/><Field label="Student name" value={f.signatureAttestation.studentName} disabled={!!disabled} onChange={v=>updateSection("signatureAttestation","studentName",v)}/><Field label="Credentials / role" value={f.signatureAttestation.credentials} disabled={!!disabled} onChange={v=>updateSection("signatureAttestation","credentials",v)}/><FormControlLabel control={<Checkbox checked={f.signatureAttestation.attestation} disabled={!!disabled} onChange={e=>updateSection("signatureAttestation","attestation",e.target.checked)}/>} label="I attest that this is my educational evaluation work based on a fictional case and that I believe that the Detroit Lions will win the superbowl" /></PageCard>;
    }
  }

  if (screen === "evaluation" && evaluation) return <Container maxWidth="xl" sx={{ py: 3 }}><Stack spacing={2}>
    <Stack direction={{xs:"column",lg:"row"}} spacing={2} alignItems={{xs:"flex-start",lg:"center"}} justifyContent="space-between"><Box><Typography variant="h4" fontWeight={800}>SNF OT Initial Evaluation</Typography><Typography color="text.secondary">Student: {evaluation.studentName} · Resume code: {evaluation.resumeCode}</Typography></Box><Chip label={evaluation.status === "submitted" ? "Submitted" : "Draft"}/></Stack>
    <LinearProgress variant="determinate" value={progress}/>
    <Stack direction={{xs:"column",md:"row"}} spacing={3} alignItems="flex-start">
      <Card sx={{ width:{xs:"100%",md:260}, position:{md:"sticky"}, top:{md:16} }}><CardContent><Typography fontWeight={700} sx={{mb:1}}>Evaluation sections</Typography><Stack spacing={0.5}>{PAGES.map(([id,title],i)=><Button key={id} fullWidth sx={{justifyContent:"flex-start",textAlign:"left"}} variant={page===id?"contained":"text"} onClick={()=>setPage(id as PageId)}>{i+1}. {title}</Button>)}</Stack></CardContent></Card>
      <Box sx={{ flex:1, minWidth:0 }}>{renderPage()}<Stack direction="row" justifyContent="space-between" sx={{mt:2}}><Button disabled={PAGES.findIndex(p=>p[0]===page)===0} onClick={()=>setPage(PAGES[PAGES.findIndex(p=>p[0]===page)-1][0])}>Previous</Button><Button disabled={PAGES.findIndex(p=>p[0]===page)===PAGES.length-1} variant="contained" onClick={()=>setPage(PAGES[PAGES.findIndex(p=>p[0]===page)+1][0])}>Next</Button></Stack></Box>
    </Stack>
    {message && <Alert severity={message.includes("saved") ? "success" : "error"}>{message}</Alert>}
    <Stack direction="row" justifyContent="flex-end"><Button variant="outlined" onClick={saveDraft} disabled={!!disabled}>Save Draft</Button></Stack>
  </Stack></Container>;

  return <Container maxWidth="sm" sx={{py:8}}><Stack spacing={3}><Box><Typography variant="h3" fontWeight={800}>SNF OT Evaluation</Typography><Typography variant="h6" color="text.secondary">Interactive teaching and practice tool for SNF OT initial evaluations.</Typography></Box><Card><CardContent><Stack spacing={2}><Typography variant="h5">Start a blank evaluation</Typography><Field label="Student name" value={studentName} disabled={busy} onChange={setStudentName}/><Button variant="contained" size="large" onClick={startEvaluation} disabled={busy}>Start Evaluation</Button></Stack></CardContent></Card><Divider>OR</Divider><Card><CardContent><Stack spacing={2}><Typography variant="h5">Resume an evaluation</Typography><Field label="Resume code" value={resumeCode} disabled={busy} onChange={v=>setResumeCode(v.toUpperCase())}/><Button variant="outlined" size="large" onClick={resumeEvaluation} disabled={busy}>Resume Evaluation</Button></Stack></CardContent></Card>{message&&<Alert severity="error">{message}</Alert>}</Stack></Container>;
}
