/**
 * Antibiótico: iniciar ou não (sepse precoce), doses pelo PDF do serviço, duração, reavaliação em 36–48 h,
 * adequação/escalonamento e texto para a prescrição.
 *
 * Fontes: SBP 2022 (sepse neonatal precoce) — Figuras 1, 2 e 3, Quadro 4 e recomendações; PDF de doses do serviço
 * (UpToDate 2025). O motor não escolhe o antibiótico: mostra o que as fontes dizem e calcula a dose do que o médico escolher.
 */
import { DROGA, FONTE_DOSES, type DoseSpec, type Droga, type DrogaId, type Eixo, type Faixa, type LinhaDose, type TabelaDose } from "./dados/antimicrobianos";
import { FONTE_SBP_SEPSE_2022 } from "./internacao";
import { arredondar, fmt } from "./numeros";

export type SimNao = "sim" | "nao";

// ---------------------------------------------------------------- Dados salvos

export interface DrogaNoEsquema {
  droga: DrogaId;
  tabela: string;
  /** Escolha do médico quando a fonte dá faixa. */
  porKg?: number | null;
  cadaH?: number | null;
  ataquePorKg?: number | null;
}

export interface EsquemaAnterior {
  inicio: string | null;
  fim: string;
  texto: string;
  motivo?: string;
}

export type Culturas = "aguardando" | "negativas" | "positivas";
export type Triagem = "negativa" | "alterada";

export interface DadosAntibiotico {
  // Iniciar ou não (sepse precoce)
  sinais?: SimNao | null;
  soRespLeve?: boolean;
  tempMaterna38?: SimNao | null;
  apiIndicada?: SimNao | null;
  apiAdequada?: SimNao | null;
  ptAltoRisco?: SimNao | null;
  ptInduzido?: SimNao | null;
  ptAchado?: SimNao | null;
  ptCesarea?: SimNao | null;
  // Esquema atual
  /** "YYYY-MM-DDTHH:mm" da 1ª dose. */
  inicio?: string | null;
  drogas: DrogaNoEsquema[];
  duracao?: DuracaoId | null;
  creatinina?: number | null;
  // Reavaliação 36–48 h
  culturas?: Culturas | null;
  rnBem?: SimNao | null;
  triagem?: Triagem | null;
  historico: EsquemaAnterior[];
}

export const ATB_INICIAL: DadosAntibiotico = { drogas: [], historico: [] };

// ---------------------------------------------------------------- Iniciar ou não (SBP 2022, Figuras 2 e 3)

export type CondutaId = "hc_atb" | "observacao" | "rotina" | "sem_atb_opcoes" | "monitorar_resp" | "suspender" | "completar" | "sepse_clinica" | "fora";
export interface Conduta {
  id: CondutaId;
  titulo: string;
  texto: string;
  fonte: string;
}

const HC = "2 hemoculturas de 1 mL, de sítios diferentes (ao menos 1 periférica)";
const C: Record<"hc_atb" | "observacao" | "rotina" | "sem_atb_opcoes" | "monitorar_resp" | "fora", Omit<Conduta, "fonte">> = {
  hc_atb: {
    id: "hc_atb",
    titulo: "Hemoculturas e antibiótico empírico",
    texto: `Colher ${HC} e iniciar antibiótico empírico. Punção lombar antes do antibiótico se o RN tolerar, sem atrasar o antibiótico. Reavaliar em 36–48 h.`,
  },
  observacao: {
    id: "observacao",
    titulo: "Observação clínica por 36–48 h do nascimento",
    texto: "Sem antibiótico agora. Exame físico seriado; hemoculturas e antibiótico se surgirem sinais clínicos de doença.",
  },
  rotina: { id: "rotina", titulo: "Rotina de cuidados com o RN", texto: "Sem triagem infecciosa nem antibiótico empírico." },
  sem_atb_opcoes: {
    id: "sem_atb_opcoes",
    titulo: "Sem antibiótico empírico de rotina",
    texto: "Opções: nenhuma avaliação laboratorial; nenhum antibiótico empírico; ou hemoculturas e monitoramento clínico. Se não melhorar após a estabilização ou tiver instabilidade sistêmica grave, antibiótico empírico é razoável, mas não obrigatório.",
  },
  monitorar_resp: {
    id: "monitorar_resp",
    titulo: "Monitorar de perto, sem antibiótico",
    texto: "Desconforto respiratório leve a moderado logo após o nascimento: observar de perto. Colher culturas e iniciar antibiótico se piorar ou persistir por mais de 6 h (recomendação 3). Quadro persistente, progressivo ou moderado a grave: culturas e antibiótico (recomendação 4).",
  },
  fora: { id: "fora", titulo: "Fora do fluxograma", texto: "Esta combinação não aparece no fluxograma: decisão médica." },
};
const conduta = (id: keyof typeof C, fonte: string): Conduta => ({ ...C[id], fonte });

export interface EntradaInicio {
  igSemanas: number | null;
  horasDeVida: number | null;
  /** Sem hora de nascimento, a janela usa o dia de vida (D4 em diante = mais de 72 h). */
  diaDeVida?: number | null;
  d: DadosAntibiotico;
}
export interface ResultadoInicio {
  grupo: "ge35" | "le34" | null;
  /** Depois de 72 h os fluxogramas de sepse precoce não se aplicam. */
  foraDaJanela: boolean;
  pendencias: string[];
  /** ≥ 35 semanas: abordagem por categoria de risco (Fig. 2A). */
  categoria?: Conduta;
  /** ≥ 35 semanas: avaliação clínica seriada (Fig. 2C). */
  seriada?: Conduta;
  /** ≤ 34 semanas (Fig. 3). */
  pt?: Conduta;
  notas: string[];
}

const F2 = `${FONTE_SBP_SEPSE_2022}, Figura 2 (Puopolo/AAP 2018)`;
const F3 = `${FONTE_SBP_SEPSE_2022}, Figura 3 (Puopolo/AAP 2018)`;

export function decidirInicio(e: EntradaInicio): ResultadoInicio {
  const r: ResultadoInicio = { grupo: null, foraDaJanela: false, pendencias: [], notas: [] };
  if (e.igSemanas == null) {
    r.pendencias.push("Informe a IG na ficha");
    return r;
  }
  r.foraDaJanela = e.horasDeVida != null ? e.horasDeVida > 72 : e.diaDeVida != null && e.diaDeVida >= 4;
  const d = e.d;
  if (e.igSemanas >= 35) {
    r.grupo = "ge35";
    if (d.sinais == null) {
      r.pendencias.push("Há sinais clínicos de doença?");
      return r;
    }
    if (d.sinais === "sim") {
      if (d.soRespLeve) {
        r.categoria = r.seriada = conduta("monitorar_resp", `${FONTE_SBP_SEPSE_2022}, recomendações 3 e 4`);
      } else {
        r.categoria = r.seriada = conduta("hc_atb", F2);
      }
      return r;
    }
    // Sem sinais clínicos.
    r.notas.push("No RN ≥ 35 semanas assintomático com fator de risco, a SBP recomenda valorizar o exame físico seriado (recomendação 2).");
    if (d.tempMaterna38 == null) r.pendencias.push("Temperatura materna intraparto ≥ 38 °C?");
    if (d.tempMaterna38 === "sim") r.categoria = conduta("hc_atb", F2);
    else if (d.tempMaterna38 === "nao") {
      if (d.apiIndicada == null) r.pendencias.push("Profilaxia para EGB (API) era indicada para a mãe?");
      else if (d.apiIndicada === "nao") r.categoria = conduta("rotina", F2);
      else if (d.apiAdequada == null) r.pendencias.push("A API foi adequada (penicilina G, ampicilina ou cefazolina ≥ 4 h antes do parto)?");
      else r.categoria = conduta(d.apiAdequada === "sim" ? "rotina" : "observacao", F2);
    }
    // Seriada: temperatura ≥ 38 °C OU API indicada e inadequada → observação; senão rotina.
    const apiInadequada = d.apiIndicada === "sim" && d.apiAdequada === "nao";
    const apiOk = d.apiIndicada === "nao" || (d.apiIndicada === "sim" && d.apiAdequada === "sim");
    if (d.tempMaterna38 === "sim" || apiInadequada) r.seriada = conduta("observacao", F2);
    else if (d.tempMaterna38 === "nao" && apiOk) r.seriada = conduta("rotina", F2);
    return r;
  }

  r.grupo = "le34";
  if (d.ptAltoRisco == null) {
    r.pendencias.push("Trabalho de parto prematuro, rotura prematura de membranas ou sinal de infecção intra-amniótica?");
    return r;
  }
  if (d.ptAltoRisco === "sim") {
    r.pt = conduta("hc_atb", F3);
    return r;
  }
  if (d.ptInduzido == null) {
    r.pendencias.push("Nasceu de parto induzido (com ou sem dilatação; vaginal ou cesárea)?");
    return r;
  }
  if (d.ptInduzido === "sim") {
    if (d.ptAchado == null) r.pendencias.push("Algum achado: API para EGB indicada e inadequada; preocupação com infecção intra-amniótica; instabilidade respiratória ou cardiovascular?");
    else r.pt = conduta(d.ptAchado === "sim" ? "hc_atb" : "sem_atb_opcoes", F3);
    return r;
  }
  if (d.ptCesarea == null) {
    r.pendencias.push("Cesárea por indicação materna/fetal, sem trabalho de parto e com bolsa íntegra até o parto?");
    return r;
  }
  r.pt = conduta(d.ptCesarea === "sim" ? "sem_atb_opcoes" : "fora", F3);
  return r;
}

// ---------------------------------------------------------------- Doses

export interface ContextoAtb {
  igSemanas: number | null;
  igDias: number | null;
  /** Peso para a dose, em gramas (atual; sem ele, o de nascimento). */
  pesoG: number | null;
  pesoOrigem: "atual" | "nascimento" | null;
  /** Idade pós-natal em dias completos (D1 = 0). */
  pnaDias: number | null;
  creatinina: number | null;
  /** Diurese da venóclise (mL/kg/h), para o lembrete renal. */
  diureseMlKgH?: number | null;
}

export function pmaSemanas(c: Pick<ContextoAtb, "igSemanas" | "igDias" | "pnaDias">): number | null {
  if (c.igSemanas == null || c.pnaDias == null) return null;
  return Math.floor((c.igSemanas * 7 + (c.igDias ?? 0) + c.pnaDias) / 7);
}

export function dentroDaFaixa(v: number, f: Faixa): boolean {
  if (f.de != null && (f.deExcl ? v <= f.de : v < f.de)) return false;
  if (f.ate != null && (f.ateExcl ? v >= f.ate : v > f.ate)) return false;
  return true;
}

const NOME_EIXO: Record<Eixo, string> = {
  ig: "a IG ao nascer",
  pma: "a idade pós-menstrual (IG + dias de vida)",
  pna: "os dias de vida",
  peso: "o peso",
  cr: "a creatinina",
};

function valorEixo(e: Eixo, c: ContextoAtb): number | null {
  switch (e) {
    case "ig":
      return c.igSemanas;
    case "pma":
      return pmaSemanas(c);
    case "pna":
      return c.pnaDias;
    case "peso":
      return c.pesoG;
    case "cr":
      return c.creatinina;
  }
}

export function acharLinha(t: TabelaDose, c: ContextoAtb): { linha?: LinhaDose; faltam: Eixo[] } {
  const eixos = new Set<Eixo>();
  for (const l of t.linhas) for (const k of Object.keys(l.quando) as Eixo[]) eixos.add(k);
  const faltam = [...eixos].filter((k) => valorEixo(k, c) == null);
  if (faltam.length) return { faltam };
  const linha = t.linhas.find((l) => (Object.entries(l.quando) as [Eixo, Faixa][]).every(([k, f]) => dentroDaFaixa(valorEixo(k, c) as number, f)));
  return { linha, faltam: [] };
}

type Num = number | readonly [number, number];
const ehFaixa = (v: Num | undefined): v is readonly [number, number] => Array.isArray(v);
const mult = (v: Num, k: number): Num => (ehFaixa(v) ? [v[0] * k, v[1] * k] : v * k);

/** mg/UI com casas pelo tamanho (UI sem casas). */
export function fmtQtd(v: number, un: "mg" | "UI"): string {
  if (un === "UI") return fmt(Math.round(v), 0);
  const casas = Math.abs(v) < 10 ? 2 : 1;
  return fmt(arredondar(v, casas), casas);
}
const fmtNum = (v: Num, un: "mg" | "UI") => (ehFaixa(v) ? `${fmtQtd(v[0], un)}–${fmtQtd(v[1], un)}` : fmtQtd(v, un));
const fmtKg = (v: Num) => (ehFaixa(v) ? `${fmt(v[0], 2)}–${fmt(v[1], 2)}` : fmt(v, 2));
export const intervaloTexto = (h: number) => `de ${h}/${h} h`;

export interface EscolhaDose {
  porKg?: number | null;
  cadaH?: number | null;
  ataquePorKg?: number | null;
}

export interface ResultadoDose {
  droga: Droga;
  tabela: TabelaDose;
  pendencias: string[];
  alertas: string[];
  notas: string[];
  linha?: LinhaDose;
  /** O que a fonte diz (pode ser faixa). */
  spec?: DoseSpec;
  /** Valores usados (escolhidos dentro da faixa, quando houver). */
  porKg?: Num;
  cadaH?: Num;
  porTomada?: Num;
  porDia?: Num;
  ataque?: { porKg: Num; total: Num; texto: string };
  /** Dia de vida pós-natal (PNA, dias completos) em que a linha da tabela muda. */
  mudaComPna?: number;
  /** Linha pronta para a prescrição (só sem pendências). */
  prescricao?: string;
}

export function calcularDose(id: DrogaId, tabelaId: string | null | undefined, c: ContextoAtb, esc: EscolhaDose = {}): ResultadoDose {
  const droga = DROGA[id];
  const tabela = droga.tabelas.find((t) => t.id === tabelaId) ?? droga.tabelas[0];
  const un = droga.unidade;
  const r: ResultadoDose = { droga, tabela, pendencias: [], alertas: [], notas: [...(droga.notas ?? [])] };
  if (tabela.nota) r.notas.unshift(tabela.nota);
  if (droga.alerta) r.alertas.push(droga.alerta);
  if (droga.renal) {
    if (c.diureseMlKgH != null && c.diureseMlKgH < 1) r.alertas.push(`Diurese ${fmt(c.diureseMlKgH, 1)} mL/kg/h (na venóclise): ${droga.renal}`);
    else r.notas.push(droga.renal);
  }

  const { linha, faltam } = acharLinha(tabela, c);
  if (faltam.length) {
    r.pendencias.push(`Informe ${faltam.map((k) => NOME_EIXO[k]).join(" e ")}`);
    return r;
  }
  if (!linha) {
    r.pendencias.push("Fora das linhas desta tabela do PDF (confira os dias de vida, o peso ou a creatinina; veja outra tabela, se houver)");
    return r;
  }
  r.linha = linha;
  r.spec = linha.dose;
  const pnaF = linha.quando.pna;
  if (pnaF?.ate != null) r.mudaComPna = pnaF.ateExcl ? pnaF.ate : pnaF.ate + 1;

  if (c.pesoG == null) {
    r.pendencias.push("Informe o peso");
    return r;
  }
  const kg = c.pesoG / 1000;
  const sp = linha.dose;

  // Dose por kg: fixa ou escolhida dentro da faixa.
  let porKg: Num = sp.porKg;
  if (ehFaixa(sp.porKg)) {
    const [a, b] = sp.porKg;
    if (esc.porKg == null) r.pendencias.push(`Escolha a dose entre ${fmt(a, 2)} e ${fmt(b, 2)} ${un}/kg${sp.porDia ? "/dia" : "/dose"}`);
    else if (esc.porKg < a - 1e-9 || esc.porKg > b + 1e-9) r.pendencias.push(`A dose escolhida (${fmt(esc.porKg, 2)}) está fora da faixa ${fmt(a, 2)}–${fmt(b, 2)}`);
    else porKg = esc.porKg;
  }
  // Intervalo: fixo ou escolhido.
  let cadaH: Num | undefined = sp.cadaH;
  if (ehFaixa(sp.cadaH)) {
    const [a, b] = sp.cadaH;
    if (esc.cadaH == null) r.pendencias.push(`Escolha o intervalo entre ${a} e ${b} h`);
    else if (esc.cadaH < a || esc.cadaH > b) r.pendencias.push(`O intervalo escolhido (${esc.cadaH} h) está fora de ${a}–${b} h`);
    else cadaH = esc.cadaH;
  }
  r.porKg = porKg;
  r.cadaH = cadaH;
  if (sp.porDia) {
    r.porDia = mult(porKg, kg);
    if (cadaH != null && !ehFaixa(cadaH) && !ehFaixa(r.porDia)) r.porTomada = r.porDia / (24 / cadaH);
  } else {
    r.porTomada = mult(porKg, kg);
    if (cadaH != null && !ehFaixa(cadaH)) r.porDia = mult(r.porTomada, 24 / cadaH);
  }

  if (tabela.ataque) {
    let ak: Num = tabela.ataque.porKg;
    if (ehFaixa(ak)) {
      const [a, b] = ak;
      if (esc.ataquePorKg == null) r.pendencias.push(`Escolha a dose de ataque entre ${fmt(a, 2)} e ${fmt(b, 2)} ${un}/kg`);
      else if (esc.ataquePorKg < a - 1e-9 || esc.ataquePorKg > b + 1e-9) r.pendencias.push("A dose de ataque escolhida está fora da faixa");
      else ak = esc.ataquePorKg;
    }
    r.ataque = { porKg: ak, total: mult(ak, kg), texto: tabela.ataque.texto };
  }

  if (tabela.maxPorDose != null) {
    const maior = (v?: Num) => (v == null ? 0 : ehFaixa(v) ? v[1] : v);
    if (maior(r.porTomada) > tabela.maxPorDose || maior(r.ataque?.total) > tabela.maxPorDose) r.alertas.push(`Acima da dose máxima de ${fmt(tabela.maxPorDose)} ${un}/dose`);
  }
  if (c.pesoOrigem === "nascimento") r.notas.push("Dose pelo peso de nascimento (peso atual não informado).");

  if (r.pendencias.length === 0 && r.porTomada != null && !ehFaixa(r.porTomada)) {
    const via = tabela.via ?? droga.via.split("/")[0];
    const freq = sp.freqTexto ?? (cadaH != null && !ehFaixa(cadaH) ? intervaloTexto(cadaH) : "");
    const base = sp.porDia ? `${fmtKg(porKg)} ${un}/kg/dia` : `${fmtKg(porKg)} ${un}/kg/dose`;
    const ataque = r.ataque && !ehFaixa(r.ataque.total) ? `ataque ${fmtQtd(r.ataque.total, un)} ${un} (${fmtKg(r.ataque.porKg)} ${un}/kg) ${r.ataque.texto}; depois ` : "";
    r.prescricao = `${droga.nome} ${ataque}${fmtQtd(r.porTomada, un)} ${un} ${via} ${freq} (${base})`.replace(/\s+/g, " ").trim();
  }
  return r;
}

/** Texto curto da dose (para mostrar mesmo com faixa pendente). */
export function resumoDose(r: ResultadoDose): string {
  const un = r.droga.unidade;
  if (r.porTomada == null && r.porDia == null) return "—";
  const freq = r.spec?.freqTexto ?? (r.cadaH != null ? (ehFaixa(r.cadaH) ? `a cada ${r.cadaH[0]}–${r.cadaH[1]} h` : intervaloTexto(r.cadaH)) : "");
  if (r.porTomada != null) return `${fmtNum(r.porTomada, un)} ${un} ${freq}`.trim();
  return `${fmtNum(r.porDia as Num, un)} ${un}/dia ${freq}`.trim();
}
/** Dose da fonte por extenso (para a tabela de referência). */
export function textoSpec(sp: DoseSpec, un: "mg" | "UI"): string {
  const freq = sp.freqTexto ?? (sp.cadaH == null ? "" : ehFaixa(sp.cadaH) ? `a cada ${sp.cadaH[0]}–${sp.cadaH[1]} h` : `a cada ${sp.cadaH} h`);
  return `${fmtKg(sp.porKg)} ${un}/kg/${sp.porDia ? "dia" : "dose"} ${freq}`.trim();
}
export const doseFonteTexto = (r: ResultadoDose) => (r.spec ? `${fmtKg(r.spec.porKg)} ${r.droga.unidade}/kg${r.spec.porDia ? "/dia" : "/dose"}` : "");

// ---------------------------------------------------------------- Duração (SBP 2022 Quadro 4 + PDF de doses)

export type DuracaoId =
  | "sepse_clinica" | "ipcs_agente" | "pneumonia" | "meningite_gp" | "meningite_gn" | "ventriculite" | "osteoarticular"
  | "egb_bacteremia" | "listeria" | "enterobacterales";
export const DURACOES: ReadonlyArray<{ id: DuracaoId; texto: string; dias: readonly [number, number]; fonte: string }> = [
  { id: "sepse_clinica", texto: "Sepse clínica", dias: [5, 7], fonte: "SBP 2022, Quadro 4" },
  { id: "ipcs_agente", texto: "Corrente sanguínea com agente isolado", dias: [7, 10], fonte: "SBP 2022, Quadro 4" },
  { id: "pneumonia", texto: "Pneumonia sem agente isolado", dias: [5, 7], fonte: "SBP 2022, Quadro 4" },
  { id: "meningite_gp", texto: "Meningite por Gram-positivo", dias: [14, 14], fonte: "SBP 2022, Quadro 4" },
  { id: "meningite_gn", texto: "Meningite por Gram-negativo", dias: [21, 21], fonte: "SBP 2022, Quadro 4" },
  { id: "ventriculite", texto: "Ventriculite", dias: [28, 28], fonte: "SBP 2022, Quadro 4 (4 semanas)" },
  { id: "osteoarticular", texto: "Infecção osteoarticular", dias: [28, 28], fonte: "SBP 2022, Quadro 4 (4 semanas)" },
  { id: "egb_bacteremia", texto: "Bacteremia por EGB sem foco", dias: [10, 10], fonte: FONTE_DOSES },
  { id: "listeria", texto: "Bacteremia por Listeria", dias: [10, 14], fonte: FONTE_DOSES },
  { id: "enterobacterales", texto: "Bacteremia por Enterobacterales não complicada", dias: [10, 10], fonte: FONTE_DOSES },
];

const H = 3_600_000;
/** D1 = primeiras 24 h desde a 1ª dose. */
export function diaDoTratamento(inicio: Date, agora: Date): number | null {
  const ms = agora.getTime() - inicio.getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / (24 * H)) + 1;
}
export const somarHoras = (d: Date, h: number) => new Date(d.getTime() + h * H);
export function fmtDataHora(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export interface Cronograma {
  dia: number | null;
  reavaliarDe: Date;
  reavaliarAte: Date;
  duracao?: { texto: string; dias: readonly [number, number]; fimMin: Date; fimMax: Date; fonte: string };
}
export function cronograma(inicio: Date, agora: Date, duracao?: DuracaoId | null): Cronograma {
  const c: Cronograma = { dia: diaDoTratamento(inicio, agora), reavaliarDe: somarHoras(inicio, 36), reavaliarAte: somarHoras(inicio, 48) };
  const du = DURACOES.find((x) => x.id === duracao);
  if (du) c.duracao = { texto: du.texto, dias: du.dias, fimMin: somarHoras(inicio, du.dias[0] * 24), fimMax: somarHoras(inicio, du.dias[1] * 24), fonte: du.fonte };
  return c;
}

// ---------------------------------------------------------------- Reavaliação 36–48 h (SBP 2022, Figura 1)

export interface EntradaReavaliacao {
  culturas?: Culturas | null;
  rnBem?: SimNao | null;
  triagem?: Triagem | null;
}
export function reavaliar(e: EntradaReavaliacao): { pendencias: string[]; conduta?: Conduta } {
  const F1 = `${FONTE_SBP_SEPSE_2022}, Figura 1 (OPAS 2016; AAP 2018)`;
  if (e.culturas == null) return { pendencias: ["Como estão as culturas?"] };
  if (e.culturas === "aguardando") return { pendencias: ["A decisão é com as culturas de 36–48 h de incubação"] };
  if (e.culturas === "positivas") {
    return {
      pendencias: [],
      conduta: { id: "completar", titulo: "Completar o tratamento e adequar", texto: "Adequar ao agente e ao antibiograma, de preferência monoterapia de espectro estreito. Punção lombar, se ainda não feita.", fonte: F1 },
    };
  }
  const p: string[] = [];
  if (e.rnBem == null) p.push("O RN está bem?");
  if (e.triagem == null) p.push("A triagem (hemograma/PCR) está normal ou alterada?");
  if (p.length) return { pendencias: p };
  if (e.rnBem === "sim" && e.triagem === "negativa") {
    return { pendencias: [], conduta: { id: "suspender", titulo: "Suspender o antibiótico em 36–48 h", texto: "Culturas negativas, RN bem e triagem negativa.", fonte: F1 } };
  }
  if (e.rnBem === "nao" && e.triagem === "alterada") {
    return {
      pendencias: [],
      conduta: {
        id: "sepse_clinica",
        titulo: "Sepse clínica: completar o tratamento",
        texto: "Culturas negativas com quadro sugestivo e triagem alterada: completar (5–7 dias) e adequar se necessário. A SBP lembra que manter antibiótico só por clínica + hemograma/PCR deve virar exceção.",
        fonte: F1,
      },
    };
  }
  return {
    pendencias: [],
    conduta: {
      id: "fora",
      titulo: "Fora do fluxograma",
      texto: "Decisão médica. Pela AAP, manter o antibiótico além de 48 h só com sinais clínicos de infecção e cultura positiva, ou com foco (pneumonia, meningite) mesmo sem agente.",
      fonte: FONTE_SBP_SEPSE_2022,
    },
  };
}

/** Orientações de adequação/escalonamento que as fontes trazem. O resto é protocolo do serviço. */
export const ADEQUAR: ReadonlyArray<{ texto: string; fonte: string }> = [
  { texto: "Com cultura e antibiograma: monoterapia de espectro estreito dirigida ao agente.", fonte: "SBP 2022" },
  { texto: "Hemocultura positiva: fazer punção lombar, se ainda não feita.", fonte: "SBP 2022" },
  { texto: "Suspeita ou confirmação de meningite por Gram-negativo: cefalosporina de 3ª ou 4ª geração (cefotaxima ou cefepima). A dose de cefotaxima não está no PDF de doses.", fonte: "SBP 2022" },
  { texto: "Crescimento na hemocultura após 48 h de incubação sugere contaminação.", fonte: "SBP 2022" },
  { texto: "PCR sobe ~24 h após o início da infecção, tem pico em 2–3 dias e normaliza com 5–10 dias de tratamento adequado. PCR inicial alterada que normaliza em 48–72 h, ou PCR seriada normal com boa evolução e hemocultura negativa, sugerem ausência de infecção bacteriana.", fonte: "SBP 2022" },
  { texto: "Escalonar por falha clínica sem cultura (ou sepse tardia): segue o protocolo do hospital/CCIH, que ainda não está cadastrado no app.", fonte: "Pendente" },
];

/** Primeira escolha empírica na sepse precoce. Fonte: SBP 2022 ("Antibioticoterapia empírica"). */
export const EMPIRICO_PRECOCE = { betalactamicos: ["ampicilina", "penicilina_cristalina"] as DrogaId[], aminoglicosideos: ["gentamicina", "amicacina"] as DrogaId[] };

// ---------------------------------------------------------------- Texto

export function textoAntibiotico(p: {
  inicio: Date | null;
  agora: Date;
  doses: ResultadoDose[];
  duracao?: DuracaoId | null;
  historico: EsquemaAnterior[];
}): string {
  const l: string[] = [];
  const cr = p.inicio ? cronograma(p.inicio, p.agora, p.duracao) : null;
  if (p.doses.length) {
    l.push(`Antibiótico${p.inicio ? ` (início ${fmtDataHora(p.inicio)}${cr?.dia ? ` — D${cr.dia}` : ""})` : ""}:`);
    for (const r of p.doses) l.push(`- ${r.prescricao ?? `${r.droga.nome}: ${r.pendencias[0] ?? "completar a dose"}`}`);
    if (cr) l.push(`Reavaliar entre ${fmtDataHora(cr.reavaliarDe)} e ${fmtDataHora(cr.reavaliarAte)} (36–48 h).`);
    if (cr?.duracao) {
      const [a, b] = cr.duracao.dias;
      l.push(
        `Duração prevista: ${a === b ? `${a} dias` : `${a} a ${b} dias`} (${cr.duracao.texto.toLowerCase()}) — até ${a === b ? fmtDataHora(cr.duracao.fimMax) : `${fmtDataHora(cr.duracao.fimMin)}–${fmtDataHora(cr.duracao.fimMax)}`}.`,
      );
    }
  }
  if (p.historico.length) {
    l.push("Esquemas anteriores:");
    for (const h of p.historico) l.push(`- ${h.texto}${h.motivo ? ` — troca: ${h.motivo}` : ""}`);
  }
  return l.join("\n");
}
