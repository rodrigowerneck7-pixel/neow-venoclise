/**
 * Motor da icterícia (hiperbilirrubinemia indireta). Puro: sem UI, sem data atual, sem efeitos.
 *
 * ≥ 35 semanas ao nascer: AAP 2022 (Kemper et al., Pediatrics 2022;150(3):e2022058859) — decisão do Rodrigo.
 * < 35 semanas ao nascer: SBP 2021, Manual de Orientação nº 10, Tabela 10 (adaptada de Maisels et al.,
 *   J Perinatol 2012;32:660-4), PDF enviado pelo Rodrigo.
 *
 * Nada é inventado: sem BT, sem horas de vida ou sem IG, não há limiar (pendência). Fora das tabelas, bloqueia.
 */
import { AAP2022, type IgAap } from "./dados/aap2022";
import { fmt } from "./numeros";
import type { Alerta, PassoMemoria } from "./tipos";

export const FONTE_AAP2022 = "AAP 2022 (Kemper et al., Pediatrics 2022;150:e2022058859)";
export const FONTE_SBP2021 = "SBP 2021, Manual nº 10, Tab. 10 (Maisels 2012)";

export type TipoMedida = "serica" | "transcutanea";
export type IntensidadeFoto = "padrao" | "intensiva";
export type AparelhosFoto = "simples" | "dupla" | "quadrupla";

export interface EntradaIctericia {
  /** Da ficha. */
  igSemanas: number | null;
  igDias?: number | null;
  pesoNascimentoG?: number | null;
  coombsPositivo?: boolean;

  bt: number | null; // mg/dL
  tipo?: TipoMedida | null;
  /** Horas de vida no momento da coleta. */
  horasDeVida: number | null;

  /** Fatores de risco de neurotoxicidade (além da IG). */
  albumina?: number | null; // g/dL
  hemolise?: boolean; // isoimune, G6PD ou outra
  g6pd?: boolean;
  sepse?: boolean;
  instabilidade?: boolean;
  /** Exsanguíneo (AAP): usar a tabela "com risco" também quando a BT sobe apesar da fototerapia. */
  subindoApesarFoto?: boolean;
  sinaisEncefalopatia?: boolean;

  btAnterior?: { bt: number | null; horasDeVida: number | null } | null;
  /** Fototerapia em curso: horas de vida no início. */
  fotoInicioHoras?: number | null;
  emFototerapia?: boolean;

  /** Informativo (da tipagem na ficha): mãe O com RN A/B; mãe Rh− com RN Rh+. */
  incompatABO?: boolean;
  incompatRh?: boolean;

  /** Escolhas do médico para a prescrição. */
  aparelhos?: AparelhosFoto | null;
  intensidade?: IntensidadeFoto | null;
}

/** O que fica salvo no paciente (a ficha fornece IG, peso e Coombs). */
export interface DadosIctericia {
  bt: number | null;
  tipo?: TipoMedida | null;
  /** "YYYY-MM-DDTHH:mm" da coleta (quando há data/hora de nascimento). */
  coletaEm?: string | null;
  /** Horas de vida digitadas (sem data/hora de nascimento). */
  horasManual?: number | null;
  albumina?: number | null;
  hemolise?: boolean;
  g6pd?: boolean;
  sepse?: boolean;
  instabilidade?: boolean;
  subindoApesarFoto?: boolean;
  sinaisEncefalopatia?: boolean;
  btAnterior?: { bt: number | null; horasDeVida: number | null } | null;
  emFototerapia?: boolean;
  fotoInicioHoras?: number | null;
  aparelhos?: AparelhosFoto | null;
  intensidade?: IntensidadeFoto | null;
}

export const ICTERICIA_INICIAL: DadosIctericia = { bt: null, tipo: "serica" };

export type Zona = "abaixo" | "faixa_foto" | "fototerapia" | "faixa_exs" | "escalonamento" | "exsanguineo";

export interface Limiar {
  /** Valor único (AAP) ou faixa (SBP/Maisels sem fatores). */
  min: number;
  max: number;
}

export interface ResultadoIctericia {
  pendencias: string[];
  alertas: Alerta[];
  memoria: PassoMemoria[];
  condutas: string[];
  referencia?: {
    fonte: string;
    grupo: string;
    comRisco: boolean;
    motivosRisco: string[];
    igUsada: string;
  };
  limiarFoto?: Limiar;
  limiarExs?: Limiar;
  /** AAP: 2 mg/dL abaixo do exsanguíneo. */
  limiarEscalonamento?: number;
  zona?: Zona;
  velocidade?: { mgDlH: number; rapida: boolean; corte: number };
  suspensao?: { ate: number; texto: string; podeSuspender: boolean | null };
  rebote?: string;
  /** TcB: só decide se precisa de BT sérica. */
  pedirSerica?: boolean;
  prescricaoTexto?: string;
}

const HORA_MAX_AAP = 359;

export function igDecimal(sem: number, dias?: number | null): number {
  return sem + (dias ?? 0) / 7;
}

/** Linha da tabela AAP (IG completa ao nascer). */
function igAap(sem: number, risco: boolean, tabela: "foto" | "exs"): IgAap {
  const teto = tabela === "foto" && !risco ? 40 : 38;
  return Math.min(Math.max(Math.floor(sem), 35), teto) as IgAap;
}

export function limiarAap(tabela: "foto" | "exs", risco: boolean, igSem: number, horas: number): number | null {
  const h = Math.floor(horas);
  if (h < 1 || h > HORA_MAX_AAP) return null;
  const linha = AAP2022[tabela][risco ? "risco" : "semRisco"] as Partial<Record<IgAap, readonly (number | null)[]>>;
  return linha[igAap(igSem, risco, tabela)]?.[h] ?? null;
}

/** SBP 2021 Tab. 10 (Maisels 2012) por IG corrigida (semanas decimais). */
export const MAISELS_2012: ReadonlyArray<{ ate: number; rotulo: string; foto: [number, number]; exs: [number, number] }> = [
  { ate: 28, rotulo: "< 28 sem", foto: [5, 6], exs: [11, 14] },
  { ate: 30, rotulo: "28 0/7 – 29 6/7 sem", foto: [6, 8], exs: [12, 14] },
  { ate: 32, rotulo: "30 0/7 – 31 6/7 sem", foto: [8, 10], exs: [13, 16] },
  { ate: 34, rotulo: "32 0/7 – 33 6/7 sem", foto: [10, 12], exs: [15, 18] },
  { ate: 35, rotulo: "34 0/7 – 34 6/7 sem", foto: [10, 12], exs: [17, 19] },
];

const alerta = (id: string, nivel: Alerta["nivel"], titulo: string, detalhe?: string, fonte?: string, bloqueia = false): Alerta => ({
  id, nivel, titulo, detalhe, fonte, bloqueia,
});

const mg = (v: number) => `${fmt(v, 1)} mg/dL`;

export function calcularIctericia(e: EntradaIctericia): ResultadoIctericia {
  const r: ResultadoIctericia = { pendencias: [], alertas: [], memoria: [], condutas: [] };

  if (e.igSemanas == null) r.pendencias.push("Informe a IG na ficha do RN.");
  else if (e.igSemanas < 22 || e.igSemanas > 44 || (e.igDias != null && (e.igDias < 0 || e.igDias > 6)))
    r.pendencias.push("IG fora do intervalo esperado (22–44 semanas, 0–6 dias). Confira a ficha.");
  if (e.horasDeVida == null) r.pendencias.push("Informe as horas de vida na coleta da BT.");
  else if (e.horasDeVida < 0) r.pendencias.push("Horas de vida negativas: confira a data/hora da coleta.");
  if (e.bt == null) r.pendencias.push("Informe a bilirrubina total (BT).");
  else if (e.bt <= 0 || e.bt > 50) r.pendencias.push("BT fora do intervalo plausível (0–50 mg/dL). Confira o valor.");

  // Icterícia nas primeiras 24 h (vale com ou sem BT) — AAP KAS 4 / SBP.
  if (e.horasDeVida != null && e.horasDeVida >= 0 && e.horasDeVida < 24) {
    r.alertas.push(alerta("ict-24h", "laranja", "Icterícia antes de 24 h de vida",
      "Medir BT (ou TcB) o quanto antes e investigar hemólise (tipagem, Coombs direto, hemograma, reticulócitos).", "AAP 2022 KAS 4; SBP 2021"));
  }
  if (e.sinaisEncefalopatia) {
    r.alertas.push(alerta("ict-encefalopatia", "vermelho", "Sinais de encefalopatia bilirrubínica: exsanguineotransfusão urgente",
      "Hipertonia, arqueamento, retrocolo, opistótono, choro agudo ou apneia recorrente indicam EST urgente, qualquer que seja a BT.", "AAP 2022 KAS 22; SBP 2021", true));
  }
  if (e.incompatABO || e.incompatRh) {
    r.alertas.push(alerta("ict-incompat", "azul",
      `Incompatibilidade ${[e.incompatABO ? "ABO (mãe O, RN A ou B)" : null, e.incompatRh ? "Rh (mãe Rh−, RN Rh+)" : null].filter(Boolean).join(" e ")}`,
      "Risco de doença hemolítica: conferir Coombs direto, hemograma e reticulócitos. Só conta como fator de risco se houver hemólise (marque abaixo) ou Coombs +.", "SBP 2021"));
  }
  if (r.pendencias.length) return r;

  const ig = e.igSemanas as number;
  const bt = e.bt as number;
  const horas = e.horasDeVida as number;
  const igNasc = igDecimal(ig, e.igDias);
  const ehAap = ig >= 35;

  // ---- velocidade de subida (AAP KAS 7)
  const ant = e.btAnterior;
  if (ant?.bt != null && ant.horasDeVida != null && horas > ant.horasDeVida) {
    const v = (bt - ant.bt) / (horas - ant.horasDeVida);
    const corte = horas <= 24 ? 0.3 : 0.2;
    r.velocidade = { mgDlH: v, rapida: v >= corte, corte };
    r.memoria.push({ titulo: "Velocidade de subida", formula: `(${fmt(bt, 1)} − ${fmt(ant.bt, 1)}) ÷ (${fmt(horas, 1)} − ${fmt(ant.horasDeVida, 1)} h)`, resultado: `${fmt(v, 2)} mg/dL/h`, fonte: "AAP 2022 KAS 7" });
    if (v >= corte) {
      r.alertas.push(alerta("ict-velocidade", "laranja", `Subida rápida: ${fmt(v, 2)} mg/dL/h (≥ ${fmt(corte, 1)})`,
        "Sugere hemólise. Investigar e considerar repetir a BT mais cedo.", "AAP 2022 KAS 7"));
    }
  }

  return ehAap ? aap(e, r, ig, igNasc, bt, horas) : maisels(e, r, igNasc, bt, horas);
}

function aap(e: EntradaIctericia, r: ResultadoIctericia, ig: number, igNasc: number, bt: number, horas: number): ResultadoIctericia {
  const h = Math.floor(horas);
  if (h < 1) {
    r.pendencias.push("Na primeira hora de vida a tabela da AAP 2022 não tem limiar (começa na hora 1).");
    return r;
  }
  if (h > HORA_MAX_AAP) {
    r.pendencias.push("A AAP 2022 tabela os limiares só até 14 dias (359 h). Após isso, a decisão é clínica; com icterícia prolongada, medir BT e frações (colestase se BD > 1 mg/dL).");
    r.alertas.push(alerta("ict-14d", "laranja", "Acima de 14 dias de vida: fora da tabela da AAP 2022", undefined, "AAP 2022; SBP 2021"));
    return r;
  }

  const motivos: string[] = [];
  if (e.albumina != null && e.albumina < 3) motivos.push(`albumina ${fmt(e.albumina, 1)} g/dL (< 3,0)`);
  if (e.coombsPositivo) motivos.push("Coombs direto positivo (doença hemolítica isoimune)");
  if (e.hemolise) motivos.push("doença hemolítica");
  if (e.g6pd) motivos.push("deficiência de G6PD");
  if (e.sepse) motivos.push("sepse");
  if (e.instabilidade) motivos.push("instabilidade clínica significativa nas últimas 24 h");
  const risco = motivos.length > 0;
  const riscoExs = risco || !!e.subindoApesarFoto;

  const foto = limiarAap("foto", risco, ig, h) as number;
  const exs = limiarAap("exs", riscoExs, ig, h) as number;
  const escal = exs - 2;
  const linhaFoto = igAap(ig, risco, "foto");
  const linhaExs = igAap(ig, riscoExs, "exs");
  const rotIg = (n: number, teto: number) => (n === teto ? `${n} sem ou mais` : `${n} sem`);

  r.referencia = {
    fonte: FONTE_AAP2022,
    grupo: `${risco ? "Com" : "Sem"} fator de risco de neurotoxicidade`,
    comRisco: risco,
    motivosRisco: motivos,
    igUsada: `IG ao nascer ${fmt(igNasc, 1)} sem · ${h} h de vida`,
  };
  r.limiarFoto = { min: foto, max: foto };
  r.limiarExs = { min: exs, max: exs };
  r.limiarEscalonamento = escal;
  r.memoria.push(
    { titulo: "Limiar de fototerapia", formula: `Suppl. Table ${risco ? 2 : 1} · linha ${rotIg(linhaFoto, risco ? 38 : 40)} · hora ${h}`, resultado: mg(foto), fonte: FONTE_AAP2022 },
    { titulo: "Limiar de exsanguineotransfusão", formula: `Suppl. Table ${riscoExs ? 4 : 3} · linha ${rotIg(linhaExs, 38)} · hora ${h}${!risco && e.subindoApesarFoto ? " (BT subindo apesar da fototerapia)" : ""}`, resultado: mg(exs), fonte: FONTE_AAP2022 },
    { titulo: "Limiar de escalonamento", formula: `${fmt(exs, 1)} − 2`, resultado: mg(escal), fonte: "AAP 2022 KAS 17" },
  );

  // ---- TcB: só orienta a coleta de BT sérica (KAS 3 e 6)
  if (e.tipo === "transcutanea") {
    const pedir = bt >= foto - 3 || bt >= 15;
    r.pedirSerica = pedir;
    r.memoria.push({ titulo: "Regra da TcB", formula: `TcB ≥ ${fmt(foto, 1)} − 3 = ${fmt(foto - 3, 1)} ou TcB ≥ 15`, resultado: pedir ? "colher BT sérica" : "não exige BT sérica", fonte: "AAP 2022 KAS 6" });
    if (pedir) {
      r.alertas.push(alerta("ict-tcb", "laranja", "Colher BT sérica",
        `TcB ${mg(bt)} está a menos de 3 mg/dL do limiar de fototerapia (${mg(foto)}) ou ≥ 15. Decisões de fototerapia e escalonamento usam a BT sérica.`, "AAP 2022 KAS 3 e 6"));
    } else {
      r.condutas.push(`TcB ${mg(bt)}: mais de 3 mg/dL abaixo do limiar de fototerapia (${mg(foto)}).`);
    }
    return r;
  }

  // ---- zona
  r.zona = bt >= exs ? "exsanguineo" : bt >= escal ? "escalonamento" : bt >= foto ? "fototerapia" : "abaixo";
  r.memoria.push({ titulo: "Distância até os limiares", formula: `BT ${fmt(bt, 1)} − fototerapia ${fmt(foto, 1)} · − exsanguíneo ${fmt(exs, 1)}`, resultado: `${sinal(bt - foto)} · ${sinal(bt - exs)} mg/dL` });

  if (r.zona === "exsanguineo") {
    r.alertas.push(alerta("ict-exs", "vermelho", `BT ${mg(bt)} ≥ limiar de exsanguineotransfusão (${mg(exs)})`,
      "Exsanguineotransfusão urgente. Se, ao preparar, uma nova BT ficar abaixo do limiar e não houver sinais de encefalopatia, seguir o escalonamento.", "AAP 2022 KAS 23", true));
  } else if (r.zona === "escalonamento") {
    r.alertas.push(alerta("ict-escal", "vermelho", `BT ${mg(bt)} na zona de escalonamento (≥ ${mg(escal)})`,
      "A 2 mg/dL ou menos do limiar de exsanguineotransfusão.", "AAP 2022 KAS 17", true));
  }
  if (r.zona === "exsanguineo" || r.zona === "escalonamento") {
    r.condutas.push(
      "Exames STAT: BT e frações, hemograma, albumina, eletrólitos, tipagem e prova cruzada (AAP KAS 18).",
      "Hidratação venosa e fototerapia intensiva emergencial; acionar neonatologista / UTI que faça exsanguineotransfusão (AAP KAS 19).",
      "BT pelo menos a cada 2 h até sair da zona de escalonamento (AAP KAS 20).",
    );
    if (e.coombsPositivo || e.hemolise)
      r.condutas.push("Doença hemolítica isoimune (Coombs +): IVIG 0,5–1 g/kg em 2 h é opção; pode repetir em 12 h (AAP KAS 21).");
  } else if (r.zona === "fototerapia") {
    r.condutas.push(
      `Fototerapia intensiva indicada: BT ${mg(bt)} ≥ limiar ${mg(foto)} (AAP KAS 10; os limiares da AAP são para fototerapia intensiva).`,
      "Internado: medir BT em até 12 h após iniciar a fototerapia; depois, conforme idade, fatores de risco, nível e tendência (AAP KAS 12).",
    );
  } else {
    r.condutas.push(`Abaixo do limiar de fototerapia: faltam ${fmt(foto - bt, 1)} mg/dL.`);
    if (foto - bt < 2) r.condutas.push("A menos de 2 mg/dL do limiar: reavaliar com nova BT conforme o julgamento clínico.");
  }

  // ---- suspensão (KAS 15) e rebote (KAS 16)
  if (e.emFototerapia) {
    if (e.fotoInicioHoras == null) {
      r.pendencias.push("Fototerapia em curso: informe as horas de vida no início, para o critério de suspensão.");
    } else {
      const lInicio = limiarAap("foto", risco, ig, e.fotoInicioHoras);
      if (lInicio == null) {
        r.pendencias.push("Hora de início da fototerapia fora da tabela da AAP (1–359 h).");
      } else {
        const ate = lInicio - 2;
        const pode = bt <= ate;
        const fatoresRebote = [igNasc < 38 ? "IG < 38 sem" : null, e.fotoInicioHoras < 48 ? "início antes de 48 h" : null, e.coombsPositivo || e.hemolise ? "doença hemolítica" : null].filter(Boolean) as string[];
        r.suspensao = {
          ate,
          podeSuspender: pode,
          texto: `Suspender é opção quando BT ≤ ${mg(ate)} (2 mg/dL abaixo do limiar no início, ${mg(lInicio)} às ${Math.floor(e.fotoInicioHoras)} h).` +
            (fatoresRebote.length ? ` Fatores de rebote (${fatoresRebote.join(", ")}): fototerapia mais longa é opção.` : ""),
        };
        r.memoria.push({ titulo: "Critério de suspensão", formula: `limiar às ${Math.floor(e.fotoInicioHoras)} h (${fmt(lInicio, 1)}) − 2`, resultado: mg(ate), fonte: "AAP 2022 KAS 15" });
        const reboteAlto = e.fotoInicioHoras < 48 || e.coombsPositivo || e.hemolise;
        r.rebote = reboteAlto
          ? "Após suspender: BT em 6–12 h e nova BT no dia seguinte (fototerapia antes de 48 h, Coombs + ou hemólise)."
          : "Após suspender: BT no dia seguinte.";
        r.rebote += " (AAP 2022 KAS 16)";
      }
    }
  }

  r.prescricaoTexto = prescricao(e, r);
  return r;
}

function maisels(e: EntradaIctericia, r: ResultadoIctericia, igNasc: number, bt: number, horas: number): ResultadoIctericia {
  const igCorr = igNasc + horas / 24 / 7;
  const linha = MAISELS_2012.find((l) => igCorr < l.ate);
  if (!linha) {
    r.pendencias.push(`IG corrigida ${fmt(igCorr, 1)} sem: a tabela de Maisels/SBP para RN nascido < 35 sem vai só até 34 6/7. Decisão do médico (TODO(validar) referência).`);
    return r;
  }
  const motivos: string[] = [];
  if (e.coombsPositivo) motivos.push("Coombs direto positivo (doença hemolítica)");
  if (e.hemolise) motivos.push("doença hemolítica");
  if (e.g6pd) motivos.push("deficiência de G6PD");
  if (e.albumina != null && e.albumina < 2.5) motivos.push(`albumina ${fmt(e.albumina, 1)} g/dL (< 2,5)`);
  if (r.velocidade?.rapida) motivos.push("aumento rápido da BT");
  if (e.sepse) motivos.push("sepse/meningite");
  if (e.instabilidade) motivos.push("instabilidade clínica (pH < 7,15, VM, apneia/bradicardia com ventilação ou droga vasoativa nas últimas 24 h)");
  const risco = motivos.length > 0;
  const f: Limiar = risco ? { min: linha.foto[0], max: linha.foto[0] } : { min: linha.foto[0], max: linha.foto[1] };
  const x: Limiar = risco ? { min: linha.exs[0], max: linha.exs[0] } : { min: linha.exs[0], max: linha.exs[1] };
  const txt = (l: Limiar) => (l.min === l.max ? mg(l.min) : `${fmt(l.min, 0)}–${fmt(l.max, 0)} mg/dL`);

  r.referencia = {
    fonte: FONTE_SBP2021,
    grupo: risco ? "Com condição agravante: usar o valor inferior" : "Sem condição agravante: faixa",
    comRisco: risco,
    motivosRisco: motivos,
    igUsada: `IG corrigida ${fmt(igCorr, 1)} sem (${linha.rotulo})`,
  };
  r.limiarFoto = f;
  r.limiarExs = x;
  r.memoria.push(
    { titulo: "IG corrigida", formula: `${fmt(igNasc, 2)} + ${fmt(horas, 0)} h ÷ 24 ÷ 7`, resultado: `${fmt(igCorr, 2)} sem` },
    { titulo: "Fototerapia", formula: `Tabela 10 · ${linha.rotulo}${risco ? " · valor inferior" : ""}`, resultado: txt(f), fonte: FONTE_SBP2021 },
    { titulo: "Exsanguineotransfusão", formula: `Tabela 10 · ${linha.rotulo}${risco ? " · valor inferior" : ""}`, resultado: txt(x), fonte: FONTE_SBP2021 },
  );

  if (e.tipo === "transcutanea") {
    r.alertas.push(alerta("ict-tcb-pt", "laranja", "TcB em prematuro < 35 sem: confirme com BT sérica (micrométodo) antes de decidir", undefined, "SBP 2021"));
  }

  r.zona = bt >= x.max ? "exsanguineo" : bt >= x.min ? "faixa_exs" : bt >= f.max ? "fototerapia" : bt >= f.min ? "faixa_foto" : "abaixo";
  if (r.zona === "exsanguineo") {
    r.alertas.push(alerta("ict-exs-pt", "vermelho", `BT ${mg(bt)} no limiar de exsanguineotransfusão (${txt(x)})`,
      "Iniciar fototerapia de alta intensidade na maior superfície e avaliar EST. EST indicada se BT 5 mg/dL acima do nível, se subir apesar da fototerapia intensiva ou com sinais de encefalopatia.", FONTE_SBP2021, true));
  } else if (r.zona === "faixa_exs") {
    r.alertas.push(alerta("ict-faixa-exs", "vermelho", `BT ${mg(bt)} dentro da faixa de exsanguineotransfusão (${txt(x)})`,
      "Sem condição agravante, a decisão dentro da faixa é do médico. Fototerapia de alta intensidade na maior superfície.", FONTE_SBP2021, true));
  } else if (r.zona === "fototerapia") {
    r.condutas.push(`Fototerapia indicada: BT ${mg(bt)} ≥ ${fmt(f.max, 0)} mg/dL.`);
  } else if (r.zona === "faixa_foto") {
    r.condutas.push(`BT ${mg(bt)} dentro da faixa de fototerapia (${txt(f)}): decisão do médico; com condição agravante use o valor inferior.`);
  } else {
    r.condutas.push(`Abaixo do limiar de fototerapia (${txt(f)}).`);
  }
  if ((e.pesoNascimentoG != null && e.pesoNascimentoG <= 1000) || igNasc <= 26) {
    r.alertas.push(alerta("ict-ebp", "azul", "RN ≤ 1.000 g ou IG ≤ 26 sem",
      "Fototerapia profilática até 12 h de vida com irradiância padrão (8–10 µW/cm²/nm); evitar alta intensidade no extremo baixo peso.", FONTE_SBP2021));
  }
  if (e.emFototerapia) {
    const base = risco ? f.min : null;
    r.suspensao = base != null
      ? { ate: base - 2, podeSuspender: bt <= base - 2, texto: `Suspender quando BT ≤ ${mg(base - 2)} (2 mg/dL abaixo do nível de indicação).` }
      : { ate: f.min - 2, podeSuspender: null, texto: `Suspender quando a BT ficar 2 mg/dL abaixo do nível usado na indicação (entre ${mg(f.min - 2)} e ${mg(f.max - 2)}, conforme o limiar que você usou).` };
    r.memoria.push({ titulo: "Critério de suspensão", formula: "nível de indicação − 2", resultado: r.suspensao.texto, fonte: "SBP 2021" });
  }
  r.prescricaoTexto = prescricao(e, r);
  return r;
}

const sinal = (v: number) => (v >= 0 ? `+${fmt(v, 1)}` : `−${fmt(-v, 1)}`);

function prescricao(e: EntradaIctericia, r: ResultadoIctericia): string | undefined {
  const indicada = r.zona && r.zona !== "abaixo";
  if (!indicada && !e.emFototerapia) return undefined;
  if (!e.aparelhos) return undefined;
  const nome = { simples: "simples", dupla: "dupla", quadrupla: "quádrupla" }[e.aparelhos];
  const intens = e.intensidade === "intensiva" ? ", intensiva (≥ 30 µW/cm²/nm)" : e.intensidade === "padrao" ? ", irradiância padrão (8–10 µW/cm²/nm)" : "";
  // SBP 2021 Tab. 8: descontinuar para amamentar só se a BT não estiver próxima do nível de risco.
  const perto = r.zona === "escalonamento" || r.zona === "exsanguineo" || r.zona === "faixa_exs";
  const linhas = [
    `Fototerapia ${nome} contínua${intens}.`,
    perto
      ? "Proteção ocular; expor a maior superfície corporal; não interromper (BT próxima do nível de risco de neurotoxicidade)."
      : "Proteção ocular; expor a maior superfície corporal; pausar só para mamada/cuidados rápidos.",
    "Temperatura a cada 3 h; peso diário.",
  ];
  // Intervalos de BT só onde a fonte define (AAP KAS 12 e 20). Em < 35 sem o intervalo fica com o médico.
  if (r.referencia?.fonte === FONTE_AAP2022) {
    if (r.zona === "escalonamento" || r.zona === "exsanguineo") linhas.push("BT a cada 2 h.");
    else if (r.zona === "fototerapia") linhas.push("BT de controle em até 12 h.");
  }
  return linhas.join("\n");
}
