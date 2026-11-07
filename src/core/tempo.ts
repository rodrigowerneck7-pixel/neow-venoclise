/** D1 = primeiras 24 h de vida. Retorna null se a data de nascimento está no futuro. */
export function calcularDiaDeVida(nascimento: Date, agora: Date = new Date()): number | null {
  const ms = agora.getTime() - nascimento.getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / (24 * 3600 * 1000)) + 1;
}

/** "YYYY-MM-DDTHH:mm" no fuso local (valor de <input type="datetime-local">). */
export const isoLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

/** Horas de vida (decimais) entre o nascimento e um momento. null se o momento é anterior ao nascimento. */
export function horasDeVida(nascimento: Date, momento: Date): number | null {
  const ms = momento.getTime() - nascimento.getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms / 3_600_000;
}
