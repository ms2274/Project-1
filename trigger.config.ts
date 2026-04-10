import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "reddit-email-workflow",  // replace with your Trigger.dev project ref
  dirs: ["./src/trigger"],
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
    },
  },
});
