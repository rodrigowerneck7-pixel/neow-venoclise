/**
 * Identificação do paciente: só leito + iniciais. Recusa o que parece nome completo, prontuário ou CPF,
 * para que esses dados nunca entrem no aparelho.
 */
export interface ErrosIdentificacao {
  leito?: string;
  iniciais?: string;
}

export function validarIdentificacao(leito: string, iniciais: string): ErrosIdentificacao {
  const erros: ErrosIdentificacao = {};
  const l = leito.trim();
  const i = iniciais.trim();
  if (!l) erros.leito = "Informe o leito.";
  else if (l.length > 12) erros.leito = "Use no máximo 12 caracteres.";
  else if ((l.match(/\d/g) ?? []).length > 4) erros.leito = "Parece um número de prontuário/CPF. Use só o leito (ex.: UTIN 3).";
  if (!i) erros.iniciais = "Informe as iniciais.";
  else if (i.length > 8) erros.iniciais = "Use só as iniciais (máx. 8 caracteres), nunca o nome completo.";
  else if (/\d/.test(i)) erros.iniciais = "Iniciais não levam números.";
  else if (/\S{5,}/.test(i.replace(/\./g, ""))) erros.iniciais = "Parece um nome. Use só as iniciais (ex.: M.S.).";
  return erros;
}

/** "YYYY-MM-DDTHH:mm" (hora local do aparelho) → Date. */
export function parseNascimento(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isNaN(d.getTime()) ? null : d;
}
