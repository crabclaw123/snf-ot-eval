import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, Container, Divider,
  FormControl, FormControlLabel, InputLabel, LinearProgress, MenuItem, Select,
  Stack, TextField, Typography,
} from "@mui/material";
import type { AssistanceLevel, Evaluation, EvaluationFormData, FindingStatus, SectionGGCode } from "./types";
import { createEmptyFormData, normalizeEvaluation, MOVEMENTS } from "./types";
import { ensureAnonymousAuth, generateResumeCode, getLastCode, loadEvaluation, saveEvaluation } from "./storage";

const PAGES = [
  ["patient", "Patient / Referral"],
  ["profile", "Occupational Profile"],
  ["environment", "Environment"],
  ["function", "PLOF & Current Function"],
  ["rom", "ROM"],
  ["strength", "Strength"],
  ["client", "Cognition & Performance Skills"],
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
const ADLS: [string, string][] = [
  ["eating", "Eating"], ["grooming", "Grooming"], ["bathing", "Bathing"], ["upperBodyDressing", "Upper-body dressing"],
  ["lowerBodyDressing", "Lower-body dressing"], ["toileting", "Toileting"], ["toiletTransfer", "Toilet transfer"],
  ["showerTransfer", "Shower transfer"], ["bedMobility", "Bed mobility"], ["transfers", "Transfers"], ["functionalMobility", "Functional mobility / ambulation"],
];
function Field({ label, value, onChange, disabled, multiline = false, minRows = 3, placeholder }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean; multiline?: boolean; minRows?: number; placeholder?: string }) {
  return <TextField fullWidth label={label} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} multiline={multiline} minRows={multiline ? minRows : undefined} placeholder={placeholder} />;
}
function SelectField({ label, value, options, onChange, disabled }: { label: string; value: string; options: string[]; onChange: (v: string) => void; disabled: boolean }) {
  return <FormControl fullWidth disabled={disabled}><InputLabel>{label}</InputLabel><Select value={value} label={label} onChange={e => onChange(e.target.value)}>{options.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}</Select></FormControl>;
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
  const disabled = evaluation?.status === "submitted" || busy;

  useEffect(() => { const last = getLastCode(); if (last) setResumeCode(last); }, []);

  const progress = useMemo(() => {
    if (!evaluation) return 0;
    const f = evaluation.formData;
    const sections = [
      f.patientInfo.patientName || f.patientInfo.reasonForReferral, f.occupationalProfile.summary,
      f.environmentPLOF.priorLivingEnvironment || f.environmentPLOF.equipment, Object.values(f.adlStatus.current).some(v => v !== "Not Assessed"),
      Object.values(f.rom.right).some(v => v.status !== "Not Assessed") || Object.values(f.rom.left).some(v => v.status !== "Not Assessed"),
      Object.values(f.strength.right).some(v => v.status !== "Not Assessed") || Object.values(f.strength.left).some(v => v.status !== "Not Assessed"),
      Object.values(f.clientFactors).some(v => Array.isArray(v) ? v.length : v), f.clinicalAssessment.assessmentSummary,
      f.goalsPlanOfCare.shortTermGoals || f.goalsPlanOfCare.longTermGoals, f.goalsPlanOfCare.frequency || f.goalsPlanOfCare.treatmentInterventions.length,
      Object.values(f.sectionGG).some(v => v !== "09" && v !== ""), f.signatureAttestation.attestation,
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
        <FormControlLabel control={<Checkbox checked={f.medicalStatus.precautions.includes("Fall risk")} disabled={!!disabled} onChange={e => updateSection("medicalStatus","precautions",e.target.checked ? [...f.medicalStatus.precautions,"Fall risk"] : f.medicalStatus.precautions.filter(x => x !== "Fall risk"))}/>} label="Fall risk" />
        <Field label="Precautions / relevant medical considerations" value={f.medicalStatus.notes} disabled={!!disabled} onChange={v => updateSection("medicalStatus","notes",v)} multiline />
      </Stack></PageCard>;
      case "profile": return <PageCard title="Occupational Profile" help="Write a concise occupational profile rather than completing separate prompts for roles, routines, interests, and concerns."><Field label="Occupational Profile / Patient Summary" value={f.occupationalProfile.summary} disabled={!!disabled} onChange={v => updateSection("occupationalProfile","summary",v)} multiline minRows={14} placeholder="Describe the patient's roles, routines, interests, meaningful occupations, occupational concerns, relevant history, and patient priorities." /></PageCard>;
      case "environment": return <PageCard title="Environment" help="Describe the environmental context that may support or limit occupational performance. Keep this page focused on the physical and social environment; PLOF is documented with the occupations on the next page."><Field label="Prior living environment / home setup" value={f.environmentPLOF.priorLivingEnvironment} disabled={!!disabled} onChange={v => updateSection("environmentPLOF","priorLivingEnvironment",v)} multiline minRows={9} placeholder="Include setting, layout, stairs, bathroom setup, accessibility, caregiver/support availability, and other environmental factors relevant to occupational performance." /><Field label="Current equipment / DME / assistive devices" value={f.environmentPLOF.equipment} disabled={!!disabled} onChange={v => updateSection("environmentPLOF","equipment",v)} multiline minRows={7} placeholder="List current DME, adaptive equipment, mobility devices, and other supports." /></PageCard>;
      case "function": return <PageCard title="PLOF & Current Occupational Performance" help="Document the patient's prior and current assistance levels for each occupation. PLOF is captured here functionally rather than as a separate narrative."><Stack spacing={1.5}>{ADLS.map(([key,label]) => <Card variant="outlined" key={key}><CardContent><Stack spacing={1.5}><Typography variant="h6">{label}</Typography><Stack direction={{ xs:"column", sm:"row" }} spacing={1.5}><SelectField label="PLOF" value={f.adlStatus.plof[key]} options={ASSISTANCE_OPTIONS} disabled={!!disabled} onChange={v => updateNestedADL("plof",key,v)} /><SelectField label="Current level" value={f.adlStatus.current[key]} options={ASSISTANCE_OPTIONS} disabled={!!disabled} onChange={v => updateNestedADL("current",key,v)} /></Stack></Stack></CardContent></Card>)}</Stack><Field label="Current occupational performance / functional observations" value={f.adlStatus.observations} disabled={!!disabled} onChange={v => updateSection("adlStatus","observations",v)} multiline minRows={8} /><Stack direction={{ xs:"column", sm:"row" }} spacing={1.5}><Field label="Activity tolerance" value={f.adlStatus.activityTolerance} disabled={!!disabled} onChange={v => updateSection("adlStatus","activityTolerance",v)} /><Field label="Cueing needed" value={f.adlStatus.cueingNeeded} disabled={!!disabled} onChange={v => updateSection("adlStatus","cueingNeeded",v)} /></Stack><Field label="Safety awareness" value={f.adlStatus.safetyAwareness} disabled={!!disabled} onChange={v => updateSection("adlStatus","safetyAwareness",v)} multiline /></PageCard>;
      case "rom": return renderFindingPage("rom");
      case "strength": return renderFindingPage("strength");
      case "client": return <PageCard title="Cognition & Performance Skills" help="Use quick clinical selections for common examination findings. Use the Clinical Assessment page for narrative synthesis."><Stack spacing={2}>
        <Typography variant="h6">Orientation & cognition</Typography>
        <FormControlLabel control={<Checkbox checked={f.clientFactors.orientedX4} disabled={!!disabled} onChange={e=>updateSection("clientFactors","orientedX4",e.target.checked)} />} label="Alert and oriented ×4" />
        <SelectField label="Cognitive / command-following status" value={f.clientFactors.cognition} options={["Alert / appropriate","Follows simple commands","Follows multi-step commands","Requires intermittent cues","Requires frequent cues","Inconsistent command following","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","cognition",v)} />
        <SelectField label="Communication" value={f.clientFactors.communication} options={["Functional verbal communication","Verbal communication with extra time","Uses communication device / alternative communication","Limited by cognition","Limited by hearing","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","communication",v)} />
        <Stack direction={{xs:"column",sm:"row"}} spacing={1.5}><SelectField label="Vision" value={f.clientFactors.vision} options={["Functional for observed tasks","Uses corrective lenses","Mildly impaired","Moderately impaired","Severely impaired","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","vision",v)} /><SelectField label="Hearing" value={f.clientFactors.hearing} options={["Functional for conversation","Uses hearing aids","Mildly impaired","Moderately impaired","Severely impaired","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","hearing",v)} /></Stack>
        <Stack direction={{xs:"column",sm:"row"}} spacing={1.5}><SelectField label="Sensation" value={f.clientFactors.sensation} options={["Intact for observed tasks","Mildly impaired","Moderately impaired","Severely impaired","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","sensation",v)} /><SelectField label="Coordination" value={f.clientFactors.coordination} options={["Functional","Mildly impaired","Moderately impaired","Severely impaired","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","coordination",v)} /></Stack>
        <Stack direction={{xs:"column",sm:"row"}} spacing={1.5}><SelectField label="Balance" value={f.clientFactors.balance} options={["Functional / independent","Mildly impaired","Moderately impaired","Severely impaired","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","balance",v)} /><SelectField label="Endurance / activity tolerance" value={f.clientFactors.endurance} options={["Functional for task","Mildly limited","Moderately limited","Severely limited","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","endurance",v)} /></Stack>
        <SelectField label="Motor planning / praxis" value={f.clientFactors.motorPlanning} options={["Functional","Mildly impaired","Moderately impaired","Severely impaired","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","motorPlanning",v)} />
        <SelectField label="Functional mobility" value={f.clientFactors.functionalMobility} options={["Functional","Requires supervision / cues","Requires physical assistance","Unable to assess"]} disabled={!!disabled} onChange={v=>updateSection("clientFactors","functionalMobility",v)} />
        <Field label="Pain / other relevant findings" value={f.clientFactors.pain} disabled={!!disabled} onChange={v=>updateSection("clientFactors","pain",v)} />
      </Stack></PageCard>;
      case "assessment": return <PageCard title="Clinical Assessment / OT Analysis" help="Synthesize the evaluation findings into one clinical narrative. Include strengths, impairments, activity limitations, participation restrictions, occupational performance problems, and why skilled OT is indicated."><Field label="Assessment / Clinical Impression" value={f.clinicalAssessment.assessmentSummary} disabled={!!disabled} onChange={v=>updateSection("clinicalAssessment","assessmentSummary",v)} multiline minRows={16} placeholder="Synthesize the relevant findings and explain their impact on occupational performance and the need for skilled OT." /><SelectField label="Rehabilitation prognosis" value={f.clinicalAssessment.prognosis} options={["Good","Fair","Guarded","Unable to determine"]} disabled={!!disabled} onChange={v=>updateSection("clinicalAssessment","prognosis",v)} /></PageCard>;
      case "goals": return <PageCard title="Goals" help="Goals are intentionally open-ended for this first workflow pass. The guided SMART builder will be added after the core evaluation is stable."><Field label="Short-term goals" value={f.goalsPlanOfCare.shortTermGoals} disabled={!!disabled} onChange={v=>updateSection("goalsPlanOfCare","shortTermGoals",v)} multiline minRows={10} /><Field label="Long-term goals" value={f.goalsPlanOfCare.longTermGoals} disabled={!!disabled} onChange={v=>updateSection("goalsPlanOfCare","longTermGoals",v)} multiline minRows={10} /></PageCard>;
      case "plan": return <PageCard title="Plan of Care"><Stack spacing={2}><Stack direction={{xs:"column",sm:"row"}} spacing={1.5}><Field label="Frequency" value={f.goalsPlanOfCare.frequency} disabled={!!disabled} onChange={v=>updateSection("goalsPlanOfCare","frequency",v)} /><Field label="Duration" value={f.goalsPlanOfCare.duration} disabled={!!disabled} onChange={v=>updateSection("goalsPlanOfCare","duration",v)} /></Stack><Typography fontWeight={600}>Planned skilled interventions</Typography>{INTERVENTIONS.map(i=><FormControlLabel key={i} control={<Checkbox checked={f.goalsPlanOfCare.treatmentInterventions.includes(i)} disabled={!!disabled} onChange={e=>updateSection("goalsPlanOfCare","treatmentInterventions",e.target.checked?[...f.goalsPlanOfCare.treatmentInterventions,i]:f.goalsPlanOfCare.treatmentInterventions.filter(x=>x!==i))}/>} label={i}/>)}<Field label="Patient / caregiver education" value={f.goalsPlanOfCare.patientCaregiverEducation} disabled={!!disabled} onChange={v=>updateSection("goalsPlanOfCare","patientCaregiverEducation",v)} multiline minRows={6}/><Field label="Discharge planning / anticipated disposition" value={f.goalsPlanOfCare.dischargePlan} disabled={!!disabled} onChange={v=>updateSection("goalsPlanOfCare","dischargePlan",v)} multiline minRows={6}/></Stack></PageCard>;
      case "gg": return <PageCard title="Section GG" help="Educational reference only. This is not an official MDS or billing form."><Stack spacing={1.5}>{([["eating","Eating"],["oralHygiene","Oral hygiene"],["toiletingHygiene","Toileting hygiene"],["showerBathing","Shower / bathing"],["upperBodyDressing","Upper-body dressing"],["lowerBodyDressing","Lower-body dressing"],["footwear","Footwear"],["rolling","Rolling"],["sitToLying","Sit to lying"],["lyingToSitting","Lying to sitting"],["sitToStand","Sit to stand"],["chairBedTransfer","Chair / bed transfer"],["toiletTransfer","Toilet transfer"],["walking10Feet","Walking 10 feet"],["walking50FeetTurn","Walking 50 feet with turns"],["stairs","Stairs"]] as const).map(([key,label])=><SelectField key={key} label={label} value={f.sectionGG[key]} options={GG_OPTIONS.map(x=>x.label)} disabled={!!disabled} onChange={v=>updateSection("sectionGG",key,GG_OPTIONS.find(x=>x.label===v)?.code ?? "09")}/>)}<Field label="Section GG notes / reasoning" value={f.sectionGG.ggNotes} disabled={!!disabled} onChange={v=>updateSection("sectionGG","ggNotes",v)} multiline minRows={6}/></Stack></PageCard>;
      case "review": return <PageCard title="Review / Attestation"><Alert severity="info">This blank evaluation is intentionally open-ended. Use the navigation to move between sections before saving or submitting.</Alert><Typography>Progress: {progress}%</Typography><LinearProgress variant="determinate" value={progress}/><Field label="Student name" value={f.signatureAttestation.studentName} disabled={!!disabled} onChange={v=>updateSection("signatureAttestation","studentName",v)}/><Field label="Credentials / role" value={f.signatureAttestation.credentials} disabled={!!disabled} onChange={v=>updateSection("signatureAttestation","credentials",v)}/><FormControlLabel control={<Checkbox checked={f.signatureAttestation.attestation} disabled={!!disabled} onChange={e=>updateSection("signatureAttestation","attestation",e.target.checked)}/>} label="I attest that this is my educational evaluation work based on a fictional case." /></PageCard>;
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
