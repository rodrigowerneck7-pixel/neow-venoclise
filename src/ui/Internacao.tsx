import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { FichaRN } from "../core/ficha";
import { calcularIctericia, type DadosIctericia } from "../core/ictericia";
import {
  avaliarColeta,
  avaliarNivel,
  CIRURGIAS,
  classificacaoAutomatica,
  contextoDaFicha,
  CUIDADOS,
  FATORES_SEPSE,
  FONTE_PORTARIA_930,
  FONTE_SBP_SEPSE_2022,
  HIPOTESES_RESP,
  labsParaVenoclise,
  MOTIVOS,
  SINAIS_SEPSE,
  STATUS_CULTURA,
  SUPORTES,
  textoInternacao,
  type Achado,
  type ColetaAvaliada,
  type ColetaExames,
  type ContextoRN,
  type CuidadoId,
  type DadosInternacao,
  type MotivoId,
  type ResultadoColeta,
  type Status,
} from "../core/internacao";
import { fmt, parseContagemBR } from "../core/numeros";
import { horasDeVida, isoLocal } from "../core/tempo";
import type { Laboratorio } from "../core/tipos";
import { novoId } from "../db/cofre";
import { parseNascimento } from "../db/validacao";
import { Card, Interruptor, NumInput, Segmentado } from "./campos";
import { entradaIctericia } from "./Ictericia";

interface Props {
  d: DadosInternacao;
  setD: Dispatch<SetStateAction<DadosInternacao>>;
  ficha: FichaRN;
  nascimento: string | null;
  agora: Date;
  topo: ReactNode;
  ict: DadosIctericia;
  /** Marcações atuais da venóclise (para sugerir, nunca mudar sozinho). */
  venoclise: { asfixiaSdrVm: boolean; sepse: boolean };
  onMarcarVenoclise: (campo: "asfixiaSdrVm" | "sepseOuDoencaAguda") => void;
  onLevarLabs: (labs: Laboratorio) => void;
  onAbrirIctericia: () => void;
  onHipoglicemia: () => void;
}

/** Pretermo tardio, PIG, GIG ou filho de mãe diabética (grupo do Quadro 2 da SBP de hipoglicemia). */
export const grupoRiscoHipoglicemia = (d: DadosInternacao, rn: ContextoRN) =>
  (rn.igSemanas != null && rn.igSemanas >= 34 && rn.igSemanas < 37) || !!d.motivos.pig || !!d.motivos.gig || !!d.motivos.fmd;

/** Avalia todas as coletas, com as horas de vida de cada uma. */
export function avaliarColetas(d: DadosInternacao, rn: ContextoRN, nascimento: string | null): ColetaAvaliada[] {
  const nasc = parseNascimento(nascimento);
  const grupo = grupoRiscoHipoglicemia(d, rn);
  return d.coletas.map((c) => {
    const em = parseNascimento(c.em ?? null);
    const horas = nasc ? (em ? horasDeVida(nasc, em) : null) : (c.horasManual ?? null);
    const r = avaliarColeta(c, { ...rn, horas, grupoRiscoHipo: grupo });
    if (nasc && em && em.getTime() < nasc.getTime()) r.pendencias.unshift("A data da coleta é antes do nascimento: confira");
    return { coleta: c, r, quando: quando(c.em) };
  });
}

const quando = (em?: string | null) => {
  const m = em?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}` : "Sem data/hora";
};

const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const COR: Record<Status, string> = {
  alterado: "bg-danger-soft border-danger",
  limitrofe: "bg-warning-soft border-warning",
  normal: "bg-success-soft border-success",
  info: "bg-surface-2 border-border",
};

export function Internacao({ d, setD, ficha, nascimento, agora, topo, ict, venoclise, onMarcarVenoclise, onLevarLabs, onAbrirIctericia, onHipoglicemia }: Props) {
  const set = (p: Partial<DadosInternacao>) => setD((x) => ({ ...x, ...p }));
  const nasc = parseNascimento(nascimento);
  const [copiado, setCopiado] = useState(false);
  const [limpar, setLimpar] = useState(false);

  const rn: ContextoRN = useMemo(() => contextoDaFicha(ficha), [ficha]);
  const avaliadas: ColetaAvaliada[] = useMemo(() => avaliarColetas(d, rn, nascimento), [d, rn, nascimento]);
  const cronologicas = useMemo(() => [...avaliadas].sort((a, b) => (a.r.horas ?? Infinity) - (b.r.horas ?? Infinity)), [avaliadas]);
  const nivel = useMemo(() => avaliarNivel(d, rn), [d, rn]);
  const texto = useMemo(() => textoInternacao(d, rn, nivel, cronologicas), [d, rn, nivel, cronologicas]);
  const auto = classificacaoAutomatica(rn);

  // Sugestão vinda da icterícia (o médico marca).
  const ictR = useMemo(() => calcularIctericia(entradaIctericia(ict, ficha, nascimento)), [ict, ficha, nascimento]);
  const pertoEst = !!ict.emFototerapia && (ictR.zona === "escalonamento" || ictR.zona === "exsanguineo" || ictR.zona === "faixa_exs");

  const horasAgora = nasc ? horasDeVida(nasc, agora) : null;
  const toggleMotivo = (id: MotivoId) => set({ motivos: { ...d.motivos, [id]: !d.motivos[id] } });
  const toggleCuidado = (id: CuidadoId) => set({ cuidados: { ...d.cuidados, [id]: !d.cuidados[id] } });
  const setColeta = (id: string, p: Partial<ColetaExames>) => setD((x) => ({ ...x, coletas: x.coletas.map((c) => (c.id === id ? { ...c, ...p } : c)) }));
  const novaColeta = () => setD((x) => ({ ...x, coletas: [{ id: novoId() }, ...x.coletas] }));
  const apagarColeta = (id: string) => setD((x) => ({ ...x, coletas: x.coletas.filter((c) => c.id !== id) }));

  const sugereAsfixia = (!!d.motivos.asfixia || d.suporte === "vm" || !!d.hipoteses?.sdr) && !venoclise.asfixiaSdrVm;
  const sugereSepse = !!d.motivos.suspeita_sepse && !venoclise.sepse;
  const pcrs = cronologicas.filter((x) => x.r.pcrMgDl != null);

  return (
    <div className="space-y-4">
      {topo}

      <Card titulo="Motivos de internação">
        {auto.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="Da ficha">
            {auto.map((a) => (
              <span key={a} className="rounded-full bg-primary-soft text-primary border border-border px-3 py-1 text-body-sm font-semibold">{a}</span>
            ))}
          </div>
        )}
        {auto.length > 0 && <p className="text-caption text-subtle">Da ficha (CID-10 P07; pretermo tardio: SBP 2022).</p>}

        {MOTIVOS.map((g) => (
          <div key={g.grupo} className="space-y-2">
            <div className="text-body-sm text-muted">{g.grupo}</div>
            <div className="flex flex-wrap gap-2">
              {g.itens.map((i) => (
                <Interruptor key={i.id} rotulo={i.texto} ativo={!!d.motivos[i.id]} onChange={() => toggleMotivo(i.id)} />
              ))}
            </div>

            {g.grupo === "Respiratório" && d.motivos.resp && (
              <Sub>
                <Segmentado rotulo="Suporte" valor={d.suporte} opcoes={SUPORTES} onChange={(v) => set({ suporte: v })} />
                {d.suporte && d.suporte !== "ar" && <NumInput rotulo="FiO₂" unidade="%" valor={d.fio2} onChange={(v) => set({ fio2: v })} ajuda="Acima de 30% entra no critério de UTIN" />}
                {d.fio2 != null && (d.fio2 < 21 || d.fio2 > 100) && <p className="text-body-sm text-warning font-semibold">FiO₂ entre 21 e 100%: confira o valor.</p>}
                <div className="text-body-sm text-muted">Hipótese (você escolhe)</div>
                <div className="flex flex-wrap gap-2">
                  {HIPOTESES_RESP.map((h) => (
                    <Interruptor key={h.id} rotulo={h.texto} ativo={!!d.hipoteses?.[h.id]} onChange={(v) => set({ hipoteses: { ...d.hipoteses, [h.id]: v } })} />
                  ))}
                </div>
              </Sub>
            )}

            {g.grupo === "Infeccioso" && d.motivos.risco_infeccioso && (
              <Sub>
                <div className="text-body-sm text-muted">Fatores de risco para sepse precoce</div>
                <div className="flex flex-wrap gap-2">
                  {FATORES_SEPSE.map((f) => (
                    <Interruptor key={f.id} rotulo={f.texto} ativo={!!d.fatoresSepse?.[f.id]} onChange={(v) => set({ fatoresSepse: { ...d.fatoresSepse, [f.id]: v } })} />
                  ))}
                </div>
                <p className="text-caption text-subtle">
                  Suspeita clínica de corioamnionite: febre materna ≥ 39 °C, ou 38–38,9 °C por mais de 30 min com leucocitose materna &gt; 15.000, secreção cervical purulenta ou taquicardia fetal &gt; 160 bpm por 10 min ou mais. Em RN ≥ 35 semanas assintomático, vale mais o exame físico seriado. Fonte: {FONTE_SBP_SEPSE_2022}.
                </p>
              </Sub>
            )}
            {g.grupo === "Infeccioso" && d.motivos.suspeita_sepse && (
              <Sub>
                <div className="text-body-sm text-muted">Sinais (sem outra causa reconhecida)</div>
                <div className="flex flex-wrap gap-2">
                  {SINAIS_SEPSE.map((s) => (
                    <Interruptor key={s.id} rotulo={s.texto} ativo={!!d.sinaisSepse?.[s.id]} onChange={(v) => set({ sinaisSepse: { ...d.sinaisSepse, [s.id]: v } })} />
                  ))}
                </div>
                <p className="text-caption text-subtle">
                  Sepse precoce: até 48 h completas de vida (ANVISA) ou 72 h (AAP)
                  {horasAgora != null ? ` — agora: ${Math.floor(horasAgora)} h de vida` : ""}. Antes do antibiótico: 2 hemoculturas de 1 mL, de sítios diferentes. A decisão sobre antibiótico vem na aba Antibiótico. Fonte: SBP 2022.
                </p>
              </Sub>
            )}

            {g.grupo === "Metabólico" && d.motivos.hipoglicemia && (
              <Sub>
                <p className="text-body-sm">A glicemia entra em Exames. Bolus e TIG ficam na tela de hipoglicemia.</p>
                <button type="button" onClick={onHipoglicemia} className="tap rounded-sm bg-primary-soft text-primary border border-border px-3 font-semibold">Abrir hipoglicemia</button>
              </Sub>
            )}

            {g.grupo === "Icterícia" && d.motivos.ictericia && (
              <Sub>
                <p className="text-body-sm">
                  {ict.bt != null ? `Aba Icterícia: BT ${fmt(ict.bt, 1)} mg/dL${ictR.zona ? ` — ${ZONA_TXT[ictR.zona]}` : ""}.` : "A bilirrubina e a fototerapia ficam na aba Icterícia."}
                </p>
                <button type="button" onClick={onAbrirIctericia} className="tap rounded-sm bg-primary-soft text-primary border border-border px-3 font-semibold">Abrir Icterícia</button>
              </Sub>
            )}

            {g.grupo === "Neurológico" && d.motivos.asfixia && (
              <Sub>
                <div className="grid grid-cols-3 gap-2">
                  <NumInput rotulo="Apgar 1'" valor={d.apgar1} onChange={(v) => set({ apgar1: v })} />
                  <NumInput rotulo="Apgar 5'" valor={d.apgar5} onChange={(v) => set({ apgar5: v })} />
                  <NumInput rotulo="Apgar 10'" valor={d.apgar10} onChange={(v) => set({ apgar10: v })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <NumInput rotulo="pH (cordão/1ª hora)" valor={d.phCordao} onChange={(v) => set({ phCordao: v })} />
                  <NumInput rotulo="BE" unidade="mmol/L" valor={d.beCordao} onChange={(v) => set({ beCordao: v })} />
                </div>
                <p className="text-caption text-subtle">Só registro: o app ainda não tem critério de asfixia/hipotermia cadastrado com fonte.</p>
              </Sub>
            )}

            {g.grupo === "Cirúrgico" && d.motivos.cirurgico && (
              <Sub>
                <Segmentado rotulo="Situação cirúrgica" valor={d.cirurgia} opcoes={CIRURGIAS} onChange={(v) => set({ cirurgia: v })} />
              </Sub>
            )}
          </div>
        ))}

        <label className="block">
          <span className="block text-body-sm text-muted mb-1">Outro motivo</span>
          <input
            type="text"
            value={d.outroMotivo ?? ""}
            onChange={(ev) => set({ outroMotivo: ev.target.value })}
            className="w-full rounded-sm bg-surface-2 border border-border px-3 text-input control-h"
          />
        </label>
      </Card>

      {(sugereAsfixia || sugereSepse) && (
        <section className="space-y-2" aria-label="Sugestões para a venóclise">
          {sugereAsfixia && <Sugestao texto="A venóclise ainda não marca “Asfixia / SDR / VM umidificada” (muda a faixa de volume)." onClick={() => onMarcarVenoclise("asfixiaSdrVm")} />}
          {sugereSepse && <Sugestao texto="A venóclise ainda não marca “Sepse / doença aguda” (lembrete de TIG)." onClick={() => onMarcarVenoclise("sepseOuDoencaAguda")} />}
        </section>
      )}

      <Card titulo="Cuidados em uso">
        <p className="text-caption text-subtle">Marque o que vale agora. Isso define os critérios da Portaria abaixo.</p>
        <div className="flex flex-wrap gap-2">
          {CUIDADOS.map((c) => (
            <Interruptor key={c.id} rotulo={c.texto} ativo={!!d.cuidados[c.id]} onChange={() => toggleCuidado(c.id)} />
          ))}
        </div>
        {pertoEst && !d.cuidados.foto_perto_est && (
          <Sugestao texto={`Aba Icterícia: em fototerapia, ${minuscula(ZONA_TXT[ictR.zona as keyof typeof ZONA_TXT])}. Pode ser “fototerapia com BT perto da exsanguineotransfusão”.`} onClick={() => toggleCuidado("foto_perto_est")} />
        )}
      </Card>

      <section className="rounded-lg bg-surface border border-border shadow-card p-4 space-y-3" aria-live="polite">
        <h2 className="text-eyebrow text-muted">Nível de cuidado (Portaria 930/2012)</h2>
        <div className={`rounded-md border-l-4 border px-3 py-2 ${nivel.sugerido === "UTIN" ? "bg-danger-soft border-danger" : nivel.sugerido ? "bg-warning-soft border-warning" : "bg-surface-2 border-border"}`}>
          <div className="text-heading">{nivel.sugerido ? `Critérios de ${nivel.sugerido} presentes` : "Nenhum critério da Portaria marcado"}</div>
          <div className="text-caption text-muted">A Portaria lista critérios; onde internar é decisão do médico e do serviço.</div>
        </div>
        {nivel.criterios.length > 0 && (
          <ul className="space-y-1 text-body-sm">
            {nivel.criterios.map((c) => (
              <li key={`${c.ref}-${c.texto}`}>
                <span className="font-semibold">{c.unidade} · {c.ref}:</span> {c.texto}
              </li>
            ))}
          </ul>
        )}
        {nivel.avisos.map((a) => <p key={a} className="text-body-sm text-warning font-semibold">{a}</p>)}
        {nivel.pendencias.length > 0 && <p className="text-body-sm text-muted">Falta para avaliar: {nivel.pendencias.join("; ")}.</p>}
        <p className="text-caption text-subtle">Fonte: {FONTE_PORTARIA_930}.</p>
      </section>

      <Card
        titulo="Exames"
        extra={
          <button type="button" onClick={novaColeta} className="tap rounded-sm bg-primary text-on-primary px-3 text-body-sm font-semibold">
            Nova coleta
          </button>
        }
      >
        {d.coletas.length === 0 && <p className="text-body-sm text-muted">Nenhuma coleta. Toque em “Nova coleta” para lançar glicemia, hemograma, PCR, eletrólitos, gasometria, líquor e culturas.</p>}
        {pcrs.length >= 2 && (
          <p className="text-body-sm num">
            PCR: {pcrs.map((x) => `${fmt(x.r.pcrMgDl as number, 2)}${x.r.horas != null ? ` (${Math.floor(x.r.horas)} h)` : ""}`).join(" → ")} mg/dL
          </p>
        )}
      </Card>

      {avaliadas.map(({ coleta: c, r }) => (
        <ColetaCard
          key={c.id}
          c={c}
          r={r}
          temNascimento={!!nasc}
          agora={agora}
          set={(p) => setColeta(c.id, p)}
          onApagar={() => apagarColeta(c.id)}
          onLevarLabs={() => onLevarLabs(labsParaVenoclise(c))}
          onHipoglicemia={onHipoglicemia}
        />
      ))}

      <Card titulo="Texto para a evolução">
        <pre className="whitespace-pre-wrap text-body-sm font-sans">{texto}</pre>
        <button
          type="button"
          onClick={() => { void navigator.clipboard?.writeText(texto).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); }); }}
          className="tap w-full rounded-sm bg-primary text-on-primary font-semibold"
        >
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </Card>

      {limpar ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setLimpar(false)} className="tap rounded-sm border border-border font-semibold">Cancelar</button>
          <button type="button" onClick={() => { setD({ motivos: {}, cuidados: {}, coletas: [] }); setLimpar(false); }} className="tap rounded-sm bg-danger text-on-primary font-semibold">Apagar tudo da internação</button>
        </div>
      ) : (
        <button type="button" onClick={() => setLimpar(true)} className="tap w-full rounded-sm border border-border text-muted font-semibold">
          Limpar internação
        </button>
      )}
    </div>
  );
}

const ZONA_TXT = {
  abaixo: "Abaixo do limiar de fototerapia",
  faixa_foto: "Dentro da faixa de fototerapia",
  fototerapia: "Fototerapia indicada",
  faixa_exs: "Dentro da faixa de exsanguineotransfusão",
  escalonamento: "Zona de escalonamento (até 2 mg/dL do exsanguíneo)",
  exsanguineo: "No limiar de exsanguineotransfusão",
} as const;

function Sub({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-border bg-surface-2 p-3 space-y-3">{children}</div>;
}

function Sugestao({ texto, onClick }: { texto: string; onClick: () => void }) {
  return (
    <div className="rounded-md border border-primary-2 bg-primary-soft px-3 py-2 text-body-sm flex items-center justify-between gap-3">
      <span>{texto}</span>
      <button type="button" onClick={onClick} className="tap shrink-0 rounded-sm bg-primary text-on-primary px-3 font-semibold">Marcar</button>
    </div>
  );
}

function Grupo({ titulo, aberto, children }: { titulo: string; aberto: boolean; children: ReactNode }) {
  return (
    <details className="rounded-md border border-border bg-surface-2 px-3 py-2" open={aberto}>
      <summary className="tap cursor-pointer text-body-sm font-semibold flex items-center">{titulo}</summary>
      <div className="mt-2 space-y-3 pb-1">{children}</div>
    </details>
  );
}

function ColetaCard({
  c,
  r,
  temNascimento,
  agora,
  set,
  onApagar,
  onLevarLabs,
  onHipoglicemia,
}: {
  c: ColetaExames;
  r: ResultadoColeta;
  temNascimento: boolean;
  agora: Date;
  set: (p: Partial<ColetaExames>) => void;
  onApagar: () => void;
  onLevarLabs: () => void;
  onHipoglicemia: () => void;
}) {
  const [apagar, setApagar] = useState(false);
  const [levado, setLevado] = useState(false);
  const tem = (...v: unknown[]) => v.some((x) => x != null && x !== "" && x !== false);
  const temLabsVeno = tem(c.glicemia, c.na, c.k, c.caTotal, c.caIonico, c.mg);
  const hipo = c.glicemia != null && c.glicemia < 45;
  const id = `coleta-${c.id}`;

  return (
    <section className="rounded-lg bg-surface border border-border shadow-card p-4 space-y-3" aria-labelledby={`${id}-t`}>
      <div className="flex items-center justify-between gap-2">
        <h2 id={`${id}-t`} className="text-eyebrow text-muted">
          Coleta · {quando(c.em)}{r.horas != null ? ` · ${Math.floor(r.horas)} h` : ""}
        </h2>
        {apagar ? (
          <span className="flex gap-2">
            <button type="button" onClick={() => setApagar(false)} className="tap rounded-sm border border-border px-3 text-body-sm font-semibold">Não</button>
            <button type="button" onClick={onApagar} className="tap rounded-sm bg-danger text-on-primary px-3 text-body-sm font-semibold">Apagar</button>
          </span>
        ) : (
          <button type="button" onClick={() => setApagar(true)} className="tap rounded-sm border border-border px-3 text-body-sm text-muted font-semibold">Apagar</button>
        )}
      </div>

      {temNascimento ? (
        <div>
          <label className="block text-body-sm text-muted mb-1" htmlFor={`${id}-em`}>Data e hora da coleta</label>
          <div className="flex gap-2">
            <input
              id={`${id}-em`}
              type="datetime-local"
              value={c.em ?? ""}
              max={isoLocal(agora)}
              onChange={(ev) => set({ em: ev.target.value || null })}
              className="w-full rounded-sm bg-surface-2 border border-border px-3 text-input control-h min-w-0"
            />
            <button type="button" onClick={() => set({ em: isoLocal(agora) })} className="tap shrink-0 rounded-sm bg-primary-soft text-primary border border-border px-3 text-body-sm font-semibold">
              Agora
            </button>
          </div>
        </div>
      ) : (
        <NumInput rotulo="Horas de vida na coleta" unidade="h" valor={c.horasManual} onChange={(v) => set({ horasManual: v })} ajuda="Com a data/hora de nascimento no paciente, o app calcula sozinho" />
      )}

      <Grupo titulo="Glicemia" aberto={tem(c.glicemia)}>
        <NumInput rotulo="Glicemia" unidade="mg/dL" valor={c.glicemia} onChange={(v) => set({ glicemia: v })} />
        <Segmentado rotulo="Tipo" valor={c.glicemiaTipo} opcoes={[{ valor: "capilar", texto: "Capilar" }, { valor: "plasmatica", texto: "Plasmática" }]} onChange={(v) => set({ glicemiaTipo: v })} />
        <Interruptor rotulo="Com sinais de hipoglicemia" ativo={!!c.sintomatico} onChange={(v) => set({ sintomatico: v })} />
      </Grupo>

      <Grupo titulo="Hemograma" aberto={tem(c.leucocitos, c.plaquetas, c.hb, c.ht, c.segmentadosPct)}>
        <NumInput rotulo="Leucócitos" unidade="/mm³" valor={c.leucocitos} onChange={(v) => set({ leucocitos: v })} parse={parseContagemBR} placeholder="12.500" />
        <div className="grid grid-cols-2 gap-2">
          <NumInput rotulo="Segmentados" unidade="%" valor={c.segmentadosPct} onChange={(v) => set({ segmentadosPct: v })} />
          <NumInput rotulo="Bastões" unidade="%" valor={c.bastoesPct} onChange={(v) => set({ bastoesPct: v })} />
          <NumInput rotulo="Metamielócitos" unidade="%" valor={c.metamielocitosPct} onChange={(v) => set({ metamielocitosPct: v })} />
          <NumInput rotulo="Mielócitos" unidade="%" valor={c.mielocitosPct} onChange={(v) => set({ mielocitosPct: v })} />
          <NumInput rotulo="Promielócitos" unidade="%" valor={c.promielocitosPct} onChange={(v) => set({ promielocitosPct: v })} />
        </div>
        <p className="text-caption text-subtle">Vazios entre metamielócitos, mielócitos e promielócitos contam como 0.</p>
        <NumInput rotulo="Plaquetas" unidade="/mm³" valor={c.plaquetas} onChange={(v) => set({ plaquetas: v })} parse={parseContagemBR} placeholder="250.000" />
        <div className="grid grid-cols-2 gap-2">
          <NumInput rotulo="Hb" unidade="g/dL" valor={c.hb} onChange={(v) => set({ hb: v })} />
          <NumInput rotulo="Ht" unidade="%" valor={c.ht} onChange={(v) => set({ ht: v })} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Interruptor rotulo="Alterações degenerativas nos neutrófilos" ativo={!!c.degenerativas} onChange={(v) => set({ degenerativas: v })} />
          <Interruptor rotulo="Leucometria alterada para a idade" ativo={!!c.leucometriaAlterada} onChange={(v) => set({ leucometriaAlterada: v })} />
        </div>
        <p className="text-caption text-subtle">Leucócitos &lt; 5.000 já contam no escore sem marcar. Hb e Ht: só registro.</p>
      </Grupo>

      <Grupo titulo="PCR" aberto={tem(c.pcr)}>
        <NumInput rotulo="PCR" unidade={c.pcrUnidade ?? ""} valor={c.pcr} onChange={(v) => set({ pcr: v })} />
        <Segmentado rotulo="Unidade do laudo" valor={c.pcrUnidade} opcoes={[{ valor: "mg/dL", texto: "mg/dL" }, { valor: "mg/L", texto: "mg/L" }]} onChange={(v) => set({ pcrUnidade: v })} />
      </Grupo>

      <Grupo titulo="Eletrólitos" aberto={tem(c.na, c.k, c.caTotal, c.caIonico, c.mg)}>
        <div className="grid grid-cols-2 gap-2">
          <NumInput rotulo="Na" unidade="mmol/L" valor={c.na} onChange={(v) => set({ na: v })} />
          <NumInput rotulo="K" unidade="mmol/L" valor={c.k} onChange={(v) => set({ k: v })} />
          <NumInput rotulo="Ca total" unidade="mg/dL" valor={c.caTotal} onChange={(v) => set({ caTotal: v })} />
          <NumInput rotulo="Ca iônico" unidade="mmol/L" valor={c.caIonico} onChange={(v) => set({ caIonico: v })} />
          <NumInput rotulo="Mg" unidade="mg/dL" valor={c.mg} onChange={(v) => set({ mg: v })} />
        </div>
      </Grupo>

      <Grupo titulo="Gasometria" aberto={tem(c.ph, c.pco2, c.hco3, c.be, c.lactato)}>
        <div className="grid grid-cols-2 gap-2">
          <NumInput rotulo="pH" valor={c.ph} onChange={(v) => set({ ph: v })} />
          <NumInput rotulo="pCO₂" unidade="mmHg" valor={c.pco2} onChange={(v) => set({ pco2: v })} />
          <NumInput rotulo="HCO₃" unidade="mmol/L" valor={c.hco3} onChange={(v) => set({ hco3: v })} />
          <NumInput rotulo="BE" unidade="mmol/L" valor={c.be} onChange={(v) => set({ be: v })} />
          <NumInput rotulo="Lactato" unidade="mmol/L" valor={c.lactato} onChange={(v) => set({ lactato: v })} />
        </div>
        <p className="text-caption text-subtle">Só registro: sem faixa de referência cadastrada com fonte.</p>
      </Grupo>

      <Grupo titulo="Líquor" aberto={tem(c.lcrCelulas, c.lcrProteina, c.lcrGlicose)}>
        <div className="grid grid-cols-3 gap-2">
          <NumInput rotulo="Células" unidade="/mm³" valor={c.lcrCelulas} onChange={(v) => set({ lcrCelulas: v })} />
          <NumInput rotulo="Proteína" unidade="mg/dL" valor={c.lcrProteina} onChange={(v) => set({ lcrProteina: v })} />
          <NumInput rotulo="Glicose" unidade="mg/dL" valor={c.lcrGlicose} onChange={(v) => set({ lcrGlicose: v })} />
        </div>
      </Grupo>

      <Grupo titulo="Culturas" aberto={tem(c.hemocultura, c.culturaLcr)}>
        <Segmentado rotulo="Hemocultura" valor={c.hemocultura} opcoes={STATUS_CULTURA} onChange={(v) => set({ hemocultura: v })} />
        {c.hemocultura === "positiva" && <TextoCurto rotulo="Agente (hemocultura)" valor={c.hemoculturaAgente} onChange={(v) => set({ hemoculturaAgente: v })} />}
        <Segmentado rotulo="Cultura de líquor" valor={c.culturaLcr} opcoes={STATUS_CULTURA} onChange={(v) => set({ culturaLcr: v })} />
        {c.culturaLcr === "positiva" && <TextoCurto rotulo="Agente (líquor)" valor={c.culturaLcrAgente} onChange={(v) => set({ culturaLcrAgente: v })} />}
      </Grupo>

      <Grupo titulo="Outros exames" aberto={tem(c.outros)}>
        <label className="block">
          <span className="sr-only">Outros exames</span>
          <textarea
            value={c.outros ?? ""}
            onChange={(ev) => set({ outros: ev.target.value })}
            rows={2}
            placeholder="Ex.: BD 0,8; TGO 40; US transfontanela normal"
            className="w-full rounded-sm bg-surface-2 border border-border px-3 py-2 text-input"
          />
        </label>
      </Grupo>

      {r.pendencias.length > 0 && (
        <div className="space-y-1">
          {r.pendencias.map((p) => <p key={p} className="text-body-sm text-warning font-semibold">{p}</p>)}
        </div>
      )}

      {r.achados.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {r.achados.map((a, i) => <AchadoItem key={`${a.exame}-${i}`} a={a} />)}
        </ul>
      )}

      {r.hemograma && (
        <details className="rounded-md border border-border bg-surface-2 px-3 py-2">
          <summary className="tap cursor-pointer text-body-sm font-semibold flex items-center">
            Escore de Rodwell: {r.hemograma.rodwell.min === r.hemograma.rodwell.max ? r.hemograma.rodwell.min : `${r.hemograma.rodwell.min}–${r.hemograma.rodwell.max}`} de 7
          </summary>
          <ul className="mt-2 space-y-1 text-body-sm">
            {r.hemograma.rodwell.itens.map((i) => (
              <li key={i.texto} className="flex justify-between gap-3">
                <span>{i.texto}</span>
                <span className="num font-semibold">{i.pontos === 1 ? "1" : i.pontos === 0 ? "0" : i.semDado ? "sem dado" : "limítrofe"}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {(hipo || temLabsVeno) && (
        <div className="flex flex-wrap gap-2">
          {hipo && <button type="button" onClick={onHipoglicemia} className="tap rounded-sm bg-danger text-on-primary px-3 text-body-sm font-semibold">Abrir hipoglicemia</button>}
          {temLabsVeno && (
            <button type="button" onClick={() => { onLevarLabs(); setLevado(true); setTimeout(() => setLevado(false), 2000); }} className="tap rounded-sm bg-primary-soft text-primary border border-border px-3 text-body-sm font-semibold">
              {levado ? "Levado para a venóclise" : "Levar glicemia e eletrólitos para a venóclise"}
            </button>
          )}
        </div>
      )}

      {r.memoria.length > 0 && (
        <details className="rounded-md border border-border px-3 py-2">
          <summary className="tap cursor-pointer text-body-sm text-muted flex items-center">Memória de cálculo</summary>
          <ol className="mt-2 space-y-2 text-body-sm">
            {r.memoria.map((m) => (
              <li key={m.titulo}>
                <div className="font-semibold">{m.titulo}: <span className="num">{m.resultado}</span></div>
                <div className="text-muted num">{m.formula}</div>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}

function AchadoItem({ a }: { a: Achado }) {
  return (
    <li className={`rounded-md border-l-4 border px-3 py-2 ${COR[a.status]}`}>
      <div className="text-body-sm"><span className="font-semibold">{a.exame}:</span> {a.texto}</div>
      {a.fonte && <div className="text-caption text-subtle">{a.fonte}</div>}
    </li>
  );
}

function TextoCurto({ rotulo, valor, onChange }: { rotulo: string; valor?: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-body-sm text-muted mb-1">{rotulo}</span>
      <input type="text" value={valor ?? ""} onChange={(ev) => onChange(ev.target.value)} className="w-full rounded-sm bg-surface-2 border border-border px-3 text-input control-h" />
    </label>
  );
}

