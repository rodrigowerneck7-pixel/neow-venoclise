import { describe, expect, it } from "vitest";
import { FICHA_INICIAL, aplicarFicha, fichaDeEntrada, igTexto, pendenciasFicha, resumoFicha } from "./ficha";
import type { EntradaVenoclise } from "./tipos";

const entrada: EntradaVenoclise = {
  pesoNascimento: 2500,
  pesoAtual: 2400,
  confirmouKg: { atual: true },
  igSemanas: 36,
  igDias: 2,
  diaDeVida: 3,
  volumeMlKgDia: 90,
  tig: 5,
  fototerapia: true,
};

describe("ficha do RN", () => {
  it("migra os dados comuns de uma entrada antiga", () => {
    const f = fichaDeEntrada(entrada);
    expect(f).toMatchObject({ pesoNascimento: 2500, pesoAtual: 2400, igSemanas: 36, igDias: 2, diaDeVida: 3, confirmouKg: { atual: true } });
    expect(f).not.toHaveProperty("volumeMlKgDia");
  });

  it("entrada antiga sem campos opcionais mantém os padrões vazios", () => {
    const f = fichaDeEntrada({ pesoNascimento: null, igSemanas: null, diaDeVida: null, volumeMlKgDia: null, tig: null });
    expect(f.pesoNascimento).toBeNull();
    expect(f.diaDeVida).toBeNull();
    expect(f.pesoAtual).toBeNull();
  });

  it("a ficha sempre vence na entrada do motor (reusar prescrição antiga não volta o peso antigo)", () => {
    const antiga = { ...entrada, pesoAtual: 2000, diaDeVida: 1 };
    const r = aplicarFicha(antiga, { ...FICHA_INICIAL, pesoNascimento: 2500, pesoAtual: 2450, igSemanas: 36, diaDeVida: 4 });
    expect(r.pesoAtual).toBe(2450);
    expect(r.diaDeVida).toBe(4);
    expect(r.igDias).toBeNull();
    expect(r.volumeMlKgDia).toBe(90);
    expect(r.fototerapia).toBe(true);
  });

  it("não informado continua não informado", () => {
    const r = aplicarFicha(entrada, FICHA_INICIAL);
    expect(r.pesoNascimento).toBeNull();
    expect(r.igSemanas).toBeNull();
  });

  it("resumo mostra só o informado", () => {
    expect(resumoFicha(FICHA_INICIAL, null)).toBe("Ficha vazia");
    const f = { ...fichaDeEntrada(entrada), tipagemRN: { abo: "A" as const, rh: "pos" as const }, tipagemMae: { abo: "O" as const, rh: "pos" as const }, coombsDireto: "positivo" as const };
    expect(resumoFicha(f, 3)).toBe("2.400 g · 36s2d · D3 · RN A+ · mãe O+ · Coombs +");
    expect(resumoFicha({ ...FICHA_INICIAL, pesoNascimento: 2.5 }, null)).toBe("2,5 kg?");
  });

  it("IG em texto", () => {
    expect(igTexto({ igSemanas: 38, igDias: 0 })).toBe("38 sem");
    expect(igTexto({ igSemanas: 34, igDias: 5 })).toBe("34s5d");
    expect(igTexto({ igSemanas: null })).toBeNull();
  });

  it("pendências básicas", () => {
    expect(pendenciasFicha(FICHA_INICIAL, false)).toEqual(["peso de nascimento", "IG"]);
    expect(pendenciasFicha({ ...FICHA_INICIAL, diaDeVida: null }, true)).toEqual(["peso de nascimento", "IG"]);
    expect(pendenciasFicha({ ...FICHA_INICIAL, diaDeVida: null }, false)).toContain("dia de vida");
  });
});
