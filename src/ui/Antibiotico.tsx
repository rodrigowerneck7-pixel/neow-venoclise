import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  ADEQUAR,
  calcularDose,
  cronograma,
  decidirInicio,
  doseFonteTexto,
  DURACOES,
  EMPIRICO_PRECOCE,
  fmtDataHora,
  reavaliar,
  resumoDose,
  textoAntibiotico,
  type Conduta,
  type ContextoAtb,
  type DadosAntibiotico,
  type DrogaNoEsquema,
  type ResultadoDose,
  type SimNao,
} from "../core/antibiotico";
import { ANTIMICROBIANOS, DROGA, FONTE_DOSES, type DrogaId } from "../core/dados/antimicrobianos";
import type { FichaRN } from "../core/ficha";
import { contextoDaFicha, resumoInfeccioso, type DadosInternacao } from "../core/internacao";
import { fmt } from "../core/numeros";
import { horasDeVida } from "../core/tempo";
import { parseNascimento } from "../db/validacao";
import { Card, Chip, Interruptor, NumInput, Segmentado } from "./campos";
import { avaliarColetas } from "./Internacao";

interface Props {
  d: DadosAntibiotico;
  setD: Dispatch<SetStateAction<DadosAntibiotico>>;
  ficha: FichaRN;
  nascimento: string | null;
  agora: Date;
  topo: ReactNode;
  inter: DadosInternacao;
  /** Diurese informada na venóclise (lembrete renal de aminoglicosídeo). */
  diureseMlKgH: number | null;
  onAbrirInternacao: () => void;
}

const isoLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const EMPIRICOS: DrogaId[] = [...EMPIRICO_PRECOCE.betalactamicos, ...EMPIRICO_PRECOCE.aminoglicosideos];
const SN = [{ valor: "sim" as const, texto: "Sim" }, { valor: "nao" as const, texto: "Não" }];

const COR_CONDUTA: Record<string, string> = {
  hc_atb: "bg-danger-soft border-danger",
  completar: "bg-danger-soft border-danger",
  sepse_clinica: "bg-danger-soft border-danger",
  observacao: "bg-warning-soft border-warning",
  monitorar_resp: "bg-warning-soft border-warning",
  sem_atb_opcoes: "bg-success-soft border-success",
  rotina: "bg-success-soft border-success",
  suspender: "bg-success-soft border-success",
  fora: "bg-surface-2 border-border",
};

export function Antibiotico({ d, setD, ficha, nascimento, agora, topo, inter, diureseMlKgH, onAbrirInternacao }: Props) {
  const set = (p: Partial<DadosAntibiotico>) => setD((x) => ({ ...x, ...p }));
  const [copiado, setCopiado] = useState(false);
  const [limpar, setLimpar] = useState(false);
  const [motivo, setMotivo] = useState("");

  const rn = useMemo(() => contextoDaFicha(ficha), [ficha]);
  const nasc = parseNascimento(nascimento);
  const horasAgora = nasc ? horasDeVida(nasc, agora) : null;
  const pnaDias = horasAgora != null ? Math.floor(horasAgora / 24) : ficha.diaDeVida != null ? ficha.diaDeVida - 1 : null;
  const ctx: ContextoAtb = {
    igSemanas: rn.igSemanas,
    igDias: rn.igDias,
    pesoG: rn.pesoAtualG ?? rn.pesoNascimentoG,
    pesoOrigem: rn.pesoAtualG != null ? "atual" : rn.pesoNascimentoG != null ? "nascimento" : null,
    pnaDias,
    creatinina: d.creatinina ?? null,
    diureseMlKgH,
  };
  const doses = d.drogas.map((x) => calcularDose(x.droga, x.tabela, ctx, x));
  const inicio = parseNascimento(d.inicio ?? null);
  const crono = inicio ? cronograma(inicio, agora, d.duracao) : null;
  const ini = decidirInicio({ igSemanas: rn.igSemanas, horasDeVida: horasAgora, d });
  const reav = reavaliar(d);
  const info = useMemo(() => resumoInfeccioso(avaliarColetas(inter, rn, nascimento)), [inter, rn, nascimento]);
  const texto = textoAntibiotico({ inicio, agora, doses, duracao: d.duracao, historico: d.historico });

  const setDroga = (i: number, p: Partial<DrogaNoEsquema>) => setD((x) => ({ ...x, drogas: x.drogas.map((g, j) => (j === i ? { ...g, ...p } : g)) }));
  const addDroga = (id: DrogaId) => setD((x) => (x.drogas.some((g) => g.droga === id) ? x : { ...x, drogas: [...x.drogas, { droga: id, tabela: DROGA[id].tabelas[0].id }] }));
  const remDroga = (i: number) => setD((x) => ({ ...x, drogas: x.drogas.filter((_, j) => j !== i) }));
  const encerrar = () =>
    setD((x) => ({
      ...x,
      historico: [
        ...x.historico,
        {
          inicio: x.inicio ?? null,
          fim: isoLocal(agora),
          texto: `${x.inicio ? `${fmtDataHora(parseNascimento(x.inicio) as Date)} a ` : "até "}${fmtDataHora(agora)}: ${doses.map((r) => r.droga.nome).join(" + ") || "sem droga"}`,
          motivo: motivo.trim() || undefined,
        },
      ],
      drogas: [],
      inicio: null,
      duracao: null,
      culturas: null,
      rnBem: null,
      triagem: null,
    }));

  // Pistas da Internação.
  const sinaisInter = inter.motivos.suspeita_sepse || Object.values(inter.sinaisSepse ?? {}).some(Boolean);
  const fat = inter.fatoresSepse ?? {};

  return (
    <div className="space-y-4">
      {topo}

      <Card titulo="Iniciar antibiótico? (sepse precoce)">
        {ini.foraDaJanela ? (
          <p className="text-body-sm">
            Mais de 72 h de vida{horasAgora != null ? ` (${Math.floor(horasAgora)} h)` : ""}: os fluxogramas de sepse precoce não se aplicam. Sepse tardia segue o protocolo do serviço, que ainda não está cadastrado.
          </p>
        ) : ini.grupo == null ? (
          ini.pendencias.map((p) => <p key={p} className="text-body-sm text-warning font-semibold">{p}</p>)
        ) : (
          <>
            <p className="text-caption text-subtle">
              {ini.grupo === "ge35" ? "RN ≥ 35 semanas — SBP 2022, Figura 2." : "RN ≤ 34 semanas — SBP 2022, Figura 3."}
              {horasAgora != null ? ` Agora: ${Math.floor(horasAgora)} h de vida.` : ""}
            </p>
            {ini.grupo === "ge35" ? (
              <>
                <Pergunta rotulo="Há sinais clínicos de doença?" valor={d.sinais} onChange={(v) => set({ sinais: v })} dica={sinaisInter ? "Na Internação: suspeita de sepse marcada." : undefined} />
                {d.sinais === "sim" && <Interruptor rotulo="Só desconforto respiratório leve a moderado logo após nascer" ativo={!!d.soRespLeve} onChange={(v) => set({ soRespLeve: v })} />}
                {d.sinais === "nao" && (
                  <>
                    <Pergunta
                      rotulo="Temperatura materna intraparto ≥ 38 °C?"
                      valor={d.tempMaterna38}
                      onChange={(v) => set({ tempMaterna38: v })}
                      dica={fat.febre_materna || fat.corioamnionite ? "Na Internação: febre materna ou corioamnionite marcada (confira se foi intraparto ≥ 38 °C)." : undefined}
                    />
                    {d.tempMaterna38 === "nao" && (
                      <Pergunta rotulo="Profilaxia para EGB (API) era indicada para a mãe?" valor={d.apiIndicada} onChange={(v) => set({ apiIndicada: v })} dica={fat.egb_sem_api ? "Na Internação: EGB positivo sem profilaxia marcado." : undefined} />
                    )}
                    {d.tempMaterna38 === "nao" && d.apiIndicada === "sim" && (
                      <Pergunta rotulo="A API foi adequada (penicilina G, ampicilina ou cefazolina ≥ 4 h antes do parto)?" valor={d.apiAdequada} onChange={(v) => set({ apiAdequada: v })} />
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <Pergunta
                  rotulo="Trabalho de parto prematuro, rotura prematura de membranas ou sinal de infecção intra-amniótica?"
                  valor={d.ptAltoRisco}
                  onChange={(v) => set({ ptAltoRisco: v })}
                  dica={fat.tp_pre37 || fat.bolsa18 || fat.corioamnionite ? "Na Internação: trabalho de parto < 37 sem, bolsa rota ≥ 18 h ou corioamnionite marcado." : "Infecção intra-amniótica: pensar também em movimentos fetais diminuídos ou testes fetais alterados sem explicação."}
                />
                {d.ptAltoRisco === "nao" && <Pergunta rotulo="Nasceu de parto induzido (com ou sem dilatação; vaginal ou cesárea)?" valor={d.ptInduzido} onChange={(v) => set({ ptInduzido: v })} />}
                {d.ptAltoRisco === "nao" && d.ptInduzido === "sim" && (
                  <Pergunta rotulo="Algum destes: API para EGB indicada e inadequada; preocupação com infecção intra-amniótica; instabilidade respiratória ou cardiovascular?" valor={d.ptAchado} onChange={(v) => set({ ptAchado: v })} />
                )}
                {d.ptAltoRisco === "nao" && d.ptInduzido === "nao" && (
                  <Pergunta rotulo="Cesárea por indicação materna/fetal, sem trabalho de parto e com bolsa íntegra até o parto?" valor={d.ptCesarea} onChange={(v) => set({ ptCesarea: v })} />
                )}
              </>
            )}
            {ini.pendencias.length > 0 && <p className="text-body-sm text-muted">{ini.pendencias[0]}</p>}
            {ini.grupo === "ge35" && ini.categoria && ini.seriada && ini.categoria.id === ini.seriada.id ? (
              <CondutaBox c={ini.categoria} />
            ) : (
              <>
                {ini.categoria && <CondutaBox c={ini.categoria} rotulo="Por categoria de risco (A)" />}
                {ini.seriada && <CondutaBox c={ini.seriada} rotulo="Avaliação clínica seriada (C)" />}
              </>
            )}
            {ini.pt && <CondutaBox c={ini.pt} />}
            {ini.notas.map((n) => <p key={n} className="text-caption text-subtle">{n}</p>)}
            <p className="text-caption text-subtle">A calculadora de sepse (abordagem B) não está no app.</p>
          </>
        )}
      </Card>

      <Card titulo="Esquema">
        {d.drogas.length < 2 && d.drogas.every((g) => EMPIRICOS.includes(g.droga)) && (
          <div className="space-y-2">
            <p className="text-body-sm">Primeira escolha na sepse precoce (SBP 2022): ampicilina ou penicilina cristalina + gentamicina ou amicacina. Você escolhe.</p>
            <div className="flex flex-wrap gap-2">
              {EMPIRICOS.filter((id) => !d.drogas.some((g) => g.droga === id)).map((id) => (
                <Chip key={id} ativo={false} onClick={() => addDroga(id)}>+ {DROGA[id].nome}</Chip>
              ))}
            </div>
          </div>
        )}
        <label className="block">
          <span className="block text-body-sm text-muted mb-1">Adicionar antimicrobiano</span>
          <select
            value=""
            onChange={(ev) => { if (ev.target.value) addDroga(ev.target.value as DrogaId); }}
            className="w-full rounded-sm bg-surface-2 border border-border px-3 text-input control-h"
          >
            <option value="">Escolher…</option>
            {ANTIMICROBIANOS.filter((x) => !d.drogas.some((g) => g.droga === x.id)).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </label>
        {info.liquorAlterado && <p className="text-body-sm text-warning font-semibold">Líquor fora da referência na Internação: veja as tabelas de meningite.</p>}
        {info.hemoculturaPositiva && <p className="text-body-sm text-warning font-semibold">Hemocultura {info.hemocultura} na Internação: adequar ao agente e ao antibiograma.</p>}
        <div>
          <label className="block text-body-sm text-muted mb-1" htmlFor="atb-inicio">Início (1ª dose)</label>
          <div className="flex gap-2">
            <input
              id="atb-inicio"
              type="datetime-local"
              value={d.inicio ?? ""}
              max={isoLocal(agora)}
              onChange={(ev) => set({ inicio: ev.target.value || null })}
              className="w-full rounded-sm bg-surface-2 border border-border px-3 text-input control-h min-w-0"
            />
            <button type="button" onClick={() => set({ inicio: isoLocal(agora) })} className="tap shrink-0 rounded-sm bg-primary-soft text-primary border border-border px-3 text-body-sm font-semibold">Agora</button>
          </div>
          <p className="text-caption text-subtle mt-1 num">
            Peso da dose: {ctx.pesoG != null ? `${fmt(ctx.pesoG, 0)} g (${ctx.pesoOrigem === "atual" ? "atual" : "nascimento"})` : "—"} · dias de vida: {pnaDias ?? "—"}
          </p>
        </div>
      </Card>

      {doses.map((r, i) => (
        <DrogaCard
          key={r.droga.id}
          r={r}
          g={d.drogas[i]}
          ctx={ctx}
          nascimento={nasc}
          creatinina={d.creatinina ?? null}
          setCreatinina={(v) => set({ creatinina: v })}
          set={(p) => setDroga(i, p)}
          onRemover={() => remDroga(i)}
        />
      ))}

      {d.drogas.length > 0 && (
        <Card titulo="Duração">
          <div className="flex flex-wrap gap-2">
            {DURACOES.map((x) => (
              <Chip key={x.id} ativo={d.duracao === x.id} onClick={() => set({ duracao: d.duracao === x.id ? null : x.id })}>
                {x.texto} · {x.dias[0] === x.dias[1] ? x.dias[0] : `${x.dias[0]}–${x.dias[1]}`} d
              </Chip>
            ))}
          </div>
          {crono ? (
            <div className="space-y-1 text-body-sm num">
              <p className="text-heading">{crono.dia != null ? `D${crono.dia} de antibiótico` : "Início no futuro: confira a data"}</p>
              <p>Reavaliar entre {fmtDataHora(crono.reavaliarDe)} e {fmtDataHora(crono.reavaliarAte)} (36–48 h).</p>
              {crono.duracao && (
                <p>
                  Termina {crono.duracao.dias[0] === crono.duracao.dias[1] ? `em ${fmtDataHora(crono.duracao.fimMax)}` : `entre ${fmtDataHora(crono.duracao.fimMin)} e ${fmtDataHora(crono.duracao.fimMax)}`} ({crono.duracao.fonte}).
                </p>
              )}
            </div>
          ) : (
            <p className="text-body-sm text-muted">Informe o início para contar os dias.</p>
          )}
        </Card>
      )}

      {d.drogas.length > 0 && (
        <Card titulo="Reavaliação em 36–48 h">
          <Segmentado
            rotulo="Culturas"
            valor={d.culturas}
            opcoes={[{ valor: "aguardando", texto: "Aguardando" }, { valor: "negativas", texto: "Negativas" }, { valor: "positivas", texto: "Positivas" }]}
            onChange={(v) => set({ culturas: v })}
          />
          {info.hemocultura && <p className="text-caption text-subtle">Na Internação: hemocultura {info.hemocultura}.</p>}
          {d.culturas === "negativas" && (
            <>
              <Pergunta rotulo="O RN está bem?" valor={d.rnBem} onChange={(v) => set({ rnBem: v })} />
              <Segmentado rotulo="Triagem (hemograma/PCR)" valor={d.triagem} opcoes={[{ valor: "negativa", texto: "Negativa" }, { valor: "alterada", texto: "Alterada" }]} onChange={(v) => set({ triagem: v })} />
              {(info.pcrs.length > 0 || info.rodwellMax != null) && (
                <p className="text-caption text-subtle num">
                  Na Internação: {info.pcrs.length > 0 ? `PCR ${info.pcrs.map((p) => `${fmt(p.mgdl, 2)}${p.horas != null ? ` (${Math.floor(p.horas)} h)` : ""}`).join(" → ")} mg/dL` : ""}
                  {info.pcrs.length > 0 && info.rodwellMax != null ? "; " : ""}
                  {info.rodwellMax != null ? `Rodwell até ${info.rodwellMax}` : ""}.
                </p>
              )}
            </>
          )}
          {reav.pendencias.length > 0 && <p className="text-body-sm text-muted">{reav.pendencias.join(" ")}</p>}
          {reav.conduta && <CondutaBox c={reav.conduta} />}
          <button type="button" onClick={onAbrirInternacao} className="tap rounded-sm bg-primary-soft text-primary border border-border px-3 text-body-sm font-semibold">Lançar exames na Internação</button>
        </Card>
      )}

      <Card titulo="Adequar ou escalonar">
        <ul className="space-y-2 text-body-sm list-disc pl-5">
          {ADEQUAR.map((a) => (
            <li key={a.texto}>
              {a.texto} <span className="text-caption text-subtle">({a.fonte})</span>
            </li>
          ))}
        </ul>
        {d.drogas.length > 0 && (
          <div className="space-y-2">
            <label className="block">
              <span className="block text-body-sm text-muted mb-1">Motivo (suspensão, troca, alta)</span>
              <input type="text" value={motivo} onChange={(ev) => setMotivo(ev.target.value)} className="w-full rounded-sm bg-surface-2 border border-border px-3 text-input control-h" />
            </label>
            <button type="button" onClick={() => { encerrar(); setMotivo(""); }} className="tap w-full rounded-sm border border-border font-semibold">
              Encerrar este esquema
            </button>
            <p className="text-caption text-subtle">Vai para o histórico abaixo; depois escolha o novo esquema, se houver.</p>
          </div>
        )}
        {d.historico.length > 0 && (
          <div className="space-y-1">
            <div className="text-body-sm text-muted">Esquemas anteriores</div>
            {d.historico.map((h, i) => (
              <p key={i} className="text-body-sm num">{h.texto}{h.motivo ? ` — ${h.motivo}` : ""}</p>
            ))}
          </div>
        )}
      </Card>

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
          <button type="button" onClick={() => { setD({ drogas: [], historico: [] }); setLimpar(false); }} className="tap rounded-sm bg-danger text-on-primary font-semibold">Apagar tudo do antibiótico</button>
        </div>
      ) : (
        <button type="button" onClick={() => setLimpar(true)} className="tap w-full rounded-sm border border-border text-muted font-semibold">Limpar antibiótico</button>
      )}
    </div>
  );
}

function Pergunta({ rotulo, valor, onChange, dica }: { rotulo: string; valor?: SimNao | null; onChange: (v: SimNao | null) => void; dica?: string }) {
  return (
    <div className="space-y-1">
      <Segmentado rotulo={rotulo} valor={valor} opcoes={SN} onChange={onChange} />
      {dica && <p className="text-caption text-subtle">{dica}</p>}
    </div>
  );
}

function CondutaBox({ c, rotulo }: { c: Conduta; rotulo?: string }) {
  return (
    <div className={`rounded-md border-l-4 border px-3 py-2 ${COR_CONDUTA[c.id] ?? "bg-surface-2 border-border"}`} aria-live="polite">
      {rotulo && <div className="text-caption text-muted">{rotulo}</div>}
      <div className="text-heading">{c.titulo}</div>
      <p className="text-body-sm">{c.texto}</p>
      <p className="text-caption text-subtle">{c.fonte}</p>
    </div>
  );
}

function DrogaCard({
  r,
  g,
  ctx,
  nascimento,
  creatinina,
  setCreatinina,
  set,
  onRemover,
}: {
  r: ResultadoDose;
  g: DrogaNoEsquema;
  ctx: ContextoAtb;
  nascimento: Date | null;
  creatinina: number | null;
  setCreatinina: (v: number | null) => void;
  set: (p: Partial<DrogaNoEsquema>) => void;
  onRemover: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const un = r.droga.unidade;
  const sp = r.spec;
  const faixaKg = sp && Array.isArray(sp.porKg) ? (sp.porKg as readonly [number, number]) : null;
  const faixaH = sp && Array.isArray(sp.cadaH) ? (sp.cadaH as readonly [number, number]) : null;
  const faixaAtaque = r.tabela.ataque && Array.isArray(r.tabela.ataque.porKg) ? (r.tabela.ataque.porKg as readonly [number, number]) : null;
  // Outra tabela do mesmo grupo (ex.: pelo peso) que dá dose diferente.
  const alternativas = r.droga.tabelas
    .filter((t) => t.grupo === r.tabela.grupo && t.id !== r.tabela.id)
    .map((t) => ({ t, x: calcularDose(r.droga.id, t.id, ctx, {}) }))
    .filter(({ x }) => x.spec && r.spec && doseFonteTexto(x) + x.spec.cadaH !== doseFonteTexto(r) + r.spec.cadaH);
  const mudaEm = r.mudaComPna != null && ctx.pnaDias != null && r.mudaComPna > ctx.pnaDias && nascimento ? new Date(nascimento.getTime() + r.mudaComPna * 86_400_000) : null;

  return (
    <section className="rounded-lg bg-surface border border-border shadow-card p-4 space-y-3" aria-label={r.droga.nome}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-heading">{r.droga.nome}</h2>
        <button type="button" onClick={onRemover} className="tap rounded-sm border border-border px-3 text-body-sm text-muted font-semibold">Tirar</button>
      </div>
      {r.droga.tabelas.length > 1 && (
        <Segmentado rotulo="Tabela do PDF" valor={g.tabela} opcoes={r.droga.tabelas.map((t) => ({ valor: t.id, texto: t.titulo }))} onChange={(v) => v && set({ tabela: v, porKg: null, cadaH: null, ataquePorKg: null })} />
      )}
      {r.tabela.id === "creatinina" && <NumInput rotulo="Creatinina sérica" unidade="mg/dL" valor={creatinina} onChange={setCreatinina} />}

      {r.alertas.map((a) => <p key={a} className="text-body-sm text-danger font-semibold">{a}</p>)}

      {sp && (
        <div className="rounded-md bg-surface-2 px-3 py-2">
          <div className="num text-heading">{resumoDose(r)}</div>
          <div className="text-caption text-muted">{r.linha?.rotulo} · {doseFonteTexto(r)}{r.ataque ? ` · ataque ${Array.isArray(r.ataque.porKg) ? (r.ataque.porKg as number[]).map((v) => fmt(v, 2)).join("–") : fmt(r.ataque.porKg as number, 2)} ${un}/kg ${r.ataque.texto}` : ""}</div>
        </div>
      )}
      {faixaKg && <NumInput rotulo={`Dose escolhida (${un}/kg${sp?.porDia ? "/dia" : "/dose"})`} valor={g.porKg} onChange={(v) => set({ porKg: v })} ajuda={`Faixa do PDF: ${fmt(faixaKg[0], 2)}–${fmt(faixaKg[1], 2)}`} />}
      {faixaH && <Segmentado rotulo="Intervalo" valor={g.cadaH != null ? String(g.cadaH) : null} opcoes={[...new Set(faixaH)].map((h) => ({ valor: String(h), texto: `${h}/${h} h` }))} onChange={(v) => set({ cadaH: v ? Number(v) : null })} />}
      {faixaAtaque && <NumInput rotulo={`Ataque escolhido (${un}/kg)`} valor={g.ataquePorKg} onChange={(v) => set({ ataquePorKg: v })} ajuda={`Faixa do PDF: ${fmt(faixaAtaque[0], 2)}–${fmt(faixaAtaque[1], 2)}`} />}

      {r.pendencias.map((p) => <p key={p} className="text-body-sm text-warning font-semibold">{p}</p>)}
      {mudaEm && <p className="text-body-sm">A linha da tabela muda com {r.mudaComPna} dias de vida ({fmtDataHora(mudaEm).slice(0, 5)}): reveja a dose.</p>}
      {alternativas.map(({ t, x }) => (
        <p key={t.id} className="text-caption text-subtle">Pela tabela “{t.titulo}”: {resumoDose(x)} ({doseFonteTexto(x)}).</p>
      ))}

      {r.prescricao && (
        <button
          type="button"
          onClick={() => { void navigator.clipboard?.writeText(r.prescricao ?? "").then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); }); }}
          className="tap w-full rounded-sm bg-primary-soft text-primary border border-border text-left px-3 py-2 text-body-sm font-semibold"
        >
          {copiado ? "Copiado" : r.prescricao}
        </button>
      )}

      {r.notas.length > 0 && (
        <details className="rounded-md border border-border px-3 py-2">
          <summary className="tap cursor-pointer text-body-sm text-muted flex items-center">Notas do PDF</summary>
          <ul className="mt-2 space-y-1 text-body-sm list-disc pl-5">
            {r.notas.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </details>
      )}
      <p className="text-caption text-subtle">Fonte: {FONTE_DOSES}, p. {r.droga.pagina}. Volume conforme a diluição do serviço.</p>
    </section>
  );
}
