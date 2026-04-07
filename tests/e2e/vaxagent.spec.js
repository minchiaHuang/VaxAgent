const path = require("path");
const { test, expect } = require("@playwright/test");

const sampleVcf = path.resolve(__dirname, "../fixtures/tiny.vcf");
const backendUrl = "http://127.0.0.1:8010";
const backendQuery = `/?api=${encodeURIComponent(backendUrl)}`;

/**
 * Helper: fill step 1 diagnosis form and advance to step 2.
 */
async function fillStep1AndAdvance(page, species = "dog", cancerType = "melanoma") {
  await page.locator(`[data-species="${species}"]`).click();
  await page.locator("#cancer-type-select").selectOption(cancerType);
  await page.locator("#wizard-next").click();
  await expect(page.locator("#step-upload")).toBeVisible();
}

/**
 * Helper: click demo button and load a benchmark.
 * Handles both single-benchmark (auto-load) and multi-benchmark (selector) flows.
 */
async function clickDemoAndWaitForCandidates(page, timeout = 15000) {
  await page.getByRole("button", { name: /benchmark case|demo case/i }).click();

  // If benchmark selector appears, click the first card
  const selector = page.locator("#benchmark-selector");
  const firstCard = page.locator(".benchmark-card").first();
  try {
    await firstCard.waitFor({ state: "visible", timeout: 2000 });
    await firstCard.click();
  } catch {
    // No selector — single benchmark or fallback, auto-loads
  }

  await expect(page.locator("#step-candidates")).toBeVisible({ timeout });
}

test("wizard starts on step 1 with diagnosis form", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#step-diagnosis")).toBeVisible();
  await expect(page.locator("#step-upload")).not.toBeVisible();
  await expect(page.locator("#step-candidates")).not.toBeVisible();

  // Next button disabled until form filled
  await expect(page.locator("#wizard-next")).toBeDisabled();

  // Fill species and cancer type
  await page.locator('[data-species="dog"]').click();
  await page.locator("#cancer-type-select").selectOption("lymphoma");

  await expect(page.locator("#wizard-next")).toBeEnabled();
  await expect(page.locator("#sequencing-guidance")).toBeVisible();

  // Audience toggle should be visible
  await expect(page.locator(".audience-toggle")).toBeVisible();
});

test("fallback demo loads from step 2 and advances to candidates", async ({ page }) => {
  await page.goto("/?api=http://127.0.0.1:65535&timeout_ms=50");

  await fillStep1AndAdvance(page);
  await clickDemoAndWaitForCandidates(page, 15000);

  await expect(page.locator("#mode-chip")).toHaveText("Demo mode");
  await expect(page.locator("#candidate-list .candidate-card").first()).toBeVisible();

  // Origin badge should show benchmark
  await expect(page.locator(".origin-badge")).toBeVisible();

  // Navigate to blueprint
  await page.locator("#wizard-next").click();
  await expect(page.locator("#step-blueprint")).toBeVisible();
});

test("backend happy path streams pipeline and shows candidates", async ({ page }) => {
  await page.goto(backendQuery);

  await fillStep1AndAdvance(page, "cat", "lymphoma");
  await clickDemoAndWaitForCandidates(page, 20000);

  await expect(page.locator("#candidate-list .candidate-card").first()).toBeVisible();

  // Navigate to blueprint
  await page.locator("#wizard-next").click();
  await expect(page.locator("#step-blueprint")).toBeVisible();
  await expect(page.locator("#export-brief")).toBeEnabled();
});

test("quick upload path analyses file and shows results", async ({ page }) => {
  await page.goto(backendQuery);

  await fillStep1AndAdvance(page, "dog", "osteosarcoma");

  // Upload file
  await page.locator("#vcf-file-input").setInputFiles(sampleVcf);
  await page.getByRole("button", { name: "Analyse My File" }).click();

  // Should advance to step 3 after pipeline completes
  await expect(page.locator("#step-candidates")).toBeVisible({ timeout: 30000 });
  await expect(page.locator("#candidate-list .candidate-card").first()).toBeVisible();
});

test("wizard back navigation works", async ({ page }) => {
  await page.goto("/?api=http://127.0.0.1:65535&timeout_ms=50");

  await fillStep1AndAdvance(page);
  await clickDemoAndWaitForCandidates(page, 15000);

  // Go back to step 2
  await page.locator("#wizard-back").click();
  await expect(page.locator("#step-upload")).toBeVisible();

  // Go back to step 1
  await page.locator("#wizard-back").click();
  await expect(page.locator("#step-diagnosis")).toBeVisible();
});

test("progress bar allows clicking completed steps", async ({ page }) => {
  await page.goto("/?api=http://127.0.0.1:65535&timeout_ms=50");

  await fillStep1AndAdvance(page);
  await clickDemoAndWaitForCandidates(page, 15000);

  // Click step 1 in progress bar
  await page.locator('.wizard-progress-step[data-step="1"]').click();
  await expect(page.locator("#step-diagnosis")).toBeVisible();

  // Click step 5 in progress bar
  await page.locator('.wizard-progress-step[data-step="5"]').click();
  await expect(page.locator("#step-nextsteps")).toBeVisible();
});
