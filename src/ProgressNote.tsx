import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, Container, FormControl, FormControlLabel, InputLabel, LinearProgress, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import type { AssistanceLevel, Evaluation } from "./types";
import type { GoalPlan, GoalProgressStatus, ProgressNote } from "./progressTypes";
import { buildSuggestedAssessment, createProgressNote } from "./progressTypes";
import { generateResumeCode, loadEvaluation, saveProgressNote } from "./storage";

const ADLS: [string,string][] = [["eating","Eating"],["grooming","Grooming"],["bathing","Bathing"],["upperBodyDressing","Upper-body dressing"],["lowerBodyDressing","Lower-body dressing"],["toileting","Toileting"],["toiletTransfer","Toilet transfer"],["showerTransfer","Shower transfer"],["bedMobility","Bed mobility"],["transfers","Transfers"],["functionalMobility","Functional mobility"]];
const LEVELS: string[] = ["Independent","Modified Independent","Supervision","Contact Guard Assist","Minimal Assist","Moderate Assist","Maximal Assist","Dependent","Not Assessed","Not Applicable","Non-ambulatory"];
const INTERVENTIONS = ["ADL retraining","Functional mobility / transfer training","Therapeutic exercise","Therapeutic activity","Balance training","Cognitive / compensatory strategy training","Neuromuscular re-education","Energy conservation","Adaptive equipment training","Caregiver education","Discharge planning"];
const PAGES = [
  ["period", "Progress Period / Medical Update"],
  ["function", "Functional Progress"],
  ["performance", "Performance Factors"],
  ["goals", "Goal Progress"],
  ["intervention", "Skilled OT / Response"],
  ["assessment", "Assessment & Plan"],
] as const;
type PageId = typeof PAGES[number][0];

function Field({label,value,onChange,multiline=false,type}:{label:string;value:string;onChange:(v:string)=>void;multiline?:boolean;type?:string}) {
  return <TextField fullWidth label={label} type={type} value={value} onChange={e=>onChange(e.target.value)} multiline={multiline} minRows={multiline?3:undefined} InputLabelProps={type==="date"?{shrink:true}:undefined}/>;
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
    addField(label,`Initial eval: ${baseline} -> Current: ${current}`);
  }
  addField("Functional progress / observations",note.functionalNotes);

  addSection("3. Performance Factors");
  addField("ROM update",note.romUpdate); addField("Strength update",note.strengthUpdate); addField("Balance update",note.balanceUpdate);
  addField("Endurance / activity tolerance update",note.enduranceUpdate); addField("Cognition / safety awareness update",note.cognitionSafetyUpdate); addField("Other performance component changes",note.otherPerformanceUpdate);

  addSection("4. Goal Progress");
  if(!note.goals.length) addText("No structured goals were carried forward.",10);
  note.goals.forEach((g,i)=>{
    addText(`${g.originalGoal.type} Goal ${i+1}`,10,true);
    addText(g.originalGoal.goalStatement || "Goal statement not documented",10,false,8);
    addField("Baseline / target",`${g.originalGoal.current || "Not documented"} -> ${g.originalGoal.target || "Not documented"}`);
    addField("Target date",g.originalGoal.targetDate || "Not documented");
    addField("Current performance",g.currentPerformance); addField("Status",g.status); addField("Goal plan",g.plan);
    addField("Modified / updated goal",g.modifiedGoal); addField("Goal progress notes",g.notes);
  });

  addSection("5. Skilled OT / Response");
  addField("Interventions addressed",note.skilledInterventions.join(", "));
  addField("Patient response / skilled clinical observations",note.responseToIntervention);
  addField("Barriers affecting progress",note.barriers); addField("Facilitators / supports",note.facilitators);

  addSection("6. Assessment & Plan");
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
        <Alert severity="info">Initial evaluation status is carried forward as the comparison baseline. Update only the patient's current performance.</Alert>
        {ADLS.map(([key,label])=>{const baseline=evaluation.formData.adlStatus.current[key]||"Not documented"; return <Card variant="outlined" key={key}><CardContent><Stack spacing={1.5}><Stack direction={{xs:"column",sm:"row"}} justifyContent="space-between"><Typography fontWeight={700}>{label}</Typography>{improved[key]&&<Chip size="small" label={improved[key]} color={improved[key]==="Improved"?"success":improved[key]==="Declined"?"warning":"default"}/>}</Stack><Typography variant="body2" color="text.secondary">Initial eval: <b>{baseline}</b> → Current</Typography><FormControl fullWidth><InputLabel>Current level</InputLabel><Select label="Current level" value={note.currentADL[key]||""} onChange={e=>patch("currentADL",{...note.currentADL,[key]:e.target.value as AssistanceLevel})}>{LEVELS.filter(x=>key==="functionalMobility"||x!=="Non-ambulatory").map(x=><MenuItem key={x} value={x}>{x}</MenuItem>)}</Select></FormControl></Stack></CardContent></Card>})}
        <Field label="Functional progress / observations" value={note.functionalNotes} onChange={v=>patch("functionalNotes",v)} multiline/>
      </Stack></CardContent></Card>;
      case "performance": return <Card><CardContent><Stack spacing={2}><Typography variant="h5" fontWeight={700}>3. Performance Factors — What Changed?</Typography>
        <Alert severity="info">This is intentionally not a second evaluation. Document clinically meaningful changes rather than repeating every measurement.</Alert>
        <Field label="ROM update" value={note.romUpdate} onChange={v=>patch("romUpdate",v)} multiline/><Field label="Strength update" value={note.strengthUpdate} onChange={v=>patch("strengthUpdate",v)} multiline/><Field label="Balance update" value={note.balanceUpdate} onChange={v=>patch("balanceUpdate",v)} multiline/><Field label="Endurance / activity tolerance update" value={note.enduranceUpdate} onChange={v=>patch("enduranceUpdate",v)} multiline/><Field label="Cognition / safety awareness update" value={note.cognitionSafetyUpdate} onChange={v=>patch("cognitionSafetyUpdate",v)} multiline/><Field label="Other performance component changes" value={note.otherPerformanceUpdate} onChange={v=>patch("otherPerformanceUpdate",v)} multiline/>
      </Stack></CardContent></Card>;
      case "goals": return <Card><CardContent><Stack spacing={2}><Typography variant="h5" fontWeight={700}>4. Goal Progress</Typography>
        {note.goals.length===0?<Alert severity="warning">No structured goals were found in the initial evaluation.</Alert>:note.goals.map((g,i)=><Card variant="outlined" key={g.goalId||i}><CardContent><Stack spacing={2}>
          <Typography fontWeight={700}>{g.originalGoal.type} Goal {i+1}</Typography><Typography>{g.originalGoal.goalStatement}</Typography>
          <Typography variant="body2" color="text.secondary">Baseline: {g.originalGoal.current||"Not documented"} · Target: {g.originalGoal.target||"Not documented"} · Target date: {g.originalGoal.targetDate||"Not documented"}</Typography>
          <Field label="Current performance" value={g.currentPerformance} onChange={v=>patchGoal(i,{currentPerformance:v})}/>
          <Stack direction={{xs:"column",sm:"row"}} spacing={2}><FormControl fullWidth><InputLabel>Status</InputLabel><Select label="Status" value={g.status} onChange={e=>patchGoal(i,{status:e.target.value as GoalProgressStatus})}>{["Met","Progressing","Limited Progress","Not Met"].map(x=><MenuItem key={x} value={x}>{x}</MenuItem>)}</Select></FormControl><FormControl fullWidth><InputLabel>Goal plan</InputLabel><Select label="Goal plan" value={g.plan} onChange={e=>patchGoal(i,{plan:e.target.value as GoalPlan})}>{["Continue","Modify","Discontinue"].map(x=><MenuItem key={x} value={x}>{x}</MenuItem>)}</Select></FormControl></Stack>
          {g.plan==="Modify"&&<Field label="Modified / updated goal" value={g.modifiedGoal} onChange={v=>patchGoal(i,{modifiedGoal:v})} multiline/>}<Field label="Goal progress notes" value={g.notes} onChange={v=>patchGoal(i,{notes:v})} multiline/>
        </Stack></CardContent></Card>)}
      </Stack></CardContent></Card>;
      case "intervention": return <Card><CardContent><Stack spacing={2}><Typography variant="h5" fontWeight={700}>5. Skilled OT / Response</Typography>
        <Typography fontWeight={600}>Interventions addressed during reporting period</Typography>{INTERVENTIONS.map(x=><FormControlLabel key={x} control={<Checkbox checked={note.skilledInterventions.includes(x)} onChange={e=>patch("skilledInterventions",e.target.checked?[...note.skilledInterventions,x]:note.skilledInterventions.filter(v=>v!==x))}/>} label={x}/>)}
        <Field label="Patient response / skilled clinical observations" value={note.responseToIntervention} onChange={v=>patch("responseToIntervention",v)} multiline/><Field label="Barriers affecting progress" value={note.barriers} onChange={v=>patch("barriers",v)} multiline/><Field label="Facilitators / supports" value={note.facilitators} onChange={v=>patch("facilitators",v)} multiline/>
      </Stack></CardContent></Card>;
      case "assessment": return <Card><CardContent><Stack spacing={2}><Typography variant="h5" fontWeight={700}>6. Assessment & Plan</Typography>
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
