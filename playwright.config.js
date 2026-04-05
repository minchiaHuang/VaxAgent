const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 45000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
  },
  webServer: [
    {
      command: "python3 -m http.server 4173 --bind 127.0.0.1",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: true,
    },
    {
      command: "CORS_ORIGIN=http://127.0.0.1:4173 DB_PATH=/tmp/vaxagent-playwright.db REPORTS_DIR=/tmp/vaxagent-playwright-reports JOBS_DIR=/tmp/vaxagent-playwright-jobs DISABLE_UPLOAD_CACHE_EVICTION=true PIPELINE_STEP_DELAY_SECONDS=0.01 .venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8010",
      cwd: "./backend",
      url: "http://127.0.0.1:8010/health",
      reuseExistingServer: false,
    },
  ],
});
