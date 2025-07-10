import { defineConfig } from "vite";
import path from "path";

// Server build configuration
export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(process.cwd(), "server/node-build.js"), // Ensure this file exists
      name: "server",
      fileName: "index", // Output file will be dist/server/index.mjs
      formats: ["es"],
    },
    outDir: "dist/server",
    target: "node22",
    ssr: true,
    rollupOptions: {
      external: [
        // Node.js built-ins
        "fs",
        "path",
        "url",
        "http",
        "https",
        "os",
        "crypto",
        "stream",
        "util",
        "events",
        "buffer",
        "querystring",
        "child_process",
        // External dependencies
        "express",
        "cors",
        "mysql2",
        "mysql2/promise",
        "serverless-http",
      ],
      output: {
        format: "es",
        entryFileNames: "[name].mjs", // Output file name pattern
      },
    },
    minify: false, // Keep readable for debugging
    sourcemap: true, // Enable source maps for debugging
  },
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "./client"),
      "@shared": path.resolve(process.cwd(), "./shared"),
    },
  },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});