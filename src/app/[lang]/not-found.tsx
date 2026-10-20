import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";

export default async function NotFound() {
  const locale = await getLocale();
  const dict = await getDictionary();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-[28px] font-bold tracking-tight">{dict.notFound.title}</h1>
      <Link
        href={`/${locale}`}
        className="flex min-h-11 items-center rounded-full bg-accent px-6 text-[17px] font-semibold text-accent-contrast shadow-[0_6px_16px_color-mix(in_oklab,var(--accent)_28%,transparent),inset_0_1px_0_rgb(255_255_255/0.28)] transition-transform active:scale-95"
      >
        {dict.notFound.back}
      </Link>
    </main>
  );
}
