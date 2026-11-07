import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serve em /<repo>/. O CI define BASE_PATH; localmente fica "./".
const base = process.env.BASE_PATH ?? "./";

export default defineConfig({
  base,
  server: { host: "0.0.0.0", port: 5178 },
  plugins: [
    react(),
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
