import { defineConfig } from "vitest/config";

// Unit tests cover only vscode-free modules (cli argv/parse, frontmatter
// reader, model normalization, schema validation). The `vscode` API is not
// imported by any tested module, so no host is needed.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
