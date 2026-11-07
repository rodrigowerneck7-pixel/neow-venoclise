import Dexie, { type EntityTable } from "dexie";
import {
  ITERACOES_PADRAO,
  cifrar,
  conferirVerificador,
  criarVerificador,
  decifrar,
  derivarChave,
  gerarSalt,
  pinValido,
  type Envelope,
} from "./cripto";
import { PREFERENCIAS_PADRAO, type EstadoCofre, type Paciente, type Preferencias, type Registro } from "./modelos";

interface LinhaPaciente { id: string; atualizadoEm: number; dados: Envelope }
interface LinhaRegistro { id: string; pacienteId: string; em: number; dados: Envelope }
interface LinhaMeta { chave: string; valor: unknown }

export interface Seguranca { salt: string; iter: number; verificador: Envelope }

export interface Backup {
  formato: "neow-venoclise-backup";
  versao: 1;
  criadoEm: number;
  /** null = dados em texto puro (backup feito sem PIN). */
  seguranca: Seguranca | null;
  pacientes: { id: string; atualizadoEm: number; dados: Envelope }[];
  registros: { id: string; pacienteId: string; em: number; dados: Envelope }[];
}

export class ErroCofre extends Error {
  constructor(public codigo: "BLOQUEADO" | "PIN_INCORRETO" | "PIN_INVALIDO" | "ESTADO" | "BACKUP_INVALIDO", msg: string) {
    super(msg);
  }
}

type Banco = Dexie & {
  meta: EntityTable<LinhaMeta, "chave">;
  pacientes: EntityTable<LinhaPaciente, "id">;
  registros: EntityTable<LinhaRegistro, "id">;
};

export function novoId(): string {
  return crypto.randomUUID();
}

/**
 * Camada única de acesso aos dados de paciente. Com PIN ligado, tudo que identifica ou descreve o
 * paciente fica cifrado (AES-GCM); só ids aleatórios e datas de atualização ficam em claro (índices).
 * A chave vive só na memória: bloquear = esquecer a chave.
 */
export class Cofre {
  private db: Banco;
  private chave: CryptoKey | null = null;
  private seg: Seguranca | null = null;
  private iniciado = false;

  constructor(nomeBanco = "neow-venoclise") {
    const db = new Dexie(nomeBanco) as Banco;
    db.version(1).stores({ meta: "chave", pacientes: "id, atualizadoEm", registros: "id, pacienteId, em" });
    this.db = db;
  }

  async iniciar(): Promise<EstadoCofre> {
    const m = await this.db.meta.get("seguranca");
    this.seg = (m?.valor as Seguranca | undefined) ?? null;
    this.chave = null;
    this.iniciado = true;
    return this.estado();
  }

  estado(): EstadoCofre {
    if (!this.iniciado) throw new ErroCofre("ESTADO", "Cofre não iniciado");
    if (!this.seg) return "sem_pin";
    return this.chave ? "aberto" : "bloqueado";
  }

  // ---------- criptografia por linha
  private async selar(valor: unknown): Promise<Envelope> {
    if (!this.seg) return { v: 0, json: JSON.stringify(valor) };
    if (!this.chave) throw new ErroCofre("BLOQUEADO", "Cofre bloqueado");
    return cifrar(this.chave, valor);
  }
  private async abrir<T>(env: Envelope): Promise<T> {
    if (env.v === 0) return JSON.parse(env.json ?? "null") as T;
    if (!this.chave) throw new ErroCofre("BLOQUEADO", "Cofre bloqueado");
    return decifrar<T>(this.chave, env);
  }
  private exigirAberto() {
    if (this.estado() === "bloqueado") throw new ErroCofre("BLOQUEADO", "Cofre bloqueado");
  }

  // ---------- PIN
  async desbloquear(pin: string): Promise<boolean> {
    if (!this.seg) return true;
    const k = await derivarChave(pin, this.seg.salt, this.seg.iter);
    if (!(await conferirVerificador(k, this.seg.verificador))) return false;
    this.chave = k;
    return true;
  }

  bloquear() {
    this.chave = null;
  }

  /** Liga o PIN e cifra tudo o que já estava salvo. */
  async ativarPin(pin: string, iteracoes = ITERACOES_PADRAO): Promise<void> {
    if (this.estado() !== "sem_pin") throw new ErroCofre("ESTADO", "O PIN já está ativo");
    if (!pinValido(pin)) throw new ErroCofre("PIN_INVALIDO", "O PIN deve ter de 4 a 12 dígitos");
    const salt = gerarSalt();
    const k = await derivarChave(pin, salt, iteracoes);
    const seg: Seguranca = { salt, iter: iteracoes, verificador: await criarVerificador(k) };
    const [ps, rs] = await Promise.all([this.db.pacientes.toArray(), this.db.registros.toArray()]);
    const ps2 = await Promise.all(ps.map(async (l) => ({ ...l, dados: await cifrar(k, await this.abrir(l.dados)) })));
    const rs2 = await Promise.all(rs.map(async (l) => ({ ...l, dados: await cifrar(k, await this.abrir(l.dados)) })));
    await this.db.transaction("rw", this.db.meta, this.db.pacientes, this.db.registros, async () => {
      await this.db.pacientes.bulkPut(ps2);
      await this.db.registros.bulkPut(rs2);
      await this.db.meta.put({ chave: "seguranca", valor: seg });
    });
    this.seg = seg;
    this.chave = k;
  }

  /** Desliga o PIN: exige o PIN atual e volta tudo para texto puro. */
  async desativarPin(pin: string): Promise<void> {
    if (this.estado() === "sem_pin") return;
    if (!(await this.desbloquear(pin))) throw new ErroCofre("PIN_INCORRETO", "PIN incorreto");
    const [ps, rs] = await Promise.all([this.db.pacientes.toArray(), this.db.registros.toArray()]);
    const ps2 = await Promise.all(ps.map(async (l) => ({ ...l, dados: { v: 0 as const, json: JSON.stringify(await this.abrir(l.dados)) } })));
    const rs2 = await Promise.all(rs.map(async (l) => ({ ...l, dados: { v: 0 as const, json: JSON.stringify(await this.abrir(l.dados)) } })));
    await this.db.transaction("rw", this.db.meta, this.db.pacientes, this.db.registros, async () => {
      await this.db.pacientes.bulkPut(ps2);
      await this.db.registros.bulkPut(rs2);
      await this.db.meta.delete("seguranca");
    });
    this.seg = null;
    this.chave = null;
  }

  async trocarPin(atual: string, novo: string, iteracoes = ITERACOES_PADRAO): Promise<void> {
    if (this.estado() === "sem_pin") throw new ErroCofre("ESTADO", "Não há PIN para trocar");
    if (!pinValido(novo)) throw new ErroCofre("PIN_INVALIDO", "O PIN deve ter de 4 a 12 dígitos");
    if (!(await this.desbloquear(atual))) throw new ErroCofre("PIN_INCORRETO", "PIN atual incorreto");
    const salt = gerarSalt();
    const k = await derivarChave(novo, salt, iteracoes);
    const seg: Seguranca = { salt, iter: iteracoes, verificador: await criarVerificador(k) };
    const [ps, rs] = await Promise.all([this.db.pacientes.toArray(), this.db.registros.toArray()]);
    const ps2 = await Promise.all(ps.map(async (l) => ({ ...l, dados: await cifrar(k, await this.abrir(l.dados)) })));
    const rs2 = await Promise.all(rs.map(async (l) => ({ ...l, dados: await cifrar(k, await this.abrir(l.dados)) })));
    await this.db.transaction("rw", this.db.meta, this.db.pacientes, this.db.registros, async () => {
      await this.db.pacientes.bulkPut(ps2);
      await this.db.registros.bulkPut(rs2);
      await this.db.meta.put({ chave: "seguranca", valor: seg });
    });
    this.seg = seg;
    this.chave = k;
  }

  // ---------- pacientes
  async listarPacientes(): Promise<Paciente[]> {
    this.exigirAberto();
    const ls = await this.db.pacientes.toArray();
    const ps = await Promise.all(ls.map((l) => this.abrir<Paciente>(l.dados)));
    return ps.sort((a, b) => b.atualizadoEm - a.atualizadoEm);
  }

  async salvarPaciente(p: Paciente): Promise<void> {
    this.exigirAberto();
    const dados = await this.selar(p);
    await this.db.pacientes.put({ id: p.id, atualizadoEm: p.atualizadoEm, dados });
  }

  async apagarPaciente(id: string): Promise<void> {
    await this.db.transaction("rw", this.db.pacientes, this.db.registros, async () => {
      await this.db.registros.where("pacienteId").equals(id).delete();
      await this.db.pacientes.delete(id);
    });
  }

  // ---------- histórico
  async listarRegistros(pacienteId: string): Promise<Registro[]> {
    this.exigirAberto();
    const ls = await this.db.registros.where("pacienteId").equals(pacienteId).toArray();
    const rs = await Promise.all(ls.map((l) => this.abrir<Registro>(l.dados)));
    return rs.sort((a, b) => b.em - a.em);
  }

  async salvarRegistro(r: Registro): Promise<void> {
    this.exigirAberto();
    const dados = await this.selar(r);
    await this.db.registros.put({ id: r.id, pacienteId: r.pacienteId, em: r.em, dados });
  }

  async apagarRegistro(id: string): Promise<void> {
    await this.db.registros.delete(id);
  }

  // ---------- preferências (não identificam ninguém: ficam em claro)
  async preferencias(): Promise<Preferencias> {
    const m = await this.db.meta.get("preferencias");
    return { ...PREFERENCIAS_PADRAO, ...((m?.valor as Partial<Preferencias> | undefined) ?? {}) };
  }
  async salvarPreferencias(p: Preferencias): Promise<void> {
    await this.db.meta.put({ chave: "preferencias", valor: p });
  }

  /** Apaga pacientes sem atualização há mais de `retencaoDias`. Usa só índices em claro (funciona bloqueado). */
  async limpezaAutomatica(agora = Date.now()): Promise<number> {
    const { retencaoDias } = await this.preferencias();
    if (!retencaoDias || retencaoDias <= 0) return 0;
    const limite = agora - retencaoDias * 24 * 3600 * 1000;
    const velhos = await this.db.pacientes.where("atualizadoEm").below(limite).primaryKeys();
    for (const id of velhos) await this.apagarPaciente(id);
    return velhos.length;
  }

  /** Apaga TODOS os dados e o PIN. */
  async apagarTudo(): Promise<void> {
    await this.db.transaction("rw", this.db.meta, this.db.pacientes, this.db.registros, async () => {
      await this.db.pacientes.clear();
      await this.db.registros.clear();
      await this.db.meta.clear();
    });
    this.seg = null;
    this.chave = null;
  }

  // ---------- backup
  async exportar(agora = Date.now()): Promise<Backup> {
    this.exigirAberto();
    const [ps, rs] = await Promise.all([this.db.pacientes.toArray(), this.db.registros.toArray()]);
    return {
      formato: "neow-venoclise-backup",
      versao: 1,
      criadoEm: agora,
      seguranca: this.seg,
      pacientes: ps,
      registros: rs,
    };
  }

  /**
   * Importa mesclando: paciente mais novo vence; registro com id já existente é mantido.
   * `pinDoBackup` é o PIN com que o arquivo foi criado (se ele era criptografado).
   */
  async importar(bruto: unknown, pinDoBackup?: string): Promise<{ pacientes: number; registros: number }> {
    this.exigirAberto();
    const b = validarBackup(bruto);
    let chaveBackup: CryptoKey | null = null;
    if (b.seguranca) {
      if (!pinDoBackup) throw new ErroCofre("PIN_INCORRETO", "Este backup é protegido por PIN");
      chaveBackup = await derivarChave(pinDoBackup, b.seguranca.salt, b.seguranca.iter);
      if (!(await conferirVerificador(chaveBackup, b.seguranca.verificador)))
        throw new ErroCofre("PIN_INCORRETO", "PIN do backup incorreto");
    }
    const ler = async <T>(env: Envelope): Promise<T> => {
      if (env.v === 0) return JSON.parse(env.json ?? "null") as T;
      if (!chaveBackup) throw new ErroCofre("BACKUP_INVALIDO", "Backup inconsistente");
      return decifrar<T>(chaveBackup, env);
    };
    const existentes = new Map((await this.db.pacientes.toArray()).map((l) => [l.id, l.atualizadoEm]));
    const idsReg = new Set(await this.db.registros.toCollection().primaryKeys());
    let np = 0;
    let nr = 0;
    for (const l of b.pacientes) {
      if ((existentes.get(l.id) ?? -1) >= l.atualizadoEm) continue;
      const p = await ler<Paciente>(l.dados);
      if (p.id !== l.id) throw new ErroCofre("BACKUP_INVALIDO", "Backup inconsistente");
      await this.salvarPaciente(p);
      np++;
    }
    for (const l of b.registros) {
      if (idsReg.has(l.id)) continue;
      const r = await ler<Registro>(l.dados);
      if (r.id !== l.id) throw new ErroCofre("BACKUP_INVALIDO", "Backup inconsistente");
      await this.salvarRegistro(r);
      nr++;
    }
    return { pacientes: np, registros: nr };
  }
}

function ehEnvelope(x: unknown): x is Envelope {
  const e = x as Envelope;
  return !!e && (e.v === 0 ? typeof e.json === "string" : e.v === 1 && typeof e.iv === "string" && typeof e.ct === "string");
}

export function validarBackup(x: unknown): Backup {
  const b = x as Partial<Backup> | null;
  const ruim = () => new ErroCofre("BACKUP_INVALIDO", "Arquivo de backup inválido");
  if (!b || b.formato !== "neow-venoclise-backup" || b.versao !== 1) throw ruim();
  if (!Array.isArray(b.pacientes) || !Array.isArray(b.registros)) throw ruim();
  if (b.seguranca != null) {
    const s = b.seguranca;
    if (typeof s.salt !== "string" || typeof s.iter !== "number" || !ehEnvelope(s.verificador)) throw ruim();
  }
  for (const l of b.pacientes) if (typeof l?.id !== "string" || typeof l.atualizadoEm !== "number" || !ehEnvelope(l.dados)) throw ruim();
  for (const l of b.registros) if (typeof l?.id !== "string" || typeof l.pacienteId !== "string" || typeof l.em !== "number" || !ehEnvelope(l.dados)) throw ruim();
  return b as Backup;
}
