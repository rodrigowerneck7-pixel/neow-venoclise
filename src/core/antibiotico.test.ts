import { describe, expect, it } from "vitest";
import {
  acharLinha,
  ATB_INICIAL,
  calcularDose,
  cronograma,
  decidirInicio,
  fmtDataHora,
  pmaSemanas,
  reavaliar,
  resumoDose,
  textoAntibiotico,
  type ContextoAtb,
  type DadosAntibiotico,
} from "./antibiotico";
import { ANTIMICROBIANOS, type DrogaId } from "./dados/antimicrobianos";

const ctx = (p: Partial<ContextoAtb> = {}): ContextoAtb => ({ igSemanas: 38, igDias: 0, pesoG: 3000, pesoOrigem: "atual", pnaDias: 2, creatinina: null, ...p });
/** "15/q48", "17.5-18/q24", "fora", "falta". */
function linha(id: DrogaId, tabela: string, p: Partial<ContextoAtb>): string {
  const r = calcularDose(id, tabela, ctx(p));
  if (!r.spec) return r.pendencias[0]?.startsWith("Informe") ? "falta" : "fora";
  const k = Array.isArray(r.spec.porKg) ? r.spec.porKg.join("-") : String(r.spec.porKg);
  const h = Array.isArray(r.spec.cadaH) ? r.spec.cadaH.join("-") : String(r.spec.cadaH ?? r.spec.freqTexto);
  return `${k}/q${h}`;
}

describe("integridade das tabelas", () => {
  it("nenhuma tabela tem duas linhas valendo ao mesmo tempo", () => {
    const pesos = [500, 999, 1000, 1500, 2000, 2001, 4000];
    const crs = [0.3, 0.49, 0.5, 0.7, 0.75, 0.8, 0.9, 1, 1.05, 1.1, 1.2, 1.3, 1.4, 1.45, 1.6, 1.7, 2];
    for (const dr of ANTIMICROBIANOS) {
      for (const t of dr.tabelas) {
        for (let ig = 22; ig <= 42; ig += 1) {
          for (let pna = 0; pna <= 61; pna += 1) {
            for (const peso of pesos) {
              for (const cr of crs) {
                const c = ctx({ igSemanas: ig, pnaDias: pna, pesoG: peso, creatinina: cr });
                const n = t.linhas.filter((l) => acharLinha({ ...t, linhas: [l] }, c).linha).length;
                if (n > 1) throw new Error(`${dr.id}/${t.id}: ${n} linhas para IG ${ig}, PNA ${pna}, ${peso} g, Cr ${cr}`);
              }
            }
          }
        }
      }
    }
  });
  it("20 drogas, todas com tabela e página", () => {
    expect(ANTIMICROBIANOS).toHaveLength(20);
    for (const d of ANTIMICROBIANOS) {
      expect(d.tabelas.length).toBeGreaterThan(0);
      expect(d.pagina).toBeTruthy();
    }
  });
  it("PMA = IG + dias de vida, em semanas completas", () => {
    expect(pmaSemanas({ igSemanas: 34, igDias: 5, pnaDias: 3 })).toBe(35);
    expect(pmaSemanas({ igSemanas: 34, igDias: 5, pnaDias: 1 })).toBe(34);
    expect(pmaSemanas({ igSemanas: 34, igDias: null, pnaDias: null })).toBeNull();
  });
});

describe("linhas conferidas com o PDF", () => {
  it("amicacina (p. 1)", () => {
    expect(linha("amicacina", "idade", { igSemanas: 28, pnaDias: 14 })).toBe("15/q48");
    expect(linha("amicacina", "idade", { igSemanas: 28, pnaDias: 15 })).toBe("15/q36");
    expect(linha("amicacina", "idade", { igSemanas: 30, pnaDias: 10 })).toBe("15/q36");
    expect(linha("amicacina", "idade", { igSemanas: 34, pnaDias: 11 })).toBe("15/q24");
    expect(linha("amicacina", "idade", { igSemanas: 35, pnaDias: 7 })).toBe("15/q24");
    expect(linha("amicacina", "idade", { igSemanas: 39, pnaDias: 8 })).toBe("17.5-18/q24");
    expect(linha("amicacina", "idade", { igSemanas: 39, pnaDias: 61 })).toBe("fora");
  });
  it("gentamicina (p. 7)", () => {
    expect(linha("gentamicina", "idade", { igSemanas: 29, pnaDias: 14 })).toBe("5/q48");
    expect(linha("gentamicina", "idade", { igSemanas: 29, pnaDias: 15 })).toBe("5/q36");
    expect(linha("gentamicina", "idade", { igSemanas: 34, pnaDias: 10 })).toBe("5/q36");
    expect(linha("gentamicina", "idade", { igSemanas: 30, pnaDias: 11 })).toBe("5/q24");
    expect(linha("gentamicina", "idade", { igSemanas: 35, pnaDias: 7 })).toBe("4/q24");
    expect(linha("gentamicina", "idade", { igSemanas: 40, pnaDias: 8 })).toBe("5/q24");
  });
  it("ampicilina (p. 2–3)", () => {
    expect(linha("ampicilina", "ig", { igSemanas: 34, pnaDias: 7 })).toBe("50/q12");
    expect(linha("ampicilina", "ig", { igSemanas: 34, pnaDias: 8 })).toBe("75/q12");
    expect(linha("ampicilina", "ig", { igSemanas: 35, pnaDias: 0 })).toBe("50/q8");
    expect(linha("ampicilina", "ig", { igSemanas: 35, pnaDias: 29 })).toBe("fora");
    expect(linha("ampicilina", "peso", { pesoG: 2000, pnaDias: 8 })).toBe("75/q12");
    expect(linha("ampicilina", "peso", { pesoG: 1800, pnaDias: 29 })).toBe("50/q6");
    expect(linha("ampicilina", "peso", { pesoG: 2500, pnaDias: 28 })).toBe("50/q8");
    expect(linha("ampicilina", "meningite_egb", { igSemanas: 36, pnaDias: 3 })).toBe("100/q8");
    expect(linha("ampicilina", "meningite_egb", { igSemanas: 30, pnaDias: 8 })).toBe("75/q6");
  });
  it("cefepima e ciprofloxacino (p. 5)", () => {
    expect(linha("cefepima", "pna", { pnaDias: 29 })).toBe("30-50/q12");
    expect(linha("cefepima", "pna", { pnaDias: 30 })).toBe("50/q8");
    expect(linha("cefepima", "peso", { pesoG: 1800, pnaDias: 20 })).toBe("30/q12");
    expect(linha("cefepima", "peso", { pesoG: 2500, pnaDias: 20 })).toBe("50/q12");
    expect(linha("cefepima", "peso", { pesoG: 2500, pnaDias: 29 })).toBe("50/q8");
    expect(linha("ciprofloxacino", "pma", { igSemanas: 30, pnaDias: 14 })).toBe("7.5-10/q12");
    expect(linha("ciprofloxacino", "pma", { igSemanas: 34, pnaDias: 0 })).toBe("10-15/q12");
  });
  it("clindamicina (p. 6)", () => {
    expect(linha("clindamicina", "pma", { igSemanas: 32, igDias: 3, pnaDias: 0 })).toBe("5/q8");
    expect(linha("clindamicina", "pma", { igSemanas: 32, igDias: 0, pnaDias: 7 })).toBe("7/q8");
    expect(linha("clindamicina", "pma", { igSemanas: 40, pnaDias: 0 })).toBe("7/q8");
    expect(linha("clindamicina", "pma", { igSemanas: 40, pnaDias: 7 })).toBe("9/q8");
    expect(linha("clindamicina", "peso", { pesoG: 1500, pnaDias: 29 })).toBe("10/q8");
    expect(linha("clindamicina", "peso", { pesoG: 2500, pnaDias: 8 })).toBe("9/q8");
  });
  it("linezolida e meropenem (p. 9–10)", () => {
    expect(linha("linezolida", "idade", { igSemanas: 33, pnaDias: 7 })).toBe("10/q12");
    expect(linha("linezolida", "idade", { igSemanas: 33, pnaDias: 8 })).toBe("10/q8");
    expect(linha("linezolida", "idade", { igSemanas: 34, pnaDias: 0 })).toBe("10/q8");
    expect(linha("meropenem", "ig", { igSemanas: 31, pnaDias: 13 })).toBe("20/q12");
    expect(linha("meropenem", "ig", { igSemanas: 31, pnaDias: 14 })).toBe("20/q8");
    expect(linha("meropenem", "ig", { igSemanas: 32, pnaDias: 13 })).toBe("20/q8");
    expect(linha("meropenem", "ig", { igSemanas: 32, pnaDias: 14 })).toBe("30/q8");
    expect(linha("meropenem", "peso", { pesoG: 1500, pnaDias: 15 })).toBe("20/q8");
    expect(linha("meropenem", "peso", { pesoG: 1500, pnaDias: 29 })).toBe("30/q8");
    expect(linha("meropenem", "peso", { pesoG: 2500, pnaDias: 15 })).toBe("30/q8");
    expect(linha("meropenem", "cim", { pesoG: 1500, pnaDias: 14 })).toBe("40/q12");
    expect(linha("meropenem", "cim", { pesoG: 2500, pnaDias: 60 })).toBe("40/q8");
  });
  it("oxacilina (p. 13–14)", () => {
    expect(linha("oxacilina", "ig", { igSemanas: 34, pnaDias: 7 })).toBe("25/q12");
    expect(linha("oxacilina", "ig", { igSemanas: 35, pnaDias: 8 })).toBe("25/q6");
    expect(linha("oxacilina", "peso", { pesoG: 900, pnaDias: 14 })).toBe("25/q12");
    expect(linha("oxacilina", "peso", { pesoG: 900, pnaDias: 15 })).toBe("25/q8");
    expect(linha("oxacilina", "peso", { pesoG: 1000, pnaDias: 7 })).toBe("25/q12");
    expect(linha("oxacilina", "peso", { pesoG: 2000, pnaDias: 30 })).toBe("37.5/q6");
    expect(linha("oxacilina", "meningite", { pesoG: 2500, pnaDias: 3 })).toBe("50/q8");
    expect(linha("oxacilina", "meningite", { pesoG: 800, pnaDias: 40 })).toBe("75/q6");
  });
  it("penicilina cristalina e piperacilina-tazobactam (p. 15–16)", () => {
    expect(linha("penicilina_cristalina", "idade", { igSemanas: 30, pnaDias: 3 })).toBe("50000/q12");
    expect(linha("penicilina_cristalina", "idade", { igSemanas: 38, pnaDias: 10 })).toBe("50000/q8");
    expect(linha("piperacilina_tazobactam", "pma", { igSemanas: 30, pnaDias: 0 })).toBe("100/q8");
    expect(linha("piperacilina_tazobactam", "pma", { igSemanas: 30, pnaDias: 7 })).toBe("80/q6");
    expect(linha("piperacilina_tazobactam", "peso", { pesoG: 1500, igSemanas: 28, pnaDias: 10 })).toBe("100/q8");
    expect(linha("piperacilina_tazobactam", "peso", { pesoG: 1500, igSemanas: 30, pnaDias: 10 })).toBe("80/q6");
    expect(linha("piperacilina_tazobactam", "peso", { pesoG: 3000, pnaDias: 3 })).toBe("80/q6");
  });
  it("vancomicina (p. 18–19)", () => {
    expect(linha("vancomicina", "padrao", { igSemanas: 27, pnaDias: 7 })).toBe("15/q24");
    expect(linha("vancomicina", "padrao", { igSemanas: 28, pnaDias: 7 })).toBe("15/q12");
    expect(linha("vancomicina", "padrao", { igSemanas: 35, pnaDias: 0 })).toBe("15/q12");
    expect(linha("vancomicina", "padrao", { igSemanas: 35, pnaDias: 7 })).toBe("15/q8");
    expect(linha("vancomicina", "otimizado", { igSemanas: 27, pnaDias: 3 })).toBe("15/q12");
    expect(linha("vancomicina", "creatinina", { igSemanas: 27, creatinina: 0.6 })).toBe("20/q24");
    expect(linha("vancomicina", "creatinina", { igSemanas: 27, creatinina: 1.5 })).toBe("15/q48");
    expect(linha("vancomicina", "creatinina", { igSemanas: 30, creatinina: 0.8 })).toBe("20/q24");
    expect(linha("vancomicina", "creatinina", { igSemanas: 30, creatinina: 1.3 })).toBe("10/q24");
    expect(linha("vancomicina", "creatinina", { igSemanas: 30, creatinina: 0.95 })).toBe("fora");
    expect(linha("vancomicina", "creatinina", { igSemanas: 30 })).toBe("falta");
  });
});

describe("cálculo da dose", () => {
  it("dose fixa vira prescrição", () => {
    expect(calcularDose("ampicilina", "ig", ctx({ pesoG: 3000, pnaDias: 1 })).prescricao).toBe("Ampicilina 150 mg IV de 8/8 h (50 mg/kg/dose)");
    expect(calcularDose("gentamicina", "idade", ctx({ pesoG: 3200, pnaDias: 1 })).prescricao).toBe("Gentamicina 12,8 mg IV de 24/24 h (4 mg/kg/dose)");
    expect(calcularDose("penicilina_cristalina", "idade", ctx({ igSemanas: 30, pesoG: 1500, pnaDias: 3 })).prescricao).toBe("Penicilina G cristalina 75.000 UI IV de 12/12 h (50.000 UI/kg/dose)");
    expect(calcularDose("gentamicina", "idade", ctx({ pesoG: 850, igSemanas: 26, pnaDias: 2 })).prescricao).toBe("Gentamicina 4,25 mg IV de 48/48 h (5 mg/kg/dose)");
  });
  it("faixa exige escolha do médico, dentro da faixa", () => {
    const r = calcularDose("cefepima", "pna", ctx({ pnaDias: 10 }));
    expect(r.pendencias[0]).toBe("Escolha a dose entre 30 e 50 mg/kg/dose");
    expect(r.prescricao).toBeUndefined();
    expect(resumoDose(r)).toBe("90–150 mg de 12/12 h");
    expect(calcularDose("cefepima", "pna", ctx({ pnaDias: 10 }), { porKg: 60 }).pendencias[0]).toMatch(/fora da faixa/);
    expect(calcularDose("cefepima", "pna", ctx({ pnaDias: 10 }), { porKg: 30 }).prescricao).toBe("Cefepima 90 mg IV de 12/12 h (30 mg/kg/dose)");
  });
  it("dose por dia dividida no intervalo", () => {
    const r = calcularDose("metronidazol", "iv", ctx(), { porKg: 30, cadaH: 8 });
    expect(r.porDia).toBe(90);
    expect(r.porTomada).toBe(30);
    expect(r.prescricao).toBe("Metronidazol 30 mg IV de 8/8 h (30 mg/kg/dia)");
    expect(calcularDose("metronidazol", "iv", ctx(), { porKg: 30 }).pendencias).toContain("Escolha o intervalo entre 6 e 8 h");
    expect(calcularDose("metronidazol", "vo", ctx(), { porKg: 30 }).prescricao).toBe("Metronidazol 30 mg VO de 8/8 h (30 mg/kg/dia)");
    expect(calcularDose("polimixina_b", "iv", ctx({ pesoG: 2000 }), { porKg: 25000 }).prescricao).toBe("Polimixina B 25.000 UI IV de 12/12 h (25.000 UI/kg/dia)");
  });
  it("ataque e manutenção", () => {
    expect(calcularDose("fluconazol", "tratamento", ctx({ pesoG: 2000 })).prescricao).toBe("Fluconazol ataque 50 mg (25 mg/kg) no dia 1; depois 24 mg IV de 24/24 h (12 mg/kg/dose)");
    expect(calcularDose("teicoplanina", "geral", ctx()).prescricao).toBe("Teicoplanina ataque 48 mg (16 mg/kg) no dia 1; depois 24 mg IV de 24/24 h (8 mg/kg/dose)");
    expect(calcularDose("vancomicina", "otimizado", ctx({ pnaDias: 7 })).prescricao).toBe("Vancomicina ataque 75 mg (25 mg/kg) uma vez; depois 45 mg IV de 8/8 h (15 mg/kg/dose)");
    const t = calcularDose("tigeciclina", "geral", ctx(), { porKg: 2 });
    expect(t.pendencias).toContain("Escolha a dose de ataque entre 1,5 e 2 mg/kg");
    expect(calcularDose("tigeciclina", "geral", ctx({ pesoG: 26000 }), { porKg: 2, ataquePorKg: 2 }).alertas.join()).toMatch(/dose máxima de 50/);
    expect(calcularDose("fluconazol", "profilaxia", ctx({ pesoG: 2000 }), { porKg: 6 }).prescricao).toBe("Fluconazol 12 mg IV 2 vezes por semana (6 mg/kg/dose)");
  });
  it("pendências: peso, eixos, fora da tabela", () => {
    expect(calcularDose("ampicilina", "ig", ctx({ pesoG: null })).pendencias).toEqual(["Informe o peso"]);
    expect(calcularDose("ampicilina", "ig", ctx({ pnaDias: null })).pendencias).toEqual(["Informe os dias de vida"]);
    expect(calcularDose("gentamicina", "idade", ctx({ igSemanas: null })).pendencias[0]).toBe("Informe a IG ao nascer");
    expect(calcularDose("ampicilina", "ig", ctx({ pnaDias: 40 })).pendencias[0]).toMatch(/Fora das linhas/);
  });
  it("lembrete renal fica forte com diurese < 1 mL/kg/h", () => {
    expect(calcularDose("gentamicina", "idade", ctx({ diureseMlKgH: 0.8 })).alertas[0]).toMatch(/Diurese 0,8 mL\/kg\/h/);
    expect(calcularDose("gentamicina", "idade", ctx({ diureseMlKgH: 2 })).alertas).toEqual([]);
  });
  it("avisa quando a linha muda com os dias", () => {
    expect(calcularDose("ampicilina", "ig", ctx({ igSemanas: 34, pnaDias: 3 })).mudaComPna).toBe(8);
    expect(calcularDose("meropenem", "ig", ctx({ igSemanas: 31, pnaDias: 3 })).mudaComPna).toBe(14);
    expect(calcularDose("vancomicina", "padrao", ctx()).mudaComPna).toBeUndefined();
  });
  it("alertas de uso restrito", () => {
    expect(calcularDose("ciprofloxacino", "pma", ctx(), { porKg: 10 }).alertas[0]).toMatch(/Não é primeira linha/);
    expect(calcularDose("ampicilina", "ig", ctx({ pesoOrigem: "nascimento" })).notas.join()).toMatch(/peso de nascimento/);
  });
});

describe("iniciar ou não — sepse precoce (SBP 2022)", () => {
  const dec = (ig: number, p: Partial<DadosAntibiotico>, horas: number | null = 6) => decidirInicio({ igSemanas: ig, horasDeVida: horas, d: { ...ATB_INICIAL, ...p } });
  it("≥ 35 semanas", () => {
    expect(decidirInicio({ igSemanas: null, horasDeVida: 2, d: ATB_INICIAL }).pendencias).toEqual(["Informe a IG na ficha"]);
    expect(dec(38, {}).pendencias).toEqual(["Há sinais clínicos de doença?"]);
    const s = dec(38, { sinais: "sim" });
    expect([s.categoria?.id, s.seriada?.id]).toEqual(["hc_atb", "hc_atb"]);
    expect(dec(38, { sinais: "sim", soRespLeve: true }).categoria?.id).toBe("monitorar_resp");
    const t = dec(38, { sinais: "nao", tempMaterna38: "sim" });
    expect([t.categoria?.id, t.seriada?.id]).toEqual(["hc_atb", "observacao"]);
    const a = dec(38, { sinais: "nao", tempMaterna38: "nao", apiIndicada: "nao" });
    expect([a.categoria?.id, a.seriada?.id]).toEqual(["rotina", "rotina"]);
    const b = dec(38, { sinais: "nao", tempMaterna38: "nao", apiIndicada: "sim", apiAdequada: "nao" });
    expect([b.categoria?.id, b.seriada?.id]).toEqual(["observacao", "observacao"]);
    const c = dec(38, { sinais: "nao", tempMaterna38: "nao", apiIndicada: "sim", apiAdequada: "sim" });
    expect([c.categoria?.id, c.seriada?.id]).toEqual(["rotina", "rotina"]);
    const e = dec(38, { sinais: "nao", tempMaterna38: "nao", apiIndicada: "sim" });
    expect(e.pendencias[0]).toMatch(/A API foi adequada/);
    expect(e.seriada).toBeUndefined();
    expect(dec(38, { sinais: "nao" }, 80).foraDaJanela).toBe(true);
  });
  it("≤ 34 semanas", () => {
    expect(dec(32, {}).pendencias[0]).toMatch(/Trabalho de parto prematuro/);
    expect(dec(32, { ptAltoRisco: "sim" }).pt?.id).toBe("hc_atb");
    expect(dec(34, { ptAltoRisco: "nao", ptInduzido: "sim", ptAchado: "sim" }).pt?.id).toBe("hc_atb");
    expect(dec(34, { ptAltoRisco: "nao", ptInduzido: "sim", ptAchado: "nao" }).pt?.id).toBe("sem_atb_opcoes");
    expect(dec(30, { ptAltoRisco: "nao", ptInduzido: "nao", ptCesarea: "sim" }).pt?.id).toBe("sem_atb_opcoes");
    expect(dec(30, { ptAltoRisco: "nao", ptInduzido: "nao", ptCesarea: "nao" }).pt?.id).toBe("fora");
  });
});

describe("reavaliação 36–48 h (SBP 2022, Figura 1)", () => {
  it("as três saídas e o que fica fora", () => {
    expect(reavaliar({}).pendencias).toEqual(["Como estão as culturas?"]);
    expect(reavaliar({ culturas: "aguardando" }).conduta).toBeUndefined();
    expect(reavaliar({ culturas: "positivas" }).conduta?.id).toBe("completar");
    expect(reavaliar({ culturas: "negativas", rnBem: "sim", triagem: "negativa" }).conduta?.id).toBe("suspender");
    expect(reavaliar({ culturas: "negativas", rnBem: "nao", triagem: "alterada" }).conduta?.id).toBe("sepse_clinica");
    expect(reavaliar({ culturas: "negativas", rnBem: "sim", triagem: "alterada" }).conduta?.id).toBe("fora");
    expect(reavaliar({ culturas: "negativas" }).pendencias).toEqual(["O RN está bem?", "A triagem (hemograma/PCR) está normal ou alterada?"]);
  });
});

describe("cronograma e texto", () => {
  const inicio = new Date(2026, 10, 7, 8, 0);
  it("dia do tratamento, janela de reavaliação e fim previsto", () => {
    const c = cronograma(inicio, new Date(2026, 10, 8, 14, 0), "ipcs_agente");
    expect(c.dia).toBe(2);
    expect(fmtDataHora(c.reavaliarDe)).toBe("08/11 20:00");
    expect(fmtDataHora(c.reavaliarAte)).toBe("09/11 08:00");
    expect(fmtDataHora(c.duracao!.fimMin)).toBe("14/11 08:00");
    expect(fmtDataHora(c.duracao!.fimMax)).toBe("17/11 08:00");
  });
  it("monta o texto da prescrição", () => {
    const doses = [calcularDose("ampicilina", "ig", ctx({ pnaDias: 1 })), calcularDose("gentamicina", "idade", ctx({ pnaDias: 1 }))];
    const t = textoAntibiotico({ inicio, agora: new Date(2026, 10, 8, 9, 0), doses, duracao: "sepse_clinica", historico: [{ inicio: null, fim: "x", texto: "Penicilina + amicacina", motivo: "falta no estoque" }] });
    expect(t).toBe(
      [
        "Antibiótico (início 07/11 08:00 — D2):",
        "- Ampicilina 150 mg IV de 8/8 h (50 mg/kg/dose)",
        "- Gentamicina 12 mg IV de 24/24 h (4 mg/kg/dose)",
        "Reavaliar entre 08/11 20:00 e 09/11 08:00 (36–48 h).",
        "Duração prevista: 5 a 7 dias (sepse clínica) — até 12/11 08:00–14/11 08:00.",
        "Esquemas anteriores:",
        "- Penicilina + amicacina — troca: falta no estoque",
      ].join("\n"),
    );
  });
});
