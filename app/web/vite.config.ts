import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // In local dev, proxy /api and /health to the API container
      "/api": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
});
