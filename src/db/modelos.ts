import type { FichaRN } from "../core/ficha";
import type { ConfigServico, EntradaVenoclise } from "../core/tipos";

/** Identificação mínima. NUNCA nome completo, prontuário ou CPF. */
export interface Paciente {
  id: string;
  leito: string;
  iniciais: string;
  /** ISO local "YYYY-MM-DDTHH:mm" (hora de nascimento). null = dia de vida digitado. */
  nascimento: string | null;
  criadoEm: number;
  atualizadoEm: number;
  /** Rascunho atual da venóclise. Peso, IG e dia de vida valem os da `ficha` (quando existe). */
  entrada: EntradaVenoclise;
  cfg: ConfigServico;
  /** Dados comuns do RN. Ausente em pacientes salvos antes da Fase 0 dos módulos: migra de `entrada`. */
  ficha?: FichaRN;
}

/** Linha do histórico diário (uma prescrição salva). */
export interface Registro {
  id: string;
  pacienteId: string;
  em: number;
  diaDeVida: number;
  vazaoMlH: number;
  concFinalRealPct: number;
  volumeMlKgDia: number;
  tig: number;
  prescricaoTexto: string;
  entrada: EntradaVenoclise;
  cfg: ConfigServico;
}

export interface Preferencias {
  /** Dias sem atualização até apagar o paciente automaticamente. 0 = desligado. */
  retencaoDias: number;
  /** Minutos de inatividade para bloquear (só com PIN). 0 = só ao sair do app. */
  bloqueioMin: number;
}
export const PREFERENCIAS_PADRAO: Preferencias = { retencaoDias: 0, bloqueioMin: 2 };

export type EstadoCofre = "sem_pin" | "bloqueado" | "aberto";
