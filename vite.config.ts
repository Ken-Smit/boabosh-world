import { defineConfig } from "vite";

// esnext so top-level await in main.ts survives the build.
export default defineConfig({ build: { target: "esnext" } });
