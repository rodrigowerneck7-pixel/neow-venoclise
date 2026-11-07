import { describe, expect, it } from "vitest";
import { calcularHipoglicemia, vazaoSg10 } from "./hipoglicemia";

describe("hipoglicemia (MS 2014)", () => {
  it("bolus 2 mL/kg de SG 10% a 1 mL/min", () => {
    const r = calcularHipoglicemia({ pesoG: 3000 });
    expect(r.bolus).toMatchObject({ ml: 6, minutos: 6, velocidadeMlMin: 1, glicoseMg: 600 });
    expect(r.texto).toContain("sem cálcio no bolus");
  });
  it("manutenção: TIG 6 em 3 kg = 10,8 mL/h de SG 10%", () => {
    const r = calcularHipoglicemia({ pesoG: 3000, tig: 6 });
    expect(r.manutencao?.vazaoMlH).toBe(10.8);
    expect(r.foraDaFaixa).toBe(false);
    expect(r.desmame).toMatchObject({ tigDepois: 5, vazaoDepoisMlH: 9, intervaloMinH: 1 });
  });
  it("vazão bate com a fórmula da venóclise (TIG×1,44×kg÷0,1÷24)", () => {
    expect(vazaoSg10(7, 2.5)).toBeCloseTo((7 * 1.44 * 2.5) / 0.1 / 24, 10);
  });
  it("TIG fora de 6–8 só sinaliza; acima de 12 bloqueia", () => {
    expect(calcularHipoglicemia({ pesoG: 3000, tig: 4 }).foraDaFaixa).toBe(true);
    const r = calcularHipoglicemia({ pesoG: 3000, tig: 13 });
    expect(r.manutencao).toBeUndefined();
    expect(r.texto).toBeUndefined();
  });
  it("sem peso: nada calculado; peso < 15 pergunta kg", () => {
    expect(calcularHipoglicemia({ pesoG: null })).toEqual({ pendencias: ["Informe o peso"] });
    expect(calcularHipoglicemia({ pesoG: 3 }).perguntaKg).toBe(true);
    expect(calcularHipoglicemia({ pesoG: 3 }).bolus).toBeUndefined();
    expect(calcularHipoglicemia({ pesoG: 3, confirmouKg: true }).bolus?.ml).toBe(6);
  });
  it("sem TIG não inventa manutenção; TIG 1 não gera desmame negativo", () => {
    expect(calcularHipoglicemia({ pesoG: 3000 }).manutencao).toBeUndefined();
    expect(calcularHipoglicemia({ pesoG: 3000, tig: 1 }).desmame?.tigDepois).toBeUndefined();
  });
});
