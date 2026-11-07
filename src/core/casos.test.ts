import { describe, expect, it } from "vitest";
import { CONFIG_PADRAO, calcularVenoclise } from "./calculo";
import { casoA, casoB } from "./teste-util";

const TOL = 0.05;
const perto = (v: number, esperado: number) => expect(Math.abs(v - esperado)).toBeLessThanOrEqual(TOL);

describe("Caso A: termo 3.000 g, D1, 70 mL/kg/dia (fonte MS), TIG 5, Ca 4, Mg 0,3", () => {
  const r = calcularVenoclise(casoA(), { ...CONFIG_PADRAO, fonteHidrica: "ms" });
  const c = r.calculo!;
  it("está liberado", () => {
    expect(r.pendencias).toEqual([]);
    expect(r.alertas.filter((a) => a.bloqueia)).toEqual([]);
    expect(r.liberado).toBe(true);
  });
  it("volume 210 mL/dia e 8,75 mL/h", () => {
    perto(c.volumeVenoclise, 210);
    perto(c.vazaoMlH, 8.75);
  });
  it("glicose 21,6 g e concentração final 10,29%", () => {
    perto(c.glicoseGDia, 21.6);
    expect(Math.abs(c.concFinalPct - 10.29)).toBeLessThan(0.01);
  });
  it("gluconato de Ca 12,0 mL (2,79 mmol; 37,2 mg/kg elementar)", () => {
    perto(c.calcio.mlDia, 12);
    perto(c.calcio.mmolDia, 2.79);
    perto(c.calcio.mgElementarKg, 37.2);
  });
  it("MgSO4 10% 1,11 mL", () => perto(c.magnesio.mlDia, 1.11));
  it("mistura SG 10% 192,11 + SG 50% 4,78", () => {
    perto(c.mistura.sg10Ml, 192.11);
    perto(c.mistura.sg50Ml, 4.78);
    expect(c.mistura.adMl).toBe(0);
  });
  it("Na e K = 0 no D1", () => {
    expect(c.sodio.mlDia).toBe(0);
    expect(c.potassio.mlDia).toBe(0);
  });
  it("gera o texto copiável com rodapé de concentrações", () => {
    expect(r.prescricaoTexto).toContain("SG 10% 192,1 mL");
    expect(r.prescricaoTexto).toContain("SG 50% 4,78 mL");
    expect(r.prescricaoTexto).toContain("8,8 mL/h");
    expect(r.prescricaoTexto).toContain("Concentrações:");
  });
});

describe("Caso A na fonte ESPGHAN: 70 mL/kg está fora da faixa do termo no D1 (40–60)", () => {
  it("bloqueia até confirmar com justificativa", () => {
    const r = calcularVenoclise(casoA());
    expect(r.liberado).toBe(false);
    expect(r.alertas.some((a) => a.id === "volume-fora" && a.bloqueia)).toBe(true);
    const ok = calcularVenoclise(casoA({ foraDaFaixa: { volume: { confirmado: true, justificativa: "teste" } } }));
    expect(ok.liberado).toBe(true);
    expect(ok.alertas.find((a) => a.id === "volume-fora")?.nivel).toBe("laranja");
  });
});

describe("Caso B: PT 1.200 g, D1, 80 mL/kg/dia, TIG 5, Ca 4, Mg 0,3", () => {
  const r = calcularVenoclise(casoB());
  const c = r.calculo!;
  it("está liberado (80 está dentro de 70–90)", () => expect(r.liberado).toBe(true));
  it("volume 96 mL/dia e 4,00 mL/h", () => {
    perto(c.volumeVenoclise, 96);
    perto(c.vazaoMlH, 4);
  });
  it("glicose 8,64 g e concentração final 9,00%", () => {
    perto(c.glicoseGDia, 8.64);
    expect(Math.abs(c.concFinalPct - 9)).toBeLessThan(0.01);
  });
  it("Ca 4,8 mL e Mg 0,44 mL", () => {
    perto(c.calcio.mlDia, 4.8);
    perto(c.magnesio.mlDia, 0.44);
  });
  it("mistura SG 10% 86,4 + AD 4,36", () => {
    perto(c.mistura.sg10Ml, 86.4);
    perto(c.mistura.adMl, 4.36);
    expect(c.mistura.sg50Ml).toBe(0);
  });
});
