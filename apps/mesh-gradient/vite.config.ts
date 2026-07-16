import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    // Workspace packages (@tools/*) import React from source; dedupe so the app
    // and every linked package share a single React instance.
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
