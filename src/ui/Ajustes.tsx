import { useRef, useState } from "react";
import { ErroCofre } from "../db/cofre";
import type { EstadoCofre, Preferencias } from "../db/modelos";
import { cofre } from "../db/instancia";
import { CampoPin } from "./Bloqueio";
import type { ConfigServico as Cfg } from "../core/tipos";
import { Card, Segmentado } from "./campos";
import { ComoInstalar } from "./ComoInstalar";
import { ConfigServico } from "./ConfigServico";
import { CartaoTema, type Tema } from "./Tema";

type Msg = { tipo: "ok" | "erro"; texto: string } | null;
const Aviso = ({ m }: { m: Msg }) =>
  m ? <p role={m.tipo === "erro" ? "alert" : "status"} className={`text-body-sm ${m.tipo === "erro" ? "text-danger" : "text-success"}`}>{m.texto}</p> : null;

const msgErro = (e: unknown) => (e instanceof ErroCofre ? e.message : "Algo deu errado. Tente de novo.");
const btn = "btn btn-primary";
const btn2 = "btn btn-neutro";

function Seguranca({ estado, onMudou }: { estado: EstadoCofre; onMudou: () => void }) {
  const [atual, setAtual] = useState("");
  const [novo, setNovo] = useState("");
  const [conf, setConf] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [ocupado, setOcupado] = useState(false);
  const comPin = estado !== "sem_pin";

  const rodar = async (fn: () => Promise<void>, ok: string) => {
    setOcupado(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ tipo: "ok", texto: ok });
      setAtual(""); setNovo(""); setConf("");
      onMudou();
    } catch (e) {
      setMsg({ tipo: "erro", texto: msgErro(e) });
    } finally {
      setOcupado(false);
    }
  };
  const novoOk = novo.length >= 4 && novo === conf;

  return (
    <Card titulo="Segurança (PIN)">
      <p className="text-body-sm text-muted">
        {comPin ? "PIN ativo: os dados salvos ficam cifrados (AES-GCM) neste aparelho." : "Sem PIN: os dados salvos ficam legíveis no aparelho. Recomendado ativar."}
      </p>
      {comPin && <CampoPin rotulo="PIN atual" valor={atual} onChange={setAtual} />}
      <CampoPin rotulo={comPin ? "Novo PIN (4 a 12 dígitos)" : "Criar PIN (4 a 12 dígitos)"} valor={novo} onChange={setNovo} />
      <CampoPin rotulo="Repita o PIN" valor={conf} onChange={setConf} />
      {novo.length >= 4 && conf.length > 0 && novo !== conf && <p className="text-caption text-danger">Os PINs não são iguais.</p>}
      <p className="text-caption text-subtle">Se esquecer o PIN, os dados não podem ser recuperados. Só o backup (com o mesmo PIN) restaura.</p>
      <div className="flex flex-wrap gap-2">
        {!comPin ? (
          <button type="button" disabled={!novoOk || ocupado} className={btn} onClick={() => rodar(() => cofre.ativarPin(novo), "PIN ativado. Dados cifrados.")}>
            {ocupado ? "Cifrando…" : "Ativar PIN"}
          </button>
        ) : (
          <>
            <button type="button" disabled={!novoOk || atual.length < 4 || ocupado} className={btn} onClick={() => rodar(() => cofre.trocarPin(atual, novo), "PIN trocado.")}>
              {ocupado ? "Aguarde…" : "Trocar PIN"}
            </button>
            <button type="button" disabled={atual.length < 4 || ocupado} className={btn2} onClick={() => rodar(() => cofre.desativarPin(atual), "PIN desativado. Dados voltaram a texto puro.")}>
              Desativar PIN
            </button>
          </>
        )}
      </div>
      <Aviso m={msg} />
    </Card>
  );
}

function Backup({ estado, onMudou }: { estado: EstadoCofre; onMudou: () => void }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [pendente, setPendente] = useState<unknown>(null);
  const [pinBackup, setPinBackup] = useState("");
  const arquivo = useRef<HTMLInputElement>(null);

  const exportar = async () => {
    setMsg(null);
    try {
      const b = await cofre.exportar();
      const nome = `neow-venoclise-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const file = new File([JSON.stringify(b)], nome, { type: "application/json" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: nome });
          setMsg({ tipo: "ok", texto: "Backup enviado para o compartilhamento." });
          return;
        } catch (e) {
          if ((e as DOMException).name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setMsg({ tipo: "ok", texto: "Backup baixado." });
    } catch (e) {
      setMsg({ tipo: "erro", texto: msgErro(e) });
    }
  };

  const importar = async (bruto: unknown, pin?: string) => {
    try {
      const r = await cofre.importar(bruto, pin);
      setPendente(null);
      setPinBackup("");
      setMsg({ tipo: "ok", texto: `Importado: ${r.pacientes} paciente(s), ${r.registros} registro(s) do histórico.` });
      onMudou();
    } catch (e) {
      if (e instanceof ErroCofre && e.codigo === "PIN_INCORRETO") setPendente(bruto);
      setMsg({ tipo: "erro", texto: msgErro(e) });
    }
  };

  const escolher = async (f: File | undefined) => {
    if (!f) return;
    setMsg(null);
    try {
      await importar(JSON.parse(await f.text()));
    } catch {
      setMsg({ tipo: "erro", texto: "Arquivo de backup inválido" });
    }
    if (arquivo.current) arquivo.current.value = "";
  };

  return (
    <Card titulo="Backup">
      <p className="text-body-sm text-muted">
        {estado === "sem_pin"
          ? "Atenção: sem PIN o arquivo de backup NÃO é criptografado e contém leitos e iniciais."
          : "O arquivo de backup fica cifrado com o seu PIN. Guarde-o fora do aparelho."}
      </p>
      <p className="text-caption text-subtle">No iPhone, o app instalado na Tela de Início guarda os dados separados do Safari. Use sempre o ícone.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={exportar}>Exportar backup</button>
        <button type="button" className={btn2} onClick={() => arquivo.current?.click()}>Importar backup</button>
        <input ref={arquivo} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void escolher(e.target.files?.[0])} />
      </div>
      {pendente != null && (
        <div className="space-y-2">
          <CampoPin rotulo="PIN com que o backup foi criado" valor={pinBackup} onChange={setPinBackup} />
          <button type="button" disabled={pinBackup.length < 4} className={btn} onClick={() => void importar(pendente, pinBackup)}>Importar com este PIN</button>
        </div>
      )}
      <p className="text-caption text-subtle">Importar mescla: pacientes mais novos substituem os iguais; nada é apagado.</p>
      <Aviso m={msg} />
    </Card>
  );
}

function Retencao({ prefs, onSalvar }: { prefs: Preferencias; onSalvar: (p: Preferencias) => void }) {
  return (
    <Card titulo="Privacidade">
      <Segmentado
        rotulo="Apagar paciente sem uso há…"
        valor={String(prefs.retencaoDias)}
        onChange={(v) => v && onSalvar({ ...prefs, retencaoDias: Number(v) })}
        opcoes={[{ valor: "0", texto: "Nunca" }, { valor: "7", texto: "7 dias" }, { valor: "14", texto: "14 dias" }, { valor: "30", texto: "30 dias" }]}
      />
      <Segmentado
        rotulo="Bloquear com PIN após inatividade"
        valor={String(prefs.bloqueioMin)}
        onChange={(v) => v && onSalvar({ ...prefs, bloqueioMin: Number(v) })}
        opcoes={[{ valor: "0", texto: "Ao sair do app" }, { valor: "2", texto: "2 min" }, { valor: "5", texto: "5 min" }, { valor: "15", texto: "15 min" }]}
      />
      <p className="text-caption text-subtle">A limpeza automática roda ao abrir o app e apaga paciente e histórico. O bloqueio só vale com PIN ativo.</p>
    </Card>
  );
}

function ApagarTudo({ onApagado }: { onApagado: () => void }) {
  const [t, setT] = useState("");
  return (
    <Card titulo="Apagar tudo">
      <p className="text-body-sm text-muted">Remove pacientes, histórico, PIN e preferências deste aparelho. Não dá para desfazer. Digite <strong>APAGAR</strong> para liberar.</p>
      <input value={t} onChange={(e) => setT(e.target.value)} autoComplete="off" autoCapitalize="characters" className="campo" aria-label="Confirmação" />
      <button type="button" disabled={t !== "APAGAR"} onClick={async () => { await cofre.apagarTudo(); onApagado(); }} className="btn btn-perigo px-4">
        Apagar tudo agora
      </button>
    </Card>
  );
}

export function Ajustes({
  estado,
  prefs,
  persistente,
  cfgServico,
  onCfgServico,
  tema,
  onTema,
  onPrefs,
  onMudou,
  onApagado,
}: {
  estado: EstadoCofre;
  prefs: Preferencias;
  persistente: boolean | null;
  cfgServico: Cfg;
  onCfgServico: (c: Cfg) => void;
  tema: Tema;
  onTema: (t: Tema) => void;
  onPrefs: (p: Preferencias) => void;
  onMudou: () => void;
  onApagado: () => void;
}) {
  return (
    <div className="space-y-4">
      <ConfigServico key={JSON.stringify(cfgServico)} cfg={cfgServico} onSalvar={onCfgServico} />
      <CartaoTema tema={tema} onTema={onTema} />
      <Seguranca estado={estado} onMudou={onMudou} />
      <Backup estado={estado} onMudou={onMudou} />
      <Retencao prefs={prefs} onSalvar={onPrefs} />
      <Card titulo="Armazenamento">
        <p className="text-body-sm text-muted">
          {persistente === true && "Armazenamento protegido contra limpeza automática do navegador."}
          {persistente === false && "O navegador pode apagar estes dados se faltar espaço (o iOS limpa sites sem uso por 7 dias). Instale na Tela de Início e faça backups."}
          {persistente === null && "Verificando…"}
        </p>
      </Card>
      <ComoInstalar />
      <ApagarTudo onApagado={onApagado} />
    </div>
  );
}
