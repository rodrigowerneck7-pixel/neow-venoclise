import { describe, expect, it } from "vitest";
import { CONFIG_PADRAO, calcularVenoclise, interpretarPeso } from "./calculo";
import { PRESETS_CALCIO } from "./constantes";
import { parseNumeroBR } from "./numeros";
import { calcularDiaDeVida } from "./tempo";
import { casoA, casoB } from "./teste-util";

const MS = { ...CONFIG_PADRAO, fonteHidrica: "ms" as const };
const bloqueios = (r: ReturnType<typeof calcularVenoclise>) => r.alertas.filter((a) => a.bloqueia).map((a) => a.id);

describe("Trava 1: Na/K no D1", () => {
  it("Na > 0 no D1 bloqueia; com justificativa libera com alerta vermelho", () => {
    const r = calcularVenoclise(casoB({ sodioMEqKgDia: 2 }));
    expect(bloqueios(r)).toContain("na-d1");
    expect(r.liberado).toBe(false);
    const j = calcularVenoclise(casoB({ sodioMEqKgDia: 2, overrideSodioD1: { justificativa: "NP precoce" } }));
    expect(bloqueios(j)).not.toContain("na-d1");
    expect(j.alertas.find((a) => a.id === "na-d1-override")?.nivel).toBe("vermelho");
  });
  it("K > 0 no D1 bloqueia sem override possível", () => {
    const r = calcularVenoclise(casoB({ potassioMEqKgDia: 2, urinou: "sim", overrideSodioD1: { justificativa: "x" } }));
    expect(bloqueios(r)).toContain("k-d1");
  });
});

describe("Trava 2: K sem diurese confirmada", () => {
  const base = () => casoB({ diaDeVida: 3, pesoAtual: 1150, volumeMlKgDia: 110, potassioMEqKgDia: 2 });
  it.each([["nao"], ["nao_sei"], [null]] as const)("urinou = %s bloqueia", (u) => {
    expect(bloqueios(calcularVenoclise({ ...base(), urinou: u }))).toContain("k-diurese");
  });
  it("diurese < 1 mL/kg/h bloqueia mesmo com urinou = sim", () => {
    expect(bloqueios(calcularVenoclise({ ...base(), urinou: "sim", diureseMlKgH: 0.7 }))).toContain("k-diurese");
  });
  it("urinou = sim libera", () => {
    expect(bloqueios(calcularVenoclise({ ...base(), urinou: "sim" }))).not.toContain("k-diurese");
  });
  it("K sérico ≥ 5,5 bloqueia; < 800 g nas 72 h sem K sérico bloqueia", () => {
    expect(bloqueios(calcularVenoclise({ ...base(), urinou: "sim", labs: { k: 5.6 } }))).toContain("k-serico");
    const peq = casoB({ pesoNascimento: 750, pesoAtual: 740, diaDeVida: 3, volumeMlKgDia: 130, potassioMEqKgDia: 2, urinou: "sim", igSemanas: 25 });
    expect(bloqueios(calcularVenoclise(peq))).toContain("k-lt800");
    expect(bloqueios(calcularVenoclise({ ...peq, labs: { k: 4.2 } }))).not.toContain("k-lt800");
  });
});

describe("Trava 3: concentração > 12,5% em acesso periférico", () => {
  // TIG 9 em 80 mL/kg: 9×1,44/0,08 = 162 mg/mL = 16,2%
  const alta = (acesso?: "periferico" | "picc" | "cvu" | null) =>
    calcularVenoclise(casoB({ tig: 9, acesso, foraDaFaixa: { tig: { confirmado: true, justificativa: "x" } } }));
  it("periférico bloqueia", () => expect(bloqueios(alta("periferico"))).toContain("conc-central"));
  it("acesso não informado bloqueia e pergunta", () => expect(bloqueios(alta(null))).toContain("conc-acesso"));
  it("PICC libera", () => {
    expect(alta("picc").calculo!.concFinalPct).toBeGreaterThan(12.5);
    expect(bloqueios(alta("picc"))).toEqual([]);
  });
});

describe("Trava 4: concentração < 2,5%", () => {
  it("bloqueia (hemólise)", () => {
    const r = calcularVenoclise(casoA({ tig: 1, foraDaFaixa: { tig: { confirmado: true, justificativa: "x" }, volume: { confirmado: true, justificativa: "x" } } }), MS);
    expect(r.calculo!.concFinalPct).toBeLessThan(2.5);
    expect(bloqueios(r)).toContain("conc-min");
  });
});

describe("Trava 5: mãe com MgSO4", () => {
  it("sim => Mg sugerido = 0, com alerta vermelho", () => {
    const r = calcularVenoclise(casoB({ maeMgSO4: "sim", magnesioMEqKgDia: null }));
    expect(r.calculo!.magnesio.mEqKg).toBe(0);
    expect(r.calculo!.magnesio.mlDia).toBe(0);
    expect(r.alertas.find((a) => a.id === "mg-mae")?.nivel).toBe("vermelho");
  });
  it("não sei => preset com alerta laranja; sem resposta => pendência", () => {
    const r = calcularVenoclise(casoB({ maeMgSO4: "nao_sei", magnesioMEqKgDia: null }));
    expect(r.calculo!.magnesio.mEqKg).toBe(0.3);
    expect(r.alertas.find((a) => a.id === "mg-mae-nao-sei")?.nivel).toBe("laranja");
    const p = calcularVenoclise(casoB({ maeMgSO4: null }));
    expect(p.pendencias).toContain("Informe se a mãe recebeu MgSO₄");
    expect(p.calculo).toBeUndefined();
  });
  it("Mg sérico > 2,5 sugere zerar", () => {
    const r = calcularVenoclise(casoB({ magnesioMEqKgDia: null, labs: { mg: 3 } }));
    expect(r.calculo!.magnesio.mEqKg).toBe(0);
  });
});

describe("Trava 6: peso '3,2' pergunta kg", () => {
  it("vírgula e ponto valem igual", () => {
    expect(parseNumeroBR("3,2")).toBe(3.2);
    expect(parseNumeroBR("3.2")).toBe(3.2);
    expect(parseNumeroBR("")).toBeNull();
    expect(parseNumeroBR("abc")).toBeNull();
  });
  it("não converte sem confirmação; converte com", () => {
    expect(interpretarPeso(3.2, false)).toEqual({ tipo: "perguntar_kg", valor: 3.2 });
    expect(interpretarPeso(3.2, true)).toEqual({ tipo: "ok", gramas: 3200, convertidoDeKg: true });
    const r = calcularVenoclise(casoA({ pesoNascimento: parseNumeroBR("3,2") }), MS);
    expect(r.calculo).toBeUndefined();
    expect(r.alertas.find((a) => a.id === "peso-nasc-kg")?.acao).toBe("confirmar_kg");
    const ok = calcularVenoclise(casoA({ pesoNascimento: 3.2, confirmouKg: { nascimento: true } }), MS);
    expect(ok.calculo!.pesoCalculoG).toBe(3200);
  });
});

describe("Trava 7: campo obrigatório vazio => nenhuma saída numérica", () => {
  it.each([
    ["peso de nascimento", { pesoNascimento: null }, "Informe o peso de nascimento"],
    ["IG", { igSemanas: null }, "Informe a idade gestacional (semanas)"],
    ["dia de vida", { diaDeVida: null }, "Informe o dia de vida"],
  ] as const)("%s", (_n, extra, msg) => {
    const r = calcularVenoclise(casoA(extra));
    expect(r.pendencias).toContain(msg);
    expect(r.calculo).toBeUndefined();
    expect(r.referencia).toBeUndefined();
    expect(r.prescricaoTexto).toBeUndefined();
    expect(r.liberado).toBe(false);
  });
  it("volume e TIG vazios: mostra a faixa de referência mas não calcula", () => {
    const r = calcularVenoclise(casoA({ volumeMlKgDia: null, tig: null }));
    expect(r.pendencias).toEqual(["Escolha o volume total (mL/kg/dia)", "Escolha a TIG (mg/kg/min)"]);
    expect(r.referencia).toBeDefined();
    expect(r.calculo).toBeUndefined();
  });
  it("peso atual é obrigatório a partir do D2", () => {
    expect(calcularVenoclise(casoB({ diaDeVida: 2, volumeMlKgDia: 100 })).pendencias).toContain("Informe o peso atual (obrigatório a partir do D2)");
  });
  it("termo sem risco: pergunta sobre o cálcio", () => {
    const r = calcularVenoclise(casoA({ calcio: {} }));
    expect(r.pendencias).toContain("Termo sem fator de risco: informe se adiciona gluconato de cálcio");
  });
});

describe("Trava 8: preset Ca 100 (sal)", () => {
  it("alerta < 0,8 mmol/kg/dia", () => {
    const r = calcularVenoclise(casoB({ calcio: { mlKgDia: PRESETS_CALCIO.ca100.mlKg } }));
    expect(r.calculo!.calcio.mmolKg).toBeCloseTo(0.2325, 4);
    const a = r.alertas.find((x) => x.id === "ca-baixo")!;
    expect(a.nivel).toBe("laranja");
    expect(a.titulo).toContain("abaixo de 0,8 mmol/kg/dia");
  });
  it("Ca 200 também alerta; padrão 4 mL/kg (0,93 mmol/kg) não", () => {
    expect(calcularVenoclise(casoB({ calcio: { mlKgDia: 2 } })).alertas.some((x) => x.id === "ca-baixo")).toBe(true);
    expect(calcularVenoclise(casoB()).alertas.some((x) => x.id === "ca-baixo")).toBe(false);
  });
});

describe("Trava 9: ajustes da faixa de volume", () => {
  const faixa = (extra = {}) => {
    const r = calcularVenoclise(casoB({ volumeMlKgDia: null, ...extra }));
    const v = r.referencia!.volume;
    if (v.status !== "ok") throw new Error("sem faixa");
    return v;
  };
  it("fototerapia: limite inferior +10%, superior +20%", () => {
    const f = faixa({ fototerapia: true });
    expect(f.base).toEqual({ min: 70, max: 90 });
    expect(f.ajustada.min).toBeCloseTo(77, 6);
    expect(f.ajustada.max).toBeCloseTo(108, 6);
    expect(f.motivosAjuste.join()).toContain("Fototerapia");
  });
  it("VM/SDR/asfixia: limite inferior −20%, superior −10%", () => {
    const f = faixa({ asfixiaSdrVm: true });
    expect(f.ajustada.min).toBeCloseTo(56, 6);
    expect(f.ajustada.max).toBeCloseTo(81, 6);
  });
  it("ESPGHAN: D5 e D6+ seguem a tabela", () => {
    const d5 = calcularVenoclise(casoB({ diaDeVida: 5, pesoAtual: 1100, volumeMlKgDia: null })).referencia!.volume;
    expect(d5.status === "ok" && d5.base).toEqual({ min: 160, max: 180 });
    const d9 = calcularVenoclise(casoB({ diaDeVida: 9, pesoAtual: 1100, volumeMlKgDia: null })).referencia!.volume;
    expect(d9.status === "ok" && d9.base).toEqual({ min: 140, max: 160 });
  });
  it("MS: D2–D6 do termo é TODO(validar) e bloqueia", () => {
    const r = calcularVenoclise(casoA({ diaDeVida: 3, pesoAtual: 2900, volumeMlKgDia: 80 }), MS);
    expect(r.referencia!.volume.status).toBe("todo");
    expect(bloqueios(r)).toContain("volume-todo");
  });
});

describe("Trava 10: enteral e outras infusões", () => {
  it("20 mL/kg/dia + 10 mL/dia reduzem a venóclise", () => {
    const r = calcularVenoclise(casoA({ dietaEnteralMlKgDia: 20, outrasInfusoesMlDia: 10 }), MS);
    // 70×3 = 210; enteral 20×3 = 60; outras 10 => 140 mL
    expect(r.calculo!.volumeVenoclise).toBeCloseTo(140, 6);
    expect(r.calculo!.volumeTotalMlDia).toBeCloseTo(210, 6);
    expect(r.calculo!.vazaoMlH).toBeCloseTo(140 / 24, 6);
    // a glicose continua sendo a da TIG, então a concentração sobe
    expect(r.calculo!.glicoseGDia).toBeCloseTo(21.6, 6);
  });
  it("sem volume sobrando bloqueia", () => {
    const r = calcularVenoclise(casoA({ dietaEnteralMlKgDia: 70 }), MS);
    expect(bloqueios(r)).toContain("volume-zero");
  });
});

describe("Sanidade de entrada e outros", () => {
  it.each([
    [{ pesoNascimento: 200 }, "peso-fora"],
    [{ pesoNascimento: 7000 }, "peso-fora"],
    [{ igSemanas: 20 }, "ig-fora"],
    [{ igSemanas: 46 }, "ig-fora"],
    [{ diaDeVida: 29, pesoAtual: 3000 }, "dia-escopo"],
  ] as const)("%j => %s", (extra, id) => {
    const r = calcularVenoclise(casoA(extra), MS);
    expect(bloqueios(r)).toContain(id);
    expect(r.calculo).toBeUndefined();
  });
  it("variação de peso > 25% exige confirmação", () => {
    const base = casoB({ diaDeVida: 3, pesoAtual: 1600, volumeMlKgDia: 110 });
    expect(bloqueios(calcularVenoclise(base))).toContain("variacao-peso");
    expect(bloqueios(calcularVenoclise({ ...base, confirmouVariacaoPeso: true }))).not.toContain("variacao-peso");
  });
  it("peso de cálculo: PN enquanto o atual está abaixo; atual depois que recuperou", () => {
    const abaixo = calcularVenoclise(casoB({ diaDeVida: 4, pesoAtual: 1100, volumeMlKgDia: 130 })).calculo!;
    expect(abaixo.pesoUsado).toBe("nascimento");
    expect(abaixo.pesoCalculoG).toBe(1200);
    const rec = calcularVenoclise(casoB({ diaDeVida: 12, pesoAtual: 1300, volumeMlKgDia: 150 })).calculo!;
    expect(rec.pesoUsado).toBe("atual");
    expect(rec.pesoCalculoG).toBe(1300);
  });
  it("perda de peso ≥ 20% é alerta vermelho; > 10% no termo é laranja", () => {
    const v = calcularVenoclise(casoA({ diaDeVida: 5, pesoAtual: 2300, volumeMlKgDia: 120, foraDaFaixa: { volume: { confirmado: true, justificativa: "x" } } }));
    expect(v.alertas.find((a) => a.id === "perda-excesso")?.nivel).toBe("vermelho");
    const l = calcularVenoclise(casoA({ diaDeVida: 5, pesoAtual: 2600, volumeMlKgDia: 120, foraDaFaixa: { volume: { confirmado: true, justificativa: "x" } } }));
    expect(l.alertas.find((a) => a.id === "perda-termo")?.nivel).toBe("laranja");
  });
  it("glicemia < 45 abre a hipoglicemia; 175–250 sugere −2", () => {
    expect(calcularVenoclise(casoB({ labs: { glicemia: 38 } })).alertas.find((a) => a.id === "glicemia-hipo")?.acao).toBe("hipoglicemia");
    expect(calcularVenoclise(casoB({ labs: { glicemia: 200 } })).alertas.find((a) => a.id === "glicemia-alta")?.detalhe).toContain("TIG sugerida: 3");
    expect(calcularVenoclise(casoB({ labs: { glicemia: 300 } })).alertas.find((a) => a.id === "glicemia-alta")?.detalhe).toContain("TIG sugerida: 1");
  });
  it("TIG fora da faixa exige confirmação; > 12 alerta vermelho", () => {
    expect(bloqueios(calcularVenoclise(casoB({ tig: 9 })))).toContain("tig-fora");
    const r = calcularVenoclise(casoB({ tig: 13, acesso: "picc", foraDaFaixa: { tig: { confirmado: true, justificativa: "x" } } }));
    expect(r.alertas.find((a) => a.id === "tig-max")?.nivel).toBe("vermelho");
  });
  it("etapas: 4 × 6 h divide a receita por 4", () => {
    const r = calcularVenoclise(casoB(), { ...CONFIG_PADRAO, etapas: 4 });
    expect(r.calculo!.receitaEtapa.sg10).toBeCloseTo(21.6, 2);
    expect(r.prescricaoTexto).toContain("4 etapas de 6 h");
  });
  it("SG 5% opcional: mistura SG 5% + SG 10% fecha a conta", () => {
    const r = calcularVenoclise(casoB({ tig: 4 }), { ...CONFIG_PADRAO, soroBaixo: "sg5" });
    const m = r.calculo!.mistura;
    expect(m.sg5Ml + m.sg10Ml + m.adMl).toBeCloseTo(96 - 4.8 - 0.4444, 3);
    expect(m.sg5Ml * 0.05 + m.sg10Ml * 0.1).toBeCloseTo(4 * 1.44 * 1.2, 6);
  });
  it("dia de vida: D1 = primeiras 24 h", () => {
    const n = new Date("2026-01-01T08:00:00");
    expect(calcularDiaDeVida(n, new Date("2026-01-02T07:59:00"))).toBe(1);
    expect(calcularDiaDeVida(n, new Date("2026-01-02T08:00:00"))).toBe(2);
    expect(calcularDiaDeVida(n, new Date("2025-12-31T08:00:00"))).toBeNull();
  });
});
