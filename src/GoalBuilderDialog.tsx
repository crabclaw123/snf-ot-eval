import { useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { AssistanceLevel, OTGoal } from "./types";
import {
  GOAL_BUILDER_STEPS,
  GOAL_TIMEFRAMES,
  GOAL_TYPES,
  buildGoalStatement,
  calculateGoalTargetDate,
  formatGoalDate,
  formatSourceFinding,
  goalBuilderCanAdvance,
  occupationLabel,
  recommendedTarget,
  smartConditionOptions,
  smartCriterionOptions,
  smartPurposeOptions,
  smartTargetOptions,
} from "./goalBuilderLogic";

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
  ["functionalMobility", "Functional mobility / ambulation"],
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
];

type Props = {
  open: boolean;
  disabled: boolean;
  draft: OTGoal;
  step: number;
  context: string;
  evaluationDate: string;
  adlPlof: Record<string, AssistanceLevel>;
  adlCurrent: Record<string, AssistanceLevel>;
  isEditing: boolean;
  onDraftChange: (next: OTGoal | ((current: OTGoal) => OTGoal)) => void;
  onStepChange: (step: number) => void;
  onClose: () => void;
  onSave: (goal: OTGoal) => void;
};

function ChoiceButtons({
  options,
  value,
  suggested,
  disabled = false,
  onChange,
}: {
  options: string[];
  value: string;
  suggested?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Stack spacing={1}>
      {options.map(option => (
        <Button
          key={option}
          variant={value === option ? "contained" : "outlined"}
          onClick={() => onChange(option)}
          disabled={disabled}
          sx={{ justifyContent: "space-between", textTransform: "none", py: 1.25, textAlign: "left" }}
        >
          <span>{option}</span>
          {suggested === option && <Chip size="small" label="Suggested" color={value === option ? "default" : "primary"} />}
        </Button>
      ))}
    </Stack>
  );
}

function BaselineSelect({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: AssistanceLevel;
  onChange: (value: AssistanceLevel) => void;
  disabled: boolean;
}) {
  return (
    <FormControl fullWidth disabled={disabled}>
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={value} onChange={event => onChange(event.target.value as AssistanceLevel)}>
        <MenuItem value=""><em>Not documented</em></MenuItem>
        {ASSISTANCE_OPTIONS.map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}
      </Select>
    </FormControl>
  );
}

export default function GoalBuilderDialog({
  open,
  disabled,
  draft,
  step,
  context,
  evaluationDate,
  adlPlof,
  adlCurrent,
  isEditing,
  onDraftChange,
  onStepChange,
  onClose,
  onSave,
}: Props) {
  const wizardStep = GOAL_BUILDER_STEPS[step] || GOAL_BUILDER_STEPS[0];
  const baseline = draft.occupation
    ? {
        plof: adlPlof[draft.occupation] ?? "",
        current: adlCurrent[draft.occupation] ?? "",
      }
    : { plof: "" as AssistanceLevel, current: "" as AssistanceLevel };

  const effectiveGoal: OTGoal = {
    ...draft,
    plof: draft.plof || baseline.plof,
    current: draft.current || baseline.current,
  };

  const generatedGoal = buildGoalStatement(effectiveGoal);
  const finalGoalText = draft.goalStatement.trim() || generatedGoal;
  const sourceLabel = formatSourceFinding(effectiveGoal);
  const suggestedTarget = recommendedTarget(effectiveGoal);
  const targetOptions = useMemo(
    () => smartTargetOptions(effectiveGoal),
    [effectiveGoal.sourceType, effectiveGoal.sourceBaseline, effectiveGoal.current, effectiveGoal.occupation],
  );
  const purposeOptions = useMemo(
    () => smartPurposeOptions(effectiveGoal),
    [effectiveGoal.sourceType, effectiveGoal.sourceSide, effectiveGoal.occupation],
  );
  const conditionOptions = useMemo(() => smartConditionOptions(effectiveGoal), [effectiveGoal.sourceType]);
  const criterionOptions = useMemo(() => smartCriterionOptions(effectiveGoal), [effectiveGoal.sourceType]);

  const update = (changes: Partial<OTGoal>) => {
    onDraftChange(current => ({ ...current, ...changes }));
  };

  const chooseOccupation = (occupation: string) => {
    const nextPlof = adlPlof[occupation] ?? "";
    const nextCurrent = adlCurrent[occupation] ?? "";
    onDraftChange(current => ({
      ...current,
      occupation,
      plof: nextPlof,
      current: nextCurrent,
      ...(current.occupation !== occupation ? { performanceProblem: "", target: "" } : {}),
    }));
  };

  const enterCustomOccupation = (occupation: string) => {
    onDraftChange(current => ({
      ...current,
      occupation,
      plof: "",
      current: "",
      ...(current.occupation !== occupation ? { performanceProblem: "", target: "" } : {}),
    }));
  };

  const chooseTimeframe = (timeframe: string) => {
    const baseDate = evaluationDate || new Date().toISOString().slice(0, 10);
    const targetDate = calculateGoalTargetDate(baseDate, timeframe);
    update({ timeframe, targetDate });
  };

  const enterCustomTimeframe = (timeframe: string) => {
    onDraftChange(current => ({
      ...current,
      timeframe,
      ...(current.timeframe !== timeframe ? { targetDate: "" } : {}),
    }));
  };

  const handleSave = () => {
    const next: OTGoal = {
      ...effectiveGoal,
      goalStatement: finalGoalText,
      targetDate: effectiveGoal.targetDate || "",
    };
    onSave(next);
  };

  const canAdvance = goalBuilderCanAdvance(wizardStep.key, effectiveGoal);
  const isLastStep = step === GOAL_BUILDER_STEPS.length - 1;
  const hasCustomizedWording = !!draft.goalStatement.trim();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{isEditing ? "Edit an OT Goal" : "Build an OT Goal"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.25}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
            <Box>
              <Typography color="text.secondary">Step {step + 1} of {GOAL_BUILDER_STEPS.length}</Typography>
              <Typography variant="h6" fontWeight={700}>{wizardStep.title}</Typography>
              <Typography color="text.secondary">{wizardStep.help}</Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              {GOAL_TYPES.map(type => (
                <Button
                  key={type}
                  size="small"
                  variant={effectiveGoal.type === type ? "contained" : "outlined"}
                  onClick={() => update({ type })}
                  disabled={disabled}
                  sx={{ textTransform: "none", whiteSpace: "nowrap" }}
                >
                  {type === "Short-term" ? "STG" : "LTG"}
                </Button>
              ))}
            </Stack>
          </Stack>

          {context && (
            <Alert severity="info">
              Started from: <strong>{context}</strong>
              {!draft.occupation && " — connect this finding to the occupation it is limiting."}
            </Alert>
          )}
          {sourceLabel && <Chip label={`Source finding: ${sourceLabel}`} color="secondary" sx={{ alignSelf: "flex-start" }} />}

          {wizardStep.key === "focus" && (
            <Stack spacing={2.25}>
              <Box>
                <Typography fontWeight={700} sx={{ mb: 1 }}>Occupation / activity</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
                  Choose a common SNF occupation or enter another meaningful occupation below.
                </Typography>
                <Stack spacing={1}>
                  {ADLS.map(([key, label]) => (
                    <Button
                      key={key}
                      variant={effectiveGoal.occupation === key ? "contained" : "outlined"}
                      onClick={() => chooseOccupation(key)}
                      disabled={disabled}
                      sx={{ justifyContent: "flex-start", textTransform: "none", py: 1.1 }}
                    >
                      {label}
                    </Button>
                  ))}
                </Stack>
              </Box>

              <TextField
                fullWidth
                label="Or enter your own occupation / activity"
                value={ADLS.some(([key]) => key === draft.occupation) ? "" : draft.occupation}
                onChange={event => enterCustomOccupation(event.target.value)}
                disabled={disabled}
                placeholder="Example: meal preparation, medication management, leisure participation"
              />

              {!!effectiveGoal.occupation && (
                <Card variant="outlined">
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Typography fontWeight={700}>Functional baseline</Typography>
                      <Typography variant="body2" color="text.secondary">
                        These values are carried from the Performance section when available. They remain editable for a custom occupation.
                      </Typography>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                        <BaselineSelect label="Prior level of function" value={effectiveGoal.plof} disabled={disabled} onChange={value => update({ plof: value })} />
                        <BaselineSelect label="Current level of function" value={effectiveGoal.current} disabled={disabled} onChange={value => update({ current: value })} />
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              )}

              {!!effectiveGoal.occupation && (
                <Box>
                  <Typography fontWeight={700} sx={{ mb: 0.5 }}>Functional purpose</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
                    What occupational outcome is this goal intended to improve?
                  </Typography>
                  <ChoiceButtons options={purposeOptions} value={effectiveGoal.performanceProblem} disabled={disabled} onChange={value => update({ performanceProblem: value })} />
                  <TextField
                    fullWidth
                    sx={{ mt: 1.5 }}
                    label="Functional purpose (editable)"
                    value={effectiveGoal.performanceProblem}
                    onChange={event => update({ performanceProblem: event.target.value })}
                    disabled={disabled}
                    multiline
                    minRows={2}
                    placeholder="Example: improve ability to manage clothing during toileting"
                  />
                </Box>
              )}
            </Stack>
          )}

          {wizardStep.key === "target" && (
            <Stack spacing={2}>
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={0.75}>
                    <Typography fontWeight={700}>Documented starting point</Typography>
                    {sourceLabel ? (
                      <Typography>{sourceLabel}</Typography>
                    ) : (
                      <Typography>
                        {occupationLabel(effectiveGoal.occupation)} — Current level: <strong>{effectiveGoal.current || "Not documented"}</strong>
                        {effectiveGoal.plof ? <> · PLOF: <strong>{effectiveGoal.plof}</strong></> : null}
                      </Typography>
                    )}
                  </Stack>
                </CardContent>
              </Card>

              <Box>
                <Typography fontWeight={700} sx={{ mb: 0.5 }}>Target performance</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
                  The suggested target is a starting point only. Choose or enter the target supported by your clinical reasoning.
                </Typography>
                <ChoiceButtons options={targetOptions} value={effectiveGoal.target} suggested={suggestedTarget} disabled={disabled} onChange={value => update({ target: value })} />
                <TextField
                  fullWidth
                  sx={{ mt: 1.5 }}
                  label={effectiveGoal.sourceType === "ROM" ? "ROM target (editable)" : effectiveGoal.sourceType === "Strength" ? "Strength target (editable)" : "Target performance (editable)"}
                  value={effectiveGoal.target}
                  onChange={event => update({ target: event.target.value })}
                  disabled={disabled}
                  placeholder={effectiveGoal.sourceType === "ROM" ? "Example: 110°" : effectiveGoal.sourceType === "Strength" ? "Example: 4-/5" : "Example: with setup assistance using adaptive equipment"}
                />
              </Box>
            </Stack>
          )}

          {wizardStep.key === "criteria" && (
            <Stack spacing={2.5}>
              <Alert severity="info">
                Conditions and consistency criteria are optional. Add them only when they make the goal more specific; do not add extra clauses just to fill the form.
              </Alert>

              <Box>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1} sx={{ mb: 1 }}>
                  <Box>
                    <Typography fontWeight={700}>Condition / context</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Cueing, equipment, safety, positioning, or other conditions that matter for performance.
                    </Typography>
                  </Box>
                  {!!effectiveGoal.condition && <Button size="small" disabled={disabled} onClick={() => update({ condition: "" })}>Clear condition</Button>}
                </Stack>
                <ChoiceButtons options={conditionOptions} value={effectiveGoal.condition} disabled={disabled} onChange={value => update({ condition: value })} />
                <TextField
                  fullWidth
                  sx={{ mt: 1.5 }}
                  label="Condition / context (editable)"
                  value={effectiveGoal.condition}
                  onChange={event => update({ condition: event.target.value })}
                  disabled={disabled}
                  multiline
                  minRows={2}
                  placeholder="Example: using a reacher and no more than one verbal cue"
                />
              </Box>

              <Divider />

              <Box>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1} sx={{ mb: 1 }}>
                  <Box>
                    <Typography fontWeight={700}>Success / consistency criterion</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Add repeated performance or measurement language when it strengthens the goal.
                    </Typography>
                  </Box>
                  {!!effectiveGoal.measurableCriterion && <Button size="small" disabled={disabled} onClick={() => update({ measurableCriterion: "" })}>Clear criterion</Button>}
                </Stack>
                <ChoiceButtons options={criterionOptions} value={effectiveGoal.measurableCriterion} disabled={disabled} onChange={value => update({ measurableCriterion: value })} />
                <TextField
                  fullWidth
                  sx={{ mt: 1.5 }}
                  label="Success criterion (editable)"
                  value={effectiveGoal.measurableCriterion}
                  onChange={event => update({ measurableCriterion: event.target.value })}
                  disabled={disabled}
                  multiline
                  minRows={2}
                  placeholder="Example: in 4 of 5 observed opportunities"
                />
              </Box>
            </Stack>
          )}

          {wizardStep.key === "timeframe" && (
            <Stack spacing={2.25}>
              <Box>
                <Typography fontWeight={700} sx={{ mb: 0.5 }}>Expected timeframe</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
                  Preset target dates are calculated from the evaluation date ({formatGoalDate(evaluationDate) || "not documented"}), not the date the goal builder happens to be opened.
                </Typography>
                <ChoiceButtons options={GOAL_TIMEFRAMES} value={effectiveGoal.timeframe} disabled={disabled} onChange={chooseTimeframe} />
                <TextField
                  fullWidth
                  sx={{ mt: 1.5 }}
                  label="Custom timeframe"
                  value={effectiveGoal.timeframe}
                  onChange={event => enterCustomTimeframe(event.target.value)}
                  disabled={disabled}
                  placeholder="Example: within 10 treatment sessions"
                />
              </Box>

              <TextField
                fullWidth
                type="date"
                label="Target date"
                value={effectiveGoal.targetDate || ""}
                onChange={event => update({ targetDate: event.target.value })}
                disabled={disabled}
                InputLabelProps={{ shrink: true }}
              />

              {hasCustomizedWording && (
                <Alert severity="info">
                  Customized goal wording is being preserved while you edit the structured fields. Review it below to make sure it still matches your selections, or reset it to the newly generated wording.
                </Alert>
              )}

              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1}>
                      <Box>
                        <Typography fontWeight={700}>Final goal statement</Typography>
                        <Typography variant="body2" color="text.secondary">
                          The generated wording is fully editable. Your final text is what will be saved to the evaluation and carried into future progress notes.
                        </Typography>
                      </Box>
                      {hasCustomizedWording && (
                        <Button size="small" disabled={disabled} onClick={() => update({ goalStatement: "" })}>Reset to generated wording</Button>
                      )}
                    </Stack>
                    <TextField
                      fullWidth
                      value={finalGoalText}
                      onChange={event => update({ goalStatement: event.target.value })}
                      disabled={disabled}
                      multiline
                      minRows={5}
                      placeholder="Complete the earlier steps to generate a goal, or write the full goal in your own wording."
                    />
                    {hasCustomizedWording && <Chip size="small" label="Customized wording" color="info" sx={{ alignSelf: "flex-start" }} />}
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          )}

          {wizardStep.key !== "timeframe" && (
            <Card variant="outlined" sx={{ bgcolor: "action.hover" }}>
              <CardContent>
                <Typography fontWeight={700}>Goal so far</Typography>
                <Typography sx={{ mt: 0.75 }} color={generatedGoal ? "text.primary" : "text.secondary"}>
                  {generatedGoal || (
                    wizardStep.key === "focus"
                      ? effectiveGoal.occupation && effectiveGoal.performanceProblem
                        ? `${occupationLabel(effectiveGoal.occupation)} — ${effectiveGoal.performanceProblem}`
                        : "Choose the occupation and functional purpose to begin building the goal."
                      : "Complete the required selections above to build the goal statement."
                  )}
                </Typography>
                {hasCustomizedWording && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                    A customized final statement is preserved separately and can be reviewed on Step 4.
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}

          <Typography variant="caption" color="text.secondary">
            Educational support only: suggested targets and phrases are prompts, not prescriptions. The treating OT remains responsible for selecting a clinically appropriate, patient-centered goal.
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ justifyContent: "space-between", px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={() => onStepChange(Math.max(0, step - 1))} disabled={step === 0}>Back</Button>
          {!isLastStep ? (
            <Button variant="contained" onClick={() => onStepChange(step + 1)} disabled={!canAdvance || disabled}>Next</Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={disabled || !canAdvance || !effectiveGoal.occupation.trim() || !effectiveGoal.target.trim() || !effectiveGoal.performanceProblem.trim() || !finalGoalText.trim()}
            >
              {isEditing ? "Save Changes" : "Add Goal"}
            </Button>
          )}
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
