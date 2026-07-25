/**
 * Design-QA config: `npm run dev:preview` (port 5176).
 *
 * Identical to the demo (FakeRest data, no Supabase connection) except that
 * VITE_IS_DEMO is "false", so the demo-only placeholder panels step aside and
 * the real board, finance page and integrations render against fake data. Use
 * it to review the interface without touching production.
 */
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import createHtmlPlugin from "vite-plugin-simple-html";

export default defineConfig({
  server: {
    port: 5176,
    host: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    createHtmlPlugin({
      minify: true,
      inject: {
        data: {
          mainScript: `demo/main.tsx`,
        },
      },
    }),
  ],
  define: {
    "import.meta.env.VITE_IS_DEMO": JSON.stringify("false"),
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
      "https://demo.example.org",
    ),
    "import.meta.env.VITE_SB_PUBLISHABLE_KEY": JSON.stringify("demo-key"),
  },
  base: "./",
  esbuild: {
    keepNames: true,
  },
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
