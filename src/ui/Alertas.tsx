import { useState, type ReactNode } from "react";
import type { Alerta, NivelAlerta } from "../core/tipos";
import { IcAlerta, IcErro, IcInfo } from "./icones";

const estilo: Record<NivelAlerta, { caixa: string; icone: ReactNode; nome: string }> = {
  vermelho: { caixa: "bg-danger-soft border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)]", icone: <IcErro className="size-5 text-danger" />, nome: "Bloqueio/alerta" },
  laranja: { caixa: "bg-warning-soft border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)]", icone: <IcAlerta className="size-5 text-warning" />, nome: "Atenção" },
  azul: { caixa: "bg-surface border-border", icone: <IcInfo className="size-5 text-primary" />, nome: "Informação" },
};

/** Formulário de justificativa para sair da faixa. */
export function Justificar({ rotulo, onConfirmar }: { rotulo: string; onConfirmar: (texto: string) => void }) {
  const [t, setT] = useState("");
  return (
    <div className="mt-2 space-y-2">
      <input
        value={t}
        onChange={(e) => setT(e.target.value)}
        placeholder="Justificativa (fica no histórico)"
        aria-label="Justificativa (fica no histórico)"
        className="campo"
      />
      <button
        type="button"
        disabled={!t.trim()}
        onClick={() => onConfirmar(t.trim())}
        className="btn btn-primary px-4"
      >
        {rotulo}
      </button>
    </div>
  );
}

export function PainelAlertas({ alertas, acoes }: { alertas: Alerta[]; acoes: (a: Alerta) => ReactNode }) {
  const ordem: NivelAlerta[] = ["vermelho", "laranja", "azul"];
  const ordenados = [...alertas].sort((a, b) => ordem.indexOf(a.nivel) - ordem.indexOf(b.nivel));
  if (!ordenados.length) return null;
  return (
    <div className="space-y-2" role="region" aria-label="Alertas">
      {ordenados.map((a) => {
        const s = estilo[a.nivel];
        return (
          <div key={a.id} className={`rounded-[14px] border px-3 py-2.5 text-text ${s.caixa}`} role={a.nivel === "vermelho" ? "alert" : undefined}>
            <div className="flex items-start gap-2.5">
              <span className="shrink-0 mt-px">{s.icone}</span>
              <div className="min-w-0 space-y-0.5">
                <div className="text-body-sm font-semibold">
                  <span className="sr-only">{s.nome}: </span>
                  {a.bloqueia && <span className="text-danger">BLOQUEIO · </span>}
                  {a.titulo}
                </div>
                {a.detalhe && <div className="text-body-sm text-muted">{a.detalhe}</div>}
                {a.fonte && <div className="text-caption text-subtle pt-0.5">Fonte: {a.fonte}</div>}
                {acoes(a)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
