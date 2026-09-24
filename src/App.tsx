import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { Evaluation, EvaluationFormData } from "./types";
import { generateResumeCode, getLastCode, loadLocalEvaluation, saveLocalEvaluation } from "./storage";

const emptyForm: EvaluationFormData = {
  patientInfo: {
    patientName: "",
    medicalRecordNumber: "",
    dateOfBirth: "",
    evaluationDate: new Date().toISOString().slice(0, 10),
    referralSource: "",
    medicalDiagnosis: "",
    reasonForReferral: "",
  },
  occupationalProfile: {
    priorSetting: "",
    livingSituation: "",
    roles: "",
    routines: "",
    interests: "",
    patientGoals: "",
    occupationalConcerns: "",
  },
};

type Screen = "home" | "evaluation";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [studentName, setStudentName] = useState("");
  const [resumeCode, setResumeCode] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [message, setMessage] = useState("");

  const progress = useMemo(() => {
    if (!evaluation) return 0;
    const values = [
      ...Object.values(evaluation.formData.patientInfo),
      ...Object.values(evaluation.formData.occupationalProfile),
    ];
    return Math.round((values.filter(Boolean).length / values.length) * 100);
  }, [evaluation]);

  useEffect(() => {
    const last = getLastCode();
    if (last) setResumeCode(last);
  }, []);

  function startEvaluation() {
    const name = studentName.trim();
    if (!name) {
      setMessage("Enter your name before starting.");
      return;
    }

    const now = new Date().toISOString();
    const next: Evaluation = {
      id: crypto.randomUUID(),
      resumeCode: generateResumeCode(),
      studentName: name,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      formData: structuredClone(emptyForm),
    };

    saveLocalEvaluation(next);
    setEvaluation(next);
    setResumeCode(next.resumeCode);
    setMessage("");
    setScreen("evaluation");
  }

  function resumeEvaluation() {
    const code = resumeCode.trim().toUpperCase();
    const found = loadLocalEvaluation(code);
    if (!found) {
      setMessage("No saved evaluation was found on this browser for that code.");
      return;
    }
    setEvaluation(found);
    setStudentName(found.studentName);
    setMessage("");
    setScreen("evaluation");
  }

  function updateForm<K extends keyof EvaluationFormData>(
    section: K,
    field: keyof EvaluationFormData[K],
    value: string,
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
    saveLocalEvaluation(next);
  }

  function saveDraft() {
    if (!evaluation) return;
    const next = { ...evaluation, updatedAt: new Date().toISOString() };
    setEvaluation(next);
    saveLocalEvaluation(next);
    setMessage("Draft saved.");
  }

  function submitEvaluation() {
    if (!evaluation) return;
    const next: Evaluation = {
      ...evaluation,
      status: "submitted",
      updatedAt: new Date().toISOString(),
    };
    setEvaluation(next);
    saveLocalEvaluation(next);
    setMessage("Evaluation submitted. This evaluation is now read-only.");
  }

  if (screen === "evaluation" && evaluation) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
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
              <Typography variant="body2">Checkpoint 1 progress</Typography>
              <Typography variant="body2">{progress}%</Typography>
            </Stack>
            <LinearProgress variant="determinate" value={progress} />
          </Box>

          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom>1. Patient / Referral Information</Typography>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                Fictional patient information for educational practice.
              </Typography>
              <Stack spacing={2}>
                <TextField label="Patient name" value={evaluation.formData.patientInfo.patientName}
                  onChange={(e) => updateForm("patientInfo", "patientName", e.target.value)} disabled={evaluation.status === "submitted"} />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField fullWidth label="Medical record number" value={evaluation.formData.patientInfo.medicalRecordNumber}
                    onChange={(e) => updateForm("patientInfo", "medicalRecordNumber", e.target.value)} disabled={evaluation.status === "submitted"} />
                  <TextField fullWidth label="Date of birth" type="date" slotProps={{ inputLabel: { shrink: true } }}
                    value={evaluation.formData.patientInfo.dateOfBirth}
                    onChange={(e) => updateForm("patientInfo", "dateOfBirth", e.target.value)} disabled={evaluation.status === "submitted"} />
                </Stack>
                <TextField label="Evaluation date" type="date" slotProps={{ inputLabel: { shrink: true } }}
                  value={evaluation.formData.patientInfo.evaluationDate}
                  onChange={(e) => updateForm("patientInfo", "evaluationDate", e.target.value)} disabled={evaluation.status === "submitted"} />
                <TextField label="Referral source" value={evaluation.formData.patientInfo.referralSource}
                  onChange={(e) => updateForm("patientInfo", "referralSource", e.target.value)} disabled={evaluation.status === "submitted"} />
                <TextField label="Medical diagnosis" value={evaluation.formData.patientInfo.medicalDiagnosis}
                  onChange={(e) => updateForm("patientInfo", "medicalDiagnosis", e.target.value)} disabled={evaluation.status === "submitted"} />
                <TextField label="Reason for OT referral" multiline minRows={3} value={evaluation.formData.patientInfo.reasonForReferral}
                  onChange={(e) => updateForm("patientInfo", "reasonForReferral", e.target.value)} disabled={evaluation.status === "submitted"} />
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom>2. Occupational Profile</Typography>
              <Stack spacing={2}>
                <TextField label="Prior setting / living environment" multiline minRows={2} value={evaluation.formData.occupationalProfile.priorSetting}
                  onChange={(e) => updateForm("occupationalProfile", "priorSetting", e.target.value)} disabled={evaluation.status === "submitted"} />
                <TextField label="Current living situation" multiline minRows={2} value={evaluation.formData.occupationalProfile.livingSituation}
                  onChange={(e) => updateForm("occupationalProfile", "livingSituation", e.target.value)} disabled={evaluation.status === "submitted"} />
                <TextField label="Important roles" value={evaluation.formData.occupationalProfile.roles}
                  onChange={(e) => updateForm("occupationalProfile", "roles", e.target.value)} disabled={evaluation.status === "submitted"} />
                <TextField label="Typical routines" multiline minRows={2} value={evaluation.formData.occupationalProfile.routines}
                  onChange={(e) => updateForm("occupationalProfile", "routines", e.target.value)} disabled={evaluation.status === "submitted"} />
                <TextField label="Interests / meaningful occupations" multiline minRows={2} value={evaluation.formData.occupationalProfile.interests}
                  onChange={(e) => updateForm("occupationalProfile", "interests", e.target.value)} disabled={evaluation.status === "submitted"} />
                <TextField label="Patient-stated goals" multiline minRows={2} value={evaluation.formData.occupationalProfile.patientGoals}
                  onChange={(e) => updateForm("occupationalProfile", "patientGoals", e.target.value)} disabled={evaluation.status === "submitted"} />
                <TextField label="Occupational concerns identified during interview" multiline minRows={3} value={evaluation.formData.occupationalProfile.occupationalConcerns}
                  onChange={(e) => updateForm("occupationalProfile", "occupationalConcerns", e.target.value)} disabled={evaluation.status === "submitted"} />
              </Stack>
            </CardContent>
          </Card>

          {message && <Alert severity={message.startsWith("Draft") || message.startsWith("Evaluation") ? "success" : "error"}>{message}</Alert>}

          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button variant="outlined" onClick={saveDraft} disabled={evaluation.status === "submitted"}>Save Draft</Button>
            <Button variant="contained" onClick={submitEvaluation} disabled={evaluation.status === "submitted"}>Submit Evaluation</Button>
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
              <Button variant="contained" size="large" onClick={startEvaluation}>Start Evaluation</Button>
            </Stack>
          </CardContent>
        </Card>

        <Divider>OR</Divider>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h5">Resume an evaluation</Typography>
              <TextField label="Resume code" placeholder="SNF-8K4X-27QP" value={resumeCode} onChange={(e) => setResumeCode(e.target.value.toUpperCase())} />
              <Button variant="outlined" size="large" onClick={resumeEvaluation}>Resume Evaluation</Button>
            </Stack>
          </CardContent>
        </Card>

        <Alert severity="warning">
          Checkpoint 1 uses browser storage only. Firestore persistence will be wired in the next checkpoint.
        </Alert>

        {message && <Alert severity="error">{message}</Alert>}
      </Stack>
    </Container>
  );
}
