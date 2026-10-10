"use client";

/**
 * Reemplazo propio de window.confirm/window.prompt.
 *
 * Los dialogos nativos del navegador muestran el dominio ("sinka-eight.
 * vercel.app dice...") y no se pueden estilizar — rompen la sensacion de
 * app propia justo en el momento de una accion importante (reportar,
 * disolver un grupo, salir de una sesion). Este provider monta UN modal
 * compartido para toda la app y expone useConfirm(), que cualquier
 * pantalla usa para pedir confirmacion o un texto corto sin salirse del
 * estilo de SINKA.
 *
 * Uso:
 *   const { confirm, prompt } = useConfirm();
 *   if (!(await confirm("¿Seguro?"))) return;
 *   const motivo = await prompt("¿Por qué...?");  // null si cancela
 */
import { createContext, useCallback, useContext, useState } from "react";
import { color, radius, shadow, fontSerif } from "@/lib/theme";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PromptOptions {
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

type Dialogo =
  | { kind: "confirm"; options: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "prompt"; options: PromptOptions; resolve: (v: string | null) => void };

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  prompt: (options: PromptOptions | string) => Promise<string | null>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm() se usa dentro de <ConfirmProvider> (ya esta en layout.tsx).");
  }
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [valor, setValor] = useState("");

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const opts = typeof options === "string" ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      setDialogo({ kind: "confirm", options: opts, resolve });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions | string) => {
    const opts = typeof options === "string" ? { message: options } : options;
    setValor(opts.defaultValue ?? "");
    return new Promise<string | null>((resolve) => {
      setDialogo({ kind: "prompt", options: opts, resolve });
    });
  }, []);

  const cerrar = (aceptado: boolean) => {
    if (!dialogo) return;
    if (dialogo.kind === "confirm") {
      dialogo.resolve(aceptado);
    } else {
      dialogo.resolve(aceptado ? valor : null);
    }
    setDialogo(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm, prompt }}>
      {children}
      {dialogo && (
        <div style={s.overlay} onClick={() => cerrar(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <p style={s.message}>
              {dialogo.options.title && <strong style={s.title}>{dialogo.options.title}</strong>}
              {dialogo.options.message}
            </p>

            {dialogo.kind === "prompt" && (
              <input
                autoFocus
                style={s.input}
                placeholder={dialogo.options.placeholder}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") cerrar(true); }}
              />
            )}

            <div style={s.actions}>
              <button style={s.cancelBtn} onClick={() => cerrar(false)}>
                {dialogo.options.cancelLabel ?? "Cancelar"}
              </button>
              <button
                autoFocus={dialogo.kind === "confirm"}
                style={{
                  ...s.confirmBtn,
                  ...(dialogo.kind === "confirm" && dialogo.options.danger ? s.confirmBtnDanger : {}),
                }}
                onClick={() => cerrar(true)}
              >
                {dialogo.options.confirmLabel ?? "Aceptar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 2000, padding: 20,
  },
  modal: {
    background: color.surface, borderRadius: radius.lg, padding: 22,
    maxWidth: 380, width: "100%", boxShadow: shadow.raised,
    border: `1px solid ${color.border}`,
  },
  title: { display: "block", fontFamily: fontSerif, fontSize: 16, marginBottom: 6, color: color.text },
  message: { color: color.text, fontSize: 14, lineHeight: 1.6, margin: "0 0 16px" },
  input: {
    width: "100%", padding: "10px 12px", borderRadius: radius.sm,
    border: `1px solid ${color.border}`, background: color.bg, color: color.text,
    fontSize: 14, marginBottom: 16, boxSizing: "border-box",
  },
  actions: { display: "flex", justifyContent: "flex-end", gap: 10 },
  cancelBtn: {
    padding: "8px 16px", borderRadius: radius.sm, border: `1px solid ${color.border}`,
    background: "none", color: color.textMuted, cursor: "pointer", fontSize: 13,
  },
  confirmBtn: {
    padding: "8px 18px", borderRadius: radius.sm, border: "none",
    background: color.moss, color: color.bg, cursor: "pointer", fontSize: 13, fontWeight: 600,
  },
  confirmBtnDanger: { background: color.accent },
};
