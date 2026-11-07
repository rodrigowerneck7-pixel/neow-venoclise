/** D1 = primeiras 24 h de vida. Retorna null se a data de nascimento está no futuro. */
export function calcularDiaDeVida(nascimento: Date, agora: Date = new Date()): number | null {
  const ms = agora.getTime() - nascimento.getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / (24 * 3600 * 1000)) + 1;
}
