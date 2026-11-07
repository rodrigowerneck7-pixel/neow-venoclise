import { useState, type ReactNode } from "react";
import type { Alerta, NivelAlerta } from "../core/tipos";

const estilo: Record<NivelAlerta, { caixa: string; marca: string; nome: string }> = {
  vermelho: { caixa: "bg-danger-soft border-danger text-text", marca: "bg-danger", nome: "Bloqueio/alerta" },
  laranja: { caixa: "bg-warning-soft border-warning text-text", marca: "bg-warning", nome: "Atenção" },
  azul: { caixa: "bg-primary-soft border-primary-2 text-text", marca: "bg-primary-2", nome: "Informação" },
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
        className="w-full rounded-sm bg-surface border border-border px-3 text-input min-h-11"
      />
      <button
        type="button"
        disabled={!t.trim()}
        onClick={() => onConfirmar(t.trim())}
        className="tap rounded-sm bg-primary text-on-primary px-4 font-semibold disabled:opacity-40"
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
          <div key={a.id} className={`rounded-md border-l-4 border px-3 py-2 ${s.caixa}`} role={a.nivel === "vermelho" ? "alert" : undefined}>
            <div className="flex items-start gap-2">
              <span className={`mt-1.5 inline-block size-2.5 shrink-0 rounded-full ${s.marca}`} aria-hidden />
              <div className="min-w-0">
                <div className="text-body-sm font-semibold">
                  <span className="sr-only">{s.nome}: </span>
                  {a.bloqueia && <span className="text-danger">BLOQUEIO · </span>}
                  {a.titulo}
                </div>
                {a.detalhe && <div className="text-body-sm text-muted">{a.detalhe}</div>}
                {a.fonte && <div className="text-caption text-subtle">Fonte: {a.fonte}</div>}
                {acoes(a)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
