/** Aceita vírgula ou ponto como decimal: "3,2" = "3.2". Retorna null se vazio/inválido. */
export function parseNumeroBR(texto: string | null | undefined): number | null {
  if (texto == null) return null;
  const t = String(texto).trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  if (!/^-?\d*\.?\d+$/.test(t) && !/^-?\d+\.$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Contagens (leucócitos, plaquetas): aceita ponto de milhar ("12.500" = 12500, "250.000" = 250000).
 * Fora desse padrão, vale a regra comum ("12,5" ou "12.5" = 12,5, que o motor recusa como /mm³).
 */
export function parseContagemBR(texto: string | null | undefined): number | null {
  if (texto == null) return null;
  const t = String(texto).trim().replace(/\s/g, "");
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ""));
  return parseNumeroBR(t);
}

/** mL a 0,1; se < 10 mL, a 0,01 (MS: precisão do volume pequeno). */
export function arredondarMl(v: number): number {
  const casas = Math.abs(v) < 10 ? 2 : 1;
  const f = 10 ** casas;
  return Math.round((v + Number.EPSILON * Math.sign(v)) * f) / f;
}

export function arredondar(v: number, casas: number): number {
  const f = 10 ** casas;
  return Math.round((v + Number.EPSILON * Math.sign(v)) * f) / f;
}

/** Formato pt-BR sem zeros à direita desnecessários. */
export function fmt(v: number, casasMax = 2): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casasMax });
}
