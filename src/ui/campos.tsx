import { useEffect, useId, useState, type ReactNode } from "react";
import { parseNumeroBR } from "../core/numeros";
import { IcCheck } from "./icones";

export function Card({ titulo, extra, children }: { titulo: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="card space-y-4">
      <div className="flex items-center justify-between gap-2 min-h-6">
        <h2 className="card-titulo">{titulo}</h2>
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
  parse = parseNumeroBR,
}: {
  rotulo: string;
  valor: number | null | undefined;
  onChange: (v: number | null) => void;
  unidade?: string;
  placeholder?: string;
  ajuda?: string;
  /** Leitura do texto (padrão: decimal com vírgula ou ponto). */
  parse?: (t: string) => number | null;
}) {
  const id = useId();
  const [texto, setTexto] = useState(valor == null ? "" : String(valor).replace(".", ","));
  // Se o valor mudar por fora (ex.: botão "sugerido"), acompanha.
  useEffect(() => {
    if (parse(texto) !== (valor ?? null)) setTexto(valor == null ? "" : String(valor).replace(".", ","));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);
  return (
    <div>
      <label htmlFor={id} className="rotulo">
        {rotulo}
      </label>
      <div className="campo flex items-center">
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
            onChange(parse(ev.target.value));
          }}
          className="campo-interno num w-full min-w-0 bg-transparent outline-none text-input min-h-11"
        />
        {unidade && <span className="text-body-sm text-subtle pl-2 whitespace-nowrap">{unidade}</span>}
      </div>
      {ajuda && <p className="text-caption text-subtle mt-1.5">{ajuda}</p>}
    </div>
  );
}

export function Chip({ ativo, onClick, children, marca = false }: { ativo: boolean; onClick: () => void; children: ReactNode; marca?: boolean }) {
  return (
    <button type="button" aria-pressed={ativo} onClick={onClick} className="chip">
      {marca && ativo && <IcCheck />}
      {children}
    </button>
  );
}

/** Poucas opções curtas viram trilho segmentado; muitas ou longas viram etiquetas. Tocar de novo desmarca. */
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
  const trilho = opcoes.length >= 2 && opcoes.length <= 4 && opcoes.every((o) => o.texto.length <= 14) && opcoes.reduce((n, o) => n + o.texto.length, 0) <= 30;
  const tocar = (v: T) => onChange(valor === v ? null : v);
  return (
    <div role="group" aria-label={rotulo}>
      {rotulo && <div className="rotulo" aria-hidden>{rotulo}</div>}
      {trilho ? (
        <div className="seg">
          {opcoes.map((o) => (
            <button key={o.valor} type="button" aria-pressed={valor === o.valor} onClick={() => tocar(o.valor)}>
              {o.texto}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {opcoes.map((o) => (
            <Chip key={o.valor} ativo={valor === o.valor} onClick={() => tocar(o.valor)}>
              {o.texto}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

export function Interruptor({ rotulo, ativo, onChange }: { rotulo: string; ativo: boolean; onChange: (v: boolean) => void }) {
  return (
    <Chip ativo={ativo} onClick={() => onChange(!ativo)} marca>
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
