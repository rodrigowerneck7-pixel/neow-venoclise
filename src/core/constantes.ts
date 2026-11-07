/**
 * Constantes clínicas do NeoW Venóclise.
 * REGRA: toda constante tem fonte citada. Sem fonte validada => TODO(validar) e a saída é bloqueada.
 * Detalhes e conflitos: docs/regras-clinicas.md e docs/DIVERGENCIAS.md.
 */

// ---------------------------------------------------------------- Ampolas (configuráveis por serviço)

/** Gluconato de cálcio 10%. Fonte: MS 2014 vol. 2 cap. 12. 1 mL = 100 mg de sal = 9,3 mg Ca elementar = 0,465 mEq = 0,2325 mmol. */
export const GLUCONATO_CA = {
  mgSalPorMl: 100,
  mgElementarPorMl: 9.3,
  mEqPorMl: 0.465,
  mmolPorMl: 0.2325,
} as const;

/** MgSO4. Fonte: MS 2014. 10% = 100 mg/mL = 0,81 mEq/mL; 50% = 4,05 mEq/mL. 1 mEq = 0,5 mmol (bivalente). */
export const AMPOLAS_MG = {
  "10": { rotulo: "MgSO₄ 10%", mgPorMl: 100, mEqPorMl: 0.81 },
  "50": { rotulo: "MgSO₄ 50%", mgPorMl: 500, mEqPorMl: 4.05 },
} as const;

/** NaCl. Fonte: MS 2014 / padrão do serviço. 20% = 3,4 mEq/mL; 10% = 1,7 mEq/mL. */
export const AMPOLAS_NA = {
  "20": { rotulo: "NaCl 20%", mEqPorMl: 3.4 },
  "10": { rotulo: "NaCl 10%", mEqPorMl: 1.7 },
} as const;

/** KCl. Fonte: MS 2014 / padrão do serviço. 19,1% = 2,56 mEq/mL; 10% = 1,34 mEq/mL. */
export const AMPOLAS_K = {
  "19.1": { rotulo: "KCl 19,1%", mEqPorMl: 2.56 },
  "10": { rotulo: "KCl 10%", mEqPorMl: 1.34 },
} as const;

/** Massa atômica (física, não clínica) para converter mEq em mg de elemento. */
export const MG_POR_MEQ_NA = 23.0;
export const MG_POR_MEQ_K = 39.1;

/** Soros glicosados: g de glicose por mL. */
export const GLICOSE_G_POR_ML = { sg5: 0.05, sg10: 0.1, sg50: 0.5 } as const;

// ---------------------------------------------------------------- Glicose

/** glicose (g/dia) = TIG (mg/kg/min) × 1,44 × peso (kg). 1,44 = 1440 min/dia ÷ 1000 mg/g. */
export const FATOR_TIG = 1.44;

/** Fonte: MS 2014 (hemólise). */
export const CONC_GLICOSE_MIN_PCT = 2.5;
/** Fonte: MS 2014. Acima disto exige acesso central. */
export const CONC_GLICOSE_MAX_PERIFERICO_PCT = 12.5;
/** Fonte: ESPGHAN 2018 R5.4. TIG máxima. */
export const TIG_MAX = 12;

/** Faixas recomendadas de TIG (mg/kg/min). Fonte: ESPGHAN 2018 R5.4. */
export const TIG_FAIXAS = {
  pretermo: { d1: [4, 8], aPartirD2: [4, 10], padraoSugerido: 5 },
  termo: { d1: [2.5, 5], aPartirD2: [2.5, 10], padraoSugerido: 4.5 },
} as const;

// ---------------------------------------------------------------- Volume hídrico (mL/kg/dia)

export type GrupoVolume = "termo" | "pt_gt1500" | "pt_1000_1500" | "pt_lt1000";

/** ESPGHAN 2018 (Jochum, Clin Nutr 2018;37) = SBP 2023. Índice 0..4 = D1..D5. D6+ => FASE_II_III. */
export const VOLUME_ESPGHAN: Record<GrupoVolume, ReadonlyArray<readonly [number, number]>> = {
  termo: [[40, 60], [50, 70], [60, 80], [60, 100], [100, 140]],
  pt_gt1500: [[60, 80], [80, 100], [100, 120], [120, 140], [140, 160]],
  pt_1000_1500: [[70, 90], [90, 110], [110, 130], [130, 150], [160, 180]],
  pt_lt1000: [[80, 100], [100, 120], [120, 140], [140, 160], [160, 180]],
};
/** Fonte: ESPGHAN/SBP: D6 em diante, fase II/III. */
export const FASE_II_III: readonly [number, number] = [140, 160];

/** MS 2014 / Lorenz 2008. Colunas por peso de nascimento; linhas por dia. */
export type ClassePesoMS = "le750" | "751_1000" | "1001_1500" | "1501_2500";
export const VOLUME_MS: Record<ClassePesoMS, { d1: readonly [number, number]; d2: readonly [number, number]; d3_4: readonly [number, number]; d5_7: readonly [number, number] }> = {
  le750: { d1: [90, 120], d2: [100, 140], d3_4: [120, 150], d5_7: [130, 150] },
  "751_1000": { d1: [90, 120], d2: [100, 130], d3_4: [120, 140], d5_7: [130, 150] },
  "1001_1500": { d1: [80, 100], d2: [100, 120], d3_4: [120, 140], d5_7: [130, 150] },
  "1501_2500": { d1: [70, 90], d2: [90, 110], d3_4: [100, 140], d5_7: [120, 150] },
};
/** MS 2014, termo: D1 = 60–80 de SG 10%; D7 = 80–120. D2–D6 NÃO tabelados => TODO(validar). */
export const VOLUME_MS_TERMO = { d1: [60, 80], d7: [80, 120] } as const;

/** Ajustes da faixa. Fonte: MS 2014 / ESPGHAN. Interpretação: ver DIVERGENCIAS.md (h). */
export const AJUSTE_FOTOTERAPIA = { min: 0.1, max: 0.2 } as const; // +10% no limite inferior, +20% no superior
export const AJUSTE_ASFIXIA_SDR_VM = { min: 0.1, max: 0.2 } as const; // −20% no inferior, −10% no superior

// ---------------------------------------------------------------- Cálcio

/** Fonte: ESPGHAN/SBP D1–10: 0,8–2,0 mmol/kg/dia. */
export const CA_FAIXA_MMOL_KG = [0.8, 2.0] as const;
/** Padrão do serviço. Fonte: MS 2014 vol. 2 cap. 12. */
export const CA_PADRAO_ML_KG = 4;
/** Hipocalcemia sem convulsão: sugerir 5 mL/kg/dia (MS 2014). */
export const CA_HIPOCALCEMIA_ML_KG = 5;
/** Limites de hipocalcemia (MS 2014). */
export const HIPOCA = {
  lt1500: { totalMgDl: 7, ionicoMmolL: 1.0 },
  ge1500: { totalMgDl: 8, ionicoMmolL: 1.1 },
} as const;

/**
 * Presets de cálcio. TODO(validar): o significado de "Ca 100 / Ca 200" no serviço NÃO está confirmado.
 * Aqui só valem os rótulos explícitos (mg/kg/dia de SAL). Ver DIVERGENCIAS.md (c).
 */
export const PRESETS_CALCIO = {
  padrao: { rotulo: "4 mL/kg/dia (padrão MS)", mlKg: 4 },
  ca100: { rotulo: "Ca 100 = 100 mg/kg/dia de SAL (1 mL/kg)", mlKg: 1 },
  ca200: { rotulo: "Ca 200 = 200 mg/kg/dia de SAL (2 mL/kg)", mlKg: 2 },
  hipocalcemia: { rotulo: "Hipocalcemia sem convulsão (5 mL/kg/dia)", mlKg: 5 },
} as const;

// ---------------------------------------------------------------- Magnésio

export const MG_PADRAO_MEQ_KG = 0.3;
/** ESPGHAN/SBP: D1–10 0,2–0,4 mEq/kg/dia; depois 0,4–0,6. */
export const MG_FAIXA_MEQ_KG = { ate10: [0.2, 0.4], depois10: [0.4, 0.6] } as const;
export const MG_SERICO = { zerarAcimaMgDl: 2.5, hipoAbaixoMgDl: 1.5, graveAbaixoMgDl: 1.2 } as const;

// ---------------------------------------------------------------- Na / K

export const NA_ALVO_PLASMA = [135, 145] as const;
export const NA_FAIXA_MEQ_KG = { termo: [2, 4], pt: [3, 5], espghanMax: 5, espghanMaxLt1500: 7 } as const;
export const K_FAIXA_MEQ_KG = { termo: [1, 2.5], pt: [2, 3] } as const;
export const K_SERICO = { bloqueiaMmolL: 5.5, hipercalemiaMmolL: 6.0, hipoMmolL: 3.5 } as const;
export const DIURESE_MINIMA_ML_KG_H = 1;

// ---------------------------------------------------------------- Travas de entrada (MS 2014 / bom senso do serviço)

export const SANIDADE = {
  pesoMinG: 300,
  pesoMaxG: 6500,
  /** Abaixo disto o app pergunta "kg?". */
  pesoProvavelKg: 15,
  igMin: 22,
  igMax: 44,
  diaMax: 28,
  variacaoPesoConfirmarPct: 25,
  vazaoMinMlH: 0.5,
  aditivosMaxPctVolume: 15,
} as const;

/** Perda de peso. Fonte: MS 2014. */
export const PERDA_PESO = { termoAlertaPct: 10, lt1500AlertaPct: 10, excessoPct: 20, extremoMinPctAposD3: 2 } as const;

export const GLICEMIA = {
  hipoMgDl: 45,
  manterAteMgDl: 175, // 125–175 manter TIG
  reduz2AteMgDl: 250, // 175–250: −2 mg/kg/min
  persistenteInsulinaMgDl: 180,
} as const;
