export const locales = ["he", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "he";

export const localeCookie = "homie_locale";

export const localeDirection: Record<Locale, "rtl" | "ltr"> = {
  he: "rtl",
  en: "ltr",
};

export function hasLocale(value: string | undefined): value is Locale {
  return locales.includes(value as Locale);
}
