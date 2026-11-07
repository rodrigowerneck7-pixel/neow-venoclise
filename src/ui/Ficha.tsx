import { useState, type Dispatch, type SetStateAction } from "react";
import { pendenciasFicha, resumoFicha, type FichaRN, type GrupoABO, type Tipagem } from "../core/ficha";
import { Card, NumInput, Segmentado } from "./campos";

interface Props {
  f: FichaRN;
  setF: Dispatch<SetStateAction<FichaRN>>;
  /** Dia de vida efetivo (automático pela data/hora de nascimento, ou o digitado). */
  dia: number | null;
  diaAutomatico: boolean;
}

/** Peso, IG e dia de vida: os campos que todos os módulos usam. */
function CamposBasicos({ f, setF, diaAutomatico, dia }: Props) {
  const set = (p: Partial<FichaRN>) => setF((x) => ({ ...x, ...p }));
  return (
    <div className="grid grid-cols-2 gap-3">
      <NumInput rotulo="Peso de nascimento" unidade="g" valor={f.pesoNascimento} onChange={(v) => set({ pesoNascimento: v, confirmouKg: { ...f.confirmouKg, nascimento: false } })} />
      <NumInput rotulo="Peso atual" unidade="g" valor={f.pesoAtual} onChange={(v) => set({ pesoAtual: v, confirmouKg: { ...f.confirmouKg, atual: false } })} ajuda={dia === 1 ? "Opcional no D1" : "Obrigatório após o D1"} />
      <NumInput rotulo="IG (semanas)" valor={f.igSemanas} onChange={(v) => set({ igSemanas: v })} />
      <NumInput rotulo="IG (dias)" valor={f.igDias} onChange={(v) => set({ igDias: v })} />
      <NumInput
        rotulo="Dia de vida"
        valor={diaAutomatico ? dia : f.diaDeVida}
        onChange={(v) => !diaAutomatico && set({ diaDeVida: v })}
        ajuda={diaAutomatico ? "Calculado pela data/hora de nascimento" : "D1 = primeiras 24 h"}
      />
    </div>
  );
}

/** Aba "Ficha": todos os dados comuns do RN. */
export function FichaCompleta(props: Props & { onLimpar: () => void }) {
  const { f, setF, onLimpar } = props;
  const setTip = (campo: "tipagemMae" | "tipagemRN", p: Tipagem) => setF((x) => ({ ...x, [campo]: { ...x[campo], ...p } }));
  const abo = (campo: "tipagemMae" | "tipagemRN", rotulo: string) => (
    <div className="space-y-2">
      <Segmentado<GrupoABO>
        rotulo={`${rotulo}: grupo ABO`}
        valor={f[campo]?.abo}
        onChange={(v) => setTip(campo, { abo: v })}
        opcoes={(["A", "B", "AB", "O"] as const).map((g) => ({ valor: g, texto: g }))}
      />
      <Segmentado
        rotulo={`${rotulo}: fator Rh`}
        valor={f[campo]?.rh}
        onChange={(v) => setTip(campo, { rh: v })}
        opcoes={[{ valor: "pos", texto: "Rh +" }, { valor: "neg", texto: "Rh −" }]}
      />
    </div>
  );
  return (
    <div className="space-y-4">
      <Card titulo="Dados do RN">
        <p className="text-body-sm text-muted">Digite uma vez: todos os setores (venóclise, icterícia, internação, antibiótico, dieta) usam estes dados.</p>
        <CamposBasicos {...props} />
      </Card>
      <Card titulo="Tipagem e Coombs">
        {abo("tipagemMae", "Mãe")}
        {abo("tipagemRN", "RN")}
        <Segmentado
          rotulo="Coombs direto"
          valor={f.coombsDireto}
          onChange={(v) => setF((x) => ({ ...x, coombsDireto: v }))}
          opcoes={[{ valor: "positivo", texto: "Positivo" }, { valor: "negativo", texto: "Negativo" }, { valor: "nao_feito", texto: "Não feito" }]}
        />
        <p className="text-caption text-subtle">Usados pela icterícia (fase seguinte). Vazio = não informado.</p>
      </Card>
      <button type="button" onClick={onLimpar} className="tap w-full rounded-sm border border-border text-muted font-semibold">
        Limpar ficha
      </button>
    </div>
  );
}

/** Topo de cada setor: resumo da ficha; abre os campos básicos se faltar algo ou se tocar em "Editar". */
export function FichaResumo(props: Props & { onAbrirFicha: () => void }) {
  const { f, dia, diaAutomatico, onAbrirFicha } = props;
  const falta = pendenciasFicha(f, diaAutomatico);
  const [editando, setEditando] = useState(false);
  const aberto = editando || falta.length > 0;
  return (
    <section className="rounded-lg bg-surface border border-border shadow-card p-4 space-y-3" aria-label="Ficha do RN">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-eyebrow text-muted">Ficha do RN</h2>
          <p className="num text-body font-semibold">{resumoFicha(f, dia)}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {falta.length === 0 && (
            <button type="button" onClick={() => setEditando((v) => !v)} aria-expanded={aberto} className="tap rounded-sm bg-surface-2 border border-border px-3 text-body-sm font-semibold">
              {editando ? "Fechar" : "Editar"}
            </button>
          )}
          <button type="button" onClick={onAbrirFicha} className="tap rounded-sm bg-surface-2 border border-border px-3 text-body-sm font-semibold">
            Ficha
          </button>
        </div>
      </div>
      {falta.length > 0 && <p className="text-body-sm text-warning font-semibold">Informe {falta.join(", ")}.</p>}
      {aberto && <CamposBasicos {...props} />}
    </section>
  );
}
