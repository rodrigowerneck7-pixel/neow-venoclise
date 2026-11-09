import { useEffect, useRef, type KeyboardEvent } from "react";

export type Aba = "ficha" | "venoclise" | "ictericia" | "internacao" | "atb" | "dieta" | "prescricao";

export const ABAS: ReadonlyArray<{ id: Aba; texto: string }> = [
  { id: "ficha", texto: "Ficha" },
  { id: "venoclise", texto: "Venóclise" },
  { id: "ictericia", texto: "Icterícia" },
  { id: "internacao", texto: "Internação" },
  { id: "atb", texto: "Antibiótico" },
  { id: "dieta", texto: "Dieta" },
  { id: "prescricao", texto: "Prescrição" },
];

export const idPainel = (a: Aba) => `painel-${a}`;
const idAba = (a: Aba) => `aba-${a}`;

/** Setores do RN. Padrão WAI-ARIA de abas: setas ←/→ trocam, Home/End vão às pontas. */
export function BarraAbas({ ativa, onChange }: { ativa: Aba; onChange: (a: Aba) => void }) {
  const lista = useRef<HTMLDivElement>(null);
  useEffect(() => {
    lista.current?.querySelector<HTMLElement>(`#${idAba(ativa)}`)?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [ativa]);
  const mover = (ev: KeyboardEvent) => {
    const i = ABAS.findIndex((a) => a.id === ativa);
    const alvo =
      ev.key === "ArrowRight" ? (i + 1) % ABAS.length
      : ev.key === "ArrowLeft" ? (i - 1 + ABAS.length) % ABAS.length
      : ev.key === "Home" ? 0
      : ev.key === "End" ? ABAS.length - 1
      : null;
    if (alvo == null) return;
    ev.preventDefault();
    onChange(ABAS[alvo].id);
    lista.current?.querySelector<HTMLButtonElement>(`#${idAba(ABAS[alvo].id)}`)?.focus();
  };
  return (
    <div ref={lista} role="tablist" aria-label="Setores do RN" onKeyDown={mover} className="abas -mx-2">
      {ABAS.map((a) => {
        const sel = a.id === ativa;
        return (
          <button
            key={a.id}
            id={idAba(a.id)}
            type="button"
            role="tab"
            aria-selected={sel}
            aria-controls={idPainel(a.id)}
            tabIndex={sel ? 0 : -1}
            onClick={() => onChange(a.id)}
          >
            {a.texto}
          </button>
        );
      })}
    </div>
  );
}

const EM_BREVE: Partial<Record<Aba, { fase: string; texto: string }>> = {
};

export function EmBreve({ aba }: { aba: Aba }) {
  const m = EM_BREVE[aba];
  if (!m) return null;
  return (
    <section className="rounded-lg bg-surface border border-dashed border-border-strong p-4 space-y-2">
      <h2 className="card-titulo">Em construção · {m.fase}</h2>
      <p className="text-body-sm">{m.texto}</p>
    </section>
  );
}
