import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.VITE_API_PROXY || "http://localhost:4000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: process.env.VITE_HOST === "true",
    proxy: {
      "/api": apiTarget,
      "/uploads": apiTarget,
      "/socket.io": {
        target: apiTarget,
        ws: true,
      },
    },
  },
});
