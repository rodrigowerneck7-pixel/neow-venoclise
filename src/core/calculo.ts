/**
 * Motor de cálculo do NeoW Venóclise. PURO: sem DOM, sem I/O, sem relógio.
 * É a ÚNICA fonte de cálculo; a UI só exibe o que sai daqui.
 * Princípio: nunca inventar valor. Campo obrigatório vazio => `pendencias` e nenhuma saída numérica.
 */
import {
  AMPOLAS_K,
  AMPOLAS_MG,
  AMPOLAS_NA,
  CA_FAIXA_MMOL_KG,
  CA_HIPOCALCEMIA_ML_KG,
  CA_PADRAO_ML_KG,
  CONC_GLICOSE_MAX_PERIFERICO_PCT,
  CONC_GLICOSE_MIN_PCT,
  DIURESE_MINIMA_ML_KG_H,
  FATOR_TIG,
  GLICEMIA,
  GLICOSE_G_POR_ML,
  GLUCONATO_CA,
  HIPOCA,
  K_FAIXA_MEQ_KG,
  K_SERICO,
  MG_FAIXA_MEQ_KG,
  MG_PADRAO_MEQ_KG,
  MG_POR_MEQ_K,
  MG_POR_MEQ_NA,
  MG_SERICO,
  NA_ALVO_PLASMA,
  NA_FAIXA_MEQ_KG,
  PERDA_PESO,
  SANIDADE,
  TIG_FAIXAS,
  TIG_MAX,
} from "./constantes";
import { ehTermo, faixaTig, faixaVolume, grupoVolume, rotuloGrupo } from "./faixas";
import { arredondar, arredondarMl, fmt } from "./numeros";
import type {
  Alerta,
  CalculoVenoclise,
  Componentes,
  ConfigServico,
  DoseCa,
  DoseEletrolito,
  EntradaVenoclise,
  Justificativa,
  Mistura,
  PassoMemoria,
  ResultadoVenoclise,
} from "./tipos";

export const CONFIG_PADRAO: ConfigServico = {
  fonteHidrica: "espghan",
  mgso4: "10",
  nacl: "20",
  kcl: "19.1",
  soroBaixo: "sg10",
  calcioMlKgDia: CA_PADRAO_ML_KG,
  magnesioMEqKgDia: MG_PADRAO_MEQ_KG,
  etapas: 1,
};

/** Rodapé de cada prescrição: concentrações em uso no serviço. */
export function rodapeConcentracoes(cfg: ConfigServico): string {
  return `Concentrações: gluconato de Ca 10%, ${AMPOLAS_MG[cfg.mgso4].rotulo}, ${AMPOLAS_NA[cfg.nacl].rotulo}, ${AMPOLAS_K[cfg.kcl].rotulo}, SG 5%/10%/50%.`;
}

// ------------------------------------------------------------------ peso

export type LeituraPeso =
  | { tipo: "vazio" }
  | { tipo: "invalido" }
  | { tipo: "perguntar_kg"; valor: number }
  | { tipo: "ok"; gramas: number; convertidoDeKg: boolean };

/** Peso < 15 provavelmente é kg: pergunta e só converte após confirmação. */
export function interpretarPeso(valor: number | null | undefined, confirmouKg: boolean | undefined): LeituraPeso {
  if (valor == null) return { tipo: "vazio" };
  if (!Number.isFinite(valor) || valor <= 0) return { tipo: "invalido" };
  if (valor < SANIDADE.pesoProvavelKg) {
    return confirmouKg ? { tipo: "ok", gramas: valor * 1000, convertidoDeKg: true } : { tipo: "perguntar_kg", valor };
  }
  return { tipo: "ok", gramas: valor, convertidoDeKg: false };
}

const zeroSeTiny = (v: number) => (Math.abs(v) < 1e-9 ? 0 : v);
const dentro = (v: number, min: number, max: number) => v >= min - 1e-9 && v <= max + 1e-9;
const temJust = (j?: Justificativa) => !!j && j.confirmado && j.justificativa.trim().length > 0;

function vazio(pendencias: string[], alertas: Alerta[], memoria: PassoMemoria[] = []): ResultadoVenoclise {
  return { pendencias, alertas, memoria, liberado: false };
}

// ------------------------------------------------------------------ motor

export function calcularVenoclise(e: EntradaVenoclise, cfg: ConfigServico = CONFIG_PADRAO): ResultadoVenoclise {
  const alertas: Alerta[] = [];
  const pendencias: string[] = [];
  const memoria: PassoMemoria[] = [];
  const add = (a: Alerta) => alertas.push(a);

  // ---------- 1. Dados obrigatórios do paciente
  const pn = interpretarPeso(e.pesoNascimento, e.confirmouKg?.nascimento);
  if (pn.tipo === "vazio") pendencias.push("Informe o peso de nascimento");
  if (pn.tipo === "invalido") add({ id: "peso-nasc-invalido", nivel: "vermelho", bloqueia: true, titulo: "Peso de nascimento inválido" });
  if (pn.tipo === "perguntar_kg") {
    add({
      id: "peso-nasc-kg",
      nivel: "vermelho",
      bloqueia: true,
      titulo: `Peso de nascimento ${fmt(pn.valor, 3)}: você quis dizer ${fmt(pn.valor, 3)} kg (${fmt(pn.valor * 1000, 0)} g)?`,
      detalhe: "O app trabalha em gramas. Confirme para converter.",
      acao: "confirmar_kg",
    });
  }
  if (e.igSemanas == null) pendencias.push("Informe a idade gestacional (semanas)");
  if (e.diaDeVida == null) pendencias.push("Informe o dia de vida");
  if (pendencias.length || pn.tipo !== "ok") return vazio(pendencias, alertas);

  const pesoNascG = pn.gramas;
  const igSem = e.igSemanas as number;
  const igDias = e.igDias ?? 0;
  const dia = e.diaDeVida as number;

  // ---------- 2. Sanidade de entrada (trava e não calcula)
  if (pesoNascG < SANIDADE.pesoMinG || pesoNascG > SANIDADE.pesoMaxG) {
    add({ id: "peso-fora", nivel: "vermelho", bloqueia: true, titulo: `Peso de nascimento ${fmt(pesoNascG, 0)} g fora de ${SANIDADE.pesoMinG}–${SANIDADE.pesoMaxG} g`, detalhe: "Confira a digitação (g × kg)." });
  }
  if (igSem < SANIDADE.igMin || igSem > SANIDADE.igMax || igDias < 0 || igDias > 6) {
    add({ id: "ig-fora", nivel: "vermelho", bloqueia: true, titulo: `IG ${igSem}+${igDias} fora de ${SANIDADE.igMin}–${SANIDADE.igMax} semanas`, detalhe: "Dias da IG: 0 a 6." });
  }
  if (!Number.isInteger(dia) || dia < 1) {
    add({ id: "dia-invalido", nivel: "vermelho", bloqueia: true, titulo: "Dia de vida inválido (D1 = primeiras 24 h)" });
  } else if (dia > SANIDADE.diaMax) {
    add({ id: "dia-escopo", nivel: "vermelho", bloqueia: true, titulo: `Dia de vida ${dia} > ${SANIDADE.diaMax}: fora do escopo neonatal deste app` });
  }
  if (alertas.some((a) => a.bloqueia)) return vazio(pendencias, alertas);

  // Peso atual: opcional no D1, obrigatório depois.
  const pa = interpretarPeso(e.pesoAtual ?? null, e.confirmouKg?.atual);
  if (pa.tipo === "vazio" && dia >= 2) pendencias.push("Informe o peso atual (obrigatório a partir do D2)");
  if (pa.tipo === "invalido") add({ id: "peso-atual-invalido", nivel: "vermelho", bloqueia: true, titulo: "Peso atual inválido" });
  if (pa.tipo === "perguntar_kg") {
    add({
      id: "peso-atual-kg",
      nivel: "vermelho",
      bloqueia: true,
      titulo: `Peso atual ${fmt(pa.valor, 3)}: você quis dizer ${fmt(pa.valor, 3)} kg (${fmt(pa.valor * 1000, 0)} g)?`,
      acao: "confirmar_kg",
    });
  }
  if (pendencias.length || pa.tipo === "invalido" || pa.tipo === "perguntar_kg") return vazio(pendencias, alertas);
  const pesoAtualG = pa.tipo === "ok" ? pa.gramas : null;
  if (pesoAtualG != null && (pesoAtualG < SANIDADE.pesoMinG || pesoAtualG > SANIDADE.pesoMaxG)) {
    add({ id: "peso-atual-fora", nivel: "vermelho", bloqueia: true, titulo: `Peso atual ${fmt(pesoAtualG, 0)} g fora de ${SANIDADE.pesoMinG}–${SANIDADE.pesoMaxG} g` });
    return vazio(pendencias, alertas);
  }

  // ---------- 3. Peso de cálculo (MS 2014)
  const recuperou = pesoAtualG != null && pesoAtualG >= pesoNascG;
  const pesoUsado: "nascimento" | "atual" = recuperou ? "atual" : "nascimento";
  const pesoCalcG = recuperou ? (pesoAtualG as number) : pesoNascG;
  const kg = pesoCalcG / 1000;
  memoria.push({
    titulo: "Peso de cálculo",
    formula: "PN enquanto peso atual < PN; depois, peso atual",
    resultado: `${fmt(pesoCalcG, 0)} g (${pesoUsado === "nascimento" ? "peso de nascimento" : "peso atual"})`,
    fonte: "MS 2014 (Atenção à Saúde do RN, vol. 2 cap. 12)",
  });

  const termo = ehTermo(igSem);
  const grupo = grupoVolume(igSem, pesoNascG);
  const rotulo = rotuloGrupo(grupo);

  if (pesoAtualG != null) {
    const variacao = Math.abs(pesoAtualG - pesoNascG) / pesoNascG * 100;
    if (variacao > SANIDADE.variacaoPesoConfirmarPct && !e.confirmouVariacaoPeso) {
      add({ id: "variacao-peso", nivel: "vermelho", bloqueia: true, titulo: `Peso atual difere ${fmt(variacao, 1)}% do PN: confirmar`, detalhe: "Variação > 25%. Confira os pesos." });
    }
    const perda = ((pesoNascG - pesoAtualG) / pesoNascG) * 100;
    memoria.push({ titulo: "Perda de peso", formula: "(PN − atual) ÷ PN × 100", resultado: `${fmt(perda, 1)}%`, fonte: "MS 2014" });
    if (perda >= PERDA_PESO.excessoPct) {
      add({ id: "perda-excesso", nivel: "vermelho", bloqueia: false, titulo: `Perda de peso ${fmt(perda, 1)}% (≥ 20%): excesso de perda`, fonte: "MS 2014" });
    } else if (termo && perda > PERDA_PESO.termoAlertaPct) {
      add({ id: "perda-termo", nivel: "laranja", bloqueia: false, titulo: `Perda de peso ${fmt(perda, 1)}% no termo (> 10%)`, fonte: "MS 2014" });
    } else if (pesoNascG < 1500 && perda > PERDA_PESO.lt1500AlertaPct) {
      add({ id: "perda-lt1500", nivel: "laranja", bloqueia: false, titulo: `Perda de peso ${fmt(perda, 1)}% no < 1.500 g (esperado 7–10%)`, fonte: "MS 2014" });
    }
    const extremo = igSem < 28 || pesoNascG < 1000;
    if (extremo && dia > 3 && perda < PERDA_PESO.extremoMinPctAposD3) {
      add({ id: "perda-pouca", nivel: "laranja", bloqueia: false, titulo: `Perda de peso ${fmt(perda, 1)}% no extremo após o D3: possível oferta excessiva`, fonte: "MS 2014" });
    }
  }

  // ---------- 4. Faixas de referência
  const fv = faixaVolume(cfg.fonteHidrica, grupo, pesoNascG, dia, !!e.fototerapia, !!e.asfixiaSdrVm);
  const ftig = faixaTig(termo, dia);
  const tigPadrao = termo ? TIG_FAIXAS.termo.padraoSugerido : TIG_FAIXAS.pretermo.padraoSugerido;
  const referencia = { grupo: rotulo, pesoCalculoG: pesoCalcG, pesoUsado, volume: fv, tig: ftig, tigPadraoSugerido: tigPadrao };

  if (e.ambiente === "berco_aquecido") {
    add({ id: "berco", nivel: "azul", bloqueia: false, titulo: "Berço aquecido sem umidade: perdas insensíveis podem dobrar; considere o limite superior da faixa" });
  }
  add({ id: "np", nivel: "azul", bloqueia: false, titulo: "NP (aminoácidos/lipídios, fosfato): use o protocolo da NP / farmácia", detalhe: "Fora do escopo deste app, assim como choque, desidratação, insuficiência renal, SIADH e cardiopatia com restrição hídrica." });

  // ---------- 5. Escolhas do médico obrigatórias
  if (e.volumeMlKgDia == null) pendencias.push("Escolha o volume total (mL/kg/dia)");
  if (e.tig == null) pendencias.push("Escolha a TIG (mg/kg/min)");
  if (dia <= 7 && e.maeMgSO4 == null) pendencias.push("Informe se a mãe recebeu MgSO₄");
  const ca = e.calcio ?? {};
  const riscoCa = !!e.asfixiaSdrVm || !!ca.fatoresRisco?.maeDiabetica || !!ca.fatoresRisco?.pig;
  const caIndicado = !termo || riscoCa;
  if (ca.incluir == null && !caIndicado) pendencias.push("Termo sem fator de risco: informe se adiciona gluconato de cálcio");
  if (pendencias.length || alertas.some((a) => a.bloqueia && a.id !== "np")) {
    return { pendencias, alertas, referencia, memoria, liberado: false };
  }
  const volMlKg = e.volumeMlKgDia as number;
  const tig = e.tig as number;
  if (!(volMlKg > 0) || !(tig > 0)) {
    add({ id: "valor-invalido", nivel: "vermelho", bloqueia: true, titulo: "Volume e TIG devem ser maiores que zero" });
    return { pendencias, alertas, referencia, memoria, liberado: false };
  }

  // ---------- 6. Volume
  const volTotalDia = volMlKg * kg;
  const enteralMlDia = (e.dietaEnteralMlKgDia ?? 0) * kg;
  const outrasMlDia = e.outrasInfusoesMlDia ?? 0;
  const volV = volTotalDia - enteralMlDia - outrasMlDia;
  memoria.push({ titulo: "Volume total", formula: `${fmt(volMlKg)} mL/kg/dia × ${fmt(kg, 3)} kg`, resultado: `${fmt(volTotalDia, 2)} mL/dia`, fonte: fv.status === "ok" ? fv.fonte : undefined });
  memoria.push({
    titulo: "Volume da venóclise",
    formula: `${fmt(volTotalDia, 2)} − enteral ${fmt(enteralMlDia, 2)} − outras infusões ${fmt(outrasMlDia, 2)}`,
    resultado: `${fmt(volV, 2)} mL/dia`,
  });
  if (volV <= 0) {
    add({ id: "volume-zero", nivel: "vermelho", bloqueia: true, titulo: "Dieta enteral + outras infusões já cobrem o volume total: não há volume para a venóclise" });
    return { pendencias, alertas, referencia, memoria, liberado: false };
  }

  if (fv.status === "todo") {
    if (temJust(e.foraDaFaixa?.volume)) {
      add({ id: "volume-manual", nivel: "laranja", bloqueia: false, titulo: "Volume manual sem faixa da diretriz", detalhe: `Justificativa: ${e.foraDaFaixa!.volume!.justificativa}` });
    } else {
      add({ id: "volume-todo", nivel: "vermelho", bloqueia: true, titulo: "Faixa de volume indisponível", detalhe: `${fv.motivo} Para seguir com volume manual, confirme com justificativa.` });
    }
  } else if (!dentro(volMlKg, fv.ajustada.min, fv.ajustada.max)) {
    const faixaTxt = `${fmt(fv.ajustada.min, 1)}–${fmt(fv.ajustada.max, 1)} mL/kg/dia`;
    if (temJust(e.foraDaFaixa?.volume)) {
      add({ id: "volume-fora", nivel: "laranja", bloqueia: false, titulo: `Volume ${fmt(volMlKg)} fora da diretriz (${faixaTxt})`, detalhe: `Justificativa: ${e.foraDaFaixa!.volume!.justificativa}`, fonte: fv.fonte });
    } else {
      add({ id: "volume-fora", nivel: "vermelho", bloqueia: true, titulo: `Fora da diretriz (${faixaTxt}), confirmar?`, detalhe: "Confirme e registre a justificativa para liberar.", fonte: fv.fonte });
    }
  }

  // ---------- 7. Glicose
  const glicoseG = tig * FATOR_TIG * kg;
  const concFinal = (glicoseG / volV) * 100;
  memoria.push({ titulo: "Glicose", formula: `TIG ${fmt(tig)} × 1,44 × ${fmt(kg, 3)} kg`, resultado: `${fmt(glicoseG, 2)} g/dia`, fonte: "Fórmula padrão (ESPGHAN 2018 R5.4)" });
  memoria.push({ titulo: "Concentração final de glicose", formula: `${fmt(glicoseG, 2)} g ÷ ${fmt(volV, 2)} mL × 100`, resultado: `${fmt(concFinal, 2)}%` });

  if (!dentro(tig, ftig.min, ftig.max)) {
    const txt = `${fmt(ftig.min)}–${fmt(ftig.max)} mg/kg/min`;
    if (temJust(e.foraDaFaixa?.tig)) {
      add({ id: "tig-fora", nivel: "laranja", bloqueia: false, titulo: `TIG ${fmt(tig)} fora da faixa recomendada (${txt})`, detalhe: `Justificativa: ${e.foraDaFaixa!.tig!.justificativa}`, fonte: "ESPGHAN 2018 R5.4" });
    } else {
      add({ id: "tig-fora", nivel: "vermelho", bloqueia: true, titulo: `TIG fora da faixa recomendada (${txt}), confirmar?`, fonte: "ESPGHAN 2018 R5.4" });
    }
  }
  if (tig > TIG_MAX) {
    add({
      id: "tig-max",
      nivel: "vermelho",
      bloqueia: false,
      titulo: `TIG ${fmt(tig)} > ${TIG_MAX} mg/kg/min`,
      detalhe: "Hipoglicemia refratária: o MS cita hidrocortisona 5 mg/kg/dose 12/12 h (apenas referência; decisão médica).",
      fonte: "ESPGHAN 2018 R5.4; MS 2014",
    });
  }
  if (tig < 4.5 && !termo) {
    add({ id: "tig-baixa", nivel: "azul", bloqueia: false, titulo: "Tentar manter TIG ≥ 4,5 mg/kg/min", fonte: "SBP 2023" });
  }
  if (termo) {
    add({ id: "tig-ms", nivel: "azul", bloqueia: false, titulo: "Referência MS: termo com 60–80 mL/kg de SG 10% ≈ TIG 4–6 mg/kg/min", fonte: "MS 2014" });
  }
  if (e.sepseOuDoencaAguda) {
    add({ id: "tig-sepse", nivel: "azul", bloqueia: false, titulo: "Sepse/doença aguda: considerar voltar à TIG do D1", fonte: "ESPGHAN 2018 R5.5" });
  }

  const g = e.labs?.glicemia;
  if (g != null) {
    if (g < GLICEMIA.hipoMgDl) {
      add({ id: "glicemia-hipo", nivel: "vermelho", bloqueia: false, titulo: `Glicemia ${fmt(g, 0)} mg/dL (< 45): hipoglicemia`, detalhe: "Abrir a tela de hipoglicemia (bolus 2 mL/kg de SG 10%, sem cálcio no bolus).", fonte: "MS 2014", acao: "hipoglicemia" });
    } else if (g > GLICEMIA.reduz2AteMgDl) {
      add({ id: "glicemia-alta", nivel: "laranja", bloqueia: false, titulo: `Glicemia ${fmt(g, 0)} mg/dL (> 250): reduzir TIG em 4 mg/kg/min`, detalhe: `TIG sugerida: ${fmt(Math.max(tig - 4, 0))}`, fonte: "MS 2014" });
    } else if (g > GLICEMIA.manterAteMgDl) {
      add({ id: "glicemia-alta", nivel: "laranja", bloqueia: false, titulo: `Glicemia ${fmt(g, 0)} mg/dL (175–250): reduzir TIG em 2 mg/kg/min`, detalhe: `TIG sugerida: ${fmt(Math.max(tig - 2, 0))}`, fonte: "MS 2014" });
    } else if (g >= 125) {
      add({ id: "glicemia-manter", nivel: "azul", bloqueia: false, titulo: `Glicemia ${fmt(g, 0)} mg/dL (125–175): manter TIG`, fonte: "MS 2014" });
    }
    if (g > GLICEMIA.persistenteInsulinaMgDl) {
      add({ id: "glicemia-insulina", nivel: "laranja", bloqueia: false, titulo: "Glicemia > 180: se persistir após ajustar a TIG, considerar insulina (decisão médica)", fonte: "ESPGHAN 2018 R5.11" });
    }
  }

  // ---------- 8. Cálcio
  const caAtivo = ca.incluir === false ? false : true;
  const caMlKg = caAtivo ? (ca.mlKgDia ?? cfg.calcioMlKgDia) : 0;
  const caMlDia = caMlKg * kg;
  const doseCa: DoseCa = {
    mlKg: caMlKg,
    mlDia: caMlDia,
    mgSalKg: caMlKg * GLUCONATO_CA.mgSalPorMl,
    mgElementarKg: caMlKg * GLUCONATO_CA.mgElementarPorMl,
    mmolKg: caMlKg * GLUCONATO_CA.mmolPorMl,
    mmolDia: caMlDia * GLUCONATO_CA.mmolPorMl,
    mEqKg: caMlKg * GLUCONATO_CA.mEqPorMl,
  };
  memoria.push({
    titulo: "Gluconato de cálcio 10%",
    formula: `${fmt(caMlKg)} mL/kg × ${fmt(kg, 3)} kg`,
    resultado: `${fmt(caMlDia, 2)} mL = ${fmt(doseCa.mmolDia, 2)} mmol · ${fmt(doseCa.mgSalKg, 1)} mg/kg de sal · ${fmt(doseCa.mgElementarKg, 1)} mg/kg de Ca elementar · ${fmt(doseCa.mmolKg, 3)} mmol/kg`,
    fonte: "MS 2014 vol. 2 cap. 12 (1 mL = 100 mg sal = 9,3 mg Ca elem. = 0,2325 mmol)",
  });
  if ((caIndicado || ca.incluir === true) && doseCa.mmolKg < CA_FAIXA_MMOL_KG[0] - 1e-9) {
    add({ id: "ca-baixo", nivel: "laranja", bloqueia: false, titulo: `Cálcio ${fmt(doseCa.mmolKg, 2)} mmol/kg/dia: abaixo de 0,8 mmol/kg/dia (ESPGHAN/NICE/SBP/MS)`, fonte: "ESPGHAN 2018; SBP 2023" });
  }
  if (doseCa.mmolKg > CA_FAIXA_MMOL_KG[1] + 1e-9) {
    add({ id: "ca-alto", nivel: "laranja", bloqueia: false, titulo: `Cálcio ${fmt(doseCa.mmolKg, 2)} mmol/kg/dia: acima de 2,0 mmol/kg/dia`, fonte: "ESPGHAN 2018; SBP 2023" });
  }
  if (caMlKg > 0 && e.acesso === "periferico") {
    add({ id: "ca-extravasamento", nivel: "azul", bloqueia: false, titulo: "Cálcio em acesso periférico: risco de necrose se extravasar" });
  }
  const lb = e.labs ?? {};
  const lim = pesoNascG < 1500 ? HIPOCA.lt1500 : HIPOCA.ge1500;
  if ((lb.caTotal != null && lb.caTotal < lim.totalMgDl) || (lb.caIonico != null && lb.caIonico < lim.ionicoMmolL)) {
    add({
      id: "hipocalcemia",
      nivel: "laranja",
      bloqueia: false,
      titulo: "Hipocalcemia pelos exames",
      detalhe: `Sem convulsão: sugerir ${CA_HIPOCALCEMIA_ML_KG} mL/kg/dia no soro. Bolus de 2 mL/kg em 5–10 min só em convulsão ou arritmia por hipercalemia, com monitorização da FC (apenas referência).`,
      fonte: "MS 2014",
    });
  }

  // ---------- 9. Magnésio
  const mgCfg = AMPOLAS_MG[cfg.mgso4];
  const mae = dia <= 7 ? e.maeMgSO4 : "nao";
  const mgSer = lb.mg;
  let mgSugerido = cfg.magnesioMEqKgDia;
  if (mae === "sim" && (mgSer == null || mgSer > MG_SERICO.zerarAcimaMgDl)) mgSugerido = 0;
  if (mgSer != null && mgSer > MG_SERICO.zerarAcimaMgDl) mgSugerido = 0;
  if (mae === "sim") {
    add({
      id: "mg-mae",
      nivel: "vermelho",
      bloqueia: false,
      titulo: "Mãe recebeu MgSO₄: sugerido NÃO adicionar Mg até ter o Mg sérico",
      detalhe: "O RN fica hipermagnesêmico por 3–7 dias.",
      fonte: "ESPGHAN 2018 R8.5",
    });
  } else if (mae === "nao_sei") {
    add({ id: "mg-mae-nao-sei", nivel: "laranja", bloqueia: false, titulo: "Não se sabe se a mãe recebeu MgSO₄: confirme antes de adicionar Mg", fonte: "ESPGHAN 2018 R8.5" });
  }
  if (mgSer != null) {
    if (mgSer < MG_SERICO.graveAbaixoMgDl) add({ id: "mg-grave", nivel: "vermelho", bloqueia: false, titulo: `Mg sérico ${fmt(mgSer, 1)} mg/dL: hipomagnesemia grave; tratar e corrigir o Mg antes do Ca`, fonte: "MS 2014" });
    else if (mgSer < MG_SERICO.hipoAbaixoMgDl) add({ id: "mg-baixo", nivel: "laranja", bloqueia: false, titulo: `Mg sérico ${fmt(mgSer, 1)} mg/dL: hipomagnesemia`, fonte: "MS 2014" });
    else if (mgSer > MG_SERICO.zerarAcimaMgDl) add({ id: "mg-alto", nivel: "laranja", bloqueia: false, titulo: `Mg sérico ${fmt(mgSer, 1)} mg/dL (> 2,5): sugerido zerar o Mg` });
  }
  const mgMEqKg = e.magnesioMEqKgDia ?? mgSugerido;
  const mgMEqDia = mgMEqKg * kg;
  const mgMlDia = mgMEqDia / mgCfg.mEqPorMl;
  const doseMg: DoseEletrolito = {
    mEqKg: mgMEqKg,
    mEqDia: mgMEqDia,
    mmolKg: mgMEqKg / 2,
    mlDia: mgMlDia,
    mgKg: (mgMlDia * mgCfg.mgPorMl) / kg,
  };
  memoria.push({
    titulo: `${mgCfg.rotulo}`,
    formula: `${fmt(mgMEqKg)} mEq/kg × ${fmt(kg, 3)} kg ÷ ${fmt(mgCfg.mEqPorMl, 2)} mEq/mL`,
    resultado: `${fmt(mgMlDia, 2)} mL = ${fmt(mgMEqDia, 2)} mEq (${fmt(doseMg.mmolKg, 3)} mmol/kg · ${fmt(doseMg.mgKg, 1)} mg/kg)`,
    fonte: "MS 2014; ESPGHAN/SBP 0,2–0,4 mEq/kg/dia (D1–10)",
  });
  if (mgMEqKg > 0) {
    const [mn, mx] = dia <= 10 ? MG_FAIXA_MEQ_KG.ate10 : MG_FAIXA_MEQ_KG.depois10;
    if (!dentro(mgMEqKg, mn, mx)) {
      add({ id: "mg-faixa", nivel: "laranja", bloqueia: false, titulo: `Mg ${fmt(mgMEqKg)} mEq/kg/dia fora da faixa ${fmt(mn)}–${fmt(mx)}`, fonte: "ESPGHAN 2018; SBP 2023" });
    }
    if (mae === "sim" && mgSer == null) {
      add({ id: "mg-mae-dose", nivel: "vermelho", bloqueia: false, titulo: "Mg prescrito apesar de mãe com MgSO₄ e sem Mg sérico: confirme" });
    }
  }

  // ---------- 10. Sódio
  const naCfg = AMPOLAS_NA[cfg.nacl];
  const naMEqKg = e.sodioMEqKgDia ?? 0;
  const naMEqDia = naMEqKg * kg;
  const doseNa: DoseEletrolito = { mEqKg: naMEqKg, mEqDia: naMEqDia, mmolKg: naMEqKg, mlDia: naMEqDia / naCfg.mEqPorMl, mgKg: naMEqKg * MG_POR_MEQ_NA };
  if (naMEqKg > 0) {
    if (dia === 1) {
      if (e.overrideSodioD1?.justificativa.trim()) {
        add({ id: "na-d1-override", nivel: "vermelho", bloqueia: false, titulo: "Na no D1 prescrito com justificativa (MS: não adicionar)", detalhe: `Justificativa: ${e.overrideSodioD1.justificativa}`, fonte: "MS 2014" });
      } else {
        add({ id: "na-d1", nivel: "vermelho", bloqueia: true, titulo: "Na no D1: não adicionar (MS 2014)", detalhe: "Para mudar, informe justificativa.", fonte: "MS 2014" });
      }
    }
    const maxNa = pesoNascG < 1500 ? NA_FAIXA_MEQ_KG.espghanMaxLt1500 : NA_FAIXA_MEQ_KG.espghanMax;
    if (naMEqKg > maxNa) add({ id: "na-alto", nivel: "laranja", bloqueia: false, titulo: `Na ${fmt(naMEqKg)} mEq/kg/dia acima de ${maxNa}`, fonte: "ESPGHAN 2018" });
    if (!termo && dia >= 2 && dia <= 4 && !(lb.na != null && lb.na < NA_ALVO_PLASMA[0])) {
      add({ id: "na-pt", nivel: "laranja", bloqueia: false, titulo: "PT: em geral Na só quando o Na plasmático cair (até o D4)", fonte: "MS 2014" });
    }
    if (termo && dia >= 2 && dia <= 3) {
      const ok = (e.diureseMlKgH != null && e.diureseMlKgH >= DIURESE_MINIMA_ML_KG_H) || (e.diureseMlKgH == null && e.urinou === "sim");
      if (!ok) add({ id: "na-diurese", nivel: "laranja", bloqueia: false, titulo: "Termo: Na requer diurese adequada (1–2 mL/kg/h) e Na plasmático normal", fonte: "MS 2014" });
    }
    add({ id: "na-oculto", nivel: "azul", bloqueia: false, titulo: "Hemoderivados, flush e diluição de drogas são fontes ocultas de Na" });
  } else if (dia >= 2) {
    const [a, b] = termo ? NA_FAIXA_MEQ_KG.termo : NA_FAIXA_MEQ_KG.pt;
    add({ id: "na-ref", nivel: "azul", bloqueia: false, titulo: `Na não adicionado. Referência MS: ${termo ? "termo, a partir do D2–3" : "PT, a partir do D5 (ou antes se Na cair)"}, ${a}–${b} mEq/kg/dia, com diurese adequada`, fonte: "MS 2014" });
  }
  if (lb.na != null) {
    if (lb.na > 150) add({ id: "na-150", nivel: "vermelho", bloqueia: false, titulo: `Na plasmático ${fmt(lb.na, 0)} (> 150)` });
    else if (lb.na > NA_ALVO_PLASMA[1]) add({ id: "na-145", nivel: "laranja", bloqueia: false, titulo: `Na plasmático ${fmt(lb.na, 0)} (> 145): pensar em desidratação/perda insensível antes de mexer no sódio` });
    else if (lb.na < NA_ALVO_PLASMA[0] && dia <= 7) add({ id: "na-135", nivel: "laranja", bloqueia: false, titulo: `Na plasmático ${fmt(lb.na, 0)} (< 135) na 1ª semana: pensar em hiperidratação`, fonte: "MS 2014" });
  }

  // ---------- 11. Potássio
  const kCfg = AMPOLAS_K[cfg.kcl];
  const kMEqKg = e.potassioMEqKgDia ?? 0;
  const kMEqDia = kMEqKg * kg;
  const dosek: DoseEletrolito = { mEqKg: kMEqKg, mEqDia: kMEqDia, mmolKg: kMEqKg, mlDia: kMEqDia / kCfg.mEqPorMl, mgKg: kMEqKg * MG_POR_MEQ_K };
  if (kMEqKg > 0) {
    if (dia === 1) add({ id: "k-d1", nivel: "vermelho", bloqueia: true, titulo: "K no D1: não adicionar (travado, MS 2014)", fonte: "MS 2014" });
    const diurese = e.diureseMlKgH;
    const diureseOk = diurese != null ? diurese >= DIURESE_MINIMA_ML_KG_H : e.urinou === "sim";
    if (!diureseOk) {
      add({ id: "k-diurese", nivel: "vermelho", bloqueia: true, titulo: "K requer diurese confirmada (≥ 1 mL/kg/h)", detalhe: diurese != null ? `Diurese informada: ${fmt(diurese)} mL/kg/h.` : "Urinou: não / não sei / não informado.", fonte: "MS 2014" });
    }
    if (pesoNascG < 800 && dia <= 3 && lb.k == null) {
      add({ id: "k-lt800", nivel: "vermelho", bloqueia: true, titulo: "< 800 g nas primeiras 72 h: risco de hipercalemia não oligúrica; informe o K sérico", fonte: "MS 2014; Cochrane (Vemgal & Ohlsson)" });
    }
    if (lb.k != null && lb.k >= K_SERICO.bloqueiaMmolL) {
      add({ id: "k-serico", nivel: "vermelho", bloqueia: true, titulo: `K sérico ${fmt(lb.k, 1)} (≥ 5,5): KCl bloqueado`, fonte: "MS 2014" });
    }
    const maxK = termo ? K_FAIXA_MEQ_KG.termo[1] : K_FAIXA_MEQ_KG.pt[1];
    if (kMEqKg > maxK) add({ id: "k-alto", nivel: "laranja", bloqueia: false, titulo: `K ${fmt(kMEqKg)} mEq/kg/dia acima de ${maxK}`, fonte: "MS 2014" });
  }
  if (lb.k != null) {
    if (lb.k > K_SERICO.hipercalemiaMmolL) add({ id: "k-hiper", nivel: "vermelho", bloqueia: false, titulo: `K sérico ${fmt(lb.k, 1)} (> 6,0): hipercalemia` });
    else if (lb.k < K_SERICO.hipoMmolL) add({ id: "k-hipo", nivel: "laranja", bloqueia: false, titulo: `K sérico ${fmt(lb.k, 1)} (< 3,5): hipocalemia` });
  }
  const cloroMmolKg = naMEqKg + kMEqKg;

  // ---------- 12. Mistura
  const addMl = caMlDia + mgMlDia + doseNa.mlDia + dosek.mlDia;
  const fracao = volV - addMl;
  if (fracao <= 0) {
    add({ id: "fracao-zero", nivel: "vermelho", bloqueia: true, titulo: "Os aditivos ocupam todo o volume da venóclise" });
    return { pendencias, alertas, referencia, memoria, liberado: false };
  }
  const concFracao = (glicoseG / fracao) * 100;
  const mist = montarMistura(glicoseG, fracao, concFracao, cfg.soroBaixo);
  if (!mist) {
    add({ id: "mistura-impossivel", nivel: "vermelho", bloqueia: true, titulo: `Concentração necessária ${fmt(concFracao, 1)}% na fração glicosada: impossível com SG 50% (reduza a TIG ou aumente o volume)` });
    return { pendencias, alertas, referencia, memoria, liberado: false };
  }
  memoria.push({
    titulo: "Fração glicosada",
    formula: `${fmt(volV, 2)} − aditivos ${fmt(addMl, 2)} mL`,
    resultado: `${fmt(fracao, 2)} mL a ${fmt(concFracao, 2)}% de glicose`,
  });
  memoria.push({
    titulo: "Mistura de soros",
    formula: concFracao > 10 ? "SG 10% + SG 50% (sistema de 2 equações: volume e glicose)" : cfg.soroBaixo === "sg10" ? "SG 10% = glicose ÷ 0,1; AD = fração − SG 10%" : "SG 5% + SG 10% / AD",
    resultado: [
      mist.sg5Ml > 0 ? `SG 5% ${fmt(mist.sg5Ml, 2)} mL` : "",
      mist.sg10Ml > 0 ? `SG 10% ${fmt(mist.sg10Ml, 2)} mL` : "",
      mist.sg50Ml > 0 ? `SG 50% ${fmt(mist.sg50Ml, 2)} mL` : "",
      mist.adMl > 0 ? `AD ${fmt(mist.adMl, 2)} mL` : "",
    ].filter(Boolean).join(" + "),
    fonte: "MS 2014",
  });

  const componentes: Componentes = {
    sg5: mist.sg5Ml,
    sg10: mist.sg10Ml,
    sg50: mist.sg50Ml,
    ad: mist.adMl,
    gluconatoCa: caMlDia,
    mgso4: mgMlDia,
    nacl: doseNa.mlDia,
    kcl: dosek.mlDia,
  };

  // ---------- 13. Travas da solução (MS 2014)
  if (concFinal < CONC_GLICOSE_MIN_PCT) {
    add({ id: "conc-min", nivel: "vermelho", bloqueia: true, titulo: `Concentração final ${fmt(concFinal, 2)}% < 2,5%: risco de hemólise`, fonte: "MS 2014" });
  }
  if (concFinal > CONC_GLICOSE_MAX_PERIFERICO_PCT) {
    if (e.acesso == null) {
      add({ id: "conc-acesso", nivel: "vermelho", bloqueia: true, titulo: `Concentração final ${fmt(concFinal, 2)}% > 12,5%: informe o tipo de acesso`, detalhe: "Acima de 12,5% exige acesso central (PICC/CVU).", fonte: "MS 2014" });
    } else if (e.acesso === "periferico") {
      add({ id: "conc-central", nivel: "vermelho", bloqueia: true, titulo: `Concentração final ${fmt(concFinal, 2)}% > 12,5% exige acesso central`, detalhe: "Acesso informado: periférico.", fonte: "MS 2014" });
    }
  }
  if (e.acesso == null && concFinal <= CONC_GLICOSE_MAX_PERIFERICO_PCT) {
    add({ id: "acesso-nao-informado", nivel: "azul", bloqueia: false, titulo: "Tipo de acesso não informado (a trava de 12,5% só dispara acima desse valor)" });
  }

  // ---------- 14. Vazão, etapas e arredondamento
  const vazao = volV / 24;
  if (vazao < SANIDADE.vazaoMinMlH) {
    add({ id: "vazao-baixa", nivel: "laranja", bloqueia: false, titulo: `Vazão ${fmt(vazao, 2)} mL/h (< 0,5): confira a precisão da bomba` });
  }
  if ((addMl / volV) * 100 > SANIDADE.aditivosMaxPctVolume) {
    add({ id: "aditivos-volume", nivel: "laranja", bloqueia: false, titulo: `Aditivos somam ${fmt((addMl / volV) * 100, 1)}% do volume (> 15%): revisar` });
  }

  const etapas = cfg.etapas;
  const horas = 24 / etapas;
  const rec = (v: number) => arredondarMl(v / etapas);
  const receitaEtapa: Componentes = {
    sg5: rec(componentes.sg5),
    sg10: rec(componentes.sg10),
    sg50: rec(componentes.sg50),
    ad: rec(componentes.ad),
    gluconatoCa: rec(componentes.gluconatoCa),
    mgso4: rec(componentes.mgso4),
    nacl: rec(componentes.nacl),
    kcl: rec(componentes.kcl),
  };
  const concFinalReal = concentracaoReal(receitaEtapa);
  memoria.push({
    titulo: "Concentração final real (valores arredondados)",
    formula: "glicose dos soros arredondados ÷ soma dos volumes arredondados × 100",
    resultado: `${fmt(concFinalReal, 2)}%`,
  });
  memoria.push({ titulo: "Vazão", formula: `${fmt(volV, 2)} mL ÷ 24 h`, resultado: `${fmt(vazao, 2)} mL/h (${etapas === 1 ? "etapa única 24 h" : `${etapas} etapas de ${horas} h`})` });
  if (cloroMmolKg > 0) {
    memoria.push({ titulo: "Cloro dos eletrólitos", formula: "Na + K (cloreto de Na e K)", resultado: `${fmt(cloroMmolKg, 2)} mmol/kg/dia`, fonte: "Referência ESPGHAN R6.5 (ver DIVERGENCIAS.md g)" });
  }

  const calculo: CalculoVenoclise = {
    pesoCalculoG: pesoCalcG,
    pesoCalculoKg: kg,
    pesoUsado,
    grupo: rotulo,
    volumeTotalMlKgDia: volMlKg,
    volumeTotalMlDia: volTotalDia,
    volumeEnteralMlDia: enteralMlDia,
    outrasInfusoesMlDia: outrasMlDia,
    volumeVenoclise: volV,
    vazaoMlH: vazao,
    etapas,
    horasPorEtapa: horas,
    tig,
    glicoseGDia: glicoseG,
    concFinalPct: concFinal,
    mistura: mist,
    calcio: doseCa,
    magnesio: doseMg,
    sodio: doseNa,
    potassio: dosek,
    cloroMmolKg,
    componentes,
    receitaEtapa,
    concFinalRealPct: concFinalReal,
  };

  const liberado = pendencias.length === 0 && !alertas.some((a) => a.bloqueia);
  return {
    pendencias,
    alertas,
    referencia,
    calculo,
    memoria,
    prescricaoTexto: liberado ? montarTexto(calculo, cfg) : undefined,
    liberado,
  };
}

// ------------------------------------------------------------------ auxiliares

/** Resolve a mistura para `glicoseG` gramas em `fracaoMl` mL. Retorna null se impossível. */
export function montarMistura(glicoseG: number, fracaoMl: number, concPct: number, soroBaixo: "sg10" | "sg5"): Mistura | null {
  const g5 = GLICOSE_G_POR_ML.sg5;
  const g10 = GLICOSE_G_POR_ML.sg10;
  const g50 = GLICOSE_G_POR_ML.sg50;
  let sg5 = 0, sg10 = 0, sg50 = 0, ad = 0;
  if (concPct > 10) {
    sg50 = (glicoseG - g10 * fracaoMl) / (g50 - g10);
    sg10 = fracaoMl - sg50;
    if (sg10 < -1e-9) return null;
  } else if (soroBaixo === "sg10") {
    sg10 = glicoseG / g10;
    ad = fracaoMl - sg10;
  } else if (concPct >= 5) {
    sg10 = (glicoseG - g5 * fracaoMl) / (g10 - g5);
    sg5 = fracaoMl - sg10;
  } else {
    sg5 = glicoseG / g5;
    ad = fracaoMl - sg5;
  }
  return {
    sg5Ml: zeroSeTiny(sg5),
    sg10Ml: zeroSeTiny(sg10),
    sg50Ml: zeroSeTiny(sg50),
    adMl: zeroSeTiny(ad),
    concNecessariaFracaoPct: concPct,
  };
}

/** Concentração de glicose (%) calculada a partir dos volumes ARREDONDADOS da receita. */
export function concentracaoReal(r: Componentes): number {
  const g = r.sg5 * GLICOSE_G_POR_ML.sg5 + r.sg10 * GLICOSE_G_POR_ML.sg10 + r.sg50 * GLICOSE_G_POR_ML.sg50;
  const total = r.sg5 + r.sg10 + r.sg50 + r.ad + r.gluconatoCa + r.mgso4 + r.nacl + r.kcl;
  return total > 0 ? (g / total) * 100 : 0;
}

function montarTexto(c: CalculoVenoclise, cfg: ConfigServico): string {
  const r = c.receitaEtapa;
  const partes: string[] = [];
  const p = (nome: string, v: number) => {
    if (v > 0) partes.push(`${nome} ${fmt(v, 2)} mL`);
  };
  p("SG 5%", r.sg5);
  p("SG 10%", r.sg10);
  p("SG 50%", r.sg50);
  p("Água destilada", r.ad);
  p("Gluconato de cálcio 10%", r.gluconatoCa);
  p(AMPOLAS_MG[cfg.mgso4].rotulo.replace("MgSO₄", "Sulfato de magnésio"), r.mgso4);
  p(AMPOLAS_NA[cfg.nacl].rotulo.replace("NaCl", "NaCl"), r.nacl);
  p(AMPOLAS_K[cfg.kcl].rotulo, r.kcl);
  const etapaTxt =
    c.etapas === 1 ? "etapa única 24 h" : `${c.etapas} etapas de ${c.horasPorEtapa} h; a composição acima vale para CADA etapa`;
  return (
    `${partes.join(" + ")} — EV em BIC a ${fmt(arredondar(c.vazaoMlH, 1), 1)} mL/h (${etapaTxt}). TIG ${fmt(c.tig)} mg/kg/min. ` +
    `Peso de cálculo ${fmt(c.pesoCalculoG, 0)} g. Glicose final ${fmt(c.concFinalRealPct, 2)}%.\n` +
    rodapeConcentracoes(cfg)
  );
}
