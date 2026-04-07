const { defineConfig } = require("@playwright/test");
const path = require("path");

const isWin = process.platform === "win32";
const pythonCmd = isWin ? "python" : "python3";
// Prefer venv if it exists, otherwise use system python
const fs = require("fs");
const venvExists = isWin
  ? fs.existsSync(path.join(__dirname, "backend", ".venv", "Scripts", "python.exe"))
  : fs.existsSync(path.join(__dirname, "backend", ".venv", "bin", "python"));
const venvPython = venvExists
  ? (isWin ? path.join(".", ".venv", "Scripts", "python") : path.join(".", ".venv", "bin", "python"))
  : pythonCmd;

// Build backend command with env vars that works on both Windows and Unix
const backendEnv = [
  "CORS_ORIGIN=http://127.0.0.1:4173",
  "DB_PATH=" + (isWin ? path.join(process.env.TEMP || "/tmp", "vaxagent-playwright.db") : "/tmp/vaxagent-playwright.db"),
  "REPORTS_DIR=" + (isWin ? path.join(process.env.TEMP || "/tmp", "vaxagent-playwright-reports") : "/tmp/vaxagent-playwright-reports"),
  "JOBS_DIR=" + (isWin ? path.join(process.env.TEMP || "/tmp", "vaxagent-playwright-jobs") : "/tmp/vaxagent-playwright-jobs"),
  "DISABLE_UPLOAD_CACHE_EVICTION=true",
  "PIPELINE_STEP_DELAY_SECONDS=0.01",
  "ANTHROPIC_API_KEY=",
];

// On Windows, use 'set VAR=val && cmd'; on Unix, use 'VAR=val cmd'
const backendCommand = isWin
  ? backendEnv.map((e) => `set "${e}"`).join(" && ") + ` && ${venvPython} -m uvicorn main:app --host 127.0.0.1 --port 8010`
  : backendEnv.join(" ") + ` ${venvPython} -m uvicorn main:app --host 127.0.0.1 --port 8010`;

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
      command: `${pythonCmd} -m http.server 4173 --bind 127.0.0.1 --directory frontend`,
      url: "http://127.0.0.1:4173",
      reuseExistingServer: true,
    },
    {
      command: backendCommand,
      cwd: "./backend",
      url: "http://127.0.0.1:8010/health",
      reuseExistingServer: false,
      shell: true,
    },
  ],
});
