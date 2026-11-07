import { useState } from "react";
import { calcularDiaDeVida } from "../core/tempo";
import type { Paciente } from "../db/modelos";
import { parseNascimento, validarIdentificacao } from "../db/validacao";
import { Card } from "./campos";
import { IcAvancar, IcGota, IcLivro, IcMais, IcRaio } from "./icones";

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
        <div className="faixa faixa-atencao block">
          Os dados deste aparelho ainda não têm PIN. Ative em <strong>Ajustes → Segurança</strong> para cifrá-los.
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onNovo} className="btn btn-primary h-14"><IcMais />Novo paciente</button>
        <button type="button" onClick={onRapido} className="btn btn-neutro h-14"><IcRaio />Cálculo rápido</button>
        <button type="button" onClick={onHipo} className="btn btn-perigo-contorno"><IcGota />Hipoglicemia</button>
        <button type="button" onClick={onRefs} className="btn btn-contorno"><IcLivro />Referências</button>
      </div>
      <p className="text-caption text-subtle -mt-1">Cálculo rápido não salva nada no aparelho.</p>
      {pacientes.length === 0 ? (
        <Card titulo="Pacientes">
          <p className="text-body-sm text-muted">Nenhum paciente salvo. Cadastre só leito e iniciais.</p>
        </Card>
      ) : (
        <section aria-label="Pacientes salvos" className="space-y-2">
          <h2 className="card-titulo px-1">Pacientes · {pacientes.length}</h2>
          <ul className="card !p-0 overflow-hidden divide-y divide-border">
            {pacientes.map((p) => {
              const d = diaDoPaciente(p, agora);
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => onAbrir(p.id)} className="w-full text-left px-4 py-3 min-h-16 flex items-center gap-3 active:bg-surface-2 transition-colors">
                    <span className="num shrink-0 grid place-items-center size-11 rounded-full bg-primary-soft text-primary text-body-sm font-bold">{d != null ? `D${d}` : "—"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-semibold truncate">{p.leito} · {p.iniciais}</span>
                      <span className="block text-caption text-subtle">atualizado {dataHora(p.atualizadoEm)}</span>
                    </span>
                    <IcAvancar className="size-5 text-subtle shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
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

  const campo = "campo";
  return (
    <Card titulo={inicial ? "Editar paciente" : "Novo paciente"}>
      <p className="text-body-sm text-muted">Guarde só <strong>leito e iniciais</strong>. Nunca nome completo, prontuário ou CPF.</p>
      <label className="block">
        <span className="rotulo">Leito</span>
        <input className={campo} value={leito} onChange={(e) => setLeito(e.target.value)} maxLength={12} autoComplete="off" placeholder="UTIN 3" />
        {tentou && erros.leito && <span role="alert" className="text-caption text-danger">{erros.leito}</span>}
      </label>
      <label className="block">
        <span className="rotulo">Iniciais</span>
        <input className={campo} value={iniciais} onChange={(e) => setIniciais(e.target.value)} maxLength={8} autoComplete="off" autoCapitalize="characters" placeholder="M.S." />
        {tentou && erros.iniciais && <span role="alert" className="text-caption text-danger">{erros.iniciais}</span>}
      </label>
      <label className="block">
        <span className="rotulo">Data e hora de nascimento (opcional)</span>
        <input className={campo} type="datetime-local" value={nasc} onChange={(e) => setNasc(e.target.value)} max={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} />
        <span className="text-caption text-subtle">Com a data/hora, o dia de vida é calculado sozinho (D1 = primeiras 24 h).</span>
        {nascInvalido && <span role="alert" className="block text-caption text-danger">Data/hora inválida ou no futuro.</span>}
      </label>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={onCancelar} className="btn btn-neutro">Cancelar</button>
        <button
          type="button"
          onClick={() => {
            setTentou(true);
            if (ok) onSalvar({ leito: leito.trim(), iniciais: iniciais.trim(), nascimento: nasc || null });
          }}
          className="btn btn-primary"
        >
          Salvar
        </button>
      </div>
      {onApagar && (
        <div className="border-t border-border pt-3 space-y-2">
          {!confirmaApagar ? (
            <button type="button" onClick={() => setConfirmaApagar(true)} className="btn btn-perigo-contorno w-full">
              Dar alta / apagar paciente
            </button>
          ) : (
            <>
              <p role="alert" className="aviso aviso-perigo">Apaga o paciente e todo o histórico dele deste aparelho. Não dá para desfazer.</p>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setConfirmaApagar(false)} className="btn btn-neutro">Voltar</button>
                <button type="button" onClick={onApagar} className="btn btn-perigo">Apagar</button>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
