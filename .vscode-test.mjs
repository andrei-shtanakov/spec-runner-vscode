import { defineConfig } from "@vscode/test-cli";

// Integration harness: launches a real VS Code, opens the fixture workspace
// (which sets spec-runner.path to the fake node script), and runs the compiled
// mocha tests from out/test-integration.
export default defineConfig({
  label: "integration",
  files: "out/test-integration/**/*.test.js",
  workspaceFolder: "./test-integration/fixtures/workspace",
  // macOS caps Unix-socket paths at 103 chars; the default user-data-dir sits
  // deep in the project path and overflows it, so pin a short one.
  launchArgs: ["--user-data-dir", "/tmp/srv-vscode-ud"],
  mocha: {
    ui: "bdd",
    timeout: 60000,
  },
});
