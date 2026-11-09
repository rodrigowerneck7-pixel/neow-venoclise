import { useState } from "react";
import { IcCheck, IcCopiar } from "./icones";
import { fmt } from "../core/numeros";
import type { Registro } from "../db/modelos";
import { Card } from "./campos";

const dataHora = (t: number) =>
  new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function Historico({ registros, onReusar, onApagar }: { registros: Registro[]; onReusar: (r: Registro) => void; onApagar: (id: string) => void }) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  if (!registros.length) {
    return (
      <Card titulo="Histórico">
        <p className="text-body-sm text-muted">Nenhuma prescrição salva para este paciente.</p>
      </Card>
    );
  }
  return (
    <Card titulo="Histórico">
      <ul className="space-y-2">
        {registros.map((r) => (
          <li key={r.id} className="rounded-md border border-border bg-surface-2 p-3">
            <button type="button" onClick={() => setAberto(aberto === r.id ? null : r.id)} className="w-full text-left tap flex items-center justify-between gap-2" aria-expanded={aberto === r.id}>
              <span className="text-body-sm font-semibold">{dataHora(r.em)} · D{r.diaDeVida}</span>
              <span className="num text-body-sm">{fmt(r.vazaoMlH, 1)} mL/h · {fmt(r.concFinalRealPct, 1)}%</span>
            </button>
            {aberto === r.id && (
              <div className="mt-2 space-y-2">
                <div className="text-caption text-subtle">Volume {fmt(r.volumeMlKgDia, 0)} mL/kg/dia · TIG {fmt(r.tig)} mg/kg/min</div>
                <pre className="whitespace-pre-wrap text-body-sm bg-surface rounded-sm border border-border p-2 select-all">{r.prescricaoTexto}</pre>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-tonal px-3 text-body-sm"
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(r.prescricaoTexto); setCopiado(r.id); } catch { /* sem permissão: o texto está selecionável */ }
                    }}
                  >
                    {copiado === r.id ? <><IcCheck />Copiado</> : <><IcCopiar />Copiar texto</>}
                  </button>
                  <button type="button" className="btn btn-tonal px-3 text-body-sm" onClick={() => onReusar(r)}>
                    Reusar dados na tela
                  </button>
                  <button type="button" className="btn btn-perigo-contorno px-3 text-body-sm" onClick={() => onApagar(r.id)}>
                    Apagar
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
