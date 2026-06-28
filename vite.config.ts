import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: "src/client",
  base: "/",
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
    modulePreload: false,
    target: "es2018",
  },
  server: {
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/api": "http://localhost:3000",
      "/ws": { target: "ws://localhost:3000", ws: true },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/client"),
    },
  },
});
