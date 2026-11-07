import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { CONFIG_PADRAO, calcularVenoclise } from "../core/calculo";
import { fmt } from "../core/numeros";
import { calcularDiaDeVida } from "../core/tempo";
import type { ConfigServico, EntradaVenoclise, ResultadoVenoclise } from "../core/tipos";
import { cofre } from "../db/instancia";
import { novoId } from "../db/cofre";
import { PREFERENCIAS_PADRAO, type EstadoCofre, type Paciente, type Preferencias, type Registro } from "../db/modelos";
import { parseNascimento } from "../db/validacao";
import { Ajustes } from "./Ajustes";
import { Bloqueio } from "./Bloqueio";
import { Calculadora, ENTRADA_INICIAL } from "./Calculadora";
import { Historico } from "./Historico";
import { Hipoglicemia } from "./Hipoglicemia";
import { Referencias } from "./Referencias";
import { useTema } from "./Tema";
import { registerSW } from "virtual:pwa-register";
import { FormPaciente, ListaPacientes, diaDoPaciente } from "./Pacientes";

type Tela = "lista" | "calc" | "ajustes" | "novo" | "editar" | "hipo" | "refs";

export function App() {
  const [carregando, setCarregando] = useState(true);
  const [estado, setEstado] = useState<EstadoCofre>("sem_pin");
  const [tela, setTela] = useState<Tela>("lista");
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [atualId, setAtualId] = useState<string | null>(null);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [e, setEraw] = useState<EntradaVenoclise>(ENTRADA_INICIAL);
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
  const refs = useRef({ atualId, e, cfg, pacientes });
  refs.current = { atualId, e, cfg, pacientes };
  const persistenciaPedida = useRef(false);

  const setE: Dispatch<SetStateAction<EntradaVenoclise>> = useCallback((v) => { sujo.current = true; setEraw(v); }, []);
  const setCfg: Dispatch<SetStateAction<ConfigServico>> = useCallback((v) => { sujo.current = true; setCfgRaw(v); }, []);

  const salvarAgora = useCallback(async () => {
    const { atualId: id, e: ent, cfg: c, pacientes: ps } = refs.current;
    if (!id || !sujo.current) return;
    const p = ps.find((x) => x.id === id);
    if (!p) return;
    sujo.current = false;
    const novo: Paciente = { ...p, entrada: ent, cfg: c, atualizadoEm: Date.now() };
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
  }, [e, cfg, atualId, salvarAgora]);

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
    setEraw(ENTRADA_INICIAL); setCfgRaw(cfgPadrao);
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
  const eEfetiva = useMemo<EntradaVenoclise>(() => (diaAuto != null ? { ...e, diaDeVida: diaAuto } : e), [e, diaAuto]);
  const r = useMemo(() => calcularVenoclise(eEfetiva, cfg), [eEfetiva, cfg]);
  const c = r.calculo;
  const resumo = c ? `${fmt(c.vazaoMlH, 1)} mL/h · ${fmt(c.concFinalRealPct, 1)}%` : "—";

  // ---- ações
  const abrir = async (id: string) => {
    const p = pacientes.find((x) => x.id === id);
    if (!p) return;
    sujo.current = false;
    setEraw(p.entrada); setCfgRaw(p.cfg); setAtualId(id);
    setRegistros(await cofre.listarRegistros(id));
    setTela("calc");
  };
  const rapido = () => {
    sujo.current = false;
    setAtualId(null); setRegistros([]); setEraw(ENTRADA_INICIAL); setCfgRaw(cfgPadrao);
    setTela("calc");
  };
  const voltar = async () => {
    await salvarAgora();
    setAtualId(null); setRegistros([]);
    setTela("lista");
  };
  const criar = async (v: { leito: string; iniciais: string; nascimento: string | null }) => {
    const t = Date.now();
    const p: Paciente = { id: novoId(), ...v, criadoEm: t, atualizadoEm: t, entrada: ENTRADA_INICIAL, cfg: cfgPadrao };
    await cofre.salvarPaciente(p);
    setPacientes((l) => [p, ...l]);
    sujo.current = false;
    setEraw(p.entrada); setCfgRaw(p.cfg); setAtualId(p.id); setRegistros([]);
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
    if (atualId && !window.confirm("Limpar os dados deste paciente na tela? O histórico salvo não é apagado.")) return;
    setE(ENTRADA_INICIAL); setCfg(cfgPadrao);
  };
  const salvarCfgPadrao = async (c: ConfigServico) => {
    setCfgPadrao(c);
    await cofre.salvarConfigServico(c);
  };
  const salvarPrefs = async (p: Preferencias) => {
    setPrefs(p);
    await cofre.salvarPreferencias(p);
  };

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
  const titulo = "NeoW Venóclise";
  const voltarHeader = () => {
    if (tela === "calc") void voltar();
    else if (tela === "editar") setTela("calc");
    else if (tela === "hipo") setTela(hipoDeCalc ? "calc" : "lista");
    else setTela("lista");
  };
  const rotuloVoltar = tela === "calc" ? "Pacientes" : tela === "editar" || (tela === "hipo" && hipoDeCalc) ? "Voltar" : "Pacientes";

  return (
    <div className="min-h-dvh bg-bg text-text pb-28">
      <header className="appbar-bg text-on-appbar sticky top-0 z-10 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-raised">
        <div className="mx-auto max-w-xl flex items-center justify-between gap-3">
          {tela === "lista" ? (
            <h1 className="text-heading">{titulo}</h1>
          ) : (
            <button type="button" onClick={voltarHeader} className="tap text-heading">
              ‹ {rotuloVoltar}
            </button>
          )}
          <div className="flex items-center gap-3">
            {tela === "calc" && <output className="num text-heading" aria-live="polite">{resumo}</output>}
            {tela === "lista" && (
              <>
                {comPin && <button type="button" onClick={() => void bloquear()} className="tap text-body-sm font-semibold" aria-label="Bloquear agora">Bloquear</button>}
                <button type="button" onClick={() => setTela("ajustes")} className="tap text-body-sm font-semibold">Ajustes</button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pt-4">
        {novaVersao && (
          <div role="status" className="mb-3 rounded-md border border-primary-2 bg-primary-soft px-3 py-2 text-body-sm flex items-center justify-between gap-3">
            <span>Nova versão disponível.</span>
            <button type="button" onClick={() => { void salvarAgora().then(novaVersao); }} className="tap rounded-sm bg-primary text-on-primary px-3 font-semibold">Atualizar</button>
          </div>
        )}
        {aviso && <div role="status" className="mb-3 rounded-md border border-success bg-success-soft px-3 py-2 text-body-sm">{aviso}</div>}

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
          <Calculadora
            e={eEfetiva}
            r={r}
            setE={setE}
            cfg={cfg}
            setCfg={setCfg}
            diaAutomatico={diaAutomatico}
            topo={
              atual ? (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-surface border border-border shadow-card px-4 py-3">
                  <div>
                    <div className="text-heading">{atual.leito} · {atual.iniciais}</div>
                    <div className="text-caption text-subtle">Salvo automaticamente neste aparelho</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="num text-heading text-primary">{diaDoPaciente({ nascimento: atual.nascimento, entrada: e }, agora) != null ? `D${diaDoPaciente({ nascimento: atual.nascimento, entrada: e }, agora)}` : "—"}</div>
                    <button type="button" onClick={() => setTela("editar")} className="tap rounded-sm bg-surface-2 border border-border px-3 text-body-sm font-semibold">Editar</button>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-body-sm text-muted">Cálculo rápido: nada é salvo no aparelho.</div>
              )
            }
            onSalvarHistorico={atual ? (res) => void salvarHistorico(res) : undefined}
            abaixo={
              atual && (
                <Historico
                  registros={registros}
                  onReusar={(reg) => setE({ ...reg.entrada, diaDeVida: e.diaDeVida })}
                  onApagar={async (id) => { await cofre.apagarRegistro(id); setRegistros((l) => l.filter((x) => x.id !== id)); }}
                />
              )
            }
            onLimpar={limpar}
            onHipoglicemia={() => { setHipoDeCalc(true); setTela("hipo"); }}
          />
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 bg-surface border-t border-border px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-caption text-muted text-center">
        Ferramenta de apoio. Confira os cálculos. A decisão e a prescrição são do médico.
      </footer>
    </div>
  );
}
