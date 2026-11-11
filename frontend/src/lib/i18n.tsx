"use client";
import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

export type Lang = "en" | "ur";

const STR = {
  tagline: { en: "Before you pay, let Roshni check it.", ur: "پیسے دینے سے پہلے، روشنی سے چیک کروائیں۔" },
  sub: {
    en: "An independent second opinion on your solar or battery quote, for Pakistani homes. We sell nothing and earn no commission.",
    ur: "پاکستانی گھروں کے لیے سولر یا بیٹری کوٹیشن پر آزاد دوسری رائے۔ ہم کچھ نہیں بیچتے اور کوئی کمیشن نہیں لیتے۔",
  },
  checkQuote: { en: "Check my quote", ur: "میری کوٹیشن چیک کریں" },
  checkQuoteD: { en: "Upload a photo, PDF or paste the WhatsApp text. Get risks, real savings and questions to ask.", ur: "تصویر، PDF یا میسج کا متن دیں۔ خطرات، اصل بچت اور انسٹالر سے پوچھنے کے سوال پائیں۔" },
  decodeBill: { en: "Decode my bill", ur: "اپنا بل سمجھیں" },
  decodeBillD: { en: "Every line explained, how close you are to 200 units, and what solar can't remove.", ur: "ہر لائن کی وضاحت، 200 یونٹ کی حد سے کتنے دور ہیں، اور سولر کیا کم نہیں کر سکتا۔" },
  battery: { en: "Should I add a battery?", ur: "کیا بیٹری لگوانی چاہیے؟" },
  batteryD: { en: "For existing solar homes: value under net billing and backup hours.", ur: "موجودہ سولر گھروں کے لیے: نیٹ بلنگ میں فائدہ اور بیک اپ کے گھنٹے۔" },
  learn: { en: "Bijli gayi to kya hoga?", ur: "بجلی گئی تو کیا ہوگا؟" },
  learnD: { en: "On-grid vs hybrid in load-shedding, a backup simulator and simple lessons.", ur: "لوڈشیڈنگ میں آن گرڈ اور ہائبرڈ کا فرق، بیک اپ سمیولیٹر اور آسان اسباق۔" },
  askMadadgar: { en: "Ask Madadgar", ur: "مددگار سے پوچھیں" },
  next: { en: "Next", ur: "آگے" },
  back: { en: "Back", ur: "پیچھے" },
  skip: { en: "Skip", ur: "چھوڑیں" },
  working: { en: "Working…", ur: "کام جاری ہے…" },
  disclaimer: {
    en: "Roshni provides decision support, not a design certificate. Final design and installation must be done and checked by a qualified installer.",
    ur: "روشنی فیصلے میں مدد دیتی ہے، ڈیزائن سرٹیفکیٹ نہیں۔ حتمی ڈیزائن اور تنصیب کسی مستند انسٹالر سے کروائیں اور چیک کروائیں۔",
  },
} as const;

export type Key = keyof typeof STR;

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({
  lang: "en", setLang: () => {}, t: (k) => STR[k].en,
});

// Tiny external store so the saved language survives reloads without setState-in-effect.
const listeners = new Set<() => void>();
let current: Lang | null = null;
function read(): Lang {
  if (current) return current;
  try { const l = localStorage.getItem("roshni-lang"); current = l === "ur" ? "ur" : "en"; } catch { current = "en"; }
  return current;
}
function write(l: Lang) {
  current = l;
  try { localStorage.setItem("roshni-lang", l); } catch {}
  listeners.forEach((fn) => fn());
}
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export function LangProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribe, read, () => "en" as Lang);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ur" ? "rtl" : "ltr";
  }, [lang]);
  const setLang = write;
  return <Ctx.Provider value={{ lang, setLang, t: (k) => STR[k][lang] }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
