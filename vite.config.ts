import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import path from "path";
import type { Plugin } from "vite";

/** Telegram Android WebView ломается на crossorigin у module scripts */
function stripCrossorigin(): Plugin {
  return {
    name: "strip-crossorigin",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        return html.replace(/ crossorigin/g, "");
      },
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ["iOS >= 12", "Android >= 6", "defaults"],
      modernPolyfills: true,
      renderLegacyChunks: true,
    }),
    stripCrossorigin(),
  ],
  root: "src/client",
  base: "/",
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
    modulePreload: false,
    cssCodeSplit: false,
    target: "es2015",
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
