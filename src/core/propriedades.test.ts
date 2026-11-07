import { describe, expect, it } from "vitest";
import { CONFIG_PADRAO, calcularVenoclise, concentracaoReal } from "./calculo";
import type { ConfigServico, EntradaVenoclise } from "./tipos";

// Gerador pseudoaleatório com semente fixa (determinístico, sem dependência extra).
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

describe("propriedades do motor (2.000 entradas sorteadas)", () => {
  const rnd = lcg(20261106);
  const entre = (a: number, b: number) => a + rnd() * (b - a);
  let validos = 0;

  for (let i = 0; i < 2000; i++) {
    const pt = rnd() < 0.7;
    const dia = 1 + Math.floor(rnd() * 14);
    const pn = Math.round(pt ? entre(500, 2400) : entre(2500, 4500));
    const e: EntradaVenoclise = {
      pesoNascimento: pn,
      pesoAtual: dia >= 2 ? Math.round(pn * entre(0.9, 1.05)) : null,
      igSemanas: pt ? Math.floor(entre(24, 36)) : Math.floor(entre(37, 41)),
      diaDeVida: dia,
      volumeMlKgDia: entre(40, 180),
      tig: entre(2.5, 10),
      maeMgSO4: "nao",
      calcio: { incluir: true, mlKgDia: entre(1, 6) },
      magnesioMEqKgDia: entre(0.1, 0.6),
      sodioMEqKgDia: dia >= 3 ? entre(0, 4) : 0,
      potassioMEqKgDia: 0,
      dietaEnteralMlKgDia: rnd() < 0.3 ? entre(0, 30) : 0,
      outrasInfusoesMlDia: rnd() < 0.3 ? entre(0, 20) : 0,
      confirmouVariacaoPeso: true,
      foraDaFaixa: { volume: { confirmado: true, justificativa: "p" }, tig: { confirmado: true, justificativa: "p" } },
      acesso: "picc",
    };
    const cfg: ConfigServico = { ...CONFIG_PADRAO, etapas: ([1, 2, 4] as const)[Math.floor(rnd() * 3)], soroBaixo: rnd() < 0.3 ? "sg5" : "sg10" };

    it(`#${i}`, () => {
      const r = calcularVenoclise(e, cfg);
      if (!r.calculo) return;
      validos++;
      const c = r.calculo;
      const k = c.componentes;
      // 1) a soma dos componentes é igual ao volume da venóclise
      const soma = k.sg5 + k.sg10 + k.sg50 + k.ad + k.gluconatoCa + k.mgso4 + k.nacl + k.kcl;
      expect(Math.abs(soma - c.volumeVenoclise)).toBeLessThan(1e-6);
      // 2) nenhum componente negativo
      for (const v of Object.values(k)) expect(v).toBeGreaterThanOrEqual(0);
      // 3) a glicose dos soros é exatamente a da TIG
      const g = k.sg5 * 0.05 + k.sg10 * 0.1 + k.sg50 * 0.5;
      expect(Math.abs(g - c.glicoseGDia)).toBeLessThan(1e-6);
      // 4) a concentração recalculada com a receita arredondada é a exibida
      expect(c.concFinalRealPct).toBeCloseTo(concentracaoReal(c.receitaEtapa), 10);
      // 5) e fica perto da concentração teórica (arredondamento a 0,01–0,1 mL por componente)
      expect(Math.abs(c.concFinalRealPct - c.concFinalPct)).toBeLessThan(Math.max(0.6, c.concFinalPct * 0.06));
      // 6) vazão × 24 = volume
      expect(c.vazaoMlH * 24).toBeCloseTo(c.volumeVenoclise, 8);
    });
  }

  it("a amostra teve casos válidos suficientes", () => expect(validos).toBeGreaterThan(500));
});
