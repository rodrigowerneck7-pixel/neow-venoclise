import { useState } from "react";
import { IcCheck, IcCopiar } from "./icones";
import { fmt } from "../core/numeros";
import type { ResultadoVenoclise } from "../core/tipos";
import { Card } from "./campos";

function Linha({ nome, valor, sub }: { nome: string; valor: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-border last:border-0">
      <div className="text-body-sm">
        {nome}
        {sub && <div className="text-caption text-subtle">{sub}</div>}
      </div>
      <div className="num font-semibold text-right">{valor}</div>
    </div>
  );
}

export function Resultado({ r }: { r: ResultadoVenoclise }) {
  const [copiado, setCopiado] = useState(false);
  const c = r.calculo;

  if (r.pendencias.length) {
    return (
      <Card titulo="Resultado">
        <ul className="space-y-2">
          {r.pendencias.map((p) => (
            <li key={p} className="aviso">
              {p}
            </li>
          ))}
        </ul>
        <p className="text-body-sm text-subtle">Nenhum valor é calculado enquanto faltar dado obrigatório.</p>
      </Card>
    );
  }
  if (!c) {
    return (
      <Card titulo="Resultado">
        <p className="aviso aviso-perigo">Cálculo bloqueado. Veja os alertas acima.</p>
      </Card>
    );
  }

  const k = c.receitaEtapa;
  const linhas: Array<[string, number]> = [
    ["SG 5%", k.sg5],
    ["SG 10%", k.sg10],
    ["SG 50%", k.sg50],
    ["Água destilada", k.ad],
    ["Gluconato de cálcio 10%", k.gluconatoCa],
    ["Sulfato de magnésio", k.mgso4],
    ["NaCl", k.nacl],
    ["KCl", k.kcl],
  ];

  const copiar = async () => {
    if (!r.prescricaoTexto) return;
    try {
      await navigator.clipboard.writeText(r.prescricaoTexto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sem permissão de área de transferência: o texto continua selecionável na tela */
    }
  };

  return (
    <>
      <Card titulo={`Venóclise · peso de cálculo ${fmt(c.pesoCalculoG, 0)} g (${c.pesoUsado === "nascimento" ? "nascimento" : "atual"})`}>
        {!r.liberado && (
          <p className="aviso aviso-perigo">Resultado NÃO liberado: resolva os bloqueios acima. Valores só para conferência.</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg appbar-bg text-on-appbar p-3.5">
            <div className="text-caption text-on-appbar-muted">Vazão</div>
            <div className="num text-display mt-0.5">{fmt(c.vazaoMlH, 1)} <span className="text-body-sm font-medium text-on-appbar-muted">mL/h</span></div>
            <div className="text-caption text-on-appbar-muted">{c.etapas === 1 ? "etapa única 24 h" : `${c.etapas} etapas de ${c.horasPorEtapa} h`}</div>
          </div>
          <div className="rounded-lg appbar-bg text-on-appbar p-3.5">
            <div className="text-caption text-on-appbar-muted">Glicose final</div>
            <div className="num text-display mt-0.5">{fmt(c.concFinalRealPct, 2)}<span className="text-body-sm font-medium text-on-appbar-muted">%</span></div>
            <div className="text-caption text-on-appbar-muted">TIG {fmt(c.tig)} mg/kg/min · {fmt(c.glicoseGDia, 2)} g/dia</div>
          </div>
        </div>
        <div>
          <Linha nome="Volume total" valor={`${fmt(c.volumeTotalMlDia, 1)} mL/dia`} sub={`${fmt(c.volumeTotalMlKgDia)} mL/kg/dia`} />
          <Linha nome="Volume da venóclise" valor={`${fmt(c.volumeVenoclise, 1)} mL/dia`} sub={c.volumeEnteralMlDia || c.outrasInfusoesMlDia ? `− enteral ${fmt(c.volumeEnteralMlDia, 1)} − outras ${fmt(c.outrasInfusoesMlDia, 1)}` : undefined} />
        </div>
      </Card>

      <Card titulo={c.etapas === 1 ? "Composição (24 h)" : `Composição de CADA etapa (${c.horasPorEtapa} h)`}>
        <div>
          {linhas.filter(([, v]) => v > 0).map(([n, v]) => (
            <Linha key={n} nome={n} valor={`${fmt(v, 2)} mL`} />
          ))}
        </div>
        <div className="rounded-md bg-surface-2 p-3 text-body-sm space-y-1">
          <div className="font-semibold">Aditivos (dia todo)</div>
          <div>Cálcio: {fmt(c.calcio.mlKg)} mL/kg · {fmt(c.calcio.mgSalKg, 1)} mg/kg de sal · {fmt(c.calcio.mgElementarKg, 1)} mg/kg elementar · {fmt(c.calcio.mmolKg, 3)} mmol/kg</div>
          <div>Magnésio: {fmt(c.magnesio.mEqKg)} mEq/kg · {fmt(c.magnesio.mmolKg, 3)} mmol/kg · {fmt(c.magnesio.mgKg, 1)} mg/kg</div>
          <div>Sódio: {fmt(c.sodio.mEqKg)} mEq/kg ({fmt(c.sodio.mEqDia, 2)} mEq · {fmt(c.sodio.mgKg, 1)} mg/kg)</div>
          <div>Potássio: {fmt(c.potassio.mEqKg)} mEq/kg ({fmt(c.potassio.mEqDia, 2)} mEq · {fmt(c.potassio.mgKg, 1)} mg/kg)</div>
        </div>
      </Card>

      {r.liberado && r.prescricaoTexto && (
        <Card titulo="Prescrição" extra={<button type="button" onClick={copiar} className="btn btn-tonal px-3 text-body-sm">{copiado ? <><IcCheck />Copiado</> : <><IcCopiar />Copiar</>}</button>}>
          <p className="num rounded-md bg-surface-2 p-3 whitespace-pre-line select-all text-body-sm">{r.prescricaoTexto}</p>
        </Card>
      )}

      <details className="card">
        <summary className="tap cursor-pointer text-[15px] font-semibold flex items-center">Memória de cálculo</summary>
        <ol className="mt-3 space-y-3">
          {r.memoria.map((p, i) => (
            <li key={i} className="text-body-sm">
              <div className="font-semibold">{p.titulo}</div>
              <div className="num text-muted">{p.formula}</div>
              <div className="num">= {p.resultado}</div>
              {p.fonte && <div className="text-caption text-subtle">Fonte: {p.fonte}</div>}
            </li>
          ))}
        </ol>
      </details>
    </>
  );
}
