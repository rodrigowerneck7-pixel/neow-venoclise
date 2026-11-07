import { useState } from "react";
import { IcCheck, IcCopiar } from "./icones";
import { fmt } from "../core/numeros";
import { calcularHipoglicemia } from "../core/hipoglicemia";
import { HIPOGLICEMIA } from "../core/constantes";
import { Card, Deslizante, NumInput } from "./campos";

export function Hipoglicemia({ pesoInicialG }: { pesoInicialG: number | null }) {
  const [pesoG, setPesoG] = useState<number | null>(pesoInicialG);
  const [kg, setKg] = useState(false);
  const [tig, setTig] = useState<number | null>(null);
  const [copiado, setCopiado] = useState(false);
  const r = calcularHipoglicemia({ pesoG, confirmouKg: kg, tig });
  const [tMin, tMax] = HIPOGLICEMIA.tigManutencao;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border borda-perigo bg-danger-soft px-3 py-2 text-body-sm">
        <strong>Hipoglicemia (glicemia &lt; 45 mg/dL ou sintomas).</strong> Tratar primeiro; confirmar a glicemia sem atrasar o bolus se houver sintomas. Fonte: MS 2014.
      </div>
      <Card titulo="Paciente">
        <NumInput rotulo="Peso atual" unidade="g" valor={pesoG} onChange={(v) => { setPesoG(v); setKg(false); }} />
        {r.perguntaKg && (
          <div role="alert" className="aviso aviso-perigo">
            Peso menor que 15: é em kg?{" "}
            <button type="button" onClick={() => setKg(true)} className="btn btn-tonal px-3">Sim, é kg</button>
          </div>
        )}
        {r.invalido && <p role="alert" className="aviso aviso-perigo">Peso inválido.</p>}
        {r.pendencias.map((p) => <p key={p} className="text-body font-semibold text-muted">⚠ {p}</p>)}
      </Card>

      {r.bolus && (
        <Card titulo="Bolus">
          <div className="num text-display">SG 10% {fmt(r.bolus.ml, 1)} mL</div>
          <p className="text-body-sm text-muted">
            {HIPOGLICEMIA.bolusMlKg} mL/kg, IV a {r.bolus.velocidadeMlMin} mL/min (≈ {r.bolus.minutos} min) = {fmt(r.bolus.glicoseMg, 0)} mg de glicose. <strong>Sem cálcio no bolus.</strong>
          </p>
        </Card>
      )}

      {r.bolus && (
        <Card titulo="Manutenção">
          <NumInput rotulo="TIG" unidade="mg/kg/min" valor={tig} onChange={setTig} ajuda={`Faixa do MS 2014: ${tMin}–${tMax} mg/kg/min`} />
          <Deslizante rotulo="TIG dentro da faixa" min={tMin} max={tMax} passo={0.5} valor={tig} onChange={setTig} />
          {r.pendencias.map((p) => <p key={p} role="alert" className="aviso aviso-perigo">{p}</p>)}
          {r.foraDaFaixa && r.manutencao && <p className="text-body-sm text-warning">TIG fora da faixa de {tMin}–{tMax}: decisão médica.</p>}
          {r.manutencao && (
            <>
              <div className="num text-display">{fmt(r.manutencao.vazaoMlH, 1)} mL/h</div>
              <p className="text-body-sm text-muted">SG 10% puro ({fmt(r.manutencao.mlDia, 1)} mL/dia). Mesma conta da venóclise: TIG × 1,44 × kg.</p>
              {r.desmame && (
                <p className="text-body-sm text-muted">
                  Desmame: reduzir {r.desmame.reduzMgKgMin} mg/kg/min por vez, intervalo mínimo de {r.desmame.intervaloMinH} h, conforme a glicemia
                  {r.desmame.tigDepois != null && <> (próximo passo: TIG {fmt(r.desmame.tigDepois)} = {fmt(r.desmame.vazaoDepoisMlH ?? 0, 1)} mL/h)</>}.
                </p>
              )}
            </>
          )}
          {!r.manutencao && !r.pendencias.length && <p className="text-body-sm text-subtle">Escolha a TIG para ver a vazão. O app não escolhe por você.</p>}
        </Card>
      )}

      {r.texto && (
        <Card titulo="Texto para copiar">
          <pre className="whitespace-pre-wrap text-body-sm bg-surface-2 rounded-sm border border-border p-2 select-all">{r.texto}</pre>
          <button
            type="button"
            className="btn btn-primary px-4"
            onClick={async () => { try { await navigator.clipboard.writeText(r.texto!); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* texto selecionável */ } }}
          >
            {copiado ? <><IcCheck />Copiado</> : <><IcCopiar />Copiar texto</>}
          </button>
        </Card>
      )}
    </div>
  );
}
