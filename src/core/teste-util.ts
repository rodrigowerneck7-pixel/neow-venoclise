import type { EntradaVenoclise } from "./tipos";

/** Caso A (termo 3.000 g, D1) como base; testes sobrescrevem o que importa. */
export function casoA(extra: Partial<EntradaVenoclise> = {}): EntradaVenoclise {
  return {
    pesoNascimento: 3000,
    igSemanas: 39,
    diaDeVida: 1,
    volumeMlKgDia: 70,
    tig: 5,
    maeMgSO4: "nao",
    calcio: { incluir: true, mlKgDia: 4 },
    magnesioMEqKgDia: 0.3,
    ...extra,
  };
}

/** Caso B (PT 1.200 g, D1). */
export function casoB(extra: Partial<EntradaVenoclise> = {}): EntradaVenoclise {
  return {
    pesoNascimento: 1200,
    igSemanas: 29,
    diaDeVida: 1,
    volumeMlKgDia: 80,
    tig: 5,
    maeMgSO4: "nao",
    calcio: { mlKgDia: 4 },
    magnesioMEqKgDia: 0.3,
    ...extra,
  };
}
