import { useState, type ReactNode } from "react";
import {
  AMPOLAS_K, AMPOLAS_MG, AMPOLAS_NA, CA_FAIXA_MMOL_KG, FASE_II_III, GLUCONATO_CA, HIPOGLICEMIA, K_FAIXA_MEQ_KG,
  MG_FAIXA_MEQ_KG, NA_FAIXA_MEQ_KG, TIG_FAIXAS, TIG_MAX, VOLUME_ESPGHAN, VOLUME_MS, VOLUME_MS_TERMO,
  CONC_GLICOSE_MAX_PERIFERICO_PCT, CONC_GLICOSE_MIN_PCT, type GrupoVolume,
} from "../core/constantes";
import { fmt } from "../core/numeros";
import { rotuloGrupo } from "../core/faixas";
import { Card } from "./campos";

const par = (a: readonly [number, number] | readonly number[]) => `${fmt(a[0])}–${fmt(a[1])}`;

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <section className="rounded-lg bg-surface border border-border shadow-card">
      <button type="button" onClick={() => setAberto(!aberto)} aria-expanded={aberto} className="tap w-full text-left px-4 text-eyebrow text-muted flex items-center justify-between">
        {titulo}
        <span aria-hidden>{aberto ? "–" : "+"}</span>
      </button>
      {aberto && <div className="px-4 pb-4 space-y-2 text-body-sm">{children}</div>}
    </section>
  );
}

function Tabela({ cab, linhas }: { cab: string[]; linhas: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body-sm num">
        <thead><tr>{cab.map((c) => <th key={c} className="text-left font-semibold pr-3 pb-1 text-muted">{c}</th>)}</tr></thead>
        <tbody>
          {linhas.map((l, i) => <tr key={i} className="border-t border-border">{l.map((c, j) => <td key={j} className="pr-3 py-1 whitespace-nowrap">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

const GRUPOS: GrupoVolume[] = ["termo", "pt_gt1500", "pt_1000_1500", "pt_lt1000"];

/** Tudo vem das constantes do motor: a referência nunca diverge do cálculo. */
export function Referencias() {
  return (
    <div className="space-y-3">
      <Card titulo="Referências (offline)">
        <p className="text-body-sm text-muted">Valores usados pelo cálculo, com a fonte. Em caso de dúvida vale a diretriz do serviço e o julgamento médico.</p>
      </Card>
      <Secao titulo="Volume — ESPGHAN/SBP (mL/kg/dia)">
        <Tabela cab={["Grupo", "D1", "D2", "D3", "D4", "D5", "D6+"]} linhas={GRUPOS.map((g) => [rotuloGrupo(g), ...VOLUME_ESPGHAN[g].map(par), par(FASE_II_III)])} />
        <p className="text-caption text-subtle">Fonte: ESPGHAN 2018 (Jochum, Clin Nutr 2018;37) = SBP 2023. PT usa o peso de nascimento. Fototerapia: limite inferior +10%, superior +20%. Asfixia/SDR/VM umidificada: inferior −20%, superior −10%.</p>
      </Secao>
      <Secao titulo="Volume — Ministério da Saúde 2014">
        <Tabela cab={["Peso nasc.", "D1", "D2", "D3–4", "D5–7"]} linhas={Object.entries(VOLUME_MS).map(([k, v]) => [{ le750: "≤ 750 g", "751_1000": "751–1000 g", "1001_1500": "1001–1500 g", "1501_2500": "1501–2500 g" }[k]!, par(v.d1), par(v.d2), par(v.d3_4), par(v.d5_7)])} />
        <p>Termo: D1 {par(VOLUME_MS_TERMO.d1)}; D7 {par(VOLUME_MS_TERMO.d7)}. D2–D6 não tabelados (TODO validar): o app pede ESPGHAN ou volume manual com justificativa.</p>
        <p className="text-caption text-subtle">Fonte: MS 2014 / Lorenz 2008.</p>
      </Secao>
      <Secao titulo="Glicose (TIG)">
        <Tabela cab={["Grupo", "D1", "D2+", "Sugerida"]} linhas={[["Pré-termo", par(TIG_FAIXAS.pretermo.d1), par(TIG_FAIXAS.pretermo.aPartirD2), fmt(TIG_FAIXAS.pretermo.padraoSugerido)], ["Termo", par(TIG_FAIXAS.termo.d1), par(TIG_FAIXAS.termo.aPartirD2), fmt(TIG_FAIXAS.termo.padraoSugerido)]]} />
        <p>mg/kg/min. Máximo {TIG_MAX}. Glicose (g/dia) = TIG × 1,44 × kg. Concentração final: mínima {fmt(CONC_GLICOSE_MIN_PCT)}% e máxima {fmt(CONC_GLICOSE_MAX_PERIFERICO_PCT)}% em acesso periférico.</p>
        <p className="text-caption text-subtle">Fonte: ESPGHAN 2018 R5.4; MS 2014 (concentração).</p>
      </Secao>
      <Secao titulo="Eletrólitos">
        <ul className="space-y-1">
          <li>Cálcio D1–10: {par(CA_FAIXA_MMOL_KG)} mmol/kg/dia. Gluconato de Ca 10%: 1 mL = {GLUCONATO_CA.mgSalPorMl} mg de sal = {fmt(GLUCONATO_CA.mgElementarPorMl)} mg elementar = {fmt(GLUCONATO_CA.mEqPorMl, 3)} mEq = {fmt(GLUCONATO_CA.mmolPorMl, 4)} mmol.</li>
          <li>Magnésio: D1–10 {par(MG_FAIXA_MEQ_KG.ate10)}; depois {par(MG_FAIXA_MEQ_KG.depois10)} mEq/kg/dia.</li>
          <li>Sódio (mEq/kg/dia): termo {par(NA_FAIXA_MEQ_KG.termo)}; pré-termo {par(NA_FAIXA_MEQ_KG.pt)}. Não no D1 sem justificativa.</li>
          <li>Potássio (mEq/kg/dia): termo {par(K_FAIXA_MEQ_KG.termo)}; pré-termo {par(K_FAIXA_MEQ_KG.pt)}. Não no D1; exige diurese.</li>
        </ul>
        <p className="text-caption text-subtle">Fonte: ESPGHAN/SBP; MS 2014.</p>
      </Secao>
      <Secao titulo="Ampolas">
        <ul className="space-y-1">
          {Object.values(AMPOLAS_MG).map((a) => <li key={a.rotulo}>{a.rotulo}: {fmt(a.mEqPorMl, 2)} mEq/mL</li>)}
          {Object.values(AMPOLAS_NA).map((a) => <li key={a.rotulo}>{a.rotulo}: {fmt(a.mEqPorMl, 2)} mEq/mL</li>)}
          {Object.values(AMPOLAS_K).map((a) => <li key={a.rotulo}>{a.rotulo}: {fmt(a.mEqPorMl, 2)} mEq/mL</li>)}
        </ul>
      </Secao>
      <Secao titulo="Hipoglicemia">
        <p>Bolus de SG 10% {HIPOGLICEMIA.bolusMlKg} mL/kg a {HIPOGLICEMIA.bolusVelocidadeMlMin} mL/min, sem cálcio no bolus. Manutenção com TIG {par(HIPOGLICEMIA.tigManutencao)} mg/kg/min. Desmame de {HIPOGLICEMIA.desmameMgKgMin} mg/kg/min, intervalo mínimo de {HIPOGLICEMIA.desmameIntervaloMinH} h.</p>
        <p className="text-caption text-subtle">Fonte: MS 2014.</p>
      </Secao>
      <Secao titulo="Fontes">
        <ul className="list-disc pl-5 space-y-1">
          <li>ESPGHAN/ESPEN/ESPR/CSPEN 2018. Guidelines on pediatric parenteral nutrition (Jochum; Mesotten; Mihatsch). Clin Nutr 2018;37.</li>
          <li>SBP 2023. Recomendações de nutrição parenteral em RN pré-termo.</li>
          <li>Brasil. Ministério da Saúde. Atenção à Saúde do Recém-Nascido, 2ª ed., 2014.</li>
          <li>NICE NG154 (2020) e NG29. Cochrane (Bell; Vemgal). Lorenz JM et al., 2008.</li>
        </ul>
      </Secao>
    </div>
  );
}
