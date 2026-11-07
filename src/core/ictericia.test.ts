import { describe, expect, it } from "vitest";
import { AAP2022 } from "./dados/aap2022";
import { calcularIctericia, limiarAap, type EntradaIctericia } from "./ictericia";

const base: EntradaIctericia = { igSemanas: 39, igDias: 0, bt: 10, tipo: "serica", horasDeVida: 48 };

describe("tabelas AAP 2022 (integridade)", () => {
  const todas = [
    ...Object.entries(AAP2022.foto.semRisco), ...Object.entries(AAP2022.foto.risco),
    ...Object.entries(AAP2022.exs.semRisco), ...Object.entries(AAP2022.exs.risco),
  ];
  it("18 tabelas, 360 posições (hora 0 vazia), sem lacunas e nunca diminuem", () => {
    expect(todas).toHaveLength(18);
    for (const [, a] of todas) {
      expect(a).toHaveLength(360);
      expect(a[0]).toBeNull();
      for (let h = 1; h < 360; h++) {
        expect(typeof a[h]).toBe("number");
        if (h > 1) expect(a[h] as number).toBeGreaterThanOrEqual(a[h - 1] as number);
      }
    }
  });
  it("valores conferidos no PDF (Suppl. Table 3, 38 sem ou mais, sem risco)", () => {
    const a = AAP2022.exs.semRisco[38];
    expect([a[1], a[23], a[24], a[47], a[48], a[72], a[96], a[359]]).toEqual([18, 21.2, 21.4, 23.9, 24, 25.9, 27, 27]);
  });
  it("valores conferidos no PDF (Suppl. Table 1, 37 sem): hora 1 = 7,4; 24 h = 11,7; 48 h = 15,4", () => {
    const a = AAP2022.foto.semRisco[37];
    expect([a[1], a[24], a[48]]).toEqual([7.4, 11.7, 15.4]);
  });
  it("platôs dos rodapés: fototerapia 40+ = 21,8 a partir de 96 h; com risco 38+ = 18,2; exsanguíneo 38+ = 27", () => {
    expect(AAP2022.foto.semRisco[40].slice(96).every((v) => v === 21.8)).toBe(true);
    expect(AAP2022.foto.risco[38].slice(96).every((v) => v === 18.2)).toBe(true);
    expect(AAP2022.exs.risco[38].slice(96).every((v) => v === 23.5)).toBe(true);
  });
});

describe("escolha da linha (IG)", () => {
  it("41 sem usa a linha 40+; 38 sem com risco usa 38+", () => {
    expect(limiarAap("foto", false, 41, 24)).toBe(AAP2022.foto.semRisco[40][24]);
    expect(limiarAap("foto", true, 40, 24)).toBe(AAP2022.foto.risco[38][24]);
    expect(limiarAap("exs", false, 39, 24)).toBe(AAP2022.exs.semRisco[38][24]);
  });
  it("horas fracionadas usam a hora completa; fora de 1–359 h não há limiar", () => {
    expect(limiarAap("foto", false, 37, 24.9)).toBe(AAP2022.foto.semRisco[37][24]);
    expect(limiarAap("foto", false, 37, 0.5)).toBeNull();
    expect(limiarAap("foto", false, 37, 360)).toBeNull();
  });
});

describe("pendências (nada inventado)", () => {
  it("sem BT, horas ou IG não calcula", () => {
    const r = calcularIctericia({ igSemanas: null, bt: null, horasDeVida: null });
    expect(r.pendencias).toHaveLength(3);
    expect(r.limiarFoto).toBeUndefined();
  });
  it("BT implausível bloqueia", () => {
    expect(calcularIctericia({ ...base, bt: 80 }).pendencias[0]).toMatch(/plausível/);
  });
  it("primeira hora e > 14 dias ficam fora da tabela", () => {
    expect(calcularIctericia({ ...base, horasDeVida: 0.5 }).pendencias[0]).toMatch(/primeira hora/);
    const r = calcularIctericia({ ...base, horasDeVida: 400 });
    expect(r.pendencias[0]).toMatch(/14 dias/);
    expect(r.zona).toBeUndefined();
  });
  it("icterícia < 24 h sempre alerta", () => {
    expect(calcularIctericia({ ...base, horasDeVida: 20 }).alertas.map((a) => a.id)).toContain("ict-24h");
  });
});

describe("zonas AAP 2022", () => {
  const foto = AAP2022.foto.semRisco[39][48] as number;
  const exs = AAP2022.exs.semRisco[38][48] as number;
  it("abaixo do limiar mostra a distância, sem prescrição", () => {
    const r = calcularIctericia({ ...base, bt: foto - 3 });
    expect(r.zona).toBe("abaixo");
    expect(r.prescricaoTexto).toBeUndefined();
    expect(r.limiarEscalonamento).toBe(exs - 2);
  });
  it("no limiar: fototerapia; prescrição só depois que o médico escolhe os aparelhos", () => {
    const r = calcularIctericia({ ...base, bt: foto });
    expect(r.zona).toBe("fototerapia");
    expect(r.prescricaoTexto).toBeUndefined();
    const p = calcularIctericia({ ...base, bt: foto, aparelhos: "dupla", intensidade: "intensiva" });
    expect(p.prescricaoTexto).toMatch(/^Fototerapia dupla contínua, intensiva/);
    expect(p.prescricaoTexto).toMatch(/até 12 h/);
  });
  it("escalonamento = exsanguíneo − 2; exsanguíneo bloqueia", () => {
    const e1 = calcularIctericia({ ...base, bt: exs - 2 });
    expect(e1.zona).toBe("escalonamento");
    expect(e1.condutas.join(" ")).toMatch(/STAT/);
    expect(calcularIctericia({ ...base, bt: exs - 2, aparelhos: "quadrupla" }).prescricaoTexto).toMatch(/não interromper/);
    expect(calcularIctericia({ ...base, bt: foto, aparelhos: "simples" }).prescricaoTexto).toMatch(/pausar só para mamada/);
    const e2 = calcularIctericia({ ...base, bt: exs });
    expect(e2.zona).toBe("exsanguineo");
    expect(e2.alertas.find((a) => a.id === "ict-exs")?.bloqueia).toBe(true);
  });
  it("fatores de risco trocam para as tabelas 2 e 4 (Coombs + da ficha conta)", () => {
    const r = calcularIctericia({ ...base, coombsPositivo: true });
    expect(r.referencia?.comRisco).toBe(true);
    expect(r.limiarFoto?.min).toBe(AAP2022.foto.risco[38][48]);
    expect(r.limiarExs?.min).toBe(AAP2022.exs.risco[38][48]);
    const alb = calcularIctericia({ ...base, albumina: 2.9 });
    expect(alb.referencia?.motivosRisco[0]).toMatch(/albumina/);
    expect(calcularIctericia({ ...base, albumina: 3 }).referencia?.comRisco).toBe(false);
  });
  it("BT subindo apesar da fototerapia: exsanguíneo pela tabela 4, fototerapia segue a tabela 1", () => {
    const r = calcularIctericia({ ...base, subindoApesarFoto: true });
    expect(r.limiarFoto?.min).toBe(foto);
    expect(r.limiarExs?.min).toBe(AAP2022.exs.risco[38][48]);
  });
  it("IVIG só aparece com doença hemolítica isoimune no escalonamento", () => {
    const sem = calcularIctericia({ ...base, bt: 30 });
    expect(sem.condutas.join(" ")).not.toMatch(/IVIG/);
    const com = calcularIctericia({ ...base, bt: 30, coombsPositivo: true });
    expect(com.condutas.join(" ")).toMatch(/IVIG 0,5–1 g\/kg/);
  });
  it("sinais de encefalopatia: EST urgente mesmo sem BT", () => {
    const r = calcularIctericia({ igSemanas: 39, bt: null, horasDeVida: null, sinaisEncefalopatia: true });
    expect(r.alertas.find((a) => a.id === "ict-encefalopatia")?.bloqueia).toBe(true);
  });
});

describe("TcB (AAP KAS 6)", () => {
  const foto = AAP2022.foto.semRisco[39][48] as number;
  it("TcB a menos de 3 mg/dL do limiar pede BT sérica e não define zona", () => {
    const r = calcularIctericia({ ...base, tipo: "transcutanea", bt: foto - 2.9 });
    expect(r.pedirSerica).toBe(true);
    expect(r.zona).toBeUndefined();
  });
  it("TcB ≥ 15 sempre pede sérica; longe do limiar não pede", () => {
    expect(calcularIctericia({ ...base, horasDeVida: 200, tipo: "transcutanea", bt: 15 }).pedirSerica).toBe(true);
    expect(calcularIctericia({ ...base, tipo: "transcutanea", bt: foto - 4 }).pedirSerica).toBe(false);
  });
});

describe("velocidade (AAP KAS 7)", () => {
  it("≥ 0,3 mg/dL/h nas primeiras 24 h alerta", () => {
    const r = calcularIctericia({ ...base, horasDeVida: 20, bt: 9, btAnterior: { bt: 6, horasDeVida: 10 } });
    expect(r.velocidade?.mgDlH).toBeCloseTo(0.3);
    expect(r.alertas.map((a) => a.id)).toContain("ict-velocidade");
  });
  it("depois de 24 h o corte é 0,2", () => {
    const r = calcularIctericia({ ...base, horasDeVida: 60, bt: 12, btAnterior: { bt: 10, horasDeVida: 50 } });
    expect(r.velocidade?.corte).toBe(0.2);
    expect(r.velocidade?.rapida).toBe(true);
  });
});

describe("suspensão e rebote (AAP KAS 15–16)", () => {
  it("suspender é opção 2 mg/dL abaixo do limiar da hora de início", () => {
    const l30 = AAP2022.foto.semRisco[39][30] as number;
    const r = calcularIctericia({ ...base, horasDeVida: 60, bt: l30 - 2, emFototerapia: true, fotoInicioHoras: 30 });
    expect(r.suspensao?.ate).toBeCloseTo(l30 - 2);
    expect(r.suspensao?.podeSuspender).toBe(true);
    expect(r.rebote).toMatch(/6–12 h/); // começou antes de 48 h
  });
  it("sem fatores de rebote: BT no dia seguinte", () => {
    const r = calcularIctericia({ ...base, horasDeVida: 90, bt: 10, emFototerapia: true, fotoInicioHoras: 60 });
    expect(r.rebote).toMatch(/^Após suspender: BT no dia seguinte/);
  });
  it("sem a hora de início não inventa", () => {
    expect(calcularIctericia({ ...base, emFototerapia: true }).pendencias[0]).toMatch(/início/);
  });
});

describe("< 35 semanas (SBP 2021 / Maisels 2012)", () => {
  const pt: EntradaIctericia = { igSemanas: 30, igDias: 0, bt: 9, tipo: "serica", horasDeVida: 48 };
  it("IG corrigida escolhe a linha; sem agravante mostra a faixa", () => {
    const r = calcularIctericia(pt);
    expect(r.referencia?.igUsada).toMatch(/30 0\/7 – 31 6\/7/);
    expect(r.limiarFoto).toEqual({ min: 8, max: 10 });
    expect(r.zona).toBe("faixa_foto");
  });
  it("com agravante usa o valor inferior", () => {
    const r = calcularIctericia({ ...pt, sepse: true });
    expect(r.limiarFoto).toEqual({ min: 8, max: 8 });
    expect(r.limiarExs).toEqual({ min: 13, max: 13 });
    expect(r.zona).toBe("fototerapia");
  });
  it("a IG corrigida avança com os dias de vida", () => {
    const r = calcularIctericia({ ...pt, igSemanas: 31, igDias: 6, horasDeVida: 48 });
    expect(r.limiarFoto).toEqual({ min: 10, max: 12 });
  });
  it("faixa de exsanguíneo bloqueia e pede decisão do médico", () => {
    const r = calcularIctericia({ ...pt, bt: 14 });
    expect(r.zona).toBe("faixa_exs");
    expect(r.alertas.find((a) => a.id === "ict-faixa-exs")?.bloqueia).toBe(true);
  });
  it("nascido < 35 sem que já passou de 34 6/7 corrigida: sem tabela", () => {
    const r = calcularIctericia({ ...pt, igSemanas: 34, igDias: 6, horasDeVida: 72 });
    expect(r.pendencias[0]).toMatch(/34 6\/7/);
  });
  it("≤ 1.000 g lembra fototerapia profilática e evitar alta intensidade", () => {
    const r = calcularIctericia({ ...pt, igSemanas: 27, pesoNascimentoG: 900 });
    expect(r.alertas.map((a) => a.id)).toContain("ict-ebp");
    expect(r.referencia?.igUsada).toMatch(/< 28/);
  });
  it("albumina < 2,5 (não < 3,0) é o agravante no prematuro", () => {
    expect(calcularIctericia({ ...pt, albumina: 2.7 }).referencia?.comRisco).toBe(false);
    expect(calcularIctericia({ ...pt, albumina: 2.4 }).referencia?.comRisco).toBe(true);
  });
  it("prescrição em < 35 sem não inventa intervalo de BT", () => {
    const r = calcularIctericia({ ...pt, sepse: true, aparelhos: "simples", intensidade: "padrao" });
    expect(r.prescricaoTexto).toMatch(/^Fototerapia simples contínua, irradiância padrão/);
    expect(r.prescricaoTexto).not.toMatch(/BT de controle|a cada 2 h/);
  });
});
