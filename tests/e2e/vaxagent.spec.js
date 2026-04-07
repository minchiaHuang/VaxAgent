const path = require("path");
const { test, expect } = require("@playwright/test");

const sampleVcf = path.resolve(__dirname, "../fixtures/tiny.vcf");
const backendUrl = "http://127.0.0.1:8010";
const backendQuery = `/?api=${encodeURIComponent(backendUrl)}`;

test("wizard starts on step 1 with diagnosis form", async ({ page }) => {
  await page.goto("/");

  // Step 1 should be visible
  await expect(page.locator("#step-diagnosis")).toBeVisible();
  await expect(page.locator("#step-upload")).not.toBeVisible();
  await expect(page.locator("#step-candidates")).not.toBeVisible();

  // Next button should be disabled until form is filled
  await expect(page.locator("#wizard-next")).toBeDisabled();

  // Fill species and cancer type
  await page.locator('[data-species="dog"]').click();
  await page.locator("#cancer-type-select").selectOption("lymphoma");

  // Next should now be enabled
  await expect(page.locator("#wizard-next")).toBeEnabled();

  // Sequencing guidance should appear
  await expect(page.locator("#sequencing-guidance")).toBeVisible();
});

test("fallback demo loads from step 2 and advances to candidates", async ({ page }) => {
  await page.goto("/?api=http://127.0.0.1:65535&timeout_ms=50");

  // Fill step 1
  await page.locator('[data-species="dog"]').click();
  await page.locator("#cancer-type-select").selectOption("melanoma");
  await page.locator("#wizard-next").click();

  // Should be on step 2
  await expect(page.locator("#step-upload")).toBeVisible();

  // Click demo button
  await page.getByRole("button", { name: /demo case/i }).click();

  // Should auto-advance to step 3 with candidates
  await expect(page.locator("#step-candidates")).toBeVisible();
  await expect(page.locator("#mode-chip")).toHaveText("Demo mode");
  await expect(page.locator("#candidate-list .candidate-card")).toHaveCount(5);

  // Candidates should use pet-owner language (binding badges, not raw IC50)
  await expect(page.locator(".binding-badge").first()).toBeVisible();

  // Click a candidate to expand details
  await page.locator('[data-rank="1"]').click();
  await expect(page.locator(".candidate-detail")).toBeVisible();
  await expect(page.locator(".candidate-detail")).toContainText("immune system");

  // Navigate to blueprint
  await page.locator("#wizard-next").click();
  await expect(page.locator("#step-blueprint")).toBeVisible();
  await expect(page.locator("#blueprint-card")).toContainText("vaccine targets");

  // Export should work from step 4
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export-brief").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("vaxagent-vaccine-report.md");

  // Navigate to next steps
  await page.locator("#wizard-next").click();
  await expect(page.locator("#step-nextsteps")).toBeVisible();
  await expect(page.locator(".vet-letter-text")).toContainText("Melanoma");
});

test("backend happy path streams pipeline and shows candidates", async ({ page }) => {
  await page.goto(backendQuery);

  // Fill step 1
  await page.locator('[data-species="cat"]').click();
  await page.locator("#cancer-type-select").selectOption("lymphoma");
  await page.locator("#wizard-next").click();

  // On step 2 — click demo (will try backend first)
  await page.getByRole("button", { name: /demo case/i }).click();

  // Should auto-advance to step 3 with candidates
  await expect(page.locator("#step-candidates")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("#candidate-list .candidate-card")).toHaveCount(10);
  await expect(page.locator("#summary-grid .summary-card")).toHaveCount(4);

  // Can navigate to blueprint and export PDF
  await page.locator("#wizard-next").click();
  await expect(page.locator("#step-blueprint")).toBeVisible();
  await expect(page.locator("#export-brief")).toBeEnabled();
});

test("quick upload path analyses file and shows results", async ({ page }) => {
  await page.goto(backendQuery);

  // Fill step 1
  await page.locator('[data-species="dog"]').click();
  await page.locator("#cancer-type-select").selectOption("osteosarcoma");
  await page.locator("#wizard-next").click();

  // On step 2 — upload file
  await page.locator("#vcf-file-input").setInputFiles(sampleVcf);
  await page.getByRole("button", { name: "Analyse My File" }).click();

  // Should auto-advance to step 3 after pipeline completes
  await expect(page.locator("#step-candidates")).toBeVisible({ timeout: 30000 });
  await expect(page.locator("#candidate-list .candidate-card")).toHaveCount(10);
});

test("wizard back navigation works", async ({ page }) => {
  await page.goto("/?api=http://127.0.0.1:65535&timeout_ms=50");

  // Fill step 1 and advance
  await page.locator('[data-species="dog"]').click();
  await page.locator("#cancer-type-select").selectOption("melanoma");
  await page.locator("#wizard-next").click();
  await expect(page.locator("#step-upload")).toBeVisible();

  // Load demo to get to step 3
  await page.getByRole("button", { name: /demo case/i }).click();
  await expect(page.locator("#step-candidates")).toBeVisible();

  // Go back to step 2
  await page.locator("#wizard-back").click();
  await expect(page.locator("#step-upload")).toBeVisible();

  // Go back to step 1
  await page.locator("#wizard-back").click();
  await expect(page.locator("#step-diagnosis")).toBeVisible();
});

test("progress bar allows clicking completed steps", async ({ page }) => {
  await page.goto("/?api=http://127.0.0.1:65535&timeout_ms=50");

  // Complete step 1
  await page.locator('[data-species="dog"]').click();
  await page.locator("#cancer-type-select").selectOption("melanoma");
  await page.locator("#wizard-next").click();

  // Load demo to unlock all steps
  await page.getByRole("button", { name: /demo case/i }).click();
  await expect(page.locator("#step-candidates")).toBeVisible();

  // Click step 1 in progress bar
  await page.locator('.wizard-progress-step[data-step="1"]').click();
  await expect(page.locator("#step-diagnosis")).toBeVisible();

  // Click step 5 in progress bar
  await page.locator('.wizard-progress-step[data-step="5"]').click();
  await expect(page.locator("#step-nextsteps")).toBeVisible();
});
