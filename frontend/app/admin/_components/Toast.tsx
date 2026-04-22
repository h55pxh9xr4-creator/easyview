"use client";

import { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  exiting?: boolean;
}

let toastId = 0;
let addToastFn: ((message: string, type: ToastType) => void) | null = null;

export function showToast(message: string, type: ToastType = "success") {
  if (addToastFn) addToastFn(message, type);
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    addToastFn = (message, type) => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300);
      }, 3000);
    };
    return () => { addToastFn = null; };
  }, []);

  const bgMap: Record<ToastType, string> = { success: "bg-green-500", error: "bg-red-500", info: "bg-blue-500", warning: "bg-yellow-500" };
  const iconMap: Record<ToastType, string> = { success: "✓", error: "✕", info: "i", warning: "!" };

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div key={toast.id} className={`${toast.exiting ? "toast-exit" : "toast-enter"} flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white ${bgMap[toast.type]} min-w-[300px]`}>
          <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">{iconMap[toast.type]}</span>
          <span className="text-sm">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
