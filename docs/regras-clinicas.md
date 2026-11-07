# Regras clínicas implementadas

Cada regra tem a constante em `src/core/constantes.ts` (com a fonte em comentário) e o teste em `src/core/*.test.ts`.
Siglas de fonte em `docs/fontes.md`. Conflitos e pendências em `docs/DIVERGENCIAS.md`.

## Peso e entrada
| Regra | Fonte | Onde |
|---|---|---|
| Peso de cálculo = PN enquanto peso atual < PN; depois o atual | MS 2014 | `calculo.ts` |
| Perda de peso: >10% termo 🟠; >10% no <1.500 g 🟠; ≥20% 🔴; <2% no extremo após D3 🟠 | MS 2014 | `PERDA_PESO` |
| Peso < 15 pergunta "kg?"; só converte após confirmação | prompt | `interpretarPeso` |
| Peso 300–6.500 g; IG 22–44 sem; dia ≤ 28; variação PN×atual > 25% confirma | prompt | `SANIDADE` |
| Dia de vida: D1 = primeiras 24 h | prompt | `tempo.ts` |

## Volume (mL/kg/dia)
| Regra | Fonte |
|---|---|
| Tabela D1–D5 por grupo; D6+ = 140–160 | ESPGHAN 2018 = SBP 2023 (padrão) |
| Tabela por dia × peso (≤750, 751–1.000, 1.001–1.500, 1.501–2.500) | MS 2014 / Lorenz 2008 (alternativa) |
| Termo MS: D1 60–80; D7 80–120; demais dias `TODO(validar)` | MS 2014 |
| Fototerapia +10–20%; asfixia/SDR/VM −10–20% (ver DIVERGENCIAS h) | MS / ESPGHAN |
| Fora da faixa só com confirmação + justificativa | prompt |

## Glicose
| Regra | Fonte |
|---|---|
| glicose (g/dia) = TIG × 1,44 × kg; conc. final = g ÷ volume da venóclise × 100 | fórmula padrão |
| TIG PT D1 4–8, depois até 8–10; termo D1 2,5–5, depois até 5–10; máx. 12 | ESPGHAN 2018 R5.4 |
| Conc. final < 2,5% bloqueia; > 12,5% exige central | MS 2014 |
| Mistura: fração > 10% → SG 10% + SG 50%; ≤ 10% → SG 10% + AD (SG 5% opcional) | MS 2014 |
| Glicemia: < 45 hipoglicemia; 125–175 manter; 175–250 −2; > 250 −4 | MS 2014 |
| Glicemia > 180 persistente: considerar insulina | ESPGHAN R5.11 |

## Cálcio, magnésio, sódio, potássio
| Regra | Fonte |
|---|---|
| Gluconato de Ca 10%: 1 mL = 100 mg sal = 9,3 mg Ca elementar = 0,465 mEq = 0,2325 mmol | MS 2014 |
| Padrão 4 mL/kg/dia; faixa 0,8–2,0 mmol/kg/dia; início no D1 em PT e grupo de risco | MS 2014; ESPGHAN/SBP |
| Hipocalcemia: total < 7 (< 1.500 g) ou < 8 mg/dL; iônico < 1,0 ou < 1,1 mmol/L | MS 2014 |
| MgSO₄ 10%: 0,81 mEq/mL; padrão 0,3 mEq/kg/dia; faixa 0,2–0,4 (D1–10) | MS 2014; ESPGHAN/SBP |
| Mãe com MgSO₄ = sim: sugerir Mg = 0 até ter Mg sérico | ESPGHAN R8.5 |
| NaCl 20% 3,4 mEq/mL; D1 travado em 0 (override com justificativa); termo 2–4, PT 3–5 | MS 2014 |
| KCl 19,1% 2,56 mEq/mL; D1 travado; exige diurese ≥ 1 mL/kg/h; K sérico ≥ 5,5 bloqueia; < 800 g nas 72 h exige K sérico | MS 2014; Cochrane |

## Fora do escopo (o app diz isso na tela)
NP com aminoácidos/lipídios, fosfato, refeeding, choque, expansão, correção de desidratação, insuficiência renal, SIADH, cardiopatia com restrição hídrica.
