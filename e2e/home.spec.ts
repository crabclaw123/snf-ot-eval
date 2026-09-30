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

  test("completes a basic evaluation workflow and saves a draft", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel("Student name").fill("E2E Sample Student");
    await page.getByRole("button", { name: "Start Evaluation" }).click();

    await expect(page.getByRole("heading", { name: "SNF OT Initial Evaluation" })).toBeVisible();
    await expect(page.getByText(/Student: E2E Sample Student/)).toBeVisible();

    // Fill a few representative fields using stable text inputs.
    await page.getByLabel("Patient name").fill("John Sample");
    await page.getByLabel("Medical diagnosis").fill("Left hip fracture");
    await page.getByLabel("Reason for OT referral").fill("Evaluate ADL performance and functional mobility.");
    await page.getByLabel("Precautions / relevant medical considerations").fill("Fall risk.");

    await page.getByRole("button", { name: "2. Occupational Profile" }).click();
    await page.getByLabel("Occupational Profile / Patient Summary").fill(
      "Previously independent with ADLs and household mobility. Goal is safe return home."
    );

    await page.getByRole("button", { name: "3. Environment" }).click();
    await page.getByLabel("Environment / Home Setup").fill(
      "One-story home with spouse available for intermittent assistance."
    );

    await page.getByRole("button", { name: "4. Performance" }).click();
    await expect(page.getByRole("heading", { name: "Performance" })).toBeVisible();

    // Use one representative ADL and the text fields that are known to be stable.
    await page.getByLabel("Current occupational performance / functional observations").fill(
      "Requires assistance with transfers and lower-body dressing."
    );
    await page.getByLabel("Activity tolerance").fill("Fair.");
    await page.getByLabel("Cueing needed").fill("Intermittent verbal cues.");
    await page.getByRole("textbox", { name: "Safety awareness" }).fill("Fair.");

    await page.getByRole("button", { name: "5. ROM" }).click();
    await expect(page.getByRole("heading", { name: "ROM" })).toBeVisible();

    await page.getByLabel("AROM (degrees)").fill("90");
    await page.getByLabel("PROM (degrees)").fill("100");
    await page.getByLabel("Notes").fill("Mild limitation.");

    await page.getByRole("button", { name: "8. Clinical Assessment" }).click();
    await page.getByLabel("Assessment / Clinical Impression").fill(
      "Patient demonstrates functional limitations affecting ADLs and mobility. Skilled OT indicated."
    );

    await page.getByRole("button", { name: "10. Plan of Care" }).click();
    await page.getByLabel("Frequency").fill("5x/week");
    await page.getByLabel("Duration").fill("4 weeks");

    await page.getByRole("button", { name: "12. Review / Attestation" }).click();
    await expect(page.getByText(/Progress:/)).toBeVisible();
    await page.getByLabel("Credentials / role").fill("MSOT Student");
    await page.getByLabel(/I attest that this is my educational evaluation work/).check();

    await page.getByRole("button", { name: "Save Draft" }).click();
    await expect(page.getByText("Draft saved to Firebase.")).toBeVisible();
  });

});
