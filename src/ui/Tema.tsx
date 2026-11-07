import { useEffect, useState } from "react";
import { Card, Segmentado } from "./campos";

export type Tema = "system" | "light" | "dark";
const CHAVE = "neow.theme";

export function lerTema(): Tema {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function aplicarTema(t: Tema) {
  const escuro = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", escuro);
}

export function useTema(): [Tema, (t: Tema) => void] {
  const [t, setT] = useState<Tema>(lerTema);
  useEffect(() => {
    aplicarTema(t);
    if (t !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const f = () => aplicarTema("system");
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, [t]);
  const set = (n: Tema) => {
    try {
      if (n === "system") localStorage.removeItem(CHAVE);
      else localStorage.setItem(CHAVE, n);
    } catch { /* sem storage: vale só nesta sessão */ }
    setT(n);
  };
  return [t, set];
}

export function CartaoTema({ tema, onTema }: { tema: Tema; onTema: (t: Tema) => void }) {
  return (
    <Card titulo="Aparência">
      <Segmentado
        valor={tema}
        onChange={(v) => v && onTema(v)}
        opcoes={[{ valor: "system", texto: "Automático" }, { valor: "light", texto: "Claro" }, { valor: "dark", texto: "Escuro" }]}
      />
    </Card>
  );
}
