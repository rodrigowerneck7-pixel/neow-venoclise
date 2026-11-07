import { describe, expect, it } from "vitest";
import { avaliarDieta, textoDieta, type ContextoDieta, type DadosDieta } from "./dieta";

const PT: ContextoDieta = { pesoG: 1200, pesoNascimentoG: 1200, igSemanas: 30, igDias: 0, pnaDias: 3, volumeTotalMlKgDia: null, outrasInfusoesMlDia: null };
const prog = (p: Partial<DadosDieta> = {}): DadosDieta => ({ modo: "programada", leite: "lm", via: "sog", intervaloH: 3, volumeMlKgDia: 20, ...p });
const notas = (r: ReturnType<typeof avaliarDieta>) => r.notas.map((n) => n.texto).join(" | ");

describe("modo", () => {
  it("pede o modo; dieta zero", () => {
    expect(avaliarDieta({}, PT).pendencias).toEqual(["Escolha: livre demanda, dieta programada ou dieta zero"]);
    const z = avaliarDieta({ modo: "zero" }, PT);
    expect(z.prescricao).toBe("Dieta zero.");
    expect(notas(z)).toMatch(/começar pequenos volumes de dieta o quanto antes/);
    expect(avaliarDieta({ modo: "zero" }, { ...PT, pesoNascimentoG: 3000 }).notas).toEqual([]);
  });
  it("livre demanda (MS)", () => {
    const termo = { ...PT, pesoG: 3200, pesoNascimentoG: 3200, igSemanas: 39 };
    const r = avaliarDieta({ modo: "livre_demanda", leite: "lm" }, termo);
    expect(r.prescricao).toBe("Seio materno em livre demanda.");
    expect(r.notas.some((n) => n.texto === "Amamentar sempre que a criança pedir (em livre demanda)." && n.fonte.includes("Guia Alimentar"))).toBe(true);
    expect(avaliarDieta({ modo: "livre_demanda", leite: "lm", complemento: "formula_termo" }, termo).prescricao).toBe(
      "Seio materno em livre demanda. Complementar com fórmula infantil de partida se faltar leite materno.",
    );
    expect(avaliarDieta({ modo: "livre_demanda", leite: "formula_termo" }, termo).alertas[0]).toMatch(/livre demanda do MS é para a amamentação/);
    expect(avaliarDieta({ modo: "livre_demanda", leite: "lm" }, PT).alertas[0]).toMatch(/IG pós-menstrual 30 sem/);
  });
});

describe("dieta programada", () => {
  it("volume por mamada e prescrição", () => {
    const r = avaliarDieta(prog(), PT);
    expect(r.pendencias).toEqual([]);
    expect([r.mlDia, r.mamadasDia, r.mlPorMamada]).toEqual([24, 8, 3]);
    expect(r.prescricao).toBe("Leite materno ordenhado (LMO) 3 mL de 3/3 h por SOG (20 mL/kg/dia).");
    expect(notas(r)).toMatch(/Dieta mínima: 12–24 mL\/kg\/dia/);
  });
  it("pendências", () => {
    expect(avaliarDieta({ modo: "programada" }, { ...PT, pesoG: null }).pendencias).toEqual([
      "Escolha o leite",
      "Escolha a via",
      "Escolha o intervalo",
      "Informe o volume de hoje (mL/kg/dia)",
      "Informe o peso na ficha",
    ]);
    expect(avaliarDieta(prog({ leite: "outra" }), PT).pendencias).toContain("Escreva qual leite");
    expect(avaliarDieta(prog({ incrementoMlKgDia: 20 }), PT).pendencias).toContain("Informe a meta (mL/kg/dia) para o plano de aumento");
  });
  it("faixas da ESPGHAN (PN < 1.800 g)", () => {
    expect(avaliarDieta(prog({ incrementoMlKgDia: 35, metaMlKgDia: 160 }), PT).alertas[0]).toMatch(/recomenda 18–30/);
    expect(avaliarDieta(prog({ incrementoMlKgDia: 20, metaMlKgDia: 210 }), PT).alertas[0]).toMatch(/Meta de 210/);
    expect(notas(avaliarDieta(prog({ incrementoMlKgDia: 20, metaMlKgDia: 140 }), PT))).toMatch(/A maioria dos prematuros estáveis precisa de 150–180/);
    expect(avaliarDieta(prog({ volumeMlKgDia: 120 }), PT).alertas[0]).toMatch(/acima de 100 mL\/kg\/dia sem aditivo/);
    expect(notas(avaliarDieta(prog({ volumeMlKgDia: 60 }), PT))).toMatch(/iniciar o aditivo multicomponente/);
    expect(avaliarDieta(prog({ leite: "formula_pt", aditivo: true }), PT).alertas).toContain("Aditivo é para leite humano.");
    expect(notas(avaliarDieta(prog({ leite: "formula_pt" }), PT))).toMatch(/leite humano de banco com aditivo/);
    expect(avaliarDieta(prog({ via: "seio" }), PT).alertas[0]).toMatch(/via oral a partir de 32 semanas/);
    expect(avaliarDieta(prog({ via: "seio" }), { ...PT, igSemanas: 31, pnaDias: 7 }).alertas).toEqual([]);
  });
  it("fora do escopo da ESPGHAN (PN ≥ 1.800 g)", () => {
    const r = avaliarDieta(prog({ incrementoMlKgDia: 40, metaMlKgDia: 160 }), { ...PT, pesoG: 2500, pesoNascimentoG: 2500, igSemanas: 36 });
    expect(r.alertas).toEqual([]);
    expect(notas(r)).toMatch(/fora do escopo da ESPGHAN/);
  });
  it("aditivo e complemento no texto", () => {
    expect(avaliarDieta(prog({ volumeMlKgDia: 80, aditivo: true, complemento: "lhop" }), PT).prescricao).toBe(
      "Leite materno ordenhado (LMO) 12 mL de 3/3 h por SOG (80 mL/kg/dia); com aditivo do leite humano conforme o protocolo do serviço. Complementar com leite humano pasteurizado (LHOP) se faltar leite materno.",
    );
  });
});

describe("transição com a venóclise", () => {
  it("plano dia a dia até a meta, com aditivo e saída da venóclise", () => {
    const r = avaliarDieta(prog({ incrementoMlKgDia: 20, metaMlKgDia: 160 }), { ...PT, volumeTotalMlKgDia: 140 });
    expect(r.plano?.map((l) => l.dietaMlKgDia)).toEqual([20, 40, 60, 80, 100, 120, 140, 160]);
    expect(r.plano?.map((l) => l.venoMlKgDia)).toEqual([120, 100, 80, 60, 40, 20, 0, 0]);
    expect(r.plano?.[0].venoMlH).toBe(6);
    expect(r.plano?.[0].mlPorMamada).toBe(3);
    expect(r.plano?.[1].eventos).toEqual(["Aditivo pode começar (40–100 mL/kg/dia)"]);
    expect(r.plano?.[6].eventos).toEqual(["A dieta cobre o volume total: venóclise sai"]);
    expect(r.plano?.[7].eventos).toEqual(["Meta atingida"]);
    expect(r.plano?.[7].mlPorMamada).toBe(24);
  });
  it("outras infusões entram na conta; sem volume total, só a dieta", () => {
    const r = avaliarDieta(prog({ incrementoMlKgDia: 20, metaMlKgDia: 60 }), { ...PT, volumeTotalMlKgDia: 140, outrasInfusoesMlDia: 24 });
    expect(r.plano?.map((l) => l.venoMlKgDia)).toEqual([100, 80, 60]);
    const s = avaliarDieta(prog({ incrementoMlKgDia: 20, metaMlKgDia: 60 }), PT);
    expect(s.plano?.every((l) => l.venoMlKgDia == null)).toBe(true);
  });
  it("texto inclui a venóclise", () => {
    const c = { ...PT, volumeTotalMlKgDia: 140 };
    expect(textoDieta(avaliarDieta(prog(), c), c)).toBe(
      "Dieta: Leite materno ordenhado (LMO) 3 mL de 3/3 h por SOG (20 mL/kg/dia).\nVenóclise: 120 mL/kg/dia (volume total 140 − dieta); reduzir conforme a dieta aumenta.",
    );
    expect(textoDieta(avaliarDieta(prog({ volumeMlKgDia: 150, aditivo: true }), c), c)).toMatch(/a dieta já cobre o volume total de 140/);
  });
});
