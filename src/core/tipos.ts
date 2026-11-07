export type Ambiente = "incubadora_umida" | "incubadora_seca" | "berco_aquecido";
export type SimNaoNaoSei = "sim" | "nao" | "nao_sei";
export type Acesso = "periferico" | "picc" | "cvu";
export type FonteHidrica = "espghan" | "ms";

export interface Justificativa {
  confirmado: boolean;
  justificativa: string;
}

export interface Laboratorio {
  glicemia?: number | null; // mg/dL
  na?: number | null; // mmol/L
  k?: number | null; // mmol/L
  caTotal?: number | null; // mg/dL
  caIonico?: number | null; // mmol/L
  mg?: number | null; // mg/dL
}

/** Tudo que o médico informa. `null`/ausente = não informado (o motor nunca preenche por conta própria). */
export interface EntradaVenoclise {
  /** Em gramas. Valor < 15 dispara a pergunta "kg?" e só converte com `confirmouKg`. */
  pesoNascimento: number | null;
  pesoAtual?: number | null;
  confirmouKg?: { nascimento?: boolean; atual?: boolean };
  confirmouVariacaoPeso?: boolean;
  igSemanas: number | null;
  igDias?: number | null;
  /** D1 = primeiras 24 h. */
  diaDeVida: number | null;

  ambiente?: Ambiente | null;
  fototerapia?: boolean;
  asfixiaSdrVm?: boolean;
  sepseOuDoencaAguda?: boolean;
  urinou?: SimNaoNaoSei | null;
  diureseMlKgH?: number | null;
  maeMgSO4?: SimNaoNaoSei | null;
  dietaEnteralMlKgDia?: number | null;
  outrasInfusoesMlDia?: number | null;
  labs?: Laboratorio;
  acesso?: Acesso | null;

  /** Escolhas do médico (slider dentro da faixa). */
  volumeMlKgDia: number | null;
  tig: number | null;
  foraDaFaixa?: { volume?: Justificativa; tig?: Justificativa };

  calcio?: {
    /** null/ausente: PT e grupo de risco = sim automático; termo sem risco = pergunta. */
    incluir?: boolean | null;
    mlKgDia?: number | null;
    fatoresRisco?: { maeDiabetica?: boolean; pig?: boolean };
  };
  magnesioMEqKgDia?: number | null;
  sodioMEqKgDia?: number | null;
  potassioMEqKgDia?: number | null;
  /** Na no D1 só com justificativa. K no D1 é travado (sem override). */
  overrideSodioD1?: { justificativa: string };
}

export interface ConfigServico {
  fonteHidrica: FonteHidrica;
  mgso4: keyof typeof import("./constantes").AMPOLAS_MG;
  nacl: keyof typeof import("./constantes").AMPOLAS_NA;
  kcl: keyof typeof import("./constantes").AMPOLAS_K;
  /** Soro de baixa concentração para a mistura. SG 5% é opcional. */
  soroBaixo: "sg10" | "sg5";
  calcioMlKgDia: number;
  magnesioMEqKgDia: number;
  etapas: 1 | 2 | 4;
}

export type NivelAlerta = "vermelho" | "laranja" | "azul";
export interface Alerta {
  id: string;
  nivel: NivelAlerta;
  bloqueia: boolean;
  titulo: string;
  detalhe?: string;
  fonte?: string;
  /** Sugere uma ação de navegação na UI. */
  acao?: "hipoglicemia" | "confirmar_kg";
}

export interface PassoMemoria {
  titulo: string;
  formula: string;
  resultado: string;
  fonte?: string;
}

export interface FaixaNumerica {
  min: number;
  max: number;
}

export type FaixaVolume =
  | { status: "ok"; base: FaixaNumerica; ajustada: FaixaNumerica; fonte: string; motivosAjuste: string[] }
  | { status: "todo"; motivo: string };

export interface Mistura {
  /** Volumes exatos (sem arredondar), em mL, para o volume TOTAL da venóclise. */
  sg5Ml: number;
  sg10Ml: number;
  sg50Ml: number;
  adMl: number;
  concNecessariaFracaoPct: number;
}

export interface Componentes {
  sg5: number;
  sg10: number;
  sg50: number;
  ad: number;
  gluconatoCa: number;
  mgso4: number;
  nacl: number;
  kcl: number;
}

export interface DoseCa {
  mlKg: number;
  mlDia: number;
  mgSalKg: number;
  mgElementarKg: number;
  mmolKg: number;
  mmolDia: number;
  mEqKg: number;
}
export interface DoseEletrolito {
  mEqKg: number;
  mEqDia: number;
  mmolKg: number;
  mlDia: number;
  mgKg: number;
}

export interface CalculoVenoclise {
  pesoCalculoG: number;
  pesoCalculoKg: number;
  pesoUsado: "nascimento" | "atual";
  grupo: string;
  volumeTotalMlKgDia: number;
  volumeTotalMlDia: number;
  volumeEnteralMlDia: number;
  outrasInfusoesMlDia: number;
  volumeVenoclise: number;
  vazaoMlH: number;
  etapas: number;
  horasPorEtapa: number;
  tig: number;
  glicoseGDia: number;
  concFinalPct: number;
  mistura: Mistura;
  calcio: DoseCa;
  magnesio: DoseEletrolito;
  sodio: DoseEletrolito;
  potassio: DoseEletrolito;
  cloroMmolKg: number;
  /** Volume (exato) de cada componente para o volume total da venóclise. */
  componentes: Componentes;
  /** Receita arredondada de UMA etapa, e a concentração recalculada com esses valores. */
  receitaEtapa: Componentes;
  concFinalRealPct: number;
}

export interface ResultadoVenoclise {
  /** Campos obrigatórios que faltam: "informe X". Sem eles não há nenhuma saída numérica. */
  pendencias: string[];
  alertas: Alerta[];
  /** Faixas de referência (só quando dá para calcular). */
  referencia?: {
    grupo: string;
    pesoCalculoG: number;
    pesoUsado: "nascimento" | "atual";
    volume: FaixaVolume;
    tig: FaixaNumerica;
    tigPadraoSugerido: number;
  };
  calculo?: CalculoVenoclise;
  memoria: PassoMemoria[];
  /** Só existe quando liberado. */
  prescricaoTexto?: string;
  /** true = sem pendências e sem alerta que bloqueia. */
  liberado: boolean;
}
