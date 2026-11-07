import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { createHash } from "node:crypto";
import type { Plugin } from "vite";

// CSP só no build (o dev server precisa de scripts inline do HMR). Permite apenas o próprio
// origin + o script inline do tema (por hash). Sem rede externa: connect-src 'self'.
function cspNoBuild(): Plugin {
  return {
    name: "neow-csp",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
          (m) => `'sha256-${createHash("sha256").update(m[1]).digest("base64")}'`,
        );
        const csp = [
          "default-src 'self'",
          `script-src 'self' ${hashes.join(" ")}`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "font-src 'self'",
          "connect-src 'self'",
          "worker-src 'self'",
          "manifest-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'none'",
        ].join("; ");
        return html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`);
      },
    },
  };
}

// GitHub Pages serve em /<repo>/. O CI define BASE_PATH; localmente fica "./".
const base = process.env.BASE_PATH ?? "./";

export default defineConfig({
  base,
  server: { host: "0.0.0.0", port: 5178 },
  plugins: [
    react(),
    cspNoBuild(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt", // o app mostra o banner "Nova versão disponível"
      includeAssets: ["icons/favicon.svg", "icons/apple-touch-icon-180.png"],
      manifest: {
        name: "NeoW Venóclise",
        short_name: "NeoW Venó",
        description: "Cálculo de venóclise neonatal para o plantão.",
        lang: "pt-BR",
        display: "standalone",
        orientation: "portrait",
        start_url: "./",
        scope: "./",
        background_color: "#0E0E2C",
        theme_color: "#0E0E2C",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Só assets estáticos. Dados de paciente ficam no IndexedDB, nunca em cache do SW.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "index.html",
      },
    }),
  ],
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
