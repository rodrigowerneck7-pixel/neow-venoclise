import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { LEITES, VIAS, type DadosDieta, type Leite } from "../core/dieta";
import type { FichaRN } from "../core/ficha";
import { fmt } from "../core/numeros";
import { Card, Interruptor, NumInput, Segmentado } from "./campos";
import { derivarDieta } from "./derivados";

interface Props {
  d: DadosDieta;
  setD: Dispatch<SetStateAction<DadosDieta>>;
  ficha: FichaRN;
  nascimento: string | null;
  agora: Date;
  topo: ReactNode;
  /** Peso de cálculo da venóclise (mesma base de mL/kg). */
  pesoCalculoG: number | null;
  venoclise: { volumeTotalMlKgDia: number | null; outrasInfusoesMlDia: number | null; dietaMlKgDia: number | null };
  onLevarDieta: (mlKgDia: number) => void;
  onAbrirVenoclise: () => void;
}

const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

export function Dieta({ d, setD, ficha, nascimento, agora, topo, pesoCalculoG, venoclise, onLevarDieta, onAbrirVenoclise }: Props) {
  const set = (p: Partial<DadosDieta>) => setD((x) => ({ ...x, ...p }));
  const [copiado, setCopiado] = useState(false);
  const [limpar, setLimpar] = useState(false);

  const { c, r, pesoG, origem, texto } = derivarDieta(d, ficha, nascimento, agora, pesoCalculoG, venoclise);
  const humano = d.leite === "lm" || d.leite === "lhop";
  const levarValor = d.modo === "programada" ? (d.volumeMlKgDia ?? null) : d.modo === "zero" ? 0 : null;

  return (
    <div className="space-y-4">
      {topo}

      <Card titulo="Dieta">
        <Segmentado
          rotulo="Tipo"
          valor={d.modo}
          opcoes={[{ valor: "livre_demanda", texto: "Livre demanda" }, { valor: "programada", texto: "Volume programado" }, { valor: "zero", texto: "Dieta zero" }]}
          onChange={(v) => set({ modo: v })}
        />
        {d.modo && d.modo !== "zero" && (
          <>
            <Segmentado rotulo="Leite" valor={d.leite} opcoes={LEITES} onChange={(v) => set({ leite: v })} />
            {d.leite === "outra" && <TextoCurto rotulo="Qual leite" valor={d.leiteOutro} onChange={(v) => set({ leiteOutro: v })} placeholder="Ex.: fórmula extensamente hidrolisada" />}
            {d.leite === "lm" && (
              <>
                <Segmentado
                  rotulo="Se faltar leite materno, complementar com"
                  valor={d.complemento}
                  opcoes={LEITES.filter((l) => l.valor !== "lm") as { valor: Leite; texto: string }[]}
                  onChange={(v) => set({ complemento: v })}
                />
                {d.complemento === "outra" && <TextoCurto rotulo="Qual complemento" valor={d.complementoOutro} onChange={(v) => set({ complementoOutro: v })} />}
              </>
            )}
          </>
        )}
        {d.modo === "programada" && (
          <>
            <Segmentado rotulo="Via" valor={d.via} opcoes={VIAS} onChange={(v) => set({ via: v })} />
            <Segmentado rotulo="Intervalo" valor={d.intervaloH ? String(d.intervaloH) : null} opcoes={[{ valor: "2", texto: "2/2 h" }, { valor: "3", texto: "3/3 h" }]} onChange={(v) => set({ intervaloH: v ? (Number(v) as 2 | 3) : null })} />
            <NumInput rotulo="Volume de hoje" unidade="mL/kg/dia" valor={d.volumeMlKgDia} onChange={(v) => set({ volumeMlKgDia: v })} />
            <div className="grid grid-cols-2 gap-2">
              <NumInput rotulo="Aumento por dia" unidade="mL/kg/dia" valor={d.incrementoMlKgDia} onChange={(v) => set({ incrementoMlKgDia: v })} />
              <NumInput rotulo="Meta" unidade="mL/kg/dia" valor={d.metaMlKgDia} onChange={(v) => set({ metaMlKgDia: v })} />
            </div>
            {humano && <Interruptor rotulo="Com aditivo do leite humano" ativo={!!d.aditivo} onChange={(v) => set({ aditivo: v })} />}
          </>
        )}
        <p className="text-caption text-subtle num">
          Peso da conta: {pesoG != null ? `${fmt(pesoG, 0)} g (${origem})` : "—"}
          {c.pnaDias != null ? ` · ${c.pnaDias} dias de vida` : ""}
        </p>
      </Card>

      {(r.pendencias.length > 0 || r.prescricao) && (
        <section className="rounded-lg bg-surface border border-border shadow-card p-4 space-y-3" aria-live="polite">
          {r.pendencias.map((p) => <p key={p} className="text-body-sm text-warning font-semibold">{p}</p>)}
          {r.mlPorMamada != null && (
            <div className="rounded-md bg-surface-2 px-3 py-2">
              <div className="num text-heading">{fmt(r.mlPorMamada, 2)} mL de {d.intervaloH}/{d.intervaloH} h</div>
              <div className="text-caption text-muted num">{fmt(d.volumeMlKgDia as number)} mL/kg/dia · {fmt(r.mlDia as number, 1)} mL/dia · {r.mamadasDia} mamadas</div>
            </div>
          )}
          {r.prescricao && <p className="text-body-sm font-semibold">{r.prescricao}</p>}
          {r.alertas.map((a) => <p key={a} className="text-body-sm text-warning font-semibold">{a}</p>)}
          {r.notas.length > 0 && (
            <ul className="space-y-1 text-caption text-subtle list-disc pl-5">
              {r.notas.map((n) => (
                <li key={n.texto}>{n.texto} ({n.fonte.startsWith("ESPGHAN") ? "ESPGHAN 2022" : "MS, Guia Alimentar"})</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {d.modo === "programada" && (
        <Card titulo="Transição: dieta sobe, venóclise desce">
          {venoclise.volumeTotalMlKgDia == null ? (
            <p className="text-body-sm text-muted">Sem volume total na aba Venóclise: o plano mostra só a dieta.</p>
          ) : (
            <p className="text-caption text-subtle">
              Venóclise = volume total ({fmt(venoclise.volumeTotalMlKgDia)} mL/kg/dia, da aba Venóclise) − dieta{venoclise.outrasInfusoesMlDia ? " − outras infusões" : ""}. O total fica o de hoje; ajuste dia a dia na aba Venóclise. Mantendo a TIG com menos volume, a concentração de glicose sobe.
            </p>
          )}
          {r.plano ? (
            <ol className="space-y-2">
              {r.plano.map((l) => (
                <li key={l.dia} className={`rounded-md border px-3 py-2 ${l.eventos.length ? "border-primary-2 bg-primary-soft" : "border-border bg-surface-2"}`}>
                  <div className="text-body-sm font-semibold num">{l.dia === 0 ? "Hoje" : `+${l.dia} d`} · {ddmm(new Date(agora.getTime() + l.dia * 86_400_000))}</div>
                  <div className="text-body-sm num">
                    Dieta {fmt(l.dietaMlKgDia)} mL/kg/dia ({fmt(l.mlPorMamada, 2)} mL/mamada)
                    {l.venoMlKgDia != null ? ` · venóclise ${fmt(l.venoMlKgDia, 1)} mL/kg/dia (${fmt(l.venoMlH as number, 2)} mL/h)` : ""}
                  </div>
                  {l.eventos.map((e) => <div key={e} className="text-caption text-primary font-semibold">{e}</div>)}
                </li>
              ))}
            </ol>
          ) : (
            r.venoHojeMlKgDia != null && <p className="text-body-sm num">Hoje: venóclise {fmt(r.venoHojeMlKgDia, 1)} mL/kg/dia.</p>
          )}
          {!r.plano && r.prescricao && <p className="text-caption text-subtle">Informe aumento por dia e meta para ver o plano.</p>}
        </Card>
      )}

      {levarValor != null && (r.prescricao || d.modo === "zero") && (
        <div className="rounded-md border border-primary-2 bg-primary-soft px-3 py-2 text-body-sm flex items-center justify-between gap-3">
          <span className="num">
            {venoclise.dietaMlKgDia === levarValor
              ? `A venóclise já desconta ${fmt(levarValor)} mL/kg/dia de dieta.`
              : venoclise.dietaMlKgDia != null
                ? `A venóclise desconta ${fmt(venoclise.dietaMlKgDia)} mL/kg/dia de dieta; a de hoje é ${fmt(levarValor)}.`
                : `A venóclise ainda não desconta dieta; a de hoje é ${fmt(levarValor)} mL/kg/dia.`}
          </span>
          {venoclise.dietaMlKgDia === levarValor ? (
            <button type="button" onClick={onAbrirVenoclise} className="tap shrink-0 rounded-sm bg-primary text-on-primary px-3 font-semibold">Abrir</button>
          ) : (
            <button type="button" onClick={() => onLevarDieta(levarValor)} className="tap shrink-0 rounded-sm bg-primary text-on-primary px-3 font-semibold">Levar</button>
          )}
        </div>
      )}

      {texto && (
        <Card titulo="Texto para a prescrição">
          <pre className="whitespace-pre-wrap text-body-sm font-sans">{texto}</pre>
          <button
            type="button"
            onClick={() => { void navigator.clipboard?.writeText(texto).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); }); }}
            className="tap w-full rounded-sm bg-primary text-on-primary font-semibold"
          >
            {copiado ? "Copiado" : "Copiar"}
          </button>
        </Card>
      )}

      {limpar ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setLimpar(false)} className="tap rounded-sm border border-border font-semibold">Cancelar</button>
          <button type="button" onClick={() => { setD({}); setLimpar(false); }} className="tap rounded-sm bg-danger text-on-primary font-semibold">Apagar a dieta</button>
        </div>
      ) : (
        <button type="button" onClick={() => setLimpar(true)} className="tap w-full rounded-sm border border-border text-muted font-semibold">Limpar dieta</button>
      )}
    </div>
  );
}

function TextoCurto({ rotulo, valor, onChange, placeholder }: { rotulo: string; valor?: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-body-sm text-muted mb-1">{rotulo}</span>
      <input type="text" value={valor ?? ""} placeholder={placeholder} onChange={(ev) => onChange(ev.target.value)} className="w-full rounded-sm bg-surface-2 border border-border px-3 text-input control-h" />
    </label>
  );
}
