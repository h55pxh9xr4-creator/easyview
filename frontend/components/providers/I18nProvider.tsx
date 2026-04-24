"use client";

import { useEffect, useState } from "react";
import i18n from "@/lib/i18n/config";

/**
 * i18next 초기화를 클라이언트에서 보장하고,
 * 첫 렌더 전에 언어 감지가 끝나도록 기다림.
 */
export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(i18n.isInitialized);

  useEffect(() => {
    if (i18n.isInitialized) {
      setReady(true);
      return;
    }
    const on = () => setReady(true);
    i18n.on("initialized", on);
    return () => { i18n.off("initialized", on); };
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}
