import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "child_process";

let GIT_SHA = "unknown";
try {
  GIT_SHA = execSync("git rev-parse --short HEAD").toString().trim();
} catch {}

export default defineConfig({
  plugins: [react()],
  define: {
    __GIT_SHA__: JSON.stringify(GIT_SHA),
  },
  build: {
    sourcemap: true,
  },
});
