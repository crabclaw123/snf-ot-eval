import { useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, Container, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import type { AssistanceLevel, Evaluation } from "./types";
import type { GoalPlan, GoalProgressStatus, ProgressNote } from "./progressTypes";
import { buildSuggestedAssessment, createProgressNote } from "./progressTypes";
import { generateResumeCode, loadEvaluation, saveProgressNote } from "./storage";

const ADLS: [string,string][] = [["eating","Eating"],["grooming","Grooming"],["bathing","Bathing"],["upperBodyDressing","Upper-body dressing"],["lowerBodyDressing","Lower-body dressing"],["toileting","Toileting"],["toiletTransfer","Toilet transfer"],["showerTransfer","Shower transfer"],["bedMobility","Bed mobility"],["transfers","Transfers"],["functionalMobility","Functional mobility"]];
const LEVELS: AssistanceLevel[] = ["Independent","Modified Independent","Supervision","Contact Guard Assist","Minimal Assist","Moderate Assist","Maximal Assist","Dependent","Not Assessed","Not Applicable"];
const INTERVENTIONS = ["ADL retraining","Functional mobility / transfer training","Therapeutic exercise","Therapeutic activity","Balance training","Cognitive / compensatory strategy training","Neuromuscular re-education","Energy conservation","Adaptive equipment training","Caregiver education","Discharge planning"];

function Field({label,value,onChange,multiline=false}:{label:string;value:string;onChange:(v:string)=>void;multiline?:boolean}) {
  return <TextField fullWidth label={label} value={value} onChange={e=>onChange(e.target.value)} multiline={multiline} minRows={multiline?3:undefined}/>;
}

export default function ProgressNoteScreen({onExit}:{onExit:()=>void}) {
  const [evalCode,setEvalCode]=useState("");
  const [evaluation,setEvaluation]=useState<Evaluation|null>(null);
  const [note,setNote]=useState<ProgressNote|null>(null);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);

  async function loadSource() {
    setBusy(true); setMessage("");
    try {
      const found=await loadEvaluation(evalCode);
      if(!found){setMessage("No saved initial evaluation was found for that resume code.");return;}
      const next=createProgressNote(found,generateResumeCode().replace("SNF-","PN-"));
      setEvaluation(found); setNote(next);
    } catch(e){console.error(e);setMessage("Could not load the initial evaluation.");}
    finally{setBusy(false);}
  }
  function patch<K extends keyof ProgressNote>(key:K,value:ProgressNote[K]) {
    setNote(n=>n?{...n,[key]:value,updatedAt:new Date().toISOString()}:n);
  }
  function patchGoal(index:number,changes:Partial<ProgressNote["goals"][number]>) {
    if(!note)return; const goals=note.goals.map((g,i)=>i===index?{...g,...changes}:g); patch("goals",goals);
  }
  const improved = useMemo(()=>{
    if(!note||!evaluation)return {} as Record<string,string>;
    const rank=["Dependent","Maximal Assist","Moderate Assist","Minimal Assist","Contact Guard Assist","Supervision","Modified Independent","Independent"];
    return Object.fromEntries(ADLS.map(([k])=>{const b=evaluation.formData.adlStatus.current[k];const c=note.currentADL[k];const bi=rank.indexOf(b);const ci=rank.indexOf(c);return [k,bi>=0&&ci>bi?"Improved":bi>=0&&ci<bi?"Declined":b&&c&&b===c?"Unchanged":""]; }));
  },[note,evaluation]);

  async function save() {
    if(!note)return; setBusy(true);
    try { await saveProgressNote(note); setMessage("Progress note saved."); }
    catch(e){console.error(e);setMessage("Could not save progress note.");}
    finally{setBusy(false);}
  }

  if(!note||!evaluation) return <Container maxWidth="sm" sx={{py:6}}><Stack spacing={3}>
    <Box><Typography variant="h3" fontWeight={800}>OT Progress Note</Typography><Typography color="text.secondary">Start from a saved initial evaluation so baseline function and goals carry forward automatically.</Typography></Box>
    <Card><CardContent><Stack spacing={2}><Typography variant="h5">Load initial evaluation</Typography><Field label="Initial evaluation resume code" value={evalCode} onChange={v=>setEvalCode(v.toUpperCase())}/><Button variant="contained" onClick={loadSource} disabled={busy}>Create Progress Note</Button></Stack></CardContent></Card>
    {message&&<Alert severity="error">{message}</Alert>}<Button onClick={onExit}>Back to Home</Button>
  </Stack></Container>;

  return <Container maxWidth="lg" sx={{py:3}}><Stack spacing={3}>
    <Box><Stack direction={{xs:"column",sm:"row"}} justifyContent="space-between" spacing={1}><Box><Typography variant="h3" fontWeight={800}>OT Progress Note</Typography><Typography color="text.secondary">{evaluation.formData.patientInfo.patientName || "Patient"} · Initial eval {evaluation.formData.patientInfo.evaluationDate || "date not documented"} · Note code {note.resumeCode}</Typography></Box><Chip label="Draft"/></Stack></Box>

    <Card><CardContent><Stack spacing={2}><Typography variant="h5" fontWeight={700}>1. Reporting Period</Typography>
      <Stack direction={{xs:"column",sm:"row"}} spacing={2}><Field label="Reporting period start" value={note.reportingPeriodStart} onChange={v=>patch("reportingPeriodStart",v)}/><Field label="Reporting period end" value={note.reportingPeriodEnd} onChange={v=>patch("reportingPeriodEnd",v)}/><Field label="Visits since evaluation / last progress note" value={note.visitsSinceEvaluation} onChange={v=>patch("visitsSinceEvaluation",v)}/></Stack>
    </Stack></CardContent></Card>

    <Card><CardContent><Stack spacing={2}><Typography variant="h5" fontWeight={700}>2. Medical / Clinical Update</Typography>
      <Field label="Medical status changes / new diagnoses / relevant events" value={note.medicalUpdates} onChange={v=>patch("medicalUpdates",v)} multiline/>
      <Field label="Pain update" value={note.pain} onChange={v=>patch("pain",v)}/>
      <Field label="Falls / hospitalizations / acute events" value={note.fallsHospitalizations} onChange={v=>patch("fallsHospitalizations",v)}/>
      <Field label="Precaution / weight-bearing changes" value={note.precautionsChanges} onChange={v=>patch("precautionsChanges",v)}/>
    </Stack></CardContent></Card>

    <Card><CardContent><Stack spacing={2}><Typography variant="h5" fontWeight={700}>3. Functional Status & Change</Typography>
      <Alert severity="info">Initial evaluation status is carried forward as the comparison baseline. Update only the patient's current performance.</Alert>
      {ADLS.map(([key,label])=>{const baseline=evaluation.formData.adlStatus.current[key]||"Not documented"; return <Card variant="outlined" key={key}><CardContent><Stack spacing={1.5}><Stack direction={{xs:"column",sm:"row"}} justifyContent="space-between"><Typography fontWeight={700}>{label}</Typography>{improved[key]&&<Chip size="small" label={improved[key]} color={improved[key]==="Improved"?"success":improved[key]==="Declined"?"warning":"default"}/>}</Stack><Typography variant="body2" color="text.secondary">Initial eval: <b>{baseline}</b> → Current</Typography><FormControl fullWidth><InputLabel>Current level</InputLabel><Select label="Current level" value={note.currentADL[key]||""} onChange={e=>patch("currentADL",{...note.currentADL,[key]:e.target.value as AssistanceLevel})}>{LEVELS.map(x=><MenuItem key={x} value={x}>{x}</MenuItem>)}</Select></FormControl></Stack></CardContent></Card>})}
      <Field label="Functional progress / observations" value={note.functionalNotes} onChange={v=>patch("functionalNotes",v)} multiline/>
    </Stack></CardContent></Card>

    <Card><CardContent><Stack spacing={2}><Typography variant="h5" fontWeight={700}>4. Performance Components — What Changed?</Typography>
      <Alert severity="info">This is intentionally not a second evaluation. Document clinically meaningful changes rather than repeating every measurement.</Alert>
      <Field label="ROM update" value={note.romUpdate} onChange={v=>patch("romUpdate",v)} multiline/><Field label="Strength update" value={note.strengthUpdate} onChange={v=>patch("strengthUpdate",v)} multiline/><Field label="Balance update" value={note.balanceUpdate} onChange={v=>patch("balanceUpdate",v)} multiline/><Field label="Endurance / activity tolerance update" value={note.enduranceUpdate} onChange={v=>patch("enduranceUpdate",v)} multiline/><Field label="Cognition / safety awareness update" value={note.cognitionSafetyUpdate} onChange={v=>patch("cognitionSafetyUpdate",v)} multiline/><Field label="Other performance component changes" value={note.otherPerformanceUpdate} onChange={v=>patch("otherPerformanceUpdate",v)} multiline/>
    </Stack></CardContent></Card>

    <Card><CardContent><Stack spacing={2}><Typography variant="h5" fontWeight={700}>5. Goal Progress</Typography>
      {note.goals.length===0?<Alert severity="warning">No structured goals were found in the initial evaluation.</Alert>:note.goals.map((g,i)=><Card variant="outlined" key={g.goalId||i}><CardContent><Stack spacing={2}>
        <Typography fontWeight={700}>{g.originalGoal.type} Goal {i+1}</Typography><Typography>{g.originalGoal.goalStatement}</Typography>
        <Typography variant="body2" color="text.secondary">Baseline: {g.originalGoal.current||"Not documented"} · Target: {g.originalGoal.target||"Not documented"}</Typography>
        <Field label="Current performance" value={g.currentPerformance} onChange={v=>patchGoal(i,{currentPerformance:v})}/>
        <Stack direction={{xs:"column",sm:"row"}} spacing={2}><FormControl fullWidth><InputLabel>Status</InputLabel><Select label="Status" value={g.status} onChange={e=>patchGoal(i,{status:e.target.value as GoalProgressStatus})}>{["Met","Progressing","Limited Progress","Not Met"].map(x=><MenuItem key={x} value={x}>{x}</MenuItem>)}</Select></FormControl><FormControl fullWidth><InputLabel>Goal plan</InputLabel><Select label="Goal plan" value={g.plan} onChange={e=>patchGoal(i,{plan:e.target.value as GoalPlan})}>{["Continue","Modify","Discontinue"].map(x=><MenuItem key={x} value={x}>{x}</MenuItem>)}</Select></FormControl></Stack>
        {g.plan==="Modify"&&<Field label="Modified / updated goal" value={g.modifiedGoal} onChange={v=>patchGoal(i,{modifiedGoal:v})} multiline/>}<Field label="Goal progress notes" value={g.notes} onChange={v=>patchGoal(i,{notes:v})} multiline/>
      </Stack></CardContent></Card>)}
    </Stack></CardContent></Card>

    <Card><CardContent><Stack spacing={2}><Typography variant="h5" fontWeight={700}>6. Skilled Intervention & Response</Typography>
      <Typography fontWeight={600}>Interventions addressed during reporting period</Typography>{INTERVENTIONS.map(x=><FormControlLabel key={x} control={<Checkbox checked={note.skilledInterventions.includes(x)} onChange={e=>patch("skilledInterventions",e.target.checked?[...note.skilledInterventions,x]:note.skilledInterventions.filter(v=>v!==x))}/>} label={x}/>)}
      <Field label="Patient response / skilled clinical observations" value={note.responseToIntervention} onChange={v=>patch("responseToIntervention",v)} multiline/><Field label="Barriers affecting progress" value={note.barriers} onChange={v=>patch("barriers",v)} multiline/><Field label="Facilitators / supports" value={note.facilitators} onChange={v=>patch("facilitators",v)} multiline/>
    </Stack></CardContent></Card>

    <Card><CardContent><Stack spacing={2}><Typography variant="h5" fontWeight={700}>7. Clinical Assessment & Continued Skilled Need</Typography>
      <Button variant="outlined" onClick={()=>patch("assessment",buildSuggestedAssessment(note,evaluation))}>Draft Assessment From Documented Change</Button>
      <Field label="Clinical assessment / progress summary" value={note.assessment} onChange={v=>patch("assessment",v)} multiline/><Field label="Why continued skilled OT is required" value={note.continuedSkilledNeed} onChange={v=>patch("continuedSkilledNeed",v)} multiline/>
    </Stack></CardContent></Card>

    <Card><CardContent><Stack spacing={2}><Typography variant="h5" fontWeight={700}>8. Plan</Typography>
      <FormControl fullWidth><InputLabel>Plan decision</InputLabel><Select label="Plan decision" value={note.planDecision} onChange={e=>patch("planDecision",e.target.value as ProgressNote["planDecision"])}>{["Continue POC","Modify POC","Discharge OT"].map(x=><MenuItem key={x} value={x}>{x}</MenuItem>)}</Select></FormControl>
      <Stack direction={{xs:"column",sm:"row"}} spacing={2}><Field label="Frequency" value={note.frequency} onChange={v=>patch("frequency",v)}/><Field label="Duration" value={note.duration} onChange={v=>patch("duration",v)}/></Stack>
      <Field label="Discharge planning / anticipated disposition" value={note.dischargePlanning} onChange={v=>patch("dischargePlanning",v)} multiline/><Field label="Caregiver training / equipment / DME needs" value={note.caregiverEquipmentNeeds} onChange={v=>patch("caregiverEquipmentNeeds",v)} multiline/>
    </Stack></CardContent></Card>

    {message&&<Alert severity={message.includes("saved")?"success":"error"}>{message}</Alert>}
    <Stack direction={{xs:"column",sm:"row"}} justifyContent="space-between" spacing={1}><Button onClick={onExit}>Home / Exit</Button><Button variant="contained" onClick={save} disabled={busy}>Save Progress Note Draft</Button></Stack>
  </Stack></Container>;
}
