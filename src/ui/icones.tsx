/** Ícones de linha do NeoW (24 × 24, traço na cor do texto). Decorativos: o texto ao lado ou o aria-label diz o que é. */
import type { ReactNode } from "react";

function Svg({ children, className = "size-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden focusable="false">
      {children}
    </svg>
  );
}

type P = { className?: string };

export const IcVoltar = (p: P) => <Svg {...p}><path d="m15 18-6-6 6-6" /></Svg>;
export const IcAvancar = (p: P) => <Svg {...p}><path d="m9 18 6-6-6-6" /></Svg>;
export const IcLapis = (p: P) => <Svg {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></Svg>;
export const IcCopiar = (p: P) => <Svg {...p}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Svg>;
export const IcCheck = (p: P) => <Svg {...p}><path d="M20 6 9 17l-5-5" /></Svg>;
export const IcAlerta = (p: P) => <Svg {...p}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></Svg>;
export const IcErro = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></Svg>;
export const IcInfo = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></Svg>;
export const IcCadeado = (p: P) => <Svg {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Svg>;
export const IcAjustes = (p: P) => <Svg {...p}><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></Svg>;
export const IcMais = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IcRaio = (p: P) => <Svg {...p}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" /></Svg>;
export const IcLivro = (p: P) => <Svg {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></Svg>;
export const IcGota = (p: P) => <Svg {...p}><path d="M12 2.7 17.7 8.4a8 8 0 1 1-11.3 0Z" /></Svg>;
export const IcFicha = (p: P) => <Svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></Svg>;
