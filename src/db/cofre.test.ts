import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { CONFIG_PADRAO } from "../core/calculo";
import { Cofre, ErroCofre } from "./cofre";
import type { Paciente, Registro } from "./modelos";

const IT = 1000; // iterações baixas só nos testes
let n = 0;
const novo = () => new Cofre(`teste-${++n}-${Math.random()}`);

const pac = (id: string, atualizadoEm = 1000): Paciente => ({
  id, leito: "UTIN 3", iniciais: "M.S.", nascimento: null, criadoEm: 1, atualizadoEm,
  entrada: { pesoNascimento: 1200, igSemanas: 30, diaDeVida: 2, volumeMlKgDia: 100, tig: 5 }, cfg: CONFIG_PADRAO,
});
const reg = (id: string, pacienteId: string): Registro => ({
  id, pacienteId, em: 5, diaDeVida: 2, vazaoMlH: 4, concFinalRealPct: 9, volumeMlKgDia: 100, tig: 5,
  prescricaoTexto: "texto", entrada: pac("x").entrada, cfg: CONFIG_PADRAO,
});

let c: Cofre;
beforeEach(async () => { c = novo(); await c.iniciar(); });

describe("sem PIN", () => {
  it("salva e lê paciente e histórico", async () => {
    await c.salvarPaciente(pac("a"));
    await c.salvarRegistro(reg("r1", "a"));
    expect((await c.listarPacientes())[0].iniciais).toBe("M.S.");
    expect(await c.listarRegistros("a")).toHaveLength(1);
    expect(c.estado()).toBe("sem_pin");
  });
  it("apagar paciente apaga o histórico", async () => {
    await c.salvarPaciente(pac("a"));
    await c.salvarRegistro(reg("r1", "a"));
    await c.apagarPaciente("a");
    expect(await c.listarPacientes()).toHaveLength(0);
    expect(await c.listarRegistros("a")).toHaveLength(0);
  });
});

describe("com PIN", () => {
  it("cifra o que já existia e exige PIN depois de bloquear", async () => {
    await c.salvarPaciente(pac("a"));
    await c.ativarPin("1234", IT);
    expect(c.estado()).toBe("aberto");
    const bruto = JSON.stringify(await c.exportar());
    expect(bruto).not.toContain("UTIN 3");
    expect(bruto).not.toContain("M.S.");
    c.bloquear();
    expect(c.estado()).toBe("bloqueado");
    await expect(c.listarPacientes()).rejects.toBeInstanceOf(ErroCofre);
    expect(await c.desbloquear("0000")).toBe(false);
    expect(await c.desbloquear("1234")).toBe(true);
    expect((await c.listarPacientes())[0].leito).toBe("UTIN 3");
  });
  it("persiste entre sessões: novo objeto no mesmo banco começa bloqueado", async () => {
    const nome = `persist-${Math.random()}`;
    const a = new Cofre(nome); await a.iniciar();
    await a.ativarPin("4321", IT);
    await a.salvarPaciente(pac("a"));
    const b = new Cofre(nome);
    expect(await b.iniciar()).toBe("bloqueado");
    expect(await b.desbloquear("4321")).toBe(true);
    expect(await b.listarPacientes()).toHaveLength(1);
  });
  it("rejeita PIN fraco", async () => {
    await expect(c.ativarPin("12", IT)).rejects.toMatchObject({ codigo: "PIN_INVALIDO" });
    await expect(c.ativarPin("abcd", IT)).rejects.toMatchObject({ codigo: "PIN_INVALIDO" });
  });
  it("IV novo a cada gravação (mesmo conteúdo → cifras diferentes)", async () => {
    await c.ativarPin("1234", IT);
    await c.salvarPaciente(pac("a"));
    const e1 = (await c.exportar()).pacientes[0].dados.ct;
    await c.salvarPaciente(pac("a"));
    expect((await c.exportar()).pacientes[0].dados.ct).not.toBe(e1);
  });
  it("trocar PIN mantém os dados e invalida o antigo", async () => {
    await c.salvarPaciente(pac("a"));
    await c.ativarPin("1234", IT);
    await expect(c.trocarPin("9999", "5678", IT)).rejects.toMatchObject({ codigo: "PIN_INCORRETO" });
    await c.trocarPin("1234", "5678", IT);
    c.bloquear();
    expect(await c.desbloquear("1234")).toBe(false);
    expect(await c.desbloquear("5678")).toBe(true);
    expect(await c.listarPacientes()).toHaveLength(1);
  });
  it("desativar PIN devolve texto puro e exige o PIN", async () => {
    await c.ativarPin("1234", IT);
    await c.salvarPaciente(pac("a"));
    await expect(c.desativarPin("0000")).rejects.toMatchObject({ codigo: "PIN_INCORRETO" });
    await c.desativarPin("1234");
    expect(c.estado()).toBe("sem_pin");
    expect(JSON.stringify(await c.exportar())).toContain("UTIN 3");
  });
  it("dado adulterado não abre (GCM autentica)", async () => {
    await c.ativarPin("1234", IT);
    await c.salvarPaciente(pac("a"));
    const b = await c.exportar();
    const ct = b.pacientes[0].dados.ct!;
    b.pacientes[0].dados.ct = (ct[0] === "A" ? "B" : "A") + ct.slice(1);
    const d = novo(); await d.iniciar();
    await expect(d.importar(b, "1234")).rejects.toBeDefined();
  });
});

describe("backup", () => {
  it("round-trip sem PIN", async () => {
    await c.salvarPaciente(pac("a"));
    await c.salvarRegistro(reg("r1", "a"));
    const b = await c.exportar();
    const d = novo(); await d.iniciar();
    expect(await d.importar(JSON.parse(JSON.stringify(b)))).toEqual({ pacientes: 1, registros: 1 });
    expect(await d.listarRegistros("a")).toHaveLength(1);
  });
  it("backup com PIN importa em app sem PIN (passa a texto puro) e exige o PIN certo", async () => {
    await c.ativarPin("1234", IT);
    await c.salvarPaciente(pac("a"));
    const b = JSON.parse(JSON.stringify(await c.exportar()));
    const d = novo(); await d.iniciar();
    await expect(d.importar(b)).rejects.toMatchObject({ codigo: "PIN_INCORRETO" });
    await expect(d.importar(b, "0000")).rejects.toMatchObject({ codigo: "PIN_INCORRETO" });
    expect((await d.importar(b, "1234")).pacientes).toBe(1);
    expect((await d.listarPacientes())[0].leito).toBe("UTIN 3");
  });
  it("backup sem PIN importa em app com PIN (passa a cifrado)", async () => {
    await c.salvarPaciente(pac("a"));
    const b = JSON.parse(JSON.stringify(await c.exportar()));
    const d = novo(); await d.iniciar();
    await d.ativarPin("2468", IT);
    await d.importar(b);
    expect(JSON.stringify(await d.exportar())).not.toContain("UTIN 3");
    expect(await d.listarPacientes()).toHaveLength(1);
  });
  it("mesclagem: paciente mais novo vence, mais velho não sobrescreve", async () => {
    await c.salvarPaciente({ ...pac("a", 2000), leito: "NOVO" });
    const velho = JSON.parse(JSON.stringify(await (async () => { const d = novo(); await d.iniciar(); await d.salvarPaciente(pac("a", 1000)); return d.exportar(); })()));
    expect((await c.importar(velho)).pacientes).toBe(0);
    expect((await c.listarPacientes())[0].leito).toBe("NOVO");
  });
  it("rejeita arquivo que não é backup", async () => {
    await expect(c.importar({ foo: 1 })).rejects.toMatchObject({ codigo: "BACKUP_INVALIDO" });
    await expect(c.importar(null)).rejects.toMatchObject({ codigo: "BACKUP_INVALIDO" });
  });
});

describe("config do serviço", () => {
  it("persiste por cima do padrão e some no apagar tudo", async () => {
    expect((await c.configServico(CONFIG_PADRAO)).nacl).toBe("20");
    await c.salvarConfigServico({ ...CONFIG_PADRAO, nacl: "10" });
    expect((await c.configServico(CONFIG_PADRAO)).nacl).toBe("10");
    await c.apagarTudo();
    expect((await c.configServico(CONFIG_PADRAO)).nacl).toBe("20");
  });
});

describe("limpeza automática e apagar tudo", () => {
  it("apaga só os pacientes antigos e funciona com o cofre bloqueado", async () => {
    await c.ativarPin("1234", IT);
    const dia = 24 * 3600 * 1000;
    await c.salvarPaciente(pac("velho", 1 * dia));
    await c.salvarPaciente(pac("novo", 9 * dia));
    await c.salvarPreferencias({ retencaoDias: 5, bloqueioMin: 2 });
    c.bloquear();
    expect(await c.limpezaAutomatica(10 * dia)).toBe(1);
    await c.desbloquear("1234");
    expect((await c.listarPacientes()).map((p) => p.id)).toEqual(["novo"]);
  });
  it("desligada por padrão", async () => {
    await c.salvarPaciente(pac("a", 1));
    expect(await c.limpezaAutomatica(1e15)).toBe(0);
  });
  it("apagar tudo remove dados e PIN", async () => {
    await c.ativarPin("1234", IT);
    await c.salvarPaciente(pac("a"));
    await c.apagarTudo();
    expect(await c.iniciar()).toBe("sem_pin");
    expect(await c.listarPacientes()).toHaveLength(0);
  });
});
