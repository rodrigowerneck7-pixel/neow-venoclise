// Gera todos os PNGs a partir do SVG mestre. Uso: npm run icones
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
const svg = readFileSync(join(raiz, "icone-mestre.svg"));

// Fundo opaco (iOS pinta transparência de preto): flatten garante sem alfa.
async function png(tamanho, arquivo, { maskable = false } = {}) {
  let img = sharp(svg, { density: 384 });
  if (maskable) {
    // zona segura: arte em 80% central, sobre o mesmo gradiente
    const miolo = await sharp(svg, { density: 384 }).resize(Math.round(tamanho * 0.8)).png().toBuffer();
    img = sharp(svg, { density: 384 }).resize(tamanho).composite([{ input: miolo, gravity: "center" }]);
  } else {
    img = img.resize(tamanho);
  }
  await img.flatten({ background: "#0E0E2C" }).removeAlpha().png().toFile(join(raiz, arquivo));
}

await png(180, "apple-touch-icon-180.png");
await png(192, "icon-192.png");
await png(512, "icon-512.png");
await png(512, "icon-maskable-512.png", { maskable: true });
await png(48, "favicon-48.png");
writeFileSync(join(raiz, "favicon.svg"), svg);
console.log("Ícones gerados em public/icons");
