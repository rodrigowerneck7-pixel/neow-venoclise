import { useState, type ReactNode } from "react";
import {
  AMPOLAS_K, AMPOLAS_MG, AMPOLAS_NA, CA_FAIXA_MMOL_KG, FASE_II_III, GLUCONATO_CA, HIPOGLICEMIA, K_FAIXA_MEQ_KG,
  MG_FAIXA_MEQ_KG, NA_FAIXA_MEQ_KG, TIG_FAIXAS, TIG_MAX, VOLUME_ESPGHAN, VOLUME_MS, VOLUME_MS_TERMO,
  CONC_GLICOSE_MAX_PERIFERICO_PCT, CONC_GLICOSE_MIN_PCT, type GrupoVolume,
} from "../core/constantes";
import { fmt } from "../core/numeros";
import { rotuloGrupo } from "../core/faixas";
import { MAISELS_2012, limiarAap } from "../core/ictericia";
import { LIQUOR_THOMSON, NEUTROFILOS_SBP2022 } from "../core/internacao";
import { DURACOES, textoSpec } from "../core/antibiotico";
import { ANTIMICROBIANOS, FONTE_DOSES } from "../core/dados/antimicrobianos";
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
      <Secao titulo="Internação — Portaria 930/2012">
        <ul className="list-disc pl-5 space-y-1">
          <li><b>UTIN (art. 10):</b> I — VM, ou insuficiência respiratória aguda com FiO₂ &gt; 30%; II — IG &lt; 30 semanas ou PN &lt; 1.000 g; III — cirurgia de grande porte ou PO imediato de pequeno/médio porte; IV — nutrição parenteral; V — CVC, droga vasoativa, prostaglandina, antibiótico para infecção grave, VM e FiO₂ &gt; 30%, exsanguineotransfusão ou transfusão por hemólise aguda ou coagulopatia.</li>
          <li><b>UCINCo (art. 16):</b> I — após a UTIN, ainda com cuidados complementares; II — desconforto respiratório leve sem VM, CPAP ou capuz com FiO₂ &gt; 30%; III — 1.000–1.500 g, estável, sem acesso central, em enteral plena; IV — &gt; 1.500 g com venóclise, sonda e/ou antibiótico com quadro estável; V — fototerapia com BT perto da EST; VI — após EST, BT caindo e equilíbrio hemodinâmico; VII — cirurgia de médio porte, estável após PO imediato na UTIN.</li>
          <li><b>UCINCa (art. 21):</b> &gt; 1.250 g, clinicamente estável, enteral plena, mãe com desejo e disponibilidade.</li>
        </ul>
        <p className="text-caption text-subtle">Fonte: Portaria GM/MS nº 930/2012 (art. 10, V na redação da Portaria nº 3.389/2013).</p>
      </Secao>
      <Secao titulo="Neutrófilos no RN (/mm³) — SBP 2022">
        <Tabela
          cab={["Idade", "Neutropenia < 1,5 kg", "Neutropenia > 1,5 kg", "Neutrofilia < 1,5 kg", "Neutrofilia > 1,5 kg", "Imaturos", "I/T"]}
          linhas={NEUTROFILOS_SBP2022.map((l) => [
            l.h === 0 ? "Nascimento" : l.h === 120 ? "120 h a 28 dias" : `${l.h} h`,
            `< ${fmt(l.neutropenia[0])}`,
            `< ${fmt(l.neutropenia[1])}`,
            `> ${fmt(l.neutrofilia[0])}`,
            `> ${fmt(l.neutrofilia[1])}`,
            `> ${fmt(l.imaturos)}`,
            `> ${fmt(l.it, 2)}`,
          ])}
        />
        <ul className="list-disc pl-5 space-y-1">
          <li>Achados mais valorizados: leucócitos &lt; 5.000, I/T &gt; 0,3, neutrófilos &lt; 2.000.</li>
          <li>Escore de Rodwell (1 ponto cada): leucometria alterada, neutrófilos alterados, imaturos aumentados, I/T aumentada, I/M ≥ 0,3, plaquetas ≤ 150.000, alterações degenerativas. ≥ 3: sensibilidade 96%, especificidade 78%; ≤ 2: VPN 99%.</li>
          <li>PCR anormal: &gt; 1 mg/dL (10 mg/L). Sobe ~24 h após o início da infecção; pico em 2–3 dias.</li>
          <li>Hemocultura: 2 amostras de 1 mL, de sítios diferentes, antes do antibiótico. Crescimento após 48 h de incubação sugere contaminação.</li>
        </ul>
        <p className="text-caption text-subtle">Fonte: SBP, Sepse neonatal precoce, Documento Científico nº 11 (2022), Quadro 2 (Manroe 1979; Mouzinho 1994); Rodwell RL et al. J Pediatr 1988;112:761-7.</p>
      </Secao>
      <Secao titulo="Líquor — P5 e P95 (SBP 2022 / Thomson 2018)">
        <Tabela
          cab={["Idade", "Células/mm³ P95", "Proteína mg/dL P95", "Glicose mg/dL P5"]}
          linhas={["0–7 d", "8–14 d", "15–21 d", "22–28 d"].map((idade, i) => [idade, fmt(LIQUOR_THOMSON.celulas[i][8], 1), fmt(LIQUOR_THOMSON.proteina[i][8], 1), fmt(LIQUOR_THOMSON.glicose[i][0], 1)])}
        />
        <p className="text-caption text-subtle">Fonte: SBP 2022 (sepse), Quadro 1 — Thomson J et al. Pediatrics 2018;141(3):e20173405.</p>
      </Secao>
      <Secao titulo="Glicemia nas primeiras 24 h — SBP 2022 (AAP 2011)">
        <ul className="list-disc pl-5 space-y-1">
          <li>Para pretermo tardio (34–36 6/7), PIG, filho de mãe diabética e GIG.</li>
          <li>Sintomático e glicemia &lt; 40 mg/dL: glicose EV.</li>
          <li>Assintomático, primeiras 4 h: dieta na 1ª hora e glicemia 30 min depois. &lt; 25: repetir dieta e glicemia em 1 h; de novo &lt; 25: glicose EV; 25–40: realimentar ou glicose EV se necessário.</li>
          <li>Assintomático, 4 a 24 h: dieta a cada 2–3 h e glicemia antes de cada dieta. &lt; 35: repetir dieta e glicemia em 1 h; de novo &lt; 35: glicose EV; 35–45: realimentar ou glicose EV se necessário.</li>
          <li>Glicemia esperada ≥ 45 mg/dL antes das dietas. Capilar fica ~10–15% abaixo da plasmática.</li>
        </ul>
        <p className="text-caption text-subtle">Fonte: SBP, Hipoglicemia neonatal, Documento Científico nº 16 (2022), Quadro 2. Critério do app para hipoglicemia: &lt; 45 mg/dL (MS 2014).</p>
      </Secao>
      <Secao titulo="Sepse precoce — SBP 2022">
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Fatores de risco:</b> trabalho de parto &lt; 37 sem; bolsa rota ≥ 18 h; EGB+ sem profilaxia indicada; corioamnionite; febre materna nas 48 h antes do parto; cerclagem/pessário; medicina fetal &lt; 72 h; ITU materna sem tratamento ou &lt; 72 h.</li>
          <li><b>≥ 35 sem, por categoria de risco:</b> sinais clínicos → hemoculturas + antibiótico. Sem sinais: temperatura materna intraparto ≥ 38 °C → hemoculturas + antibiótico; API para EGB não indicada ou adequada → rotina; indicada e inadequada → observação 36–48 h.</li>
          <li><b>≥ 35 sem, avaliação clínica seriada (recomendada para o assintomático):</b> sinais → hemoculturas + antibiótico; temperatura ≥ 38 °C ou API inadequada → observação 36–48 h (culturas e antibiótico se surgirem sinais); senão rotina.</li>
          <li><b>≤ 34 sem:</b> trabalho de parto prematuro, rotura prematura de membranas ou infecção intra-amniótica → hemoculturas + antibiótico. Parto induzido com API inadequada, suspeita de infecção intra-amniótica ou instabilidade → hemoculturas + antibiótico; sem esses achados ou cesárea eletiva com bolsa íntegra → sem antibiótico de rotina.</li>
          <li><b>Empírico:</b> ampicilina ou penicilina cristalina + gentamicina ou amicacina. Meningite por Gram-negativo: cefotaxima ou cefepima.</li>
          <li><b>36–48 h:</b> culturas negativas, RN bem e triagem negativa → suspender. Culturas negativas com quadro sugestivo e triagem alterada → sepse clínica, completar. Culturas positivas → completar e adequar.</li>
        </ul>
        <Tabela cab={["Sítio / agente", "Duração", "Fonte"]} linhas={DURACOES.map((x) => [x.texto, x.dias[0] === x.dias[1] ? `${x.dias[0]} dias` : `${x.dias[0]}–${x.dias[1]} dias`, x.fonte.startsWith("SBP") ? x.fonte : "PDF de doses"])} />
        <p className="text-caption text-subtle">Fonte: SBP, Sepse neonatal precoce, Documento Científico nº 11 (2022), Figuras 1–3, Quadro 4 e recomendações (Puopolo/AAP 2018).</p>
      </Secao>
      <Secao titulo="Antimicrobianos — doses (PDF do serviço)">
        <div className="space-y-2">
          {ANTIMICROBIANOS.map((dr) => (
            <details key={dr.id} className="rounded-md border border-border px-3 py-2">
              <summary className="tap cursor-pointer text-body-sm font-semibold flex items-center">{dr.nome}<span className="text-caption text-subtle ml-2">p. {dr.pagina}</span></summary>
              <div className="mt-2 space-y-3">
                {dr.alerta && <p className="text-body-sm text-danger">{dr.alerta}</p>}
                {dr.tabelas.map((t) => (
                  <div key={t.id} className="space-y-1">
                    <div className="text-body-sm font-semibold">{t.titulo}{t.ataque ? ` — ataque ${Array.isArray(t.ataque.porKg) ? (t.ataque.porKg as number[]).map((v) => fmt(v)).join("–") : fmt(t.ataque.porKg as number)} ${dr.unidade}/kg ${t.ataque.texto}` : ""}</div>
                    <Tabela cab={["Situação", "Dose"]} linhas={t.linhas.map((l) => [l.rotulo, textoSpec(l.dose, dr.unidade)])} />
                    {t.nota && <p className="text-caption text-subtle">{t.nota}</p>}
                  </div>
                ))}
                {dr.notas?.map((n) => <p key={n} className="text-caption text-subtle">{n}</p>)}
                {dr.renal && <p className="text-caption text-subtle">{dr.renal}</p>}
              </div>
            </details>
          ))}
        </div>
        <p className="text-caption text-subtle">Fonte: {FONTE_DOSES}. IG = ao nascer; PMA = IG + dias de vida; PNA = dias de vida.</p>
      </Secao>
      <Secao titulo="Dieta enteral — ESPGHAN 2022 (PN < 1.800 g)">
        <ul className="list-disc pl-5 space-y-1">
          <li>Leite materno da própria mãe é a 1ª escolha (pré-termo e termo). Sem leite materno suficiente, em &lt; 32 sem ou &lt; 1.500 g: leite humano de banco com aditivo antes da fórmula para pré-termo.</li>
          <li>Começar pequenos volumes o quanto antes e aumentar conforme a tolerância. Dieta mínima (12–24 mL/kg/dia, sem aumentar, por 3–7 dias) não mostrou benefício claro.</li>
          <li>Aumento diário de 18–30 mL/kg/dia no prematuro estável.</li>
          <li>Volume da maioria: 150–180 mL/kg/dia; 135 pode ser seguro; até 200 caso a caso.</li>
          <li>Aditivo multicomponente quando a dieta chega a 40–100 mL/kg/dia.</li>
          <li>Bolus a cada 2–3 h; sonda oro ou nasogástrica sem preferência; não medir resíduo gástrico de rotina no RN estável.</li>
          <li>Via oral a partir de 32 sem de IG pós-menstrual, guiada pela competência e estabilidade.</li>
          <li>Cada UTIN deve ter protocolo próprio de progressão, aditivo e intolerância.</li>
        </ul>
        <p className="text-caption text-subtle">Fonte: Embleton ND et al. Enteral Nutrition in Preterm Infants (2022): ESPGHAN CoN position paper. JPGN 2023;76:248-268. Livre demanda: MS, Guia Alimentar para Crianças Brasileiras Menores de 2 Anos (versão resumida, 2021), p. 7.</p>
      </Secao>
      <Secao titulo="Fontes">
        <ul className="list-disc pl-5 space-y-1">
          <li>ESPGHAN/ESPEN/ESPR/CSPEN 2018. Guidelines on pediatric parenteral nutrition (Jochum; Mesotten; Mihatsch). Clin Nutr 2018;37.</li>
          <li>SBP 2023. Recomendações de nutrição parenteral em RN pré-termo.</li>
          <li>Brasil. Ministério da Saúde. Atenção à Saúde do Recém-Nascido, 2ª ed., 2014.</li>
          <li>NICE NG154 (2020) e NG29. Cochrane (Bell; Vemgal). Lorenz JM et al., 2008.</li>
          <li>Kemper AR et al. Clinical Practice Guideline Revision: Management of Hyperbilirubinemia in the Newborn Infant 35 or More Weeks of Gestation. Pediatrics 2022;150(3):e2022058859.</li>
          <li>SBP. Hiperbilirrubinemia indireta no período neonatal. Manual de Orientação nº 10, 2021.</li>
          <li>Brasil. Ministério da Saúde. Portaria GM/MS nº 930, de 10/05/2012 (redação da Portaria nº 3.389/2013).</li>
          <li>SBP. Sepse neonatal precoce e a abordagem do recém-nascido de risco. Documento Científico nº 11, 2022.</li>
          <li>SBP. Hipoglicemia neonatal. Documento Científico nº 16, 2022.</li>
          <li>Embleton ND et al. Enteral Nutrition in Preterm Infants (2022): A Position Paper From the ESPGHAN Committee on Nutrition. J Pediatr Gastroenterol Nutr 2023;76:248-268.</li>
          <li>Brasil. Ministério da Saúde. Guia Alimentar para Crianças Brasileiras Menores de 2 Anos — versão resumida, 2021.</li>
          <li>Doses dos antimicrobianos na neonatologia (PDF do serviço, atualizado pelo UpToDate 2025).</li>
          <li>Puopolo KM et al. Management of neonates born at ≥ 35 0/7 weeks / ≤ 34 6/7 weeks with suspected or proven early-onset bacterial sepsis. Pediatrics 2018 (citado pela SBP 2022).</li>
          <li>Rodwell RL, Leslie AL, Tudehope DI. Early diagnosis of neonatal sepsis using a hematologic scoring system. J Pediatr 1988;112:761-7.</li>
        </ul>
      </Secao>
    </div>
  );
}
