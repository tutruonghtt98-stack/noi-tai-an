"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { CircleCheck, CircleAlert } from "lucide-react";

type Toast = { id: number; kind: "success" | "error"; text: string };
const ToastCtx = createContext<(kind: Toast["kind"], text: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-8"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="rise pointer-events-auto flex max-w-md items-center gap-3 rounded-full bg-ink px-5 py-3 text-sm font-medium text-bg shadow-pop"
          >
            {t.kind === "success" ? (
              <CircleCheck className="size-5 text-jade" aria-hidden />
            ) : (
              <CircleAlert className="size-5 text-rose" aria-hidden />
            )}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
