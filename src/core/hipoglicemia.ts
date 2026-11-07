import { GLICOSE_G_POR_ML, HIPOGLICEMIA, TIG_MAX } from "./constantes";
import { interpretarPeso } from "./calculo";
import { arredondar, fmt } from "./numeros";

export interface EntradaHipoglicemia {
  /** Peso em gramas (< 15 pergunta "kg?" e só converte com `confirmouKg`). */
  pesoG: number | null;
  confirmouKg?: boolean;
  /** TIG escolhida pelo médico para a manutenção (mg/kg/min). */
  tig?: number | null;
}

export interface ResultadoHipoglicemia {
  pendencias: string[];
  perguntaKg?: boolean;
  invalido?: boolean;
  bolus?: { ml: number; minutos: number; velocidadeMlMin: number; glicoseMg: number };
  manutencao?: { tig: number; vazaoMlH: number; mlDia: number; soro: "SG 10%" };
  faixa?: readonly [number, number];
  foraDaFaixa?: boolean;
  desmame?: { reduzMgKgMin: number; intervaloMinH: number; tigDepois?: number; vazaoDepoisMlH?: number };
  texto?: string;
}

/** vazão (mL/h) de SG 10% para uma TIG: TIG × kg × 60 min ÷ 1000 ÷ 0,1 g/mL. */
export function vazaoSg10(tig: number, kg: number): number {
  return (tig * kg * 60) / 1000 / GLICOSE_G_POR_ML.sg10;
}

export function calcularHipoglicemia(e: EntradaHipoglicemia): ResultadoHipoglicemia {
  const p = interpretarPeso(e.pesoG, e.confirmouKg);
  if (p.tipo === "vazio") return { pendencias: ["Informe o peso"] };
  if (p.tipo === "invalido") return { pendencias: [], invalido: true };
  if (p.tipo === "perguntar_kg") return { pendencias: [], perguntaKg: true };
  const kg = p.gramas / 1000;

  const ml = arredondar(HIPOGLICEMIA.bolusMlKg * kg, 1);
  const minutos = Math.round(ml / HIPOGLICEMIA.bolusVelocidadeMlMin);
  const bolus = {
    ml,
    minutos,
    velocidadeMlMin: HIPOGLICEMIA.bolusVelocidadeMlMin,
    glicoseMg: arredondar(ml * GLICOSE_G_POR_ML.sg10 * 1000, 0),
  };

  const [tMin, tMax] = HIPOGLICEMIA.tigManutencao;
  const r: ResultadoHipoglicemia = { pendencias: [], bolus, faixa: HIPOGLICEMIA.tigManutencao };
  let txt = `Hipoglicemia — bolus: SG 10% ${fmt(ml, 1)} mL (${HIPOGLICEMIA.bolusMlKg} mL/kg) IV a ${HIPOGLICEMIA.bolusVelocidadeMlMin} mL/min (~${minutos} min), sem cálcio no bolus. Reavaliar glicemia após o bolus.`;

  const tig = e.tig ?? null;
  if (tig != null && tig > 0) {
    if (tig > TIG_MAX) {
      r.foraDaFaixa = true;
      r.pendencias.push(`TIG acima do máximo de ${TIG_MAX} mg/kg/min`);
      r.texto = undefined;
      return r;
    }
    r.foraDaFaixa = tig < tMin || tig > tMax;
    const vazao = vazaoSg10(tig, kg);
    r.manutencao = { tig, vazaoMlH: arredondar(vazao, 1), mlDia: arredondar(vazao * 24, 1), soro: "SG 10%" };
    txt += ` Manutenção: TIG ${fmt(tig)} mg/kg/min = SG 10% ${fmt(vazao, 1)} mL/h.`;
    const depois = tig - HIPOGLICEMIA.desmameMgKgMin;
    r.desmame = { reduzMgKgMin: HIPOGLICEMIA.desmameMgKgMin, intervaloMinH: HIPOGLICEMIA.desmameIntervaloMinH };
    if (depois > 0) {
      r.desmame.tigDepois = depois;
      r.desmame.vazaoDepoisMlH = arredondar(vazaoSg10(depois, kg), 1);
    }
    txt += ` Desmame: reduzir ${HIPOGLICEMIA.desmameMgKgMin} mg/kg/min por vez, com intervalo mínimo de ${HIPOGLICEMIA.desmameIntervaloMinH} h, conforme a glicemia.`;
  }
  r.texto = txt;
  return r;
}
