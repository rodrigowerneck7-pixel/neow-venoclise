import { useEffect, useState } from "react";
import { IcCadeado } from "./icones";

export function CampoPin({ rotulo, valor, onChange, autoFocus }: { rotulo: string; valor: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <label className="block">
      <span className="rotulo">{rotulo}</span>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        maxLength={12}
        value={valor}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        className="campo num text-input text-center tracking-[0.5em]"
      />
    </label>
  );
}

/** Tela de PIN. Após erros seguidos, espera um pouco antes de aceitar nova tentativa. */
export function Bloqueio({ onDesbloquear }: { onDesbloquear: (pin: string) => Promise<boolean> }) {
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState(false);
  const [falhas, setFalhas] = useState(0);
  const [espera, setEspera] = useState(0);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const tentar = async () => {
    if (ocupado || espera > 0 || pin.length < 4) return;
    setOcupado(true);
    const ok = await onDesbloquear(pin);
    setOcupado(false);
    if (!ok) {
      const f = falhas + 1;
      setFalhas(f);
      setErro(true);
      setPin("");
      if (f >= 3) setEspera(Math.min(2 ** (f - 2), 30));
    }
  };

  return (
    <div className="min-h-dvh bg-bg text-text flex flex-col items-center justify-center px-6 gap-5">
      <span className="grid place-items-center size-16 rounded-full bg-primary-soft text-primary" aria-hidden>
        <IcCadeado className="size-7" />
      </span>
      <div className="text-center space-y-1">
        <h1 className="text-title"><span className="font-bold">NeoW</span> <span className="font-normal text-muted">Venóclise</span></h1>
        <p className="text-body-sm text-muted">Digite o PIN para abrir os pacientes salvos.</p>
      </div>
      <form
        className="w-full max-w-xs space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void tentar();
        }}
      >
        <CampoPin rotulo="PIN" valor={pin} onChange={(v) => { setPin(v); setErro(false); }} autoFocus />
        {erro && <p role="alert" className="aviso aviso-perigo">PIN incorreto.{espera > 0 ? ` Aguarde ${espera} s.` : ""}</p>}
        <button type="submit" disabled={pin.length < 4 || espera > 0 || ocupado} className="btn btn-primary w-full h-13">
          {ocupado ? "Abrindo…" : "Desbloquear"}
        </button>
      </form>
      <p className="text-caption text-subtle text-center max-w-xs">Sem o PIN não há como recuperar os dados salvos neste aparelho. Mantenha um backup.</p>
    </div>
  );
}
