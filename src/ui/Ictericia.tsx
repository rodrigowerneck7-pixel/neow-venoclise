import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { IcCheck, IcCopiar } from "./icones";
import type { FichaRN } from "../core/ficha";
import { contextoDaFicha } from "../core/internacao";
import { calcularIctericia, limiarAap, type DadosIctericia, type EntradaIctericia, type Zona } from "../core/ictericia";
import { fmt } from "../core/numeros";
import { horasDeVida, isoLocal } from "../core/tempo";
import { parseNascimento } from "../db/validacao";
import { PainelAlertas } from "./Alertas";
import { Card, Interruptor, NumInput, Segmentado } from "./campos";

interface Props {
  d: DadosIctericia;
  setD: Dispatch<SetStateAction<DadosIctericia>>;
  ficha: FichaRN;
  /** "YYYY-MM-DDTHH:mm" do paciente (null no cálculo rápido ou sem data/hora). */
  nascimento: string | null;
  agora: Date;
  /** Resumo da ficha no topo. */
  topo: ReactNode;
  /** A venóclise já considera fototerapia? */
  fotoNaVenoclise: boolean;
  onMarcarFotoVenoclise: () => void;
}


/** Monta a entrada do motor a partir do que está salvo + ficha. */
export function entradaIctericia(d: DadosIctericia, f: FichaRN, nascimento: string | null): EntradaIctericia {
  const nasc = parseNascimento(nascimento);
  const coleta = parseNascimento(d.coletaEm ?? null);
  const horas = nasc ? (coleta ? horasDeVida(nasc, coleta) : null) : (d.horasManual ?? null);
  const mae = f.tipagemMae, rn = f.tipagemRN;
  return {
    igSemanas: f.igSemanas,
    igDias: f.igDias,
    pesoNascimentoG: contextoDaFicha(f).pesoNascimentoG,
    coombsPositivo: f.coombsDireto === "positivo",
    incompatABO: mae?.abo === "O" && (rn?.abo === "A" || rn?.abo === "B"),
    incompatRh: mae?.rh === "neg" && rn?.rh === "pos",
    bt: d.bt,
    tipo: d.tipo ?? "serica",
    horasDeVida: horas,
    albumina: d.albumina,
    hemolise: d.hemolise,
    g6pd: d.g6pd,
    sepse: d.sepse,
    instabilidade: d.instabilidade,
    subindoApesarFoto: d.subindoApesarFoto,
    sinaisEncefalopatia: d.sinaisEncefalopatia,
    btAnterior: d.btAnterior,
    emFototerapia: d.emFototerapia,
    fotoInicioHoras: d.fotoInicioHoras,
    aparelhos: d.aparelhos,
    intensidade: d.intensidade,
  };
}

const ZONA: Record<Zona, { texto: string; classe: string }> = {
  abaixo: { texto: "Abaixo do limiar de fototerapia", classe: "bg-success-soft borda-sucesso" },
  faixa_foto: { texto: "Dentro da faixa de fototerapia", classe: "bg-warning-soft borda-atencao" },
  fototerapia: { texto: "Fototerapia indicada", classe: "bg-warning-soft borda-atencao" },
  faixa_exs: { texto: "Dentro da faixa de exsanguineotransfusão", classe: "bg-danger-soft borda-perigo" },
  escalonamento: { texto: "Escalonamento de cuidados", classe: "bg-danger-soft borda-perigo" },
  exsanguineo: { texto: "Limiar de exsanguineotransfusão", classe: "bg-danger-soft borda-perigo" },
};

const lim = (l?: { min: number; max: number }) => (l ? (l.min === l.max ? `${fmt(l.min, 1)}` : `${fmt(l.min, 0)}–${fmt(l.max, 0)}`) : "—");

export function Ictericia({ d, setD, ficha, nascimento, agora, topo, fotoNaVenoclise, onMarcarFotoVenoclise }: Props) {
  const set = (p: Partial<DadosIctericia>) => setD((x) => ({ ...x, ...p }));
  const nasc = parseNascimento(nascimento);
  const entrada = useMemo(() => entradaIctericia(d, ficha, nascimento), [d, ficha, nascimento]);
  const r = useMemo(() => calcularIctericia(entrada), [entrada]);
  const horasAgora = nasc ? horasDeVida(nasc, agora) : null;
  const ehAap = ficha.igSemanas != null && ficha.igSemanas >= 35;
  const [copiado, setCopiado] = useState(false);
  const indicada = r.zona != null && r.zona !== "abaixo";

  return (
    <div className="space-y-4">
      {topo}
      <PainelAlertas alertas={r.alertas} acoes={() => null} />

      <Card titulo="Bilirrubina">
        <Segmentado
          rotulo="Medida"
          valor={d.tipo ?? "serica"}
          onChange={(v) => set({ tipo: v ?? "serica" })}
          opcoes={[{ valor: "serica", texto: "Sérica (BT)" }, { valor: "transcutanea", texto: "Transcutânea (TcB)" }]}
        />
        <NumInput rotulo={d.tipo === "transcutanea" ? "TcB" : "Bilirrubina total"} unidade="mg/dL" valor={d.bt} onChange={(v) => set({ bt: v })} ajuda="Total, sem descontar a direta" />
        {nasc ? (
          <div>
            <label className="rotulo" htmlFor="coleta-bt">Data e hora da coleta</label>
            <div className="flex gap-2">
              <input
                id="coleta-bt"
                type="datetime-local"
                value={d.coletaEm ?? ""}
                max={isoLocal(agora)}
                onChange={(ev) => set({ coletaEm: ev.target.value || null })}
                className="campo min-w-0"
              />
              <button type="button" onClick={() => set({ coletaEm: isoLocal(agora) })} className="btn btn-tonal shrink-0 px-3 text-body-sm">
                Agora
              </button>
            </div>
            <p className="text-caption text-subtle mt-1 num">
              {entrada.horasDeVida != null ? `${fmt(entrada.horasDeVida, 1)} h de vida na coleta` : "Informe a hora da coleta"} · agora: {horasAgora != null ? `${Math.floor(horasAgora)} h` : "—"}
            </p>
          </div>
        ) : (
          <NumInput rotulo="Horas de vida na coleta" unidade="h" valor={d.horasManual} onChange={(v) => set({ horasManual: v })} ajuda="Com a data/hora de nascimento no paciente, o app calcula sozinho" />
        )}
      </Card>

      <Card titulo={ehAap ? "Fatores de risco de neurotoxicidade (AAP 2022)" : "Condições agravantes (SBP 2021)"}>
        <p className="text-caption text-subtle">
          {ehAap
            ? "A IG já entra pela tabela. Qualquer fator abaixo troca para as tabelas com risco."
            : "Com qualquer condição abaixo, usar o valor inferior da faixa."}
          {ficha.coombsDireto === "positivo" && " Coombs direto positivo (da ficha) já conta."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Interruptor rotulo="Doença hemolítica" ativo={!!d.hemolise} onChange={(v) => set({ hemolise: v })} />
          <Interruptor rotulo="Deficiência de G6PD" ativo={!!d.g6pd} onChange={(v) => set({ g6pd: v })} />
          <Interruptor rotulo={ehAap ? "Sepse" : "Sepse / meningite"} ativo={!!d.sepse} onChange={(v) => set({ sepse: v })} />
          <Interruptor rotulo={ehAap ? "Instabilidade clínica nas últimas 24 h" : "Instabilidade (pH < 7,15, VM, apneia/bradicardia)"} ativo={!!d.instabilidade} onChange={(v) => set({ instabilidade: v })} />
        </div>
        <NumInput rotulo="Albumina" unidade="g/dL" valor={d.albumina} onChange={(v) => set({ albumina: v })} ajuda={ehAap ? "< 3,0 é fator de risco" : "< 2,5 é agravante"} />
        <div className="flex flex-wrap gap-2">
          {ehAap && <Interruptor rotulo="BT subindo apesar da fototerapia" ativo={!!d.subindoApesarFoto} onChange={(v) => set({ subindoApesarFoto: v })} />}
          <Interruptor rotulo="Sinais de encefalopatia bilirrubínica" ativo={!!d.sinaisEncefalopatia} onChange={(v) => set({ sinaisEncefalopatia: v })} />
        </div>
      </Card>

      <details className="card" open={!!d.btAnterior?.bt}>
        <summary className="tap cursor-pointer text-[15px] font-semibold flex items-center">BT anterior (velocidade de subida)</summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <NumInput rotulo="BT anterior" unidade="mg/dL" valor={d.btAnterior?.bt} onChange={(v) => set({ btAnterior: { horasDeVida: d.btAnterior?.horasDeVida ?? null, bt: v } })} />
          <NumInput rotulo="Horas de vida" unidade="h" valor={d.btAnterior?.horasDeVida} onChange={(v) => set({ btAnterior: { bt: d.btAnterior?.bt ?? null, horasDeVida: v } })} />
        </div>
        {r.velocidade && <p className="text-body-sm mt-2 num">Subida: {fmt(r.velocidade.mgDlH, 2)} mg/dL/h (alerta ≥ {fmt(r.velocidade.corte, 1)})</p>}
      </details>

      {r.pendencias.length > 0 && (
        <Card titulo="Para calcular">
          {r.pendencias.map((p) => <p key={p} className="aviso">{p}</p>)}
        </Card>
      )}

      {r.limiarFoto && r.referencia && (
        <section className="card space-y-3" aria-live="polite">
          {r.zona && (
            <div className={`rounded-xl border px-3 py-2 ${ZONA[r.zona].classe}`}>
              <div className="text-heading">{ZONA[r.zona].texto}</div>
              <div className="text-caption text-muted">{r.referencia.igUsada} · {r.referencia.grupo}</div>
            </div>
          )}
          {r.pedirSerica != null && (
            <div className={`rounded-xl border px-3 py-2 ${r.pedirSerica ? "bg-warning-soft borda-atencao" : "bg-success-soft borda-sucesso"}`}>
              <div className="text-heading">{r.pedirSerica ? "Colher BT sérica" : "TcB longe do limiar"}</div>
              <div className="text-caption text-muted">{r.referencia.igUsada} · {r.referencia.grupo}</div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 text-center">
            <Valor rotulo="Fototerapia" valor={lim(r.limiarFoto)} />
            {r.limiarEscalonamento != null ? <Valor rotulo="Escalonamento" valor={fmt(r.limiarEscalonamento, 1)} /> : <Valor rotulo="BT" valor={d.bt != null ? fmt(d.bt, 1) : "—"} />}
            <Valor rotulo="Exsanguíneo" valor={lim(r.limiarExs)} />
          </div>
          {r.referencia.motivosRisco.length > 0 && <p className="text-caption text-subtle">Fatores: {r.referencia.motivosRisco.join("; ")}.</p>}
          {ehAap && entrada.horasDeVida != null && entrada.horasDeVida >= 1 && entrada.horasDeVida < 360 && (
            <GraficoBili ig={ficha.igSemanas as number} risco={r.referencia.comRisco} riscoExs={r.referencia.comRisco || !!d.subindoApesarFoto} pontos={[
              ...(d.btAnterior?.bt != null && d.btAnterior.horasDeVida != null ? [{ h: d.btAnterior.horasDeVida, bt: d.btAnterior.bt, anterior: true }] : []),
              ...(d.bt != null ? [{ h: entrada.horasDeVida, bt: d.bt, anterior: false }] : []),
            ]} />
          )}
          {r.condutas.length > 0 && (
            <ul className="space-y-1 text-body-sm list-disc pl-5">
              {r.condutas.map((c) => <li key={c}>{c}</li>)}
            </ul>
          )}
          <p className="text-caption text-subtle">Fonte: {r.referencia.fonte}</p>
        </section>
      )}

      <Card titulo="Fototerapia">
        <Interruptor rotulo="Em fototerapia" ativo={!!d.emFototerapia} onChange={(v) => set({ emFototerapia: v })} />
        {d.emFototerapia && (
          <NumInput rotulo="Início da fototerapia (horas de vida)" unidade="h" valor={d.fotoInicioHoras} onChange={(v) => set({ fotoInicioHoras: v })} ajuda={horasAgora != null ? `Agora: ${Math.floor(horasAgora)} h de vida` : undefined} />
        )}
        {(indicada || d.emFototerapia) && (
          <>
            <Segmentado
              rotulo="Aparelhos (você escolhe)"
              valor={d.aparelhos}
              onChange={(v) => set({ aparelhos: v })}
              opcoes={[{ valor: "simples", texto: "Simples" }, { valor: "dupla", texto: "Dupla" }, { valor: "quadrupla", texto: "Quádrupla" }]}
            />
            <Segmentado
              rotulo="Intensidade"
              valor={d.intensidade}
              onChange={(v) => set({ intensidade: v })}
              opcoes={[{ valor: "padrao", texto: "Padrão (8–10 µW/cm²/nm)" }, { valor: "intensiva", texto: "Intensiva (≥ 30)" }]}
            />
            <p className="text-caption text-subtle">
              {ehAap ? "Os limiares da AAP 2022 são para fototerapia intensiva. " : ""}
              Perto do exsanguíneo: alta irradiância na maior superfície (luz na frente e nas costas) — SBP 2021.
            </p>
          </>
        )}
        {r.suspensao && <p className={`text-body-sm ${r.suspensao.podeSuspender ? "text-success font-semibold" : ""}`}>{r.suspensao.podeSuspender ? "Critério de suspensão atingido. " : ""}{r.suspensao.texto}</p>}
        {r.rebote && <p className="text-body-sm">{r.rebote}</p>}
        {(indicada || d.emFototerapia) && !fotoNaVenoclise && (
          <div className="faixa">
            <span>A venóclise ainda não considera fototerapia (faixa de volume +10–20%).</span>
            <button type="button" onClick={onMarcarFotoVenoclise} className="btn btn-primary shrink-0 px-3">Marcar</button>
          </div>
        )}
      </Card>

      {r.prescricaoTexto && (
        <Card titulo="Texto para a prescrição">
          <pre className="whitespace-pre-wrap text-body-sm font-sans">{r.prescricaoTexto}</pre>
          <button
            type="button"
            onClick={() => { void navigator.clipboard?.writeText(r.prescricaoTexto ?? "").then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); }); }}
            className="btn btn-primary w-full"
          >
            {copiado ? <><IcCheck />Copiado</> : <><IcCopiar />Copiar</>}
          </button>
        </Card>
      )}

      {r.memoria.length > 0 && (
        <details className="card">
          <summary className="tap cursor-pointer text-[15px] font-semibold flex items-center">Memória de cálculo</summary>
          <ol className="mt-3 space-y-2 text-body-sm">
            {r.memoria.map((m) => (
              <li key={m.titulo}>
                <div className="font-semibold">{m.titulo}: <span className="num">{m.resultado}</span></div>
                <div className="text-muted num">{m.formula}</div>
                {m.fonte && <div className="text-caption text-subtle">{m.fonte}</div>}
              </li>
            ))}
          </ol>
        </details>
      )}

      <button type="button" onClick={() => setD({ bt: null, tipo: "serica" })} className="btn btn-discreto w-full">
        Limpar icterícia
      </button>
    </div>
  );
}

function Valor({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2">
      <div className="text-caption text-muted">{rotulo}</div>
      <div className="num text-heading">{valor}</div>
      <div className="text-caption text-subtle">mg/dL</div>
    </div>
  );
}

/** Curvas de fototerapia, escalonamento e exsanguíneo (AAP 2022) de 0 a 14 dias, com a BT marcada. */
function GraficoBili({ ig, risco, riscoExs, pontos }: { ig: number; risco: boolean; riscoExs: boolean; pontos: { h: number; bt: number; anterior: boolean }[] }) {
  const W = 320, H = 190, L = 28, B = 22, T = 8, R = 8;
  const x = (h: number) => L + (h / 336) * (W - L - R);
  const yMax = 30;
  const y = (v: number) => T + (1 - Math.min(v, yMax) / yMax) * (H - T - B);
  const linha = (f: (h: number) => number | null) => {
    let d = "";
    for (let h = 1; h <= 336; h += 3) { const v = f(h); if (v != null) d += `${d ? "L" : "M"}${x(h).toFixed(1)},${y(v).toFixed(1)}`; }
    return d;
  };
  const foto = linha((h) => limiarAap("foto", risco, ig, h));
  const exs = linha((h) => limiarAap("exs", riscoExs, ig, h));
  const esc = linha((h) => { const v = limiarAap("exs", riscoExs, ig, h); return v == null ? null : v - 2; });
  return (
    <figure className="space-y-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Gráfico dos limiares de bilirrubina por idade, com a BT do paciente">
        {[5, 10, 15, 20, 25, 30].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeWidth="0.6" />
            <text x={L - 4} y={y(v) + 3} textAnchor="end" fontSize="8" fill="var(--color-text-subtle)">{v}</text>
          </g>
        ))}
        {[0, 2, 4, 6, 8, 10, 12, 14].map((dia) => (
          <text key={dia} x={x(dia * 24)} y={H - 8} textAnchor="middle" fontSize="8" fill="var(--color-text-subtle)">{dia}d</text>
        ))}
        <path d={exs} fill="none" stroke="var(--color-danger)" strokeWidth="1.6" />
        <path d={esc} fill="none" stroke="var(--color-danger)" strokeWidth="1" strokeDasharray="3 3" />
        <path d={foto} fill="none" stroke="var(--color-warning)" strokeWidth="1.6" />
        {pontos.map((p) => (
          <circle key={`${p.h}-${p.anterior}`} cx={x(Math.min(p.h, 336))} cy={y(p.bt)} r={p.anterior ? 3 : 4.5} fill={p.anterior ? "var(--color-surface)" : "var(--color-primary)"} stroke="var(--color-primary)" strokeWidth="1.5" />
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-muted">
        <span><span className="inline-block w-3 h-0.5 align-middle bg-warning mr-1" />Fototerapia</span>
        <span><span className="inline-block w-3 h-0.5 align-middle bg-danger mr-1" />Exsanguíneo</span>
        <span><span className="inline-block w-3 align-middle border-t border-dashed border-danger mr-1" />Escalonamento</span>
        <span>● BT</span>
      </figcaption>
    </figure>
  );
}
