import { useEffect, useId, useState, type ReactNode } from "react";
import { parseNumeroBR } from "../core/numeros";

export function Card({ titulo, extra, children }: { titulo: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg bg-surface border border-border shadow-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-eyebrow text-muted">{titulo}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

/** Campo numérico: aceita vírgula e ponto, teclado decimal, fonte ≥ 16 px (sem zoom no Safari). */
export function NumInput({
  rotulo,
  valor,
  onChange,
  unidade,
  placeholder,
  ajuda,
}: {
  rotulo: string;
  valor: number | null | undefined;
  onChange: (v: number | null) => void;
  unidade?: string;
  placeholder?: string;
  ajuda?: string;
}) {
  const id = useId();
  const [texto, setTexto] = useState(valor == null ? "" : String(valor).replace(".", ","));
  // Se o valor mudar por fora (ex.: botão "sugerido"), acompanha.
  useEffect(() => {
    if (parseNumeroBR(texto) !== (valor ?? null)) setTexto(valor == null ? "" : String(valor).replace(".", ","));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);
  return (
    <div>
      <label htmlFor={id} className="block text-body-sm text-muted mb-1">
        {rotulo}
      </label>
      <div className="flex items-center rounded-sm bg-surface-2 border border-border focus-within:border-focus control-h px-3">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          value={texto}
          placeholder={placeholder}
          onChange={(ev) => {
            setTexto(ev.target.value);
            onChange(parseNumeroBR(ev.target.value));
          }}
          className="num w-full bg-transparent outline-none text-input min-h-11 placeholder:text-subtle"
        />
        {unidade && <span className="text-body-sm text-muted pl-2 whitespace-nowrap">{unidade}</span>}
      </div>
      {ajuda && <p className="text-caption text-subtle mt-1">{ajuda}</p>}
    </div>
  );
}

export function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={`tap rounded-full px-4 text-body-sm font-semibold border transition-colors ${
        ativo ? "bg-primary text-on-primary border-primary" : "bg-surface-2 text-text border-border"
      }`}
    >
      {children}
    </button>
  );
}

export function Segmentado<T extends string>({
  rotulo,
  valor,
  opcoes,
  onChange,
}: {
  rotulo?: string;
  valor: T | null | undefined;
  opcoes: ReadonlyArray<{ valor: T; texto: string }>;
  onChange: (v: T | null) => void;
}) {
  return (
    <div>
      {rotulo && <div className="text-body-sm text-muted mb-1">{rotulo}</div>}
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <Chip key={o.valor} ativo={valor === o.valor} onClick={() => onChange(valor === o.valor ? null : o.valor)}>
            {o.texto}
          </Chip>
        ))}
      </div>
    </div>
  );
}

export function Interruptor({ rotulo, ativo, onChange }: { rotulo: string; ativo: boolean; onChange: (v: boolean) => void }) {
  return (
    <Chip ativo={ativo} onClick={() => onChange(!ativo)}>
      {rotulo}
    </Chip>
  );
}

export function Deslizante({
  min,
  max,
  passo,
  valor,
  onChange,
  rotulo,
}: {
  min: number;
  max: number;
  passo: number;
  valor: number | null;
  onChange: (v: number) => void;
  rotulo: string;
}) {
  const v = valor == null ? (min + max) / 2 : Math.min(Math.max(valor, min), max);
  return (
    <input
      type="range"
      aria-label={rotulo}
      min={min}
      max={max}
      step={passo}
      value={v}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`w-full h-11 accent-[var(--color-primary)] ${valor == null ? "opacity-50" : ""}`}
    />
  );
}
