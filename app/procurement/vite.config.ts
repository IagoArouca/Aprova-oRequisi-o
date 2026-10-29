import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    proxy: {
      "/odata": {
        target: process.env.CAP_URL ?? "http://localhost:4004",
        changeOrigin: true,
      },
    },
  },
});