/**
 * Dieta: tipo de leite, via, volume por mamada, progressão e transição com a venóclise.
 *
 * Fontes:
 * - ESPGHAN 2022 (Embleton et al., JPGN 2023;76:248-268), para prematuros com PN < 1.800 g:
 *   dieta mínima 12–24 mL/kg/d por 3–7 dias (opcional); aumento diário de 18–30 mL/kg/d no estável;
 *   volume da maioria 150–180 mL/kg/d (135 pode ser seguro; até 200 em casos individuais);
 *   aditivo multicomponente com 40–100 mL/kg/d; bolus a cada 2–3 h; oral a partir de 32 sem de PMA;
 *   LM da própria mãe é a 1ª escolha; sem LM, leite humano de banco com aditivo antes da fórmula de
 *   pré-termo (< 32 sem ou < 1.500 g). A ESPGHAN pede que cada UTIN tenha seu protocolo.
 * - MS, Guia Alimentar para Crianças Brasileiras Menores de 2 Anos (versão resumida, 2021, p. 7): amamentar em livre demanda.
 *
 * A transição é aritmética: venóclise = volume total − dieta − outras infusões (a mesma conta da aba Venóclise).
 * Não há fonte para o ponto de suspender a venóclise: ela sai quando a dieta cobre o volume total.
 */
import { arredondarMl, fmt } from "./numeros";

export const FONTE_ESPGHAN_ENTERAL = "ESPGHAN 2022 — Embleton ND et al. Enteral Nutrition in Preterm Infants. JPGN 2023;76:248-268";
export const FONTE_GUIA_MS = "MS — Guia Alimentar para Crianças Brasileiras Menores de 2 Anos, versão resumida (2021), p. 7";

export const ESPGHAN_ENTERAL = {
  /** Escopo do documento: PN < 1.800 g. */
  pnMaxG: 1800,
  dietaMinima: [12, 24],
  incremento: [18, 30],
  volumeUsual: [150, 180],
  volumeMinimoSeguro: 135,
  volumeMaximo: 200,
  aditivoInicio: [40, 100],
  oralDesdePma: 32,
  bancoAteIg: 32,
  bancoAtePn: 1500,
} as const;

export type ModoDieta = "livre_demanda" | "programada" | "zero";
export type Leite = "lm" | "lhop" | "formula_pt" | "formula_termo" | "outra";
export type ViaDieta = "seio" | "sog" | "sng" | "copo" | "mamadeira";

export const LEITES: ReadonlyArray<{ valor: Leite; texto: string }> = [
  { valor: "lm", texto: "Leite materno (da própria mãe)" },
  { valor: "lhop", texto: "Leite humano de banco (LHOP)" },
  { valor: "formula_pt", texto: "Fórmula para pré-termo" },
  { valor: "formula_termo", texto: "Fórmula infantil de partida" },
  { valor: "outra", texto: "Outra" },
];
export const VIAS: ReadonlyArray<{ valor: ViaDieta; texto: string; oral: boolean }> = [
  { valor: "seio", texto: "Seio", oral: true },
  { valor: "sog", texto: "Sonda orogástrica", oral: false },
  { valor: "sng", texto: "Sonda nasogástrica", oral: false },
  { valor: "copo", texto: "Copo", oral: true },
  { valor: "mamadeira", texto: "Mamadeira", oral: true },
];
const SIGLA_VIA: Record<ViaDieta, string> = { seio: "no seio", sog: "por SOG", sng: "por SNG", copo: "no copo", mamadeira: "na mamadeira" };

export interface DadosDieta {
  modo?: ModoDieta | null;
  leite?: Leite | null;
  leiteOutro?: string;
  /** Complemento se faltar leite materno. */
  complemento?: Leite | null;
  complementoOutro?: string;
  via?: ViaDieta | null;
  intervaloH?: 2 | 3 | null;
  volumeMlKgDia?: number | null;
  incrementoMlKgDia?: number | null;
  metaMlKgDia?: number | null;
  aditivo?: boolean;
}
export const DIETA_INICIAL: DadosDieta = {};

export interface ContextoDieta {
  /** Peso da conta (o mesmo da venóclise, quando houver). */
  pesoG: number | null;
  pesoNascimentoG: number | null;
  igSemanas: number | null;
  igDias: number | null;
  pnaDias: number | null;
  /** Volume total hídrico da venóclise (mL/kg/dia), para a transição. */
  volumeTotalMlKgDia: number | null;
  outrasInfusoesMlDia: number | null;
}

export interface LinhaPlano {
  /** 0 = hoje. */
  dia: number;
  dietaMlKgDia: number;
  mlPorMamada: number;
  venoMlKgDia: number | null;
  venoMlH: number | null;
  eventos: string[];
}

export interface ResultadoDieta {
  pendencias: string[];
  alertas: string[];
  notas: { texto: string; fonte: string }[];
  mlDia?: number;
  mamadasDia?: number;
  mlPorMamada?: number;
  prescricao?: string;
  plano?: LinhaPlano[];
  /** Venóclise de hoje pela conta (mL/kg/dia), se houver volume total. */
  venoHojeMlKgDia?: number | null;
}

export function nomeLeite(l: Leite | null | undefined, outro: string | undefined, via?: ViaDieta | null): string {
  switch (l) {
    case "lm":
      return via === "seio" ? "Seio materno" : "Leite materno ordenhado (LMO)";
    case "lhop":
      return "Leite humano pasteurizado (LHOP)";
    case "formula_pt":
      return "Fórmula para pré-termo";
    case "formula_termo":
      return "Fórmula infantil de partida";
    case "outra":
      return outro?.trim() || "Outro leite";
    default:
      return "Leite";
  }
}

const humano = (l?: Leite | null) => l === "lm" || l === "lhop";
const pma = (c: ContextoDieta) => (c.igSemanas == null || c.pnaDias == null ? null : Math.floor((c.igSemanas * 7 + (c.igDias ?? 0) + c.pnaDias) / 7));

export function avaliarDieta(d: DadosDieta, c: ContextoDieta): ResultadoDieta {
  const r: ResultadoDieta = { pendencias: [], alertas: [], notas: [] };
  const E = ESPGHAN_ENTERAL;
  const escopoEspghan = c.pesoNascimentoG != null && c.pesoNascimentoG < E.pnMaxG;
  const nota = (texto: string, fonte = FONTE_ESPGHAN_ENTERAL) => r.notas.push({ texto, fonte });

  if (!d.modo) {
    r.pendencias.push("Escolha: livre demanda, dieta programada ou dieta zero");
    return r;
  }
  if (d.modo === "zero") {
    r.prescricao = "Dieta zero.";
    if (escopoEspghan) nota("A ESPGHAN recomenda começar pequenos volumes de dieta o quanto antes na maioria dos prematuros; jejum ou dieta mínima não mostraram benefício claro.");
    return r;
  }

  if (!d.leite) r.pendencias.push("Escolha o leite");
  else if (d.leite === "outra" && !d.leiteOutro?.trim()) r.pendencias.push("Escreva qual leite");
  nota("Leite materno da própria mãe é a primeira escolha, no pré-termo e no termo.");
  if (d.leite === "formula_pt" && ((c.igSemanas != null && c.igSemanas < E.bancoAteIg) || (c.pesoNascimentoG != null && c.pesoNascimentoG < E.bancoAtePn))) {
    nota("Sem leite materno suficiente, em < 32 semanas ou < 1.500 g a ESPGHAN prefere leite humano de banco com aditivo à fórmula para pré-termo.");
  }
  const nc = nomeLeite(d.complemento, d.complementoOutro);
  const compl = d.complemento ? ` Complementar com ${nc.charAt(0).toLowerCase()}${nc.slice(1)} se faltar leite materno.` : "";

  if (d.modo === "livre_demanda") {
    if (d.leite && d.leite !== "lm") r.alertas.push("A orientação de livre demanda do MS é para a amamentação (leite materno no seio).");
    if (r.pendencias.length) return r;
    r.prescricao = `${d.leite === "lm" ? "Seio materno" : nomeLeite(d.leite, d.leiteOutro)} em livre demanda.${compl}`;
    nota("Amamentar sempre que a criança pedir (em livre demanda).", FONTE_GUIA_MS);
    const p = pma(c);
    if (escopoEspghan && p != null && p < E.oralDesdePma) r.alertas.push(`IG pós-menstrual ${p} sem: a ESPGHAN sugere começar a via oral a partir de 32 semanas, guiada pela competência e estabilidade do RN.`);
    return r;
  }

  // Dieta programada
  if (!d.via) r.pendencias.push("Escolha a via");
  if (!d.intervaloH) r.pendencias.push("Escolha o intervalo");
  if (d.volumeMlKgDia == null) r.pendencias.push("Informe o volume de hoje (mL/kg/dia)");
  if (c.pesoG == null) r.pendencias.push("Informe o peso na ficha");
  const p = pma(c);
  if (d.via && VIAS.find((v) => v.valor === d.via)?.oral && escopoEspghan && p != null && p < E.oralDesdePma) {
    r.alertas.push(`IG pós-menstrual ${p} sem: a ESPGHAN sugere começar a via oral a partir de 32 semanas, guiada pela competência e estabilidade do RN.`);
  }
  if (d.aditivo && d.leite && !humano(d.leite)) r.alertas.push("Aditivo é para leite humano.");
  if (d.volumeMlKgDia != null && d.volumeMlKgDia <= 0) r.pendencias.push("Volume deve ser maior que zero");
  if (d.incrementoMlKgDia != null && d.incrementoMlKgDia > 0 && d.metaMlKgDia == null) r.pendencias.push("Informe a meta (mL/kg/dia) para o plano de aumento");
  if (r.pendencias.length) return r;

  const vol = d.volumeMlKgDia as number;
  const kg = (c.pesoG as number) / 1000;
  const h = d.intervaloH as 2 | 3;
  r.mamadasDia = 24 / h;
  r.mlDia = vol * kg;
  r.mlPorMamada = arredondarMl(r.mlDia / r.mamadasDia);

  const inc = d.incrementoMlKgDia ?? 0;
  const meta = d.metaMlKgDia ?? null;
  if (escopoEspghan) {
    if (inc > 0 && (inc < E.incremento[0] || inc > E.incremento[1])) r.alertas.push(`Aumento de ${fmt(inc)} mL/kg/dia: a ESPGHAN recomenda 18–30 mL/kg/dia no prematuro estável.`);
    if (inc === 0 && vol <= E.dietaMinima[1]) nota("Dieta mínima: 12–24 mL/kg/dia, sem aumentar, por 3–7 dias. A ESPGHAN não viu benefício claro sobre aumentar desde o início.");
    if (meta != null && (meta < E.volumeMinimoSeguro || meta > E.volumeMaximo)) r.alertas.push(`Meta de ${fmt(meta)} mL/kg/dia: a ESPGHAN fala em 150–180 (135 pode ser seguro; até 200 em casos individuais).`);
    else if (meta != null && (meta < E.volumeUsual[0] || meta > E.volumeUsual[1])) nota("A maioria dos prematuros estáveis precisa de 150–180 mL/kg/dia; 135 pode ser seguro e até 200 pode servir caso a caso.");
    if (humano(d.leite) && !d.aditivo && vol >= E.aditivoInicio[0]) {
      if (vol > E.aditivoInicio[1]) r.alertas.push("Leite humano acima de 100 mL/kg/dia sem aditivo: a ESPGHAN recomenda iniciar o aditivo com 40–100 mL/kg/dia.");
      else nota("Leite humano: a ESPGHAN recomenda iniciar o aditivo multicomponente quando a dieta chega a 40–100 mL/kg/dia.");
    }
    nota("Bolus a cada 2–3 h parece um pouco melhor que dieta contínua; sonda oro ou nasogástrica, sem preferência. Cada UTIN deve ter seu protocolo de progressão.");
  } else if (c.pesoNascimentoG != null) {
    nota("PN ≥ 1.800 g: fora do escopo da ESPGHAN 2022 (prematuro < 1.800 g). Volume e aumento são escolha do médico.");
  }

  // Plano dia a dia (até a meta)
  const outrasKg = (c.outrasInfusoesMlDia ?? 0) / kg;
  const veno = (enteral: number) => (c.volumeTotalMlKgDia == null ? null : Math.max(c.volumeTotalMlKgDia - enteral - outrasKg, 0));
  r.venoHojeMlKgDia = veno(vol);
  if (inc > 0 && meta != null && meta > vol) {
    const linhas: LinhaPlano[] = [];
    let aditivoAvisado = !!d.aditivo || !humano(d.leite) || !escopoEspghan;
    let venoZerou = c.volumeTotalMlKgDia == null || (veno(vol) ?? 1) <= 0;
    for (let dia = 0; dia <= 60; dia++) {
      const diet = Math.min(vol + inc * dia, meta);
      const v = veno(diet);
      const ev: string[] = [];
      if (!aditivoAvisado && diet >= E.aditivoInicio[0]) {
        ev.push("Aditivo pode começar (40–100 mL/kg/dia)");
        aditivoAvisado = true;
      }
      if (!venoZerou && v != null && v <= 0) {
        ev.push("A dieta cobre o volume total: venóclise sai");
        venoZerou = true;
      }
      if (diet >= meta) ev.push("Meta atingida");
      linhas.push({ dia, dietaMlKgDia: diet, mlPorMamada: arredondarMl((diet * kg) / r.mamadasDia), venoMlKgDia: v, venoMlH: v == null ? null : arredondarMl((v * kg) / 24), eventos: ev });
      if (diet >= meta) break;
    }
    r.plano = linhas;
  }

  const leite = nomeLeite(d.leite, d.leiteOutro, d.via);
  const aumento = inc > 0 && meta != null ? `; aumentar ${fmt(inc)} mL/kg/dia conforme a tolerância, até ${fmt(meta)} mL/kg/dia` : "";
  const adit = d.aditivo ? "; com aditivo do leite humano conforme o protocolo do serviço" : "";
  r.prescricao = `${leite} ${fmt(r.mlPorMamada, 2)} mL de ${h}/${h} h ${SIGLA_VIA[d.via as ViaDieta]} (${fmt(vol)} mL/kg/dia)${aumento}${adit}.${compl}`;
  return r;
}

/** Texto final (inclui a linha da venóclise na transição). */
export function textoDieta(r: ResultadoDieta, c: ContextoDieta): string {
  if (!r.prescricao) return "";
  const l = [`Dieta: ${r.prescricao}`];
  if (r.venoHojeMlKgDia != null && c.volumeTotalMlKgDia != null && r.mlDia != null) {
    l.push(
      r.venoHojeMlKgDia > 0
        ? `Venóclise: ${fmt(r.venoHojeMlKgDia, 1)} mL/kg/dia (volume total ${fmt(c.volumeTotalMlKgDia)} − dieta${c.outrasInfusoesMlDia ? " − outras infusões" : ""}); reduzir conforme a dieta aumenta.`
        : `Venóclise: a dieta já cobre o volume total de ${fmt(c.volumeTotalMlKgDia)} mL/kg/dia.`,
    );
  }
  return l.join("\n");
}
