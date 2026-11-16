import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the API runs separately on port 5000; proxying keeps the browser on one origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY || "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
