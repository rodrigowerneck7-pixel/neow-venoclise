/**
 * Internação (UCINCo/UTIN): motivos clicáveis, cuidados em uso, critérios de nível de cuidado
 * (Portaria 930/2012) e leitura de exames com fonte.
 *
 * REGRA: o motor não diagnostica nem decide. Ele descreve onde cada valor cai na referência citada,
 * lista os critérios da Portaria que o médico marcou e monta o texto. Sem fonte => o valor é só registrado.
 */
import { interpretarPeso } from "./calculo";
import { GLICEMIA, HIPOCA, K_SERICO, MG_SERICO, NA_ALVO_PLASMA } from "./constantes";
import type { FichaRN } from "./ficha";
import { arredondar, fmt } from "./numeros";
import type { PassoMemoria } from "./tipos";

// ---------------------------------------------------------------- Fontes

export const FONTE_PORTARIA_930 = "Portaria GM/MS nº 930/2012, arts. 10, 16 e 21 (art. 10, V na redação da Portaria nº 3.389/2013)";
export const FONTE_SBP_SEPSE_2022 = "SBP — Sepse neonatal precoce, Documento Científico nº 11, Neonatologia, 15/06/2022";
export const FONTE_SBP_HIPO_2022 = "SBP — Hipoglicemia neonatal, Documento Científico nº 16, Endocrinologia, 09/05/2022";
export const FONTE_NEUTROFILOS = "SBP 2022 (sepse), Quadro 2 — Manroe 1979 (PN > 1,5 kg) e Mouzinho 1994 (PN < 1,5 kg)";
export const FONTE_RODWELL = "Rodwell RL et al. J Pediatr 1988;112:761-7 (PubMed 3361389); interpretação: SBP 2022 (sepse)";
export const FONTE_LIQUOR = "SBP 2022 (sepse), Quadro 1 — Thomson J et al. Pediatrics 2018;141(3):e20173405";
export const FONTE_CID10 = "OMS, CID-10 P07 (prematuridade e baixo peso)";

// ---------------------------------------------------------------- Opções clicáveis

export type MotivoId =
  | "resp" | "risco_infeccioso" | "suspeita_sepse" | "hipoglicemia" | "fmd" | "pig" | "gig" | "ictericia"
  | "asfixia" | "convulsao" | "cardiopatia" | "choque" | "cirurgico" | "policitemia" | "anemia" | "coagulopatia"
  | "baixa_aceitacao";

export const MOTIVOS: ReadonlyArray<{ grupo: string; itens: ReadonlyArray<{ id: MotivoId; texto: string }> }> = [
  { grupo: "Respiratório", itens: [{ id: "resp", texto: "Desconforto respiratório" }] },
  { grupo: "Infeccioso", itens: [{ id: "risco_infeccioso", texto: "Risco infeccioso" }, { id: "suspeita_sepse", texto: "Suspeita de sepse" }] },
  {
    grupo: "Metabólico",
    itens: [
      { id: "hipoglicemia", texto: "Hipoglicemia" },
      { id: "fmd", texto: "Filho de mãe diabética" },
      { id: "pig", texto: "PIG" },
      { id: "gig", texto: "GIG" },
    ],
  },
  { grupo: "Icterícia", itens: [{ id: "ictericia", texto: "Icterícia / hiperbilirrubinemia" }] },
  { grupo: "Neurológico", itens: [{ id: "asfixia", texto: "Asfixia perinatal" }, { id: "convulsao", texto: "Convulsão" }] },
  { grupo: "Cardiovascular", itens: [{ id: "cardiopatia", texto: "Cardiopatia congênita" }, { id: "choque", texto: "Instabilidade hemodinâmica / choque" }] },
  { grupo: "Cirúrgico", itens: [{ id: "cirurgico", texto: "Malformação / condição cirúrgica" }] },
  {
    grupo: "Hematológico",
    itens: [
      { id: "policitemia", texto: "Policitemia" },
      { id: "anemia", texto: "Anemia" },
      { id: "coagulopatia", texto: "Plaquetopenia / distúrbio de coagulação" },
    ],
  },
  { grupo: "Nutrição", itens: [{ id: "baixa_aceitacao", texto: "Baixa aceitação / perda de peso" }] },
];

export const TEXTO_MOTIVO: Record<MotivoId, string> = Object.fromEntries(
  MOTIVOS.flatMap((g) => g.itens.map((i) => [i.id, i.texto])),
) as Record<MotivoId, string>;

export type SuporteResp = "ar" | "o2" | "cpap" | "vni" | "vm";
export const SUPORTES: ReadonlyArray<{ valor: SuporteResp; texto: string }> = [
  { valor: "ar", texto: "Ar ambiente" },
  { valor: "o2", texto: "O₂ (cateter/capuz)" },
  { valor: "cpap", texto: "CPAP" },
  { valor: "vni", texto: "VNI" },
  { valor: "vm", texto: "Ventilação mecânica" },
];

/** Como o suporte aparece no texto ("em CPAP", "em ar ambiente"). */
export const TEXTO_SUPORTE: Record<SuporteResp, string> = { ar: "ar ambiente", o2: "O₂", cpap: "CPAP", vni: "VNI", vm: "ventilação mecânica" };

export type HipoteseResp = "ttrn" | "sdr" | "sam" | "pneumonia" | "pneumotorax" | "apneia";
export const HIPOTESES_RESP: ReadonlyArray<{ id: HipoteseResp; texto: string }> = [
  { id: "ttrn", texto: "Taquipneia transitória" },
  { id: "sdr", texto: "Síndrome do desconforto respiratório" },
  { id: "sam", texto: "Aspiração de mecônio" },
  { id: "pneumonia", texto: "Pneumonia" },
  { id: "pneumotorax", texto: "Pneumotórax" },
  { id: "apneia", texto: "Apneia da prematuridade" },
];

/** Fatores de risco para sepse precoce. Fonte: SBP 2022 (sepse), "Fatores de risco". */
export type FatorSepseId =
  | "tp_pre37" | "bolsa18" | "egb_sem_api" | "corioamnionite" | "febre_materna" | "cerclagem" | "medicina_fetal" | "itu_materna";
export const FATORES_SEPSE: ReadonlyArray<{ id: FatorSepseId; texto: string }> = [
  { id: "tp_pre37", texto: "Trabalho de parto antes de 37 semanas" },
  { id: "bolsa18", texto: "Bolsa rota ≥ 18 h" },
  { id: "egb_sem_api", texto: "EGB positivo sem profilaxia intraparto (quando indicada)" },
  { id: "corioamnionite", texto: "Corioamnionite (infecção intra-amniótica)" },
  { id: "febre_materna", texto: "Febre materna nas 48 h antes do parto" },
  { id: "cerclagem", texto: "Cerclagem ou pessário" },
  { id: "medicina_fetal", texto: "Procedimento de medicina fetal nas 72 h antes do parto" },
  { id: "itu_materna", texto: "ITU materna sem tratamento ou tratada há menos de 72 h" },
];

/** Sinais de sepse clínica. Fonte: SBP 2022 (sepse), Quadro 3 (ANVISA 2017). */
export type SinalSepseId =
  | "instab_termica" | "apneia" | "bradicardia" | "intol_alimentar" | "piora_resp" | "intol_glicose" | "instab_hemod" | "hipoatividade";
export const SINAIS_SEPSE: ReadonlyArray<{ id: SinalSepseId; texto: string }> = [
  { id: "instab_termica", texto: "Instabilidade térmica" },
  { id: "apneia", texto: "Apneia" },
  { id: "bradicardia", texto: "Bradicardia" },
  { id: "intol_alimentar", texto: "Intolerância alimentar" },
  { id: "piora_resp", texto: "Piora do desconforto respiratório" },
  { id: "intol_glicose", texto: "Intolerância à glicose" },
  { id: "instab_hemod", texto: "Instabilidade hemodinâmica" },
  { id: "hipoatividade", texto: "Hipoatividade / letargia" },
];

export type Cirurgia = "grande" | "po_imediato" | "medio_estavel";
export const CIRURGIAS: ReadonlyArray<{ valor: Cirurgia; texto: string }> = [
  { valor: "grande", texto: "Cirurgia de grande porte" },
  { valor: "po_imediato", texto: "PO imediato de cirurgia pequena/média" },
  { valor: "medio_estavel", texto: "Cirurgia média, estável após PO na UTIN" },
];

export type CuidadoId =
  | "npt" | "cvc" | "dva" | "pge" | "atb_grave" | "atb_estavel" | "est" | "transfusao" | "venoclise" | "sonda"
  | "enteral_plena" | "foto_perto_est" | "pos_est" | "estavel" | "pos_utin" | "mae_canguru";
export const CUIDADOS: ReadonlyArray<{ id: CuidadoId; texto: string }> = [
  { id: "npt", texto: "Nutrição parenteral" },
  { id: "cvc", texto: "Cateter venoso central" },
  { id: "dva", texto: "Droga vasoativa" },
  { id: "pge", texto: "Prostaglandina" },
  { id: "atb_grave", texto: "Antibiótico para infecção grave" },
  { id: "atb_estavel", texto: "Antibiótico com quadro infeccioso estável" },
  { id: "est", texto: "Exsanguineotransfusão" },
  { id: "transfusao", texto: "Transfusão por hemólise aguda ou coagulopatia" },
  { id: "venoclise", texto: "Venóclise (hidratação venosa)" },
  { id: "sonda", texto: "Alimentação por sonda" },
  { id: "enteral_plena", texto: "Nutrição enteral plena" },
  { id: "foto_perto_est", texto: "Fototerapia com BT perto da exsanguineotransfusão" },
  { id: "pos_est", texto: "Pós-exsanguineotransfusão: BT caindo, estável" },
  { id: "estavel", texto: "Clinicamente estável" },
  { id: "pos_utin", texto: "Veio da UTIN e ainda precisa de cuidados" },
  { id: "mae_canguru", texto: "Mãe quer e pode ficar (Canguru)" },
];
export const TEXTO_CUIDADO: Record<CuidadoId, string> = Object.fromEntries(CUIDADOS.map((c) => [c.id, c.texto])) as Record<CuidadoId, string>;

// ---------------------------------------------------------------- Dados salvos

export type StatusCultura = "nao_colhida" | "aguardando" | "negativa" | "positiva";
export const STATUS_CULTURA: ReadonlyArray<{ valor: StatusCultura; texto: string }> = [
  { valor: "nao_colhida", texto: "Não colhida" },
  { valor: "aguardando", texto: "Aguardando" },
  { valor: "negativa", texto: "Negativa" },
  { valor: "positiva", texto: "Positiva" },
];

export interface ColetaExames {
  id: string;
  /** "YYYY-MM-DDTHH:mm" (com nascimento no paciente). */
  em?: string | null;
  /** Sem data/hora de nascimento: horas de vida digitadas. */
  horasManual?: number | null;

  glicemia?: number | null;
  glicemiaTipo?: "capilar" | "plasmatica" | null;
  /** RN com sinais de hipoglicemia no momento da glicemia. */
  sintomatico?: boolean;

  /** Hemograma: contagens em /mm³; diferencial em %. */
  leucocitos?: number | null;
  segmentadosPct?: number | null;
  bastoesPct?: number | null;
  metamielocitosPct?: number | null;
  mielocitosPct?: number | null;
  promielocitosPct?: number | null;
  plaquetas?: number | null;
  hb?: number | null;
  ht?: number | null;
  /** Rodwell: alterações degenerativas acentuadas nos neutrófilos (laudo). */
  degenerativas?: boolean;
  /** Rodwell: leucometria alterada para a idade, marcada pelo médico (< 5.000 já conta sozinho). */
  leucometriaAlterada?: boolean;

  pcr?: number | null;
  pcrUnidade?: "mg/dL" | "mg/L" | null;

  na?: number | null;
  k?: number | null;
  caTotal?: number | null;
  caIonico?: number | null;
  mg?: number | null;

  ph?: number | null;
  pco2?: number | null;
  hco3?: number | null;
  be?: number | null;
  lactato?: number | null;

  lcrCelulas?: number | null;
  lcrProteina?: number | null;
  lcrGlicose?: number | null;

  hemocultura?: StatusCultura | null;
  hemoculturaAgente?: string;
  culturaLcr?: StatusCultura | null;
  culturaLcrAgente?: string;

  outros?: string;
}

export interface DadosInternacao {
  motivos: Partial<Record<MotivoId, boolean>>;
  outroMotivo?: string;
  suporte?: SuporteResp | null;
  fio2?: number | null;
  hipoteses?: Partial<Record<HipoteseResp, boolean>>;
  fatoresSepse?: Partial<Record<FatorSepseId, boolean>>;
  sinaisSepse?: Partial<Record<SinalSepseId, boolean>>;
  apgar1?: number | null;
  apgar5?: number | null;
  apgar10?: number | null;
  phCordao?: number | null;
  beCordao?: number | null;
  cirurgia?: Cirurgia | null;
  cuidados: Partial<Record<CuidadoId, boolean>>;
  coletas: ColetaExames[];
}

export const INTERNACAO_INICIAL: DadosInternacao = { motivos: {}, cuidados: {}, coletas: [] };

// ---------------------------------------------------------------- Prematuridade e peso (automáticos da ficha)

export interface ContextoRN {
  igSemanas: number | null;
  igDias: number | null;
  /** Já convertidos para gramas (null se não informado ou aguardando "kg?"). */
  pesoNascimentoG: number | null;
  pesoAtualG: number | null;
  diaDeVida: number | null;
}

/** Peso em gramas a partir da ficha (respeitando a confirmação de "kg?"). */
export function contextoDaFicha(f: FichaRN): ContextoRN {
  const pn = interpretarPeso(f.pesoNascimento, f.confirmouKg?.nascimento);
  const pa = interpretarPeso(f.pesoAtual ?? null, f.confirmouKg?.atual);
  return {
    igSemanas: f.igSemanas,
    igDias: f.igDias ?? null,
    pesoNascimentoG: pn.tipo === "ok" ? pn.gramas : null,
    pesoAtualG: pa.tipo === "ok" ? pa.gramas : null,
    diaDeVida: f.diaDeVida,
  };
}

/** O que a aba Antibiótico usa das coletas: última hemocultura, PCRs, maior Rodwell, líquor fora da referência. */
export function resumoInfeccioso(coletas: ColetaAvaliada[]): {
  hemocultura: string | null;
  hemoculturaPositiva: boolean;
  pcrs: { horas: number | null; mgdl: number }[];
  rodwellMax: number | null;
  liquorAlterado: boolean;
} {
  const ord = [...coletas].sort((a, b) => (a.r.horas ?? Infinity) - (b.r.horas ?? Infinity));
  const comHc = ord.filter((x) => x.coleta.hemocultura);
  const ult = comHc[comHc.length - 1]?.coleta;
  const hemocultura = ult?.hemocultura
    ? ult.hemocultura === "positiva"
      ? `positiva${ult.hemoculturaAgente?.trim() ? ` (${ult.hemoculturaAgente.trim()})` : ""}`
      : (STATUS_CULTURA.find((s) => s.valor === ult.hemocultura)?.texto.toLowerCase() ?? null)
    : null;
  const rods = ord.map((x) => x.r.hemograma?.rodwell.min).filter((v): v is number => v != null);
  return {
    hemocultura,
    hemoculturaPositiva: comHc.some((x) => x.coleta.hemocultura === "positiva"),
    pcrs: ord.filter((x) => x.r.pcrMgDl != null).map((x) => ({ horas: x.r.horas, mgdl: x.r.pcrMgDl as number })),
    rodwellMax: rods.length ? Math.max(...rods) : null,
    liquorAlterado: ord.some((x) => x.r.achados.some((a) => a.exame.startsWith("Líquor") && a.status === "alterado")),
  };
}

/** Rótulos automáticos. Fonte: CID-10 P07 (< 37 sem; < 28 sem; < 2.500, < 1.500, < 1.000 g) e SBP 2022 (pretermo tardio 34–36 6/7). */
export function classificacaoAutomatica(c: ContextoRN): string[] {
  const r: string[] = [];
  if (c.igSemanas != null) {
    const ig = c.igDias ? `${c.igSemanas}s${c.igDias}d` : `${c.igSemanas} sem`;
    if (c.igSemanas < 28) r.push(`Pré-termo extremo (${ig})`);
    else if (c.igSemanas < 34) r.push(`Pré-termo (${ig})`);
    else if (c.igSemanas < 37) r.push(`Pré-termo tardio (${ig})`);
  }
  const pn = c.pesoNascimentoG;
  if (pn != null) {
    const g = `${fmt(pn, 0)} g`;
    if (pn < 1000) r.push(`Extremo baixo peso ao nascer (${g})`);
    else if (pn < 1500) r.push(`Muito baixo peso ao nascer (${g})`);
    else if (pn < 2500) r.push(`Baixo peso ao nascer (${g})`);
  }
  return r;
}

// ---------------------------------------------------------------- Nível de cuidado (Portaria 930/2012)

export type Unidade = "UTIN" | "UCINCo" | "UCINCa";
export interface Criterio {
  unidade: Unidade;
  ref: string;
  texto: string;
}
export interface ResultadoNivel {
  criterios: Criterio[];
  /** A unidade de maior complexidade com algum critério marcado. A decisão é do médico. */
  sugerido: Unidade | null;
  avisos: string[];
  pendencias: string[];
}

export function avaliarNivel(d: DadosInternacao, c: ContextoRN): ResultadoNivel {
  const cr: Criterio[] = [];
  const avisos: string[] = [];
  const pend: string[] = [];
  const cu = d.cuidados ?? {};
  const add = (unidade: Unidade, ref: string, texto: string) => cr.push({ unidade, ref, texto });

  // Peso usado nos arts. 16 e 21 (o texto fala do peso do RN; o art. 10, II fala em peso de nascimento).
  const peso = c.pesoAtualG ?? c.pesoNascimentoG;
  if (c.pesoAtualG == null && c.pesoNascimentoG != null && (c.diaDeVida ?? 1) > 1) {
    avisos.push("Peso atual não informado: os critérios de peso da UCINCo e do Canguru usaram o peso de nascimento.");
  }

  // UTIN — art. 10
  const resp = !!d.motivos.resp;
  // Suporte e FiO2 só valem com o motivo marcado (desmarcar não apaga os campos).
  const suporte = resp ? (d.suporte ?? null) : null;
  const fio2 = resp ? (d.fio2 ?? null) : null;
  if (suporte === "vm") add("UTIN", "art. 10, I", "Ventilação mecânica");
  if (fio2 != null && fio2 > 30 && suporte !== "ar") add("UTIN", "art. 10, I", `Insuficiência respiratória com FiO₂ ${fmt(fio2, 0)}%, acima de 30%`);
  if (c.igSemanas == null) pend.push("IG ao nascer (art. 10, II)");
  else if (c.igSemanas < 30) add("UTIN", "art. 10, II", `IG ao nascer < 30 semanas (${c.igSemanas}s${c.igDias ? `${c.igDias}d` : ""})`);
  if (c.pesoNascimentoG == null) pend.push("peso de nascimento (art. 10, II)");
  else if (c.pesoNascimentoG < 1000) add("UTIN", "art. 10, II", `Peso de nascimento < 1.000 g (${fmt(c.pesoNascimentoG, 0)} g)`);
  if (d.cirurgia === "grande") add("UTIN", "art. 10, III", "Cirurgia de grande porte");
  if (d.cirurgia === "po_imediato") add("UTIN", "art. 10, III", "Pós-operatório imediato de cirurgia de pequeno/médio porte");
  if (cu.npt) add("UTIN", "art. 10, IV", "Nutrição parenteral");
  const v: string[] = [];
  if (cu.cvc) v.push("cateter venoso central");
  if (cu.dva) v.push("droga vasoativa");
  if (cu.pge) v.push("prostaglandina");
  if (cu.atb_grave) v.push("antibiótico para infecção grave");
  if (cu.est) v.push("exsanguineotransfusão");
  if (cu.transfusao) v.push("transfusão por hemólise aguda ou coagulopatia");
  if (v.length) add("UTIN", "art. 10, V", `Cuidados especializados: ${v.join(", ")}`);

  // UCINCo — art. 16
  if (cu.pos_utin) add("UCINCo", "art. 16, I", "Após alta da UTIN, ainda precisa de cuidados complementares");
  if (resp) {
    if (suporte == null) pend.push("suporte respiratório");
    else if (suporte === "o2" && fio2 == null) pend.push("FiO₂ do O₂");
    else if ((suporte === "ar" || suporte === "o2") && !(fio2 != null && fio2 > 30)) {
      add("UCINCo", "art. 16, II", `Desconforto respiratório leve sem VM/CPAP/FiO₂ > 30% (${suporte === "ar" ? "ar ambiente" : `O₂, FiO₂ ${fmt(fio2 as number, 0)}%`})`);
    }
    if ((suporte === "cpap" || suporte === "vni") && !(fio2 != null && fio2 > 30)) {
      if (fio2 == null) pend.push(`FiO₂ no ${suporte === "cpap" ? "CPAP" : "VNI"}`);
      else avisos.push(`${suporte === "cpap" ? "CPAP" : "VNI"} com FiO₂ ≤ 30%: a Portaria não enquadra (não é o art. 10, I, e o art. 16, II exclui CPAP). Decisão do serviço.`);
    }
  }
  if (peso != null && peso > 1000 && peso < 1500) {
    const falta = [!cu.estavel && "estável", !!cu.cvc && "sem acesso central", !cu.enteral_plena && "enteral plena"].filter(Boolean);
    if (falta.length === 0) add("UCINCo", "art. 16, III", `Peso entre 1.000 e 1.500 g (${fmt(peso, 0)} g), estável, sem acesso central, em enteral plena`);
  }
  if (peso != null && peso > 1500) {
    const m = [cu.venoclise && "venóclise", cu.sonda && "sonda", cu.atb_estavel && "antibiótico com quadro estável"].filter(Boolean) as string[];
    if (m.length) add("UCINCo", "art. 16, IV", `Peso > 1.500 g (${fmt(peso, 0)} g) com ${m.join(", ")}`);
  }
  if (cu.foto_perto_est) add("UCINCo", "art. 16, V", "Fototerapia com BT próxima da exsanguineotransfusão");
  if (cu.pos_est) add("UCINCo", "art. 16, VI", "Após exsanguineotransfusão, BT em queda e equilíbrio hemodinâmico");
  if (d.cirurgia === "medio_estavel") add("UCINCo", "art. 16, VII", "Cirurgia de médio porte, estável após PO imediato na UTIN");

  // UCINCa — art. 21 (todos os requisitos juntos)
  if (peso != null && peso > 1250 && cu.estavel && cu.enteral_plena && cu.mae_canguru) {
    add("UCINCa", "art. 21", `Peso > 1.250 g (${fmt(peso, 0)} g), estável, enteral plena, mãe quer e pode participar`);
  }

  const sugerido: Unidade | null = cr.some((x) => x.unidade === "UTIN")
    ? "UTIN"
    : cr.some((x) => x.unidade === "UCINCo")
      ? "UCINCo"
      : cr.some((x) => x.unidade === "UCINCa")
        ? "UCINCa"
        : null;
  return { criterios: cr, sugerido, avisos, pendencias: pend };
}

// ---------------------------------------------------------------- Exames

/** Travas de digitação (não são valores clínicos): fora disso o app pede para conferir. */
export const SANIDADE_EXAMES = {
  glicemia: [1, 1000],
  leucocitos: [300, 200_000],
  plaquetas: [1_000, 2_000_000],
  na: [100, 200],
  k: [1, 12],
  caTotal: [2, 20],
  caIonico: [0.3, 3],
  mg: [0.3, 10],
  pcrMgDlAlto: 30,
  fio2: [21, 100],
} as const;

/** Neutrófilos no RN (/mm³). Fonte: SBP 2022 (sepse), Quadro 2. Índice 0 = PN < 1,5 kg (Mouzinho); 1 = PN > 1,5 kg (Manroe). */
export interface LinhaNeutrofilos {
  h: number;
  neutropenia: readonly [number, number];
  neutrofilia: readonly [number, number];
  imaturos: number;
  it: number;
}
export const NEUTROFILOS_SBP2022: ReadonlyArray<LinhaNeutrofilos> = [
  { h: 0, neutropenia: [500, 1800], neutrofilia: [6300, 5400], imaturos: 1100, it: 0.16 },
  { h: 12, neutropenia: [1800, 7800], neutrofilia: [12400, 14500], imaturos: 1500, it: 0.16 },
  { h: 24, neutropenia: [2200, 7000], neutrofilia: [14000, 12600], imaturos: 1280, it: 0.16 },
  { h: 36, neutropenia: [1800, 5400], neutrofilia: [11600, 10600], imaturos: 1100, it: 0.15 },
  { h: 48, neutropenia: [1100, 3600], neutrofilia: [9000, 8500], imaturos: 850, it: 0.13 },
  { h: 60, neutropenia: [1100, 3000], neutrofilia: [6000, 7200], imaturos: 600, it: 0.13 },
  { h: 72, neutropenia: [1100, 1800], neutrofilia: [6000, 7000], imaturos: 550, it: 0.13 },
  // 120 h e "4º ao 28º dia" têm os mesmos valores na tabela.
  { h: 120, neutropenia: [1100, 1800], neutrofilia: [6000, 5400], imaturos: 500, it: 0.12 },
];
/** Última linha vale até o 28º dia. */
export const NEUTROFILOS_ATE_H = 28 * 24;

/** Linhas da tabela que valem para a hora: a exata, ou as duas vizinhas (entre pontos a tabela não diz). */
export function linhasNeutrofilos(h: number): LinhaNeutrofilos[] {
  if (h < 0 || h > NEUTROFILOS_ATE_H) return [];
  const t = NEUTROFILOS_SBP2022;
  const ultima = t[t.length - 1];
  if (h >= ultima.h) return [ultima];
  const exata = t.find((l) => l.h === h);
  if (exata) return [exata];
  const i = t.findIndex((l) => l.h > h);
  return [t[i - 1], t[i]];
}

/** Colunas de peso: < 1.500 g, > 1.500 g, e as duas se for exatamente 1.500 g (a tabela não define). */
function colunasPeso(pn: number): (0 | 1)[] {
  return pn < 1500 ? [0] : pn > 1500 ? [1] : [0, 1];
}

export type Status = "normal" | "alterado" | "limitrofe" | "info";
export interface Achado {
  exame: string;
  status: Status;
  texto: string;
  fonte?: string;
}

/** Junta a avaliação em todas as linhas/colunas candidatas: todas alteradas, algumas, ou nenhuma. */
function juntar(res: boolean[]): Status {
  const n = res.filter(Boolean).length;
  return n === 0 ? "normal" : n === res.length ? "alterado" : "limitrofe";
}

export interface ItemRodwell {
  texto: string;
  /** 1 = pontua; 0 = não; null = limítrofe (entre pontos da tabela) ou sem dado. */
  pontos: 0 | 1 | null;
  semDado?: boolean;
}
export interface Hemograma {
  neutrofilos: number;
  imaturos: number;
  it: number;
  /** null se não há neutrófilos maduros (divisão por zero). */
  im: number | null;
  linhas: string;
  rodwell: { min: number; max: number; itens: ItemRodwell[] };
  /** Achado do escore (entra depois das plaquetas). */
  achado: Achado;
}

export interface ResultadoColeta {
  horas: number | null;
  pendencias: string[];
  achados: Achado[];
  hemograma?: Hemograma;
  /** PCR em mg/dL (convertida se veio em mg/L). */
  pcrMgDl?: number;
  memoria: PassoMemoria[];
  /** Uma linha para o texto da evolução. */
  resumo: string;
}

export interface ContextoColeta extends ContextoRN {
  horas: number | null;
  /** Grupo de risco do Quadro 2 da SBP (pretermo tardio, PIG, FMD, GIG). */
  grupoRiscoHipo: boolean;
}

const pct = (v?: number | null) => (v == null ? 0 : v);
const n0 = (v: number) => fmt(v, 0);
const fora = (v: number, [a, b]: readonly [number, number]) => v < a || v > b;

export function avaliarColeta(c: ColetaExames, ctx: ContextoColeta): ResultadoColeta {
  const pend: string[] = [];
  const ach: Achado[] = [];
  const mem: PassoMemoria[] = [];
  const partes: string[] = [];
  const h = ctx.horas;
  const r: ResultadoColeta = { horas: h, pendencias: pend, achados: ach, memoria: mem, resumo: "" };

  // ---------- Glicemia
  const g = c.glicemia;
  if (g != null) {
    if (fora(g, SANIDADE_EXAMES.glicemia)) pend.push(`Glicemia ${n0(g)}: confira o valor`);
    else {
      partes.push(`glicemia ${n0(g)} mg/dL${c.glicemiaTipo ? ` (${c.glicemiaTipo === "capilar" ? "capilar" : "plasmática"})` : ""}`);
      if (g < GLICEMIA.hipoMgDl) {
        ach.push({ exame: "Glicemia", status: "alterado", texto: `${n0(g)} mg/dL: hipoglicemia (< 45 mg/dL, critério do app). Tela de hipoglicemia na aba Venóclise.`, fonte: "MS 2014" });
        if (c.glicemiaTipo === "capilar") {
          ach.push({ exame: "Glicemia", status: "info", texto: "Glicemia capilar fica cerca de 10–15% abaixo da plasmática; a hipoglicemia na beira do leito deve ser confirmada pela plasmática.", fonte: FONTE_SBP_HIPO_2022 });
        }
      } else if (g > GLICEMIA.manterAteMgDl) {
        ach.push({ exame: "Glicemia", status: "alterado", texto: `${n0(g)} mg/dL: acima de 175. Ajuste da TIG na aba Venóclise.`, fonte: "MS 2014" });
      } else {
        ach.push({ exame: "Glicemia", status: "normal", texto: `${n0(g)} mg/dL: sem hipoglicemia pelo critério do app (≥ 45).`, fonte: "MS 2014" });
      }
      // Quadro 2 da SBP 2022 (AAP 2011): só nas primeiras 24 h, no grupo de risco.
      if (h != null && h <= 24 && (ctx.grupoRiscoHipo || c.sintomatico)) {
        const q = quadroHipoSbp(g, h, !!c.sintomatico);
        if (q) ach.push({ exame: "Glicemia", status: q.status, texto: q.texto, fonte: `${FONTE_SBP_HIPO_2022}, Quadro 2` });
      }
    }
  }

  // ---------- Hemograma
  const L = c.leucocitos;
  const temDif = c.segmentadosPct != null || c.bastoesPct != null;
  if (L != null && fora(L, SANIDADE_EXAMES.leucocitos)) {
    pend.push(L < SANIDADE_EXAMES.leucocitos[0] ? `Leucócitos ${fmt(L, 1)}: informe em /mm³ (ex.: 12500)` : `Leucócitos ${n0(L)}: confira o valor`);
  } else if (L != null) {
    partes.push(`leucócitos ${n0(L)}`);
    if (L < 5000) ach.push({ exame: "Leucócitos", status: "alterado", texto: `${n0(L)}/mm³: abaixo de 5.000 (achado valorizado).`, fonte: FONTE_SBP_SEPSE_2022 });
    if (temDif) {
      const soma = pct(c.segmentadosPct) + pct(c.bastoesPct) + pct(c.metamielocitosPct) + pct(c.mielocitosPct) + pct(c.promielocitosPct);
      if (c.segmentadosPct == null || c.bastoesPct == null) pend.push("Informe segmentados e bastões (%) para o diferencial");
      else if (soma > 100 + 1e-9) pend.push(`A soma do diferencial de neutrófilos passou de 100% (${fmt(soma, 1)}%)`);
      else {
        const hemo = avaliarHemograma(c, L, ctx, ach, pend, mem);
        if (hemo) {
          r.hemograma = hemo;
          partes.push(`neutrófilos ${n0(hemo.neutrofilos)}; imaturos ${n0(hemo.imaturos)} (I/T ${fmt(hemo.it, 2)}${hemo.im != null ? `; I/M ${fmt(hemo.im, 2)}` : ""})`);
        }
      }
    }
  } else if (temDif) {
    pend.push("Informe os leucócitos totais para calcular neutrófilos e imaturos");
  }
  const P = c.plaquetas;
  if (P != null) {
    if (fora(P, SANIDADE_EXAMES.plaquetas)) pend.push(P < SANIDADE_EXAMES.plaquetas[0] ? `Plaquetas ${fmt(P, 1)}: informe em /mm³ (ex.: 150000)` : `Plaquetas ${n0(P)}: confira o valor`);
    else {
      partes.push(`plaquetas ${n0(P)}`);
      if (P <= 150_000) ach.push({ exame: "Plaquetas", status: "alterado", texto: `${n0(P)}/mm³: ≤ 150.000 (item do escore de Rodwell).`, fonte: FONTE_RODWELL });
    }
  }
  if (r.hemograma) ach.push(r.hemograma.achado);
  if (c.hb != null) partes.push(`Hb ${fmt(c.hb, 1)}`);
  if (c.ht != null) partes.push(`Ht ${fmt(c.ht, 1)}%`);

  // ---------- PCR
  if (c.pcr != null) {
    if (c.pcr < 0) pend.push("PCR negativa: confira o valor");
    else if (!c.pcrUnidade) pend.push("Informe a unidade da PCR (mg/dL ou mg/L)");
    else {
      const mgdl = c.pcrUnidade === "mg/L" ? c.pcr / 10 : c.pcr;
      r.pcrMgDl = mgdl;
      if (c.pcrUnidade === "mg/L") mem.push({ titulo: "PCR em mg/dL", formula: `${fmt(c.pcr, 2)} mg/L ÷ 10`, resultado: `${fmt(mgdl, 2)} mg/dL` });
      if (c.pcrUnidade === "mg/dL" && mgdl > SANIDADE_EXAMES.pcrMgDlAlto) pend.push(`PCR ${fmt(mgdl, 1)} mg/dL é muito alta: confira se não é mg/L`);
      else {
        partes.push(`PCR ${fmt(mgdl, 2)} mg/dL`);
        ach.push(
          mgdl > 1
            ? { exame: "PCR", status: "alterado", texto: `${fmt(mgdl, 2)} mg/dL: acima de 1 mg/dL (10 mg/L). Sozinha não é critério de infecção; vale mais a evolução seriada.`, fonte: FONTE_SBP_SEPSE_2022 }
            : { exame: "PCR", status: "normal", texto: `${fmt(mgdl, 2)} mg/dL: até 1 mg/dL. A PCR sobe cerca de 24 h após o início da infecção.`, fonte: FONTE_SBP_SEPSE_2022 },
        );
      }
    }
  }

  // ---------- Eletrólitos (mesmos critérios da venóclise)
  const pnCa = ctx.pesoNascimentoG;
  if (c.na != null) {
    if (fora(c.na, SANIDADE_EXAMES.na)) pend.push(`Na ${fmt(c.na, 1)}: confira o valor`);
    else {
      partes.push(`Na ${fmt(c.na, 1)}`);
      const [a, b] = NA_ALVO_PLASMA;
      ach.push({ exame: "Sódio", status: c.na < a || c.na > b ? "alterado" : "normal", texto: `${fmt(c.na, 1)} mmol/L: ${c.na < a ? "abaixo" : c.na > b ? "acima" : "dentro"} do alvo ${a}–${b}.`, fonte: "MS 2014" });
    }
  }
  if (c.k != null) {
    if (fora(c.k, SANIDADE_EXAMES.k)) pend.push(`K ${fmt(c.k, 1)}: confira o valor`);
    else {
      partes.push(`K ${fmt(c.k, 1)}`);
      const k = c.k;
      ach.push(
        k < K_SERICO.hipoMmolL
          ? { exame: "Potássio", status: "alterado", texto: `${fmt(k, 1)} mmol/L: hipocalemia (< ${fmt(K_SERICO.hipoMmolL, 1)}).`, fonte: "MS 2014" }
          : k >= K_SERICO.hipercalemiaMmolL
            ? { exame: "Potássio", status: "alterado", texto: `${fmt(k, 1)} mmol/L: hipercalemia (≥ ${fmt(K_SERICO.hipercalemiaMmolL, 1)}). Não adicionar K.`, fonte: "MS 2014" }
            : k >= K_SERICO.bloqueiaMmolL
              ? { exame: "Potássio", status: "limitrofe", texto: `${fmt(k, 1)} mmol/L: ≥ ${fmt(K_SERICO.bloqueiaMmolL, 1)}; a venóclise trava o K.`, fonte: "MS 2014" }
              : { exame: "Potássio", status: "normal", texto: `${fmt(k, 1)} mmol/L.`, fonte: "MS 2014" },
      );
    }
  }
  if (c.caTotal != null || c.caIonico != null) {
    const ruim = (c.caTotal != null && fora(c.caTotal, SANIDADE_EXAMES.caTotal)) || (c.caIonico != null && fora(c.caIonico, SANIDADE_EXAMES.caIonico));
    if (ruim) pend.push("Cálcio: confira o valor (total em mg/dL, iônico em mmol/L)");
    else if (pnCa == null) pend.push("Informe o peso de nascimento para o limite de hipocalcemia");
    else {
      const lim = pnCa < 1500 ? HIPOCA.lt1500 : HIPOCA.ge1500;
      const baixo = (c.caTotal != null && c.caTotal < lim.totalMgDl) || (c.caIonico != null && c.caIonico < lim.ionicoMmolL);
      const v = [c.caTotal != null && `Ca total ${fmt(c.caTotal, 1)} mg/dL`, c.caIonico != null && `Ca iônico ${fmt(c.caIonico, 2)} mmol/L`].filter(Boolean).join(" · ");
      partes.push(v);
      ach.push({ exame: "Cálcio", status: baixo ? "alterado" : "normal", texto: `${v}: ${baixo ? "hipocalcemia" : "sem hipocalcemia"} (limite ${pnCa < 1500 ? "< 1.500 g" : "≥ 1.500 g"}: total < ${fmt(lim.totalMgDl)} ou iônico < ${fmt(lim.ionicoMmolL, 1)}).`, fonte: "MS 2014" });
    }
  }
  if (c.mg != null) {
    if (fora(c.mg, SANIDADE_EXAMES.mg)) pend.push(`Mg ${fmt(c.mg, 1)}: confira o valor`);
    else {
      partes.push(`Mg ${fmt(c.mg, 1)}`);
      const m = c.mg;
      ach.push(
        m < MG_SERICO.graveAbaixoMgDl
          ? { exame: "Magnésio", status: "alterado", texto: `${fmt(m, 1)} mg/dL: hipomagnesemia grave (< ${fmt(MG_SERICO.graveAbaixoMgDl, 1)}).`, fonte: "MS 2014" }
          : m < MG_SERICO.hipoAbaixoMgDl
            ? { exame: "Magnésio", status: "alterado", texto: `${fmt(m, 1)} mg/dL: hipomagnesemia (< ${fmt(MG_SERICO.hipoAbaixoMgDl, 1)}).`, fonte: "MS 2014" }
            : m > MG_SERICO.zerarAcimaMgDl
              ? { exame: "Magnésio", status: "limitrofe", texto: `${fmt(m, 1)} mg/dL: > ${fmt(MG_SERICO.zerarAcimaMgDl, 1)}; a venóclise sugere zerar o Mg.` }
              : { exame: "Magnésio", status: "normal", texto: `${fmt(m, 1)} mg/dL.`, fonte: "MS 2014" },
      );
    }
  }

  // ---------- Gasometria (só registro: sem faixa de referência cadastrada)
  const gaso = [
    c.ph != null && `pH ${fmt(c.ph, 2)}`,
    c.pco2 != null && `pCO₂ ${fmt(c.pco2, 1)}`,
    c.hco3 != null && `HCO₃ ${fmt(c.hco3, 1)}`,
    c.be != null && `BE ${fmt(c.be, 1)}`,
    c.lactato != null && `lactato ${fmt(c.lactato, 1)}`,
  ].filter(Boolean) as string[];
  if (gaso.length) partes.push(`gasometria: ${gaso.join(", ")}`);

  // ---------- Líquor (percentis da referência)
  const temLcr = c.lcrCelulas != null || c.lcrProteina != null || c.lcrGlicose != null;
  if (temLcr) {
    const dias = h != null ? Math.floor(h / 24) : ctx.diaDeVida != null ? ctx.diaDeVida - 1 : null;
    const lp = [
      c.lcrCelulas != null && `células ${fmt(c.lcrCelulas, 1)}`,
      c.lcrProteina != null && `proteína ${fmt(c.lcrProteina, 1)}`,
      c.lcrGlicose != null && `glicose ${fmt(c.lcrGlicose, 1)}`,
    ].filter(Boolean) as string[];
    partes.push(`líquor: ${lp.join(", ")}`);
    if (dias == null) pend.push("Informe a hora da coleta (o líquor é lido pela idade em dias)");
    else {
      const faixa = faixaLiquor(dias);
      if (!faixa) ach.push({ exame: "Líquor", status: "info", texto: `${dias} dias de vida: fora da tabela de referência (até 28 dias). Só registrado.`, fonte: FONTE_LIQUOR });
      else {
        if (c.lcrCelulas != null) ach.push(percentilLiquor("Líquor — células", c.lcrCelulas, "/mm³", LIQUOR_THOMSON.celulas[faixa.i], faixa.texto, "alto"));
        if (c.lcrProteina != null) ach.push(percentilLiquor("Líquor — proteína", c.lcrProteina, "mg/dL", LIQUOR_THOMSON.proteina[faixa.i], faixa.texto, "alto"));
        if (c.lcrGlicose != null) ach.push(percentilLiquor("Líquor — glicose", c.lcrGlicose, "mg/dL", LIQUOR_THOMSON.glicose[faixa.i], faixa.texto, "baixo"));
      }
    }
  }

  // ---------- Culturas
  const cult = (nome: string, s?: StatusCultura | null, agente?: string) => {
    if (!s) return;
    const t = s === "positiva" ? `positiva${agente?.trim() ? ` (${agente.trim()})` : ""}` : STATUS_CULTURA.find((x) => x.valor === s)?.texto.toLowerCase();
    partes.push(`${nome} ${t}`);
    if (s === "positiva") ach.push({ exame: nome[0].toUpperCase() + nome.slice(1), status: "alterado", texto: `Positiva${agente?.trim() ? `: ${agente.trim()}` : " (informe o agente)"}.` });
  };
  cult("hemocultura", c.hemocultura, c.hemoculturaAgente);
  cult("cultura de líquor", c.culturaLcr, c.culturaLcrAgente);
  if (c.hemocultura === "positiva" && h != null) {
    ach.push({ exame: "Hemocultura", status: "info", texto: "Crescimento nas primeiras 48 h de incubação: considerar agente; depois disso sugere contaminação. Com hemocultura positiva, fazer punção lombar se ainda não feita.", fonte: FONTE_SBP_SEPSE_2022 });
  }

  if (c.outros?.trim()) partes.push(c.outros.trim());
  r.resumo = partes.join("; ");
  return r;
}

function avaliarHemograma(c: ColetaExames, L: number, ctx: ContextoColeta, ach: Achado[], pend: string[], mem: PassoMemoria[]): Hemograma | null {
  const seg = pct(c.segmentadosPct);
  const imatPct = pct(c.bastoesPct) + pct(c.metamielocitosPct) + pct(c.mielocitosPct) + pct(c.promielocitosPct);
  const neut = (L * (seg + imatPct)) / 100;
  const imat = (L * imatPct) / 100;
  const maduros = (L * seg) / 100;
  if (neut <= 0) {
    pend.push("Neutrófilos totais = 0: confira o diferencial");
    return null;
  }
  const it = imat / neut;
  const im = maduros > 0 ? imat / maduros : null;
  const naoInf = [c.metamielocitosPct == null && "metamielócitos", c.mielocitosPct == null && "mielócitos", c.promielocitosPct == null && "promielócitos"].filter(Boolean);
  mem.push({
    titulo: "Neutrófilos totais",
    formula: `${n0(L)} × (segmentados ${fmt(seg, 1)}% + imaturos ${fmt(imatPct, 1)}%)`,
    resultado: `${n0(neut)}/mm³`,
  });
  mem.push({
    titulo: "Imaturos (bastões + metamielócitos + mielócitos + promielócitos)",
    formula: `${n0(L)} × ${fmt(imatPct, 1)}%${naoInf.length ? ` · não informados, contados como 0: ${naoInf.join(", ")}` : ""}`,
    resultado: `${n0(imat)}/mm³ · I/T ${fmt(arredondar(it, 3), 3)}${im != null ? ` · I/M ${fmt(arredondar(im, 3), 3)}` : " · I/M: sem maduros"}`,
  });

  if (neut < 2000) ach.push({ exame: "Neutrófilos", status: "alterado", texto: `${n0(neut)}/mm³: abaixo de 2.000 (achado valorizado).`, fonte: FONTE_SBP_SEPSE_2022 });
  if (it > 0.3) ach.push({ exame: "I/T", status: "alterado", texto: `${fmt(it, 2)}: acima de 0,3 (achado valorizado).`, fonte: FONTE_SBP_SEPSE_2022 });

  // Tabela por hora de vida.
  const h = ctx.horas;
  const itens: ItemRodwell[] = [];
  const leucAuto = L < 5000;
  itens.push({ texto: "Leucometria alterada", pontos: leucAuto || c.leucometriaAlterada ? 1 : 0 });
  let linhasTxt = "";
  const linhas = h != null ? linhasNeutrofilos(h) : [];
  if (h == null) {
    pend.push("Informe a hora da coleta para ler neutrófilos, imaturos e I/T pela tabela");
    itens.push({ texto: "Neutrófilos totais alterados", pontos: null, semDado: true }, { texto: "Imaturos aumentados", pontos: null, semDado: true }, { texto: "I/T aumentada", pontos: null, semDado: true });
  } else if (linhas.length === 0) {
    ach.push({ exame: "Neutrófilos", status: "info", texto: "Fora da tabela (após 28 dias de vida): neutrófilos, imaturos e I/T só registrados.", fonte: FONTE_NEUTROFILOS });
    itens.push({ texto: "Neutrófilos totais alterados", pontos: null, semDado: true }, { texto: "Imaturos aumentados", pontos: null, semDado: true }, { texto: "I/T aumentada", pontos: null, semDado: true });
  } else {
    linhasTxt = linhas.length === 1 ? `linha de ${linhas[0].h} h` : `entre as linhas de ${linhas[0].h} h e ${linhas[1].h} h`;
    const rot = (l: LinhaNeutrofilos) => (l.h === 120 ? "≥ 120 h (até 28 dias)" : l.h === 0 ? "nascimento" : `${l.h} h`);
    // Neutrófilos totais: depende do peso de nascimento.
    if (ctx.pesoNascimentoG == null) {
      pend.push("Informe o peso de nascimento (a tabela de neutrófilos depende dele)");
      itens.push({ texto: "Neutrófilos totais alterados", pontos: null, semDado: true });
    } else {
      const cols = colunasPeso(ctx.pesoNascimentoG);
      const baixo = juntar(linhas.flatMap((l) => cols.map((k) => neut < l.neutropenia[k])));
      const alto = juntar(linhas.flatMap((l) => cols.map((k) => neut > l.neutrofilia[k])));
      const lims = linhas.map((l) => `${rot(l)}: < ${n0(Math.min(...cols.map((k) => l.neutropenia[k])))}${cols.length > 1 ? `–${n0(Math.max(...cols.map((k) => l.neutropenia[k])))}` : ""} ou > ${n0(Math.min(...cols.map((k) => l.neutrofilia[k])))}${cols.length > 1 ? `–${n0(Math.max(...cols.map((k) => l.neutrofilia[k])))}` : ""}`).join("; ");
      const st: Status = baixo === "alterado" || alto === "alterado" ? "alterado" : baixo === "limitrofe" || alto === "limitrofe" ? "limitrofe" : "normal";
      const qual = baixo !== "normal" ? "neutropenia" : alto !== "normal" ? "neutrofilia" : "dentro da tabela";
      ach.push({ exame: "Neutrófilos", status: st, texto: `${n0(neut)}/mm³: ${st === "limitrofe" ? `possível ${qual} (entre pontos da tabela)` : qual} (${lims}; PN ${cols.length > 1 ? "= 1.500 g, as duas colunas" : ctx.pesoNascimentoG < 1500 ? "< 1.500 g" : "> 1.500 g"}).`, fonte: FONTE_NEUTROFILOS });
      itens.push({ texto: "Neutrófilos totais alterados", pontos: st === "alterado" ? 1 : st === "limitrofe" ? null : 0 });
    }
    const sImat = juntar(linhas.map((l) => imat > l.imaturos));
    ach.push({ exame: "Imaturos", status: sImat, texto: `${n0(imat)}/mm³: ${sImat === "normal" ? "dentro da tabela" : sImat === "limitrofe" ? "possivelmente aumentados (entre pontos da tabela)" : "aumentados"} (${linhas.map((l) => `${rot(l)}: > ${n0(l.imaturos)}`).join("; ")}).`, fonte: FONTE_NEUTROFILOS });
    itens.push({ texto: "Imaturos aumentados", pontos: sImat === "alterado" ? 1 : sImat === "limitrofe" ? null : 0 });
    const sIt = juntar(linhas.map((l) => it > l.it));
    ach.push({ exame: "I/T", status: sIt, texto: `${fmt(it, 2)}: ${sIt === "normal" ? "dentro da tabela" : sIt === "limitrofe" ? "possivelmente aumentada (entre pontos da tabela)" : "aumentada"} (${linhas.map((l) => `${rot(l)}: > ${fmt(l.it, 2)}`).join("; ")}).`, fonte: FONTE_NEUTROFILOS });
    itens.push({ texto: "I/T aumentada", pontos: sIt === "alterado" ? 1 : sIt === "limitrofe" ? null : 0 });
  }
  itens.push({ texto: "I/M ≥ 0,3", pontos: im == null || im >= 0.3 ? 1 : 0 });
  const P = c.plaquetas;
  const plaqOk = P != null && !fora(P, SANIDADE_EXAMES.plaquetas);
  itens.push(plaqOk ? { texto: "Plaquetas ≤ 150.000", pontos: (P as number) <= 150_000 ? 1 : 0 } : { texto: "Plaquetas ≤ 150.000", pontos: null, semDado: true });
  itens.push({ texto: "Alterações degenerativas nos neutrófilos", pontos: c.degenerativas ? 1 : 0 });

  const min = itens.filter((i) => i.pontos === 1).length;
  const max = min + itens.filter((i) => i.pontos === null).length;
  const placar = min === max ? `${min}` : `${min}–${max}`;
  const status: Status = min >= 3 ? "alterado" : max <= 2 ? "normal" : "limitrofe";
  const rodwell: Achado = {
    exame: "Escore de Rodwell",
    status,
    texto: `${placar} de 7.${status === "alterado" ? " ≥ 3: sensibilidade 96%, especificidade 78%." : status === "normal" ? " ≤ 2: valor preditivo negativo de 99%." : " Pode ficar ≥ 3: complete os itens sem dado."}`,
    fonte: FONTE_RODWELL,
  };
  return { neutrofilos: neut, imaturos: imat, it, im, linhas: linhasTxt, rodwell: { min, max, itens }, achado: rodwell };
}

/** Quadro 2 da SBP 2022 (adaptado da AAP 2011): triagem nas primeiras 24 h de pretermo tardio, PIG, FMD e GIG. */
export function quadroHipoSbp(g: number, h: number, sintomatico: boolean): { status: Status; texto: string } | null {
  if (h > 24) return null;
  if (sintomatico && g < 40) return { status: "alterado", texto: "Sintomático com glicemia < 40 mg/dL: glicose EV." };
  if (sintomatico) return { status: "info", texto: "Sintomático: o Quadro 2 indica glicose EV abaixo de 40 mg/dL." };
  const ate4 = h < 4;
  const corte = ate4 ? 25 : 35;
  const faixaAlta = ate4 ? 40 : 45;
  const periodo = ate4 ? "primeiras 4 h" : "4 a 24 h";
  if (g < corte) {
    return { status: "alterado", texto: `Assintomático, ${periodo}, < ${corte} mg/dL: repetir a dieta e nova glicemia em 1 h. Se a de controle ficar < ${corte}: glicose EV; se ${corte}–${faixaAlta}: realimentar ou glicose EV se necessário.` };
  }
  if (g < 45) {
    return { status: "limitrofe", texto: `Assintomático, ${periodo}: abaixo do esperado (≥ 45 mg/dL antes das dietas). Na glicemia de controle, ${corte}–${faixaAlta} mg/dL: realimentar ou glicose EV se necessário.` };
  }
  return { status: "normal", texto: `Assintomático, ${periodo}: dentro do esperado (≥ 45 mg/dL antes das dietas).` };
}

/** Líquor: percentis P5…P95 por idade (7, 14, 21, 28 dias). Fonte: SBP 2022 (sepse), Quadro 1 (Thomson 2018). */
export const PERCENTIS = ["P5", "P10", "P15", "P25", "P50", "P75", "P85", "P90", "P95"] as const;
export const LIQUOR_THOMSON = {
  celulas: [
    [0.7, 1.3, 1.7, 2.6, 5.0, 8.7, 11.6, 14.2, 19.1],
    [0.6, 1.0, 1.4, 2.1, 4.0, 7.0, 9.5, 11.6, 16.0],
    [0.4, 0.8, 1.1, 1.8, 3.4, 5.9, 8.0, 9.9, 13.7],
    [0.3, 0.7, 1.0, 1.6, 3.0, 5.2, 7.0, 8.6, 11.9],
  ],
  proteina: [
    [47.0, 52.9, 57.2, 64.0, 78.4, 96.0, 107.4, 116.0, 130.7],
    [39.6, 44.8, 48.5, 54.3, 66.9, 82.4, 92.4, 100.1, 103.1],
    [34.9, 39.6, 43.0, 48.4, 60.0, 74.3, 83.7, 90.9, 103.1],
    [32.1, 36.6, 39.8, 45.0, 56.2, 70.2, 79.3, 86.3, 98.4],
  ],
  glicose: [
    [34.7, 36.8, 38.2, 40.4, 44.9, 50.2, 53.6, 56.2, 60.6],
    [34.7, 36.7, 38.1, 40.3, 44.6, 49.8, 53.0, 55.5, 59.7],
    [34.8, 36.8, 38.1, 40.2, 44.5, 49.5, 52.7, 55.1, 59.2],
    [35.2, 37.1, 38.5, 40.6, 44.8, 49.8, 53.0, 55.4, 59.5],
  ],
} as const;

/** Idade em dias completos → linha 7/14/21/28 (0–7, 8–14, 15–21, 22–28). Ver DIVERGENCIAS (u). */
export function faixaLiquor(dias: number): { i: number; texto: string } | null {
  if (dias < 0 || dias > 28) return null;
  if (dias <= 7) return { i: 0, texto: "0–7 dias" };
  if (dias <= 14) return { i: 1, texto: "8–14 dias" };
  if (dias <= 21) return { i: 2, texto: "15–21 dias" };
  return { i: 3, texto: "22–28 dias" };
}

function percentilLiquor(exame: string, v: number, un: string, linha: readonly number[], faixa: string, ruim: "alto" | "baixo"): Achado {
  const p95 = linha[8], p5 = linha[0];
  let pos: string;
  if (v > p95) pos = `acima do P95 (${fmt(p95, 1)})`;
  else if (v < p5) pos = `abaixo do P5 (${fmt(p5, 1)})`;
  else {
    let i = 0;
    while (i < 8 && v >= linha[i + 1]) i++;
    pos = v === linha[i] ? `no ${PERCENTIS[i]}` : `entre ${PERCENTIS[i]} (${fmt(linha[i], 1)}) e ${PERCENTIS[i + 1]} (${fmt(linha[i + 1], 1)})`;
  }
  const alterado = ruim === "alto" ? v > p95 : v < p5;
  return { exame, status: alterado ? "alterado" : "normal", texto: `${fmt(v, 1)} ${un}: ${pos} para ${faixa}.`, fonte: FONTE_LIQUOR };
}

// ---------------------------------------------------------------- Texto

export interface ColetaAvaliada {
  coleta: ColetaExames;
  r: ResultadoColeta;
  /** Rótulo da data/hora (ex.: "07/11 08:00"). */
  quando: string;
}

export function textoInternacao(d: DadosInternacao, c: ContextoRN, nivel: ResultadoNivel, coletas: ColetaAvaliada[]): string {
  const linhas: string[] = [];
  const mot: string[] = [...classificacaoAutomatica(c)];
  for (const g of MOTIVOS) {
    for (const it of g.itens) {
      if (!d.motivos[it.id]) continue;
      if (it.id === "resp") {
        const sup = d.suporte ? TEXTO_SUPORTE[d.suporte] : null;
        const hip = HIPOTESES_RESP.filter((x) => d.hipoteses?.[x.id]).map((x) => x.texto.toLowerCase());
        mot.push(
          `Desconforto respiratório${sup ? ` em ${sup}` : ""}${d.fio2 != null && d.suporte !== "ar" ? `, FiO₂ ${fmt(d.fio2, 0)}%` : ""}${hip.length ? ` (hipótese: ${hip.join(", ")})` : ""}`,
        );
      } else if (it.id === "risco_infeccioso") {
        const f = FATORES_SEPSE.filter((x) => d.fatoresSepse?.[x.id]).map((x) => x.texto.toLowerCase());
        mot.push(`Risco infeccioso${f.length ? `: ${f.join("; ")}` : ""}`);
      } else if (it.id === "suspeita_sepse") {
        const s = SINAIS_SEPSE.filter((x) => d.sinaisSepse?.[x.id]).map((x) => x.texto.toLowerCase());
        mot.push(`Suspeita de sepse${s.length ? ` (${s.join(", ")})` : ""}`);
      } else if (it.id === "asfixia") {
        const a = [
          d.apgar1 != null && `Apgar 1' ${d.apgar1}`,
          d.apgar5 != null && `5' ${d.apgar5}`,
          d.apgar10 != null && `10' ${d.apgar10}`,
          d.phCordao != null && `pH ${fmt(d.phCordao, 2)}`,
          d.beCordao != null && `BE ${fmt(d.beCordao, 1)}`,
        ].filter(Boolean);
        mot.push(`Asfixia perinatal${a.length ? ` (${a.join(", ")})` : ""}`);
      } else if (it.id === "cirurgico") {
        const ci = CIRURGIAS.find((x) => x.valor === d.cirurgia)?.texto.toLowerCase();
        mot.push(`Malformação / condição cirúrgica${ci ? ` (${ci})` : ""}`);
      } else mot.push(it.texto);
    }
  }
  if (d.outroMotivo?.trim()) mot.push(d.outroMotivo.trim());
  linhas.push(`Motivos de internação: ${mot.length ? mot.join("; ") : "não informados"}.`);

  const cu = CUIDADOS.filter((x) => d.cuidados?.[x.id] && x.id !== "estavel" && x.id !== "mae_canguru" && x.id !== "pos_utin").map((x) => x.texto.toLowerCase());
  if (d.cuidados?.estavel) cu.unshift("clinicamente estável");
  if (cu.length) linhas.push(`Cuidados: ${cu.join("; ")}.`);

  if (nivel.criterios.length) {
    const porUnidade = (["UTIN", "UCINCo", "UCINCa"] as Unidade[])
      .map((u) => {
        const l = nivel.criterios.filter((x) => x.unidade === u);
        return l.length ? `${u} — ${l.map((x) => `${x.ref}: ${x.texto.charAt(0).toLowerCase()}${x.texto.slice(1)}`).join("; ")}` : null;
      })
      .filter(Boolean);
    linhas.push(`Critérios da Portaria 930/2012: ${porUnidade.join(" | ")}.`);
  }

  const comExame = coletas.filter((x) => x.r.resumo);
  if (comExame.length) {
    linhas.push("Exames:");
    for (const x of comExame) {
      const hh = x.r.horas != null ? ` (${fmt(Math.floor(x.r.horas), 0)} h de vida)` : "";
      const rod = x.r.hemograma ? `; Rodwell ${x.r.hemograma.rodwell.min === x.r.hemograma.rodwell.max ? x.r.hemograma.rodwell.min : `${x.r.hemograma.rodwell.min}–${x.r.hemograma.rodwell.max}`}` : "";
      linhas.push(`${x.quando}${hh}: ${x.r.resumo}${rod}.`);
    }
  }
  return linhas.join("\n");
}

/** Valores da coleta que a venóclise usa (para o botão "Levar para a venóclise"). */
export function labsParaVenoclise(c: ColetaExames): { glicemia?: number; na?: number; k?: number; caTotal?: number; caIonico?: number; mg?: number } {
  const o: Record<string, number> = {};
  const ok = (v: number | null | undefined, f: readonly [number, number]) => v != null && !fora(v, f);
  if (ok(c.glicemia, SANIDADE_EXAMES.glicemia)) o.glicemia = c.glicemia as number;
  if (ok(c.na, SANIDADE_EXAMES.na)) o.na = c.na as number;
  if (ok(c.k, SANIDADE_EXAMES.k)) o.k = c.k as number;
  if (ok(c.caTotal, SANIDADE_EXAMES.caTotal)) o.caTotal = c.caTotal as number;
  if (ok(c.caIonico, SANIDADE_EXAMES.caIonico)) o.caIonico = c.caIonico as number;
  if (ok(c.mg, SANIDADE_EXAMES.mg)) o.mg = c.mg as number;
  return o;
}
