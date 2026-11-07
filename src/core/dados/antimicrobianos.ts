/**
 * Doses dos antimicrobianos na neonatologia.
 * Fonte: PDF do serviço "Doses dos antimicrobianos na NEONATOLOGIA — Atualizado pelo UpToDate 2025" (19 páginas),
 * enviado pelo Rodrigo em 07/11/2026. As tabelas são imagens no PDF: cada página foi renderizada e transcrita
 * à mão; os testes (antibiotico.test.ts) conferem linha a linha com o PDF.
 *
 * Convenções (ver DIVERGENCIAS y):
 * - ig = idade gestacional ao nascer, em semanas completas; pma = idade pós-menstrual em semanas completas;
 * - pna = idade pós-natal em dias completos (D1 = 0 dias); peso em gramas; cr = creatinina sérica em mg/dL.
 * - Uma faixa {de, ate} inclui as pontas, a não ser que deExcl/ateExcl digam o contrário.
 */

export interface Faixa {
  de?: number;
  ate?: number;
  deExcl?: boolean;
  ateExcl?: boolean;
}
export type Eixo = "ig" | "pma" | "pna" | "peso" | "cr";

export interface DoseSpec {
  /** mg/kg (ou UI/kg) por dose — ou por dia, se `porDia`. Faixa = o médico escolhe dentro. */
  porKg: number | readonly [number, number];
  /** Intervalo em horas. Faixa = o médico escolhe. */
  cadaH?: number | readonly [number, number];
  /** Frequência que não cabe em horas (ex.: "2 vezes por semana"). */
  freqTexto?: string;
  /** `porKg` é por dia, dividido no intervalo. */
  porDia?: boolean;
}

export interface LinhaDose {
  quando: Partial<Record<Eixo, Faixa>>;
  rotulo: string;
  dose: DoseSpec;
}

export interface TabelaDose {
  id: string;
  /** Tabelas do mesmo grupo são alternativas do PDF para a mesma situação (ex.: pela IG × pelo peso). */
  grupo: string;
  titulo: string;
  linhas: LinhaDose[];
  ataque?: { porKg: number | readonly [number, number]; texto: string };
  /** Dose máxima por dose (mesma unidade). */
  maxPorDose?: number;
  /** Via desta tabela, quando difere da via da droga (ex.: "VO"). */
  via?: string;
  nota?: string;
}

export type DrogaId =
  | "amicacina" | "ampicilina" | "anfotericina_b" | "anfotericina_lipo" | "cefepima" | "ciprofloxacino" | "clindamicina"
  | "fluconazol" | "gentamicina" | "linezolida" | "meropenem" | "metronidazol" | "micafungina" | "oxacilina"
  | "penicilina_cristalina" | "piperacilina_tazobactam" | "polimixina_b" | "teicoplanina" | "tigeciclina" | "vancomicina";

export interface Droga {
  id: DrogaId;
  nome: string;
  unidade: "mg" | "UI";
  via: string;
  /** Página do PDF. */
  pagina: string;
  tabelas: TabelaDose[];
  notas?: string[];
  /** Alerta de uso restrito que o PDF destaca. */
  alerta?: string;
  /** Aminoglicosídeo/vancomicina: lembrar do ajuste renal do PDF. */
  renal?: string;
}

const lt = (n: number): Faixa => ({ ate: n, ateExcl: true });
const le = (n: number): Faixa => ({ ate: n });
const gt = (n: number): Faixa => ({ de: n, deExcl: true });
const ge = (n: number): Faixa => ({ de: n });
const ab = (a: number, b: number): Faixa => ({ de: a, ate: b });
const d = (porKg: DoseSpec["porKg"], cadaH: DoseSpec["cadaH"]): DoseSpec => ({ porKg, cadaH });

const RENAL_AMINO =
  "Débito urinário < 1 mL/kg/h ou creatinina subindo bastante: considerar dose única com nível sérico em vez da dose programada.";

export const ANTIMICROBIANOS: ReadonlyArray<Droga> = [
  {
    id: "amicacina",
    nome: "Amicacina",
    unidade: "mg",
    via: "IV/IM",
    pagina: "1",
    renal: RENAL_AMINO,
    notas: ["Meningite: usar doses menores e intervalos mais longos em < 2 kg; PNA ≤ 7 dias e ≥ 2 kg: 7,5–10 mg/kg a cada 12 h; PNA > 7 dias e ≥ 2 kg: 10 mg/kg a cada 8 h."],
    tabelas: [
      {
        id: "idade",
        grupo: "geral",
        titulo: "Pela idade",
        linhas: [
          { quando: { ig: lt(30), pna: le(14) }, rotulo: "IG < 30 sem, PNA ≤ 14 d", dose: d(15, 48) },
          { quando: { ig: lt(30), pna: gt(14) }, rotulo: "IG < 30 sem, PNA > 14 d", dose: d(15, 36) },
          { quando: { ig: ab(30, 34), pna: le(10) }, rotulo: "IG 30–34 sem, PNA ≤ 10 d", dose: d(15, 36) },
          { quando: { ig: ab(30, 34), pna: ab(11, 60) }, rotulo: "IG 30–34 sem, PNA 11–60 d", dose: d(15, 24) },
          { quando: { ig: ge(35), pna: le(7) }, rotulo: "IG ≥ 35 sem, PNA ≤ 7 d", dose: d(15, 24) },
          { quando: { ig: ge(35), pna: ab(8, 60) }, rotulo: "IG ≥ 35 sem, PNA 8–60 d", dose: d([17.5, 18], 24) },
        ],
      },
    ],
  },
  {
    id: "ampicilina",
    nome: "Ampicilina",
    unidade: "mg",
    via: "IV/IM",
    pagina: "2–3",
    notas: [
      "Empírica: suspender quando as hemoculturas estão estéreis em 36–48 h de incubação, salvo infecção localizada.",
      "Duração (confirmada): bacteremia por EGB sem foco 10 dias; Listeria 10–14 dias; Enterobacterales não complicada 10 dias; osteoarticular por EGB 3–4 semanas; endocardite por EGB ≥ 4 semanas.",
    ],
    tabelas: [
      {
        id: "ig",
        grupo: "geral",
        titulo: "Geral — pela idade gestacional",
        linhas: [
          { quando: { ig: le(34), pna: le(7) }, rotulo: "IG ≤ 34 sem, PNA ≤ 7 d", dose: d(50, 12) },
          { quando: { ig: le(34), pna: ab(8, 28) }, rotulo: "IG ≤ 34 sem, PNA 8–28 d", dose: d(75, 12) },
          { quando: { ig: gt(34), pna: le(28) }, rotulo: "IG > 34 sem, PNA ≤ 28 d", dose: d(50, 8) },
        ],
      },
      {
        id: "peso",
        grupo: "geral",
        titulo: "Geral — pelo peso",
        linhas: [
          { quando: { peso: le(2000), pna: le(7) }, rotulo: "≤ 2 kg, PNA ≤ 7 d", dose: d(50, 12) },
          { quando: { peso: le(2000), pna: ab(8, 28) }, rotulo: "≤ 2 kg, PNA 8–28 d", dose: d(75, 12) },
          { quando: { peso: le(2000), pna: ab(29, 60) }, rotulo: "≤ 2 kg, PNA 29–60 d", dose: d(50, 6) },
          { quando: { peso: gt(2000), pna: le(28) }, rotulo: "> 2 kg, PNA ≤ 28 d", dose: d(50, 8) },
          { quando: { peso: gt(2000), pna: ab(29, 60) }, rotulo: "> 2 kg, PNA 29–60 d", dose: d(50, 6) },
        ],
      },
      {
        id: "meningite",
        grupo: "meningite",
        titulo: "Meningite — empírica ou estreptococo não do grupo B",
        nota: "Gram-negativo ou Listeria: tratar ≥ 21 dias.",
        linhas: [
          { quando: { ig: le(34), pna: le(7) }, rotulo: "IG ≤ 34 sem, PNA ≤ 7 d", dose: d(50, 12) },
          { quando: { ig: le(34), pna: ab(8, 28) }, rotulo: "IG ≤ 34 sem, PNA 8–28 d", dose: d(75, 12) },
          { quando: { ig: gt(34), pna: le(28) }, rotulo: "IG > 34 sem, PNA ≤ 28 d", dose: d(50, 8) },
        ],
      },
      {
        id: "meningite_egb",
        grupo: "meningite_egb",
        titulo: "Meningite por estreptococo do grupo B",
        nota: "Não complicada: 14 dias; ventriculite: ≥ 4 semanas.",
        linhas: [
          { quando: { ig: le(34), pna: le(7) }, rotulo: "IG ≤ 34 sem, PNA ≤ 7 d", dose: d(100, 8) },
          { quando: { ig: le(34), pna: ab(8, 60) }, rotulo: "IG ≤ 34 sem, PNA 8–60 d", dose: d(75, 6) },
          { quando: { ig: gt(34), pna: le(7) }, rotulo: "IG > 34 sem, PNA ≤ 7 d", dose: d(100, 8) },
          { quando: { ig: gt(34), pna: ab(8, 60) }, rotulo: "IG > 34 sem, PNA 8–60 d", dose: d(75, 6) },
        ],
      },
    ],
  },
  {
    id: "anfotericina_b",
    nome: "Anfotericina B desoxicolato",
    unidade: "mg",
    via: "IV",
    pagina: "4",
    notas: ["A dose pode subir para 1,5 mg/kg/dia, conforme a clínica.", "Em prematuros extremos, Na > 4 mEq/kg/dia pode reduzir a nefrotoxicidade."],
    tabelas: [{ id: "geral", grupo: "geral", titulo: "Geral", linhas: [{ quando: {}, rotulo: "Pré-termo e termo", dose: d(1, 24) }] }],
  },
  {
    id: "anfotericina_lipo",
    nome: "Anfotericina B lipossomal",
    unidade: "mg",
    via: "IV",
    pagina: "4",
    notas: ["O PDF traz a dose para bebês, crianças e adolescentes (sem linha específica para RN)."],
    tabelas: [{ id: "geral", grupo: "geral", titulo: "Geral", linhas: [{ quando: {}, rotulo: "Bebês, crianças e adolescentes", dose: d([3, 5], 24) }] }],
  },
  {
    id: "cefepima",
    nome: "Cefepima",
    unidade: "mg",
    via: "IV",
    pagina: "5",
    notas: [
      "PNA < 30 d: preferir o limite inferior em menos maduros (inclusive PNA < 14 d) e/ou patógeno mais sensível (CIM < 4 mg/L).",
      "CIM ≥ 8 mg/L: pode ser preciso infundir em 3 h ou dar a cada 6 h.",
    ],
    tabelas: [
      {
        id: "pna",
        grupo: "geral",
        titulo: "Geral — pela idade pós-natal",
        linhas: [
          { quando: { pna: lt(30) }, rotulo: "PNA < 30 d", dose: d([30, 50], 12) },
          { quando: { pna: ge(30) }, rotulo: "PNA ≥ 30 d", dose: d(50, 8) },
        ],
      },
      {
        id: "peso",
        grupo: "geral",
        titulo: "Geral — pelo peso",
        linhas: [
          { quando: { peso: le(2000), pna: le(28) }, rotulo: "≤ 2 kg, PNA ≤ 28 d", dose: d(30, 12) },
          { quando: { peso: le(2000), pna: ab(29, 60) }, rotulo: "≤ 2 kg, PNA 29–60 d", dose: d(50, 8) },
          { quando: { peso: gt(2000), pna: le(28) }, rotulo: "> 2 kg, PNA ≤ 28 d", dose: d(50, 12) },
          { quando: { peso: gt(2000), pna: ab(29, 60) }, rotulo: "> 2 kg, PNA 29–60 d", dose: d(50, 8) },
        ],
      },
    ],
  },
  {
    id: "ciprofloxacino",
    nome: "Ciprofloxacino",
    unidade: "mg",
    via: "IV",
    pagina: "5",
    alerta: "Não é primeira linha: só sem substituto seguro e eficaz (resistência, alergia). Dados limitados em RN.",
    tabelas: [
      {
        id: "pma",
        grupo: "geral",
        titulo: "Agente alternativo para resistentes — pela idade pós-menstrual",
        linhas: [
          { quando: { pma: lt(34) }, rotulo: "PMA < 34 sem", dose: d([7.5, 10], 12) },
          { quando: { pma: ge(34) }, rotulo: "PMA ≥ 34 sem", dose: d([10, 15], 12) },
        ],
      },
    ],
  },
  {
    id: "clindamicina",
    nome: "Clindamicina",
    unidade: "mg",
    via: "IV",
    pagina: "6",
    tabelas: [
      {
        id: "pma",
        grupo: "geral",
        titulo: "Pela idade pós-menstrual",
        linhas: [
          { quando: { pma: le(32) }, rotulo: "PMA ≤ 32 sem", dose: d(5, 8) },
          { quando: { pma: { de: 32, deExcl: true, ate: 40 } }, rotulo: "PMA > 32 a 40 sem", dose: d(7, 8) },
          { quando: { pma: gt(40) }, rotulo: "PMA > 40 sem", dose: d(9, 8) },
        ],
      },
      {
        id: "peso",
        grupo: "geral",
        titulo: "Pelo peso",
        linhas: [
          { quando: { peso: le(2000), pna: le(28) }, rotulo: "≤ 2 kg, PNA ≤ 28 d", dose: d(5, 8) },
          { quando: { peso: le(2000), pna: ab(29, 60) }, rotulo: "≤ 2 kg, PNA 29–60 d", dose: d(10, 8) },
          { quando: { peso: gt(2000), pna: le(7) }, rotulo: "> 2 kg, PNA ≤ 7 d", dose: d(7, 8) },
          { quando: { peso: gt(2000), pna: ab(8, 28) }, rotulo: "> 2 kg, PNA 8–28 d", dose: d(9, 8) },
          { quando: { peso: gt(2000), pna: ab(29, 60) }, rotulo: "> 2 kg, PNA 29–60 d", dose: d(10, 8) },
        ],
      },
    ],
  },
  {
    id: "fluconazol",
    nome: "Fluconazol",
    unidade: "mg",
    via: "IV/VO",
    pagina: "8",
    tabelas: [
      { id: "tratamento", grupo: "tratamento", titulo: "Tratamento", ataque: { porKg: 25, texto: "no dia 1" }, linhas: [{ quando: {}, rotulo: "Do dia 2 em diante", dose: d(12, 24) }] },
      { id: "profilaxia", grupo: "profilaxia", titulo: "Profilaxia", linhas: [{ quando: {}, rotulo: "Pré-termo e termo", dose: { porKg: [3, 6], freqTexto: "2 vezes por semana" } }] },
    ],
  },
  {
    id: "gentamicina",
    nome: "Gentamicina",
    unidade: "mg",
    via: "IV/IM",
    pagina: "7",
    renal: RENAL_AMINO,
    notas: ["Se CIM ≥ 1 mg/L, podem ser precisas doses maiores e outros intervalos."],
    tabelas: [
      {
        id: "idade",
        grupo: "geral",
        titulo: "Pela idade",
        linhas: [
          { quando: { ig: lt(30), pna: le(14) }, rotulo: "IG < 30 sem, PNA ≤ 14 d", dose: d(5, 48) },
          { quando: { ig: lt(30), pna: ge(15) }, rotulo: "IG < 30 sem, PNA ≥ 15 d", dose: d(5, 36) },
          { quando: { ig: ab(30, 34), pna: le(10) }, rotulo: "IG 30–34 sem, PNA ≤ 10 d", dose: d(5, 36) },
          { quando: { ig: ab(30, 34), pna: ab(11, 60) }, rotulo: "IG 30–34 sem, PNA 11–60 d", dose: d(5, 24) },
          { quando: { ig: ge(35), pna: le(7) }, rotulo: "IG ≥ 35 sem, PNA ≤ 7 d", dose: d(4, 24) },
          { quando: { ig: ge(35), pna: ab(8, 60) }, rotulo: "IG ≥ 35 sem, PNA 8–60 d", dose: d(5, 24) },
        ],
      },
    ],
  },
  {
    id: "linezolida",
    nome: "Linezolida",
    unidade: "mg",
    via: "IV/VO",
    pagina: "9",
    alerta: "Toxicidade hematológica e neurológica grave aumenta após 2 e 4 semanas de uso: preferir alternativas em terapia longa.",
    tabelas: [
      {
        id: "idade",
        grupo: "geral",
        titulo: "Geral",
        linhas: [
          { quando: { ig: lt(34), pna: le(7) }, rotulo: "IG < 34 sem, PNA ≤ 7 d", dose: d(10, 12) },
          { quando: { ig: lt(34), pna: gt(7) }, rotulo: "IG < 34 sem, PNA > 7 d", dose: d(10, 8) },
          { quando: { ig: ge(34) }, rotulo: "IG ≥ 34 sem", dose: d(10, 8) },
        ],
      },
    ],
  },
  {
    id: "meropenem",
    nome: "Meropenem",
    unidade: "mg",
    via: "IV",
    pagina: "10",
    notas: ["Doses para infecção fora do SNC (o PDF não traz dose de meningite). Dados limitados."],
    tabelas: [
      {
        id: "ig",
        grupo: "geral",
        titulo: "Sensível — pela idade gestacional",
        linhas: [
          { quando: { ig: lt(32), pna: lt(14) }, rotulo: "IG < 32 sem, PNA < 14 d", dose: d(20, 12) },
          { quando: { ig: lt(32), pna: ge(14) }, rotulo: "IG < 32 sem, PNA ≥ 14 d", dose: d(20, 8) },
          { quando: { ig: ge(32), pna: lt(14) }, rotulo: "IG ≥ 32 sem, PNA < 14 d", dose: d(20, 8) },
          { quando: { ig: ge(32), pna: ge(14) }, rotulo: "IG ≥ 32 sem, PNA ≥ 14 d", dose: d(30, 8) },
        ],
      },
      {
        id: "peso",
        grupo: "geral",
        titulo: "Sensível — pelo peso",
        linhas: [
          { quando: { peso: le(2000), pna: le(14) }, rotulo: "≤ 2 kg, PNA ≤ 14 d", dose: d(20, 12) },
          { quando: { peso: le(2000), pna: ab(15, 28) }, rotulo: "≤ 2 kg, PNA 15–28 d", dose: d(20, 8) },
          { quando: { peso: le(2000), pna: ab(29, 60) }, rotulo: "≤ 2 kg, PNA 29–60 d", dose: d(30, 8) },
          { quando: { peso: gt(2000), pna: le(14) }, rotulo: "> 2 kg, PNA ≤ 14 d", dose: d(20, 8) },
          { quando: { peso: gt(2000), pna: ab(15, 60) }, rotulo: "> 2 kg, PNA 15–60 d", dose: d(30, 8) },
        ],
      },
      {
        id: "cim",
        grupo: "cim_elevada",
        titulo: "CIM elevada (4–8 mg/L)",
        nota: "Pode considerar infusão em 4 h.",
        linhas: [
          { quando: { peso: le(2000), pna: le(14) }, rotulo: "≤ 2 kg, PNA ≤ 14 d", dose: d(40, 12) },
          { quando: { peso: le(2000), pna: ab(15, 60) }, rotulo: "≤ 2 kg, PNA 15–60 d", dose: d(40, 8) },
          { quando: { peso: gt(2000), pna: le(60) }, rotulo: "> 2 kg, PNA ≤ 60 d", dose: d(40, 8) },
        ],
      },
    ],
  },
  {
    id: "metronidazol",
    nome: "Metronidazol",
    unidade: "mg",
    via: "IV/VO",
    pagina: "11",
    notas: ["O PDF traz a dose para bebês, crianças e adolescentes (sem linha específica para RN). Máximo: 4.000 mg/dia IV; 2.250 mg/dia VO."],
    tabelas: [
      { id: "iv", grupo: "iv", titulo: "IV", linhas: [{ quando: {}, rotulo: "Bebês, crianças e adolescentes", dose: { porKg: [22.5, 40], cadaH: [6, 8], porDia: true } }] },
      { id: "vo", grupo: "vo", titulo: "Oral", via: "VO", linhas: [{ quando: {}, rotulo: "Bebês, crianças e adolescentes", dose: { porKg: [15, 50], cadaH: 8, porDia: true } }] },
    ],
  },
  {
    id: "micafungina",
    nome: "Micafungina",
    unidade: "mg",
    via: "IV",
    pagina: "12",
    notas: ["Candidemia: mínimo de 14 dias a partir da primeira hemocultura negativa. Doses até 15 mg/kg foram relatadas."],
    tabelas: [{ id: "geral", grupo: "geral", titulo: "Candidíase sistêmica", linhas: [{ quando: {}, rotulo: "Tratamento", dose: d(10, 24) }] }],
  },
  {
    id: "oxacilina",
    nome: "Oxacilina",
    unidade: "mg",
    via: "IV/IM",
    pagina: "13–14",
    tabelas: [
      {
        id: "ig",
        grupo: "geral",
        titulo: "Geral (não meningite) — pela idade gestacional",
        linhas: [
          { quando: { ig: le(34), pna: le(7) }, rotulo: "IG ≤ 34 sem, PNA ≤ 7 d", dose: d(25, 12) },
          { quando: { ig: le(34), pna: ab(8, 28) }, rotulo: "IG ≤ 34 sem, PNA 8–28 d", dose: d(25, 8) },
          { quando: { ig: gt(34), pna: le(7) }, rotulo: "IG > 34 sem, PNA ≤ 7 d", dose: d(25, 8) },
          { quando: { ig: gt(34), pna: ab(8, 28) }, rotulo: "IG > 34 sem, PNA 8–28 d", dose: d(25, 6) },
        ],
      },
      {
        id: "peso",
        grupo: "geral",
        titulo: "Geral (não meningite) — pelo peso",
        linhas: [
          { quando: { peso: lt(1000), pna: le(14) }, rotulo: "< 1 kg, PNA ≤ 14 d", dose: d(25, 12) },
          { quando: { peso: lt(1000), pna: ab(15, 28) }, rotulo: "< 1 kg, PNA 15–28 d", dose: d(25, 8) },
          { quando: { peso: lt(1000), pna: ab(29, 60) }, rotulo: "< 1 kg, PNA 29–60 d", dose: d(37.5, 6) },
          { quando: { peso: ab(1000, 2000), pna: le(7) }, rotulo: "1–2 kg, PNA ≤ 7 d", dose: d(25, 12) },
          { quando: { peso: ab(1000, 2000), pna: ab(8, 28) }, rotulo: "1–2 kg, PNA 8–28 d", dose: d(25, 8) },
          { quando: { peso: ab(1000, 2000), pna: ab(29, 60) }, rotulo: "1–2 kg, PNA 29–60 d", dose: d(37.5, 6) },
          { quando: { peso: gt(2000), pna: le(7) }, rotulo: "> 2 kg, PNA ≤ 7 d", dose: d(25, 8) },
          { quando: { peso: gt(2000), pna: ab(8, 28) }, rotulo: "> 2 kg, PNA 8–28 d", dose: d(25, 6) },
          { quando: { peso: gt(2000), pna: ab(29, 60) }, rotulo: "> 2 kg, PNA 29–60 d", dose: d(37.5, 6) },
        ],
      },
      {
        id: "meningite",
        grupo: "meningite",
        titulo: "Meningite — pelo peso",
        linhas: [
          { quando: { peso: lt(1000), pna: le(14) }, rotulo: "< 1 kg, PNA ≤ 14 d", dose: d(50, 12) },
          { quando: { peso: lt(1000), pna: ab(15, 28) }, rotulo: "< 1 kg, PNA 15–28 d", dose: d(50, 8) },
          { quando: { peso: lt(1000), pna: ab(29, 60) }, rotulo: "< 1 kg, PNA 29–60 d", dose: d(75, 6) },
          { quando: { peso: ab(1000, 2000), pna: le(7) }, rotulo: "1–2 kg, PNA ≤ 7 d", dose: d(50, 12) },
          { quando: { peso: ab(1000, 2000), pna: ab(8, 28) }, rotulo: "1–2 kg, PNA 8–28 d", dose: d(50, 8) },
          { quando: { peso: ab(1000, 2000), pna: ab(29, 60) }, rotulo: "1–2 kg, PNA 29–60 d", dose: d(75, 6) },
          { quando: { peso: gt(2000), pna: le(7) }, rotulo: "> 2 kg, PNA ≤ 7 d", dose: d(50, 8) },
          { quando: { peso: gt(2000), pna: ab(8, 28) }, rotulo: "> 2 kg, PNA 8–28 d", dose: d(50, 6) },
          { quando: { peso: gt(2000), pna: ab(29, 60) }, rotulo: "> 2 kg, PNA 29–60 d", dose: d(75, 6) },
        ],
      },
    ],
  },
  {
    id: "penicilina_cristalina",
    nome: "Penicilina G cristalina",
    unidade: "UI",
    via: "IV/IM",
    pagina: "15",
    notas: ["Dose para infecção fora do SNC (o PDF não traz dose de meningite)."],
    tabelas: [
      {
        id: "idade",
        grupo: "geral",
        titulo: "Infecção sensível (não SNC)",
        linhas: [
          { quando: { ig: le(34), pna: le(7) }, rotulo: "IG ≤ 34 sem, PNA ≤ 7 d", dose: d(50000, 12) },
          { quando: { ig: le(34), pna: ab(8, 28) }, rotulo: "IG ≤ 34 sem, PNA 8–28 d", dose: d(50000, 8) },
          { quando: { ig: gt(34), pna: le(7) }, rotulo: "IG > 34 sem, PNA ≤ 7 d", dose: d(50000, 12) },
          { quando: { ig: gt(34), pna: ab(8, 28) }, rotulo: "IG > 34 sem, PNA 8–28 d", dose: d(50000, 8) },
        ],
      },
    ],
  },
  {
    id: "piperacilina_tazobactam",
    nome: "Piperacilina-tazobactam",
    unidade: "mg",
    via: "IV",
    pagina: "16",
    notas: [
      "Dose em mg de piperacilina (cada 1.000 mg de piperacilina vem com 125 mg de tazobactam).",
      "Infusão prolongada (3 h) pode ajudar com CIM > 16 mg/L. PMA > 35 sem com patógeno mais resistente: considerar 80 mg/kg a cada 4 h.",
    ],
    tabelas: [
      {
        id: "pma",
        grupo: "geral",
        titulo: "Pela idade pós-menstrual",
        linhas: [
          { quando: { pma: le(30) }, rotulo: "PMA ≤ 30 sem", dose: d(100, 8) },
          { quando: { pma: gt(30) }, rotulo: "PMA > 30 sem", dose: d(80, 6) },
        ],
      },
      {
        id: "peso",
        grupo: "geral",
        titulo: "Pelo peso",
        linhas: [
          { quando: { peso: le(2000), pna: le(7) }, rotulo: "≤ 2 kg, PNA ≤ 7 d", dose: d(100, 8) },
          { quando: { peso: le(2000), pna: ab(8, 28), pma: le(30) }, rotulo: "≤ 2 kg, PNA 8–28 d, PMA ≤ 30 sem", dose: d(100, 8) },
          { quando: { peso: le(2000), pna: ab(8, 28), pma: gt(30) }, rotulo: "≤ 2 kg, PNA 8–28 d, PMA > 30 sem", dose: d(80, 6) },
          { quando: { peso: le(2000), pna: ab(29, 60) }, rotulo: "≤ 2 kg, PNA 29–60 d", dose: d(80, 6) },
          { quando: { peso: gt(2000), pna: le(60) }, rotulo: "> 2 kg, PNA ≤ 60 d", dose: d(80, 6) },
        ],
      },
    ],
  },
  {
    id: "polimixina_b",
    nome: "Polimixina B",
    unidade: "UI",
    via: "IV",
    pagina: "17",
    alerta: "Só para infecção multirresistente com risco de vida, sem alternativa menos tóxica. 10.000 UI = 1 mg.",
    tabelas: [{ id: "iv", grupo: "geral", titulo: "Infecção grave multirresistente (exceto meningite)", linhas: [{ quando: {}, rotulo: "IV", dose: { porKg: [15000, 40000], cadaH: 12, porDia: true } }] }],
  },
  {
    id: "teicoplanina",
    nome: "Teicoplanina",
    unidade: "mg",
    via: "IV",
    pagina: "17",
    tabelas: [{ id: "geral", grupo: "geral", titulo: "Gram-positivos (< 2 meses)", ataque: { porKg: 16, texto: "no dia 1" }, linhas: [{ quando: {}, rotulo: "Do dia 2 em diante", dose: d(8, 24) }] }],
  },
  {
    id: "tigeciclina",
    nome: "Tigeciclina",
    unidade: "mg",
    via: "IV",
    pagina: "17",
    alerta: "Não recomendada abaixo de 8 anos (dentes, dose incerta): só sem alternativa eficaz. Dados limitados.",
    tabelas: [{ id: "geral", grupo: "geral", titulo: "Infecção bacteriana", ataque: { porKg: [1.5, 2], texto: "uma vez" }, maxPorDose: 50, linhas: [{ quando: {}, rotulo: "Manutenção", dose: d([1, 2], 12) }] }],
  },
  {
    id: "vancomicina",
    nome: "Vancomicina",
    unidade: "mg",
    via: "IV",
    pagina: "18–19",
    renal: "A creatinina flutua e reflete a materna na 1ª semana: reavaliar a função renal com frequência em RN ≤ 7 dias.",
    notas: ["Meningite (≥ 2 kg): PNA ≤ 7 d: 20–30 mg/kg/dia a cada 8–12 h; PNA > 7 d: 30–45 mg/kg/dia a cada 6–8 h. Em < 2 kg, doses menores e intervalos maiores."],
    tabelas: [
      {
        id: "padrao",
        grupo: "geral",
        titulo: "Regime padrão (menos ototoxicidade)",
        linhas: [
          { quando: { pma: lt(29) }, rotulo: "PMA < 29 sem", dose: d(15, 24) },
          { quando: { pma: ab(29, 35) }, rotulo: "PMA 29–35 sem", dose: d(15, 12) },
          { quando: { pma: gt(35) }, rotulo: "PMA > 35 sem", dose: d(15, 8) },
        ],
      },
      {
        id: "otimizado",
        grupo: "geral",
        titulo: "Regime otimizado (mais chance de AUC ≥ 400 para S. aureus)",
        ataque: { porKg: 25, texto: "uma vez" },
        linhas: [
          { quando: { pma: lt(29) }, rotulo: "PMA < 29 sem", dose: d(15, 12) },
          { quando: { pma: ab(29, 35) }, rotulo: "PMA 29–35 sem", dose: d(15, 12) },
          { quando: { pma: gt(35) }, rotulo: "PMA > 35 sem", dose: d(15, 8) },
        ],
      },
      {
        id: "creatinina",
        grupo: "geral",
        titulo: "Pela creatinina (alvo de vale 5–10 mg/L)",
        ataque: { porKg: 20, texto: "uma vez" },
        linhas: [
          { quando: { ig: le(28), cr: lt(0.5) }, rotulo: "IG ≤ 28 sem, Cr < 0,5", dose: d(15, 12) },
          { quando: { ig: le(28), cr: ab(0.5, 0.7) }, rotulo: "IG ≤ 28 sem, Cr 0,5–0,7", dose: d(20, 24) },
          { quando: { ig: le(28), cr: ab(0.8, 1) }, rotulo: "IG ≤ 28 sem, Cr 0,8–1", dose: d(15, 24) },
          { quando: { ig: le(28), cr: ab(1.1, 1.4) }, rotulo: "IG ≤ 28 sem, Cr 1,1–1,4", dose: d(10, 24) },
          { quando: { ig: le(28), cr: gt(1.4) }, rotulo: "IG ≤ 28 sem, Cr > 1,4", dose: d(15, 48) },
          { quando: { ig: gt(28), cr: lt(0.7) }, rotulo: "IG > 28 sem, Cr < 0,7", dose: d(15, 12) },
          { quando: { ig: gt(28), cr: ab(0.7, 0.9) }, rotulo: "IG > 28 sem, Cr 0,7–0,9", dose: d(20, 24) },
          { quando: { ig: gt(28), cr: ab(1, 1.2) }, rotulo: "IG > 28 sem, Cr 1–1,2", dose: d(15, 24) },
          { quando: { ig: gt(28), cr: ab(1.3, 1.6) }, rotulo: "IG > 28 sem, Cr 1,3–1,6", dose: d(10, 24) },
          { quando: { ig: gt(28), cr: gt(1.6) }, rotulo: "IG > 28 sem, Cr > 1,6", dose: d(15, 48) },
        ],
      },
    ],
  },
];

export const DROGA: Record<DrogaId, Droga> = Object.fromEntries(ANTIMICROBIANOS.map((x) => [x.id, x])) as Record<DrogaId, Droga>;
export const FONTE_DOSES = "PDF do serviço: Doses dos antimicrobianos na neonatologia (UpToDate 2025)";
