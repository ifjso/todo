"use client";

import { useEffect, type ReactNode } from "react";
import { iconButtonClass } from "./styles";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ open, title, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-md bg-canvas shadow-float sm:max-w-xl sm:rounded-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 grid grid-cols-[2rem_1fr_2rem] items-center border-b border-hairline bg-canvas px-6 py-4">
          <button type="button" onClick={onClose} aria-label="닫기" className={iconButtonClass}>
            ✕
          </button>
          <h2 className="text-center text-base font-semibold text-ink">{title}</h2>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
