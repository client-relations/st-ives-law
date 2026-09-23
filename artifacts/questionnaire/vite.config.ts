import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// PORT is only needed for the dev/preview server; defaults to 3000 for CI/build.
const port = Number(process.env.PORT || "3000");

// BASE_PATH is the Vite `base` setting; defaults to "/" for production builds.
const basePath = process.env.BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    minify: false,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
    // The /api routes are Vercel serverless functions, which `vite dev` does
    // not run — without this, anything touching them 404s locally and the only
    // way to test document generation is to deploy. Point this at whatever is
    // serving them (`vercel dev`, or the local runner) and the whole app works
    // from one origin, which also keeps the Supabase session intact.
    // Dev only: `vite build` never reads server.proxy.
    proxy: {
      "/api": {
        target: process.env.API_ORIGIN || "http://localhost:3100",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
