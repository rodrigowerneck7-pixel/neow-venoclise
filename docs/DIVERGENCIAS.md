# Divergências entre fontes e decisões pendentes

Regra do projeto: o app **não decide sozinho** uma regra clínica nova. Cada item abaixo está aberto até o Rodrigo decidir.
Estados: 🟡 aberto · 🟢 decidido.

## a) MS × ESPGHAN no volume do D1 do < 1.000 g — 🟡
- MS 2014 / Lorenz: ≤ 750 g e 751–1.000 g → **90–120** mL/kg/dia.
- ESPGHAN 2018 = SBP 2023: < 1.000 g → **80–100** mL/kg/dia.
- O app usa ESPGHAN/SBP por padrão; MS é alternativa nas Configurações. As faixas se sobrepõem em 90–100.

## b) Na/K no D1 — 🟡
- MS 2014: **não** adicionar Na nem K no D1. O app trava (Na com override e justificativa; K sem override).
- ESPGHAN/SBP: Na 0–2(3) mEq/kg no D1; Na/K desde o D1 em NP precoce com aminoácidos.
- Caso de NP precoce está **fora do escopo** do app (NP: protocolo da NP / farmácia).

## c) Significado de "Ca 100 / Ca 200" no serviço — 🟡 `TODO(validar)`
- O app oferece os presets só com rótulo explícito: **Ca 100 = 100 mg/kg/dia de SAL (1 mL/kg)** e **Ca 200 = 200 mg/kg/dia de SAL (2 mL/kg)**.
- Ambos ficam < 0,8 mmol/kg/dia (0,23 e 0,47) e geram alerta laranja. **Confirmar com o Rodrigo** o que significam no serviço.

## d) Inconsistência interna do MS (Ca) — 🟡
- MS: "4 mL/kg = 20–30 mg/kg" de Ca elementar. A conta real: 4 mL × 9,3 mg = **37,2 mg/kg** (0,93 mmol/kg).
- O app usa a conta real (9,3 mg de Ca elementar por mL) e mostra mL/kg, mg/kg de sal, mg/kg elementar e mmol/kg.

## e) Frequência de eletrólitos — 🟡
- SBP 2023 (Tabela 8): semanal. MS/ESPGHAN: diário na 1ª semana. O app segue o diário.

## f) Tonicidade no RN termo — 🟡 não resolvida
- NICE NG29 (isotônico) × Neofluid 2024 × ECR indiano (mais hipernatremia). O app não toma partido; segue a tabela da fonte escolhida.

## g) Cloro: "Na + K − Cl" (ESPGHAN R6.5) — 🟡 NÃO implementado
- O prompt pede alerta se Na + K − Cl > 2 ou < 1 mmol/kg/dia. Como o único cloro que o app soma vem do NaCl e do KCl, **Na + K − Cl é sempre 0** e o alerta dispararia sempre.
- O app mostra o cloro (= Na + K) na memória de cálculo, sem alerta. **Decidir** de onde virá o outro termo (cloro de NP? de outras soluções?).

## h) Ajuste da faixa de volume — 🟡 interpretação minha
O prompt diz "+10 a 20%" (fototerapia) e "−10 a 20%" (asfixia/SDR/VM). Implementei como **deslocamento da faixa**:
- Fototerapia: limite inferior ×1,10 e limite superior ×1,20.
- Asfixia/SDR/VM: limite inferior ×0,80 e limite superior ×0,90.
- Se os dois estiverem marcados, aplicam-se em sequência. **Confirmar** se prefere um único percentual escolhido por você (10–20%).

## i) Termo com mais de 37 semanas pela tabela do MS — 🟡 lacunas `TODO(validar)`
- MS dá o termo só no D1 (60–80) e no D7 (80–120). **D2–D6 e após D7 não existem** na fonte: o app bloqueia e pede volume manual com justificativa, ou troca para ESPGHAN.
- Pré-termo no MS após o D7: o MS não define; o app usa 140–160 (fase II/III do ESPGHAN) **com aviso** na faixa.

## j) Pré-termo tardio com mais de 2.500 g — 🟡
- Pela regra "PT usa peso de nascimento", um PT de 35 sem com 2.700 g cai em "PT > 1.500 g" no ESPGHAN (faixa de PT). No MS, a tabela só vai até 2.500 g: o app bloqueia (`TODO(validar)`).

## k) Termo no D6 em diante — 🟡
- O prompt manda usar 140–160 (fase II/III) do D6 em diante para todos os grupos, inclusive termo (a tabela do termo termina no D5, 100–140). Implementado como pedido; vale conferir se faz sentido para o termo.

## l) Arredondamento da receita — 🟢 (regra do prompt)
- mL a 0,1; **0,01 se o volume for < 10 mL**. Por isso o exemplo do prompt ("SG 50% 4,8 mL") sai como **4,78 mL**, e "Gluconato 12 mL", "MgSO₄ 1,11 mL". A concentração final exibida é recalculada com os valores arredondados.

## m) Mãe com MgSO₄: pergunta só até o D7 — 🟡
- O efeito do Mg materno dura 3–7 dias (ESPGHAN R8.5). O app exige a resposta até o D7; do D8 em diante assume "não" (sem pergunta). Confirmar.

## n) "Extremo" na perda de peso — 🟡
- Alerta "< 2% no extremo após o D3" usa **IG < 28 semanas ou PN < 1.000 g**.
