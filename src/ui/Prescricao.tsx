import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  AMBIENTES,
  CONTROLES,
  CUIDADOS_P,
  montarPrescricao,
  moverSecao,
  type DadosPrescricao,
  type Fontes,
  type SecaoId,
} from "../core/prescricao";
import type { Aba } from "./Abas";
import { Card, Interruptor, Segmentado } from "./campos";

interface Props {
  d: DadosPrescricao;
  setD: Dispatch<SetStateAction<DadosPrescricao>>;
  topo: ReactNode;
  cabecalho: string;
  fontes: Fontes;
  onAbrirAba: (a: Aba) => void;
}

/** Seções que vêm de outra aba e qual aba abrir. */
const DE_ABA: Partial<Record<SecaoId, Aba>> = { dieta: "dieta", venoclise: "venoclise", medicacoes: "atb", respiratorio: "internacao", fototerapia: "ictericia" };

export function Prescricao({ d, setD, topo, cabecalho, fontes, onAbrirAba }: Props) {
  const set = (p: Partial<DadosPrescricao>) => setD((x) => ({ ...x, ...p }));
  const [copiado, setCopiado] = useState(false);
  const [limpar, setLimpar] = useState(false);
  const r = montarPrescricao(fontes, d, cabecalho);
  const amb = r.secoes.find((s) => s.id === "ambiente");

  return (
    <div className="space-y-4">
      {topo}

      <Card titulo="Das outras abas">
        <ul className="space-y-2">
          {r.secoes
            .filter((s) => DE_ABA[s.id])
            .map((s) => {
              const daAba = s.id === "medicacoes" ? (fontes.antibioticos?.linhas ?? []) : s.itens;
              const estado = s.pendente ? "pendente" : daAba.length ? "ok" : "vazio";
              return (
                <li key={s.id} className={`rounded-md border px-3 py-2 ${estado === "pendente" ? "bg-warning-soft border-warning" : estado === "ok" ? "bg-success-soft border-success" : "bg-surface-2 border-border"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-body-sm font-semibold">{s.id === "medicacoes" ? "Antibiótico" : s.titulo}</span>
                    <button type="button" onClick={() => onAbrirAba(DE_ABA[s.id] as Aba)} className="tap shrink-0 rounded-sm border border-border bg-surface px-3 text-body-sm font-semibold">Abrir</button>
                  </div>
                  {estado === "pendente" && <p className="text-body-sm text-warning font-semibold">{s.pendente}</p>}
                  {estado === "ok" && daAba.map((t) => <p key={t} className="text-caption text-muted line-clamp-2">{t}</p>)}
                  {estado === "vazio" && <p className="text-caption text-subtle">Nada lançado nesta aba.</p>}
                </li>
              );
            })}
        </ul>
      </Card>

      <Card titulo="Ambiente">
        <Segmentado valor={d.ambiente ?? null} opcoes={AMBIENTES} onChange={(v) => set({ ambiente: v })} rotulo="Onde o RN fica" />
        {amb?.sugestao && <p className="text-caption text-subtle">Usando o ambiente da aba Venóclise: {amb.itens[0]?.replace(/\.$/, "").toLowerCase()}. Toque para escolher outro.</p>}
      </Card>

      <Card titulo="Controles">
        <p className="text-caption text-subtle">Sem frequência padrão: escolha a do serviço. Toque de novo para tirar.</p>
        {CONTROLES.map((c) => (
          <Segmentado
            key={c.id}
            rotulo={c.texto}
            valor={d.controles?.[c.id] ?? null}
            opcoes={c.freqs.map((f) => ({ valor: f, texto: f }))}
            onChange={(v) => set({ controles: { ...d.controles, [c.id]: v } })}
          />
        ))}
      </Card>

      <Card titulo="Cuidados">
        <div className="flex flex-wrap gap-2">
          {CUIDADOS_P.map((c) => (
            <Interruptor key={c.id} rotulo={c.texto} ativo={!!d.cuidados?.[c.id]} onChange={(v) => set({ cuidados: { ...d.cuidados, [c.id]: v } })} />
          ))}
        </div>
        <AreaTexto rotulo="Outros cuidados (um por linha)" valor={d.cuidadosOutros} onChange={(v) => set({ cuidadosOutros: v })} />
      </Card>

      <Card titulo="Outras medicações">
        <AreaTexto rotulo="Uma por linha" valor={d.medicacoesOutras} onChange={(v) => set({ medicacoesOutras: v })} placeholder="Ex.: Vitamina K …" />
        <p className="text-caption text-subtle">O app não calcula estas doses: confira.</p>
      </Card>

      <Card titulo="Exames e outros">
        <AreaTexto rotulo="Exames (um por linha)" valor={d.exames} onChange={(v) => set({ exames: v })} />
        <AreaTexto rotulo="Outros itens (um por linha)" valor={d.outros} onChange={(v) => set({ outros: v })} />
      </Card>

      <Card titulo="Ordem e itens">
        <ol className="space-y-2">
          {r.secoes.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2">
              <span className="num text-body-sm text-muted w-5 text-right">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <Interruptor rotulo={`${s.titulo}${s.itens.length ? "" : " (vazio)"}`} ativo={s.incluida} onChange={(v) => set({ excluir: { ...d.excluir, [s.id]: !v } })} />
              </div>
              <button type="button" aria-label={`Subir ${s.titulo}`} disabled={i === 0} onClick={() => set({ ordem: moverSecao(d.ordem, s.id, -1) })} className="tap rounded-sm border border-border px-3 font-semibold disabled:opacity-40">↑</button>
              <button type="button" aria-label={`Descer ${s.titulo}`} disabled={i === r.secoes.length - 1} onClick={() => set({ ordem: moverSecao(d.ordem, s.id, 1) })} className="tap rounded-sm border border-border px-3 font-semibold disabled:opacity-40">↓</button>
            </li>
          ))}
        </ol>
      </Card>

      <Card titulo="Prescrição">
        {r.texto ? (
          <>
            <pre className="whitespace-pre-wrap text-body-sm font-sans num">{r.texto}</pre>
            <button
              type="button"
              onClick={() => { void navigator.clipboard?.writeText(r.texto).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); }); }}
              className="tap w-full rounded-sm bg-primary text-on-primary font-semibold"
            >
              {copiado ? "Copiado" : "Copiar prescrição"}
            </button>
            <p className="text-caption text-subtle">Confira cada item antes de usar. A prescrição é do médico.</p>
          </>
        ) : (
          <p className="text-body-sm text-muted">Ainda não há itens. Lance a dieta, a venóclise, o antibiótico ou os itens desta aba.</p>
        )}
      </Card>

      {limpar ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setLimpar(false)} className="tap rounded-sm border border-border font-semibold">Cancelar</button>
          <button type="button" onClick={() => { setD({}); setLimpar(false); }} className="tap rounded-sm bg-danger text-on-primary font-semibold">Apagar itens desta aba</button>
        </div>
      ) : (
        <button type="button" onClick={() => setLimpar(true)} className="tap w-full rounded-sm border border-border text-muted font-semibold">Limpar prescrição (só os itens desta aba)</button>
      )}
    </div>
  );
}

function AreaTexto({ rotulo, valor, onChange, placeholder }: { rotulo: string; valor?: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-body-sm text-muted mb-1">{rotulo}</span>
      <textarea value={valor ?? ""} rows={3} placeholder={placeholder} onChange={(ev) => onChange(ev.target.value)} className="w-full rounded-sm bg-surface-2 border border-border px-3 py-2 text-input" />
    </label>
  );
}
