import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  // Replace <your-project-ref> with the value from your Trigger.dev dashboard
  // e.g. "proj_abcdefghijkl"
  project: "proj_pmfcxnhapgvymqgmpftm",
  runtime: "node",
  logLevel: "log",
  dirs: ["src/trigger"],
});
