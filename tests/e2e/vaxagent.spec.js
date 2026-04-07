const path = require("path");
const { test, expect } = require("@playwright/test");

const sampleVcf = path.resolve(__dirname, "../../test_small.vcf");
const backendUrl = "http://127.0.0.1:8010";
const backendQuery = `/?api=${encodeURIComponent(backendUrl)}`;

test("fallback mode loads fixture and exports markdown", async ({ page }) => {
  await page.goto("/?api=http://127.0.0.1:65535&timeout_ms=50");
  await page.getByRole("button", { name: "Load Benchmark Case" }).click();

  await expect(page.locator("#mode-chip")).toHaveText("Fallback fixture");
  await expect(page.locator("#dataset-title")).toHaveText("HCC1395 Breast Cancer Cell Line");

  // Visual Explorer: funnel scene should be active (Scene 3a)
  await expect(page.locator("#scene-funnel.is-active")).toBeVisible();
  await expect(page.locator(".funnel-viz")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Brief" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("vaxagent-research-brief.md");
});

test("visual explorer scene navigation works in fallback mode", async ({ page }) => {
  await page.goto("/?api=http://127.0.0.1:65535&timeout_ms=50");
  await page.getByRole("button", { name: "Load Benchmark Case" }).click();
  await expect(page.locator("#mode-chip")).toHaveText("Fallback fixture");

  // Scene 3a: Funnel is shown
  await expect(page.locator("#scene-funnel.is-active")).toBeVisible();

  // Navigate to Scene 3b: Explorer
  await page.getByRole("button", { name: "See your targets" }).click();
  await expect(page.locator("#scene-explorer.is-active")).toBeVisible();
  await expect(page.locator(".explorer-tabs")).toBeVisible();

  // Click a different target tab
  await page.locator('.explorer-tab[data-rank="2"]').click();

  // Navigate to Scene 4a: Construct
  await page.getByRole("button", { name: "View Blueprint" }).click();
  await expect(page.locator("#scene-construct.is-active")).toBeVisible();
  await expect(page.locator(".construct-viz")).toBeVisible();

  // Navigate back to Scene 3b
  await page.getByRole("button", { name: "Back to targets" }).click();
  await expect(page.locator("#scene-explorer.is-active")).toBeVisible();

  // Navigate back to Scene 3a
  await page.getByRole("button", { name: "Back to overview" }).click();
  await expect(page.locator("#scene-funnel.is-active")).toBeVisible();
});

test("backend happy path completes and shows visual explorer", async ({ page }) => {
  await page.goto(backendQuery);
  await page.getByRole("button", { name: "Load Benchmark Case" }).click();

  await expect(page.locator("#mode-chip")).toHaveText("Backend connected");
  await expect(page.locator(".stepper-item.is-complete")).toHaveCount(6);
  await expect(page.getByRole("button", { name: "Export Brief" })).toBeEnabled();
  await expect(page.locator("#history-list")).toContainText("HCC1395 Breast Cancer Cell Line");

  // Visual Explorer should be active with funnel scene
  await expect(page.locator("#scene-funnel.is-active")).toBeVisible();

  // Navigate to explorer and select a target
  await page.getByRole("button", { name: "See your targets" }).click();
  await expect(page.locator("#scene-explorer.is-active")).toBeVisible();
  await expect(page.locator("#limitations-list")).toContainText("Human expert review remains required");
});

test("quick upload path uses uploaded filename and completes analysis", async ({ page }) => {
  await page.goto(backendQuery);
  await page.locator("#vcf-file-input").setInputFiles(sampleVcf);
  await page.getByRole("button", { name: "Analyse My File" }).click();

  await expect(page.locator("#mode-chip")).toHaveText("Backend connected");
  await expect(page.locator("#dataset-title")).toHaveText("test_small.vcf");
  await expect(page.locator("#dataset-banner")).toContainText("User-uploaded VCF file.");
  await expect(page.locator("#summary-grid .summary-card")).toHaveCount(4);
  // Visual Explorer should be active after upload completes
  await expect(page.locator("#scene-funnel.is-active")).toBeVisible();
  await expect(page.locator("#upload-status")).toContainText("Analysis complete");
  await expect(page.locator("#history-list")).toContainText("test_small.vcf");

  const uploadedRun = page.locator('.history-card:has-text("test_small.vcf")').first();
  await uploadedRun.getByRole("button", { name: "Reopen Run" }).click();
  await expect(page.locator("#dataset-title")).toHaveText("test_small.vcf");
});

test("full analysis mode can be enabled for UI validation", async ({ page }) => {
  await page.route("**/health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        service: "vaxagent-backend",
        docker: true,
      }),
    });
  });

  await page.goto(backendQuery);
  await expect(page.locator("#mode-full")).toBeEnabled();
  await page.locator("#mode-full").click();

  await expect(page.locator("#mode-description")).toContainText("pVACseq will run inside Docker");
  const required = await page.locator("#hla-alleles-input").evaluate((element) => element.required);
  expect(required).toBe(true);
});
