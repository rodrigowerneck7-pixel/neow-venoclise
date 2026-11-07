/**
 * Cálculos de cada aba a partir do estado salvo — usados pela própria aba e pela Prescrição,
 * para que as duas mostrem sempre o mesmo resultado.
 */
import { calcularDose, cronograma, textoAntibiotico, type ContextoAtb, type DadosAntibiotico } from "../core/antibiotico";
import { avaliarDieta, textoDieta, type ContextoDieta, type DadosDieta } from "../core/dieta";
import type { FichaRN } from "../core/ficha";
import { calcularIctericia, type DadosIctericia } from "../core/ictericia";
import { contextoDaFicha } from "../core/internacao";
import { horasDeVida } from "../core/tempo";
import { parseNascimento } from "../db/validacao";
import { entradaIctericia } from "./Ictericia";

/** Dias de vida completos (D1 = 0), pela hora de nascimento ou pelo dia de vida da ficha. */
export function pnaDiasDe(ficha: FichaRN, nascimento: string | null, agora: Date): number | null {
  const nasc = parseNascimento(nascimento);
  const h = nasc ? horasDeVida(nasc, agora) : null;
  return h != null ? Math.floor(h / 24) : ficha.diaDeVida != null ? ficha.diaDeVida - 1 : null;
}

export function derivarAntibiotico(d: DadosAntibiotico, ficha: FichaRN, nascimento: string | null, agora: Date, diureseMlKgH: number | null) {
  const rn = contextoDaFicha(ficha);
  const ctx: ContextoAtb = {
    igSemanas: rn.igSemanas,
    igDias: rn.igDias,
    pesoG: rn.pesoAtualG ?? rn.pesoNascimentoG,
    pesoOrigem: rn.pesoAtualG != null ? "atual" : rn.pesoNascimentoG != null ? "nascimento" : null,
    pnaDias: pnaDiasDe(ficha, nascimento, agora),
    creatinina: d.creatinina ?? null,
    diureseMlKgH,
  };
  const doses = d.drogas.map((x) => calcularDose(x.droga, x.tabela, ctx, x));
  const inicio = parseNascimento(d.inicio ?? null);
  const crono = inicio ? cronograma(inicio, agora, d.duracao) : null;
  const texto = textoAntibiotico({ inicio, agora, doses, duracao: d.duracao, historico: d.historico });
  return { rn, ctx, doses, inicio, crono, texto };
}

export interface VenocliseParaDieta {
  volumeTotalMlKgDia: number | null;
  outrasInfusoesMlDia: number | null;
  dietaMlKgDia: number | null;
}

export function derivarDieta(d: DadosDieta, ficha: FichaRN, nascimento: string | null, agora: Date, pesoCalculoG: number | null, veno: VenocliseParaDieta) {
  const rn = contextoDaFicha(ficha);
  const pesoG = pesoCalculoG ?? rn.pesoAtualG ?? rn.pesoNascimentoG;
  const origem = pesoCalculoG != null ? "da venóclise" : rn.pesoAtualG != null ? "atual" : rn.pesoNascimentoG != null ? "de nascimento" : null;
  const c: ContextoDieta = {
    pesoG,
    pesoNascimentoG: rn.pesoNascimentoG,
    igSemanas: rn.igSemanas,
    igDias: rn.igDias,
    pnaDias: pnaDiasDe(ficha, nascimento, agora),
    volumeTotalMlKgDia: veno.volumeTotalMlKgDia,
    outrasInfusoesMlDia: veno.outrasInfusoesMlDia,
  };
  const r = avaliarDieta(d, c);
  return { rn, c, r, pesoG, origem, texto: textoDieta(r, c) };
}

export function derivarIctericia(ict: DadosIctericia, ficha: FichaRN, nascimento: string | null) {
  return calcularIctericia(entradaIctericia(ict, ficha, nascimento));
}
