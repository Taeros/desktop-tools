import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Tools keep their UI next to their engine code (tools/<id>/ui). Vite bundles them all into one app.
export default defineConfig({
  plugins: [react()],
  resolve: {
    // tools/<id>/ui lives outside this folder, so pin shared packages to ui/node_modules
    alias: [
      { find: "@sdk", replacement: fileURLToPath(new URL("./src/sdk/index.ts", import.meta.url)) },
      { find: /^react(\/.*)?$/, replacement: fileURLToPath(new URL("./node_modules/react", import.meta.url)) + "$1" },
    ],
    dedupe: ["react", "react-dom"],
  },
  server: { fs: { allow: [".."] } },
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false, chunkSizeWarningLimit: 900 },
});
