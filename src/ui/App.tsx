import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { CONFIG_PADRAO, calcularVenoclise } from "../core/calculo";
import { fmt } from "../core/numeros";
import { calcularDiaDeVida } from "../core/tempo";
import type { ConfigServico, EntradaVenoclise, ResultadoVenoclise } from "../core/tipos";
import { cofre } from "../db/instancia";
import { novoId } from "../db/cofre";
import { PREFERENCIAS_PADRAO, type EstadoCofre, type Paciente, type Preferencias, type Registro } from "../db/modelos";
import { parseNascimento } from "../db/validacao";
import { FICHA_INICIAL, aplicarFicha, fichaDeEntrada, igTexto, type FichaRN } from "../core/ficha";
import { ABAS, BarraAbas, EmBreve, idPainel, type Aba } from "./Abas";
import { IcAjustes, IcCadeado, IcLapis, IcVoltar } from "./icones";
import { Ajustes } from "./Ajustes";
import { FichaCompleta, FichaResumo } from "./Ficha";
import { Ictericia } from "./Ictericia";
import { ICTERICIA_INICIAL, type DadosIctericia } from "../core/ictericia";
import { INTERNACAO_INICIAL, type DadosInternacao } from "../core/internacao";
import { Internacao } from "./Internacao";
import { ATB_INICIAL, type DadosAntibiotico } from "../core/antibiotico";
import { Antibiotico } from "./Antibiotico";
import { DIETA_INICIAL, type DadosDieta } from "../core/dieta";
import { Dieta } from "./Dieta";
import { AMBIENTE_DA_VENOCLISE, PRESCRICAO_INICIAL, textoRespiratorio, type DadosPrescricao, type Fontes } from "../core/prescricao";
import { contextoDaFicha } from "../core/internacao";
import { Prescricao } from "./Prescricao";
import { derivarAntibiotico, derivarDieta, derivarIctericia } from "./derivados";
import { Bloqueio } from "./Bloqueio";
import { Calculadora, ENTRADA_INICIAL } from "./Calculadora";
import { Historico } from "./Historico";
import { Hipoglicemia } from "./Hipoglicemia";
import { Referencias } from "./Referencias";
import { useTema } from "./Tema";
import { registerSW } from "virtual:pwa-register";
import { FormPaciente, ListaPacientes } from "./Pacientes";

type Tela = "lista" | "calc" | "ajustes" | "novo" | "editar" | "hipo" | "refs";

export function App() {
  const [carregando, setCarregando] = useState(true);
  const [estado, setEstado] = useState<EstadoCofre>("sem_pin");
  const [tela, setTela] = useState<Tela>("lista");
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [atualId, setAtualId] = useState<string | null>(null);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [e, setEraw] = useState<EntradaVenoclise>(ENTRADA_INICIAL);
  const [ficha, setFichaRaw] = useState<FichaRN>(FICHA_INICIAL);
  const [aba, setAba] = useState<Aba>("venoclise");
  const [ict, setIctRaw] = useState<DadosIctericia>(ICTERICIA_INICIAL);
  const [inter, setInterRaw] = useState<DadosInternacao>(INTERNACAO_INICIAL);
  const [atb, setAtbRaw] = useState<DadosAntibiotico>(ATB_INICIAL);
  const [dieta, setDietaRaw] = useState<DadosDieta>(DIETA_INICIAL);
  const [presc, setPrescRaw] = useState<DadosPrescricao>(PRESCRICAO_INICIAL);
  const [cfg, setCfgRaw] = useState<ConfigServico>(CONFIG_PADRAO);
  const [prefs, setPrefs] = useState<Preferencias>(PREFERENCIAS_PADRAO);
  const [persistente, setPersistente] = useState<boolean | null>(null);
  const [agora, setAgora] = useState(() => new Date());
  const [aviso, setAviso] = useState<string | null>(null);
  const [cfgPadrao, setCfgPadrao] = useState<ConfigServico>(CONFIG_PADRAO);
  const [tema, setTema] = useTema();
  const [hipoDeCalc, setHipoDeCalc] = useState(false);
  const [novaVersao, setNovaVersao] = useState<null | (() => void)>(null);

  // ---- rascunho do paciente: salva sozinho (debounce) quando algo muda
  const sujo = useRef(false);
  const refs = useRef({ atualId, e, cfg, ficha, ict, inter, atb, dieta, presc, pacientes });
  refs.current = { atualId, e, cfg, ficha, ict, inter, atb, dieta, presc, pacientes };
  const persistenciaPedida = useRef(false);

  const setE: Dispatch<SetStateAction<EntradaVenoclise>> = useCallback((v) => { sujo.current = true; setEraw(v); }, []);
  const setCfg: Dispatch<SetStateAction<ConfigServico>> = useCallback((v) => { sujo.current = true; setCfgRaw(v); }, []);
  const setFicha: Dispatch<SetStateAction<FichaRN>> = useCallback((v) => { sujo.current = true; setFichaRaw(v); }, []);
  const setIct: Dispatch<SetStateAction<DadosIctericia>> = useCallback((v) => { sujo.current = true; setIctRaw(v); }, []);
  const setInter: Dispatch<SetStateAction<DadosInternacao>> = useCallback((v) => { sujo.current = true; setInterRaw(v); }, []);
  const setAtb: Dispatch<SetStateAction<DadosAntibiotico>> = useCallback((v) => { sujo.current = true; setAtbRaw(v); }, []);
  const setDieta: Dispatch<SetStateAction<DadosDieta>> = useCallback((v) => { sujo.current = true; setDietaRaw(v); }, []);
  const setPresc: Dispatch<SetStateAction<DadosPrescricao>> = useCallback((v) => { sujo.current = true; setPrescRaw(v); }, []);

  const salvarAgora = useCallback(async () => {
    const { atualId: id, e: ent, cfg: c, ficha: fi, ict: ic, inter: it, atb: ab, dieta: di, presc: pr, pacientes: ps } = refs.current;
    if (!id || !sujo.current) return;
    const p = ps.find((x) => x.id === id);
    if (!p) return;
    sujo.current = false;
    const novo: Paciente = { ...p, entrada: ent, cfg: c, ficha: fi, ictericia: ic, internacao: it, antibiotico: ab, dieta: di, prescricao: pr, atualizadoEm: Date.now() };
    await cofre.salvarPaciente(novo);
    setPacientes((l) => l.map((x) => (x.id === id ? novo : x)));
    if (!persistenciaPedida.current && navigator.storage?.persist) {
      persistenciaPedida.current = true;
      navigator.storage.persist().then(setPersistente).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!sujo.current || !atualId) return;
    const t = setTimeout(() => void salvarAgora(), 600);
    return () => clearTimeout(t);
  }, [e, cfg, ficha, ict, inter, atb, dieta, presc, atualId, salvarAgora]);

  // ---- carga inicial
  const carregarLista = useCallback(async () => {
    setPacientes(await cofre.listarPacientes());
  }, []);

  const iniciar = useCallback(async () => {
    const est = await cofre.iniciar();
    await cofre.limpezaAutomatica();
    setPrefs(await cofre.preferencias());
    setCfgPadrao(await cofre.configServico(CONFIG_PADRAO));
    setEstado(est);
    if (est !== "bloqueado") await carregarLista();
    setCarregando(false);
    navigator.storage?.persisted?.().then(setPersistente).catch(() => setPersistente(false));
  }, [carregarLista]);

  useEffect(() => { void iniciar(); }, [iniciar]);

  // aviso de nova versão (o service worker só atualiza quando você aceita)
  useEffect(() => {
    const atualizar = registerSW({ onNeedRefresh: () => setNovaVersao(() => () => void atualizar(true)) });
  }, []);

  // relógio do dia de vida
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // ---- bloqueio automático
  const bloquear = useCallback(async () => {
    if (cofre.estado() === "sem_pin") return;
    await salvarAgora();
    cofre.bloquear();
    setPacientes([]); setRegistros([]); setAtualId(null);
    setEraw(ENTRADA_INICIAL); setCfgRaw(cfgPadrao); setFichaRaw(FICHA_INICIAL); setIctRaw(ICTERICIA_INICIAL); setInterRaw(INTERNACAO_INICIAL); setAtbRaw(ATB_INICIAL); setDietaRaw(DIETA_INICIAL); setPrescRaw(PRESCRICAO_INICIAL);
    sujo.current = false;
    setTela("lista");
    setEstado("bloqueado");
  }, [salvarAgora, cfgPadrao]);

  useEffect(() => {
    if (estado !== "aberto") return;
    let ocultoEm: number | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arma = () => {
      clearTimeout(timer);
      if (prefs.bloqueioMin > 0) timer = setTimeout(() => void bloquear(), prefs.bloqueioMin * 60_000);
    };
    const visib = () => {
      if (document.visibilityState === "hidden") {
        ocultoEm = Date.now();
        void salvarAgora();
        if (prefs.bloqueioMin === 0) void bloquear();
      } else if (ocultoEm != null) {
        if (Date.now() - ocultoEm >= prefs.bloqueioMin * 60_000) void bloquear();
        ocultoEm = null;
        arma();
      }
    };
    const evs = ["pointerdown", "keydown", "input"] as const;
    evs.forEach((n) => window.addEventListener(n, arma, { passive: true }));
    document.addEventListener("visibilitychange", visib);
    arma();
    return () => {
      clearTimeout(timer);
      evs.forEach((n) => window.removeEventListener(n, arma));
      document.removeEventListener("visibilitychange", visib);
    };
  }, [estado, prefs.bloqueioMin, bloquear, salvarAgora]);

  // ---- derivados
  const atual = pacientes.find((p) => p.id === atualId) ?? null;
  const nascimento = parseNascimento(atual?.nascimento);
  const diaAuto = nascimento ? calcularDiaDeVida(nascimento, agora) : null;
  const diaAutomatico = diaAuto != null;
  const fichaEfetiva = useMemo<FichaRN>(() => (diaAuto != null ? { ...ficha, diaDeVida: diaAuto } : ficha), [ficha, diaAuto]);
  const eEfetiva = useMemo<EntradaVenoclise>(() => aplicarFicha(e, fichaEfetiva), [e, fichaEfetiva]);
  const r = useMemo(() => calcularVenoclise(eEfetiva, cfg), [eEfetiva, cfg]);

  /** O que cada aba entrega para a prescrição (mesmos cálculos das abas). */
  const fontesPrescricao = (): { fontes: Fontes; cabecalho: string } => {
    const nasc = atual?.nascimento ?? null;
    const di = derivarDieta(dieta, fichaEfetiva, nasc, agora, r.referencia?.pesoCalculoG ?? null, {
      volumeTotalMlKgDia: e.volumeMlKgDia ?? null,
      outrasInfusoesMlDia: e.outrasInfusoesMlDia ?? null,
      dietaMlKgDia: e.dietaEnteralMlKgDia ?? null,
    });
    const at = derivarAntibiotico(atb, fichaEfetiva, nasc, agora, e.diureseMlKgH ?? null);
    const du = at.crono?.duracao ? (at.crono.duracao.dias[0] === at.crono.duracao.dias[1] ? `${at.crono.duracao.dias[0]}` : `${at.crono.duracao.dias[0]}–${at.crono.duracao.dias[1]}`) : null;
    const semDose = at.doses.find((x) => !x.prescricao);
    const ic = derivarIctericia(ict, fichaEfetiva, nasc);
    const temVeno = e.volumeMlKgDia != null || e.tig != null;
    const dietaHoje = dieta.modo === "programada" ? (dieta.volumeMlKgDia ?? null) : dieta.modo === "zero" ? 0 : null;
    const dietaNaVeno = e.dietaEnteralMlKgDia ?? 0;
    const dietaDiferente = dietaHoje != null && Math.abs(dietaHoje - dietaNaVeno) > 1e-9;
    const fontes: Fontes = {
      dieta: di.r.prescricao ? { texto: di.r.prescricao } : dieta.modo ? { pendente: di.r.pendencias[0] ?? "Complete na aba Dieta" } : undefined,
      venoclise: r.prescricaoTexto && dietaDiferente
        ? { pendente: `A venóclise desconta ${fmt(dietaNaVeno)} mL/kg/dia de dieta, mas a aba Dieta tem ${fmt(dietaHoje as number)}: use "Levar" na aba Dieta e confira a venóclise` }
        : r.prescricaoTexto
        ? { texto: `Venóclise: ${r.prescricaoTexto}` }
        : temVeno
          ? { pendente: r.pendencias[0] ?? r.alertas.find((a) => a.bloqueia)?.titulo ?? "Complete na aba Venóclise" }
          : undefined,
      antibioticos: {
        linhas: at.doses.filter((x) => x.prescricao).map((x) => `${x.prescricao}${at.crono?.dia ? ` — D${at.crono.dia}${du ? ` de ${du}` : ""}` : ""}`),
        pendente: semDose ? `${semDose.droga.nome}: ${semDose.pendencias[0] ?? "complete a dose"}` : undefined,
      },
      fototerapia: ic.prescricaoTexto ? { texto: ic.prescricaoTexto } : ict.emFototerapia ? { pendente: "Escolha simples, dupla ou quádrupla na aba Icterícia" } : undefined,
      respiratorio: inter.motivos.resp ? textoRespiratorio(inter.suporte, inter.fio2) : undefined,
      ambienteVenoclise: e.ambiente ? AMBIENTE_DA_VENOCLISE[e.ambiente] : null,
    };
    const rn = contextoDaFicha(fichaEfetiva);
    const peso = rn.pesoAtualG ?? rn.pesoNascimentoG;
    const p2 = (n: number) => String(n).padStart(2, "0");
    const cab = [
      `Prescrição — ${p2(agora.getDate())}/${p2(agora.getMonth() + 1)}/${agora.getFullYear()}`,
      peso != null ? `${fmt(peso, 0)} g` : null,
      igTexto(fichaEfetiva),
      fichaEfetiva.diaDeVida != null ? `D${fichaEfetiva.diaDeVida}` : null,
    ].filter(Boolean).join(" · ");
    return { fontes, cabecalho: cab };
  };
  const c = r.calculo;
  const resumo = c ? `${fmt(c.vazaoMlH, 1)} mL/h · ${fmt(c.concFinalRealPct, 1)}%` : "—";

  // ---- ações
  const abrir = async (id: string) => {
    const p = pacientes.find((x) => x.id === id);
    if (!p) return;
    sujo.current = false;
    setEraw(p.entrada); setCfgRaw(p.cfg); setFichaRaw(p.ficha ?? fichaDeEntrada(p.entrada)); setIctRaw(p.ictericia ?? ICTERICIA_INICIAL); setInterRaw(p.internacao ?? INTERNACAO_INICIAL); setAtbRaw(p.antibiotico ?? ATB_INICIAL); setDietaRaw(p.dieta ?? DIETA_INICIAL); setPrescRaw(p.prescricao ?? PRESCRICAO_INICIAL); setAtualId(id);
    setRegistros(await cofre.listarRegistros(id));
    setAba("venoclise");
    setTela("calc");
  };
  const rapido = () => {
    sujo.current = false;
    setAtualId(null); setRegistros([]); setEraw(ENTRADA_INICIAL); setCfgRaw(cfgPadrao); setFichaRaw(FICHA_INICIAL); setIctRaw(ICTERICIA_INICIAL); setInterRaw(INTERNACAO_INICIAL); setAtbRaw(ATB_INICIAL); setDietaRaw(DIETA_INICIAL); setPrescRaw(PRESCRICAO_INICIAL);
    setAba("venoclise");
    setTela("calc");
  };
  const voltar = async () => {
    await salvarAgora();
    setAtualId(null); setRegistros([]);
    setTela("lista");
  };
  const criar = async (v: { leito: string; iniciais: string; nascimento: string | null }) => {
    const t = Date.now();
    const p: Paciente = { id: novoId(), ...v, criadoEm: t, atualizadoEm: t, entrada: ENTRADA_INICIAL, cfg: cfgPadrao, ficha: FICHA_INICIAL };
    await cofre.salvarPaciente(p);
    setPacientes((l) => [p, ...l]);
    sujo.current = false;
    setEraw(p.entrada); setCfgRaw(p.cfg); setFichaRaw(FICHA_INICIAL); setIctRaw(ICTERICIA_INICIAL); setInterRaw(INTERNACAO_INICIAL); setAtbRaw(ATB_INICIAL); setDietaRaw(DIETA_INICIAL); setPrescRaw(PRESCRICAO_INICIAL); setAtualId(p.id); setRegistros([]);
    setAba("ficha");
    setTela("calc");
  };
  const editar = async (v: { leito: string; iniciais: string; nascimento: string | null }) => {
    if (!atual) return;
    const p: Paciente = { ...atual, ...v, atualizadoEm: Date.now() };
    await cofre.salvarPaciente(p);
    setPacientes((l) => l.map((x) => (x.id === p.id ? p : x)));
    setTela("calc");
  };
  const apagar = async () => {
    if (!atualId) return;
    await cofre.apagarPaciente(atualId);
    setPacientes((l) => l.filter((x) => x.id !== atualId));
    sujo.current = false;
    setAtualId(null); setRegistros([]);
    setTela("lista");
  };
  const salvarHistorico = async (res: ResultadoVenoclise) => {
    if (!atualId || !res.calculo || !res.prescricaoTexto) return;
    await salvarAgora();
    const reg: Registro = {
      id: novoId(), pacienteId: atualId, em: Date.now(), diaDeVida: eEfetiva.diaDeVida ?? 0,
      vazaoMlH: res.calculo.vazaoMlH, concFinalRealPct: res.calculo.concFinalRealPct,
      volumeMlKgDia: res.calculo.volumeTotalMlKgDia, tig: res.calculo.tig,
      prescricaoTexto: res.prescricaoTexto, entrada: eEfetiva, cfg,
    };
    await cofre.salvarRegistro(reg);
    setRegistros((l) => [reg, ...l]);
    setAviso("Prescrição salva no histórico.");
    setTimeout(() => setAviso(null), 3000);
  };
  const limpar = () => {
    if (atualId && !window.confirm("Limpar os dados da venóclise deste paciente? A ficha e o histórico salvo não são apagados.")) return;
    setE(ENTRADA_INICIAL); setCfg(cfgPadrao);
  };
  const limparFicha = () => {
    if (atualId && !window.confirm("Limpar a ficha deste paciente (peso, IG, tipagem)? O histórico salvo não é apagado.")) return;
    setFicha(FICHA_INICIAL);
  };
  const salvarCfgPadrao = async (c: ConfigServico) => {
    setCfgPadrao(c);
    await cofre.salvarConfigServico(c);
  };
  const salvarPrefs = async (p: Preferencias) => {
    setPrefs(p);
    await cofre.salvarPreferencias(p);
  };

  const titulo = "NeoW Venóclise";
  const tituloTela: Record<string, string> = {
    lista: titulo, calc: ABAS.find((a) => a.id === aba)?.texto ?? "Paciente", ajustes: "Ajustes", novo: "Novo paciente",
    editar: "Editar paciente", hipo: "Hipoglicemia", refs: "Referências",
  };
  const mainRef = useRef<HTMLElement>(null);
  const primeira = useRef(true);
  // Acessibilidade: ao trocar de tela, atualiza o título da aba e leva o foco ao conteúdo (leitor de tela).
  useEffect(() => {
    document.title = tela === "lista" ? titulo : `${tituloTela[tela]} · ${titulo}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tela, aba]);
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    mainRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tela]);
  if (carregando) return <div className="min-h-dvh bg-bg" />;
  if (estado === "bloqueado") {
    return (
      <Bloqueio
        onDesbloquear={async (pin) => {
          const ok = await cofre.desbloquear(pin);
          if (ok) {
            setEstado("aberto");
            await carregarLista();
          }
          return ok;
        }}
      />
    );
  }

  const comPin = estado === "aberto";
  const voltarHeader = () => {
    if (tela === "calc") void voltar();
    else if (tela === "editar") setTela("calc");
    else if (tela === "hipo") setTela(hipoDeCalc ? "calc" : "lista");
    else setTela("lista");
  };
  const rotuloVoltar = tela === "calc" ? "Pacientes" : tela === "editar" || (tela === "hipo" && hipoDeCalc) ? "Voltar" : "Pacientes";

  return (
    <div className="min-h-dvh bg-bg text-text pb-24">
      <header className="appbar-bg text-on-appbar sticky top-0 z-10 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] border-b border-[rgb(0_0_0/0.12)]">
        <div className={`mx-auto max-w-xl flex items-center justify-between gap-2 ${tela === "calc" ? "" : "pb-2"}`}>
          {tela === "lista" ? (
            <h1 className="text-heading min-h-11 flex items-center gap-1.5">
              <span className="font-bold tracking-tight">NeoW</span>
              <span className="font-normal text-on-appbar-muted">Venóclise</span>
            </h1>
          ) : tela === "calc" ? (
            <div className="flex items-center gap-1 min-w-0">
              <button type="button" onClick={voltarHeader} className="tap -ml-3 flex items-center justify-center rounded-full" aria-label={`Voltar para ${rotuloVoltar}`}>
                <IcVoltar className="size-6" />
              </button>
              <div className="min-w-0">
                <div className="text-heading truncate">{atual ? `${atual.leito} · ${atual.iniciais}` : "Cálculo rápido"}</div>
                <div className="text-caption text-on-appbar-muted truncate num">
                  {atual ? `${fichaEfetiva.diaDeVida != null ? `D${fichaEfetiva.diaDeVida} · ` : ""}salvo no aparelho` : "nada é salvo no aparelho"}
                </div>
              </div>
            </div>
          ) : (
            <button type="button" onClick={voltarHeader} className="tap -ml-2 flex items-center gap-0.5 text-heading">
              <IcVoltar className="size-6" />
              {rotuloVoltar}
            </button>
          )}
          <div className="flex items-center gap-1 shrink-0">
            {tela === "calc" && aba === "venoclise" && <output className="num text-body-sm font-semibold rounded-full bg-[rgb(255_255_255/0.12)] px-3 py-1" aria-live="polite">{resumo}</output>}
            {tela === "calc" && atual && (
              <button type="button" onClick={() => setTela("editar")} className="tap flex items-center justify-center rounded-full -mr-2" aria-label="Editar paciente">
                <IcLapis className="size-5" />
              </button>
            )}
            {tela === "lista" && (
              <>
                {comPin && (
                  <button type="button" onClick={() => void bloquear()} className="tap flex items-center justify-center rounded-full" aria-label="Bloquear agora">
                    <IcCadeado className="size-5" />
                  </button>
                )}
                <button type="button" onClick={() => setTela("ajustes")} className="tap flex items-center justify-center rounded-full -mr-2" aria-label="Ajustes">
                  <IcAjustes className="size-5" />
                </button>
              </>
            )}
          </div>
        </div>
        {tela === "calc" && (
          <div className="mx-auto max-w-xl">
            <BarraAbas ativa={aba} onChange={setAba} />
          </div>
        )}
      </header>

      <main ref={mainRef} tabIndex={-1} aria-label={tituloTela[tela]} className="mx-auto max-w-xl px-4 pt-4 outline-none">
        {tela !== "lista" && <h1 className="sr-only">{tituloTela[tela]}</h1>}
        {novaVersao && (
          <div role="status" className="mb-3 faixa">
            <span>Nova versão disponível.</span>
            <button type="button" onClick={() => { void salvarAgora().then(novaVersao); }} className="btn btn-primary px-3">Atualizar</button>
          </div>
        )}
        {aviso && <div role="status" className="mb-3 faixa faixa-sucesso">{aviso}</div>}

        {tela === "lista" && (
          <ListaPacientes pacientes={pacientes} agora={agora} onAbrir={(id) => void abrir(id)} onNovo={() => setTela("novo")} onRapido={rapido} onHipo={() => { setHipoDeCalc(false); setTela("hipo"); }} onRefs={() => setTela("refs")} avisoPin={estado === "sem_pin" && pacientes.length > 0} />
        )}
        {tela === "novo" && <FormPaciente onSalvar={(v) => void criar(v)} onCancelar={() => setTela("lista")} />}
        {tela === "editar" && atual && <FormPaciente inicial={atual} onSalvar={(v) => void editar(v)} onCancelar={() => setTela("calc")} onApagar={() => void apagar()} />}
        {tela === "ajustes" && (
          <Ajustes
            estado={estado}
            prefs={prefs}
            persistente={persistente}
            cfgServico={cfgPadrao}
            onCfgServico={(c) => void salvarCfgPadrao(c)}
            tema={tema}
            onTema={setTema}
            onPrefs={(p) => void salvarPrefs(p)}
            onMudou={() => { setEstado(cofre.estado()); void carregarLista(); }}
            onApagado={() => { setPacientes([]); setPrefs(PREFERENCIAS_PADRAO); setEstado("sem_pin"); setTela("lista"); }}
          />
        )}
        {tela === "refs" && <Referencias />}
        {tela === "hipo" && <Hipoglicemia pesoInicialG={hipoDeCalc ? (r.referencia?.pesoCalculoG ?? null) : null} />}
        {tela === "calc" && (
          <div className="space-y-4">
            <div role="tabpanel" id={idPainel(aba)} aria-labelledby={`aba-${aba}`} className="space-y-4">
              {aba === "ficha" ? (
                <FichaCompleta f={ficha} setF={setFicha} dia={fichaEfetiva.diaDeVida} diaAutomatico={diaAutomatico} onLimpar={limparFicha} />
              ) : aba === "venoclise" ? (
                <Calculadora
                  e={eEfetiva}
                  r={r}
                  setE={setE}
                  cfg={cfg}
                  setCfg={setCfg}
                  setFicha={setFicha}
                  ficha={<FichaResumo f={ficha} setF={setFicha} dia={fichaEfetiva.diaDeVida} diaAutomatico={diaAutomatico} onAbrirFicha={() => setAba("ficha")} />}
                  onSalvarHistorico={atual ? (res) => void salvarHistorico(res) : undefined}
                  abaixo={
                    atual && (
                      <Historico
                        registros={registros}
                        onReusar={(reg) => setE(reg.entrada)}
                        onApagar={async (id) => { await cofre.apagarRegistro(id); setRegistros((l) => l.filter((x) => x.id !== id)); }}
                      />
                    )
                  }
                  onLimpar={limpar}
                  onHipoglicemia={() => { setHipoDeCalc(true); setTela("hipo"); }}
                />
              ) : aba === "ictericia" ? (
                <Ictericia
                  d={ict}
                  setD={setIct}
                  ficha={fichaEfetiva}
                  nascimento={atual?.nascimento ?? null}
                  agora={agora}
                  topo={<FichaResumo f={ficha} setF={setFicha} dia={fichaEfetiva.diaDeVida} diaAutomatico={diaAutomatico} onAbrirFicha={() => setAba("ficha")} />}
                  fotoNaVenoclise={!!e.fototerapia}
                  onMarcarFotoVenoclise={() => setE((x) => ({ ...x, fototerapia: true }))}
                />
              ) : aba === "internacao" ? (
                <Internacao
                  d={inter}
                  setD={setInter}
                  ficha={fichaEfetiva}
                  nascimento={atual?.nascimento ?? null}
                  agora={agora}
                  topo={<FichaResumo f={ficha} setF={setFicha} dia={fichaEfetiva.diaDeVida} diaAutomatico={diaAutomatico} onAbrirFicha={() => setAba("ficha")} />}
                  ict={ict}
                  venoclise={{ asfixiaSdrVm: !!e.asfixiaSdrVm, sepse: !!e.sepseOuDoencaAguda }}
                  onMarcarVenoclise={(campo) => setE((x) => ({ ...x, [campo]: true }))}
                  onLevarLabs={(labs) => setE((x) => ({ ...x, labs: { ...x.labs, ...labs } }))}
                  onAbrirIctericia={() => setAba("ictericia")}
                  onHipoglicemia={() => { setHipoDeCalc(true); setTela("hipo"); }}
                />
              ) : aba === "atb" ? (
                <Antibiotico
                  d={atb}
                  setD={setAtb}
                  ficha={fichaEfetiva}
                  nascimento={atual?.nascimento ?? null}
                  agora={agora}
                  topo={<FichaResumo f={ficha} setF={setFicha} dia={fichaEfetiva.diaDeVida} diaAutomatico={diaAutomatico} onAbrirFicha={() => setAba("ficha")} />}
                  inter={inter}
                  diureseMlKgH={e.diureseMlKgH ?? null}
                  onAbrirInternacao={() => setAba("internacao")}
                />
              ) : aba === "dieta" ? (
                <Dieta
                  d={dieta}
                  setD={setDieta}
                  ficha={fichaEfetiva}
                  nascimento={atual?.nascimento ?? null}
                  agora={agora}
                  topo={<FichaResumo f={ficha} setF={setFicha} dia={fichaEfetiva.diaDeVida} diaAutomatico={diaAutomatico} onAbrirFicha={() => setAba("ficha")} />}
                  pesoCalculoG={r.referencia?.pesoCalculoG ?? null}
                  venoclise={{ volumeTotalMlKgDia: e.volumeMlKgDia ?? null, outrasInfusoesMlDia: e.outrasInfusoesMlDia ?? null, dietaMlKgDia: e.dietaEnteralMlKgDia ?? null }}
                  onLevarDieta={(v) => setE((x) => ({ ...x, dietaEnteralMlKgDia: v }))}
                  onAbrirVenoclise={() => setAba("venoclise")}
                />
              ) : aba === "prescricao" ? (
                <Prescricao
                  d={presc}
                  setD={setPresc}
                  topo={<FichaResumo f={ficha} setF={setFicha} dia={fichaEfetiva.diaDeVida} diaAutomatico={diaAutomatico} onAbrirFicha={() => setAba("ficha")} />}
                  {...fontesPrescricao()}
                  onAbrirAba={setAba}
                />
              ) : (
                <>
                  <FichaResumo f={ficha} setF={setFicha} dia={fichaEfetiva.diaDeVida} diaAutomatico={diaAutomatico} onAbrirFicha={() => setAba("ficha")} />
                  <EmBreve aba={aba} />
                </>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-10 bg-surface/85 backdrop-blur-md border-t border-border px-6 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] text-caption text-subtle text-center">
        Ferramenta de apoio. Confira os cálculos. A decisão e a prescrição são do médico.
      </footer>
    </div>
  );
}
