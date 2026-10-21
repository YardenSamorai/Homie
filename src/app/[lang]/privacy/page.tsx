import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { HomieMark } from "@/components/brand/homie-mark";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).privacyPage.title };
}

/** Public, without signing in: the App Store and anyone deciding whether to join link here. */
export default async function PrivacyPage() {
  const dict = await getDictionary();
  const locale = await getLocale();
  const copy = dict.privacyPage;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 bg-bg px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Link href={`/${locale}/settings`} className="flex min-h-11 items-center gap-1 self-start text-[17px] text-accent active:opacity-60">
        <ChevronRight aria-hidden size={22} className="ltr:-scale-x-100" />
        {copy.back}
      </Link>
      <header className="flex flex-col gap-3">
        <HomieMark size={56} />
        <h1 className="text-[34px] font-bold leading-tight tracking-tight">{copy.title}</h1>
        <p className="text-[15px] text-label-secondary">{copy.updated}</p>
      </header>
      {copy.sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="text-[20px] font-semibold tracking-tight">{section.title}</h2>
          <p className="text-[17px] leading-relaxed text-label/[0.82]">{section.body}</p>
        </section>
      ))}
    </main>
  );
}
