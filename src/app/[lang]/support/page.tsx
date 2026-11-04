import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Mail } from "lucide-react";
import { HomieMark } from "@/components/brand/homie-mark";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).supportPage.title };
}

/** Public, without signing in: the App Store's support link. How to reach us, and answers to the usual questions. */
export default async function SupportPage() {
  const dict = await getDictionary();
  const locale = await getLocale();
  const copy = dict.supportPage;
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 bg-bg px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Link href={`/${locale}/settings`} className="flex min-h-11 items-center gap-1 self-start text-[17px] text-accent active:opacity-60">
        <ChevronRight aria-hidden size={22} className="ltr:-scale-x-100" />
        {copy.back}
      </Link>
      <header className="flex flex-col gap-3">
        <HomieMark size={56} />
        <h1 className="text-[34px] font-bold leading-tight tracking-tight">{copy.title}</h1>
        <p className="text-[17px] leading-relaxed text-label-secondary">{copy.lead}</p>
      </header>
      {email && (
        <a
          href={`mailto:${email}`}
          className="flex min-h-14 items-center gap-3 self-start rounded-full bg-accent px-5 text-[17px] font-semibold text-accent-contrast transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          <Mail aria-hidden size={20} />
          <bdi>{email}</bdi>
        </a>
      )}
      {copy.sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="text-[20px] font-semibold tracking-tight">{section.title}</h2>
          <p className="text-[17px] leading-relaxed text-label/[0.82]">{section.body}</p>
        </section>
      ))}
      <Link href={`/${locale}/privacy`} className="flex min-h-11 items-center self-start text-[17px] text-accent active:opacity-60">
        {copy.privacy}
      </Link>
    </main>
  );
}
