import { useState } from "react";
import { calcularDiaDeVida } from "../core/tempo";
import type { Paciente } from "../db/modelos";
import { parseNascimento, validarIdentificacao } from "../db/validacao";
import { Card } from "./campos";

export function diaDoPaciente(p: Pick<Paciente, "nascimento" | "entrada" | "ficha">, agora: Date): number | null {
  const n = parseNascimento(p.nascimento);
  return n ? calcularDiaDeVida(n, agora) : ((p.ficha ?? p.entrada).diaDeVida ?? null);
}

const dataHora = (t: number) =>
  new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function ListaPacientes({
  pacientes,
  agora,
  onAbrir,
  onNovo,
  onRapido,
  onHipo,
  onRefs,
  avisoPin,
}: {
  pacientes: Paciente[];
  agora: Date;
  onAbrir: (id: string) => void;
  onNovo: () => void;
  onRapido: () => void;
  onHipo: () => void;
  onRefs: () => void;
  avisoPin: boolean;
}) {
  return (
    <div className="space-y-4">
      {avisoPin && (
        <div className="rounded-md border border-warning bg-warning-soft px-3 py-2 text-body-sm">
          Os dados deste aparelho ainda não têm PIN. Ative em <strong>Ajustes → Segurança</strong> para cifrá-los.
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={onNovo} className="tap rounded-sm bg-primary text-on-primary font-semibold">Novo paciente</button>
        <button type="button" onClick={onRapido} className="tap rounded-sm bg-surface-2 border border-border font-semibold">Cálculo rápido</button>
      </div>
      <p className="text-caption text-subtle">Cálculo rápido não salva nada no aparelho.</p>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={onHipo} className="tap rounded-sm border border-danger text-danger font-semibold">Hipoglicemia</button>
        <button type="button" onClick={onRefs} className="tap rounded-sm bg-surface-2 border border-border font-semibold">Referências</button>
      </div>
      {pacientes.length === 0 ? (
        <Card titulo="Pacientes">
          <p className="text-body-sm text-muted">Nenhum paciente salvo. Cadastre só leito e iniciais.</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {pacientes.map((p) => {
            const d = diaDoPaciente(p, agora);
            return (
              <li key={p.id}>
                <button type="button" onClick={() => onAbrir(p.id)} className="w-full text-left rounded-lg bg-surface border border-border shadow-card p-4 tap flex items-center justify-between gap-3">
                  <div>
                    <div className="text-heading">{p.leito} · {p.iniciais}</div>
                    <div className="text-caption text-subtle">atualizado {dataHora(p.atualizadoEm)}</div>
                  </div>
                  <div className="num text-heading text-primary">{d != null ? `D${d}` : "—"}</div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function FormPaciente({
  inicial,
  onSalvar,
  onCancelar,
  onApagar,
}: {
  inicial?: Paciente;
  onSalvar: (v: { leito: string; iniciais: string; nascimento: string | null }) => void;
  onCancelar: () => void;
  onApagar?: () => void;
}) {
  const [leito, setLeito] = useState(inicial?.leito ?? "");
  const [iniciais, setIniciais] = useState(inicial?.iniciais ?? "");
  const [nasc, setNasc] = useState(inicial?.nascimento ?? "");
  const [tentou, setTentou] = useState(false);
  const [confirmaApagar, setConfirmaApagar] = useState(false);
  const erros = validarIdentificacao(leito, iniciais);
  const nascInvalido = nasc !== "" && (!parseNascimento(nasc) || parseNascimento(nasc)!.getTime() > Date.now());
  const ok = !erros.leito && !erros.iniciais && !nascInvalido;

  const campo = "w-full rounded-sm bg-surface-2 border border-border focus:border-focus outline-none px-3 text-input control-h";
  return (
    <Card titulo={inicial ? "Editar paciente" : "Novo paciente"}>
      <p className="text-body-sm text-muted">Guarde só <strong>leito e iniciais</strong>. Nunca nome completo, prontuário ou CPF.</p>
      <label className="block">
        <span className="block text-body-sm text-muted mb-1">Leito</span>
        <input className={campo} value={leito} onChange={(e) => setLeito(e.target.value)} maxLength={12} autoComplete="off" placeholder="UTIN 3" />
        {tentou && erros.leito && <span role="alert" className="text-caption text-danger">{erros.leito}</span>}
      </label>
      <label className="block">
        <span className="block text-body-sm text-muted mb-1">Iniciais</span>
        <input className={campo} value={iniciais} onChange={(e) => setIniciais(e.target.value)} maxLength={8} autoComplete="off" autoCapitalize="characters" placeholder="M.S." />
        {tentou && erros.iniciais && <span role="alert" className="text-caption text-danger">{erros.iniciais}</span>}
      </label>
      <label className="block">
        <span className="block text-body-sm text-muted mb-1">Data e hora de nascimento (opcional)</span>
        <input className={campo} type="datetime-local" value={nasc} onChange={(e) => setNasc(e.target.value)} max={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} />
        <span className="text-caption text-subtle">Com a data/hora, o dia de vida é calculado sozinho (D1 = primeiras 24 h).</span>
        {nascInvalido && <span role="alert" className="block text-caption text-danger">Data/hora inválida ou no futuro.</span>}
      </label>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={onCancelar} className="tap rounded-sm bg-surface-2 border border-border font-semibold">Cancelar</button>
        <button
          type="button"
          onClick={() => {
            setTentou(true);
            if (ok) onSalvar({ leito: leito.trim(), iniciais: iniciais.trim(), nascimento: nasc || null });
          }}
          className="tap rounded-sm bg-primary text-on-primary font-semibold"
        >
          Salvar
        </button>
      </div>
      {onApagar && (
        <div className="border-t border-border pt-3 space-y-2">
          {!confirmaApagar ? (
            <button type="button" onClick={() => setConfirmaApagar(true)} className="tap w-full rounded-sm border border-danger text-danger font-semibold">
              Dar alta / apagar paciente
            </button>
          ) : (
            <>
              <p role="alert" className="text-body-sm text-danger">Apaga o paciente e todo o histórico dele deste aparelho. Não dá para desfazer.</p>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setConfirmaApagar(false)} className="tap rounded-sm bg-surface-2 border border-border font-semibold">Voltar</button>
                <button type="button" onClick={onApagar} className="tap rounded-sm bg-danger text-on-primary font-semibold">Apagar</button>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
