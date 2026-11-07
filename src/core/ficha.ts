/**
 * Ficha do RN: dados comuns a todos os módulos (venóclise, icterícia, internação, antibiótico, dieta).
 * Digitados uma vez; cada módulo lê daqui. Nenhum valor é inventado: ausente = não informado.
 */
import { fmt } from "./numeros";
import type { EntradaVenoclise } from "./tipos";

export type GrupoABO = "A" | "B" | "AB" | "O";
export type FatorRh = "pos" | "neg";
export type Coombs = "positivo" | "negativo" | "nao_feito";

export interface Tipagem {
  abo?: GrupoABO | null;
  rh?: FatorRh | null;
}

export interface FichaRN {
  /** Em gramas (valor < 15 pede confirmação de kg, como na venóclise). */
  pesoNascimento: number | null;
  pesoAtual?: number | null;
  confirmouKg?: { nascimento?: boolean; atual?: boolean };
  confirmouVariacaoPeso?: boolean;
  igSemanas: number | null;
  igDias?: number | null;
  /** Usado só quando não há data/hora de nascimento. D1 = primeiras 24 h. */
  diaDeVida: number | null;
  tipagemMae?: Tipagem;
  tipagemRN?: Tipagem;
  coombsDireto?: Coombs | null;
}

export const FICHA_INICIAL: FichaRN = {
  pesoNascimento: null,
  pesoAtual: null,
  igSemanas: null,
  igDias: null,
  diaDeVida: 1,
};

/** Campos da ficha que também existem na entrada da venóclise (a ficha é a fonte). */
const CAMPOS_COMUNS = ["pesoNascimento", "pesoAtual", "confirmouKg", "confirmouVariacaoPeso", "igSemanas", "igDias", "diaDeVida"] as const;

/** Migração: pacientes salvos antes da ficha guardavam esses dados dentro da entrada da venóclise. */
export function fichaDeEntrada(e: EntradaVenoclise): FichaRN {
  const f: FichaRN = { ...FICHA_INICIAL };
  for (const k of CAMPOS_COMUNS) if (e[k] !== undefined) (f as unknown as Record<string, unknown>)[k] = e[k];
  return f;
}

/** Entrada que o motor da venóclise recebe: os campos comuns vêm sempre da ficha. */
export function aplicarFicha(e: EntradaVenoclise, f: FichaRN): EntradaVenoclise {
  const r: EntradaVenoclise = { ...e };
  for (const k of CAMPOS_COMUNS) (r as unknown as Record<string, unknown>)[k] = f[k];
  return r;
}

export function igTexto(f: Pick<FichaRN, "igSemanas" | "igDias">): string | null {
  if (f.igSemanas == null) return null;
  return f.igDias ? `${fmt(f.igSemanas, 0)}s${fmt(f.igDias, 0)}d` : `${fmt(f.igSemanas, 0)} sem`;
}

const tipagemTexto = (t?: Tipagem) => (t?.abo ? `${t.abo}${t.rh === "pos" ? "+" : t.rh === "neg" ? "−" : ""}` : null);

/** Linha curta para o topo de cada módulo. Só mostra o que foi informado. */
export function resumoFicha(f: FichaRN, dia: number | null): string {
  const peso = f.pesoAtual ?? f.pesoNascimento;
  const partes = [
    peso != null ? `${fmt(peso, peso < 15 ? 3 : 0)} ${peso < 15 ? "kg?" : "g"}` : null,
    igTexto(f),
    dia != null ? `D${dia}` : null,
    tipagemTexto(f.tipagemRN) ? `RN ${tipagemTexto(f.tipagemRN)}` : null,
    tipagemTexto(f.tipagemMae) ? `mãe ${tipagemTexto(f.tipagemMae)}` : null,
    f.coombsDireto === "positivo" ? "Coombs +" : f.coombsDireto === "negativo" ? "Coombs −" : null,
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : "Ficha vazia";
}

/** O que falta para os módulos básicos (peso, IG, dia de vida). */
export function pendenciasFicha(f: FichaRN, diaAutomatico: boolean): string[] {
  const p: string[] = [];
  if (f.pesoNascimento == null) p.push("peso de nascimento");
  if (f.igSemanas == null) p.push("IG");
  if (!diaAutomatico && f.diaDeVida == null) p.push("dia de vida");
  return p;
}
