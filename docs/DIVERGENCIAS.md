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

---

# Icterícia (módulo 1, 07/11/2026)

## o) ≥ 35 semanas: AAP 2022 × SBP 2021 — 🟢 decidido pelo Rodrigo (AAP 2022)
- O manual da SBP enviado (nº 10, 2021, Tabela 9) ainda usa os limiares da **AAP 2004**, mais baixos (ex.: termo às 48 h: fototerapia 13 na SBP × 16,0–17,0 na AAP 2022).
- O app segue a **AAP 2022** (Suppl. Tables 1–4, hora a hora), como decidido. A suspensão também segue a AAP (KAS 15: 2 mg/dL abaixo do limiar da hora de início), e não os valores fixos da SBP (≤ 11,5 / ≤ 9,5 / ≤ 14).

## p) < 35 semanas: SBP 2021 Tabela 10 (Maisels 2012) — 🟡 confirmar
- Faixas por IG corrigida; sem condição agravante o app mostra a **faixa** e a decisão dentro dela é do médico; com agravante usa o valor inferior (como diz a nota da tabela).
- Nascido < 35 sem que já passou de 34 6/7 corrigida: a tabela acaba; o app **não calcula** (TODO(validar) qual referência usar).

## q) "Simples / dupla / quádrupla" — 🟡 regra do serviço pendente
- A AAP 2022 não define número de aparelhos; os limiares são para fototerapia **intensiva**. A SBP diz: perto da EST, alta irradiância na maior superfície (frente e costas).
- O app **não escolhe** o número de aparelhos: o médico marca simples/dupla/quádrupla e a intensidade, e isso vai para o texto da prescrição. Se o serviço tiver regra (ex.: dupla a partir de X mg/dL do limiar), dá para incluir.

## r) Depois de 14 dias e primeira hora — 🟢 bloqueio
- A tabela da AAP vai da hora 1 à hora 359. Fora disso o app não calcula (pendência), e acima de 14 dias lembra colestase (BD > 1 mg/dL).

## s) Seguimento abaixo do limiar (Fig. 7 da AAP 2022) — 🟡 não incorporado
- A AAP define quando repetir a BT pela diferença até o limiar (figura de seguimento pós-alta). Não foi incorporado nesta fase: abaixo do limiar o app mostra só a distância e, a menos de 2 mg/dL, sugere reavaliar.

---

# Internação (módulo 2, 07/11/2026)

## t) Portaria 930/2012 — leituras do texto — 🟡 confirmar
- O app só **lista** os critérios dos arts. 10 (UTIN), 16 (UCINCo) e 21 (UCINCa) que o médico marcou; não decide onde internar.
- Art. 10, I: FiO₂ > 30% conta com qualquer suporte (O₂, CPAP, VNI, VM).
- Art. 10, II: usa a **IG ao nascer** e o **peso de nascimento**. Arts. 16 e 21: usam o **peso atual** (sem ele, o de nascimento, com aviso).
- **CPAP ou VNI com FiO₂ ≤ 30%**: a Portaria não enquadra (não é o art. 10, I, e o art. 16, II exclui CPAP). O app avisa e deixa para o serviço.
- Art. 21 (Canguru): só aparece com todos os requisitos juntos (> 1.250 g, estável, enteral plena, mãe quer e pode).

## u) Líquor (SBP 2022, Quadro 1 = Thomson 2018) — 🟡
- A tabela traz idades "7, 14, 21, 28". O app lê como 0–7, 8–14, 15–21 e 22–28 dias completos. Depois de 28 dias: só registra.
- O app **descreve o percentil** (ex.: "acima do P95"); não diz se é meningite.

## v) Hemograma (SBP 2022, Quadro 2 = Manroe/Mouzinho) e escore de Rodwell — 🟡
- A tabela tem pontos (nascimento, 12, 24, 36, 48, 60, 72, 120 h, 4º–28º dia). **Entre dois pontos**, o app compara com os dois: se só um acusa, mostra "limítrofe" e o escore vira faixa (ex.: 3–4).
- Peso de nascimento de **exatamente 1.500 g**: a tabela separa < 1,5 e > 1,5 kg; o app usa as duas colunas.
- Imaturos = bastões + metamielócitos + mielócitos + promielócitos. Campos vazios desses três últimos contam como 0 (dito na tela).
- Rodwell (do resumo do artigo, PubMed 3361389): 7 itens de 1 ponto. "Leucometria alterada" conta sozinha só com **< 5.000** (corte da SBP); outros casos o médico marca. Neutrófilos, imaturos e I/T usam a tabela da SBP. A regra do artigo original para ausência de neutrófilos maduros não foi incorporada (só o resumo foi consultado).

## w) Glicemia — 🟡
- O critério do app continua **< 45 mg/dL (MS 2014)**, o mesmo da venóclise.
- O Quadro 2 da SBP 2022 (adaptado da AAP 2011) aparece nas **primeiras 24 h** para pretermo tardio, PIG, FMD e GIG (e para sintomático). Os valores da PES (50/60/70) e o 47 da AAP citados no texto da SBP não são usados.
- A SBP 2022 cita manutenção com TIG 5–8 mg/kg/min; a tela de hipoglicemia segue o MS 2014 (6–8).

## x) Classificação automática e PIG/GIG — 🟡
- Prematuridade e peso pela CID-10 P07 (< 37 e < 28 semanas; < 2.500, < 1.500 e < 1.000 g); pretermo tardio 34–36 6/7 pela SBP 2022.
- PIG e GIG o médico marca: a curva de crescimento enviada (gráfico masculino) ainda não foi incorporada.
- Gasometria, Hb/Ht e Apgar/pH de cordão: **só registro** (sem faixa cadastrada com fonte).

---

# Antibiótico (módulo 3, 07/11/2026)

## y) Tabelas de dose (PDF do serviço, UpToDate 2025) — 🟡 confirmar
- As tabelas são imagens no PDF: foram transcritas à mão e conferidas por teste, linha a linha.
- **Idades:** PNA = dias de vida completos (D1 = 0 dias). IG ao nascer e PMA em semanas completas; PMA = IG + dias de vida.
- **Peso da dose:** peso atual; sem ele, o de nascimento (com aviso).
- **Faixas do PDF** (ex.: cefepima 30–50 mg/kg, amicacina 17,5–18 mg/kg, metronidazol a cada 6–8 h): o médico escolhe. Sem a escolha, não sai texto de prescrição.
- **Creatinina entre linhas** (ex.: 0,75 ou 0,95 na vancomicina): o app não arredonda; mostra "fora das linhas".
- **Duas tabelas para o mesmo caso** (pela IG × pelo peso): o médico escolhe. Se a outra der dose diferente, o app mostra.
- **Doses que o PDF dá para bebês e crianças, sem linha de RN:** metronidazol e anfotericina lipossomal.
- **O que não está no PDF:** dose de meningite da penicilina cristalina e do meropenem, e a cefotaxima inteira.
- **Volume:** o app só calcula mg ou UI. O volume depende da diluição do serviço, que não está cadastrada.

## z) Iniciar ou não — fluxogramas da SBP 2022 — 🟡
- **≥ 35 semanas:** o app mostra as abordagens A (categoria de risco) e C (avaliação clínica seriada). A SBP recomenda a C para o RN assintomático (recomendação 2). A calculadora de sepse (B) não foi incorporada.
- **Só desconforto respiratório leve a moderado logo após nascer:** o app usa a recomendação 3 (monitorar; culturas e antibiótico se piorar ou passar de 6 h). A Figura 2 sozinha mandaria colher culturas e iniciar antibiótico diante de qualquer sinal.
- **≤ 34 semanas:** a figura diz "cesárea... com bolsa rota no momento do nascimento". O app lê como bolsa íntegra até o parto, que é como diz a recomendação 5.
- **Combinações que não estão no fluxograma:** decisão médica.
- **Janela:** até 72 h de vida (AAP); a ANVISA usa 48 h. Depois de 72 h o app não sugere conduta.

## aa) Duração — 🟡
- O Quadro 4 da SBP dá 7–10 dias para corrente sanguínea com agente isolado. O PDF de doses dá 10 dias para EGB e para Enterobacterales. Os dois aparecem e o médico escolhe.
- O D1 do antibiótico são as primeiras 24 h desde a 1ª dose. Fim previsto = início + número de dias.

## ab) Escalonamento — 🔴 pendente
- Não há fonte para as linhas de escalonamento (falha clínica sem cultura, sepse tardia).
- O app mostra só o que a SBP diz: adequar pela cultura e pelo antibiograma; meningite por Gram-negativo → cefotaxima ou cefepima. O resto depende do protocolo do hospital/CCIH.

---

# Dieta (módulo 4, 07/11/2026)

## ac) Progressão da dieta — ESPGHAN 2022 — 🟡 confirmar com o protocolo do serviço
- A ESPGHAN 2022 vale para prematuros com **PN < 1.800 g**. Fora disso, volume e aumento são escolha do médico, sem alerta.
- **Faixas usadas:**
  - dieta mínima de 12–24 mL/kg/dia (opcional);
  - aumento diário de 18–30 mL/kg/dia;
  - volume-alvo de 150–180 mL/kg/dia (135 pode ser seguro; até 200 caso a caso);
  - aditivo com 40–100 mL/kg/dia;
  - via oral a partir de 32 semanas de IG pós-menstrual.
- **A ESPGHAN pede que cada UTIN tenha seu protocolo.** Se o serviço tiver números próprios, eles podem substituir estes.
- **Peso da conta:** o peso de cálculo da venóclise (mesma base de mL/kg). Sem ele, o peso atual ou o de nascimento.
- **Intervalos:** só 2/2 h e 3/3 h (bolus). Dieta contínua não entrou.
- **mL por mamada:** arredondado como na venóclise (0,1 mL; 0,01 mL abaixo de 10 mL).

## ad) Transição dieta × venóclise — 🟡
- **Conta:** venóclise = volume total − dieta − outras infusões, a mesma da aba Venóclise. O plano usa o volume total de hoje.
- **O que não tem fonte:** o ponto de suspender a venóclise e o quanto baixar a TIG. O app só mostra quando a dieta cobre o volume total.
- **TIG:** continua a escolhida na aba Venóclise. Com menos volume, a concentração de glicose sobe, e a venóclise avisa se passar do limite periférico.
- **"Levar":** o botão só copia o volume de dieta de hoje para a venóclise. Nada muda sozinho.

## ae) Leites — 🟡
- **Hierarquia (ESPGHAN 2022):**
  - leite materno da própria mãe é a 1ª escolha;
  - sem ele, em < 32 semanas ou < 1.500 g, leite humano de banco com aditivo antes da fórmula para pré-termo.
- **Fora desse grupo (≥ 32 semanas e ≥ 1.500 g sem leite materno):** sem recomendação cadastrada, o médico escolhe.
- **Livre demanda:** o Guia Alimentar do MS fala da amamentação. O app avisa se você marcar livre demanda com fórmula.
- **Sem marcas.** A lista de leites do hospital ainda está pendente.

---

# Prescrição (módulo 5, 07/11/2026)

## af) Prescrição completa — 🟡 sem modelo do serviço
- **De onde vêm as linhas:** dieta, venóclise, antibiótico, fototerapia e suporte respiratório vêm prontos de cada aba, pelas mesmas funções que as abas usam. A Prescrição não calcula nada.
- **Controles:** sem frequência padrão; o médico escolhe entre opções (ex.: 3/3 h).
- **Cuidados:** são frases sem número (ex.: "cabeceira elevada", sem grau).
- **Outras medicações:** texto livre, sem cálculo de dose.
- **Ambiente:** se não for escolhido aqui, usa o da aba Venóclise (marcado como sugestão).
- **Ordem padrão:** dieta → venóclise → medicações → suporte respiratório → fototerapia → ambiente → controles → cuidados → exames → outros. Dá para subir, descer e tirar itens.
- **Antibiótico:** cada linha leva "— D2 de 5–7" quando há início e duração.
- **Suporte respiratório:** a VM sai como "(parâmetros na evolução)", porque o app não registra os parâmetros.
- **Cabeçalho:** data, peso, IG e dia de vida, sem leito nem iniciais.
- **Pendente:** um modelo de prescrição do serviço (ordem e jeito de escrever).
