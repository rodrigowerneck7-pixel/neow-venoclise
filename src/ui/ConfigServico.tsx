import { useState } from "react";
import { AMPOLAS_K, AMPOLAS_MG, AMPOLAS_NA, MG_FAIXA_MEQ_KG, PRESETS_CALCIO } from "../core/constantes";
import { fmt } from "../core/numeros";
import type { ConfigServico as Cfg } from "../core/tipos";
import { Card, NumInput, Segmentado } from "./campos";

const rotulo = (cfg: Cfg) => `${AMPOLAS_MG[cfg.mgso4].rotulo}, ${AMPOLAS_NA[cfg.nacl].rotulo}, ${AMPOLAS_K[cfg.kcl].rotulo}`;

/** Padrões do serviço. Trocar ampola muda toda a conta de eletrólitos: exige confirmação dupla. */
export function ConfigServico({ cfg, onSalvar }: { cfg: Cfg; onSalvar: (c: Cfg) => void }) {
  const [d, setD] = useState<Cfg>(cfg);
  const [passo, setPasso] = useState<"editando" | "confirmando">("editando");
  const [ok, setOk] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const ampolaMudou = d.mgso4 !== cfg.mgso4 || d.nacl !== cfg.nacl || d.kcl !== cfg.kcl;
  const mgMax = MG_FAIXA_MEQ_KG.depois10[1];
  const mgInvalido = d.magnesioMEqKgDia < 0 || d.magnesioMEqKgDia > mgMax;
  const mudou = JSON.stringify(d) !== JSON.stringify(cfg);

  const set = (p: Partial<Cfg>) => { setD((x) => ({ ...x, ...p })); setSalvo(false); setPasso("editando"); setOk(false); };

  return (
    <Card titulo="Padrões do serviço">
      <p className="text-body-sm text-muted">Valem para novos pacientes e para o cálculo rápido. Pacientes já salvos mantêm os seus.</p>
      <Segmentado
        rotulo="MgSO₄"
        valor={d.mgso4}
        onChange={(v) => v && set({ mgso4: v })}
        opcoes={Object.entries(AMPOLAS_MG).map(([k, a]) => ({ valor: k as Cfg["mgso4"], texto: a.rotulo }))}
      />
      <Segmentado
        rotulo="NaCl"
        valor={d.nacl}
        onChange={(v) => v && set({ nacl: v })}
        opcoes={Object.entries(AMPOLAS_NA).map(([k, a]) => ({ valor: k as Cfg["nacl"], texto: a.rotulo }))}
      />
      <Segmentado
        rotulo="KCl"
        valor={d.kcl}
        onChange={(v) => v && set({ kcl: v })}
        opcoes={Object.entries(AMPOLAS_K).map(([k, a]) => ({ valor: k as Cfg["kcl"], texto: a.rotulo }))}
      />
      <Segmentado
        rotulo="Soro de baixa concentração na mistura"
        valor={d.soroBaixo}
        onChange={(v) => v && set({ soroBaixo: v })}
        opcoes={[{ valor: "sg10", texto: "SG 10% (padrão)" }, { valor: "sg5", texto: "SG 5%" }]}
      />
      <div>
        <div className="rotulo">Dose padrão de gluconato de cálcio 10%</div>
        <div className="flex flex-wrap gap-2">
          {Object.values(PRESETS_CALCIO).map((p) => (
            <button
              key={p.rotulo}
              type="button"
              onClick={() => set({ calcioMlKgDia: p.mlKg })}
              aria-pressed={d.calcioMlKgDia === p.mlKg}
              className="chip text-caption"
            >
              {p.rotulo}
            </button>
          ))}
        </div>
      </div>
      <NumInput rotulo="Magnésio padrão" unidade="mEq/kg/dia" valor={d.magnesioMEqKgDia} onChange={(v) => v != null && set({ magnesioMEqKgDia: v })} ajuda={`0 a ${fmt(mgMax)} (ESPGHAN/SBP)`} />
      {mgInvalido && <p role="alert" className="text-caption text-danger">Valor fora de 0–{fmt(mgMax)} mEq/kg/dia.</p>}
      <Segmentado
        rotulo="Etapas"
        valor={String(d.etapas)}
        onChange={(v) => v && set({ etapas: Number(v) as 1 | 2 | 4 })}
        opcoes={[{ valor: "1", texto: "1 × 24 h" }, { valor: "2", texto: "2 × 12 h" }, { valor: "4", texto: "4 × 6 h" }]}
      />
      <Segmentado
        rotulo="Tabela hídrica"
        valor={d.fonteHidrica}
        onChange={(v) => v && set({ fonteHidrica: v })}
        opcoes={[{ valor: "espghan", texto: "ESPGHAN/SBP" }, { valor: "ms", texto: "MS 2014" }]}
      />

      {passo === "editando" ? (
        <button
          type="button"
          disabled={!mudou || mgInvalido}
          onClick={() => (ampolaMudou ? setPasso("confirmando") : (onSalvar(d), setSalvo(true)))}
          className="btn btn-primary px-4"
        >
          Salvar padrões
        </button>
      ) : (
        <div className="rounded-md border borda-atencao bg-warning-soft p-3 space-y-2">
          <p role="alert" className="text-body-sm">Você mudou as ampolas. Todas as contas de Mg, Na e K usarão: <strong>{rotulo(d)}</strong>. Prescrição errada de concentração é perigosa.</p>
          <label className="flex items-start gap-2 text-body-sm">
            <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-1 size-5" />
            <span>Conferi: estas são as ampolas que existem na farmácia/unidade.</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setD(cfg)} className="btn btn-neutro">Descartar</button>
            <button type="button" disabled={!ok} onClick={() => { onSalvar(d); setPasso("editando"); setOk(false); setSalvo(true); }} className="btn btn-primary">Confirmar</button>
          </div>
        </div>
      )}
      {salvo && <p role="status" className="text-body-sm text-success">Padrões salvos.</p>}
    </Card>
  );
}
