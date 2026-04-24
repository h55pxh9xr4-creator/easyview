"use client";

import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGS, LANG_LABELS, type Lang } from "@/lib/i18n/config";

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = (i18n.language?.split("-")[0] ?? "ko") as Lang;

  return (
    <select
      value={current}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      title={t("header.language", "Language")}
      style={{
        padding: "4px 8px",
        fontSize: 12,
        fontWeight: 500,
        background: "transparent",
        color: "inherit",
        border: "1px solid rgba(128,128,128,0.3)",
        borderRadius: 4,
        cursor: "pointer",
        fontFamily: "inherit",
        outline: "none",
      }}
    >
      {SUPPORTED_LANGS.map((lang) => (
        <option key={lang} value={lang}>{LANG_LABELS[lang]}</option>
      ))}
    </select>
  );
}
