import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, Container, FormControl, FormControlLabel, InputLabel, LinearProgress, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import type { AssistanceLevel, Evaluation, FindingStatus } from "./types";
import { MOVEMENTS } from "./types";
import type { GoalPlan, GoalProgressStatus, ProgressNote } from "./progressTypes";
import { buildSuggestedAssessment, createProgressNote } from "./progressTypes";
import { generateResumeCode, loadEvaluation, saveProgressNote } from "./storage";

const ADLS: [string,string][] = [["eating","Eating"],["grooming","Grooming"],["bathing","Bathing"],["upperBodyDressing","Upper-body dressing"],["lowerBodyDressing","Lower-body dressing"],["toileting","Toileting"],["toiletTransfer","Toilet transfer"],["showerTransfer","Shower transfer"],["bedMobility","Bed mobility"],["transfers","Transfers"],["functionalMobility","Functional mobility"]];
const LEVELS: string[] = ["Independent","Modified Independent","Supervision","Contact Guard Assist","Minimal Assist","Moderate Assist","Maximal Assist","Dependent","Not Assessed","Not Applicable","Non-ambulatory"];
const FINDING_OPTIONS: FindingStatus[] = ["WNL","WFL","Impaired","Not Assessed"];
const INTERVENTIONS = ["ADL retraining","Functional mobility / transfer training","Therapeutic exercise","Therapeutic activity","Balance training","Cognitive / compensatory strategy training","Neuromuscular re-education","Energy conservation","Adaptive equipment training","Caregiver education","Discharge planning"];
const CLIENT_FIELDS: [keyof ProgressNote["currentClientFactors"],string][] = [
  ["cognition","Cognition / command following"],
  ["communication","Communication"],
  ["vision","Vision"],
  ["hearing","Hearing"],
  ["sensation","Sensation"],
  ["coordination","Coordination"],
  ["balance","Balance"],
  ["endurance","Endurance / activity tolerance"],
  ["motorPlanning","Motor planning / praxis"],
  ["functionalMobility","Functional mobility"],
  ["standardizedAssessments","Standardized assessments"],
  ["assessmentFindings","Assessment findings"],
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

function Field({label,value,onChange,multiline=false,type}:{label:string;value:string;onChange:(v:string)=>void;multiline?:boolean;type?:string}) {
  return <TextField fullWidth label={label} type={type} value={value} onChange={e=>onChange(e.target.value)} multiline={multiline} minRows={multiline?3:undefined} InputLabelProps={type==="date"?{shrink:true}:undefined}/>;
}

function ConfirmButton({confirmed,onConfirm}:{confirmed:boolean;onConfirm:()=>void}) {
  return <Button variant={confirmed?"contained":"outlined"} color={confirmed?"success":"primary"} onClick={onConfirm}>{confirmed?"Confirmed":"Confirm current status"}</Button>;
}

function orientationText(factors: ProgressNote["currentClientFactors"]) {
  const selected = [factors.orientedPerson&&"Person",factors.orientedPlace&&"Place",factors.orientedTime&&"Time",factors.orientedSituation&&"Situation"].filter(Boolean);
  return selected.length ? selected.join(", ") : "Not oriented domains documented";
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
  const ensureSpace = (height:number) => { if (y + height > pageHeight - margin) { doc.addPage(); y = 48; } };
  const addText = (text:string,size=10,bold=false,indent=0) => {
    const clean=safe(text).trim(); if(!clean)return;
    doc.setFont("helvetica",bold?"bold":"normal"); doc.setFontSize(size);
    const lines=doc.splitTextToSize(clean,usableWidth-indent); const lineHeight=size+4;
    ensureSpace(lines.length*lineHeight+4); doc.text(lines,margin+indent,y); y+=lines.length*lineHeight+4;
  };
  const addSection = (title:string) => { ensureSpace(34); y+=8; doc.setDrawColor(210,210,210); doc.line(margin,y,pageWidth-margin,y); y+=18; addText(title,13,true); };
  const addField = (label:string,value:unknown) => { const text=safe(value).trim(); if(!text)return; addText(label,9,true); addText(text,10,false,8); };

  doc.setFont("helvetica","bold"); doc.setFontSize(18); doc.text("OT Progress Note",margin,y); y+=22;
  addText(`${evaluation.formData.patientInfo.patientName || "Patient"}    Note code: ${note.resumeCode}`,10,true);
  addText(`Reporting period: ${note.reportingPeriodStart || "Not documented"} to ${note.reportingPeriodEnd || "Not documented"}`,9);
  addText(`Initial evaluation: ${evaluation.formData.patientInfo.evaluationDate || "Not documented"}    Source code: ${note.sourceEvaluationCode}`,9);
  addText(`Generated: ${new Date().toLocaleString()}`,9);

  addSection("1. Progress Period / Medical Update");
  addField("Visits since evaluation / last progress note",note.visitsSinceEvaluation);
  addField("Medical status changes / relevant events",note.medicalUpdates);
  addField("Pain update",note.pain);
  addField("Falls / hospitalizations / acute events",note.fallsHospitalizations);
  addField("Precaution / weight-bearing changes",note.precautionsChanges);

  addSection("2. Functional Progress");
  for(const [key,label] of ADLS){
    const baseline=evaluation.formData.adlStatus.current[key] || "Not documented";
    const current=note.currentADL[key] || "Not documented";
    addField(label,`Initial eval: ${baseline} -> Current: ${current} | Confirmed: ${note.functionalADLConfirmed?.[key]?"Yes":"No"}`);
  }
  addField("Functional progress / observations",note.functionalNotes);

  addSection("3. Cognition / Communication / Sensory");
  addField("Orientation",`${orientationText(note.currentClientFactors)} | Confirmed: ${note.cognitionConfirmed?.orientation?"Yes":"No"}`);
  for(const [key,label] of CLIENT_FIELDS) addField(label,`${String(note.currentClientFactors[key] ?? "") || "Not documented"} | Confirmed: ${note.cognitionConfirmed?.[String(key)]?"Yes":"No"}`);

  addSection("4. Range of Motion");
  for(const movement of MOVEMENTS){
    for(const side of ["right","left"] as const){
      const finding=note.currentROM[side][movement];
      addField(`${side==="right"?"Right":"Left"} ${movement}`,`${finding.status || "Not documented"}${finding.arom?` | AROM: ${finding.arom} deg`:""}${finding.prom?` | PROM: ${finding.prom} deg`:""}${finding.notes?` | ${finding.notes}`:""} | Confirmed: ${note.romConfirmed?.[`${side}:${movement}`]?"Yes":"No"}`);
    }
  }
  addField("ROM summary / notes",note.currentROM.notes);

  addSection("5. Strength");
  for(const movement of MOVEMENTS){
    for(const side of ["right","left"] as const){
      const finding=note.currentStrength[side][movement];
      addField(`${side==="right"?"Right":"Left"} ${movement}`,`${finding.status || "Not documented"}${finding.mmt?` | MMT: ${finding.mmt}`:""}${finding.notes?` | ${finding.notes}`:""} | Confirmed: ${note.strengthConfirmed?.[`${side}:${movement}`]?"Yes":"No"}`);
    }
  }
  addField("Strength summary / notes",note.currentStrength.notes);

  addSection("6. Goal Progress");
  if(!note.goals.length) addText("No structured goals were carried forward.",10);
  note.goals.forEach((g,i)=>{
    addText(`${g.originalGoal.type} Goal ${i+1}`,10,true);
    addText(g.originalGoal.goalStatement || "Goal statement not documented",10,false,8);
    addField("Baseline / target",`${g.originalGoal.current || "Not documented"} -> ${g.originalGoal.target || "Not documented"}`);
    addField("Target date",g.originalGoal.targetDate || "Not documented");
    addField("Current performance",g.currentPerformance); addField("Status",g.status); addField("Goal plan",g.plan);
    addField("Upgraded / updated goal",g.modifiedGoal); addField("Goal progress notes",g.notes);
  });

  addSection("7. Skilled OT / Response");
  addField("Interventions addressed",note.skilledInterventions.join(", "));
  addField("Patient response / skilled clinical observations",note.responseToIntervention);
  addField("Barriers affecting progress",note.barriers); addField("Facilitators / supports",note.facilitators);

  addSection("8. Assessment & Plan");
  addField("Clinical assessment / progress summary",note.assessment);
  addField("Why continued skilled OT is required",note.continuedSkilledNeed);
  addField("Plan decision",note.planDecision);
  addField("Frequency",note.frequency); addField("Duration",note.duration);
  addField("Caregiver training / equipment / DME needs",note.caregiverEquipmentNeeds);

  doc.save(`OT-Progress-Note-${note.resumeCode}.pdf`);
}

export default function ProgressNoteScreen({onExit}:{onExit:()=>void}) {
  const [evalCode,setEvalCode]=useState("");
  const [evaluation,setEvaluation]=useState<Evaluation|null>(null);
  const [note,setNote]=useState<ProgressNote|null>(null);
  const [page,setPage]=useState<PageId>("period");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);

  async function loadSource() {
    setBusy(true); setMessage("");
    try {
      const found=await loadEvaluation(evalCode);
      if(!found){setMessage("No saved initial evaluation was found for that resume code.");return;}
      const next=createProgressNote(found,generateResumeCode().replace("SNF-","PN-"));
      setEvaluation(found); setNote(next); setPage("period");
    } catch(e){console.error(e);setMessage("Could not load the initial evaluation.");}
    finally{setBusy(false);}
  }

  function patch<K extends keyof ProgressNote>(key:K,value:ProgressNote[K]) {
    setNote(n=>n?{...n,[key]:value,updatedAt:new Date().toISOString()}:n);
  }
  function patchGoal(index:number,changes:Partial<ProgressNote["goals"][number]>) {
    if(!note)return; const goals=note.goals.map((g,i)=>i===index?{...g,...changes}:g); patch("goals",goals);
  }
  function confirmFunctional(key:string){patch("functionalADLConfirmed",{...note!.functionalADLConfirmed,[key]:true});}
  function updateClientFactor(key:keyof ProgressNote["currentClientFactors"],value:string|boolean){
    patch("currentClientFactors",{...note!.currentClientFactors,[key]:value});
    patch("cognitionConfirmed",{...note!.cognitionConfirmed,[String(key)]:false});
  }
  function updateROM(side:"right"|"left",movement:string,field:"status"|"arom"|"prom"|"notes",value:string){
    const current=note!.currentROM;
    patch("currentROM",{...current,[side]:{...current[side],[movement]:{...current[side][movement],[field]:value}}});
    patch("romConfirmed",{...note!.romConfirmed,[`${side}:${movement}`]:false});
  }
  function updateStrength(side:"right"|"left",movement:string,field:"status"|"mmt"|"notes",value:string){
    const current=note!.currentStrength;
    patch("currentStrength",{...current,[side]:{...current[side],[movement]:{...current[side][movement],[field]:value}}});
    patch("strengthConfirmed",{...note!.strengthConfirmed,[`${side}:${movement}`]:false});
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
    <Box><Typography variant="h3" fontWeight={800}>OT Progress Note</Typography><Typography color="text.secondary">Start from a saved initial evaluation so baseline function, cognition, ROM, strength, and goals carry forward automatically.</Typography></Box>
    <Card><CardContent><Stack spacing={2}><Typography variant="h5">Load initial evaluation</Typography><Field label="Initial evaluation resume code" value={evalCode} onChange={v=>setEvalCode(v.toUpperCase())}/><Button variant="contained" onClick={loadSource} disabled={busy}>Create Progress Note</Button></Stack></CardContent></Card>
    {message&&<Alert severity="error">{message}</Alert>}<Button onClick={onExit}>Back to Home</Button>
  </Stack></Container>;

  const pageIndex=PAGES.findIndex(p=>p[0]===page);
  const progress=Math.round(((pageIndex+1)/PAGES.length)*100);

  const renderPage = () => {
    switch(page){
      case "period": return <Card><CardContent><Stack spacing={2}><Typography variant="h5" fontWeight={700}>1. Progress Period / Medical Update</Typography>
        <Stack direction={{xs:"column",sm:"row"}} spacing={2}><Field type="date" label="Reporting period start" value={note.reportingPeriodStart} onChange={v=>patch("reportingPeriodStart",v)}/><Field type="date" label="Reporting period end" value={note.reportingPeriodEnd} onChange={v=>patch("reportingPeriodEnd",v)}/><Field label="Visits since evaluation / last progress note" value={note.visitsSinceEvaluation} onChange={v=>patch("visitsSinceEvaluation",v)}/></Stack>
        <Field label="Medical status changes / new diagnoses / relevant events" value={note.medicalUpdates} onChange={v=>patch("medicalUpdates",v)} multiline/>
        <Field label="Pain update" value={note.pain} onChange={v=>patch("pain",v)}/>
        <Field label="Falls / hospitalizations / acute events" value={note.fallsHospitalizations} onChange={v=>patch("fallsHospitalizations",v)}/>
        <Field label="Precaution / weight-bearing changes" value={note.precautionsChanges} onChange={v=>patch("precautionsChanges",v)}/>
      </Stack></CardContent></Card>;

      case "function": return <Card><CardContent><Stack spacing={2}><Typography variant="h5" fontWeight={700}>2. Functional Progress</Typography>
        <Alert severity="info">Initial evaluation status is carried forward. Review every item and click Confirm even if performance is unchanged. Changing a level after confirming resets that confirmation.</Alert>
        {ADLS.map(([key,label])=>{const baseline=evaluation.formData.adlStatus.current[key]||"Not documented"; return <Card variant="outlined" key={key}><CardContent><Stack spacing={1.5}><Stack direction={{xs:"column",sm:"row"}} justifyContent="space-between"><Typography fontWeight={700}>{label}</Typography>{improved[key]&&<Chip size="small" label={improved[key]} color={improved[key]==="Improved"?"success":improved[key]==="Declined"?"warning":"default"}/>}</Stack><Typography variant="body2" color="text.secondary">Initial eval: <b>{baseline}</b> → Current</Typography><FormControl fullWidth><InputLabel>Current level</InputLabel><Select label="Current level" value={note.currentADL[key]||""} onChange={e=>{patch("currentADL",{...note.currentADL,[key]:e.target.value as AssistanceLevel});patch("functionalADLConfirmed",{...note.functionalADLConfirmed,[key]:false});}}>{LEVELS.filter(x=>key==="functionalMobility"||x!=="Non-ambulatory").map(x=><MenuItem key={x} value={x}>{x}</MenuItem>)}</Select></FormControl><ConfirmButton confirmed={!!note.functionalADLConfirmed[key]} onConfirm={()=>confirmFunctional(key)}/></Stack></CardContent></Card>})}
        <Field label="Functional progress / observations" value={note.functionalNotes} onChange={v=>patch("functionalNotes",v)} multiline/>
      </Stack></CardContent></Card>;

      case "cognition": return <Card><CardContent><Stack spacing={2}><Typography variant="h5" fontWeight={700}>3. Cognition / Communication / Sensory</Typography>
        <Alert severity="info">Evaluation findings are carried forward. Confirm each item if unchanged, or update it and then confirm the new status.</Alert>
        <Card variant="outlined"><CardContent><Stack spacing={1.5}><Typography fontWeight={700}>Orientation</Typography><Typography variant="body2" color="text.secondary">Initial eval: {orientationText(evaluation.formData.clientFactors)}</Typography><Stack direction={{xs:"column",sm:"row"}} spacing={1}><FormControlLabel control={<Checkbox checked={note.currentClientFactors.orientedPerson} onChange={e=>{updateClientFactor("orientedPerson",e.target.checked);patch("cognitionConfirmed",{...note.cognitionConfirmed,orientation:false});}}/>} label="Person"/><FormControlLabel control={<Checkbox checked={note.currentClientFactors.orientedPlace} onChange={e=>{updateClientFactor("orientedPlace",e.target.checked);patch("cognitionConfirmed",{...note.cognitionConfirmed,orientation:false});}}/>} label="Place"/><FormControlLabel control={<Checkbox checked={note.currentClientFactors.orientedTime} onChange={e=>{updateClientFactor("orientedTime",e.target.checked);patch("cognitionConfirmed",{...note.cognitionConfirmed,orientation:false});}}/>} label="Time"/><FormControlLabel control={<Checkbox checked={note.currentClientFactors.orientedSituation} onChange={e=>{updateClientFactor("orientedSituation",e.target.checked);patch("cognitionConfirmed",{...note.cognitionConfirmed,orientation:false});}}/>} label="Situation"/></Stack><ConfirmButton confirmed={!!note.cognitionConfirmed.orientation} onConfirm={()=>patch("cognitionConfirmed",{...note.cognitionConfirmed,orientation:true})}/></Stack></CardContent></Card>
        {CLIENT_FIELDS.map(([key,label])=><Card variant="outlined" key={String(key)}><CardContent><Stack spacing={1.5}><Typography fontWeight={700}>{label}</Typography><Typography variant="body2" color="text.secondary">Initial eval: {String(evaluation.formData.clientFactors[key] ?? "") || "Not documented"}</Typography><Field label="Current status" value={String(note.currentClientFactors[key] ?? "")} onChange={v=>updateClientFactor(key,v)} multiline={key==="standardizedAssessments"||key==="assessmentFindings"}/><ConfirmButton confirmed={!!note.cognitionConfirmed[String(key)]} onConfirm={()=>patch("cognitionConfirmed",{...note.cognitionConfirmed,[String(key)]:true})}/></Stack></CardContent></Card>)}
      </Stack></CardContent></Card>;

      case "rom": return <Card><CardContent><Stack spacing={2}><Typography variant="h5" fontWeight={700}>4. Range of Motion</Typography>
        <Alert severity="info">ROM findings from the evaluation are pre-populated. Confirm each side/movement if unchanged, or update the finding before confirming.</Alert>
        {MOVEMENTS.map(movement=><Box key={movement}><Typography variant="h6" sx={{mb:1}}>{movement}</Typography><Stack direction={{xs:"column",lg:"row"}} spacing={1.5}>{(["right","left"] as const).map(side=>{const f=note.currentROM[side][movement];const baseline=evaluation.formData.rom[side][movement];const confirmKey=`${side}:${movement}`;return <Card variant="outlined" key={confirmKey} sx={{flex:1}}><CardContent><Stack spacing={1.5}><Typography fontWeight={700}>{side==="right"?"Right":"Left"}</Typography><Typography variant="body2" color="text.secondary">Eval: {baseline.status||"Not documented"}{baseline.arom?` · AROM ${baseline.arom}°`:""}{baseline.prom?` · PROM ${baseline.prom}°`:""}</Typography><FormControl fullWidth><InputLabel>Finding</InputLabel><Select label="Finding" value={f.status} onChange={e=>updateROM(side,movement,"status",e.target.value)}><MenuItem value=""><em>Not documented</em></MenuItem>{FINDING_OPTIONS.map(x=><MenuItem key={x} value={x}>{x}</MenuItem>)}</Select></FormControl>{f.status==="Impaired"&&<><Field label="AROM (degrees)" value={f.arom} onChange={v=>updateROM(side,movement,"arom",v)}/><Field label="PROM (degrees)" value={f.prom} onChange={v=>updateROM(side,movement,"prom",v)}/><Field label="Notes" value={f.notes} onChange={v=>updateROM(side,movement,"notes",v)}/></>}<ConfirmButton confirmed={!!note.romConfirmed[confirmKey]} onConfirm={()=>patch("romConfirmed",{...note.romConfirmed,[confirmKey]:true})}/></Stack></CardContent></Card>})}</Stack></Box>)}
        <Field label="ROM summary / clinical notes" value={note.currentROM.notes} onChange={v=>patch("currentROM",{...note.currentROM,notes:v})} multiline/>
      </Stack></CardContent></Card>;

      case "strength": return <Card><CardContent><Stack spacing={2}><Typography variant="h5" fontWeight={700}>5. Strength</Typography>
        <Alert severity="info">Strength findings from the evaluation are pre-populated. Confirm each side/movement if unchanged, or update the finding before confirming.</Alert>
        {MOVEMENTS.map(movement=><Box key={movement}><Typography variant="h6" sx={{mb:1}}>{movement}</Typography><Stack direction={{xs:"column",lg:"row"}} spacing={1.5}>{(["right","left"] as const).map(side=>{const f=note.currentStrength[side][movement];const baseline=evaluation.formData.strength[side][movement];const confirmKey=`${side}:${movement}`;return <Card variant="outlined" key={confirmKey} sx={{flex:1}}><CardContent><Stack spacing={1.5}><Typography fontWeight={700}>{side==="right"?"Right":"Left"}</Typography><Typography variant="body2" color="text.secondary">Eval: {baseline.status||"Not documented"}{baseline.mmt?` · MMT ${baseline.mmt}`:""}</Typography><FormControl fullWidth><InputLabel>Finding</InputLabel><Select label="Finding" value={f.status} onChange={e=>updateStrength(side,movement,"status",e.target.value)}><MenuItem value=""><em>Not documented</em></MenuItem>{FINDING_OPTIONS.map(x=><MenuItem key={x} value={x}>{x}</MenuItem>)}</Select></FormControl>{f.status==="Impaired"&&<><Field label="MMT" value={f.mmt} onChange={v=>updateStrength(side,movement,"mmt",v)}/><Field label="Notes" value={f.notes} onChange={v=>updateStrength(side,movement,"notes",v)}/></>}<ConfirmButton confirmed={!!note.strengthConfirmed[confirmKey]} onConfirm={()=>patch("strengthConfirmed",{...note.strengthConfirmed,[confirmKey]:true})}/></Stack></CardContent></Card>})}</Stack></Box>)}
        <Field label="Strength summary / clinical notes" value={note.currentStrength.notes} onChange={v=>patch("currentStrength",{...note.currentStrength,notes:v})} multiline/>
      </Stack></CardContent></Card>;

      case "goals": return <Card><CardContent><Stack spacing={2}><Typography variant="h5" fontWeight={700}>6. Goal Progress</Typography>
        {note.goals.length===0?<Alert severity="warning">No structured goals were found in the initial evaluation.</Alert>:note.goals.map((g,i)=><Card variant="outlined" key={g.goalId||i}><CardContent><Stack spacing={2}>
          <Typography fontWeight={700}>{g.originalGoal.type} Goal {i+1}</Typography><Typography>{g.originalGoal.goalStatement}</Typography>
          <Typography variant="body2" color="text.secondary">Baseline: {g.originalGoal.current||"Not documented"} · Target: {g.originalGoal.target||"Not documented"} · Target date: {g.originalGoal.targetDate||"Not documented"}</Typography>
          <Field label="Current performance" value={g.currentPerformance} onChange={v=>patchGoal(i,{currentPerformance:v})}/>
          <Stack direction={{xs:"column",sm:"row"}} spacing={2}><FormControl fullWidth><InputLabel>Status</InputLabel><Select label="Status" value={g.status} onChange={e=>patchGoal(i,{status:e.target.value as GoalProgressStatus})}>{["Met","Partially Met","Unmet"].map(x=><MenuItem key={x} value={x}>{x}</MenuItem>)}</Select></FormControl><FormControl fullWidth><InputLabel>Goal plan</InputLabel><Select label="Goal plan" value={g.plan} onChange={e=>patchGoal(i,{plan:e.target.value as GoalPlan})}>{["Continue","Upgrade","Discontinue"].map(x=><MenuItem key={x} value={x}>{x}</MenuItem>)}</Select></FormControl></Stack>
          {g.plan==="Upgrade"&&<Field label="Upgraded / updated goal" value={g.modifiedGoal} onChange={v=>patchGoal(i,{modifiedGoal:v})} multiline/>}<Field label="Goal progress notes" value={g.notes} onChange={v=>patchGoal(i,{notes:v})} multiline/>
        </Stack></CardContent></Card>)}
      </Stack></CardContent></Card>;

      case "intervention": return <Card><CardContent><Stack spacing={2}><Typography variant="h5" fontWeight={700}>7. Skilled OT / Response</Typography>
        <Typography fontWeight={600}>Interventions addressed during reporting period</Typography>{INTERVENTIONS.map(x=><FormControlLabel key={x} control={<Checkbox checked={note.skilledInterventions.includes(x)} onChange={e=>patch("skilledInterventions",e.target.checked?[...note.skilledInterventions,x]:note.skilledInterventions.filter(v=>v!==x))}/>} label={x}/>)}
        <Field label="Patient response / skilled clinical observations" value={note.responseToIntervention} onChange={v=>patch("responseToIntervention",v)} multiline/><Field label="Barriers affecting progress" value={note.barriers} onChange={v=>patch("barriers",v)} multiline/><Field label="Facilitators / supports" value={note.facilitators} onChange={v=>patch("facilitators",v)} multiline/>
      </Stack></CardContent></Card>;

      case "assessment": return <Card><CardContent><Stack spacing={2}><Typography variant="h5" fontWeight={700}>8. Assessment & Plan</Typography>
        <Button variant="outlined" onClick={()=>patch("assessment",buildSuggestedAssessment(note,evaluation))}>Draft Assessment From Documented Change</Button>
        <Field label="Clinical assessment / progress summary" value={note.assessment} onChange={v=>patch("assessment",v)} multiline/><Field label="Why continued skilled OT is required" value={note.continuedSkilledNeed} onChange={v=>patch("continuedSkilledNeed",v)} multiline/>
        <FormControl fullWidth><InputLabel>Plan decision</InputLabel><Select label="Plan decision" value={note.planDecision} onChange={e=>patch("planDecision",e.target.value as ProgressNote["planDecision"])}>{["Continue POC","Modify POC","Discharge OT"].map(x=><MenuItem key={x} value={x}>{x}</MenuItem>)}</Select></FormControl>
        <Stack direction={{xs:"column",sm:"row"}} spacing={2}><Field label="Frequency" value={note.frequency} onChange={v=>patch("frequency",v)}/><Field label="Duration" value={note.duration} onChange={v=>patch("duration",v)}/></Stack>
        <Field label="Caregiver training / equipment / DME needs" value={note.caregiverEquipmentNeeds} onChange={v=>patch("caregiverEquipmentNeeds",v)} multiline/>
      </Stack></CardContent></Card>;
    }
  };

  return <Container maxWidth="xl" sx={{py:3}}><Stack spacing={2}>
    <Stack direction={{xs:"column",lg:"row"}} justifyContent="space-between" spacing={1}><Box><Typography variant="h3" fontWeight={800}>OT Progress Note</Typography><Typography color="text.secondary">{evaluation.formData.patientInfo.patientName || "Patient"} · Initial eval {evaluation.formData.patientInfo.evaluationDate || "date not documented"} · Note code {note.resumeCode}</Typography></Box><Chip label="Draft"/></Stack>
    <LinearProgress variant="determinate" value={progress}/>
    <Stack direction={{xs:"column",md:"row"}} spacing={3} alignItems="flex-start">
      <Card sx={{width:{xs:"100%",md:280},position:{md:"sticky"},top:{md:16}}}><CardContent><Typography fontWeight={700} sx={{mb:1}}>Progress note sections</Typography><Stack spacing={0.5}>{PAGES.map(([id,title],i)=><Button key={id} fullWidth sx={{justifyContent:"flex-start",textAlign:"left"}} variant={page===id?"contained":"text"} onClick={()=>setPage(id)}>{i+1}. {title}</Button>)}</Stack></CardContent></Card>
      <Box sx={{flex:1,minWidth:0}}>{renderPage()}<Stack direction="row" justifyContent="space-between" sx={{mt:2}}><Button disabled={pageIndex===0} onClick={()=>setPage(PAGES[pageIndex-1][0])}>Previous</Button><Button disabled={pageIndex===PAGES.length-1} variant="contained" onClick={()=>setPage(PAGES[pageIndex+1][0])}>Next</Button></Stack></Box>
    </Stack>
    {message&&<Alert severity={message.includes("saved")?"success":"error"}>{message}</Alert>}
    <Stack direction={{xs:"column",sm:"row"}} justifyContent="space-between" spacing={1}><Button onClick={onExit}>Home / Exit</Button><Stack direction={{xs:"column",sm:"row"}} spacing={1}><Button variant="outlined" onClick={()=>exportProgressNotePdf(note,evaluation)}>Download PDF</Button><Button variant="contained" onClick={save} disabled={busy}>Save Progress Note Draft</Button></Stack></Stack>
  </Stack></Container>;
}
