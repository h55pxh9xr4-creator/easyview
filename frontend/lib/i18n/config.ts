"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import ko from "./locales/ko.json";
import en from "./locales/en.json";

export const SUPPORTED_LANGS = ["ko", "en"] as const;
export type Lang = typeof SUPPORTED_LANGS[number];

export const LANG_LABELS: Record<Lang, string> = {
  ko: "한국어",
  en: "English",
};

// SSR-safe: 브라우저에서만 detector 사용
const isBrowser = typeof window !== "undefined";

if (!i18n.isInitialized) {
  const chain = i18n.use(initReactI18next);
  if (isBrowser) chain.use(LanguageDetector);
  chain.init({
    resources: {
      ko: { translation: ko },
      en: { translation: en },
    },
    fallbackLng: "ko",
    supportedLngs: SUPPORTED_LANGS,
    interpolation: { escapeValue: false },
    detection: isBrowser
      ? {
          // sessionStorage에 수동 선택 저장 → 재방문 시 유지
          order: ["localStorage", "navigator"],
          lookupLocalStorage: "ev_lang",
          caches: ["localStorage"],
        }
      : undefined,
    react: { useSuspense: false },
  });
}

export default i18n;
