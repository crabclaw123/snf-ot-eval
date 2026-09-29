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
});
