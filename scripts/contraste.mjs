// Verifica contraste WCAG dos pares texto/fundo usados nos tokens (claro e escuro).
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
const [claro, escuro] = [css.split(".dark {")[0], css.split(".dark {")[1]];
const tokens = (txt) => Object.fromEntries([...txt.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pares = [
  ["text", "bg"], ["text", "surface"], ["text", "surface-2"], ["text-muted", "surface"], ["text-muted", "surface-2"], ["text-muted", "bg"],
  ["text-subtle", "surface"], ["text-subtle", "surface-2"], ["text-subtle", "bg"],
  ["on-primary", "primary"], ["on-danger", "danger"], ["danger", "surface"], ["danger", "danger-soft"],
  ["text", "danger-soft"], ["text", "warning-soft"], ["text", "primary-soft"], ["text-muted", "warning-soft"], ["text-muted", "primary-soft"], ["text-muted", "danger-soft"],
  ["warning", "surface"], ["success", "surface"], ["success", "success-soft"], ["primary", "surface"], ["primary", "primary-soft"],
  ["on-appbar", "primary-2"], ["on-appbar-muted", "primary-2"], ["focus", "surface"], ["focus", "bg"],
];
let falhas = 0;
for (const [nome, t] of [["claro", tokens(claro)], ["escuro", { ...tokens(claro), ...tokens(escuro) }]]) {
  for (const [a, b] of pares) {
    if (!t[a] || !t[b]) continue;
    const r = ratio(t[a], t[b]);
    const min = a === "focus" ? 3 : 4.5;
    if (r < min) { falhas++; console.log(`FALHA ${nome}: ${a} ${t[a]} sobre ${b} ${t[b]} = ${r.toFixed(2)} (mín ${min})`); }
  }
}
console.log(falhas ? `${falhas} pares abaixo do mínimo` : "Todos os pares ≥ mínimo WCAG AA");
process.exit(falhas ? 1 : 0);
