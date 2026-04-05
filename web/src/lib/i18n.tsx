"use client";
import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import en from "@/i18n/messages/en.json";
import zh from "@/i18n/messages/zh.json";

type Messages = typeof en;

const messagesMap: Record<string, Messages> = { en, zh };

const I18nContext = createContext<{ locale: string; messages: Messages }>({
  locale: "en",
  messages: en,
});

export function I18nProvider({ locale, children }: { locale: string; children: ReactNode }) {
  const [messages, setMessages] = useState(messagesMap[locale] || en);

  useEffect(() => {
    setMessages(messagesMap[locale] || en);
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, messages }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslations(namespace?: string) {
  const { messages } = useContext(I18nContext);
  return (key: string) => {
    try {
      const keys = key.split(".");
      let value: any = messages;
      for (const k of keys) {
        value = value?.[k];
      }
      return value || key;
    } catch {
      return key;
    }
  };
}

export function useLocale() {
  return useContext(I18nContext).locale;
}
