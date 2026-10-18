"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";
import { locales } from "@/i18n/config";
import { useI18n } from "@/i18n/dictionary-provider";
import { rememberLocale } from "@/i18n/remember-locale";

export function LanguagePicker() {
  const { locale, dict } = useI18n();
  const pathname = usePathname();
  const restOfPath = pathname.slice(`/${locale}`.length);

  return (
    <ul className="divide-y divide-separator">
      {locales.map((option) => {
        const selected = option === locale;
        return (
          <li key={option}>
            <Link
              href={`/${option}${restOfPath}`}
              hrefLang={option}
              lang={option}
              aria-current={selected ? "true" : undefined}
              onClick={() => rememberLocale(option)}
              className="flex min-h-12 items-center justify-between px-4 text-[17px] transition-colors first:rounded-t-card last:rounded-b-card hover:bg-fill"
            >
              {dict.settings.languageNames[option]}
              {selected && <Check aria-hidden size={20} className="text-accent" />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
