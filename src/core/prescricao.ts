/**
 * Prescrição completa: junta o texto de cada aba (dieta, venóclise, antibiótico, fototerapia, suporte respiratório)
 * com o que o médico marca aqui (ambiente, controles, cuidados, outras medicações, exames, outros).
 *
 * REGRA: nada é calculado aqui. Cada linha vem pronta da aba de origem (que tem as fontes) ou é escolha do médico.
 * Controles não têm frequência padrão: o médico escolhe.
 */
export type SecaoId = "dieta" | "venoclise" | "medicacoes" | "respiratorio" | "fototerapia" | "ambiente" | "controles" | "cuidados" | "exames" | "outros";

export const SECOES: ReadonlyArray<{ id: SecaoId; titulo: string; origem: string }> = [
  { id: "dieta", titulo: "Dieta", origem: "aba Dieta" },
  { id: "venoclise", titulo: "Venóclise", origem: "aba Venóclise" },
  { id: "medicacoes", titulo: "Medicações", origem: "aba Antibiótico + aqui" },
  { id: "respiratorio", titulo: "Suporte respiratório", origem: "aba Internação" },
  { id: "fototerapia", titulo: "Fototerapia", origem: "aba Icterícia" },
  { id: "ambiente", titulo: "Ambiente", origem: "aqui (sugestão da aba Venóclise)" },
  { id: "controles", titulo: "Controles", origem: "aqui" },
  { id: "cuidados", titulo: "Cuidados", origem: "aqui" },
  { id: "exames", titulo: "Exames", origem: "aqui" },
  { id: "outros", titulo: "Outros", origem: "aqui" },
];
export const ORDEM_PADRAO: SecaoId[] = SECOES.map((s) => s.id);

export type AmbienteP = "berco_aquecido" | "incubadora" | "incubadora_umida" | "berco_comum" | "alojamento_conjunto";
export const AMBIENTES: ReadonlyArray<{ valor: AmbienteP; texto: string }> = [
  { valor: "berco_aquecido", texto: "Berço aquecido" },
  { valor: "incubadora", texto: "Incubadora" },
  { valor: "incubadora_umida", texto: "Incubadora umidificada" },
  { valor: "berco_comum", texto: "Berço comum" },
  { valor: "alojamento_conjunto", texto: "Alojamento conjunto" },
];
/** Ambiente da aba Venóclise → ambiente da prescrição. */
export const AMBIENTE_DA_VENOCLISE: Record<"incubadora_umida" | "incubadora_seca" | "berco_aquecido", AmbienteP> = {
  incubadora_umida: "incubadora_umida",
  incubadora_seca: "incubadora",
  berco_aquecido: "berco_aquecido",
};

export type ControleId = "ssvv" | "temperatura" | "glicemia" | "diurese" | "balanco" | "peso" | "pa";
export const CONTROLES: ReadonlyArray<{ id: ControleId; texto: string; freqs: readonly string[] }> = [
  { id: "ssvv", texto: "Sinais vitais (FC, FR, SatO₂)", freqs: ["1/1 h", "2/2 h", "3/3 h", "4/4 h", "6/6 h"] },
  { id: "temperatura", texto: "Temperatura axilar", freqs: ["1/1 h", "2/2 h", "3/3 h", "4/4 h", "6/6 h"] },
  { id: "glicemia", texto: "Glicemia capilar", freqs: ["1/1 h", "3/3 h", "6/6 h", "12/12 h", "antes das mamadas"] },
  { id: "diurese", texto: "Diurese", freqs: ["6/6 h", "12/12 h", "24/24 h"] },
  { id: "balanco", texto: "Balanço hídrico", freqs: ["6/6 h", "12/12 h", "24/24 h"] },
  { id: "peso", texto: "Peso", freqs: ["diário"] },
  { id: "pa", texto: "Pressão arterial", freqs: ["4/4 h", "6/6 h", "12/12 h"] },
];

export type CuidadoP = "normotermia" | "cabeceira" | "manuseio" | "canguru" | "aleitamento" | "ordenha" | "ocular" | "cateter" | "intercorrencias";
export const CUIDADOS_P: ReadonlyArray<{ id: CuidadoP; texto: string }> = [
  { id: "normotermia", texto: "Manter normotermia" },
  { id: "cabeceira", texto: "Cabeceira elevada" },
  { id: "manuseio", texto: "Manuseio mínimo" },
  { id: "canguru", texto: "Posição canguru / contato pele a pele" },
  { id: "aleitamento", texto: "Estimular o aleitamento materno" },
  { id: "ordenha", texto: "Estimular a ordenha do leite materno" },
  { id: "ocular", texto: "Proteção ocular durante a fototerapia" },
  { id: "cateter", texto: "Cuidados com o cateter" },
  { id: "intercorrencias", texto: "Comunicar intercorrências ao plantonista" },
];

export interface DadosPrescricao {
  ordem?: SecaoId[];
  /** Ausente = incluída. */
  excluir?: Partial<Record<SecaoId, boolean>>;
  ambiente?: AmbienteP | null;
  controles?: Partial<Record<ControleId, string | null>>;
  cuidados?: Partial<Record<CuidadoP, boolean>>;
  cuidadosOutros?: string;
  medicacoesOutras?: string;
  exames?: string;
  outros?: string;
}
export const PRESCRICAO_INICIAL: DadosPrescricao = {};

/** O que vem das outras abas, já pronto. `pendente` = a aba tem dado, mas falta completar. */
export interface Fontes {
  dieta?: { texto?: string; pendente?: string };
  venoclise?: { texto?: string; pendente?: string };
  antibioticos?: { linhas: string[]; pendente?: string };
  fototerapia?: { texto?: string; pendente?: string };
  respiratorio?: { texto?: string; pendente?: string };
  ambienteVenoclise?: AmbienteP | null;
}

export interface SecaoMontada {
  id: SecaoId;
  titulo: string;
  origem: string;
  /** Cada item vira um número; um item pode ter várias linhas. */
  itens: string[];
  pendente?: string;
  incluida: boolean;
  /** Ambiente veio da venóclise (sugestão). */
  sugestao?: boolean;
}

export interface ResultadoPrescricao {
  secoes: SecaoMontada[];
  texto: string;
}

/** "A; b; c." — minúscula depois do primeiro item gerado pelo app. */
const juntar = (itens: string[]) => itens.map((t, i) => (i === 0 ? t : t.charAt(0).toLowerCase() + t.slice(1))).join("; ") + ".";
const linhas = (t?: string) => (t ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

export function ordemValida(o?: SecaoId[]): SecaoId[] {
  const vistos = new Set<SecaoId>();
  const r: SecaoId[] = [];
  for (const id of [...(o ?? []), ...ORDEM_PADRAO]) {
    if (ORDEM_PADRAO.includes(id) && !vistos.has(id)) {
      vistos.add(id);
      r.push(id);
    }
  }
  return r;
}

export function moverSecao(o: SecaoId[] | undefined, id: SecaoId, delta: -1 | 1): SecaoId[] {
  const a = ordemValida(o);
  const i = a.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= a.length) return a;
  [a[i], a[j]] = [a[j], a[i]];
  return a;
}

export function montarPrescricao(f: Fontes, d: DadosPrescricao, cabecalho: string): ResultadoPrescricao {
  const meta = Object.fromEntries(SECOES.map((s) => [s.id, s])) as Record<SecaoId, (typeof SECOES)[number]>;
  const itensDe = (id: SecaoId): { itens: string[]; pendente?: string; sugestao?: boolean } => {
    switch (id) {
      case "dieta":
        return { itens: f.dieta?.texto ? [f.dieta.texto] : [], pendente: f.dieta?.pendente };
      case "venoclise":
        return { itens: f.venoclise?.texto ? [f.venoclise.texto] : [], pendente: f.venoclise?.pendente };
      case "medicacoes":
        return { itens: [...(f.antibioticos?.linhas ?? []), ...linhas(d.medicacoesOutras)], pendente: f.antibioticos?.pendente };
      case "respiratorio":
        return { itens: f.respiratorio?.texto ? [f.respiratorio.texto] : [], pendente: f.respiratorio?.pendente };
      case "fototerapia":
        return { itens: f.fototerapia?.texto ? [f.fototerapia.texto] : [], pendente: f.fototerapia?.pendente };
      case "ambiente": {
        const amb = d.ambiente ?? f.ambienteVenoclise ?? null;
        const t = AMBIENTES.find((a) => a.valor === amb)?.texto;
        return { itens: t ? [`${t}.`] : [], sugestao: d.ambiente == null && amb != null };
      }
      case "controles": {
        const c = CONTROLES.filter((x) => d.controles?.[x.id]).map((x) => {
          const fr = d.controles?.[x.id] as string;
          return fr === "diário" ? `${x.texto} diário` : fr === "antes das mamadas" ? `${x.texto} antes das mamadas` : `${x.texto} de ${fr}`;
        });
        return { itens: c.length ? [juntar(c)] : [] };
      }
      case "cuidados": {
        const c = CUIDADOS_P.filter((x) => d.cuidados?.[x.id]).map((x) => x.texto);
        const extra = linhas(d.cuidadosOutros);
        return { itens: c.length || extra.length ? [[juntar(c).slice(0, -1), ...extra].filter(Boolean).join("; ") + "."] : [] };
      }
      case "exames":
        return { itens: linhas(d.exames) };
      case "outros":
        return { itens: linhas(d.outros) };
    }
  };

  const secoes: SecaoMontada[] = ordemValida(d.ordem).map((id) => {
    const x = itensDe(id);
    return { id, titulo: meta[id].titulo, origem: meta[id].origem, itens: x.itens, pendente: x.pendente, sugestao: x.sugestao, incluida: !d.excluir?.[id] };
  });

  const corpo: string[] = [];
  let n = 1;
  for (const s of secoes) {
    if (!s.incluida) continue;
    for (const it of s.itens) {
      const [primeira, ...resto] = linhas(it);
      if (!primeira) continue;
      corpo.push(`${n}. ${primeira}`);
      for (const r of resto) corpo.push(`   ${r}`);
      n++;
    }
  }
  return { secoes, texto: corpo.length ? [cabecalho, "", ...corpo].join("\n") : "" };
}

/** Linha do suporte respiratório a partir da aba Internação. */
export function textoRespiratorio(suporte: "ar" | "o2" | "cpap" | "vni" | "vm" | null | undefined, fio2: number | null | undefined): { texto?: string; pendente?: string } {
  if (!suporte || suporte === "ar") return {};
  if (fio2 == null) return { pendente: "Informe a FiO₂ na aba Internação" };
  const f = `FiO₂ ${Math.round(fio2)}%`;
  switch (suporte) {
    case "o2":
      return { texto: `Oxigênio (cateter/capuz), ${f}.` };
    case "cpap":
      return { texto: `CPAP, ${f}.` };
    case "vni":
      return { texto: `Ventilação não invasiva, ${f}.` };
    case "vm":
      return { texto: `Ventilação mecânica, ${f} (parâmetros na evolução).` };
  }
}
