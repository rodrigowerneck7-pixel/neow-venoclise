/**
 * Criptografia em repouso (WebCrypto, sem bibliotecas).
 * PIN → PBKDF2-SHA256 → chave AES-GCM 256 (não extraível, só na memória).
 * Cada gravação usa um IV aleatório novo de 12 bytes.
 */
export const ITERACOES_PADRAO = 600_000; // OWASP 2023 para PBKDF2-HMAC-SHA256
const TEXTO_VERIFICADOR = "neow-venoclise:ok";

export interface Envelope {
  /** 0 = texto puro (sem PIN); 1 = AES-GCM. */
  v: 0 | 1;
  /** v0: JSON. v1: ausente. */
  json?: string;
  iv?: string;
  ct?: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function paraB64(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
export function deB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function gerarSalt(): string {
  return paraB64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function derivarChave(pin: string, saltB64: string, iteracoes: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: deB64(saltB64), iterations: iteracoes },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function cifrar(chave: CryptoKey, valor: unknown): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, chave, enc.encode(JSON.stringify(valor)));
  return { v: 1, iv: paraB64(iv), ct: paraB64(ct) };
}

/** Lança se a chave estiver errada ou o dado tiver sido adulterado (GCM autentica). */
export async function decifrar<T>(chave: CryptoKey, env: Envelope): Promise<T> {
  if (env.v !== 1 || !env.iv || !env.ct) throw new Error("Envelope inválido");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(env.iv) }, chave, deB64(env.ct));
  return JSON.parse(dec.decode(pt)) as T;
}

export async function criarVerificador(chave: CryptoKey): Promise<Envelope> {
  return cifrar(chave, TEXTO_VERIFICADOR);
}
export async function conferirVerificador(chave: CryptoKey, v: Envelope): Promise<boolean> {
  try {
    return (await decifrar<string>(chave, v)) === TEXTO_VERIFICADOR;
  } catch {
    return false;
  }
}

/** PIN: 4 a 12 dígitos numéricos. */
export function pinValido(pin: string): boolean {
  return /^\d{4,12}$/.test(pin);
}
