import { describe, expect, it } from "vitest";
import { montarPrescricao, moverSecao, ORDEM_PADRAO, ordemValida, textoRespiratorio, type Fontes } from "./prescricao";

const F: Fontes = {
  dieta: { texto: "Leite materno ordenhado (LMO) 3 mL de 3/3 h por SOG (20 mL/kg/dia)." },
  venoclise: { texto: "SG 10% 80 mL + Gluconato de cálcio 10% 4 mL — EV em BIC a 3,5 mL/h.\nConcentrações: NaCl 20%" },
  antibioticos: { linhas: ["Ampicilina 60 mg IV de 12/12 h (50 mg/kg/dose) — D1", "Gentamicina 6 mg IV de 48/48 h (5 mg/kg/dose) — D1"] },
  fototerapia: { texto: "Fototerapia dupla contínua, intensiva." },
  respiratorio: { texto: "CPAP, FiO₂ 30%." },
  ambienteVenoclise: "incubadora_umida",
};

describe("montar a prescrição", () => {
  it("numera na ordem padrão, com linhas de continuação recuadas", () => {
    const r = montarPrescricao(F, { controles: { ssvv: "3/3 h", peso: "diário", glicemia: "antes das mamadas" }, cuidados: { normotermia: true, manuseio: true }, exames: "BT em 12 h\nHemograma amanhã" }, "Prescrição — 07/11/2026");
    expect(r.texto).toBe(
      [
        "Prescrição — 07/11/2026",
        "",
        "1. Leite materno ordenhado (LMO) 3 mL de 3/3 h por SOG (20 mL/kg/dia).",
        "2. SG 10% 80 mL + Gluconato de cálcio 10% 4 mL — EV em BIC a 3,5 mL/h.",
        "   Concentrações: NaCl 20%",
        "3. Ampicilina 60 mg IV de 12/12 h (50 mg/kg/dose) — D1",
        "4. Gentamicina 6 mg IV de 48/48 h (5 mg/kg/dose) — D1",
        "5. CPAP, FiO₂ 30%.",
        "6. Fototerapia dupla contínua, intensiva.",
        "7. Incubadora umidificada.",
        "8. Sinais vitais (FC, FR, SatO₂) de 3/3 h; glicemia capilar antes das mamadas; peso diário.",
        "9. Manter normotermia; manuseio mínimo.",
        "10. BT em 12 h",
        "11. Hemograma amanhã",
      ].join("\n"),
    );
    expect(r.secoes.find((s) => s.id === "ambiente")?.sugestao).toBe(true);
  });
  it("ambiente escolhido aqui vence o da venóclise", () => {
    const r = montarPrescricao(F, { ambiente: "berco_aquecido" }, "P");
    expect(r.texto).toContain("Berço aquecido.");
    expect(r.secoes.find((s) => s.id === "ambiente")?.sugestao).toBe(false);
  });
  it("excluir e reordenar", () => {
    const r = montarPrescricao(F, { excluir: { venoclise: true, fototerapia: true }, ordem: ["ambiente", "dieta"] }, "P");
    const l = r.texto.split("\n");
    expect(l[2]).toBe("1. Incubadora umidificada.");
    expect(l[3]).toMatch(/^2\. Leite materno/);
    expect(r.texto).not.toContain("SG 10%");
    expect(r.texto).not.toContain("Fototerapia");
  });
  it("outras medicações entram depois dos antibióticos; pendências aparecem nas seções", () => {
    const r = montarPrescricao({ ...F, dieta: { pendente: "Complete na aba Dieta" } }, { medicacoesOutras: "Cafeína 20 mg/kg ataque\n\nVitamina K 1 mg IM" }, "P");
    const med = r.secoes.find((s) => s.id === "medicacoes");
    expect(med?.itens).toEqual([...F.antibioticos!.linhas, "Cafeína 20 mg/kg ataque", "Vitamina K 1 mg IM"]);
    expect(r.secoes.find((s) => s.id === "dieta")?.pendente).toBe("Complete na aba Dieta");
    expect(r.texto).not.toContain("Leite materno");
  });
  it("sem nada, texto vazio", () => {
    expect(montarPrescricao({}, {}, "P").texto).toBe("");
  });
});

describe("ordem", () => {
  it("completa e limpa a ordem salva", () => {
    expect(ordemValida(["outros", "dieta", "outros"]).slice(0, 3)).toEqual(["outros", "dieta", "venoclise"]);
    expect(ordemValida()).toEqual(ORDEM_PADRAO);
    expect(ordemValida()).toHaveLength(10);
  });
  it("move para cima e para baixo", () => {
    expect(moverSecao(undefined, "venoclise", -1).slice(0, 2)).toEqual(["venoclise", "dieta"]);
    expect(moverSecao(undefined, "dieta", -1)).toEqual(ORDEM_PADRAO);
    expect(moverSecao(undefined, "outros", 1)).toEqual(ORDEM_PADRAO);
  });
});

describe("suporte respiratório", () => {
  it("texto por suporte", () => {
    expect(textoRespiratorio("ar", 21)).toEqual({});
    expect(textoRespiratorio(null, null)).toEqual({});
    expect(textoRespiratorio("o2", null).pendente).toBe("Informe a FiO₂ na aba Internação");
    expect(textoRespiratorio("o2", 28).texto).toBe("Oxigênio (cateter/capuz), FiO₂ 28%.");
    expect(textoRespiratorio("vm", 40).texto).toBe("Ventilação mecânica, FiO₂ 40% (parâmetros na evolução).");
  });
});
