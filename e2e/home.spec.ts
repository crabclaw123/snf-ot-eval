import { test, expect } from "@playwright/test";

test.describe("SNF OT Evaluation home screen", () => {
  test("loads the evaluation home screen", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "SNF OT Evaluation" }).first()).toBeVisible();
    await expect(page.getByText("Start a blank evaluation")).toBeVisible();
    await expect(page.getByText("Resume an evaluation")).toBeVisible();
  });

  test("requires a student name before starting an evaluation", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Start Evaluation" }).click();

    await expect(page.getByText("Enter your name before starting.")).toBeVisible();
    await expect(page.getByText("Start a blank evaluation")).toBeVisible();
  });

  test("requires a resume code before attempting to resume", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Resume Evaluation" }).click();

    await expect(page.getByText("Enter a resume code.")).toBeVisible();
    await expect(page.getByText("Resume an evaluation")).toBeVisible();
  });

  test("fills a complete sample evaluation across all sections and saves the draft", async ({ page }) => {
    const selectOption = async (label: string, option: string) => {
      await page.getByRole("combobox", { name: label }).click();
      await page.getByRole("option", { name: option, exact: true }).click();
    };

    const selectFinding = async (index: number, option: string) => {
      await page.getByRole("combobox").nth(index).click();
      await page.getByRole("option", { name: option, exact: true }).click();
    };

    await page.goto("/");

    await page.getByLabel("Student name").fill("E2E Sample Student");
    await page.getByRole("button", { name: "Start Evaluation" }).click();

    await expect(page.getByRole("heading", { name: "SNF OT Initial Evaluation" })).toBeVisible();
    await expect(page.getByText(/Student: E2E Sample Student/)).toBeVisible();

    // 1. Patient / Referral
    await page.getByLabel("Patient name").fill("John Sample");
    await page.getByLabel("Medical record number").fill("E2E-001");
    await page.getByLabel("Date of birth").fill("1948-06-15");
    await page.getByLabel("Evaluation date").fill("2026-09-29");
    await page.getByLabel("Medical diagnosis").fill("Left hip fracture, status post ORIF");
    await page.getByLabel("Reason for OT referral").fill("Evaluate and treat deficits in ADL performance, functional mobility, balance, and safety following left hip fracture.");
    await selectOption("Weight-bearing status", "WBAT");
    await page.getByLabel("Precautions / relevant medical considerations").fill("Fall risk; posterior hip precautions.");
    await page.getByLabel("Pain rating (0–10)").fill("6");
    await selectOption("Does pain interfere with occupational participation?", "Yes");
    await selectOption("Pain timing", "With activity");
    await page.getByLabel("Pain location").fill("Left hip");
    await page.getByLabel("Pain description").fill("Aching pain increases with transfers and lower-body dressing.");
    await page.getByRole("button", { name: "2. Occupational Profile" }).click();

    // 2. Occupational Profile
    await page.getByLabel("Occupational Profile / Patient Summary").fill(
      "Retired machinist who lives with his spouse in a one-story home. Prior to the fracture he was independent with ADLs, medication management, household mobility, and community participation. He enjoys woodworking and attending church. Current priorities are returning home safely and resuming independent self-care."
    );
    await page.getByRole("button", { name: "3. Environment" }).click();

    // 3. Environment
    await page.getByLabel("Environment / Home Setup").fill(
      "One-story home with three steps to enter and a tub/shower combination. Spouse is available to provide intermittent assistance. Bedroom and bathroom are on the main level."
    );
    await page.getByLabel("Current equipment / DME / assistive devices (list)").fill(
      "Rolling walker, shower chair, raised toilet seat, grab bar."
    );
    await page.getByRole("button", { name: "4. Performance" }).click();

    // 4. Performance
    const adls = [
      ["Eating", "Independent", "Independent"],
      ["Grooming", "Independent", "Supervision"],
      ["Bathing", "Independent", "Moderate Assist"],
      ["Upper-body dressing", "Independent", "Supervision"],
      ["Lower-body dressing", "Independent", "Maximal Assist"],
      ["Toileting", "Independent", "Minimal Assist"],
      ["Toilet transfer", "Independent", "Minimal Assist"],
      ["Shower transfer", "Independent", "Moderate Assist"],
      ["Bed mobility", "Independent", "Supervision"],
      ["Transfers", "Independent", "Minimal Assist"],
      ["Functional mobility / ambulation", "Independent", "Contact Guard Assist"],
    ] as const;

    for (const [label, plof, current] of adls) {
      await selectOption("PLOF", plof);
      await selectOption("Current level", current);
    }

    await page.getByLabel("Current occupational performance / functional observations").fill(
      "Patient requires assistance for lower-body dressing and transfers due to left hip pain, reduced balance, and hip precautions. Uses rolling walker with contact guard assistance and benefits from verbal safety cues."
    );
    await page.getByLabel("Activity tolerance").fill("Fair; tolerates approximately 15 minutes of standing activity.");
    await page.getByLabel("Cueing needed").fill("Intermittent verbal cues for walker management and hip precautions.");
    await page.getByLabel("Safety awareness").fill("Fair; requires reminders to maintain hip precautions during functional tasks.");
    await page.getByRole("button", { name: "5. ROM" }).click();

    // 5. ROM — document representative right and left findings.
    await selectFinding(0, "WNL");
    await selectFinding(1, "Impaired");
    await page.getByLabel("AROM (degrees)").fill("80");
    await page.getByLabel("PROM (degrees)").fill("90");
    await page.getByLabel("Notes").fill("Pain-limited shoulder flexion.");
    await page.getByLabel("ROM summary / clinical notes").fill("Mild left shoulder limitation; remaining tested UE ROM grossly functional.");
    await page.getByRole("button", { name: "6. Strength" }).click();

    // 6. Strength — document representative right and left findings.
    await selectFinding(0, "WNL");
    await selectFinding(1, "Impaired");
    await selectOption("MMT", "4-");
    await page.getByLabel("Notes").fill("Mild weakness with left shoulder flexion.");
    await page.getByLabel("Strength summary / clinical notes").fill("Gross UE strength functional for basic ADLs with mild left-sided weakness.");
    await page.getByRole("button", { name: "7. Cognition, Communication & Sensory Skills" }).click();

    // 7. Cognition, Communication & Sensory Skills
    for (const label of ["Person", "Place", "Time", "Situation"]) {
      await page.getByLabel(label, { exact: true }).check();
    }
    await selectOption("Cognitive / command-following status", "Follows multi-step commands");
    await selectOption("Communication", "Functional verbal communication");
    await selectOption("Vision", "Functional for observed tasks");
    await selectOption("Hearing", "Functional for conversation");
    await selectOption("Sensation", "Intact for observed tasks");
    await selectOption("Coordination", "Functional");
    await selectOption("Balance", "Moderately impaired");
    await selectOption("Endurance / activity tolerance", "Moderately limited");
    await selectOption("Motor planning / praxis", "Functional");
    await selectOption("Functional mobility", "Requires physical assistance");
    await page.getByRole("button", { name: "8. Clinical Assessment" }).click();

    // 8. Clinical Assessment
    await page.getByLabel("Assessment / Clinical Impression").fill(
      "Patient presents with decreased ADL independence, impaired balance, reduced activity tolerance, left hip pain, and need for safety cues following hip fracture and ORIF. Deficits limit toileting, dressing, bathing, transfers, and functional mobility. Skilled OT is indicated to improve occupational performance, safety, compensatory strategy use, and discharge readiness."
    );
    await selectOption("Rehabilitation prognosis", "Good");
    await page.getByRole("button", { name: "9. Goals" }).click();

    // 9. Goals — exercise the guided goal builder.
    await page.getByRole("button", { name: "Open Guided Goal Builder" }).click();
    await page.getByRole("button", { name: "Toileting", exact: true }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Minimal Assist", exact: true }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "improve independence with toileting", exact: true }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "with no more than 1 verbal cue", exact: true }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "in 4 out of 5 observed opportunities", exact: true }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "2 weeks", exact: true }).click();
    await page.getByRole("button", { name: "Add Goal" }).click();
    await expect(page.getByText(/Short-term Goal 1/)).toBeVisible();
    await page.getByRole("button", { name: "10. Plan of Care" }).click();

    // 10. Plan of Care
    await page.getByLabel("Frequency").fill("5x/week");
    await page.getByLabel("Duration").fill("4 weeks");
    await page.getByLabel("ADL retraining").check();
    await page.getByLabel("Functional mobility / transfer training").check();
    await page.getByLabel("Therapeutic activity").check();
    await page.getByLabel("Balance training").check();
    await page.getByLabel("Adaptive equipment training").check();
    await page.getByLabel("Caregiver education").check();
    await page.getByLabel("Patient / caregiver education").fill(
      "Educated patient and spouse on hip precautions, safe transfer technique, walker management, and adaptive equipment use."
    );
    await page.getByLabel("Discharge planning / anticipated disposition").fill(
      "Anticipate discharge home with spouse and home health services when safe functional mobility and ADL performance are established."
    );
    await page.getByRole("button", { name: "11. Section GG" }).click();

    // 11. Section GG — populate the functional scoring fields.
    const ggFields = [
      ["Eating", "06 — Independent"],
      ["Oral hygiene", "06 — Independent"],
      ["Toileting hygiene", "03 — Partial/moderate assistance"],
      ["Shower / bathing", "03 — Partial/moderate assistance"],
      ["Upper-body dressing", "04 — Supervision or touching assistance"],
      ["Lower-body dressing", "02 — Substantial/maximal assistance"],
      ["Footwear", "02 — Substantial/maximal assistance"],
      ["Rolling", "04 — Supervision or touching assistance"],
      ["Sit to lying", "04 — Supervision or touching assistance"],
      ["Lying to sitting", "04 — Supervision or touching assistance"],
      ["Sit to stand", "03 — Partial/moderate assistance"],
      ["Chair / bed transfer", "03 — Partial/moderate assistance"],
      ["Toilet transfer", "03 — Partial/moderate assistance"],
      ["Walking 10 feet", "04 — Supervision or touching assistance"],
      ["Walking 50 feet with turns", "04 — Supervision or touching assistance"],
      ["Stairs", "03 — Partial/moderate assistance"],
    ] as const;

    for (const [label, option] of ggFields) {
      await selectOption(label, option);
    }

    await page.getByLabel("Section GG notes / reasoning").fill(
      "Scores reflect observed performance with rolling walker and current need for assistance due to balance impairment, pain, and hip precautions."
    );
    await page.getByRole("button", { name: "12. Review / Attestation" }).click();

    // 12. Review / Attestation
    await expect(page.getByText(/Progress:/)).toBeVisible();
    await page.getByLabel("Credentials / role").fill("MSOT Student");
    await page.getByLabel(/I attest that this is my educational evaluation work/).check();

    // Save the completed sample as a draft rather than submitting it.
    await page.getByRole("button", { name: "Save Draft" }).click();
    await expect(page.getByText("Draft saved to Firebase.")).toBeVisible();
  });

});
