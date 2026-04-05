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
  await expect(page.locator("#candidate-list .candidate-card")).toHaveCount(5);
  await expect(page.locator("#explanation-card")).toContainText("TP53 R248W ranks #1");
  await expect(page.locator("#blueprint-card")).toContainText("MRNA-HCC1395-DRAFT-01");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Brief" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("vaxagent-research-brief.md");
});

test("backend happy path completes and supports candidate selection", async ({ page }) => {
  await page.goto(backendQuery);
  await page.getByRole("button", { name: "Load Benchmark Case" }).click();

  await expect(page.locator("#mode-chip")).toHaveText("Backend connected");
  await expect(page.locator(".stepper-item.is-complete")).toHaveCount(6);
  await expect(page.locator("#candidate-list .candidate-card")).toHaveCount(10);
  await expect(page.getByRole("button", { name: "Export Brief" })).toBeEnabled();

  await page.locator('[data-rank="2"]').click();
  await expect(page.locator("#explanation-card")).toContainText("PIK3CA E545K ranks #2");
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
  await expect(page.locator("#candidate-list .candidate-card")).toHaveCount(10);
  await expect(page.locator("#upload-status")).toContainText("Analysis complete");
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
