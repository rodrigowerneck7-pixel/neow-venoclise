import { type Dispatch, type ReactNode, type SetStateAction } from "react";
import { PRESETS_CALCIO } from "../core/constantes";
import { fmt } from "../core/numeros";
import type { FichaRN } from "../core/ficha";
import type { Alerta, ConfigServico, EntradaVenoclise, ResultadoVenoclise } from "../core/tipos";
import { Justificar, PainelAlertas } from "./Alertas";
import { Resultado } from "./Resultado";
import { Card, Deslizante, Interruptor, NumInput, Segmentado } from "./campos";

export const ENTRADA_INICIAL: EntradaVenoclise = {
  pesoNascimento: null,
  pesoAtual: null,
  igSemanas: null,
  igDias: null,
  diaDeVida: 1,
  volumeMlKgDia: null,
  tig: null,
};

interface Props {
  e: EntradaVenoclise;
  /** Resultado do motor para `e` e `cfg` (calculado no shell, que também mostra o resumo no cabeçalho). */
  r: ResultadoVenoclise;
  setE: Dispatch<SetStateAction<EntradaVenoclise>>;
  cfg: ConfigServico;
  setCfg: Dispatch<SetStateAction<ConfigServico>>;
  /** Resumo/campos da ficha do RN (peso, IG, dia de vida vêm da ficha). */
  ficha: ReactNode;
  setFicha: Dispatch<SetStateAction<FichaRN>>;
  /** Faixa de identificação do paciente, acima dos alertas. */
  topo?: ReactNode;
  /** Cards extras (histórico) depois do resultado. */
  abaixo?: ReactNode;
  /** Se informado, mostra o botão de salvar a prescrição no histórico. */
  onSalvarHistorico?: (r: ResultadoVenoclise) => void;
  onLimpar: () => void;
  onHipoglicemia: () => void;
}

export function Calculadora({ e, r, setE, cfg, setCfg, ficha, setFicha, topo, abaixo, onSalvarHistorico, onLimpar, onHipoglicemia }: Props) {
  const set = (p: Partial<EntradaVenoclise>) => setE((x) => ({ ...x, ...p }));
  const setLab = (p: NonNullable<EntradaVenoclise["labs"]>) => setE((x) => ({ ...x, labs: { ...x.labs, ...p } }));

  const ref = r.referencia;
  const faixaVol = ref?.volume.status === "ok" ? ref.volume.ajustada : null;
  const faixaTig = ref?.tig ?? null;

  const acoes = (a: Alerta) => {
    switch (a.id) {
      case "peso-nasc-kg":
        return <BotaoAlerta onClick={() => setFicha((f) => ({ ...f, confirmouKg: { ...f.confirmouKg, nascimento: true } }))}>Sim, é kg</BotaoAlerta>;
      case "peso-atual-kg":
        return <BotaoAlerta onClick={() => setFicha((f) => ({ ...f, confirmouKg: { ...f.confirmouKg, atual: true } }))}>Sim, é kg</BotaoAlerta>;
      case "variacao-peso":
        return <BotaoAlerta onClick={() => setFicha((f) => ({ ...f, confirmouVariacaoPeso: true }))}>Pesos conferidos</BotaoAlerta>;
      case "volume-fora":
      case "volume-todo":
        return <Justificar rotulo="Confirmar volume fora da diretriz" onConfirmar={(t) => set({ foraDaFaixa: { ...e.foraDaFaixa, volume: { confirmado: true, justificativa: t } } })} />;
      case "tig-fora":
        return <Justificar rotulo="Confirmar TIG fora da faixa" onConfirmar={(t) => set({ foraDaFaixa: { ...e.foraDaFaixa, tig: { confirmado: true, justificativa: t } } })} />;
      case "na-d1":
        return <Justificar rotulo="Confirmar Na no D1" onConfirmar={(t) => set({ overrideSodioD1: { justificativa: t } })} />;
      case "glicemia-hipo":
        return <BotaoAlerta onClick={onHipoglicemia}>Abrir tela de hipoglicemia</BotaoAlerta>;
      default:
        return null;
    }
  };

  return (
    <>
      <div className="space-y-4">
        {topo}
        {ficha}
        {ref && <p className="text-body-sm text-muted px-1">{ref.grupo} · peso de cálculo {fmt(ref.pesoCalculoG, 0)} g ({ref.pesoUsado === "nascimento" ? "nascimento" : "atual"})</p>}
        <PainelAlertas alertas={r.alertas} acoes={acoes} />


        <Card titulo="Contexto">
          <Segmentado
            rotulo="Ambiente"
            valor={e.ambiente}
            onChange={(v) => set({ ambiente: v })}
            opcoes={[
              { valor: "incubadora_umida", texto: "Incubadora umidificada" },
              { valor: "incubadora_seca", texto: "Incubadora sem umidade" },
              { valor: "berco_aquecido", texto: "Berço aquecido" },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Interruptor rotulo="Fototerapia" ativo={!!e.fototerapia} onChange={(v) => set({ fototerapia: v })} />
            <Interruptor rotulo="Asfixia / SDR / VM umidificada" ativo={!!e.asfixiaSdrVm} onChange={(v) => set({ asfixiaSdrVm: v })} />
            <Interruptor rotulo="Sepse / doença aguda" ativo={!!e.sepseOuDoencaAguda} onChange={(v) => set({ sepseOuDoencaAguda: v })} />
          </div>
          <Segmentado
            rotulo="Mãe recebeu MgSO₄?"
            valor={e.maeMgSO4}
            onChange={(v) => set({ maeMgSO4: v })}
            opcoes={[{ valor: "sim", texto: "Sim" }, { valor: "nao", texto: "Não" }, { valor: "nao_sei", texto: "Não sei" }]}
          />
          <Segmentado
            rotulo="Urinou?"
            valor={e.urinou}
            onChange={(v) => set({ urinou: v })}
            opcoes={[{ valor: "sim", texto: "Sim" }, { valor: "nao", texto: "Não" }, { valor: "nao_sei", texto: "Não sei" }]}
          />
          <div className="grid grid-cols-2 gap-3">
            <NumInput rotulo="Diurese" unidade="mL/kg/h" valor={e.diureseMlKgH} onChange={(v) => set({ diureseMlKgH: v })} />
            <NumInput rotulo="Dieta enteral" unidade="mL/kg/dia" valor={e.dietaEnteralMlKgDia} onChange={(v) => set({ dietaEnteralMlKgDia: v })} />
            <NumInput rotulo="Outras infusões" unidade="mL/dia" valor={e.outrasInfusoesMlDia} onChange={(v) => set({ outrasInfusoesMlDia: v })} ajuda="Drogas, flush, ATB" />
          </div>
          <Segmentado
            rotulo="Acesso venoso"
            valor={e.acesso}
            onChange={(v) => set({ acesso: v })}
            opcoes={[{ valor: "periferico", texto: "Periférico" }, { valor: "picc", texto: "PICC" }, { valor: "cvu", texto: "CVU" }]}
          />
        </Card>

        <Card titulo="Volume e glicose">
          <div className="flex items-end justify-between gap-3">
            <NumInput rotulo="Volume total" unidade="mL/kg/dia" valor={e.volumeMlKgDia} onChange={(v) => set({ volumeMlKgDia: v })} />
            {faixaVol && <BotaoAlerta onClick={() => set({ volumeMlKgDia: Math.round((faixaVol.min + faixaVol.max) / 2) })}>Meio da faixa</BotaoAlerta>}
          </div>
          {faixaVol && (
            <>
              <Deslizante rotulo="Volume dentro da faixa" min={Math.floor(faixaVol.min)} max={Math.ceil(faixaVol.max)} passo={1} valor={e.volumeMlKgDia} onChange={(v) => set({ volumeMlKgDia: v })} />
              <p className="text-body-sm text-muted">Faixa da diretriz: {fmt(faixaVol.min, 1)}–{fmt(faixaVol.max, 1)} mL/kg/dia</p>
              {ref?.volume.status === "ok" && ref.volume.motivosAjuste.map((m) => <p key={m} className="text-caption text-subtle">{m}</p>)}
            </>
          )}
          <div className="flex items-end justify-between gap-3">
            <NumInput rotulo="TIG" unidade="mg/kg/min" valor={e.tig} onChange={(v) => set({ tig: v })} />
            {ref && <BotaoAlerta onClick={() => set({ tig: ref.tigPadraoSugerido })}>Sugerida {fmt(ref.tigPadraoSugerido)}</BotaoAlerta>}
          </div>
          {faixaTig && (
            <>
              <Deslizante rotulo="TIG dentro da faixa" min={faixaTig.min} max={faixaTig.max} passo={0.5} valor={e.tig} onChange={(v) => set({ tig: v })} />
              <p className="text-body-sm text-muted">Faixa recomendada: {fmt(faixaTig.min)}–{fmt(faixaTig.max)} mg/kg/min (máx. 12)</p>
            </>
          )}
          <Segmentado
            rotulo="Etapas"
            valor={String(cfg.etapas)}
            onChange={(v) => v && setCfg({ ...cfg, etapas: Number(v) as 1 | 2 | 4 })}
            opcoes={[{ valor: "1", texto: "1 × 24 h" }, { valor: "2", texto: "2 × 12 h" }, { valor: "4", texto: "4 × 6 h" }]}
          />
          <Segmentado
            rotulo="Tabela hídrica"
            valor={cfg.fonteHidrica}
            onChange={(v) => v && setCfg({ ...cfg, fonteHidrica: v })}
            opcoes={[{ valor: "espghan", texto: "ESPGHAN/SBP" }, { valor: "ms", texto: "MS 2014" }]}
          />
        </Card>

        <Card titulo="Aditivos">
          <div>
            <div className="rotulo">Gluconato de cálcio 10%</div>
            <div className="flex flex-wrap gap-2 mb-2">
              <Interruptor rotulo="Mãe diabética" ativo={!!e.calcio?.fatoresRisco?.maeDiabetica} onChange={(v) => set({ calcio: { ...e.calcio, fatoresRisco: { ...e.calcio?.fatoresRisco, maeDiabetica: v } } })} />
              <Interruptor rotulo="PIG" ativo={!!e.calcio?.fatoresRisco?.pig} onChange={(v) => set({ calcio: { ...e.calcio, fatoresRisco: { ...e.calcio?.fatoresRisco, pig: v } } })} />
              <Segmentado valor={e.calcio?.incluir == null ? null : e.calcio.incluir ? "sim" : "nao"} onChange={(v) => set({ calcio: { ...e.calcio, incluir: v == null ? null : v === "sim" } })} opcoes={[{ valor: "sim", texto: "Adicionar" }, { valor: "nao", texto: "Não adicionar" }]} />
            </div>
            <NumInput rotulo="Dose" unidade="mL/kg/dia" valor={e.calcio?.mlKgDia} placeholder={fmt(cfg.calcioMlKgDia)} onChange={(v) => set({ calcio: { ...e.calcio, mlKgDia: v } })} ajuda="Vazio = preset do serviço" />
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.values(PRESETS_CALCIO).map((p) => (
                <button key={p.rotulo} type="button" onClick={() => set({ calcio: { ...e.calcio, mlKgDia: p.mlKg } })} className="chip text-caption">
                  {p.rotulo}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <NumInput rotulo="Magnésio" unidade="mEq/kg/dia" valor={e.magnesioMEqKgDia} placeholder={fmt(cfg.magnesioMEqKgDia)} onChange={(v) => set({ magnesioMEqKgDia: v })} ajuda="Vazio = sugestão do app (0 se a mãe recebeu MgSO₄)" />
            <NumInput rotulo="Sódio" unidade="mEq/kg/dia" valor={e.sodioMEqKgDia} placeholder="0" onChange={(v) => set({ sodioMEqKgDia: v })} />
            <NumInput rotulo="Potássio" unidade="mEq/kg/dia" valor={e.potassioMEqKgDia} placeholder="0" onChange={(v) => set({ potassioMEqKgDia: v })} />
          </div>
        </Card>

        <details className="card">
          <summary className="tap cursor-pointer text-[15px] font-semibold flex items-center">Laboratório (opcional)</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <NumInput rotulo="Glicemia" unidade="mg/dL" valor={e.labs?.glicemia} onChange={(v) => setLab({ glicemia: v })} />
            <NumInput rotulo="Na" unidade="mmol/L" valor={e.labs?.na} onChange={(v) => setLab({ na: v })} />
            <NumInput rotulo="K" unidade="mmol/L" valor={e.labs?.k} onChange={(v) => setLab({ k: v })} />
            <NumInput rotulo="Ca total" unidade="mg/dL" valor={e.labs?.caTotal} onChange={(v) => setLab({ caTotal: v })} />
            <NumInput rotulo="Ca iônico" unidade="mmol/L" valor={e.labs?.caIonico} onChange={(v) => setLab({ caIonico: v })} />
            <NumInput rotulo="Mg" unidade="mg/dL" valor={e.labs?.mg} onChange={(v) => setLab({ mg: v })} />
          </div>
        </details>

        <Resultado r={r} />

        {onSalvarHistorico && (
          <button
            type="button"
            disabled={!r.liberado || !r.prescricaoTexto}
            onClick={() => onSalvarHistorico(r)}
            className="btn btn-primary w-full"
          >
            Salvar prescrição no histórico
          </button>
        )}

        {abaixo}

        <button type="button" onClick={onLimpar} className="btn btn-discreto w-full">
          Limpar venóclise
        </button>
      </div>
    </>
  );
}

function BotaoAlerta({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="btn btn-tonal shrink-0 px-3 text-body-sm mt-1">
      {children}
    </button>
  );
}
