import {
  AJUSTE_ASFIXIA_SDR_VM,
  AJUSTE_FOTOTERAPIA,
  FASE_II_III,
  TIG_FAIXAS,
  VOLUME_ESPGHAN,
  VOLUME_MS,
  VOLUME_MS_TERMO,
  type ClassePesoMS,
  type GrupoVolume,
} from "./constantes";
import type { FaixaNumerica, FaixaVolume, FonteHidrica } from "./tipos";

export const FONTE_ESPGHAN = "ESPGHAN 2018 (Jochum, Clin Nutr 2018;37) = SBP 2023";
export const FONTE_MS = "MS 2014 / Lorenz 2008";

/** "Termo" = IG ≥ 37 semanas. */
export function ehTermo(igSemanas: number): boolean {
  return igSemanas >= 37;
}

/** Grupo de volume. PT usa o PESO DE NASCIMENTO. */
export function grupoVolume(igSemanas: number, pesoNascimentoG: number): GrupoVolume {
  if (ehTermo(igSemanas)) return "termo";
  if (pesoNascimentoG < 1000) return "pt_lt1000";
  if (pesoNascimentoG <= 1500) return "pt_1000_1500";
  return "pt_gt1500";
}

export function rotuloGrupo(g: GrupoVolume): string {
  return {
    termo: "Termo (IG ≥ 37 sem)",
    pt_gt1500: "Pré-termo > 1.500 g",
    pt_1000_1500: "Pré-termo 1.000–1.500 g",
    pt_lt1000: "Pré-termo < 1.000 g",
  }[g];
}

function classePesoMS(pesoNascimentoG: number): ClassePesoMS | null {
  if (pesoNascimentoG <= 750) return "le750";
  if (pesoNascimentoG <= 1000) return "751_1000";
  if (pesoNascimentoG <= 1500) return "1001_1500";
  if (pesoNascimentoG <= 2500) return "1501_2500";
  return null; // PT tardio > 2.500 g: MS não cobre (DIVERGENCIAS.md)
}

/** Faixa de volume ANTES dos ajustes. */
export function faixaVolumeBase(
  fonte: FonteHidrica,
  grupo: GrupoVolume,
  pesoNascimentoG: number,
  dia: number,
): { status: "ok"; faixa: FaixaNumerica; fonte: string; nota?: string } | { status: "todo"; motivo: string } {
  if (fonte === "espghan") {
    const [min, max] = dia >= 6 ? FASE_II_III : VOLUME_ESPGHAN[grupo][dia - 1];
    return { status: "ok", faixa: { min, max }, fonte: FONTE_ESPGHAN };
  }
  // ---- MS 2014
  if (grupo === "termo") {
    if (dia === 1) return { status: "ok", faixa: { min: VOLUME_MS_TERMO.d1[0], max: VOLUME_MS_TERMO.d1[1] }, fonte: FONTE_MS };
    if (dia === 7) return { status: "ok", faixa: { min: VOLUME_MS_TERMO.d7[0], max: VOLUME_MS_TERMO.d7[1] }, fonte: FONTE_MS };
    return {
      status: "todo",
      motivo: "TODO(validar): o MS só dá D1 (60–80) e D7 (80–120) no termo; D2–D6 e após D7 não estão tabelados. Use a fonte ESPGHAN/SBP ou informe volume manual com justificativa.",
    };
  }
  const classe = classePesoMS(pesoNascimentoG);
  if (!classe) {
    return {
      status: "todo",
      motivo: "TODO(validar): pré-termo tardio com peso de nascimento > 2.500 g não está na tabela do MS (ver DIVERGENCIAS.md). Use ESPGHAN/SBP.",
    };
  }
  const t = VOLUME_MS[classe];
  if (dia >= 8) {
    return {
      status: "ok",
      faixa: { min: FASE_II_III[0], max: FASE_II_III[1] },
      fonte: FONTE_ESPGHAN,
      nota: "O MS não define faixa após o D7; usada a fase II/III (140–160) do ESPGHAN/SBP.",
    };
  }
  const [min, max] = dia === 1 ? t.d1 : dia === 2 ? t.d2 : dia <= 4 ? t.d3_4 : t.d5_7;
  return { status: "ok", faixa: { min, max }, fonte: FONTE_MS };
}

/**
 * Ajustes da faixa. Interpretação (ver DIVERGENCIAS.md h):
 * fototerapia: limite inferior +10%, superior +20%;
 * asfixia/SDR/VM umidificada: limite inferior −20%, superior −10%.
 */
export function faixaVolume(
  fonte: FonteHidrica,
  grupo: GrupoVolume,
  pesoNascimentoG: number,
  dia: number,
  fototerapia: boolean,
  asfixiaSdrVm: boolean,
): FaixaVolume {
  const b = faixaVolumeBase(fonte, grupo, pesoNascimentoG, dia);
  if (b.status === "todo") return b;
  let { min, max } = b.faixa;
  const motivos: string[] = [];
  if (b.nota) motivos.push(b.nota);
  if (fototerapia) {
    min *= 1 + AJUSTE_FOTOTERAPIA.min;
    max *= 1 + AJUSTE_FOTOTERAPIA.max;
    motivos.push("Fototerapia: faixa +10% a +20% (perdas insensíveis aumentadas)");
  }
  if (asfixiaSdrVm) {
    min *= 1 - AJUSTE_ASFIXIA_SDR_VM.max;
    max *= 1 - AJUSTE_ASFIXIA_SDR_VM.min;
    motivos.push("Asfixia / SDR / VM umidificada: faixa −10% a −20% (risco de retenção hídrica)");
  }
  return { status: "ok", base: b.faixa, ajustada: { min, max }, fonte: b.fonte, motivosAjuste: motivos };
}

export function faixaTig(termo: boolean, dia: number): FaixaNumerica {
  const f = termo ? TIG_FAIXAS.termo : TIG_FAIXAS.pretermo;
  const [min, max] = dia === 1 ? f.d1 : f.aPartirD2;
  return { min, max };
}
