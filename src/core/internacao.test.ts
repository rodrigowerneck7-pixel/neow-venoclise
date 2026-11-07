import { describe, expect, it } from "vitest";
import {
  avaliarColeta,
  avaliarNivel,
  classificacaoAutomatica,
  faixaLiquor,
  INTERNACAO_INICIAL,
  labsParaVenoclise,
  LIQUOR_THOMSON,
  linhasNeutrofilos,
  NEUTROFILOS_SBP2022,
  quadroHipoSbp,
  textoInternacao,
  type ColetaExames,
  type ContextoColeta,
  type ContextoRN,
  type DadosInternacao,
} from "./internacao";
import { parseContagemBR } from "./numeros";

const RN: ContextoRN = { igSemanas: 38, igDias: 0, pesoNascimentoG: 3000, pesoAtualG: 3000, diaDeVida: 2 };
const dados = (p: Partial<DadosInternacao> = {}): DadosInternacao => ({ ...INTERNACAO_INICIAL, motivos: {}, cuidados: {}, coletas: [], ...p });
const ctx = (p: Partial<ContextoColeta> = {}): ContextoColeta => ({ ...RN, horas: 24, grupoRiscoHipo: false, ...p });
const coleta = (p: Partial<ColetaExames>): ColetaExames => ({ id: "c1", ...p });
const textos = (r: ReturnType<typeof avaliarColeta>) => r.achados.map((a) => `${a.exame}|${a.status}|${a.texto}`).join("\n");

describe("tabelas (conferidas com o PDF da SBP 2022)", () => {
  it("neutrófilos: linhas e valores", () => {
    expect(NEUTROFILOS_SBP2022.map((l) => l.h)).toEqual([0, 12, 24, 36, 48, 60, 72, 120]);
    expect(NEUTROFILOS_SBP2022[0]).toEqual({ h: 0, neutropenia: [500, 1800], neutrofilia: [6300, 5400], imaturos: 1100, it: 0.16 });
    expect(NEUTROFILOS_SBP2022[2]).toEqual({ h: 24, neutropenia: [2200, 7000], neutrofilia: [14000, 12600], imaturos: 1280, it: 0.16 });
    expect(NEUTROFILOS_SBP2022[6]).toEqual({ h: 72, neutropenia: [1100, 1800], neutrofilia: [6000, 7000], imaturos: 550, it: 0.13 });
  });
  it("líquor: 4 idades × 9 percentis, crescentes", () => {
    for (const t of [LIQUOR_THOMSON.celulas, LIQUOR_THOMSON.proteina, LIQUOR_THOMSON.glicose]) {
      expect(t).toHaveLength(4);
      for (const linha of t) {
        expect(linha).toHaveLength(9);
        for (let i = 1; i < 9; i++) expect(linha[i]).toBeGreaterThanOrEqual(linha[i - 1]);
      }
    }
    expect(LIQUOR_THOMSON.celulas[0][8]).toBe(19.1);
    expect(LIQUOR_THOMSON.proteina[0][8]).toBe(130.7);
    expect(LIQUOR_THOMSON.glicose[0][0]).toBe(34.7);
  });
});

describe("classificação automática (CID-10 / SBP)", () => {
  it("prematuridade e peso", () => {
    expect(classificacaoAutomatica({ ...RN, igSemanas: 35, igDias: 2, pesoNascimentoG: 2100 })).toEqual(["Pré-termo tardio (35s2d)", "Baixo peso ao nascer (2.100 g)"]);
    expect(classificacaoAutomatica({ ...RN, igSemanas: 27, igDias: 0, pesoNascimentoG: 900 })).toEqual(["Pré-termo extremo (27 sem)", "Extremo baixo peso ao nascer (900 g)"]);
    expect(classificacaoAutomatica({ ...RN, igSemanas: 31, igDias: 5, pesoNascimentoG: 1400 })).toEqual(["Pré-termo (31s5d)", "Muito baixo peso ao nascer (1.400 g)"]);
    expect(classificacaoAutomatica(RN)).toEqual([]);
  });
});

describe("nível de cuidado (Portaria 930/2012)", () => {
  it("ventilação mecânica e FiO2 > 30% → UTIN art. 10, I", () => {
    const r = avaliarNivel(dados({ motivos: { resp: true }, suporte: "vm", fio2: 40 }), RN);
    expect(r.sugerido).toBe("UTIN");
    expect(r.criterios.filter((c) => c.ref === "art. 10, I")).toHaveLength(2);
  });
  it("CPAP com FiO2 35% → UTIN; com 25% → aviso (a Portaria não enquadra)", () => {
    expect(avaliarNivel(dados({ motivos: { resp: true }, suporte: "cpap", fio2: 35 }), RN).sugerido).toBe("UTIN");
    const r = avaliarNivel(dados({ motivos: { resp: true }, suporte: "cpap", fio2: 25 }), RN);
    expect(r.sugerido).toBeNull();
    expect(r.avisos.join()).toMatch(/CPAP com FiO₂ ≤ 30%/);
    expect(avaliarNivel(dados({ motivos: { resp: true }, suporte: "cpap" }), RN).pendencias).toContain("FiO₂ no CPAP");
  });
  it("desconforto leve em O2 ≤ 30% ou ar ambiente → UCINCo art. 16, II; O2 sem FiO2 → pendência", () => {
    expect(avaliarNivel(dados({ motivos: { resp: true }, suporte: "o2", fio2: 28 }), RN).criterios[0]).toMatchObject({ unidade: "UCINCo", ref: "art. 16, II" });
    expect(avaliarNivel(dados({ motivos: { resp: true }, suporte: "ar" }), RN).sugerido).toBe("UCINCo");
    expect(avaliarNivel(dados({ motivos: { resp: true }, suporte: "o2" }), RN).pendencias).toContain("FiO₂ do O₂");
    expect(avaliarNivel(dados({ motivos: { resp: true } }), RN).pendencias).toContain("suporte respiratório");
  });
  it("IG ao nascer < 30 sem ou PN < 1.000 g → UTIN art. 10, II; sem IG/PN → pendência", () => {
    expect(avaliarNivel(dados(), { ...RN, igSemanas: 29, igDias: 6 }).criterios[0]).toMatchObject({ unidade: "UTIN", ref: "art. 10, II" });
    expect(avaliarNivel(dados(), { ...RN, pesoNascimentoG: 990, pesoAtualG: 990 }).sugerido).toBe("UTIN");
    expect(avaliarNivel(dados(), { ...RN, igSemanas: 30, igDias: 0 }).sugerido).toBeNull();
    expect(avaliarNivel(dados(), { ...RN, igSemanas: null, pesoNascimentoG: null }).pendencias).toEqual(["IG ao nascer (art. 10, II)", "peso de nascimento (art. 10, II)"]);
  });
  it("NPT, cirurgia e cuidados especializados → UTIN", () => {
    expect(avaliarNivel(dados({ cuidados: { npt: true } }), RN).criterios[0].ref).toBe("art. 10, IV");
    expect(avaliarNivel(dados({ cirurgia: "grande" }), RN).criterios[0].ref).toBe("art. 10, III");
    expect(avaliarNivel(dados({ cirurgia: "po_imediato" }), RN).criterios[0].ref).toBe("art. 10, III");
    const r = avaliarNivel(dados({ cuidados: { cvc: true, dva: true, transfusao: true } }), RN);
    expect(r.criterios[0]).toMatchObject({ ref: "art. 10, V", texto: "Cuidados especializados: cateter venoso central, droga vasoativa, transfusão por hemólise aguda ou coagulopatia" });
  });
  it("UCINCo art. 16, III: 1.000–1.500 g, estável, sem CVC, enteral plena", () => {
    const rn = { ...RN, igSemanas: 32, pesoNascimentoG: 1200, pesoAtualG: 1350 };
    expect(avaliarNivel(dados({ cuidados: { estavel: true, enteral_plena: true } }), rn).criterios[0]).toMatchObject({ unidade: "UCINCo", ref: "art. 16, III" });
    expect(avaliarNivel(dados({ cuidados: { estavel: true, enteral_plena: true, cvc: true } }), rn).criterios.some((c) => c.ref === "art. 16, III")).toBe(false);
    expect(avaliarNivel(dados({ cuidados: { estavel: true } }), rn).criterios).toHaveLength(0);
  });
  it("UCINCo art. 16, IV: > 1.500 g com venóclise, sonda ou ATB estável", () => {
    expect(avaliarNivel(dados({ cuidados: { venoclise: true, atb_estavel: true } }), RN).criterios[0]).toMatchObject({ ref: "art. 16, IV", texto: "Peso > 1.500 g (3.000 g) com venóclise, antibiótico com quadro estável" });
    expect(avaliarNivel(dados({ cuidados: { venoclise: true } }), { ...RN, pesoAtualG: 1450 }).criterios).toHaveLength(0);
  });
  it("UCINCo arts. 16, I, V, VI, VII", () => {
    const r = avaliarNivel(dados({ cuidados: { pos_utin: true, foto_perto_est: true, pos_est: true }, cirurgia: "medio_estavel" }), RN);
    expect(r.criterios.map((c) => c.ref)).toEqual(["art. 16, I", "art. 16, V", "art. 16, VI", "art. 16, VII"]);
    expect(r.sugerido).toBe("UCINCo");
  });
  it("UCINCa art. 21: só com todos os requisitos", () => {
    const rn = { ...RN, igSemanas: 33, pesoNascimentoG: 1300, pesoAtualG: 1400 };
    const todos = { estavel: true, enteral_plena: true, mae_canguru: true };
    const r = avaliarNivel(dados({ cuidados: todos }), rn);
    expect(r.criterios.map((c) => `${c.unidade} ${c.ref}`)).toEqual(["UCINCo art. 16, III", "UCINCa art. 21"]);
    expect(r.sugerido).toBe("UCINCo");
    expect(avaliarNivel(dados({ cuidados: todos }), { ...rn, pesoAtualG: 1600 }).sugerido).toBe("UCINCa");
    expect(avaliarNivel(dados({ cuidados: { estavel: true, enteral_plena: true } }), { ...rn, pesoAtualG: 1600 }).sugerido).toBeNull();
    expect(avaliarNivel(dados({ cuidados: todos }), { ...rn, pesoAtualG: 1250 }).criterios.some((c) => c.unidade === "UCINCa")).toBe(false);
  });
  it("UTIN tem prioridade e o aviso de peso atual aparece depois do D1", () => {
    const r = avaliarNivel(dados({ cuidados: { npt: true, venoclise: true } }), { ...RN, pesoAtualG: null, diaDeVida: 3 });
    expect(r.sugerido).toBe("UTIN");
    expect(r.avisos[0]).toMatch(/Peso atual não informado/);
    expect(avaliarNivel(dados(), { ...RN, pesoAtualG: null, diaDeVida: 1 }).avisos).toEqual([]);
  });
});

describe("neutrófilos: linhas por hora", () => {
  it("exata, entre pontos, depois de 120 h e fora", () => {
    expect(linhasNeutrofilos(24).map((l) => l.h)).toEqual([24]);
    expect(linhasNeutrofilos(0).map((l) => l.h)).toEqual([0]);
    expect(linhasNeutrofilos(30).map((l) => l.h)).toEqual([24, 36]);
    expect(linhasNeutrofilos(100).map((l) => l.h)).toEqual([72, 120]);
    expect(linhasNeutrofilos(500).map((l) => l.h)).toEqual([120]);
    expect(linhasNeutrofilos(672).map((l) => l.h)).toEqual([120]);
    expect(linhasNeutrofilos(673)).toEqual([]);
  });
});

describe("hemograma e Rodwell", () => {
  const base = coleta({ leucocitos: 4000, segmentadosPct: 50, bastoesPct: 15, plaquetas: 120_000 });
  it("calcula neutrófilos, imaturos, I/T e I/M e pontua Rodwell", () => {
    const r = avaliarColeta(base, ctx({ horas: 24, pesoNascimentoG: 2500 }));
    expect(r.pendencias).toEqual([]);
    expect(r.hemograma).toMatchObject({ neutrofilos: 2600, imaturos: 600 });
    expect(r.hemograma?.it).toBeCloseTo(0.2308, 3);
    expect(r.hemograma?.im).toBeCloseTo(0.3, 6);
    // leucometria (< 5.000) + neutropenia (< 7.000 às 24 h, PN > 1,5 kg) + I/T > 0,16 + I/M ≥ 0,3 + plaquetas ≤ 150.000
    expect(r.hemograma?.rodwell).toMatchObject({ min: 5, max: 5 });
    const t = textos(r);
    expect(t).toMatch(/Neutrófilos\|alterado\|2\.600\/mm³: neutropenia/);
    expect(t).toMatch(/Imaturos\|normal/);
    expect(t).toMatch(/Escore de Rodwell\|alterado\|5 de 7\. ≥ 3/);
    expect(t).toMatch(/Leucócitos\|alterado\|4\.000\/mm³: abaixo de 5\.000/);
    expect(r.resumo).toContain("I/T 0,23; I/M 0,3");
  });
  it("PN < 1.500 g usa a coluna de Mouzinho", () => {
    const r = avaliarColeta(base, ctx({ horas: 24, pesoNascimentoG: 1200 }));
    expect(textos(r)).toMatch(/Neutrófilos\|normal\|2\.600\/mm³: dentro da tabela/);
    expect(r.hemograma?.rodwell.min).toBe(4);
  });
  it("entre pontos da tabela fica limítrofe e o escore vira faixa", () => {
    const c = coleta({ leucocitos: 10000, segmentadosPct: 60, bastoesPct: 0, plaquetas: 250_000 });
    const r = avaliarColeta(c, ctx({ horas: 30, pesoNascimentoG: 3000 }));
    expect(textos(r)).toMatch(/Neutrófilos\|limitrofe\|6\.000\/mm³: possível neutropenia \(entre pontos da tabela\)/);
    expect(r.hemograma?.rodwell).toMatchObject({ min: 0, max: 1 });
    expect(r.hemograma?.linhas).toBe("entre as linhas de 24 h e 36 h");
  });
  it("PN de exatamente 1.500 g usa as duas colunas", () => {
    const c = coleta({ leucocitos: 10000, segmentadosPct: 50, bastoesPct: 0 });
    // 5.000 às 24 h: < 7.000 (Manroe) mas não < 2.200 (Mouzinho) → limítrofe
    expect(textos(avaliarColeta(c, ctx({ horas: 24, pesoNascimentoG: 1500 })))).toMatch(/Neutrófilos\|limitrofe.*as duas colunas/);
  });
  it("sem hora: pendência e itens sem dado", () => {
    const r = avaliarColeta(base, ctx({ horas: null }));
    expect(r.pendencias).toContain("Informe a hora da coleta para ler neutrófilos, imaturos e I/T pela tabela");
    expect(r.hemograma?.rodwell).toMatchObject({ min: 3, max: 6 });
  });
  it("travas: leucócitos em mil, plaquetas em mil, diferencial incompleto ou > 100%", () => {
    expect(avaliarColeta(coleta({ leucocitos: 12.5 }), ctx()).pendencias[0]).toBe("Leucócitos 12,5: informe em /mm³ (ex.: 12500)");
    expect(avaliarColeta(coleta({ plaquetas: 150 }), ctx()).pendencias[0]).toBe("Plaquetas 150: informe em /mm³ (ex.: 150000)");
    expect(avaliarColeta(coleta({ leucocitos: 9000, segmentadosPct: 60 }), ctx()).pendencias).toContain("Informe segmentados e bastões (%) para o diferencial");
    expect(avaliarColeta(coleta({ leucocitos: 9000, segmentadosPct: 90, bastoesPct: 20 }), ctx()).pendencias[0]).toMatch(/passou de 100%/);
    expect(avaliarColeta(coleta({ segmentadosPct: 60, bastoesPct: 5 }), ctx()).pendencias).toContain("Informe os leucócitos totais para calcular neutrófilos e imaturos");
  });
  it("metamielócitos e mielócitos entram nos imaturos", () => {
    const r = avaliarColeta(coleta({ leucocitos: 10000, segmentadosPct: 50, bastoesPct: 10, metamielocitosPct: 5, mielocitosPct: 5 }), ctx({ horas: 72 }));
    expect(r.hemograma).toMatchObject({ neutrofilos: 7000, imaturos: 2000 });
    expect(textos(r)).toMatch(/I\/T\|alterado\|0,29: aumentada/);
  });
});

describe("PCR (SBP 2022: > 1 mg/dL)", () => {
  it("exige unidade, converte mg/L e lê o corte", () => {
    expect(avaliarColeta(coleta({ pcr: 12 }), ctx()).pendencias).toEqual(["Informe a unidade da PCR (mg/dL ou mg/L)"]);
    const r = avaliarColeta(coleta({ pcr: 24, pcrUnidade: "mg/L" }), ctx());
    expect(r.pcrMgDl).toBeCloseTo(2.4);
    expect(textos(r)).toMatch(/PCR\|alterado\|2,4 mg\/dL: acima de 1 mg\/dL/);
    expect(textos(avaliarColeta(coleta({ pcr: 0.6, pcrUnidade: "mg/dL" }), ctx()))).toMatch(/PCR\|normal/);
    expect(avaliarColeta(coleta({ pcr: 48, pcrUnidade: "mg/dL" }), ctx()).pendencias[0]).toMatch(/confira se não é mg\/L/);
  });
});

describe("glicemia", () => {
  it("< 45 é hipoglicemia (MS 2014) e capilar pede confirmação", () => {
    const r = avaliarColeta(coleta({ glicemia: 40, glicemiaTipo: "capilar" }), ctx({ horas: 30 }));
    expect(textos(r)).toMatch(/Glicemia\|alterado\|40 mg\/dL: hipoglicemia/);
    expect(textos(r)).toMatch(/confirmada pela plasmática/);
    expect(textos(avaliarColeta(coleta({ glicemia: 200 }), ctx()))).toMatch(/acima de 175/);
  });
  it("Quadro 2 da SBP nas primeiras 24 h, só no grupo de risco ou sintomático", () => {
    expect(quadroHipoSbp(20, 2, false)?.texto).toMatch(/primeiras 4 h, < 25 mg\/dL: repetir a dieta/);
    expect(quadroHipoSbp(30, 10, false)?.texto).toMatch(/4 a 24 h, < 35 mg\/dL/);
    expect(quadroHipoSbp(40, 10, false)?.status).toBe("limitrofe");
    expect(quadroHipoSbp(46, 10, false)?.status).toBe("normal");
    expect(quadroHipoSbp(35, 30, true)).toBeNull();
    expect(quadroHipoSbp(35, 10, true)?.texto).toBe("Sintomático com glicemia < 40 mg/dL: glicose EV.");
    expect(textos(avaliarColeta(coleta({ glicemia: 30 }), ctx({ horas: 10, grupoRiscoHipo: false })))).not.toMatch(/Quadro|4 a 24 h/);
    expect(avaliarColeta(coleta({ glicemia: 30 }), ctx({ horas: 10, grupoRiscoHipo: true })).achados.some((a) => a.fonte?.includes("Quadro 2"))).toBe(true);
  });
});

describe("eletrólitos (mesmos limites da venóclise)", () => {
  it("Na, K, Ca e Mg", () => {
    expect(textos(avaliarColeta(coleta({ na: 130 }), ctx()))).toMatch(/Sódio\|alterado\|130 mmol\/L: abaixo do alvo 135–145/);
    expect(textos(avaliarColeta(coleta({ k: 5.7 }), ctx()))).toMatch(/Potássio\|limitrofe/);
    expect(textos(avaliarColeta(coleta({ k: 6.2 }), ctx()))).toMatch(/Potássio\|alterado\|6,2 mmol\/L: hipercalemia/);
    expect(textos(avaliarColeta(coleta({ k: 3.2 }), ctx()))).toMatch(/hipocalemia/);
    expect(textos(avaliarColeta(coleta({ caTotal: 7.5 }), ctx({ pesoNascimentoG: 1200 })))).toMatch(/Cálcio\|normal/);
    expect(textos(avaliarColeta(coleta({ caTotal: 7.5 }), ctx({ pesoNascimentoG: 2000 })))).toMatch(/Cálcio\|alterado\|.*hipocalcemia/);
    expect(textos(avaliarColeta(coleta({ caIonico: 0.95 }), ctx({ pesoNascimentoG: 1200 })))).toMatch(/Cálcio\|alterado/);
    expect(textos(avaliarColeta(coleta({ mg: 1.1 }), ctx()))).toMatch(/hipomagnesemia grave/);
    expect(avaliarColeta(coleta({ na: 13.5 }), ctx()).pendencias[0]).toBe("Na 13,5: confira o valor");
  });
});

describe("líquor (SBP 2022 / Thomson 2018)", () => {
  it("faixas de idade", () => {
    expect(faixaLiquor(0)?.i).toBe(0);
    expect(faixaLiquor(7)?.i).toBe(0);
    expect(faixaLiquor(8)?.i).toBe(1);
    expect(faixaLiquor(28)?.i).toBe(3);
    expect(faixaLiquor(29)).toBeNull();
  });
  it("descreve o percentil", () => {
    const r = avaliarColeta(coleta({ lcrCelulas: 25, lcrProteina: 90, lcrGlicose: 30 }), ctx({ horas: 72 }));
    const t = textos(r);
    expect(t).toMatch(/células\|alterado\|25 \/mm³: acima do P95 \(19,1\) para 0–7 dias/);
    expect(t).toMatch(/proteína\|normal\|90 mg\/dL: entre P50 \(78,4\) e P75 \(96\)/);
    expect(t).toMatch(/glicose\|alterado\|30 mg\/dL: abaixo do P5 \(34,7\)/);
    expect(textos(avaliarColeta(coleta({ lcrCelulas: 10 }), ctx({ horas: 40 * 24 })))).toMatch(/fora da tabela/);
  });
});

describe("texto e integração", () => {
  it("monta motivos, cuidados, critérios e exames", () => {
    const d = dados({
      motivos: { resp: true, risco_infeccioso: true },
      suporte: "cpap",
      fio2: 35,
      hipoteses: { ttrn: true },
      fatoresSepse: { bolsa18: true },
      cuidados: { venoclise: true },
      outroMotivo: "Mãe HIV+",
    });
    const rn = { ...RN, igSemanas: 35, igDias: 2, pesoNascimentoG: 2100, pesoAtualG: 2050 };
    const nivel = avaliarNivel(d, rn);
    const c = coleta({ pcr: 2.4, pcrUnidade: "mg/dL", hemocultura: "aguardando" });
    const t = textoInternacao(d, rn, nivel, [{ coleta: c, r: avaliarColeta(c, ctx({ ...rn, horas: 30 })), quando: "07/11 08:00" }]);
    expect(t).toContain("Motivos de internação: Pré-termo tardio (35s2d); Baixo peso ao nascer (2.100 g); Desconforto respiratório em CPAP, FiO₂ 35% (hipótese: taquipneia transitória); Risco infeccioso: bolsa rota ≥ 18 h; Mãe HIV+.");
    expect(t).toContain("Cuidados: venóclise (hidratação venosa).");
    expect(t).toContain("Critérios da Portaria 930/2012: UTIN — art. 10, I: insuficiência respiratória com FiO₂ 35%, acima de 30% | UCINCo — art. 16, IV: peso");
    expect(t).toContain("07/11 08:00 (30 h de vida): PCR 2,4 mg/dL; hemocultura aguardando.");
  });
  it("leva só valores plausíveis para a venóclise", () => {
    expect(labsParaVenoclise(coleta({ glicemia: 40, na: 132, k: 50, mg: 1.8 }))).toEqual({ glicemia: 40, na: 132, mg: 1.8 });
  });
});

describe("contagens com ponto de milhar", () => {
  it("12.500 = 12500; 250.000 = 250000; 12,5 e 12.5 ficam 12,5", () => {
    expect(parseContagemBR("12.500")).toBe(12500);
    expect(parseContagemBR("250.000")).toBe(250000);
    expect(parseContagemBR("1.250.000")).toBe(1250000);
    expect(parseContagemBR("12500")).toBe(12500);
    expect(parseContagemBR("12,5")).toBe(12.5);
    expect(parseContagemBR("12.5")).toBe(12.5);
    expect(parseContagemBR("")).toBeNull();
  });
});
