import { useState, type ReactNode } from "react";
import {
  AMPOLAS_K, AMPOLAS_MG, AMPOLAS_NA, CA_FAIXA_MMOL_KG, FASE_II_III, GLUCONATO_CA, HIPOGLICEMIA, K_FAIXA_MEQ_KG,
  MG_FAIXA_MEQ_KG, NA_FAIXA_MEQ_KG, TIG_FAIXAS, TIG_MAX, VOLUME_ESPGHAN, VOLUME_MS, VOLUME_MS_TERMO,
  CONC_GLICOSE_MAX_PERIFERICO_PCT, CONC_GLICOSE_MIN_PCT, type GrupoVolume,
} from "../core/constantes";
import { fmt } from "../core/numeros";
import { rotuloGrupo } from "../core/faixas";
import { MAISELS_2012, limiarAap } from "../core/ictericia";
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
      <Secao titulo="Icterícia ≥ 35 sem — AAP 2022 (mg/dL)">
        <p>Limiares de fototerapia <strong>intensiva</strong> e de exsanguineotransfusão por hora de vida. Amostra a cada 24 h; o app usa a tabela hora a hora.</p>
        <Tabela
          cab={["Grupo", "24 h", "48 h", "72 h", "96 h", "7 d"]}
          linhas={[
            ...([40, 38, 37, 36, 35] as const).map((g) => [`Foto ${g === 40 ? "≥ 40" : g} sem`, ...[24, 48, 72, 96, 168].map((h) => fmt(limiarAap("foto", false, g, h) ?? 0, 1))]),
            ...([38, 37, 36, 35] as const).map((g) => [`Foto c/ risco ${g === 38 ? "≥ 38" : g}`, ...[24, 48, 72, 96, 168].map((h) => fmt(limiarAap("foto", true, g, h) ?? 0, 1))]),
            ...([38, 37, 36, 35] as const).map((g) => [`EST ${g === 38 ? "≥ 38" : g} sem`, ...[24, 48, 72, 96, 168].map((h) => fmt(limiarAap("exs", false, g, h) ?? 0, 1))]),
            ...([38, 37, 36, 35] as const).map((g) => [`EST c/ risco ${g === 38 ? "≥ 38" : g}`, ...[24, 48, 72, 96, 168].map((h) => fmt(limiarAap("exs", true, g, h) ?? 0, 1))]),
          ]}
        />
        <ul className="list-disc pl-5 space-y-1">
          <li>Fatores de risco de neurotoxicidade (além da IG): albumina &lt; 3,0 g/dL; doença hemolítica isoimune (Coombs +), deficiência de G6PD ou outra hemólise; sepse; instabilidade clínica significativa nas últimas 24 h.</li>
          <li>Escalonamento: BT ≥ exsanguíneo − 2 mg/dL → exames STAT, hidratação IV, fototerapia intensiva, BT a cada 2 h; IVIG 0,5–1 g/kg em 2 h se Coombs + (pode repetir em 12 h).</li>
          <li>EST urgente: BT ≥ limiar de exsanguíneo ou sinais de encefalopatia intermediária/avançada.</li>
          <li>TcB: colher BT sérica se TcB a menos de 3 mg/dL do limiar de fototerapia ou ≥ 15.</li>
          <li>Subida rápida (sugere hemólise): ≥ 0,3 mg/dL/h nas primeiras 24 h ou ≥ 0,2 depois.</li>
          <li>Suspensão (opção): BT 2 mg/dL abaixo do limiar da hora de início. Rebote: BT 6–12 h após suspender se começou antes de 48 h, Coombs + ou hemólise; senão, no dia seguinte.</li>
        </ul>
        <p className="text-caption text-subtle">Fonte: Kemper AR et al. Pediatrics 2022;150(3):e2022058859 e Supplemental Tables 1–4.</p>
      </Secao>
      <Secao titulo="Icterícia < 35 sem — SBP 2021 / Maisels 2012">
        <Tabela cab={["IG corrigida", "Fototerapia", "Exsanguíneo"]} linhas={MAISELS_2012.map((l) => [l.rotulo, par(l.foto), par(l.exs)])} />
        <ul className="list-disc pl-5 space-y-1">
          <li>Usar o valor inferior com: doença hemolítica, G6PD, albumina &lt; 2,5 g/dL, aumento rápido da BT, instabilidade (pH &lt; 7,15, VM, sepse/meningite, apneia/bradicardia com ventilação ou droga vasoativa nas últimas 24 h).</li>
          <li>EST: BT subindo apesar de fototerapia intensiva na maior superfície, sinais de encefalopatia ou BT 5 mg/dL acima do nível.</li>
          <li>≤ 1.000 g ou ≤ 26 sem: fototerapia profilática até 12 h com irradiância padrão (8–10 µW/cm²/nm); evitar alta intensidade.</li>
          <li>Suspensão: BT 2 mg/dL abaixo do nível de indicação.</li>
        </ul>
        <p className="text-caption text-subtle">Fonte: SBP, Manual de Orientação nº 10 (2021), Tabela 10, adaptada de Maisels et al. J Perinatol 2012;32:660-4.</p>
      </Secao>
      <Secao titulo="Fontes">
        <ul className="list-disc pl-5 space-y-1">
          <li>ESPGHAN/ESPEN/ESPR/CSPEN 2018. Guidelines on pediatric parenteral nutrition (Jochum; Mesotten; Mihatsch). Clin Nutr 2018;37.</li>
          <li>SBP 2023. Recomendações de nutrição parenteral em RN pré-termo.</li>
          <li>Brasil. Ministério da Saúde. Atenção à Saúde do Recém-Nascido, 2ª ed., 2014.</li>
          <li>NICE NG154 (2020) e NG29. Cochrane (Bell; Vemgal). Lorenz JM et al., 2008.</li>
          <li>Kemper AR et al. Clinical Practice Guideline Revision: Management of Hyperbilirubinemia in the Newborn Infant 35 or More Weeks of Gestation. Pediatrics 2022;150(3):e2022058859.</li>
          <li>SBP. Hiperbilirrubinemia indireta no período neonatal. Manual de Orientação nº 10, 2021.</li>
        </ul>
      </Secao>
    </div>
  );
}
