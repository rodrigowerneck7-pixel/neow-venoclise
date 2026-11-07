import { describe, expect, it } from "vitest";
import { parseNascimento, validarIdentificacao } from "./validacao";

describe("identificação mínima", () => {
  it("aceita leito e iniciais", () => {
    expect(validarIdentificacao("UTIN 3", "M.S.")).toEqual({});
    expect(validarIdentificacao("12", "RN de AB")).toEqual({});
  });
  it("recusa nome completo", () => {
    expect(validarIdentificacao("UTIN 3", "Maria da Silva").iniciais).toBeDefined();
    expect(validarIdentificacao("UTIN 3", "Mariana").iniciais).toBeDefined();
  });
  it("recusa prontuário/CPF no leito e números nas iniciais", () => {
    expect(validarIdentificacao("123456789", "M.S.").leito).toBeDefined();
    expect(validarIdentificacao("UTIN 3", "M.S.2").iniciais).toBeDefined();
  });
  it("exige os dois campos", () => {
    expect(validarIdentificacao("", "").leito).toBeDefined();
    expect(validarIdentificacao("", "").iniciais).toBeDefined();
  });
});

describe("nascimento", () => {
  it("lê data/hora local e recusa lixo", () => {
    const d = parseNascimento("2026-11-05T14:30")!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 10, 5, 14, 30]);
    expect(parseNascimento("")).toBeNull();
    expect(parseNascimento("ontem")).toBeNull();
  });
});
